# Inventario Andando (Modo Revisión Rápida por Aula) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher walk through a classroom, photograph each piece of equipment one at a time, and get an instant confirmed/wrong-room/unrecognized verdict per photo — without opening the full item-edit modal — ending with a session summary of what was confirmed vs. never seen.

**Architecture:** A new frontend module (`js/revision-aula.js`) mirrors the existing `js/camara-serie.js` camera-capture pattern (same `getUserMedia`/canvas/photo-fija flow) but interprets the response differently: it compares the matched item's `aula` field against the classroom the teacher is currently reviewing, rather than opening item-creation flows. It reuses the already-deployed `buscarPorSerie` backend action unchanged, and the already-deployed `update` action for the one write path (correcting a misfiled item's classroom). No backend changes, no migration.

**Tech Stack:** Cloudflare Pages Functions (JS, unchanged), vanilla JS frontend, no build step, no test framework (verification is manual/Playwright against production, per project convention).

## Global Constraints

- No backend changes, no new D1 migration — `buscarPorSerie` and `update` are reused exactly as they exist today.
- The `update` action requires the FULL item object (all `FIELDS_UPD` columns), not a partial patch — the established pattern across this codebase is `{...existingItemRow, fieldToChange: newValue}` (see `js/inventory.js:789`, `js/modal-item.js:811,1095,1227,1507`). Never send a partial object to `update`.
- Presence confirmation during a review session is ephemeral — nothing is persisted to D1 for a plain "confirmed in the right room" result. Only the "wrong room, corrected" case writes to D1 (via the existing `update` action).
- No new item-creation path — unrecognized objects show a neutral "not identified" message, never an offer to create a new item (that's the general camera flow's job, out of scope here).
- `sw.js` `VERSION` must be bumped as the final step (project workflow in `CLAUDE.md`).
- Verification is manual/Playwright against production — this project has no automated test suite.

---

### Task 1: HTML — review button in aula view + review modal

**Files:**
- Modify: `index.html` — add a button to `.action-strip` (around line 462-467) and a new modal after `#mCamaraSerie` (around line 1552, right after its closing `</div>`)

**Interfaces:**
- Produces: DOM elements `#btnRevisionAula` (button), `#mRevisionAula` (modal), `#revisionVideo`, `#revisionEstado`, `#revisionResultado`, `#revisionCapturarBtn`, `#revisionResumenBtn` — all consumed by Task 2's `js/revision-aula.js`.

- [ ] **Step 1: Add the "Revisar aula" button to the action strip**

In `index.html`, inside `<div class="action-strip">` (the block starting around line 462), add a new button after the existing "＋ Añadir ítem" button:

```html
      <button class="btn btn-p icon-btn print-no" id="btnRevisionAula" data-perm="items.write" style="padding:6px 10px;font-size:12px;display:none" onclick="openRevisionAula()">📷 <span class="btn-text">Revisar aula</span></button>
```

Place it as the second button in the strip (right after "＋ Añadir ítem", before "⌛ Nuevo préstamo"). It starts with `display:none` — Task 4 will show it only when the current view is an aula.

- [ ] **Step 2: Add the review modal**

In `index.html`, right after the closing `</div>` of `#mCamaraSerie` (the block ending around line 1553 with `</div>\n</div>`), add this new modal:

```html
<!-- ══ MODO REVISIÓN RÁPIDA POR AULA (INVENTARIO ANDANDO) ══ -->
<div class="mbg" id="mRevisionAula" onclick="if(event.target===this)closeRevisionAula()">
  <div class="modal" style="max-width:600px">
    <div class="mh"><div class="mt" id="revisionTitulo">📷 Revisando aula</div><button class="mx" onclick="closeRevisionAula()">✕</button></div>
    <video id="revisionVideo" style="width:100%;max-width:500px;border-radius:8px;margin-bottom:16px;display:none" autoplay playsinline></video>
    <div id="revisionEstado" style="display:none;font-size:13px;color:var(--muted);margin:16px 0;text-align:center">Identificando equipo...</div>
    <div id="revisionResultado" style="display:none"></div>
    <div class="mf" style="margin-top:16px;gap:8px">
      <button class="btn btn-p" id="revisionCapturarBtn" style="display:none" onclick="capturarRevision()">Capturar</button>
      <button class="btn" id="revisionResumenBtn" style="display:none" onclick="terminarRevisionAula()">Terminar revisión</button>
      <button class="btn" onclick="closeRevisionAula()">Cerrar</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Verify placement with a syntax-safe check**

Run: `node -e "require('fs').readFileSync('index.html','utf8')"` (just confirms the file is still readable as text; HTML has no real syntax checker in this project, so also visually confirm no unclosed tags were introduced by re-reading the modified regions).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: botón y modal de revisión rápida de aula (inventario andando)"
```

