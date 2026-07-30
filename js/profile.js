// ═════════════════════════════════════════════════════════
// PERFIL DE USUARIO
// ═════════════════════════════════════════════════════════

function goProfile() {
  closeMobMenu();
  _push({ page: 'profile' }, '#profile');
  document.getElementById('bc').innerHTML = `<span class="bc-link" onclick="goHome()">Inicio</span><span class="sep">›</span><strong>👤 Mi perfil</strong>`;
  document.getElementById('btnN').style.display = 'none';
  document.getElementById('btnE').style.display = 'none';
  document.getElementById('btnImp').style.display = 'none';
  document.getElementById('btnPres').style.display = 'none';
  document.getElementById('btnPed').style.display = 'none';
  document.getElementById('btnInstall').style.display = 'none';

  const nombre = SESSION.nombre || SESSION.usuario;
  const initials = nombre.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('profAvatar').textContent = initials;
  document.getElementById('profUser').textContent = SESSION.usuario;
  document.getElementById('profRol').textContent = typeof roleLabelWithIcon === 'function' ? roleLabelWithIcon() : (SESSION.rol || 'profesor');
  document.getElementById('profNombre').value = SESSION.nombre || '';
  document.getElementById('profEmail').value = SESSION.email || '';

  const isSuperAdmin = String(SESSION.rol||'').trim().toLowerCase() === 'superadmin';
  const deptWrap = document.getElementById('profDeptWrap');
  if(isSuperAdmin && typeof DEPARTAMENTOS !== 'undefined' && DEPARTAMENTOS.length){
    deptWrap.style.display = '';
    const sel = document.getElementById('profDept');
    sel.innerHTML = DEPARTAMENTOS.map(d=>`<option value="${escHtml(d.slug)}">${escHtml(d.icono||'')} ${escHtml(d.nombre)}</option>`).join('');
    sel.value = SESSION.departamento || '';
  } else {
    deptWrap.style.display = 'none';
  }

  document.getElementById('profPassOld').value = '';
  document.getElementById('profPassNew').value = '';
  document.getElementById('profPassConf').value = '';

  show('pProfile');
}

async function saveProfile() {
  const nombre = document.getElementById('profNombre').value.trim();
  const email = document.getElementById('profEmail').value.trim();
  if (!nombre) { toast('El nombre no puede estar vacío', 'err'); return; }

  const deptWrap = document.getElementById('profDeptWrap');
  const departamento = deptWrap.style.display !== 'none' ? document.getElementById('profDept').value : undefined;

  const btn = document.getElementById('btnSavePerfil');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    const res = await apiPost({ action: 'updateProfile', nombre, email, departamento });
    if (!res.ok) throw new Error(res.error || 'Error al guardar');
    SESSION.nombre = nombre;
    SESSION.email = email;
    if(departamento != null){
      SESSION.departamento = departamento;
      const dept = DEPARTAMENTOS.find(d=>d.slug===departamento);
      SESSION.departamentoNombre = dept?.nombre || '';
      SESSION.departamentoIcono = dept?.icono || '';
    }
    localStorage.setItem('inv_session', JSON.stringify(SESSION));
    showUserChip();
    const initials = nombre.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
    document.getElementById('profAvatar').textContent = initials;
    toast('Perfil actualizado correctamente', 'ok');
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Guardar cambios';
  }
}

async function doChangePassword() {
  const old = document.getElementById('profPassOld').value;
  const n1  = document.getElementById('profPassNew').value;
  const n2  = document.getElementById('profPassConf').value;

  if (!old || !n1 || !n2) { toast('Rellena todos los campos de contraseña', 'err'); return; }
  if (n1 !== n2) { toast('Las contraseñas nuevas no coinciden', 'err'); return; }
  if (n1.length < 4) { toast('La contraseña debe tener al menos 4 caracteres', 'err'); return; }

  const btn = document.getElementById('btnChangePass');
  btn.disabled = true; btn.textContent = 'Cambiando...';
  try {
    const res = await apiPost({ action: 'changePassword', oldPassword: old, newPassword: n1 });
    if (!res.ok) throw new Error(res.error || 'Error al cambiar contraseña');
    SESSION.password = n1;
    localStorage.setItem('inv_session', JSON.stringify(SESSION));
    document.getElementById('profPassOld').value = '';
    document.getElementById('profPassNew').value = '';
    document.getElementById('profPassConf').value = '';
    toast('Contraseña cambiada correctamente', 'ok');
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '🔑 Cambiar contraseña';
  }
}
