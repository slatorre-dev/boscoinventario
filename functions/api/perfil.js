async function auditLog(db, user, accion, resumen) {
  const fecha = new Date().toISOString().replace('T',' ').slice(0,19);
  try {
    await db.prepare("CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT DEFAULT '', usuario TEXT DEFAULT '', nombre TEXT DEFAULT '', rol TEXT DEFAULT '', accion TEXT DEFAULT '', itemId TEXT DEFAULT '', resumen TEXT DEFAULT '')").run();
    await db.prepare('INSERT INTO log (fecha,usuario,nombre,rol,accion,itemId,resumen) VALUES (?,?,?,?,?,?,?)')
      .bind(fecha, user.usuario, user.nombre, user.rol, accion, '', resumen).run();
  } catch (error) {
    console.warn('auditLog failed', error?.message || error);
  }
}

function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

// ── Hashing de contraseñas (PBKDF2 vía Web Crypto) — duplicado en cada
// functions/api/*.js que toca contraseñas, ver _middleware.js/docs/SECURITY.md.
function _pwBytesToHex(bytes){ return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join(''); }
function _pwHexToBytes(hex){ const b=new Uint8Array(hex.length/2); for(let i=0;i<b.length;i++) b[i]=parseInt(hex.substr(i*2,2),16); return b; }
function _pwTimingSafeEqual(a,b){ if(a.length!==b.length) return false; let r=0; for(let i=0;i<a.length;i++) r|=a.charCodeAt(i)^b.charCodeAt(i); return r===0; }

async function hashPassword(password){
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt:saltBytes, iterations:100000, hash:'SHA-256' }, keyMaterial, 256);
  return `pbkdf2$100000$${_pwBytesToHex(saltBytes)}$${_pwBytesToHex(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored){
  if(!stored) return false;
  if(!stored.startsWith('pbkdf2$')) return password === stored;
  const [, iterStr, saltHex, hashHex] = stored.split('$');
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt:_pwHexToBytes(saltHex), iterations:parseInt(iterStr,10), hash:'SHA-256' }, keyMaterial, 256);
  return _pwTimingSafeEqual(_pwBytesToHex(new Uint8Array(bits)), hashHex);
}

export async function onRequestPost({ request, env, data }) {
  try {
    const body = await request.json();
    const { action } = body;
    const user = data?.user || request.user;
    if (!user) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

    if (action === 'updateProfile') {
      // Solo superadmin puede cambiar su propio departamento de referencia
      // (badge, icono del juego, y base para "actuar como" ese departamento
      // en Fase 3) — un jefe/a de departamento normal tiene el suyo fijo.
      if (isSuperAdmin(user) && body.departamento != null) {
        await env.DB.prepare('UPDATE usuarios SET nombre=?, email=?, departamento=? WHERE usuario=?')
          .bind(body.nombre, body.email || '', body.departamento || '', user.usuario).run();
      } else {
        await env.DB.prepare('UPDATE usuarios SET nombre=?, email=? WHERE usuario=?')
          .bind(body.nombre, body.email || '', user.usuario).run();
      }
      await auditLog(env.DB, user, 'updateProfile', `Perfil actualizado: ${body.nombre}`);
      return Response.json({ ok: true });
    }

    if (action === 'selectDepartamento') {
      // Autoasignación de departamento en el primer login sin departamento
      // (típicamente cuentas de Google con un correo @iesjuanbosco.es no
      // mapeado en EMAIL_DEPT_MAP, ver oauth/login-google.js) — evita que
      // el superadmin tenga que asignarlo a mano. Solo funciona una vez:
      // si el usuario ya tiene departamento, hay que pedírselo a su jefe/a
      // de departamento o al administrador (mismo criterio que
      // updateProfile, que solo deja tocar el departamento a superadmin).
      const slug = String(body.departamento || '').trim();
      if (!slug) return Response.json({ ok: false, error: 'Selecciona un departamento' });

      const current = await env.DB.prepare('SELECT departamento FROM usuarios WHERE usuario=?').bind(user.usuario).first();
      if (current?.departamento) {
        return Response.json({ ok: false, error: 'Ya tienes un departamento asignado. Pide a tu jefe/a de departamento o al administrador que lo cambie.' });
      }

      const dept = await env.DB.prepare('SELECT slug, nombre, icono FROM departamentos WHERE slug=?').bind(slug).first();
      if (!dept) return Response.json({ ok: false, error: 'Departamento no válido' });

      await env.DB.prepare('UPDATE usuarios SET departamento=? WHERE usuario=?').bind(dept.slug, user.usuario).run();
      await auditLog(env.DB, user, 'selectDepartamento', `Departamento seleccionado: ${dept.nombre}`);
      return Response.json({ ok: true, departamento: dept.slug, departamentoNombre: dept.nombre, departamentoIcono: dept.icono });
    }

    if (action === 'changePassword') {
      if (!body.oldPassword) {
        return Response.json({ ok: false, error: 'Contraseña actual requerida' });
      }
      if (!body.newPassword || body.newPassword.length < 4) {
        return Response.json({ ok: false, error: 'Contraseña demasiado corta' });
      }

      const current = await env.DB.prepare('SELECT password FROM usuarios WHERE usuario=?')
        .bind(user.usuario).first();
      if (!current || !(await verifyPassword(body.oldPassword, current.password))) {
        return Response.json({ ok: false, error: 'La contraseña actual no es correcta' });
      }

      await env.DB.prepare('UPDATE usuarios SET password=?, password_temporal=0 WHERE usuario=?')
        .bind(await hashPassword(body.newPassword), user.usuario).run();
      await auditLog(env.DB, user, 'changePassword', 'Contraseña cambiada');
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Acción desconocida' });
  } catch (error) {
    console.error('perfil error', error?.message || error);
    return Response.json({ ok: false, error: error?.message || String(error) });
  }
}
