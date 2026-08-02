# Lectura de Código de Barras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before sending a captured photo to the AI for serial-number OCR, attempt to decode a linear barcode from the same photo using the browser's native `BarcodeDetector` API. If a barcode decodes to a value that matches (or fuzzy-matches) an item already in D1, skip the AI call entirely and resolve instantly. If no barcode is found, decoding fails, or the decoded value has no match, fall through to the exact same AI flow that exists today — zero UX change in that case.

**Architecture:** A new backend action (`buscarSeriePorCodigo`) accepts an already-decoded text value (not an image) and searches D1 directly — no Workers AI call. The existing `buscarPorSerie` action's exact/fuzzy D1 search logic is extracted into a shared function (`buscarSerieEnD1`) so both actions use one copy, not two — this project has hit the "duplicated logic silently diverges" bug three times already (`HEADERS_INV`, category scoping, `data-perm`), and this plan avoids adding a fourth instance from day one. The frontend (`js/camara-serie.js`) tries `BarcodeDetector` on the captured canvas before falling back to the existing `buscarPorSerie` call.

**Tech Stack:** Cloudflare Pages Functions (JS), Cloudflare D1, native browser `BarcodeDetector` API (no new library), vanilla JS frontend.

## Global Constraints

- Scope is linear barcodes only: `code_128`, `ean_13`, `ean_8`, `upc_a`, `upc_e`. No 2D codes (DataMatrix), no continuous scanning.
- The decode attempt runs on the SAME already-captured canvas frame that the existing flow already produces — no new camera mode, no new button, no new modal.
- If `window.BarcodeDetector` doesn't exist, or exists but detects nothing, the code must fall through to the EXACT existing `buscarPorSerie` call with no behavior change and no visible delay from the failed detection attempt (barcode detection on a single still frame is fast — sub-100ms typically — so no loading-state changes are needed for this attempt).
- The new backend action must reuse the SAME D1 query logic `buscarPorSerie` already uses for exact/fuzzy serial matching — via a shared function, not a second copy. Any change to the department-scoping filter must apply to both callers automatically because there is only one copy.
- No new D1 migration.
- `sw.js` `VERSION` must be bumped as the final step (project workflow in `CLAUDE.md`).
- Verification is manual/Playwright against production — this project has no automated test suite.

---

### Task 1: Backend — extract shared D1 search function

**Files:**
- Modify: `functions/api/item.js` — extract lines 364-385 (the existing exact/fuzzy serial search inside `buscarPorSerie`) into a new standalone function, then call it from `buscarPorSerie`.

**Interfaces:**
- Produces: `async function buscarSerieEnD1(env, serieLeida, dept, superadmin, genericDept)` → returns `{ match: 'exacto', item }` | `{ match: 'fuzzy', candidatos }` | `{ match: 'ninguno' }` (plain object, NOT a `Response` — the caller wraps it in `Response.json({ ok: true, ...result })`). Consumed by both `buscarPorSerie` (Task 1, this task) and the new `buscarSeriePorCodigo` action (Task 2).
- Consumes: `env.DB` (D1 binding), the existing `levenshtein()` helper function already defined later in this same file (verify it's defined as a plain top-level function, not nested inside `buscarPorSerie`'s block, so it's callable from the new extracted function — it should already be, since `buscarPorSerie`'s current code calls it the same way).

- [ ] **Step 1: Read the current exact block to confirm line numbers**

Run: `grep -n "if (serieLeida) {" -A 20 functions/api/item.js`

Confirm the block matches this shape (line numbers may have shifted slightly from concurrent work, but the content should match):

```js
    if (serieLeida) {
      const exact = await env.DB.prepare(`SELECT * FROM inventario WHERE serie=?${deptFilter}`)
        .bind(serieLeida, ...deptBind).first();
      if (exact) return Response.json({ ok: true, match: 'exacto', item: exact });

      const candidatesRes = await env.DB.prepare(`SELECT id, item, ref, aula, serie FROM inventario WHERE serie != ''${deptFilter}`)
        .bind(...deptBind).all();
      const candidatos = (candidatesRes.results || [])
        .map(r => ({ ...r, _dist: levenshtein(r.serie, serieLeida) }))
        .filter(r => r._dist <= 2)
        .sort((a, b) => a._dist - b._dist)
        .slice(0, 5)
        .map(({ _dist, ...r }) => r);

      if (candidatos.length) return Response.json({ ok: true, match: 'fuzzy', candidatos });
      return Response.json({ ok: true, match: 'ninguno', serieLeida, marca, modelo });
    }
```

