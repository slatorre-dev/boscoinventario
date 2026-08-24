// Mantener sincronizado con el HEADERS_INV de list.js — ver CLAUDE.md, bug recurrente de columnas divergentes (mismo orden, mismas columnas, en ambos archivos)
const HEADERS_INV = ['id','ref','aula','mod','item','qty','min','cat','loc','est','util','proveedor','tags','fecha','fecha_adquisicion','precio','mant','mantFecha','mantNota','mantResp','mantEstado','mantCoste','mantSolicitante','mantSolicitanteEmail','foto','obs','code','serie','es_contenedor','parent_id','tipo_material','oculto'];
const FIELDS_UPD  = HEADERS_INV.filter(h => h !== 'id');

const GENERIC_DEPT = 'iesjuanbosco'; // "IES Juan Bosco": bolsa compartida, visible/editable por cualquier departamento

function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

function isProfesor(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'profesor';
}

// Deriva el departamento de un ítem a partir del ciclo/asignatura elegido:
// si el usuario selecciona el ciclo "IES Juan Bosco", el ítem se archiva ahí
// (bolsa compartida) en vez de en el departamento propio del usuario.
function resolveItemDept(item, ownDept, superadmin, genericDept){
  if (superadmin) return item.departamento || ownDept || '';
  const modCiclo = String(item.mod || '').split('__')[0];
  return modCiclo === genericDept ? genericDept : ownDept;
}

async function ensureContainerCols(db) {
  await db.prepare("ALTER TABLE inventario ADD COLUMN es_contenedor INTEGER DEFAULT 0").run().catch(() => {});
  await db.prepare("ALTER TABLE inventario ADD COLUMN parent_id INTEGER DEFAULT NULL").run().catch(() => {});
  await db.prepare("ALTER TABLE inventario ADD COLUMN tipo_material TEXT DEFAULT 'consumible'").run().catch(() => {});
  await db.prepare("ALTER TABLE inventario ADD COLUMN proveedor TEXT DEFAULT ''").run().catch(() => {});
  await db.prepare("ALTER TABLE inventario ADD COLUMN tags TEXT DEFAULT ''").run().catch(() => {});
  await db.prepare("ALTER TABLE inventario ADD COLUMN oculto INTEGER DEFAULT 0").run().catch(() => {});
  await db.prepare("UPDATE inventario SET tipo_material='inventariable' WHERE es_contenedor=1 AND (tipo_material IS NULL OR trim(tipo_material)='')").run().catch(() => {});
  await db.prepare("UPDATE inventario SET tipo_material='consumible' WHERE tipo_material IS NULL OR trim(tipo_material)=''").run().catch(() => {});
  await db.prepare("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT DEFAULT '')").run().catch(() => {});
  const migrated = await db.prepare("SELECT value FROM app_meta WHERE key='tipo_material_migrated'").first().catch(() => null);
  if (!migrated) {
    await db.prepare("UPDATE inventario SET tipo_material='inventariable' WHERE es_contenedor=1 OR lower(cat) LIKE '%herramient%' OR lower(cat) LIKE '%equipo%' OR lower(cat) LIKE '%instrument%'").run().catch(() => {});
    await db.prepare("INSERT OR REPLACE INTO app_meta (key,value) VALUES ('tipo_material_migrated', datetime('now'))").run().catch(() => {});
  }
}

