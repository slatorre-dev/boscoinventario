# Reconocimiento visual y búsqueda por texto libre con cámara — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing camera-based serial-number search (`buscarPorSerie`) so the same button and the same single AI call also resolve two new cases: free text visible on a label (idea #4) and pure visual recognition when no text is legible (idea #3) — all in one deterministic backend cascade, no new button, no second AI call.

**Architecture:** One backend action (`functions/api/item.js`, action `buscarPorSerie`, unchanged name) gets a wider AI prompt that extracts `{serie, marca, modelo, textoLibre, descripcionVisual, categoriaSugerida}` in a single call to Cloudflare Workers AI. Backend code (not the AI) decides priority: serie → textoLibre → visual → sin_lectura. Frontend (`js/camara-serie.js`) gets two new response branches; the `texto` branch reuses the existing global search (`js/search.js`, `globalSearch()`) instead of any new UI.

**Tech Stack:** Cloudflare Pages Functions (JS), Cloudflare D1, Cloudflare Workers AI (`@cf/moondream/moondream3.1-9B-A2B`), vanilla JS frontend.

## Global Constraints

- Action name stays `buscarPorSerie` — already registered in `js/api.js` (`ENDPOINT_MAP`) and `js/roles.js` (`ACTION_PERMISSIONS: buscarPorSerie: 'serie.read'`, treated as universal read like `docs.read`). Do not re-register.
- Single AI call per photo — no second round-trip to Workers AI.
- All new D1 queries must follow existing department scoping pattern in `buscarPorSerie`: non-superadmin filtered to `(departamento=? OR departamento='iesjuanbosco')` and excluding `oculto=1`; superadmin unfiltered. Use the `dept`, `superadmin`, `genericDept` variables already available in the `onRequestPost` handler (`functions/api/item.js:77-83`).
- No new D1 migration — reuses existing `item`, `cat`, `categorias` columns/tables.
- AI prompt JSON examples must use realistic sample values, never placeholders like `"VALOR"` — lesson from idea #2's bug (`docs/superpowers/specs/2026-08-01-autocompletado-marca-modelo-design.md`).
- `sw.js` `VERSION` must be bumped as part of this change (project workflow in `CLAUDE.md`).
- Verification is manual/Playwright against production — this project has no automated test suite (no `package.json`, no test files).

---

### Task 1: Backend — load department categories and extend AI prompt

**Files:**
- Modify: `functions/api/item.js:319-336` (inside the `buscarPorSerie` action block)

**Interfaces:**
- Consumes: `dept`, `superadmin`, `genericDept`, `env.DB`, `env.AI` (already in scope in `onRequestPost`)
- Produces: `aiData` object as before, but the underlying prompt now requests additional fields `textoLibre`, `descripcionVisual`, `categoriaSugerida` alongside the existing `serie`, `marca`, `modelo`. Also produces a new local variable `categoriasDept` (array of strings) for Task 2 to consume when building the visual-match SQL query.

- [ ] **Step 1: Add category lookup before the AI call**

In `functions/api/item.js`, inside the `if (action === 'buscarPorSerie')` block, right after the `if (!env.AI) return ...` check (currently line 322) and before the `let aiData;` declaration (currently line 324), add:

```js
    const catDeptFilter = superadmin ? '' : ` WHERE departamento IN (?, '${genericDept}')`;
    const catDeptBind = superadmin ? [] : [dept];
    const catRows = await env.DB.prepare(`SELECT DISTINCT name FROM categorias${catDeptFilter} ORDER BY orden`)
      .bind(...catDeptBind).all();
    const categoriasDept = (catRows.results || []).map(r => r.name).filter(Boolean);
```

**Note:** for `superadmin`, this omits any department filter (same behavior as the existing `deptFilter` further down in the function, which also gives `superadmin` no scoping) — this is intentional, matching current code, not a new limitation introduced here.

- [ ] **Step 2: Replace the AI prompt to request the new fields**

Replace the existing `env.AI.run(...)` call (currently lines 326-333):

