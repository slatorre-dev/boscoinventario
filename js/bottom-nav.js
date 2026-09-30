// ═════════════════════════════════════════════════════════
// BARRA DE NAVEGACIÓN INFERIOR (≤1024px)
// Spec: docs/superpowers/specs/2026-09-30-barra-navegacion-inferior-design.md
// Solo con sesión y fuera de las pantallas de login/selección. En
// escritorio no existe. Las pestañas llaman a funciones ya existentes
// (goHome, openPrestarPicker, openCamaraUnificada, openModal…); este
// archivo solo gestiona la barra, la capa de búsqueda y el modal de Añadir.
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
  const menuAbierto = document.getElementById('topbarBtns')?.classList.contains('open');
  const activa = _bnBuscando() ? 'bnSearch' : menuAbierto ? 'bnMore' : (_bnPaginaActiva() === 'pH' ? 'bnHome' : '');
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

// Llamada desde show() (js/state.js) en cada cambio de página: si la capa
// de búsqueda estaba abierta (se eligió un resultado, o "atrás"), se cierra.
function bnOnPageChange(){
  _bnRestaurarBuscador();
  bnSync();
}

// ─── ＋ Añadir: cámara o manual ─────────────────────────────
function openAddChoiceModal(){
  document.getElementById('mAddChoice').classList.add('open');
}
function closeAddChoiceModal(){
  document.getElementById('mAddChoice').classList.remove('open');
}

// ─── ☰ Más ──────────────────────────────────────────────────
// El menú de siempre (#topbarBtns), presentado como hoja inferior por CSS.
function bnToggleMore(){
  if(_bnBuscando()) bnCloseSearch();
  toggleMobMenu(); // ya llama a bnSync()
}

// ─── 🔍 Buscador a pantalla completa ────────────────────────
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

if(BN_MQ.addEventListener) BN_MQ.addEventListener('change', bnSync); else BN_MQ.addListener(bnSync);
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bnSync); else bnSync();
