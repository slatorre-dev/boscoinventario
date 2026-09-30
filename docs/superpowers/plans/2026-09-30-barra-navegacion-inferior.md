# Barra de navegación inferior — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Barra fija inferior en móvil/tablet (≤1024px) con 🏠 Inicio · 🔍 Buscar · ＋ Añadir · ⌛ Prestar · ☰ Más.

**Architecture:** Marcado estático en `index.html` + un archivo nuevo `js/bottom-nav.js` con toda la lógica (visibilidad, estado activo, badge, capa de búsqueda, modal de Añadir, ajuste de Volt). El resto de la app solo recibe enganches de una línea (`show()`, `applyRoleUI()`, `renderHome()`, menú móvil en `nav.js`). El buscador a pantalla completa **mueve** el nodo existente `#gsWrap` en vez de duplicarlo; ☰ Más reutiliza el menú `#topbarBtns` presentado como hoja inferior.

**Tech Stack:** Vanilla JS (scripts clásicos `defer`, funciones globales), CSS3, sin build step. Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-09-30-barra-navegacion-inferior-design.md`

## Global Constraints

- Solo **≤1024px** (`window.matchMedia('(max-width:1024px)')`) y **con sesión** (`SESSION` no nulo). Escritorio >1024px: cero cambios visuales.
- Nunca visible en páginas: `pLogin`, `pReset`, `pForcePassword`, `pSeleccionarDepartamento`, `pSeleccionarModulos`, `pSeleccionarAulas`.
- **Inicio no cambia** (las 4 acciones grandes se quedan como están).
- **No modificar** `js/search.js`, `js/prestamos.js`, `js/agente-widget.js` (solo llamar a sus funciones). Así no aplica la regla de modularización oportunista (Pendiente #26 de `claude.md`).
- z-index: barra `400`, capa de búsqueda `450`, modales `.mbg` ya usan `500`.
- Permisos: ＋ Añadir con `can('items.write')`, ⌛ Prestar con `can('loans.write')`.
- Textos en español, sin mencionar un departamento concreto.
- Sin tests automatizados de frontend en el repo (solo backend con Vitest): la verificación de cada tarea es con **Playwright MCP** sobre HTML estático servido con `python -m http.server 8765` desde la raíz del repo, simulando sesión (ver "Arnés de verificación").
- Repo dentro de Google Drive: antes de cada `git commit`/`push`, `find .git -iname "desktop.ini" -type f -delete`.
- `claude.md` está trackeado en minúsculas: `git add claude.md`.

## Arnés de verificación (común a todas las tareas)

Servidor: `python -m http.server 8765` (en background) desde la raíz del repo. Navegar a `http://localhost:8765/index.html?v=<n>` con viewport 390×844. Simular sesión con `browser_evaluate`:

```js
async () => {
  SESSION = { usuario:'t', nombre:'T', rol:'Jefe/a Departamento' }; // o 'Profesor/a' / 'Consulta'
  items = [{id:1,name:'Osciloscopio',aula:AULAS[0]?.id,qty:1,min:3,cat:'x',tipo_material:'consumible'}];
  itemsLoaded = true;
  document.querySelectorAll('[id*="plash"],[class*="splash"]').forEach(e=>e.style.display='none');
  applyRoleUI();
  goHome();
  await new Promise(r=>setTimeout(r,300));
  return true;
}
```

Para recargar CSS sin recargar la página: `const l=document.querySelector('link[href*="styles.css"]'); l.href=l.href.split('?')[0]+'?x='+Date.now();`.

## File Structure

- **Create** `js/bottom-nav.js` — toda la lógica de la barra.
- **Modify** `index.html` — marcado `#bottomNav`, `#searchOverlay`, modal `#mAddChoice`, `<script defer src="js/bottom-nav.js">` tras `js/nav.js`.
- **Modify** `css/styles.css` — bloque nuevo al final del archivo (barra, capa, hoja ☰, toasts, Volt).
- **Modify** `js/state.js:65-70` — `show()` llama a `bnOnPageChange()`.
- **Modify** `js/roles.js:142-168` — `applyRoleUI()` llama a `bnSync()` al final.
- **Modify** `js/home.js` — `renderHome()` llama a `bnSync()` (refresca el badge cuando llegan los préstamos).
- **Modify** `js/nav.js:281-307` — `toggleMobMenu`/`closeMobMenu` sincronizan la barra; el cierre por clic fuera ignora `#bnMore`; `_misCursosHintTarget()` apunta a `#bnMore` si el ⋮ está oculto.
- **Modify** `sw.js` — `VERSION` +1 (una vez, en la última tarea).

