// ═════════════════════════════════════════════════════════
// PEDIDOS — lista de material a comprar, compartida por departamento
// (antes solo en localStorage; el endpoint no existía y la notificación
// nunca llegó a enviarse a nadie, ver docs/DEVELOPMENT.md)
// ═════════════════════════════════════════════════════════

function escHtml(v){
  return String(v ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
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

async function auditLog(db, user, accion, itemId, resumen) {
  const fecha = new Date().toISOString().replace('T',' ').slice(0,19);
  try {
    const actor = user || {};
    await db.prepare("CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT DEFAULT '', usuario TEXT DEFAULT '', nombre TEXT DEFAULT '', rol TEXT DEFAULT '', accion TEXT DEFAULT '', itemId TEXT DEFAULT '', resumen TEXT DEFAULT '')").run();
    await db.prepare('INSERT INTO log (fecha,usuario,nombre,rol,accion,itemId,resumen) VALUES (?,?,?,?,?,?,?)')
      .bind(fecha, actor.usuario || '', actor.nombre || '', actor.rol || '', accion, String(itemId ?? ''), resumen).run();
  } catch (error) {
    console.warn('auditLog failed', error?.message || error);
  }
}

async function ensurePedidosTable(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    itemId INTEGER NOT NULL,
    departamento TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL DEFAULT 1,
    nota TEXT DEFAULT '',
    creadoPor TEXT DEFAULT '',
    fecha TEXT DEFAULT (datetime('now')),
    UNIQUE(itemId, departamento)
  )`).run().catch(() => {});
}

export async function onRequestPost({ request, env, data }) {
  const body = await request.json();
  const { action } = body;
  const user = data?.user || request.user;
  const dept = data?.departamento || request.departamento || '';

  await ensurePedidosTable(env.DB);

  if (action === 'pedidoAdd') {
    const itemId = body.itemId;
    const qty = Math.max(1, Number(body.qty) || 1);
    const nota = String(body.nota || '').trim();
    if (!itemId) return Response.json({ ok: false, error: 'Falta el ítem' });

    const item = await env.DB.prepare('SELECT i.item, i.ref, i.aula, a.name AS aulaNombre FROM inventario i LEFT JOIN aulas a ON a.id = i.aula WHERE i.id=?').bind(itemId).first();
    if (!item) return Response.json({ ok: false, error: 'Ítem no encontrado' });

    const existing = await env.DB.prepare('SELECT id FROM pedidos WHERE itemId=? AND departamento=?').bind(itemId, dept).first();
    if (existing) {
      await env.DB.prepare('UPDATE pedidos SET qty=?, nota=? WHERE id=?').bind(qty, nota, existing.id).run();
      return Response.json({ ok: true, id: existing.id });
    }

    const ins = await env.DB.prepare('INSERT INTO pedidos (itemId, departamento, qty, nota, creadoPor) VALUES (?,?,?,?,?)')
      .bind(itemId, dept, qty, nota, user?.nombre || user?.usuario || '').run();
    const newId = ins.meta?.last_row_id;
    await auditLog(env.DB, user, 'pedidoAdd', itemId, `Añadido a pedidos: ${item.item}`);

    // Notificación por email al jefe/a de departamento — silenciosa si falla
    // o si no hay ninguno con email registrado, no bloquea la respuesta.
    const jefeRow = await env.DB.prepare(
      "SELECT email FROM usuarios WHERE departamento=? AND rol='jefe/a departamento' AND email!='' LIMIT 1"
    ).bind(dept).first();
    if (jefeRow?.email) {
      const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2>Nuevo ítem en la lista de pedido</h2>
        <p>${escHtml(user?.nombre || user?.usuario || 'Alguien')} ha añadido un ítem a la lista de pedido:</p>
        <table style="border-collapse:collapse">
          <tr><td style="padding:6px;font-weight:bold">Ítem:</td><td style="padding:6px">${escHtml(item.item)}${item.ref ? ' (' + escHtml(item.ref) + ')' : ''}</td></tr>
          <tr><td style="padding:6px;font-weight:bold">Aula:</td><td style="padding:6px">${escHtml(item.aulaNombre || item.aula || '—')}</td></tr>
          <tr><td style="padding:6px;font-weight:bold">Cantidad:</td><td style="padding:6px">${qty}</td></tr>
          ${nota ? `<tr><td style="padding:6px;font-weight:bold">Nota:</td><td style="padding:6px">${escHtml(nota)}</td></tr>` : ''}
        </table>
        <p style="font-size:12px;color:#6b7280">Inventario IES Juan Bosco</p>
      </div>`;
      await sendGmail(env, jefeRow.email, `Pedido: ${item.item}`, html);
    }

    return Response.json({ ok: true, id: newId });
  }

  if (action === 'pedidoUpdate') {
    const itemId = body.itemId;
    const qty = Math.max(1, Number(body.qty) || 1);
    const nota = String(body.nota || '').trim();
    await env.DB.prepare('UPDATE pedidos SET qty=?, nota=? WHERE itemId=? AND departamento=?')
      .bind(qty, nota, itemId, dept).run();
    return Response.json({ ok: true });
  }

  if (action === 'pedidoRemove') {
    const itemId = body.itemId;
    await env.DB.prepare('DELETE FROM pedidos WHERE itemId=? AND departamento=?').bind(itemId, dept).run();
    return Response.json({ ok: true });
  }

  if (action === 'pedidoClear') {
    await env.DB.prepare('DELETE FROM pedidos WHERE departamento=?').bind(dept).run();
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'Acción desconocida' });
}
