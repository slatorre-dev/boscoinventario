# Onboarding de Funciones de Cámara Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the app's eight-plus camera features (built over the last two days but with zero onboarding) via a 4-screen guided tour shown automatically once per browser after login, plus a permanent, always-accessible help modal covering every camera feature in full.

**Architecture:** Two new modals (`#mTourCamara`, `#mAyudaCamara`) added to `index.html`, driven by a new frontend-only module `js/onboarding-camara.js`. The tour's "seen" state lives in `localStorage` only — no backend, no D1 migration, no new API actions. The tour is triggered from the existing `loadData()` flow in `js/auth.js`, right after the app finishes rendering Home for a successfully authenticated session.

**Tech Stack:** Vanilla JS, no build step, no test framework (verification is manual/Playwright against production, per project convention).

## Global Constraints

- No backend changes, no new D1 migration, no new actions in `js/api.js`/`js/roles.js` — this is pure frontend UI state, backed only by `localStorage`.
- The tour covers exactly 4 features, in this order: #1 (buscar por número de serie), #6 (multi-equipo en una foto), #5 (inventario andando), #3 (reconocimiento visual sin etiqueta). The permanent help modal covers all 8+ features (including barcode reading and free-text search, folded into the #1 description as part of the same underlying cascade, not as separate entries).
- `localStorage` key for the "tour seen" flag: `tour_camara_visto_v1` — matches this project's existing naming convention for versioned flags (e.g. `volt_intents_migrated_v1`).
- The tour must mark itself as seen (write the `localStorage` flag) on ANY close path — finishing all 4 screens, clicking "Saltar", or dismissing the modal by clicking its background overlay — not just on explicit completion.
- The permanent help modal must explicitly note that #5 (Revisar aula) and #6 (Añadir varios) are only accessible from inside a specific classroom ("aula") view, not from Home — since their buttons don't live next to the camera search button.
- The help modal's "Ver tour guiado" button reopens the SAME tour component (`#mTourCamara`), not a duplicate — no content is ever written twice.
- `sw.js` `VERSION` must be bumped as the final step (project workflow in `CLAUDE.md`).
- Verification is manual/Playwright against production — this project has no automated test suite.

---

### Task 1: HTML — tour and help modals, plus the help entry button

