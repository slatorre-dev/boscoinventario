# Modal de ítem: fix solape galería, fecha adquisición, precio, sección contenedor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir el solape visual entre la galería de fotos y la fila de stock del modal de ítem, añadir 2 campos nuevos (fecha de adquisición, precio) con sus columnas D1, y mover el bloque de Contenedor/Caja a su propia sección.

**Architecture:** 4 cambios independientes en los mismos archivos (`index.html`, `js/modal-item.js`, `functions/api/item.js`, `css/styles.css`). Los campos nuevos siguen el patrón ya establecido en el proyecto para columnas simples (`HEADERS_INV` → `openModal()` rellena → `saveItem()` guarda). La reorganización de Contenedor/Caja es un mover-sin-tocar-lógica.

**Tech Stack:** Cloudflare Pages Functions (backend, `functions/api/item.js`), Vanilla JS (frontend, `js/modal-item.js`), D1 (SQLite), HTML/CSS sin build step.

## Global Constraints

- Ningún cambio de esta feature toca `list.js`, `inventory.js`, `search.js`, `qr-scanner.js` ni ninguna vista fuera del modal de edición/creación de ítem — precio y fecha de adquisición son campos "de detalle", igual que `proveedor` hoy, no se muestran en tabla/tarjetas.
- Precio: número simple sin símbolo de moneda, columna D1 `REAL DEFAULT NULL`. Guardar como `parseFloat(...)||null`, nunca `||0` (un precio de 0 y "sin dato" son conceptos distintos).
- Fecha de adquisición: columna D1 `TEXT DEFAULT ''`, formato `YYYY-MM-DD`, campo independiente de la columna `fecha` existente (que sigue siendo "Última revisión").
- Workflow de despliegue del proyecto: bump `VERSION` en `sw.js` → commit → `git push origin main` (Cloudflare Pages autodespliega). No usar `--no-verify`.
- Verificación manual únicamente: no hay `wrangler pages dev` funcional en Windows (crash de libuv/workerd confirmado en sesiones anteriores) — toda verificación es contra producción tras deploy, con Playwright + `wrangler d1 execute`.
- Próxima migración disponible: `migrations/0025_*.sql` (la última existente es `0024_item_fotos.sql`).

---

## Task 1: Fix CSS — solape entre galería de fotos y fila de stock

**Files:**
- Modify: `css/styles.css:946-947` (`.foto-slot`, `.foto-slot .photo-preview`), `css/styles.css:941` (`.photo-picker`)

**Interfaces:**
- Consumes: ninguna — cambio CSS puro, sin tocar HTML ni JS.
- Produces: ningún cambio de interfaz — mismo comportamiento visual, solo ajuste de tamaño/wrap.

### Contexto para el implementador

El modal de ítem (`index.html`, sección 📦 INVENTARIO) tiene una fila `.photo-picker` que contiene dos hijos: `.photo-col` (la galería de fotos, `.fotos-galeria` con hasta 3 `.foto-slot` de 72×72px cada uno) y `.item-stock-strip` (los campos Cantidad/Mínimo/Tipo, en grid de 3 columnas). Con 2-3 fotos, `.photo-col` (que es `flex:0 0 auto`, línea 954) crece hasta ~250px+, dejando muy poco espacio al `.item-stock-strip` (`flex:1`, línea 955) dentro de `.photo-picker` (que tiene `overflow:hidden`, línea 941, sin `flex-wrap`) — el resultado es que los campos de stock se comprimen hasta solaparse visualmente con las miniaturas de foto.

- [ ] **Step 1: Reducir el tamaño de los slots de foto**

Localizar en `css/styles.css`:

```css
.foto-slot{position:relative;width:72px;height:72px}
```

Reemplazar por:

```css
.foto-slot{position:relative;width:56px;height:56px}
```

- [ ] **Step 2: Permitir que la fila de foto+stock salte de línea si no cabe**

Localizar en `css/styles.css`:

```css
.photo-picker{display:flex;align-items:center;gap:12px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px;min-width:0;overflow:hidden}
```

Reemplazar por:

