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

// Diff completo entre lo que el usuario tiene hoy en `modulo_profesores` y
// `modulosNuevos` (array de moduloId, formato `cicloId__modCod`) — añade lo
// que falta, borra lo que sobra. Usada por `userAssignModulos` (admin,
// cualquier usuario destino) y `selectModulos` (autoservicio, siempre el
// propio actor) — nunca por `importModulosCSV`, que solo añade (ver esa
// acción más abajo).
async function reemplazarModulosUsuario(db, usuarioLogin, departamento, modulosNuevos) {
  await db.prepare('CREATE TABLE IF NOT EXISTS modulo_profesores (cicloId TEXT NOT NULL, modCod TEXT NOT NULL, departamento TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (cicloId, modCod, departamento, usuario))').run().catch(() => {});
  const actuales = await db.prepare('SELECT cicloId, modCod FROM modulo_profesores WHERE usuario=? AND departamento=?').bind(usuarioLogin, departamento).all();
  const idsActuales = new Set((actuales.results || []).map(r => moduloId(r)));
  const idsNuevos = new Set(modulosNuevos.filter(id => id.includes('__')));
  for (const id of idsNuevos) {
    if (idsActuales.has(id)) continue;
    const [cicloId, modCod] = id.split('__');
    await db.prepare('INSERT OR IGNORE INTO modulo_profesores (cicloId, modCod, departamento, usuario) VALUES (?,?,?,?)').bind(cicloId, modCod, departamento, usuarioLogin).run();
  }
  for (const id of idsActuales) {
    if (idsNuevos.has(id)) continue;
    const [cicloId, modCod] = id.split('__');
    await db.prepare('DELETE FROM modulo_profesores WHERE cicloId=? AND modCod=? AND departamento=? AND usuario=?').bind(cicloId, modCod, departamento, usuarioLogin).run();
  }
}

// Diff completo entre las aulas que el usuario tiene hoy en
// `aula_profesores` y `aulasNuevas` (array de aula.id) — añade lo que
// falta, borra lo que sobra. `aula.id` ya es única por sí sola, a
// diferencia de los módulos no hace falta departamento en la clave.
async function reemplazarAulasUsuario(db, usuarioLogin, aulasNuevas) {
  await db.prepare('CREATE TABLE IF NOT EXISTS aula_profesores (aula TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (aula, usuario))').run().catch(() => {});
  const actuales = await db.prepare('SELECT aula FROM aula_profesores WHERE usuario=?').bind(usuarioLogin).all();
  const idsActuales = new Set((actuales.results || []).map(r => r.aula));
  const idsNuevos = new Set(aulasNuevas);
  for (const id of idsNuevos) {
    if (idsActuales.has(id)) continue;
    await db.prepare('INSERT OR IGNORE INTO aula_profesores (aula, usuario) VALUES (?,?)').bind(id, usuarioLogin).run();
  }
  for (const id of idsActuales) {
    if (idsNuevos.has(id)) continue;
    await db.prepare('DELETE FROM aula_profesores WHERE aula=? AND usuario=?').bind(id, usuarioLogin).run();
  }
}

// ── Hashing de contraseñas (PBKDF2 vía Web Crypto) — duplicado en cada
// functions/api/*.js que toca contraseñas, ver _middleware.js/docs/SECURITY.md.
// Aquí solo se necesita hashear (alta y reseteo de contraseña de otro
// usuario), no verificar — el superadmin/jefe de departamento no necesita
// conocer la contraseña anterior para asignar una nueva.
function _pwBytesToHex(bytes){ return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function hashPassword(password){
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt:saltBytes, iterations:100000, hash:'SHA-256' }, keyMaterial, 256);
  return `pbkdf2$100000$${_pwBytesToHex(saltBytes)}$${_pwBytesToHex(new Uint8Array(bits))}`;
}

function normalizeText(s){
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
}

