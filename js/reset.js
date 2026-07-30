// ═════════════════════════════════════════════════════════
// RECUPERACIÓN DE CONTRASEÑA
// ═════════════════════════════════════════════════════════
let _resetToken = null;

// ─── LOGIN: alternar vistas ───────────────────────────────
function showRecovery() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('recoveryForm').style.display = 'block';
  document.getElementById('recoveryError').classList.remove('show');
  document.getElementById('recoveryOk').classList.remove('show');
  document.getElementById('recoveryUser').value = '';
  document.getElementById('recoveryUser').focus();
}

function showLogin() {
  document.getElementById('recoveryForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
}

// ─── CREAR CUENTA (profesor/a) ────────────────────────────
let _registerDeptsLoaded = false;

function showRegister() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
  document.getElementById('registerError').classList.remove('show');
  document.getElementById('registerOk').classList.remove('show');
  document.getElementById('registerNombre').value = '';
  document.getElementById('registerEmail').value = '';
  document.getElementById('registerUserHint').style.display = 'none';
  if (!_registerDeptsLoaded) loadRegisterDepartments();
  document.getElementById('registerNombre').focus();
}

// Previsualiza el usuario/login que se generará del email — mismo cálculo
// que el backend (parte local del email, sanitizada). Si ya existe, el
// backend añade un sufijo numérico; aquí solo se muestra la base.
function _updateRegisterUserHint() {
  const email = document.getElementById('registerEmail').value.trim();
  const hint = document.getElementById('registerUserHint');
  const userPart = email.split('@')[0] || '';
  const usuario = userPart.replace(/[^a-z0-9._-]/gi, '').toLowerCase();
  if (usuario) {
    hint.textContent = `👤 Tu usuario será: ${usuario}`;
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
}

async function loadRegisterDepartments() {
  const sel = document.getElementById('registerDept');
  try {
    const r = await fetch('/api/auth?action=departamentos');
    const res = await r.json();
    if (!res.ok) throw new Error(res.error || 'Error al cargar departamentos');
    _registerDeptsLoaded = true;
    sel.innerHTML = '<option value="">Selecciona tu departamento</option>' +
      res.departamentos.map(d => `<option value="${escHtml(d.slug)}">${escHtml(d.icono || '')} ${escHtml(d.nombre)}</option>`).join('');
  } catch (err) {
    sel.innerHTML = '<option value="">Error al cargar — recarga la página</option>';
  }
}

async function submitRegister() {
  const nombre = document.getElementById('registerNombre').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const departamento = document.getElementById('registerDept').value;
  const errEl = document.getElementById('registerError');
  const okEl = document.getElementById('registerOk');
  errEl.classList.remove('show');
  okEl.classList.remove('show');

  if (!nombre) { errEl.textContent = 'Introduce tu nombre completo'; errEl.classList.add('show'); return; }
  if (!email) { errEl.textContent = 'Introduce tu correo electrónico'; errEl.classList.add('show'); return; }
  if (!departamento) { errEl.textContent = 'Selecciona tu departamento'; errEl.classList.add('show'); return; }

  const btn = document.getElementById('registerBtn');
  btn.disabled = true; btn.textContent = 'Creando...';
  try {
    const appUrl = window.location.href.split('#')[0];
    const r = await fetch('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'register', nombre, email, departamento, appUrl }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await r.json();
    if (!res.ok) throw new Error(res.error || 'Error al crear la cuenta');
    okEl.textContent = '✓ Cuenta creada. Revisa tu correo para elegir tu contraseña.';
    okEl.classList.add('show');
    document.getElementById('registerNombre').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerDept').value = '';
  } catch (err) {
    errEl.textContent = err.message || 'Error de conexión. Inténtalo de nuevo.';
    errEl.classList.add('show');
  } finally {
    btn.disabled = false; btn.textContent = 'Crear cuenta';
  }
}

// ─── SOLICITAR RECUPERACIÓN ───────────────────────────────
async function requestReset() {
  const usuario = document.getElementById('recoveryUser').value.trim();
  const errEl = document.getElementById('recoveryError');
  const okEl  = document.getElementById('recoveryOk');
  errEl.classList.remove('show');
  okEl.classList.remove('show');

  if (!usuario) {
    errEl.textContent = 'Introduce tu usuario';
    errEl.classList.add('show');
    return;
  }

  const btn = document.getElementById('recoveryBtn');
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    const appUrl = window.location.href.split('#')[0];
    const r = await fetch(`/api/auth?action=requestReset&usuario=${encodeURIComponent(usuario)}&appUrl=${encodeURIComponent(appUrl)}`);
    const res = await r.json().catch(() => null);
    if (!r.ok || !res?.ok) throw new Error(res?.error || 'HTTP ' + r.status);
    // Mensaje genérico siempre (no revelar si el usuario existe)
    okEl.textContent = 'Si el usuario existe y tiene correo registrado, recibirás un enlace en breve.';
    okEl.classList.add('show');
    document.getElementById('recoveryUser').value = '';
  } catch (err) {
    errEl.textContent = err.message || 'Error de conexión. Inténtalo de nuevo.';
    errEl.classList.add('show');
  } finally {
    btn.disabled = false; btn.textContent = 'Enviar correo de recuperación';
  }
}

// ─── PÁGINA DE RESET (desde enlace del correo) ────────────
function showResetPage(token) {
  _resetToken = token;
  document.getElementById('resetPass1').value = '';
  document.getElementById('resetPass2').value = '';
  document.getElementById('resetError').classList.remove('show');
  if (typeof _hideOverlay === 'function') _hideOverlay();
  setConn('', 'Restablecer contraseña');
  show('pReset');
}

function goBackToLogin() {
  _resetToken = null;
  history.replaceState(null, '', window.location.pathname);
  show('pLogin');
  showLogin();
}

async function doResetPassword() {
  const p1 = document.getElementById('resetPass1').value;
  const p2 = document.getElementById('resetPass2').value;
  const errEl = document.getElementById('resetError');
  errEl.classList.remove('show');

  if (!p1 || !p2) { errEl.textContent = 'Rellena los dos campos'; errEl.classList.add('show'); return; }
  if (p1 !== p2)  { errEl.textContent = 'Las contraseñas no coinciden'; errEl.classList.add('show'); return; }
  if (p1.length < 4) { errEl.textContent = 'La contraseña debe tener al menos 4 caracteres'; errEl.classList.add('show'); return; }

  const btn = document.getElementById('resetBtn');
  btn.disabled = true; btn.textContent = 'Cambiando...';
  try {
    const r = await fetch('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'resetPassword', token: _resetToken, newPassword: p1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await r.json();
    if (!res.ok) throw new Error(res.error || 'Error al cambiar la contraseña');

    _resetToken = null;
    history.replaceState(null, '', window.location.pathname);
    show('pLogin');
    showLogin();
    const okEl = document.getElementById('loginOk');
    okEl.textContent = '✓ Contraseña cambiada correctamente. Ya puedes iniciar sesión.';
    okEl.classList.add('show');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('show');
  } finally {
    btn.disabled = false; btn.textContent = 'Cambiar contraseña';
  }
}

// ─── EVENT LISTENERS ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('recoveryUser').addEventListener('keydown', e => { if (e.key === 'Enter') requestReset(); });
  document.getElementById('resetPass1').addEventListener('keydown', e => { if (e.key === 'Enter') doResetPassword(); });
  document.getElementById('resetPass2').addEventListener('keydown', e => { if (e.key === 'Enter') doResetPassword(); });
  document.getElementById('registerEmail').addEventListener('keydown', e => { if (e.key === 'Enter') submitRegister(); });
});
