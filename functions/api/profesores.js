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

function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

export async function onRequestPost({ request, env, data }) {
  const body = await request.json();
  const { action } = body;
  const user = data?.user || request.user;
  const superadmin = isSuperAdmin(user);
  const dept = user?.departamento || '';

  if (action === 'profAdd') {
    const p = body.profesor;
    const maxRow = await env.DB.prepare('SELECT MAX(id) as m FROM profesores').first();
    p.id = (maxRow.m || 0) + 1;
    p.departamento = superadmin ? (p.departamento || dept || '') : dept;
    await env.DB.prepare('INSERT INTO profesores (id,nombre,departamento,email) VALUES (?,?,?,?)')
      .bind(p.id, p.nombre, p.departamento, p.email||'').run();
    await auditLog(env.DB, user, 'profAdd', p.id, `Añadido: ${p.nombre}`);
    return Response.json({ ok: true, profesor: p });
  }

  if (action === 'profUpdate') {
    const p = body.profesor;
    if (!superadmin) {
      const target = await env.DB.prepare('SELECT departamento FROM profesores WHERE id=?').bind(p.id).first();
      if (!target || (target.departamento || '') !== dept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    await env.DB.prepare('UPDATE profesores SET nombre=?, departamento=?, email=? WHERE id=?')
      .bind(p.nombre, superadmin ? (p.departamento || dept || '') : dept, p.email||'', p.id).run();
    await auditLog(env.DB, user, 'profUpdate', p.id, `Actualizado: ${p.nombre}`);
    return Response.json({ ok: true });
  }

  if (action === 'profDelete') {
    if (!superadmin) {
      const target = await env.DB.prepare('SELECT departamento FROM profesores WHERE id=?').bind(body.id).first();
      if (!target || (target.departamento || '') !== dept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    const old = await env.DB.prepare('SELECT nombre FROM profesores WHERE id=?').bind(body.id).first();
    await env.DB.prepare('DELETE FROM profesores WHERE id=?').bind(body.id).run();
    await auditLog(env.DB, user, 'profDelete', body.id, `Eliminado: ${old?.nombre}`);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'Acción desconocida' });
}
