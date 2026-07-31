# Mejoras en Devolver material y recordatorio de vencidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4 mejoras en el flujo de devolución de préstamos: aviso de vencido
en el modal, quitar el `loadData()` innecesario tras devolver, aviso de
devolución parcial, y recordatorio proactivo (por email) de préstamos
vencidos al jefe/a de departamento.

**Architecture:** Cambios en `js/prestamos.js` + `index.html` (frontend) y
`functions/api/prestar.js` (backend Cloudflare Workers/D1) más una
migración D1 aislada. El recordatorio de vencidos se dispara al visitar la
página de Préstamos (no hay cron/scheduled worker en este proyecto), es
idempotente por columna `notificado_vencido`.

**Tech Stack:** Vanilla JS (sin build step), Cloudflare D1 (SQLite),
Cloudflare Pages Functions, Gmail API (envío ya existente vía
`sendGmail`/`getGmailAccessToken` en `functions/api/prestar.js`).

## Global Constraints

- No usar `request.user`/`request.departamento` en backend — leer siempre
  de `data.user`/`data.departamento`.
- Cambiar `VERSION` en `sw.js` al final (bump de versión).
- Backup D1 (`npx wrangler d1 export boscoinventario --remote --output
  backup_FECHA.sql`) antes de aplicar cualquier migración en remoto.
- Reusar patrones ya existentes en vez de crear nuevos: `isVencido()`
  (`js/prestamos.js:8`) para detectar vencidos, `sendGmail`/
  `getGmailAccessToken` (`functions/api/prestar.js:28-66`) para email,
  el patrón de aviso `ag-loan-stock-warn` (`js/agente-widget.js:1830,1871-1878`)
  para el aviso de devolución parcial.
- Proyecto sin tests automatizados — cada tarea termina con verificación
  manual (lectura cuidadosa de código + revisión de lógica), no ejecución
  de suite.

---

### Task 1: Aviso de vencido en el modal Devolver

**Files:**
- Modify: `js/prestamos.js` (función `openDevolver`, línea ~566)

**Interfaces:**
- Consumes: `isVencido(pres)` (ya existente, `js/prestamos.js:8`, recibe
  un objeto préstamo y devuelve boolean).
- Produces: ninguna función nueva — solo cambia el HTML generado dentro
  de `openDevolver`.

- [ ] **Step 1: Añadir el aviso condicional**

Localizar en `js/prestamos.js`:

```javascript
function openDevolver(presId){
  if(!requirePerm('loans.write')) return;
  const p = prestamos.find(x=>Number(x.id)===Number(presId));
  if(!p) return;
  devolverPresId = presId;
  const btn = document.getElementById('btnDevolverSave');
  btn.disabled = false; btn.textContent = '📥 Confirmar devolución';
  const pendiente = Number(p.cantidad) - Number(p.cantidadDevuelta||0);

  document.getElementById('devolverInfo').innerHTML = `
    <div style="font-weight:700;font-size:14px;margin-bottom:4px">${p.itemNombre}</div>
    <div style="font-size:12px;color:var(--muted)">
      Profesor: <strong>${p.profesorNombre}</strong><br>
      Pendiente de devolver: <strong style="color:var(--green)">${pendiente} unidad${pendiente!==1?'es':''}</strong>${Number(p.cantidadDevuelta)>0?` (de ${p.cantidad} prestadas)`:''}
    </div>`;
```

Reemplazar por:

