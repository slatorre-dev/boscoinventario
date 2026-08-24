# Planificación de Prácticas (Reservas de Material) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a profesor/jefe de departamento reserve a "kit" of material (several items at once, tied to a ciclo/asignatura, a future date, and a free-text time slot) so it doesn't clash with another reservation for the same items/slot, then convert that reservation into a real préstamo with one click on the day of the class.

**Architecture:** Two new D1 tables (`reservas_practica` header + `reserva_items` lines) hold reservations independently from `prestamos` — a reservation never touches stock until confirmed. Three new actions in the existing `functions/api/prestar.js` (`reservaCrear`, `reservaConfirmar`, `reservaCancelar`) reuse a shared helper `crearPrestamoDesdeLinea()` extracted from the existing `prestar`/`prestarCaja` actions, so stock-decrement logic is never duplicated a third time. `functions/api/list.js` includes reservations (with nested lines) in the department-scoped bulk load, same pattern already used for `prestamos`. On the frontend, a new file `js/reservas-practica.js` adds a "📅 Planificar práctica" button to the Préstamos page (reusing the existing profesor-search and aula-select helpers already in `js/prestamos.js`) and a "📅 Ver reservas" toggle that lists pending reservations with "Confirmar recogida"/"Cancelar" actions.

**Tech Stack:** Cloudflare Pages Functions (JS) + D1 (SQLite), vanilla JS frontend, no new dependencies.

**Spec:** [`docs/superpowers/specs/2026-08-24-planificacion-practicas-design.md`](../specs/2026-08-24-planificacion-practicas-design.md)

## Global Constraints

