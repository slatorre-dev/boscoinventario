# Unificar Botones de QR y Búsqueda por Cámara Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Home's two separate camera buttons ("Escanear QR" and "Buscar con la cámara") with a single "🎥 Buscar con cámara (QR o S/N)" button that opens one continuous-scan modal capable of recognizing an app QR code, a factory barcode, or (after a few seconds of no detection) offering a manual transition to the existing still-photo AI OCR flow.

**Architecture:** A new orchestration module, `js/camara-unificada.js`, opens a single continuous-scan modal and runs `BarcodeDetector` (already used in `js/camara-serie.js` since v549) against every video frame with `formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e']`. If `qr_code` isn't in `BarcodeDetector.getSupportedFormats()`, the existing `jsQR` library (already loaded globally via CDN) runs in parallel on the same frame as a fallback for QR only. Detected QR codes reuse the EXISTING `_showQrActions()` function from `js/qr-scanner.js` unchanged; detected barcodes call the EXISTING `buscarSeriePorCodigo` backend action unchanged. A manual "No lo detecta, buscar con IA" button (shown after ~3 seconds with no detection) freezes the current frame and hands off to the EXISTING still-photo AI flow (`buscarPorSerie`) from `js/camara-serie.js`, unchanged. No backend changes; this plan is pure frontend orchestration reusing three already-working pieces rather than rewriting them.

**Tech Stack:** Vanilla JS, no build step, no test framework (verification is manual/Playwright against production, per project convention). Native `BarcodeDetector` API + existing `jsQR` CDN library (already loaded, no new dependency).

## Global Constraints

- No backend changes — `buscarSeriePorCodigo` and `buscarPorSerie` (both in `functions/api/item.js`) are reused exactly as they exist today. No new D1 migration.
- The RESULT behavior per detection type must NOT change: a detected QR still opens the quick-actions panel (`_showQrActions()`); a detected barcode/serial still opens the item directly on exact match or shows candidates on fuzzy match (existing `buscarSeriePorCodigo` response handling); falling through to AI still runs the existing serial/free-text/visual cascade (existing `buscarPorSerie` response handling). This plan unifies the ENTRY POINT only, never the downstream behavior.
- `jsQR` remains as a conditional fallback, never removed — `BarcodeDetector`'s `qr_code` format support varies by browser, so `jsQR` must still run in parallel whenever `qr_code` isn't in `BarcodeDetector.getSupportedFormats()` (or whenever `BarcodeDetector` doesn't exist at all).
- The manual-transition-to-AI button appears only after ~3 seconds of no detection — never automatically triggers the AI call, since that call has a real Workers AI cost and the user may still be adjusting framing.
- Reuse existing functions where they already do the right thing — do NOT reimplement `_showQrActions()`, `qrQuickAction()`, the `buscarSeriePorCodigo`/`buscarPorSerie` response-handling branches (`_mostrarSerieCandidatos()`, `_mostrarSerieCrearNuevo()`, `_mostrarVisualCandidatos()`, etc.), or the QR-code item-id extraction regex (`code.data.match(/item\/([a-zA-Z0-9_-]+)/)`). Call them from the new orchestration module instead.
- `sw.js` `VERSION` must be bumped as the final step (project workflow in `CLAUDE.md`).
- Verification is manual/Playwright against production — this project has no automated test suite.

---

### Task 1: HTML — single button and unified scan modal

**Files:**
- Modify: `index.html` — replace the two existing buttons `#gsQr` and `#gsSerie` (currently in `.gsearch-extra-btns`, around lines 316-327) with one new button; add a new modal `#mCamaraUnificada` after the existing `#mCamaraSerie` modal (keep `#mQrScanner` and `#mCamaraSerie` in the DOM for this task — Task 5 decides their fate once the new modal is proven working).

**Interfaces:**
- Produces: DOM elements `#gsCamara` (button), `#mCamaraUnificada` (modal) with `#camaraUnifVideo`, `#camaraUnifEstado`, `#camaraUnifResultado`, `#camaraUnifBtnIA` (the "No lo detecta, buscar con IA" button) — all consumed by Task 2's `js/camara-unificada.js`.

- [ ] **Step 1: Replace the two existing buttons with one**

In `index.html`, find `.gsearch-extra-btns` (currently containing `#gsQr` and `#gsSerie`, lines 315-328). Replace BOTH buttons with a single new one:

```html
    <div class="gsearch-extra-btns">
      <button class="gsearch-extra-btn" id="gsCamara" onclick="openCamaraUnificada()" title="Buscar con cámara (QR o S/N)">
        🎥
        <span>Buscar con cámara (QR o S/N)</span>
      </button>
    </div>
```

Do NOT add a `data-perm` attribute to this button — per this project's established convention (see `CLAUDE.md`'s documented `applyRoleUI()`/`data-perm` bug from the previous session), only add `data-perm` to buttons whose visibility depends ONLY on a permission with no other condition. This button has no view-specific visibility requirement (unlike `#btnRevisionAula`/`#btnMultiEquipo`, which live inside aula views) — it's always visible in Home to any logged-in user, same as the two buttons it replaces, neither of which had `data-perm` either. Confirm this by reading the current `#gsQr`/`#gsSerie` markup before removing it.

