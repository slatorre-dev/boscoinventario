// Modal "🛡️ Accesos" — historial de intentos de login (correctos,
// incorrectos, bloqueos) + cuentas bloqueadas ahora mismo con desbloqueo
// directo. Reusa /api/historial (tipo "Accesos", ver historial.js) y
// /api/usuarios?action=getUsers (columna bloqueado, ver usuarios.js).

let accesosData = [];

function accesosEsc(value) {
  return String(value ?? '-').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function accesosResultadoLabel(accion) {
  const a = String(accion || '').toLowerCase();
  if (a === 'loginok') return '✅ Correcto';
  if (a === 'loginfail') return '⚠ Incorrecto';
  if (a === 'loginblocked') return '🔒 Bloqueado';
  return accion;
}

function openAccesosModal() {
  if (!requirePerm('config.manage')) return;
  const modal = document.getElementById('mAccesos');
  modal.style.display = 'flex';
  modal.classList.add('open');
  cargarAccesos();
}

function closeAccesosModal() {
  const modal = document.getElementById('mAccesos');
  modal.classList.remove('open');
  modal.style.display = 'none';
}

// Cruce con el Historial de acciones: pinchar un usuario en la tabla de
// Accesos abre su historial completo (items, préstamos y sus propios
// accesos, todo en la misma tabla `log`) ya filtrado por ese usuario.
function verHistorialDeUsuario(usuario) {
  closeAccesosModal();
  openHistorialModal(usuario);
}

async function cargarAccesos() {
  const tbody = document.getElementById('accesosTbody');
  const empty = document.getElementById('accesosEmpty');
  const table = document.getElementById('accesosTable');

  tbody.innerHTML = '';
  empty.textContent = 'Cargando accesos...';
  empty.style.display = 'block';
  table.style.display = 'none';

  try {
    const [historial, usuariosRes] = await Promise.all([
      apiGet('historial'),
      apiPost({ action: 'getUsers' }).catch(() => ({ ok: false, usuarios: [] }))
    ]);
    accesosData = (Array.isArray(historial) ? historial : []).filter(h => h.tipo === 'Accesos');
    renderAccesosBloqueadas((usuariosRes && usuariosRes.usuarios) || []);
    renderAccesos(accesosData);
  } catch (err) {
    console.error('Error loading accesos:', err);
    empty.textContent = 'Error al cargar accesos: ' + err.message;
  }
}

function renderAccesosBloqueadas(usuarios) {
  const el = document.getElementById('accesosBloqueadas');
  const bloqueadas = usuarios.filter(u => u.bloqueado);
  if (!bloqueadas.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="accesos-bloqueadas-box">
    <div class="accesos-bloqueadas-title">🔒 ${bloqueadas.length} cuenta${bloqueadas.length === 1 ? '' : 's'} bloqueada${bloqueadas.length === 1 ? '' : 's'} ahora mismo</div>
    ${bloqueadas.map(u => `<div class="accesos-bloqueada-row">
      <span>${accesosEsc(u.nombre || u.usuario)} <span class="accesos-bloqueada-user">(${accesosEsc(u.usuario)})</span></span>
      <button class="btn btn-sm" onclick="_desbloquearDesdeAccesos('${accesosEsc(u.usuario)}')">🔓 Desbloquear</button>
    </div>`).join('')}
  </div>`;
}

async function _desbloquearDesdeAccesos(usuario) {
  if (!await confirmDialog({ message: `¿Desbloquear la cuenta de "${usuario}"? Podrá volver a intentar iniciar sesión.` })) return;
  try {
    const res = await apiPost({ action: 'userUnlock', usuario });
    if (!res.ok) throw new Error(res.error);
    toast(`Cuenta de ${usuario} desbloqueada`, 'ok');
    cargarAccesos();
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

function renderAccesos(data) {
  const tbody = document.getElementById('accesosTbody');
  const empty = document.getElementById('accesosEmpty');
  const table = document.getElementById('accesosTable');

  if (!data.length) {
    tbody.innerHTML = '';
    table.style.display = 'none';
    empty.textContent = 'No hay accesos que coincidan con los filtros.';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  table.style.display = 'table';
  tbody.innerHTML = data.map(h => `
    <tr>
      <td class="ts">${accesosEsc(h.timestamp)}</td>
      <td class="usr"><span class="accesos-usr-link" onclick="verHistorialDeUsuario('${accesosEsc(h.usuario)}')" title="Ver el historial de acciones de ${accesosEsc(h.usuario)}">${accesosEsc(h.usuario)}</span></td>
      <td>${accesosEsc(h.nombre)}</td>
      <td>${accesosEsc(h.rol)}</td>
      <td class="act"><span class="badge ${historialBadgeClass(h.accion)}">${accesosResultadoLabel(h.accion)}</span></td>
      <td class="det">${accesosEsc(h.detalles)}</td>
    </tr>
  `).join('');
}

function filtrarAccesos() {
  const usuario = String(document.getElementById('accesosFilterUsuario').value || '').toLowerCase();
  const resultado = document.getElementById('accesosFilterResultado').value;

  const filtered = accesosData.filter(h => {
    const matchUsr = !usuario || String(h.usuario || '').toLowerCase().includes(usuario);
    const matchRes = !resultado || String(h.accion || '').toLowerCase() === resultado.toLowerCase();
    return matchUsr && matchRes;
  });

  renderAccesos(filtered);
}

function limpiarFiltrosAccesos() {
  document.getElementById('accesosFilterUsuario').value = '';
  document.getElementById('accesosFilterResultado').value = '';
  renderAccesos(accesosData);
}

document.addEventListener('DOMContentLoaded', () => {
  const usuario = document.getElementById('accesosFilterUsuario');
  const resultado = document.getElementById('accesosFilterResultado');
  if (usuario) usuario.addEventListener('input', filtrarAccesos);
  if (resultado) resultado.addEventListener('change', filtrarAccesos);
});
