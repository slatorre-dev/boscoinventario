const HEADERS_PRES = ['id','itemId','itemNombre','cantidad','aulaOrigen','aulaDestino','profesorId','profesorNombre','gestionadoPor','fechaPrestamo','fechaPrevista','fechaDevolucion','cantidadDevuelta','estado','obs'];

function escHtml(v){
  return String(v ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
}

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

async function notifyResponsableModulo(env, moduloCod, moduloNombre, subject, rowsHtml, extraInfoHtml) {
  if (!moduloCod) return;
  try {
    await env.DB.prepare("ALTER TABLE ciclos ADD COLUMN responsable TEXT DEFAULT ''").run().catch(() => {});
    const moduloKey = String(moduloCod);
    const [cicloId, modCod] = moduloKey.includes('__') ? moduloKey.split('__') : ['', moduloKey];
    const modRow = cicloId
      ? await env.DB.prepare('SELECT responsable FROM ciclos WHERE cicloId=? AND modCod=?').bind(cicloId, modCod).first()
      : await env.DB.prepare('SELECT responsable FROM ciclos WHERE modCod=?').bind(modCod).first();
    const responsableNombre = modRow?.responsable?.trim();
    if (!responsableNombre) return;
    const userRow = await env.DB.prepare('SELECT email FROM usuarios WHERE nombre=?').bind(responsableNombre).first();
    if (!userRow?.email) return;

    const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2>Nuevo préstamo de material</h2>
      <p>Hola ${escHtml(responsableNombre)},</p>
      <p>Se ha registrado un préstamo de material de tu módulo <strong>${escHtml(moduloNombre || moduloCod)}</strong>:</p>
      ${rowsHtml}
      ${extraInfoHtml || ''}
      <p style="font-size:12px;color:#6b7280">Inventario IES Juan Bosco</p>
    </div>`;
    await sendGmail(env, userRow.email, subject, html);
  } catch (e) {
    console.warn('notif email failed', e?.message);
  }
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

async function crearPrestamoDesdeLinea(db, datos) {
  const maxRow = await db.prepare('SELECT MAX(id) as m FROM prestamos').first();
  const pres = {
    id: (maxRow.m || 0) + 1,
    itemId: datos.itemId,
    itemNombre: datos.itemNombre,
    cantidad: datos.cantidad,
    aulaOrigen: datos.aulaOrigen || '',
    aulaDestino: datos.aulaDestino || '',
    profesorId: datos.profesorId,
    profesorNombre: datos.profesorNombre,
    gestionadoPor: datos.gestionadoPor || '',
    fechaPrestamo: datos.fechaPrestamo || '',
    fechaPrevista: datos.fechaPrevista || '',
    fechaDevolucion: '',
    cantidadDevuelta: 0,
    estado: 'Activo',
    obs: datos.obs || '',
  };
  const vals = HEADERS_PRES.map(h => pres[h] ?? '');
  await db.prepare(`INSERT INTO prestamos (${HEADERS_PRES.join(',')}) VALUES (${HEADERS_PRES.map(()=>'?').join(',')})`)
    .bind(...vals).run();
  await db.prepare('UPDATE inventario SET qty = qty - ? WHERE id=?').bind(pres.cantidad, pres.itemId).run();
  return pres;
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
    const caja = await env.DB.prepare('SELECT item, mod FROM inventario WHERE id=?').bind(cajaId).first();
    const hijos = await env.DB.prepare('SELECT * FROM inventario WHERE parent_id=?').bind(cajaId).all();
    if (!hijos.results?.length) return Response.json({ ok: false, error: 'La caja no tiene componentes' });
    const nuevos = [];
    for (const hijo of hijos.results) {
      if (Number(hijo.qty) < 1) continue;
      const nuevo = await crearPrestamoDesdeLinea(env.DB, {
        itemId: hijo.id, itemNombre: hijo.item, cantidad: Number(hijo.qty),
        aulaOrigen: hijo.aula, aulaDestino: aulaDestino || '', profesorId, profesorNombre,
        gestionadoPor: gestionadoPor || '', fechaPrestamo: fechaPrestamo || '',
        fechaPrevista: fechaPrevista || '', obs: obs || '',
      });
      nuevos.push(nuevo);
    }
    await auditLog(env.DB, user, 'prestarCaja', cajaId, `Préstamo de caja ${cajaId} completa a ${profesorNombre}: ${nuevos.length} componentes`);

    // Notificar al responsable del módulo de la caja (mismo criterio que prestar individual)
    if (caja?.mod && nuevos.length) {
      const rowsHtml = `<table style="border-collapse:collapse;width:100%;max-width:500px">
          <tr><td style="padding:6px;font-weight:bold">Caja:</td><td style="padding:6px">${escHtml(caja.item)}</td></tr>
          <tr><td style="padding:6px;font-weight:bold">Profesor:</td><td style="padding:6px">${escHtml(profesorNombre)}</td></tr>
          <tr><td style="padding:6px;font-weight:bold">Aula destino:</td><td style="padding:6px">${escHtml(aulaDestino || '-')}</td></tr>
          <tr><td style="padding:6px;font-weight:bold">Fecha prevista devolución:</td><td style="padding:6px">${escHtml(fechaPrevista || '-')}</td></tr>
        </table>`;
      const componentesHtml = `<p style="font-weight:bold;margin-top:10px">Componentes (${nuevos.length}):</p>
        <ul>${nuevos.map(p => `<li>${escHtml(p.itemNombre)} · ${escHtml(p.cantidad)} ud.</li>`).join('')}</ul>`;
      await notifyResponsableModulo(env, caja.mod, null, `Préstamo de caja: ${caja.item}`, rowsHtml, componentesHtml);
    }

    return Response.json({ ok: true, prestamos: nuevos });
  }

  if (action === 'prestar') {
    const pres = body.prestamo;
    if (!superadmin && !ownsItemDept(await itemDept(env.DB, pres.itemId), dept, genericDept)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const nuevo = await crearPrestamoDesdeLinea(env.DB, pres);
    await auditLog(env.DB, user, 'prestar', nuevo.itemId, `Préstamo ${nuevo.id}: ${nuevo.cantidad}ud a ${nuevo.profesorNombre}`);

    // Notificar al responsable del módulo si existe
    const rowsHtml = `<table style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td style="padding:6px;font-weight:bold">Material:</td><td style="padding:6px">${escHtml(nuevo.itemNombre)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Cantidad:</td><td style="padding:6px">${escHtml(nuevo.cantidad)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Profesor:</td><td style="padding:6px">${escHtml(nuevo.profesorNombre)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Aula destino:</td><td style="padding:6px">${escHtml(nuevo.aulaDestino || '-')}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Fecha prevista devolución:</td><td style="padding:6px">${escHtml(nuevo.fechaPrevista || '-')}</td></tr>
      </table>`;
    await notifyResponsableModulo(env, pres.moduloCod, pres.moduloNombre, `Préstamo de material: ${nuevo.itemNombre}`, rowsHtml);

    return Response.json({ ok: true, prestamo: nuevo });
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
    const itemRow = await env.DB.prepare('SELECT qty FROM inventario WHERE id=?').bind(pres.itemId).first();
    await auditLog(env.DB, user, 'devolver', pres.itemId, `Devolución préstamo ${presId}: ${cantidadDevuelta}ud`);
    return Response.json({
      ok: true,
      prestamo: { ...pres, fechaDevolucion: fecha, cantidadDevuelta, estado, obs: obs || '' },
      nuevoQty: itemRow?.qty ?? null,
    });
  }

  if (action === 'reservaCrear') {
    const { cicloId, moduloCod, moduloNombre, aulaDestino, profesorId, profesorNombre, fecha, franja, obs, lineas } = body;
    if (!fecha || !String(franja || '').trim() || !Array.isArray(lineas) || !lineas.length) {
      return Response.json({ ok: false, error: 'Faltan datos de la reserva (fecha, franja o ítems)' });
    }

    // Validar propiedad + calcular departamento único del kit
    const deptsUsados = new Set();
    for (const linea of lineas) {
      const itemDeptValue = await itemDept(env.DB, linea.itemId);
      if (!superadmin && !ownsItemDept(itemDeptValue, dept, genericDept)) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
      if (itemDeptValue !== GENERIC_DEPT) deptsUsados.add(itemDeptValue);
    }
    if (deptsUsados.size > 1) {
      return Response.json({ ok: false, error: 'Todos los ítems de una misma reserva deben ser del mismo departamento' });
    }
    const departamentoReserva = deptsUsados.size === 1 ? [...deptsUsados][0] : (dept || GENERIC_DEPT);

    // Comprobar disponibilidad (stock actual − lo ya reservado en el mismo hueco exacto)
    for (const linea of lineas) {
      const itemRow = await env.DB.prepare('SELECT item, qty FROM inventario WHERE id=?').bind(linea.itemId).first();
      if (!itemRow) return Response.json({ ok: false, error: `Ítem ${linea.itemId} no encontrado` });
      const reservadoRow = await env.DB.prepare(`
        SELECT COALESCE(SUM(ri.cantidad),0) as total
        FROM reserva_items ri
        JOIN reservas_practica rp ON rp.id = ri.reservaId
        WHERE ri.itemId = ? AND rp.fecha = ? AND rp.franja = ? AND rp.estado = 'pendiente'
      `).bind(linea.itemId, fecha, franja).first();
      const yaReservado = Number(reservadoRow?.total || 0);
      const disponible = Number(itemRow.qty) - yaReservado;
      if (Number(linea.cantidad) > disponible) {
        return Response.json({ ok: false, error: `${itemRow.item}: solo quedan ${disponible} libre(s) para ${fecha} · ${franja}` });
      }
    }

    // Todo validado antes de escribir nada — evita dejar filas parciales si una línea falla
    const fechaCreacion = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const insertReserva = await env.DB.prepare(`
      INSERT INTO reservas_practica (departamento, cicloId, moduloCod, moduloNombre, aulaDestino, profesorId, profesorNombre, fecha, franja, estado, obs, creadoPor, creadoEn)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?)
    `).bind(
      departamentoReserva, cicloId || '', moduloCod || '', moduloNombre || '', aulaDestino || '',
      profesorId || 0, profesorNombre || '', fecha, String(franja).trim(), obs || '',
      user?.usuario || '', fechaCreacion
    ).run();
    const reservaId = insertReserva.meta?.last_row_id;

    const lineasGuardadas = [];
    for (const linea of lineas) {
      await env.DB.prepare('INSERT INTO reserva_items (reservaId, itemId, itemNombre, cantidad) VALUES (?,?,?,?)')
        .bind(reservaId, linea.itemId, linea.itemNombre, linea.cantidad).run();
      lineasGuardadas.push({ reservaId, itemId: linea.itemId, itemNombre: linea.itemNombre, cantidad: linea.cantidad });
    }

    await auditLog(env.DB, user, 'reservaCrear', reservaId, `Reserva ${reservaId} creada: ${lineas.length} ítem(s) para ${fecha} · ${franja}`);

    return Response.json({
      ok: true,
      reserva: {
        id: reservaId, departamento: departamentoReserva, cicloId: cicloId || '', moduloCod: moduloCod || '',
        moduloNombre: moduloNombre || '', aulaDestino: aulaDestino || '', profesorId: profesorId || 0,
        profesorNombre: profesorNombre || '', fecha, franja: String(franja).trim(), estado: 'pendiente',
        obs: obs || '', creadoPor: user?.usuario || '', creadoEn: fechaCreacion,
      },
      lineas: lineasGuardadas,
    });
  }

  if (action === 'notificarVencidos') {
    const hoy = new Date().toISOString().split('T')[0];
    const vencidos = await env.DB.prepare(`
      SELECT p.* FROM prestamos p
      JOIN inventario i ON i.id = p.itemId
      WHERE p.estado IN ('Activo','Parcial')
        AND p.fechaPrevista != ''
        AND p.fechaPrevista < ?
        AND p.notificado_vencido = 0
        AND i.departamento = ?
    `).bind(hoy, dept).all();

    if (!vencidos.results || !vencidos.results.length) {
      return Response.json({ ok: true, enviados: 0 });
    }

    const ids = vencidos.results.map(p => p.id);
    const jefeRow = await env.DB.prepare(
      "SELECT email FROM usuarios WHERE departamento=? AND rol='jefe/a departamento' AND email!='' LIMIT 1"
    ).bind(dept).first();

    if (jefeRow?.email) {
      const rowsHtml = '<table style="border-collapse:collapse;width:100%">' +
        '<tr><th style="text-align:left;padding:6px;border-bottom:1px solid #e5e7eb">Ítem</th><th style="text-align:left;padding:6px;border-bottom:1px solid #e5e7eb">Profesor/a</th><th style="text-align:left;padding:6px;border-bottom:1px solid #e5e7eb">Prevista</th></tr>' +
        vencidos.results.map(p => `<tr><td style="padding:6px">${escHtml(p.itemNombre)}</td><td style="padding:6px">${escHtml(p.profesorNombre)}</td><td style="padding:6px">${escHtml(p.fechaPrevista)}</td></tr>`).join('') +
        '</table>';
      const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2>Préstamos vencidos</h2>
        <p>Hay ${vencidos.results.length} préstamo(s) de tu departamento con la devolución vencida:</p>
        ${rowsHtml}
        <p style="font-size:12px;color:#6b7280">Inventario IES Juan Bosco</p>
      </div>`;
      await sendGmail(env, jefeRow.email, `${vencidos.results.length} préstamo(s) vencido(s)`, html);
    }

    const placeholders = ids.map(() => '?').join(',');
    await env.DB.prepare(`UPDATE prestamos SET notificado_vencido=1 WHERE id IN (${placeholders})`)
      .bind(...ids).run();

    return Response.json({ ok: true, enviados: jefeRow?.email ? vencidos.results.length : 0 });
  }

  return Response.json({ ok: false, error: 'Acción desconocida' });
}
