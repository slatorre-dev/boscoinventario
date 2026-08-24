# Mantenimiento como flujo real Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el checkbox+campos planos de mantenimiento en un flujo real con historial completo de incidencias por ítem (fecha/nota de apertura, responsable, coste, fecha/nota de cierre), sin tocar Volt ni los filtros/badges/CSV ya existentes.

**Architecture:** Tabla nueva `mantenimientos` (una fila por incidencia). Los 6 campos `mant*` de `inventario` (incluye el nuevo `mantCoste`) pasan a ser un espejo puro, calculado exclusivamente por una función nueva del backend (`syncMantenimiento`) que compara el estado viejo vs nuevo tras cada `add`/`update` de ítem y decide si abre, actualiza o cierra una incidencia — reutilizando la misma lectura de fila vieja que ya existe para el diff del historial-timeline. El frontend sustituye el checkbox+4 estados actual por un único desplegable de 6 opciones (Ninguno + 5 estados), con campos de cierre (fecha+nota, nota obligatoria) que solo aparecen al elegir un estado terminal, y un historial de solo lectura cargado bajo demanda.

**Tech Stack:** Cloudflare Pages Functions (JS, sin build), D1 (SQLite), Vanilla JS frontend sin build. Sin framework de test — verificación con scripts Node desechables para lógica pura, siguiendo la convención ya establecida en `docs/superpowers/plans/2026-08-24-historial-timeline.md`.

**Spec:** `docs/superpowers/specs/2026-08-25-mantenimiento-flujo-real-design.md`

## Global Constraints

- 5 estados en `mantEstado`: `Pendiente`, `En reparación`, `Enviado a reparar externo` (abiertos, `mant=1`), `Reparado`, `Resuelto` (cierran, `mant=0`, exigen fecha+nota de cierre).
- `inventario.mant`/`mantFecha`/`mantEstado`/`mantResp`/`mantNota`/`mantCoste` son un espejo puro calculado por el backend — el frontend nunca manda el booleano `mant`; los otros 5 los manda como entrada, pero el backend decide el valor final.
- Historial completo por ítem — tabla nueva `mantenimientos`, nunca se sobrescribe una incidencia cerrada.
- Cerrar (pasar a `Reparado`/`Resuelto`) **no** toca `inventario.est` automáticamente — sin sugerencia ni aviso.
- Sin cambios en `js/state.js` (`needsMaintenance`) ni en Volt (`lista_mantenimiento`) — ambos siguen leyendo los mismos campos espejo, que se comportan igual desde su punto de vista.
- `HEADERS_INV` (columnas de `inventario` en `functions/api/item.js` y `functions/api/list.js`) gana `mantCoste`, insertado justo después de `'mantEstado'` y antes de `'mantSolicitante'`, **en ambos archivos, mismo orden exacto** — bug recurrente ya documentado en este proyecto si se olvida uno de los dos.
- Bulk edit de mantenimiento (`js/inventory.js`) pierde la opción "Quitar mantenimiento" — cerrar una incidencia con nota solo se hace desde el modal del ítem, uno a uno.
- Sin test framework instalado (no hay `package.json`) — verificación de lógica pura con scripts Node desechables (creados en `scratchpad/`, nunca commiteados), migración D1 verificada con `wrangler d1 execute ... --remote`.

---

### Task 1: Migración D1 — tabla `mantenimientos` + columna `mantCoste`

**Files:**
- Create: `migrations/0028_mantenimientos.sql`

**Interfaces:**
- Produces: tabla `mantenimientos(id, item_id, estado, fecha_apertura, nota_apertura, responsable, coste, fecha_cierre, nota_cierre, creado_por, creado_en)` + índice `idx_mantenimientos_item_id` + columna `inventario.mantCoste` (REAL, nullable). Las Tasks 2-4 dependen de que esta migración ya esté aplicada en la D1 remota antes de poder verificarse end-to-end (aunque el código de las Tasks 2-4 puede escribirse y revisarse sin ella, solo no puede probarse contra datos reales).

- [ ] **Step 1: Crear el archivo de migración**

Crear `migrations/0028_mantenimientos.sql` con exactamente este contenido:

```sql
CREATE TABLE mantenimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  fecha_apertura TEXT NOT NULL,
  nota_apertura TEXT DEFAULT '',
  responsable TEXT DEFAULT '',
  coste REAL,
  fecha_cierre TEXT DEFAULT '',
  nota_cierre TEXT DEFAULT '',
  creado_por TEXT DEFAULT '',
  creado_en TEXT DEFAULT ''
);
CREATE INDEX idx_mantenimientos_item_id ON mantenimientos(item_id);

ALTER TABLE inventario ADD COLUMN mantCoste REAL;

-- Backfill: ítems ya marcados en mantenimiento se convierten en 1 incidencia
-- abierta cada uno (se conserva su mantEstado actual tal cual, sin forzar
-- fecha/nota de cierre aunque ya diga Reparado/Resuelto — no hay forma de
-- reconstruir ese dato histórico).
INSERT INTO mantenimientos (item_id, estado, fecha_apertura, nota_apertura, responsable, creado_en)
  SELECT id,
    CASE WHEN mantEstado IN ('Pendiente','En reparación','Enviado a reparar externo','Reparado','Resuelto')
         THEN mantEstado ELSE 'Pendiente' END,
    COALESCE(NULLIF(mantFecha,''), date('now')),
    COALESCE(mantNota,''),
    COALESCE(mantResp,''),
    datetime('now')
  FROM inventario WHERE mant = 1 OR mant = '1';
```

- [ ] **Step 2: Aplicar la migración en la D1 remota**

Run: `npx wrangler d1 execute boscoinventario --remote --file=migrations/0028_mantenimientos.sql`

Si el entorno no tiene sesión de `wrangler` activa (`npx wrangler whoami` falla o pide login interactivo), esta tarea queda **BLOCKED** — reportarlo así en vez de intentar workarounds; el controlador de la sesión tiene que aplicar la migración él mismo o pedir al usuario que ejecute `npx wrangler login` (incidente ya documentado varias veces en `CLAUDE.md` de este proyecto, el flujo OAuth necesita un navegador real).

Expected: sin errores. La tabla `mantenimientos` y la columna `inventario.mantCoste` quedan creadas en la base remota.

- [ ] **Step 3: Verificar el resultado en D1**