- [ ] **Step 2: Add the unified scan modal**

Add this new modal right after `#mCamaraSerie`'s closing tags (find `id="mCamaraSerie"` and locate where that modal's `</div></div>` ends):

```html
<!-- ══ CÁMARA UNIFICADA: QR + CÓDIGO DE BARRAS + S/N ══ -->
<div class="mbg" id="mCamaraUnificada" onclick="if(event.target===this)closeCamaraUnificada()">
  <div class="modal" style="max-width:600px">
    <div class="mh"><div class="mt">🎥 Apunta la cámara a un QR o etiqueta</div><button class="mx" onclick="closeCamaraUnificada()">✕</button></div>
    <video id="camaraUnifVideo" style="width:100%;max-width:500px;border-radius:8px;margin-bottom:16px" autoplay playsinline></video>
    <div id="camaraUnifEstado" style="font-size:13px;color:var(--muted);margin:16px 0;text-align:center">Buscando QR o código...</div>
    <div id="camaraUnifResultado" style="display:none"></div>
    <div class="mf" style="margin-top:16px;gap:8px">
      <button class="btn btn-p" id="camaraUnifBtnIA" style="display:none" onclick="camaraUnifPasarAIA()">No lo detecta, buscar con IA</button>
      <button class="btn" onclick="closeCamaraUnificada()">Cerrar</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Visual verification**

Re-read the modified regions to confirm no unclosed tags, and confirm `#gsQr`/`#gsSerie` no longer exist anywhere in the file (run `grep -c 'id="gsQr"\|id="gsSerie"' index.html` — expect `0` for both) while `#mQrScanner`/`#mCamaraSerie` (the modals, not the Home buttons) still exist untouched (their functions are still called by the new module in later tasks).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: botón y modal únicos de cámara (QR + código de barras + S/N)"
```

---

### Task 2: Frontend — continuous scan loop with dual detector (BarcodeDetector + conditional jsQR)

**Files:**
- Create: `js/camara-unificada.js`
- Modify: `index.html` — add `<script defer src="js/camara-unificada.js"></script>` near the other camera-feature script tags (e.g. next to `js/camara-serie.js`'s tag)

**Interfaces:**
- Consumes: `BarcodeDetector` (native, may not exist), `jsQR` (global, always loaded via CDN per this project's existing setup — see `index.html`'s `<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js">`), `_showQrActions()` (existing, `js/qr-scanner.js`), `apiPost()` (existing), `_mostrarSerieCandidatos()`/`_mostrarSerieCrearNuevo()`/`_mostrarVisualCandidatos()`/`_mostrarSerieError()` (existing, `js/camara-serie.js` — all currently `function`-scoped at module level, callable from any file since this project has no module system), `openItemRoute()` (existing).
- Produces: `openCamaraUnificada()`, `closeCamaraUnificada()`, `camaraUnifPasarAIA()` — called from `index.html`'s onclick handlers (Task 1).

- [ ] **Step 1: Add the script tag**

Run: `grep -n 'camara-serie.js' index.html`

Add immediately after that line:
```html
<script defer src="js/camara-unificada.js"></script>
```

- [ ] **Step 2: Write `js/camara-unificada.js`**

