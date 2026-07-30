const HEADERS_PRES = ['id','itemId','itemNombre','cantidad','aulaOrigen','aulaDestino','profesorId','profesorNombre','gestionadoPor','fechaPrestamo','fechaPrevista','fechaDevolucion','cantidadDevuelta','estado','obs'];

const GENERIC_DEPT = 'iesjuanbosco'; // "IES Juan Bosco": bolsa compartida, visible/editable por cualquier departamento

function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

function isProfesor(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'profesor';
}

async function itemDept(db, id) {
  const row = await db.prepare('SELECT departamento FROM inventario WHERE id=?').bind(id).first();
  return row?.departamento || '';
}

function ownsItemDept(itemDeptValue, ownDept, genericDept){
  return itemDeptValue === ownDept || itemDeptValue === genericDept;
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
  await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encoded }),
  }).catch(e => console.warn('sendGmail failed', e?.message));
}

async function auditLog(db, user, accion, itemId, resumen) {
  const fecha = new Date().toISOString().replace('T',' ').slice(0,19);
  try {
    await db.prepare("CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT DEFAULT '', usuario TEXT DEFAULT '', nombre TEXT DEFAULT '', rol TEXT DEFAULT '', accion TEXT DEFAULT '', itemId TEXT DEFAULT '', resumen TEXT DEFAULT '')").run();
    await db.prepare('INSERT INTO log (fecha,usuario,nombre,rol,accion,itemId,resumen) VALUES (?,?,?,?,?,?,?)')
      .bind(fecha, user.usuario, user.nombre, user.rol, accion, String(itemId ?? ''), resumen).run();
  } catch (error) {
    console.warn('auditLog failed', error?.message || error);
  }
}