```css
.photo-picker{display:flex;flex-wrap:wrap;align-items:center;gap:12px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px;min-width:0}
```

**Nota:** se quita `overflow:hidden` porque ya no hace falta ocultar el desbordamiento — con `flex-wrap:wrap`, el contenido que no quepa en una línea pasa a la siguiente en vez de desbordar o comprimirse. Esto es intencional y coincide con el fix — no lo dejes por error de copiado.

- [ ] **Step 3: Verificar que no se rompe la regla específica de `#mItem .photo-picker`**

Leer `css/styles.css` alrededor de la línea 952 y confirmar que sigue así (no debe cambiar en este task):

```css
#mItem .photo-picker{align-items:end}
```

Esta regla más específica se aplica después de la de Step 2 y solo sobreescribe `align-items` — el `flex-wrap:wrap` añadido en Step 2 se mantiene porque no se sobreescribe aquí. Si al leer el archivo actual encuentras que esta regla también define `flex-wrap` o `overflow`, detente y pregunta antes de continuar — significaría que el CSS cambió desde que se escribió este plan.

- [ ] **Step 4: Commit**

```bash
git add css/styles.css
git commit -m "fix: reducir tamaño de fotos y permitir wrap para evitar solape con Cantidad/Mínimo/Tipo"
```

- [ ] **Step 5: Verificación manual (requiere deploy — ver Task 5)**

No hay entorno de desarrollo local funcional — la verificación visual real ocurre en Task 5, tras el deploy conjunto de todo el plan.

---

## Task 2: Backend — columnas `fecha_adquisicion` y `precio` en D1

**Files:**
- Create: `migrations/0025_fecha_adquisicion_precio.sql`
- Modify: `functions/api/item.js:1` (`HEADERS_INV`)

**Interfaces:**
- Consumes: ninguna.
- Produces: columnas `inventario.fecha_adquisicion` (TEXT) e `inventario.precio` (REAL), ambas incluidas en `HEADERS_INV` — por tanto ya soportadas automáticamente por las acciones `add`/`update`/`bulkImport` de `functions/api/item.js` (todas iteran sobre `HEADERS_INV`/`FIELDS_UPD` sin necesitar más cambios).

### Contexto para el implementador

`functions/api/item.js` línea 1 define:

```js
const HEADERS_INV = ['id','ref','aula','mod','item','qty','min','cat','loc','est','util','proveedor','tags','fecha','mant','mantFecha','mantNota','mantResp','mantEstado','mantSolicitante','mantSolicitanteEmail','foto','obs','code','es_contenedor','parent_id','tipo_material','oculto'];
const FIELDS_UPD  = HEADERS_INV.filter(h => h !== 'id');
```

Todas las acciones (`add`, `update`, `bulkImport`) construyen su SQL dinámicamente a partir de este array — añadir los dos nombres nuevos aquí es suficiente para que el backend los acepte, sin tocar ninguna otra parte de `onRequestPost`.

- [ ] **Step 1: Escribir la migración**

Crear `migrations/0025_fecha_adquisicion_precio.sql`:

```sql
ALTER TABLE inventario ADD COLUMN fecha_adquisicion TEXT DEFAULT '';
ALTER TABLE inventario ADD COLUMN precio REAL DEFAULT NULL;
```

- [ ] **Step 2: Aplicar la migración en D1 remota**

```bash
npx wrangler d1 execute boscoinventario --remote --file=migrations/0025_fecha_adquisicion_precio.sql
```

Expected: comando termina sin error.

- [ ] **Step 3: Verificar el resultado**

```bash
npx wrangler d1 execute boscoinventario --remote --command="PRAGMA table_info(inventario)"
```

Expected: la salida incluye filas con `name` igual a `fecha_adquisicion` (type `TEXT`) y `precio` (type `REAL`).

- [ ] **Step 4: Añadir las columnas nuevas a `HEADERS_INV`**

Localizar en `functions/api/item.js`:

```js
const HEADERS_INV = ['id','ref','aula','mod','item','qty','min','cat','loc','est','util','proveedor','tags','fecha','mant','mantFecha','mantNota','mantResp','mantEstado','mantSolicitante','mantSolicitanteEmail','foto','obs','code','es_contenedor','parent_id','tipo_material','oculto'];
```

