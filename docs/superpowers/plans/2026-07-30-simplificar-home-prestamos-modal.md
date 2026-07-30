# Simplificar Home, Préstamos y Modal Nuevo ítem — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce visual/scroll clutter in Home, Préstamos and the "Nuevo ítem" modal without removing any existing feature, following the approved spec at `docs/superpowers/specs/2026-07-30-simplificar-home-prestamos-modal-design.md`.

**Architecture:** Pure frontend, vanilla JS/HTML/CSS (no framework, no bundler). Each task edits `index.html` markup, the relevant `js/*.js` render function, and `css/styles.css`. No backend, no D1 migration, no new dependency — native `<details>`/`<summary>` for collapsible sections, `localStorage` for persisted UI state (mirrors the existing `inv_page_size` pattern in `js/inventory.js:506-507,1158`).

**Tech Stack:** Vanilla JS (ES6, no modules/bundler — scripts loaded via `<script>` tags in `index.html`), plain CSS, `localStorage` for client-side persistence.

## Global Constraints

- No new libraries/dependencies — use native `<details>`/`<summary>` only.
- No backend/D1 changes — this is presentation-layer only.
- Every `localStorage` key follows the existing naming style (snake_case, prefixed by feature: `home_sec_cats`, `home_sec_ciclos`, `pres_group_by`) — same style as `inv_page_size`.
- Bump `VERSION` in `sw.js` (vXXX → vXXX+1) as the final step, per `CLAUDE.md` workflow — do this once, after all 3 tasks are done, not per-task.
- No automated test suite exists in this project — verification is manual: start a local server and check behavior in a browser (or Playwright) per task's Verification section. Do not invent a test framework.
- Commit each task separately with `git add` of the specific files touched (never `git add -A`).

---

### Task 1: Home — collapsible "Por categoría" / "Por ciclo/departamento" sections

**Files:**
- Modify: `index.html:293-309` (Home `.sec-label` + `.choice-grid` blocks for aulas/cats/ciclos)
- Modify: `js/home.js:1-61` (`renderHome()`)
- Modify: `css/styles.css` (add rules near `.sec-label`/`.choice-grid`, around line 354-360)

**Interfaces:**
- Consumes: existing globals `AULAS`, `sortedCatEntries()`, `CICLOS`, `items` (all already used by `renderHome()` in `js/home.js`).
- Produces: `homeSectionOpenState(key, count)` — a helper function other code does not need to call (only `renderHome()` uses it), but keep it as a small named function (not inlined) so Task self-review can verify its logic in isolation.

- [ ] **Step 1: Wrap "Por categoría" and "Por ciclo/departamento" in `<details>` in index.html**

Replace lines 299-309 of `index.html`:

```html
    <div style="height:20px"></div>
    <div class="sec-label">
      Por categoría
      <button class="mini-btn" data-perm="categories.manage" onclick="openCatsModal()">⚙️ Gestionar categorías</button>
    </div>
    <div class="choice-grid" id="gCats"></div>
    <div style="height:20px"></div>
    <div class="sec-label">
      Por ciclo/departamento
      <button class="mini-btn" data-perm="config.manage" onclick="openCiclosModal()">⚙️ Gestionar ciclos</button>
    </div>
    <div class="choice-grid" id="gCiclos"></div>
```

with:

```html
    <div style="height:20px"></div>
    <details class="home-sec" id="homeSecCats">
      <summary class="sec-label">
        Por categoría
        <span class="sec-label-arrow">▾</span>
        <button class="mini-btn" data-perm="categories.manage" onclick="event.preventDefault();event.stopPropagation();openCatsModal()">⚙️ Gestionar categorías</button>
      </summary>
      <div class="choice-grid" id="gCats"></div>
    </details>
    <div style="height:20px"></div>
    <details class="home-sec" id="homeSecCiclos">
      <summary class="sec-label">
        Por ciclo/departamento
        <span class="sec-label-arrow">▾</span>
        <button class="mini-btn" data-perm="config.manage" onclick="event.preventDefault();event.stopPropagation();openCiclosModal()">⚙️ Gestionar ciclos</button>
      </summary>
      <div class="choice-grid" id="gCiclos"></div>
    </details>
```