---

### Task 2: Frontend — camera capture and result interpretation logic

**Files:**
- Create: `js/revision-aula.js`
- Modify: `index.html` — add `<script src="js/revision-aula.js"></script>` near the existing `<script src="js/camara-serie.js"></script>` tag

**Interfaces:**
- Consumes: `apiPost()` (existing, `js/api.js`), `AULAS` (existing global array), `items` (existing global array), `escHtml()` (existing), `toast()` (existing), `cf` (existing global set by `goAula()` in `js/nav.js`, has shape `{type:'aula', id, label, icon}` when reviewing an aula).
- Produces: `openRevisionAula()`, `closeRevisionAula()`, `capturarRevision()`, `terminarRevisionAula()` — all called from `index.html` onclick handlers (Task 1) and from Task 4's button-visibility logic.

- [ ] **Step 1: Find the camara-serie.js script tag to place the new script next to it**

Run: `grep -n 'camara-serie.js' index.html`

Add the new script tag immediately after that line:

```html
<script src="js/revision-aula.js"></script>
```

- [ ] **Step 2: Write `js/revision-aula.js`**

```js
let _revisionStream = null;
let _revisionCapturing = false;
let _revisionAulaId = '';
let _revisionConfirmados = [];

function openRevisionAula() {
  if (!cf || cf.type !== 'aula') {
    toast('Abre primero la vista de un aula para revisarla', 'err');
    return;
  }
  _revisionAulaId = cf.id;
  _revisionConfirmados = [];

  const modal = document.getElementById('mRevisionAula');
  const video = document.getElementById('revisionVideo');
  const estado = document.getElementById('revisionEstado');
  const resultado = document.getElementById('revisionResultado');
  const capturarBtn = document.getElementById('revisionCapturarBtn');
  const resumenBtn = document.getElementById('revisionResumenBtn');
  const titulo = document.getElementById('revisionTitulo');

  const aulaNombre = (AULAS.find(a => a.id === _revisionAulaId) || {}).name || _revisionAulaId;
  titulo.textContent = `📷 Revisando: ${aulaNombre}`;

  modal.classList.add('open');
  estado.style.display = 'none';
  resultado.style.display = 'none';
  resultado.innerHTML = '';
  capturarBtn.style.display = 'none';
  resumenBtn.style.display = 'inline-flex';
  _revisionCapturing = false;

  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Este navegador no permite acceder a la cámara', 'err');
    closeRevisionAula();
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      _revisionStream = stream;
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
      closeRevisionAula();
    });
}

function closeRevisionAula() {
  if (_revisionStream) {
    _revisionStream.getTracks().forEach(t => t.stop());
    _revisionStream = null;
  }
  const video = document.getElementById('revisionVideo');
  if (video) video.srcObject = null;
  document.getElementById('mRevisionAula').classList.remove('open');
}

async function capturarRevision() {
  if (_revisionCapturing) return;
  _revisionCapturing = true;
  const video = document.getElementById('revisionVideo');
  const estado = document.getElementById('revisionEstado');
  const resultado = document.getElementById('revisionResultado');
  const capturarBtn = document.getElementById('revisionCapturarBtn');

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
  const imagenBase64 = dataUrl.split(',')[1];

  video.style.display = 'none';
  capturarBtn.style.display = 'none';
  estado.style.display = 'block';
  estado.textContent = 'Identificando equipo...';
  resultado.style.display = 'none';

  try {
    const res = await apiPost({ action: 'buscarPorSerie', imagen: imagenBase64 });
    estado.style.display = 'none';
    if (!res.ok) {
      _mostrarRevisionError(res.error || 'No se pudo identificar el equipo, inténtalo de nuevo');
      return;
    }
    if (res.match === 'exacto' || (res.match === 'fuzzy' && res.candidatos && res.candidatos.length === 1)) {
      const item = res.match === 'exacto' ? res.item : res.candidatos[0];
      _mostrarRevisionResultado(item);
      return;
    }
    if (res.match === 'fuzzy') {
      _mostrarRevisionFuzzy(res.candidatos);
      return;
    }
    _mostrarRevisionNoIdentificado();
  } catch (e) {
    estado.style.display = 'none';
    _mostrarRevisionError('No se pudo identificar el equipo, inténtalo de nuevo');
  } finally {
    _revisionCapturing = false;
  }
}

function _mostrarRevisionResultado(item) {
  const resultado = document.getElementById('revisionResultado');
  resultado.style.display = 'block';
  if (String(item.aula) === String(_revisionAulaId)) {
    if (!_revisionConfirmados.some(x => String(x.id) === String(item.id))) {
      _revisionConfirmados.push(item);
    }
    resultado.innerHTML = `
      <div style="padding:12px;border:1px solid var(--green);background:var(--green-l);border-radius:8px;margin-bottom:12px">
        <div style="font-weight:600;color:var(--green)">✓ ${escHtml(item.item)} confirmado</div>
      </div>
      <button class="btn btn-p" onclick="revisionSiguiente()">Siguiente</button>`;
    return;
  }
  const aulaReal = (AULAS.find(a => a.id === item.aula) || {}).name || item.aula || 'Sin aula';
  resultado.innerHTML = `
    <div style="padding:12px;border:1px solid var(--amber);background:var(--amber-l);border-radius:8px;margin-bottom:12px">
      <div style="font-weight:600;color:var(--amber)">⚠ ${escHtml(item.item)}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">Este ítem figura en ${escHtml(aulaReal)}</div>
    </div>
    <button class="btn btn-p" onclick='_corregirAulaRevision(${JSON.stringify(item.id)})'>Actualizar a esta aula</button>
    <button class="btn" onclick="revisionSiguiente()" style="margin-top:8px">Siguiente (sin corregir)</button>`;
}

function _mostrarRevisionFuzzy(candidatos) {
  const resultado = document.getElementById('revisionResultado');
  resultado.style.display = 'block';
  const filas = candidatos.map(c => {
    const aulaNombre = (AULAS.find(a => a.id === c.aula) || {}).name || c.aula || 'Sin aula';
    return `<div class="serie-candidato" onclick='_mostrarRevisionResultado(${JSON.stringify(c)})' style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer">
      <div style="font-weight:600">${escHtml(c.item)}</div>
      <div style="font-size:12px;color:var(--muted)">${escHtml(aulaNombre)}</div>
    </div>`;
  }).join('');
  resultado.innerHTML = `<div style="margin-bottom:8px">¿Es alguno de estos?</div>${filas}<button class="btn" onclick="revisionSiguiente()">Ninguno, siguiente</button>`;
}

function _mostrarRevisionNoIdentificado() {
  const resultado = document.getElementById('revisionResultado');
  resultado.style.display = 'block';
  resultado.innerHTML = `
    <div style="margin-bottom:12px;color:var(--muted)">No identificado, prueba otra foto.</div>
    <button class="btn btn-p" onclick="revisionSiguiente()">Siguiente</button>`;
}

function _mostrarRevisionError(msg) {
  const resultado = document.getElementById('revisionResultado');
  resultado.style.display = 'block';
  resultado.innerHTML = `
    <div style="color:var(--red);margin-bottom:12px">${escHtml(msg)}</div>
    <button class="btn" onclick="revisionSiguiente()">Reintentar</button>`;
}

async function _corregirAulaRevision(itemId) {
  const item = items.find(x => String(x.id) === String(itemId));
  if (!item) {
    toast('No se encontró el ítem para actualizar', 'err');
    return;
  }
  const updated = { ...item, aula: _revisionAulaId };
  try {
    const res = await apiPost({ action: 'update', item: updated });
    if (!res.ok) throw new Error(res.error || 'Error al actualizar');
    const idx = items.findIndex(x => String(x.id) === String(itemId));
    if (idx >= 0) items[idx] = updated;
    if (!_revisionConfirmados.some(x => String(x.id) === String(updated.id))) {
      _revisionConfirmados.push(updated);
    }
    toast('Aula actualizada', 'ok');
    revisionSiguiente();
  } catch (e) {
    toast('No se pudo actualizar el aula: ' + (e.message || ''), 'err');
  }
}

function revisionSiguiente() {
  const estado = document.getElementById('revisionEstado');
  const resultado = document.getElementById('revisionResultado');
  const video = document.getElementById('revisionVideo');
  const capturarBtn = document.getElementById('revisionCapturarBtn');
  resultado.style.display = 'none';
  resultado.innerHTML = '';
  estado.style.display = 'none';
  video.style.display = 'block';
  capturarBtn.style.display = 'inline-flex';
}

function terminarRevisionAula() {
  const esperados = items.filter(x => String(x.aula) === String(_revisionAulaId));
  const confirmadosIds = new Set(_revisionConfirmados.map(x => String(x.id)));
  const noVerificados = esperados.filter(x => !confirmadosIds.has(String(x.id)));

  closeRevisionAula();

  const aulaNombre = (AULAS.find(a => a.id === _revisionAulaId) || {}).name || _revisionAulaId;
  const listaConfirmados = _revisionConfirmados.length
    ? _revisionConfirmados.map(x => x.item).join(', ')
    : 'ninguno';
  const listaNoVerificados = noVerificados.length
    ? noVerificados.map(x => x.item).join(', ')
    : 'ninguno';
  const message = `Confirmados (${_revisionConfirmados.length}): ${listaConfirmados}. No verificados (${noVerificados.length}): ${listaNoVerificados}. "No verificado" no significa ausente — puede que no se haya fotografiado durante esta revisión.`;

  confirmDialog({
    title: `📋 Resumen de revisión: ${aulaNombre}`,
    message,
    confirmText: 'Cerrar'
  }).catch(() => {});
}
```

