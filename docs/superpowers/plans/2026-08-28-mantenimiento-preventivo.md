# Mantenimiento preventivo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un plan de mantenimiento preventivo por ítem (intervalo +
próxima revisión), responsables de mantenimiento por categoría
(autoservicio + asignación admin), y un aviso en pantalla que reutiliza la
vista "Mantenimiento" y el modal "🔔 Requiere tu atención" ya existentes.

**Architecture:** 4 columnas planas nuevas en `inventario` (sin tabla de
historial propia) + una tabla puente `mantenimiento_responsables` (mismo
patrón que `aula_profesores`/`modulo_profesores`). Una única acción de
servidor nueva (`mantenimientoMarcarRevisado`) hace el trabajo genuinamente
nuevo; todo lo demás reutiliza mecanismos ya existentes (`FIELDS_UPD`
genérico, diff-sync de responsables, notificación en pantalla calculada al
cargar datos).

**Tech Stack:** Cloudflare Pages Functions (backend, `functions/api/*.js`),
D1 (SQLite), Vanilla JS sin build step (`js/*.js`, `<script>` global, sin
módulos), Vitest + `@cloudflare/vitest-plugin` para los tests de backend.

**Spec:** `docs/superpowers/specs/2026-08-28-mantenimiento-preventivo-design.md`
— este plan sigue ese diseño; los ejecutores deben leer ambos si algo no
queda claro aquí. Una discrepancia detectada al escribir este plan: el
diseño dice que `MIS_AULAS`/la nueva `MIS_MANT_CATEGORIAS` se declaran en
`js/state.js`, pero `MIS_AULAS` vive realmente en `js/config.js:43` — este
plan usa la ubicación real del código, no la del diseño.

## Global Constraints

- **No usar bundler ni build step** — `<script>` global cargado directo,
  sin `import`/`export` en frontend (`index.html` decide el orden).
- **Todas las columnas nuevas viajan solas por `HEADERS_INV`/`FIELDS_UPD`**
  (patrón ya usado por `mantCoste` etc.) — no tocar `add`/`update`/
  `bulkImport`/`restoreBackup` en `functions/api/item.js` salvo para
  añadir el nombre de columna al array.
- **Mismo criterio de scoping por departamento** que el resto del backend:
  `superadmin` ve todo, el resto compara `departamento` del actor contra
  el del recurso (o `GENERIC_DEPT='iesjuanbosco'`).
- **Edición de código directamente en el checkout principal**
  (`H:\Mi unidad\Github\boscoinventario`) — funciona bien para todo lo que
  no sea `npm`/`node_modules` (ver `CLAUDE.md`, sección Entorno). **Solo**
  la Task de tests automatizados (Vitest) necesita ejecutarse en un
  worktree **fuera de Google Drive** (ej. `C:\ClaudeWork\worktrees\<nombre>`,
  nunca un directorio hermano dentro de "Mi unidad") — `npm install`/
  `node_modules` se corrompe dentro de Google Drive.
- **Ningún `git push`** sin confirmación explícita del usuario — cada Task
  termina en un commit local, no en push.
- **Sin `VERSION` nueva en `sw.js` hasta la Task final** (13) — el resto de
  Tasks son commits intermedios sobre una función todavía no completa.
- **Español** en todo texto de UI, commits y comentarios de código (según
  el resto del repo).

---

## File Structure

- `migrations/0039_mantenimiento_preventivo.sql` — **crear**: 4 columnas
  en `inventario`, columna `tipo` en `mantenimientos`, tabla
  `mantenimiento_responsables`.
- `functions/api/item.js` — **modificar**: `HEADERS_INV` (+4 columnas),
  acción nueva `mantenimientoMarcarRevisado`, `mantenimientosGet` incluye
  `tipo`.
- `functions/api/list.js` — **modificar**: `HEADERS_INV` en paralelo (debe
  quedar idéntico a `item.js`, ya hay un aviso de "bug recurrente" en la
  línea 1 de ambos archivos).
- `functions/api/usuarios.js` — **modificar**: helper
  `reemplazarMantenimientoUsuario`, acciones `selectMantenimientoCategorias`
  / `userAssignMantenimiento`, `getUsers` gana `mantenimiento` por usuario.
- `functions/api/meta.js` — **modificar**: expone `misMantenimiento`.
- `js/api.js` — **modificar**: `ENDPOINT_MAP` (3 acciones nuevas).
- `js/roles.js` — **modificar**: `ACTION_PERMISSIONS` (3 acciones nuevas).
- `js/state.js` — **modificar**: `needsPreventiveMaintenance`,
  `needsAnyMaintenance`, `MANT_PLAN_INTERVALOS`,
  `mantPlanIntervaloOptionsHtml`.
- `js/config.js` — **modificar**: `let MIS_MANT_CATEGORIAS = []`.
- `js/auth.js` — **modificar**: rellena `MIS_MANT_CATEGORIAS` tras login.
- `js/modal-item.js` — **modificar**: campos de plan preventivo en el
  modal de ítem (rellenar/guardar/marcar revisado), `MODAL_TRACKED_FIELDS`,
  `setItemModalReadonly`, badge `tipo` en el historial de mantenimiento.
- `js/inventory.js` — **modificar**: `getBase`/`getFiltered`/
  `renderSubStats` (vista Mantenimiento mezclada), badges de fila en
  `rTable`/`rCards`/`rList`, acciones de lote `plan-set`/`plan-off`.
- `js/home.js` — **modificar**: contadores con `needsAnyMaintenance`,
  `checkAtencionHoy()` con rama nueva para profesorado sin
  `config.manage`.
- `js/modal-mis-mantenimiento.js` — **crear**: autoservicio de categorías
  de mantenimiento (calco de `js/modal-mis-aulas.js`).
- `js/prestamos.js` — **modificar**: botón + mini-modal para que
  jefatura/superadmin asignen categorías de mantenimiento a otro usuario
  (calco de `openAulasUsuario`/`mAulasUsuario` ya existente en el mismo
  archivo).
- `css/styles.css` — **modificar**: regla `.maintenance-pill-preventive`.
- `index.html` — **modificar**: bloque "Plan preventivo" en `#mSecMantenimiento`,
  2 opciones nuevas en `#bulkAction`, entrada de menú "🛠️ Mantenimiento"
  en "📌 Mis Cursos/Aulas", modal `#mMisMantenimiento`, modal
  `#mMantenimientoUsuario`, `<script>` de `js/modal-mis-mantenimiento.js`.
- `tests/backend/scoping.test.ts` — **modificar**: 2 tests nuevos para
  `mantenimientoMarcarRevisado` (mismo patrón que los tests de `update`/
  `delete` ya existentes ahí).
- `sw.js` — **modificar** (solo Task 13): `VERSION` v649 → v650.

---

### Task 1: Migración D1 — columnas de plan preventivo y tabla de responsables

**Files:**
- Create: `migrations/0039_mantenimiento_preventivo.sql`

**Interfaces:**
- Produces: columnas `inventario.mantPlanIntervaloDias` (INTEGER, NULL =
  sin plan), `inventario.mantPlanUltimaRevision` (TEXT, `YYYY-MM-DD` o
  `''`), `inventario.mantPlanProximaRevision` (TEXT, ídem),
  `inventario.mantPlanNota` (TEXT); columna `mantenimientos.tipo` (TEXT,
  `'correctivo'` por defecto); tabla `mantenimiento_responsables(categoria,
  departamento, usuario)`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Plan preventivo: 1:1 con el ítem, columnas planas (mismo patrón que
-- fecha_adquisicion/precio/serie) — no hay historial de "versiones" del
-- plan, solo el estado actual.
ALTER TABLE inventario ADD COLUMN mantPlanIntervaloDias INTEGER;
ALTER TABLE inventario ADD COLUMN mantPlanUltimaRevision TEXT DEFAULT '';
ALTER TABLE inventario ADD COLUMN mantPlanProximaRevision TEXT DEFAULT '';
ALTER TABLE inventario ADD COLUMN mantPlanNota TEXT DEFAULT '';

-- Cada incidencia de mantenimiento distingue correctivo (avería real) de
-- preventivo (revisión rutinaria, con o sin hallazgo).
ALTER TABLE mantenimientos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'correctivo';