Note: `event.preventDefault();event.stopPropagation();` is required on the "Gestionar..." buttons inside `<summary>` — without it, clicking the button also toggles the `<details>` open/close state (native browser behavior: any click inside `<summary>` toggles it unless propagation/default is stopped).

The "Por aula / espacio" block (lines 293-297) is NOT changed — stays a plain `<div>`, always expanded.

- [ ] **Step 2: Add CSS for `.home-sec` and `.sec-label-arrow`**

In `css/styles.css`, immediately after the existing `.choice-grid{...}` rule (line 360), add:

```css
.home-sec{margin-top:0}
.home-sec>summary{cursor:pointer;list-style:none}
.home-sec>summary::-webkit-details-marker{display:none}
.sec-label-arrow{display:inline-block;font-size:10px;transition:transform .2s;margin-left:-4px}
.home-sec[open]>summary .sec-label-arrow{transform:rotate(180deg)}
```

- [ ] **Step 3: Add `homeSectionOpenState()` helper and wire it into `renderHome()` in `js/home.js`**

At the top of `js/home.js` (before `renderHome()`), add:

```js
function homeSectionOpenState(key, count){
  const stored = localStorage.getItem('home_sec_'+key);
  if(stored !== null) return stored === '1';
  return count <= 8;
}
```

In `renderHome()`, after the `gCats` block is rendered (after the line ending `.join('')` for `document.getElementById('gCats').innerHTML=...` around line 50) and after the `gCiclos` block is rendered (end of function, around line 59), add the open-state wiring. Replace the end of `renderHome()` (from the `document.getElementById('gCiclos').innerHTML=CICLOS.map...` block to the closing `}`) so the full tail of the function reads:

```js
  document.getElementById('gCiclos').innerHTML=CICLOS.map(c=>{
    const n=items.filter(x=>x.mod && x.mod.startsWith(c.id+'__')).length;
    return`<div class="ccard ${c.th}" onclick="openCiclo('${c.id}')">
      ${loading ? `<span class="ccard-count skel skel-count"></span>` : `<span class="ccard-count">${n} ítems</span>`}
      <div class="ccard-icon">${c.icon}</div>
      <div class="ccard-title">${c.name}</div>
      <div class="ccard-desc">${c.desc}</div>
    </div>`;
  }).join('');

  const secCats = document.getElementById('homeSecCats');
  if(secCats) secCats.open = homeSectionOpenState('cats', catEntries.length);
  const secCiclos = document.getElementById('homeSecCiclos');
  if(secCiclos) secCiclos.open = homeSectionOpenState('ciclos', CICLOS.length);
}

function homeSectionOpenState(key, count){
  const stored = localStorage.getItem('home_sec_'+key);
  if(stored !== null) return stored === '1';
  return count <= 8;
}

function onHomeSecToggle(el, key){
  localStorage.setItem('home_sec_'+key, el.open ? '1' : '0');
}
```

(Move the `homeSectionOpenState` definition to wherever fits — either before or after `renderHome()`, both are valid in a plain-script, non-module file since function declarations are hoisted.)

- [ ] **Step 4: Wire the `toggle` event so manual open/close is persisted**

In `index.html`, add `ontoggle="onHomeSecToggle(this,'cats')"` and `ontoggle="onHomeSecToggle(this,'ciclos')"` to the two `<details>` tags from Step 1:

```html
    <details class="home-sec" id="homeSecCats" ontoggle="onHomeSecToggle(this,'cats')">
```
```html
    <details class="home-sec" id="homeSecCiclos" ontoggle="onHomeSecToggle(this,'ciclos')">
```

Note: the native `toggle` event fires on every open/close, including the ones triggered programmatically by Step 3's `secCats.open = ...` line. This means `onHomeSecToggle` re-writes the same value back to `localStorage` on every `renderHome()` call — harmless (idempotent), but be aware it's not "only fires on user click".

- [ ] **Step 5: Manual verification**

