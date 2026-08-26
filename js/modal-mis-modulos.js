// Autoservicio de módulos/asignaturas — checklist agrupada por ciclo,
// reusada por dos puntos de entrada: la pantalla de onboarding tras elegir
// departamento (js/auth.js:abrirSeleccionModulosOnboarding) y el modal
// "📚 Mis módulos" accesible en cualquier momento desde la topbar.
// Misma UI que el modal admin (js/prestamos.js:_renderModUsuarioGroups)
// pero autoreferenciada: siempre el usuario logueado, nunca un índice de
// _usuariosEditing.

let _misModulosCiclos = []; // [{cid,name,nivel,mods:[{mid,cod,name,checked,otrosEmails}]}]
let _misModulosSeleccionados = new Set();
let _misModulosExpanded = new Set();
let _misModulosBodyId = '';
let _misModulosSearchId = '';

function _construirMisModulosCiclos(){
  const cicloMap = {};
  const cicloOrder = [];
  CICLOS.forEach(c => {
    if(c.id === 'departamento') return;
    cicloMap[c.id] = { name: c.name, nivel: c.nivel || '', mods: [] };
    cicloOrder.push(c.id);
    c.modulos.forEach(m => cicloMap[c.id].mods.push({
      mid: `${c.id}__${m.cod}`, cod: String(m.cod), name: m.name,
      otrosEmails: m.responsablesEmails || []
    }));
  });
  _misModulosCiclos = cicloOrder.map(cid => {
    const c = cicloMap[cid];
    const mods = c.mods.map(m => ({ ...m, checked: _misModulosSeleccionados.has(m.mid) }));
    return { cid, name: c.name, nivel: c.nivel, mods };
  }).filter(c => c.mods.length);
}

function _renderMisModulosGroups(query){
  const q = normalizeStr(query || '');
  const body = document.getElementById(_misModulosBodyId);
  if(!body) return;
  const html = _misModulosCiclos.map(c => {
    const modsFiltrados = q ? c.mods.filter(m => normalizeStr(m.name).includes(q)) : c.mods;
    if(!modsFiltrados.length) return '';
    const nMarcados = c.mods.filter(m => m.checked).length;
    const expanded = !!q || _misModulosExpanded.has(c.cid) || nMarcados > 0;
    const rows = modsFiltrados.map(m => {
      const otroResp = m.otrosEmails.length
        ? `<span class="mod-otro-resp" title="${escHtml(m.otrosEmails.join(', '))}">También: ${escHtml(m.otrosEmails.slice(0,2).join(', '))}${m.otrosEmails.length>2?` +${m.otrosEmails.length-2}`:''}</span>`
        : '';
      return `<label class="mod-check-row">
        <input type="checkbox" value="${m.mid}" ${m.checked?'checked':''} onchange="_toggleMisModulo('${m.mid}',this.checked)">
        <span class="mod-check-name">${escHtml(m.name)}</span>
        ${otroResp}
      </label>`;
    }).join('');
    return `<div class="mod-ciclo-group">
      <div class="mod-ciclo-title" style="cursor:pointer;display:flex;align-items:center;gap:6px" onclick="_toggleMisModulosCicloExpand('${c.cid}')">
        <span style="font-size:11px;color:var(--muted)">${expanded?'▼':'▶'}</span>
        <span>${escHtml(c.name)}${c.nivel?' · '+escHtml(c.nivel):''}</span>
        ${nMarcados?`<span class="usr-mod-badge" style="margin-left:auto">${nMarcados}</span>`:''}
      </div>
      ${expanded ? rows : ''}
    </div>`;
  }).join('');
  body.innerHTML = html || '<p style="color:var(--muted);font-size:13px">Sin resultados.</p>';
}

function _toggleMisModulosCicloExpand(cid){
  if(_misModulosExpanded.has(cid)) _misModulosExpanded.delete(cid);
  else _misModulosExpanded.add(cid);
  _renderMisModulosGroups(document.getElementById(_misModulosSearchId)?.value || '');
}

function _toggleMisModulo(mid, checked){
  if(checked) _misModulosSeleccionados.add(mid);
  else _misModulosSeleccionados.delete(mid);
  for(const c of _misModulosCiclos){
    const m = c.mods.find(mm => mm.mid === mid);
    if(m){ m.checked = checked; if(checked) _misModulosExpanded.add(c.cid); break; }
  }
  _renderMisModulosGroups(document.getElementById(_misModulosSearchId)?.value || '');
}

function filterMisModulos(){
  _renderMisModulosGroups(document.getElementById(_misModulosSearchId)?.value || '');
}

// ─── Onboarding (tras elegir departamento) ────────────────
function abrirSeleccionModulosOnboarding(){
  _misModulosBodyId = 'onboardingModulosBody';
  _misModulosSearchId = 'onboardingModulosSearch';
  _misModulosSeleccionados = new Set(MIS_MODULOS);
  _misModulosExpanded = new Set();
  _construirMisModulosCiclos();
  document.getElementById('onboardingModulosSearch').value = '';
  _renderMisModulosGroups('');
  show('pSeleccionarModulos');
}

function saltarSeleccionModulos(){
  showUserChip();
  _showOverlay();
  loadData();
}

async function guardarSeleccionModulosOnboarding(){
  const btn = document.getElementById('onboardingModulosBtn');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    const res = await apiPost({ action:'selectModulos', modulos:[..._misModulosSeleccionados] });
    if(!res.ok) throw new Error(res.error || 'Error al guardar los módulos');
    MIS_MODULOS = [..._misModulosSeleccionados];
    showUserChip();
    _showOverlay();
    loadData();
  } catch(err){
    toast('Error: '+(err.message||'error de conexión'), 'err');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Guardar y continuar';
  }
}

// ─── Modal "Mis módulos" (accesible en cualquier momento) ──
function openMisModulosModal(){
  _misModulosBodyId = 'mMisModulosBody';
  _misModulosSearchId = 'misModulosSearch';
  _misModulosSeleccionados = new Set(MIS_MODULOS);
  _misModulosExpanded = new Set();
  _construirMisModulosCiclos();
  document.getElementById('misModulosSearch').value = '';
  _renderMisModulosGroups('');
  document.getElementById('mMisModulos').classList.add('open');
}

function closeMisModulosModal(){
  document.getElementById('mMisModulos').classList.remove('open');
}

async function guardarMisModulosModal(){
  const btn = document.getElementById('btnGuardarMisModulos');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    const res = await apiPost({ action:'selectModulos', modulos:[..._misModulosSeleccionados] });
    if(!res.ok) throw new Error(res.error || 'Error al guardar los módulos');
    MIS_MODULOS = [..._misModulosSeleccionados];
    toast('Módulos actualizados', 'ok');
    closeMisModulosModal();
  } catch(err){
    toast('Error: '+(err.message||'error de conexión'), 'err');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Guardar';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const onboardingSearch = document.getElementById('onboardingModulosSearch');
  if(onboardingSearch) onboardingSearch.addEventListener('input', filterMisModulos);
  const modalSearch = document.getElementById('misModulosSearch');
  if(modalSearch) modalSearch.addEventListener('input', filterMisModulos);
});