```javascript
function openDevolver(presId){
  if(!requirePerm('loans.write')) return;
  const p = prestamos.find(x=>Number(x.id)===Number(presId));
  if(!p) return;
  devolverPresId = presId;
  const btn = document.getElementById('btnDevolverSave');
  btn.disabled = false; btn.textContent = '📥 Confirmar devolución';
  const pendiente = Number(p.cantidad) - Number(p.cantidadDevuelta||0);
  const vencidoHtml = isVencido(p)
    ? `<div style="color:var(--red);font-weight:600;margin-top:6px">⚠ Vencido desde el ${formatFechaEs(p.fechaPrevista)}</div>`
    : '';

  document.getElementById('devolverInfo').innerHTML = `
    <div style="font-weight:700;font-size:14px;margin-bottom:4px">${p.itemNombre}</div>
    <div style="font-size:12px;color:var(--muted)">
      Profesor: <strong>${p.profesorNombre}</strong><br>
      Pendiente de devolver: <strong style="color:var(--green)">${pendiente} unidad${pendiente!==1?'es':''}</strong>${Number(p.cantidadDevuelta)>0?` (de ${p.cantidad} prestadas)`:''}
    </div>
    ${vencidoHtml}`;
```

- [ ] **Step 2: Confirmar o crear `formatFechaEs`**

Busca con Grep si ya existe una función `formatFechaEs` (o similar,
formato DD/MM/YYYY) en `js/*.js`. Si existe, úsala tal cual — no la
dupliques. Si NO existe ninguna función de formato de fecha reutilizable
en el proyecto, añade esta función pequeña justo antes de `openDevolver`
en `js/prestamos.js`:

```javascript
function formatFechaEs(iso){
  if(!iso) return '';
  const [y,m,d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
}
```

(`p.fechaPrevista` se guarda como `YYYY-MM-DD`, ver el input
`type="date"` en `index.html` que lo rellena — confirma este formato
leyendo cómo se guarda en `confirmPrestar`/`confirmPrestarCaja` antes de
asumir, por si acaso difiere.)

- [ ] **Step 3: Verificación manual**

Sin tests automatizados — relee la función final y confirma: que
`isVencido(p)` se evalúa correctamente (usa `p.fechaPrevista` y
`p.estado`, ambos presentes en el objeto `p` de `openDevolver`), que el
HTML no rompe la estructura del `innerHTML` existente (comillas
balanceadas, template literal cerrado correctamente), y que un préstamo
NO vencido no muestra el aviso (`vencidoHtml` queda `''`).

- [ ] **Step 4: Commit**

```bash
git add js/prestamos.js
git commit -m "feat: aviso de vencido en el modal Devolver material"
```

---

### Task 2: Backend — `devolver` devuelve el préstamo actualizado

**Files:**
- Modify: `functions/api/prestar.js` (bloque `action === 'devolver'`,
  línea ~188-203)

**Interfaces:**
- Consumes: nada nuevo — misma tabla `prestamos`/`inventario` ya usadas.
- Produces: la respuesta JSON de la acción `devolver` gana los campos
  `prestamo` (objeto con los mismos campos que una fila de `prestamos`,
  ya actualizados) y `nuevoQty` (number) — consumidos por Task 3.

- [ ] **Step 1: Modificar el bloque `devolver`**

Localizar en `functions/api/prestar.js`:

```javascript
  if (action === 'devolver') {
    const { presId, cantidadDevuelta, obs } = body;
    const pres = await env.DB.prepare('SELECT * FROM prestamos WHERE id=?').bind(presId).first();
    if (!pres) return Response.json({ ok: false, error: 'Préstamo no encontrado' });
    if (!superadmin && !ownsItemDept(await itemDept(env.DB, pres.itemId), dept, genericDept)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const fecha = new Date().toISOString().split('T')[0];
    const estado = cantidadDevuelta >= pres.cantidad ? 'Devuelto' : 'Parcial';
    await env.DB.prepare('UPDATE prestamos SET fechaDevolucion=?, cantidadDevuelta=?, estado=?, obs=? WHERE id=?')
      .bind(fecha, cantidadDevuelta, estado, obs || '', presId).run();
    // Reponer stock
    await env.DB.prepare('UPDATE inventario SET qty = qty + ? WHERE id=?').bind(cantidadDevuelta, pres.itemId).run();
    await auditLog(env.DB, user, 'devolver', pres.itemId, `Devolución préstamo ${presId}: ${cantidadDevuelta}ud`);
    return Response.json({ ok: true });
  }
```

