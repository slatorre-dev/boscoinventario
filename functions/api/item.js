const HEADERS_INV = ['id','ref','aula','mod','item','qty','min','cat','loc','est','util','proveedor','tags','fecha','mant','mantFecha','mantNota','mantResp','mantEstado','mantSolicitante','mantSolicitanteEmail','foto','obs','code','es_contenedor','parent_id','tipo_material','oculto'];
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
  await env.DB.prepare("ALTER TABLE inventario ADD COLUMN departamento TEXT DEFAULT ''").run().catch(() => {});

  if (action === 'add') {
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
    item.es_contenedor = item.es_contenedor ? 1 : 0;
    item.parent_id = item.parent_id || null;
    item.tipo_material = item.es_contenedor ? 'inventariable' : (item.tipo_material || 'consumible');
    const sets = FIELDS_UPD.map(h => `${h}=?`).join(',');
    const vals = [...FIELDS_UPD.map(h => item[h] ?? null), item.id];
    await env.DB.prepare(`UPDATE inventario SET ${sets} WHERE id=?`).bind(...vals).run();
    await auditLog(env.DB, user, 'update', item.id, itemAuditSummary('Actualizado', item));
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

  return Response.json({ ok: false, error: 'Accion desconocida' });
}