**Files:**
- Modify: `index.html` — add a new "❓" button to `.gsearch-extra-btns` (currently ending around line 327, right after the existing `#gsSerie` button), and two new modals placed after the existing `#mConf` modal block (or any other reasonable location alongside other top-level modals in the file — exact placement among sibling modals doesn't matter, consistency with existing modal markup does).

**Interfaces:**
- Produces: DOM elements `#gsAyuda` (button), `#mTourCamara` (modal) with `#tourPantalla1`..`#tourPantalla4` (or a single content container swapped via JS — see Task 2 for the exact approach), `#tourBtnAtras`, `#tourBtnSiguiente`, `#tourBtnSaltar`, `#mAyudaCamara` (modal) with a static list of all 8+ features and a `#ayudaBtnVerTour` button — all consumed by Task 2's `js/onboarding-camara.js`.

- [ ] **Step 1: Add the help button next to the camera search button**

In `index.html`, inside `.gsearch-extra-btns` (find it via `grep -n "gsearch-extra-btns"`), add a new button right after the existing `#gsSerie` button:

```html
      <button class="gsearch-extra-btn" id="gsAyuda" onclick="openAyudaCamara()" title="Ayuda: funciones de cámara">
        ❓
        <span>Ayuda</span>
      </button>
```

- [ ] **Step 2: Add the tour modal**

Add this new modal (single content container, swapped by JS rather than four separate always-in-DOM screens — simpler to maintain and matches how the rest of this project builds multi-step UI, e.g. the CSV import flow's step indicator):

```html
<!-- ══ TOUR GUIADO: FUNCIONES DE CÁMARA ══ -->
<div class="mbg" id="mTourCamara" onclick="if(event.target===this)closeTourCamara()">
  <div class="modal" style="max-width:480px">
    <div class="mh"><div class="mt" id="tourTitulo">📷 Novedades: búsqueda por cámara</div><button class="mx" onclick="closeTourCamara()">✕</button></div>
    <div id="tourContenido" style="min-height:120px;font-size:14px;line-height:1.5"></div>
    <div style="text-align:center;margin:14px 0;font-size:12px;color:var(--muted)" id="tourPasos">1 / 4</div>
    <div class="mf" style="margin-top:8px;gap:8px">
      <button class="btn" id="tourBtnSaltar" onclick="closeTourCamara()">Saltar</button>
      <div style="flex:1"></div>
      <button class="btn" id="tourBtnAtras" onclick="tourAnterior()" style="display:none">Atrás</button>
      <button class="btn btn-p" id="tourBtnSiguiente" onclick="tourSiguiente()">Siguiente</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add the permanent help modal**

Add this new modal right after `#mTourCamara`:

```html
<!-- ══ AYUDA: FUNCIONES DE CÁMARA (COMPLETA) ══ -->
<div class="mbg" id="mAyudaCamara" onclick="if(event.target===this)closeAyudaCamara()">
  <div class="modal" style="max-width:560px">
    <div class="mh"><div class="mt">❓ Funciones de cámara</div><button class="mx" onclick="closeAyudaCamara()">✕</button></div>
    <div style="font-size:13px;line-height:1.6;max-height:60vh;overflow-y:auto">
      <div style="margin-bottom:14px"><strong>🔢 Buscar por número de serie</strong><br>Apunta la cámara a la etiqueta de un equipo — lee el número de serie (o un código de barras si lo tiene) y encuentra el ítem al instante. Si el texto no es un número de serie, lo busca igual en el inventario.</div>
      <div style="margin-bottom:14px"><strong>🧩 Reconocimiento visual</strong><br>Aunque el equipo no tenga ninguna etiqueta legible, la cámara puede reconocerlo igual y sugerir de qué se trata.</div>
      <div style="margin-bottom:14px"><strong>✏️ Autocompletado al dar de alta</strong><br>Si el equipo no está en el inventario, se precargan marca y modelo automáticamente a partir de la foto.</div>
      <div style="margin-bottom:14px"><strong>📸 Añadir varios equipos de una foto</strong><br>Fotografía una mesa entera con varios equipos nuevos y créalos todos de golpe, con cantidades. <em>Disponible dentro de la vista de una aula concreta, botón "Añadir varios".</em></div>
      <div style="margin-bottom:14px"><strong>📷 Revisar aula (inventario andando)</strong><br>Recorre un aula fotografiando cada equipo, uno tras otro, y confirma qué está donde debe. <em>Disponible dentro de la vista de una aula concreta, botón "Revisar aula".</em></div>
    </div>
    <div class="mf" style="margin-top:14px">
      <button class="btn" id="ayudaBtnVerTour" onclick="closeAyudaCamara();openTourCamara(true)">▶ Ver tour guiado</button>
      <button class="btn btn-p" onclick="closeAyudaCamara()">Cerrar</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Visual verification**

Re-read the modified regions of `index.html` to confirm no unclosed tags were introduced, and that `#gsAyuda`, `#mTourCamara`, `#mAyudaCamara` and their child ids are all present and uniquely named (no collision with any existing id in the file — run `grep -c 'id="gsAyuda"\|id="mTourCamara"\|id="mAyudaCamara"' index.html` and confirm each count is exactly 1).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: botón de ayuda y modales de tour/ayuda de funciones de cámara (index.html)"
```

---

### Task 2: Frontend — tour navigation and help modal logic

**Files:**
- Create: `js/onboarding-camara.js`
- Modify: `index.html` — add `<script defer src="js/onboarding-camara.js"></script>` near the other feature script tags (e.g. next to `js/multi-equipo.js`'s tag)

**Interfaces:**
- Consumes: `escHtml()` (existing, unused here since content is static/trusted, but available if needed), no external data — all tour/help content is static text baked into this file.
- Produces: `openTourCamara(fromHelp)`, `closeTourCamara()`, `tourSiguiente()`, `tourAnterior()`, `openAyudaCamara()`, `closeAyudaCamara()` — all called from `index.html`'s onclick handlers (Task 1) and from Task 3's login-flow trigger.

- [ ] **Step 1: Add the script tag**

Run: `grep -n 'multi-equipo.js' index.html`

Add immediately after that line:
```html
<script defer src="js/onboarding-camara.js"></script>
```

- [ ] **Step 2: Write `js/onboarding-camara.js`**

```js
const TOUR_CAMARA_KEY = 'tour_camara_visto_v1';

const TOUR_PANTALLAS = [
  {
    titulo: '📷 Novedades: búsqueda por cámara',
    texto: '<strong>🔢 Buscar por número de serie</strong><br>Apunta la cámara a la etiqueta de un equipo y encuéntralo al instante en el inventario.'
  },
  {
    titulo: '📷 Novedades: búsqueda por cámara',
    texto: '<strong>📸 Multi-equipo en una foto</strong><br>Fotografía una mesa entera con varios equipos nuevos y créalos todos de golpe.'
  },
  {
    titulo: '📷 Novedades: búsqueda por cámara',
    texto: '<strong>📷 Inventario andando</strong><br>Recorre un aula fotografiando cada equipo, uno tras otro, y confirma que todo está donde debe.'
  },
  {
    titulo: '📷 Novedades: búsqueda por cámara',
    texto: '<strong>🧩 Reconocimiento visual</strong><br>Aunque el equipo no tenga ninguna etiqueta legible, la cámara puede reconocerlo igual.'
  }
];

let _tourPaso = 0;

function _tourVisto() {
  try { return !!localStorage.getItem(TOUR_CAMARA_KEY); } catch (e) { return false; }
}

function _marcarTourVisto() {
  try { localStorage.setItem(TOUR_CAMARA_KEY, '1'); } catch (e) { /* localStorage no disponible, no bloquea nada */ }
}

function iniciarTourCamaraSiPrimeraVez() {
  if (_tourVisto()) return;
  openTourCamara(false);
}

function openTourCamara(reabierta) {
  _tourPaso = 0;
  _renderTourPaso();
  document.getElementById('mTourCamara').classList.add('open');
  if (reabierta) _marcarTourVisto();
}

function closeTourCamara() {
  _marcarTourVisto();
  document.getElementById('mTourCamara').classList.remove('open');
}

function _renderTourPaso() {
  const p = TOUR_PANTALLAS[_tourPaso];
  document.getElementById('tourTitulo').textContent = p.titulo;
  document.getElementById('tourContenido').innerHTML = p.texto;
  document.getElementById('tourPasos').textContent = `${_tourPaso + 1} / ${TOUR_PANTALLAS.length}`;
  document.getElementById('tourBtnAtras').style.display = _tourPaso === 0 ? 'none' : 'inline-flex';
  document.getElementById('tourBtnSiguiente').textContent = _tourPaso === TOUR_PANTALLAS.length - 1 ? 'Terminar' : 'Siguiente';
}

function tourSiguiente() {
  if (_tourPaso >= TOUR_PANTALLAS.length - 1) {
    closeTourCamara();
    return;
  }
  _tourPaso++;
  _renderTourPaso();
}

function tourAnterior() {
  if (_tourPaso <= 0) return;
  _tourPaso--;
  _renderTourPaso();
}

function openAyudaCamara() {
  document.getElementById('mAyudaCamara').classList.add('open');
}

function closeAyudaCamara() {
  document.getElementById('mAyudaCamara').classList.remove('open');
}
```

**Design notes:**
- `openTourCamara(reabierta)` takes a boolean: when reopened from the help modal (`reabierta=true`), it also marks the flag as seen immediately — this covers the case where someone who has NEVER seen the tour opens it manually from the help modal before ever triggering the automatic first-login path (an edge case: a brand-new user could theoretically click "❓" before `iniciarTourCamaraSiPrimeraVez()` ever ran, e.g. if Task 3's trigger point is reached asynchronously after Home is already interactive). When triggered automatically on first login (`reabierta=false`), the flag is instead marked on close (any close path), matching the spec's requirement that skipping/closing early still counts as "seen".
- `tourSiguiente()` on the last screen acts as "Terminar" (closes the tour, which marks the flag) rather than advancing past the array bounds — the button's label switches to "Terminar" via `_renderTourPaso()` so this isn't a hidden behavior.
- Static content arrays (`TOUR_PANTALLAS`) keep all four screens' text in one place, easy to review for tone/length consistency — no need for a build step or i18n system, this project has none.
- `localStorage` access wrapped in try/catch in both read (`_tourVisto`) and write (`_marcarTourVisto`) paths — per the spec's explicitly accepted edge case (localStorage unavailable in strict incognito), a failure here must never throw and block the rest of the login flow.

- [ ] **Step 3: Syntax check**

Run: `node --check js/onboarding-camara.js`
Expected: no output (syntax valid)

- [ ] **Step 4: Commit**

```bash
git add index.html js/onboarding-camara.js
git commit -m "feat: lógica de navegación del tour y modal de ayuda de cámara"
```

---

### Task 3: Trigger the tour after a successful login

**Files:**
- Modify: `js/auth.js` — inside `loadData()`, right after Home finishes rendering for a successfully authenticated session.

**Interfaces:**
- Consumes: `iniciarTourCamaraSiPrimeraVez()` (from Task 2).
- Produces: no new exported functions — this is a single call inserted into an existing function.

- [ ] **Step 1: Find the exact insertion point**

Run: `grep -n "goHome();" js/auth.js`

Confirm the line `else if(cf) openSub(); else if(currentCiclo) openCiclo(currentCiclo.id); else goHome();` (currently around line 452, inside `loadData()`, right after `bar.className` handling and `if(location.hash...)` navigation logic) — this is the last line of the successful-login path before the function's `catch` block. Line numbers may have shifted from concurrent work; insert relative to this content.

- [ ] **Step 2: Add the trigger call**

Add a call to `iniciarTourCamaraSiPrimeraVez()` immediately after that line (still inside the `try` block, after the app has finished navigating to whatever view it's going to show):

```js
    if(location.hash && location.hash.length > 1) navigateFromHash(location.hash);
    else if(cf) openSub(); else if(currentCiclo) openCiclo(currentCiclo.id); else goHome();
    iniciarTourCamaraSiPrimeraVez();
```

**Design note:** the tour is triggered unconditionally after every successful `loadData()` completion, but `iniciarTourCamaraSiPrimeraVez()` itself is the guard (checks `localStorage` and no-ops if already seen) — so on every login after the first, this call is a fast no-op. Placing it here (not conditioned on `cf`/`currentCiclo`/hash navigation) means the tour can appear even if the user's session restores them directly into an aula/category view or a deep link — acceptable per the spec, which doesn't require Home specifically, just "after the app finishes rendering for a successfully authenticated session."

- [ ] **Step 3: Syntax check**

Run: `node --check js/auth.js`
Expected: no output (syntax valid)

- [ ] **Step 4: Commit**

```bash
git add js/auth.js
git commit -m "feat: dispara el tour de cámara automáticamente tras el primer login"
```

---

### Task 4: Bump service worker version and end-to-end verification

**Files:**
- Modify: `sw.js` (VERSION constant)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new — deployment/cache-busting step only

- [ ] **Step 1: Bump VERSION in sw.js**

Read `sw.js`, find the current `VERSION` constant, increment it by 1, matching the existing format exactly (confirm the actual current value first — it may have moved since this plan was written, e.g. past `v549`).

- [ ] **Step 2: Commit the version bump**

```bash
git add sw.js
git commit -m "chore: bump version tras onboarding de funciones de cámara"
```

- [ ] **Step 3: Push and wait for Cloudflare Pages deploy**

```bash
git push origin main
```

Wait for Cloudflare Pages auto-deploy to complete before verification (fetch `sw.js`'s deployed `VERSION` value directly — remember this project's corporate network requires `NODE_TLS_REJECT_UNAUTHORIZED=0` / `curl -k` for outbound HTTPS, per `CLAUDE.md`).

- [ ] **Step 4: End-to-end verification in production with Playwright**

Using the `playwright-skill`, against `boscoinventario.pages.dev`:

1. **Tour appears on first login:** in a fresh browser context (or after clearing `localStorage` for the site), log in with a test account (e.g. `Seba`/`Seba`) — confirm `#mTourCamara` opens automatically, showing screen 1 of 4 with the correct title/content.
2. **Navigation works both directions:** click "Siguiente" through all 4 screens (confirm content changes each time, step counter updates `1/4` → `4/4`, "Atrás" appears from screen 2 onward, "Siguiente" becomes "Terminar" on screen 4), then click "Atrás" back to screen 1 (confirm content reverts correctly).
3. **Closing marks the flag on every path:** test THREE separate close paths in three separate fresh sessions — (a) clicking "Terminar" on the last screen, (b) clicking "Saltar" from screen 1, (c) clicking the modal background overlay — confirm in each case that `localStorage.getItem('tour_camara_visto_v1')` is set afterward, and that reloading the page does NOT reopen the tour automatically.
4. **Tour doesn't reappear on subsequent logins:** with the flag already set, log out and log back in — confirm the tour does NOT open automatically.
5. **Help button opens the full list:** click "❓" next to the camera search button — confirm `#mAyudaCamara` opens showing all 5 described feature blocks (serial search, visual recognition, autofill, multi-equipo, revisión de aula), with the two aula-specific notes visible.
6. **Help modal can reopen the tour:** from the help modal, click "▶ Ver tour guiado" — confirm the help modal closes, the tour modal opens showing screen 1, and this does NOT disturb the already-set `localStorage` flag in a way that breaks anything (it's already `1`, setting it to `1` again is a no-op).

Report actual observed behavior for each case — do not assume success without observing the response in the browser (per `superpowers:verification-before-completion`).

- [ ] **Step 5: Fix any issues found during verification**

If any case fails, use `superpowers:systematic-debugging` to diagnose before patching.

## Self-Review Notes

- **Spec coverage:** all sections of `docs/superpowers/specs/2026-08-02-onboarding-camara-design.md` are covered — 4-screen tour with the specified feature order and content (Task 1/2), automatic trigger after first login via `localStorage` flag with no D1 (Task 2/3), permanent help modal with all 8+ features and explicit aula-specific notes for #5/#6 (Task 1), help modal reopening the tour without content duplication (Task 1/2), single help entry point in Home only (Task 1).
- **No placeholders:** all code blocks are complete and copy-pasteable. Task 3 Step 1 requires reading live code to confirm the exact insertion point since concurrent work may have shifted line numbers — a legitimate "confirm against current state" step, not a deferred design decision.
- **Type/name consistency:** `openTourCamara`, `closeTourCamara`, `tourSiguiente`, `tourAnterior`, `openAyudaCamara`, `closeAyudaCamara` match exactly between their `index.html` onclick handlers (Task 1) and their definitions (Task 2). `TOUR_CAMARA_KEY` (`'tour_camara_visto_v1'`) is defined once and used consistently by both the read (`_tourVisto`) and write (`_marcarTourVisto`) helpers — no risk of a typo'd key string diverging between the two, since there's only one literal string in the whole file.
- **Explicit handling of a subtle edge case:** Task 2's design note calls out and resolves the case where a first-time user could open the tour manually (via the help modal) before the automatic first-login trigger ever fires — `openTourCamara(reabierta)`'s boolean parameter distinguishes "opened automatically, mark on close" from "opened manually while never-seen, mark immediately" so the flag's semantics stay consistent regardless of entry path.