Serve the app locally (any static server, e.g. `npx serve .` or open `index.html` via the existing dev workflow) and in a browser:
1. Log in as a department with ≤8 categories and ≤8 ciclos — confirm both sections render **open** by default.
2. Log in as a department with >8 categories or ciclos (or temporarily lower the `<= 8` threshold to `<= 0` to force the closed state, then revert) — confirm the section renders **closed** by default, with the ▾ arrow pointing up (rotated).
3. Click a `<summary>` to manually toggle a section closed. Reload the page. Confirm the section stays closed (localStorage override wins over the count rule).
4. Click "⚙️ Gestionar categorías" / "⚙️ Gestionar ciclos" inside a `<summary>` — confirm it opens the management modal and does NOT also toggle the details open/closed state.
5. Confirm "Por aula / espacio" is unaffected — always visible, no arrow, no collapse behavior.

- [ ] **Step 6: Commit**

```bash
git add index.html js/home.js css/styles.css
git commit -m "feat(v495): colapsar secciones categoría/ciclo en Home si tienen >8 tarjetas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Préstamos — collapse 6 tabs into 2 tabs + vencidos toggle + agrupar-por select

**Files:**
- Modify: `index.html:359-383` (`#pPres` page markup)
- Modify: `js/prestamos.js:44-226` (`goPrestamos`, `setPresTab`, `renderPrestamos`, plus new small helpers)
- Modify: `js/state.js:16` (`currentPresTab` init — add `currentPresGroupBy`)
- Modify: `css/styles.css` (minor — reuse `.pres-tabs`/`.pres-tab`, add a select style if needed near line 204-206)

**Interfaces:**
- Consumes: `getPrestamosActivos()`, `isVencido()`, `getVencidos()`, `_renderGrouped(groupKey)`, `_presCardHtml(p)` — all already defined in `js/prestamos.js`, unchanged.
- Produces: `currentPresGroupBy` (global, values: `''` | `'profesor'` | `'aula'` | `'material'`), `setPresGroupBy(val)`, `togglePresVencidos()`, `currentPresOnlyVencidos` (boolean global).

- [ ] **Step 1: Replace the tabs + toolbar markup in `index.html`**

Replace lines 367-380 of `index.html`:

```html
    <div class="pres-tabs">
      <button class="pres-tab active" id="ptActivos" onclick="setPresTab('activos')">🟡 Activos</button>
      <button class="pres-tab" id="ptVencidos" onclick="setPresTab('vencidos')">🔴 Vencidos</button>
      <button class="pres-tab" id="ptDevueltos" onclick="setPresTab('devueltos')">✅ Historial</button>
      <button class="pres-tab" id="ptProfesor" onclick="setPresTab('profesor')">👤 Por profesor/a</button>
      <button class="pres-tab" id="ptAula" onclick="setPresTab('aula')">🏫 Por aula</button>
      <button class="pres-tab" id="ptMaterial" onclick="setPresTab('material')">📦 Por material</button>
    </div>
    <div class="toolbar">
      <div class="sbox"><span class="si">🔍</span><input type="text" id="presSearch" placeholder="Buscar por ítem o profesor..." oninput="renderPrestamos()"></div>
      <button class="btn btn-loan icon-btn" data-perm="loans.write" onclick="openPrestar()">⌛ <span class="btn-text">Nuevo préstamo</span></button>
      <button class="btn icon-btn" data-perm="profesores.manage" onclick="openProfModal()">👥 <span class="btn-text">Gestionar profesores</span></button>
      <button class="btn icon-btn" data-perm="config.manage" onclick="openUsuariosModal()">🔐 <span class="btn-text">Gestionar usuarios</span></button>
    </div>
```

with:

```html
    <div class="pres-tabs">
      <button class="pres-tab active" id="ptActivos" onclick="setPresTab('activos')">🟡 Activos</button>
      <button class="pres-tab" id="ptHistorial" onclick="setPresTab('historial')">✅ Historial</button>
      <label class="pres-venc-toggle" id="presVencToggleWrap">
        <input type="checkbox" id="presVencToggle" onchange="togglePresVencidos()">
        🔴 Solo vencidos
      </label>
    </div>
    <div class="toolbar">
      <div class="sbox"><span class="si">🔍</span><input type="text" id="presSearch" placeholder="Buscar por ítem o profesor..." oninput="renderPrestamos()"></div>
      <label class="pres-group-select">
        <span>Agrupar por</span>
        <select id="presGroupBy" onchange="setPresGroupBy(this.value)">
          <option value="">Sin agrupar</option>
          <option value="profesor">Profesor/a</option>
          <option value="aula">Aula</option>
          <option value="material">Material</option>
        </select>
      </label>
      <button class="btn btn-loan icon-btn" data-perm="loans.write" onclick="openPrestar()">⌛ <span class="btn-text">Nuevo préstamo</span></button>
      <button class="btn icon-btn" data-perm="profesores.manage" onclick="openProfModal()">👥 <span class="btn-text">Gestionar profesores</span></button>
      <button class="btn icon-btn" data-perm="config.manage" onclick="openUsuariosModal()">🔐 <span class="btn-text">Gestionar usuarios</span></button>
    </div>
```