Run: `npx wrangler d1 execute boscoinventario --remote --command "SELECT COUNT(*) as n FROM mantenimientos"`
Expected: una fila con `n` = número de ítems que ya tenían `mant=1` en producción en el momento de aplicar la migración (puede ser 0, no es un error).

Run: `npx wrangler d1 execute boscoinventario --remote --command "PRAGMA table_info(inventario)"`
Expected: la lista de columnas incluye `mantCoste`.

- [ ] **Step 4: Commit**

```bash
git add migrations/0028_mantenimientos.sql
git commit -m "feat(mantenimiento): migración tabla mantenimientos + columna mantCoste"
```

---

### Task 2: Backend — `functions/api/item.js`, `functions/api/list.js`, `js/api.js`, `js/roles.js`

**Files:**
- Modify: `functions/api/item.js:2` (`HEADERS_INV`), `functions/api/item.js:90` (justo después de `computeItemDiff`, antes de `itemDept`), `functions/api/item.js:162-176` (acción `add`), `functions/api/item.js:178-198` (acción `update`), `functions/api/item.js:215` (justo antes de `fotosGet`, para insertar `mantenimientosGet`)
- Modify: `functions/api/list.js:2` (`HEADERS_INV`)
- Modify: `js/api.js:6` (`ENDPOINT_MAP`)
- Modify: `js/roles.js:39-40` (`ACTION_PERMISSIONS`, justo después de `fotosSync`)

**Interfaces:**
- Consumes: nada de tareas anteriores (Task 1 es solo esquema D1, sin interfaz de código).
- Produces: `MANT_OPEN_STATES`/`MANT_CLOSE_STATES` (arrays de strings) y `syncMantenimiento(db, itemId, oldRow, item, user)` (función async, muta `item` in-place con los campos mant finales, sin valor de retorno) en `functions/api/item.js` — la Task 3 (frontend) depende de que la respuesta JSON de `add`/`update` (`res.item`) refleje siempre el resultado de esta función. Acción nueva `mantenimientosGet` (recibe `{action:'mantenimientosGet', itemId}`, devuelve `{ok:true, mantenimientos:[...]}` con filas `{id, estado, fecha_apertura, nota_apertura, responsable, coste, fecha_cierre, nota_cierre}`, orden más reciente primero) — la Task 4 (frontend) depende de esta forma exacta de respuesta.

- [ ] **Step 1: Añadir `mantCoste` a `HEADERS_INV` en `item.js` y en `list.js`**

En `functions/api/item.js:2`, localizar:

```js
const HEADERS_INV = ['id','ref','aula','mod','item','qty','min','cat','loc','est','util','proveedor','tags','fecha','fecha_adquisicion','precio','mant','mantFecha','mantNota','mantResp','mantEstado','mantSolicitante','mantSolicitanteEmail','foto','obs','code','serie','es_contenedor','parent_id','tipo_material','oculto'];
```

Reemplazar por (añade `'mantCoste'` justo después de `'mantEstado'`):

```js
const HEADERS_INV = ['id','ref','aula','mod','item','qty','min','cat','loc','est','util','proveedor','tags','fecha','fecha_adquisicion','precio','mant','mantFecha','mantNota','mantResp','mantEstado','mantCoste','mantSolicitante','mantSolicitanteEmail','foto','obs','code','serie','es_contenedor','parent_id','tipo_material','oculto'];
```

En `functions/api/list.js:2`, la línea es idéntica (misma constante, mismo array) — aplicar el mismo cambio ahí también, con el mismo orden.

- [ ] **Step 2: Añadir `MANT_OPEN_STATES`, `MANT_CLOSE_STATES` y `syncMantenimiento` en `item.js`**

En `functions/api/item.js`, localizar el final de `computeItemDiff` (línea ~97, justo antes de `async function itemDept(db, id) {`):

```js
function computeItemDiff(oldRow, newItem) {
  if (!oldRow) return [];
  return DIFF_FIELDS
    .filter(f => String(oldRow[f] ?? '') !== String(newItem[f] ?? ''))
    .map(f => ({ campo: f, antes: oldRow[f] ?? '', despues: newItem[f] ?? '' }));
}

async function itemDept(db, id) {
```

Insertar entre ambas funciones:

