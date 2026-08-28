# Tests automatizados de backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una suite de tests automatizados de `functions/api/*.js` (auth + scoping por departamento) que corre en local contra D1 simulada, sin tocar producción, y se reporta en GitHub Actions.

**Architecture:** `@cloudflare/vitest-plugin` (paquete oficial de Cloudflare para Vitest 4, sucesor de `@cloudflare/vitest-pool-workers`) ejecuta los tests dentro del runtime real de Workers (workerd/Miniflare) con un binding D1 local. Los handlers de `functions/api/*.js` se invocan **directamente por import** (no por HTTP) usando el helper oficial `createPagesEventContext()` — Pages Functions no es un único Worker con `fetch()`, así que no hay un `main` que compilar ni servidor que levantar; se llama a `onRequestGet`/`onRequestPost` tal cual, encadenando manualmente `_middleware.js` cuando el test necesita simular la resolución de autenticación real.

**Tech Stack:** Vitest 4, `@cloudflare/vitest-plugin`, D1 local (vía el mismo `wrangler.toml` que usa producción), GitHub Actions.

**Spec:** [docs/superpowers/specs/2026-08-28-tests-backend-design.md](../specs/2026-08-28-tests-backend-design.md)

## Global Constraints

- Ningún archivo de `functions/api/*.js` ni de `wrangler.toml` se modifica — todo lo nuevo es aditivo (`package.json`, `vitest.config.ts`, `tests/backend/*`, `.github/workflows/tests.yml`).
- Los tests nunca tocan la D1 remota `boscoinventario` — todo corre contra una D1 local (Miniflare), incluidas las migraciones reales.
- **Nota de implementación (ajuste sobre el spec, confirmado con un prototipo real antes de escribir este plan):** el spec hablaba de "correr sobre D1 local" sin fijar el mecanismo exacto de invocación HTTP. Investigando la API actual (`@cloudflare/vitest-plugin` 1.1.1, no `@cloudflare/vitest-pool-workers` que aparece en ejemplos antiguos — el paquete se renombró para Vitest 4) se confirmó empíricamente que:
  - No hace falta compilar `functions/` a un Worker (`main` es opcional) — **sí** hace falta declarar un binding de servicio `ASSETS` (`buildPagesASSETSBinding()`) o `createPagesEventContext()` lanza un error en tiempo de ejecución.
  - El **aislamiento de storage entre tests es por archivo de test, NO por cada `it()` individual** (confirmado con un prototipo: una fila insertada en un test seguía visible en el siguiente `it()` del mismo archivo). Por eso cada archivo de test que muta datos lleva su propio `beforeEach` que borra y vuelve a sembrar las filas de prueba — no basta con un `beforeAll`.
  - `readD1Migrations()` (helper oficial) lee cualquier `*.sql` de una carpeta y ordena por el prefijo numérico — hay que filtrar por `/^\d{4}_/` porque `migrations/` también tiene archivos sueltos sin numerar (`intent_learning.sql`, `form_corrections.sql`, `form_corrections_nombre.sql`) que nunca formaron parte del historial acumulativo real (ver Pendiente #9 de `CLAUDE.md`).
- Todos los archivos de test usan `.ts`, pero no hay `tsc`/type-checking en el flujo (`npm test` solo transpila vía esbuild) — los tipos son deliberadamente laxos (`any` donde haga falta), no se instala `@cloudflare/workers-types`.
- Contraseñas de seed en texto plano (`password = usuario`), igual que las migraciones reales de seed (`0005`, `0006`, `0012`) — `verifyPassword()` en `_middleware.js`/`auth.js` acepta contraseñas sin hashear vía su migración perezosa, así que esto ejercita el código real de login sin necesitar duplicar PBKDF2 en el seed.
- **Node.js ≥22 requerido** (`vitest@4.1.11` exige `>=22.0.0`, comprobado con `npm view vitest@4.1.11 engines`) — por eso el workflow de CI usa `node-version: 22`, no 20. La máquina de desarrollo del usuario ya tiene Node v24.19, así que Task 1 no debería bloquearse en local, pero cualquier otra máquina/CI que se use para este repo necesita Node 22+ para correr `npm test`.

---

### Task 1: Scaffolding + aplicación de migraciones reales

**Files:**
- Create: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/backend/apply-migrations.ts`
- Create: `tests/backend/smoke.test.ts`

**Interfaces:**
- Produces: binding D1 local `env.DB` con **todas** las migraciones numeradas de `migrations/` ya aplicadas, disponible en cualquier test posterior vía `import { env } from 'cloudflare:workers'`.

- [ ] **Step 1: Crear `package.json`**

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
    "@cloudflare/vitest-plugin": "^1.1.1",
    "vitest": "^4.1.11"
  }
}
```

- [ ] **Step 2: Instalar dependencias**

Run: `npm install`
Expected: crea `node_modules/` y `package-lock.json` sin errores. `node_modules/` ya está en `.gitignore` — no hace falta tocarlo.

- [ ] **Step 3: Crear `vitest.config.ts`**

```ts
import path from "node:path";
import {
  buildPagesASSETSBinding,
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrationsPath = path.join(import.meta.dirname, "migrations");
  const allMigrations = await readD1Migrations(migrationsPath);
  // migrations/ tambien tiene archivos sueltos sin numerar (intent_learning.sql,
  // form_corrections*.sql) que nunca formaron parte del historial acumulativo
  // real aplicado en remoto — se excluyen del esquema de test.
  const migrations = allMigrations.filter((m) => /^\d{4}_/.test(m.name));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          serviceBindings: {
            // createPagesEventContext() exige un binding ASSETS — el repo
            // sirve sus estaticos (index.html, css/, js/) desde la raiz.
            ASSETS: await buildPagesASSETSBinding(import.meta.dirname),
          },
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      setupFiles: ["./tests/backend/apply-migrations.ts"],
    },
  };
});
```

- [ ] **Step 4: Crear `tests/backend/apply-migrations.ts`**

```ts
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Setup file: corre una vez, fuera del aislamiento de storage por archivo de
// test (ver Global Constraints) — aplica el esquema real antes de que
// cualquier test se ejecute. applyD1Migrations() es idempotente (rastrea
// migraciones ya aplicadas por nombre), seguro aunque el runner lo invoque
// mas de una vez.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS as any);
```

- [ ] **Step 5: Crear `tests/backend/smoke.test.ts`**

```ts
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("entorno de test", () => {
  it("el binding DB responde y las migraciones reales ya se aplicaron", async () => {
    const dept = await env.DB.prepare(
      "SELECT COUNT(*) as n FROM departamentos"
    ).first<{ n: number }>();
    expect(dept!.n).toBeGreaterThan(0);

    // Confirma que el filtro de migrations/*.sql sueltas funciono: la tabla
    // que crearia intent_learning.sql no deberia existir aqui.
    const looseTable = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='intent_learning'"
    ).first();
    expect(looseTable).toBeNull();
  });
});
```

- [ ] **Step 6: Ejecutar y verificar**

Run: `npm test`
Expected: `Test Files 1 passed (1)`, `Tests 1 passed (1)`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/backend/apply-migrations.ts tests/backend/smoke.test.ts
git commit -m "test: scaffolding de vitest + aplicacion de migraciones reales en D1 local"
```

---

### Task 2: Seed de datos de prueba

**Files:**
- Create: `tests/backend/seed.ts`
- Test: `tests/backend/seed.test.ts`

**Interfaces:**
- Consumes: nada nuevo (usa `env.DB` ya migrado por Task 1).
- Produces: `resetAndSeed(db: any): Promise<void>` — exportada desde `tests/backend/seed.ts`, usada por `beforeEach` en Tasks 3-5. Dos departamentos (`test-dept-a`, `test-dept-b`), cinco usuarios (`test-superadmin`, `test-jefe-a`, `test-profesor-a`, `test-profesor-b`, `test-profesor-temp`), tres items (`9001` en `test-dept-a`, `9002` en `test-dept-b`, `9003` en el departamento compartido `iesjuanbosco`).

- [ ] **Step 1: Crear `tests/backend/seed.ts`**

```ts
// Borra-y-vuelve-a-sembrar (no solo INSERT): el aislamiento de storage de
// @cloudflare/vitest-plugin es por ARCHIVO de test, no por cada `it()` (ver
// Global Constraints) — sin este reset, un test que edita/borra/bloquea una
// fila de prueba dejaria ese cambio visible para el siguiente `it()` del
// mismo archivo. Se llama desde un beforeEach en cada archivo consumidor.
export async function resetAndSeed(db: any): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM inventario WHERE id IN (9001, 9002, 9003)"),
    db.prepare(
      "DELETE FROM usuarios WHERE usuario IN ('test-superadmin','test-jefe-a','test-profesor-a','test-profesor-b','test-profesor-temp')"
    ),
    db.prepare(
      "DELETE FROM departamentos WHERE slug IN ('test-dept-a','test-dept-b')"
    ),
  ]);

  await db.batch([
    db.prepare(
      "INSERT INTO departamentos (slug,nombre,orden) VALUES ('test-dept-a','Test Depto A',900)"
    ),
    db.prepare(
      "INSERT INTO departamentos (slug,nombre,orden) VALUES ('test-dept-b','Test Depto B',901)"
    ),
    // Password en texto plano = usuario, igual que las migraciones reales de
    // seed (0005/0006/0012) — verifyPassword() lo acepta via su migracion
    // perezosa (ver Global Constraints).
    db.prepare(
      "INSERT INTO usuarios (usuario,password,nombre,rol,email,departamento) VALUES ('test-superadmin','test-superadmin','Test Superadmin','superadmin','test-superadmin@iesjuanbosco.es','test-dept-a')"
    ),
    db.prepare(
      "INSERT INTO usuarios (usuario,password,nombre,rol,email,departamento) VALUES ('test-jefe-a','test-jefe-a','Test Jefe A','jefe/a departamento','test-jefe-a@iesjuanbosco.es','test-dept-a')"
    ),
    db.prepare(
      "INSERT INTO usuarios (usuario,password,nombre,rol,email,departamento) VALUES ('test-profesor-a','test-profesor-a','Test Profesor A','profesor','test-profesor-a@iesjuanbosco.es','test-dept-a')"
    ),
    db.prepare(
      "INSERT INTO usuarios (usuario,password,nombre,rol,email,departamento) VALUES ('test-profesor-b','test-profesor-b','Test Profesor B','profesor','test-profesor-b@iesjuanbosco.es','test-dept-b')"
    ),
    db.prepare(
      "INSERT INTO usuarios (usuario,password,nombre,rol,email,departamento,password_temporal) VALUES ('test-profesor-temp','test-profesor-temp','Test Profesor Temp','profesor','test-profesor-temp@iesjuanbosco.es','test-dept-a',1)"
    ),
    db.prepare(
      "INSERT INTO inventario (id,ref,aula,mod,item,qty,min,cat,departamento) VALUES (9001,'TEST-A-001','aula-test-a','','Item de prueba A',5,1,'Test','test-dept-a')"
    ),
    db.prepare(
      "INSERT INTO inventario (id,ref,aula,mod,item,qty,min,cat,departamento) VALUES (9002,'TEST-B-001','aula-test-b','','Item de prueba B',5,1,'Test','test-dept-b')"
    ),
    // Item en el departamento compartido iesjuanbosco (creado por la
    // migracion 0011) — para el test de "cualquiera puede editar lo comun".
    db.prepare(
      "INSERT INTO inventario (id,ref,aula,mod,item,qty,min,cat,departamento) VALUES (9003,'TEST-SHARED-001','aula-test-shared','','Item compartido',5,1,'Test','iesjuanbosco')"
    ),
  ]);
}
```

- [ ] **Step 2: Crear `tests/backend/seed.test.ts`**

```ts
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { resetAndSeed } from "./seed";