- [ ] **Step 2: Add CSS for the new vencidos toggle and group-by select**

In `css/styles.css`, right after the `.pres-tab.active{...}` rule (line 206), add:

```css
.pres-venc-toggle{display:flex;align-items:center;gap:6px;padding:7px 12px;font-size:13px;font-weight:600;color:var(--red);cursor:pointer;margin-left:4px}
.pres-venc-toggle input{margin:0;cursor:pointer}
.pres-group-select{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);font-weight:600}
.pres-group-select select{font-family:var(--font);font-size:13px;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--white);cursor:pointer}
```

- [ ] **Step 3: Add `currentPresGroupBy` and `currentPresOnlyVencidos` globals in `js/state.js`**

In `js/state.js`, right after line 16 (`let currentPresTab = 'activos';`), add:

```js
let currentPresGroupBy = localStorage.getItem('pres_group_by') || '';
let currentPresOnlyVencidos = false;
```

- [ ] **Step 4: Rewrite `goPrestamos()` in `js/prestamos.js`**

Replace the whole `goPrestamos(tab)` function (lines 44-77 of `js/prestamos.js`):

```js
function goPrestamos(tab){
  _push({page:'prestamos'}, '#prestamos');
  cf=null; currentCiclo=null;
  if(tab) currentPresTab = tab;
  document.getElementById('btnN').style.display='none';
  document.getElementById('btnE').style.display='none';
  _hideHomeButtons();
  if(typeof applyRoleUI === 'function') applyRoleUI();
  document.getElementById('bc').innerHTML=`<span class="bc-link" onclick="goHome()">Inicio</span><span class="sep">›</span><strong>📋 Préstamos</strong>`;

  // Stats
  const activos = getPrestamosActivos().length;
  const vencidos = getVencidos().length;
  const devueltos = prestamos.filter(p=>p.estado==='Devuelto').length;
  document.getElementById('presStats').innerHTML=`
    <div class="scard"><div class="scard-icon">🟡</div><div><div class="scard-num">${activos}</div><div class="scard-lbl">activos</div></div></div>
    <div class="scard"><div class="scard-icon">🔴</div><div><div class="scard-num" style="color:var(--red)">${vencidos}</div><div class="scard-lbl">vencidos</div></div></div>
    <div class="scard"><div class="scard-icon">✅</div><div><div class="scard-num">${devueltos}</div><div class="scard-lbl">devueltos (histórico)</div></div></div>
    <div class="scard"><div class="scard-icon">👥</div><div><div class="scard-num">${profesores.length}</div><div class="scard-lbl">profesores/as</div></div></div>
  `;
  document.getElementById('presMeta').textContent = `${prestamos.length} préstamo${prestamos.length!==1?'s':''} registrado${prestamos.length!==1?'s':''} en total`;

  // Tabs
  ['activos','historial'].forEach(t=>{
    document.getElementById('pt'+t.charAt(0).toUpperCase()+t.slice(1)).classList.toggle('active', currentPresTab===t);
  });

  // El toggle "solo vencidos" y el select de agrupar solo tienen sentido en la tab Activos
  const vencWrap = document.getElementById('presVencToggleWrap');
  if(vencWrap) vencWrap.style.display = currentPresTab==='activos' ? '' : 'none';
  const vencCheckbox = document.getElementById('presVencToggle');
  if(vencCheckbox) vencCheckbox.checked = currentPresOnlyVencidos;

  const groupSelect = document.getElementById('presGroupBy');
  if(groupSelect) groupSelect.value = currentPresGroupBy;
  const groupWrap = groupSelect ? groupSelect.closest('.pres-group-select') : null;
  if(groupWrap) groupWrap.style.display = currentPresTab==='activos' ? '' : 'none';

  // El buscador solo tiene sentido en las vistas de lista, ocultarlo en las vistas agrupadas
  const isGrouped = currentPresTab==='activos' && !!currentPresGroupBy;
  document.querySelector('#pPres .sbox').style.display = isGrouped ? 'none' : '';

  show('pPres');
  renderPrestamos();
}

function setPresTab(tab){
  currentPresTab = tab;
  goPrestamos(tab);
}

function togglePresVencidos(){
  currentPresOnlyVencidos = document.getElementById('presVencToggle').checked;
  renderPrestamos();
}

function setPresGroupBy(val){
  currentPresGroupBy = val;
  localStorage.setItem('pres_group_by', val);
  const isGrouped = currentPresTab==='activos' && !!val;
  document.querySelector('#pPres .sbox').style.display = isGrouped ? 'none' : '';
  renderPrestamos();
}
```

