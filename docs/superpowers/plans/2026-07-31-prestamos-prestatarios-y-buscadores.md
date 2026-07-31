# Préstamos: fuente única de prestatarios + buscadores — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el modal 👥 en "solo prestatarios externos", limpiar la
tabla `profesores` de filas que ya duplican usuarios de la app, y añadir
buscadores rápidos donde faltan: profesor/a (préstamo individual + caja) e
ítem/caja (préstamo de caja completa, hoy sin selector propio).

**Architecture:** Todo el trabajo vive en `js/prestamos.js` +
`index.html` (frontend vanilla JS, sin build step) más una migración D1
aislada. No se toca el backend (`functions/api/`) — `list.js` ya fusiona
`profesores` + `usuarios` sin duplicados (`mergeProfesores`), y ese
comportamiento no cambia.

**Tech Stack:** Vanilla JS (sin framework), Cloudflare D1 (SQLite), SQL
migrations aplicadas con `npx wrangler d1 execute boscoinventario --remote`.

## Global Constraints

- No usar `request.user`/`request.departamento` en backend — este plan no
  toca backend, pero si algún paso lo rozara: leer siempre de `data.user`.
- Cambiar `VERSION` en `sw.js` (vXXX → vXXX+1) en el commit final del
  frontend.
- Backup D1 (`npx wrangler d1 export boscoinventario --remote
  --output backup_FECHA.sql`) obligatorio antes de aplicar la migración
  DELETE en remoto — es una operación destructiva sobre datos reales.
- Reusar `normalize()` ya definida en `js/import.js:187` (sin tildes,
  minúsculas, sin espacios/guiones) para cualquier comparación de texto
  nueva — no redefinir otra función con el mismo propósito.
- Cada tarea termina con verificación manual en navegador (proyecto sin
  suite de tests automatizados) contra `boscoinventario.pages.dev` tras
  el deploy, o local si hay forma de servir el HTML estático.

---

### Task 1: Modal 👥 solo prestatarios externos

**Files:**
- Modify: `js/prestamos.js:538-568` (`openProfModal`, `renderProfList`,
  `addProfRow`)
- Modify: `index.html` (texto del botón "+ Añadir profesor/a" y título del
  modal `mProf`, buscar `id="mProf"`)

**Interfaces:**
- Consumes: `profesores` (array global ya poblado por `loadData()`, cada
  fila trae `source: 'profesores'|'usuarios'` — ver
  `functions/api/list.js:61-87`).
- Produces: `profEditing` (array global ya existente) contendrá desde
  ahora solo filas con `source !== 'usuarios'` (o `source` ausente, para
  filas nuevas añadidas a mano antes de guardar).

- [ ] **Step 1: Filtrar `openProfModal` a solo externos**

En `js/prestamos.js`, reemplazar:

```javascript
function openProfModal(){
  if(!requirePerm('profesores.manage')) return;
  profEditing = JSON.parse(JSON.stringify(
    profesores.filter(p => String(p.nombre||'').trim() && String(p.nombre||'').trim().toLowerCase() !== 'departamento')
  ));
  renderProfList();
  document.getElementById('mProf').classList.add('open');
}
```

por:

```javascript
function openProfModal(){
  if(!requirePerm('profesores.manage')) return;
  profEditing = JSON.parse(JSON.stringify(
    profesores.filter(p =>
      String(p.nombre||'').trim() &&
      String(p.nombre||'').trim().toLowerCase() !== 'departamento' &&
      p.source !== 'usuarios'
    )
  ));
  renderProfList();
  document.getElementById('mProf').classList.add('open');
}
```

- [ ] **Step 2: Simplificar `renderProfList` (ya no hay filas `readonly`)**

Reemplazar:

```javascript
function renderProfList(){
  if(!profEditing.length){
    document.getElementById('profList').innerHTML='<div class="empty" style="padding:20px"><div class="et" style="font-size:13px">Aún no hay profesores/as. Pulsa "+ Añadir profesor/a" para empezar.</div></div>';
    return;
  }
  document.getElementById('profList').innerHTML = profEditing.map((p,i)=>`
    <div class="prof-row">
      <input class="fi-w name-input" value="${escHtml(p.nombre||'')}" onchange="profEditing[${i}].nombre=this.value" placeholder="Nombre completo" ${p.source==='usuarios'?'readonly title="Usuario de la app: se gestiona desde Usuarios"':''}>
      <input class="fi-w dept-input" value="${escHtml(p.departamento||'')}" onchange="profEditing[${i}].departamento=this.value" placeholder="Departamento" ${p.source==='usuarios'?'readonly':''}>
      <button class="del-btn" onclick="removeProfRow(${i})" title="Eliminar">🗑</button>
    </div>
  `).join('');
}
```