Reemplazar por:

```js
const HEADERS_INV = ['id','ref','aula','mod','item','qty','min','cat','loc','est','util','proveedor','tags','fecha','fecha_adquisicion','precio','mant','mantFecha','mantNota','mantResp','mantEstado','mantSolicitante','mantSolicitanteEmail','foto','obs','code','es_contenedor','parent_id','tipo_material','oculto'];
```

**Nota:** las columnas nuevas se insertaron junto a `fecha` (misma familia semántica) — el orden dentro de `HEADERS_INV` no afecta a la lógica (se usa solo para construir listas de columnas SQL por nombre), pero mantener campos relacionados juntos ayuda a la lectura del array en futuras sesiones.

- [ ] **Step 5: Verificar sintaxis**

```bash
node --check functions/api/item.js
```

Expected: sin salida (sin error).

- [ ] **Step 6: Commit**

```bash
git add migrations/0025_fecha_adquisicion_precio.sql functions/api/item.js
git commit -m "feat: columnas fecha_adquisicion y precio en inventario (D1 + HEADERS_INV)"
```

---

## Task 3: Frontend — campos fecha de adquisición y precio en el modal

**Files:**
- Modify: `index.html` (fila `.ref-nombre-row` en sección IDENTIFICACIÓN; sección 🔧 DETALLES)
- Modify: `css/styles.css:900` (`.ref-nombre-row`), `css/styles.css:1344` (regla responsive)
- Modify: `js/modal-item.js` (`openModal()`, `saveItem()`)

**Interfaces:**
- Consumes: columnas `fecha_adquisicion`/`precio` ya soportadas por el backend (Task 2).
- Produces: inputs `#f_fechaAdquisicion` (`type="date"`) y `#f_precio` (`type="number"`), ambos leídos/escritos por `openModal()`/`saveItem()`.

### Contexto para el implementador

**Antes de tocar nada, relee el HTML y JS actuales** — este plan cita el contenido tal como estaba al escribirse; si algo no coincide exactamente, confirma la diferencia antes de aplicar el reemplazo basado en texto (no solo en número de línea).

`index.html` tiene hoy (sección 📝 IDENTIFICACIÓN):

```html
<div class="ref-nombre-row full">
  <div><label class="fl">Ref.</label><input class="fi-w" id="f_ref" placeholder="R-10K"></div>
  <div><label class="fl">Nombre del ítem *</label><input class="fi-w" id="f_item" placeholder="Nombre del material o equipo"></div>
</div>
```

Y `css/styles.css` tiene:

```css
.ref-nombre-row{display:grid;grid-template-columns:80px 1fr;gap:12px;min-width:0}
```

- [ ] **Step 1: Añadir el campo de fecha de adquisición en `index.html`**

Reemplazar:

```html
<div class="ref-nombre-row full">
  <div><label class="fl">Ref.</label><input class="fi-w" id="f_ref" placeholder="R-10K"></div>
  <div><label class="fl">Nombre del ítem *</label><input class="fi-w" id="f_item" placeholder="Nombre del material o equipo"></div>
</div>
```

Por:

```html
<div class="ref-nombre-row full">
  <div><label class="fl">Ref.</label><input class="fi-w" id="f_ref" placeholder="R-10K"></div>
  <div><label class="fl">Nombre del ítem *</label><input class="fi-w" id="f_item" placeholder="Nombre del material o equipo"></div>
  <div><label class="fl">Fecha adquisición</label><input class="fi-w" id="f_fechaAdquisicion" type="date"></div>
</div>
```

- [ ] **Step 2: Ajustar el grid de `.ref-nombre-row` a 3 columnas**

Localizar en `css/styles.css`:

```css
.ref-nombre-row{display:grid;grid-template-columns:80px 1fr;gap:12px;min-width:0}
```

Reemplazar por:

```css
.ref-nombre-row{display:grid;grid-template-columns:80px 1fr 140px;gap:12px;min-width:0}
```

- [ ] **Step 3: Ajustar la regla responsive de `.ref-nombre-row`**