**Note:** the final line `return Response.json({ ok: true, match: 'ninguno', serieLeida, marca, modelo });` includes `serieLeida`, `marca`, `modelo` — these are variables from `buscarPorSerie`'s OWN scope (parsed from the AI response), NOT available inside a generic shared function that only knows about a bare `serieLeida` string with no `marca`/`modelo`. The extracted function must NOT include `marca`/`modelo` in its `ninguno` return — `buscarPorSerie` will add them back itself when it wraps the shared function's result (see Step 3).

- [ ] **Step 2: Add the new shared function**

Add this function near `levenshtein()` (same general area of the file, both are small D1/string helpers used by the serial-search actions):

```js
async function buscarSerieEnD1(env, serieLeida, dept, superadmin, genericDept) {
  const deptFilter = superadmin
    ? ''
    : ` AND (oculto IS NULL OR oculto != 1) AND (departamento=? OR departamento='${genericDept}')`;
  const deptBind = superadmin ? [] : [dept];

  const exact = await env.DB.prepare(`SELECT * FROM inventario WHERE serie=?${deptFilter}`)
    .bind(serieLeida, ...deptBind).first();
  if (exact) return { match: 'exacto', item: exact };

  const candidatesRes = await env.DB.prepare(`SELECT id, item, ref, aula, serie FROM inventario WHERE serie != ''${deptFilter}`)
    .bind(...deptBind).all();
  const candidatos = (candidatesRes.results || [])
    .map(r => ({ ...r, _dist: levenshtein(r.serie, serieLeida) }))
    .filter(r => r._dist <= 2)
    .sort((a, b) => a._dist - b._dist)
    .slice(0, 5)
    .map(({ _dist, ...r }) => r);

  if (candidatos.length) return { match: 'fuzzy', candidatos };
  return { match: 'ninguno' };
}
```

- [ ] **Step 3: Replace `buscarPorSerie`'s inline block with a call to the shared function**

Replace the `if (serieLeida) { ... }` block found in Step 1 with:

```js
    if (serieLeida) {
      const r = await buscarSerieEnD1(env, serieLeida, dept, superadmin, genericDept);
      if (r.match === 'ninguno') return Response.json({ ok: true, match: 'ninguno', serieLeida, marca, modelo });
      return Response.json({ ok: true, ...r });
    }
```

**Design note:** `buscarPorSerie`'s own `deptFilter`/`deptBind` variables (declared right before this block, currently lines 364-367) are STILL needed after this change — they're reused a few lines below by the `visual` match branch (`if (descripcionVisual || categoriaSugerida) { ... deptFilter ... }`). Do not delete those two `const` declarations — only the `if (serieLeida)` block's BODY is replaced; the `deptFilter`/`deptBind` declarations immediately above it stay exactly as they are, since the shared function computes its own independent copy of the same filter internally (this is intentional duplication of a 4-line filter expression, not the kind of drift-prone duplication this plan is trying to avoid — the filter LOGIC itself only needs to be correct in one conceptual place, and both copies are trivial one-liners that are easy to keep in sync by inspection, unlike a 15-line SQL+fuzzy-matching block).

- [ ] **Step 4: Syntax check**

Run: `node --check functions/api/item.js`
Expected: no output (syntax valid)

- [ ] **Step 5: Commit**

```bash
git add functions/api/item.js
git commit -m "refactor: extrae búsqueda de serie en D1 a función compartida buscarSerieEnD1"
```

---

### Task 2: Backend — new `buscarSeriePorCodigo` action

**Files:**
- Modify: `functions/api/item.js` — add a new action block, placed after `buscarPorSerie`'s block (Task 1 leaves `buscarPorSerie` ending around the same place it does today) and before `detectarMultiples`'s block.