async function ensureDeteccionLearningTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS ia_deteccion_ejemplos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT DEFAULT '',
    departamento TEXT DEFAULT '',
    tipo TEXT DEFAULT '',
    nombre TEXT DEFAULT '',
    categoria TEXT DEFAULT '',
    serie TEXT DEFAULT '',
    marca TEXT DEFAULT '',
    modelo TEXT DEFAULT '',
    texto_libre TEXT DEFAULT '',
    confianza REAL DEFAULT 0,
    imagen_base64 TEXT DEFAULT ''
  )`).run().catch(() => {});
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

async function getAuditActor(request, env, data) {
  if (data?.user?.usuario) return data.user;
  if (request.user?.usuario) return request.user;
  const usuario = new URL(request.url).searchParams.get('u') || '';
  if (!usuario) return {};
  const row = await env.DB.prepare('SELECT usuario, nombre, rol, departamento FROM usuarios WHERE usuario=?')
    .bind(usuario.trim()).first().catch(() => null);
  return row || { usuario: usuario.trim(), nombre: usuario.trim(), rol: '' };
}

function itemAuditSummary(prefix, item) {
  const parts = [
    item.ref ? `ref ${item.ref}` : '',
    item.aula ? `aula ${item.aula}` : '',
    item.cat ? `categoria ${item.cat}` : '',
    item.qty != null ? `stock ${item.qty}` : '',
    item.proveedor ? `proveedor ${item.proveedor}` : ''
  ].filter(Boolean);
  return `${prefix}: ${item.item || ''}${parts.length ? ' - ' + parts.join(' - ') : ''}`;
}

const DIFF_FIELDS = ['item', 'aula', 'cat', 'mod', 'qty', 'min', 'est', 'loc'];

function computeItemDiff(oldRow, newItem) {
  if (!oldRow) return [];
  return DIFF_FIELDS
    .filter(f => String(oldRow[f] ?? '') !== String(newItem[f] ?? ''))
    .map(f => ({ campo: f, antes: oldRow[f] ?? '', despues: newItem[f] ?? '' }));
}

const MANT_OPEN_STATES = ['Pendiente', 'En reparación', 'Enviado a reparar externo'];
const MANT_CLOSE_STATES = ['Reparado', 'Resuelto'];

function isValidMantEstado(estado) {
  return !estado || MANT_OPEN_STATES.includes(estado) || MANT_CLOSE_STATES.includes(estado);
}

async function syncMantenimiento(db, itemId, oldRow, item, user) {
  const oldEstado = oldRow?.mantEstado || '';
  const newEstado = item.mantEstado || '';
  const wasOpen = MANT_OPEN_STATES.includes(oldEstado);
  const isOpenNow = MANT_OPEN_STATES.includes(newEstado);
  const isClosingNow = MANT_CLOSE_STATES.includes(newEstado);
  const hoy = new Date().toISOString().slice(0, 10);

  if (!oldEstado && !newEstado) return;

  if (isClosingNow) {
    const openRow = await db.prepare(
      `SELECT id FROM mantenimientos WHERE item_id=? AND estado IN (${MANT_OPEN_STATES.map(() => '?').join(',')}) ORDER BY id DESC LIMIT 1`
    ).bind(itemId, ...MANT_OPEN_STATES).first();
    const fechaCierre = item.mantFechaCierre || hoy;
    const notaCierre = item.mantNotaCierre || '';
    if (openRow) {
      await db.prepare(
        `UPDATE mantenimientos SET estado=?, responsable=?, coste=?, fecha_cierre=?, nota_cierre=? WHERE id=?`
      ).bind(newEstado, item.mantResp || '', item.mantCoste ?? null, fechaCierre, notaCierre, openRow.id).run();
    } else {
      await db.prepare(
        `INSERT INTO mantenimientos (item_id, estado, fecha_apertura, nota_apertura, responsable, coste, fecha_cierre, nota_cierre, creado_por, creado_en)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).bind(itemId, newEstado, item.mantFecha || hoy, item.mantNota || '', item.mantResp || '', item.mantCoste ?? null, fechaCierre, notaCierre, user?.usuario || '', new Date().toISOString()).run();
    }
    await db.prepare(
      `UPDATE inventario SET mant=0, mantFecha='', mantEstado='', mantResp='', mantNota='', mantCoste=NULL WHERE id=?`
    ).bind(itemId).run();
    Object.assign(item, { mant: 0, mantFecha: '', mantEstado: '', mantResp: '', mantNota: '', mantCoste: null });
    return;
  }

  if (isOpenNow && !wasOpen) {
    await db.prepare(
      `INSERT INTO mantenimientos (item_id, estado, fecha_apertura, nota_apertura, responsable, coste, creado_por, creado_en)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(itemId, newEstado, item.mantFecha || hoy, item.mantNota || '', item.mantResp || '', item.mantCoste ?? null, user?.usuario || '', new Date().toISOString()).run();
  } else if (isOpenNow && wasOpen) {
    const openRow = await db.prepare(
      `SELECT id FROM mantenimientos WHERE item_id=? AND estado IN (${MANT_OPEN_STATES.map(() => '?').join(',')}) ORDER BY id DESC LIMIT 1`
    ).bind(itemId, ...MANT_OPEN_STATES).first();
    if (openRow) {
      await db.prepare(
        `UPDATE mantenimientos SET estado=?, nota_apertura=?, responsable=?, coste=? WHERE id=?`
      ).bind(newEstado, item.mantNota || '', item.mantResp || '', item.mantCoste ?? null, openRow.id).run();
    }
  }

  if (isOpenNow) {
    await db.prepare(
      `UPDATE inventario SET mant=1, mantFecha=?, mantEstado=?, mantResp=?, mantNota=?, mantCoste=? WHERE id=?`
    ).bind(item.mantFecha || hoy, newEstado, item.mantResp || '', item.mantNota || '', item.mantCoste ?? null, itemId).run();
    Object.assign(item, { mant: 1, mantFecha: item.mantFecha || hoy, mantEstado: newEstado, mantResp: item.mantResp || '', mantNota: item.mantNota || '', mantCoste: item.mantCoste ?? null });
  }
}

async function itemDept(db, id) {
  const row = await db.prepare('SELECT departamento FROM inventario WHERE id=?').bind(id).first();
  return row?.departamento || '';
}

export async function onRequestPost({ request, env, data }) {
  const body = await request.json();
  const { action, item, id } = body;
  const user = await getAuditActor(request, env, data);
  const superadmin = isSuperAdmin(user);
  const dept = user.departamento || '';
  const genericDept = isProfesor(user) ? '__none__' : GENERIC_DEPT;

  await ensureContainerCols(env.DB);
  await ensureDeteccionLearningTable(env.DB);
  await env.DB.prepare("ALTER TABLE inventario ADD COLUMN departamento TEXT DEFAULT ''").run().catch(() => {});

  if (action === 'registrarFeedbackDeteccion') {
    const now = new Date().toISOString().replace('T',' ').slice(0,19);
    const tipo = String(body.tipo || '').slice(0, 40);
    const nombre = String(body.nombre || '').slice(0, 160);
    const categoria = String(body.categoria || '').slice(0, 120);
    const serie = String(body.serie || '').slice(0, 120);
    const marca = String(body.marca || '').slice(0, 120);
    const modelo = String(body.modelo || '').slice(0, 120);
    const textoLibre = String(body.textoLibre || '').slice(0, 240);
    const confianza = Math.max(0, Math.min(1, Number(body.confianza || 0) || 0));
    const imagen = String(body.imagen || '');
    // Limitar tamaño para no inflar D1; suficiente para few-shot visual futuro.
    const imagenCortada = imagen.length > 260000 ? imagen.slice(0, 260000) : imagen;

    await env.DB.prepare(
      `INSERT INTO ia_deteccion_ejemplos
        (fecha, departamento, tipo, nombre, categoria, serie, marca, modelo, texto_libre, confianza, imagen_base64)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      now,
      dept || '',
      tipo,
      nombre,
      categoria,
      serie,
      marca,
      modelo,
      textoLibre,
      confianza,
      imagenCortada
    ).run().catch(() => {});

    // Mantener últimos 300 ejemplos por departamento para controlar tamaño.
    await env.DB.prepare(
      `DELETE FROM ia_deteccion_ejemplos
       WHERE id IN (
         SELECT id FROM ia_deteccion_ejemplos
         WHERE departamento=?
         ORDER BY id DESC
         LIMIT -1 OFFSET 300
       )`
    ).bind(dept || '').run().catch(() => {});

    return Response.json({ ok: true });
  }

  if (action === 'add') {
    if (!isValidMantEstado(item.mantEstado)) {
      return Response.json({ ok: false, error: 'Estado de mantenimiento no válido' });
    }
    const maxRow = await env.DB.prepare('SELECT MAX(id) as m FROM inventario').first();
    const newId = (maxRow.m || 0) + 1;
    item.id = newId;
    if (!item.code) item.code = 'IB-' + String(newId).padStart(5,'0');
    item.es_contenedor = item.es_contenedor ? 1 : 0;
    item.parent_id = item.parent_id || null;
    item.tipo_material = item.es_contenedor ? 'inventariable' : (item.tipo_material || 'consumible');
    item.departamento = resolveItemDept(item, dept, superadmin, genericDept);
    const vals = HEADERS_INV.map(h => item[h] ?? null);
    await env.DB.prepare(`INSERT INTO inventario (${HEADERS_INV.join(',')},departamento) VALUES (${HEADERS_INV.map(()=>'?').join(',')},?)`)
      .bind(...vals, item.departamento).run();
    await syncMantenimiento(env.DB, newId, null, item, user);
    await auditLog(env.DB, user, 'add', newId, itemAuditSummary('Anadido', item));
    return Response.json({ ok: true, item });
  }

  if (action === 'update') {
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, item.id);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    if (!isValidMantEstado(item.mantEstado)) {
      return Response.json({ ok: false, error: 'Estado de mantenimiento no válido' });
    }
    const oldRow = await env.DB.prepare(
      `SELECT ${DIFF_FIELDS.join(',')}, mant, mantEstado, mantFecha, mantResp, mantNota, mantCoste FROM inventario WHERE id=?`
    ).bind(item.id).first();
    item.es_contenedor = item.es_contenedor ? 1 : 0;
    item.parent_id = item.parent_id || null;
    item.tipo_material = item.es_contenedor ? 'inventariable' : (item.tipo_material || 'consumible');
    const sets = FIELDS_UPD.map(h => `${h}=?`).join(',');
    const vals = [...FIELDS_UPD.map(h => item[h] ?? null), item.id];
    await env.DB.prepare(`UPDATE inventario SET ${sets} WHERE id=?`).bind(...vals).run();
    const diffs = computeItemDiff(oldRow, item);
    const resumenUpdate = diffs.length ? JSON.stringify(diffs) : itemAuditSummary('Actualizado', item);
    await auditLog(env.DB, user, 'update', item.id, resumenUpdate);
    await syncMantenimiento(env.DB, item.id, oldRow, item, user);
    return Response.json({ ok: true, item });
  }

  if (action === 'delete') {
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, id);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    const old = await env.DB.prepare('SELECT item, ref FROM inventario WHERE id=?').bind(id).first();
    // Desasociar hijos antes de borrar la caja
    await env.DB.prepare('UPDATE inventario SET parent_id=NULL WHERE parent_id=?').bind(id).run();
    await env.DB.prepare('DELETE FROM inventario WHERE id=?').bind(id).run();
    await auditLog(env.DB, user, 'delete', id, `Eliminado: ${old?.item} (${old?.ref})`);
    return Response.json({ ok: true });
  }

  if (action === 'mantenimientosGet') {
    const itemId = body.itemId;
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, itemId);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    const rows = await env.DB.prepare(
      'SELECT id, estado, fecha_apertura, nota_apertura, responsable, coste, fecha_cierre, nota_cierre FROM mantenimientos WHERE item_id=? ORDER BY id DESC'
    ).bind(itemId).all();
    return Response.json({ ok: true, mantenimientos: rows.results || [] });
  }

  if (action === 'fotosGet') {
    const itemId = body.itemId;
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, itemId);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    const rows = await env.DB.prepare('SELECT id, foto, orden FROM item_fotos WHERE item_id=? ORDER BY orden').bind(itemId).all();
    return Response.json({ ok: true, fotos: rows.results || [] });
  }

  if (action === 'fotosSync') {
    const itemId = body.itemId;
    const fotos = Array.isArray(body.fotos) ? body.fotos : [];
    if (fotos.length > 3) {
      return Response.json({ ok: false, error: 'Máximo 3 fotos por ítem' });
    }
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, itemId);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    await env.DB.prepare('DELETE FROM item_fotos WHERE item_id=?').bind(itemId).run();
    if (fotos.length) {
      const stmt = env.DB.prepare('INSERT INTO item_fotos (item_id, foto, orden) VALUES (?,?,?)');
      await env.DB.batch(fotos.map((f, i) => stmt.bind(itemId, f.foto, f.orden || (i + 1))));
    }
    const principal = fotos.find(f => (f.orden || 1) === 1);
    const fotoPrincipal = principal ? principal.foto : '';
    await env.DB.prepare('UPDATE inventario SET foto=? WHERE id=?').bind(fotoPrincipal, itemId).run();
    await auditLog(env.DB, user, 'fotosSync', itemId, `Fotos actualizadas (${fotos.length})`);
    return Response.json({ ok: true, fotoPrincipal });
  }

  if (action === 'bulkImport') {
    const newItems = body.items || [];
    if (!newItems.length) return Response.json({ ok: false, error: 'Sin items' });
    const maxRow = await env.DB.prepare('SELECT MAX(id) as m FROM inventario').first();
    let nextId = (maxRow.m || 0) + 1;
    const stmt = env.DB.prepare(`INSERT OR REPLACE INTO inventario (${HEADERS_INV.join(',')},departamento) VALUES (${HEADERS_INV.map(()=>'?').join(',')},?)`);
    const batch = newItems.map(it => {
      if (!it.id) it.id = nextId++;
      if (!it.code) it.code = 'IB-' + String(it.id).padStart(5,'0');
      it.es_contenedor = it.es_contenedor ? 1 : 0;
      it.parent_id = it.parent_id || null;
      it.tipo_material = it.es_contenedor ? 'inventariable' : (it.tipo_material || 'consumible');
      const itDept = resolveItemDept(it, dept, superadmin, genericDept);
      return stmt.bind(...HEADERS_INV.map(h => it[h] ?? null), itDept);
    });
    await env.DB.batch(batch);
    await auditLog(env.DB, user, 'bulkImport', '', `Importados ${newItems.length} items`);
    return Response.json({ ok: true, imported: newItems.length, items: newItems });
  }

  if (action === 'toggleOculto') {
    if (!superadmin) return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const val = body.oculto ? 1 : 0;
    await env.DB.prepare('UPDATE inventario SET oculto=? WHERE id=?').bind(val, id).run();
    const row = await env.DB.prepare('SELECT item, ref FROM inventario WHERE id=?').bind(id).first();
    await auditLog(env.DB, user, 'toggleOculto', id, `${val ? 'Ocultado' : 'Mostrado'}: ${row?.item} (${row?.ref})`);
    return Response.json({ ok: true, oculto: val });
  }

  if (action === 'restoreBackup') {
    if (!superadmin) return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const sections = body.sections || {};
    const backup = body.backup || {};
    // Los backups del proyecto original (inventarioelecfp, un solo departamento)
    // no traen columna "departamento" en sus filas — esta base es multi-departamento,
    // así que cualquier fila sin departamento propio se asigna a electricidadelectronica.
    // Solo se borran los departamentos presentes en las filas a importar (nunca la
    // tabla entera), para no arrastrar datos de los otros departamentos ya en producción.
    const FALLBACK_DEPT = 'electricidadelectronica';
    const restored = {};

    function deptsIn(rows){
      const set = new Set(rows.map(r => r.departamento || FALLBACK_DEPT));
      return [...set];
    }
    async function deleteDepts(table, depts){
      if (!depts.length) return;
      const placeholders = depts.map(() => '?').join(',');
      await env.DB.prepare(`DELETE FROM ${table} WHERE departamento IN (${placeholders})`).bind(...depts).run();
    }

    // "aulas.id" es TEXT PRIMARY KEY global — si se restauran aulas, se
    // prefijan con el departamento para no chocar con aulas globales o de
    // otros departamentos, y las filas de inventario que las referencian
    // (columna "aula") se reescriben con el mismo mapeo antes de insertar.
    const aulaIdMap = {};
    if (sections.aulas) {
      const rows = Array.isArray(backup.aulas) ? backup.aulas : [];
      await deleteDepts('aulas', deptsIn(rows));
      if (rows.length) {
        // Si la fila del backup no trae departamento propio, puede ser una
        // aula global (departamento='') ya existente en esta base (ej. tras
        // el seed 0008/0016) — reusarla tal cual en vez de duplicarla con
        // prefijo FALLBACK_DEPT. Solo se prefija cuando la fila SÍ pertenece
        // a un departamento real, o cuando no existe como aula global aquí.
        const existingGlobal = await env.DB.prepare("SELECT id FROM aulas WHERE departamento=''").all();
        const globalIds = new Set((existingGlobal.results || []).map(r => r.id));
        const stmt = env.DB.prepare('INSERT OR REPLACE INTO aulas (id,name,icon,desc,th,orden,departamento) VALUES (?,?,?,?,?,?,?)');
        const toInsert = [];
        for (const r of rows) {
          const oldId = String(r.id || '');
          if (!r.departamento && globalIds.has(oldId)) {
            aulaIdMap[oldId] = oldId;
            continue;
          }
          const dept = r.departamento || FALLBACK_DEPT;
          const safeId = oldId.startsWith(dept + '-') ? oldId : `${dept}-${oldId}`;
          aulaIdMap[oldId] = safeId;
          toInsert.push(stmt.bind(safeId, r.name, r.icon, r.desc, r.th, r.orden || 0, dept));
        }
        if (toInsert.length) await env.DB.batch(toInsert);
      }
      restored.aulas = rows.length;
    }

    if (sections.inventario) {
      const rows = Array.isArray(backup.inventario) ? backup.inventario : [];
      await deleteDepts('inventario', deptsIn(rows));
      if (rows.length) {
        // El "id" del backup viejo puede chocar con IDs ya usados por otros
        // departamentos (PK global) — se reasignan IDs nuevos consecutivos,
        // igual que hace "add"/"bulkImport".
        const maxRow = await env.DB.prepare('SELECT MAX(id) as m FROM inventario').first();
        let nextId = (maxRow.m || 0) + 1;
        const stmt = env.DB.prepare(`INSERT INTO inventario (${HEADERS_INV.join(',')},departamento) VALUES (${HEADERS_INV.map(()=>'?').join(',')},?)`);
        await env.DB.batch(rows.map(r => {
          const vals = HEADERS_INV.map(h => {
            if (h === 'id') return nextId++;
            if (h === 'aula' && aulaIdMap[r.aula]) return aulaIdMap[r.aula];
            return r[h] ?? null;
          });
          return stmt.bind(...vals, r.departamento || FALLBACK_DEPT);
        }));
      }
      restored.inventario = rows.length;
    }

    if (sections.categorias) {
      const rows = Array.isArray(backup.categorias) ? backup.categorias : (backup.cats || []);
      await deleteDepts('categorias', deptsIn(rows));
      if (rows.length) {
        const stmt = env.DB.prepare('INSERT INTO categorias (name,c,bg,i,orden,departamento) VALUES (?,?,?,?,?,?)');
        await env.DB.batch(rows.map(r => stmt.bind(r.name, r.c, r.bg, r.i, r.orden || 0, r.departamento || FALLBACK_DEPT)));
      }
      restored.categorias = rows.length;
    }

    if (sections.ciclos) {
      const rows = Array.isArray(backup.ciclos) ? backup.ciclos : [];
      await env.DB.prepare("ALTER TABLE ciclos ADD COLUMN responsable TEXT DEFAULT ''").run().catch(() => {});
      await deleteDepts('ciclos', deptsIn(rows));
      if (rows.length) {
        const stmt = env.DB.prepare('INSERT INTO ciclos (cicloId,cicloNombre,nivel,icon,th,desc,modCod,modNombre,modHoras,cicloOrden,modOrden,responsable,departamento) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
        await env.DB.batch(rows.map(r => stmt.bind(r.cicloId, r.cicloNombre, r.nivel, r.icon, r.th, r.desc, r.modCod, r.modNombre, r.modHoras || 0, r.cicloOrden || 0, r.modOrden || 0, r.responsable || '', r.departamento || FALLBACK_DEPT)));
      }
      restored.ciclos = rows.length;
    }

    if (sections.profesores) {
      const rows = Array.isArray(backup.profesores) ? backup.profesores : [];
      await deleteDepts('profesores', deptsIn(rows));
      if (rows.length) {
        // "id" es INTEGER PRIMARY KEY global — se reasignan IDs nuevos
        // consecutivos igual que en inventario, para no chocar con
        // profesores ya existentes de otros departamentos.
        const maxRow = await env.DB.prepare('SELECT MAX(id) as m FROM profesores').first();
        let nextId = (maxRow.m || 0) + 1;
        const stmt = env.DB.prepare('INSERT INTO profesores (id,nombre,departamento,email) VALUES (?,?,?,?)');
        await env.DB.batch(rows.map(r => stmt.bind(nextId++, r.nombre, r.departamento || FALLBACK_DEPT, r.email || '')));
      }
      restored.profesores = rows.length;
    }

    await auditLog(env.DB, user, 'restoreBackup', '', `Restaurado backup: ${Object.entries(restored).map(([k,v]) => `${k} (${v})`).join(', ')}`);
    return Response.json({ ok: true, restored });
  }

  if (action === 'buscarPorSerie') {
    const imagen = body.imagen;
    if (!imagen) return Response.json({ ok: false, error: 'Falta la imagen' });
    if (!env.AI) return Response.json({ ok: false, error: 'Workers AI no configurado en Cloudflare' });

    const catDeptFilter = superadmin ? '' : ' WHERE departamento=?';
    const catDeptBind = superadmin ? [] : [dept];
    const catRows = await env.DB.prepare(`SELECT DISTINCT name FROM categorias${catDeptFilter} ORDER BY orden`)
      .bind(...catDeptBind).all();
    const categoriasDept = (catRows.results || []).map(r => r.name).filter(Boolean);

    const categoriasTexto = categoriasDept.length
      ? categoriasDept.map(c => `"${c}"`).join(', ')
      : '(ninguna categoría disponible)';

    const ejemplosDeptFilter = superadmin ? '' : ' WHERE departamento=?';
    const ejemplosDeptBind = superadmin ? [] : [dept];
    const ejemplosRows = await env.DB.prepare(
      `SELECT tipo, nombre, categoria, serie, marca, modelo, texto_libre, confianza
       FROM ia_deteccion_ejemplos${ejemplosDeptFilter}
       ORDER BY id DESC LIMIT 4`
    ).bind(...ejemplosDeptBind).all().catch(() => ({ results: [] }));
    const ejemplosTexto = formatLearningExamples(ejemplosRows?.results || []);

    async function runVisionQuestion(question, maxTokens = 420) {
      return env.AI.run('@cf/moondream/moondream3.1-9B-A2B', {
        task: 'query',
        image: `data:image/jpeg;base64,${imagen}`,
        question,
        reasoning: true,
        stream: false,
        max_tokens: maxTokens
      });
    }

    let serieLeida = '', marca = '', modelo = '', textoLibre = '', descripcionVisual = '', categoriaSugerida = '';
    let confianzaSerie = 0;
    let alternativasSerie = [];
    let motivoEncuadre = '';

    try {
      const aiData = await runVisionQuestion(
        `Analiza esta foto de un equipo o material de inventario. Devuelve SOLO JSON con estas claves exactas: {"serie": string|null, "marca": string|null, "modelo": string|null, "textoLibre": string|null, "descripcionVisual": string|null, "categoriaSugerida": string|null, "confianzaSerie": number, "alternativasSerie": string[], "encuadreOk": boolean, "motivoEncuadre": string|null}. ` +
        `Primero intenta leer número de serie (S/N, Serial Number o Service Tag). Si no hay serie, extrae texto visible útil en "textoLibre". Si no hay texto legible, describe el objeto en "descripcionVisual". ` +
        `"categoriaSugerida" debe ser EXACTAMENTE uno de: ${categoriasTexto} o null. ` +
        `"confianzaSerie" va de 0 a 1 y representa tu confianza sobre la serie. ` +
        `"alternativasSerie" debe incluir hasta 3 variantes plausibles si hay ambigüedad OCR (ej. O/0, I/1, S/5). ` +
        `"encuadreOk" es false si la foto dificulta identificar el objeto (demasiado lejos, varios objetos superpuestos, muy borrosa u oscura); en ese caso "motivoEncuadre" da una instrucción corta y accionable para repetir la foto (ej. "Acércate más al objeto", "Encuadra solo una pieza, hay varias juntas"). Si el encuadre es correcto, "encuadreOk": true y "motivoEncuadre": null. ` +
        `${ejemplosTexto}` +
        `No añadas texto fuera del JSON y no inventes datos.`
      );

      const parsed = extractJsonObject(aiData?.result?.answer || '');
      serieLeida = safeText(parsed?.serie);
      marca = safeText(parsed?.marca);
      modelo = safeText(parsed?.modelo);
      textoLibre = safeText(parsed?.textoLibre);
      descripcionVisual = safeText(parsed?.descripcionVisual);
      categoriaSugerida = safeText(parsed?.categoriaSugerida);
      confianzaSerie = Number(parsed?.confianzaSerie || 0) || 0;
      alternativasSerie = Array.isArray(parsed?.alternativasSerie)
        ? parsed.alternativasSerie.map(safeText).filter(Boolean).slice(0, 3)
        : [];
      if (parsed?.encuadreOk === false) motivoEncuadre = safeText(parsed?.motivoEncuadre);

      // Segunda pasada solo OCR si la primera no encontró señal útil.
      if (!serieLeida && !textoLibre && !descripcionVisual) {
        const aiData2 = await runVisionQuestion(
          `Lee SOLO el texto de la etiqueta o carcasa del equipo. Devuelve SOLO JSON: {"serie": string|null, "textoLibre": string|null, "marca": string|null, "modelo": string|null, "confianzaSerie": number, "alternativasSerie": string[]}. ` +
          `Si no puedes leer nada con certeza, devuelve null en serie y textoLibre. No añadas texto fuera del JSON.`,
          320
        );
        const parsed2 = extractJsonObject(aiData2?.result?.answer || '');
        serieLeida = serieLeida || safeText(parsed2?.serie);
        textoLibre = textoLibre || safeText(parsed2?.textoLibre);
        marca = marca || safeText(parsed2?.marca);
        modelo = modelo || safeText(parsed2?.modelo);
        confianzaSerie = Math.max(confianzaSerie, Number(parsed2?.confianzaSerie || 0) || 0);
        const alt2 = Array.isArray(parsed2?.alternativasSerie)
          ? parsed2.alternativasSerie.map(safeText).filter(Boolean).slice(0, 3)
          : [];
        alternativasSerie = [...new Set([...alternativasSerie, ...alt2])].slice(0, 4);
      }

      // Tercera pasada dedicada solo a identificar el objeto (sin repartir
      // atención con serie/OCR) cuando ninguna de las dos anteriores sacó nada.
      if (!serieLeida && !textoLibre && !descripcionVisual && !categoriaSugerida) {
        const aiData3 = await runVisionQuestion(
          `No hay texto legible en la foto. Identifica qué objeto de taller es: nombre genérico y concreto (ej. "multímetro digital", "destornillador de estrella", "router WiFi") y su categoría. Devuelve SOLO JSON: {"descripcionVisual": string|null, "categoriaSugerida": string|null, "confianzaVisual": number}. ` +
          `"categoriaSugerida" debe ser EXACTAMENTE uno de: ${categoriasTexto} o null. Si no puedes identificarlo con razonable certeza, devuelve null en ambos campos y confianzaVisual en 0. No añadas texto fuera del JSON.`,
          280
        );
        const parsed3 = extractJsonObject(aiData3?.result?.answer || '');
        descripcionVisual = safeText(parsed3?.descripcionVisual);
        categoriaSugerida = categoriaSugerida || safeText(parsed3?.categoriaSugerida);
        confianzaSerie = Math.max(confianzaSerie, Number(parsed3?.confianzaVisual || 0) || 0);
      }
    } catch (e) {
      return Response.json({ ok: false, error: 'Error del servicio de IA' });
    }

    // categoriaSugerida solo es válida si coincide exactamente con una categoría real del departamento
    if (categoriaSugerida && !categoriasDept.includes(categoriaSugerida)) categoriaSugerida = '';

    const deptFilter = superadmin
      ? ''
      : ` AND (oculto IS NULL OR oculto != 1) AND (departamento=? OR departamento='${genericDept}')`;
    const deptBind = superadmin ? [] : [dept];

    if (serieLeida) {
      const serieRaw = serieLeida;
      const variantes = [...new Set([
        serieRaw,
        ...alternativasSerie,
        ...expandOcrCandidates(serieRaw)
      ])].filter(Boolean).slice(0, 12);

      const fuzzyMap = new Map();
      for (const candidata of variantes) {
        const r = await buscarSerieEnD1(env, candidata, dept, superadmin, genericDept);
        if (r.match === 'exacto') return Response.json({ ok: true, confianzaSerie, ...r });
        if (r.match === 'fuzzy') {
          for (const c of r.candidatos || []) {
            const k = String(c.id);
            if (!fuzzyMap.has(k)) fuzzyMap.set(k, c);
          }
        }
      }
      if (fuzzyMap.size) {
        return Response.json({ ok: true, match: 'fuzzy', confianzaSerie, candidatos: [...fuzzyMap.values()].slice(0, 5) });
      }
      return Response.json({ ok: true, match: 'ninguno', confianzaSerie, serieLeida: serieRaw, marca, modelo, motivoEncuadre });
    }

    if (textoLibre) {
      return Response.json({ ok: true, match: 'texto', textoLibre, confianzaSerie });
    }

    if (descripcionVisual || categoriaSugerida) {
      const nombreSugerido = descripcionVisual || categoriaSugerida;
      const palabras = String(descripcionVisual || '')
        .toLowerCase()
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length >= 4 && !['para','con','como','esta','este','equipo','objeto','material'].includes(w))
        .slice(0, 4);
      const palabraClave = palabras[0] || descripcionVisual;
      const catCond = categoriaSugerida ? ' AND cat=?' : '';
      const catBind = categoriaSugerida ? [categoriaSugerida] : [];
      const visualRes = await env.DB.prepare(
        `SELECT id, item, ref, aula, cat FROM inventario WHERE (item LIKE ? OR ref LIKE ?)${catCond}${deptFilter} LIMIT 30`
      ).bind(`%${palabraClave}%`, `%${palabraClave}%`, ...catBind, ...deptBind).all();

      const ranked = (visualRes.results || [])
        .map(r => {
          const txt = `${String(r.item || '')} ${String(r.ref || '')}`.toLowerCase();
          const scoreKw = palabras.reduce((acc, w) => acc + (txt.includes(w) ? 1 : 0), 0);
          const scoreCat = categoriaSugerida && r.cat === categoriaSugerida ? 1 : 0;
          return { ...r, _score: (scoreKw * 2) + scoreCat };
        })
        .sort((a, b) => b._score - a._score)
        .slice(0, 10)
        .map(({ _score, ...r }) => r);

      return Response.json({
        ok: true,
        match: 'visual',
        candidatos: ranked,
        nombreSugerido,
        categoriaSugerida,
        confianzaSerie,
        motivoEncuadre
      });
    }

    return Response.json({ ok: true, match: 'sin_lectura', confianzaSerie, motivoEncuadre });
  }

  if (action === 'buscarSeriePorCodigo') {
    const codigo = String(body.codigo || '').trim();
    const formato = String(body.formato || '').trim();
    if (!codigo) return Response.json({ ok: false, error: 'Falta el código' });
    const r = await buscarSerieEnD1(env, codigo, dept, superadmin, genericDept);
    if (
      r.match === 'ninguno' &&
      ['ean_13', 'ean_8', 'upc_a', 'upc_e'].includes(formato) &&
      /^\d{8,14}$/.test(codigo)
    ) {
      const producto = await lookupProductoUpcItemDb(codigo);
      if (producto) return Response.json({ ok: true, ...r, producto });
    }
    return Response.json({ ok: true, ...r });
  }

  if (action === 'detectarMultiples') {
    const imagen = body.imagen;
    if (!imagen) return Response.json({ ok: false, error: 'Falta la imagen' });
    if (!env.AI) return Response.json({ ok: false, error: 'Workers AI no configurado en Cloudflare' });

    const catDeptFilter = superadmin ? '' : ' WHERE departamento=?';
    const catDeptBind = superadmin ? [] : [dept];
    const catRows = await env.DB.prepare(`SELECT DISTINCT name FROM categorias${catDeptFilter} ORDER BY orden`)
      .bind(...catDeptBind).all();
    const categoriasDept = (catRows.results || []).map(r => r.name).filter(Boolean);

    let aiData;
    const categoriasTexto = categoriasDept.length
      ? categoriasDept.map(c => `"${c}"`).join(', ')
      : '(ninguna categoría disponible)';

    async function runMultiQuestion(question, maxTokens = 720) {
      return env.AI.run('@cf/moondream/moondream3.1-9B-A2B', {
        task: 'query',
        image: `data:image/jpeg;base64,${imagen}`,
        question,
        reasoning: true,
        stream: false,
        max_tokens: maxTokens
      });
    }

    try {
      aiData = await runMultiQuestion(
        `Analiza esta foto de una mesa o superficie con varios equipos/materiales de taller. Devuelve SOLO un array JSON. ` +
        `Cada elemento debe tener: {"nombre": string, "cantidad": number, "categoriaSugerida": string|null, "confianza": number}. ` +
        `Agrupa objetos iguales en una sola fila con su cantidad. ` +
        `"categoriaSugerida" debe ser EXACTAMENTE una de: ${categoriasTexto}, o null. ` +
        `"confianza" va de 0 a 1. Si no detectas nada fiable, devuelve []. No escribas texto fuera del array JSON.`
      );
    } catch (e) {
      return Response.json({ ok: false, error: 'Error del servicio de IA' });
    }

    let objetos = [];
    const raw = aiData?.result?.answer || '';
    try {
      const parsed = extractJsonArray(raw);
      objetos = (Array.isArray(parsed) ? parsed : []).map(o => {
        const nombre = String(o?.nombre || '').trim();
        const cantidad = Math.max(1, parseInt(o?.cantidad, 10) || 1);
        let categoriaSugerida = String(o?.categoriaSugerida || '').trim();
        const confianza = Math.max(0, Math.min(1, Number(o?.confianza || 0) || 0));
        if (categoriaSugerida && !categoriasDept.includes(categoriaSugerida)) categoriaSugerida = '';
        return { nombre, cantidad, categoriaSugerida, confianza };
      }).filter(o => o.nombre);
    } catch (e) {
      objetos = [];
    }

    // Segunda pasada más corta cuando no hay objetos fiables.
    if (!objetos.length || objetos.every(o => (o.confianza || 0) < 0.45)) {
      try {
        const aiData2 = await runMultiQuestion(
          `Cuenta objetos de taller visibles y devuelve SOLO array JSON [{"nombre":string,"cantidad":number,"categoriaSugerida":string|null,"confianza":number}]. ` +
          `Incluye solo objetos con confianza media o alta. Categorías permitidas: ${categoriasTexto}. Sin texto extra.`,
          420
        );
        const parsed2 = extractJsonArray(aiData2?.result?.answer || '[]');
        const objetos2 = (Array.isArray(parsed2) ? parsed2 : []).map(o => {
          const nombre = String(o?.nombre || '').trim();
          const cantidad = Math.max(1, parseInt(o?.cantidad, 10) || 1);
          let categoriaSugerida = String(o?.categoriaSugerida || '').trim();
          const confianza = Math.max(0, Math.min(1, Number(o?.confianza || 0) || 0));
          if (categoriaSugerida && !categoriasDept.includes(categoriaSugerida)) categoriaSugerida = '';
          return { nombre, cantidad, categoriaSugerida, confianza };
        }).filter(o => o.nombre);
        if (objetos2.length > objetos.length) objetos = objetos2;
      } catch (e) {
        // ignore second pass failures
      }
    }

    objetos = objetos
      .sort((a, b) => (b.confianza || 0) - (a.confianza || 0))
      .map(({ confianza, ...o }) => o);

    return Response.json({ ok: true, objetos });
  }

  return Response.json({ ok: false, error: 'Accion desconocida' });
}