```js
let _camUnifStream = null;
let _camUnifScanning = false;
let _camUnifUsarJsQR = false;
let _camUnifNoDetectadoTimer = null;

function openCamaraUnificada() {
  const modal = document.getElementById('mCamaraUnificada');
  const video = document.getElementById('camaraUnifVideo');
  const estado = document.getElementById('camaraUnifEstado');
  const resultado = document.getElementById('camaraUnifResultado');
  const btnIA = document.getElementById('camaraUnifBtnIA');

  modal.classList.add('open');
  estado.style.display = 'block';
  estado.textContent = 'Buscando QR o código...';
  resultado.style.display = 'none';
  resultado.innerHTML = '';
  btnIA.style.display = 'none';
  _camUnifScanning = true;

  _camUnifUsarJsQR = true;
  if (typeof BarcodeDetector !== 'undefined' && BarcodeDetector.getSupportedFormats) {
    BarcodeDetector.getSupportedFormats().then(formatos => {
      _camUnifUsarJsQR = !formatos.includes('qr_code');
    }).catch(() => { _camUnifUsarJsQR = true; });
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Este navegador no permite acceder a la cámara', 'err');
    closeCamaraUnificada();
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      _camUnifStream = stream;
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        _camUnifNoDetectadoTimer = setTimeout(() => {
          if (_camUnifScanning) document.getElementById('camaraUnifBtnIA').style.display = 'inline-flex';
        }, 3000);
        _iniciarEscaneoUnificado(video);
      };
    })
    .catch(err => {
      let msg = 'Error al acceder a la cámara: ' + err.message;
      if (err.name === 'NotAllowedError') msg = 'Acceso denegado a la cámara. Verifica los permisos.';
      else if (err.name === 'NotFoundError') msg = 'No se encontró cámara en tu dispositivo.';
      toast(msg, 'err');
      closeCamaraUnificada();
    });
}

function closeCamaraUnificada() {
  _camUnifScanning = false;
  if (_camUnifNoDetectadoTimer) { clearTimeout(_camUnifNoDetectadoTimer); _camUnifNoDetectadoTimer = null; }
  if (_camUnifStream) {
    _camUnifStream.getTracks().forEach(t => t.stop());
    _camUnifStream = null;
  }
  const video = document.getElementById('camaraUnifVideo');
  if (video) video.srcObject = null;
  document.getElementById('mCamaraUnificada').classList.remove('open');
}

function _iniciarEscaneoUnificado(video) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  let procesandoFrame = false;
  let detector = null;
  if (typeof BarcodeDetector !== 'undefined') {
    try {
      detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    } catch (e) { detector = null; }
  }

  async function procesarFrame() {
    if (!_camUnifScanning) return;
    if (procesandoFrame) { requestAnimationFrame(procesarFrame); return; }
    procesandoFrame = true;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    let manejado = false;

    if (detector) {
      try {
        const codigos = await detector.detect(canvas);
        if (codigos.length) {
          manejado = await _manejarDeteccionUnificada(codigos[0].rawValue, codigos[0].format);
        }
      } catch (e) { /* formato puntual no soportado, sigue con jsQR si aplica */ }
    }

    if (!manejado && _camUnifUsarJsQR && typeof jsQR !== 'undefined') {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
      if (code) {
        manejado = await _manejarDeteccionUnificada(code.data, 'qr_code');
      }
    }

    procesandoFrame = false;
    if (!manejado && _camUnifScanning) requestAnimationFrame(procesarFrame);
  }

  procesarFrame();
}

async function _manejarDeteccionUnificada(valor, formato) {
  if (formato === 'qr_code') {
    const itemMatch = valor.match(/item\/([a-zA-Z0-9_-]+)/);
    if (!itemMatch) return false;
    _camUnifScanning = false;
    if (_camUnifNoDetectadoTimer) { clearTimeout(_camUnifNoDetectadoTimer); _camUnifNoDetectadoTimer = null; }
    document.getElementById('camaraUnifEstado').textContent = 'QR detectado: ' + itemMatch[1];
    if (_camUnifStream) { _camUnifStream.getTracks().forEach(t => t.stop()); _camUnifStream = null; }
    _mostrarAccionesQrEnModalUnificado(itemMatch[1]);
    return true;
  }

  _camUnifScanning = false;
  if (_camUnifNoDetectadoTimer) { clearTimeout(_camUnifNoDetectadoTimer); _camUnifNoDetectadoTimer = null; }
  document.getElementById('camaraUnifEstado').textContent = 'Comprobando código...';
  try {
    const res = await apiPost({ action: 'buscarSeriePorCodigo', codigo: valor });
    if (res.ok && (res.match === 'exacto' || res.match === 'fuzzy')) {
      if (res.match === 'exacto') {
        closeCamaraUnificada();
        if (typeof items !== 'undefined' && Array.isArray(items) && !items.some(x => x.id === res.item.id)) {
          items.push(res.item);
        }
        openItemRoute(res.item.id);
        return true;
      }
      document.getElementById('camaraUnifEstado').style.display = 'none';
      const resultado = document.getElementById('camaraUnifResultado');
      resultado.style.display = 'block';
      const filas = res.candidatos.map(c => {
        const aula = (typeof AULAS !== 'undefined' ? AULAS.find(a => a.id === c.aula) : null);
        const aulaNombre = aula ? aula.name : (c.aula || 'Sin aula');
        return `<div class="serie-candidato" onclick="closeCamaraUnificada();openItemRoute(${c.id})" style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer">
          <div style="font-weight:600">${escHtml(c.item)}</div>
          <div style="font-size:12px;color:var(--muted)">${escHtml(aulaNombre)} · S/N: ${escHtml(c.serie)}</div>
        </div>`;
      }).join('');
      resultado.innerHTML = `<div style="margin-bottom:8px">No hay coincidencia exacta, ¿es alguno de estos?</div>${filas}`;
      return true;
    }
  } catch (e) { /* fallo de red al comprobar el código: se sigue escaneando */ }

  _camUnifScanning = true;
  document.getElementById('camaraUnifEstado').textContent = 'Buscando QR o código...';
  return false;
}

function _mostrarAccionesQrEnModalUnificado(itemId) {
  closeCamaraUnificada();
  if (typeof _showQrActionsStandalone === 'function') {
    _showQrActionsStandalone(itemId);
  } else {
    openItemRoute(itemId);
  }
}

function camaraUnifPasarAIA() {
  const video = document.getElementById('camaraUnifVideo');
  if (!video || !video.videoWidth) {
    toast('La cámara aún no está lista, espera un momento', 'err');
    return;
  }
  _camUnifScanning = false;
  if (_camUnifNoDetectadoTimer) { clearTimeout(_camUnifNoDetectadoTimer); _camUnifNoDetectadoTimer = null; }
  if (_camUnifStream) { _camUnifStream.getTracks().forEach(t => t.stop()); _camUnifStream = null; }
  video.srcObject = null;
  closeCamaraUnificada();
  openCamaraSerie();
  setTimeout(() => {
    if (typeof capturarSerie === 'function') capturarSerie();
  }, 400);
}
```