- Franja horaria is free text (no fixed period model). Conflict detection compares `(itemId, fecha, franja)` by **exact string match only** — this is a known, user-approved limitation, not a bug to fix in this plan.
- A reservation is a **kit**: N items, one row in `reservas_practica` + N rows in `reserva_items`. No per-item reservations.
- Any department member with `loans.write` (profesor or jefe/a de departamento) can create/confirm/cancel reservations for their own department + the shared `iesjuanbosco` — no approval step.
- No editing of an existing reservation — only cancel (frees the slot) and create a new one.
- "Confirmar recogida" converts the whole kit to real préstamos at once (all-or-nothing intent, but a line with insufficient real stock at pickup time fails independently — the rest of the kit still proceeds, per spec's explicit edge case).
- Conflict checking at creation time only compares against OTHER **pending** reservations for the same item/fecha/franja — never against currently active préstamos (spec's explicit non-goal: no way to know if an active loan will be returned by a future date).
- All items in one reservation kit must belong to the same department (or the shared `iesjuanbosco`) — enforced server-side even for `superadmin`, to avoid a reservation header with an ambiguous department.
- Reuse `crearPrestamoDesdeLinea()` for every path that turns a line into a real `prestamos` row (`prestar`, `prestarCaja`, `reservaConfirmar`) — never a fourth copy of the insert+stock-decrement pattern. This project has hit bugs from duplicated logic (`HEADERS_INV` in two files, category scoping duplicated, `buscarSerieEnD1()` extracted in v549 for the same reason) — do not repeat that here.
- New actions (`reservaCrear`, `reservaConfirmar`, `reservaCancelar`) must be registered in BOTH `js/api.js` (`ENDPOINT_MAP`) and `js/roles.js` (`ACTION_PERMISSIONS`) from the start — a repeated lesson in this project's history (v522, v543, v545), never deferred to a later fix.
- No email notification on `reservaConfirmar` (out of scope — the approved spec doesn't mention it; `notifyResponsableModulo` is not called from the new actions).
- No new Cloudflare binding. No new npm dependency.
- Migrations are numbered after the last existing one (`0026_inventario_serie.sql` is the last) → this one is `0027`.
- Apply the migration to remote D1 with `npx wrangler d1 execute boscoinventario --remote --file=migrations/0027_reservas_practica.sql` (set `$env:NODE_TLS_REJECT_UNAUTHORIZED="0"` first if needed, per `CLAUDE.md`) — no local D1.
- `sw.js` `VERSION` must be bumped as the final step, matching this project's exact format (currently `v587` — confirm the live value first, it may have moved since this plan was written).
- Verification is manual/Playwright against production — this project has no automated test suite. Every code step uses `node --check` for syntax validation instead of unit tests.

---

### Task 1: Migración D1 — tablas `reservas_practica` + `reserva_items`

**Files:**
- Create: `migrations/0027_reservas_practica.sql`

**Interfaces:**
- Produces: tabla `reservas_practica` (columnas: `id, departamento, cicloId, moduloCod, moduloNombre, aulaDestino, profesorId, profesorNombre, fecha, franja, estado, obs, creadoPor, creadoEn`) y tabla `reserva_items` (columnas: `id, reservaId, itemId, itemNombre, cantidad`), más índices `idx_reserva_items_reserva` e `idx_reservas_fecha`. Todas las tareas siguientes asumen que ambas tablas ya existen en D1 remoto.

- [ ] **Step 1: Crear el archivo de migración**

```sql
CREATE TABLE IF NOT EXISTS reservas_practica (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  departamento   TEXT DEFAULT '',
  cicloId        TEXT DEFAULT '',
  moduloCod      TEXT DEFAULT '',
  moduloNombre   TEXT DEFAULT '',
  aulaDestino    TEXT DEFAULT '',
  profesorId     INTEGER DEFAULT 0,
  profesorNombre TEXT DEFAULT '',
  fecha          TEXT DEFAULT '',
  franja         TEXT DEFAULT '',
  estado         TEXT DEFAULT 'pendiente',
  obs            TEXT DEFAULT '',
  creadoPor      TEXT DEFAULT '',
  creadoEn       TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS reserva_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reservaId  INTEGER NOT NULL,
  itemId     INTEGER NOT NULL,
  itemNombre TEXT DEFAULT '',
  cantidad   INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_reserva_items_reserva ON reserva_items(reservaId);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas_practica(departamento, fecha, estado);
```

- [ ] **Step 2: Aplicar en remoto**

Run: `npx wrangler d1 execute boscoinventario --remote --file=migrations/0027_reservas_practica.sql`
Expected: salida sin error (CREATE TABLE/INDEX no devuelven filas).

- [ ] **Step 3: Verificar tablas creadas**

Run: `npx wrangler d1 execute boscoinventario --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('reservas_practica','reserva_items')"`
Expected: 2 filas.

Run: `npx wrangler d1 execute boscoinventario --remote --command="SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_reserva_items_reserva','idx_reservas_fecha')"`
Expected: 2 filas.

- [ ] **Step 4: Commit**

```bash
git add migrations/0027_reservas_practica.sql
git commit -m "feat: migracion D1 para reservas de material (planificacion de practicas)"
```

---

### Task 2: Backend — extraer `crearPrestamoDesdeLinea()` (refactor sin cambio de comportamiento)

**Files:**
- Modify: `functions/api/prestar.js` — añade la función compartida y reescribe las acciones `prestar` y `prestarCaja` para usarla, sin cambiar su comportamiento observable.

**Interfaces:**
- Produces: `async function crearPrestamoDesdeLinea(db, datos)` → recibe un objeto con `{itemId, itemNombre, cantidad, aulaOrigen, aulaDestino, profesorId, profesorNombre, gestionadoPor, fechaPrestamo, fechaPrevista, obs}`, inserta la fila en `prestamos` (calculando `id` vía `MAX(id)+1`, fijando `estado:'Activo'`), descuenta `qty` en `inventario`, y devuelve el objeto `pres` completo insertado. Consumida por `prestar`, `prestarCaja` (esta tarea) y `reservaConfirmar` (Task 4).

- [ ] **Step 1: Confirmar contenido actual de `prestar`/`prestarCaja`**

Run: `grep -n "if (action === 'prestarCaja')" -A 45 functions/api/prestar.js`

Confirma que coincide con el bloque ya visto en el spec (bucle `for (const hijo of hijos.results)` con `nextId++`, insert manual, `UPDATE inventario SET qty`).

- [ ] **Step 2: Añadir `crearPrestamoDesdeLinea` justo antes de `onRequestPost`**

Insertar inmediatamente antes de la línea `export async function onRequestPost({ request, env, data }) {`:

```js
async function crearPrestamoDesdeLinea(db, datos) {
  const maxRow = await db.prepare('SELECT MAX(id) as m FROM prestamos').first();
  const pres = {
    id: (maxRow.m || 0) + 1,
    itemId: datos.itemId,
    itemNombre: datos.itemNombre,
    cantidad: datos.cantidad,
    aulaOrigen: datos.aulaOrigen || '',
    aulaDestino: datos.aulaDestino || '',
    profesorId: datos.profesorId,
    profesorNombre: datos.profesorNombre,
    gestionadoPor: datos.gestionadoPor || '',
    fechaPrestamo: datos.fechaPrestamo || '',
    fechaPrevista: datos.fechaPrevista || '',
    fechaDevolucion: '',
    cantidadDevuelta: 0,
    estado: 'Activo',
    obs: datos.obs || '',
  };
  const vals = HEADERS_PRES.map(h => pres[h] ?? '');
  await db.prepare(`INSERT INTO prestamos (${HEADERS_PRES.join(',')}) VALUES (${HEADERS_PRES.map(()=>'?').join(',')})`)
    .bind(...vals).run();
  await db.prepare('UPDATE inventario SET qty = qty - ? WHERE id=?').bind(pres.cantidad, pres.itemId).run();
  return pres;
}
```

**Design note:** the original `prestar` action updated `qty` BEFORE inserting the row; the original `prestarCaja` inserted first, then updated `qty`. Both statements are independently awaited within the same request handler (no concurrent read-modify-write within this function), so standardizing on insert-then-update here changes no observable behavior.

- [ ] **Step 3: Reescribir la acción `prestar` para usar el helper**

Reemplazar:

```js
  if (action === 'prestar') {
    const pres = body.prestamo;
    if (!superadmin && !ownsItemDept(await itemDept(env.DB, pres.itemId), dept, genericDept)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const maxRow = await env.DB.prepare('SELECT MAX(id) as m FROM prestamos').first();
    pres.id = (maxRow.m || 0) + 1;
    pres.estado = 'Activo';
    // Descontar stock
    await env.DB.prepare('UPDATE inventario SET qty = qty - ? WHERE id=?').bind(pres.cantidad, pres.itemId).run();
    const vals = HEADERS_PRES.map(h => pres[h] ?? '');
    await env.DB.prepare(`INSERT INTO prestamos (${HEADERS_PRES.join(',')}) VALUES (${HEADERS_PRES.map(()=>'?').join(',')})`)
      .bind(...vals).run();
    await auditLog(env.DB, user, 'prestar', pres.itemId, `Préstamo ${pres.id}: ${pres.cantidad}ud a ${pres.profesorNombre}`);

    // Notificar al responsable del módulo si existe
    const rowsHtml = `<table style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td style="padding:6px;font-weight:bold">Material:</td><td style="padding:6px">${escHtml(pres.itemNombre)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Cantidad:</td><td style="padding:6px">${escHtml(pres.cantidad)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Profesor:</td><td style="padding:6px">${escHtml(pres.profesorNombre)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Aula destino:</td><td style="padding:6px">${escHtml(pres.aulaDestino || '-')}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Fecha prevista devolución:</td><td style="padding:6px">${escHtml(pres.fechaPrevista || '-')}</td></tr>
      </table>`;
    await notifyResponsableModulo(env, pres.moduloCod, pres.moduloNombre, `Préstamo de material: ${pres.itemNombre}`, rowsHtml);

    return Response.json({ ok: true, prestamo: pres });
  }
```

with:

```js
  if (action === 'prestar') {
    const pres = body.prestamo;
    if (!superadmin && !ownsItemDept(await itemDept(env.DB, pres.itemId), dept, genericDept)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const nuevo = await crearPrestamoDesdeLinea(env.DB, pres);
    await auditLog(env.DB, user, 'prestar', nuevo.itemId, `Préstamo ${nuevo.id}: ${nuevo.cantidad}ud a ${nuevo.profesorNombre}`);

    // Notificar al responsable del módulo si existe
    const rowsHtml = `<table style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td style="padding:6px;font-weight:bold">Material:</td><td style="padding:6px">${escHtml(nuevo.itemNombre)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Cantidad:</td><td style="padding:6px">${escHtml(nuevo.cantidad)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Profesor:</td><td style="padding:6px">${escHtml(nuevo.profesorNombre)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Aula destino:</td><td style="padding:6px">${escHtml(nuevo.aulaDestino || '-')}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Fecha prevista devolución:</td><td style="padding:6px">${escHtml(nuevo.fechaPrevista || '-')}</td></tr>
      </table>`;
    await notifyResponsableModulo(env, pres.moduloCod, pres.moduloNombre, `Préstamo de material: ${nuevo.itemNombre}`, rowsHtml);

    return Response.json({ ok: true, prestamo: nuevo });
  }
```

(`pres.moduloCod`/`pres.moduloNombre` are read from the original request body object `pres`, not from `nuevo` — `crearPrestamoDesdeLinea` never sets those fields since `HEADERS_PRES` doesn't include them, matching today's existing behavior where they're only used for the email, never persisted.)

- [ ] **Step 4: Reescribir la acción `prestarCaja` para usar el helper**

Reemplazar:

```js
    const maxRow = await env.DB.prepare('SELECT MAX(id) as m FROM prestamos').first();
    let nextId = (maxRow.m || 0) + 1;
    const nuevos = [];
    for (const hijo of hijos.results) {
      if (Number(hijo.qty) < 1) continue;
      const pres = {
        id: nextId++, itemId: hijo.id, itemNombre: hijo.item, cantidad: Number(hijo.qty),
        aulaOrigen: hijo.aula, aulaDestino: aulaDestino || '', profesorId, profesorNombre,
        gestionadoPor: gestionadoPor || '', fechaPrestamo: fechaPrestamo || '',
        fechaPrevista: fechaPrevista || '', fechaDevolucion: '', cantidadDevuelta: 0,
        estado: 'Activo', obs: obs || '', moduloCod: '', moduloNombre: '',
      };
      const vals = HEADERS_PRES.map(h => pres[h] ?? '');
      await env.DB.prepare(`INSERT INTO prestamos (${HEADERS_PRES.join(',')}) VALUES (${HEADERS_PRES.map(()=>'?').join(',')})`)
        .bind(...vals).run();
      await env.DB.prepare('UPDATE inventario SET qty = qty - ? WHERE id=?').bind(pres.cantidad, hijo.id).run();
      nuevos.push(pres);
    }
```

with:

```js
    const nuevos = [];
    for (const hijo of hijos.results) {
      if (Number(hijo.qty) < 1) continue;
      const nuevo = await crearPrestamoDesdeLinea(env.DB, {
        itemId: hijo.id, itemNombre: hijo.item, cantidad: Number(hijo.qty),
        aulaOrigen: hijo.aula, aulaDestino: aulaDestino || '', profesorId, profesorNombre,
        gestionadoPor: gestionadoPor || '', fechaPrestamo: fechaPrestamo || '',
        fechaPrevista: fechaPrevista || '', obs: obs || '',
      });
      nuevos.push(nuevo);
    }
```

(Every line below this block — `auditLog(...)`, the `caja?.mod` notification branch, `return Response.json(...)` — stays exactly as-is, it already reads from `nuevos`/`caja`, not from the removed local variables.)

**Design note (accepted trade-off):** the original code computed `MAX(id)` once and incremented `nextId` locally per row; the refactored version calls `crearPrestamoDesdeLinea` per row, which re-queries `MAX(id)` on every iteration (N queries instead of 1). Caja sizes in this project are small (a handful of components), so the extra D1 round-trips are negligible — the trade-off is accepted in exchange for a single, non-duplicated insert+stock-decrement code path shared by three actions instead of three separate implementations of the same logic.

- [ ] **Step 5: Syntax check**

Run: `node --check functions/api/prestar.js`
Expected: no output (syntax valid)

- [ ] **Step 6: Commit**

```bash
git add functions/api/prestar.js
git commit -m "refactor: extrae crearPrestamoDesdeLinea compartida entre prestar y prestarCaja"
```

---

### Task 3: Backend — acción `reservaCrear`

**Files:**
- Modify: `functions/api/prestar.js` — añade la acción `reservaCrear` dentro de `onRequestPost`, junto a las demás acciones (`prestar`, `prestarCaja`, `devolver`, `notificarVencidos`).

**Interfaces:**
- Consumes: `itemDept(db, id)`, `ownsItemDept(itemDeptValue, ownDept, genericDept)`, `auditLog(db, user, accion, itemId, resumen)` (todas ya existentes en este archivo).
- Produces: acción `reservaCrear` — recibe `{cicloId, moduloCod, moduloNombre, aulaDestino, profesorId, profesorNombre, fecha, franja, obs, lineas:[{itemId, itemNombre, cantidad}]}`, devuelve `{ok:true, reserva:{...}, lineas:[...]}` o `{ok:false, error:'...'}`. Consumida por Task 7 (frontend).

- [ ] **Step 1: Añadir la acción `reservaCrear`**

Insertar dentro de `onRequestPost`, justo antes del bloque `if (action === 'notificarVencidos') {`:

```js
  if (action === 'reservaCrear') {
    const { cicloId, moduloCod, moduloNombre, aulaDestino, profesorId, profesorNombre, fecha, franja, obs, lineas } = body;
    if (!fecha || !String(franja || '').trim() || !Array.isArray(lineas) || !lineas.length) {
      return Response.json({ ok: false, error: 'Faltan datos de la reserva (fecha, franja o ítems)' });
    }

    // Validar propiedad + calcular departamento único del kit
    const deptsUsados = new Set();
    for (const linea of lineas) {
      const itemDeptValue = await itemDept(env.DB, linea.itemId);
      if (!superadmin && !ownsItemDept(itemDeptValue, dept, genericDept)) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
      if (itemDeptValue !== GENERIC_DEPT) deptsUsados.add(itemDeptValue);
    }
    if (deptsUsados.size > 1) {
      return Response.json({ ok: false, error: 'Todos los ítems de una misma reserva deben ser del mismo departamento' });
    }
    const departamentoReserva = deptsUsados.size === 1 ? [...deptsUsados][0] : (dept || GENERIC_DEPT);

    // Comprobar disponibilidad (stock actual − lo ya reservado en el mismo hueco exacto)
    for (const linea of lineas) {
      const itemRow = await env.DB.prepare('SELECT item, qty FROM inventario WHERE id=?').bind(linea.itemId).first();
      if (!itemRow) return Response.json({ ok: false, error: `Ítem ${linea.itemId} no encontrado` });
      const reservadoRow = await env.DB.prepare(`
        SELECT COALESCE(SUM(ri.cantidad),0) as total
        FROM reserva_items ri
        JOIN reservas_practica rp ON rp.id = ri.reservaId
        WHERE ri.itemId = ? AND rp.fecha = ? AND rp.franja = ? AND rp.estado = 'pendiente'
      `).bind(linea.itemId, fecha, franja).first();
      const yaReservado = Number(reservadoRow?.total || 0);
      const disponible = Number(itemRow.qty) - yaReservado;
      if (Number(linea.cantidad) > disponible) {
        return Response.json({ ok: false, error: `${itemRow.item}: solo quedan ${disponible} libre(s) para ${fecha} · ${franja}` });
      }
    }

    // Todo validado antes de escribir nada — evita dejar filas parciales si una línea falla
    const fechaCreacion = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const insertReserva = await env.DB.prepare(`
      INSERT INTO reservas_practica (departamento, cicloId, moduloCod, moduloNombre, aulaDestino, profesorId, profesorNombre, fecha, franja, estado, obs, creadoPor, creadoEn)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?)
    `).bind(
      departamentoReserva, cicloId || '', moduloCod || '', moduloNombre || '', aulaDestino || '',
      profesorId || 0, profesorNombre || '', fecha, String(franja).trim(), obs || '',
      user?.usuario || '', fechaCreacion
    ).run();
    const reservaId = insertReserva.meta?.last_row_id;

    const lineasGuardadas = [];
    for (const linea of lineas) {
      await env.DB.prepare('INSERT INTO reserva_items (reservaId, itemId, itemNombre, cantidad) VALUES (?,?,?,?)')
        .bind(reservaId, linea.itemId, linea.itemNombre, linea.cantidad).run();
      lineasGuardadas.push({ reservaId, itemId: linea.itemId, itemNombre: linea.itemNombre, cantidad: linea.cantidad });
    }

    await auditLog(env.DB, user, 'reservaCrear', reservaId, `Reserva ${reservaId} creada: ${lineas.length} ítem(s) para ${fecha} · ${franja}`);

    return Response.json({
      ok: true,
      reserva: {
        id: reservaId, departamento: departamentoReserva, cicloId: cicloId || '', moduloCod: moduloCod || '',
        moduloNombre: moduloNombre || '', aulaDestino: aulaDestino || '', profesorId: profesorId || 0,
        profesorNombre: profesorNombre || '', fecha, franja: String(franja).trim(), estado: 'pendiente',
        obs: obs || '', creadoPor: user?.usuario || '', creadoEn: fechaCreacion,
      },
      lineas: lineasGuardadas,
    });
  }

```

- [ ] **Step 2: Syntax check**

Run: `node --check functions/api/prestar.js`
Expected: no output (syntax valid)

- [ ] **Step 3: Commit**

```bash
git add functions/api/prestar.js
git commit -m "feat: accion reservaCrear (planificacion de practicas)"
```

---

### Task 4: Backend — acciones `reservaConfirmar` y `reservaCancelar`

**Files:**
- Modify: `functions/api/prestar.js` — añade ambas acciones dentro de `onRequestPost`.

**Interfaces:**
- Consumes: `crearPrestamoDesdeLinea(db, datos)` (Task 2), `ownsItemDept` (existente).
- Produces: acción `reservaConfirmar` → `{ok:true, prestamos:[...], fallos:[{itemNombre, motivo}]}`. Acción `reservaCancelar` → `{ok:true}`. Consumidas por Task 8 (frontend).

- [ ] **Step 1: Añadir `reservaConfirmar` y `reservaCancelar`**

Insertar justo después del bloque de `reservaCrear` añadido en Task 3 (antes de `if (action === 'notificarVencidos') {`):

```js
  if (action === 'reservaConfirmar') {
    const { reservaId } = body;
    const reserva = await env.DB.prepare('SELECT * FROM reservas_practica WHERE id=?').bind(reservaId).first();
    if (!reserva) return Response.json({ ok: false, error: 'Reserva no encontrada' });
    if (reserva.estado !== 'pendiente') return Response.json({ ok: false, error: 'La reserva ya no está pendiente' });
    if (!superadmin && !ownsItemDept(reserva.departamento, dept, genericDept)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }

    const lineas = await env.DB.prepare('SELECT * FROM reserva_items WHERE reservaId=?').bind(reservaId).all();
    const hoy = new Date().toISOString().split('T')[0];
    const nuevos = [];
    const fallos = [];
    for (const linea of lineas.results || []) {
      const itemRow = await env.DB.prepare('SELECT item, aula, qty FROM inventario WHERE id=?').bind(linea.itemId).first();
      if (!itemRow) { fallos.push({ itemNombre: linea.itemNombre, motivo: 'El ítem ya no existe' }); continue; }
      if (Number(itemRow.qty) < Number(linea.cantidad)) {
        fallos.push({ itemNombre: linea.itemNombre, motivo: `Solo quedan ${itemRow.qty} disponible(s), se reservaron ${linea.cantidad}` });
        continue;
      }
      const nuevo = await crearPrestamoDesdeLinea(env.DB, {
        itemId: linea.itemId, itemNombre: linea.itemNombre, cantidad: linea.cantidad,
        aulaOrigen: itemRow.aula, aulaDestino: reserva.aulaDestino, profesorId: reserva.profesorId,
        profesorNombre: reserva.profesorNombre, gestionadoPor: user?.nombre || '', fechaPrestamo: hoy,
        fechaPrevista: '', obs: reserva.obs || '',
      });
      nuevos.push(nuevo);
    }

    await env.DB.prepare("UPDATE reservas_practica SET estado='recogida' WHERE id=?").bind(reservaId).run();
    await auditLog(env.DB, user, 'reservaConfirmar', reservaId, `Recogida de reserva ${reservaId}: ${nuevos.length}/${(lineas.results||[]).length} línea(s)`);

    return Response.json({ ok: true, prestamos: nuevos, fallos });
  }

  if (action === 'reservaCancelar') {
    const { reservaId } = body;
    const reserva = await env.DB.prepare('SELECT * FROM reservas_practica WHERE id=?').bind(reservaId).first();
    if (!reserva) return Response.json({ ok: false, error: 'Reserva no encontrada' });
    if (reserva.estado !== 'pendiente') return Response.json({ ok: false, error: 'Solo se pueden cancelar reservas pendientes' });
    if (!superadmin && !ownsItemDept(reserva.departamento, dept, genericDept)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    await env.DB.prepare("UPDATE reservas_practica SET estado='cancelada' WHERE id=?").bind(reservaId).run();
    await auditLog(env.DB, user, 'reservaCancelar', reservaId, `Reserva ${reservaId} cancelada`);
    return Response.json({ ok: true });
  }

```

**Design note:** `reservaConfirmar` checks real stock per line right before calling `crearPrestamoDesdeLinea` (the helper itself has no such check, matching `prestar`/`prestarCaja`'s existing behavior — this plan doesn't change that for the other two callers). A line with insufficient stock is skipped and reported in `fallos`; the rest of the kit still proceeds — per the spec's explicit edge case ("si al final no se recoge todo, se puede devolver parcialmente después").

- [ ] **Step 2: Syntax check**

Run: `node --check functions/api/prestar.js`
Expected: no output (syntax valid)

- [ ] **Step 3: Commit**

```bash
git add functions/api/prestar.js
git commit -m "feat: acciones reservaConfirmar y reservaCancelar (planificacion de practicas)"
```

---

### Task 5: Backend — incluir reservas en la carga general (`list.js`)

**Files:**
- Modify: `functions/api/list.js` — añade `reservas_practica`/`reserva_items` a la carga department-scoped ya existente.

**Interfaces:**
- Produces: campo nuevo `reservas` en la respuesta JSON de `GET /api/list`, array de objetos `{id, departamento, cicloId, moduloCod, moduloNombre, aulaDestino, profesorId, profesorNombre, fecha, franja, estado, obs, creadoPor, creadoEn, lineas:[{id, reservaId, itemId, itemNombre, cantidad}]}`. Consumido por Task 6 (frontend, carga inicial) y Task 8 (vista de reservas pendientes).

- [ ] **Step 1: Confirmar contenido actual del `Promise.all` y del `Response.json` final**

Run: `grep -n "const \[items, profesores" -A 25 functions/api/list.js`
Run: `grep -n "return Response.json({" -A 12 functions/api/list.js`

Confirma que coinciden con lo ya visto (7 queries en el `Promise.all`, y el `Response.json` final con `itemsH, itemsC, profesores, prestamos, aulas, cats, ciclos, user`).

- [ ] **Step 2: Añadir la query de `reservas_practica` al `Promise.all`**

Encuentra:

```js
  const [items, profesores, usuarios, prestamos, aulas, cats, ciclosRows] = await Promise.all([
```

Reemplaza esa línea y añade una entrada más al array de destructuring y otra promesa al array de promesas — el bloque completo pasa de 7 a 8 elementos. Encuentra el final del array de promesas (la línea que cierra el `Promise.all`):

```js
    superadmin
      ? env.DB.prepare('SELECT * FROM ciclos ORDER BY cicloOrden, modOrden').all()
      : env.DB.prepare(`SELECT * FROM ciclos WHERE departamento=? OR departamento='${genericDept}' ORDER BY cicloOrden, modOrden`).bind(dept).all(),
  ]);
```

Reemplaza por:

```js
    superadmin
      ? env.DB.prepare('SELECT * FROM ciclos ORDER BY cicloOrden, modOrden').all()
      : env.DB.prepare(`SELECT * FROM ciclos WHERE departamento=? OR departamento='${genericDept}' ORDER BY cicloOrden, modOrden`).bind(dept).all(),
    superadmin
      ? env.DB.prepare("SELECT * FROM reservas_practica WHERE estado != 'cancelada' ORDER BY fecha, id").all()
      : env.DB.prepare(`SELECT * FROM reservas_practica WHERE (departamento=? OR departamento='${genericDept}') AND estado != 'cancelada' ORDER BY fecha, id`).bind(dept).all(),
  ]);
```

Y actualiza la línea de destructuring correspondiente (justo antes):

```js
  const [items, profesores, usuarios, prestamos, aulas, cats, ciclosRows] = await Promise.all([
```

a:

```js
  const [items, profesores, usuarios, prestamos, aulas, cats, ciclosRows, reservasRows] = await Promise.all([
```

- [ ] **Step 3: Cargar las líneas de las reservas y anidarlas**

Encuentra:

```js
  // Compresión: items como array de arrays
  const itemRows = items.results || [];
  const itemsC = itemRows.map(it => HEADERS_INV.map(h => it[h] ?? ''));
```

Añade justo después de esas 3 líneas (antes del `return Response.json`):

```js

  // Reservas de práctica: cargar líneas de las reservas ya filtradas por departamento y anidarlas
  const reservaIds = (reservasRows.results || []).map(r => r.id);
  let reservaItemsRows = [];
  if (reservaIds.length) {
    const placeholders = reservaIds.map(() => '?').join(',');
    const ri = await env.DB.prepare(`SELECT * FROM reserva_items WHERE reservaId IN (${placeholders})`).bind(...reservaIds).all();
    reservaItemsRows = ri.results || [];
  }
  const reservas = (reservasRows.results || []).map(r => ({
    ...r,
    lineas: reservaItemsRows.filter(li => Number(li.reservaId) === Number(r.id)),
  }));
```

- [ ] **Step 4: Añadir `reservas` a la respuesta**

Encuentra:

```js
  return Response.json({
    ok: true,
    itemsH: HEADERS_INV,
    itemsC,
    profesores: mergeProfesores(profesores.results, usuarios.results),
    prestamos: prestamos.results,
    aulas: aulas.results,
    cats: mergeCats(cats.results, itemRows),
    ciclos: cicloOrder.map(id => cicloMap[id]),
    user
  });
```

Reemplaza por:

```js
  return Response.json({
    ok: true,
    itemsH: HEADERS_INV,
    itemsC,
    profesores: mergeProfesores(profesores.results, usuarios.results),
    prestamos: prestamos.results,
    reservas,
    aulas: aulas.results,
    cats: mergeCats(cats.results, itemRows),
    ciclos: cicloOrder.map(id => cicloMap[id]),
    user
  });
```

- [ ] **Step 5: Syntax check**

Run: `node --check functions/api/list.js`
Expected: no output (syntax valid)

- [ ] **Step 6: Commit**

```bash
git add functions/api/list.js
git commit -m "feat: incluye reservas de practica en la carga general de list.js"
```

---

### Task 6: Registro de permisos + estado global frontend

**Files:**
- Modify: `js/api.js` — `ENDPOINT_MAP`
- Modify: `js/roles.js` — `ACTION_PERMISSIONS`
- Modify: `js/state.js` — declaración de estado global
- Modify: `js/auth.js` — carga inicial de `reservas` desde `list`

**Interfaces:**
- Produces: `reservaCrear`/`reservaConfirmar`/`reservaCancelar` enrutadas a `functions/api/prestar.js` y protegidas por el permiso `loans.write`; variable global `reservas` (array) poblada tras `loadData()`. Consumidas por Tasks 7 y 8.

- [ ] **Step 1: Registrar las acciones en `js/api.js`**

Encuentra:

```js
  prestar:'prestar', devolver:'prestar', prestarCaja:'prestar', notificarVencidos:'prestar',
```

Reemplaza por:

```js
  prestar:'prestar', devolver:'prestar', prestarCaja:'prestar', notificarVencidos:'prestar',
  reservaCrear:'prestar', reservaConfirmar:'prestar', reservaCancelar:'prestar',
```

- [ ] **Step 2: Registrar los permisos en `js/roles.js`**

Encuentra:

```js
  prestar: 'loans.write',
  devolver: 'loans.write',
  notificarVencidos: 'loans.write',
```

Reemplaza por:

```js
  prestar: 'loans.write',
  devolver: 'loans.write',
  notificarVencidos: 'loans.write',
  reservaCrear: 'loans.write',
  reservaConfirmar: 'loans.write',
  reservaCancelar: 'loans.write',
```

- [ ] **Step 3: Declarar el estado global en `js/state.js`**

Encuentra:

```js
let prestamos = [];
```

Reemplaza por:

```js
let prestamos = [];
let reservas = [];
```

- [ ] **Step 4: Cargar `reservas` en `js/auth.js`**

Encuentra:

```js
    profesores = res.profesores || [];
    prestamos = res.prestamos || [];
```

Reemplaza por:

```js
    profesores = res.profesores || [];
    prestamos = res.prestamos || [];
    reservas = res.reservas || [];
```

- [ ] **Step 5: Syntax check**

Run: `node --check js/api.js`
Run: `node --check js/roles.js`
Run: `node --check js/state.js`
Run: `node --check js/auth.js`
Expected: no output en ninguno (sintaxis válida)

- [ ] **Step 6: Commit**

```bash
git add js/api.js js/roles.js js/state.js js/auth.js
git commit -m "feat: registra acciones y estado global para reservas de practica"
```

---

### Task 7: Frontend — modal de creación de reserva

**Files:**
- Modify: `index.html` — botón "📅 Planificar práctica" en la toolbar de Préstamos + modal nuevo `#mReservaPractica`.
- Create: `js/reservas-practica.js` — lógica de apertura, búsqueda/añadido de ítems, y guardado.

**Interfaces:**
- Consumes: `loanTeacherOptions()`, `_renderProfSelectOptions()`, `filterProfSelect()`, `renderAulaOptions()`, `requirePerm()`, `apiPost()`, `escHtml()`, `normalize()`, `toast()` (todas ya existentes en `js/prestamos.js`/`js/api.js`/`js/roles.js`); `CICLOS`, `AULAS`, `items`, `profesores`, `reservas` (globales existentes/Task 6).
- Produces: `openReservaPractica()`, `closeReservaPractica()`, `guardarReservaPractica()` — funciones globales invocadas desde `index.html`. No exporta nada que otras tareas consuman (Task 8 es independiente, solo comparte la variable global `reservas`).

- [ ] **Step 1: Extender `filterProfSelect` para soportar un tercer selector**

`filterProfSelect` (en `js/prestamos.js`) hoy solo distingue `_presProfOptions`/`_cajaProfOptions` por un ternario hardcodeado — necesita reconocer también `_reservaProfOptions` (declarada en el nuevo archivo de esta tarea).

Run: `grep -n "function filterProfSelect" -A 5 js/prestamos.js`

Confirma que coincide con:

```js
function filterProfSelect(listVarName, inputId, selectId){
  const full = listVarName === '_presProfOptions' ? _presProfOptions : _cajaProfOptions;
  const q = normalize(document.getElementById(inputId).value);
  const filtered = q ? full.filter(p => normalize(p.nombre).includes(q)) : full;
  _renderProfSelectOptions(selectId, filtered);
}
```

Reemplaza por:

```js
function filterProfSelect(listVarName, inputId, selectId){
  const optionsMap = { _presProfOptions, _cajaProfOptions, _reservaProfOptions };
  const full = optionsMap[listVarName] || [];
  const q = normalize(document.getElementById(inputId).value);
  const filtered = q ? full.filter(p => normalize(p.nombre).includes(q)) : full;
  _renderProfSelectOptions(selectId, filtered);
}
```

(`_reservaProfOptions` se declara en `js/reservas-practica.js`, Step 3 de esta tarea — como es una variable `let` de nivel superior de script, es accesible aquí en tiempo de ejecución independientemente del orden de carga de los `<script>`, siempre que ya se haya cargado la página antes de que el usuario interactúe.)

- [ ] **Step 2: Syntax check de `js/prestamos.js`**

Run: `node --check js/prestamos.js`
Expected: no output

- [ ] **Step 3: Crear `js/reservas-practica.js`**

```js
// ═════════════════════════════════════════════════════════
// PLANIFICACIÓN DE PRÁCTICAS (RESERVAS DE MATERIAL)
// ═════════════════════════════════════════════════════════
let _reservaProfOptions = [];
let _reservaLineas = [];
let _reservaLineaRowId = 0;
let _reservaItemsDisponibles = [];

function openReservaPractica(){
  if(!requirePerm('loans.write')) return;
  _reservaLineas = [];
  _reservaLineaRowId = 0;

  const cicloSel = document.getElementById('res_ciclo');
  const ownCiclos = (typeof CICLOS !== 'undefined' ? CICLOS : []).filter(c => c.id !== 'iesjuanbosco');
  const opciones = ['<option value="">Sin asignar</option>'];
  ownCiclos.forEach(c => {
    (c.modulos || []).forEach(m => {
      opciones.push(`<option value="${escHtml(c.id)}__${escHtml(m.cod)}">${escHtml(c.name)} — ${escHtml(m.name)}</option>`);
    });
  });
  cicloSel.innerHTML = opciones.join('');
  cicloSel.value = (ownCiclos.length === 1 && (ownCiclos[0].modulos || []).length === 1)
    ? `${ownCiclos[0].id}__${ownCiclos[0].modulos[0].cod}` : '';

  document.getElementById('res_fecha').value = '';
  document.getElementById('res_franja').value = '';
  document.getElementById('res_obs').value = '';

  document.getElementById('res_profFiltQ').value = '';
  _reservaProfOptions = loanTeacherOptions();
  const profPropio = _reservaProfOptions.find(p => p.nombre.toLowerCase().trim() === (SESSION?.nombre||'').toLowerCase().trim());
  _renderProfSelectOptions('res_prof', _reservaProfOptions, profPropio ? profPropio.id : undefined);

  document.getElementById('res_aula').innerHTML = '<option value="">— Sin especificar —</option>' + renderAulaOptions();

  document.getElementById('res_itemFiltAula').innerHTML = '<option value="">Todas las aulas</option>' + renderAulaOptions();
  document.getElementById('res_itemFiltQ').value = '';
  filterReservaItems();

  _renderReservaLineas();
  document.getElementById('mReservaPractica').classList.add('open');
}

function closeReservaPractica(){
  document.getElementById('mReservaPractica').classList.remove('open');
}

function filterReservaItems(){
  const aulaVal = document.getElementById('res_itemFiltAula').value;
  const q = normalize(document.getElementById('res_itemFiltQ').value);
  let filtered = items.filter(x => Number(x.qty) > 0);
  if(aulaVal) filtered = filtered.filter(x => String(x.aula) === String(aulaVal));
  if(q) filtered = filtered.filter(x => normalize(x.item + ' ' + (x.ref||'')).includes(q));
  filtered.sort((a,b) => a.item.localeCompare(b.item));
  _reservaItemsDisponibles = filtered;
  document.getElementById('res_itemSelect').innerHTML = '<option value="">— Seleccionar ítem —</option>' +
    filtered.map(x => {
      const aulaNombre = AULAS.find(a=>a.id===x.aula)?.name || x.aula || '—';
      return `<option value="${x.id}">${escHtml(x.item)}${x.ref?' ['+escHtml(x.ref)+']':''} · ${escHtml(aulaNombre)} · ${x.qty} uds.</option>`;
    }).join('');
}

function anadirLineaReserva(){
  const itemId = document.getElementById('res_itemSelect').value;
  if(!itemId){ toast('Selecciona un ítem','err'); return; }
  const item = _reservaItemsDisponibles.find(x => String(x.id) === String(itemId));
  if(!item) return;
  if(_reservaLineas.some(l => String(l.itemId) === String(itemId))){
    toast('Ese ítem ya está en la lista','err');
    return;
  }
  _reservaLineas.push({ _rowId: _reservaLineaRowId++, itemId: item.id, itemNombre: item.item, cantidad: 1, maxQty: Number(item.qty) });
  _renderReservaLineas();
}

function _renderReservaLineas(){
  const body = document.getElementById('resLineasBody');
  const wrap = document.getElementById('resLineasWrap');
  const btnGuardar = document.getElementById('btnReservaGuardar');
  if(!_reservaLineas.length){
    wrap.style.display = 'none';
    btnGuardar.disabled = true;
    return;
  }
  wrap.style.display = 'block';
  btnGuardar.disabled = false;
  body.innerHTML = _reservaLineas.map(l => `
    <tr data-row-id="${l._rowId}">
      <td style="padding:4px">${escHtml(l.itemNombre)}</td>
      <td style="padding:4px"><input type="number" class="fi-w" min="1" max="${l.maxQty}" value="${l.cantidad}" style="width:70px" oninput="_reservaActualizarCant(${l._rowId},this.value)"></td>
      <td style="padding:4px;text-align:center"><button class="btn-icon-only" onclick="_reservaEliminarLinea(${l._rowId})" title="Eliminar" style="cursor:pointer;border:none;background:none;font-size:16px">🗑️</button></td>
    </tr>`).join('');
}

function _reservaActualizarCant(rowId, valor){
  const l = _reservaLineas.find(x => x._rowId === rowId);
  if(!l) return;
  l.cantidad = Math.max(1, Math.min(parseInt(valor,10) || 1, l.maxQty));
}

function _reservaEliminarLinea(rowId){
  _reservaLineas = _reservaLineas.filter(l => l._rowId !== rowId);
  _renderReservaLineas();
}

async function guardarReservaPractica(){
  const fecha = document.getElementById('res_fecha').value;
  const franja = document.getElementById('res_franja').value.trim();
  const profId = document.getElementById('res_prof').value;
  if(!fecha){ toast('Indica la fecha de la práctica','err'); return; }
  if(!franja){ toast('Indica la franja horaria','err'); return; }
  if(!profId){ toast('Selecciona un/a profesor/a','err'); return; }
  if(!_reservaLineas.length){ toast('Añade al menos un ítem','err'); return; }
  const prof = profesores.find(p => String(p.id) === String(profId));
  if(!prof) return;

  const cicloVal = document.getElementById('res_ciclo').value;
  const [cicloId, moduloCod] = cicloVal ? cicloVal.split('__') : ['', ''];
  const cicloInfo = cicloId ? CICLOS.find(c => c.id === cicloId) : null;
  const moduloInfo = cicloInfo ? (cicloInfo.modulos||[]).find(m => String(m.cod) === moduloCod) : null;

  const btn = document.getElementById('btnReservaGuardar');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    const res = await apiPost({
      action: 'reservaCrear',
      cicloId: cicloId || '',
      moduloCod: moduloCod || '',
      moduloNombre: moduloInfo ? moduloInfo.name : '',
      aulaDestino: document.getElementById('res_aula').value,
      profesorId: prof.id,
      profesorNombre: prof.nombre,
      fecha, franja,
      obs: document.getElementById('res_obs').value.trim(),
      lineas: _reservaLineas.map(l => ({ itemId: l.itemId, itemNombre: l.itemNombre, cantidad: l.cantidad })),
    });
    if(!res.ok) throw new Error(res.error);
    reservas.push({ ...res.reserva, lineas: res.lineas });
    closeReservaPractica();
    toast('Práctica planificada','ok');
    if(document.getElementById('pPres').classList.contains('active') && typeof renderReservasPendientes === 'function') renderReservasPendientes();
  } catch(err){ toast('Error: '+err.message,'err'); }
  finally { btn.disabled=false; btn.textContent='📅 Guardar reserva'; }
}
```

- [ ] **Step 4: Syntax check**

Run: `node --check js/reservas-practica.js`
Expected: no output

- [ ] **Step 5: Añadir el `<script>` en `index.html`**

Run: `grep -n 'src="js/prestamos.js"' index.html`

Añade una línea nueva justo después de esa, con el mismo formato:

```html
<script src="js/reservas-practica.js"></script>
```

- [ ] **Step 6: Añadir el botón en la toolbar de Préstamos**

Encuentra:

```html
      <button class="btn btn-loan icon-btn" data-perm="loans.write" onclick="openPrestarPicker()">⌛ <span class="btn-text">Nuevo préstamo</span></button>
      <button class="btn icon-btn" data-perm="profesores.manage" onclick="openProfModal()">👥 <span class="btn-text">Gestionar prestatarios externos</span></button>
```

Reemplaza por:

```html
      <button class="btn btn-loan icon-btn" data-perm="loans.write" onclick="openPrestarPicker()">⌛ <span class="btn-text">Nuevo préstamo</span></button>
      <button class="btn icon-btn" data-perm="loans.write" style="border-color:var(--accent);color:var(--accent)" onclick="openReservaPractica()">📅 <span class="btn-text">Planificar práctica</span></button>
      <button class="btn icon-btn" data-perm="profesores.manage" onclick="openProfModal()">👥 <span class="btn-text">Gestionar prestatarios externos</span></button>
```

(`data-perm="loans.write"` es seguro aquí porque, a diferencia de `#btnMultiEquipo`/`#btnRevisionAula`, la visibilidad de este botón depende únicamente del permiso — no de `cf.type` ni de ninguna otra condición dinámica que `applyRoleUI()` pudiera pisar.)

- [ ] **Step 7: Añadir el modal `#mReservaPractica`**

Encuentra el cierre del modal `mPrestarCaja` (justo antes del comentario `<!-- MODAL PICKER TIPO DE PRÉSTAMO -->`):

```html
    <div class="mf">
      <div></div>
      <div class="mf-right">
        <button class="btn" onclick="closePrestarCaja()">Cancelar</button>
        <button class="btn btn-loan" id="btnPrestarCajaSave" onclick="confirmPrestarCaja()">📦 Registrar préstamo de caja</button>
      </div>
    </div>
  </div>
</div>

<!-- MODAL PICKER TIPO DE PRÉSTAMO -->
```

Reemplaza por (añade el modal nuevo entre ambos, sin tocar el cierre de `mPrestarCaja`):

```html
    <div class="mf">
      <div></div>
      <div class="mf-right">
        <button class="btn" onclick="closePrestarCaja()">Cancelar</button>
        <button class="btn btn-loan" id="btnPrestarCajaSave" onclick="confirmPrestarCaja()">📦 Registrar préstamo de caja</button>
      </div>
    </div>
  </div>
</div>

<!-- MODAL PLANIFICAR PRÁCTICA (RESERVA DE MATERIAL) -->
<div class="mbg" id="mReservaPractica" onclick="if(event.target===this)closeReservaPractica()">
  <div class="modal">
    <div class="mh"><span class="mti">📅 Planificar práctica</span><button class="mcl" onclick="closeReservaPractica()">✕</button></div>
    <div class="fg">
      <div><label class="fl">Ciclo/Asignatura</label><select class="fi-w" id="res_ciclo"></select></div>
      <div><label class="fl">Aula destino</label><select class="fi-w" id="res_aula"></select></div>
      <div><label class="fl">Fecha de la práctica *</label><input class="fi-w" id="res_fecha" type="date"></div>
      <div><label class="fl">Franja horaria *</label><input class="fi-w" id="res_franja" type="text" placeholder='Ej. "10:00-11:00" o "3ª hora"'></div>
      <div class="full"><label class="fl">Profesor/a *</label>
        <input type="text" class="fi-w" id="res_profFiltQ" placeholder="Buscar por nombre…" autocomplete="off" oninput="filterProfSelect('_reservaProfOptions','res_profFiltQ','res_prof')" style="margin-bottom:6px">
        <select class="fi-w" id="res_prof"></select>
      </div>
      <div class="full"><label class="fl">Observaciones</label><textarea class="fi-w" id="res_obs" placeholder="Para qué se necesita, etc."></textarea></div>
    </div>

    <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px">
      <label class="fl">Añadir material *</label>
      <div style="display:flex;gap:8px;margin-bottom:6px">
        <select class="fi-w" id="res_itemFiltAula" onchange="filterReservaItems()" style="flex:1;min-width:0"></select>
        <div class="sbox" style="flex:2;min-width:0"><span class="si">🔍</span><input type="text" id="res_itemFiltQ" placeholder="Buscar..." oninput="filterReservaItems()" autocomplete="off"></div>
      </div>
      <div style="display:flex;gap:8px">
        <select class="fi-w" id="res_itemSelect" style="flex:1"></select>
        <button class="btn btn-p" onclick="anadirLineaReserva()">➕ Añadir</button>
      </div>
    </div>

    <div id="resLineasWrap" style="display:none;margin-top:12px">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="font-size:11px;color:var(--muted);text-align:left">
          <th style="padding:4px">Ítem</th><th style="padding:4px">Cantidad</th><th></th>
        </tr></thead>
        <tbody id="resLineasBody"></tbody>
      </table>
    </div>

    <div class="mf">
      <div></div>
      <div class="mf-right">
        <button class="btn" onclick="closeReservaPractica()">Cancelar</button>
        <button class="btn btn-loan" id="btnReservaGuardar" disabled onclick="guardarReservaPractica()">📅 Guardar reserva</button>
      </div>
    </div>
  </div>
</div>

<!-- MODAL PICKER TIPO DE PRÉSTAMO -->
```

- [ ] **Step 8: Commit**

```bash
git add index.html js/reservas-practica.js js/prestamos.js
git commit -m "feat: modal de planificacion de practicas (reservas de material)"
```

---

### Task 8: Frontend — vista de reservas pendientes + confirmar/cancelar

**Files:**
- Modify: `index.html` — toggle "📅 Ver reservas" + contenedor `#presReservasContent` en la página de Préstamos.
- Modify: `js/prestamos.js` — `goPrestamos()` resetea el toggle al cambiar de tab.
- Modify: `js/reservas-practica.js` — funciones de listado, confirmar recogida y cancelar.

**Interfaces:**
- Consumes: `reservas` (global, Task 6), acciones `reservaConfirmar`/`reservaCancelar` (Task 4), `confirmDialog()`, `apiPost()`, `AULAS`, `escHtml()` (existentes).
- Produces: `togglePresReservas()`, `renderReservasPendientes()`, `confirmarRecogidaReserva(id)`, `cancelarReserva(id)` — funciones globales invocadas desde `index.html`.

- [ ] **Step 1: Añadir estado del toggle en `js/state.js`**

Encuentra:

```js
let currentPresOnlyVencidos = false;
```

Reemplaza por:

```js
let currentPresOnlyVencidos = false;
let currentPresShowReservas = false;
```

- [ ] **Step 2: Añadir el toggle y el contenedor en `index.html`**

Encuentra:

```html
      <label class="pres-venc-toggle" id="presVencToggleWrap">
        <input type="checkbox" id="presVencToggle" onchange="togglePresVencidos()">
        🔴 Solo vencidos
      </label>
    </div>
```

Reemplaza por:

```html
      <label class="pres-venc-toggle" id="presVencToggleWrap">
        <input type="checkbox" id="presVencToggle" onchange="togglePresVencidos()">
        🔴 Solo vencidos
      </label>
      <label class="pres-venc-toggle" id="presReservasToggleWrap">
        <input type="checkbox" id="presReservasToggle" onchange="togglePresReservas()">
        📅 Ver reservas
      </label>
    </div>
```

Encuentra:

```html
    <div id="presContent"></div>
  </div>
</div>

<!-- ══ CICLO PAGE (selección de módulo) ══ -->
```

Reemplaza por:

```html
    <div id="presContent"></div>
    <div id="presReservasContent" style="display:none"></div>
  </div>
</div>

<!-- ══ CICLO PAGE (selección de módulo) ══ -->
```

- [ ] **Step 3: Resetear el toggle al cambiar de tab en `goPrestamos()` (`js/prestamos.js`)**

Encuentra:

```js
  // El toggle "solo vencidos" y el select de agrupar solo tienen sentido en la tab Activos
  const vencWrap = document.getElementById('presVencToggleWrap');
  if(vencWrap) vencWrap.style.display = currentPresTab==='activos' ? '' : 'none';
  const vencCheckbox = document.getElementById('presVencToggle');
  if(vencCheckbox) vencCheckbox.checked = currentPresOnlyVencidos;
```

Reemplaza por:

```js
  // El toggle "solo vencidos" y el select de agrupar solo tienen sentido en la tab Activos
  const vencWrap = document.getElementById('presVencToggleWrap');
  if(vencWrap) vencWrap.style.display = currentPresTab==='activos' ? '' : 'none';
  const vencCheckbox = document.getElementById('presVencToggle');
  if(vencCheckbox) vencCheckbox.checked = currentPresOnlyVencidos;

  // El toggle "ver reservas" también solo tiene sentido en Activos — se resetea al cambiar de tab
  const reservasWrap = document.getElementById('presReservasToggleWrap');
  if(reservasWrap) reservasWrap.style.display = currentPresTab==='activos' ? '' : 'none';
  currentPresShowReservas = false;
  const reservasCheckbox = document.getElementById('presReservasToggle');
  if(reservasCheckbox) reservasCheckbox.checked = false;
  const presContentEl = document.getElementById('presContent');
  const presReservasContentEl = document.getElementById('presReservasContent');
  if(presContentEl) presContentEl.style.display = '';
  if(presReservasContentEl) presReservasContentEl.style.display = 'none';
```

- [ ] **Step 4: Syntax check de `js/prestamos.js`**

Run: `node --check js/prestamos.js`
Expected: no output

- [ ] **Step 5: Añadir las funciones de listado/acción en `js/reservas-practica.js`**

Añadir al final del archivo:

```js

// ─── VISTA DE RESERVAS PENDIENTES ────────────────────────

function togglePresReservas(){
  currentPresShowReservas = document.getElementById('presReservasToggle').checked;
  document.getElementById('presContent').style.display = currentPresShowReservas ? 'none' : '';
  document.getElementById('presReservasContent').style.display = currentPresShowReservas ? '' : 'none';
  if(currentPresShowReservas) renderReservasPendientes();
}

function getReservasPendientes(){
  return (typeof reservas !== 'undefined' ? reservas : []).filter(r => r.estado === 'pendiente');
}

function _reservaCardHtml(r){
  const aulaNombre = AULAS.find(a=>a.id===r.aulaDestino)?.name || r.aulaDestino || '—';
  const lineasHtml = (r.lineas||[]).map(l => `<div style="font-size:12px;padding:2px 0">${escHtml(l.itemNombre)} · ${l.cantidad} ud.</div>`).join('');
  return `<div class="pres-card">
    <div class="pres-info">
      <div class="pres-name">${escHtml(r.moduloNombre || 'Sin asignatura')}</div>
      <div class="pres-prof">${escHtml(r.profesorNombre)}</div>
      <div class="pres-meta">
        <span>📅 ${escHtml(r.fecha)} · ${escHtml(r.franja)}</span>
        <span>🏫 ${escHtml(aulaNombre)}</span>
      </div>
      <div style="margin-top:6px">${lineasHtml}</div>
      ${r.obs?`<div style="font-size:11px;color:var(--muted);margin-top:4px">💬 ${escHtml(r.obs)}</div>`:''}
    </div>
    <div class="pres-actions" style="flex-direction:column;gap:6px">
      <button class="btn btn-sm btn-return" onclick="confirmarRecogidaReserva(${r.id})">✅ Confirmar recogida</button>
      <button class="btn btn-sm btn-d" onclick="cancelarReserva(${r.id})">✕ Cancelar</button>
    </div>
  </div>`;
}

function renderReservasPendientes(){
  const pendientes = getReservasPendientes().sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
  const el = document.getElementById('presReservasContent');
  if(!pendientes.length){
    el.innerHTML = `<div class="empty"><div class="ei">📅</div><div class="et">No hay prácticas planificadas</div></div>`;
    return;
  }
  el.innerHTML = pendientes.map(_reservaCardHtml).join('');
}

async function confirmarRecogidaReserva(reservaId){
  if(!await confirmDialog({message:'¿Confirmar la recogida? Se descontará el stock de todos los ítems de la reserva.', confirmText:'Confirmar'})) return;
  try {
    const res = await apiPost({action:'reservaConfirmar', reservaId});
    if(!res.ok) throw new Error(res.error);
    for(const p of (res.prestamos||[])){
      prestamos.push(p);
      const idx = items.findIndex(x=>Number(x.id)===Number(p.itemId));
      if(idx>=0) items[idx].qty = Number(items[idx].qty) - Number(p.cantidad);
    }
    const rIdx = reservas.findIndex(r=>Number(r.id)===Number(reservaId));
    if(rIdx>=0) reservas[rIdx].estado = 'recogida';
    if(res.fallos && res.fallos.length){
      toast(`Recogida parcial: ${res.fallos.length} línea(s) sin stock suficiente (${res.fallos.map(f=>f.itemNombre).join(', ')})`,'warn');
    } else {
      toast('Recogida confirmada','ok');
    }
    renderReservasPendientes();
    goPrestamos();
  } catch(err){ toast('Error: '+err.message,'err'); }
}

async function cancelarReserva(reservaId){
  if(!await confirmDialog({message:'¿Cancelar esta reserva? Se liberará el material para otras reservas.', danger:true, confirmText:'Cancelar reserva'})) return;
  try {
    const res = await apiPost({action:'reservaCancelar', reservaId});
    if(!res.ok) throw new Error(res.error);
    const rIdx = reservas.findIndex(r=>Number(r.id)===Number(reservaId));
    if(rIdx>=0) reservas[rIdx].estado = 'cancelada';
    toast('Reserva cancelada','ok');
    renderReservasPendientes();
  } catch(err){ toast('Error: '+err.message,'err'); }
}
```

- [ ] **Step 6: Syntax check**

Run: `node --check js/reservas-practica.js`
Expected: no output

- [ ] **Step 7: Commit**

```bash
git add index.html js/state.js js/prestamos.js js/reservas-practica.js
git commit -m "feat: vista de reservas pendientes con confirmar recogida y cancelar"
```

---

### Task 9: Bump de versión y verificación end-to-end en producción

**Files:**
- Modify: `sw.js` (`VERSION`)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new — deployment/cache-busting step only

- [ ] **Step 1: Bump VERSION en sw.js**

Leer `sw.js`, confirmar el valor actual de `VERSION` (puede haber avanzado desde `v587` desde que se escribió este plan) e incrementarlo en 1, manteniendo el formato exacto (`'vNNN'`).

- [ ] **Step 2: Commit**

```bash
git add sw.js
git commit -m "chore: bump version tras planificacion de practicas"
```

- [ ] **Step 3: Push y esperar el deploy de Cloudflare Pages**

```bash
git push origin main
```

Esperar a que termine el deploy automático antes de verificar (comprobar el `VERSION` desplegado de `sw.js` directamente — recordar que la red corporativa de este proyecto necesita `NODE_TLS_REJECT_UNAUTHORIZED=0` / `curl -k` para HTTPS saliente, según `CLAUDE.md`).

- [ ] **Step 4: Verificación end-to-end en producción con Playwright**

Usando la skill de Playwright (si está disponible en esta sesión/PC — ver nota en `CLAUDE.md` sobre disponibilidad variable entre perfiles), iniciar sesión en `boscoinventario.pages.dev` con una cuenta de prueba (ej. `Seba`/`Seba`) y verificar:

1. **Crear una reserva de kit:** ir a Préstamos → "📅 Planificar práctica", rellenar fecha/franja/profesor/aula, añadir 2-3 ítems distintos con cantidad, guardar. Confirmar toast de éxito y que aparece en "📅 Ver reservas".
2. **Bloqueo de conflicto (coincidencia exacta):** crear una segunda reserva para el mismo ítem, misma fecha, misma franja EXACTA, con cantidad que supere lo libre restante. Confirmar que el backend rechaza con un mensaje claro de cuánto queda disponible, y que no se creó ninguna fila (recargar y comprobar que "Ver reservas" no tiene una entrada duplicada).
3. **Sin bloqueo con franja distinta (limitación conocida, no un bug):** misma fecha, franja con texto distinto para el mismo ítem/cantidad total — confirmar que SÍ se permite crear (documenta el comportamiento esperado, no una regresión).
4. **Confirmar recogida:** sobre la primera reserva, pulsar "✅ Confirmar recogida". Confirmar que aparecen N nuevas filas en la tab "Activos" de Préstamos con el stock ya descontado, y que la reserva desaparece de "Ver reservas" (pasa a `recogida`).
5. **Cancelar:** crear una tercera reserva y cancelarla. Confirmar que desaparece de "Ver reservas" y que una reserva nueva para el mismo ítem/fecha/franja ya NO choca (el hueco quedó libre).
6. **Regresión — préstamo individual y "Prestar caja completa" sin pasar por una reserva:** confirmar que ambos siguen funcionando exactamente igual que antes de este plan (verifica que el refactor de Task 2 no rompió nada).
7. **Verificar en D1:** `npx wrangler d1 execute boscoinventario --remote --command="SELECT id, estado, fecha, franja FROM reservas_practica ORDER BY id DESC LIMIT 5"` y `npx wrangler d1 execute boscoinventario --remote --command="SELECT * FROM reserva_items ORDER BY id DESC LIMIT 10"` para confirmar los datos reales.

Reportar el comportamiento observado en cada caso — no asumir éxito sin observar la respuesta/estado del DOM en el navegador (per `superpowers:verification-before-completion`).

- [ ] **Step 5: Corregir cualquier problema encontrado**

Si algún caso falla, usar `superpowers:systematic-debugging` para diagnosticar antes de parchear.

- [ ] **Step 6: Actualizar CLAUDE.md con el resumen de sesión**

Añadir una entrada nueva en la sección "Historial de sesiones" describiendo lo construido (feature nueva "Planificación de prácticas", migración `0027`, versión final desplegada), siguiendo el mismo formato que las entradas anteriores — incluir el origen (investigación de apps comerciales de esta sesión) y los límites explícitos aceptados (franja de texto libre, sin edición, sin aprobación).

## Self-Review Notes

- **Spec coverage:** todas las secciones del spec están cubiertas — modelo de datos (Task 1), reutilización de `crearPrestamoDesdeLinea` en vez de una tercera copia (Task 2, explícitamente exigido en Global Constraints), `reservaCrear` con bloqueo duro de coincidencia exacta (Task 3), `reservaConfirmar`/`reservaCancelar` (Task 4), scoping por departamento en la carga general (Task 5), registro de permisos (Task 6, lección ya repetida en este proyecto), UI de creación (Task 7) y de gestión de pendientes (Task 8), verificación end-to-end (Task 9). Los no-objetivos explícitos del spec (sin edición, sin aprobación, sin notificación por email, sin comprobar contra préstamos activos) se respetan por omisión — ninguna tarea los implementa.
- **No placeholders:** todos los bloques de código están completos y son copiables directamente. Los pasos que leen código en vivo primero (Task 2 Step 1, Task 5 Step 1) son comprobaciones legítimas de "confirmar contra el estado actual", no decisiones de diseño diferidas — mismo patrón que usa el resto de planes de este proyecto por el riesgo de ediciones concurrentes en archivos compartidos.
- **Consistencia de tipos/nombres:** `crearPrestamoDesdeLinea(db, datos)` se define una vez (Task 2) y se consume con la misma forma de objeto en `prestar` (Task 2), `prestarCaja` (Task 2) y `reservaConfirmar` (Task 4). El campo `reservas` de la respuesta de `list.js` (Task 5) se lee de forma idéntica en `js/auth.js` (Task 6) y se usa con el mismo nombre de variable global `reservas` en `js/reservas-practica.js` (Tasks 7 y 8). `_reservaProfOptions` se declara en Task 7 Step 3 y se referencia por nombre de string en `filterProfSelect` (Task 7 Step 1) y en el atributo `oninput` del HTML (Task 7 Step 7) — coincide en los tres sitios.
- **Compatibilidad hacia atrás verificada explícitamente:** Task 2 incluye un design note explicando por qué el refactor de `prestar`/`prestarCaja` no cambia su comportamiento observable (solo el orden interno de dos statements independientes). Task 7 Step 1 modifica una función ya compartida por 2 llamantes existentes (`_presProfOptions`/`_cajaProfOptions`) sin cambiar su comportamiento para ninguno de los dos, solo añade una tercera entrada al mapa.