por:

```javascript
function renderProfList(){
  if(!profEditing.length){
    document.getElementById('profList').innerHTML='<div class="empty" style="padding:20px"><div class="et" style="font-size:13px">Aún no hay prestatarios externos. Pulsa "+ Añadir prestatario externo" para empezar.</div></div>';
    return;
  }
  document.getElementById('profList').innerHTML = profEditing.map((p,i)=>`
    <div class="prof-row">
      <input class="fi-w name-input" value="${escHtml(p.nombre||'')}" onchange="profEditing[${i}].nombre=this.value" placeholder="Nombre completo">
      <input class="fi-w dept-input" value="${escHtml(p.departamento||'')}" onchange="profEditing[${i}].departamento=this.value" placeholder="Departamento (opcional)">
      <button class="del-btn" onclick="removeProfRow(${i})" title="Eliminar">🗑</button>
    </div>
  `).join('');
}
```

- [ ] **Step 3: Simplificar `removeProfRow` (ya no hay filas `usuarios` en `profEditing`)**

Localizar (línea ~611):

```javascript
function removeProfRow(idx){
  const p = profEditing[idx];
  if(p.source === 'usuarios'){
    toast('Los usuarios de la app se gestionan desde Usuarios, no desde Profesores/as','err');
    return;
  }
  const usados = prestamos.filter(pr=>String(pr.profesorId)===String(p.id) && (pr.estado==='Activo'||pr.estado==='Parcial')).length;
  if(usados > 0){
    toast(`No puedes eliminar: tiene ${usados} préstamo(s) activo(s)`,'err');
    return;
  }
  profEditing.splice(idx,1);
  renderProfList();
}
```

Reemplazar por (quita el chequeo `source==='usuarios'`, ya no puede ocurrir):

```javascript
function removeProfRow(idx){
  const p = profEditing[idx];
  const usados = prestamos.filter(pr=>String(pr.profesorId)===String(p.id) && (pr.estado==='Activo'||pr.estado==='Parcial')).length;
  if(usados > 0){
    toast(`No puedes eliminar: tiene ${usados} préstamo(s) activo(s)`,'err');
    return;
  }
  profEditing.splice(idx,1);
  renderProfList();
}
```

- [ ] **Step 4: Simplificar `saveProfesores` (ya no filtra `source!=='usuarios'`, todo `profEditing` es editable)**

Buscar en `js/prestamos.js` (línea ~626-645) el bloque:

```javascript
  // Calcular cambios respecto a profesores actuales
  const editable = validos.filter(p=>p.source !== 'usuarios');
  const toAdd = editable.filter(p=>!p.id);
  const toUpdate = validos.filter(p=>{
    if(p.source === 'usuarios') return false;
    if(!p.id) return false;
    const orig = profesores.find(x=>Number(x.id)===Number(p.id));
    if(!orig) return false;
    return orig.nombre!==p.nombre || orig.departamento!==p.departamento || orig.email!==p.email;
  });
  const idsValidos = new Set(editable.filter(p=>p.id).map(p=>String(p.id)));
  const toDelete = profesores.filter(p=>p.source !== 'usuarios' && !idsValidos.has(String(p.id)));
```

Reemplazar por:

```javascript
  // Calcular cambios respecto a profesores actuales (profEditing ya es
  // solo externos, ver openProfModal — todo aquí es editable)
  const toAdd = validos.filter(p=>!p.id);
  const toUpdate = validos.filter(p=>{
    if(!p.id) return false;
    const orig = profesores.find(x=>Number(x.id)===Number(p.id));
    if(!orig) return false;
    return orig.nombre!==p.nombre || orig.departamento!==p.departamento || orig.email!==p.email;
  });
  const idsValidos = new Set(validos.filter(p=>p.id).map(p=>String(p.id)));
  const toDelete = profesores.filter(p=>p.source !== 'usuarios' && !idsValidos.has(String(p.id)));
```