**Design notes:**
- `_manejarDeteccionUnificada()` returns `true`/`false` to signal whether the scan loop should stop (handled) or keep running (`ninguno` match, or a non-QR-shaped payload from a stray `jsQR` false match) — this mirrors the existing `qr-scanner.js` pattern of returning to `requestAnimationFrame(processFrame)` when nothing usable was found.
- The 3-second "no detection" timer is set once per `openCamaraUnificada()` call and cleared on any detection or close — it does NOT reset on every frame, so it fires exactly once ~3 seconds after opening, regardless of how many frames were processed in that window.
- `camaraUnifPasarAIA()` reuses the EXISTING `openCamaraSerie()` + `capturarSerie()` functions from `js/camara-serie.js` rather than reimplementing the still-photo capture — it closes the unified modal, opens the existing serial-search modal, and immediately triggers a capture on the already-live video stream that `openCamaraSerie()` just started. The `setTimeout(..., 400)` gives the new `getUserMedia()` call time to resolve and attach the stream before `capturarSerie()` reads `video.videoWidth`/`videoHeight` from it — a fresh camera permission grant is nearly instant on a device that already granted it once in the same session (which it will have, from opening the unified modal moments earlier), but this small buffer avoids a race on slower devices.
- `_mostrarAccionesQrEnModalUnificado()` calls a `_showQrActionsStandalone()` function that does NOT exist yet — this is intentional and handled in Task 3, which extracts a reusable version of `js/qr-scanner.js`'s existing `_showQrActions()` (currently written to assume `#mQrScanner`'s specific DOM elements) so it can render into a standalone context instead. Until Task 3 lands, this function falls back to `openItemRoute(itemId)` directly (skipping the quick-actions panel) — a deliberately safe degraded behavior, not a bug, since Task 3 is the very next task in this same plan and no intermediate deploy happens between them.