export async function onRequestPost({ request, env, data }) {
  const body = await request.json();
  const { action } = body;
  const user = data?.user || request.user;
  const superadmin = isSuperAdmin(user);
  const dept = user?.departamento || '';
  const genericDept = isProfesor(user) ? '__none__' : GENERIC_DEPT;

  if (action === 'prestarCaja') {
    // Presta todos los hijos de una caja de una vez
    const { cajaId, profesorId, profesorNombre, aulaDestino, fechaPrevista, obs, gestionadoPor, fechaPrestamo } = body;
    if (!superadmin && !ownsItemDept(await itemDept(env.DB, cajaId), dept, genericDept)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const hijos = await env.DB.prepare('SELECT * FROM inventario WHERE parent_id=?').bind(cajaId).all();
    if (!hijos.results?.length) return Response.json({ ok: false, error: 'La caja no tiene componentes' });
    const maxRow = await env.DB.prepare('SELECT MAX(id) as m FROM prestamos').first();
    let nextId = (maxRow.m || 0) + 1;
    const nuevos = [];
    for (const hijo of hijos.results) {
      if (Number(hijo.qty) < 1) continue;
      const pres = {
        id: nextId++, itemId: hijo.id, itemNombre: hijo.item, cantidad: Number(hijo.qty),
        aulaOrigen: hijo.aula, aulaDestino: aulaDestino || '', profesorId, profesorNombre,
        gestionadoPor: gestionadoPor || '', fechaPrestamo: fechaPrestamo || '',
        fechaPrevista: fechaPrevista || '', fechaDevolucion: '', cantidadDevuelta: 0,
        estado: 'Activo', obs: obs || '', moduloCod: '', moduloNombre: '',
      };
      const vals = HEADERS_PRES.map(h => pres[h] ?? '');
      await env.DB.prepare(`INSERT INTO prestamos (${HEADERS_PRES.join(',')}) VALUES (${HEADERS_PRES.map(()=>'?').join(',')})`)
        .bind(...vals).run();
      await env.DB.prepare('UPDATE inventario SET qty = qty - ? WHERE id=?').bind(pres.cantidad, hijo.id).run();
      nuevos.push(pres);
    }
    await auditLog(env.DB, user, 'prestarCaja', cajaId, `Préstamo de caja ${cajaId} completa a ${profesorNombre}: ${nuevos.length} componentes`);
    return Response.json({ ok: true, prestamos: nuevos });
  }

  if (action === 'prestar') {
    const pres = body.prestamo;
    if (!superadmin && !ownsItemDept(await itemDept(env.DB, pres.itemId), dept, genericDept)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const maxRow = await env.DB.prepare('SELECT MAX(id) as m FROM prestamos').first();
    pres.id = (maxRow.m || 0) + 1;
    pres.estado = 'Activo';
    // Descontar stock
    await env.DB.prepare('UPDATE inventario SET qty = qty - ? WHERE id=?').bind(pres.cantidad, pres.itemId).run();
    const vals = HEADERS_PRES.map(h => pres[h] ?? '');
    await env.DB.prepare(`INSERT INTO prestamos (${HEADERS_PRES.join(',')}) VALUES (${HEADERS_PRES.map(()=>'?').join(',')})`)
      .bind(...vals).run();
    await auditLog(env.DB, user, 'prestar', pres.itemId, `Préstamo ${pres.id}: ${pres.cantidad}ud a ${pres.profesorNombre}`);

    // Notificar al responsable del módulo si existe
    if (pres.moduloCod) {
      try {
        await env.DB.prepare("ALTER TABLE ciclos ADD COLUMN responsable TEXT DEFAULT ''").run().catch(() => {});
        const moduloKey = String(pres.moduloCod);
        const [cicloId, modCod] = moduloKey.includes('__') ? moduloKey.split('__') : ['', moduloKey];
        const modRow = cicloId
          ? await env.DB.prepare('SELECT responsable FROM ciclos WHERE cicloId=? AND modCod=?').bind(cicloId, modCod).first()
          : await env.DB.prepare('SELECT responsable FROM ciclos WHERE modCod=?').bind(modCod).first();
        const responsableNombre = modRow?.responsable?.trim();
        if (responsableNombre) {
          const userRow = await env.DB.prepare('SELECT email FROM usuarios WHERE nombre=?').bind(responsableNombre).first();
          if (userRow?.email) {
            const subject = `Préstamo de material: ${pres.itemNombre}`;
            const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
              <h2>Nuevo préstamo de material</h2>
              <p>Hola ${responsableNombre},</p>
              <p>Se ha registrado un préstamo de material de tu módulo <strong>${pres.moduloNombre || pres.moduloCod}</strong>:</p>
              <table style="border-collapse:collapse;width:100%;max-width:500px">
                <tr><td style="padding:6px;font-weight:bold">Material:</td><td style="padding:6px">${pres.itemNombre}</td></tr>
                <tr><td style="padding:6px;font-weight:bold">Cantidad:</td><td style="padding:6px">${pres.cantidad}</td></tr>
                <tr><td style="padding:6px;font-weight:bold">Profesor:</td><td style="padding:6px">${pres.profesorNombre}</td></tr>
                <tr><td style="padding:6px;font-weight:bold">Aula destino:</td><td style="padding:6px">${pres.aulaDestino || '-'}</td></tr>
                <tr><td style="padding:6px;font-weight:bold">Fecha prevista devolución:</td><td style="padding:6px">${pres.fechaPrevista || '-'}</td></tr>
              </table>
              <p style="font-size:12px;color:#6b7280">Inventario Taller FP</p>
            </div>`;
            await sendGmail(env, userRow.email, subject, html);
          }
        }
      } catch (e) {
        console.warn('notif email failed', e?.message);
      }
    }

    return Response.json({ ok: true, prestamo: pres });
  }

  if (action === 'devolver') {
    const { presId, cantidadDevuelta, obs } = body;
    const pres = await env.DB.prepare('SELECT * FROM prestamos WHERE id=?').bind(presId).first();
    if (!pres) return Response.json({ ok: false, error: 'Préstamo no encontrado' });
    if (!superadmin && !ownsItemDept(await itemDept(env.DB, pres.itemId), dept, genericDept)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const fecha = new Date().toISOString().split('T')[0];
    const estado = cantidadDevuelta >= pres.cantidad ? 'Devuelto' : 'Parcial';
    await env.DB.prepare('UPDATE prestamos SET fechaDevolucion=?, cantidadDevuelta=?, estado=?, obs=? WHERE id=?')
      .bind(fecha, cantidadDevuelta, estado, obs || '', presId).run();
    // Reponer stock
    await env.DB.prepare('UPDATE inventario SET qty = qty + ? WHERE id=?').bind(cantidadDevuelta, pres.itemId).run();
    await auditLog(env.DB, user, 'devolver', pres.itemId, `Devolución préstamo ${presId}: ${cantidadDevuelta}ud`);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'Acción desconocida' });
}