Reemplazar por:

```javascript
  if (action === 'devolver') {
    const { presId, cantidadDevuelta, obs } = body;
    const pres = await env.DB.prepare('SELECT * FROM prestamos WHERE id=?').bind(presId).first();
    if (!pres) return Response.json({ ok: false, error: 'Préstamo no encontrado' });
    if (!superadmin && !ownsItemDept(await itemDept(env.DB, pres.itemId), dept, genericDept)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const fecha = new Date().toISOString().split('T')[0];
    const estado = cantidadDevuelta >= pres.cantidad ? 'Devuelto' : 'Parcial';
    await env.DB.prepare('UPDATE prestamos SET fechaDevolucion=?, cantidadDevuelta=?, estado=?, obs=? WHERE id=?')
      .bind(fecha, cantidadDevuelta, estado, obs || '', presId).run();
    // Reponer stock
    await env.DB.prepare('UPDATE inventario SET qty = qty + ? WHERE id=?').bind(cantidadDevuelta, pres.itemId).run();
    const itemRow = await env.DB.prepare('SELECT qty FROM inventario WHERE id=?').bind(pres.itemId).first();
    await auditLog(env.DB, user, 'devolver', pres.itemId, `Devolución préstamo ${presId}: ${cantidadDevuelta}ud`);
    return Response.json({
      ok: true,
      prestamo: { ...pres, fechaDevolucion: fecha, cantidadDevuelta, estado, obs: obs || '' },
      nuevoQty: itemRow?.qty ?? null,
    });
  }
```

- [ ] **Step 2: Verificación manual**

Relee el bloque: confirma que `itemRow` se lee DESPUÉS del `UPDATE
inventario` (para reflejar el valor ya sumado, no el anterior), que el
spread `{ ...pres, ... }` sobrescribe correctamente los 4 campos que
cambian sin duplicar claves, y que la respuesta sigue siendo
`Response.json` válido (sin romper la sintaxis del objeto).

- [ ] **Step 3: Commit**

```bash
git add functions/api/prestar.js
git commit -m "feat: acción devolver devuelve el préstamo actualizado y nuevo stock"
```

---

### Task 3: Frontend — `confirmDevolver` sin `loadData()`

**Files:**
- Modify: `js/prestamos.js` (función `confirmDevolver`, línea ~591-605)

**Interfaces:**
- Consumes: la respuesta de `apiPost({action:'devolver',...})` ahora
  incluye `res.prestamo` y `res.nuevoQty` (Task 2, ya aplicada — si esta
  tarea se ejecuta después, confirma que el backend ya está desplegado o
  al menos que el código de Task 2 ya está en este mismo working tree
  antes de continuar).
- Produces: ninguna función nueva.

- [ ] **Step 1: Reemplazar el cuerpo de `confirmDevolver`**

Localizar en `js/prestamos.js`:

```javascript
async function confirmDevolver(){
  const cant = parseInt(document.getElementById('dev_cant').value)||0;
  if(cant<=0){ toast('Cantidad inválida','err'); return; }

  const btn = document.getElementById('btnDevolverSave');
  btn.disabled = true; btn.textContent = '⏳ Devolviendo...';
  try {
    const res = await apiPost({action:'devolver', presId:devolverPresId, cantidadDevuelta:cant});
    if(!res.ok) throw new Error(res.error);
    closeDevolver();
    toast('Devolución registrada','ok');
    await loadData(); // recargar todo
    goPrestamos();
  } catch(err){ toast('Error: '+err.message,'err'); btn.disabled=false; btn.textContent='📥 Confirmar devolución'; }
}
```

Reemplazar por:

```javascript
async function confirmDevolver(){
  const cant = parseInt(document.getElementById('dev_cant').value)||0;
  if(cant<=0){ toast('Cantidad inválida','err'); return; }

  const btn = document.getElementById('btnDevolverSave');
  btn.disabled = true; btn.textContent = '⏳ Devolviendo...';
  try {
    const res = await apiPost({action:'devolver', presId:devolverPresId, cantidadDevuelta:cant});
    if(!res.ok) throw new Error(res.error);
    const idx = prestamos.findIndex(x=>Number(x.id)===Number(devolverPresId));
    if(idx>=0) prestamos[idx] = res.prestamo;
    if(res.nuevoQty !== null && res.nuevoQty !== undefined){
      const itemIdx = items.findIndex(x=>Number(x.id)===Number(res.prestamo.itemId));
      if(itemIdx>=0) items[itemIdx].qty = res.nuevoQty;
    }
    closeDevolver();
    toast('Devolución registrada','ok');
    goPrestamos();
  } catch(err){ toast('Error: '+err.message,'err'); btn.disabled=false; btn.textContent='📥 Confirmar devolución'; }
}
```

- [ ] **Step 2: Verificación manual**

Relee y confirma: que `prestamos[idx] = res.prestamo` reemplaza el objeto
completo (el backend devuelve todos los campos de la fila, no un parche
parcial, así que reemplazar entero es seguro), que `items[itemIdx].qty`
solo se actualiza si `res.nuevoQty` viene definido (defensivo, por si
`itemRow` de Task 2 fuera `null` porque el ítem se borró entretanto), y
que `goPrestamos()` sigue re-renderizando la vista con los arrays locales
ya actualizados (mismo patrón que usan `confirmPrestar`/
`confirmPrestarCaja`, que llaman a `renderHome()`/`openSub()` tras
mutar arrays locales sin recargar).

- [ ] **Step 3: Commit**

```bash
git add js/prestamos.js
git commit -m "perf: quitar loadData() innecesario tras devolver material"
```

---

### Task 4: Aviso de devolución parcial

**Files:**
- Modify: `index.html` (bloque `id="mDevolver"`)
- Modify: `js/prestamos.js` (`openDevolver`, nueva función
  `checkDevolucionParcialWarn`)

**Interfaces:**
- Consumes: `cantInput.max` (ya seteado en `openDevolver` al valor de
  `pendiente`).
- Produces: `checkDevolucionParcialWarn()` — nueva función global.

- [ ] **Step 1: Añadir el contenedor del aviso en `index.html`**

Localizar:

```html
    <div class="fg">
      <div class="full"><label class="fl">Cantidad a devolver *</label><input class="fi-w" id="dev_cant" type="number" min="1" value="1"></div>
      <div class="full"><label class="fl">Observaciones (opcional)</label><textarea class="fi-w" id="dev_obs" placeholder="Estado en que se devuelve..."></textarea></div>
    </div>
```

Reemplazar por:

```html
    <div class="fg">
      <div class="full">
        <label class="fl">Cantidad a devolver *</label>
        <input class="fi-w" id="dev_cant" type="number" min="1" value="1" oninput="checkDevolucionParcialWarn()">
        <div id="dev_parcial_warn" style="display:none;margin-top:6px;padding:6px 10px;border-radius:8px;background:#78350f;color:#fcd34d;font-size:12px"></div>
      </div>
      <div class="full"><label class="fl">Observaciones (opcional)</label><textarea class="fi-w" id="dev_obs" placeholder="Estado en que se devuelve..."></textarea></div>
    </div>
```

(Colores `#78350f`/`#fcd34d` tomados del mismo patrón que
`ag-loan-stock-warn` en `js/agente-widget.js:1830` — fondo ámbar oscuro,
texto ámbar claro, consistente con el resto de avisos del proyecto.)

- [ ] **Step 2: Escribir `checkDevolucionParcialWarn` en `js/prestamos.js`**