async function buscarSerieEnD1(env, serieLeida, dept, superadmin, genericDept) {
  const deptFilter = superadmin
    ? ''
    : ` AND (oculto IS NULL OR oculto != 1) AND (departamento=? OR departamento='${genericDept}')`;
  const deptBind = superadmin ? [] : [dept];

  const allWithSerieRes = await env.DB.prepare(`SELECT * FROM inventario WHERE serie != ''${deptFilter}`)
    .bind(...deptBind).all();

  return buscarSerieEnRows(allWithSerieRes.results || [], serieLeida);
}

async function lookupProductoUpcItemDb(codigo) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const resp = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(codigo)}`, {
      signal: controller.signal
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data?.code !== 'OK' || !Array.isArray(data.items) || !data.items.length) return null;
    const item = data.items[0];
    const nombre = String(item.title || '').trim().slice(0, 120);
    const marca = String(item.brand || '').trim();
    if (!nombre) return null;
    return { nombre, marca };
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buscarSerieEnRows(allWithSerie, serieLeida) {
  const serieNorm = normalizeSerieCodigo(serieLeida);

  if (!serieNorm) return { match: 'ninguno' };

  const exactLiteral = allWithSerie.find(r => String(r.serie || '').trim() === String(serieLeida || '').trim());
  if (exactLiteral) return { match: 'exacto', item: exactLiteral };

  const exactNormalizado = serieNorm
    ? allWithSerie.find(r => normalizeSerieCodigo(r.serie) === serieNorm)
    : null;
  if (exactNormalizado) return { match: 'exacto', item: exactNormalizado };

  const maxDist = serieNorm.length >= 12 ? 3 : 2;
  const candidatos = allWithSerie
    .map(r => ({
      id: r.id,
      item: r.item,
      ref: r.ref,
      aula: r.aula,
      serie: r.serie,
      _dist: levenshtein(normalizeSerieCodigo(r.serie), serieNorm)
    }))
    .filter(r => r.serie && r._dist <= maxDist)
    .sort((a, b) => a._dist - b._dist)
    .slice(0, 5)
    .map(({ _dist, ...r }) => r);

  if (candidatos.length) return { match: 'fuzzy', candidatos };
  return { match: 'ninguno' };
}

function levenshtein(a, b) {
  a = String(a || '').toUpperCase();
  b = String(b || '').toUpperCase();
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function normalizeSerieCodigo(v) {
  let s = String(v || '').toUpperCase().trim();
  // Mantener solo alfanuméricos para evitar fallos por separadores comunes en etiquetas.
  s = s.replace(/[^A-Z0-9]/g, '');
  s = s.replace(/^SERIALNUMBER/, '');
  s = s.replace(/^SERVICETAG/, '');
  if (/^SN[A-Z0-9]{3,}$/.test(s)) s = s.slice(2);
  return s;
}

function extractJsonObject(raw) {
  const text = String(raw || '').trim();
  if (!text) return {};
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    return {};
  }
}

function extractJsonArray(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function safeText(v) {
  if (v == null) return '';
  return String(v).trim();
}

function formatLearningExamples(rows) {
  const r = Array.isArray(rows) ? rows : [];
  if (!r.length) return '';
  const lines = r.slice(0, 4).map((e, i) => {
    const tipo = safeText(e.tipo) || 'desconocido';
    const nombre = safeText(e.nombre) || 'sin-nombre';
    const categoria = safeText(e.categoria) || 'sin-categoria';
    const serie = safeText(e.serie) || 'sin-serie';
    const marca = safeText(e.marca) || 'sin-marca';
    const modelo = safeText(e.modelo) || 'sin-modelo';
    const texto = safeText(e.texto_libre) || 'sin-texto';
    const confianza = Math.max(0, Math.min(1, Number(e.confianza || 0) || 0));
    return `Ejemplo ${i + 1}: tipo=${tipo}; nombre=${nombre}; categoria=${categoria}; serie=${serie}; marca=${marca}; modelo=${modelo}; texto=${texto}; confianza=${Math.round(confianza * 100)}%`;
  });
  return ` Usa estos ejemplos recientes del propio taller como referencia de estilo/terminología (no los copies literalmente): ${lines.join(' | ')}.`;
}

function expandOcrCandidates(input) {
  const base = normalizeSerieCodigo(input);
  if (!base) return [];

  const map = {
    '0': ['O'], 'O': ['0'],
    '1': ['I', 'L'], 'I': ['1', 'L'], 'L': ['1', 'I'],
    '5': ['S'], 'S': ['5'],
    '8': ['B'], 'B': ['8'],
    '2': ['Z'], 'Z': ['2']
  };

  const out = new Set([base]);
  const queue = [{ s: base, i: 0, changes: 0 }];
  const maxChanges = 2;
  const maxOut = 25;

  while (queue.length && out.size < maxOut) {
    const node = queue.shift();
    if (!node) break;
    for (let i = node.i; i < node.s.length; i++) {
      const ch = node.s[i];
      const swaps = map[ch] || [];
      for (const r of swaps) {
        if (node.changes + 1 > maxChanges) continue;
        const cand = node.s.slice(0, i) + r + node.s.slice(i + 1);
        if (!out.has(cand)) {
          out.add(cand);
          queue.push({ s: cand, i: i + 1, changes: node.changes + 1 });
          if (out.size >= maxOut) break;
        }
      }
      if (out.size >= maxOut) break;
    }
  }

  return [...out];
}