// Distancia de Levenshtein — misma tolerancia que el matching de intención
// de Volt (js/agente-widget.js), portada aquí para el import de módulos por
// nombre de asignatura sin exigir coincidencia exacta.
function levenshtein(a, b) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (!la) return lb;
  if (!lb) return la;
  let prev = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    const cur = [i];
    for (let j = 1; j <= lb; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[lb];
}

function maxEditDistance(len) {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  return 2;
}

// Empareja "nombreBuscado" contra la lista de módulos de un departamento.
// Devuelve el mejor match si es único e inequívoco; null si no hay match o
// hay ambigüedad (dos módulos igual de parecidos) — nunca adivina a ciegas.
function matchModuloPorNombre(nombreBuscado, modulos) {
  const n = normalizeText(nombreBuscado);
  if (!n) return { match: null, reason: 'nombre vacío' };

  const exact = modulos.filter(m => normalizeText(m.modNombre) === n);
  if (exact.length === 1) return { match: exact[0], reason: null };
  if (exact.length > 1) return { match: null, reason: 'ambiguo (varias asignaturas con el mismo nombre)' };

  const scored = modulos.map(m => {
    const mn = normalizeText(m.modNombre);
    const dist = levenshtein(n, mn);
    const contains = mn.includes(n) || n.includes(mn);
    return { m, dist, contains };
  }).filter(s => s.contains || s.dist <= maxEditDistance(Math.max(n.length, s.m.modNombre.length)));

  if (!scored.length) return { match: null, reason: 'sin coincidencia' };
  scored.sort((a, b) => a.dist - b.dist);
  if (scored.length > 1 && scored[0].dist === scored[1].dist) {
    return { match: null, reason: 'ambiguo (varias asignaturas igual de parecidas)' };
  }
  return { match: scored[0].m, reason: null };
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
    // Autocura las columnas de bloqueo por intentos de login si la migración
    // 0031 aún no se ha aplicado en remoto — mismo patrón que la tabla de
    // módulos más abajo.
    await env.DB.prepare('ALTER TABLE usuarios ADD COLUMN intentos_fallidos INTEGER DEFAULT 0').run().catch(() => {});
    await env.DB.prepare('ALTER TABLE usuarios ADD COLUMN bloqueado INTEGER DEFAULT 0').run().catch(() => {});
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS modulo_profesores (cicloId TEXT NOT NULL, modCod TEXT NOT NULL, departamento TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (cicloId, modCod, departamento, usuario))').run().catch(() => {});
    const [usuariosRows, ciclosRows, profesRows] = await Promise.all([
      superadmin
        ? env.DB.prepare('SELECT usuario, nombre, rol, email, departamento, bloqueado FROM usuarios ORDER BY usuario').all()
        : env.DB.prepare('SELECT usuario, nombre, rol, email, departamento, bloqueado FROM usuarios WHERE departamento=? ORDER BY usuario').bind(dept).all(),
      superadmin
        ? env.DB.prepare('SELECT cicloId, modCod, modNombre FROM ciclos WHERE modCod IS NOT NULL').all()
        : env.DB.prepare('SELECT cicloId, modCod, modNombre FROM ciclos WHERE modCod IS NOT NULL AND departamento=?').bind(dept).all(),
      superadmin
        ? env.DB.prepare('SELECT mp.cicloId, mp.modCod, mp.usuario, u.email FROM modulo_profesores mp JOIN usuarios u ON u.usuario = mp.usuario').all()
        : env.DB.prepare('SELECT mp.cicloId, mp.modCod, mp.usuario, u.email FROM modulo_profesores mp JOIN usuarios u ON u.usuario = mp.usuario WHERE mp.departamento=?').bind(dept).all(),
    ]);
    const ciclos = ciclosRows?.results || [];
    const profes = profesRows?.results || [];
    // Mapear usuario -> lista de moduloId, y moduloId -> lista de emails
    const modulosPorUsuario = {};
    const emailsPorModulo = {};
    for (const row of profes) {
      const mid = moduloId(row);
      if (!modulosPorUsuario[row.usuario]) modulosPorUsuario[row.usuario] = [];
      modulosPorUsuario[row.usuario].push(mid);
      if (!emailsPorModulo[mid]) emailsPorModulo[mid] = [];
      emailsPorModulo[mid].push(row.email || '');
    }
    const todosModulos = ciclos.map(r => ({
      id: moduloId(r), cicloId: r.cicloId, cod: String(r.modCod), nombre: r.modNombre || '',
      responsablesEmails: emailsPorModulo[moduloId(r)] || [],
    }));
    const usuarios = usuariosRows.results.map(u => {
      const rolNorm = String(u.rol || '').trim().toLowerCase();
      return {
        ...u,
        rol: rolNorm === 'superadmin' ? 'Jefe/a Departamento' : u.rol,
        modulos: modulosPorUsuario[u.usuario] || [],
      };
    });
    return Response.json({ ok: true, usuarios, todosModulos });
  }

  if (action === 'userAdd') {
    const u = body.usuario;
    const nuevoDept = superadmin ? (u.departamento || dept || '') : dept;
    await env.DB.prepare('INSERT INTO usuarios (usuario,password,nombre,rol,email,departamento) VALUES (?,?,?,?,?,?)')
      .bind(u.usuario.trim(), await hashPassword(u.password||'cambiar123'), u.nombre.trim(), u.rol.trim(), u.email||'', nuevoDept).run();
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
    if (superadmin && u.departamento != null) {
      await env.DB.prepare('UPDATE usuarios SET nombre=?, rol=?, email=?, departamento=? WHERE usuario=?')
        .bind(u.nombre.trim(), rolFinal, u.email||'', u.departamento||'', u.usuario).run();
    } else {
      await env.DB.prepare('UPDATE usuarios SET nombre=?, rol=?, email=? WHERE usuario=?')
        .bind(u.nombre.trim(), rolFinal, u.email||'', u.usuario).run();
    }
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
      .bind(await hashPassword(newPassword), body.usuario).run();
    await auditLog(env.DB, user, 'userResetPassword', `Contraseña reseteada: ${body.usuario}`);
    return Response.json({ ok: true });
  }

  if (action === 'userUnlock') {
    if (!superadmin) {
      const target = await env.DB.prepare('SELECT departamento FROM usuarios WHERE usuario=?').bind(body.usuario).first();
      if (!target || (target.departamento || '') !== dept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    await env.DB.prepare('UPDATE usuarios SET bloqueado=0, intentos_fallidos=0 WHERE usuario=?').bind(body.usuario).run();
    await auditLog(env.DB, user, 'userUnlock', `Cuenta desbloqueada: ${body.usuario}`);
    return Response.json({ ok: true });
  }

  if (action === 'userAssignModulos') {
    const usuarioDestino = String(body.usuario || '').trim();
    const modulos = Array.isArray(body.modulos) ? body.modulos.map(String) : [];
    if (!usuarioDestino) return Response.json({ ok: false, error: 'Usuario requerido' });
    const targetRow = await env.DB.prepare('SELECT departamento FROM usuarios WHERE usuario=?').bind(usuarioDestino).first();
    if (!targetRow) return Response.json({ ok: false, error: 'Usuario no encontrado' });
    if (!superadmin && targetRow.departamento !== dept) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    await reemplazarModulosUsuario(env.DB, usuarioDestino, targetRow.departamento || '', modulos);
    await auditLog(env.DB, user, 'userAssignModulos', `Módulos asignados a ${usuarioDestino}: ${modulos.join(',')}`);
    return Response.json({ ok: true });
  }

  if (action === 'selectModulos') {
    const modulos = Array.isArray(body.modulos) ? body.modulos.map(String) : [];
    if (!dept) return Response.json({ ok: false, error: 'Selecciona primero tu departamento' });
    await reemplazarModulosUsuario(env.DB, user.usuario, dept, modulos);
    await auditLog(env.DB, user, 'selectModulos', `Módulos propios actualizados: ${modulos.join(',')}`);
    return Response.json({ ok: true });
  }

  if (action === 'selectAulas') {
    // Autoservicio: en qué aulas da clase el usuario logueado (además de su
    // departamento) — mismo criterio que selectModulos, siempre el propio
    // actor, sin admin equivalente todavía. `aulas.id` ya es única por sí
    // sola (no hace falta departamento en la clave, a diferencia de los
    // módulos).
    const aulas = Array.isArray(body.aulas) ? body.aulas.map(String) : [];
    await reemplazarAulasUsuario(env.DB, user.usuario, aulas);
    await auditLog(env.DB, user, 'selectAulas', `Aulas propias actualizadas: ${aulas.join(',')}`);
    return Response.json({ ok: true });
  }

  if (action === 'importModulosCSV') {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return Response.json({ ok: false, error: 'CSV vacío' });
    await env.DB.prepare("ALTER TABLE ciclos ADD COLUMN responsable TEXT DEFAULT ''").run().catch(() => {});

    const usuariosCache = {};
    const modulosCache = {};
    const resultados = [];
    const porUsuario = {}; // usuario -> { nombre, departamento, modIds:Set }

    for (const row of rows) {
      const usuarioLogin = String(row.usuario || '').trim();
      const asignatura = String(row.asignatura || '').trim();
      if (!usuarioLogin || !asignatura) {
        resultados.push({ usuario: usuarioLogin, asignatura, ok: false, error: 'Fila incompleta' });
        continue;
      }

      if (!usuariosCache[usuarioLogin]) {
        usuariosCache[usuarioLogin] = await env.DB.prepare('SELECT usuario, nombre, departamento FROM usuarios WHERE usuario=?').bind(usuarioLogin).first();
      }
      const targetUser = usuariosCache[usuarioLogin];
      if (!targetUser) {
        resultados.push({ usuario: usuarioLogin, asignatura, ok: false, error: 'Usuario no encontrado' });
        continue;
      }
      if (!superadmin && targetUser.departamento !== dept) {
        resultados.push({ usuario: usuarioLogin, asignatura, ok: false, error: 'No autorizado (otro departamento)' });
        continue;
      }

      const targetDept = targetUser.departamento || '';
      if (!modulosCache[targetDept]) {
        const r = await env.DB.prepare('SELECT cicloId, modCod, modNombre FROM ciclos WHERE modCod IS NOT NULL AND departamento=?').bind(targetDept).all();
        modulosCache[targetDept] = r.results || [];
      }
      const { match, reason } = matchModuloPorNombre(asignatura, modulosCache[targetDept]);
      if (!match) {
        resultados.push({ usuario: usuarioLogin, asignatura, ok: false, error: reason || 'sin coincidencia' });
        continue;
      }

      if (!porUsuario[usuarioLogin]) porUsuario[usuarioLogin] = { nombre: targetUser.nombre, departamento: targetDept, modIds: new Set() };
      porUsuario[usuarioLogin].modIds.add(moduloId(match));
      resultados.push({ usuario: usuarioLogin, asignatura, ok: true, moduloEncontrado: match.modNombre });
    }

    // Aplicar asignaciones acumuladas por usuario, fusionando con lo que ya
    // tenían (solo inserta, nunca borra — a diferencia de
    // reemplazarModulosUsuario, que sí hace diff completo).
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS modulo_profesores (cicloId TEXT NOT NULL, modCod TEXT NOT NULL, departamento TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (cicloId, modCod, departamento, usuario))').run().catch(() => {});
    for (const [usuarioLogin, info] of Object.entries(porUsuario)) {
      for (const id of info.modIds) {
        const [cicloId, modCod] = id.split('__');
        await env.DB.prepare('INSERT OR IGNORE INTO modulo_profesores (cicloId, modCod, departamento, usuario) VALUES (?,?,?,?)')
          .bind(cicloId, modCod, info.departamento, usuarioLogin).run();
      }
    }

    const okCount = resultados.filter(r => r.ok).length;
    await auditLog(env.DB, user, 'importModulosCSV', `Importadas ${okCount}/${resultados.length} asignaciones de módulos por CSV`);
    return Response.json({ ok: true, resultados, okCount, total: resultados.length });
  }

  return Response.json({ ok: false, error: 'Acción desconocida' });
}