**Interfaces:**
- Consumes: `buscarSerieEnD1()` (from Task 1), `dept`, `superadmin`, `genericDept` (already in scope in `onRequestPost`).
- Produces: `POST /api/item {action:'buscarSeriePorCodigo', codigo: '<decoded barcode text>'}` → `{ok:true, match:'exacto'|'fuzzy'|'ninguno', ...}` (same response shape `buscarSerieEnD1` returns, wrapped) on success, `{ok:false, error:'...'}` if `codigo` is missing. Consumed by Task 4's `js/camara-serie.js`.

- [ ] **Step 1: Add the `buscarSeriePorCodigo` action**

Insert this new block right after `buscarPorSerie`'s closing `}` (found in Task 1's context — the block ends with the `return Response.json({ ok: true, match: 'sin_lectura' });` line that closes out `buscarPorSerie`), before the `if (action === 'detectarMultiples')` block:

```js
  if (action === 'buscarSeriePorCodigo') {
    const codigo = String(body.codigo || '').trim();
    if (!codigo) return Response.json({ ok: false, error: 'Falta el código' });
    const r = await buscarSerieEnD1(env, codigo, dept, superadmin, genericDept);
    return Response.json({ ok: true, ...r });
  }

```

**Design note:** unlike `buscarPorSerie`'s `ninguno` response (which includes `serieLeida`/`marca`/`modelo` parsed from the AI's answer), this action's `ninguno` response has nothing extra to add — there's no AI call here, so there's no marca/modelo to report. The frontend (Task 4) is expected to fall back to the full `buscarPorSerie` call in this case, which will independently produce its own `marca`/`modelo` if the AI finds any.

- [ ] **Step 2: Syntax check**

Run: `node --check functions/api/item.js`
Expected: no output (syntax valid)

- [ ] **Step 3: Commit**

```bash
git add functions/api/item.js
git commit -m "feat: acción buscarSeriePorCodigo para búsqueda directa por código de barras decodificado"
```

---

### Task 3: Register `buscarSeriePorCodigo` in permission tables

**Files:**
- Modify: `js/api.js` (`ENDPOINT_MAP`)
- Modify: `js/roles.js` (`ACTION_PERMISSIONS`)

**Interfaces:**
- Consumes: nothing new
- Produces: `apiPost({action:'buscarSeriePorCodigo', ...})` becomes routable and permission-checked — consumed by Task 4's `js/camara-serie.js`.

- [ ] **Step 1: Add to `ENDPOINT_MAP`**

In `js/api.js`, find the line (currently line 6, may have shifted):
```js
  add:'item', update:'item', delete:'item', bulkImport:'item', restoreBackup:'item', toggleOculto:'item', fotosGet:'item', fotosSync:'item', buscarPorSerie:'item', detectarMultiples:'item',
```
Add `buscarSeriePorCodigo:'item',` to this same line:
```js
  add:'item', update:'item', delete:'item', bulkImport:'item', restoreBackup:'item', toggleOculto:'item', fotosGet:'item', fotosSync:'item', buscarPorSerie:'item', detectarMultiples:'item', buscarSeriePorCodigo:'item',
```

- [ ] **Step 2: Add to `ACTION_PERMISSIONS`**

In `js/roles.js`, find the line:
```js
  buscarPorSerie: 'serie.read',
```
Add a new line immediately after it (or after `detectarMultiples: 'serie.read',` if that line already sits there from a prior feature — either position is fine, group with the other serie-related actions):
```js
  buscarSeriePorCodigo: 'serie.read',
```

Reuses the same `serie.read` permission — already treated as a universal-read permission by `can()`'s special-case (verified in prior sessions of this project), so no additional code is needed for this permission string to work correctly.

- [ ] **Step 3: Syntax check**

Run: `node --check js/api.js && node --check js/roles.js`
Expected: no output (syntax valid)

- [ ] **Step 4: Commit**

```bash
git add js/api.js js/roles.js
git commit -m "feat: registra buscarSeriePorCodigo en ENDPOINT_MAP y ACTION_PERMISSIONS"
```

---

### Task 4: Frontend — attempt barcode detection before the AI call

**Files:**
- Modify: `js/camara-serie.js` — inside `capturarSerie()`, add a barcode-detection attempt right after the canvas is drawn and before the `buscarPorSerie` call.