```js
      aiData = await env.AI.run('@cf/moondream/moondream3.1-9B-A2B', {
        task: 'query',
        image: `data:image/jpeg;base64,${imagen}`,
        question: 'Analiza esta etiqueta de equipo. Extrae el número de serie (S/N, Serial Number o Service Tag), la marca del fabricante, y el modelo del equipo, si son visibles. Responde ÚNICAMENTE con un objeto JSON real usando los datos que veas, por ejemplo: {"serie": "220A4S1002886", "marca": "TP-Link", "modelo": "Archer TX3000E"}. Si no ves alguno de esos datos, pon null en ese campo concreto (nunca inventes ni copies el ejemplo literalmente). No añadas explicaciones ni texto fuera del JSON.',
        reasoning: true,
        stream: false,
        max_tokens: 300
      });
```

with:

```js
      const categoriasTexto = categoriasDept.length
        ? categoriasDept.map(c => `"${c}"`).join(', ')
        : '(ninguna categoría disponible)';
      aiData = await env.AI.run('@cf/moondream/moondream3.1-9B-A2B', {
        task: 'query',
        image: `data:image/jpeg;base64,${imagen}`,
        question: `Analiza esta foto de un equipo o material de inventario. Primero busca una etiqueta con número de serie (S/N, Serial Number o Service Tag), marca del fabricante y modelo. Si no hay número de serie pero hay cualquier otro texto visible (nombre de producto impreso, texto en una caja, etc.), extráelo como texto libre. Si no hay ningún texto legible, describe brevemente el objeto que ves y, si encaja, elige UNA categoría de esta lista exacta: ${categoriasTexto}. Responde ÚNICAMENTE con un objeto JSON real usando los datos que veas, por ejemplo: {"serie": "220A4S1002886", "marca": "TP-Link", "modelo": "Archer TX3000E", "textoLibre": null, "descripcionVisual": null, "categoriaSugerida": null}. Otro ejemplo válido cuando no hay serie pero sí texto: {"serie": null, "marca": null, "modelo": null, "textoLibre": "Arduino UNO R3", "descripcionVisual": null, "categoriaSugerida": null}. Otro ejemplo válido cuando no hay ningún texto legible: {"serie": null, "marca": null, "modelo": null, "textoLibre": null, "descripcionVisual": "placa de desarrollo con microcontrolador y pines de conexión", "categoriaSugerida": "Electrónica"}. "categoriaSugerida" debe ser EXACTAMENTE uno de los nombres de la lista dada (copiado tal cual) o null si ninguno encaja — nunca inventes un nombre de categoría nuevo. Pon null en cualquier campo que no veas (nunca inventes datos ni copies estos ejemplos literalmente si no corresponden a la foto real). No añadas explicaciones ni texto fuera del JSON.`,
        reasoning: true,
        stream: false,
        max_tokens: 400
      });
```

(`max_tokens` raised from 300 to 400 — the response JSON has 3 more fields, including a free-text description field that can run longer than the original 3-field response.)

- [ ] **Step 3: Manual verification — prompt still parses for the existing serial case**

This step has no automated test (project has none). Verify by reading the modified block once more to confirm:
- `categoriasDept` is computed before `aiData` is used
- the JSON parsing code immediately after (currently lines 338-347, untouched by this task) still expects `aiData?.result?.answer` — confirm this is unchanged
- No syntax errors: run `node --check functions/api/item.js` from the repo root

Run: `node --check "h:/Mi unidad/Github/boscoinventario/functions/api/item.js"`
Expected: no output (syntax valid)

- [ ] **Step 4: Commit**

```bash
git add functions/api/item.js
git commit -m "feat: amplía prompt de buscarPorSerie para texto libre y reconocimiento visual"
```

---

### Task 2: Backend — parse new fields and implement resolution cascade

