// Modal del historial de acciones.

let historialData = [];

function historialText(value) {
  return String(value || '').toLowerCase();
}

function historialEsc(value) {
  return String(value ?? '-').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function _historialPlainSummary(resumenRaw){
  try {
    const parsed = JSON.parse(resumenRaw);
    if(Array.isArray(parsed) && parsed.length && parsed.every(d => d && typeof d === 'object' && 'campo' in d && 'antes' in d && 'despues' in d)){
      const labels = parsed.map(d => (typeof HISTORIAL_DIFF_FIELDS_LABELS !== 'undefined' && HISTORIAL_DIFF_FIELDS_LABELS[d.campo]) || d.campo);
      return `${parsed.length} campo${parsed.length===1?'':'s'} modificado${parsed.length===1?'':'s'}: ${labels.join(', ')}`;
    }
  } catch(e) { /* no es JSON: se usa el texto tal cual */ }
  return resumenRaw;
}

function historialBadgeClass(action) {
  return 'badge-' + String(action || 'accion').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function openHistorialModal() {
  if (!canAccessHistorial()) {
    toast('Solo el administrador o jefe de departamento puede acceder al historial', 'err');
    return;
  }

  const modal = document.getElementById('mHistorial');
  modal.style.display = 'flex';
  modal.classList.add('open');
  cargarHistorial();
}

function closeHistorialModal() {
  const modal = document.getElementById('mHistorial');
  modal.classList.remove('open');
  modal.style.display = 'none';
}

async function cargarHistorial() {
  const tbody = document.getElementById('historialTbody');
  const empty = document.getElementById('historialEmpty');
  const table = document.getElementById('historialTable');
  const summary = document.getElementById('historialSummary');

  tbody.innerHTML = '';
  empty.textContent = 'Cargando...';
  empty.style.display = 'block';
  table.style.display = 'none';
  if (summary) summary.textContent = 'Cargando...';

  try {
    historialData = await apiGet('historial');
    populateActionFilter(historialData);

    if (!historialData || historialData.length === 0) {
      empty.textContent = 'No hay historial registrado aun';
      if (summary) summary.textContent = '0 acciones';
      return;
    }

    renderHistorial(historialData);
  } catch (err) {
    console.error('Error loading historial:', err);
    empty.textContent = 'Error al cargar el historial: ' + err.message;
    if (summary) summary.textContent = 'Error de carga';
  }
}

function renderHistorial(data) {
  const tbody = document.getElementById('historialTbody');
  const empty = document.getElementById('historialEmpty');
  const table = document.getElementById('historialTable');
  const summary = document.getElementById('historialSummary');

  if (summary) summary.textContent = `${data.length} de ${historialData.length} acciones`;

  if (!data.length) {
    tbody.innerHTML = '';
    table.style.display = 'none';
    empty.textContent = 'No hay acciones que coincidan con los filtros.';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  table.style.display = 'table';
  tbody.innerHTML = data.map(h => `
    <tr>
      <td class="ts">${historialEsc(h.timestamp)}</td>
      <td class="usr">${historialEsc(h.usuario)}</td>
      <td class="tipo">${historialEsc(h.tipo)}</td>
      <td class="act"><span class="badge ${historialBadgeClass(h.accion)}">${historialEsc(h.accion)}</span></td>
      <td class="que">${historialEsc(h.que)}</td>
      <td class="nom">${historialEsc(h.nombre)}</td>
      <td class="det" title="${historialEsc(_historialPlainSummary(h.detalles))}">${historialEsc(_historialPlainSummary(h.detalles))}</td>
    </tr>
  `).join('');
}

function populateActionFilter(data) {
  const select = document.getElementById('filterAccion');
  const current = select.value;
  const actions = [...new Set((data || []).map(h => h.accion).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' }));

  select.innerHTML = '<option value="">Todas las acciones</option>' +
    actions.map(action => `<option value="${historialEsc(action)}">${historialEsc(action)}</option>`).join('');

  if (actions.includes(current)) select.value = current;
  populateTypeFilter(data);
}

function populateTypeFilter(data) {
  const select = document.getElementById('filterTipo');
  const current = select.value;
  const types = [...new Set((data || []).map(h => h.tipo).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' }));

  select.innerHTML = '<option value="">Todos los tipos</option>' +
    types.map(type => `<option value="${historialEsc(type)}">${historialEsc(type)}</option>`).join('');

  if (types.includes(current)) select.value = current;
}

function filtrarHistorial() {
  const usuario = historialText(document.getElementById('filterUsuario').value);
  const accion = document.getElementById('filterAccion').value;
  const tipo = document.getElementById('filterTipo').value;
  const que = historialText(document.getElementById('filterQue').value);

  const filtered = historialData.filter(h => {
    const matchUsr = !usuario || historialText(h.usuario).includes(usuario);
    const matchAct = !accion || h.accion === accion;
    const matchTipo = !tipo || h.tipo === tipo;
    const haystack = [h.que, h.nombre, h.detalles, h.accion, h.tipo, h.timestamp].map(historialText).join(' ');
    const matchQue = !que || haystack.includes(que);
    return matchUsr && matchAct && matchTipo && matchQue;
  });

  renderHistorial(filtered);
}

function limpiarFiltrosHistorial() {
  document.getElementById('filterUsuario').value = '';
  document.getElementById('filterAccion').value = '';
  document.getElementById('filterTipo').value = '';
  document.getElementById('filterQue').value = '';
  renderHistorial(historialData);
}

document.addEventListener('DOMContentLoaded', () => {
  const usuario = document.getElementById('filterUsuario');
  const accion = document.getElementById('filterAccion');
  const tipo = document.getElementById('filterTipo');
  const que = document.getElementById('filterQue');
  if (usuario) usuario.addEventListener('input', filtrarHistorial);
  if (accion) accion.addEventListener('change', filtrarHistorial);
  if (tipo) tipo.addEventListener('change', filtrarHistorial);
  if (que) que.addEventListener('input', filtrarHistorial);
});

// ── Página de historial ──────────────────────────────────

function _hpClass(accion) {
  const a = (accion || '').toLowerCase();
  if (['itemadd','add','bulkimport'].includes(a))    return 'add';
  if (['itemupdate','update'].includes(a))           return 'edit';
  if (['itemdelete','delete','itembaja'].includes(a))return 'del';
  if (['prestar','prestarcaja'].includes(a))         return 'loan';
  if (a === 'devolver')                              return 'ret';
  return 'sys';
}

function _hpIcon(cls) {
  return { add:'➕', edit:'✏️', del:'🗑️', loan:'📤', ret:'📥', sys:'⚙️' }[cls] || '•';
}

function _hpVerb(accion) {
  const a = (accion || '').toLowerCase();
  if (a === 'itemadd'   || a === 'add')         return 'Añadió';
  if (a === 'itemupdate'|| a === 'update')       return 'Editó';
  if (a === 'itemdelete'|| a === 'delete')       return 'Eliminó';
  if (a === 'itembaja')                          return 'Dio de baja';
  if (a === 'prestar'   || a === 'prestarcaja')  return 'Prestó';
  if (a === 'devolver')                          return 'Devolvió';
  if (a === 'bulkimport')                        return 'Importó';
  return accion || 'Acción';
}

function _hpDayLabel(fechaStr) {
  if (!fechaStr) return 'Sin fecha';
  const d = new Date(fechaStr.replace(' ','T'));
  if (isNaN(d)) return fechaStr.slice(0,10);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate()-1);
  if (d >= hoy) return 'Hoy';
  if (d >= ayer) return 'Ayer';
  return d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
}

function _hpTime(fechaStr) {
  if (!fechaStr) return '';
  const d = new Date(fechaStr.replace(' ','T'));
  if (isNaN(d)) return '';
  return d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
}

let _hpData = [];

async function goHistorialPage() {
  if (!canAccessHistorial()) {
    toast('Solo el administrador o jefe de departamento puede acceder al historial', 'err');
    return;
  }
  show('pHistorialPage');
  _hideHomeButtons && _hideHomeButtons();
  document.getElementById('btnN').style.display='none';
  _hpData = [];
  document.getElementById('hpFeed').innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">Cargando…</div>';
  document.getElementById('hpSummary').textContent = '';
  try {
    _hpData = await apiGet('historial');
    hpRender(_hpData);
  } catch(e) {
    document.getElementById('hpFeed').innerHTML = '<div style="padding:32px;text-align:center;color:var(--red);font-size:13px">Error al cargar el historial.</div>';
  }
}

function hpFilter() {
  const q = historialText(document.getElementById('hpSearch').value);
  const tipo = document.getElementById('hpFilterTipo').value;
  const filtered = _hpData.filter(h => {
    const matchTipo = !tipo || h.tipo === tipo;
    const hay = [h.usuario, h.nombre, h.que, h.detalles, h.accion].map(historialText).join(' ');
    return matchTipo && (!q || hay.includes(q));
  });
  hpRender(filtered);
}

function hpRender(data) {
  const feed = document.getElementById('hpFeed');
  const summary = document.getElementById('hpSummary');
  if (summary) summary.textContent = `${data.length} acciones`;
  if (!data.length) {
    feed.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">Sin resultados.</div>';
    return;
  }
  // Agrupar por día
  const groups = {};
  data.forEach(h => {
    const day = (h.fecha || h.timestamp || '').slice(0,10) || 'Sin fecha';
    if (!groups[day]) groups[day] = [];
    groups[day].push(h);
  });
  feed.innerHTML = Object.entries(groups).map(([day, rows]) => {
    const label = _hpDayLabel(day + 'T00:00:00');
    const rowsHtml = rows.map(h => {
      const cls = _hpClass(h.accion);
      const verb = _hpVerb(h.accion);
      const nombre = h.nombre || h.que || '';
      const quien = h.usuario || '';
      const det = _historialPlainSummary(h.detalles || '');
      const itemId = h.que || '';
      const clickable = itemId && !['prestar','prestarcaja','devolver','bulkimport'].includes((h.accion||'').toLowerCase());
      const clickAttr = clickable ? `onclick="openItemRoute('${historialEsc(itemId)}')" style="cursor:pointer" title="Ir al ítem"` : '';
      return `<div class="hp-row${clickable?' hp-row-link':''}" ${clickAttr}>
        <div class="hp-avatar ${cls}">${_hpIcon(cls)}</div>
        <div class="hp-body">
          <div class="hp-title">${historialEsc(quien)} <span>${verb}</span>${nombre ? ' <b>'+historialEsc(nombre)+'</b>' : ''}</div>
          <div class="hp-sub">
            <span class="hp-badge ${cls}">${historialEsc(h.accion)}</span>
            ${h.tipo ? `<span>${historialEsc(h.tipo)}</span>` : ''}
            ${det ? `<span title="${historialEsc(det)}">${historialEsc(det.slice(0,60))}${det.length>60?'…':''}</span>` : ''}
          </div>
        </div>
        <div class="hp-time">${_hpTime(h.fecha || h.timestamp)}${clickable ? '<span class="hp-go">→</span>' : ''}</div>
      </div>`;
    }).join('');
    return `<div class="hp-day">${label}</div>${rowsHtml}`;
  }).join('');
}