Localizar en `css/styles.css` (dentro de un bloque `@media`, alrededor de la línea 1344):

```css
  .ref-nombre-row{grid-template-columns:72px 1fr}
```

Reemplazar por:

```css
  .ref-nombre-row{grid-template-columns:72px 1fr 120px}
```

Si en pantallas muy estrechas 3 columnas siguen sin caber bien, no es bloqueante para este plan — el spec no pidió un rediseño completo de responsive, solo que el campo exista y funcione. Anota cualquier problema visual severo en el reporte, pero no inventes una solución de diseño no especificada.

- [ ] **Step 4: Añadir el campo de precio en `index.html`**

Localizar la sección 🔧 DETALLES:

```html
<!-- 🔧 DETALLES -->
<details class="m-section-details" id="mSecDetalles">
  <summary class="m-section-title">🔧 DETALLES <span class="sec-label-arrow">▾</span></summary>
  <div class="m-section-details-body">
    <div><label class="fl">Utilidad</label><input class="fi-w" id="f_util" placeholder="Para qué se usa"></div>
    <div><label class="fl">Proveedor</label><input class="fi-w" id="f_proveedor" placeholder="Proveedor, tienda o URL"></div>
    <div><label class="fl">Última revisión</label><input class="fi-w" id="f_fecha" type="date"></div>
  </div>
</details>
```

Reemplazar por:

```html
<!-- 🔧 DETALLES -->
<details class="m-section-details" id="mSecDetalles">
  <summary class="m-section-title">🔧 DETALLES <span class="sec-label-arrow">▾</span></summary>
  <div class="m-section-details-body">
    <div><label class="fl">Utilidad</label><input class="fi-w" id="f_util" placeholder="Para qué se usa"></div>
    <div><label class="fl">Proveedor</label><input class="fi-w" id="f_proveedor" placeholder="Proveedor, tienda o URL"></div>
    <div><label class="fl">Precio (€)</label><input class="fi-w" id="f_precio" type="number" step="0.01" min="0" placeholder="0.00"></div>
    <div><label class="fl">Última revisión</label><input class="fi-w" id="f_fecha" type="date"></div>
  </div>
</details>
```

- [ ] **Step 5: Rellenar los campos nuevos en `openModal()` (`js/modal-item.js`)**

Localizar en `openModal()`:

```js
  document.getElementById('f_item').value=m?.item||'';
```

Añadir justo después:

```js
  document.getElementById('f_item').value=m?.item||'';
  document.getElementById('f_fechaAdquisicion').value = m?.fecha_adquisicion || '';
```

Localizar también, más adelante en la misma función:

```js
  document.getElementById('f_proveedor').value=m?.proveedor||'';
```

Añadir justo después:

```js
  document.getElementById('f_proveedor').value=m?.proveedor||'';
  document.getElementById('f_precio').value = (m?.precio ?? '') === null ? '' : (m?.precio ?? '');
```

**Nota:** el ternario maneja tanto `undefined`/`null` (ítem nuevo o sin precio guardado, campo vacío) como `0` (precio real de cero euros, se muestra "0" y no se confunde con "sin dato" — a diferencia de `qty`/`min` que sí colapsan a 0 por defecto, aquí un precio de 0 es un dato válido que debe mostrarse tal cual, no vaciarse).

- [ ] **Step 6: Añadir los campos nuevos al payload de `saveItem()`**

Localizar en `saveItem()` el objeto `v`:

```js
  const v={
    code: eid ? itemCode(items.find(x=>x.id===eid) || eid) : '',
    ref: refRaw || _autoRef(name),
    aula:document.getElementById('f_aula').value,
    item:name,
    foto:document.getElementById('f_foto').value,
    qty:parseInt(document.getElementById('f_qty').value)||0,
    min:parseInt(document.getElementById('f_min').value)||0,
```

Reemplazar por:

```js
  const v={
    code: eid ? itemCode(items.find(x=>x.id===eid) || eid) : '',
    ref: refRaw || _autoRef(name),
    aula:document.getElementById('f_aula').value,
    item:name,
    fecha_adquisicion: document.getElementById('f_fechaAdquisicion').value,
    precio: document.getElementById('f_precio').value === '' ? null : parseFloat(document.getElementById('f_precio').value),
    foto:document.getElementById('f_foto').value,
    qty:parseInt(document.getElementById('f_qty').value)||0,
    min:parseInt(document.getElementById('f_min').value)||0,
```

**Nota:** `precio` usa `=== '' ? null : parseFloat(...)` en vez de `parseFloat(...)||null` — con `||`, un precio real de `0` (que `parseFloat` devolvería como `0`, un valor falsy) se convertiría incorrectamente en `null`. La comprobación explícita del string vacío evita ese bug.

- [ ] **Step 7: Verificar sintaxis**

```bash
node --check js/modal-item.js
```

Expected: sin salida.

- [ ] **Step 8: Commit**

```bash
git add index.html css/styles.css js/modal-item.js
git commit -m "feat: campos fecha de adquisición y precio en el modal de ítem"
```

---

## Task 4: Frontend — sección propia para Contenedor/Caja

**Files:**
- Modify: `index.html` (mover bloque de `#mSecDocumentacion` a nueva sección `#mSecContenedor`)
- Modify: `js/modal-item.js` (`openModal()` — lógica de apertura automática de secciones)

**Interfaces:**
- Consumes: ninguna interfaz nueva — reubica elementos existentes (`#f_es_contenedor`, `#f_parent_id`, `#f_parent_row`, `#f_contenedor_hijos`, `#genUnidadesPanel`, `#f_hijos_search`, `#f_hijos_list`) sin cambiar sus IDs ni la lógica que los usa (`toggleContenedorFields()`, `saveHijosCaja()`, `toggleGenerarUnidades()`, `saveGenerarUnidades()`, `renderHijosList()` — ninguna de estas funciones cambia en este task).
- Produces: nuevo `<details id="mSecContenedor">`, cuyo estado de apertura (`.open`) pasa a controlarse en `openModal()` según `esContenedor`, en vez de mezclarse con la lógica de `#mSecDocumentacion`.

### Contexto para el implementador

**Antes de tocar nada, relee el HTML actual completo de las secciones INVENTARIO, DETALLES y DOCUMENTACIÓN** — el bloque a mover es grande (checkbox + selector de caja padre + lista de hijos + panel de generar unidades), y el plan lo cita completo abajo para que no haya ambigüedad, pero confirma que coincide con el archivo real antes de cortar/pegar.

`index.html` tiene hoy, dentro de `<details ... id="mSecDocumentacion">`, inmediatamente después del `<div class="full">` de Observaciones:

```html
        <div class="full">
          <label class="fl">Contenedor / Caja</label>
          <div style="display:flex;flex-direction:column;gap:8px">
            <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer">
              <input type="checkbox" id="f_es_contenedor" onchange="toggleContenedorFields()">
              <span>Es un contenedor / agrupador de ítems</span>
            </label>
            <div id="f_parent_row">
              <select class="fi-w" id="f_parent_id" onchange="toggleContenedorFields()">
                <option value="">— Sin caja padre —</option>
              </select>
              <div style="font-size:11px;color:var(--muted);margin-top:3px">Si este componente pertenece a una caja, selecciónala aquí</div>
            </div>
            <div id="f_contenedor_hijos" style="display:none">
              <hr style="margin:8px 0;border:none;border-top:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span style="font-size:12px;color:var(--muted)">Marca los ítems que pertenecen a esta caja:</span>
                <div style="display:flex;gap:6px">
                  <button type="button" class="btn btn-sm" onclick="toggleGenerarUnidades()" style="font-size:12px;padding:4px 10px">⚡ Generar unidades</button>
                  <button type="button" class="btn btn-sm btn-loan" onclick="saveHijosCaja()" style="font-size:12px;padding:4px 10px">💾 Guardar selección</button>
                </div>
              </div>
              <!-- Panel generar unidades -->
              <div id="genUnidadesPanel" style="display:none;border:1.5px solid var(--accent);border-radius:10px;padding:12px;margin-bottom:10px;background:var(--accent-l,#eff6ff)">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                  <label style="font-size:13px;font-weight:600;white-space:nowrap">Unidades a crear:</label>
                  <input type="number" id="genUnidadesQty" min="1" max="50" value="2" style="width:70px" class="fi-w" oninput="renderGenUnidadesTable()">
                  <label style="font-size:13px;font-weight:600;white-space:nowrap">Prefijo ref.:</label>
                  <input type="text" id="genUnidadesPrefijo" class="fi-w" placeholder="ej. SET-POL" style="width:110px" oninput="renderGenUnidadesTable()">
                </div>
                <div id="genUnidadesPadreRef" style="font-size:11px;color:var(--muted);margin-bottom:6px"></div>
                <div id="genUnidadesTable" style="max-height:240px;overflow-y:auto;margin-bottom:10px"></div>
                <div style="display:flex;justify-content:flex-end;gap:8px">
                  <button type="button" class="btn btn-sm" onclick="toggleGenerarUnidades()" style="font-size:12px;padding:4px 10px">Cancelar</button>
                  <button type="button" class="btn btn-sm btn-loan" onclick="saveGenerarUnidades()" style="font-size:12px;padding:4px 10px">✅ Crear unidades</button>
                </div>
              </div>
              <input class="fi-w" id="f_hijos_search" type="text" placeholder="🔍 Buscar ítem..." oninput="renderHijosList()" style="margin-bottom:6px">
              <div id="f_hijos_list" style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px 8px;background:var(--bg2,#f9fafb)"></div>
            </div>
          </div>
        </div>
```

- [ ] **Step 1: Quitar el bloque de Contenedor/Caja de dentro de `#mSecDocumentacion`**

Eliminar exactamente el bloque HTML citado arriba (desde `<div class="full">` con la etiqueta "Contenedor / Caja" hasta su `</div>` de cierre correspondiente) de dentro de `<details id="mSecDocumentacion">`. `#mSecDocumentacion` debe quedar con: el `<div class="full">` de Observaciones, el bloque de QR del ítem (`#itemQrBox`), y el bloque de "Documentación adjunta" (subir archivos/hacer foto) — sin el bloque de Contenedor/Caja.

- [ ] **Step 2: Crear la nueva sección `#mSecContenedor`, justo después de INVENTARIO**

Localizar el cierre de la sección 📦 INVENTARIO en `index.html`:

```html
      <!-- 📦 INVENTARIO (sin cambios) -->
      <div class="m-section">
        <div class="m-section-title">📦 INVENTARIO</div>
        <div class="full">
          <label class="fl">Fotos (máx. 3)</label>
          ...
        </div>
      </div>

      <!-- 🔧 DETALLES -->
      <details class="m-section-details" id="mSecDetalles">
```

Insertar la nueva sección entre el cierre de INVENTARIO y la apertura de DETALLES:

```html
      <!-- 📦 CONTENEDOR / CAJA -->
      <details class="m-section-details" id="mSecContenedor">
        <summary class="m-section-title">📦 CONTENEDOR / CAJA <span class="sec-label-arrow">▾</span></summary>
        <div class="m-section-details-body">
          <div class="full">
            <div style="display:flex;flex-direction:column;gap:8px">
              <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer">
                <input type="checkbox" id="f_es_contenedor" onchange="toggleContenedorFields()">
                <span>Es un contenedor / agrupador de ítems</span>
              </label>
              <div id="f_parent_row">
                <select class="fi-w" id="f_parent_id" onchange="toggleContenedorFields()">
                  <option value="">— Sin caja padre —</option>
                </select>
                <div style="font-size:11px;color:var(--muted);margin-top:3px">Si este componente pertenece a una caja, selecciónala aquí</div>
              </div>
              <div id="f_contenedor_hijos" style="display:none">
                <hr style="margin:8px 0;border:none;border-top:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <span style="font-size:12px;color:var(--muted)">Marca los ítems que pertenecen a esta caja:</span>
                  <div style="display:flex;gap:6px">
                    <button type="button" class="btn btn-sm" onclick="toggleGenerarUnidades()" style="font-size:12px;padding:4px 10px">⚡ Generar unidades</button>
                    <button type="button" class="btn btn-sm btn-loan" onclick="saveHijosCaja()" style="font-size:12px;padding:4px 10px">💾 Guardar selección</button>
                  </div>
                </div>
                <!-- Panel generar unidades -->
                <div id="genUnidadesPanel" style="display:none;border:1.5px solid var(--accent);border-radius:10px;padding:12px;margin-bottom:10px;background:var(--accent-l,#eff6ff)">
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                    <label style="font-size:13px;font-weight:600;white-space:nowrap">Unidades a crear:</label>
                    <input type="number" id="genUnidadesQty" min="1" max="50" value="2" style="width:70px" class="fi-w" oninput="renderGenUnidadesTable()">
                    <label style="font-size:13px;font-weight:600;white-space:nowrap">Prefijo ref.:</label>
                    <input type="text" id="genUnidadesPrefijo" class="fi-w" placeholder="ej. SET-POL" style="width:110px" oninput="renderGenUnidadesTable()">
                  </div>
                  <div id="genUnidadesPadreRef" style="font-size:11px;color:var(--muted);margin-bottom:6px"></div>
                  <div id="genUnidadesTable" style="max-height:240px;overflow-y:auto;margin-bottom:10px"></div>
                  <div style="display:flex;justify-content:flex-end;gap:8px">
                    <button type="button" class="btn btn-sm" onclick="toggleGenerarUnidades()" style="font-size:12px;padding:4px 10px">Cancelar</button>
                    <button type="button" class="btn btn-sm btn-loan" onclick="saveGenerarUnidades()" style="font-size:12px;padding:4px 10px">✅ Crear unidades</button>
                  </div>
                </div>
                <input class="fi-w" id="f_hijos_search" type="text" placeholder="🔍 Buscar ítem..." oninput="renderHijosList()" style="margin-bottom:6px">
                <div id="f_hijos_list" style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px 8px;background:var(--bg2,#f9fafb)"></div>
              </div>
            </div>
          </div>
        </div>
      </details>

      <!-- 🔧 DETALLES -->
      <details class="m-section-details" id="mSecDetalles">
```

- [ ] **Step 3: Separar la lógica de apertura automática en `openModal()`**

Localizar en `js/modal-item.js`:

```js
  const secDocs = document.getElementById('mSecDocumentacion');
  if(secDocs) secDocs.open = existing && (modalSectionShouldOpen(m, ['obs']) || esContenedor);
```

Reemplazar por:

```js
  const secDocs = document.getElementById('mSecDocumentacion');
  if(secDocs) secDocs.open = existing && modalSectionShouldOpen(m, ['obs']);
  const secContenedor = document.getElementById('mSecContenedor');
  if(secContenedor) secContenedor.open = existing && esContenedor;
```

**Nota:** confirma que la variable `esContenedor` ya está definida en el scope de `openModal()` en este punto del archivo (el plan asume que sí, según la lectura hecha durante el diseño — `const esContenedor = m?.es_contenedor == 1 || m?.es_contenedor === true;` aparece antes en la misma función). Si no está definida ahí todavía, usa la misma expresión en vez de la variable.

- [ ] **Step 4: Verificar que ningún otro sitio del código referencia la ubicación antigua**

```bash
grep -n "mSecDocumentacion" js/modal-item.js index.html
```

Expected: las únicas coincidencias son la declaración del `<details id="mSecDocumentacion">` en `index.html` y la línea ya modificada en `js/modal-item.js` (Step 3) — ninguna otra parte del código debía depender de que el bloque de contenedor estuviera dentro de documentación.

- [ ] **Step 5: Verificar sintaxis**

```bash
node --check js/modal-item.js
```

Expected: sin salida.

- [ ] **Step 6: Commit**

```bash
git add index.html js/modal-item.js
git commit -m "feat: sección propia CONTENEDOR/CAJA, separada de DOCUMENTACIÓN"
```

---

## Task 5: Deploy y verificación end-to-end en producción

**Files:**
- Modify: `sw.js` (`VERSION`)