Añadir justo después de `closeDevolver()`:

```javascript
function checkDevolucionParcialWarn(){
  const warn = document.getElementById('dev_parcial_warn');
  const input = document.getElementById('dev_cant');
  if(!warn || !input) return;
  const cant = parseInt(input.value)||0;
  const max = parseInt(input.max)||0;
  const restante = max - cant;
  if(cant > 0 && restante > 0){
    warn.style.display = 'block';
    warn.textContent = `⚠ Quedarán ${restante} unidad${restante!==1?'es':''} sin devolver`;
  } else {
    warn.style.display = 'none';
  }
}
```

- [ ] **Step 3: Llamar a `checkDevolucionParcialWarn()` al abrir el modal**

En `openDevolver` (ya modificada por Task 1), al final de la función,
justo antes de `document.getElementById('mDevolver').classList.add('open');`,
añadir una línea `checkDevolucionParcialWarn();` — para que el aviso
también se calcule correctamente si `cantInput.value` no coincide con
`cantInput.max` nada más abrir (no debería ocurrir hoy porque siempre se
preselecciona el máximo, pero deja el estado consistente si eso cambia).

- [ ] **Step 4: Verificación manual**

Relee y confirma: que el aviso NO aparece cuando `cant === max`
(devolución total, caso por defecto), que aparece cuando `cant < max`, y
que se oculta de nuevo si el usuario vuelve a poner el máximo. Confirma
que `input.max` sigue siendo un string numérico válido para
`parseInt()` (ya lo era antes de este cambio, `cantInput.max = pendiente`
en `openDevolver`).

- [ ] **Step 5: Commit**

```bash
git add index.html js/prestamos.js
git commit -m "feat: aviso de devolución parcial en el modal Devolver material"
```

---

### Task 5: Migración — columna `notificado_vencido`

**Files:**
- Create: `migrations/0022_notificado_vencido.sql`

**Interfaces:**
- Produces: columna `prestamos.notificado_vencido INTEGER DEFAULT 0`,
  consumida por Task 6.

- [ ] **Step 1: Escribir la migración**

```sql
-- Marca si un préstamo vencido ya generó el email de recordatorio al
-- jefe/a de departamento (functions/api/prestar.js, acción
-- notificarVencidos) — evita reenviar el mismo aviso en cada visita a
-- la página de Préstamos.
ALTER TABLE prestamos ADD COLUMN notificado_vencido INTEGER DEFAULT 0;
```

- [ ] **Step 2: Backup remoto antes de aplicar**

```bash
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"
npx wrangler d1 export boscoinventario --remote --output backup_pre_0022.sql
```

Guardar fuera del repo (scratchpad de la sesión), no versionar.

- [ ] **Step 3: Aplicar en remoto**

```bash
npx wrangler d1 execute boscoinventario --remote --file=migrations/0022_notificado_vencido.sql
```

- [ ] **Step 4: Verificar**

```bash
npx wrangler d1 execute boscoinventario --remote --command "SELECT notificado_vencido FROM prestamos LIMIT 1"
```

Debe ejecutar sin error `no such column`.

- [ ] **Step 5: Commit**

```bash
git add migrations/0022_notificado_vencido.sql
git commit -m "feat: columna notificado_vencido en prestamos"
```

---

### Task 6: Backend — endpoint `notificarVencidos`

**Files:**
- Modify: `functions/api/prestar.js`

**Interfaces:**
- Consumes: `sendGmail(env, to, subject, htmlBody)` (ya existente, línea
  44), `escHtml(v)` (ya existente, línea 3), `data.departamento`
  (middleware, scoping estándar del proyecto), columna
  `notificado_vencido` (Task 5).
- Produces: acción `notificarVencidos` en el mismo router de acciones que
  `prestar`/`prestarCaja`/`devolver` — responde
  `{ok:true, enviados:number}`.