(`toDelete` conserva el filtro `p.source !== 'usuarios'` como cinturón de
seguridad — nunca debería recibir filas `usuarios` en `profesores` no
listadas en `idsValidos`, pero evita un borrado accidental si algo
cambiara arriba.)

- [ ] **Step 5: Actualizar textos del botón y título en `index.html`**

Buscar `id="mProf"` en `index.html` y el botón que llama a
`openProfModal()`. Cambiar el texto visible "+ Añadir profesor/a" →
"+ Añadir prestatario externo", y el título del modal (`<div class="mt">`
o similar dentro de `mProf`) de "👥 Profesores" → "👥 Prestatarios
externos". Usar Grep para ubicar el texto exacto antes de editar, los
literales pueden variar ligeramente del ejemplo.

- [ ] **Step 6: Verificación manual**

Con la app corriendo (local o `boscoinventario.pages.dev` tras deploy):
1. Login como jefe/a de departamento.
2. Abrir 👥 (ahora "Prestatarios externos") — la lista NO debe incluir
   ningún usuario de la app (comparar con lista de ⚙️ Usuarios).
3. Añadir un prestatario externo nuevo, guardar, comprobar que aparece en
   el selector de "Profesor/a que pide" del modal de préstamo.
4. Intentar borrar un prestatario externo con préstamo activo — debe
   seguir bloqueado con el mismo mensaje de antes.

- [ ] **Step 7: Commit**

```bash
git add js/prestamos.js index.html
git commit -m "feat: modal de profesores pasa a ser solo prestatarios externos"
```

---

### Task 2: Migración — limpiar duplicados en `profesores`

**Files:**
- Create: `migrations/0021_limpiar_profesores_duplicados.sql`

**Interfaces:**
- Consumes: tablas `profesores(id, nombre, departamento, email)` y
  `usuarios(usuario, password, nombre, rol, email, departamento, ...)`
  (schema en `migrations/0001_schema.sql` + `0007_departamentos.sql`).
- Produces: tabla `profesores` sin filas que dupliquen un `usuarios` por
  nombre o email normalizado (comparación case-insensitive, SQLite
  `LOWER()` — sin soporte nativo de plegado de tildes en SQL, se acepta
  esa limitación: incidencia rara, revisable a mano si aparece).

- [ ] **Step 1: Escribir la migración**

```sql
-- Elimina de `profesores` las filas que ya duplican un usuario de la app
-- (mismo nombre o mismo email, case-insensitive). El backend ya las
-- fusiona sin duplicados visibles (list.js:mergeProfesores), pero tras
-- convertir el modal 👥 en "solo prestatarios externos" (ver
-- js/prestamos.js:openProfModal) estas filas quedarían huérfanas de UI
-- para editarlas/borrarlas.
DELETE FROM profesores
WHERE LOWER(TRIM(nombre)) IN (SELECT LOWER(TRIM(nombre)) FROM usuarios WHERE TRIM(nombre) != '')
   OR (email != '' AND LOWER(TRIM(email)) IN (SELECT LOWER(TRIM(email)) FROM usuarios WHERE TRIM(email) != ''));
```

- [ ] **Step 2: Backup remoto antes de aplicar**

```bash
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"
npx wrangler d1 export boscoinventario --remote --output backup_pre_0021.sql
```

Guardar el archivo fuera del repo (scratchpad de la sesión), no
versionarlo — mismo criterio que backups previos de este proyecto.

- [ ] **Step 3: Contar filas afectadas antes de borrar (dry-run manual)**

```bash
npx wrangler d1 execute boscoinventario --remote --command "SELECT COUNT(*) FROM profesores WHERE LOWER(TRIM(nombre)) IN (SELECT LOWER(TRIM(nombre)) FROM usuarios WHERE TRIM(nombre) != '') OR (email != '' AND LOWER(TRIM(email)) IN (SELECT LOWER(TRIM(email)) FROM usuarios WHERE TRIM(email) != ''))"
```

Anotar el número — debe ser razonable (decenas, no miles) dado que hay 24
departamentos con pocos usuarios cada uno. Si el número parece
desproporcionado, parar y revisar antes de continuar.

- [ ] **Step 4: Aplicar la migración en remoto**