**Note on `confirmDialog` usage:** `confirmDialog({title, message, confirmText, danger, icon})` (defined in `js/ui-helpers.js:6`) renders `message` via `.textContent` on `#cSub`, a plain `<div>` with no `white-space: pre-line` styling (confirmed by reading `index.html:1455`) — literal `\n` characters would collapse to spaces in the rendered output. The code above avoids that entirely by using comma-separated lists on a single line instead of line breaks, so no CSS change or multi-line handling is needed. The dialog always shows both a confirm and a cancel button (no way to hide cancel) — since both close the dialog identically for this read-only summary, the `.catch(() => {})` is sufficient without inspecting the resolved value.

- [ ] **Step 3: Syntax check**

Run: `node --check js/revision-aula.js`
Expected: no output (syntax valid)

- [ ] **Step 4: Commit**

```bash
git add index.html js/revision-aula.js
git commit -m "feat: lógica de captura y confirmación del modo revisión de aula"
```

---

### Task 3: Register `js/revision-aula.js`'s reused actions in permission tables (verification only, no new registration expected)

**Files:**
- Read-only check: `js/api.js`, `js/roles.js`

**Interfaces:**
- Consumes: existing `ENDPOINT_MAP` entries for `buscarPorSerie` and `update` — this task does NOT add new entries, it verifies none are needed.