- [ ] **Step 1: Añadir el bloque de la acción**

Localiza el `return Response.json({ ok: false, error: 'Acción
desconocida' });` final del archivo (línea ~205) y añade el nuevo bloque
justo antes:

```javascript
  if (action === 'notificarVencidos') {
    const hoy = new Date().toISOString().split('T')[0];
    const vencidos = await env.DB.prepare(`
      SELECT p.* FROM prestamos p
      JOIN inventario i ON i.id = p.itemId
      WHERE p.estado IN ('Activo','Parcial')
        AND p.fechaPrevista != ''
        AND p.fechaPrevista < ?
        AND p.notificado_vencido = 0
        AND i.departamento = ?
    `).bind(hoy, dept).all();

    if (!vencidos.results || !vencidos.results.length) {
      return Response.json({ ok: true, enviados: 0 });
    }

    const ids = vencidos.results.map(p => p.id);
    const jefeRow = await env.DB.prepare(
      "SELECT email FROM usuarios WHERE departamento=? AND rol='jefe/a departamento' AND email!='' LIMIT 1"
    ).bind(dept).first();

    if (jefeRow?.email) {
      const rowsHtml = '<table style="border-collapse:collapse;width:100%">' +
        '<tr><th style="text-align:left;padding:6px;border-bottom:1px solid #e5e7eb">Ítem</th><th style="text-align:left;padding:6px;border-bottom:1px solid #e5e7eb">Profesor/a</th><th style="text-align:left;padding:6px;border-bottom:1px solid #e5e7eb">Prevista</th></tr>' +
        vencidos.results.map(p => `<tr><td style="padding:6px">${escHtml(p.itemNombre)}</td><td style="padding:6px">${escHtml(p.profesorNombre)}</td><td style="padding:6px">${escHtml(p.fechaPrevista)}</td></tr>`).join('') +
        '</table>';
      const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2>Préstamos vencidos</h2>
        <p>Hay ${vencidos.results.length} préstamo(s) de tu departamento con la devolución vencida:</p>
        ${rowsHtml}
        <p style="font-size:12px;color:#6b7280">Inventario Taller FP</p>
      </div>`;
      await sendGmail(env, jefeRow.email, `${vencidos.results.length} préstamo(s) vencido(s)`, html);
    }

    const placeholders = ids.map(() => '?').join(',');
    await env.DB.prepare(`UPDATE prestamos SET notificado_vencido=1 WHERE id IN (${placeholders})`)
      .bind(...ids).run();

    return Response.json({ ok: true, enviados: jefeRow?.email ? vencidos.results.length : 0 });
  }
```

- [ ] **Step 2: Verificación manual**

Relee y confirma: que la query de `vencidos` filtra correctamente por
`dept` (variable ya disponible en el resto del archivo, viene del
middleware — confirma su nombre exacto leyendo cómo se usa en el bloque
`devolver` de al lado, línea ~192, `ownsItemDept(..., dept, ...)`), que
el `UPDATE ... WHERE id IN (...)` se ejecuta SIEMPRE que haya vencidos
(con o sin email de jefe encontrado, para no reintentar indefinidamente
contra un departamento sin jefe/a con email), y que `sendGmail` ya
traga sus propios errores internamente (revisa su implementación, línea
44-66 — no lanza excepción si Gmail falla, así que no hace falta
try/catch adicional aquí).

- [ ] **Step 3: Commit**

```bash
git add functions/api/prestar.js
git commit -m "feat: endpoint notificarVencidos, email al jefe/a de departamento"
```

---

### Task 7: Frontend — disparar la notificación al visitar Préstamos

**Files:**
- Modify: `js/prestamos.js` (`goPrestamos`, línea ~44)

**Interfaces:**
- Consumes: `apiPost({action:'notificarVencidos'})` (Task 6).
- Produces: variable de módulo `_vencidosNotifCheckDone` (boolean).

- [ ] **Step 1: Añadir la variable de módulo**

Cerca del inicio de `js/prestamos.js` (junto a otras variables de módulo
como `let profEditing = [];`), añadir:

```javascript
let _vencidosNotifCheckDone = false;
```

- [ ] **Step 2: Disparar la llamada en `goPrestamos`**

Localiza en `goPrestamos` (`js/prestamos.js:44`) el bloque que calcula
`vencidos`:

```javascript
  // Stats
  const activos = getPrestamosActivos().length;
  const vencidos = getVencidos().length;
