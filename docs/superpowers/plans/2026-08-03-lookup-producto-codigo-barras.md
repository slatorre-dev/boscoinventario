# Lookup de Producto Real vía Código de Barras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a barcode is decoded as a real consumer-product format (EAN/UPC, not `code_128`) and no D1 item matches it, look up the code against UPCitemdb's free/no-key tier and prefill the new-item form with the real product name and brand instead of leaving those fields empty.

**Architecture:** `buscarSeriePorCodigo` (`functions/api/item.js`) gains an optional `formato` input field and, only when `match:'ninguno'` AND the format is EAN/UPC, makes a single best-effort outbound `fetch` to UPCitemdb with a short timeout. Any failure is swallowed and the response falls back to today's exact shape — this is purely additive enrichment, never a new failure mode. Both frontend callers (`js/camara-unificada.js`, `js/camara-serie.js`) pass the detected barcode's `format` through and, when the backend returns a `producto` field, prefill `f_item`/`f_proveedor` in the new-item modal the same way marca/modelo from AI OCR already do.

**Tech Stack:** Cloudflare Pages Functions (JS), native `fetch()` (no new Cloudflare binding), UPCitemdb free/trial REST API (no key), vanilla JS frontend.

## Global Constraints

- Lookup only fires for `formato` in `ean_13`, `ean_8`, `upc_a`, `upc_e`. Never for `code_128` — those are internal/asset codes, not real consumer products, and would waste the ~100/day free quota with zero chance of a match.
- Lookup only fires when `buscarSerieEnD1()` already returned `match:'ninguno'` — never for `exacto`/`fuzzy` matches (those already resolve to a real inventory item, no need to look anything up externally).
- Endpoint: `https://api.upcitemdb.com/prod/trial/lookup?upc=<codigo>` — no API key, no request body, GET only.
- Timeout the outbound fetch at ~4s via `AbortController`. This project's free-tier dependency (UPCitemdb) is known to be unreliable from Cloudflare Workers due to shared outbound IPs — the timeout exists so a stalled/rate-limited request never meaningfully delays the response beyond today's baseline.
- ANY failure path (timeout, non-200, malformed JSON, `code !== 'OK'`, empty `items`) must produce exactly the same response shape as today (`{ok:true, match:'ninguno'}` with no `producto` field) — no error surfaces to the user, no exception escapes the action handler.
- Truncate the looked-up product title to 120 characters before returning it.
- Never auto-fill category from the UPCitemdb result — only `nombre` (item name) and `marca` (brand).
- The `_serieDestinoFormulario` mode in `js/camara-serie.js` (capturing S/N into an already-open form's serie field) is explicitly OUT of scope — it never calls the new-item creation path this plan touches, so it needs no changes.
- No caching of lookups, no retries, no new D1 migration, no new Cloudflare binding.
- `sw.js` `VERSION` must be bumped as the final step (project workflow in `CLAUDE.md`).
- Verification is manual/Playwright against production — this project has no automated test suite.

---

### Task 1: Backend — UPCitemdb lookup helper + wire into `buscarSeriePorCodigo`

**Files:**
- Modify: `functions/api/item.js` — the `buscarSeriePorCodigo` action block (currently reads `codigo` from `body` and calls `buscarSerieEnD1`), and add a new helper function near `buscarSerieEnD1`/`buscarSerieEnRows`.

**Interfaces:**
- Produces: `async function lookupProductoUpcItemDb(codigo)` → returns `{ nombre: string, marca: string } | null`. Consumed only by `buscarSeriePorCodigo` in this same task.
- Produces: `buscarSeriePorCodigo` response gains an optional `producto: { nombre, marca }` field, present only when the lookup succeeds. Consumed by Task 2 (`js/camara-unificada.js`) and Task 3 (`js/camara-serie.js`).
- Consumes: `buscarSerieEnD1()` (existing, unchanged), `body.formato` (new optional input field, sent by Task 2 and Task 3).

- [ ] **Step 1: Confirm current content of `buscarSeriePorCodigo`**

Run: `grep -n "action === 'buscarSeriePorCodigo'" -A 6 functions/api/item.js`

Confirm it matches:

```js
  if (action === 'buscarSeriePorCodigo') {
    const codigo = String(body.codigo || '').trim();
    if (!codigo) return Response.json({ ok: false, error: 'Falta el código' });
    const r = await buscarSerieEnD1(env, codigo, dept, superadmin, genericDept);
    return Response.json({ ok: true, ...r });
  }
```

- [ ] **Step 2: Add the `lookupProductoUpcItemDb` helper**

Add this function immediately after `buscarSerieEnD1` (before `buscarSerieEnRows`) — same area of the file as the other serial/product-resolution helpers:

```js
async function lookupProductoUpcItemDb(codigo) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    let resp;
    try {
      resp = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(codigo)}`, {
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data?.code !== 'OK' || !Array.isArray(data.items) || !data.items.length) return null;
    const item = data.items[0];
    const nombre = String(item.title || '').trim().slice(0, 120);
    const marca = String(item.brand || '').trim();
    if (!nombre && !marca) return null;
    return { nombre, marca };
  } catch (e) {
    return null;
  }
}
```

**Design note:** every failure path inside this function returns `null` — timeout (via `AbortController`, caught by the outer `catch` since an aborted `fetch` rejects), non-200 response, unparseable JSON, `code !== 'OK'`, empty `items` array, or an item with no usable `title`/`brand`. The caller (Step 3) only needs to check truthiness, never inspect an error.

- [ ] **Step 3: Wire the helper into `buscarSeriePorCodigo`**

Replace the block confirmed in Step 1 with:

```js
  if (action === 'buscarSeriePorCodigo') {
    const codigo = String(body.codigo || '').trim();
    const formato = String(body.formato || '').trim();
    if (!codigo) return Response.json({ ok: false, error: 'Falta el código' });
    const r = await buscarSerieEnD1(env, codigo, dept, superadmin, genericDept);
    if (r.match === 'ninguno' && ['ean_13', 'ean_8', 'upc_a', 'upc_e'].includes(formato)) {
      const producto = await lookupProductoUpcItemDb(codigo);
      if (producto) return Response.json({ ok: true, ...r, producto });
    }
    return Response.json({ ok: true, ...r });
  }