- [ ] **Step 5: Rewrite `renderPrestamos()` to use the new tab/filter/group model**

Replace the `renderPrestamos()` function (lines 193-226 of `js/prestamos.js`):

```js
function renderPrestamos(){
  updatePresVencBadge();
  if(currentPresTab==='activos' && currentPresGroupBy){
    _renderGrouped(currentPresGroupBy);
    return;
  }

  const q = document.getElementById('presSearch').value.toLowerCase();
  let data;
  if(currentPresTab==='activos'){
    data = currentPresOnlyVencidos ? getVencidos() : getPrestamosActivos();
  } else {
    data = prestamos.filter(p=>p.estado==='Devuelto');
  }

  if(q){
    data = data.filter(p=>[p.itemNombre,p.profesorNombre,p.obs].join(' ').toLowerCase().includes(q));
  }

  data.sort((a,b)=>{
    if(currentPresTab==='historial') return new Date(b.fechaDevolucion||b.fechaPrestamo) - new Date(a.fechaDevolucion||a.fechaPrestamo);
    return new Date(a.fechaPrevista||a.fechaPrestamo) - new Date(b.fechaPrevista||b.fechaPrestamo);
  });

  const mc = document.getElementById('presContent');
  if(!data.length){
    const msg = currentPresTab==='historial' ? 'No hay préstamos en el histórico'
      : currentPresOnlyVencidos ? '¡Sin préstamos vencidos! 🎉'
      : 'No hay préstamos activos';
    mc.innerHTML=`<div class="empty"><div class="ei">📋</div><div class="et">${msg}</div></div>`;
    return;
  }

  mc.innerHTML = data.map(_presCardHtml).join('');
}
```

Note: `_presCardHtml(p)` already renders a `pres-pill` with `${p.estado}${venc&&p.estado!=='Devuelto'?' (vencido)':''}` (line 99 of the original file) — this already visually flags vencido items within the plain "Activos" list, so no card-level change is needed there.

- [ ] **Step 6: Manual verification**

1. Open Préstamos. Confirm only 2 tabs show: "🟡 Activos" (active by default) and "✅ Historial", plus a "🔴 Solo vencidos" checkbox next to them.
2. With a department that has overdue loans: check "Solo vencidos" — confirm the list filters to only vencidos, and the empty-state message changes appropriately when unchecked again.
3. Change "Agrupar por" to "Profesor/a" — confirm the search box hides and the grouped view (existing `_renderGrouped` UI) renders. Switch to "Aula", then "Material" — confirm each renders correctly. Switch back to "Sin agrupar" — confirm the search box reappears and the flat list renders again.
4. Reload the page and navigate back to Préstamos — confirm "Agrupar por" still shows the last-selected value (localStorage persistence). Note "Solo vencidos" is intentionally NOT persisted (session-only, matches spec: only grouping is persisted).
5. Click "Historial" tab — confirm it shows all `Devuelto` loans (equivalent to the old "devueltos" tab), and confirm the vencidos-toggle and agrupar-por select both hide (irrelevant on Historial).
6. Confirm `#presVencBadge` (topbar bell/badge count) still works — unaffected, uses `updatePresVencBadge()` which is unchanged.

- [ ] **Step 7: Commit**