**Interfaces:**
- Consumes: ninguna — paso de despliegue.
- Produces: build desplegado en `boscoinventario.pages.dev` con Tasks 1-4.

- [ ] **Step 1: Bump de versión**

Leer el valor actual de `VERSION` en `sw.js` e incrementarlo en 1 (el proyecto usa versiones `vNNN` secuenciales — confirmar el número actual antes de elegir el siguiente, no asumas un valor fijo).

- [ ] **Step 2: Commit y push**

```bash
git add sw.js
git commit -m "chore: bump version tras fix modal ítem (fotos, fecha adquisición, precio, contenedor)"
git push origin main
```

- [ ] **Step 3: Verificación manual con Playwright contra producción**

Login con cualquier cuenta de departamento. Abrir un ítem existente con 2-3 fotos (ej. reutilizar el ítem `1097` usado en la verificación de la galería de fotos, o cualquier otro con fotos) — confirmar visualmente que los campos Cantidad/Mínimo/Tipo ya no se solapan con las miniaturas de foto. Confirmar que aparece el campo "Fecha adquisición" junto a Ref./Nombre, y "Precio (€)" junto a Proveedor en DETALLES. Rellenar ambos, guardar, reabrir el ítem y confirmar que persisten. Marcar un ítem como "Es un contenedor/agrupador de ítems" — confirmar que el checkbox y sus campos asociados aparecen en una sección propia "📦 CONTENEDOR / CAJA", no dentro de "📎 DOCUMENTACIÓN". Guardar, reabrir el mismo ítem, confirmar que la sección CONTENEDOR/CAJA se abre automáticamente (no la de DOCUMENTACIÓN, salvo que también tenga observaciones).

- [ ] **Step 4: Verificar en D1 remota**

```bash
npx wrangler d1 execute boscoinventario --remote --command="SELECT id, fecha_adquisicion, precio FROM inventario WHERE id=<id del ítem de prueba>"
```

Expected: `fecha_adquisicion` con el valor introducido (`YYYY-MM-DD`), `precio` con el número introducido.

- [ ] **Step 5: Limpiar datos de prueba si se usó un ítem real**

Si se modificó un ítem existente solo para la prueba (no creado específicamente para ella), decidir si los valores de prueba (`fecha_adquisicion`, `precio`, `es_contenedor`) se revierten a su estado anterior o se dejan — preguntar al usuario si no es evidente por el contexto. Si se creó un ítem nuevo solo para probar, eliminarlo:

```bash
npx wrangler d1 execute boscoinventario --remote --command="DELETE FROM inventario WHERE id=<id de prueba>"
```

---

## Self-Review Notes (completado durante la escritura del plan)

- **Cobertura del spec:** Cambio 1 (fix CSS) → Task 1. Cambio 2 (fecha adquisición) → Tasks 2+3. Cambio 3 (precio) → Tasks 2+3. Cambio 4 (sección contenedor) → Task 4. Deploy + verificación → Task 5.
- **Consistencia de tipos:** `fecha_adquisicion` (TEXT/string `YYYY-MM-DD`) y `precio` (REAL/number o `null`) se usan con el mismo nombre en D1 (Task 2), `HEADERS_INV` (Task 2), HTML (`#f_fechaAdquisicion`/`#f_precio`, Task 3) y JS de `openModal()`/`saveItem()` (Task 3).
- **Bug evitado explícitamente:** `precio` usa `=== '' ? null : parseFloat(...)` en vez de `parseFloat(...)||null` para no confundir un precio real de `0` con "sin dato" — anotado en Task 3 Step 6.
- **Orden de tasks:** Task 2 (backend) antes de Task 3 (frontend que lo consume) — necesario porque Task 3 asume que `HEADERS_INV` ya incluye las columnas nuevas. Task 1 y Task 4 son independientes entre sí y de Tasks 2-3, pueden ejecutarse en cualquier orden relativo, pero se mantienen en la secuencia 1-2-3-4 por claridad de commits incrementales.
- **Placeholders:** ninguno — todo paso de código incluye el código real a escribir, con el HTML completo del bloque a mover (Task 4) para evitar ambigüedad de "mueve esto" sin mostrar el contenido exacto.