-- Responsables de mantenimiento: mismo patrón que aula_profesores/
-- modulo_profesores (migrations/0032, 0033) — autoservicio + asignación
-- admin. categoria='' significa "todo el departamento".
CREATE TABLE IF NOT EXISTS mantenimiento_responsables (
  categoria    TEXT NOT NULL DEFAULT '',
  departamento TEXT NOT NULL,
  usuario      TEXT NOT NULL,
  PRIMARY KEY (categoria, departamento, usuario)
);
CREATE INDEX IF NOT EXISTS idx_mantenimiento_responsables_usuario ON mantenimiento_responsables(usuario);
```

- [ ] **Step 2: Verificar sintaxis aplicándola contra un D1 local desechable**

Run: `npx wrangler d1 execute boscoinventario --local --file=migrations/0039_mantenimiento_preventivo.sql`

Expected: `🚣 Executed X commands` sin errores (usa el D1 local de
desarrollo de wrangler, no toca la base remota).

- [ ] **Step 3: Commit**

```bash
git add migrations/0039_mantenimiento_preventivo.sql
git commit -m "feat: migracion 0039 - columnas de mantenimiento preventivo"
```

---

### Task 2: Backend `item.js`/`list.js` — columnas + acción `mantenimientoMarcarRevisado`

**Files:**
- Modify: `functions/api/item.js:2` (HEADERS_INV), `functions/api/item.js:288-300`
  (`mantenimientosGet`), añadir acción nueva tras `mantenimientosGet`
  (después de la línea 300 actual)
- Modify: `functions/api/list.js:2` (HEADERS_INV)
- Test: `tests/backend/scoping.test.ts`

**Interfaces:**
- Consumes: `MANT_OPEN_STATES`/`itemDept(db,id)` ya definidos en
  `item.js` (líneas 100, 164).
- Produces: acción `mantenimientoMarcarRevisado` — body
  `{ action:'mantenimientoMarcarRevisado', itemId, nota }`, respuesta
  `{ ok:true, mantPlanUltimaRevision, mantPlanProximaRevision }` en éxito,
  `{ ok:false, error }` (400/403 según caso) en fallo. Usada por
  `js/modal-item.js` (Task 7).

- [ ] **Step 1: Escribir los tests (deben fallar — la acción no existe todavía)**

Añadir al final de `tests/backend/scoping.test.ts` (dentro del mismo
`describe("scoping por departamento", ...)`, dos tests nuevos, dejando el
resto del archivo intacto):

```ts
  it("mantenimientoMarcarRevisado: un profesor no puede marcar la revision de un item de otro departamento (403)", async () => {
    await env.DB.prepare("UPDATE inventario SET mantPlanIntervaloDias=90 WHERE id=9002").run();
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-profesor-a", "test-profesor-a")}`,
      body: { action: "mantenimientoMarcarRevisado", itemId: 9002, nota: "hackeado" },
    });
    expect(res.status).toBe(403);
    const row = await env.DB.prepare("SELECT mantPlanUltimaRevision FROM inventario WHERE id=9002").first<{ mantPlanUltimaRevision: string }>();
    expect(row!.mantPlanUltimaRevision || "").toBe("");
  });

  it("mantenimientoMarcarRevisado: un profesor si puede marcar la revision de un item de su propio departamento", async () => {
    await env.DB.prepare("UPDATE inventario SET mantPlanIntervaloDias=90 WHERE id=9001").run();
    const { res } = await callThroughMiddleware(itemPost, {
      method: "POST",
      path: `/api/item?${authQuery("test-profesor-a", "test-profesor-a")}`,
      body: { action: "mantenimientoMarcarRevisado", itemId: 9001, nota: "revisado ok" },
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mantPlanUltimaRevision).toBeTruthy();
    expect(body.mantPlanProximaRevision > body.mantPlanUltimaRevision).toBe(true);

    const mant = await env.DB.prepare("SELECT tipo, estado FROM mantenimientos WHERE item_id=9001 ORDER BY id DESC LIMIT 1").first<{ tipo: string; estado: string }>();
    expect(mant!.tipo).toBe("preventivo");
    expect(mant!.estado).toBe("Resuelto");
  });
```

- [ ] **Step 2: Confirmar que fallan (la columna existe por la Task 1, pero la acción no)**

Run (en un worktree fuera de Google Drive, ver Global Constraints —
`cd /c/ClaudeWork/worktrees/mantenimiento-preventivo && npm ci` primero
si no se ha hecho ya): `npm test -- scoping`

Expected: los 2 tests nuevos FAIL con `res.status` `undefined`/`404` o
similar (acción no reconocida), el resto de tests (26) sigue en verde.

- [ ] **Step 3: Añadir las 4 columnas a `HEADERS_INV`**

En `functions/api/item.js:2` y `functions/api/list.js:2` (idéntico en
ambos archivos, mismo orden):

```js
const HEADERS_INV = ['id','ref','aula','mod','item','qty','min','cat','loc','est','util','proveedor','tags','fecha','fecha_adquisicion','precio','mant','mantFecha','mantNota','mantResp','mantEstado','mantCoste','mantSolicitante','mantSolicitanteEmail','foto','obs','code','serie','es_contenedor','parent_id','tipo_material','oculto','mantPlanIntervaloDias','mantPlanUltimaRevision','mantPlanProximaRevision','mantPlanNota'];
```

- [ ] **Step 4: Implementar `mantenimientoMarcarRevisado` en `functions/api/item.js`**

Insertar justo después del bloque de `mantenimientosGet` (después de la
línea `return Response.json({ ok: true, mantenimientos: rows.results || [] });`
y su `}` de cierre, antes de `if (action === 'fotosGet') {`):

```js
  if (action === 'mantenimientoMarcarRevisado') {
    const itemId = body.itemId;
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, itemId);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    const row = await env.DB.prepare('SELECT mantPlanIntervaloDias FROM inventario WHERE id=?').bind(itemId).first();
    if (!row || !row.mantPlanIntervaloDias) {
      return Response.json({ ok: false, error: 'Este ítem no tiene un plan de mantenimiento activo' });
    }
    const hoy = new Date().toISOString().slice(0, 10);
    const proxima = new Date();
    proxima.setDate(proxima.getDate() + row.mantPlanIntervaloDias);
    const proximaStr = proxima.toISOString().slice(0, 10);
    const nota = String(body.nota || '').trim();
    await env.DB.prepare(
      `INSERT INTO mantenimientos (item_id, estado, fecha_apertura, nota_apertura, responsable, fecha_cierre, nota_cierre, tipo, creado_por, creado_en)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(itemId, 'Resuelto', hoy, 'Revisión preventiva', user?.usuario || '', hoy, nota, 'preventivo', user?.usuario || '', new Date().toISOString()).run();
    await env.DB.prepare(
      'UPDATE inventario SET mantPlanUltimaRevision=?, mantPlanProximaRevision=? WHERE id=?'
    ).bind(hoy, proximaStr, itemId).run();
    return Response.json({ ok: true, mantPlanUltimaRevision: hoy, mantPlanProximaRevision: proximaStr });
  }

```

- [ ] **Step 5: `mantenimientosGet` expone `tipo`**

En `functions/api/item.js`, dentro del bloque `if (action === 'mantenimientosGet') {`:

```js
    const rows = await env.DB.prepare(
      'SELECT id, estado, fecha_apertura, nota_apertura, responsable, coste, fecha_cierre, nota_cierre, tipo FROM mantenimientos WHERE item_id=? ORDER BY id DESC'
    ).bind(itemId).all();
```

(único cambio: añadir `, tipo` a la lista de columnas del `SELECT`).

- [ ] **Step 6: Correr los tests, confirmar que pasan**

Run (mismo worktree que el Step 2): `npm test -- scoping`

Expected: los 2 tests nuevos PASS, los 26 anteriores siguen en verde
(28/28 → 30/30 en total contando el resto de archivos de test).

- [ ] **Step 7: Commit**

```bash
git add functions/api/item.js functions/api/list.js tests/backend/scoping.test.ts
git commit -m "feat: accion mantenimientoMarcarRevisado + columnas de plan preventivo en HEADERS_INV"
```

---

### Task 3: Backend `usuarios.js` — responsables de mantenimiento

**Files:**
- Modify: `functions/api/usuarios.js:1-60` (helpers), `functions/api/usuarios.js:141-330`
  (handler: `getUsers`, y añadir 2 acciones nuevas tras `selectAulas`)
- Test: `tests/backend/scoping.test.ts`

**Interfaces:**
- Consumes: patrón `reemplazarAulasUsuario`/`reemplazarModulosUsuario` ya
  en el archivo (líneas 25-59).
- Produces: `reemplazarMantenimientoUsuario(db, usuarioLogin, departamento,
  categoriasNuevas)`; acciones `selectMantenimientoCategorias` (body
  `{categorias:string[]}`, autoservicio, siempre el actor) y
  `userAssignMantenimiento` (body `{usuario, categorias:string[]}`, admin,
  cualquier usuario del propio departamento o, si superadmin, de
  cualquiera); `getUsers` añade `mantenimiento: string[]` a cada fila de
  usuario devuelta. Usados por `js/modal-mis-mantenimiento.js` (Task 11) y
  `js/prestamos.js` (Task 12).

- [ ] **Step 1: Escribir el test (debe fallar — la acción no existe)**

Añadir a `tests/backend/scoping.test.ts` (import nuevo arriba del
archivo, junto a los otros `import { onRequestPost as ... }`):

```ts
import { onRequestPost as usuariosPost } from "../../functions/api/usuarios.js";
```

Y un test nuevo dentro del `describe`:

```ts
  it("userAssignMantenimiento: un jefe/a de departamento no puede asignar categorias a un usuario de otro departamento (403)", async () => {
    const { res } = await callThroughMiddleware(usuariosPost, {
      method: "POST",
      path: `/api/usuarios?${authQuery("test-jefe-a", "test-jefe-a")}`,
      body: { action: "userAssignMantenimiento", usuario: "test-profesor-b", categorias: ["Herramientas"] },
    });
    expect(res.status).toBe(403);
  });
```

(Usa los usuarios de seed ya existentes `test-jefe-a`/`test-profesor-b` —
confirmar sus nombres exactos en `tests/backend/seed.ts` antes de escribir
el test; si difieren, usar los reales del seed en vez de estos.)

- [ ] **Step 2: Confirmar que falla**

Run (worktree fuera de Google Drive): `npm test -- scoping`

Expected: el test nuevo FAIL (acción no reconocida → probablemente
`res.status` no es 403 sino otro código o error de parseo).

- [ ] **Step 3: Helper de diff-sync, junto a `reemplazarAulasUsuario` (`functions/api/usuarios.js:59`)**

```js
// Diff completo entre las categorías de mantenimiento que el usuario
// tiene hoy en `mantenimiento_responsables` (para su departamento) y
// `categoriasNuevas` — mismo patrón que reemplazarModulosUsuario/
// reemplazarAulasUsuario. '' en categoriasNuevas significa "todo el
// departamento", no una categoría real.
async function reemplazarMantenimientoUsuario(db, usuarioLogin, departamento, categoriasNuevas) {
  await db.prepare('CREATE TABLE IF NOT EXISTS mantenimiento_responsables (categoria TEXT NOT NULL DEFAULT \'\', departamento TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (categoria, departamento, usuario))').run().catch(() => {});
  const actuales = await db.prepare('SELECT categoria FROM mantenimiento_responsables WHERE usuario=? AND departamento=?').bind(usuarioLogin, departamento).all();
  const catsActuales = new Set((actuales.results || []).map(r => r.categoria));
  const catsNuevas = new Set(categoriasNuevas);
  for (const cat of catsNuevas) {
    if (catsActuales.has(cat)) continue;
    await db.prepare('INSERT OR IGNORE INTO mantenimiento_responsables (categoria, departamento, usuario) VALUES (?,?,?)').bind(cat, departamento, usuarioLogin).run();
  }
  for (const cat of catsActuales) {
    if (catsNuevas.has(cat)) continue;
    await db.prepare('DELETE FROM mantenimiento_responsables WHERE categoria=? AND departamento=? AND usuario=?').bind(cat, departamento, usuarioLogin).run();
  }
}
```

- [ ] **Step 4: Dos acciones nuevas, justo después del bloque `selectAulas` (`functions/api/usuarios.js:318-328`)**

```js
  if (action === 'selectMantenimientoCategorias') {
    const categorias = Array.isArray(body.categorias) ? body.categorias.map(String) : [];
    if (!dept) return Response.json({ ok: false, error: 'Selecciona primero tu departamento' });
    await reemplazarMantenimientoUsuario(env.DB, user.usuario, dept, categorias);
    await auditLog(env.DB, user, 'selectMantenimientoCategorias', `Categorías de mantenimiento propias actualizadas: ${categorias.join(',')}`);
    return Response.json({ ok: true });
  }

  if (action === 'userAssignMantenimiento') {
    const usuarioDestino = String(body.usuario || '').trim();
    const categorias = Array.isArray(body.categorias) ? body.categorias.map(String) : [];
    if (!usuarioDestino) return Response.json({ ok: false, error: 'Usuario requerido' });
    const targetRow = await env.DB.prepare('SELECT departamento FROM usuarios WHERE usuario=?').bind(usuarioDestino).first();
    if (!targetRow) return Response.json({ ok: false, error: 'Usuario no encontrado' });
    if (!superadmin && targetRow.departamento !== dept) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    await reemplazarMantenimientoUsuario(env.DB, usuarioDestino, targetRow.departamento || '', categorias);
    await auditLog(env.DB, user, 'userAssignMantenimiento', `Categorías de mantenimiento asignadas a ${usuarioDestino}: ${categorias.join(',')}`);
    return Response.json({ ok: true });
  }
```

- [ ] **Step 5: `getUsers` gana `mantenimiento` por usuario**

En `functions/api/usuarios.js`, dentro del bloque `if (action === 'getUsers')`:
añadir la tabla defensiva junto a las otras dos (línea 154-155):

```js
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS mantenimiento_responsables (categoria TEXT NOT NULL DEFAULT \'\', departamento TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (categoria, departamento, usuario))').run().catch(() => {});
```

Añadir una 5ª consulta al `Promise.all` (línea 156-169), y destructurarla:

```js
    const [usuariosRows, ciclosRows, profesRows, aulasProfesRows, mantResponsablesRows] = await Promise.all([
      superadmin
        ? env.DB.prepare('SELECT usuario, nombre, rol, email, departamento, bloqueado, password_temporal FROM usuarios ORDER BY usuario').all()
        : env.DB.prepare('SELECT usuario, nombre, rol, email, departamento, bloqueado, password_temporal FROM usuarios WHERE departamento=? ORDER BY usuario').bind(dept).all(),
      superadmin
        ? env.DB.prepare('SELECT cicloId, modCod, modNombre FROM ciclos WHERE modCod IS NOT NULL').all()
        : env.DB.prepare('SELECT cicloId, modCod, modNombre FROM ciclos WHERE modCod IS NOT NULL AND departamento=?').bind(dept).all(),
      superadmin
        ? env.DB.prepare('SELECT mp.cicloId, mp.modCod, mp.usuario, u.email FROM modulo_profesores mp JOIN usuarios u ON u.usuario = mp.usuario').all()
        : env.DB.prepare('SELECT mp.cicloId, mp.modCod, mp.usuario, u.email FROM modulo_profesores mp JOIN usuarios u ON u.usuario = mp.usuario WHERE mp.departamento=?').bind(dept).all(),
      superadmin
        ? env.DB.prepare('SELECT ap.aula, ap.usuario FROM aula_profesores ap JOIN usuarios u ON u.usuario = ap.usuario').all()
        : env.DB.prepare('SELECT ap.aula, ap.usuario FROM aula_profesores ap JOIN usuarios u ON u.usuario = ap.usuario WHERE u.departamento=?').bind(dept).all(),
      superadmin
        ? env.DB.prepare('SELECT mr.categoria, mr.usuario FROM mantenimiento_responsables mr JOIN usuarios u ON u.usuario = mr.usuario').all()
        : env.DB.prepare('SELECT mr.categoria, mr.usuario FROM mantenimiento_responsables mr JOIN usuarios u ON u.usuario = mr.usuario WHERE mr.departamento=?').bind(dept).all(),
    ]);
```

Añadir el mapeo (junto a `aulasPorUsuario`, línea 183-187):

```js
    const mantPorUsuario = {};
    for (const row of (mantResponsablesRows?.results || [])) {
      if (!mantPorUsuario[row.usuario]) mantPorUsuario[row.usuario] = [];
      mantPorUsuario[row.usuario].push(row.categoria);
    }
```

Y en el `.map` final de `usuarios` (línea 192-200), añadir `mantenimiento`:

```js
    const usuarios = usuariosRows.results.map(u => {
      const rolNorm = String(u.rol || '').trim().toLowerCase();
      return {
        ...u,
        rol: rolNorm === 'superadmin' ? 'Jefe/a Departamento' : u.rol,
        modulos: modulosPorUsuario[u.usuario] || [],
        aulas: aulasPorUsuario[u.usuario] || [],
        mantenimiento: mantPorUsuario[u.usuario] || [],
      };
    });
```

- [ ] **Step 6: Correr los tests, confirmar que pasan**

Run: `npm test -- scoping`

Expected: el test nuevo PASS, el resto sigue en verde.

- [ ] **Step 7: Commit**

```bash
git add functions/api/usuarios.js tests/backend/scoping.test.ts
git commit -m "feat: responsables de mantenimiento por categoria (autoservicio + asignacion admin)"
```

---

### Task 4: Backend `meta.js` — expone `misMantenimiento`

**Files:**
- Modify: `functions/api/meta.js:132-204`

**Interfaces:**
- Consumes: patrón de `misAulas` ya en el mismo handler (líneas 139, 164,
  200).
- Produces: `meta.misMantenimiento: string[]` (categorías propias del
  actor). Usado por `js/auth.js` (Task 6).

- [ ] **Step 1: Tabla defensiva + query nueva**

Junto a la línea 139 (`CREATE TABLE IF NOT EXISTS aula_profesores...`):

```js
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS mantenimiento_responsables (categoria TEXT NOT NULL DEFAULT '', departamento TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (categoria, departamento, usuario))").run().catch(() => {});
```

En el `Promise.all` (línea 141-165), añadir una entrada más y
destructurarla:

```js
  const [aulas, cats, invCats, ubicaciones, invLocs, ciclosRows, departamentosRows, profesRows, misAulasRows, misMantRows] = await Promise.all([
    // ...(las 8 entradas existentes sin cambios)...
    env.DB.prepare('SELECT aula FROM aula_profesores WHERE usuario=?').bind(user.usuario).all(),
    env.DB.prepare('SELECT categoria FROM mantenimiento_responsables WHERE usuario=? AND departamento=?').bind(user.usuario, dept).all(),
  ]);
```

- [ ] **Step 2: Devolverlo en el `Response.json`**

```js
  return Response.json({
    ok: true,
    aulas: sortAulas(aulas.results),
    cats: mergeCats(cats.results, invCats.results),
    catsPropias: cats.results.length > 0,
    catsCrudo: superadmin ? cats.results : undefined,
    ubicaciones: mergeUbicaciones(ubicaciones.results, invLocs.results),
    ciclos: cicloOrder.map(id => cicloMap[id]),
    misModulos,
    misAulas: (misAulasRows.results || []).map(r => r.aula),
    misMantenimiento: (misMantRows.results || []).map(r => r.categoria),
    departamentos: superadmin ? departamentosRows.results : undefined,
    user
  });
```

- [ ] **Step 3: Sanity check de sintaxis**

Run: `node --check functions/api/meta.js`

Expected: sin salida (sintaxis válida).

- [ ] **Step 4: Commit**

```bash
git add functions/api/meta.js
git commit -m "feat: meta.js expone misMantenimiento"
```

---

### Task 5: Frontend — wiring de las 3 acciones nuevas (`api.js`/`roles.js`)

**Files:**
- Modify: `js/api.js:5-17` (`ENDPOINT_MAP`)
- Modify: `js/roles.js:33-87` (`ACTION_PERMISSIONS`)

**Interfaces:**
- Consumes: nombres de acción exactos de las Tasks 2-3:
  `mantenimientoMarcarRevisado`, `selectMantenimientoCategorias`,
  `userAssignMantenimiento`.
- Produces: `apiPost({action:'mantenimientoMarcarRevisado', ...})` etc.
  resuelven al endpoint/permiso correcto para el resto del frontend
  (Tasks 7, 11, 12).

- [ ] **Step 1: `ENDPOINT_MAP` (`js/api.js:6`)**

```js
const ENDPOINT_MAP = {
  add:'item', update:'item', delete:'item', bulkImport:'item', restoreBackup:'item', toggleOculto:'item', fotosGet:'item', fotosSync:'item', mantenimientosGet:'item', mantenimientoMarcarRevisado:'item', buscarPorSerie:'item', detectarMultiples:'item', buscarSeriePorCodigo:'item', registrarFeedbackDeteccion:'item',
  prestar:'prestar', devolver:'prestar', prestarCaja:'prestar', notificarVencidos:'prestar',
  reservaCrear:'prestar', reservaConfirmar:'prestar', reservaCancelar:'prestar',
  profAdd:'profesores', profUpdate:'profesores', profDelete:'profesores',
  aulasSync:'config', catsSync:'config', normalizeCategoriesTags:'config', normalizeTagsCanonical:'config', renameTag:'config', deleteTag:'config', ciclosSync:'config', ubicacionesSync:'config',
  updateProfile:'perfil', changePassword:'perfil', selectDepartamento:'perfil',
  getUsers:'usuarios', userAdd:'usuarios', userUpdate:'usuarios',
  userDelete:'usuarios', userResetPassword:'usuarios', userAssignModulos:'usuarios', userAssignAulas:'usuarios', userAssignMantenimiento:'usuarios', userUnlock:'usuarios', selectModulos:'usuarios', importModulosCSV:'usuarios', selectAulas:'usuarios', selectMantenimientoCategorias:'usuarios',
  getDocs:'docs', uploadDoc:'docs', deleteDoc:'docs',
  pedidoAdd:'pedidos', pedidoUpdate:'pedidos', pedidoRemove:'pedidos', pedidoClear:'pedidos',
  solicitudCrear:'solicitudes', solicitudUpdate:'solicitudes',
};
```

- [ ] **Step 2: `ACTION_PERMISSIONS` (`js/roles.js:33-87`)**

Añadir estas 3 líneas (`mantenimientoMarcarRevisado` junto a
`mantenimientosGet` línea 41; las otras dos junto a `selectAulas` línea 70
y `userAssignAulas` línea 84):

```js
  mantenimientosGet: 'items.write',
  mantenimientoMarcarRevisado: 'items.write',
```

```js
  selectAulas: 'profile.write',
  selectMantenimientoCategorias: 'profile.write',
```

```js
  userAssignAulas: 'config.manage',
  userAssignMantenimiento: 'config.manage',
```

- [ ] **Step 3: Sanity check**

Run: `node --check js/api.js && node --check js/roles.js`

Expected: sin salida.

- [ ] **Step 4: Commit**

```bash
git add js/api.js js/roles.js
git commit -m "feat: wiring de acciones de mantenimiento preventivo (api.js/roles.js)"
```

---

### Task 6: Frontend — helpers compartidos (`state.js`, `config.js`, `auth.js`)

**Files:**
- Modify: `js/state.js:72-76` (después de `needsMaintenance`)
- Modify: `js/config.js:42-43` (después de `MIS_AULAS`)
- Modify: `js/auth.js:525` (después de `MIS_AULAS = ...`)

**Interfaces:**
- Produces: `needsPreventiveMaintenance(item)`, `needsAnyMaintenance(item)`,
  `MANT_PLAN_INTERVALOS` (array de enteros), `mantPlanIntervaloOptionsHtml(selected)`
  (string HTML de `<option>`s) — usados por Tasks 7-12.
  `let MIS_MANT_CATEGORIAS = []` — rellenado por `js/auth.js`, leído por
  `js/home.js` (Task 10).

- [ ] **Step 1: `js/state.js` — helpers de fecha/estado del plan**

Insertar después de la función `needsMaintenance` (línea 76):

```js

function needsPreventiveMaintenance(item){
  const proxima = item?.mantPlanProximaRevision;
  if(!item?.mantPlanIntervaloDias || !proxima) return false;
  const hoy = new Date().toISOString().slice(0,10);
  return proxima <= hoy;
}

function needsAnyMaintenance(item){
  return needsMaintenance(item) || needsPreventiveMaintenance(item);
}

// Intervalos fijos del plan preventivo + "Otro…" — compartido por el
// modal de ítem (js/modal-item.js) y la acción de lote (js/inventory.js)
// para no repetir la lista de <option> en dos sitios.
const MANT_PLAN_INTERVALOS = [30, 90, 180, 365, 730];
function mantPlanIntervaloOptionsHtml(selected){
  const sel = selected == null ? '' : String(selected);
  return '<option value="">— Sin plan —</option>'
    + MANT_PLAN_INTERVALOS.map(d => `<option value="${d}"${sel===String(d)?' selected':''}>${d} días</option>`).join('')
    + `<option value="__otro"${sel==='__otro'?' selected':''}>Otro…</option>`;
}
```

- [ ] **Step 2: `js/config.js` — variable de sesión**

En `js/config.js:43`, justo después de la línea
`let MIS_AULAS = []; // aula.id[] en las que da clase el usuario logueado (ver meta.js:misAulas)`:

```js
let MIS_MANT_CATEGORIAS = []; // categoria[] de mantenimiento asignadas al usuario logueado (ver meta.js:misMantenimiento); '' = todo el departamento
```

- [ ] **Step 3: `js/auth.js` — rellenar tras login**

En `js/auth.js:525`, justo después de
`MIS_AULAS = Array.isArray(meta.misAulas) ? meta.misAulas : [];`:

```js
    MIS_MANT_CATEGORIAS = Array.isArray(meta.misMantenimiento) ? meta.misMantenimiento : [];
```

- [ ] **Step 4: Sanity check**

Run: `node --check js/state.js && node --check js/config.js && node --check js/auth.js`

Expected: sin salida.

- [ ] **Step 5: Commit**

```bash
git add js/state.js js/config.js js/auth.js
git commit -m "feat: helpers compartidos de mantenimiento preventivo (state/config/auth)"
```

---

### Task 7: Frontend — plan preventivo en el modal de ítem

**Files:**
- Modify: `index.html:892-897` (dentro de `#mSecMantenimiento`, tras el
  bloque `maintHistorialLinkWrap`)
- Modify: `js/modal-item.js:8` (`MODAL_TRACKED_FIELDS`), `js/modal-item.js:211-218`
  (`fillModalSelects`), `js/modal-item.js:942-952` (`setItemModalReadonly`),
  `js/modal-item.js:1059-1087` (dentro de `openModal`), `js/modal-item.js:1249-1300`
  (`saveItem`), `js/modal-item.js:1678-1687` (`_formatMantRow`)

**Interfaces:**
- Consumes: `mantPlanIntervaloOptionsHtml`, `needsPreventiveMaintenance`
  (Task 6); acción `mantenimientoMarcarRevisado` (Task 2, vía `apiPost`).
- Produces: nada consumido por otras Tasks (hoja del árbol de UI).

- [ ] **Step 1: Markup en `index.html`, dentro de `#mSecMantenimiento`**

Insertar justo antes de `</details>` que cierra la sección (después del
bloque `mantHistorialLinkWrap`, línea 896-897 actuales):

```html
          <div class="full" style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px">
            <div class="docs-lbl">🛡️ Plan preventivo</div>
            <div class="fg" style="margin-top:8px">
              <div>
                <label class="fl">Revisar cada</label>
                <select class="fi-w" id="f_mantPlanIntervalo" onchange="onMantPlanIntervaloChange()"></select>
                <input class="fi-w" id="f_mantPlanIntervaloOtro" type="number" min="1" placeholder="Días" style="display:none;margin-top:6px">
              </div>
              <div class="full">
                <label class="fl">Qué revisar</label>
                <input class="fi-w" id="f_mantPlanNota" placeholder="Ej. calibración, revisión de seguridad...">
              </div>
            </div>
            <div class="full" id="mantPlanEstadoWrap" style="display:none;margin-top:10px">
              <div id="mantPlanEstadoText" style="font-size:12px"></div>
              <button type="button" class="btn btn-sm" id="btnMarcarRevisado" onclick="marcarRevisadoPreventivo()" style="margin-top:6px">✅ Marcar revisado hoy</button>
            </div>
          </div>
```

- [ ] **Step 2: `MODAL_TRACKED_FIELDS` (`js/modal-item.js:8`)**

```js
const MODAL_TRACKED_FIELDS = ['f_ref', 'f_aula', 'f_item', 'f_qty', 'f_min', 'f_tipo_material', 'f_cat', 'f_ciclo', 'f_mod', 'f_loc', 'f_est', 'f_util', 'f_proveedor', 'f_serie', 'f_tags', 'f_fecha', 'f_mantFecha', 'f_mantEstado', 'f_mantResp', 'f_mantNota', 'f_mantCoste', 'f_mantFechaCierre', 'f_mantNotaCierre', 'f_mantPlanIntervalo', 'f_mantPlanIntervaloOtro', 'f_mantPlanNota', 'f_obs', 'f_es_contenedor', 'f_parent_id'];
```

- [ ] **Step 3: `setItemModalReadonly` (`js/modal-item.js:942-952`)**

```js
function setItemModalReadonly(readonly){
  const modal = document.querySelector('#mItem .modal');
  modal?.classList.toggle('item-readonly', !!readonly);
  ['f_ref','f_aula','f_item','f_qty','f_min','f_tipo_material','f_cat','f_ciclo','f_mod','f_loc','f_est','f_util','f_proveedor','f_serie','f_tags','f_fecha','f_mantFecha','f_mantEstado','f_mantResp','f_mantNota','f_mantCoste','f_mantFechaCierre','f_mantNotaCierre','f_mantPlanIntervalo','f_mantPlanIntervaloOtro','f_mantPlanNota','f_obs','f_es_contenedor','f_parent_id']
    .forEach(id => {
      const el = document.getElementById(id);
      if(el) el.disabled = !!readonly;
    });
  const btnSerie = document.getElementById('btnSerieDesdeCamara');
  if(btnSerie) btnSerie.disabled = !!readonly;
  const btnMarcarRevisado = document.getElementById('btnMarcarRevisado');
  if(btnMarcarRevisado) btnMarcarRevisado.disabled = !!readonly;
}
```

- [ ] **Step 4: `fillModalSelects` — rellenar el `<select>` de intervalo**

En `js/modal-item.js:211-218`, dentro de `fillModalSelects()`, añadir una
línea (el `<select>` empieza vacío en `index.html`, igual que
`f_aula`/`f_ciclo`/`f_cat`):

```js
function fillModalSelects(){
  document.getElementById('f_aula').innerHTML=renderAulaOptions();
  document.getElementById('f_ciclo').innerHTML='<option value="">Sin asignar</option>'+CICLOS.map(c=>`<option value="${c.id}" data-alias="${cicloAlias(c)}" data-full="${escHtml(c.icon+' '+c.name)}">${escHtml(c.icon+' '+c.name)}</option>`).join('');
  syncCicloLabels();
  document.getElementById('f_cat').innerHTML='<option value="">Sin categoría</option>' + sortedCatNames().map(c=>`<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('') + '<option value="__new_category__">＋ Añadir categoría...</option>';
  document.getElementById('f_mantPlanIntervalo').innerHTML = mantPlanIntervaloOptionsHtml('');
  fillLocationSuggestions();
  fillTagSuggestions();
}
```

- [ ] **Step 5: Funciones nuevas — cambio de "Otro…", cálculo del valor, render del estado, marcar revisado**

Añadir cerca de `_enfocarMantenimientoEnModal` (`js/modal-item.js`, antes
de `function openModal(id=null, src=null){`):

```js
function onMantPlanIntervaloChange(){
  const esOtro = document.getElementById('f_mantPlanIntervalo').value === '__otro';
  document.getElementById('f_mantPlanIntervaloOtro').style.display = esOtro ? '' : 'none';
  if(esOtro) document.getElementById('f_mantPlanIntervaloOtro').focus();
}

function getMantPlanIntervaloValue(){
  const sel = document.getElementById('f_mantPlanIntervalo').value;
  if(!sel) return null;
  if(sel === '__otro'){
    const n = parseInt(document.getElementById('f_mantPlanIntervaloOtro').value, 10);
    return n > 0 ? n : null;
  }
  return parseInt(sel, 10);
}

function _renderMantPlanEstado(m){
  const wrap = document.getElementById('mantPlanEstadoWrap');
  const text = document.getElementById('mantPlanEstadoText');
  if(!wrap || !text) return;
  if(!m || !m.mantPlanIntervaloDias){ wrap.style.display = 'none'; return; }
  const vencida = needsPreventiveMaintenance(m);
  const ultima = m.mantPlanUltimaRevision ? formatFechaEs(m.mantPlanUltimaRevision) : 'nunca';
  const proxima = m.mantPlanProximaRevision ? formatFechaEs(m.mantPlanProximaRevision) : '—';
  text.innerHTML = `Última revisión: ${escHtml(ultima)} · Próxima: <span style="color:${vencida?'var(--red)':'var(--muted)'};font-weight:600">${escHtml(proxima)}</span>`;
  wrap.style.display = '';
}

async function marcarRevisadoPreventivo(){
  if(!eid) return;
  const btn = document.getElementById('btnMarcarRevisado');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try{
    const res = await apiPost({action:'mantenimientoMarcarRevisado', itemId:eid, nota:document.getElementById('f_mantPlanNota').value.trim()});
    if(!res.ok) throw new Error(res.error);
    const i = items.findIndex(x=>Number(x.id)===Number(eid));
    if(i>=0){
      items[i].mantPlanUltimaRevision = res.mantPlanUltimaRevision;
      items[i].mantPlanProximaRevision = res.mantPlanProximaRevision;
      _renderMantPlanEstado(items[i]);
    }
    _mantHistorial = null;
    toast('Revisión preventiva registrada','ok');
  } catch(err){ toast(friendlyError(err),'err'); }
  finally{ btn.disabled=false; btn.textContent='✅ Marcar revisado hoy'; }
}
```

- [ ] **Step 6: `openModal` — precargar el plan (`js/modal-item.js`, dentro del bloque de mantenimiento, después de la línea `document.getElementById('f_mantCoste').value=m?.mantCoste ?? '';`)**

```js
  const planIntervalo = m?.mantPlanIntervaloDias || null;
  _mantPlanIntervaloOriginal = planIntervalo;
  const planSel = document.getElementById('f_mantPlanIntervalo');
  const planOtro = document.getElementById('f_mantPlanIntervaloOtro');
  if(planIntervalo && MANT_PLAN_INTERVALOS.includes(planIntervalo)){
    planSel.value = String(planIntervalo);
    planOtro.style.display = 'none';
  } else if(planIntervalo){
    planSel.value = '__otro';
    planOtro.value = planIntervalo;
    planOtro.style.display = '';
  } else {
    planSel.value = '';
    planOtro.value = '';
    planOtro.style.display = 'none';
  }
  document.getElementById('f_mantPlanNota').value = m?.mantPlanNota || '';
  _renderMantPlanEstado(m);
```

Y declarar la variable de módulo cerca de `let eid` / `modalOriginalValues`
(buscar su declaración al inicio del archivo y añadir justo debajo):

```js
let _mantPlanIntervaloOriginal = null;
```

- [ ] **Step 7: `saveItem` — incluir los 3 campos en `v` y calcular `mantPlanProximaRevision`**

En `js/modal-item.js`, dentro de `saveItem()`, antes de `const v={...}`,
añadir el cálculo:

```js
  const nuevoIntervalo = getMantPlanIntervaloValue();
  let mantPlanProximaRevision;
  if(!nuevoIntervalo){
    mantPlanProximaRevision = '';
  } else if(!_mantPlanIntervaloOriginal || nuevoIntervalo !== _mantPlanIntervaloOriginal){
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + nuevoIntervalo);
    mantPlanProximaRevision = fecha.toISOString().slice(0,10);
  } else {
    mantPlanProximaRevision = (eid ? (items.find(x=>x.id===eid)?.mantPlanProximaRevision || '') : '');
  }
```

Y dentro del objeto literal `v={...}` (junto a `mantNotaCierre`), añadir:

```js
    mantPlanIntervaloDias: nuevoIntervalo,
    mantPlanProximaRevision,
    mantPlanNota: document.getElementById('f_mantPlanNota').value.trim(),
```

(**No** incluir `mantPlanUltimaRevision` en `v` — ese campo solo lo toca
`mantenimientoMarcarRevisado`; si `v` no lo declara, `update` preserva el
valor existente vía `{...items.find(x=>x.id===eid), ...v}` y `add` lo deja
`null`, mismo patrón que `oculto`/`mantSolicitante` que tampoco están en `v`).

- [ ] **Step 8: `_formatMantRow` — badge de tipo en el historial**

```js
function _formatMantRow(m){
  const rango = m.fecha_cierre ? `${m.fecha_apertura} → ${m.fecha_cierre}` : `${m.fecha_apertura} (abierta)`;
  const coste = (m.coste !== null && m.coste !== undefined && m.coste !== '') ? ` · ${Number(m.coste).toFixed(2)}€` : '';
  const resp = m.responsable ? ` · ${escHtml(m.responsable)}` : '';
  const notaCierre = m.nota_cierre ? `<div>✅ ${escHtml(m.nota_cierre)}</div>` : '';
  const tipoIcon = m.tipo === 'preventivo' ? '🛡️' : '🔧';
  return `<div style="padding:6px 0;border-bottom:1px solid var(--border)">
    <div>${tipoIcon} <b>${escHtml(m.estado)}</b> · ${escHtml(rango)}${coste}${resp}</div>
    <div>${escHtml(m.nota_apertura || '')}</div>
    ${notaCierre}
  </div>`;
}
```

- [ ] **Step 9: Sanity check**

Run: `node --check js/modal-item.js`

Expected: sin salida.

- [ ] **Step 10: Commit**

```bash
git add index.html js/modal-item.js
git commit -m "feat: plan de mantenimiento preventivo en el modal de item"
```

---

### Task 8: Frontend — vista "Mantenimiento" mezclada + badges de fila

**Files:**
- Modify: `js/inventory.js:4-17` (`renderSubStats`), `js/inventory.js:41-52`
  (`getBase`), `js/inventory.js:54-70` (`getFiltered`), `js/inventory.js:962-1016`
  (`rTable`), `js/inventory.js:1018-1121` (`rCards`), `js/inventory.js:1129-1161`
  (`rList`)
- Modify: `css/styles.css:830` (después de `.maintenance-pill`)

**Interfaces:**
- Consumes: `needsAnyMaintenance`, `needsPreventiveMaintenance` (Task 6).

- [ ] **Step 1: `renderSubStats` — badge cuenta ambos motivos (`js/inventory.js:6`)**

```js
  const mant=data.filter(needsAnyMaintenance).length;
```

- [ ] **Step 2: `getBase` — vista "Mantenimiento" mezcla ambos motivos (`js/inventory.js:46`)**

```js
    if(cf.type==='maintenance') return needsAnyMaintenance(x) && (!debeFiltrarPorMisAulas() || MIS_AULAS.includes(x.aula));
```

- [ ] **Step 3: `getFiltered` — mismo criterio en el sub-filtro de la barra de stats (`js/inventory.js:61`)**

```js
    if(_subFilter==='maintenance' && !needsAnyMaintenance(x)) return false;
```

- [ ] **Step 4: `rTable` — badge 🛡️ junto al nombre del ítem**

En `js/inventory.js:966`, añadir `mantPrev` a la declaración existente:

```js
      const low=isLowStock(x),mant=needsMaintenance(x),mantPrev=needsPreventiveMaintenance(x),mantInfo=[x.mantEstado,x.mantFecha,x.mantResp].filter(Boolean).join(' · '),cat=CATS[x.cat]||CATS['Otros']||{c:'#6b7280',bg:'#f9fafb',i:'🔧'},ec=ESTC[x.est]||'#6b7280',tipo=materialType(x);
```

Y en el bloque `.item-title-line` (línea 980-986), añadir el badge justo
antes de cerrar el `</div>` de esa línea (después del botón de QR, línea
985):

```js
            <button type="button" class="qr-name-btn" onclick="event.stopPropagation();openItemQr(${x.id})" title="Ver QR" aria-label="Ver QR"><img class="qr-name-icon" src="icons/qr-code.svg" alt=""></button>
            ${mantPrev?`<span title="Revisión preventiva pendiente" style="font-size:10px;background:var(--teal-l);color:var(--teal);border-radius:4px;padding:1px 5px;margin-left:4px">🛡️ Revisión</span>`:''}
          </div>
```

- [ ] **Step 5: `rCards` — pill preventiva junto a la correctiva**

En `js/inventory.js:1020`, añadir `mantPrev`:

```js
    const low=isLowStock(x),mant=needsMaintenance(x),mantPrev=needsPreventiveMaintenance(x),mantStatus=x.mantEstado||'Pendiente',cat=CATS[x.cat]||CATS['Otros']||{c:'#6b7280',bg:'#f9fafb',i:'🔧'},ec=ESTC[x.est]||'#6b7280',mod=findModulo(x.mod),tipo=materialType(x),tags=itemTags(x);
```

En el bloque `cpills` (línea 1052-1059), añadir junto al `mant?` existente
(línea 1054):

```js
          ${mant?`<span class="cpill maintenance-pill">🛠️ ${escHtml(mantStatus)}</span>`:''}
          ${mantPrev?`<span class="cpill maintenance-pill-preventive">🛡️ Revisión pendiente</span>`:''}
```

- [ ] **Step 6: `rList` — icono compacto**

En `js/inventory.js:1131`, añadir `mantPrev`:

```js
    const low=isLowStock(x),mant=needsMaintenance(x),mantPrev=needsPreventiveMaintenance(x),cat=CATS[x.cat]||CATS['Otros']||{c:'#6b7280',bg:'#f9fafb',i:'🔧'},ec=ESTC[x.est]||'#6b7280',tipo=materialType(x),tags=itemTags(x);
```

En `list-meta` (línea 1144), añadir al final:

```js
        <div class="list-meta">${x.ref?`<span class="list-badge">${escHtml(x.ref)}</span>`:''}${x.cat?` <span class="list-cat">${escHtml(cat.i)} ${escHtml(x.cat)}</span>`:''}${x.est?` <span class="list-status" style="color:${ec}">●</span>`:''}${mantPrev?` <span title="Revisión preventiva pendiente" style="color:var(--teal)">🛡️</span>`:''}</div>
```

- [ ] **Step 7: CSS — pill preventiva (`css/styles.css`, después de la línea 830)**

```css
.maintenance-pill-preventive{background:var(--teal-l);color:var(--teal);border:1px solid var(--teal)}
```

- [ ] **Step 8: Sanity check**

Run: `node --check js/inventory.js`

Expected: sin salida.

- [ ] **Step 9: Commit**

```bash
git add js/inventory.js css/styles.css
git commit -m "feat: vista Mantenimiento mezcla correctivo+preventivo, badges de fila"
```

---

### Task 9: Frontend — acciones de lote `plan-set`/`plan-off`

**Files:**
- Modify: `index.html:639` (`#bulkAction`, opciones nuevas)
- Modify: `js/inventory.js:648-680` (`renderBulkActionControl`), `js/inventory.js:766-808`
  (`applyBulkAction`)

**Interfaces:**
- Consumes: `mantPlanIntervaloOptionsHtml` (Task 6).

- [ ] **Step 1: Opciones nuevas en `#bulkAction` (`index.html:639`)**

```html
        <option value="mant">Marcar mantenimiento</option>
        <option value="plan-set">🛡️ Establecer plan de mantenimiento preventivo</option>
        <option value="plan-off">Quitar plan de mantenimiento preventivo</option>
        <option value="foto">Cambiar imagen</option>
```

- [ ] **Step 2: `renderBulkActionControl` — control del intervalo (`js/inventory.js`, dentro del `else if` que sigue a `action === 'mant'`)**

```js
  } else if(action === 'plan-set'){
    box.innerHTML = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select id="bulkPlanIntervalo" onchange="onBulkPlanIntervaloChange()">${mantPlanIntervaloOptionsHtml('')}</select>
      <input id="bulkPlanIntervaloOtro" type="number" min="1" placeholder="Días" style="display:none;width:90px">
      <input id="bulkPlanNota" type="text" placeholder="Qué revisar (opcional)" style="flex:1;min-width:160px">
    </div>`;
  } else if(action === 'plan-off'){
    box.innerHTML = '<div style="font-size:12px;color:var(--muted)">Quita el plan de mantenimiento preventivo de los ítems seleccionados (no borra la última revisión ya hecha).</div>';
  } else if(action === 'foto'){
```

(la condición `else if(action === 'foto'){` ya existe — solo insertar las
dos ramas nuevas justo antes de ella, dejando el resto de `renderBulkActionControl`
sin cambios).

Añadir la función de toggle junto a `renderBulkModOptions`:

```js
function onBulkPlanIntervaloChange(){
  const esOtro = document.getElementById('bulkPlanIntervalo').value === '__otro';
  document.getElementById('bulkPlanIntervaloOtro').style.display = esOtro ? '' : 'none';
}
```

- [ ] **Step 3: `applyBulkAction` — construir el `patch` (`js/inventory.js:778`, junto a la rama `action === 'mant'`)**

```js
  else if(action === 'mant') patch = { mantEstado: 'Pendiente' };
  else if(action === 'plan-set') {
    const sel = document.getElementById('bulkPlanIntervalo').value;
    const intervalo = sel === '__otro' ? parseInt(document.getElementById('bulkPlanIntervaloOtro').value,10) : parseInt(sel,10);
    if(!intervalo || intervalo < 1){ toast('Indica un intervalo válido','err'); return; }
    const fecha = new Date(); fecha.setDate(fecha.getDate()+intervalo);
    patch = { mantPlanIntervaloDias: intervalo, mantPlanProximaRevision: fecha.toISOString().slice(0,10), mantPlanNota: document.getElementById('bulkPlanNota').value.trim() };
  }
  else if(action === 'plan-off') patch = { mantPlanIntervaloDias: null, mantPlanProximaRevision: '' };
```

- [ ] **Step 4: Sanity check**

Run: `node --check js/inventory.js`

Expected: sin salida.

- [ ] **Step 5: Commit**

```bash
git add index.html js/inventory.js
git commit -m "feat: acciones de lote para plan de mantenimiento preventivo"
```

---

### Task 10: Frontend — contadores de Inicio + "🔔 Requiere tu atención"

**Files:**
- Modify: `js/home.js:98` (dentro de `checkAtencionHoy`), `js/home.js:165,172,181`
  (dentro de `renderHome`), `js/home.js:84-131` (`checkAtencionHoy`, rama
  nueva)

**Interfaces:**
- Consumes: `needsAnyMaintenance`, `needsPreventiveMaintenance` (Task 6),
  `MIS_MANT_CATEGORIAS` (Task 6).

- [ ] **Step 1: `checkAtencionHoy` — el chip de jefatura mezcla ambos motivos (`js/home.js:98`)**

```js
  const mantLista = items.filter(needsAnyMaintenance);
```

- [ ] **Step 2: `renderHome` — contador y tarjeta de Inicio (`js/home.js:165`)**

```js
  const mant=itemsParaAlertas.filter(needsAnyMaintenance).length;
```

(líneas 172 y 181 no cambian: ya leen la variable `mant` calculada arriba,
solo cambia su fuente).

- [ ] **Step 3: `checkAtencionHoy` — bifurcar por permiso, rama nueva para profesorado**

Sustituir la primera línea de la función (`js/home.js:85`):

```js
async function checkAtencionHoy(){
  if(typeof can !== 'function' || !SESSION) return;
  if(sessionStorage.getItem('atencion_hoy_cerrado') === '1') return;

  if(!can('config.manage')){
    await _checkAtencionHoyProfesor();
    return;
  }

  const isSuperAdmin = typeof userRole === 'function' && userRole() === 'superadmin';
```

(el resto de la función, desde `const deptOfItem = ...` en adelante, sigue
exactamente igual — solo se reemplazan las 2 primeras líneas del cuerpo
original por el bloque de arriba).

Añadir la función nueva justo después del cierre de `checkAtencionHoy`
(después de la línea `modal.classList.add('open');\n}`):

```js

// Rama reducida para profesorado sin config.manage: solo revisiones
// preventivas de sus propias categorías de mantenimiento asignadas
// (MIS_MANT_CATEGORIAS) — sin desglose por departamento (ya está acotado
// a lo suyo). Si no tiene categorías asignadas o no hay nada vencido, no
// se abre nada (mismo criterio que la rama de jefatura).
async function _checkAtencionHoyProfesor(){
  if(!Array.isArray(MIS_MANT_CATEGORIAS) || !MIS_MANT_CATEGORIAS.length) return;
  const propias = items.filter(x => needsPreventiveMaintenance(x) && x.departamento === SESSION.departamento
    && (MIS_MANT_CATEGORIAS.includes('') || MIS_MANT_CATEGORIAS.includes(x.cat)));
  if(!propias.length) return;
  if(sessionStorage.getItem('atencion_hoy_cerrado') === '1') return;

  const chip = _atencionChip('🛠️', propias.length, null, 'Revisiones preventivas pendientes', 'goMaintenance()', 'warn');
  if(!chip) return;
  const body = document.getElementById('atencionHoyBody');
  const modal = document.getElementById('mAtencionHoy');
  if(!body || !modal) return;
  body.innerHTML = `<div class="atencion-strip">${chip}</div>`;
  modal.classList.add('open');
}
```

- [ ] **Step 4: Sanity check**

Run: `node --check js/home.js`

Expected: sin salida.

- [ ] **Step 5: Commit**

```bash
git add js/home.js
git commit -m "feat: Inicio y Requiere tu atencion incluyen revisiones preventivas"
```

---

### Task 11: Frontend — autoservicio "🛠️ Mantenimiento" (`js/modal-mis-mantenimiento.js` nuevo)

**Files:**
- Create: `js/modal-mis-mantenimiento.js` (calco de `js/modal-mis-aulas.js`)
- Modify: `index.html:88-94` (menú "📌 Mis Cursos/Aulas"), `index.html`
  (nuevo bloque de modal, después del modal `#mMisAulas` que cierra en la
  línea 1662), `index.html:2289` (script tag nuevo)

**Interfaces:**
- Consumes: `CATS` (ya filtrado por departamento), `MIS_MANT_CATEGORIAS`
  (Task 6), acción `selectMantenimientoCategorias` (Task 3).
- Produces: actualiza `MIS_MANT_CATEGORIAS` tras guardar — consumido por
  `js/home.js` (Task 10) en la siguiente evaluación de
  `checkAtencionHoy()`.

- [ ] **Step 1: Crear `js/modal-mis-mantenimiento.js`**

```js
// Autoservicio de categorías de mantenimiento — en qué categorías se
// compromete el usuario logueado a hacer las revisiones preventivas,
// además de su departamento. Lista plana sobre CATS (objeto {name:{...}},
// ya filtrado por departamento en meta.js) + una fila especial "Todo el
// departamento" (valor ''), mismo patrón que js/modal-mis-aulas.js.
// Solo accesible desde el menú "📌 Mis Cursos/Aulas" de la topbar.

let _misMantSeleccionadas = new Set();

function _renderMisMantList(query){
  const q = normalizeStr(query || '');
  const body = document.getElementById('mMisMantBody');
  if(!body) return;
  const nombres = Object.keys(CATS || {}).filter(n => !q || normalizeStr(n).includes(q));
  const filaTodo = !q ? `
    <label class="mod-check-row">
      <input type="checkbox" value="" ${_misMantSeleccionadas.has('')?'checked':''} onchange="_toggleMisMant('',this.checked)">
      <span class="mod-check-name">🏷️ Todo el departamento</span>
    </label>` : '';
  const filas = nombres.map(n => `
    <label class="mod-check-row">
      <input type="checkbox" value="${escHtml(n)}" ${_misMantSeleccionadas.has(n)?'checked':''} onchange="_toggleMisMant('${escHtml(n)}',this.checked)">
      <span class="mod-check-name">${CATS[n]?.i?escHtml(CATS[n].i)+' ':''}${escHtml(n)}</span>
    </label>`).join('');
  body.innerHTML = filaTodo + filas || '<p style="color:var(--muted);font-size:13px">Sin resultados.</p>';
}

function _toggleMisMant(cat, checked){
  if(checked) _misMantSeleccionadas.add(cat);
  else _misMantSeleccionadas.delete(cat);
}

function filterMisMant(){
  _renderMisMantList(document.getElementById('misMantSearch')?.value || '');
}

function openMisMantModal(){
  closeMisCursosMenu();
  _misMantSeleccionadas = new Set(MIS_MANT_CATEGORIAS);
  document.getElementById('misMantSearch').value = '';
  _renderMisMantList('');
  document.getElementById('mMisMant').classList.add('open');
}

function closeMisMantModal(){
  document.getElementById('mMisMant').classList.remove('open');
}

async function guardarMisMantModal(){
  const btn = document.getElementById('btnGuardarMisMant');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    const res = await apiPost({ action:'selectMantenimientoCategorias', categorias:[..._misMantSeleccionadas] });
    if(!res.ok) throw new Error(res.error || 'Error al guardar las categorías');
    MIS_MANT_CATEGORIAS = [..._misMantSeleccionadas];
    toast('Categorías de mantenimiento actualizadas', 'ok');
    closeMisMantModal();
  } catch(err){
    toast('Error: '+(err.message||'error de conexión'), 'err');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Guardar';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('misMantSearch');
  if(search) search.addEventListener('input', filterMisMant);
});
```

- [ ] **Step 2: Entrada de menú (`index.html:88-94`)**

```html
      <div class="dept-menu-wrap" id="misCursosMenuWrap" style="display:none">
        <button class="tbtn" id="btnMisCursos" onclick="toggleMisCursosMenu()">📌 Mis Cursos/Aulas</button>
        <div class="dept-menu" id="misCursosMenu">
          <button class="dept-menu-item" onclick="closeMisCursosMenu();openMisModulosModal()">📚 Módulos</button>
          <button class="dept-menu-item" onclick="closeMisCursosMenu();openMisAulasModal()">🏫 Aulas</button>
          <button class="dept-menu-item" onclick="closeMisCursosMenu();openMisMantModal()">🛠️ Mantenimiento</button>
        </div>
      </div>
```

- [ ] **Step 3: Markup del modal (`index.html`, insertar después del cierre del modal `#mMisAulas`, línea 1662, antes del comentario `<!-- MODAL GESTIÓN DE AULAS -->`)**

```html

<!-- MODAL "MIS CATEGORÍAS DE MANTENIMIENTO" (autoservicio, cualquier rol) -->
<div class="mbg" id="mMisMant" style="z-index:600" onclick="if(event.target===this)closeMisMantModal()">
  <div class="modal" style="width:min(520px,100%)">
    <div class="mh"><div class="mt">🛠️ Mis categorías de mantenimiento</div><button class="mx" onclick="closeMisMantModal()">✕</button></div>
    <p style="font-size:13px;color:var(--muted);margin-bottom:10px">Marca las categorías de material de las que te encargas del mantenimiento preventivo.</p>
    <input type="text" id="misMantSearch" class="fi-w" placeholder="🔍 Buscar categoría..." oninput="filterMisMant()" style="margin-bottom:12px">
    <div id="mMisMantBody" style="max-height:55vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px"></div>
    <div class="mf" style="margin-top:18px">
      <div></div>
      <div class="mf-right">
        <button class="btn" onclick="closeMisMantModal()">Cancelar</button>
        <button class="btn btn-p" id="btnGuardarMisMant" onclick="guardarMisMantModal()">💾 Guardar</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Script tag (`index.html:2289`, justo después de `js/modal-mis-aulas.js`)**

```html
<script defer src="js/modal-mis-aulas.js"></script>
<script defer src="js/modal-mis-mantenimiento.js"></script>
```

- [ ] **Step 5: Sanity check**

Run: `node --check js/modal-mis-mantenimiento.js`

Expected: sin salida.

- [ ] **Step 6: Commit**

```bash
git add js/modal-mis-mantenimiento.js index.html
git commit -m "feat: autoservicio de categorias de mantenimiento (Mis Cursos/Aulas)"
```

---

### Task 12: Frontend — asignación admin en 🔐 Usuarios

**Files:**
- Modify: `js/prestamos.js:899-961` (`_renderUsuariosList`, `openUsuariosModal`),
  `js/prestamos.js:1150-1212` (junto a `openAulasUsuario`/`saveAulasUsuario`,
  añadir el bloque equivalente para mantenimiento)
- Modify: `index.html` (nuevo bloque de modal, después del modal
  `#mAulasUsuario` que cierra en la línea 1628)

**Interfaces:**
- Consumes: acción `userAssignMantenimiento` (Task 3), `CATS`.

- [ ] **Step 1: `openUsuariosModal` — cargar `_mant` por usuario (`js/prestamos.js:909`)**

```js
    _usuariosEditing = res.usuarios.map(u=>({...u, _nuevo:false, _resetPass:'', _modulos: u.modulos || [], _aulas: u.aulas || [], _mant: u.mantenimiento || []}));
```

- [ ] **Step 2: Botón nuevo en la fila de usuario (`js/prestamos.js:955`, justo después del botón "🏫 Aulas")**

```js
      <button class="btn btn-sm usr-mods-btn" onclick="openAulasUsuario(${i})" title="Asignar aulas en las que da clase">🏫 Aulas${nAulas>0?` (${nAulas})`:''}</button>
      <button class="btn btn-sm usr-mods-btn" onclick="openMantenimientoUsuario(${i})" title="Asignar categorías de mantenimiento">🛠️ Mantenimiento${(u._mant||[]).length>0?` (${(u._mant||[]).length})`:''}</button>
```

- [ ] **Step 3: Bloque JS nuevo — calco de `openAulasUsuario`/`saveAulasUsuario` (`js/prestamos.js`, después de la función `saveAulasUsuario`, línea 1212)**

```js

// ─── CATEGORÍAS DE MANTENIMIENTO POR USUARIO ──────────────
// Admin: superadmin/jefe de departamento asigna a cualquier usuario del
// departamento qué categorías de mantenimiento le corresponden. Mismo
// patrón que openAulasUsuario/saveAulasUsuario de arriba, contra CATS en
// vez de AULAS, y con la fila especial "Todo el departamento" (valor '').
let _mantUsuarioIdx = null;
let _mantUsuarioSeleccionadas = new Set();

function openMantenimientoUsuario(i){
  _mantUsuarioIdx = i;
  const u = _usuariosEditing[i];
  _mantUsuarioSeleccionadas = new Set(u._mant || []);
  document.getElementById('mMantenimientoUsuarioTitle').textContent = `🛠️ Mantenimiento de ${u.nombre||u.usuario}`;
  document.getElementById('mantUsuarioSearch').value = '';
  _renderMantUsuarioList('');
  document.getElementById('mMantenimientoUsuario').classList.add('open');
}

function _renderMantUsuarioList(query){
  const q = normalizeStr(query || '');
  const body = document.getElementById('mMantenimientoUsuarioBody');
  if(!body) return;
  const nombres = Object.keys(CATS || {}).filter(n => !q || normalizeStr(n).includes(q));
  const filaTodo = !q ? `
    <label class="mod-check-row">
      <input type="checkbox" value="" ${_mantUsuarioSeleccionadas.has('')?'checked':''} onchange="_toggleMantUsuario('',this.checked)">
      <span class="mod-check-name">🏷️ Todo el departamento</span>
    </label>` : '';
  const filas = nombres.map(n => `
    <label class="mod-check-row">
      <input type="checkbox" value="${escHtml(n)}" ${_mantUsuarioSeleccionadas.has(n)?'checked':''} onchange="_toggleMantUsuario('${escHtml(n)}',this.checked)">
      <span class="mod-check-name">${CATS[n]?.i?escHtml(CATS[n].i)+' ':''}${escHtml(n)}</span>
    </label>`).join('');
  body.innerHTML = filaTodo + filas || '<p style="color:var(--muted);font-size:13px">Sin resultados.</p>';
}

function _toggleMantUsuario(cat, checked){
  if(checked) _mantUsuarioSeleccionadas.add(cat);
  else _mantUsuarioSeleccionadas.delete(cat);
}

function filterMantUsuario(){
  _renderMantUsuarioList(document.getElementById('mantUsuarioSearch')?.value || '');
}

function closeMantenimientoUsuario(){
  document.getElementById('mMantenimientoUsuario').classList.remove('open');
  _renderUsuariosList();
}

async function saveMantenimientoUsuario(){
  if(_mantUsuarioIdx === null) return;
  const u = _usuariosEditing[_mantUsuarioIdx];
  if(!u.nombre.trim()){ toast('Guarda primero el nombre del usuario antes de asignar mantenimiento','err'); return; }
  const btn = document.getElementById('btnSaveMantenimientoUsuario');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    const categorias = [..._mantUsuarioSeleccionadas];
    const res = await apiPost({ action:'userAssignMantenimiento', usuario: u.usuario, categorias });
    if(!res.ok) throw new Error(res.error);
    u._mant = categorias;
    toast(`Mantenimiento actualizado para ${u.nombre}`,'ok');
    closeMantenimientoUsuario();
  } catch(e){ toast('Error: '+e.message,'err'); }
  finally { btn.disabled=false; btn.textContent='💾 Guardar mantenimiento'; }
}
```

- [ ] **Step 4: Markup del modal (`index.html`, insertar después del cierre del modal `#mAulasUsuario`, después de la línea 1628, antes del comentario `<!-- MODAL "MIS MÓDULOS" -->`)**

```html

<!-- MODAL "MANTENIMIENTO DEL USUARIO" (admin: superadmin/jefe asigna categorias a cualquier usuario) -->
<div class="mbg" id="mMantenimientoUsuario" style="z-index:600" onclick="if(event.target===this)closeMantenimientoUsuario()">
  <div class="modal" style="width:min(520px,100%)">
    <div class="mh"><div class="mt" id="mMantenimientoUsuarioTitle">🛠️ Mantenimiento del usuario</div><button class="mx" onclick="closeMantenimientoUsuario()">✕</button></div>
    <p style="font-size:13px;color:var(--muted);margin-bottom:10px">Marca las categorías de mantenimiento preventivo de las que se encarga este profesor.</p>
    <input type="text" id="mantUsuarioSearch" class="fi-w" placeholder="🔍 Buscar categoría..." oninput="filterMantUsuario()" style="margin-bottom:12px">
    <div id="mMantenimientoUsuarioBody" style="max-height:55vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px"></div>
    <div class="mf" style="margin-top:18px">
      <div></div>
      <div class="mf-right">
        <button class="btn" onclick="closeMantenimientoUsuario()">Cancelar</button>
        <button class="btn btn-p" id="btnSaveMantenimientoUsuario" onclick="saveMantenimientoUsuario()">💾 Guardar mantenimiento</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Sanity check**

Run: `node --check js/prestamos.js`

Expected: sin salida.

- [ ] **Step 6: Commit**

```bash
git add js/prestamos.js index.html
git commit -m "feat: asignacion admin de categorias de mantenimiento en Usuarios"
```

---

### Task 13: Cierre — versión, migración remota, suite completa, checklist manual

**Files:**
- Modify: `sw.js` (`VERSION`)
- Modify: `CLAUDE.md` (párrafo **Estado**)
- Modify: `docs/DEVELOPMENT.md` (entrada nueva con el detalle completo)

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Suite completa de tests de backend**

En el worktree fuera de Google Drive (`npm ci` si no se hizo ya): `npm test`

Expected: todos los tests en verde (los ~30 anteriores + los añadidos en
Tasks 2-3). Si algo falla, arreglar antes de seguir — no continuar con
tests rotos.

- [ ] **Step 2: `VERSION` en `sw.js`**

```js
const VERSION = 'v650';
```

- [ ] **Step 3: Aplicar la migración a D1 remoto**

Run (en el checkout principal, `H:\Mi unidad\Github\boscoinventario`, con
`$env:NODE_TLS_REJECT_UNAUTHORIZED="0"` si hace falta por la red
corporativa — ver `CLAUDE.md` sección Entorno):
`npx wrangler d1 execute boscoinventario --remote --file=migrations/0039_mantenimiento_preventivo.sql`

Expected: `🚣 Executed X commands` sin errores. Si `wrangler` pide login
interactivo y no es posible en este entorno, dejar este paso explícito
para que el usuario lo ejecute a mano antes de desplegar — **no
continuar** a Step 5 (push) sin que la migración esté aplicada en
remoto, o la app desplegada fallará al leer/escribir las columnas nuevas.

- [ ] **Step 4: Checklist manual (según la sección Testing del diseño) — recorrer contra un despliegue de prueba o Playwright, antes de pedir confirmación de push**

- Crear un plan (intervalo 90 días) desde el modal de un ítem sin plan
  previo → guardar → queda "Próxima" a hoy+90, "Última" en "nunca", el
  ítem no aparece aún como pendiente.
- Editar solo la nota del plan sin tocar el intervalo → la fecha de
  "Próxima" no cambia.
- Forzar una `mantPlanProximaRevision` pasada (edición directa en D1 de
  prueba) → el ítem aparece en la vista "Mantenimiento" de Inventario con
  badge 🛡️, en el contador de Inicio, y (si jefatura/superadmin) en el
  chip de "🔔 Requiere tu atención".
- "✅ Marcar revisado hoy" sobre ese ítem → nueva fila en el historial de
  mantenimiento con 🛡️/`tipo=preventivo`; el ítem deja de aparecer como
  pendiente en las 3 vistas de arriba.
- Ítem con una incidencia correctiva abierta Y un plan preventivo vencido
  a la vez → ambos badges visibles a la vez; marcar la revisión
  preventiva como hecha no toca la incidencia correctiva abierta.
- Bulk `plan-set` sobre varios ítems seleccionados → todos quedan con el
  mismo intervalo y la misma fecha de próxima revisión; `plan-off` los
  vuelve a dejar sin plan.
- Un profesor sin `config.manage` y sin categorías de mantenimiento
  autoasignadas no ve el modal "🔔 Requiere tu atención" aunque haya
  revisiones vencidas en su departamento.
- Ese mismo profesor se autoasigna una categoría con un ítem vencido
  (📌 Mis Cursos/Aulas → 🛠️ Mantenimiento) → en su siguiente visita ve la
  versión reducida del modal con un único chip.
- Jefatura asigna a un profesor una categoría vía 🔐 Usuarios → se refleja
  ahí y el profesor lo ve en "📌 Mis Cursos/Aulas" sin autoasignárselo.

Si algún punto falla, volver a la Task correspondiente y corregir antes
de continuar — no marcar este Step como hecho con fallos pendientes.

- [ ] **Step 5: Actualizar `CLAUDE.md` (párrafo Estado) y `docs/DEVELOPMENT.md`**

En `CLAUDE.md`, sustituir el primer párrafo **Estado** por uno nuevo
(2-3 frases: qué se implementó, versión, fecha) siguiendo el formato ya
usado por las entradas anteriores del archivo. En `docs/DEVELOPMENT.md`,
añadir una entrada nueva fechada con el detalle completo (columnas,
acciones, archivos tocados) — no dupliques ese detalle en `CLAUDE.md`.

- [ ] **Step 6: Commit final**

```bash
git add sw.js CLAUDE.md docs/DEVELOPMENT.md
git commit -m "chore: v650 - cierre de mantenimiento preventivo"
```

- [ ] **Step 7: Push y pull (autorizado por el usuario de antemano para esta ejecución)**

```bash
git push origin main
git pull origin main
```

Expected: push sin rechazo (fast-forward), Cloudflare Pages despliega
automáticamente `origin/main`; el `pull` posterior confirma que el
checkout local queda sincronizado con lo publicado (debe salir "Already
up to date").

---

## Self-Review

**Cobertura del spec:** Modelo de datos (Task 1) ✓; acción
`mantenimientoMarcarRevisado` (Task 2) ✓; `mantenimientosGet` con `tipo`
(Task 2) ✓; responsables autoservicio+admin (Tasks 3, 11, 12) ✓;
`misMantenimiento` (Task 4) ✓; wiring `api.js`/`roles.js` (Task 5) ✓;
plan por ítem en el modal, con "Otro…" y cálculo condicional de próxima
revisión (Task 7) ✓; aplicación en lote `plan-set`/`plan-off` (Task 9) ✓;
vista Mantenimiento mezclada + badges (Task 8) ✓; Inicio + "Requiere tu
atención" con las dos ramas (Task 10) ✓; menú "Mis Cursos/Aulas" (Task 11)
✓; botón en 🔐 Usuarios (Task 12) ✓; testing (Task 2-3 automatizado, Task
13 checklist manual) ✓.

**Desviación del spec ya corregida:** ubicación real de `MIS_AULAS` (y por
tanto de `MIS_MANT_CATEGORIAS`) es `js/config.js`, no `js/state.js` — ver
nota en la cabecera del plan.