```

Justo después de esas dos líneas (antes de que sigan usándose para
`presStats`), añade:

```javascript
  if(vencidos > 0 && !_vencidosNotifCheckDone && can('loans.write')){
    _vencidosNotifCheckDone = true;
    apiPost({action:'notificarVencidos'}).catch(()=>{});
  }
```

`can(permission)` (`js/roles.js:82-88`) es la comprobación silenciosa ya
existente en el proyecto (sin toast) que usa internamente `requirePerm`
— úsala directamente en vez de `requirePerm`, que siempre muestra un
toast de error cuando el permiso falta y no es lo que se quiere aquí (un
usuario de solo consulta no debería ver ningún aviso por esta
comprobación de fondo).

- [ ] **Step 3: Verificación manual**

Relee y confirma: que la llamada es "fire and forget" (no bloquea el
render de `goPrestamos`, sin `await` en el flujo síncrono de la
función), que `_vencidosNotifCheckDone` evita llamadas repetidas al
navegar varias veces a Préstamos en la misma sesión de página (recarga
completa del navegador sí resetea la variable — comportamiento
aceptado, el backend es idempotente de todas formas), y que un fallo de
red en `apiPost` no genera ningún error visible al usuario (`.catch(()=>{})`).

- [ ] **Step 4: Commit**

```bash
git add js/prestamos.js
git commit -m "feat: disparar recordatorio de vencidos al visitar Préstamos"
```

---

### Task 8: Deploy

**Files:**
- Modify: `sw.js` (VERSION)
- Modify: `CLAUDE.md` (nota de versión + entrada en historial)

- [ ] **Step 1: Bump de versión**

Incrementar `const VERSION` en `sw.js` en 1 respecto al valor actual en
el repo en el momento de este commit.

- [ ] **Step 2: Actualizar CLAUDE.md**

Añadir entrada al historial de sesiones resumiendo las 4 mejoras: aviso
de vencido en Devolver, `loadData()` quitado de `confirmDevolver` (con
el backend ahora devolviendo el préstamo actualizado), aviso de
devolución parcial, y recordatorio por email de vencidos al jefe/a de
departamento (disparado al visitar Préstamos, no por cron — el proyecto
no tiene scheduled workers configurados). Actualizar también la tabla de
migraciones con `0022_notificado_vencido.sql` y la línea `VERSION aquí`
en la sección de arquitectura de archivos. El archivo real en disco se
llama `claude.md` en minúsculas — usar ese nombre exacto en los comandos
`git add`/`git commit`, no `CLAUDE.md`, aunque el filesystem de Windows
sea insensible a mayúsculas (git no lo es al hacer matching de paths en
algunos comandos).

- [ ] **Step 3: Commit y push**

```bash
git add sw.js claude.md
git commit -m "chore: bump versión tras mejoras de devolución y recordatorio de vencidos"
git push origin main
```

- [ ] **Step 4: Verificación post-deploy**

Esperar el deploy automático de Cloudflare Pages. Si es posible probar en
la app real: registrar un préstamo con fecha prevista en el pasado
(editando `fechaPrevista` directamente por SQL si no hay forma más
rápida desde la UI), visitar Préstamos, confirmar que llega el email al
jefe/a de departamento correspondiente, y que una segunda visita no
reenvía el email (columna `notificado_vencido` ya en `1`).
