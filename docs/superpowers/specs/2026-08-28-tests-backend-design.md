# Tests automatizados de backend — diseño

**Fecha:** 28/08/2026
**Origen:** Pendiente #21 de `CLAUDE.md` (auditoría de código del
27/08/2026) señala "cero tests automatizados en todo el repo" como
prioridad #2, justo detrás de la seguridad de credenciales. Primer
sub-proyecto de dos (el segundo, E2E con Playwright, se diseña aparte):
este cubre solo `functions/api/*.js` (Cloudflare Workers).

## Problema

Todo el QA del proyecto es manual en producción: cada sesión de trabajo
verifica los cambios a mano (a veces con Playwright contra
`boscoinventario.pages.dev`, con un usuario desechable). No queda nada
reutilizable — la próxima sesión vuelve a probar desde cero, y varios
bugs reales ya se colaron a producción por dependencias entre archivos
que nadie vio hasta que alguien lo probó a mano (`userUnlock`/
`importModulosCSV` sin endpoint en `ENDPOINT_MAP`, orden de
`checkAtencionHoy()` en `loadData()`, binds sin límite en `list.js`).
El deploy a Cloudflare Pages es automático en cada `git push` — no hay
ninguna red de seguridad entre "el código compila" y "está en
producción".

## Alcance

**Sí:**
- Suite de tests de `functions/api/*.js` con Vitest +
  `@cloudflare/vitest-pool-workers`, corriendo sobre D1 local
  (Miniflare/workerd), sin tocar la base remota `boscoinventario` en
  ningún momento.
- Migraciones reales (`migrations/00XX_*.sql`) aplicadas a la D1 local
  antes de cada suite, más un seed de test propio y mínimo.
- Alcance funcional v1: **auth + scoping por departamento** — la zona de
  mayor riesgo de seguridad y la que ya tuvo bugs reales de permisos.
- Workflow de GitHub Actions que corre `npm test` en cada push/PR a
  `main`, como check informativo (✅/❌), sin bloquear el deploy de
  Cloudflare Pages.
- `package.json` nuevo en la raíz del repo (no existe hoy).

**No:**
- No se tocan `functions/api/*.js` — es puramente aditivo, ningún
  comportamiento de producción cambia.
- No se tocan `js/*` (frontend) — eso es el segundo sub-proyecto (E2E).
- No se bloquea el deploy de Cloudflare Pages en esta fase — es una
  decisión explícita del usuario, revisable más adelante sin rehacer
  los tests ya escritos.
- No se cubren en v1: CRUD de inventario, préstamos, pedidos,
  solicitudes, Volt/intent-learning — quedan para una tanda posterior,
  con la infraestructura ya montada.
- No se usa D1 remota real ni cuentas de prueba en producción para estos
  tests — evita cualquier riesgo de tocar datos reales por un test mal
  escrito.

## Arquitectura y entorno