```bash
npx wrangler d1 execute boscoinventario --remote --file=migrations/0021_limpiar_profesores_duplicados.sql
```

- [ ] **Step 5: Verificar resultado**

```bash
npx wrangler d1 execute boscoinventario --remote --command "SELECT COUNT(*) FROM profesores"
```

Comparar con el conteo anterior a la migración (debe haber bajado
exactamente en el número anotado en Step 3).

- [ ] **Step 6: Commit**

```bash
git add migrations/0021_limpiar_profesores_duplicados.sql
git commit -m "feat: migración para limpiar duplicados en tabla profesores"
```

---

### Task 3: Buscador de profesor/a en ambos modales de préstamo

**Files:**
- Modify: `index.html` (bloques `id="mPrestar"` y `id="mPrestarCaja"`,
  ver líneas ~833-834 y ~861-862 antes de este plan — pueden haber
  cambiado de línea tras Task 1/2, ubicar por `id="pres_prof"` y
  `id="prestarCajaProf"`)
- Modify: `js/prestamos.js` (`openPrestar`, `openPrestarCaja`, nueva
  función `filterProfSelect`)

**Interfaces:**
- Consumes: `loanTeacherOptions()` (ya existente, `js/prestamos.js:313`,
  sin cambios de firma — devuelve array de `{id, nombre, departamento,
  ...}`), `normalize()` (`js/import.js:187`).
- Produces: `filterProfSelect(listVarName, inputId, selectId)` — nueva
  función global reutilizada por los dos modales. `_presProfOptions` y
  `_cajaProfOptions` — nuevas variables de módulo (una por modal) que
  cachean el resultado de `loanTeacherOptions()` al abrir, para no
  recalcular el merge en cada tecla.

- [ ] **Step 1: Añadir el `<input>` de búsqueda en `index.html` (modal individual)**

Ubicar (usar Grep si la línea cambió):

```html
      <div class="full"><label class="fl">Profesor/a que pide *</label>
        <select class="fi-w" id="pres_prof"></select>
      </div>
```

Reemplazar por:

```html
      <div class="full"><label class="fl">Profesor/a que pide *</label>
        <input type="text" class="fi-w" id="pres_profFiltQ" placeholder="Buscar por nombre…" autocomplete="off" oninput="filterProfSelect('_presProfOptions','pres_profFiltQ','pres_prof')" style="margin-bottom:6px">
        <select class="fi-w" id="pres_prof"></select>
      </div>
```

- [ ] **Step 2: Añadir el `<input>` de búsqueda en `index.html` (modal caja)**

Ubicar:

```html
      <div class="full"><label class="fl">Profesor/a que pide *</label>
        <select class="fi-w" id="prestarCajaProf"></select>
      </div>
```

Reemplazar por:

```html
      <div class="full"><label class="fl">Profesor/a que pide *</label>
        <input type="text" class="fi-w" id="prestarCajaProfFiltQ" placeholder="Buscar por nombre…" autocomplete="off" oninput="filterProfSelect('_cajaProfOptions','prestarCajaProfFiltQ','prestarCajaProf')" style="margin-bottom:6px">
        <select class="fi-w" id="prestarCajaProf"></select>
      </div>
```

- [ ] **Step 3: Escribir `filterProfSelect` en `js/prestamos.js`**

Añadir cerca de `loanTeacherOptions()` (tras la línea 317):

```javascript
let _presProfOptions = [];
let _cajaProfOptions = [];

function _renderProfSelectOptions(selectId, list, selectedId){
  const sel = document.getElementById(selectId);
  sel.innerHTML = '<option value="">— Seleccionar —</option>' +
    list.map(p=>`<option value="${p.id}" ${selectedId!==undefined && String(p.id)===String(selectedId)?'selected':''}>${escHtml(p.nombre)}${p.departamento?' ('+escHtml(p.departamento)+')':''}</option>`).join('');
}

function filterProfSelect(listVarName, inputId, selectId){
  const full = listVarName === '_presProfOptions' ? _presProfOptions : _cajaProfOptions;
  const q = normalize(document.getElementById(inputId).value);
  const filtered = q ? full.filter(p => normalize(p.nombre).includes(q)) : full;
  _renderProfSelectOptions(selectId, filtered);
}
```

- [ ] **Step 4: Reusar el cache + render en `openPrestar`**

Localizar en `openPrestar` (línea ~355-367):