- [ ] **Step 3: Syntax check**

Run: `node --check js/camara-unificada.js`
Expected: no output (syntax valid)

- [ ] **Step 4: Commit**

```bash
git add index.html js/camara-unificada.js
git commit -m "feat: bucle de escaneo continuo unificado (BarcodeDetector + jsQR condicional)"
```

---

### Task 3: Extract a standalone quick-actions renderer reusable outside `#mQrScanner`

**Files:**
- Modify: `js/qr-scanner.js` — extract `_showQrActions()`'s DOM-rendering logic into a version that can render into the unified modal's own result area, without requiring `#mQrScanner`'s specific markup.

**Interfaces:**
- Consumes: `items` (existing global array), `AULAS`, `findModulo()`, `can()` — all already used by the existing `_showQrActions()`.
- Produces: `_showQrActionsStandalone(itemId)` — called from Task 2's `_mostrarAccionesQrEnModalUnificado()`.

- [ ] **Step 1: Read the current `_showQrActions()` implementation in full**

Run: `grep -n "_showQrActions" -A 45 js/qr-scanner.js`

This function currently looks up the item, then writes into `#qrScannerContent`/`#qrActions`/`#qrActionsTitle`/`#qrActionsMeta`/`#qrActionsPhoto` — all elements that live inside `#mQrScanner`, which Task 1 did NOT remove from the DOM (only its entry button `#gsQr` was removed). Since `#mQrScanner` still exists, the SIMPLEST correct approach — confirm this is true by re-reading the modal's current markup — is for `_showQrActionsStandalone()` to open `#mQrScanner` itself (`document.getElementById('mQrScanner').classList.add('open')`) and then call the EXISTING `_showQrActions(itemId)` unchanged, rather than reimplementing its rendering logic in a new location.

- [ ] **Step 2: Add `_showQrActionsStandalone()` as a thin wrapper, not a reimplementation**

In `js/qr-scanner.js`, add this new function near `_showQrActions()`:

```js
function _showQrActionsStandalone(itemId) {
  const modal = document.getElementById('mQrScanner');
  modal.classList.add('open');
  document.getElementById('qrScannerContent').style.display = 'none';
  document.getElementById('qrError').style.display = 'none';
  _showQrActions(itemId);
}
```

**Design note:** this is a deliberately minimal wrapper — it reuses `#mQrScanner`'s own markup (already correctly styled and tested) instead of building a parallel rendering path inside `#mCamaraUnificada`. The unified modal (`#mCamaraUnificada`) closes itself before this runs (already handled in Task 2's `_mostrarAccionesQrEnModalUnificado()`, which calls `closeCamaraUnificada()` first), so there's no visual overlap between the two modals — the user sees the unified scan modal close and the QR-actions modal open in its place, which is the same transition `qr-scanner.js` already produces internally when a QR is found (from "scanning" state to "actions" state within the same modal), just now spanning two modals instead of one internal state change.

- [ ] **Step 3: Syntax check**

Run: `node --check js/qr-scanner.js`
Expected: no output (syntax valid)

- [ ] **Step 4: Commit**

```bash
git add js/qr-scanner.js
git commit -m "feat: extrae _showQrActionsStandalone para reusar el panel de acciones QR desde la cámara unificada"
```

---

### Task 4: Verify the AI fallback handoff end-to-end

**Files:**
- No new files — this task is verification-only, confirming Task 2's `camaraUnifPasarAIA()` correctly hands off to the pre-existing, unmodified `js/camara-serie.js` flow.

**Interfaces:**
- Consumes: `openCamaraSerie()`, `capturarSerie()` (both existing, unmodified).

- [ ] **Step 1: Read `openCamaraSerie()` and `capturarSerie()` once more to confirm the handoff assumptions hold**

