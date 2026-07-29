async function auditLog(db, user, accion, resumen) {
  const fecha = new Date().toISOString().replace('T',' ').slice(0,19);
  try {
    const actor = user || {};
    const rolNorm = String(actor.rol || '').trim().toLowerCase();
    const rol = rolNorm === 'superadmin' ? 'Jefe/a Departamento' : (actor.rol || '');
    await db.prepare("CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT DEFAULT '', usuario TEXT DEFAULT '', nombre TEXT DEFAULT '', rol TEXT DEFAULT '', accion TEXT DEFAULT '', itemId TEXT DEFAULT '', resumen TEXT DEFAULT '')").run();
    await db.prepare('INSERT INTO log (fecha,usuario,nombre,rol,accion,itemId,resumen) VALUES (?,?,?,?,?,?,?)')
      .bind(fecha, actor.usuario || '', actor.nombre || '', rol, accion, '', resumen).run();
  } catch (error) {
    console.warn('auditLog failed', error?.message || error);
  }
}

function moduloId(row) {
  return `${row.cicloId}__${row.modCod}`;
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

  if (action === 'getUsers') {
    const [usuariosRows, ciclosRows] = await Promise.all([
      superadmin
        ? env.DB.prepare('SELECT usuario, nombre, rol, email, departamento FROM usuarios ORDER BY usuario').all()
        : env.DB.prepare('SELECT usuario, nombre, rol, email, departamento FROM usuarios WHERE departamento=? ORDER BY usuario').bind(dept).all(),
      superadmin
        ? env.DB.prepare('SELECT cicloId, modCod, modNombre, responsable FROM ciclos WHERE modCod IS NOT NULL').all()
        : env.DB.prepare('SELECT cicloId, modCod, modNombre, responsable FROM ciclos WHERE modCod IS NOT NULL AND departamento=?').bind(dept).all(),
    ]);
    const ciclos = ciclosRows?.results || [];
    // Mapear responsable -> lista de modCod
    const modulosPorNombre = {};
    for (const row of ciclos) {
      const resp = (row.responsable || '').trim().toLowerCase();
      if (!resp) continue;
      if (!modulosPorNombre[resp]) modulosPorNombre[resp] = [];
      modulosPorNombre[resp].push(moduloId(row));
    }
    const todosModulos = ciclos.map(r => ({ id: moduloId(r), cicloId: r.cicloId, cod: String(r.modCod), nombre: r.modNombre || '', responsable: r.responsable || '' }));
    const usuarios = usuariosRows.results.map(u => {
      const rolNorm = String(u.rol || '').trim().toLowerCase();
      return {
        ...u,
        rol: rolNorm === 'superadmin' ? 'Jefe/a Departamento' : u.rol,
        modulos: modulosPorNombre[u.nombre.trim().toLowerCase()] || [],
      };
    });
    return Response.json({ ok: true, usuarios, todosModulos });
  }

  if (action === 'userAdd') {
    const u = body.usuario;
    const nuevoDept = superadmin ? (u.departamento || dept || '') : dept;
    await env.DB.prepare('INSERT INTO usuarios (usuario,password,nombre,rol,email,departamento) VALUES (?,?,?,?,?,?)')
      .bind(u.usuario.trim(), u.password||'cambiar123', u.nombre.trim(), u.rol.trim(), u.email||'', nuevoDept).run();
    await auditLog(env.DB, user, 'userAdd', `Nuevo usuario: ${u.usuario} (${u.rol})`);
    return Response.json({ ok: true });
  }

  if (action === 'userUpdate') {
    const u = body.usuario;
    if (!superadmin) {
      const target = await env.DB.prepare('SELECT departamento FROM usuarios WHERE usuario=?').bind(u.usuario).first();
      if (!target || (target.departamento || '') !== dept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    // No degradar a un SuperAdmin: el formulario muestra su rol enmascarado como
    // 'Jefe/a Departamento', así que si en BD ya es superadmin se conserva ese rol.
    const actual = await env.DB.prepare('SELECT rol FROM usuarios WHERE usuario=?').bind(u.usuario).first();
    const eraSuperAdmin = String(actual?.rol || '').trim().toLowerCase() === 'superadmin';
    const rolFinal = eraSuperAdmin ? actual.rol : u.rol.trim();
    await env.DB.prepare('UPDATE usuarios SET nombre=?, rol=?, email=? WHERE usuario=?')
      .bind(u.nombre.trim(), rolFinal, u.email||'', u.usuario).run();
    await auditLog(env.DB, user, 'userUpdate', `Usuario actualizado: ${u.usuario} (${rolFinal})`);
    return Response.json({ ok: true });
  }

  if (action === 'userDelete') {
    if (user && body.usuario === user.usuario)
      return Response.json({ ok: false, error: 'No puedes eliminar tu propia cuenta' });
    if (!superadmin) {
      const target = await env.DB.prepare('SELECT departamento FROM usuarios WHERE usuario=?').bind(body.usuario).first();
      if (!target || (target.departamento || '') !== dept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    await env.DB.prepare('DELETE FROM usuarios WHERE usuario=?').bind(body.usuario).run();
    await auditLog(env.DB, user, 'userDelete', `Usuario eliminado: ${body.usuario}`);
    return Response.json({ ok: true });
  }

  if (action === 'userResetPassword') {
    const newPassword = String(body.newPassword || body.password || '').trim();
    if (!newPassword || newPassword.length < 4)
      return Response.json({ ok: false, error: 'Contraseña demasiado corta' });
    if (!superadmin) {
      const target = await env.DB.prepare('SELECT departamento FROM usuarios WHERE usuario=?').bind(body.usuario).first();
      if (!target || (target.departamento || '') !== dept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    await env.DB.prepare('UPDATE usuarios SET password=? WHERE usuario=?')
      .bind(newPassword, body.usuario).run();
    await auditLog(env.DB, user, 'userResetPassword', `Contraseña reseteada: ${body.usuario}`);
    return Response.json({ ok: true });
  }

  if (action === 'userAssignModulos') {
    const nombre = (body.nombre || '').trim();
    const modulos = Array.isArray(body.modulos) ? body.modulos.map(String) : [];
    const legacyByCode = modulos.length > 0 && modulos.every(m => !m.includes('__'));
    if (!nombre) return Response.json({ ok: false, error: 'Nombre requerido' });
    await env.DB.prepare("ALTER TABLE ciclos ADD COLUMN responsable TEXT DEFAULT ''").run().catch(() => {});
    const rows = superadmin
      ? await env.DB.prepare('SELECT cicloId, modCod, responsable FROM ciclos').all()
      : await env.DB.prepare('SELECT cicloId, modCod, responsable FROM ciclos WHERE departamento=?').bind(dept).all();
    for (const row of rows.results) {
      const id = moduloId(row);
      const esMio = modulos.includes(id) || (legacyByCode && modulos.includes(String(row.modCod)));
      const eraMio = (row.responsable || '').toLowerCase() === nombre.toLowerCase();
      if (esMio && !eraMio) {
        await env.DB.prepare('UPDATE ciclos SET responsable=? WHERE cicloId=? AND modCod=? AND departamento=?').bind(nombre, row.cicloId, row.modCod, dept).run();
      } else if (!esMio && eraMio) {
        await env.DB.prepare("UPDATE ciclos SET responsable='' WHERE cicloId=? AND modCod=? AND departamento=?").bind(row.cicloId, row.modCod, dept).run();
      }
    }
    await auditLog(env.DB, user, 'userAssignModulos', `Módulos asignados a ${nombre}: ${modulos.join(',')}`);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'Acción desconocida' });
}