---

### Task 1: Barra básica (marcado, estilos, visibilidad, pestañas por rol, activo, badge, Volt y toasts)

**Files:**
- Create: `js/bottom-nav.js`
- Modify: `index.html` (marcado antes de `<script defer src="js/config.js">`, línea ~2328; script tras `js/nav.js`, línea ~2348)
- Modify: `css/styles.css` (añadir al final)
- Modify: `js/state.js:65-70`, `js/roles.js` (final de `applyRoleUI`), `js/home.js` (inicio de `renderHome`)

**Interfaces:**
- Produces: `bnSync()` (global, sin argumentos: recalcula visibilidad/pestañas/activo/badge/Volt), `bnOnPageChange()` (global: la llama `show()`; en esta tarea solo llama a `bnSync()`, la Task 3 le añade cerrar la capa de búsqueda), `BN_MQ` (MediaQueryList), clase `body.has-bottom-nav`.
- IDs de marcado: `#bottomNav`, `#bnHome`, `#bnSearch`, `#bnAdd`, `#bnLoan`, `#bnLoanBadge`, `#bnMore`. Las pestañas llaman a `goHome()`, `bnOpenSearch()` (Task 3), `openAddChoiceModal()` (Task 2), `openPrestarPicker()`, `bnToggleMore()` (Task 4). Hasta que existan, esas funciones se definen en esta tarea como stubs mínimos en `js/bottom-nav.js` que las tareas siguientes reemplazan.

- [ ] **Step 1: Marcado de la barra en `index.html`**

Insertar justo antes de `<script defer src="js/config.js"></script>`:

```html
<!-- ══ BARRA DE NAVEGACIÓN INFERIOR (≤1024px, ver js/bottom-nav.js) ══ -->
<nav class="bottom-nav" id="bottomNav" hidden aria-label="Navegación principal">
  <button class="bn-tab" id="bnHome" onclick="goHome()"><span class="bn-ico">🏠</span><span class="bn-lbl">Inicio</span></button>
  <button class="bn-tab" id="bnSearch" onclick="bnOpenSearch()"><span class="bn-ico">🔍</span><span class="bn-lbl">Buscar</span></button>
  <button class="bn-tab bn-tab-main" id="bnAdd" onclick="openAddChoiceModal()"><span class="bn-ico">＋</span><span class="bn-lbl">Añadir</span></button>
  <button class="bn-tab" id="bnLoan" onclick="openPrestarPicker()"><span class="bn-ico">⌛<span class="bn-badge" id="bnLoanBadge" hidden>0</span></span><span class="bn-lbl">Prestar</span></button>
  <button class="bn-tab" id="bnMore" onclick="bnToggleMore()"><span class="bn-ico">☰</span><span class="bn-lbl">Más</span></button>
</nav>
```

Y tras `<script defer src="js/nav.js"></script>`:

```html
<script defer src="js/bottom-nav.js"></script>
```

- [ ] **Step 2: Crear `js/bottom-nav.js`**

