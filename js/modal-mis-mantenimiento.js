// Autoservicio de categorías de mantenimiento — en qué categorías se
// compromete el usuario logueado a hacer las revisiones preventivas,
// además de su departamento. Lista plana sobre CATS (objeto {name:{...}},
// ya filtrado por departamento en meta.js) + una fila especial "Todo el
// departamento" (valor ''), mismo patrón que js/modal-mis-aulas.js.
// Solo accesible desde el menú "📌 Mis Cursos/Aulas" de la topbar.

let _misMantSeleccionadas = new Set();

function _renderMisMantList(query){
  const q = normalizeStr(query || '');
  const body = document.getElementById('mMisMantBody');
  if(!body) return;
  const nombres = Object.keys(CATS || {}).filter(n => !q || normalizeStr(n).includes(q));
  const filaTodo = !q ? `
    <label class="mod-check-row">
      <input type="checkbox" value="" ${_misMantSeleccionadas.has('')?'checked':''} onchange="_toggleMisMant('',this.checked)">
      <span class="mod-check-name">🏷️ Todo el departamento</span>
    </label>` : '';
  const filas = nombres.map(n => `
    <label class="mod-check-row">
      <input type="checkbox" value="${escHtml(n)}" ${_misMantSeleccionadas.has(n)?'checked':''} onchange="_toggleMisMant('${escHtml(n)}',this.checked)">
      <span class="mod-check-name">${CATS[n]?.i?escHtml(CATS[n].i)+' ':''}${escHtml(n)}</span>
    </label>`).join('');
  body.innerHTML = filaTodo + filas || '<p style="color:var(--muted);font-size:13px">Sin resultados.</p>';
}

function _toggleMisMant(cat, checked){
  if(checked) _misMantSeleccionadas.add(cat);
  else _misMantSeleccionadas.delete(cat);
}

function filterMisMant(){
  _renderMisMantList(document.getElementById('misMantSearch')?.value || '');
}

function openMisMantModal(){
  closeMisCursosMenu();
  _misMantSeleccionadas = new Set(MIS_MANT_CATEGORIAS);
  document.getElementById('misMantSearch').value = '';
  _renderMisMantList('');
  document.getElementById('mMisMant').classList.add('open');
}

function closeMisMantModal(){
  document.getElementById('mMisMant').classList.remove('open');
}

async function guardarMisMantModal(){
  const btn = document.getElementById('btnGuardarMisMant');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    const res = await apiPost({ action:'selectMantenimientoCategorias', categorias:[..._misMantSeleccionadas] });
    if(!res.ok) throw new Error(res.error || 'Error al guardar las categorías');
    MIS_MANT_CATEGORIAS = [..._misMantSeleccionadas];
    toast('Categorías de mantenimiento actualizadas', 'ok');
    closeMisMantModal();
  } catch(err){
    toast('Error: '+(err.message||'error de conexión'), 'err');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Guardar';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('misMantSearch');
  if(search) search.addEventListener('input', filterMisMant);
});