**Interfaces:**
- Consumes: `window.BarcodeDetector` (native browser API, may not exist), the existing `canvas` element already created inside `capturarSerie()`, `apiPost()` (existing), the existing `_mostrarSerieCandidatos()` function (existing, reused as-is for the `fuzzy` case).
- Produces: no new exported functions — this is a code insertion inside the existing `capturarSerie()` function.

- [ ] **Step 1: Read the current `capturarSerie()` to confirm the exact insertion point**

Run: `grep -n "async function capturarSerie" -A 25 js/camara-serie.js`

Confirm the function's current shape matches (canvas created and drawn, then `video.style.display='none'` etc., then the `try { const res = await apiPost({ action: 'buscarPorSerie', ... }) ... }` block). Line numbers may have shifted from concurrent work — insert relative to this content, not a hardcoded line number.

- [ ] **Step 2: Add the barcode-detection attempt**

Insert this code right after the line that draws the canvas (`canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);`) and BEFORE the `const dataUrl = canvas.toDataURL(...)` line — i.e., attempt detection on the canvas element itself, before it's ever converted to a data URL (both operations can happen on the same canvas independently, order doesn't matter functionally, but doing barcode detection first means the canvas is used for its more specific purpose before being flattened to base64 for the generic AI path):

```js
  if (window.BarcodeDetector) {
    try {
      const detector = new BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const codigos = await detector.detect(canvas);
      if (codigos.length) {
        const resCodigo = await apiPost({ action: 'buscarSeriePorCodigo', codigo: codigos[0].rawValue });
        if (resCodigo.ok && (resCodigo.match === 'exacto' || resCodigo.match === 'fuzzy')) {
          if (resCodigo.match === 'exacto') {
            closeCamaraSerie();
            if (typeof items !== 'undefined' && Array.isArray(items) && !items.some(x => x.id === resCodigo.item.id)) {
              items.push(resCodigo.item);
            }
            openItemRoute(resCodigo.item.id);
            _serieCapturing = false;
            return;
          }
          _mostrarSerieCandidatos(resCodigo.candidatos);
          _serieCapturing = false;
          return;
        }
      }
    } catch (e) {
      // Falla silenciosa: si BarcodeDetector existe pero lanza un error
      // (ej. formato no soportado por este navegador concreto), se sigue
      // con el flujo normal de IA sin interrumpir al usuario.
    }
  }
```

**Design notes:**
- This block goes BEFORE the existing `video.style.display = 'none'; ...` UI-state-change lines, so if a barcode match is found, the user never even sees the "Leyendo etiqueta..." loading state — the resolution is fast enough that showing then immediately hiding that state would be visually jarring for no benefit.
- Both early-return paths (`exacto` and `fuzzy`) explicitly reset `_serieCapturing = false` before returning, matching the existing function's `finally` block behavior for the AI path (this code runs BEFORE that `try/finally`, so it needs its own reset — verify this by reading the full function in Step 1, since `_serieCapturing = true` was already set at the top of `capturarSerie()` before this new block runs).
- `match === 'ninguno'` (barcode decoded but no D1 match) deliberately does NOT return here — execution falls through to the rest of the function unchanged, which proceeds to the existing `video.style.display='none'` lines and the normal `buscarPorSerie` AI call, exactly as if no barcode had been attempted at all.
- The `try/catch` around the whole `BarcodeDetector` usage ensures ANY failure (unsupported format, browser quirk, detector throwing for any reason) falls through silently to the existing flow — this is a deliberate best-effort optimization, never a hard requirement.

- [ ] **Step 3: Syntax check**

Run: `node --check js/camara-serie.js`
Expected: no output (syntax valid)

- [ ] **Step 4: Commit**

```bash
git add js/camara-serie.js
git commit -m "feat: intenta leer código de barras antes de llamar a la IA en buscarPorSerie"
```

---

### Task 5: Bump service worker version and end-to-end verification

**Files:**
- Modify: `sw.js` (VERSION constant)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new — deployment/cache-busting step only

- [ ] **Step 1: Bump VERSION in sw.js**

Read `sw.js`, find the current `VERSION` constant, increment it by 1, matching the existing format exactly (confirm the actual current value first — it may have moved since this plan was written, e.g. past `v548`).

- [ ] **Step 2: Commit the version bump**

```bash
git add sw.js
git commit -m "chore: bump version tras lectura de código de barras"
```

