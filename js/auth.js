// ═════════════════════════════════════════════════════════
// LOGIN
// ═════════════════════════════════════════════════════════

// Flag en memoria (nunca en localStorage): true solo entre guardar el
// departamento con éxito y el loadData() que sigue justo después. Así el
// paso de módulos nunca "resucita" en una recarga de página ni en un login
// futuro — solo en el que sigue justo a elegir departamento por primera vez.
let _justSelectedDepartamento = false;

// Contraseña recién tecleada en el login, solo en memoria (nunca en SESSION
// ni localStorage) y solo mientras dura el paso de contraseña temporal
// obligatoria (doForcePasswordChange la necesita como oldPassword). Se
// descarta en cuanto se usa. SESSION ya no guarda la contraseña real en
// ningún momento — usa session_token, ver doLogin()/js/api.js.
let _pendingLoginPassword = null;

// Paso final común a todos los flujos de login (usuario/contraseña, cambio
// de contraseña obligatorio, Google) — si la cuenta no tiene departamento
// (típico en cuentas de Google con correo @iesjuanbosco.es no mapeado en
// EMAIL_DEPT_MAP, ver oauth/login-google.js), pide que lo elija antes de
// entrar en vez de dejarla sin inventario visible hasta que el superadmin
// se lo asigne a mano.
function _proceedAfterLogin(){
  if(!SESSION.departamento){
    document.getElementById('selectDeptError').classList.remove('show');
    show('pSeleccionarDepartamento');
    loadDepartamentosInto('selectDeptSelect', 'Selecciona tu departamento');
    return;
  }
  showUserChip();
  _showOverlay();
  loadData();
}

async function doSelectDepartamento(){
  const sel = document.getElementById('selectDeptSelect');
  const departamento = sel.value;
  const errorEl = document.getElementById('selectDeptError');
  const btn = document.getElementById('selectDeptBtn');

  errorEl.classList.remove('show');
  if(!departamento){
    errorEl.textContent = 'Selecciona un departamento';
    errorEl.classList.add('show');
    return;
  }

  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    const res = await apiPost({ action: 'selectDepartamento', departamento });
    if(!res.ok) throw new Error(res.error || 'Error al guardar el departamento');
    SESSION.departamento = res.departamento;
    SESSION.departamentoNombre = res.departamentoNombre;
    SESSION.departamentoIcono = res.departamentoIcono;
    localStorage.setItem('inv_session', JSON.stringify(SESSION));
    _justSelectedDepartamento = true;
    showUserChip();
    _showOverlay();
    loadData();
  } catch(err) {
    console.error(err);
    errorEl.textContent = err.message || 'Error de conexión';
    errorEl.classList.add('show');
  } finally {
    btn.disabled = false; btn.textContent = 'Continuar';
  }
}

