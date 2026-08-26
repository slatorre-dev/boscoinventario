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