**Files:**
- Modify: `functions/api/item.js:338-370` (JSON parsing and match resolution, right after Task 1's prompt change)

**Interfaces:**
- Consumes: `aiData` (from Task 1), `categoriasDept` (from Task 1), `env.DB`, `dept`, `superadmin`, `genericDept`, existing `levenshtein()` helper (`functions/api/item.js:375-389`, unchanged)
- Produces: HTTP JSON responses with `match` values `'exacto'`, `'fuzzy'`, `'ninguno'` (unchanged from today), plus two new values: `'texto'` (`{ ok: true, match: 'texto', textoLibre }`) and `'visual'` (`{ ok: true, match: 'visual', candidatos: [...], nombreSugerido, categoriaSugerida }`, where `candidatos` is `[{id, item, ref, aula, cat}]` and may be an empty array).

- [ ] **Step 1: Extend the JSON parsing block**

Replace the current parsing block (lines 338-348):

```js
    let serieLeida = '', marca = '', modelo = '';
    const raw = aiData?.result?.answer || '';
    try {
      const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
      serieLeida = String(parsed.serie || '').trim();
      marca = String(parsed.marca || '').trim();
      modelo = String(parsed.modelo || '').trim();
    } catch (e) {
      return Response.json({ ok: true, match: 'sin_lectura' });
    }
    if (!serieLeida) return Response.json({ ok: true, match: 'sin_lectura' });
```

with:

```js
    let serieLeida = '', marca = '', modelo = '', textoLibre = '', descripcionVisual = '', categoriaSugerida = '';
    const raw = aiData?.result?.answer || '';
    try {
      const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
      serieLeida = String(parsed.serie || '').trim();
      marca = String(parsed.marca || '').trim();
      modelo = String(parsed.modelo || '').trim();
      textoLibre = String(parsed.textoLibre || '').trim();
      descripcionVisual = String(parsed.descripcionVisual || '').trim();
      categoriaSugerida = String(parsed.categoriaSugerida || '').trim();
    } catch (e) {
      return Response.json({ ok: true, match: 'sin_lectura' });
    }
    // categoriaSugerida solo es válida si coincide exactamente con una categoría real del departamento
    if (categoriaSugerida && !categoriasDept.includes(categoriaSugerida)) categoriaSugerida = '';
```

(Removed the early `if (!serieLeida) return ... 'sin_lectura'` — replaced by the cascade in Step 3 below, which now also checks `textoLibre` and `descripcionVisual`/`categoriaSugerida` before giving up.)

- [ ] **Step 2: Leave the existing serie exact/fuzzy logic untouched**

Confirm lines (originally 350-368, the `deptFilter`/`deptBind`, `exact` query, and `candidatos` fuzzy query) remain exactly as they are — this task does not modify that block. It should still end with:

```js
    if (candidatos.length) return Response.json({ ok: true, match: 'fuzzy', candidatos });
    return Response.json({ ok: true, match: 'ninguno', serieLeida, marca, modelo });
```

but this last `return` only fires today when `serieLeida` was non-empty (guaranteed since the early-return in Step 1 was removed, this whole block must now be wrapped — see Step 3).

- [ ] **Step 3: Wrap the existing serie block in `if (serieLeida)` and add the new cascade after it**

The full block from "const deptFilter" through the final "return ... 'ninguno'" line must be wrapped in a condition, with new branches added after it. Replace the entire block from the `const deptFilter` line down to (and including) the final `return Response.json({ ok: true, match: 'ninguno', serieLeida, marca, modelo });` with:

```js
    const deptFilter = superadmin
      ? ''
      : ` AND (oculto IS NULL OR oculto != 1) AND (departamento=? OR departamento='${genericDept}')`;
    const deptBind = superadmin ? [] : [dept];

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

    if (textoLibre) {
      return Response.json({ ok: true, match: 'texto', textoLibre });
    }

    if (descripcionVisual || categoriaSugerida) {
      const nombreSugerido = categoriaSugerida || descripcionVisual;
      const palabraClave = descripcionVisual.split(/\s+/).filter(w => w.length >= 4)[0] || descripcionVisual;
      const catCond = categoriaSugerida ? ' AND cat=?' : '';
      const catBind = categoriaSugerida ? [categoriaSugerida] : [];
      const visualRes = await env.DB.prepare(
        `SELECT id, item, ref, aula, cat FROM inventario WHERE item LIKE ?${catCond}${deptFilter} LIMIT 10`
      ).bind(`%${palabraClave}%`, ...catBind, ...deptBind).all();
      return Response.json({
        ok: true,
        match: 'visual',
        candidatos: visualRes.results || [],
        nombreSugerido,
        categoriaSugerida
      });
    }

    return Response.json({ ok: true, match: 'sin_lectura' });
```

**Design note:** `palabraClave` picks the first word ≥4 chars from `descripcionVisual` as a simple LIKE filter — matches the project's existing "no new fuzzy library" constraint (per spec, reuse simple patterns already used elsewhere in the codebase rather than adding a new matching algorithm to the backend).

- [ ] **Step 4: Syntax check**

Run: `node --check "h:/Mi unidad/Github/boscoinventario/functions/api/item.js"`
Expected: no output (syntax valid)

- [ ] **Step 5: Commit**

```bash
git add functions/api/item.js
git commit -m "feat: cascada serie/texto libre/visual en buscarPorSerie"
```

---

### Task 3: Frontend — handle `match: 'texto'` by reusing global search

**Files:**
- Modify: `js/camara-serie.js:72-95` (inside `capturarSerie()`)

**Interfaces:**
- Consumes: `res.match === 'texto'` and `res.textoLibre` (string) from the `buscarPorSerie` response (Task 2); existing global functions `globalSearch(q)` and `closeCamaraSerie()` (already defined in `js/search.js` and `js/camara-serie.js` respectively); existing DOM element `#gsInput`.
- Produces: no new exported functions — this is a branch added to the existing `capturarSerie()` function.

- [ ] **Step 1: Add the `texto` branch**

In `js/camara-serie.js`, inside `capturarSerie()`, after the existing `if (res.match === 'fuzzy') { ... }` block (currently lines 87-90) and before `if (res.match === 'ninguno') { ... }` (currently line 91), add:

```js
    if (res.match === 'texto') {
      closeCamaraSerie();
      const gsInput = document.getElementById('gsInput');
      if (gsInput) {
        gsInput.value = res.textoLibre;
        if (typeof globalSearch === 'function') globalSearch(res.textoLibre);
        gsInput.focus();
      }
      return;
    }
```

- [ ] **Step 2: Manual verification — trace the call path**

No automated tests exist in this project. Verify by reading:
- `js/search.js:120` — `globalSearch(q)` signature takes a single string `q`, matches the call above.
- `index.html` — confirm `#gsInput` exists and `js/search.js` is loaded before `js/camara-serie.js` (or both are loaded as global scripts without module boundaries, so load order doesn't matter for function visibility at call time — only matters that `globalSearch` is defined by the time `capturarSerie()` actually runs, which is after user interaction, long after all scripts loaded).

Run: `node --check "h:/Mi unidad/Github/boscoinventario/js/camara-serie.js"`
Expected: no output (syntax valid)

- [ ] **Step 3: Commit**

```bash
git add js/camara-serie.js
git commit -m "feat: match 'texto' de buscarPorSerie reusa buscador global"
```

---

### Task 4: Frontend — handle `match: 'visual'` with and without candidates

**Files:**
- Modify: `js/camara-serie.js` (add new branch in `capturarSerie()`, add two new rendering functions, extend `_crearItemDesdeSerie`-style pending-state pattern)

**Interfaces:**
- Consumes: `res.match === 'visual'`, `res.candidatos` (array, possibly empty), `res.nombreSugerido` (string), `res.categoriaSugerida` (string, possibly empty) from Task 2's response.
- Produces: two new functions `_mostrarVisualCandidatos(candidatos, nombreSugerido, categoriaSugerida)` and `_crearItemDesdeVisual()`, plus two new module-level pending-state variables `_nombreSugeridoPendiente` and `_categoriaSugeridaPendiente`. These are consumed only within this file.

- [ ] **Step 1: Add the `visual` branch in `capturarSerie()`**

After the `texto` branch added in Task 3, and before `if (res.match === 'ninguno')`, add:

```js
    if (res.match === 'visual') {
      _mostrarVisualCandidatos(res.candidatos, res.nombreSugerido, res.categoriaSugerida);
      return;
    }
```

- [ ] **Step 2: Add pending-state variables**

Near the existing pending-state variables (currently lines 126-128: `_serieLeidaPendiente`, `_marcaPendiente`, `_modeloPendiente`), add:

```js
let _nombreSugeridoPendiente = '';
let _categoriaSugeridaPendiente = '';
```

- [ ] **Step 3: Add `_mostrarVisualCandidatos()`**

Add this new function after `_mostrarSerieCandidatos()` (currently ends at line 124):

```js
function _mostrarVisualCandidatos(candidatos, nombreSugerido, categoriaSugerida) {
  _nombreSugeridoPendiente = nombreSugerido || '';
  _categoriaSugeridaPendiente = categoriaSugerida || '';
  const resultado = document.getElementById('serieResultado');
  resultado.style.display = 'block';
  if (!candidatos || !candidatos.length) {
    const nombreTexto = nombreSugerido ? escHtml(nombreSugerido) : 'este objeto';
    resultado.innerHTML = `
      <div style="margin-bottom:12px">No se encontró ningún ítem parecido a <strong>${nombreTexto}</strong> en el inventario.</div>
      <button class="btn btn-p" onclick="_crearItemDesdeVisual()">Crear ítem nuevo${nombreSugerido ? ': ' + escHtml(nombreSugerido) : ''}</button>
      <button class="btn" onclick="serieReintentar()" style="margin-top:8px">Reintentar</button>`;
    return;
  }
  const filas = candidatos.map(c => {
    const aula = (typeof AULAS !== 'undefined' ? AULAS.find(a => a.id === c.aula) : null);
    const aulaNombre = aula ? aula.name : (c.aula || 'Sin aula');
    return `<div class="serie-candidato" onclick="closeCamaraSerie();openItemRoute(${c.id})" style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer">
      <div style="font-weight:600">${escHtml(c.item)}</div>
      <div style="font-size:12px;color:var(--muted)">${escHtml(aulaNombre)}${c.cat ? ' · ' + escHtml(c.cat) : ''}</div>
    </div>`;
  }).join('');
  resultado.innerHTML = `<div style="margin-bottom:8px">No se leyó ningún texto, ¿es alguno de estos?</div>${filas}
    <button class="btn btn-p" onclick="_crearItemDesdeVisual()" style="margin-top:8px">Ninguno, crear ítem nuevo</button>
    <button class="btn" onclick="serieReintentar()" style="margin-top:8px">Reintentar</button>`;
}
```

- [ ] **Step 4: Add `_crearItemDesdeVisual()`**

Add this new function after `_crearItemDesdeSerie()` (currently ends at line 165):

```js
function _crearItemDesdeVisual() {
  const nombreSugerido = _nombreSugeridoPendiente;
  const categoriaSugerida = _categoriaSugeridaPendiente;
  closeCamaraSerie();
  openModal();
  setTimeout(() => {
    if (nombreSugerido) {
      const itemInput = document.getElementById('f_item');
      if (itemInput) itemInput.value = nombreSugerido;
    }
    if (categoriaSugerida) {
      const catSelect = document.getElementById('f_cat');
      if (catSelect) catSelect.value = categoriaSugerida;
    }
  }, 50);
}
```

- [ ] **Step 5: Syntax check**

Run: `node --check "h:/Mi unidad/Github/boscoinventario/js/camara-serie.js"`
Expected: no output (syntax valid)

- [ ] **Step 6: Commit**

```bash
git add js/camara-serie.js
git commit -m "feat: match 'visual' de buscarPorSerie ofrece candidatos o alta precargada"
```

---

### Task 5: Frontend — generalize button and modal copy

**Files:**
- Modify: `index.html:324-327` (button `#gsSerie`)
- Modify: `index.html:1544-1551` (modal `#mCamaraSerie`)

**Interfaces:**
- Consumes: none (copy-only change)
- Produces: none (copy-only change)

- [ ] **Step 1: Update the button label and title**

In `index.html`, replace:

```html
      <button class="gsearch-extra-btn" id="gsSerie" onclick="openCamaraSerie()" title="Buscar por número de serie">
        🔢
        <span>Buscar por Nº de serie</span>
      </button>
```

with:

```html
      <button class="gsearch-extra-btn" id="gsSerie" onclick="openCamaraSerie()" title="Buscar con la cámara">
        🔢
        <span>Buscar con la cámara</span>
      </button>
```

- [ ] **Step 2: Update modal heading/instructions if present**

Read `index.html:1544-1551` in full context (a few lines before line 1544 likely contain a modal title `<h3>` or similar). If there is a heading like "Buscar por número de serie" inside `#mCamaraSerie`, update it to a generic instruction, e.g. "Apunta la cámara a la etiqueta o al objeto" — match the existing heading tag/style found in the file rather than inventing new markup.

- [ ] **Step 3: Manual visual check**

This is a copy-only change with no logic impact. Confirm via `grep -n "gsSerie\|mCamaraSerie" index.html` that no other place in the file references the old copy in a way that would look inconsistent (e.g. a tooltip elsewhere referencing "número de serie" specifically for this button).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "docs: generaliza texto del botón/modal de cámara para cubrir texto libre y reconocimiento visual"
```

---

### Task 6: Bump service worker version and end-to-end verification

**Files:**
- Modify: `sw.js` (VERSION constant)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new — deployment/cache-busting step only

- [ ] **Step 1: Bump VERSION in sw.js**

Read `sw.js`, find the current `VERSION` constant (per `CLAUDE.md`, currently around v543+), increment it by 1, matching the existing format exactly (e.g. `'v544'` → `'v545'`).

- [ ] **Step 2: Commit the version bump**

```bash
git add sw.js
git commit -m "chore: bump version tras reconocimiento visual y texto libre por cámara"
```

- [ ] **Step 3: Push and wait for Cloudflare Pages deploy**

```bash
git push origin main
```

Wait for Cloudflare Pages auto-deploy to complete (per `CLAUDE.md` workflow) before verification.

- [ ] **Step 4: End-to-end verification in production with Playwright**

Using the `playwright-skill`, log in to `boscoinventario.pages.dev` with a test account that has a department with at least one existing item and at least one category (e.g. `Seba`/`Seba`, department `electricidadelectronica`), then verify all three cascade branches:

1. **Regression — serial still works:** click `#gsSerie`, capture/upload a photo of a label with a real serial number already in the DB → confirm it still opens the matched item directly (`match: 'exacto'` path unchanged).
2. **Free text branch:** capture a photo containing readable text that is not formatted as a serial number (e.g. a printed product name) → confirm the camera modal closes and `#gsInput` is populated with that text and shows global search results.
3. **Visual branch:** capture a photo of an object with no legible text → confirm either a candidate list appears (if a similar-named item exists in that category) or "Crear ítem nuevo" opens the item modal with `#f_item` and `#f_cat` pre-filled from the AI's suggestion.

Report actual observed behavior for each of the 3 cases — do not assume success without observing the response in the browser (per `superpowers:verification-before-completion`).

- [ ] **Step 5: Fix any issues found during verification**

If any of the 3 cases fail, use `superpowers:systematic-debugging` to diagnose before patching — check Cloudflare Pages function logs (`wrangler pages deployment tail`) for the actual `aiData` response shape if the AI's JSON doesn't parse as expected, following the same debugging trail documented in `CLAUDE.md`'s session history for the original `buscarPorSerie` implementation (reading `aiData.result.answer`, not `aiData.answer`).

---

## Self-Review Notes

- **Spec coverage:** all sections of the design doc are covered — single AI call (Task 1), backend cascade (Task 2), texto branch reusing global search (Task 3), visual branch with/without candidates (Task 4), UI copy (Task 5), deployment/verification (Task 6).
- **No placeholders:** all code blocks are complete and copy-pasteable; `#f_cat` (category select id, `index.html:585`) was confirmed directly against the source before finalizing Task 4.
- **Type/name consistency:** `textoLibre`, `descripcionVisual`, `categoriaSugerida` names are identical across Task 1 (prompt), Task 2 (parsing + response), Task 3/4 (frontend consumption). `_mostrarVisualCandidatos` and `_crearItemDesdeVisual` names match between their definition (Task 4 Steps 3-4) and their call sites (Task 4 Step 1, and the `onclick` handlers inside the generated HTML strings).