- [ ] **Step 3: Push and wait for Cloudflare Pages deploy**

```bash
git push origin main
```

Wait for Cloudflare Pages auto-deploy to complete before verification (fetch `sw.js`'s deployed `VERSION` value directly — remember this project's corporate network requires `NODE_TLS_REJECT_UNAUTHORIZED=0` / `curl -k` for outbound HTTPS, per `CLAUDE.md`).

- [ ] **Step 4: End-to-end verification in production with Playwright**

Using the `playwright-skill`, log in to `boscoinventario.pages.dev` with a test account (e.g. `Seba`/`Seba`), open the camera-search modal, and verify:

1. **Barcode match skips AI:** inject a mock `window.BarcodeDetector` class into the page (via `page.addInitScript()` or `page.evaluate()` before opening the camera, since a real physical barcode isn't available for automated testing) whose `detect()` resolves to `[{ rawValue: '<a real serie value already in D1 for this department>' }]`. Intercept network requests: confirm `buscarSeriePorCodigo` is called and `buscarPorSerie` is NEVER called, and that the item opens directly (`match:'exacto'` path).
2. **Barcode decoded but no match falls through to AI:** same mock, but `rawValue` set to a value that doesn't exist in D1 (`buscarSeriePorCodigo` returns `match:'ninguno'`) — confirm `buscarPorSerie` IS subsequently called with the same photo (intercept and confirm both network calls happen in order), and the existing AI-based flow proceeds normally from there (mock `buscarPorSerie`'s response too, to complete the trace deterministically).
3. **No `BarcodeDetector` support:** do NOT inject the mock (or explicitly delete `window.BarcodeDetector` before capture) — confirm the flow goes straight to `buscarPorSerie` with no `buscarSeriePorCodigo` call at all, and behaves identically to how it did before this feature (no visible delay, no console errors).
4. **Regression on `buscarPorSerie` after the Task 1 refactor:** with no barcode mock, verify a serial-number-based search (mocking `buscarPorSerie`'s response directly, same as prior sessions' verification approach) still correctly returns `exacto`/`fuzzy`/`ninguno` matches exactly as before — this confirms the extraction of `buscarSerieEnD1()` didn't change `buscarPorSerie`'s externally-observable behavior.

Report actual observed behavior for each case — do not assume success without observing the response in the browser (per `superpowers:verification-before-completion`).

- [ ] **Step 5: Fix any issues found during verification**

If any case fails, use `superpowers:systematic-debugging` to diagnose before patching.

## Self-Review Notes

- **Spec coverage:** all sections of `docs/superpowers/specs/2026-08-02-lectura-codigo-barras-design.md` are covered — shared `buscarSerieEnD1()` extraction to avoid a fourth instance of this project's recurring duplicated-logic bug (Task 1), new `buscarSeriePorCodigo` action with no AI call (Task 2), permission registration (Task 3), barcode-detection-before-AI in the frontend with silent fallback (Task 4), verification of both the happy path and the no-support/no-match fallback paths (Task 5).
- **No placeholders:** all code blocks are complete and copy-pasteable. Task 1 Step 1 and Task 4 Step 1 both require reading live code first since line numbers may have shifted — these are legitimate "confirm against current state" steps, not deferred design decisions, consistent with how other plans in this project's history have handled the same risk from concurrent work on shared files.
- **Type/name consistency:** `buscarSerieEnD1` is defined once (Task 1) and called identically from both `buscarPorSerie` (Task 1) and `buscarSeriePorCodigo` (Task 2) with the same five-argument signature `(env, serieLeida, dept, superadmin, genericDept)`. The action name `buscarSeriePorCodigo` matches exactly across the backend handler (Task 2), `ENDPOINT_MAP`/`ACTION_PERMISSIONS` (Task 3), and the frontend's `apiPost()` call (Task 4).
- **Explicit avoidance of the project's recurring bug class:** this plan's Global Constraints section and Task 1's design note both call out, by name, the exact history (`HEADERS_INV`, category scoping, `data-perm`) that motivated extracting a shared function instead of writing a second copy of the D1 search logic — this was a direct, explicit product decision made during brainstorming specifically to prevent a fourth occurrence, not an incidental implementation choice.
