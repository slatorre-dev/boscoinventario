const HEADERS_INV = ['id','ref','aula','mod','item','qty','min','cat','loc','est','util','proveedor','tags','fecha','mant','mantFecha','mantNota','mantResp','mantEstado','mantSolicitante','mantSolicitanteEmail','foto','obs','code','es_contenedor','parent_id','tipo_material','oculto'];

const GENERIC_DEPT = 'iesjuanbosco'; // "IES Juan Bosco": bolsa compartida, visible/editable por cualquier departamento

function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

function isProfesor(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'profesor';
}

const CAT_PALETTE = [
  { c:'#2563eb', bg:'#eff6ff', i:'🏷️' },
  { c:'#0891b2', bg:'#ecfeff', i:'🏷️' },
  { c:'#059669', bg:'#ecfdf5', i:'🏷️' },
  { c:'#d97706', bg:'#fffbeb', i:'🏷️' },
  { c:'#7c3aed', bg:'#f5f3ff', i:'🏷️' },
  { c:'#db2777', bg:'#fdf2f8', i:'🏷️' },
  { c:'#6b7280', bg:'#f9fafb', i:'🏷️' },
];

function defaultCatStyle(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return CAT_PALETTE[Math.abs(hash) % CAT_PALETTE.length];
}

function mergeCats(savedCats, items) {
  const rows = (savedCats || []).filter(c => String(c.name || '').trim());
  const seen = new Set(rows.map(c => String(c.name).trim().toLowerCase()));
  const maxOrder = rows.reduce((max, c) => Math.max(max, Number(c.orden) || 0), 0);
  const inventoryNames = new Map();
  for (const item of items || []) {
    const name = String(item.cat || '').trim();
    if (name) inventoryNames.set(name.toLowerCase(), name);
  }
  const missingNames = [...inventoryNames.entries()]
    .filter(([key]) => {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(([, name]) => name)
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  return rows.concat(missingNames.map((name, idx) => ({ name, ...defaultCatStyle(name), orden: maxOrder + idx + 1 })));
}

function normKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function mergeProfesores(profesoresRows, usuariosRows) {
  const profesores = (profesoresRows || [])
    .filter(p => String(p.nombre || '').trim() && String(p.nombre || '').trim().toLowerCase() !== 'departamento')
    .map(p => ({ ...p, source: 'profesores' }));
  const seen = new Set();
  for (const p of profesores) {
    seen.add(normKey(p.nombre));
    if (p.email) seen.add('email:' + normKey(p.email));
  }
  for (const u of usuariosRows || []) {
    const nombre = String(u.nombre || u.usuario || '').trim();
    if (!nombre || nombre.toLowerCase() === 'departamento') continue;
    const emailKey = u.email ? 'email:' + normKey(u.email) : '';
    if (seen.has(normKey(nombre)) || (emailKey && seen.has(emailKey))) continue;
    profesores.push({
      id: 'user:' + u.usuario,
      nombre,
      departamento: 'Usuarios app',
      email: u.email || '',
      source: 'usuarios',
      usuario: u.usuario,
    });
    seen.add(normKey(nombre));
    if (emailKey) seen.add(emailKey);
  }
  return profesores.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' }));
}

export async function onRequestGet({ request, env, data }) {
  const user = data?.user || request.user;
  const dept = data?.departamento || request.departamento || '';
  const superadmin = isSuperAdmin(user);
  const genericDept = isProfesor(user) ? '__none__' : GENERIC_DEPT;

  await env.DB.prepare("ALTER TABLE inventario ADD COLUMN es_contenedor INTEGER DEFAULT 0").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE inventario ADD COLUMN parent_id INTEGER DEFAULT NULL").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE inventario ADD COLUMN tipo_material TEXT DEFAULT 'consumible'").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE inventario ADD COLUMN proveedor TEXT DEFAULT ''").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE inventario ADD COLUMN tags TEXT DEFAULT ''").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE inventario ADD COLUMN oculto INTEGER DEFAULT 0").run().catch(() => {});
  await env.DB.prepare("UPDATE inventario SET tipo_material='inventariable' WHERE es_contenedor=1 AND (tipo_material IS NULL OR trim(tipo_material)='')").run().catch(() => {});
  await env.DB.prepare("UPDATE inventario SET tipo_material='consumible' WHERE tipo_material IS NULL OR trim(tipo_material)=''").run().catch(() => {});
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT DEFAULT '')").run().catch(() => {});

  const catRenameMigrated = await env.DB.prepare("SELECT value FROM app_meta WHERE key='rename_consumibles_to_material_taller_v1'").first().catch(() => null);
  if (!catRenameMigrated) {
    const CAT_NEW = 'Material de taller';
    const catRows = await env.DB.prepare('SELECT rowid, name, c, bg, i, orden FROM categorias ORDER BY orden, rowid').all().catch(() => ({ results: [] }));
    const rows = catRows.results || [];
    const oldRows = rows.filter(r => {
      const key = normText(r.name);
      return key === 'consumible' || key === 'consumibles';
    });
    const newRow = rows.find(r => normText(r.name) === normText(CAT_NEW));
    const seed = newRow || oldRows[0] || null;

    await env.DB.prepare("UPDATE inventario SET cat=? WHERE lower(trim(cat)) IN ('consumible','consumibles')").bind(CAT_NEW).run().catch(() => {});

    if (newRow || oldRows.length) {
      await env.DB.prepare("DELETE FROM categorias WHERE lower(trim(name)) IN ('consumible','consumibles') OR lower(trim(name))='material de taller'").run().catch(() => {});
      await env.DB.prepare('INSERT INTO categorias (name,c,bg,i,orden) VALUES (?,?,?,?,?)')
        .bind(
          CAT_NEW,
          String(seed?.c || '#7c3aed'),
          String(seed?.bg || '#f5f3ff'),
          String(seed?.i || '📦'),
          Number(seed?.orden || 2)
        )
        .run()
        .catch(() => {});
    }

    await env.DB.prepare("INSERT OR REPLACE INTO app_meta (key,value) VALUES ('rename_consumibles_to_material_taller_v1', datetime('now'))").run().catch(() => {});
  }

  const tipoMigrado = await env.DB.prepare("SELECT value FROM app_meta WHERE key='tipo_material_migrated'").first().catch(() => null);
  if (!tipoMigrado) {
    await env.DB.prepare("UPDATE inventario SET tipo_material='inventariable' WHERE es_contenedor=1 OR lower(cat) LIKE '%herramient%' OR lower(cat) LIKE '%equipo%' OR lower(cat) LIKE '%instrument%'").run().catch(() => {});
    await env.DB.prepare("INSERT OR REPLACE INTO app_meta (key,value) VALUES ('tipo_material_migrated', datetime('now'))").run().catch(() => {});
  }

  const itemsQuery = superadmin
    ? 'SELECT * FROM inventario ORDER BY id'
    : `SELECT * FROM inventario WHERE (oculto IS NULL OR oculto != 1) AND (departamento=? OR departamento='${genericDept}') ORDER BY id`;

  const [items, profesores, usuarios, prestamos, aulas, cats, ciclosRows] = await Promise.all([
    superadmin ? env.DB.prepare(itemsQuery).all() : env.DB.prepare(itemsQuery).bind(dept).all(),
    superadmin
      ? env.DB.prepare("SELECT * FROM profesores WHERE nombre != '' AND lower(nombre) != 'departamento' ORDER BY nombre").all()
      : env.DB.prepare("SELECT * FROM profesores WHERE nombre != '' AND lower(nombre) != 'departamento' AND departamento=? ORDER BY nombre").bind(dept).all(),
    superadmin
      ? env.DB.prepare("SELECT usuario, nombre, email FROM usuarios WHERE nombre != '' ORDER BY nombre").all()
      : env.DB.prepare("SELECT usuario, nombre, email FROM usuarios WHERE nombre != '' AND departamento=? ORDER BY nombre").bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM prestamos ORDER BY id').all()
      : env.DB.prepare(`SELECT p.* FROM prestamos p JOIN inventario i ON i.id=p.itemId WHERE i.departamento=? OR i.departamento='${genericDept}' ORDER BY p.id`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM aulas ORDER BY orden').all()
      : env.DB.prepare(`SELECT * FROM aulas WHERE departamento=? OR departamento='' OR departamento IS NULL OR departamento='${genericDept}' ORDER BY orden`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM categorias ORDER BY orden').all()
      : env.DB.prepare('SELECT * FROM categorias WHERE departamento=? ORDER BY orden').bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM ciclos ORDER BY cicloOrden, modOrden').all()
      : env.DB.prepare(`SELECT * FROM ciclos WHERE departamento=? OR departamento='${genericDept}' ORDER BY cicloOrden, modOrden`).bind(dept).all(),
  ]);

  const cicloMap = {}, cicloOrder = [];
  for (const r of ciclosRows.results) {
    if (!cicloMap[r.cicloId]) {
      cicloMap[r.cicloId] = { id: r.cicloId, name: r.cicloNombre, nivel: r.nivel, icon: r.icon, th: r.th, desc: r.desc, modulos: [] };
      cicloOrder.push(r.cicloId);
    }
    if (r.modCod) cicloMap[r.cicloId].modulos.push({ cod: r.modCod, name: r.modNombre, horas: r.modHoras });
  }

  // Compresión: items como array de arrays
  const itemRows = items.results || [];
  const itemsC = itemRows.map(it => HEADERS_INV.map(h => it[h] ?? ''));

  return Response.json({
    ok: true,
    itemsH: HEADERS_INV,
    itemsC,
    profesores: mergeProfesores(profesores.results, usuarios.results),
    prestamos: prestamos.results,
    aulas: aulas.results,
    cats: mergeCats(cats.results, itemRows),
    ciclos: cicloOrder.map(id => cicloMap[id]),
    user
  });
}
