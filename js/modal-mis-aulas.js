// Autoservicio de aulas — en qué aulas da clase el usuario logueado,
// además de su departamento. Lista plana con buscador sobre `AULAS` (ya
// cargada y filtrada por departamento en meta.js, misma fuente que usa
// Inicio), sin agrupar por ciclo como los módulos. Reusada por dos puntos
// de entrada, igual que modal-mis-modulos.js: la pantalla de onboarding
// tras elegir módulos (js/auth.js:abrirSeleccionModulosOnboarding llama a
// abrirSeleccionAulasOnboarding) y el modal "🏫 Aulas" accesible en
// cualquier momento desde la topbar.

let _misAulasSeleccionadas = new Set();
let _misAulasBodyId = '';
let _misAulasSearchId = '';

function _renderMisAulasList(query){
  const q = normalizeStr(query || '');
  const body = document.getElementById(_misAulasBodyId);
  if(!body) return;
  const aulas = (AULAS || []).filter(a => !q || normalizeStr(a.name || a.id).includes(q));
  body.innerHTML = aulas.map(a => `
    <label class="mod-check-row">
      <input type="checkbox" value="${escHtml(a.id)}" ${_misAulasSeleccionadas.has(a.id)?'checked':''} onchange="_toggleMisAula('${escHtml(a.id)}',this.checked)">
      <span class="mod-check-name">${a.icon?escHtml(a.icon)+' ':''}${escHtml(a.name || a.id)}</span>
    </label>
  `).join('') || '<p style="color:var(--muted);font-size:13px">Sin resultados.</p>';
}

function _toggleMisAula(id, checked){
  if(checked) _misAulasSeleccionadas.add(id);
  else _misAulasSeleccionadas.delete(id);
}

function filterMisAulas(){
  _renderMisAulasList(document.getElementById(_misAulasSearchId)?.value || '');
}

// ─── Onboarding (tras elegir módulos) ────────────────
function abrirSeleccionAulasOnboarding(){
  _misAulasBodyId = 'onboardingAulasBody';
  _misAulasSearchId = 'onboardingAulasSearch';
  _misAulasSeleccionadas = new Set(MIS_AULAS);
  document.getElementById('onboardingAulasSearch').value = '';
  _renderMisAulasList('');
  show('pSeleccionarAulas');
}

async function _finalizarOnboarding(){
  try {
    const res = await apiPost({ action:'completarOnboarding' });
    if(!res.ok) console.warn('completarOnboarding:', res.error);
  } catch(err){
    console.warn('completarOnboarding falló:', err.message || err);
  }
  showUserChip();
  _showOverlay();
  loadData();
}

function saltarSeleccionAulas(){
  _finalizarOnboarding();
}

async function guardarSeleccionAulasOnboarding(){
  const btn = document.getElementById('onboardingAulasBtn');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    const res = await apiPost({ action:'selectAulas', aulas:[..._misAulasSeleccionadas] });
    if(!res.ok) throw new Error(res.error || 'Error al guardar las aulas');
    MIS_AULAS = [..._misAulasSeleccionadas];
    await _finalizarOnboarding();
  } catch(err){
    toast('Error: '+(err.message||'error de conexión'), 'err');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Guardar y continuar';
  }
}

// ─── Modal "Mis aulas" (accesible en cualquier momento) ──
function openMisAulasModal(){
  closeMisCursosMenu();
  _misAulasBodyId = 'mMisAulasBody';
  _misAulasSearchId = 'misAulasSearch';
  _misAulasSeleccionadas = new Set(MIS_AULAS);
  document.getElementById('misAulasSearch').value = '';
  _renderMisAulasList('');
  document.getElementById('mMisAulas').classList.add('open');
}

function closeMisAulasModal(){
  document.getElementById('mMisAulas').classList.remove('open');
}

async function guardarMisAulasModal(){
  const btn = document.getElementById('btnGuardarMisAulas');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    const res = await apiPost({ action:'selectAulas', aulas:[..._misAulasSeleccionadas] });
    if(!res.ok) throw new Error(res.error || 'Error al guardar las aulas');
    MIS_AULAS = [..._misAulasSeleccionadas];
    toast('Aulas actualizadas', 'ok');
    closeMisAulasModal();
    // Sin esto, Inicio se queda con el filtro/aviso viejo hasta que el
    // usuario navega a otra pantalla y vuelve — el cambio de MIS_AULAS de
    // arriba no se ve reflejado por sí solo (ver debeFiltrarPorMisAulas()
    // en js/config.js, que usa esta misma variable).
    if(typeof renderHome === 'function') renderHome();
  } catch(err){
    toast('Error: '+(err.message||'error de conexión'), 'err');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Guardar';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const onboardingSearch = document.getElementById('onboardingAulasSearch');
  if(onboardingSearch) onboardingSearch.addEventListener('input', filterMisAulas);
  const modalSearch = document.getElementById('misAulasSearch');
  if(modalSearch) modalSearch.addEventListener('input', filterMisAulas);
});
