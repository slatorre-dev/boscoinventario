function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
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
    `From: Inventario Taller FP <${from}>`,
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
  const subject = 'Recuperación de contraseña - Inventario Taller FP';
  const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2>Recuperación de contraseña</h2>
      <p>Hola${userName ? ' ' + escHtml(userName) : ''},</p>
      <p>Se ha solicitado cambiar la contraseña de tu cuenta en Inventario Taller FP.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">Cambiar contraseña</a></p>
      <p>Si no has solicitado este cambio, puedes ignorar este correo.</p>
      <p style="font-size:12px;color:#6b7280">El enlace caduca en 1 hora.</p>
    </div>`;
  await sendMail(env, to, subject, htmlBody);
}

async function sendWelcomeEmail(env, to, resetUrl, userName) {
  const subject = 'Bienvenido/a - Inventario Taller FP';
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
  const subject = 'Nueva cuenta creada - Inventario Taller FP';
  const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2>Nueva cuenta de profesor/a</h2>
      <p>Se ha dado de alta una cuenta nueva desde el formulario público de registro:</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td style="padding:6px;font-weight:bold">Nombre:</td><td style="padding:6px">${escHtml(nombre)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Email:</td><td style="padding:6px">${escHtml(email)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Departamento:</td><td style="padding:6px">${escHtml(departamentoNombre)}</td></tr>
      </table>
      <p style="font-size:12px;color:#6b7280">Inventario Taller FP</p>
    </div>`;
  await sendMail(env, adminEmail, subject, htmlBody);
}

async function ensureResetTable(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS reset_tokens (token TEXT PRIMARY KEY, usuario TEXT DEFAULT '', expires INTEGER DEFAULT 0)").run();
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';
  const u = url.searchParams.get('u') || '';
  const p = url.searchParams.get('p') || '';

  if (action === 'login') {
    if (!u || !p) return Response.json({ ok: false, error: 'Credenciales incorrectas' });
    const user = await env.DB.prepare(
      'SELECT usuario, nombre, rol, email, departamento, password_temporal FROM usuarios WHERE usuario=? AND password=?'
    ).bind(u.trim(), p).first();
    if (!user) return Response.json({ ok: false, error: 'Credenciales incorrectas' });
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

      await env.DB.prepare('UPDATE usuarios SET password=? WHERE usuario=?')
        .bind(body.newPassword, row.usuario).run();
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

      const randomPass = Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);
      await env.DB.prepare(`
        INSERT INTO usuarios (usuario, nombre, email, password, rol, auth_method, created_at, departamento)
        VALUES (?, ?, ?, ?, 'Profesor/a', 'local', datetime('now'), ?)
      `).bind(usuario, nombre, email, randomPass, departamento).run();

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