```js
// ═════════════════════════════════════════════════════════
// BARRA DE NAVEGACIÓN INFERIOR (≤1024px)
// Spec: docs/superpowers/specs/2026-09-30-barra-navegacion-inferior-design.md
// Solo con sesión y fuera de las pantallas de login/selección. En
// escritorio no existe. Las pestañas llaman a funciones ya existentes
// (goHome, openPrestarPicker…); este archivo solo gestiona la barra.
// ═════════════════════════════════════════════════════════
const BN_MQ = window.matchMedia('(max-width:1024px)');
const BN_SIN_BARRA = ['pLogin','pReset','pForcePassword','pSeleccionarDepartamento','pSeleccionarModulos','pSeleccionarAulas'];

function _bnPaginaActiva(){
  return document.querySelector('.page.active')?.id || '';
}

function bnSync(){
  const bar = document.getElementById('bottomNav');
  if(!bar) return;
  const visible = !!SESSION && BN_MQ.matches && !BN_SIN_BARRA.includes(_bnPaginaActiva());
  bar.hidden = !visible;
  document.body.classList.toggle('has-bottom-nav', visible);
  if(!visible) return;

  const puede = p => typeof can === 'function' && can(p);
  document.getElementById('bnAdd').hidden = !puede('items.write');
  document.getElementById('bnLoan').hidden = !puede('loans.write');

  // Pestaña activa: solo las que representan un "sitio" (Inicio, la capa
  // de búsqueda o el menú abierto). Añadir/Prestar son acciones.
  const buscando = document.getElementById('searchOverlay')?.classList.contains('open');
  const menuAbierto = document.getElementById('topbarBtns')?.classList.contains('open');
  const activa = buscando ? 'bnSearch' : menuAbierto ? 'bnMore' : (_bnPaginaActiva() === 'pH' ? 'bnHome' : '');
  bar.querySelectorAll('.bn-tab').forEach(t => t.classList.toggle('active', t.id === activa));

  const n = typeof getVencidosParaUsuario === 'function' ? getVencidosParaUsuario().length : 0;
  const badge = document.getElementById('bnLoanBadge');
  badge.textContent = n;
  badge.hidden = !n;

  _bnAjustarVolt();
}

// Volt: sin posición arrastrada lo coloca el CSS encima de la barra. Si el
// usuario lo arrastró (volt_fab_pos → top inline, ver js/agente-widget.js)
// se respeta, salvo que quede tapado por la barra: se sube lo justo.
function _bnAjustarVolt(){
  const fab = document.getElementById('agente-fab');
  const bar = document.getElementById('bottomNav');
  if(!fab || !bar || !fab.style.top) return;
  const limite = bar.getBoundingClientRect().top - fab.offsetHeight - 8;
  if(parseFloat(fab.style.top) > limite) fab.style.top = Math.max(60, limite) + 'px';
}

// Llamada desde show() (js/state.js) en cada cambio de página.
function bnOnPageChange(){
  bnSync();
}

// Stubs: los reemplazan las tareas 2-4 del plan.
function openAddChoiceModal(){ if(typeof openModal === 'function') openModal(); }
function bnOpenSearch(){ goHome(); document.getElementById('gsInput')?.focus(); }
function bnToggleMore(){ toggleMobMenu(); bnSync(); }

if(BN_MQ.addEventListener) BN_MQ.addEventListener('change', bnSync); else BN_MQ.addListener(bnSync);
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bnSync); else bnSync();
```

- [ ] **Step 3: Enganches de una línea**

`js/state.js`, dentro de `show(id)`, como última línea de la función:

```js
  if(typeof bnOnPageChange === 'function') bnOnPageChange();
```

`js/roles.js`, como última línea de `applyRoleUI()` (tras el bloque `deptWrap`):

```js
  if(typeof bnSync === 'function') bnSync();
```

`js/home.js`, primera línea dentro de `renderHome()` (antes de `let masGuardado`):

```js
  if(typeof bnSync === 'function') bnSync(); // badge de vencidos al llegar los préstamos
```

- [ ] **Step 4: Estilos al final de `css/styles.css`**

```css
/* ══ Barra de navegación inferior (≤1024px) — js/bottom-nav.js ══
   z-index 400: por debajo de los modales (.mbg, 500) y de la capa de
   búsqueda (450). [hidden] con !important porque .bottom-nav/.bn-tab
   declaran display. */
.bottom-nav{display:none}
.bottom-nav[hidden],.bn-tab[hidden],.bn-badge[hidden]{display:none!important}
@media (max-width:1024px){
  .bottom-nav{
    position:fixed;left:0;right:0;bottom:0;z-index:400;
    display:grid;grid-auto-flow:column;grid-auto-columns:1fr;
    height:calc(60px + env(safe-area-inset-bottom));
    padding-bottom:env(safe-area-inset-bottom);
    background:var(--white);border-top:1px solid var(--border);
    box-shadow:0 -4px 18px rgba(15,23,42,.08);
  }
  .bn-tab{
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
    background:none;border:none;color:var(--muted);font-family:var(--font);
    font-size:11px;font-weight:700;cursor:pointer;min-width:0;padding:4px 0;
  }
  .bn-ico{position:relative;font-size:20px;line-height:1}
  .bn-tab.active{color:var(--accent)}
  .bn-tab.active .bn-ico{transform:scale(1.08)}
  .bn-tab-main .bn-ico{
    width:40px;height:32px;border-radius:12px;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(135deg,var(--accent),#1d4ed8);color:#fff;font-size:20px;
  }
  .bn-badge{
    position:absolute;top:-6px;right:-10px;min-width:17px;height:17px;padding:0 4px;
    border-radius:9px;background:var(--red);color:#fff;font-size:10px;font-weight:800;
    display:flex;align-items:center;justify-content:center;
  }
  body.has-bottom-nav{padding-bottom:calc(64px + env(safe-area-inset-bottom))}
  body.has-bottom-nav .toasts{bottom:calc(72px + env(safe-area-inset-bottom));right:12px;left:12px;align-items:flex-end}
  body.has-bottom-nav #agente-fab{bottom:calc(72px + env(safe-area-inset-bottom))}
}
```