- [ ] **Step 1: Confirm no new actions were introduced**

`js/revision-aula.js` (Task 2) only calls `apiPost({action:'buscarPorSerie', ...})` and `apiPost({action:'update', ...})` — both already registered actions, unmodified. Run this check to confirm both are present:

```bash
grep -n "buscarPorSerie\|update:" js/api.js
grep -n "buscarPorSerie\|update:" js/roles.js
```

Expected: both files already list `buscarPorSerie` and `update` (pre-existing entries from earlier sessions — `buscarPorSerie` from the idea #1 implementation, `update` from the original item CRUD). If either is somehow missing (it should not be), STOP and report — that would indicate the codebase changed since this plan was written, not something this task should silently patch.

- [ ] **Step 2: No commit needed**

This task makes no code changes — it is a verification checkpoint confirming Task 2 introduced no permission gaps (the exact class of bug documented in `CLAUDE.md` session v522, where a new action was called from the frontend without being registered in `ENDPOINT_MAP`/`ACTION_PERMISSIONS`).

---

### Task 4: Show/hide the "Revisar aula" button based on the current view

**Files:**
- Modify: `js/nav.js:192-196` (inside `openSub()`)

**Interfaces:**
- Consumes: `cf.type` (existing global, set by `goAula()`/`goCat()`/etc.), `can()` (existing permission-check function used elsewhere in the same block, e.g. `js/nav.js:199`).
- Produces: visibility toggling of `#btnRevisionAula` (from Task 1).

- [ ] **Step 1: Add visibility logic next to the existing `btnN`/`btnE` toggling**

In `js/nav.js`, inside `openSub()`, find this existing block (around line 193-196):

```js
  const noActions = cf.type==='lowstock' || cf.type==='maintenance' || cf.type==='caja';
  document.getElementById('btnN').style.display = noActions ? 'none' : 'flex';
  document.getElementById('btnE').style.display = noActions ? 'none' : 'flex';
  _hideHomeButtons();
```

Add a new line immediately after it (before `_hideHomeButtons();` or after — order doesn't matter since they touch different elements):

```js
  const btnRevision = document.getElementById('btnRevisionAula');
  if (btnRevision) btnRevision.style.display = (cf.type === 'aula' && typeof can === 'function' && can('items.write')) ? 'flex' : 'none';
```

So the full block reads:

```js
  const noActions = cf.type==='lowstock' || cf.type==='maintenance' || cf.type==='caja';
  document.getElementById('btnN').style.display = noActions ? 'none' : 'flex';
  document.getElementById('btnE').style.display = noActions ? 'none' : 'flex';
  const btnRevision = document.getElementById('btnRevisionAula');
  if (btnRevision) btnRevision.style.display = (cf.type === 'aula' && typeof can === 'function' && can('items.write')) ? 'flex' : 'none';
  _hideHomeButtons();
```

- [ ] **Step 2: Syntax check**

Run: `node --check js/nav.js`
Expected: no output (syntax valid)

- [ ] **Step 3: Commit**

```bash
git add js/nav.js
git commit -m "feat: muestra el botón de revisión de aula solo en vista de aula"
```

---

### Task 5: Bump service worker version and end-to-end verification

**Files:**
- Modify: `sw.js` (VERSION constant)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new — deployment/cache-busting step only

- [ ] **Step 1: Bump VERSION in sw.js**

Read `sw.js`, find the current `VERSION` constant, increment it by 1, matching the existing format exactly (e.g. `'v545'` → `'v546'` — confirm the actual current value first, since it may have moved since this plan was written).

- [ ] **Step 2: Commit the version bump**

```bash
git add sw.js
git commit -m "chore: bump version tras modo revisión rápida de aula (inventario andando)"
```

- [ ] **Step 3: Push and wait for Cloudflare Pages deploy**

```bash
git push origin main
```

Wait for Cloudflare Pages auto-deploy to complete before verification (check `sw.js`'s deployed `VERSION` value via a direct fetch, same method used in the prior session for ideas #1-#4).

- [ ] **Step 4: End-to-end verification in production with Playwright**

Using the `playwright-skill`, log in to `boscoinventario.pages.dev` with a test account (e.g. `Seba`/`Seba`), open an aula that has at least 2-3 existing items, and verify:

1. **Button visibility:** "📷 Revisar aula" is visible in the aula view's action strip; navigate to a category view (`goCat()`) and confirm the button is hidden there.
2. **Confirmed in correct room:** click the button, open the camera modal, intercept the `buscarPorSerie` network call and mock a response with `match:'exacto'` where `item.aula` equals the aula being reviewed — confirm a green "✓ confirmed" card appears and a "Siguiente" button is shown.
3. **Wrong room:** mock a response with `match:'exacto'` where `item.aula` is a DIFFERENT aula — confirm an amber warning card appears with "Actualizar a esta aula" and "Siguiente (sin corregir)" buttons; click "Actualizar a esta aula" and confirm (via `wrangler d1 execute` or a follow-up API call) that the item's `aula` column was updated in D1.
4. **Not identified:** mock a response with `match:'sin_lectura'` — confirm the neutral "No identificado" message and "Siguiente" button.
5. **Summary:** after confirming at least one item and leaving at least one other existing item in that aula unconfirmed, click "Terminar revisión" — confirm the summary shows the confirmed item(s) in one list and the unconfirmed existing item(s) in another.

Report actual observed behavior for each case — do not assume success without observing the response in the browser (per `superpowers:verification-before-completion`).

- [ ] **Step 5: Fix any issues found during verification**

If any case fails, use `superpowers:systematic-debugging` to diagnose before patching.

## Self-Review Notes

- **Spec coverage:** all sections of `docs/superpowers/specs/2026-08-01-inventario-andando-design.md` are covered — manual aula selection (Task 4's visibility gate ensures the button only appears from an aula view, meaning `cf.id` is always the selected aula), fixed-photo capture reusing camera infrastructure (Task 2), reuse of `buscarPorSerie` unchanged (Task 2, no backend task in this plan), instant aula-correction via existing `update` action (Task 2's `_corregirAulaRevision`), ephemeral in-memory summary with no new D1 columns (Task 2's `_revisionConfirmados` array, Task 5 verification confirms no persistence).
- **No placeholders:** all code blocks are complete and copy-pasteable except the explicitly-flagged `confirmDialog()` signature check in Task 2 Step 3, which cannot be resolved without reading the live function (this is a verification step, not a placeholder — the plan gives a concrete fallback path if the assumed signature is wrong).
- **Type/name consistency:** `_revisionAulaId`, `_revisionConfirmados` are declared once (Task 2 Step 2) and referenced consistently across `_mostrarRevisionResultado`, `_corregirAulaRevision`, and `terminarRevisionAula`. `openRevisionAula`/`closeRevisionAula`/`capturarRevision`/`terminarRevisionAula` names match exactly between their `index.html` onclick handlers (Task 1) and their definitions (Task 2).