beforeEach(async () => {
  await resetAndSeed(env.DB);
});

describe("seed de test", () => {
  it("crea los 2 departamentos, 5 usuarios y 3 items esperados", async () => {
    const depts = await env.DB.prepare(
      "SELECT slug FROM departamentos WHERE slug LIKE 'test-dept-%' ORDER BY slug"
    ).all();
    expect(depts.results.map((r: any) => r.slug)).toEqual([
      "test-dept-a",
      "test-dept-b",
    ]);

    const users = await env.DB.prepare(
      "SELECT usuario FROM usuarios WHERE usuario LIKE 'test-%' ORDER BY usuario"
    ).all();
    expect(users.results.length).toBe(5);

    const items = await env.DB.prepare(
      "SELECT id FROM inventario WHERE id IN (9001, 9002, 9003) ORDER BY id"
    ).all();
    expect(items.results.map((r: any) => r.id)).toEqual([9001, 9002, 9003]);
  });

  it("es idempotente: llamarlo dos veces seguidas no duplica filas", async () => {
    await resetAndSeed(env.DB);
    const users = await env.DB.prepare(
      "SELECT usuario FROM usuarios WHERE usuario LIKE 'test-%'"
    ).all();
    expect(users.results.length).toBe(5);
  });
});
```

- [ ] **Step 3: Ejecutar y verificar**

Run: `npm test`
Expected: `Test Files 2 passed (2)` (smoke + seed), todos los tests en verde.

- [ ] **Step 4: Commit**

```bash
git add tests/backend/seed.ts tests/backend/seed.test.ts
git commit -m "test: seed de departamentos/usuarios/items de prueba para backend"
```

---

### Task 3: `auth.test.ts` — login, bloqueo, password_temporal, token

**Files:**
- Test: `tests/backend/auth.test.ts`

**Interfaces:**
- Consumes: `resetAndSeed` (Task 2), `onRequestGet` de `functions/api/auth.js` (sin cambios).

- [ ] **Step 1: Escribir `tests/backend/auth.test.ts`**

```ts
import {
  createPagesEventContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { onRequestGet as authGet } from "../../functions/api/auth.js";
import { resetAndSeed } from "./seed";

beforeEach(async () => {
  await resetAndSeed(env.DB);
});

async function login(u: string, p: string): Promise<any> {
  const request = new Request(
    `http://example.com/api/auth?action=login&u=${encodeURIComponent(
      u
    )}&p=${encodeURIComponent(p)}`
  );
  const ctx = createPagesEventContext<any>({ request, data: {} });
  const res = await authGet(ctx as any);
  await waitOnExecutionContext(ctx as any);
  return res.json();
}

describe("auth: login", () => {
  it("acepta usuario y contrasena correctos, sin exponer la contrasena, con session_token", async () => {
    const body = await login("test-profesor-a", "test-profesor-a");
    expect(body.ok).toBe(true);
    expect(body.user.usuario).toBe("test-profesor-a");
    expect(body.user.session_token).toBeTruthy();
    expect(body.user.password).toBeUndefined();
  });

  it("rechaza contrasena incorrecta sin revelar si el usuario existe", async () => {
    const body = await login("test-profesor-a", "mala");
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Credenciales incorrectas");
  });

  it("mismo mensaje generico para un usuario que no existe", async () => {
    const body = await login("no-existe-en-absoluto", "loquesea");
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Credenciales incorrectas");
  });

  it("avisa de los intentos restantes cerca del bloqueo", async () => {
    await login("test-profesor-a", "mala");
    await login("test-profesor-a", "mala");
    const body = await login("test-profesor-a", "mala");
    expect(body.ok).toBe(false);
    expect(body.error).toContain("intento");
  });

  it("bloquea la cuenta tras 5 intentos fallidos seguidos, incluso con la contrasena correcta despues", async () => {
    for (let i = 0; i < 5; i++) {
      await login("test-profesor-a", "mala");
    }
    const afterBlock = await login("test-profesor-a", "test-profesor-a");
    expect(afterBlock.ok).toBe(false);
    expect(afterBlock.bloqueado).toBe(true);
  });

  it("usuario con password_temporal=1 puede loguear igual, con el flag en la respuesta", async () => {
    const body = await login("test-profesor-temp", "test-profesor-temp");
    expect(body.ok).toBe(true);
    expect(body.user.password_temporal).toBe(1);
  });

  it("un login correcto resetea el contador de intentos fallidos anteriores", async () => {
    await login("test-profesor-a", "mala");
    await login("test-profesor-a", "mala");
    const ok = await login("test-profesor-a", "test-profesor-a");
    expect(ok.ok).toBe(true);

    // Tras el login correcto, deberian hacer falta 5 fallos NUEVOS para
    // bloquear (no solo los 3 restantes de antes del reset).
    for (let i = 0; i < 3; i++) {
      await login("test-profesor-a", "mala");
    }
    const stillNotBlocked = await login("test-profesor-a", "mala");
    expect(stillNotBlocked.bloqueado).toBeFalsy();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar**

Run: `npm test`
Expected: `Test Files 3 passed (3)`, todos los tests en verde (7 nuevos de `auth.test.ts`).

- [ ] **Step 3: Confirmar que el test de bloqueo realmente detecta el bug que dice detectar**

Comentar temporalmente la linea `if (bloquear) {` → `if (false) {` en `functions/api/auth.js` (el bloqueo de cuenta) y volver a correr `npm test` — el test "bloquea la cuenta tras 5 intentos..." debe fallar. Deshacer el cambio (`git checkout -- functions/api/auth.js`) y confirmar que vuelve a pasar.

Run: `git diff functions/api/auth.js` (debe salir vacio tras deshacer)

- [ ] **Step 4: Commit**

```bash
git add tests/backend/auth.test.ts
git commit -m "test: login, bloqueo tras 5 intentos, password_temporal y mensajes genericos"
```

---

### Task 4: harness de middleware + `middleware.test.ts`

**Files:**
- Create: `tests/backend/harness.ts`
- Test: `tests/backend/middleware.test.ts`

**Interfaces:**
- Consumes: `resetAndSeed` (Task 2), `onRequest` de `functions/api/_middleware.js`, `onRequestGet` de `functions/api/list.js`, `onRequestPost` de `functions/api/perfil.js` (los tres sin cambios).
- Produces: `callThroughMiddleware(handler, opts): Promise<{res, data}>` y `authQuery(u, p?, t?): string` — exportadas desde `tests/backend/harness.ts`, usadas también por Task 5.

- [ ] **Step 1: Crear `tests/backend/harness.ts`**

```ts
import {
  createPagesEventContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { onRequest as authMiddleware } from "../../functions/api/_middleware.js";

type Handler = (ctx: any) => Promise<Response>;

// Encadena _middleware.js -> el handler real, igual que hace el router de
// Cloudflare Pages para cualquier ruta bajo /api/*: si el middleware llama a
// next(), el handler recibe el MISMO objeto `data` que el middleware acabo
// de rellenar (data.user, data.departamento).
export async function callThroughMiddleware(
  handler: Handler,
  opts: { method?: string; path: string; body?: unknown }
): Promise<{ res: Response; data: Record<string, any> }> {
  const request = new Request("http://example.com" + opts.path, {
    method: opts.method || "GET",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data: Record<string, any> = {};
  const ctx = createPagesEventContext<any>({
    request,
    data,
    next: async () => {
      const innerCtx = createPagesEventContext<any>({ request, data });
      const res = await handler(innerCtx);
      await waitOnExecutionContext(innerCtx as any);
      return res;
    },
  });
  const res = await authMiddleware(ctx as any);
  await waitOnExecutionContext(ctx as any);
  return { res, data };
}

export function authQuery(u: string, p?: string, t?: string): string {
  const params = new URLSearchParams({ u });
  if (p) params.set("p", p);
  if (t) params.set("t", t);
  return params.toString();
}
```

- [ ] **Step 2: Crear `tests/backend/middleware.test.ts`**

```ts
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { onRequestGet as listGet } from "../../functions/api/list.js";
import { onRequestPost as perfilPost } from "../../functions/api/perfil.js";
import { authQuery, callThroughMiddleware } from "./harness";
import { resetAndSeed } from "./seed";

beforeEach(async () => {
  await resetAndSeed(env.DB);
});

describe("_middleware: resolucion de autenticacion", () => {
  it("resuelve data.user y data.departamento con usuario+contrasena validos", async () => {
    const { res, data } = await callThroughMiddleware(listGet, {
      path: `/api/list?${authQuery("test-profesor-a", "test-profesor-a")}`,
    });
    expect(res.status).toBe(200);
    expect(data.user.usuario).toBe("test-profesor-a");
    expect(data.departamento).toBe("test-dept-a");
  });

  it("rechaza sin credenciales, sin llegar a ejecutar el handler protegido", async () => {
    let handlerCalled = false;
    const spyHandler = async () => {
      handlerCalled = true;
      return Response.json({ ok: true });
    };
    const { res } = await callThroughMiddleware(spyHandler, { path: "/api/list" });
    expect(res.status).toBe(401);
    expect(handlerCalled).toBe(false);
  });

  it("rechaza con contrasena incorrecta", async () => {
    const { res } = await callThroughMiddleware(listGet, {
      path: `/api/list?${authQuery("test-profesor-a", "incorrecta")}`,
    });
    expect(res.status).toBe(401);
  });

  it("resuelve con token de sesion (t=) igual que con contrasena", async () => {
    await env.DB.prepare(
      "UPDATE usuarios SET session_token='test-token-fijo-123' WHERE usuario='test-profesor-a'"
    ).run();
    const { res, data } = await callThroughMiddleware(listGet, {
      path: `/api/list?${authQuery("test-profesor-a", undefined, "test-token-fijo-123")}`,
    });
    expect(res.status).toBe(200);
    expect(data.user.usuario).toBe("test-profesor-a");
  });

  it("rechaza un token de sesion invalido", async () => {
    const { res } = await callThroughMiddleware(listGet, {
      path: `/api/list?${authQuery("test-profesor-a", undefined, "token-que-no-existe")}`,
    });
    expect(res.status).toBe(401);
  });
});

describe("perfil: changePassword rota el session_token", () => {
  it("limpia password_temporal y devuelve un session_token nuevo que ya funciona", async () => {
    const before = await env.DB.prepare(
      "SELECT session_token FROM usuarios WHERE usuario='test-profesor-temp'"
    ).first<{ session_token: string | null }>();

    const { res } = await callThroughMiddleware(perfilPost, {
      method: "POST",
      path: `/api/perfil?${authQuery("test-profesor-temp", "test-profesor-temp")}`,
      body: { action: "changePassword", oldPassword: "test-profesor-temp", newPassword: "nueva1234" },
    });
    const body: any = await res.json();
    expect(body.ok).toBe(true);
    expect(body.session_token).toBeTruthy();
    expect(body.session_token).not.toBe(before?.session_token);

    const row = await env.DB.prepare(
      "SELECT password_temporal, session_token FROM usuarios WHERE usuario='test-profesor-temp'"
    ).first<{ password_temporal: number; session_token: string }>();
    expect(row!.password_temporal).toBe(0);
    expect(row!.session_token).toBe(body.session_token);

    // El token nuevo ya autentica de verdad.
    const { res: res2, data } = await callThroughMiddleware(listGet, {
      path: `/api/list?${authQuery("test-profesor-temp", undefined, row!.session_token)}`,
    });
    expect(res2.status).toBe(200);
    expect(data.user.usuario).toBe("test-profesor-temp");
  });
});
```

- [ ] **Step 3: Ejecutar y verificar**

Run: `npm test`
Expected: `Test Files 4 passed (4)`, todos los tests en verde (6 nuevos de `middleware.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add tests/backend/harness.ts tests/backend/middleware.test.ts
git commit -m "test: harness de _middleware.js + resolucion de auth (password/token/invalido)"
```

---

### Task 5: `scoping.test.ts` — aislamiento entre departamentos

**Files:**
- Test: `tests/backend/scoping.test.ts`

**Interfaces:**
- Consumes: `resetAndSeed` (Task 2), `callThroughMiddleware`/`authQuery` (Task 4), `onRequestGet` de `list.js`, `onRequestPost` de `item.js` y `prestar.js` (todos sin cambios).

- [ ] **Step 1: Escribir `tests/backend/scoping.test.ts`**

```ts
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { onRequestPost as itemPost } from "../../functions/api/item.js";
import { onRequestGet as listGet } from "../../functions/api/list.js";
import { onRequestPost as prestarPost } from "../../functions/api/prestar.js";
import { authQuery, callThroughMiddleware } from "./harness";
import { resetAndSeed } from "./seed";

beforeEach(async () => {
  await resetAndSeed(env.DB);
});

async function itemRefs(u: string, p: string): Promise<string[]> {
  const { res } = await callThroughMiddleware(listGet, {
    path: `/api/list?${authQuery(u, p)}`,
  });
  const body: any = await res.json();
  const refIdx = body.itemsH.indexOf("ref");
  return body.itemsC.map((row: any[]) => row[refIdx]);
}

describe("scoping por departamento", () => {
  it("un profesor (rol profesor) solo ve los items de su propio departamento", async () => {
    const refs = await itemRefs("test-profesor-a", "test-profesor-a");
    expect(refs).toContain("TEST-A-001");
    expect(refs).not.toContain("TEST-B-001");
    // isProfesor(user) hace que list.js excluya el departamento compartido
    // iesjuanbosco para el rol "profesor" (genericDept='__none__' en vez de
    // GENERIC_DEPT) — solo jefe/a departamento y superadmin lo ven, ver el
    // siguiente test. Comportamiento real verificado en el codigo, no lo
    // que sugiere la wording de CLAUDE.md ("cualquier jefe/a de
    // departamento o profesor") — el codigo manda.
    expect(refs).not.toContain("TEST-SHARED-001");
  });

  it("un jefe/a de departamento si ve el departamento compartido iesjuanbosco", async () => {
    const refs = await itemRefs("test-jefe-a", "test-jefe-a");
    expect(refs).toContain("TEST-A-001");
    expect(refs).toContain("TEST-SHARED-001");
    expect(refs).not.toContain("TEST-B-001");
  });

  it("superadmin ve items de todos los departamentos", async () => {
    const refs = await itemRefs("test-superadmin", "test-superadmin");
    expect(refs).toContain("TEST-A-001");
    expect(refs).toContain("TEST-B-001");
  });

  it("un profesor no puede editar un item de otro departamento (403)", async () => {
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-profesor-a", "test-profesor-a")}`,
      body: {
        action: "update",
        item: {
          id: 9002,
          ref: "HACKEADO",
          aula: "aula-test-b",
          mod: "",
          item: "x",
          qty: 5,
          min: 1,
          cat: "Test",
        },
      },
    });
    expect(res.status).toBe(403);
    const body: any = await res.json();
    expect(body.ok).toBe(false);

    // Confirma que no se colo el cambio pese al 403.
    const row = await env.DB.prepare("SELECT ref FROM inventario WHERE id=9002").first<{ ref: string }>();
    expect(row!.ref).toBe("TEST-B-001");
  });

  it("un profesor no puede borrar un item de otro departamento (403)", async () => {
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-profesor-a", "test-profesor-a")}`,
      body: { action: "delete", id: 9002 },
    });
    expect(res.status).toBe(403);

    const row = await env.DB.prepare("SELECT id FROM inventario WHERE id=9002").first();
    expect(row).not.toBeNull();
  });

  it("un profesor si puede editar un item de su propio departamento", async () => {
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-profesor-a", "test-profesor-a")}`,
      body: {
        action: "update",
        item: {
          id: 9001,
          ref: "TEST-A-001",
          aula: "aula-test-a",
          mod: "",
          item: "Item de prueba A editado",
          qty: 5,
          min: 1,
          cat: "Test",
        },
      },
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.ok).toBe(true);
  });

  it("un jefe/a de departamento (de otro departamento) puede editar el item compartido iesjuanbosco", async () => {
    // Nota: el rol "profesor" NO tiene este acceso (ver test de scoping de
    // lista arriba) — isProfesor(user) excluye el departamento compartido
    // para ese rol en item.js igual que en list.js. Se usa test-jefe-a
    // (departamento test-dept-a) editando un item de iesjuanbosco para
    // confirmar que el acceso es "cualquier departamento propio", no solo
    // el suyo.
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-jefe-a", "test-jefe-a")}`,
      body: {
        action: "update",
        item: {
          id: 9003,
          ref: "TEST-SHARED-001",
          aula: "aula-test-shared",
          mod: "",
          item: "Item compartido editado",
          qty: 5,
          min: 1,
          cat: "Test",
        },
      },
    });
    expect(res.status).toBe(200);
  });

  it("un profesor (rol profesor) NO puede editar el item del departamento compartido", async () => {
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-profesor-b", "test-profesor-b")}`,
      body: {
        action: "update",
        item: {
          id: 9003,
          ref: "TEST-SHARED-001",
          aula: "aula-test-shared",
          mod: "",
          item: "x",
          qty: 5,
          min: 1,
          cat: "Test",
        },
      },
    });
    expect(res.status).toBe(403);
  });

  it("superadmin puede editar un item de cualquier departamento", async () => {
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-superadmin", "test-superadmin")}`,
      body: {
        action: "update",
        item: {
          id: 9002,
          ref: "TEST-B-001",
          aula: "aula-test-b",
          mod: "",
          item: "Editado por superadmin",
          qty: 5,
          min: 1,
          cat: "Test",
        },
      },
    });
    expect(res.status).toBe(200);
  });

  it("un prestamo de un item ajeno al departamento del actor se rechaza (403)", async () => {
    const { res } = await callThroughMiddleware(prestarPost, {
      method: "POST",
      path: `/api/prestar?${authQuery("test-profesor-a", "test-profesor-a")}`,
      body: {
        action: "prestar",
        prestamo: {
          itemId: 9002,
          itemNombre: "Item de prueba B",
          cantidad: 1,
          aulaOrigen: "aula-test-b",
          profesorNombre: "Test Profesor A",
        },
      },
    });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar**

Run: `npm test`
Expected: `Test Files 5 passed (5)`, todos los tests en verde (10 nuevos de `scoping.test.ts`).

- [ ] **Step 3: Confirmar que el test de scoping realmente detecta el bug que dice detectar**

En `functions/api/item.js`, en el bloque `if (action === 'update')`, comentar temporalmente el `if (!superadmin) { ... return 403 }` (las 5 lineas del check de departamento) y volver a correr `npm test` — el test "un profesor no puede editar un item de otro departamento" debe fallar. Deshacer el cambio.

Run: `git diff functions/api/item.js` (debe salir vacio tras deshacer)

- [ ] **Step 4: Commit**

```bash
git add tests/backend/scoping.test.ts
git commit -m "test: aislamiento entre departamentos en list/item/prestar"
```

---

### Task 6: CI en GitHub Actions (solo aviso, sin bloquear el deploy)

**Files:**
- Create: `.github/workflows/tests.yml`

**Interfaces:**
- Consumes: `npm test` (Task 1-5).
- Produces: check ✅/❌ en cada push/PR a `main`, independiente del deploy automatico de Cloudflare Pages (que sigue disparandose igual, sin esperar a este resultado — decision explicita del usuario, ver spec).

- [ ] **Step 1: Crear `.github/workflows/tests.yml`**

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
          node-version: 22
      - run: npm ci
      - run: npm test
```

- [ ] **Step 2: Verificar que `package-lock.json` esta commiteado (requerido por `npm ci`)**

Run: `git ls-files package-lock.json`
Expected: imprime `package-lock.json` (si esta vacio, falta el `git add` del Task 1 — corregirlo antes de continuar).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/tests.yml
git commit -m "ci: correr tests de backend en GitHub Actions (aviso, no bloquea el deploy)"
```

- [ ] **Step 4: Push y verificar en GitHub**

Run: `git push origin main` (o a una rama/PR, segun prefiera el usuario en ese momento)
Expected: en la pestaña Actions del repo aparece el workflow `tests` corriendo y en verde; en Cloudflare Pages el deploy se dispara igual, sin esperar a este resultado.