- [ ] **Step 5: Verificar con Playwright (390×844)**

Arrancar servidor, navegar, ejecutar el arnés con rol `'Jefe/a Departamento'`, y luego:

```js
() => {
  const bar = document.getElementById('bottomNav');
  const vis = [...bar.querySelectorAll('.bn-tab')].filter(t=>!t.hidden).map(t=>t.id);
  const fab = document.getElementById('agente-fab')?.getBoundingClientRect();
  return { hidden: bar.hidden, vis, activa: bar.querySelector('.active')?.id,
           barTop: Math.round(bar.getBoundingClientRect().top), fabBottom: fab && Math.round(fab.bottom),
           scrollW: document.documentElement.scrollWidth, vw: innerWidth };
}
```

Esperado: `hidden:false`, `vis` = los 5 ids, `activa:'bnHome'`, `fabBottom < barTop`, `scrollW <= vw`.

Repetir con `SESSION.rol='Consulta'` + `applyRoleUI()` → `vis` = `['bnHome','bnSearch','bnMore']`.
Con `prestamos=[{id:1,itemId:1,profesorNombre:'T',fechaDevolucion:'2020-01-01',estado:'activo'}]` + `bnSync()` → `#bnLoanBadge` visible (si `getVencidosParaUsuario()` no lo detecta por la forma del objeto, leer `isVencido` en `js/prestamos.js` y ajustar el objeto de prueba, no el código).
`show('pLogin')` → `hidden:true`. Viewport 1400×900 + `bnSync()` → `hidden:true` y `body` sin `has-bottom-nav`.
Captura de pantalla a 390px para revisar visualmente.

- [ ] **Step 6: Commit**

```bash
find .git -iname "desktop.ini" -type f -delete
git add js/bottom-nav.js index.html css/styles.css js/state.js js/roles.js js/home.js
git commit -m "feat: barra de navegacion inferior en movil (estructura, roles, badge)"
```

---

### Task 2: Modal ＋ Añadir (cámara o manual)

**Files:**
- Modify: `index.html` (modal nuevo junto a `#mStockChoice`, línea ~1279)
- Modify: `js/bottom-nav.js` (reemplazar stub `openAddChoiceModal`)

**Interfaces:**
- Consumes: `#bnAdd` llama a `openAddChoiceModal()` (Task 1).
- Produces: `openAddChoiceModal()`, `closeAddChoiceModal()`; modal `#mAddChoice`.

- [ ] **Step 1: Marcado del modal en `index.html`** (justo después del cierre `</div>` de `#mStockChoice`, mismo patrón)