**Framework:** [Vitest](https://vitest.dev) +
[`@cloudflare/vitest-pool-workers`](https://developers.cloudflare.com/workers/testing/vitest-integration/) —
herramienta oficial de Cloudflare, corre el código real de
`functions/api/*.js` sobre el runtime real de Workers (workerd), no un
mock de Node. Es la opción recomendada por Cloudflare para testear
Pages Functions/Workers con bindings D1 reales (aunque locales).

**`package.json`** (nuevo, raíz del repo):

```json
{
  "name": "boscoinventario",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "vitest": "~1.6.0",
    "wrangler": "^3.80.0"
  }
}
```

**`vitest.config.ts`** (nuevo, raíz del repo):

```ts
import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersProject({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          d1Databases: ['DB'], // usa el binding DB ya definido en wrangler.toml, instancia local
        },
      },
    },
  },
});
```

El binding `DB` es el mismo nombre que usa `wrangler.toml` en
producción — así `functions/api/*.js` no necesita ningún cambio ni
detección especial de "modo test": recibe el mismo `env.DB` de siempre,
solo que apunta a una D1 local en vez de remota.

**Seed de test (`tests/backend/setup.ts`):** antes de cada suite,
aplica en orden todas las `migrations/00XX_*.sql` reales sobre la D1
local (mismo mecanismo que usa el proyecto para producción, así el
esquema de test nunca se desincroniza de una migración nueva sin que
alguien lo note — un test que falle por una migración con SQL inválido
es una señal útil, no ruido). Encima, un seed mínimo propio, aislado de
cualquier dato real:

- 2 departamentos de prueba (`test-dept-a`, `test-dept-b`) + el
  compartido `iesjuanbosco` (ya lo crea `0011_departamento_generico.sql`).
- 4 usuarios: `superadmin` de prueba, `jefe/a departamento` de
  `test-dept-a`, `profesor` de `test-dept-a`, `profesor` de
  `test-dept-b` — contraseñas hasheadas con la misma función PBKDF2 que
  usa `_middleware.js`, para poder loguear de verdad en los tests.
- 1-2 ítems de inventario por departamento de prueba, para los tests de
  scoping.

## Estructura de archivos

```
package.json
vitest.config.ts
tests/
  backend/
    setup.ts          — aplica migraciones + seed, expuesto como helper reusable
    auth.test.ts       — login correcto/incorrecto, bloqueo, password_temporal, token
    middleware.test.ts — resolución de data.user/data.departamento, rechazo sin credenciales
    scoping.test.ts    — aislamiento entre departamentos en list.js/item.js/prestar.js
.github/
  workflows/
    tests.yml
```

## Alcance v1 — casos de test

**`auth.test.ts`** (`functions/api/auth.js`, `_middleware.js`):
- Login con usuario/contraseña correctos → `ok:true` + `session_token`.
- Login con contraseña incorrecta → `ok:false`, sin exponer si el
  usuario existe o no.
- 5 intentos fallidos seguidos → cuenta bloqueada, el 6º intento
  correcto también falla hasta desbloqueo.
- Usuario con `password_temporal=1` → login correcto igual, pero el
  flag viaja en la respuesta (el frontend decide forzar cambio).
- `changePassword` limpia `password_temporal` y rota `session_token`.
- Petición con `t=` (token) inválido o caducado → rechazada.

**`middleware.test.ts`** (`functions/api/_middleware.js`):
- Con `u`+`p` válidos → `data.user`/`data.departamento` resueltos
  correctamente para el handler.
- Con `u`+`t` válidos (token) → mismo resultado.
- Sin credenciales, o credenciales inválidas → 401, el handler protegido
  nunca se ejecuta — verificado contra un endpoint real ya existente
  (`meta.js`, el más simple de los protegidos), no uno creado para el
  test.

**`scoping.test.ts`** (`list.js`, `item.js`, `prestar.js`):
- Profesor de `test-dept-a` lista inventario → solo ve ítems de
  `test-dept-a` + `iesjuanbosco`, nunca de `test-dept-b`.
- Profesor de `test-dept-a` intenta editar/borrar un ítem de
  `test-dept-b` por id → rechazado (403 o equivalente ya usado en el
  código real).
- Cualquier usuario autenticado puede crear/editar en `iesjuanbosco`
  (departamento compartido).
- `superadmin` ve y toca ítems de ambos departamentos de prueba sin
  restricción.
- Préstamo (`prestar.js`) de un ítem ajeno al departamento del actor →
  rechazado con el mismo criterio que list/item.

## CI — `.github/workflows/tests.yml`

```yaml
name: tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
```

Cloudflare Pages sigue desplegando automáticamente en cada push,
**en paralelo** a este workflow, sin depender de su resultado — decisión
explícita para no tocar el pipeline de deploy actual en esta fase. Un
test roto se ve como ❌ en GitHub (commit status / check), pero no
impide que el código llegue a producción. Pasar a bloqueo real más
adelante (Cloudflare Pages sin auto-deploy, GitHub Actions desplegando
con `wrangler pages deploy` solo si los tests pasan) es un cambio de
pipeline aparte, no de los tests en sí — no requiere rehacer nada de
esta fase.

## Seguridad

- La D1 de test es 100% local (Miniflare), nunca la remota — ningún
  test puede tocar datos reales de producción aunque falle mal.
- Los usuarios/contraseñas de test son ficticios, generados en el seed,
  y no coinciden con ninguna cuenta real documentada en `CLAUDE.md`.
- El seed hashea las contraseñas con la misma función PBKDF2 real (no
  un atajo en texto plano) — para que `auth.test.ts` ejercite el
  camino de verificación real, no una versión simplificada.

## Testing (de esta propia infraestructura)

1. `npm test` en local corre las 3 suites contra D1 local, sin red ni
   `wrangler login` — debe funcionar igual en cualquier PC nuevo tras
   `npm ci`, sin credenciales de Cloudflare.
2. Confirmar que `npm test` sigue pasando tras aplicar una migración
   nueva sin tocar `setup.ts` — valida que el seed no depende de un
   número de migración hardcodeado.
3. Provocar a propósito un fallo real (ej. comentar temporalmente el
   `WHERE departamento=?` de `list.js`) → el test de scoping
   correspondiente debe fallar — confirma que el test detecta el bug
   que dice detectar, no solo que "pasa en verde" sin ejercitar nada.
4. Push de prueba a una rama → confirmar que `.github/workflows/tests.yml`
   se dispara y reporta en GitHub, y que Cloudflare Pages despliega
   igualmente sin esperar a ese resultado.
