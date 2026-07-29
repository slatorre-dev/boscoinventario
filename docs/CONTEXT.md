# Contexto del Proyecto — Bosco Inventario

> Leer esto al inicio de cada sesión desde un PC nuevo.

## ¿Qué es esto?
Inventario general del **IES El Bosco**, con cada departamento gestionando
el suyo propio desde la misma app (ver
[PLAN_MULTIDEPARTAMENTO.md](PLAN_MULTIDEPARTAMENTO.md) para el estado de esa
migración). PWA con:
- **Frontend**: HTML/CSS/JS vanilla, Service Worker (`sw.js`)
- **Backend**: Cloudflare Pages Functions (`functions/api/`)
- **BD**: Cloudflare D1 (SQLite remoto) — base `boscoinventario`
- **Auth**: Login propio con sesión en `localStorage` (`inv_session`), más
  Google Sign-In para correos `@iesjuanbosco.es`

## URL de producción
`boscoinventario.pages.dev` en Cloudflare Pages. Cada `git push` a `main`
del repo `slatorre-dev/boscoinventario` despliega automáticamente.

## Flujo de trabajo
1. Editar código localmente
2. Subir `VERSION` en `sw.js`
3. `git push origin main` → despliega en Cloudflare Pages
4. Para SQL en BD remota: `npx wrangler d1 execute boscoinventario --remote --command="..."` (o `--file=migrations/XXXX.sql`)
5. `wrangler pages dev` sin `--remote` usa D1 **local**, no la real — útil solo para probar cambios de frontend sin tocar datos reales

## Roles del sistema
| Rol en BD | Se muestra como | Permisos |
|---|---|---|
| `superadmin` | `Jefe/a Departamento` (sin distintivo visible) | Ve y gestiona **todos** los departamentos |
| `jefe/a departamento` | `Jefe/a Departamento` | Acceso completo a su propio departamento |
| `profesor` | `Profesor/a` | Préstamos, edición básica, dentro de su departamento |
| `consulta` | `Consulta` | Solo lectura de su departamento |

Detalle de scoping por departamento (quién ve qué) en
[PLAN_MULTIDEPARTAMENTO.md](PLAN_MULTIDEPARTAMENTO.md) y en `claude.md`.

## Usuario admin
- Usuario `Admin` / contraseña `Admin`, rol `superadmin` — **cambiar la
  contraseña** en cuanto se reparta el acceso real.
- Cuentas de departamento de ejemplo: `departamento<slug>` (jefe/a
  departamento) y `profe1<slug>` (profesor), contraseña = usuario. Lista de
  `<slug>` en la tabla `departamentos` / `migrations/0007_departamentos.sql`.

## Archivos clave
- `js/roles.js` — lógica de roles y permisos
- `js/prestamos.js` — gestión de usuarios, préstamos
- `functions/api/_middleware.js` — autenticación + resolución de departamento
- `functions/api/usuarios.js` — CRUD usuarios (scoped por departamento)
- `functions/api/historial.js` — logs de auditoría (scoped por departamento)
- `sw.js` — Service Worker (versión de la app)
- `migrations/` — migraciones SQL (`0001`-`0006` esquema/seed original, `0007`-`0008` multi-departamento)

## Reglas de desarrollo
- **Siempre** subir versión en `sw.js` y hacer commit+push al final de cada sesión
- Commits atómicos con mensaje descriptivo
- Trabajar con BD remota (`--remote`), no local, salvo para pruebas de frontend puntuales
- `wrangler` necesita `wrangler login` interactivo (no funciona en shells no interactivas); si dice que la cuenta no tiene acceso al D1, borrar `.wrangler/cache/wrangler-account.json` (cachea la cuenta de una sesión anterior)

## Git remotes
- `origin` → `slatorre-dev/boscoinventario` — único remoto activo, aquí se hace push siempre
- `slatorre` → `slatorre-dev/SQLInventarioElecFP` — proyecto **distinto y no relacionado** (repo anterior de un solo departamento). No hacer push ahí, no tocar.

## Qué decir al iniciar sesión desde otro PC
"Estoy trabajando en Bosco Inventario (`boscoinventario`). Lee `claude.md` y
`docs/PLAN_MULTIDEPARTAMENTO.md` para ponerte al día. La BD es remota en
Cloudflare D1, base `boscoinventario`."
