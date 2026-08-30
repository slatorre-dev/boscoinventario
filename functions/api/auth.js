function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
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

function appBaseUrl(request, bodyOrParams) {
  const raw = bodyOrParams?.appUrl || '';
  if (raw && /^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    url.hash = '';
    url.search = '';
    return url.toString();
  }
  const url = new URL(request.url);
  return `${url.origin}/`;
}

async function getGmailAccessToken(env) {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET || !env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    throw new Error('Correo no configurado: faltan GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET o GOOGLE_OAUTH_REFRESH_TOKEN');
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error_description || data?.error || 'No se pudo obtener access token de Gmail');
  }
  return data.access_token;
}

function escHtml(v){
  return String(v ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
}

async function sendMail(env, to, subject, htmlBody) {
  const accessToken = await getGmailAccessToken(env);
  const from = env.MAIL_FROM || 'inventarioelec@iesjuanbosco.es';

  const subjectEncoded = '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(subject))) + '?=';
  const mime = [
    `From: Inventario IES Juan Bosco <${from}>`,
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(htmlBody))),
  ].join('\r\n');

  const encoded = btoa(unescape(encodeURIComponent(mime)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || 'No se pudo enviar el correo');
  }
}

async function sendResetEmail(env, to, resetUrl, userName) {
  const subject = 'Recuperación de contraseña - Inventario IES Juan Bosco';
  const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2>Recuperación de contraseña</h2>
      <p>Hola${userName ? ' ' + escHtml(userName) : ''},</p>
      <p>Se ha solicitado cambiar la contraseña de tu cuenta en Inventario IES Juan Bosco.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">Cambiar contraseña</a></p>
      <p>Si no has solicitado este cambio, puedes ignorar este correo.</p>
      <p style="font-size:12px;color:#6b7280">El enlace caduca en 1 hora.</p>
    </div>`;
  await sendMail(env, to, subject, htmlBody);
}

async function sendWelcomeEmail(env, to, resetUrl, userName) {
  const subject = 'Bienvenido/a - Inventario IES Juan Bosco';
  const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2>Cuenta creada</h2>
      <p>Hola ${escHtml(userName)},</p>
      <p>Se ha creado tu cuenta en el Inventario del IES Juan Bosco. Pulsa el siguiente enlace para elegir tu contraseña y empezar a usarla:</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">Elegir contraseña</a></p>
      <p style="font-size:12px;color:#6b7280">El enlace caduca en 1 hora. Si no has solicitado esta cuenta, ignora este correo.</p>
    </div>`;
  await sendMail(env, to, subject, htmlBody);
}

