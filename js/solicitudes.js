// ═════════════════════════════════════════════════════════
// SOLICITUDES DE MATERIAL — pedir algo que aún no existe como ítem del
// inventario (a diferencia de 🛒 Pedidos, que exige un ítem ya dado de
// alta). Docentes crean y ven las suyas; jefatura/superadmin ve todas y
// cambia el estado. `solicitudes` se rellena en loadData() (js/auth.js) a
// partir de res.solicitudes.
// ═════════════════════════════════════════════════════════

const SOLICITUD_ESTADOS = ['pendiente','aceptada','recibida','descartada'];
const SOLICITUD_ESTADO_LABEL = {
  pendiente:  '🟡 Pendiente',
  aceptada:   '🔵 Aceptada',
  recibida:   '✅ Recibida',
  descartada: '⛔ Descartada',
};

function _esJefeSolicitudes(){
  return typeof can === 'function' && can('solicitudes.manage');
}

// Pendientes + resueltas en los últimos 7 días — para Modo clase (js/modo-
// clase.js), que antes solo miraba las pendientes y por tanto una
// solicitud recién aceptada/descartada desaparecía sin que el profesor
// llegara a ver la respuesta de jefatura, salvo que entrara al modal
// completo de Solicitudes a buscarla.
function _misSolicitudesRecientes(){
  const lista = typeof solicitudes !== 'undefined' ? solicitudes : [];
  const haceUnaSemana = Date.now() - 7*24*60*60*1000;
  return lista
    .filter(s => s.creadoPor === SESSION?.usuario && (
      s.estado === 'pendiente' || new Date(s.actualizadoEn || s.fecha || 0).getTime() >= haceUnaSemana
    ))
    .sort((a,b) => new Date(b.fecha||0) - new Date(a.fecha||0));
}

function updateSolBadge(){
  const badge = document.getElementById('solBadge');
  if(!badge) return;
  const esJefe = _esJefeSolicitudes();
  const lista = typeof solicitudes !== 'undefined' ? solicitudes : [];
  const relevantes = esJefe ? lista : lista.filter(s => s.creadoPor === SESSION?.usuario);
  const n = relevantes.filter(s => s.estado === 'pendiente').length;
  badge.textContent = n;
  badge.style.display = n > 0 ? 'inline' : 'none';
}

function openSolicitudesModal(){
  if(!requirePerm('solicitudes.write')) return;
  document.getElementById('sol_nombre').value = '';
  document.getElementById('sol_cantidad').value = 1;
  document.getElementById('sol_nota').value = '';
  renderSolicitudesList();
  document.getElementById('mSolicitudes').classList.add('open');
}

function closeSolicitudesModal(){
  document.getElementById('mSolicitudes').classList.remove('open');
}

function renderSolicitudesList(){
  const esJefe = _esJefeSolicitudes();
  const titleEl = document.getElementById('solListTitle');
  if(titleEl) titleEl.textContent = esJefe ? 'Todas las solicitudes del departamento' : 'Mis solicitudes';

  const lista = typeof solicitudes !== 'undefined' ? solicitudes : [];
  const propias = esJefe ? lista : lista.filter(s => s.creadoPor === SESSION?.usuario);
  const el = document.getElementById('solList');
  if(!el) return;

  if(!propias.length){
    el.innerHTML = `<div class="empty" style="padding:16px"><div class="et" style="font-size:13px">${esJefe ? 'No hay solicitudes todavía.' : 'Aún no has enviado ninguna solicitud.'}</div></div>`;
    return;
  }

  const ordenadas = [...propias].sort((a,b) => new Date(b.fecha||0) - new Date(a.fecha||0));
  el.innerHTML = ordenadas.map(s => {
    const estadoTxt = SOLICITUD_ESTADO_LABEL[s.estado] || escHtml(s.estado);
    const controlEstado = esJefe
      ? `<select class="fi-w" style="width:auto;font-size:12px" onchange="cambiarEstadoSolicitud(${Number(s.id)},this.value)">
          ${SOLICITUD_ESTADOS.map(op => `<option value="${op}" ${s.estado===op?'selected':''}>${SOLICITUD_ESTADO_LABEL[op]}</option>`).join('')}
        </select>`
      : `<span class="pres-pill">${estadoTxt}</span>`;
    return `<div class="pres-card">
      <div class="pres-info">
        <div class="pres-name">${escHtml(s.nombre)} <span style="color:var(--muted);font-weight:400;font-size:12px">× ${Number(s.cantidad)||1}</span></div>
        <div class="pres-prof">${escHtml(s.creadoPorNombre || s.creadoPor || '')}</div>
        <div class="pres-meta"><span>📅 ${escHtml(String(s.fecha||'').slice(0,10))}</span></div>
        ${s.nota ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">💬 ${escHtml(s.nota)}</div>` : ''}
        ${s.respuesta ? `<div style="font-size:11px;color:var(--accent);margin-top:4px">↩ ${escHtml(s.respuesta)}</div>` : ''}
      </div>
      <div class="pres-actions">${controlEstado}</div>
    </div>`;
  }).join('');
}

async function crearSolicitud(){
  if(!requirePerm('solicitudes.write')) return;
  const nombre = document.getElementById('sol_nombre').value.trim();
  const cantidad = Math.max(1, parseInt(document.getElementById('sol_cantidad').value,10) || 1);
  const nota = document.getElementById('sol_nota').value.trim();
  if(!nombre){ toast('Indica el nombre del material','err'); return; }

  const btn = document.getElementById('btnSolicitudEnviar');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Enviando...'; }
  try {
    const res = await apiPost({ action:'solicitudCrear', nombre, cantidad, nota });
    if(!res.ok) throw new Error(res.error);
    solicitudes.push(res.solicitud);
    document.getElementById('sol_nombre').value = '';
    document.getElementById('sol_cantidad').value = 1;
    document.getElementById('sol_nota').value = '';
    renderSolicitudesList();
    updateSolBadge();
    toast('Solicitud enviada','ok');
  } catch(err){ toast('Error: '+err.message,'err'); }
  finally { if(btn){ btn.disabled = false; btn.textContent = '📨 Enviar solicitud'; } }
}

async function cambiarEstadoSolicitud(id, nuevoEstado){
  const s = solicitudes.find(x => Number(x.id) === Number(id));
  if(!s) return;
  const respuestaInput = prompt(`Respuesta para "${s.nombre}" (opcional):`, s.respuesta || '');
  if(respuestaInput === null){ renderSolicitudesList(); return; } // cancelado: deshace el cambio visual del <select>
  try {
    const res = await apiPost({ action:'solicitudUpdate', id, estado:nuevoEstado, respuesta: respuestaInput.trim() });
    if(!res.ok) throw new Error(res.error);
    const idx = solicitudes.findIndex(x => Number(x.id) === Number(id));
    if(idx>=0) solicitudes[idx] = { ...solicitudes[idx], estado:nuevoEstado, respuesta: respuestaInput.trim(), actualizadoEn: res.solicitud?.actualizadoEn || '' };
    renderSolicitudesList();
    updateSolBadge();
    toast('Solicitud actualizada','ok');
  } catch(err){
    toast('Error: '+err.message,'err');
    renderSolicitudesList();
  }
}
