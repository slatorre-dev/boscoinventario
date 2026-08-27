// Roles y permisos basados en la columna "rol" de la hoja Usuarios.
// Roles canónicos: 'Jefe/a Departamento', 'Profesor/a', 'Consulta'
// El resto son alias de compatibilidad (usuarios antiguos en BD).

const _PERMS_JEFE    = ['*'];
const _PERMS_PROFE   = ['items.write','docs.write','loans.write','orders.write','profile.write','solicitudes.write'];
const _PERMS_LECTURA = ['profile.write'];

const ROLE_PERMISSIONS = {
  // ── Canónico ──
  'jefe/a departamento': _PERMS_JEFE,
  'profesor/a':          _PERMS_PROFE,
  'consulta':            _PERMS_LECTURA,
  'superadmin':          _PERMS_JEFE,
  // ── Alias compatibilidad ──
  'jefe departamento':   _PERMS_JEFE,
  'jefe de departamento':_PERMS_JEFE,
  'jefa departamento':   _PERMS_JEFE,
  'jefa de departamento':_PERMS_JEFE,
  'jefe/a de departamento':_PERMS_JEFE,
  'jefe/a departamento':   _PERMS_JEFE,
  'administrador':       _PERMS_JEFE,
  'administradora':      _PERMS_JEFE,
  'admin':               _PERMS_JEFE,
  'jefe':                _PERMS_JEFE,
  'jefa':                _PERMS_JEFE,
  'profesor':            _PERMS_PROFE,
  'profesora':           _PERMS_PROFE,
  'lector':              _PERMS_LECTURA,
  'lectora':             _PERMS_LECTURA,
};

const ACTION_PERMISSIONS = {
  add: 'items.write',
  update: 'items.write',
  delete: 'items.delete',
  bulkImport: 'import.write',
  restoreBackup: 'import.write',
  fotosGet: 'items.write',
  fotosSync: 'items.write',
  mantenimientosGet: 'items.write',
  buscarPorSerie: 'serie.read',
  detectarMultiples: 'serie.read',
  buscarSeriePorCodigo: 'serie.read',
  registrarFeedbackDeteccion: 'serie.read',
  profAdd: 'profesores.manage',
  profUpdate: 'profesores.manage',
  profDelete: 'profesores.manage',
  aulasSync: 'config.manage',
  catsSync: 'categories.manage',
  normalizeCategoriesTags: 'categories.manage',
  normalizeTagsCanonical: 'categories.manage',
  renameTag: 'categories.manage',
  deleteTag: 'categories.manage',
  ciclosSync: 'config.manage',
  ubicacionesSync: 'config.manage',
  prestar: 'loans.write',
  devolver: 'loans.write',
  notificarVencidos: 'loans.write',
  reservaCrear: 'loans.write',
  reservaConfirmar: 'loans.write',
  reservaCancelar: 'loans.write',
  getDocs: 'docs.read',
  uploadDoc: 'docs.write',
  deleteDoc: 'docs.write',
  updateProfile: 'profile.write',
  changePassword: 'profile.write',
  selectDepartamento: 'profile.write',
  selectModulos: 'profile.write',
  selectAulas: 'profile.write',
  pedidoAdd: 'orders.write',
  pedidoUpdate: 'orders.write',
  pedidoRemove: 'orders.write',
  pedidoClear: 'orders.write',
  solicitudCrear: 'solicitudes.write',
  solicitudUpdate: 'solicitudes.manage',
  getUsers: 'config.manage',
  userAdd: 'config.manage',
  userUpdate: 'config.manage',
  userDelete: 'config.manage',
  userResetPassword: 'config.manage',
  userUnlock: 'config.manage',
  userAssignModulos: 'config.manage',
  userAssignAulas: 'config.manage',
  importModulosCSV: 'config.manage',
  toggleOculto: 'visibility.manage'
};

function normalizeRole(role){
  return String(role || 'consulta')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function userRole(){
  return normalizeRole(SESSION?.rol);
}

// Permisos exclusivos del SuperAdmin: NO los concede el comodín '*'.
const SUPERADMIN_ONLY = ['visibility.manage'];

function can(permission){
  if(!SESSION) return false;
  if(permission === 'docs.read' || permission === 'serie.read') return true;
  if(SUPERADMIN_ONLY.includes(permission)) return userRole() === 'superadmin';
  const perms = ROLE_PERMISSIONS[userRole()] || ROLE_PERMISSIONS.consulta;
  return perms.includes('*') || perms.includes(permission);
}

function canAction(action){
  const permission = ACTION_PERMISSIONS[action];
  return permission ? can(permission) : false;
}

function requirePerm(permission, message){
  if(can(permission)) return true;
  if(typeof toast === 'function') toast(message || 'No tienes permisos para realizar esta acci\u00f3n', 'err');
  return false;
}

function roleLabel(){
  const r = userRole();
  const perms = ROLE_PERMISSIONS[r];
  if(perms === _PERMS_JEFE) return 'Jefe/a Departamento';
  if(perms === _PERMS_PROFE) return 'Profesor/a';
  return 'Consulta';
}

function roleLabelWithIcon(){
  const label = roleLabel();
  const isSuperAdmin = userRole() === 'superadmin';
  if(isSuperAdmin) return `👑 ${label}`;
  return label;
}

function applyRoleUI(){
  const isAdmin = can('config.manage');
  const rules = [
    ['btnN',   'items.write',  'flex'],
    ['btnDeptGame', null,      'flex'],
    ['btnPres','loans.write',  'flex'],
    ['btnStock', 'orders.write', 'flex'],
    ['btnPrint', null,         'flex'],
    ['misCursosMenuWrap', null, 'flex'],
    ['gsCamara', null,         'inline-flex']
  ];
  rules.forEach(([id, permission, displayType]) => {
    const el = document.getElementById(id);
    if(el) el.style.display = (permission === null || can(permission)) ? displayType : 'none';
  });
  // Exportar e importar: solo visibles en topbar para no-admins (admins los tienen en menú Departamento)
  const btnE   = document.getElementById('btnE');
  const btnImp = document.getElementById('btnImp');
  if(btnE)   btnE.style.display   = isAdmin ? 'none' : (can('import.write') ? 'flex' : 'none');
  if(btnImp) btnImp.style.display = isAdmin ? 'none' : (can('import.write') ? 'flex' : 'none');
  document.querySelectorAll('[data-perm]').forEach(el => {
    el.style.display = can(el.dataset.perm) ? 'flex' : 'none';
  });
  // Botón Departamento solo para Jefes/Admin
  const deptWrap = document.getElementById('deptMenuWrap');
  if(deptWrap) deptWrap.style.display = can('config.manage') ? 'flex' : 'none';
}

function canAccessHistorial() {
  if (!SESSION) return false;
  const usuario = (SESSION.usuario || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  const rol = (SESSION.rol || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  return usuario === 'seba' ||
    rol.includes('admin') ||
    rol.includes('jefe') ||
    rol.includes('departamento');
}

function showHistorialButton(){
  const btnHistorial = document.getElementById('btnHistorialDept');
  if(btnHistorial) btnHistorial.style.display = canAccessHistorial() ? 'flex' : 'none';
  const btnGo = document.getElementById('btnGoHistorial');
  if(btnGo) btnGo.style.display = canAccessHistorial() ? 'inline-flex' : 'none';
}