```bash
git add index.html js/prestamos.js js/state.js css/styles.css
git commit -m "feat(v495): reducir tabs de Préstamos de 6 a 2 + toggle vencidos + selector de agrupación

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Modal "Nuevo ítem" — collapse "Detalles" and "Documentación" sections

**Files:**
- Modify: `index.html:579-586` (DETALLES section) and `index.html:616-693` (DOCUMENTACIÓN section)
- Modify: `js/modal-item.js` (`openModal()` around line 754-819) — add auto-open-if-has-data logic
- Modify: `js/docs.js:64-80` (`renderDocList()`) — auto-open Documentación once async-loaded docs arrive
- Modify: `css/styles.css` (grid-column fix for `<details>` wrapper inside `#mItem .fg`, near line 880-896)

**Interfaces:**
- Consumes: `m` (existing item object) and `existing` (boolean), both already local variables inside `openModal()`; `docsActuales` (existing module-level array in `js/docs.js`).
- Produces: `modalSectionShouldOpen(m, fields)` — small pure helper, takes the item object and an array of field names, returns boolean (true if any field has a non-empty value).

- [ ] **Step 1: Wrap "🔧 DETALLES" in `<details>` in `index.html`**

Replace lines 579-585 of `index.html`:

```html
      <!-- 🔧 DETALLES -->
      <div class="m-section">
        <div class="m-section-title">🔧 DETALLES</div>
        <div><label class="fl">Utilidad</label><input class="fi-w" id="f_util" placeholder="Para qué se usa"></div>
        <div><label class="fl">Proveedor</label><input class="fi-w" id="f_proveedor" placeholder="Proveedor, tienda o URL"></div>
        <div><label class="fl">Última revisión</label><input class="fi-w" id="f_fecha" type="date"></div>
      </div>
```

with:

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

- [ ] **Step 2: Wrap "📎 DOCUMENTACIÓN" in `<details>` in `index.html`**

The Documentación section spans the `<div class="m-section">` starting at line 617 through the closing `</div>` at line 693 (containing Observaciones, Contenedor/Caja, QR box, and Adjuntos). Replace lines 617-693:

```html
      <!-- 📎 DOCUMENTACIÓN -->
      <div class="m-section">
        <div class="m-section-title">📎 DOCUMENTACIÓN</div>
        <div class="full"><label class="fl">Observaciones</label><textarea class="fi-w" id="f_obs" placeholder="Notas, proveedor, nº serie..."></textarea></div>
        <div class="full">
          <label class="fl">Contenedor / Caja</label>
          ...
        </div>
        <div class="full" id="itemQrBox" style="display:none">
          ...
        </div>
      <div class="full">
        ...
        <div class="doc-list" id="f_doc_list"></div>
      </div>
    </div>
```