```html
<div class="mbg" id="mAddChoice" onclick="if(event.target===this)closeAddChoiceModal()">
  <div class="modal" style="max-width:380px">
    <div class="mh"><div class="mt">＋ Añadir</div><button class="mx" onclick="closeAddChoiceModal()">✕</button></div>
    <p style="font-size:13px;color:var(--muted);margin:12px 0 18px;padding:0 20px">¿Cómo quieres añadir el material?</p>
    <div style="display:flex;flex-direction:column;gap:10px;padding:0 20px 20px">
      <button class="btn btn-p" onclick="closeAddChoiceModal();openCamaraUnificada()" style="width:100%;padding:12px;font-size:14px;text-align:left;display:block;white-space:normal;height:auto;line-height:1.4">
        <span style="font-size:18px;margin-right:8px">🎥</span>Con cámara<br><small style="font-size:11px;color:rgba(255,255,255,.85);font-weight:400">QR, código de barras, nº de serie o foto del objeto</small>
      </button>
      <button class="btn" onclick="closeAddChoiceModal();openModal()" style="width:100%;padding:12px;font-size:14px;border-color:var(--accent);color:var(--accent);text-align:left;display:block;white-space:normal;height:auto;line-height:1.4">
        <span style="font-size:18px;margin-right:8px">✍️</span>Manual<br><small style="font-size:11px;color:var(--muted);font-weight:400">Rellenar la ficha a mano</small>
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Reemplazar el stub en `js/bottom-nav.js`**

Sustituir la línea `function openAddChoiceModal(){ if(typeof openModal === 'function') openModal(); }` por:

```js
function openAddChoiceModal(){
  document.getElementById('mAddChoice').classList.add('open');
}
function closeAddChoiceModal(){
  document.getElementById('mAddChoice').classList.remove('open');
}
```

- [ ] **Step 3: Verificar con Playwright (390×844, arnés rol Jefe/a)**

```js
async () => {
  document.getElementById('bnAdd').click();
  const abierto = document.getElementById('mAddChoice').classList.contains('open');
  const btns = [...document.querySelectorAll('#mAddChoice .btn')].map(b=>b.textContent.trim().slice(0,12));
  closeAddChoiceModal();
  return { abierto, btns, cerrado: !document.getElementById('mAddChoice').classList.contains('open') };
}
```

Esperado: `abierto:true`, dos botones ("🎥Con cámara…", "✍️Manual…"), `cerrado:true`. Pulsar "✍️ Manual" debe abrir el modal de ítem (`#mItem` o el id que use `openModal()`, comprobar `.mbg.open`). Captura del modal abierto encima de la barra (la barra queda cubierta por el fondo del modal).

- [ ] **Step 4: Commit**

```bash
find .git -iname "desktop.ini" -type f -delete
git add index.html js/bottom-nav.js
git commit -m "feat: selector camara/manual para Anadir desde la barra inferior"
```

---

### Task 3: 🔍 Buscador a pantalla completa

**Files:**
- Modify: `index.html` (capa nueva justo después de `#bottomNav`)
- Modify: `js/bottom-nav.js` (reemplazar stub `bnOpenSearch`, ampliar `bnOnPageChange`)
- Modify: `css/styles.css` (añadir al bloque de la barra)

**Interfaces:**
- Consumes: `#gsWrap`, `#gsInput`, `#gsResults`, `globalSearch(q)` de `js/search.js` (sin modificarlo); `bnSync()`, `bnOnPageChange()` (Task 1).
- Produces: `bnOpenSearch()`, `bnCloseSearch()`, `#searchOverlay`, `#searchOverlayBody`.

Notas de diseño (del spec): la capa **mueve** `#gsWrap` a `#searchOverlayBody` y lo devuelve a su sitio al cerrar. Abrir hace `pushState('#buscar')`. ✕/Esc cierran con `history.back()` si la URL es `#buscar`; el `popstate` resultante navega a la vista anterior → `show()` → `bnOnPageChange()` → devuelve el buscador. `navigateFromHash('#buscar')` ya cae en el `goHome()` por defecto de `js/nav.js` (no hace falta caso nuevo). Elegir un resultado que navega (`gsGo` → `goAula` → `show()`) cierra la capa por la misma vía; abrir un ítem (modal, z 500) la deja debajo, y al cerrar el modal se vuelve a los resultados.

- [ ] **Step 1: Marcado en `index.html`** (justo después de `</nav>` de `#bottomNav`)

```html
<div class="search-overlay" id="searchOverlay" role="dialog" aria-label="Buscar">
  <div class="search-overlay-head">
    <strong>🔍 Buscar</strong>
    <button class="mx" onclick="bnCloseSearch()" aria-label="Cerrar búsqueda">✕</button>
  </div>
  <div class="search-overlay-body" id="searchOverlayBody"></div>
</div>
```

- [ ] **Step 2: Lógica en `js/bottom-nav.js`**

Sustituir el stub `function bnOpenSearch(){ goHome(); document.getElementById('gsInput')?.focus(); }` por:

```js
// ─── Buscador a pantalla completa ───────────────────────────
// Mueve el buscador real de Inicio (#gsWrap) a la capa y lo devuelve al
// cerrar: js/search.js depende de sus IDs y así sigue funcionando igual
// (historial, teclado, "crear ítem si no existe") sin duplicarlo.
let _bnGsOrigen = null; // { parent, next } donde vivía #gsWrap

function _bnBuscando(){
  return !!document.getElementById('searchOverlay')?.classList.contains('open');
}

function bnOpenSearch(){
  const capa = document.getElementById('searchOverlay');
  const wrap = document.getElementById('gsWrap');
  if(!capa || !wrap || _bnBuscando()) return;
  closeMobMenu();
  _bnGsOrigen = { parent: wrap.parentNode, next: wrap.nextSibling };
  document.getElementById('searchOverlayBody').appendChild(wrap);
  capa.classList.add('open');
  history.pushState({ page:'buscar' }, '', '#buscar');
  const inp = document.getElementById('gsInput');
  inp.focus();
  globalSearch(inp.value);
  bnSync();
}

// Devuelve #gsWrap a Inicio y cierra la capa (sin tocar el historial).
function _bnRestaurarBuscador(){
  if(!_bnBuscando()) return;
  const wrap = document.getElementById('gsWrap');
  if(_bnGsOrigen && wrap) _bnGsOrigen.parent.insertBefore(wrap, _bnGsOrigen.next);
  _bnGsOrigen = null;
  document.getElementById('searchOverlay').classList.remove('open');
  document.getElementById('gsResults')?.classList.remove('open');
  bnSync();
}

// ✕ / Esc: si la entrada #buscar sigue en el historial, "atrás" la quita y
// el popstate resultante (show → bnOnPageChange) restaura el buscador.
function bnCloseSearch(){
  if(!_bnBuscando()) return;
  if(location.hash === '#buscar') history.back();
  else _bnRestaurarBuscador();
}

document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && _bnBuscando() && !document.querySelector('.mbg.open')) bnCloseSearch();
});
```

Y cambiar `bnOnPageChange` a:

```js
function bnOnPageChange(){
  _bnRestaurarBuscador();
  bnSync();
}
```

- [ ] **Step 3: Estilos** (dentro del bloque `@media (max-width:1024px)` de la barra, antes de su `}` final; y la regla base fuera)

Fuera del media query (junto a `.bottom-nav{display:none}`):

```css
.search-overlay{display:none}
```

Dentro del `@media (max-width:1024px)`:

```css
  .search-overlay.open{
    position:fixed;inset:0;z-index:450;background:var(--bg);
    display:flex;flex-direction:column;gap:12px;
    padding:12px 16px calc(72px + env(safe-area-inset-bottom));
  }
  .search-overlay-head{display:flex;align-items:center;justify-content:space-between;font-size:16px}
  .search-overlay-body{flex:1;min-height:0;display:flex;flex-direction:column}
  #searchOverlay .gsearch-wrap{margin:0!important;max-width:none;flex:1;min-height:0;display:flex;flex-direction:column;box-shadow:none}
  #searchOverlay .gsr{position:static;max-height:none;flex:1;margin-top:10px;overflow-y:auto}
```

(`#searchOverlay .gsearch-wrap` necesita conservar el input en fila: si al hacerlo `flex-direction:column` el icono 🔍/✕ del input se descolocan, envolver solo la regla de `.gsr` y dejar `.gsearch-wrap` con `margin:0!important;max-width:none` — verificar en la captura del Step 4.)

- [ ] **Step 4: Verificar con Playwright (390×844, arnés rol Profesor/a)**

```js
async () => {
  const origen = document.getElementById('gsWrap').parentNode.id || document.getElementById('gsWrap').parentNode.className;
  bnOpenSearch();
  const r = { abierta: _bnBuscando(), hash: location.hash,
              dentro: !!document.querySelector('#searchOverlayBody #gsWrap'),
              foco: document.activeElement?.id,
              activa: document.querySelector('#bottomNav .active')?.id };
  document.getElementById('gsInput').value = 'osci'; globalSearch('osci');
  r.resultados = document.querySelectorAll('#gsResults .gsr-item').length;
  bnCloseSearch();
  await new Promise(res=>setTimeout(res,300));
  r.tras = { abierta: _bnBuscando(), hash: location.hash,
             vuelto: !document.querySelector('#searchOverlay #gsWrap'),
             origenIgual: (document.getElementById('gsWrap').parentNode.id || document.getElementById('gsWrap').parentNode.className) === origen };
  return r;
}
```