```

- [ ] **Step 4: Syntax check**

Run: `node --check functions/api/item.js`
Expected: no output (syntax valid)

- [ ] **Step 5: Commit**

```bash
git add functions/api/item.js
git commit -m "feat: lookup gratuito de producto (UPCitemdb) al no encontrar match por codigo EAN/UPC"
```

---

### Task 2: Frontend — `js/camara-unificada.js` passes `formato` and prefills product on alta

**Files:**
- Modify: `js/camara-unificada.js` — top-level `let` declarations, `openCamaraUnificada()`, `_manejarDeteccionUnificada()`, `camaraUnifCrearItemDesdeCodigo()`.

**Interfaces:**
- Consumes: `buscarSeriePorCodigo`'s new optional `producto` field (Task 1).
- Produces: no new exported functions — internal state additions only.

- [ ] **Step 1: Add a new state variable**

In the top-level `let` block (currently lines 1-11), add a new line after `let _camUnifCodigoPendienteAlta = '';`:

```js
let _camUnifProductoPendienteAlta = null;
```

- [ ] **Step 2: Reset it in `openCamaraUnificada()`**

Find this line inside `openCamaraUnificada()`:

```js
  _camUnifCodigoPendienteAlta = '';
```

Add immediately after it:

```js
  _camUnifProductoPendienteAlta = null;
```

- [ ] **Step 3: Pass `formato` to the backend call**

In `_manejarDeteccionUnificada(valor, formato)`, find:

```js
    const res = await apiPost({ action: 'buscarSeriePorCodigo', codigo: valor });
```

Replace with:

```js
    const res = await apiPost({ action: 'buscarSeriePorCodigo', codigo: valor, formato });
```

- [ ] **Step 4: Capture `res.producto` before showing the "no match" message**

Find this block (the `match:'ninguno'` fallthrough, right after the `exacto`/`fuzzy` handling returns):

```js
    document.getElementById('camaraUnifEstado').style.display = 'none';
    document.getElementById('camaraUnifResultado').style.display = 'block';
    document.getElementById('camaraUnifResultado').innerHTML = '<div style="margin-bottom:8px">No se encontró ningún ítem para ese código.</div><button class="btn btn-p" onclick="camaraUnifCrearItemDesdeCodigo()">➕ Añadir ítem nuevo con este código</button><button class="btn" onclick="camaraUnifReintentar()" style="margin-top:8px">Reintentar</button>';
    return true;
