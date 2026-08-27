// ═════════════════════════════════════════════════════════
// SOLICITUDES DE MATERIAL — un docente pide algo que puede no existir
// todavía como ítem del inventario (a diferencia de `pedidos`, que exige
// un itemId ya dado de alta). Jefatura/superadmin decide el estado.
// ═════════════════════════════════════════════════════════

const ESTADOS_VALIDOS = ['pendiente', 'aceptada', 'recibida', 'descartada'];

function escHtml(v){
  return String(v ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
}

function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

function isJefeDepartamento(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'jefe/a departamento';
}

async function getGmailAccessToken(env) {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET || !env.GOOGLE_OAUTH_REFRESH_TOKEN) return null;
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
  return data.access_token || null;
}

async function sendGmail(env, to, subject, htmlBody) {
  const accessToken = await getGmailAccessToken(env);
  if (!accessToken || !to) return;
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
  await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encoded }),
  }).catch(e => console.warn('sendGmail failed', e?.message));
}

async function auditLog(db, user, accion, resumen) {
  const fecha = new Date().toISOString().replace('T',' ').slice(0,19);
  try {
    const actor = user || {};
    await db.prepare("CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT DEFAULT '', usuario TEXT DEFAULT '', nombre TEXT DEFAULT '', rol TEXT DEFAULT '', accion TEXT DEFAULT '', itemId TEXT DEFAULT '', resumen TEXT DEFAULT '')").run();
    await db.prepare('INSERT INTO log (fecha,usuario,nombre,rol,accion,itemId,resumen) VALUES (?,?,?,?,?,?,?)')
      .bind(fecha, actor.usuario || '', actor.nombre || '', actor.rol || '', accion, '', resumen).run();
  } catch (error) {
    console.warn('auditLog failed', error?.message || error);
  }
}

async function ensureSolicitudesTable(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS solicitudes_material (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    departamento TEXT NOT NULL DEFAULT '',
    nombre TEXT NOT NULL DEFAULT '',
    cantidad INTEGER NOT NULL DEFAULT 1,
    nota TEXT DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'pendiente',
    respuesta TEXT DEFAULT '',
    creadoPor TEXT DEFAULT '',
    creadoPorNombre TEXT DEFAULT '',
    fecha TEXT DEFAULT (datetime('now')),
    actualizadoEn TEXT DEFAULT ''
  )`).run().catch(() => {});
}

export async function onRequestPost({ request, env, data }) {
  const body = await request.json();
  const { action } = body;
  const user = data?.user || request.user;
  const dept = data?.departamento || request.departamento || '';

  await ensureSolicitudesTable(env.DB);

  if (action === 'solicitudCrear') {
    const nombre = String(body.nombre || '').trim();
    const cantidad = Math.max(1, Number(body.cantidad) || 1);
    const nota = String(body.nota || '').trim();
    if (!nombre) return Response.json({ ok: false, error: 'Indica el nombre del material' });

    const fecha = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const creadoPorNombre = user?.nombre || user?.usuario || '';
    const ins = await env.DB.prepare(
      "INSERT INTO solicitudes_material (departamento, nombre, cantidad, nota, estado, creadoPor, creadoPorNombre, fecha) VALUES (?,?,?,?,'pendiente',?,?,?)"
    ).bind(dept, nombre, cantidad, nota, user?.usuario || '', creadoPorNombre, fecha).run();
    const id = ins.meta?.last_row_id;
    await auditLog(env.DB, user, 'solicitudCrear', `Solicitud ${id}: ${nombre} (${cantidad})`);

    // Notificación por email: al jefe/a de departamento, a quien la solicita
    // y al buzón central de inventario — silenciosa si falla, mismo patrón
    // que pedidoAdd pero con más destinatarios (pedido explícito del usuario).
    const jefeRow = await env.DB.prepare(
      "SELECT email FROM usuarios WHERE departamento=? AND rol='jefe/a departamento' AND email!='' LIMIT 1"
    ).bind(dept).first();
    const destinatarios = new Set(['inventarioelec@iesjuanbosco.es']);
    if (jefeRow?.email) destinatarios.add(jefeRow.email);
    if (user?.email) destinatarios.add(user.email);
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2>Nueva solicitud de material</h2>
      <p>${escHtml(creadoPorNombre || 'Alguien')} ha solicitado material que no está en el inventario:</p>
      <table style="border-collapse:collapse">
        <tr><td style="padding:6px;font-weight:bold">Material:</td><td style="padding:6px">${escHtml(nombre)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Cantidad aproximada:</td><td style="padding:6px">${cantidad}</td></tr>
        ${nota ? `<tr><td style="padding:6px;font-weight:bold">Comentario:</td><td style="padding:6px">${escHtml(nota)}</td></tr>` : ''}
      </table>
      <p style="font-size:12px;color:#6b7280">Puedes aceptarla, marcarla como recibida o descartarla desde 🧰 Pedir algo nuevo en la app.</p>
      <p style="font-size:12px;color:#6b7280">Inventario IES Juan Bosco</p>
    </div>`;
    for (const to of destinatarios) {
      await sendGmail(env, to, `Solicitud de material: ${nombre}`, html);
    }

    return Response.json({
      ok: true,
      solicitud: {
        id, departamento: dept, nombre, cantidad, nota, estado: 'pendiente', respuesta: '',
        creadoPor: user?.usuario || '', creadoPorNombre, fecha, actualizadoEn: '',
      },
    });
  }

  if (action === 'solicitudUpdate') {
    const id = body.id;
    const estado = String(body.estado || '').trim();
    const respuesta = String(body.respuesta || '').trim();
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return Response.json({ ok: false, error: 'Estado inválido' });
    }
    if (!isSuperAdmin(user) && !isJefeDepartamento(user)) {
      return Response.json({ ok: false, error: 'Solo jefatura de departamento puede cambiar el estado' }, { status: 403 });
    }
    const row = await env.DB.prepare('SELECT * FROM solicitudes_material WHERE id=?').bind(id).first();
    if (!row) return Response.json({ ok: false, error: 'Solicitud no encontrada' });
    if (!isSuperAdmin(user) && row.departamento !== dept) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }

    const actualizadoEn = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await env.DB.prepare('UPDATE solicitudes_material SET estado=?, respuesta=?, actualizadoEn=? WHERE id=?')
      .bind(estado, respuesta, actualizadoEn, id).run();
    await auditLog(env.DB, user, 'solicitudUpdate', `Solicitud ${id} → ${estado}: ${escHtml(row.nombre)}`);

    return Response.json({
      ok: true,
      solicitud: { ...row, estado, respuesta, actualizadoEn },
    });
  }

  return Response.json({ ok: false, error: 'Acción desconocida' });
}
