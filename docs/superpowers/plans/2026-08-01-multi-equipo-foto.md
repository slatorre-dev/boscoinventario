# Multi-equipo en una foto (Alta Masiva) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher photograph a table with several new, never-inventoried pieces of equipment, get an AI-proposed editable list (name + quantity + suggested category per row), and create all of them at once in the classroom already selected — without any per-object duplicate search.

**Architecture:** One new read-only backend action (`detectarMultiples` in `functions/api/item.js`) makes a single Workers AI call with a prompt distinct from `buscarPorSerie`'s, asking for an array of detected objects. The frontend (`js/multi-equipo.js`, mirroring `js/camara-serie.js`'s and `js/revision-aula.js`'s camera-capture pattern) renders the array as an editable table, then reuses the already-deployed `bulkImport` action unchanged for the actual write.

**Tech Stack:** Cloudflare Pages Functions (JS), vanilla JS frontend, no build step, no test framework (verification is manual/Playwright against production, per project convention).

## Global Constraints

- No new D1 migration — `bulkImport` already inserts into the current schema unchanged.
- `bulkImport` requires each item object to carry EVERY field in `HEADERS_INV` (`functions/api/item.js:2`) — it reads `it[h] ?? null` for each header, so a partial `{nombre, cantidad, categoria}` object is not enough. Every row sent to `bulkImport` must be built as a full item shape with the non-relevant fields defaulted (empty string / 0 / null as appropriate), not just the 3 fields the AI detects.
- `bulkImport`'s registered permission is `import.write` (`js/roles.js:37`), NOT `items.write` — any UI gating on whether the "Crear N ítems" button should be usable must check `can('import.write')`, matching what the backend will actually accept. Do not assume `items.write` (an easy mistake since the rest of this feature's UI, like the entry button, correctly gates on `items.write` for OPENING the modal — but the final creation step's permission is `import.write` because it goes through `bulkImport`).
- `categoriaSugerida` (per row) must be validated against the real category names of the user's department before being trusted — same `categoriasDept` pattern already used in `buscarPorSerie` (`functions/api/item.js:325-329`). A value that isn't an exact match is discarded to empty/null for that row, never passed through.
- **Known bug class in this codebase (hit twice already, see `CLAUDE.md`): a value computed or validated in one file silently diverges from what another file actually expects.** Read `functions/api/list.js`'s `HEADERS_INV` and `functions/api/item.js`'s `HEADERS_INV` before writing any code that touches `bulkImport`'s payload shape — they must already be identical (fixed in a prior session); if this task discovers new columns needed, both files must be updated together, never just one.
- **Known UI bug in this codebase (idea #5's implementation, already fixed): a new button using the generic `data-perm="X"` attribute gets unconditionally shown by `applyRoleUI()`'s `querySelectorAll('[data-perm]')` sweep (`js/roles.js:140-142`), which runs on every `openSub()` call and OVERWRITES any `cf.type`-based visibility logic set earlier in the same function.** The new button in this plan (`#btnMultiEquipo`) must NOT use `data-perm` — its visibility must be controlled exclusively by explicit code in `openSub()`, the same way `#btnRevisionAula` was fixed to work (see `js/nav.js:196-197` for the exact working pattern to copy).
- `sw.js` `VERSION` must be bumped as the final step (project workflow in `CLAUDE.md`).
- Verification is manual/Playwright against production — this project has no automated test suite.

---

### Task 1: Backend — `detectarMultiples` action

**Files:**
- Modify: `functions/api/item.js` — add a new action block, placed after the existing `buscarPorSerie` block (which currently ends around line 409-410 with its closing `}` before the function's final `return Response.json({ ok: false, error: 'Accion desconocida' });`)

**Interfaces:**
- Consumes: `env.AI`, `env.DB`, `dept`, `superadmin`, `genericDept` (already in scope in `onRequestPost`, same variables `buscarPorSerie` uses).
- Produces: `POST /api/item {action:'detectarMultiples', imagen: <base64>}` → `{ok:true, objetos:[{nombre, cantidad, categoriaSugerida}, ...]}` on success (objetos may be an empty array if nothing was detected), or `{ok:false, error:'...'}` on failure. Consumed by Task 3's `js/multi-equipo.js`.

- [ ] **Step 1: Read the current end of the `buscarPorSerie` block to find the exact insertion point**

Run: `grep -n "if (action === 'buscarPorSerie')" -A 95 functions/api/item.js | tail -20`

Confirm where the block's closing `}` is (should be shortly after the `if (textoLibre) { ... }` / visual-match / `sin_lectura` fallback lines), and confirm the next line after that closing brace before you insert new code.

- [ ] **Step 2: Add the `detectarMultiples` action block**

Insert this new block immediately after `buscarPorSerie`'s closing `}` (before the function's final `return Response.json({ ok: false, error: 'Accion desconocida' });`):

```js
  if (action === 'detectarMultiples') {
    const imagen = body.imagen;
    if (!imagen) return Response.json({ ok: false, error: 'Falta la imagen' });
    if (!env.AI) return Response.json({ ok: false, error: 'Workers AI no configurado en Cloudflare' });

    const catDeptFilter = superadmin ? '' : ' WHERE departamento=?';
    const catDeptBind = superadmin ? [] : [dept];
    const catRows = await env.DB.prepare(`SELECT DISTINCT name FROM categorias${catDeptFilter} ORDER BY orden`)
      .bind(...catDeptBind).all();
    const categoriasDept = (catRows.results || []).map(r => r.name).filter(Boolean);

    let aiData;
    try {
      const categoriasTexto = categoriasDept.length
        ? categoriasDept.map(c => `"${c}"`).join(', ')
        : '(ninguna categoría disponible)';
      aiData = await env.AI.run('@cf/moondream/moondream3.1-9B-A2B', {
        task: 'query',
        image: `data:image/jpeg;base64,${imagen}`,
        question: `Analiza esta foto de una mesa o superficie con varios equipos o materiales de inventario. Identifica CADA objeto distinto que veas y agrupa los que sean iguales entre sí, contando cuántas unidades hay de cada uno. Para cada tipo de objeto distinto, indica un nombre breve y descriptivo, la cantidad de unidades de ese tipo, y si encaja, UNA categoría de esta lista exacta: ${categoriasTexto}. Responde ÚNICAMENTE con un array JSON real usando los datos que veas, por ejemplo: [{"nombre": "Fuente de alimentación de laboratorio", "cantidad": 4, "categoriaSugerida": "Equipos de medida"}, {"nombre": "Multímetro digital", "cantidad": 2, "categoriaSugerida": "Herramientas"}, {"nombre": "Osciloscopio", "cantidad": 1, "categoriaSugerida": null}]. "categoriaSugerida" debe ser EXACTAMENTE uno de los nombres de la lista dada (copiado tal cual) o null si ninguno encaja — nunca inventes un nombre de categoría nuevo. Si no detectas ningún objeto reconocible, responde con un array vacío: []. No añadas explicaciones ni texto fuera del array JSON. Nunca copies este ejemplo literalmente si no corresponde a la foto real.`,
        reasoning: true,
        stream: false,
        max_tokens: 600
      });
    } catch (e) {
      return Response.json({ ok: false, error: 'Error del servicio de IA' });
    }

    let objetos = [];
    const raw = aiData?.result?.answer || '';
    try {
      const parsed = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] || '[]');
      objetos = (Array.isArray(parsed) ? parsed : []).map(o => {
        const nombre = String(o?.nombre || '').trim();
        const cantidad = Math.max(1, parseInt(o?.cantidad, 10) || 1);
        let categoriaSugerida = String(o?.categoriaSugerida || '').trim();
        if (categoriaSugerida && !categoriasDept.includes(categoriaSugerida)) categoriaSugerida = '';
        return { nombre, cantidad, categoriaSugerida };
      }).filter(o => o.nombre);
    } catch (e) {
      return Response.json({ ok: true, objetos: [] });
    }

    return Response.json({ ok: true, objetos });
  }

```

**Design notes:**
- `max_tokens: 600` (higher than `buscarPorSerie`'s 400) because this prompt can legitimately return several array entries, each with its own strings.
- `cantidad` defaults to 1 and is clamped to a minimum of 1 (`Math.max(1, ...)`) — an AI response with a missing or zero/negative count should never produce an unusable row.
- Rows with an empty `nombre` after trimming are filtered out entirely — a row with no name is not useful to show in the editable list.
- Same `categoriasDept` validation pattern as `buscarPorSerie` (`functions/api/item.js:325-329`), copied not shared, matching how `buscarPorSerie` already does its own independent copy (no premature abstraction across the two actions for a 5-line block).

- [ ] **Step 3: Syntax check**

Run: `node --check functions/api/item.js`
Expected: no output (syntax valid)

- [ ] **Step 4: Commit**

```bash
git add functions/api/item.js
git commit -m "feat: acción detectarMultiples para alta masiva desde una foto"
```

---

### Task 2: Register `detectarMultiples` in permission tables

**Files:**
- Modify: `js/api.js` (`ENDPOINT_MAP`)
- Modify: `js/roles.js` (`ACTION_PERMISSIONS`)

**Interfaces:**
- Consumes: nothing new
- Produces: `apiPost({action:'detectarMultiples', ...})` becomes routable and permission-checked — consumed by Task 3's `js/multi-equipo.js`.

- [ ] **Step 1: Add to `ENDPOINT_MAP`**

In `js/api.js`, find the line (currently line 6):
```js
  add:'item', update:'item', delete:'item', bulkImport:'item', restoreBackup:'item', toggleOculto:'item', fotosGet:'item', fotosSync:'item', buscarPorSerie:'item',
```
Add `detectarMultiples:'item',` to this same line (same object, `item` endpoint group, matching `buscarPorSerie`'s grouping since both live in the same backend file):
```js
  add:'item', update:'item', delete:'item', bulkImport:'item', restoreBackup:'item', toggleOculto:'item', fotosGet:'item', fotosSync:'item', buscarPorSerie:'item', detectarMultiples:'item',
```

- [ ] **Step 2: Add to `ACTION_PERMISSIONS`**

In `js/roles.js`, find the line (currently line 41):
```js
  buscarPorSerie: 'serie.read',
```
Add a new line immediately after it:
```js
  detectarMultiples: 'serie.read',
```

This reuses the same `serie.read` permission `buscarPorSerie` uses (already treated as a universal-read permission — see `js/roles.js`'s `can()` function, which special-cases `docs.read`/`serie.read` as always-true reads, per the project's existing convention for this permission).

- [ ] **Step 3: Confirm `serie.read`'s special-case handling still covers the new permission name**

Run: `grep -n "serie.read" js/roles.js`

Confirm the line that special-cases `'docs.read' || permission === 'serie.read'` as always-true reads is unaffected by this change (it checks the permission STRING `'serie.read'`, not the action name, so reusing the same permission string for `detectarMultiples` automatically inherits this special-case — no additional code needed here, this step is verification only).

- [ ] **Step 4: Syntax check**

Run: `node --check js/api.js && node --check js/roles.js`
Expected: no output (syntax valid)

- [ ] **Step 5: Commit**

```bash
git add js/api.js js/roles.js
git commit -m "feat: registra detectarMultiples en ENDPOINT_MAP y ACTION_PERMISSIONS"
```

---

### Task 3: HTML — entry button + editable-list modal

**Files:**
- Modify: `index.html` — add a button to `.action-strip` (around line 462-467, alongside the existing `#btnRevisionAula` from idea #5) and a new modal after `#mRevisionAula`

**Interfaces:**
- Produces: DOM elements `#btnMultiEquipo` (button), `#mMultiEquipo` (modal), `#multiVideo`, `#multiEstado`, `#multiCapturarBtn`, `#multiListaWrap`, `#multiListaBody` (table body for editable rows), `#multiCrearBtn` — all consumed by Task 4's `js/multi-equipo.js`.

- [ ] **Step 1: Add the "Añadir varios" button to the action strip**

In `index.html`, inside `<div class="action-strip">`, add a new button right after `#btnRevisionAula`'s button (currently the line containing `id="btnRevisionAula"`):

```html
      <button class="btn btn-p icon-btn print-no" id="btnMultiEquipo" style="padding:6px 10px;font-size:12px;display:none" onclick="openMultiEquipo()">📸 <span class="btn-text">Añadir varios</span></button>
```

**Do NOT add `data-perm` to this button** — see this plan's Global Constraints section for why (the `applyRoleUI()` sweep would override the `cf.type`-based visibility Task 5 sets). It starts with inline `display:none`, matching the exact pattern already used by `#btnRevisionAula`.

- [ ] **Step 2: Add the multi-equipo modal**

Find `#mRevisionAula`'s closing `</div></div>` (the modal added by idea #5, currently ending around line 1571-1572 depending on the current state of the file — search for `id="mRevisionAula"` and read forward to its closing tags). Add this new modal immediately after it:

```html
<!-- ══ ALTA MASIVA MULTI-EQUIPO DESDE UNA FOTO ══ -->
<div class="mbg" id="mMultiEquipo" onclick="if(event.target===this)closeMultiEquipo()">
  <div class="modal" style="max-width:700px">
    <div class="mh"><div class="mt">📸 Fotografía la mesa con los equipos</div><button class="mx" onclick="closeMultiEquipo()">✕</button></div>
    <video id="multiVideo" style="width:100%;max-width:500px;border-radius:8px;margin-bottom:16px;display:none" autoplay playsinline></video>
    <div id="multiEstado" style="display:none;font-size:13px;color:var(--muted);margin:16px 0;text-align:center">Identificando equipos...</div>
    <div id="multiListaWrap" style="display:none">
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
        <thead>
          <tr style="text-align:left;font-size:12px;color:var(--muted)">
            <th style="padding:6px 4px">Nombre</th>
            <th style="padding:6px 4px;width:70px">Cant.</th>
            <th style="padding:6px 4px;width:160px">Categoría</th>
            <th style="padding:6px 4px;width:30px"></th>
          </tr>
        </thead>
        <tbody id="multiListaBody"></tbody>
      </table>
    </div>
    <div class="mf" style="margin-top:16px;gap:8px">
      <button class="btn btn-p" id="multiCapturarBtn" style="display:none" onclick="capturarMulti()">Capturar</button>
      <button class="btn btn-p" id="multiCrearBtn" style="display:none" onclick="confirmarCrearMulti()">Crear ítems</button>
      <button class="btn" onclick="closeMultiEquipo()">Cerrar</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Visual verification**

Re-read the modified regions of `index.html` to confirm no unclosed tags were introduced (this project has no HTML syntax checker — visual inspection is the expected evidence).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: botón y modal de alta masiva multi-equipo (index.html)"
```

---

### Task 4: Frontend — camera capture, editable list rendering, and confirmation

**Files:**
- Create: `js/multi-equipo.js`
- Modify: `index.html` — add `<script defer src="js/multi-equipo.js"></script>` near the existing `js/revision-aula.js` script tag

**Interfaces:**
- Consumes: `apiPost()` (existing), `AULAS`/`CATS` (existing globals — `CATS` for populating the category `<select>` per row, same object already used by other category dropdowns in this project), `escHtml()`, `toast()`, `confirmDialog()` (existing, `js/ui-helpers.js:6`, signature `{title, message, confirmText, danger, icon}` — see idea #5's plan for the exact verified signature, do not assume anything richer), `cf` (existing global, `{type:'aula', id, ...}` when in aula view), `can()` (existing permission-check function).
- Produces: `openMultiEquipo()`, `closeMultiEquipo()`, `capturarMulti()`, `confirmarCrearMulti()` — called from `index.html` onclick handlers (Task 3) and Task 5's visibility logic.

- [ ] **Step 1: Add the script tag**

Run: `grep -n 'revision-aula.js' index.html`

Add immediately after that line:
```html
<script defer src="js/multi-equipo.js"></script>
```

- [ ] **Step 2: Write `js/multi-equipo.js`**

```js
let _multiStream = null;
let _multiCapturing = false;
let _multiAulaId = '';
let _multiObjetos = [];

function openMultiEquipo() {
  if (!cf || cf.type !== 'aula') {
    toast('Abre primero la vista de un aula para añadir varios equipos', 'err');
    return;
  }
  _multiAulaId = cf.id;
  _multiObjetos = [];

  const modal = document.getElementById('mMultiEquipo');
  const video = document.getElementById('multiVideo');
  const estado = document.getElementById('multiEstado');
  const listaWrap = document.getElementById('multiListaWrap');
  const capturarBtn = document.getElementById('multiCapturarBtn');
  const crearBtn = document.getElementById('multiCrearBtn');

  modal.classList.add('open');
  estado.style.display = 'none';
  listaWrap.style.display = 'none';
  document.getElementById('multiListaBody').innerHTML = '';
  capturarBtn.style.display = 'none';
  crearBtn.style.display = 'none';
  _multiCapturing = false;

  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Este navegador no permite acceder a la cámara', 'err');
    closeMultiEquipo();
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      _multiStream = stream;
      video.srcObject = stream;
      video.style.display = 'block';
      capturarBtn.style.display = 'inline-flex';
      video.onloadedmetadata = () => video.play();
    })
    .catch(err => {
      let msg = 'Error al acceder a la cámara: ' + err.message;
      if (err.name === 'NotAllowedError') msg = 'Acceso denegado a la cámara. Verifica los permisos.';
      else if (err.name === 'NotFoundError') msg = 'No se encontró cámara en tu dispositivo.';
      toast(msg, 'err');
      closeMultiEquipo();
    });
}

function closeMultiEquipo() {
  if (_multiStream) {
    _multiStream.getTracks().forEach(t => t.stop());
    _multiStream = null;
  }
  const video = document.getElementById('multiVideo');
  if (video) video.srcObject = null;
  document.getElementById('mMultiEquipo').classList.remove('open');
}

async function capturarMulti() {
  if (_multiCapturing) return;
  _multiCapturing = true;
  const video = document.getElementById('multiVideo');
  const estado = document.getElementById('multiEstado');
  const capturarBtn = document.getElementById('multiCapturarBtn');
  const listaWrap = document.getElementById('multiListaWrap');

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
  const imagenBase64 = dataUrl.split(',')[1];

  video.style.display = 'none';
  capturarBtn.style.display = 'none';
  estado.style.display = 'block';
  estado.textContent = 'Identificando equipos...';
  listaWrap.style.display = 'none';

  try {
    const res = await apiPost({ action: 'detectarMultiples', imagen: imagenBase64 });
    estado.style.display = 'none';
    if (!res.ok) {
      toast(res.error || 'No se pudo analizar la foto, inténtalo de nuevo', 'err');
      _volverACapturarMulti();
      return;
    }
    if (!res.objetos || !res.objetos.length) {
      toast('No se detectó ningún equipo, prueba otra foto o mejora la luz/encuadre', 'err');
      _volverACapturarMulti();
      return;
    }
    _multiObjetos = res.objetos.map((o, i) => ({ _rowId: i, nombre: o.nombre, cantidad: o.cantidad, categoriaSugerida: o.categoriaSugerida || '' }));
    _renderMultiLista();
  } catch (e) {
    estado.style.display = 'none';
    toast('No se pudo analizar la foto, inténtalo de nuevo', 'err');
    _volverACapturarMulti();
  } finally {
    _multiCapturing = false;
  }
}

function _volverACapturarMulti() {
  const video = document.getElementById('multiVideo');
  const capturarBtn = document.getElementById('multiCapturarBtn');
  video.style.display = 'block';
  capturarBtn.style.display = 'inline-flex';
}

function _renderMultiLista() {
  const listaWrap = document.getElementById('multiListaWrap');
  const body = document.getElementById('multiListaBody');
  const crearBtn = document.getElementById('multiCrearBtn');
  const capturarBtn = document.getElementById('multiCapturarBtn');

  const catNames = typeof CATS !== 'undefined' ? Object.keys(CATS) : [];
  const catOptions = ['<option value="">Sin categoría</option>']
    .concat(catNames.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`))
    .join('');

  body.innerHTML = _multiObjetos.map(o => `
    <tr data-row-id="${o._rowId}">
      <td style="padding:4px"><input type="text" class="fi-w" value="${escHtml(o.nombre)}" oninput="_multiActualizarFila(${o._rowId},'nombre',this.value)" style="width:100%"></td>
      <td style="padding:4px"><input type="number" class="fi-w" min="1" value="${Number(o.cantidad) || 1}" oninput="_multiActualizarFila(${o._rowId},'cantidad',this.value)" style="width:100%"></td>
      <td style="padding:4px"><select class="fi-w" onchange="_multiActualizarFila(${o._rowId},'categoriaSugerida',this.value)" style="width:100%">${catOptions.replace(`value="${o.categoriaSugerida}"`, `value="${o.categoriaSugerida}" selected`)}</select></td>
      <td style="padding:4px;text-align:center"><button class="btn-icon-only" onclick="_multiEliminarFila(${o._rowId})" title="Eliminar fila" style="cursor:pointer;border:none;background:none;font-size:16px">🗑️</button></td>
    </tr>`).join('');

  listaWrap.style.display = 'block';
  capturarBtn.style.display = 'none';
  crearBtn.style.display = _multiObjetos.length ? 'inline-flex' : 'none';
  crearBtn.textContent = `Crear ${_multiObjetos.length} ítem${_multiObjetos.length !== 1 ? 's' : ''}`;
}

function _multiActualizarFila(rowId, campo, valor) {
  const row = _multiObjetos.find(o => o._rowId === rowId);
  if (!row) return;
  row[campo] = campo === 'cantidad' ? (parseInt(valor, 10) || 1) : valor;
}

function _multiEliminarFila(rowId) {
  _multiObjetos = _multiObjetos.filter(o => o._rowId !== rowId);
  _renderMultiLista();
}

async function confirmarCrearMulti() {
  if (!_multiObjetos.length) return;
  if (typeof can === 'function' && !can('import.write')) {
    toast('No tienes permiso para crear varios ítems a la vez', 'err');
    return;
  }
  const ok = await confirmDialog({
    title: 'Crear ítems',
    message: `Se crearán ${_multiObjetos.length} ítem${_multiObjetos.length !== 1 ? 's' : ''} nuevo${_multiObjetos.length !== 1 ? 's' : ''} en esta aula. ¿Continuar?`,
    confirmText: 'Crear'
  }).catch(() => false);
  if (!ok) return;

  const payload = _multiObjetos.map(o => ({
    ref: '', aula: _multiAulaId, mod: '', item: o.nombre, qty: o.cantidad, min: 1,
    cat: o.categoriaSugerida || '', loc: '', est: 'Operativo', util: '', proveedor: '', tags: '',
    fecha: new Date().toISOString().slice(0, 10), fecha_adquisicion: '', precio: null,
    mant: '', mantFecha: '', mantNota: '', mantResp: '', mantEstado: '', mantSolicitante: '', mantSolicitanteEmail: '',
    foto: '', obs: '', code: '', serie: '', es_contenedor: 0, parent_id: null, tipo_material: 'inventariable', oculto: 0
  }));

  try {
    const res = await apiPost({ action: 'bulkImport', items: payload });
    if (!res.ok) throw new Error(res.error || 'Error al crear los ítems');
    if (res.items) items.push(...res.items);
    toast(`${res.imported} ítem${res.imported !== 1 ? 's' : ''} creado${res.imported !== 1 ? 's' : ''}`, 'ok');
    closeMultiEquipo();
    if (typeof renderInv === 'function') renderInv();
  } catch (e) {
    toast('No se pudieron crear los ítems: ' + (e.message || ''), 'err');
  }
}
```

**Design notes:**
- `payload` rows are built as FULL item shapes (every `HEADERS_INV` field present, defaulted sensibly) — required per this plan's Global Constraints, since `bulkImport` reads `it[h] ?? null` for every header and a missing field silently becomes `null` in D1. `tipo_material: 'inventariable'` (not `'consumible'`) because newly-detected physical equipment (oscilloscopes, power supplies, etc.) matches the project's existing convention for durable goods, same default `item.js`'s own `add` action uses when `es_contenedor` is truthy — here it's set explicitly since these are standalone items, not containers.
- `confirmarCrearMulti()` checks `can('import.write')` explicitly before attempting the call, since that's `bulkImport`'s real registered permission (not `items.write`) — per this plan's Global Constraints.
- After success, pushes `res.items` (the created rows, with real D1-assigned `id`s) into the local `items` array and calls `renderInv()` — this is the EXACT pattern the existing CSV import flow already uses (`js/import.js:424-428`: `if(res.items) items.push(...res.items);`), verified against live code rather than assumed. This keeps the teacher in the same aula view with the new items visible immediately, without a full page/data reload (which `loadData()` would cause, including navigating back to Home — the wrong UX for this feature).
- The `<select>`'s "mark the AI-suggested option as selected" trick (`catOptions.replace(...)`) is a simple string substitution — acceptable here because `escHtml()` already sanitized the category name before it was interpolated into `catOptions`, so the `.replace()` target string is deterministic and safe (this is not user-controlled at the replace step, it's matching against option values this same function just generated).

- [ ] **Step 3: Syntax check**

Run: `node --check js/multi-equipo.js`
Expected: no output (syntax valid)

- [ ] **Step 4: Commit**

```bash
git add index.html js/multi-equipo.js
git commit -m "feat: lógica de captura, lista editable y creación masiva de multi-equipo"
```

---

### Task 5: Show/hide the "Añadir varios" button based on the current view

**Files:**
- Modify: `js/nav.js` (inside `openSub()`, right next to the `#btnRevisionAula` visibility line added by idea #5)

**Interfaces:**
- Consumes: `cf.type`, `can()` — same as `#btnRevisionAula`'s existing visibility logic.
- Produces: visibility toggling of `#btnMultiEquipo` (from Task 3).

- [ ] **Step 1: Add visibility logic next to `#btnRevisionAula`'s existing block**

In `js/nav.js`, inside `openSub()`, find this existing block (currently around lines 193-198):

```js
  const noActions = cf.type==='lowstock' || cf.type==='maintenance' || cf.type==='caja';
  document.getElementById('btnN').style.display = noActions ? 'none' : 'flex';
  document.getElementById('btnE').style.display = noActions ? 'none' : 'flex';
  const btnRevision = document.getElementById('btnRevisionAula');
  if (btnRevision) btnRevision.style.display = (cf.type === 'aula' && typeof can === 'function' && can('items.write')) ? 'flex' : 'none';
  _hideHomeButtons();
```

Add a new line for the multi-equipo button, right after the `btnRevision` line:

```js
  const noActions = cf.type==='lowstock' || cf.type==='maintenance' || cf.type==='caja';
  document.getElementById('btnN').style.display = noActions ? 'none' : 'flex';
  document.getElementById('btnE').style.display = noActions ? 'none' : 'flex';
  const btnRevision = document.getElementById('btnRevisionAula');
  if (btnRevision) btnRevision.style.display = (cf.type === 'aula' && typeof can === 'function' && can('items.write')) ? 'flex' : 'none';
  const btnMulti = document.getElementById('btnMultiEquipo');
  if (btnMulti) btnMulti.style.display = (cf.type === 'aula' && typeof can === 'function' && can('items.write')) ? 'flex' : 'none';
  _hideHomeButtons();
```

**Note:** this gates OPENING the modal on `items.write` (same as `#btnRevisionAula`, since taking a photo and reviewing the proposed list doesn't itself write anything) — the actual creation step inside the modal (Task 4's `confirmarCrearMulti()`) separately checks `import.write` before calling `bulkImport`, since that's the permission that actually governs the write. A user could have `items.write` without `import.write` and see the button, open the modal, review AI suggestions, but get a clear error only when trying to confirm creation — this is intentional per this plan's Global Constraints, not a gap to close in this task.

- [ ] **Step 2: Syntax check**

Run: `node --check js/nav.js`
Expected: no output (syntax valid)

- [ ] **Step 3: Commit**

```bash
git add js/nav.js
git commit -m "feat: muestra el botón de alta masiva solo en vista de aula"
```

---

### Task 6: Bump service worker version and end-to-end verification

**Files:**
- Modify: `sw.js` (VERSION constant)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new — deployment/cache-busting step only

- [ ] **Step 1: Bump VERSION in sw.js**

Read `sw.js`, find the current `VERSION` constant, increment it by 1, matching the existing format exactly (confirm the actual current value first — it may have moved since this plan was written, e.g. past `v546`).

- [ ] **Step 2: Commit the version bump**

```bash
git add sw.js
git commit -m "chore: bump version tras alta masiva multi-equipo desde foto"
```

- [ ] **Step 3: Push and wait for Cloudflare Pages deploy**

```bash
git push origin main
```

Wait for Cloudflare Pages auto-deploy to complete before verification (fetch `sw.js`'s deployed `VERSION` value directly, same method used in prior sessions for ideas #1-#5 — remember this project's corporate network requires `NODE_TLS_REJECT_UNAUTHORIZED=0` / `curl -k` for outbound HTTPS, per `CLAUDE.md`).

- [ ] **Step 4: End-to-end verification in production with Playwright**

Using the `playwright-skill`, log in to `boscoinventario.pages.dev` with a test account (e.g. `Seba`/`Seba`), open an aula view, and verify:

1. **Button visibility:** "📸 Añadir varios" is visible in the aula view's action strip, alongside "📷 Revisar aula"; navigate to a category view (`goCat()`) and confirm BOTH buttons are hidden there — this specifically re-tests the `data-perm`/`applyRoleUI()` interaction bug that was found and fixed during idea #5's verification, since this is a second button using the exact same visibility pattern and could reintroduce the same class of bug if `data-perm` was accidentally added back.
2. **Editable list renders:** click the button, open the camera modal, intercept the `detectarMultiples` network call and mock a response with `objetos: [{nombre:'Fuente de alimentación QA', cantidad:4, categoriaSugerida:'<a real category name from this department>'}, {nombre:'Multímetro QA', cantidad:2, categoriaSugerida:''}]` — confirm both rows render with correct name/quantity/category values, and the "Crear N ítems" button shows "Crear 2 ítems".
3. **Edit and delete a row:** change one row's name/quantity via the rendered inputs, delete the other row, confirm the remaining state (1 row, edited values, button now says "Crear 1 ítem").
4. **Confirm creates real D1 rows:** click "Crear ítems", confirm the dialog, verify (via `wrangler d1 execute`) that exactly 1 new row was created in `inventario` with the edited name/quantity/category and the correct `aula` — matching the classroom that was open when the button was clicked.
5. **Zero rows blocks creation:** delete all rows before confirming — verify the "Crear ítems" button becomes hidden/disabled and no `bulkImport` call fires (check via network tab or route interception that the request never happens).
6. **No detection:** mock a response with `objetos: []` — confirm the error toast appears and the camera view returns (ready for another photo) rather than showing an empty table.

Report actual observed behavior for each case — do not assume success without observing the response in the browser (per `superpowers:verification-before-completion`).

- [ ] **Step 5: Fix any issues found during verification**

If any case fails, use `superpowers:systematic-debugging` to diagnose before patching — check Cloudflare Pages function logs (`wrangler pages deployment tail`) for the actual `aiData` response shape if the AI's JSON doesn't parse as expected, following the same debugging trail already documented in `CLAUDE.md` for `buscarPorSerie` (reading `aiData.result.answer`, not `aiData.answer`).

## Self-Review Notes

- **Spec coverage:** all sections of `docs/superpowers/specs/2026-08-01-multi-equipo-foto-design.md` are covered — new backend action separate from `buscarPorSerie` (Task 1), category validation against real department categories (Task 1), permission registration (Task 2), aula chosen before photo via existing `cf` state (Task 4's `openMultiEquipo` guard), editable list without automatic duplicate search (Task 4), shared aula / per-row category (Task 4's payload construction), reuse of `bulkImport` unmodified (Task 4), button visibility only in aula view (Task 5).
- **No placeholders:** all code blocks are complete and copy-pasteable. The post-creation refresh logic (Task 4) was verified against the live CSV import flow (`js/import.js:424-428`) rather than assumed, and uses the exact same `items.push(...res.items)` pattern already proven in production — not a guess. Task 1 Step 1's "confirm insertion point" instruction is a legitimate "confirm against current state" step, not a deferred design decision, since line numbers may have shifted from concurrent work on the same file.
- **Type/name consistency:** `_multiAulaId`, `_multiObjetos`, `_rowId` are used consistently across `openMultiEquipo`, `capturarMulti`, `_renderMultiLista`, `_multiActualizarFila`, `_multiEliminarFila`, `confirmarCrearMulti`. `#btnMultiEquipo`, `#mMultiEquipo`, `#multiVideo`, `#multiEstado`, `#multiListaWrap`, `#multiListaBody`, `#multiCapturarBtn`, `#multiCrearBtn` match exactly between their HTML definition (Task 3) and their JS references (Task 4, Task 5). `detectarMultiples` action name matches exactly across the backend handler (Task 1), `ENDPOINT_MAP`/`ACTION_PERMISSIONS` (Task 2), and the frontend's `apiPost()` call (Task 4).
- **Known-bug avoidance verified explicit in the plan:** the `data-perm` visibility bug from idea #5 is called out in Global Constraints, in Task 3 Step 1's instruction, AND in Task 6's verification case 1 — three independent points where the plan actively steers away from reintroducing it, rather than assuming a single mention is enough given how easy the mistake is to make (it's the "obviously right" pattern every other button in `.action-strip` uses).