```javascript
  // Preseleccionar el usuario logueado si existe como profesor prestatario
  const profSelect = document.getElementById('pres_prof');
  const profsFiltrados = loanTeacherOptions();
  const profPropio = profsFiltrados.find(p => p.nombre.toLowerCase().trim() === (SESSION?.nombre||'').toLowerCase().trim());
  if(profPropio){
    profSelect.innerHTML = '<option value="">— Seleccionar —</option>' +
      profsFiltrados.map(p=>`<option value="${p.id}" ${String(p.id)===String(profPropio.id)?'selected':''}>${escHtml(p.nombre)}${p.departamento?' ('+escHtml(p.departamento)+')':''}</option>`).join('');
    profSelect.disabled = false;
  } else {
    profSelect.disabled = false;
    profSelect.innerHTML = '<option value="">— Seleccionar —</option>' +
      profsFiltrados.map(p=>`<option value="${p.id}">${escHtml(p.nombre)}${p.departamento?' ('+escHtml(p.departamento)+')':''}</option>`).join('');
  }
```

Reemplazar por:

```javascript
  // Preseleccionar el usuario logueado si existe como profesor prestatario
  document.getElementById('pres_profFiltQ').value = '';
  _presProfOptions = loanTeacherOptions();
  const profPropio = _presProfOptions.find(p => p.nombre.toLowerCase().trim() === (SESSION?.nombre||'').toLowerCase().trim());
  document.getElementById('pres_prof').disabled = false;
  _renderProfSelectOptions('pres_prof', _presProfOptions, profPropio ? profPropio.id : undefined);
```

- [ ] **Step 5: Reusar el cache + render en `openPrestarCaja`**

Localizar en `openPrestarCaja` (línea ~396-407):

```javascript
  const profSelect = document.getElementById('prestarCajaProf');
  const profsFiltrados = loanTeacherOptions();
  const profPropio = profsFiltrados.find(p => p.nombre.toLowerCase().trim() === (SESSION?.nombre||'').toLowerCase().trim());
  if(profPropio){
    profSelect.innerHTML = '<option value="">— Seleccionar —</option>' +
      profsFiltrados.map(p=>`<option value="${p.id}" ${String(p.id)===String(profPropio.id)?'selected':''}>${escHtml(p.nombre)}</option>`).join('');
    profSelect.disabled = false;
  } else {
    profSelect.disabled = false;
    profSelect.innerHTML = '<option value="">— Seleccionar —</option>' +
      profsFiltrados.map(p=>`<option value="${p.id}">${escHtml(p.nombre)}</option>`).join('');
  }
```

Reemplazar por:

```javascript
  document.getElementById('prestarCajaProfFiltQ').value = '';
  _cajaProfOptions = loanTeacherOptions();
  const profPropioCaja = _cajaProfOptions.find(p => p.nombre.toLowerCase().trim() === (SESSION?.nombre||'').toLowerCase().trim());
  document.getElementById('prestarCajaProf').disabled = false;
  _renderProfSelectOptions('prestarCajaProf', _cajaProfOptions, profPropioCaja ? profPropioCaja.id : undefined);
```

- [ ] **Step 6: Verificación manual**

1. Abrir "⌛ Nuevo préstamo" — el campo de búsqueda de profesor aparece
   encima del desplegable, vacío.
2. Escribir parte de un nombre (con y sin tilde) — el desplegable se
   reduce a coincidencias, sin perder la opción "— Seleccionar —".
3. Borrar el texto — vuelve a mostrar todos.
4. Repetir en 📦 Préstamo de caja completa (abrir desde el botón 📦⌛ de
   una fila con componentes).
5. Confirmar que el profesor logueado sigue apareciendo preseleccionado
   cuando corresponde (comportamiento sin cambios).

- [ ] **Step 7: Commit**

```bash
git add index.html js/prestamos.js
git commit -m "feat: buscador de profesor/a en modales de préstamo individual y caja"
```

---

### Task 4: Selector de caja sin `cajaId` fijo + buscador de ítem

**Files:**
- Modify: `index.html` (bloque `id="mPrestarCaja"`, y los 3 botones
  "⌛ Nuevo préstamo" — buscar `onclick="openPrestar()"`)
- Modify: `js/prestamos.js` (`openPrestarCaja`, nueva función
  `filterPresCajaItems`)