Run: `grep -n "function openCamaraSerie\|function capturarSerie" -A 15 js/camara-serie.js`

Confirm: (a) `openCamaraSerie()` resets its own module-level state (`_serieLeidaPendiente`, etc.) and requests a FRESH `getUserMedia()` call — it does not attempt to reuse any stream from elsewhere, so it's safe to call after `camaraUnifPasarAIA()` has already stopped the unified modal's own stream; (b) `capturarSerie()` reads `video.videoWidth`/`video.videoHeight` from `#serieVideo` (a DIFFERENT video element than `#camaraUnifVideo`) at call time — confirming the `setTimeout(..., 400)` in Task 2's `camaraUnifPasarAIA()` is giving the NEW stream (attached to `#serieVideo` by `openCamaraSerie()`) time to have non-zero dimensions before `capturarSerie()` tries to draw it to a canvas, not attempting to reuse the OLD `#camaraUnifVideo` stream (which was already stopped).

- [ ] **Step 2: If the assumption in Step 1 doesn't hold, fix `camaraUnifPasarAIA()`**

If `capturarSerie()` would run into a zero-dimension video element in some circumstance (e.g. `video.onloadedmetadata` in `openCamaraSerie()` hasn't fired yet within the 400ms window on a particular device), replace the fixed `setTimeout` in `camaraUnifPasarAIA()` (Task 2) with an event-based wait instead:

```js
function camaraUnifPasarAIA() {
  const video = document.getElementById('camaraUnifVideo');
  if (!video || !video.videoWidth) {
    toast('La cámara aún no está lista, espera un momento', 'err');
    return;
  }
  _camUnifScanning = false;
  if (_camUnifNoDetectadoTimer) { clearTimeout(_camUnifNoDetectadoTimer); _camUnifNoDetectadoTimer = null; }
  if (_camUnifStream) { _camUnifStream.getTracks().forEach(t => t.stop()); _camUnifStream = null; }
  video.srcObject = null;
  closeCamaraUnificada();
  openCamaraSerie();
  const serieVideo = document.getElementById('serieVideo');
  const onReady = () => {
    serieVideo.removeEventListener('loadedmetadata', onReady);
    if (typeof capturarSerie === 'function') capturarSerie();
  };
  serieVideo.addEventListener('loadedmetadata', onReady);
}
```

This waits for the actual `loadedmetadata` event on `#serieVideo` (the same event `openCamaraSerie()` itself already listens for internally) rather than guessing a fixed delay — eliminates the race entirely rather than papering over it with a longer timeout.

- [ ] **Step 3: Commit only if Step 2's fix was needed**

```bash
git add js/camara-unificada.js
git commit -m "fix: espera el evento loadedmetadata real antes de capturar tras pasar a IA"
```

If Task 2's original `setTimeout` approach was confirmed sufficient in Step 1, skip this commit — there's nothing to change.

---

### Task 5: Bump service worker version and end-to-end verification

**Files:**
- Modify: `sw.js` (VERSION constant)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new — deployment/cache-busting step only

- [ ] **Step 1: Bump VERSION in sw.js**

Read `sw.js`, find the current `VERSION` constant, increment it by 1, matching the existing format exactly (confirm the actual current value first — it may have moved since this plan was written, e.g. past `v550`).

- [ ] **Step 2: Commit the version bump**

```bash
git add sw.js
git commit -m "chore: bump version tras unificar botones de QR y búsqueda por cámara"
```

- [ ] **Step 3: Push and wait for Cloudflare Pages deploy**

```bash
git push origin main
```

Wait for Cloudflare Pages auto-deploy to complete before verification (fetch `sw.js`'s deployed `VERSION` value directly — remember this project's corporate network requires `NODE_TLS_REJECT_UNAUTHORIZED=0` / `curl -k` for outbound HTTPS, per `CLAUDE.md`).

- [ ] **Step 4: End-to-end verification in production with Playwright**

Using the `playwright-skill`, against `boscoinventario.pages.dev`:

1. **QR detection opens quick-actions panel:** mock `window.BarcodeDetector` (via `page.addInitScript()`) so `detect()` resolves to `[{rawValue: '.../item/<real-id>', format: 'qr_code'}]` for a real item id in the test account's department — open the unified modal, confirm it closes and `#mQrScanner` opens showing the quick-actions panel with that item's info (title, aula, stock), NOT the item's edit page directly.
2. **Barcode/serial detection reuses existing behavior:** mock `BarcodeDetector.detect()` to return a non-QR format (e.g. `code_128`) with a `rawValue` matching a real item's `serie` in D1 — confirm `buscarSeriePorCodigo` is called (intercept the network request) and the item opens directly (exact match path), with the same behavior already verified for `js/camara-serie.js` in a prior session.
3. **`qr_code` unsupported triggers `jsQR` fallback:** mock `BarcodeDetector.getSupportedFormats()` to resolve WITHOUT `'qr_code'` in the array, and mock `BarcodeDetector.detect()` to always return an empty array (simulating "this detector doesn't handle QR") — confirm `_camUnifUsarJsQR` becomes `true` and that a real QR-shaped image (or a mocked `jsQR` global function returning a match) still gets detected and handled.
4. **No detection triggers the manual AI button:** mock BOTH detectors to never find anything — wait ~3.5 seconds, confirm `#camaraUnifBtnIA` becomes visible; click it, confirm the unified modal closes and `#mCamaraSerie` opens with the video stream active (or already mid-capture, depending on timing) — this is the fallback handoff Task 4 verified in isolation, now confirmed in the full user-facing flow.
5. **AI fallback flow still works end-to-end after handoff:** continuing from case 4, mock `buscarPorSerie`'s response (same mocking pattern already used in prior sessions' verification of `js/camara-serie.js`) to confirm the full existing serial/text/visual cascade still resolves correctly once reached via this new entry point — this is the regression check confirming the unification didn't break the AI path it hands off to.
6. **Single button, no leftover buttons:** confirm `#gsQr` and `#gsSerie` no longer exist in the page, and `#gsCamara` is the only camera-related button visible in Home's search bar area.