```js
function computeItemDiff(oldRow, newItem) {
  if (!oldRow) return [];
  return DIFF_FIELDS
    .filter(f => String(oldRow[f] ?? '') !== String(newItem[f] ?? ''))
    .map(f => ({ campo: f, antes: oldRow[f] ?? '', despues: newItem[f] ?? '' }));
}

const MANT_OPEN_STATES = ['Pendiente', 'En reparación', 'Enviado a reparar externo'];
const MANT_CLOSE_STATES = ['Reparado', 'Resuelto'];

async function syncMantenimiento(db, itemId, oldRow, item, user) {
  const oldEstado = oldRow?.mantEstado || '';
  const newEstado = item.mantEstado || '';
  const wasOpen = MANT_OPEN_STATES.includes(oldEstado);
  const isOpenNow = MANT_OPEN_STATES.includes(newEstado);
  const isClosingNow = MANT_CLOSE_STATES.includes(newEstado);
  const hoy = new Date().toISOString().slice(0, 10);

  if (!oldEstado && !newEstado) return;

  if (isClosingNow) {
    const openRow = await db.prepare(
      `SELECT id FROM mantenimientos WHERE item_id=? AND estado IN (${MANT_OPEN_STATES.map(() => '?').join(',')}) ORDER BY id DESC LIMIT 1`
    ).bind(itemId, ...MANT_OPEN_STATES).first();
    const fechaCierre = item.mantFechaCierre || hoy;
    const notaCierre = item.mantNotaCierre || '';
    if (openRow) {
      await db.prepare(
        `UPDATE mantenimientos SET estado=?, responsable=?, coste=?, fecha_cierre=?, nota_cierre=? WHERE id=?`
      ).bind(newEstado, item.mantResp || '', item.mantCoste ?? null, fechaCierre, notaCierre, openRow.id).run();
    } else {
      await db.prepare(
        `INSERT INTO mantenimientos (item_id, estado, fecha_apertura, nota_apertura, responsable, coste, fecha_cierre, nota_cierre, creado_por, creado_en)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).bind(itemId, newEstado, item.mantFecha || hoy, item.mantNota || '', item.mantResp || '', item.mantCoste ?? null, fechaCierre, notaCierre, user?.usuario || '', new Date().toISOString()).run();
    }
    await db.prepare(
      `UPDATE inventario SET mant=0, mantFecha='', mantEstado='', mantResp='', mantNota='', mantCoste=NULL WHERE id=?`
    ).bind(itemId).run();
    Object.assign(item, { mant: 0, mantFecha: '', mantEstado: '', mantResp: '', mantNota: '', mantCoste: null });
    return;
  }

  if (isOpenNow && !wasOpen) {
    await db.prepare(
      `INSERT INTO mantenimientos (item_id, estado, fecha_apertura, nota_apertura, responsable, coste, creado_por, creado_en)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(itemId, newEstado, item.mantFecha || hoy, item.mantNota || '', item.mantResp || '', item.mantCoste ?? null, user?.usuario || '', new Date().toISOString()).run();
  } else if (isOpenNow && wasOpen) {
    const openRow = await db.prepare(
      `SELECT id FROM mantenimientos WHERE item_id=? AND estado IN (${MANT_OPEN_STATES.map(() => '?').join(',')}) ORDER BY id DESC LIMIT 1`
    ).bind(itemId, ...MANT_OPEN_STATES).first();
    if (openRow) {
      await db.prepare(
        `UPDATE mantenimientos SET estado=?, nota_apertura=?, responsable=?, coste=? WHERE id=?`
      ).bind(newEstado, item.mantNota || '', item.mantResp || '', item.mantCoste ?? null, openRow.id).run();
    }
  }

  if (isOpenNow) {
    await db.prepare(
      `UPDATE inventario SET mant=1, mantFecha=?, mantEstado=?, mantResp=?, mantNota=?, mantCoste=? WHERE id=?`
    ).bind(item.mantFecha || hoy, newEstado, item.mantResp || '', item.mantNota || '', item.mantCoste ?? null, itemId).run();
    Object.assign(item, { mant: 1, mantFecha: item.mantFecha || hoy, mantEstado: newEstado, mantResp: item.mantResp || '', mantNota: item.mantNota || '', mantCoste: item.mantCoste ?? null });
  }
}

async function itemDept(db, id) {
```

- [ ] **Step 2b: Verificar la lógica de `syncMantenimiento` con un script Node desechable, antes de seguir**

Crear `scratchpad/verify-sync-mantenimiento.js` (no se commitea) con una base de datos SQLite en memoria simulada mediante un stub mínimo — dado que `syncMantenimiento` usa `db.prepare(...).bind(...).first()/.run()`, la forma más simple de verificar la lógica de transición SIN una D1 real es extraer la función pura de decisión de rama (abrir/actualizar/cerrar) a mano en el script y comprobar los 5 casos de la spec:

```js
const MANT_OPEN_STATES = ['Pendiente', 'En reparación', 'Enviado a reparar externo'];
const MANT_CLOSE_STATES = ['Reparado', 'Resuelto'];

function decideBranch(oldEstado, newEstado) {
  const wasOpen = MANT_OPEN_STATES.includes(oldEstado || '');
  const isOpenNow = MANT_OPEN_STATES.includes(newEstado || '');
  const isClosingNow = MANT_CLOSE_STATES.includes(newEstado || '');
  if (!oldEstado && !newEstado) return 'noop';
  if (isClosingNow) return 'close';
  if (isOpenNow && !wasOpen) return 'open-new';
  if (isOpenNow && wasOpen) return 'update-open';
  return 'noop';
}

// Caso 1: abrir incidencia nueva
console.assert(decideBranch('', 'Pendiente') === 'open-new', 'Caso 1 falló');
// Caso 2: actualizar incidencia ya abierta (cambio de estado, sigue abierta)
console.assert(decideBranch('Pendiente', 'En reparación') === 'update-open', 'Caso 2 falló');
// Caso 3: cerrar una incidencia abierta
console.assert(decideBranch('En reparación', 'Resuelto') === 'close', 'Caso 3 falló');
// Caso 4: pasar directo de Ninguno a un estado de cierre (crea+cierra)
console.assert(decideBranch('', 'Reparado') === 'close', 'Caso 4 falló');
// Caso 5: nunca hubo ni hay incidencia (noop, no debe tocar D1)
console.assert(decideBranch('', '') === 'noop', 'Caso 5 falló');
// Caso 6: ambos estados de cierre se tratan igual
console.assert(decideBranch('Pendiente', 'Reparado') === 'close', 'Caso 6 falló');

console.log('Todos los asserts pasaron (si no se imprimió ningún "Caso" arriba con fallo).');
```

Run: `node scratchpad/verify-sync-mantenimiento.js`
Expected: solo el mensaje final, ningún `Caso N: falló`.

Borrar el script después: `rm scratchpad/verify-sync-mantenimiento.js`.

Esto verifica la lógica de decisión de rama en aislamiento (sin D1). La verificación end-to-end real contra D1 (que las 3 ramas escriben las filas correctas) se hace en la Verificación final de este plan, con Playwright + `wrangler d1 execute` contra un ítem real.

- [ ] **Step 3: Llamar a `syncMantenimiento` desde la acción `add`**

En `functions/api/item.js`, localizar (línea ~162):

```js
  if (action === 'add') {
    const maxRow = await env.DB.prepare('SELECT MAX(id) as m FROM inventario').first();
    const newId = (maxRow.m || 0) + 1;
    item.id = newId;
    if (!item.code) item.code = 'IB-' + String(newId).padStart(5,'0');
    item.es_contenedor = item.es_contenedor ? 1 : 0;
    item.parent_id = item.parent_id || null;
    item.tipo_material = item.es_contenedor ? 'inventariable' : (item.tipo_material || 'consumible');
    item.departamento = resolveItemDept(item, dept, superadmin, genericDept);
    const vals = HEADERS_INV.map(h => item[h] ?? null);
    await env.DB.prepare(`INSERT INTO inventario (${HEADERS_INV.join(',')},departamento) VALUES (${HEADERS_INV.map(()=>'?').join(',')},?)`)
      .bind(...vals, item.departamento).run();
    await auditLog(env.DB, user, 'add', newId, itemAuditSummary('Anadido', item));
    return Response.json({ ok: true, item });
  }
```

Reemplazar por:

```js
  if (action === 'add') {
    const maxRow = await env.DB.prepare('SELECT MAX(id) as m FROM inventario').first();
    const newId = (maxRow.m || 0) + 1;
    item.id = newId;
    if (!item.code) item.code = 'IB-' + String(newId).padStart(5,'0');
    item.es_contenedor = item.es_contenedor ? 1 : 0;
    item.parent_id = item.parent_id || null;
    item.tipo_material = item.es_contenedor ? 'inventariable' : (item.tipo_material || 'consumible');
    item.departamento = resolveItemDept(item, dept, superadmin, genericDept);
    const vals = HEADERS_INV.map(h => item[h] ?? null);
    await env.DB.prepare(`INSERT INTO inventario (${HEADERS_INV.join(',')},departamento) VALUES (${HEADERS_INV.map(()=>'?').join(',')},?)`)
      .bind(...vals, item.departamento).run();
    await syncMantenimiento(env.DB, newId, null, item, user);
    await auditLog(env.DB, user, 'add', newId, itemAuditSummary('Anadido', item));
    return Response.json({ ok: true, item });
  }
```

(`syncMantenimiento` va antes de `auditLog` para que, si abre una incidencia, el `item` ya esté actualizado — aunque `itemAuditSummary` no lee campos mant, así que el orden entre esas dos líneas concretas no cambia el resultado del audit log; se pone ahí por claridad de flujo, justo después del `INSERT`.)

- [ ] **Step 4: Ampliar el `SELECT` de la fila vieja en `update` y llamar a `syncMantenimiento`**

En `functions/api/item.js`, localizar (línea ~178):

```js
  if (action === 'update') {
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, item.id);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    const oldRow = await env.DB.prepare(
      `SELECT ${DIFF_FIELDS.join(',')} FROM inventario WHERE id=?`
    ).bind(item.id).first();
    item.es_contenedor = item.es_contenedor ? 1 : 0;
    item.parent_id = item.parent_id || null;
    item.tipo_material = item.es_contenedor ? 'inventariable' : (item.tipo_material || 'consumible');
    const sets = FIELDS_UPD.map(h => `${h}=?`).join(',');
    const vals = [...FIELDS_UPD.map(h => item[h] ?? null), item.id];
    await env.DB.prepare(`UPDATE inventario SET ${sets} WHERE id=?`).bind(...vals).run();
    const diffs = computeItemDiff(oldRow, item);
    const resumenUpdate = diffs.length ? JSON.stringify(diffs) : itemAuditSummary('Actualizado', item);
    await auditLog(env.DB, user, 'update', item.id, resumenUpdate);
    return Response.json({ ok: true, item });
  }
```

Reemplazar por:

```js
  if (action === 'update') {
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, item.id);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    const oldRow = await env.DB.prepare(
      `SELECT ${DIFF_FIELDS.join(',')}, mant, mantEstado, mantFecha, mantResp, mantNota, mantCoste FROM inventario WHERE id=?`
    ).bind(item.id).first();
    item.es_contenedor = item.es_contenedor ? 1 : 0;
    item.parent_id = item.parent_id || null;
    item.tipo_material = item.es_contenedor ? 'inventariable' : (item.tipo_material || 'consumible');
    const sets = FIELDS_UPD.map(h => `${h}=?`).join(',');
    const vals = [...FIELDS_UPD.map(h => item[h] ?? null), item.id];
    await env.DB.prepare(`UPDATE inventario SET ${sets} WHERE id=?`).bind(...vals).run();
    const diffs = computeItemDiff(oldRow, item);
    const resumenUpdate = diffs.length ? JSON.stringify(diffs) : itemAuditSummary('Actualizado', item);
    await auditLog(env.DB, user, 'update', item.id, resumenUpdate);
    await syncMantenimiento(env.DB, item.id, oldRow, item, user);
    return Response.json({ ok: true, item });
  }
```

(`syncMantenimiento` se llama DESPUÉS de calcular `diffs`/`resumenUpdate` y de escribir el `auditLog` de la acción `update` — el diff del historial-timeline usa `DIFF_FIELDS`, que no incluye ningún campo mant, así que el orden entre el cálculo del diff y `syncMantenimiento` no afecta a ninguno de los dos. Se llama justo antes del `return` para que el `item` que se devuelve en la respuesta ya lleve los campos mant finales.)

- [ ] **Step 5: Añadir la acción `mantenimientosGet`**

En `functions/api/item.js`, localizar el inicio del bloque `fotosGet` (línea ~215):

```js
  if (action === 'fotosGet') {
```

Insertar justo antes:

```js
  if (action === 'mantenimientosGet') {
    const itemId = body.itemId;
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, itemId);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    const rows = await env.DB.prepare(
      'SELECT id, estado, fecha_apertura, nota_apertura, responsable, coste, fecha_cierre, nota_cierre FROM mantenimientos WHERE item_id=? ORDER BY id DESC'
    ).bind(itemId).all();
    return Response.json({ ok: true, mantenimientos: rows.results || [] });
  }

  if (action === 'fotosGet') {
```

- [ ] **Step 6: Registrar `mantenimientosGet` en `js/api.js` y `js/roles.js`**

En `js/api.js:6`, localizar:

```js
  add:'item', update:'item', delete:'item', bulkImport:'item', restoreBackup:'item', toggleOculto:'item', fotosGet:'item', fotosSync:'item', buscarPorSerie:'item', detectarMultiples:'item', buscarSeriePorCodigo:'item', registrarFeedbackDeteccion:'item',
```

Reemplazar por (añade `mantenimientosGet:'item'` junto a `fotosGet`):

```js
  add:'item', update:'item', delete:'item', bulkImport:'item', restoreBackup:'item', toggleOculto:'item', fotosGet:'item', fotosSync:'item', mantenimientosGet:'item', buscarPorSerie:'item', detectarMultiples:'item', buscarSeriePorCodigo:'item', registrarFeedbackDeteccion:'item',
```

En `js/roles.js:39-40`, localizar:

```js
  fotosGet: 'items.write',
  fotosSync: 'items.write',
```

Reemplazar por:

```js
  fotosGet: 'items.write',
  fotosSync: 'items.write',
  mantenimientosGet: 'items.write',
```

- [ ] **Step 7: Commit**

```bash
git add functions/api/item.js functions/api/list.js js/api.js js/roles.js
git commit -m "feat(mantenimiento): historial real de incidencias en el backend"
```

---

### Task 3: Frontend — formulario de mantenimiento (`index.html` + `js/modal-item.js` + `js/inventory.js`)

**Files:**
- Modify: `index.html:629-635` (checkbox suelto `f_mant`), `index.html:740-767` (bloque `#maintFields`)
- Modify: `js/modal-item.js:702-724` (`isMaintenanceMarked` se queda igual, `toggleMaintFields` se reescribe), `js/modal-item.js:922-926` (población en `openModal`), `js/modal-item.js:1097-1150` (`saveItem`, validación + payload + uso de `res.item`)
- Modify: `js/inventory.js:663-664` (opciones de `bulkMant`), `js/inventory.js:776` (patch de bulk-edit)

**Interfaces:**
- Consumes: de Task 2 — la acción `update`/`add` ahora devuelve en `res.item` los campos `mant`/`mantFecha`/`mantEstado`/`mantResp`/`mantNota`/`mantCoste` ya corregidos por `syncMantenimiento` (puede diferir de lo que se mandó, ej. limpios a `''`/`null` si la incidencia se cerró).
- Produces: constante `MAINT_CLOSE_STATES` (array, mismo contenido que `MANT_CLOSE_STATES` del backend: `['Reparado', 'Resuelto']`) en `js/modal-item.js`, usada solo dentro de esta misma tarea (`toggleMaintFields`, validación en `saveItem`). El bloque de `openModal()` que la Task 4 amplía (Step 3 de esa tarea, la línea que crea/oculta `#mantHistorialLinkWrap`) es una interfaz de esta tarea hacia la Task 4 — no `MAINT_CLOSE_STATES` en sí.

- [ ] **Step 1: Sustituir el HTML del checkbox suelto y del bloque de campos**

En `index.html`, localizar (línea ~626-636):

```html
        <div><label class="fl">Estado</label>
          <select class="fi-w" id="f_est"><option>Bueno</option><option>Deteriorado</option><option>Avería</option><option>Baja</option></select>
        </div>
        <label style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:6px 8px;cursor:pointer;background:#FFD700;border-radius:6px;font-size:11px">
          <div style="display:flex;align-items:center;gap:4px">
            <input type="checkbox" id="f_mant" onchange="toggleMaintFields()" style="margin:0;cursor:pointer;min-width:16px;width:16px;height:16px">
            <span style="font-weight:bold">Solicitar</span>
          </div>
          <span style="font-weight:bold;font-size:10px;line-height:1.2">mantenimiento</span>
        </label>
      </div>
```

Reemplazar por (quita el checkbox suelto, deja solo el Estado del ítem en esa fila):

```html
        <div><label class="fl">Estado</label>
          <select class="fi-w" id="f_est"><option>Bueno</option><option>Deteriorado</option><option>Avería</option><option>Baja</option></select>
        </div>
      </div>
```

En `index.html`, localizar el bloque completo (línea ~740-767):

```html
      <!-- 🛠️ MANTENIMIENTO (opcional) -->
      <div class="maint-fields m-section" id="maintFields" style="border:none;padding:0;margin-top:0;background:none;border-top:none">
        <div style="margin-bottom:12px">
          <div class="m-section-title" style="margin-top:0">🛠️ MANTENIMIENTO</div>
        </div>
        <div>
          <label class="fl">Fecha de aviso</label>
          <input class="fi-w" id="f_mantFecha" type="date">
        </div>
        <div>
          <label class="fl">Estado mantenimiento</label>
          <select class="fi-w" id="f_mantEstado">
            <option>Pendiente</option>
            <option>En reparación</option>
            <option>Reparado</option>
            <option>Resuelto</option>
          </select>
        </div>
        <div>
          <label class="fl">Responsable</label>
          <input class="fi-w" id="f_mantResp" list="mantRespList" placeholder="Profesor/a o responsable">
          <datalist id="mantRespList"></datalist>
        </div>
        <div class="full">
          <label class="fl">Motivo / nota de reparación</label>
          <textarea class="fi-w" id="f_mantNota" placeholder="Qué ocurre, qué revisar, piezas necesarias..."></textarea>
        </div>
      </div>
```

Reemplazar por:

```html
      <!-- 🛠️ MANTENIMIENTO -->
      <div class="m-section" id="mSecMantenimiento" style="margin-top:0">
        <div class="m-section-title" style="margin-top:0">🛠️ MANTENIMIENTO</div>
        <div class="full">
          <label class="fl">Estado</label>
          <select class="fi-w" id="f_mantEstado" onchange="toggleMaintFields()">
            <option value="">— Ninguno —</option>
            <option>Pendiente</option>
            <option>En reparación</option>
            <option>Enviado a reparar externo</option>
            <option>Reparado</option>
            <option>Resuelto</option>
          </select>
        </div>
        <div class="maint-fields" id="maintFields">
          <div>
            <label class="fl">Fecha de aviso</label>
            <input class="fi-w" id="f_mantFecha" type="date">
          </div>
          <div>
            <label class="fl">Responsable</label>
            <input class="fi-w" id="f_mantResp" list="mantRespList" placeholder="Profesor/a o responsable">
            <datalist id="mantRespList"></datalist>
          </div>
          <div>
            <label class="fl">Coste (€)</label>
            <input class="fi-w" id="f_mantCoste" type="number" step="0.01" min="0" placeholder="0.00">
          </div>
          <div class="full">
            <label class="fl">Motivo / nota</label>
            <textarea class="fi-w" id="f_mantNota" placeholder="Qué ocurre, qué revisar, piezas necesarias..."></textarea>
          </div>
          <div class="full" id="maintCierreFields" style="display:none;grid-template-columns:1fr 1fr;gap:13px">
            <div>
              <label class="fl">Fecha de cierre</label>
              <input class="fi-w" id="f_mantFechaCierre" type="date">
            </div>
            <div class="full">
              <label class="fl">Nota de cierre *</label>
              <textarea class="fi-w" id="f_mantNotaCierre" placeholder="Qué se hizo para resolverlo"></textarea>
            </div>
          </div>
        </div>
        <div class="full" id="mantHistorialLinkWrap" style="display:none;margin-top:8px">
          <a href="#" onclick="toggleMantHistorial();return false" style="font-size:12px;color:var(--accent);text-decoration:none">📜 Ver historial de mantenimiento</a>
          <div id="mantHistorialBox" style="display:none;margin-top:8px;font-size:12px"></div>
        </div>
      </div>
```

(El enlace "Ver historial" y su contenedor `#mantHistorialBox` se dejan cableados en el HTML aquí — la lógica de `toggleMantHistorial()` que los rellena la construye la Task 4. El enlace queda oculto por defecto (`display:none` en `#mantHistorialLinkWrap`) hasta que la Task 3, Step 3 lo muestre para ítems existentes — para cualquier prueba manual de esta tarea antes de que la Task 4 exista, el enlace es visible pero su `onclick` fallará con "toggleMantHistorial is not defined"; es el estado intermedio esperado de una tarea con una interfaz que la siguiente tarea completa, no un bug de esta tarea.)

- [ ] **Step 2: Reescribir `toggleMaintFields()` en `js/modal-item.js`**

Localizar (línea ~714-724):

```js
function toggleMaintFields(){
  const checked = document.getElementById('f_mant')?.checked;
  const box = document.getElementById('maintFields');
  if(box) box.classList.toggle('show', !!checked);
  if(checked){
    const fecha = document.getElementById('f_mantFecha');
    const estado = document.getElementById('f_mantEstado');
    if(fecha && !fecha.value) fecha.value = new Date().toISOString().split('T')[0];
    if(estado && !estado.value) estado.value = 'Pendiente';
  }
}
```

Reemplazar por:

```js
const MAINT_CLOSE_STATES = ['Reparado', 'Resuelto'];

function toggleMaintFields(){
  const estado = document.getElementById('f_mantEstado')?.value || '';
  const box = document.getElementById('maintFields');
  if(box) box.classList.toggle('show', !!estado);
  if(estado){
    const fecha = document.getElementById('f_mantFecha');
    if(fecha && !fecha.value) fecha.value = new Date().toISOString().split('T')[0];
  }
  const cierreBox = document.getElementById('maintCierreFields');
  const isClosing = MAINT_CLOSE_STATES.includes(estado);
  if(cierreBox) cierreBox.style.display = isClosing ? 'grid' : 'none';
  if(isClosing){
    const fechaCierre = document.getElementById('f_mantFechaCierre');
    if(fechaCierre && !fechaCierre.value) fechaCierre.value = new Date().toISOString().split('T')[0];
  }
}
```

- [ ] **Step 3: Actualizar la población del formulario en `openModal()`**

Localizar (línea ~922-926):

```js
  document.getElementById('f_mant').checked=isMaintenanceMarked(m);
  document.getElementById('f_mantFecha').value=m?.mantFecha||'';
  document.getElementById('f_mantEstado').value=m?.mantEstado||'Pendiente';
  document.getElementById('f_mantResp').value=m?.mantResp||'';
  document.getElementById('f_mantNota').value=m?.mantNota||'';
  toggleMaintFields();
```

Reemplazar por:

```js
  document.getElementById('f_mantFecha').value=m?.mantFecha||'';
  document.getElementById('f_mantEstado').value=m?.mantEstado||'';
  document.getElementById('f_mantResp').value=m?.mantResp||'';
  document.getElementById('f_mantNota').value=m?.mantNota||'';
  document.getElementById('f_mantCoste').value=m?.mantCoste ?? '';
  document.getElementById('f_mantFechaCierre').value='';
  document.getElementById('f_mantNotaCierre').value='';
  const noneOption = document.querySelector('#f_mantEstado option[value=""]');
  if(noneOption) noneOption.disabled = isMaintenanceMarked(m);
  toggleMaintFields();
  const historialLink = document.getElementById('mantHistorialLinkWrap');
  if(historialLink) historialLink.style.display = existing ? '' : 'none';
```

(`isMaintenanceMarked(m)` no cambia — sigue en `js/modal-item.js:702`, se reutiliza tal cual para decidir si la opción "— Ninguno —" queda deshabilitada. La variable `existing` ya está definida más arriba en `openModal()`, línea ~871.)

- [ ] **Step 4: Añadir la validación de nota de cierre obligatoria en `saveItem()`**

Localizar (línea ~1097-1104):

```js
async function saveItem(){
  clearFieldErrors();
  const name=document.getElementById('f_item').value.trim();
  let hasError = false;
  if(!name){ markFieldError('f_item', 'El nombre es obligatorio'); hasError = true; }
  if(!document.getElementById('f_ciclo').value){ markFieldError('f_ciclo', 'Selecciona un ciclo/departamento'); hasError = true; }
  if(!document.getElementById('f_mod').value){ markFieldError('f_mod', 'Selecciona una asignatura/módulo'); hasError = true; }
  if(hasError){ toast('Revisa los campos marcados','err'); focusFirstError(); return; }
```

Reemplazar por:

```js
async function saveItem(){
  clearFieldErrors();
  const name=document.getElementById('f_item').value.trim();
  let hasError = false;
  if(!name){ markFieldError('f_item', 'El nombre es obligatorio'); hasError = true; }
  if(!document.getElementById('f_ciclo').value){ markFieldError('f_ciclo', 'Selecciona un ciclo/departamento'); hasError = true; }
  if(!document.getElementById('f_mod').value){ markFieldError('f_mod', 'Selecciona una asignatura/módulo'); hasError = true; }
  if(MAINT_CLOSE_STATES.includes(document.getElementById('f_mantEstado').value) && !document.getElementById('f_mantNotaCierre').value.trim()){
    markFieldError('f_mantNotaCierre', 'Indica qué se hizo para cerrar la incidencia'); hasError = true;
  }
  if(hasError){ toast('Revisa los campos marcados','err'); focusFirstError(); return; }
```

- [ ] **Step 5: Cambiar el payload `v` (quitar `mant`, añadir `mantCoste`/`mantFechaCierre`/`mantNotaCierre`)**

Localizar (línea ~1126-1130):

```js
    mant:document.getElementById('f_mant').checked ? '1' : '',
    mantFecha:document.getElementById('f_mantFecha').value,
    mantNota:document.getElementById('f_mantNota').value.trim(),
    mantResp:document.getElementById('f_mantResp').value.trim(),
    mantEstado:document.getElementById('f_mantEstado').value,
```

Reemplazar por:

```js
    mantFecha:document.getElementById('f_mantFecha').value,
    mantNota:document.getElementById('f_mantNota').value.trim(),
    mantResp:document.getElementById('f_mantResp').value.trim(),
    mantEstado:document.getElementById('f_mantEstado').value,
    mantCoste: document.getElementById('f_mantCoste').value === '' ? null : parseFloat(document.getElementById('f_mantCoste').value),
    mantFechaCierre: document.getElementById('f_mantFechaCierre').value,
    mantNotaCierre: document.getElementById('f_mantNotaCierre').value.trim(),
```

- [ ] **Step 6: Usar `res.item` (no el objeto local) tras `update`**

Localizar (línea ~1144-1152):

```js
    if(eid){
      const item={...items.find(x=>x.id===eid),...v};
      const res = await apiPost({action:'update', item});
      if(!res.ok) throw new Error(res.error);
      const fotosRes = await apiPost({action:'fotosSync', itemId:eid, fotos:_fotosEditing});
      if(fotosRes.ok){ item.foto = fotosRes.fotoPrincipal || ''; }
      const i=items.findIndex(x=>x.id===eid); items[i]=item;
      await uploadPendingDocs(eid, item.item, item.aula);
      if(typeof logHistorial === 'function') logHistorial('itemUpdate', item.id, item.item, `Item actualizado: ${item.item} (${item.ref || item.code || item.id})`);
      fillTagSuggestions();
      toast('Ítem actualizado','ok');
```

Reemplazar por:

```js
    if(eid){
      const item={...items.find(x=>x.id===eid),...v};
      const res = await apiPost({action:'update', item});
      if(!res.ok) throw new Error(res.error);
      const itemFinal = res.item || item;
      const fotosRes = await apiPost({action:'fotosSync', itemId:eid, fotos:_fotosEditing});
      if(fotosRes.ok){ itemFinal.foto = fotosRes.fotoPrincipal || ''; }
      const i=items.findIndex(x=>x.id===eid); items[i]=itemFinal;
      await uploadPendingDocs(eid, itemFinal.item, itemFinal.aula);
      if(typeof logHistorial === 'function') logHistorial('itemUpdate', itemFinal.id, itemFinal.item, `Item actualizado: ${itemFinal.item} (${itemFinal.ref || itemFinal.code || itemFinal.id})`);
      fillTagSuggestions();
      toast('Ítem actualizado','ok');
```

(El backend siempre devuelve `item` en la respuesta de `update` — ver `functions/api/item.js`, `return Response.json({ ok: true, item })` — así que `res.item` nunca debería faltar en un `res.ok===true`; el fallback `|| item` es solo defensivo, por si algún día cambia esa garantía.)

- [ ] **Step 7: Simplificar el bulk-edit de mantenimiento en `js/inventory.js`**

Localizar (línea ~663-664):

```js
  } else if(action === 'mant'){
    box.innerHTML = '<select id="bulkMant"><option value="1">Marcar mantenimiento</option><option value="">Quitar mantenimiento</option></select>';
```

Reemplazar por:

```js
  } else if(action === 'mant'){
    box.innerHTML = '<div style="font-size:12px;color:var(--muted)">Marca los ítems seleccionados como pendientes de mantenimiento.</div>';
```

Localizar (línea ~776):

```js
  else if(action === 'mant') patch = { mant: document.getElementById('bulkMant').value, mantEstado: document.getElementById('bulkMant').value ? 'Pendiente' : '' };
```

Reemplazar por:

```js
  else if(action === 'mant') patch = { mantEstado: 'Pendiente' };
```

- [ ] **Step 8: Revisión manual de la cadena `f_mant` eliminada**

Run: `grep -n "f_mant'" "js/modal-item.js" "index.html"` (nota: el nombre exacto del campo eliminado es `f_mant`, sin sufijo — comprobar que no queda ninguna referencia suelta a `document.getElementById('f_mant')` en ningún otro archivo del proyecto, aparte de los ya editados en este Step).

Expected: sin resultados (o solo coincidencias dentro de `f_mantFecha`/`f_mantEstado`/etc., que son campos distintos y no deben tocarse).

- [ ] **Step 9: Commit**

```bash
git add index.html js/modal-item.js js/inventory.js
git commit -m "feat(mantenimiento): formulario con estado real, coste y cierre obligatorio"
```

---

### Task 4: Frontend — historial de mantenimiento (solo lectura)

**Files:**
- Modify: `js/modal-item.js` (nueva sección, junto a las demás funciones de historial/galería — insertar cerca de `openHistorial()`)

**Interfaces:**
- Consumes: de Task 2, la acción `mantenimientosGet` (`apiPost({action:'mantenimientosGet', itemId})` → `{ok:true, mantenimientos:[{id, estado, fecha_apertura, nota_apertura, responsable, coste, fecha_cierre, nota_cierre}]}`). De Task 3, el HTML `#mantHistorialLinkWrap`/`#mantHistorialBox` ya cableado en `index.html`, y la función `escHtml()` ya existente en `js/modal-item.js:577`.
- Produces: `toggleMantHistorial()` (función global, referenciada desde el `onclick` del enlace ya insertado en la Task 3) y variable local `_mantHistorial` (cache, mismo patrón que `_fotosEditing`).

- [ ] **Step 1: Escribir un script Node desechable para la función de formato de fila del historial**

Crear `scratchpad/verify-mant-historial.js` (no se commitea):

```js
function escHtml(v){
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function _formatMantRow(m){
  const rango = m.fecha_cierre ? `${m.fecha_apertura} → ${m.fecha_cierre}` : `${m.fecha_apertura} (abierta)`;
  const coste = (m.coste !== null && m.coste !== undefined && m.coste !== '') ? ` · ${Number(m.coste).toFixed(2)}€` : '';
  const resp = m.responsable ? ` · ${escHtml(m.responsable)}` : '';
  const notaCierre = m.nota_cierre ? `<div>✅ ${escHtml(m.nota_cierre)}</div>` : '';
  return `<div style="padding:6px 0;border-bottom:1px solid var(--border)">
    <div><b>${escHtml(m.estado)}</b> · ${escHtml(rango)}${coste}${resp}</div>
    <div>${escHtml(m.nota_apertura || '')}</div>
    ${notaCierre}
  </div>`;
}

// Caso 1: incidencia cerrada con coste y responsable
const h1 = _formatMantRow({ estado:'Resuelto', fecha_apertura:'2026-08-01', fecha_cierre:'2026-08-05', nota_apertura:'No enciende', nota_cierre:'Cambiado fusible', responsable:'Juan', coste:12.5 });
console.assert(h1.includes('Resuelto') && h1.includes('12.50€') && h1.includes('Juan') && h1.includes('Cambiado fusible'), 'Caso 1 falló: ' + h1);

// Caso 2: incidencia abierta sin coste ni responsable
const h2 = _formatMantRow({ estado:'Pendiente', fecha_apertura:'2026-08-20', fecha_cierre:'', nota_apertura:'Revisar cable', nota_cierre:'', responsable:'', coste:null });
console.assert(h2.includes('(abierta)') && !h2.includes('€') && h2.includes('Revisar cable'), 'Caso 2 falló: ' + h2);

// Caso 3: valores con caracteres a escapar no deben quedar sin escapar
const h3 = _formatMantRow({ estado:'Pendiente', fecha_apertura:'2026-08-20', fecha_cierre:'', nota_apertura:'<script>alert(1)</script>', nota_cierre:'', responsable:'A & B', coste:null });
console.assert(!h3.includes('<script>alert'), 'Caso 3 falló (XSS no escapado): ' + h3);
console.assert(h3.includes('&amp;'), 'Caso 3 falló (& no escapado): ' + h3);

console.log('Todos los asserts pasaron (si no se imprimió ningún "Caso" arriba con fallo).');
```

Run: `node scratchpad/verify-mant-historial.js`
Expected: solo el mensaje final, ningún `Caso N: falló`.

- [ ] **Step 2: Pegar `_formatMantRow` y `toggleMantHistorial` en `js/modal-item.js`**

Localizar la línea `async function openHistorial(){` (ver `js/modal-item.js`, sección de historial del ítem) e insertar justo antes:

```js
let _mantHistorial = null;

function _formatMantRow(m){
  const rango = m.fecha_cierre ? `${m.fecha_apertura} → ${m.fecha_cierre}` : `${m.fecha_apertura} (abierta)`;
  const coste = (m.coste !== null && m.coste !== undefined && m.coste !== '') ? ` · ${Number(m.coste).toFixed(2)}€` : '';
  const resp = m.responsable ? ` · ${escHtml(m.responsable)}` : '';
  const notaCierre = m.nota_cierre ? `<div>✅ ${escHtml(m.nota_cierre)}</div>` : '';
  return `<div style="padding:6px 0;border-bottom:1px solid var(--border)">
    <div><b>${escHtml(m.estado)}</b> · ${escHtml(rango)}${coste}${resp}</div>
    <div>${escHtml(m.nota_apertura || '')}</div>
    ${notaCierre}
  </div>`;
}

async function toggleMantHistorial(){
  const box = document.getElementById('mantHistorialBox');
  if(!box) return;
  if(box.style.display !== 'none'){ box.style.display = 'none'; return; }
  box.style.display = 'block';
  if(_mantHistorial !== null){
    box.innerHTML = _mantHistorial.length ? _mantHistorial.map(_formatMantRow).join('') : 'Sin incidencias registradas todavía';
    return;
  }
  box.innerHTML = 'Cargando…';
  try {
    const res = await apiPost({action:'mantenimientosGet', itemId:eid});
    _mantHistorial = (res.ok && Array.isArray(res.mantenimientos)) ? res.mantenimientos : [];
    box.innerHTML = _mantHistorial.length ? _mantHistorial.map(_formatMantRow).join('') : 'Sin incidencias registradas todavía';
  } catch(e){
    box.innerHTML = 'Error al cargar el historial.';
  }
}

```

- [ ] **Step 3: Resetear `_mantHistorial` al abrir el modal (para que un ítem distinto no muestre el historial del anterior)**

Localizar en `openModal()`, la línea (añadida en la Task 3, Step 3):

```js
  const historialLink = document.getElementById('mantHistorialLinkWrap');
  if(historialLink) historialLink.style.display = existing ? '' : 'none';
```

Reemplazar por:

```js
  const historialLink = document.getElementById('mantHistorialLinkWrap');
  if(historialLink) historialLink.style.display = existing ? '' : 'none';
  _mantHistorial = null;
  const historialBox = document.getElementById('mantHistorialBox');
  if(historialBox) historialBox.style.display = 'none';
```

- [ ] **Step 4: Borrar el script desechable**

Run: `rm scratchpad/verify-mant-historial.js`

- [ ] **Step 5: Commit**

```bash
git add js/modal-item.js
git commit -m "feat(mantenimiento): historial de incidencias de solo lectura en el modal"
```

---

## Verificación final (tras las 4 tareas, antes de mergear)

No forma parte de ninguna tarea individual — la hace el controlador de la sesión, con Playwright + `wrangler d1 execute` contra un ítem real, como en el resto de features de este proyecto:

1. Abrir un ítem sin mantenimiento → el desplegable muestra "— Ninguno —" seleccionado y sin deshabilitar → elegir "Pendiente", rellenar nota+responsable → guardar → reabrir el ítem: el desplegable muestra "Pendiente", la opción "— Ninguno —" está deshabilitada, el badge de mantenimiento aparece en la tarjeta/tabla del inventario.
2. Cambiar el estado a "En reparación" sin cerrar → guardar → verificar en D1 (`SELECT * FROM mantenimientos WHERE item_id=?`) que sigue habiendo **una sola fila** (no se duplicó), con `estado='En reparación'`.
3. Cambiar a "Resuelto" sin rellenar la nota de cierre → intentar guardar → bloqueado con el campo marcado en rojo.
4. Rellenar la nota de cierre → guardar → verificar en D1 que la fila de `mantenimientos` tiene `fecha_cierre`/`nota_cierre` rellenas → reabrir el ítem: el desplegable vuelve a "— Ninguno —" (ya deshabilitado no aplica, vuelve a estar habilitado), el badge de mantenimiento desaparece.
5. Pulsar "Ver historial de mantenimiento" → aparece la incidencia recién cerrada con su nota.
6. Abrir una incidencia nueva en el mismo ítem tiempo después → cerrarla también → el historial acumula 2 filas independientes.
7. Bulk edit → seleccionar varios ítems → "Marcar mantenimiento" → los 3 quedan en estado "Pendiente" con 1 incidencia abierta cada uno.
8. CSV de inventario y el filtro "Mantenimiento" de Inicio/Inventario siguen funcionando igual con al menos un ítem en mantenimiento (regresión, sin cambios esperados).
9. Volt: preguntar "qué hay en mantenimiento" (o la frase que dispare `lista_mantenimiento`) sigue devolviendo el ítem marcado, sin cambios de comportamiento.