```

Replace with:

```js
    _camUnifProductoPendienteAlta = res.producto || null;
    document.getElementById('camaraUnifEstado').style.display = 'none';
    document.getElementById('camaraUnifResultado').style.display = 'block';
    document.getElementById('camaraUnifResultado').innerHTML = '<div style="margin-bottom:8px">No se encontró ningún ítem para ese código.</div><button class="btn btn-p" onclick="camaraUnifCrearItemDesdeCodigo()">➕ Añadir ítem nuevo con este código</button><button class="btn" onclick="camaraUnifReintentar()" style="margin-top:8px">Reintentar</button>';
    return true;
```

**Design note:** this is the ONLY place `match:'ninguno'` is handled for the barcode-detected path in this file (the fuzzy-candidates branch above it already `return`s before reaching here), so capturing `res.producto` here covers every route into `camaraUnifCrearItemDesdeCodigo()`.

- [ ] **Step 5: Prefill `f_item`/`f_proveedor` in `camaraUnifCrearItemDesdeCodigo()`**

Find:

```js
function camaraUnifCrearItemDesdeCodigo() {
  const codigo = String(_camUnifCodigoPendienteAlta || '').trim();
  window._camaraReturnToScanner = _camUnifQuickMode();
  closeCamaraUnificada();
  openModal();
  setTimeout(() => {
    const serieInput = document.getElementById('f_serie');
    if (serieInput && codigo) serieInput.value = codigo;
    const aulaPref = localStorage.getItem(CAM_PREF_LAST_AULA) || '';
    const catPref = localStorage.getItem(CAM_PREF_LAST_CAT) || '';
    const aulaSel = document.getElementById('f_aula');
    if (aulaSel && aulaPref && [...aulaSel.options].some(o => o.value === aulaPref)) aulaSel.value = aulaPref;
    const catSel = document.getElementById('f_cat');
    if (catSel && catPref && [...catSel.options].some(o => o.value === catPref)) {
      catSel.value = catPref;
      catSel.dataset.prev = catPref;
    }
    const itemInput = document.getElementById('f_item');
    if (itemInput) itemInput.focus();
  }, 50);
}
```

Replace with:

```js
function camaraUnifCrearItemDesdeCodigo() {
  const codigo = String(_camUnifCodigoPendienteAlta || '').trim();
  const producto = _camUnifProductoPendienteAlta;
  window._camaraReturnToScanner = _camUnifQuickMode();
  closeCamaraUnificada();
  openModal();
  setTimeout(() => {
    const serieInput = document.getElementById('f_serie');
    if (serieInput && codigo) serieInput.value = codigo;
    const aulaPref = localStorage.getItem(CAM_PREF_LAST_AULA) || '';
    const catPref = localStorage.getItem(CAM_PREF_LAST_CAT) || '';
    const aulaSel = document.getElementById('f_aula');
    if (aulaSel && aulaPref && [...aulaSel.options].some(o => o.value === aulaPref)) aulaSel.value = aulaPref;
    const catSel = document.getElementById('f_cat');
    if (catSel && catPref && [...catSel.options].some(o => o.value === catPref)) {
      catSel.value = catPref;
      catSel.dataset.prev = catPref;
    }
    const itemInput = document.getElementById('f_item');
    if (itemInput) {
      if (producto?.nombre) itemInput.value = producto.nombre;
      itemInput.focus();
    }
    if (producto?.marca) {
      const provInput = document.getElementById('f_proveedor');
      if (provInput) provInput.value = producto.marca;
    }
  }, 50);
}
```

- [ ] **Step 6: Syntax check**

Run: `node --check js/camara-unificada.js`
Expected: no output (syntax valid)

- [ ] **Step 7: Commit**

```bash
git add js/camara-unificada.js
git commit -m "feat: prellena nombre/proveedor desde lookup de producto en camara unificada"
```

---

### Task 3: Frontend — `js/camara-serie.js` passes `formato` and prefills product on alta

**Files:**
- Modify: `js/camara-serie.js` — `capturarSerie()`'s barcode-detection branch, `_mostrarSerieCrearNuevo()`, `_crearItemDesdeSerie()`.

**Interfaces:**
- Consumes: `buscarSeriePorCodigo`'s new optional `producto` field (Task 1).
- Produces: `_mostrarSerieCrearNuevo(serieLeida, marca, modelo, motivoEncuadre, nombreProducto)` — new 5th optional parameter. Existing callers (the AI-OCR path, which never passes a 5th argument) are unaffected since `nombreProducto` defaults to falsy and the function falls back to the current `[marca, modelo].join(' ')` behavior.

- [ ] **Step 1: Confirm current content of the barcode branch in `capturarSerie()`**

Run: `grep -n "if (window.BarcodeDetector)" -A 45 js/camara-serie.js`

Confirm it matches (this is the block inside `capturarSerie()`, already gated by `if (_serieDestinoFormulario) { ...; return; }` earlier in the same `if (codigos.length)` block — that early return is untouched by this task, per the Global Constraints scope boundary):

```js
        const resCodigo = await apiPost({ action: 'buscarSeriePorCodigo', codigo: codigos[0].rawValue });
        if (!resCodigo.ok) {
          _mostrarSerieError(resCodigo.error || 'No se pudo comprobar el código detectado');
          video.style.display = 'none';
          capturarBtn.style.display = 'none';
          return;
        }
        if (resCodigo.ok && (resCodigo.match === 'exacto' || resCodigo.match === 'fuzzy')) {
          if (resCodigo.match === 'exacto') {
            _seriePulseDetected();
            window._camaraReturnToScanner = _serieQuickMode();
            closeCamaraSerie();
            if (typeof items !== 'undefined' && Array.isArray(items) && !items.some(x => x.id === resCodigo.item.id)) {
              items.push(resCodigo.item);
            }
            openItemRoute(resCodigo.item.id);
            return;
          }
          _mostrarSerieCandidatos(resCodigo.candidatos);
          video.style.display = 'none';
          capturarBtn.style.display = 'none';
          return;
        }
        _mostrarSerieCrearNuevo(String(codigos[0].rawValue || '').trim(), '', '');
        video.style.display = 'none';
        capturarBtn.style.display = 'none';
        return;