**Interfaces:**
- Consumes: `items` (array global), `renderAulaOptions()` (ya existente,
  usado igual que en `filterPresItems`), `AULAS` (array global),
  `normalize()` (`js/import.js:187`).
- Produces: `openPrestarCaja(cajaId)` acepta `cajaId` opcional
  (`undefined` = mostrar selector). `filterPresCajaItems()` — nueva
  función global, análoga a `filterPresItems()` pero filtrando a
  contenedores con stock en hijos.

- [ ] **Step 1: Añadir el bloque de selector en `index.html` dentro de `mPrestarCaja`**

Ubicar el inicio del modal:

```html
<div class="mbg" id="mPrestarCaja" onclick="if(event.target===this)closePrestarCaja()">
  <div class="modal">
    <div class="mh"><span class="mti">📦 Préstamo de caja completa</span><button class="mcl" onclick="closePrestarCaja()">✕</button></div>
    <div style="margin-bottom:12px">
      <div style="font-weight:600;font-size:15px" id="prestarCajaNombre"></div>
```

Insertar el selector justo antes de `<div style="margin-bottom:12px">`:

```html
<div class="mbg" id="mPrestarCaja" onclick="if(event.target===this)closePrestarCaja()">
  <div class="modal">
    <div class="mh"><span class="mti">📦 Préstamo de caja completa</span><button class="mcl" onclick="closePrestarCaja()">✕</button></div>
    <div id="prestarCajaSelector" style="display:none;margin-bottom:14px">
      <label class="fl">Caja a prestar *</label>
      <div style="display:flex;gap:8px;margin-bottom:6px">
        <select class="fi-w" id="pres_cajaFiltAula" onchange="filterPresCajaItems()" style="flex:1;min-width:0"></select>
        <div class="sbox" style="flex:2;min-width:0"><span class="si">🔍</span><input type="text" id="pres_cajaFiltQ" placeholder="Buscar..." oninput="filterPresCajaItems()" autocomplete="off"></div>
      </div>
      <select class="fi-w" id="pres_cajaSelect" onchange="onPresCajaSelectChange(this.value)"></select>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-weight:600;font-size:15px" id="prestarCajaNombre"></div>
```

- [ ] **Step 2: Añadir botón "📦 Prestar caja completa" en los 3 sitios del botón "⌛ Nuevo préstamo"**

En `index.html`, junto a cada una de las 3 apariciones de
`onclick="openPrestar()"` (buscar con Grep `onclick="openPrestar()"` para
confirmar líneas exactas, pueden haber cambiado), añadir justo después el
botón hermano con el mismo `data-perm` y estilo, ejemplo para la primera
aparición:

```html
      <button class="btn icon-btn" data-perm="loans.write" style="padding:11px 24px;font-size:14px;border-color:var(--amber);color:var(--amber)" onclick="openPrestar()">⌛ <span class="btn-text">Nuevo préstamo</span></button>
      <button class="btn icon-btn" data-perm="loans.write" style="padding:11px 24px;font-size:14px;border-color:var(--amber);color:var(--amber)" onclick="openPrestarCaja()">📦 <span class="btn-text">Prestar caja</span></button>
```

Replicar el mismo patrón (mismas clases/estilos que el botón vecino en
cada uno de los otros 2 sitios) para las apariciones en `index.html:424`
y `index.html:456` (líneas de referencia previas a este plan — confirmar
con Grep antes de editar).

- [ ] **Step 3: Escribir `_buildPresCajaOptions` y `filterPresCajaItems` en `js/prestamos.js`**

Añadir cerca de `_buildPresItemOptions`/`filterPresItems` (tras la línea
280):

```javascript
function _cajasConStock(){
  return items.filter(x => x.es_contenedor &&
    items.some(h => Number(h.parent_id)===Number(x.id) && Number(h.qty)>0)
  );
}

function _buildPresCajaOptions(filtered){
  document.getElementById('pres_cajaSelect').innerHTML =
    '<option value="">— Seleccionar caja —</option>' +
    filtered.map(x=>`<option value="${x.id}">${x.item}${x.ref?' ['+x.ref+']':''}</option>`).join('');
}

function filterPresCajaItems(){
  const aulaVal = document.getElementById('pres_cajaFiltAula').value;
  const q = normalize(document.getElementById('pres_cajaFiltQ').value);
  let filtered = _cajasConStock();
  if(aulaVal) filtered = filtered.filter(x=>String(x.aula)===String(aulaVal));
  if(q) filtered = filtered.filter(x=>normalize(x.item+' '+(x.ref||'')).includes(q));
  filtered.sort((a,b)=>a.item.localeCompare(b.item));
  _buildPresCajaOptions(filtered);
}

function onPresCajaSelectChange(val){
  if(!val) return;
  _loadCajaIntoModal(Number(val));
}
```

