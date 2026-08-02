# Enlaces a Manual/Datasheet/Vídeo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the item edit/create modal, show three links (Manual, Datasheet, Video) that open pre-built Google search queries combining the item's provider and name — for ANY item with both fields filled, not just ones created via the camera flow.

**Architecture:** Pure frontend addition. Three `<a>` elements are added next to the existing `#f_proveedor` field in `index.html`'s DETALLES section. A new function in `js/modal-item.js` recomputes their `href` (and visibility) from the live values of `#f_proveedor` and `#f_item`, called once when the modal opens and again on every `input`/`change` of those two fields.

**Tech Stack:** Vanilla JS, no build step, no test framework (verification is manual/Playwright against production, per project convention).

## Global Constraints

- No backend changes, no new D1 migration, no new actions in `js/api.js`/`js/roles.js` — this feature reads only already-loaded DOM field values.
- Search engine: Google (`https://www.google.com/search?q=`) — no API key, no external dependency, matching the plan's explicit choice to avoid any paid/curated infrastructure.
- Provider and item name values MUST go through `encodeURIComponent()` before being embedded in the search URL — raw concatenation would break the query string on `&`, `+`, `#`, etc. (a real category name in this project's own data, e.g. "Audiovisual & Sonido", already contains `&`).
- Links are visible/enabled ONLY when both `#f_proveedor` and `#f_item` have non-empty (post-`.trim()`) values — showing a search link built from an empty or single-word query is not useful and was explicitly excluded from scope.
- `sw.js` `VERSION` must be bumped as the final step (project workflow in `CLAUDE.md`).
- Verification is manual/Playwright against production — this project has no automated test suite.

---

### Task 1: HTML — three link elements next to the Proveedor field

**Files:**
- Modify: `index.html` — inside the `#mSecDetalles` section, right after the existing Proveedor field (currently `index.html:689`)

**Interfaces:**
- Produces: DOM elements `#linkManual`, `#linkDatasheet`, `#linkVideo` (all `<a>` tags) — consumed by Task 2's `js/modal-item.js` function, which sets their `href` and visibility.

- [ ] **Step 1: Add the three links**

In `index.html`, find the Proveedor field (currently):
```html
          <div><label class="fl">Proveedor</label><input class="fi-w" id="f_proveedor" placeholder="Proveedor, tienda o URL"></div>
```

Replace it with (wrapping the existing input, unchanged, plus the three new links right below it in the same `<div>`):
```html
          <div>
            <label class="fl">Proveedor</label>
            <input class="fi-w" id="f_proveedor" placeholder="Proveedor, tienda o URL">
            <div id="linksManualWrap" style="display:none;margin-top:4px;display:flex;gap:10px;font-size:12px">
              <a id="linkManual" href="#" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">📄 Manual</a>
              <a id="linkDatasheet" href="#" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">📋 Datasheet</a>
              <a id="linkVideo" href="#" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">🎥 Vídeo</a>
            </div>
          </div>
```

**Note:** `#linksManualWrap`'s inline style has `display:none` listed before `display:flex` — this is intentional-looking but is actually a mistake to avoid: the SECOND `display` declaration in an inline `style` attribute wins (CSS cascade within the same attribute, later wins), so as written this element would default to VISIBLE (`flex`), not hidden. Fix this before committing: use only `display:none` in the initial inline style (Task 2's JS will set it to `flex` when both fields have content):
```html
            <div id="linksManualWrap" style="display:none;margin-top:4px;gap:10px;font-size:12px">
```
(i.e., remove the `display:flex` from the inline style entirely — keep only `display:none` initially, and let Task 2's JS set `.style.display = 'flex'` when appropriate).

- [ ] **Step 2: Visual verification**

Re-read the modified region of `index.html` to confirm the three `<a>` tags and their ids are present, the wrapping `<div>` is well-formed, and the inline style only has ONE `display` declaration (per Step 1's note).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: enlaces de manual/datasheet/vídeo junto al campo Proveedor"
```

---

### Task 2: Frontend — compute and refresh the three search URLs

**Files:**
- Modify: `js/modal-item.js` — add a new function, call it once at modal-open time, and attach it as a listener to `#f_proveedor`/`#f_item`

**Interfaces:**
- Consumes: `document.getElementById('f_proveedor')`, `document.getElementById('f_item')` (existing form fields, already present in the modal at the time this runs), `#linksManualWrap`/`#linkManual`/`#linkDatasheet`/`#linkVideo` (from Task 1).
- Produces: a new function `_actualizarEnlacesManual()`, called from `openModal()` (existing function, right where `captureModalOriginalValues()` is already called) and from new `input` listeners on `#f_proveedor` and `#f_item`.

- [ ] **Step 1: Add `_actualizarEnlacesManual()`**

In `js/modal-item.js`, add this function near the top of the file (alongside the other small modal-state helper functions like `markModalAsChanged`/`updateModalIndicator`, currently around lines 15-37):

```js
function _actualizarEnlacesManual(){
  const wrap = document.getElementById('linksManualWrap');
  if(!wrap) return;
  const proveedor = (document.getElementById('f_proveedor')?.value || '').trim();
  const nombre = (document.getElementById('f_item')?.value || '').trim();
  if(!proveedor || !nombre){
    wrap.style.display = 'none';
    return;
  }
  const base = encodeURIComponent(`${proveedor} ${nombre}`);
  document.getElementById('linkManual').href = `https://www.google.com/search?q=${base}+manual+pdf`;
  document.getElementById('linkDatasheet').href = `https://www.google.com/search?q=${base}+datasheet`;
  document.getElementById('linkVideo').href = `https://www.google.com/search?q=${base}+tutorial+video`;
  wrap.style.display = 'flex';
}
```

**Design note:** `encodeURIComponent()` is applied to the COMBINED `"${proveedor} ${nombre}"` string once, then the keyword suffix (`+manual+pdf`, `+datasheet`, `+tutorial+video`) is appended as literal `+`-separated tokens outside the encoded portion — this is safe because those suffix words contain no characters that need escaping, and matches how Google's `q=` parameter already treats literal `+` as a space in a URL query string. Do not encode the suffix separately or concatenate before encoding — encoding the whole combined string including the suffix would also work, but appending pre-encoded literal `+` tokens after is simpler and avoides a second `encodeURIComponent` call per link.

- [ ] **Step 2: Call it once when the modal opens**

In `js/modal-item.js`, find where `captureModalOriginalValues()` is called inside `openModal()` (currently around line 911):

```js
  resetModalChanges();
  captureModalOriginalValues();
```

Add a call to the new function immediately after:

```js
  resetModalChanges();
  captureModalOriginalValues();
  _actualizarEnlacesManual();
```

- [ ] **Step 3: Attach live-update listeners**

In `js/modal-item.js`, find `attachModalChangeListeners()` (currently around lines 55-66):

```js
function attachModalChangeListeners(){
  const fields = ['f_ref', 'f_aula', 'f_item', 'f_qty', 'f_min', 'f_tipo_material', 'f_cat', 'f_ciclo', 'f_mod', 'f_loc', 'f_est', 'f_util', 'f_proveedor', 'f_serie', 'f_tags', 'f_fecha', 'f_mant', 'f_mantFecha', 'f_mantEstado', 'f_mantResp', 'f_mantNota', 'f_obs', 'f_es_contenedor', 'f_parent_id'];
  fields.forEach(field => {
    const el = document.getElementById(field);
    if(el){
      el.removeEventListener('change', checkModalForChanges);
      el.removeEventListener('input', checkModalForChanges);
      el.addEventListener('change', checkModalForChanges);
      el.addEventListener('input', checkModalForChanges);
    }
  });
}
```

**Do not add this feature's listener inside this function** — `checkModalForChanges()` serves an unrelated purpose (detecting unsaved changes for the "●" indicator), and mixing concerns here would make a future change to one break the other silently. Instead, add a small dedicated block right after this function's closing brace:

```js
function attachManualLinksListeners(){
  ['f_proveedor', 'f_item'].forEach(field => {
    const el = document.getElementById(field);
    if(el){
      el.removeEventListener('input', _actualizarEnlacesManual);
      el.addEventListener('input', _actualizarEnlacesManual);
    }
  });
}
```

Then call `attachManualLinksListeners()` from the same place `attachModalChangeListeners()` is called — find that call site (currently `js/modal-item.js:52`, inside `captureModalOriginalValues()`):

```js
  attachModalChangeListeners();
}
```

Add the new call right after:

```js
  attachModalChangeListeners();
  attachManualLinksListeners();
}
```

(This means `attachManualLinksListeners()` runs every time `captureModalOriginalValues()` runs, i.e. every modal open — matching the `removeEventListener`-before-`addEventListener` guard pattern already used by `attachModalChangeListeners()`, which prevents duplicate listeners from accumulating across repeated opens of the modal in the same page session.)

- [ ] **Step 4: Syntax check**

Run: `node --check js/modal-item.js`
Expected: no output (syntax valid)

- [ ] **Step 5: Commit**

```bash
git add js/modal-item.js
git commit -m "feat: calcula y refresca en vivo los enlaces de manual/datasheet/vídeo"
```

---

### Task 3: Bump service worker version and end-to-end verification

**Files:**
- Modify: `sw.js` (VERSION constant)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new — deployment/cache-busting step only

- [ ] **Step 1: Bump VERSION in sw.js**

Read `sw.js`, find the current `VERSION` constant, increment it by 1, matching the existing format exactly (confirm the actual current value first — it may have moved since this plan was written, e.g. past `v547`).

- [ ] **Step 2: Commit the version bump**

```bash
git add sw.js
git commit -m "chore: bump version tras enlaces de manual/datasheet/vídeo"
```

- [ ] **Step 3: Push and wait for Cloudflare Pages deploy**

```bash
git push origin main
```

Wait for Cloudflare Pages auto-deploy to complete before verification (fetch `sw.js`'s deployed `VERSION` value directly — remember this project's corporate network requires `NODE_TLS_REJECT_UNAUTHORIZED=0` / `curl -k` for outbound HTTPS, per `CLAUDE.md`).

- [ ] **Step 4: End-to-end verification in production with Playwright**

Using the `playwright-skill`, log in to `boscoinventario.pages.dev` with a test account (e.g. `Seba`/`Seba`), and verify:

1. **Links appear with correct queries:** open an existing item that has both a provider and a name filled in (or create one via the modal, filling both fields), confirm all three links become visible and their `href` attributes contain the expected encoded query with the correct suffix (`manual+pdf`, `datasheet`, `tutorial+video` respectively) — read the `href` attribute directly, no need to actually follow the link.
2. **Links hidden without provider:** open an item (or clear the field) with an empty `#f_proveedor` — confirm the links wrapper is hidden (`display:none`).
3. **Live update:** with the modal open and links visible, edit `#f_proveedor` to a new value — confirm the three `href` values update immediately to reflect the new text, without needing to close/reopen the modal.
4. **Special characters:** set `#f_proveedor` or `#f_item` to a value containing `&` (e.g. "Audiovisual & Sonido", a real category name already present in this project's data, or any similar test string) — confirm the resulting `href` correctly percent-encodes it (e.g. `%26`) rather than producing a broken query string with an unescaped `&`.
5. **Repeated modal opens don't duplicate listeners:** open the modal, close it, open a different item — confirm editing the provider field still updates the links exactly once per keystroke (no doubled/tripled `href` recalculation causing visible lag or errors in the console).

Report actual observed behavior for each case — do not assume success without observing the response in the browser (per `superpowers:verification-before-completion`).

- [ ] **Step 5: Fix any issues found during verification**

If any case fails, use `superpowers:systematic-debugging` to diagnose before patching.

## Self-Review Notes

- **Spec coverage:** all sections of `docs/superpowers/specs/2026-08-01-enlaces-manual-datasheet-design.md` are covered — three links in DETALLES next to Proveedor (Task 1), visibility gated on both fields having content (Task 2), Google search with `manual+pdf`/`datasheet`/`tutorial+video` suffixes (Task 2), live recompute on edit (Task 2 Step 3), `encodeURIComponent` for special characters (Task 2 Step 1, verified in Task 3's test case 4), no backend/migration/new actions (confirmed — this plan touches only `index.html` and `js/modal-item.js`).
- **No placeholders:** all code blocks are complete and copy-pasteable. Task 1 Step 1 explicitly flags and corrects a real mistake this plan's own first draft of the HTML snippet would have introduced (a duplicate `display` declaration in one inline `style` attribute, where the second value silently wins and would have shipped the links wrapper permanently visible) — caught and fixed during this plan's own writing, not left for the implementer to discover.
- **Type/name consistency:** `_actualizarEnlacesManual`, `attachManualLinksListeners` names match exactly between their definitions (Task 2 Steps 1 and 3) and call sites (`openModal()` in Task 2 Step 2, `captureModalOriginalValues()` in Task 2 Step 3). `#linksManualWrap`, `#linkManual`, `#linkDatasheet`, `#linkVideo` match exactly between their HTML definition (Task 1) and JS references (Task 2).
