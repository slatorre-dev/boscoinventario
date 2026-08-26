// Autoservicio de aulas — en qué aulas da clase el usuario logueado,
// además de su departamento. Lista plana con buscador sobre `AULAS` (ya
// cargada y filtrada por departamento en meta.js, misma fuente que usa
// Inicio), sin agrupar por ciclo como los módulos. Solo accesible desde
// el menú "📌 Mis Cursos/Aulas" de la topbar — a diferencia de los
// módulos, no tiene paso de onboarding tras elegir departamento.

let _misAulasSeleccionadas = new Set();

function _renderMisAulasList(query){
  const q = normalizeStr(query || '');
  const body = document.getElementById('mMisAulasBody');
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
  _renderMisAulasList(document.getElementById('misAulasSearch')?.value || '');
}

function openMisAulasModal(){
  closeMisCursosMenu();
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
  } catch(err){
    toast('Error: '+(err.message||'error de conexión'), 'err');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Guardar';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('misAulasSearch');
  if(search) search.addEventListener('input', filterMisAulas);
});