- [ ] **Step 4: Extraer la lógica de poblar el modal a `_loadCajaIntoModal`**

Localizar `openPrestarCaja` completa (línea ~380-416):

```javascript
function openPrestarCaja(cajaId){
  if(!requirePerm('loans.write')) return;
  const caja = items.find(x=>Number(x.id)===Number(cajaId));
  if(!caja) return;
  const hijos = items.filter(x=>Number(x.parent_id)===Number(cajaId) && Number(x.qty)>0);
  if(!hijos.length){ toast('La caja no tiene componentes con stock','err'); return; }
  _prestarCajaId = cajaId;

  document.getElementById('prestarCajaNombre').textContent = `${caja.ref ? caja.ref+' · ' : ''}${caja.item}`;
  document.getElementById('prestarCajaComponentes').innerHTML = hijos.map(h=>
    `<div style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--border)">
      <span style="font-weight:600">${escHtml(h.item)}</span>
      <span style="color:var(--muted);font-size:12px"> · ${h.qty} ud.</span>
    </div>`
  ).join('');

  document.getElementById('prestarCajaProfFiltQ').value = '';
  _cajaProfOptions = loanTeacherOptions();
  const profPropioCaja = _cajaProfOptions.find(p => p.nombre.toLowerCase().trim() === (SESSION?.nombre||'').toLowerCase().trim());
  document.getElementById('prestarCajaProf').disabled = false;
  _renderProfSelectOptions('prestarCajaProf', _cajaProfOptions, profPropioCaja ? profPropioCaja.id : undefined);

  document.getElementById('prestarCajaAulaDest').innerHTML = '<option value="">— Sin especificar —</option>' +
    renderAulaOptions();

  const f = new Date(); f.setDate(f.getDate()+7);
  document.getElementById('prestarCajaFecha').value = f.toISOString().split('T')[0];
  document.getElementById('prestarCajaObs').value = '';
  document.getElementById('mPrestarCaja').classList.add('open');
}
```

(Nota: este bloque ya incluye el cambio de Task 3 Step 5 — si Task 3 se
ejecutó antes, la firma real en el archivo tendrá ese contenido; si este
task se ejecuta de forma aislada, adaptar sobre el bloque original
correspondiente.)

Reemplazar por dos funciones — la de entrada al modal, y la que carga
una caja concreta:

```javascript
function openPrestarCaja(cajaId){
  if(!requirePerm('loans.write')) return;
  const selector = document.getElementById('prestarCajaSelector');

  if(cajaId!==undefined && cajaId!==null){
    selector.style.display = 'none';
    if(!_loadCajaIntoModal(Number(cajaId))) return;
  } else {
    selector.style.display = '';
    _prestarCajaId = null;
    document.getElementById('pres_cajaFiltAula').innerHTML = '<option value="">Todas las aulas</option>' +
      renderAulaOptions();
    document.getElementById('pres_cajaFiltQ').value = '';
    _buildPresCajaOptions(_cajasConStock().sort((a,b)=>a.item.localeCompare(b.item)));
    document.getElementById('prestarCajaNombre').textContent = '';
    document.getElementById('prestarCajaComponentes').innerHTML = '<div style="color:var(--muted);font-size:13px">Selecciona una caja para ver sus componentes</div>';

    document.getElementById('prestarCajaProfFiltQ').value = '';
    _cajaProfOptions = loanTeacherOptions();
    document.getElementById('prestarCajaProf').disabled = false;
    _renderProfSelectOptions('prestarCajaProf', _cajaProfOptions, undefined);

    document.getElementById('prestarCajaAulaDest').innerHTML = '<option value="">— Sin especificar —</option>' +
      renderAulaOptions();

    const f = new Date(); f.setDate(f.getDate()+7);
    document.getElementById('prestarCajaFecha').value = f.toISOString().split('T')[0];
    document.getElementById('prestarCajaObs').value = '';
  }

  document.getElementById('mPrestarCaja').classList.add('open');
}

function _loadCajaIntoModal(cajaId){
  const caja = items.find(x=>Number(x.id)===Number(cajaId));
  if(!caja) return false;
  const hijos = items.filter(x=>Number(x.parent_id)===Number(cajaId) && Number(x.qty)>0);
  if(!hijos.length){ toast('La caja no tiene componentes con stock','err'); return false; }
  _prestarCajaId = cajaId;

  document.getElementById('prestarCajaNombre').textContent = `${caja.ref ? caja.ref+' · ' : ''}${caja.item}`;
  document.getElementById('prestarCajaComponentes').innerHTML = hijos.map(h=>
    `<div style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--border)">
      <span style="font-weight:600">${escHtml(h.item)}</span>
      <span style="color:var(--muted);font-size:12px"> · ${h.qty} ud.</span>
    </div>`
  ).join('');

  document.getElementById('prestarCajaProfFiltQ').value = '';
  _cajaProfOptions = loanTeacherOptions();
  const profPropioCaja = _cajaProfOptions.find(p => p.nombre.toLowerCase().trim() === (SESSION?.nombre||'').toLowerCase().trim());
  document.getElementById('prestarCajaProf').disabled = false;
  _renderProfSelectOptions('prestarCajaProf', _cajaProfOptions, profPropioCaja ? profPropioCaja.id : undefined);

  document.getElementById('prestarCajaAulaDest').innerHTML = '<option value="">— Sin especificar —</option>' +
    renderAulaOptions();

  const f = new Date(); f.setDate(f.getDate()+7);
  document.getElementById('prestarCajaFecha').value = f.toISOString().split('T')[0];
  document.getElementById('prestarCajaObs').value = '';
  return true;
}
```

- [ ] **Step 5: Verificación manual**

1. Pulsar el nuevo botón "📦 Prestar caja" (en home, inventario y
   préstamos) sin partir de ninguna fila — debe abrir el modal con el
   selector de caja visible, filtro de aula + buscador de texto.
2. Escribir en el buscador — la lista de cajas se filtra en vivo (probar
   con y sin tilde).
3. Elegir una caja — se cargan sus componentes, profesor y aula destino
   como ya pasaba antes.
4. Registrar el préstamo — debe funcionar igual que el flujo anterior
   (verificar que el stock de los componentes baja correctamente).
5. Repetir el flujo antiguo: pulsar 📦⌛ en una fila de contenedor del
   inventario — debe seguir abriendo directo sin selector, comportamiento
   sin cambios.
6. Probar con un departamento que no tenga ninguna caja con stock — el
   selector debe mostrar la lista vacía sin errores de JS en consola.

- [ ] **Step 6: Commit**

```bash
git add index.html js/prestamos.js
git commit -m "feat: selector de caja con buscador en préstamo de caja completa"
```

---

### Task 5: Deploy

**Files:**
- Modify: `sw.js` (VERSION)
- Modify: `CLAUDE.md` (nota de versión + entrada en historial de sesiones)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: nada nuevo — solo bump de versión y push.

- [ ] **Step 1: Bump de versión**

En `sw.js`, incrementar `const VERSION = 'vXXX';` en 1 respecto al valor
actual en el repo en el momento de este commit.

- [ ] **Step 2: Actualizar CLAUDE.md**

Añadir una línea a la sección de historial de sesiones resumiendo: modal
👥 pasa a ser solo prestatarios externos, migración `0021` limpia
duplicados, buscador de profesor/a en ambos modales de préstamo,
selector de caja con buscador en préstamo de caja completa (nuevo botón
"📦 Prestar caja").

- [ ] **Step 3: Commit y push**

```bash
git add sw.js CLAUDE.md
git commit -m "chore: bump versión tras cambios de préstamos y prestatarios"
git push origin main
```

- [ ] **Step 4: Verificación post-deploy**

Esperar el deploy automático de Cloudflare Pages, recargar
`boscoinventario.pages.dev` forzando refresco de Service Worker
(cerrar/reabrir pestaña o hard refresh), y repetir las verificaciones
manuales de las Tasks 1, 3 y 4 contra el sitio real.