Esperado: `abierta:true`, `hash:'#buscar'`, `dentro:true`, `foco:'gsInput'`, `activa:'bnSearch'`, `resultados>=1`; tras cerrar: `abierta:false`, hash distinto de `#buscar`, `vuelto:true`, `origenIgual:true`.

Además: abrir, luego `history.back()` (simula botón atrás del móvil) → capa cerrada y buscador de vuelta. Abrir, buscar y hacer clic en un resultado de aula (`gsGo`) → navega y la capa se cierra. Tras todo, en Inicio el buscador sigue funcionando (`globalSearch('osci')` muestra resultados en `#gsResults` de Inicio). Captura con la capa abierta y resultados.

- [ ] **Step 5: Commit**

```bash
find .git -iname "desktop.ini" -type f -delete
git add index.html js/bottom-nav.js css/styles.css
git commit -m "feat: buscador a pantalla completa desde la barra inferior"
```

---

### Task 4: ☰ Más como hoja inferior (sustituye al ⋮ en móvil)

**Files:**
- Modify: `js/bottom-nav.js` (reemplazar stub `bnToggleMore`)
- Modify: `js/nav.js:281-307`
- Modify: `css/styles.css` (bloque de la barra)

**Interfaces:**
- Consumes: `toggleMobMenu()`, `closeMobMenu()`, `#topbarBtns`, `#mobMenuBtn` (`js/nav.js`, `index.html`); `bnSync()`.
- Produces: `bnToggleMore()`.

Notas: `#topbarBtns` vive dentro de `.topbar` (z-index 100, crea su propio contexto de apilamiento). Como hoja inferior se ancla con `position:fixed` encima de la barra, así que no se solapa con ella y el z-index relativo no importa. El handler de clic fuera (`js/nav.js:300-307`) cerraría el menú justo después de abrirlo con ☰ (el clic burbujea a `document`): hay que excluir `#bnMore`.

- [ ] **Step 1: `js/nav.js`**

`toggleMobMenu` y `closeMobMenu` pasan a:

```js
function toggleMobMenu(){
  document.getElementById('topbarBtns').classList.toggle('open');
  if(typeof bnSync === 'function') bnSync();
}
function closeMobMenu(){
  document.getElementById('topbarBtns').classList.remove('open');
  if(typeof bnSync === 'function') bnSync();
}
```

En `_misCursosHintTarget()`, antes del `return null;` final:

```js
  const bnMore = document.getElementById('bnMore');
  if (bnMore && bnMore.offsetParent !== null) return bnMore;
```

En el `document.addEventListener('click', …)`, la primera condición pasa a:

```js
  if(!e.target.closest('#topbarBtns') && !e.target.closest('#mobMenuBtn') && !e.target.closest('#bnMore'))
    closeMobMenu();
```

- [ ] **Step 2: `js/bottom-nav.js`** — sustituir el stub `function bnToggleMore(){ toggleMobMenu(); bnSync(); }` por:

```js
// ☰ Más: el menú de siempre (#topbarBtns), presentado como hoja inferior
// por CSS. Cierra antes la capa de búsqueda si estaba abierta.
function bnToggleMore(){
  if(_bnBuscando()) bnCloseSearch();
  toggleMobMenu(); // ya llama a bnSync()
}
```

- [ ] **Step 3: Estilos** (dentro del `@media (max-width:1024px)` de la barra; ganan por orden de cascada y `body.has-bottom-nav` sube la especificidad sobre las reglas previas de `.topbar-btns` en los bloques ≤640/≤1200)

```css
  body.has-bottom-nav .mob-menu-btn{display:none!important}
  body.has-bottom-nav .topbar-btns{
    position:fixed!important;top:auto!important;left:0!important;right:0!important;
    bottom:calc(60px + env(safe-area-inset-bottom))!important;
    max-height:70vh;overflow-y:auto!important;min-width:0!important;
    border-radius:18px 18px 0 0!important;border:1px solid var(--border)!important;border-bottom:none!important;
    border-top:3px solid var(--accent)!important;
    padding:12px 12px 8px!important;
    box-shadow:0 -12px 32px rgba(15,23,42,.18)!important;
  }
```

- [ ] **Step 4: Verificar con Playwright (390×844, arnés rol Jefe/a)**