```

- [ ] **Step 2: Pass `formato` and use `producto` in the "no match" fallback**

Replace the two lines:

```js
        const resCodigo = await apiPost({ action: 'buscarSeriePorCodigo', codigo: codigos[0].rawValue });
```

and

```js
        _mostrarSerieCrearNuevo(String(codigos[0].rawValue || '').trim(), '', '');
```

with:

```js
        const resCodigo = await apiPost({ action: 'buscarSeriePorCodigo', codigo: codigos[0].rawValue, formato: codigos[0].format });
```

and:

```js
        _mostrarSerieCrearNuevo(String(codigos[0].rawValue || '').trim(), resCodigo.producto?.marca || '', '', undefined, resCodigo.producto?.nombre || '');
```

(Every other line in the block from Step 1 stays exactly as-is — only these two lines change.)

- [ ] **Step 3: Add the `nombreProducto` parameter to `_mostrarSerieCrearNuevo`**

Find:

```js
function _mostrarSerieCrearNuevo(serieLeida, marca, modelo, motivoEncuadre) {
  _serieLeidaPendiente = serieLeida;
  _marcaPendiente = marca || '';
  _modeloPendiente = modelo || '';
  const resultado = document.getElementById('serieResultado');
  resultado.style.display = 'block';
  const nombreDetectado = [marca, modelo].filter(Boolean).join(' ').trim();
```

Replace with:

```js
function _mostrarSerieCrearNuevo(serieLeida, marca, modelo, motivoEncuadre, nombreProducto) {
  _serieLeidaPendiente = serieLeida;
  _marcaPendiente = marca || '';
  _modeloPendiente = modelo || '';
  _productoNombrePendiente = nombreProducto || '';
  const resultado = document.getElementById('serieResultado');
  resultado.style.display = 'block';
  const nombreDetectado = nombreProducto || [marca, modelo].filter(Boolean).join(' ').trim();
```

- [ ] **Step 4: Declare the new state variable**

Find the top-level `let` block (currently lines 1-15), which includes:

```js
let _serieIntentoPrevio = null;
let _serieCarryIntentoPrevio = false;
```

Add immediately after:

```js
let _productoNombrePendiente = '';
```

- [ ] **Step 5: Reset it in `openCamaraSerie()`**

Find this line inside `openCamaraSerie()`:

```js
  _nombreSugeridoPendiente = '';
```

Add immediately after it:

```js
  _productoNombrePendiente = '';
```

- [ ] **Step 6: Use it in `_crearItemDesdeSerie()`**

Find:

```js
function _crearItemDesdeSerie() {
  const serie = _serieLeidaPendiente;
  const marca = _marcaPendiente;
  const modelo = _modeloPendiente;
  _registrarFeedbackDeteccion({
    tipo: 'alta_desde_serie',
    nombre: [marca, modelo].filter(Boolean).join(' ').trim(),
    serie,
    marca,
    modelo
  });
```

Replace with:

```js
function _crearItemDesdeSerie() {
  const serie = _serieLeidaPendiente;
  const marca = _marcaPendiente;
  const modelo = _modeloPendiente;
  const nombreProducto = _productoNombrePendiente;
  _registrarFeedbackDeteccion({
    tipo: 'alta_desde_serie',
    nombre: nombreProducto || [marca, modelo].filter(Boolean).join(' ').trim(),
    serie,
    marca,
    modelo
  });
```

Then find, further down in the same function:

```js
    const nombreDetectado = [marca, modelo].filter(Boolean).join(' ').trim();
    if (nombreDetectado) {
      const itemInput = document.getElementById('f_item');
      if (itemInput) itemInput.value = nombreDetectado;
    }
```

Replace with:

```js
    const nombreDetectado = nombreProducto || [marca, modelo].filter(Boolean).join(' ').trim();
    if (nombreDetectado) {
      const itemInput = document.getElementById('f_item');
      if (itemInput) itemInput.value = nombreDetectado;
    }
```

The next lines (`if (marca) { const provInput = ...; provInput.value = marca; }`) stay unchanged — `marca` is still set from `resCodigo.producto?.marca` (Step 2), so the provider field prefill continues to work for the barcode path exactly like it already does for the AI-OCR path.

**Design note:** `nombreProducto` (from UPCitemdb, e.g. `"TP-Link Archer TX3000E AXE5400 Wi-Fi 6E Router"`) is a full product title, so it takes priority over `[marca, modelo].join(' ')` to avoid duplicating the brand name (e.g. `"TP-Link" + "TP-Link Archer TX3000E..."`). When `nombreProducto` is absent (the existing AI-OCR path, or a barcode lookup that returned no `producto`), behavior is byte-for-byte identical to before this task.

- [ ] **Step 7: Syntax check**

Run: `node --check js/camara-serie.js`
Expected: no output (syntax valid)

- [ ] **Step 8: Commit**

```bash
git add js/camara-serie.js
git commit -m "feat: prellena nombre/proveedor desde lookup de producto en camara-serie"
```

---

### Task 4: Bump service worker version and end-to-end verification

**Files:**
- Modify: `sw.js` (`VERSION` constant)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new — deployment/cache-busting step only

- [ ] **Step 1: Bump VERSION in sw.js**

Read `sw.js`, find the current `VERSION` constant, increment it by 1, matching the existing format exactly (confirm the actual current value first — it may have moved past `v577` since this plan was written).

- [ ] **Step 2: Commit the version bump**

```bash
git add sw.js
git commit -m "chore: bump version tras lookup de producto por codigo de barras"
```

- [ ] **Step 3: Push and wait for Cloudflare Pages deploy**

```bash
git push origin main
```

Wait for Cloudflare Pages auto-deploy to complete before verification (fetch `sw.js`'s deployed `VERSION` value directly — remember this project's corporate network requires `NODE_TLS_REJECT_UNAUTHORIZED=0` / `curl -k` for outbound HTTPS, per `CLAUDE.md`).

- [ ] **Step 4: End-to-end verification in production with Playwright**

Using the `playwright-skill`, log in to `boscoinventario.pages.dev` with a test account (e.g. `Seba`/`Seba`), and verify each case below. Since a real physical EAN/UPC barcode isn't available for automated testing, mock `window.BarcodeDetector` via `page.addInitScript()`/`page.evaluate()` before opening the camera, same pattern used in prior sessions of this project (see `docs/superpowers/plans/2026-08-02-lectura-codigo-barras.md`'s Task 5).

1. **Lookup succeeds and prefills the form:** mock `BarcodeDetector.detect()` to resolve `[{ rawValue: '<a UPC/EAN code not present in D1 for this department>', format: 'ean_13' }]`. Mock the network response for `buscarSeriePorCodigo` to return `{ok:true, match:'ninguno', producto:{nombre:'Producto de Prueba XYZ', marca:'MarcaTest'}}`. Confirm the request payload sent to `buscarSeriePorCodigo` includes `formato:'ean_13'`, and that after clicking "Añadir ítem nuevo con este código", the opened item-creation modal has `f_item` = `"Producto de Prueba XYZ"` and `f_proveedor` = `"MarcaTest"`.
2. **Lookup fails silently, no regression:** same mock detection, but mock `buscarSeriePorCodigo`'s response as `{ok:true, match:'ninguno'}` (no `producto` field — simulating a UPCitemdb failure already handled server-side). Confirm the item-creation modal opens with `f_serie` prefilled from the code, but `f_item`/`f_proveedor` empty — exactly today's behavior, no error shown.
3. **`code_128` never triggers a lookup:** mock `BarcodeDetector.detect()` to resolve a `code_128` value not in D1. Intercept the network request to `buscarSeriePorCodigo` and confirm the request is sent with `formato:'code_128'` — this alone doesn't prove the backend skipped the lookup (that's a server-side decision), so also confirm via Task 1's logic reading that a `code_128` value can never enter the `['ean_13','ean_8','upc_a','upc_e'].includes(formato)` branch; treat this as a code-inspection check paired with confirming the response has no `producto` field when the mock backend doesn't provide one.
4. **Regression — exact/fuzzy match still works:** mock a barcode that DOES match an existing item (`buscarSeriePorCodigo` mock returns `match:'exacto'`) — confirm the item opens directly, with no lookup-related code path involved (the lookup only runs when `match==='ninguno'`, verified in Task 1).
5. **Repeat cases 1-2 through `js/camara-unificada.js`'s entry point** (the unified QR/barcode button, `#gsCamara`), not just `js/camara-serie.js` — confirm the same prefill behavior applies there too, since both files were modified independently in Tasks 2 and 3.

Report actual observed behavior for each case — do not assume success without observing the response/DOM state in the browser (per `superpowers:verification-before-completion`).

- [ ] **Step 5: Fix any issues found during verification**

If any case fails, use `superpowers:systematic-debugging` to diagnose before patching.

## Self-Review Notes

- **Spec coverage:** all sections of `docs/superpowers/specs/2026-08-03-lookup-producto-codigo-barras-design.md` are covered — UPCitemdb lookup gated to EAN/UPC formats only and only on `match:'ninguno'` (Task 1), silent fallback on any failure (Task 1's helper, verified in Task 4 Step 4.2), prefill in both frontend entry points (Tasks 2 and 3), explicit non-goals respected (no category autofill — `producto` only carries `nombre`/`marca`; `_serieDestinoFormulario` untouched — Task 3 only touches the barcode-detected branch that runs after that mode's early return).
- **No placeholders:** all code blocks are complete and copy-pasteable. Steps that read live code first (Task 1 Step 1, Task 3 Step 1) are legitimate "confirm against current state" checks, not deferred design decisions — consistent with how this project's prior plans handle the risk of concurrent edits to shared files.
- **Type/name consistency:** `lookupProductoUpcItemDb(codigo)` is defined once (Task 1) and its return shape `{nombre, marca} | null` is consumed identically by both frontend files via `res.producto?.nombre`/`res.producto?.marca` (Tasks 2 and 3). The new `_mostrarSerieCrearNuevo` 5th parameter is named `nombreProducto` consistently at its definition (Task 3 Step 3) and at its two call sites — the existing AI-OCR call site (unchanged, omits the argument) and the new barcode call site (Task 3 Step 2, passes it explicitly).
- **Backward compatibility explicitly verified:** `_mostrarSerieCrearNuevo`'s existing caller (the AI-OCR `match:'ninguno'` path, already in the codebase, not modified by this plan) never passes a 5th argument, so `nombreProducto` is `undefined` there and the function falls back to `[marca, modelo].join(' ')` exactly as it does today — Task 3's design note calls this out explicitly.