async function doLogin(){
  const usuario = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  errorEl.classList.remove('show');
  if(!usuario || !password){
    errorEl.textContent = 'Introduce usuario y contraseña';
    errorEl.classList.add('show');
    return;
  }

  btn.disabled = true; btn.textContent = 'Comprobando...';
  try {
    const u = encodeURIComponent(usuario);
    const p = encodeURIComponent(password);
    const r = await fetch(`/api/auth?action=login&u=${u}&p=${p}`);
    if(!r.ok) throw new Error('HTTP '+r.status);
    const res = await r.json();
    if(!res.ok) throw new Error(res.error||'Credenciales incorrectas');
    if(!res.user) throw new Error('Sin datos de usuario. Comprueba que la BD tiene la tabla Usuarios con datos.');

    SESSION = {
      usuario: usuario,
      session_token: res.user.session_token || '',
      nombre: res.user.nombre || usuario,
      rol: res.user.rol || 'profesor',
      email: res.user.email || '',
      departamento: res.user.departamento || '',
      departamentoNombre: res.user.departamentoNombre || '',
      departamentoIcono: res.user.departamentoIcono || '',
      passwordTemporal: !!res.user.password_temporal
    };
    localStorage.setItem('inv_session', JSON.stringify(SESSION));
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';

    if(SESSION.passwordTemporal){
      _pendingLoginPassword = password;
      document.getElementById('forcePass1').value = '';
      document.getElementById('forcePass2').value = '';
      document.getElementById('forcePassError').classList.remove('show');
      show('pForcePassword');
      return;
    }

    _proceedAfterLogin();
  } catch(err) {
    console.error(err);
    errorEl.textContent = err.message || 'Error de conexión';
    errorEl.classList.add('show');
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

// ═════════════════════════════════════════════════════════
// CAMBIO DE CONTRASEÑA OBLIGATORIO (primer login, cuentas genéricas)
// ═════════════════════════════════════════════════════════
async function doForcePasswordChange(){
  const n1 = document.getElementById('forcePass1').value;
  const n2 = document.getElementById('forcePass2').value;
  const errorEl = document.getElementById('forcePassError');
  const btn = document.getElementById('forcePassBtn');

  errorEl.classList.remove('show');
  if(!n1 || !n2){
    errorEl.textContent = 'Rellena los dos campos';
    errorEl.classList.add('show');
    return;
  }
  if(n1 !== n2){
    errorEl.textContent = 'Las contraseñas no coinciden';
    errorEl.classList.add('show');
    return;
  }
  if(n1.length < 4){
    errorEl.textContent = 'La contraseña debe tener al menos 4 caracteres';
    errorEl.classList.add('show');
    return;
  }
  if(n1 === SESSION.usuario){
    errorEl.textContent = 'La nueva contraseña no puede ser igual al usuario';
    errorEl.classList.add('show');
    return;
  }

  btn.disabled = true; btn.textContent = 'Cambiando...';
  try {
    const res = await apiPost({ action: 'changePassword', oldPassword: _pendingLoginPassword, newPassword: n1 });
    if(!res.ok) throw new Error(res.error || 'Error al cambiar contraseña');
    _pendingLoginPassword = null;
    SESSION.session_token = res.session_token || SESSION.session_token;
    SESSION.passwordTemporal = false;
    localStorage.setItem('inv_session', JSON.stringify(SESSION));
    _proceedAfterLogin();
  } catch(err) {
    console.error(err);
    errorEl.textContent = err.message || 'Error de conexión';
    errorEl.classList.add('show');
  } finally {
    btn.disabled = false; btn.textContent = 'Cambiar contraseña y continuar';
  }
}

// ═════════════════════════════════════════════════════════
// GOOGLE SIGN-IN
// ═════════════════════════════════════════════════════════
// disableAutoSelect() antes de renderButton(): sin esto, GIS reutiliza en
// silencio la última cuenta de Google usada en el navegador en vez de
// dejar elegir entre varias cuentas activas simultáneamente.
function initGoogleButton() {
  if (typeof google === 'undefined' || !google.accounts?.id) return;
  google.accounts.id.initialize({
    client_id: '374986567801-lamnmhp3p3jtudo9f4db3s5kum7ef1v9.apps.googleusercontent.com',
    callback: handleGoogleSignIn,
    auto_select: false,
    ux_mode: 'popup',
  });
  google.accounts.id.disableAutoSelect();
  const container = document.getElementById('googleBtnContainer');
  if (container) {
    google.accounts.id.renderButton(container, {
      type: 'standard',
      size: 'large',
      theme: 'outline',
      width: 300,
      use_fedcm_for_button: true,
    });
    // El popup de Google (accounts.google.com/gsi/transform) a veces se
    // queda colgado en blanco sin completar el callback — problema
    // conocido de Google Identity Services (bloqueo de cookies de
    // terceros / conflictos con FedCM), no de este código. Sin aviso,
    // el usuario se queda mirando la pantalla sin límite. Arrancamos un
    // timeout al pulsar el botón (GIS abre el popup de forma síncrona al
    // click) que se cancela en cuanto handleGoogleSignIn recibe respuesta.
    container.addEventListener('click', _startGoogleSignInTimeout, true);
  }
}
window.addEventListener('load', initGoogleButton);

let _googleSignInTimeoutId = null;
function _startGoogleSignInTimeout(){
  clearTimeout(_googleSignInTimeoutId);
  _googleSignInTimeoutId = setTimeout(() => {
    const errorEl = document.getElementById('loginError');
    if (!errorEl) return;
    errorEl.textContent = 'El login con Google está tardando más de lo normal. Cierra la ventana emergente e inténtalo de nuevo, o usa usuario/contraseña.';
    errorEl.classList.add('show');
  }, 8000);
}

let _googleSignInInFlight = false;
async function handleGoogleSignIn(response) {
  console.log('Google Sign-In response:', response);
  clearTimeout(_googleSignInTimeoutId);

  // GIS puede invocar este callback más de una vez para el mismo login
  // (One Tap + botón renderizado, o reintentos internos) — cada
  // invocación regenera session_token en el backend (login-google.js),
  // así que una segunda llamada solapada puede invalidar el token que
  // la primera ya guardó en localStorage antes de usarlo, provocando un
  // 401 en la siguiente petición autenticada. Ignoramos duplicados.
  if (_googleSignInInFlight) return;
  _googleSignInInFlight = true;

  const errorEl = document.getElementById('loginError');
  const okEl = document.getElementById('loginOk');

  if (!response.credential) {
    errorEl.textContent = 'Error: no se recibió token de Google';
    errorEl.classList.add('show');
    _googleSignInInFlight = false;
    return;
  }

  try {
    errorEl.classList.remove('show');

    // Enviar token al backend
    const loginRes = await fetch('/api/oauth/login-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: response.credential }),
    });

    const loginData = await loginRes.json();

    if (!loginData.ok) {
      throw new Error(loginData.error || 'Error en el servidor');
    }

    // Crear SESSION compatible
    SESSION = {
      usuario: loginData.user.usuario,
      nombre: loginData.user.nombre,
      email: loginData.user.email,
      rol: loginData.user.rol,
      departamento: loginData.user.departamento || '',
      departamentoNombre: loginData.user.departamentoNombre || '',
      departamentoIcono: loginData.user.departamentoIcono || '',
      google_id: loginData.user.google_id,
      auth_method: 'google',
      session_token: loginData.user.session_token, // ← Token para requests posteriores
    };

    localStorage.setItem('inv_session', JSON.stringify(SESSION));

    // Limpiar formulario y mostrar éxito
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';

    okEl.textContent = `✓ ¡Bienvenido ${loginData.user.nombre}!`;
    okEl.classList.add('show');

    // Cargar datos del usuario (o pedir departamento si la cuenta no tiene)
    _proceedAfterLogin();

  } catch(err) {
    console.error('Error en Google Sign-In:', err);
    errorEl.textContent = err.message || 'Error al procesar login de Google';
    errorEl.classList.add('show');
  } finally {
    _googleSignInInFlight = false;
  }
}

// ─── CIERRE DE SESIÓN POR INACTIVIDAD ────────────────────
const INACTIVITY_DEFAULT_MIN = 5;
const INACTIVITY_WARN_SEC = 10;
let _inactivityTimer = null;
let _inactivityWarnTimer = null;
let _inactivityCountdown = null;

function getInactivityMinutes(){
  const v = parseInt(localStorage.getItem('inv_inactivity_min'));
  return (!isNaN(v) && v > 0) ? v : INACTIVITY_DEFAULT_MIN;
}

function setInactivityMinutes(min){
  if(min > 0) localStorage.setItem('inv_inactivity_min', String(min));
}

function _resetInactivityTimer(){
  if(!SESSION) return;
  clearTimeout(_inactivityTimer);
  clearTimeout(_inactivityWarnTimer);
  const warnModal = document.getElementById('mInactivityWarn');
  if(warnModal && warnModal.classList.contains('open')) _hideInactivityWarn();
  const ms = getInactivityMinutes() * 60 * 1000;
  _inactivityTimer = setTimeout(_showInactivityWarn, ms - INACTIVITY_WARN_SEC * 1000);
}

function _showInactivityWarn(){
  const modal = document.getElementById('mInactivityWarn');
  if(!modal || !SESSION) return;
  modal.classList.add('open');
  let secs = INACTIVITY_WARN_SEC;
  document.getElementById('inactivityCountdown').textContent = secs;
  clearInterval(_inactivityCountdown);
  _inactivityCountdown = setInterval(()=>{
    secs--;
    const el = document.getElementById('inactivityCountdown');
    if(el) el.textContent = secs;
    if(secs <= 0){
      clearInterval(_inactivityCountdown);
      _hideInactivityWarn();
      _doAutoLogout();
    }
  }, 1000);
}

function _hideInactivityWarn(){
  const modal = document.getElementById('mInactivityWarn');
  if(modal) modal.classList.remove('open');
  clearInterval(_inactivityCountdown);
}

function stayConnected(){
  _hideInactivityWarn();
  _resetInactivityTimer();
}

function _doAutoLogout(){
  localStorage.removeItem('inv_session');
  SESSION = null;
  items = [];
  cf = null;
  currentCiclo = null;
  document.getElementById('userChip').style.display = 'none';
  document.getElementById('btnN').style.display = 'none';
  document.getElementById('btnE').style.display = 'none';
  document.getElementById('bc').innerHTML = '';
  const deptEl0 = document.getElementById('brandDept');
  if(deptEl0) deptEl0.textContent = '';
  deptActivo = '';
  localStorage.removeItem('dept_activo_superadmin');
  const deptSelEl0 = document.getElementById('deptActivoSelect');
  if(deptSelEl0) deptSelEl0.style.display = 'none';
  setConn('', 'Sin sesión');
  show('pLogin');
}

let _inactivityWatchStarted = false;
function _startInactivityWatch(){
  if(!_inactivityWatchStarted){
    _inactivityWatchStarted = true;
    ['mousemove','mousedown','keydown','touchstart','scroll','click'].forEach(ev=>{
      document.addEventListener(ev, _resetInactivityTimer, {passive:true});
    });
  }
  _resetInactivityTimer();
}

async function logout(){
  if(!await confirmDialog({message:'¿Cerrar sesión?'})) return;
  localStorage.removeItem('inv_session');
  SESSION = null;
  items = [];
  cf = null;
  currentCiclo = null;
  document.getElementById('userChip').style.display = 'none';
  document.getElementById('btnN').style.display = 'none';
  document.getElementById('btnE').style.display = 'none';
  document.getElementById('bc').innerHTML = '';
  const deptEl1 = document.getElementById('brandDept');
  if(deptEl1) deptEl1.textContent = '';
  deptActivo = '';
  localStorage.removeItem('dept_activo_superadmin');
  const deptSelEl1 = document.getElementById('deptActivoSelect');
  if(deptSelEl1) deptSelEl1.style.display = 'none';
  setConn('', 'Sin sesión');
  // Permite que el botón de Google vuelva a disparar el callback tras logout
  if(typeof google !== 'undefined' && google.accounts?.id) google.accounts.id.disableAutoSelect();
  show('pLogin');
}

function showUserChip(){
  if(!SESSION) return;
  const initials = (SESSION.nombre||SESSION.usuario).split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('userAvatar').textContent = initials;
  document.getElementById('userName').textContent = SESSION.nombre || SESSION.usuario;
  document.getElementById('userChip').style.display = 'flex';
  const deptEl = document.getElementById('brandDept');
  if(deptEl) deptEl.textContent = SESSION.departamentoNombre || '';
  const deptIconEl = document.getElementById('deptGameIcon');
  if(deptIconEl){
    if(SESSION.departamentoIcono) deptIconEl.textContent = SESSION.departamentoIcono;
    else deptIconEl.innerHTML = '<img src="icons/imagenbosco.png" alt="">';
  }
  if(typeof applyRoleUI === 'function') applyRoleUI();
  if(typeof showHistorialButton === 'function') showHistorialButton();
}

function renderDeptActivoSelector(){
  const sel = document.getElementById('deptActivoSelect');
  if(!sel) return;
  const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
  if(!isSuperAdmin || !Array.isArray(DEPARTAMENTOS) || !DEPARTAMENTOS.length){
    sel.style.display = 'none';
    return;
  }
  sel.style.display = 'inline-block';
  sel.innerHTML = '<option value="">— Elige departamento para gestionar —</option>' +
    DEPARTAMENTOS.map(d => `<option value="${d.slug}" ${deptActivo===d.slug?'selected':''}>${d.icono||''} ${d.nombre}</option>`).join('');
}

function onDeptActivoChange(value){
  deptActivo = value || '';
  localStorage.setItem('dept_activo_superadmin', deptActivo);
}

function syncSessionUser(user){
  if(!SESSION || !user) return;
  SESSION = {
    ...SESSION,
    nombre: user.nombre || SESSION.nombre || SESSION.usuario,
    rol: user.rol || SESSION.rol || 'profesor',
    email: user.email || SESSION.email || '',
    departamento: user.departamento || SESSION.departamento || ''
  };
  localStorage.setItem('inv_session', JSON.stringify(SESSION));
}

function _showOverlay(){
  const ov = document.getElementById('loadOverlay');
  if(!ov) return;
  ov.classList.remove('lo-hide');
  ov.style.display = '';
}

function _hideOverlay(){
  const ov = document.getElementById('loadOverlay');
  if(!ov || ov.style.display==='none') return;
  ov.classList.add('lo-hide');
  setTimeout(()=>{ ov.style.display='none'; }, 480);
}

async function loadData(){
  if(!SESSION){ _hideOverlay(); show('pLogin'); setConn('','Sin sesión'); return; }
  if(SESSION.passwordTemporal){
    if(!_pendingLoginPassword){
      // La contraseña recién tecleada solo vive en memoria (nunca en
      // localStorage) — si se pierde (recarga de página a mitad del
      // cambio obligatorio), no hay forma de verificarla en el backend.
      // Mejor pedir que inicie sesión de nuevo que mostrar un formulario
      // que fallaría al enviarlo.
      localStorage.removeItem('inv_session');
      SESSION = null;
      _hideOverlay();
      show('pLogin');
      setConn('', 'Sin sesión');
      return;
    }
    _hideOverlay(); show('pForcePassword'); return;
  }
  if(!SESSION.departamento){
    _hideOverlay();
    show('pSeleccionarDepartamento');
    loadDepartamentosInto('selectDeptSelect', 'Selecciona tu departamento');
    return;
  }
  itemsLoaded = false;
  showUserChip();
  show('pH');
  setConn('loading','Cargando...');
  const bar = document.getElementById('loadBar');
  bar.className = ''; bar.style.width = '0'; bar.offsetWidth;
  bar.className = 'is-loading';

  // ── Fase 1: metadatos ligeros (aulas, cats, ciclos) ──────
  try{
    const meta = await apiGet('meta');
    if(!meta.ok){
      if(meta.error && meta.error.includes('autorizado')){
        localStorage.removeItem('inv_session');
        SESSION = null;
        document.getElementById('userChip').style.display = 'none';
        _hideOverlay();
        show('pLogin');
        setConn('err','Sesión expirada');
        const errorEl = document.getElementById('loginError');
        if(errorEl){
          errorEl.textContent = 'Tu sesión ha caducado o no es válida. Vuelve a iniciar sesión.';
          errorEl.classList.add('show');
        }
        bar.className = '';
        return;
      }
      throw new Error(meta.error||'Error');
    }
    syncSessionUser(meta.user);
    showUserChip();
    if(meta.aulas && meta.aulas.length) AULAS = meta.aulas;
    MIS_AULAS = Array.isArray(meta.misAulas) ? meta.misAulas : [];
    if(meta.cats && meta.cats.length) setCatsFromEntries(meta.cats.map(c=>[c.name,{c:c.c,bg:c.bg,i:c.i}]));
    if(Array.isArray(meta.catsCrudo)) catsCrudo = meta.catsCrudo;
    if(meta.ubicaciones) UBICACIONES = meta.ubicaciones;
    if(meta.ciclos && meta.ciclos.length) CICLOS = meta.ciclos;
    MIS_MODULOS = Array.isArray(meta.misModulos) ? meta.misModulos : [];
    if(_justSelectedDepartamento){
      _justSelectedDepartamento = false;
      if(!MIS_MODULOS.length){
        _hideOverlay();
        abrirSeleccionModulosOnboarding();
        return;
      }
    }
    catsPropias = !!meta.catsPropias;
    if(meta.departamentos && meta.departamentos.length) DEPARTAMENTOS = meta.departamentos;
    renderDeptActivoSelector();
    document.getElementById('btnN').style.display='flex';
    document.getElementById('btnPres').style.display='flex';
    document.getElementById('btnStock').style.display='flex';
    if(typeof applyRoleUI === 'function') applyRoleUI();
    updatePedBadge();
    _startInactivityWatch();
    _hideOverlay();
    bar.className = 'is-done';
    setTimeout(()=>{bar.className='';bar.style.width='0';}, 500);
    if(location.hash && location.hash.length > 1) navigateFromHash(location.hash);
    else if(cf) openSub(); else if(currentCiclo) openCiclo(currentCiclo.id); else goHome();
    if (typeof mostrarHintCamaraSiPrimeraVez === 'function') mostrarHintCamaraSiPrimeraVez();
  }catch(err){
    console.error(err);
    if(err.message && (err.message.includes('401') || err.message.includes('autorizado'))){
      localStorage.removeItem('inv_session');
      SESSION = null;
      document.getElementById('userChip').style.display = 'none';
      _hideOverlay();
      show('pLogin');
      setConn('err','Sesión expirada');
      const errorEl = document.getElementById('loginError');
      if(errorEl){
        errorEl.textContent = 'Tu sesión ha caducado o no es válida. Vuelve a iniciar sesión.';
        errorEl.classList.add('show');
      }
      bar.className = '';
      return;
    }
    setConn('err','Error de conexión');
    show('pH');
    document.getElementById('hStats').innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="ei">⚠️</div><div class="et">No se pudo conectar.<br><small>${err.message}</small></div></div>`;
    _hideOverlay();
    bar.className = '';
    return;
  }

  // ── Fase 2: datos pesados en background (items, prestamos, profesores) ──
  setConn('loading','Cargando inventario...');
  try{
    const res = await apiGet('list');
    if(!res.ok) throw new Error(res.error||'Error');
    // Descomprimir formato compacto (array de arrays → objetos)
    if(res.itemsC && res.itemsH){
      items = res.itemsC.map(row => Object.fromEntries(res.itemsH.map((h,i) => [h, row[i]])));
    } else {
      items = res.items || [];
    }
    profesores = res.profesores || [];
    prestamos = res.prestamos || [];
    reservas = res.reservas || [];
    solicitudes = res.solicitudes || [];
    pedidos = {};
    (res.pedidos || []).forEach(p => { pedidos[p.itemId] = { qty: Number(p.qty)||1, nota: p.nota || '' }; });
    if(typeof updatePedBadge === 'function') updatePedBadge();
    if(typeof updateSolBadge === 'function') updateSolBadge();
    itemsLoaded = true;
    if(typeof checkAtencionHoy === 'function') checkAtencionHoy();
    if(typeof updatePresVencBadge === 'function') updatePresVencBadge();
    if(typeof getVencidosParaUsuario==='function'&&typeof toast==='function'){
      const venc=getVencidosParaUsuario();
      if(venc.length>0){
        const t=toast('⚠ '+venc.length+' préstamo'+(venc.length!==1?'s':'')+' vencido'+(venc.length!==1?'s':'')+' · Ver','warn');
        if(t){t.style.cursor='pointer';t.onclick=()=>{window.location.hash='prestamos';};}
      }
    }
    setConn('ok','sincronizado');
    if(typeof renderHome === 'function' && document.getElementById('pH').classList.contains('active')) renderHome();
    else if(cf) openSub();
  }catch(err){
    console.error(err);
    setConn('err','Error cargando inventario');
  }
}

// ─── INIT ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeM();closeConf();closeAulasModal();closeUbicacionesModal();closePrestar();closeDevolver();closeProfModal();closeImport();closeExportModal();closeDocsModal();closeDelModal();closeHistorial();closeQrScanner();closeUsuariosModal();closeModulosUsuario();closePrintModal();closeTourCamara();closeAyudaCamara();closeCamaraSerie();closeCamaraUnificada();closeReservaPractica()}});
  ['loginUser','loginPass'].forEach(id=>{
    document.getElementById(id).addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
  });
  // Detectar enlace de recuperación de contraseña
  if(location.hash.startsWith('#reset/')){
    showResetPage(location.hash.slice(7));
    return;
  }
  loadData();
});