```js
async () => {
  const menu = document.getElementById('topbarBtns');
  const r = { tresPuntos: getComputedStyle(document.getElementById('mobMenuBtn')).display };
  document.getElementById('bnMore').click();
  await new Promise(res=>setTimeout(res,100));
  const m = menu.getBoundingClientRect(), b = document.getElementById('bottomNav').getBoundingClientRect();
  r.abierto = menu.classList.contains('open');
  r.pegadoABarra = Math.abs(m.bottom - b.top) <= 2;
  r.activa = document.querySelector('#bottomNav .active')?.id;
  r.items = [...menu.querySelectorAll('.tbtn,.dept-menu-item')].filter(x=>x.offsetParent).length;
  document.body.click();
  await new Promise(res=>setTimeout(res,100));
  r.cerradoFuera = !menu.classList.contains('open');
  return r;
}
```

Esperado: `tresPuntos:'none'`, `abierto:true`, `pegadoABarra:true`, `activa:'bnMore'`, `items>=5`, `cerradoFuera:true`. Pulsar ☰ dos veces seguidas lo abre y lo cierra. Captura con la hoja abierta. A 1400px: ⋮ sigue como antes (oculto en escritorio, menú superior normal) y sin barra.

- [ ] **Step 5: Commit**

```bash
find .git -iname "desktop.ini" -type f -delete
git add js/nav.js js/bottom-nav.js css/styles.css
git commit -m "feat: menu Mas como hoja inferior desde la barra, sin el boton de tres puntos"
```

---

### Task 5: Verificación completa, versión, documentación y push

**Files:**
- Modify: `sw.js` (`VERSION` +1 sobre el valor actual)
- Modify: `docs/DEVELOPMENT.md` (entrada nueva al final de la sección de sesiones, antes de `**Última actualización:**`), `claude.md` (párrafo **Estado** al principio)

- [ ] **Step 1: Matriz de verificación con Playwright**

Para cada combinación de viewport **390×844, 768×1024, 1400×900** y rol **Jefe/a Departamento, Profesor/a, Consulta** (arnés + `applyRoleUI()`), comprobar:

```js
() => {
  const bar = document.getElementById('bottomNav');
  return { vw: innerWidth, barra: !bar.hidden,
    tabs: [...bar.querySelectorAll('.bn-tab')].filter(t=>!t.hidden).map(t=>t.id),
    scrollH: document.documentElement.scrollWidth > innerWidth,
    tresPuntos: getComputedStyle(document.getElementById('mobMenuBtn')).display };
}
```

Esperado: 390/768 → `barra:true`, tabs según rol (Jefe/a y Profesor/a: 5; Consulta: `bnHome,bnSearch,bnMore`), `scrollH:false`, `tresPuntos:'none'`. 1400 → `barra:false` y aspecto idéntico al de antes (captura comparada con `git stash`/`HEAD~4` si hay duda).
Además, a 390px: con una vista de aula larga (`goAula(AULAS[0].id)` con ~30 ítems simulados) hacer scroll al final → el último ítem no queda tapado por la barra; un `toast('Prueba','ok')` aparece por encima de la barra; Volt por encima de la barra.

- [ ] **Step 2: Versión y documentación**

`sw.js`: incrementar `VERSION` en 1.

`docs/DEVELOPMENT.md`: nueva entrada `### 30/09/2026 (vNNN): Barra de navegación inferior en móvil/tablet` con: pestañas y comportamiento, que Buscar mueve `#gsWrap`, que ☰ reutiliza `#topbarBtns`, enganches en `state.js`/`roles.js`/`home.js`/`nav.js`, que `search.js`/`prestamos.js`/`agente-widget.js` no se tocaron, y el resultado de la matriz de verificación. Enlazar la spec y este plan.

`claude.md`: anteponer al párrafo **Estado** una línea `**Estado:** vNNN | 30/09/2026 | Barra de navegación inferior en móvil/tablet (Inicio · Buscar · Añadir · Prestar · Más) …` de 2-3 frases.

- [ ] **Step 3: Commit y push**

```bash
find .git -iname "desktop.ini" -type f -delete
git fetch origin && git log --oneline HEAD..origin/main   # si hay commits: git rebase origin/main y resolver sw.js/claude.md renumerando la versión
git add sw.js docs/DEVELOPMENT.md claude.md docs/superpowers/plans/2026-09-30-barra-navegacion-inferior.md
git commit -m "chore: vNNN - barra de navegacion inferior en movil/tablet"
git push origin main
```