async function sendNewUserNotification(env, adminEmail, nombre, email, departamentoNombre) {
  const subject = 'Nueva cuenta creada - Inventario IES Juan Bosco';
  const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2>Nueva cuenta de profesor/a</h2>
      <p>Se ha dado de alta una cuenta nueva desde el formulario público de registro:</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td style="padding:6px;font-weight:bold">Nombre:</td><td style="padding:6px">${escHtml(nombre)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Email:</td><td style="padding:6px">${escHtml(email)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Departamento:</td><td style="padding:6px">${escHtml(departamentoNombre)}</td></tr>
      </table>
      <p style="font-size:12px;color:#6b7280">Inventario IES Juan Bosco</p>
    </div>`;
  await sendMail(env, adminEmail, subject, htmlBody);
}

async function ensureResetTable(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS reset_tokens (token TEXT PRIMARY KEY, usuario TEXT DEFAULT '', expires INTEGER DEFAULT 0)").run();
}

// ── Bloqueo por intentos de login fallidos — ver migrations/0031_intentos_login.sql.
// MAX_INTENTOS_LOGIN intentos fallidos seguidos bloquean la cuenta (hay que
// contactar con el administrador para desbloquearla, vía userUnlock en
// usuarios.js); a partir de AVISO_RESTANTES intentos restantes se avisa en
// el mensaje de error para que el usuario no llegue al bloqueo a ciegas.
const MAX_INTENTOS_LOGIN = 5;
const AVISO_RESTANTES = 2;

// Lee el usuario para login incluyendo intentos_fallidos/bloqueado. Si la
// migración 0031 aún no se ha aplicado en remoto, las columnas no existen
// todavía: nos autocuramos añadiéndolas y reintentando una vez, igual que
// el patrón ya usado en usuarios.js para la columna `responsable`.
async function getUserForLogin(db, usuario) {
  const sql = 'SELECT usuario, nombre, rol, email, departamento, password_temporal, password, intentos_fallidos, bloqueado, session_token FROM usuarios WHERE usuario=?';
  try {
    return await db.prepare(sql).bind(usuario).first();
  } catch (error) {
    if (!/no such column/i.test(error?.message || '')) throw error;
    await db.prepare('ALTER TABLE usuarios ADD COLUMN intentos_fallidos INTEGER DEFAULT 0').run().catch(() => {});
    await db.prepare('ALTER TABLE usuarios ADD COLUMN bloqueado INTEGER DEFAULT 0').run().catch(() => {});
    return await db.prepare(sql).bind(usuario).first();
  }
}

// ── Registro de accesos (panel "🛡️ Accesos", solo jefe/a de departamento y
// superadmin) — reusa la tabla `log` ya existente para Historial de acciones
// (historial.js la clasifica como tipo "Accesos" por el prefijo `login`).
// Sin columna `departamento` propia: se ve por jefe/a de departamento via
// JOIN a usuarios.departamento (igual que el resto del historial), así que
// los intentos contra un usuario inexistente solo los ve el superadmin.
function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || '';
}

async function logAccessAttempt(db, { usuario, nombre, rol, accion, detalle }) {
  try {
    await db.prepare("CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT DEFAULT '', usuario TEXT DEFAULT '', nombre TEXT DEFAULT '', rol TEXT DEFAULT '', accion TEXT DEFAULT '', itemId TEXT DEFAULT '', resumen TEXT DEFAULT '')").run();
    const fecha = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const rolNorm = String(rol || '').trim().toLowerCase();
    const rolFinal = rolNorm === 'superadmin' ? 'Jefe/a Departamento' : (rol || '');
    await db.prepare('INSERT INTO log (fecha,usuario,nombre,rol,accion,itemId,resumen) VALUES (?,?,?,?,?,?,?)')
      .bind(fecha, usuario || '', nombre || '', rolFinal, accion, '', detalle || '').run();
  } catch (error) {
    console.warn('logAccessAttempt failed', error?.message || error);
  }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';
  const u = url.searchParams.get('u') || '';
  const p = url.searchParams.get('p') || '';

  if (action === 'login') {
    if (!u || !p) return Response.json({ ok: false, error: 'Credenciales incorrectas' });
    const ip = clientIp(request);
    const row = await getUserForLogin(env.DB, u.trim());
    if (!row) {
      await logAccessAttempt(env.DB, { usuario: u.trim(), accion: 'loginFail', detalle: `Usuario no encontrado · IP ${ip}` });
      return Response.json({ ok: false, error: 'Credenciales incorrectas' });
    }

    if (Number(row.bloqueado) === 1) {
      await logAccessAttempt(env.DB, { usuario: row.usuario, nombre: row.nombre, rol: row.rol, accion: 'loginBlocked', detalle: `Intento contra cuenta ya bloqueada · IP ${ip}` });
      return Response.json({ ok: false, error: 'Cuenta bloqueada por demasiados intentos fallidos. Ponte en contacto con el administrador.', bloqueado: true });
    }

    if (!(await verifyPassword(p, row.password))) {
      const intentos = Number(row.intentos_fallidos || 0) + 1;
      const bloquear = intentos >= MAX_INTENTOS_LOGIN;
      await env.DB.prepare('UPDATE usuarios SET intentos_fallidos=?, bloqueado=? WHERE usuario=?')
        .bind(intentos, bloquear ? 1 : 0, row.usuario).run();
      if (bloquear) {
        await logAccessAttempt(env.DB, { usuario: row.usuario, nombre: row.nombre, rol: row.rol, accion: 'loginBlocked', detalle: `Bloqueada tras ${MAX_INTENTOS_LOGIN} intentos fallidos · IP ${ip}` });
        return Response.json({ ok: false, error: 'Cuenta bloqueada por demasiados intentos fallidos. Ponte en contacto con el administrador.', bloqueado: true });
      }
      const restantes = MAX_INTENTOS_LOGIN - intentos;
      let error = 'Credenciales incorrectas';
      if (restantes <= AVISO_RESTANTES) {
        error += ` (te quedan ${restantes} intento${restantes === 1 ? '' : 's'} antes de que se bloquee la cuenta)`;
      }
      await logAccessAttempt(env.DB, { usuario: row.usuario, nombre: row.nombre, rol: row.rol, accion: 'loginFail', detalle: `Intento ${intentos}/${MAX_INTENTOS_LOGIN} · IP ${ip}` });
      return Response.json({ ok: false, error });
    }

    // Login correcto: limpiar el contador de intentos fallidos.
    if (row.intentos_fallidos) {
      await env.DB.prepare('UPDATE usuarios SET intentos_fallidos=0 WHERE usuario=?').bind(row.usuario).run();
    }
    // Migración perezosa: contraseña aún en claro -> se rehashea ahora que
    // se acaba de comprobar que es correcta, sin que el usuario haga nada.
    if (!String(row.password || '').startsWith('pbkdf2$')) {
      await env.DB.prepare('UPDATE usuarios SET password=? WHERE usuario=?')
        .bind(await hashPassword(p), row.usuario).run();
    }
    await logAccessAttempt(env.DB, { usuario: row.usuario, nombre: row.nombre, rol: row.rol, accion: 'loginOk', detalle: `IP ${ip}` });
    delete row.password;
    delete row.intentos_fallidos;
    delete row.bloqueado;

    // Token de sesión (mismo mecanismo que ya usa el login de Google):
    // se reutiliza si ya existe, para no desconectar otras sesiones activas
    // de la misma cuenta (las 48 cuentas genéricas de departamento las usan
    // varios profesores a la vez desde dispositivos distintos). Solo se
    // genera uno nuevo la primera vez, o al cambiar la contraseña (ver
    // perfil.js/usuarios.js/resetPassword más abajo). Así el frontend deja
    // de reenviar la contraseña real en cada petición tras el login.
    if (!row.session_token) {
      row.session_token = randomToken();
      await env.DB.prepare('UPDATE usuarios SET session_token=? WHERE usuario=?').bind(row.session_token, row.usuario).run();
    }
    const user = row;
    if (user.departamento) {
      const dept = await env.DB.prepare('SELECT nombre, icono FROM departamentos WHERE slug=?').bind(user.departamento).first().catch(() => null);
      if (dept) { user.departamentoNombre = dept.nombre; user.departamentoIcono = dept.icono; }
    }
    return Response.json({ ok: true, user });
  }

  if (action === 'requestReset') {
    try {
      await ensureResetTable(env.DB);
      const usuario = url.searchParams.get('usuario') || '';
      const user = usuario ? await env.DB.prepare(
        'SELECT usuario, nombre, email FROM usuarios WHERE usuario=?'
      ).bind(usuario.trim()).first() : null;

      // Respuesta generica para no revelar si el usuario existe.
      if (!user || !user.email) return Response.json({ ok: true });

      const token = randomToken();
      const expires = Date.now() + 60 * 60 * 1000;
      await env.DB.prepare('INSERT OR REPLACE INTO reset_tokens (token,usuario,expires) VALUES (?,?,?)')
        .bind(token, user.usuario, expires).run();

      const resetUrl = appBaseUrl(request, { appUrl: url.searchParams.get('appUrl') }) + '#reset/' + encodeURIComponent(token);
      await sendResetEmail(env, user.email, resetUrl, user.nombre);
      return Response.json({ ok: true });
    } catch (error) {
      console.error('requestReset error', error?.message || error);
      return Response.json({ ok: false, error: error?.message || String(error) });
    }
  }

  // Público (sin sesión) — solo lo mínimo para poblar el select del
  // formulario de alta: slug/nombre/icono, nada sensible.
  if (action === 'departamentos') {
    const rows = await env.DB.prepare('SELECT slug, nombre, icono FROM departamentos ORDER BY orden').all();
    return Response.json({ ok: true, departamentos: rows.results || [] });
  }

  return Response.json({ ok: false, error: 'Acción desconocida' });
}

export async function onRequestPost({ request, env }) {
  let body = {};
  try {
    body = await request.json();
  } catch (error) {
    return Response.json({ ok: false, error: 'JSON inválido' });
  }

  if (body.action === 'resetPassword') {
    try {
      await ensureResetTable(env.DB);
      if (!body.token) return Response.json({ ok: false, error: 'Token requerido' });
      if (!body.newPassword || body.newPassword.length < 4) {
        return Response.json({ ok: false, error: 'Contraseña demasiado corta' });
      }

      const row = await env.DB.prepare('SELECT * FROM reset_tokens WHERE token=?')
        .bind(body.token).first();
      if (!row || Number(row.expires) < Date.now()) {
        return Response.json({ ok: false, error: 'El enlace ha caducado o no es válido' });
      }

      // Rotar session_token: invalida cualquier sesión abierta con la
      // contraseña/token anteriores, igual que si se hubiera cambiado la
      // contraseña desde dentro de la app (ver auth.js action=login).
      await env.DB.prepare('UPDATE usuarios SET password=?, session_token=? WHERE usuario=?')
        .bind(await hashPassword(body.newPassword), randomToken(), row.usuario).run();
      await env.DB.prepare('DELETE FROM reset_tokens WHERE token=?').bind(body.token).run();
      return Response.json({ ok: true });
    } catch (error) {
      console.error('resetPassword error', error?.message || error);
      return Response.json({ ok: false, error: error?.message || String(error) });
    }
  }

  // Alta pública de profesor/a — sin aprobación previa. Crea la cuenta,
  // manda al profesor un enlace tipo "olvidé contraseña" para elegir su
  // clave, y avisa al admin del centro por email.
  if (body.action === 'register') {
    try {
      await ensureResetTable(env.DB);
      const nombre = String(body.nombre || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const departamento = String(body.departamento || '').trim();

      if (!nombre) return Response.json({ ok: false, error: 'Introduce tu nombre completo' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ ok: false, error: 'Introduce un email válido' });
      if (!email.endsWith('@iesjuanbosco.es')) return Response.json({ ok: false, error: 'Solo se aceptan cuentas de correo @iesjuanbosco.es' });
      if (!departamento) return Response.json({ ok: false, error: 'Selecciona tu departamento' });

      const dept = await env.DB.prepare('SELECT slug, nombre FROM departamentos WHERE slug=?').bind(departamento).first();
      if (!dept) return Response.json({ ok: false, error: 'Departamento no válido' });

      const existing = await env.DB.prepare('SELECT usuario FROM usuarios WHERE email=?').bind(email).first();
      if (existing) {
        return Response.json({ ok: false, error: 'Ya existe una cuenta con ese email. Usa "¿Olvidaste tu contraseña?" o contacta con tu jefe/a de departamento.' });
      }

      const [userPart] = email.split('@');
      let usuario = userPart.replace(/[^a-z0-9._-]/gi, '').toLowerCase();
      let baseUsuario = usuario, counter = 1;
      while (await env.DB.prepare('SELECT usuario FROM usuarios WHERE usuario=?').bind(usuario).first()) {
        usuario = `${baseUsuario}${counter}`;
        counter++;
      }

      // Contraseña de relleno aleatoria — nadie la usa nunca, el profesor
      // siempre elige la suya de verdad vía el enlace de bienvenida (abajo).
      // Se hashea igual que cualquier otra, por consistencia.
      const randomPass = Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);
      await env.DB.prepare('ALTER TABLE usuarios ADD COLUMN onboarding_pendiente INTEGER DEFAULT 0').run().catch(() => {});
      await env.DB.prepare(`
        INSERT INTO usuarios (usuario, nombre, email, password, rol, auth_method, created_at, departamento, onboarding_pendiente)
        VALUES (?, ?, ?, ?, 'Profesor/a', 'local', datetime('now'), ?, 1)
      `).bind(usuario, nombre, email, await hashPassword(randomPass), departamento).run();

      const token = randomToken();
      const expires = Date.now() + 60 * 60 * 1000;
      await env.DB.prepare('INSERT OR REPLACE INTO reset_tokens (token,usuario,expires) VALUES (?,?,?)')
        .bind(token, usuario, expires).run();
      const resetUrl = appBaseUrl(request, body) + '#reset/' + encodeURIComponent(token);

      await sendWelcomeEmail(env, email, resetUrl, nombre);
      const adminEmail = env.MAIL_FROM || 'inventarioelec@iesjuanbosco.es';
      sendNewUserNotification(env, adminEmail, nombre, email, dept.nombre).catch(err => console.warn('notif admin failed', err?.message));

      return Response.json({ ok: true });
    } catch (error) {
      console.error('register error', error?.message || error);
      return Response.json({ ok: false, error: error?.message || String(error) });
    }
  }

  return Response.json({ ok: false, error: 'Acción desconocida' });
}