with (same inner content, only the outer wrapper changes from `<div class="m-section">` to `<details class="m-section-details">`, and note the two mismatched inner closing tags in the original markup are preserved as-is since that's pre-existing structure not touched by this task):

```html
      <!-- 📎 DOCUMENTACIÓN -->
      <details class="m-section-details" id="mSecDocumentacion">
        <summary class="m-section-title">📎 DOCUMENTACIÓN <span class="sec-label-arrow">▾</span></summary>
        <div class="m-section-details-body">
        <div class="full"><label class="fl">Observaciones</label><textarea class="fi-w" id="f_obs" placeholder="Notas, proveedor, nº serie..."></textarea></div>
        <div class="full">
          <label class="fl">Contenedor / Caja</label>
          ...
        </div>
        <div class="full" id="itemQrBox" style="display:none">
          ...
        </div>
      <div class="full">
        ...
        <div class="doc-list" id="f_doc_list"></div>
      </div>
        </div>
      </details>
```

Implementer note: don't retype the "..." content — use the Edit tool with `old_string`/`new_string` targeting only the opening `<div class="m-section">` → `<details class="m-section-details" id="mSecDocumentacion"><summary class="m-section-title">📎 DOCUMENTACIÓN <span class="sec-label-arrow">▾</span></summary><div class="m-section-details-body">` line, and the final closing `</div>` of that section → `</div></details>`, leaving everything in between byte-for-byte untouched. Read the exact current file around those lines first since line numbers may have shifted after Step 1's edit.

- [ ] **Step 3: Add CSS for `.m-section-details`**

In `css/styles.css`, right after the `#mItem .m-section:has(#f_foto_preview){grid-template-columns:1fr}` rule (line 895), add:

```css
#mItem .m-section-details{grid-column:1/-1;border-bottom:1px solid var(--border);padding-bottom:18px}
#mItem .m-section-details:last-of-type{border-bottom:none}
#mItem .m-section-details>summary{cursor:pointer;list-style:none;margin-bottom:0}
#mItem .m-section-details>summary::-webkit-details-marker{display:none}
#mItem .m-section-details[open]>summary{margin-bottom:8px}
#mItem .m-section-details .sec-label-arrow{transition:transform .2s;display:inline-block}
#mItem .m-section-details[open] .sec-label-arrow{transform:rotate(180deg)}
#mItem .m-section-details-body{display:grid;grid-template-columns:1fr 1fr 0.5fr;gap:12px}
#mItem .m-section-details-body .full{grid-column:1/-1}
```

Note: the Documentación section's inner rows are all `class="full"` (single column), so the 3-column template on `.m-section-details-body` collapses harmlessly to full-width for those — matches current visual behavior. The Detalles section genuinely uses the 3-column layout (Utilidad/Proveedor/Fecha side by side), which this preserves (mirrors the old `#mItem .m-section:has(#f_util){grid-template-columns:1fr 1fr 0.5fr}` rule).

- [ ] **Step 4: Add `modalSectionShouldOpen()` helper in `js/modal-item.js`**

Near the top of `js/modal-item.js` (after the header comment, before other functions), add:

```js
function modalSectionShouldOpen(m, fields){
  if(!m) return false;
  return fields.some(f => {
    const v = m[f];
    return v !== undefined && v !== null && v !== '' && v !== 0 && v !== '0';
  });
}
```

- [ ] **Step 5: Wire auto-open into `openModal()`, with a separate hook for async-loaded docs**

Attached documents are NOT part of the item object `m` — they're loaded asynchronously after the modal opens, via `initDocSection(id)` (called at `js/modal-item.js:805`) → `loadItemDocs(itemId)` in `js/docs.js:22-31`, which fetches `res.docs` from the backend and stores them in the module-level `docsActuales` array (`js/docs.js:26`), then calls `renderDocList()` (`js/docs.js:64-80`) to paint them into `#f_doc_list`. This means the Documentación section's "has docs" check cannot run synchronously inside `openModal()` — it must react once the async load finishes.

In `js/modal-item.js`, inside `openModal()`, right after the line `document.getElementById('f_es_contenedor').checked = esContenedor;` (currently line 800) and before the `toggleMaintFields();`/`toggleContenedorFields();` calls, add:

```js
  const secDetalles = document.getElementById('mSecDetalles');
  if(secDetalles) secDetalles.open = existing && modalSectionShouldOpen(m, ['util','proveedor','fecha']);
  const secDocs = document.getElementById('mSecDocumentacion');
  if(secDocs) secDocs.open = existing && (modalSectionShouldOpen(m, ['obs']) || esContenedor);
```

Place this after `esContenedor` is computed (it's defined a few lines above at `const esContenedor = m?.es_contenedor == 1 || m?.es_contenedor === true;`) and after `m` is available — both conditions are already true at that point in the function. Since `existing` is `false` for both "new item" and "duplicate item" flows (per line 755: `const existing = id !== null && id !== undefined;`), both sections correctly start closed for brand-new items, and open automatically when editing an item that already has Observaciones text or is a contenedor.

This covers Observaciones/contenedor synchronously, but not "has attached docs" (unknown until the async fetch resolves). To also auto-open when docs arrive after the fact, modify `renderDocList()` in `js/docs.js` (lines 64-80). Add this at the very end of the function, right after the existing `el.innerHTML = ex + pe;` line:

```js
  if(docsActuales.length > 0){
    const secDocs = document.getElementById('mSecDocumentacion');
    if(secDocs) secDocs.open = true;
  }
```

This way: if the item has Observaciones or is a contenedor, the section opens immediately when the modal appears (no flicker); if the item's only "reason to open" is having attached docs, the section pops open a moment later once the fetch resolves — acceptable since it only affects items with no other Documentación content, and the fetch is normally fast.

- [ ] **Step 6: Manual verification**

1. Click "＋ Nuevo ítem". Confirm "🔧 DETALLES" and "📎 DOCUMENTACIÓN" both render collapsed (closed), while Identificación/Clasificación/Inventario remain fully visible as before.
2. Click each `<summary>` — confirm it expands/collapses correctly and the arrow rotates.
3. Fill in "Utilidad" and save a new item. Re-open that same item for editing — confirm "🔧 DETALLES" is now open automatically (has data).
4. Create an item with no Utilidad/Proveedor/Fecha filled and no Observaciones/contenedor/docs — save, re-open for editing — confirm both sections start closed (no data).
5. Edit an item that has file attachments (Documentación) or is a contenedor — confirm "📎 DOCUMENTACIÓN" opens automatically.
6. Confirm "🛠️ MANTENIMIENTO" section behavior is completely unchanged (still driven by the `f_mant` checkbox via `toggleMaintFields()`, not touched by this task).
7. Test on mobile viewport (or narrow browser window) — confirm the `<details>` sections still respect the existing `@media(max-width:600px)` grid rules (lines 1301-1307 of `css/styles.css`) — the `.m-section-details-body` should collapse to 1 column like `.m-section` currently does. If it doesn't inherit correctly, add an explicit mobile override next to the existing `#mItem .m-section{grid-template-columns:1fr!important}` rule (around line 1301):

```css
@media(max-width:600px){
  #mItem .m-section-details-body{grid-template-columns:1fr!important}
}
```

- [ ] **Step 7: Commit**

```bash
git add index.html js/modal-item.js js/docs.js css/styles.css
git commit -m "feat(v495): colapsar secciones Detalles y Documentación en modal Nuevo ítem

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Bump service worker version and final smoke test

**Files:**
- Modify: `sw.js` (VERSION constant)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is the release-bump step per `CLAUDE.md` workflow.

- [ ] **Step 1: Find and bump VERSION in `sw.js`**

Read `sw.js`, find the `VERSION` constant (per `CLAUDE.md`, currently expected around v494), increment it by 1 (e.g. `v494` → `v495`).

- [ ] **Step 2: Full smoke test across all 3 changes together**

With a local server running:
1. Home: verify collapsible categoría/ciclo sections work (Task 1 verification steps 1-5).
2. Préstamos: verify 2-tab layout + vencidos toggle + agrupar-por select (Task 2 verification steps 1-6).
3. Modal ítem: verify Detalles/Documentación collapse behavior in both create and edit flows (Task 3 verification steps 1-7).
4. Confirm no console errors appear in the browser devtools console while navigating Home → Préstamos → open/save an item → back to Home.

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "chore: bump VERSION a v495 (colapsables Home/Préstamos/modal ítem)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Push**

```bash
git push origin main
```

(Only after user confirms they want to deploy — per `CLAUDE.md`, push triggers Cloudflare Pages auto-deploy to production. Confirm with the user before this step if not already granted standing permission.)

---

## Self-Review Notes

- **Spec coverage:** All 3 spec sections (Home collapse w/ 8-card threshold + localStorage override, Préstamos 2-tabs + vencidos toggle + agrupar-por select w/ persistence, Modal Detalles/Documentación collapse w/ auto-open-on-data) are each covered by one task. Mantenimiento section explicitly left untouched per spec ("Fuera de alcance" is respected — no `modal-aulas.js`/`modal-ciclos.js`/`modal-cats.js` touched).
- **Placeholder scan:** No TBD/TODO. Task 3 Step 2 contains "..." only as an explicit instruction to the implementer to preserve existing untouched markup verbatim via targeted Edit calls — not a code placeholder to fill in.
- **Type consistency:** `currentPresGroupBy` (string) and `currentPresOnlyVencidos` (boolean) are defined once in `js/state.js` (Task 2 Step 3) and referenced with the same names in `js/prestamos.js` (Task 2 Steps 4-5). `modalSectionShouldOpen(m, fields)` defined once in Task 3 Step 4, called once in Task 3 Step 5 with matching signature. `homeSectionOpenState(key, count)` and `onHomeSecToggle(el, key)` defined once in Task 1 Step 3, called with matching signatures in Steps 3-4.