Report actual observed behavior for each case — do not assume success without observing the response in the browser (per `superpowers:verification-before-completion`).

- [ ] **Step 5: Fix any issues found during verification**

If any case fails, use `superpowers:systematic-debugging` to diagnose before patching.

## Self-Review Notes

- **Spec coverage:** all sections of `docs/superpowers/specs/2026-08-02-unificar-camara-qr-serie-design.md` are covered — single entry point (Task 1), unified continuous-scan loop with `BarcodeDetector` + conditional `jsQR` fallback (Task 2), unchanged downstream behavior for QR (Task 3's thin wrapper reusing `_showQrActions()` unchanged) and for barcode/serial (Task 2 reuses `buscarSeriePorCodigo`'s existing response shapes), manual (not automatic) transition to the existing AI flow (Task 2/4), no backend changes (confirmed — no task in this plan touches `functions/api/`).
- **No placeholders:** all code blocks are complete and copy-pasteable. Task 3's design explicitly chose the simplest correct approach (a thin wrapper reopening the existing `#mQrScanner` modal) over reimplementing rendering logic, after reading the existing function's DOM dependencies rather than assuming they could be trivially ported. Task 4 is an explicit verification-first task with a conditional fix — it doesn't assume the timing approach in Task 2 is correct, it re-derives the answer by reading both functions' actual behavior before deciding whether a fix is needed.
- **Type/name consistency:** `openCamaraUnificada`, `closeCamaraUnificada`, `camaraUnifPasarAIA` match exactly between `index.html`'s onclick handlers (Task 1) and their definitions (Task 2). `_showQrActionsStandalone` matches between its call site (Task 2's `_mostrarAccionesQrEnModalUnificado()`) and its definition (Task 3) — Task 2 explicitly acknowledges this function doesn't exist yet at the time Task 2 lands, with a safe degraded fallback (`openItemRoute()` directly) documented as intentional, not a defect, since Task 3 completes the wiring in the very next task of this same plan.
- **Explicit reuse over reimplementation:** every downstream behavior (QR quick-actions, barcode/serial matching, AI cascade) is reused from existing, already-verified code rather than rewritten — this plan's only new logic is the detection loop itself and the routing between the three existing outcomes, minimizing the surface area for the kind of cross-task integration bug this project's final-branch reviews have repeatedly found in the four prior features of this same session.
