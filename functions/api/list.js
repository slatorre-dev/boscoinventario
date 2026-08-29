// Mantener sincronizado con el HEADERS_INV de item.js — ver CLAUDE.md, bug recurrente de columnas divergentes (mismo orden, mismas columnas, en ambos archivos)
const HEADERS_INV = ['id','ref','aula','mod','item','qty','min','cat','loc','est','util','proveedor','tags','fecha','fecha_adquisicion','precio','mant','mantFecha','mantNota','mantResp','mantEstado','mantCoste','mantSolicitante','mantSolicitanteEmail','foto','obs','code','serie','es_contenedor','parent_id','tipo_material','oculto','mantPlanIntervaloDias','mantPlanUltimaRevision','mantPlanProximaRevision','mantPlanNota'];

// Aulas numeradas ("Aula 35") ordenan por su número tanto si son la fila
// global sembrada (id "aulaN", ver migrations/0008_aulas_seed.sql) como si
// son una fila propia de departamento con otro id (creada a mano con "+
// Añadir aula", vía CSV de aulas, o por una restauración de backup que
// prefija el id) — sin esto, cualquier duplicado con nombre "Aula N" pero
// id no-"aulaN" queda varado al final de la lista solo por caer en la rama
// `orden` (101+) del ORDER BY, en vez de intercalarse por número.
function aulaNum(row) {
  const m1 = /^aula(\d+)$/.exec(String(row.id || ''));
  if (m1) return parseInt(m1[1], 10);
  const m2 = /(\d+)/.exec(String(row.name || ''));
  return m2 ? parseInt(m2[1], 10) : null;
}
function sortAulas(rows) {
  return [...rows].sort((a, b) => {
    const na = aulaNum(a), nb = aulaNum(b);
    if (na !== null && nb !== null) return na - nb || (a.orden || 0) - (b.orden || 0) || String(a.id).localeCompare(String(b.id));
    if (na !== null) return -1;
    if (nb !== null) return 1;
    return (a.orden || 0) - (b.orden || 0) || String(a.id).localeCompare(String(b.id));
  });
}

const GENERIC_DEPT = 'iesjuanbosco'; // "IES Juan Bosco": bolsa compartida, visible/editable por cualquier departamento

function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

function isProfesor(user){
  const r = String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  return r === 'profesor' || r === 'profesor/a' || r === 'profesora';
}

// Colores por hash del nombre — el icono ya no viene de aquí (ver
// suggestCatIcon), esta paleta solo decide texto/fondo para categorías
// "huérfanas" (existen en inventario.cat pero nunca se guardaron como
// fila propia en categorias, típico de un import CSV con una columna de
// categoría nueva).
const CAT_PALETTE = [
  { c:'#2563eb', bg:'#eff6ff' },
  { c:'#0891b2', bg:'#ecfeff' },
  { c:'#059669', bg:'#ecfdf5' },
  { c:'#d97706', bg:'#fffbeb' },
  { c:'#7c3aed', bg:'#f5f3ff' },
  { c:'#db2777', bg:'#fdf2f8' },
  { c:'#6b7280', bg:'#f9fafb' },
];

// Mismo criterio que js/config.js:CAT_ICON_SUGGESTIONS (duplicado aquí
// porque functions/ no puede importar módulos del frontend) — icono
// representativo por nombre de categoría común, en vez del 🏷️ fijo que
// usaba antes toda categoría sin fila propia en D1.
const CAT_ICON_SUGGESTIONS = [
  { re: /audiovisual|proyector|pantalla|televisi/i, i: '📽️' },
  { re: /inform[aá]tic|ordenador|pc\b/i, i: '💻' },
  { re: /material did[aá]ctico|did[aá]ctic/i, i: '📚' },
  { re: /mobiliario|mueble|silla|mesa/i, i: '🪑' },
  { re: /herramient/i, i: '🔨' },
  { re: /componente|electr[oó]nic/i, i: '⚡' },
  { re: /el[eé]ctric/i, i: '🔌' },
  { re: /dom[oó]tic/i, i: '🏠' },
  { re: /audio\b/i, i: '🔊' },
  { re: /deporte|deportiv/i, i: '🏀' },
  { re: /music|instrumento/i, i: '🎵' },
  { re: /arte|pl[aá]stic|dibujo/i, i: '🎨' },
  { re: /laboratorio|qu[ií]mic/i, i: '🧪' },
  { re: /cocina|hosteler/i, i: '🍳' },
  { re: /medida|medici[oó]n/i, i: '📊' },
  { re: /red(es)?\b|network/i, i: '🌐' },
  { re: /seguridad|protecci/i, i: '🦺' },
  { re: /limpieza/i, i: '🧹' },
  { re: /papel|oficina/i, i: '📄' },
  { re: /veh[ií]culo|autom[oó]vil|motor|rob[oó]tic/i, i: '🚗' },
  { re: /textil|costura|tela/i, i: '🧵' },
  { re: /libro|biblioteca/i, i: '📖' },
  { re: /taller/i, i: '📦' },
];
// Icono neutro de "sin categoría concreta detectada" — distinto de
// 🏷️ (reservado a tags) para no confundir en Home.
const CAT_ICON_FALLBACK = '📁';

function suggestCatIcon(name) {
  const n = String(name || '');
  const hit = CAT_ICON_SUGGESTIONS.find(s => s.re.test(n));
  return hit ? hit.i : CAT_ICON_FALLBACK;
}

function defaultCatStyle(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  const { c, bg } = CAT_PALETTE[Math.abs(hash) % CAT_PALETTE.length];
  return { c, bg, i: suggestCatIcon(name) };
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
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, itemId INTEGER NOT NULL, departamento TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL DEFAULT 1, nota TEXT DEFAULT '', creadoPor TEXT DEFAULT '',
    fecha TEXT DEFAULT (datetime('now')), UNIQUE(itemId, departamento)
  )`).run().catch(() => {});
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS solicitudes_material (
    id INTEGER PRIMARY KEY AUTOINCREMENT, departamento TEXT NOT NULL DEFAULT '', nombre TEXT NOT NULL DEFAULT '',
    cantidad INTEGER NOT NULL DEFAULT 1, nota TEXT DEFAULT '', estado TEXT NOT NULL DEFAULT 'pendiente',
    respuesta TEXT DEFAULT '', creadoPor TEXT DEFAULT '', creadoPorNombre TEXT DEFAULT '',
    fecha TEXT DEFAULT (datetime('now')), actualizadoEn TEXT DEFAULT ''
  )`).run().catch(() => {});

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

  const [items, profesores, usuarios, prestamos, aulas, cats, ciclosRows, reservasRows, reservaItemsRows, pedidosRows, solicitudesRows] = await Promise.all([
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
      ? env.DB.prepare("SELECT * FROM aulas ORDER BY orden, id").all()
      : env.DB.prepare(`SELECT * FROM aulas WHERE departamento=? OR departamento='' OR departamento IS NULL OR departamento='${genericDept}' ORDER BY orden, id`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM categorias ORDER BY orden').all()
      : env.DB.prepare('SELECT * FROM categorias WHERE departamento=? ORDER BY orden').bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM ciclos ORDER BY cicloOrden, modOrden').all()
      : env.DB.prepare(`SELECT * FROM ciclos WHERE departamento=? OR departamento='${genericDept}' ORDER BY cicloOrden, modOrden`).bind(dept).all(),
    superadmin
      ? env.DB.prepare("SELECT * FROM reservas_practica WHERE estado != 'cancelada' ORDER BY fecha, id").all()
      : env.DB.prepare(`SELECT * FROM reservas_practica WHERE (departamento=? OR departamento='${genericDept}') AND estado != 'cancelada' ORDER BY fecha, id`).bind(dept).all(),
    superadmin
      ? env.DB.prepare("SELECT ri.* FROM reserva_items ri JOIN reservas_practica rp ON rp.id=ri.reservaId WHERE rp.estado != 'cancelada'").all()
      : env.DB.prepare(`SELECT ri.* FROM reserva_items ri JOIN reservas_practica rp ON rp.id=ri.reservaId WHERE (rp.departamento=? OR rp.departamento='${genericDept}') AND rp.estado != 'cancelada'`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM pedidos ORDER BY id').all()
      : env.DB.prepare('SELECT * FROM pedidos WHERE departamento=? ORDER BY id').bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM solicitudes_material ORDER BY id DESC').all()
      : env.DB.prepare('SELECT * FROM solicitudes_material WHERE departamento=? ORDER BY id DESC').bind(dept).all(),
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

  // Reservas de práctica: anidar líneas ya cargadas junto a las reservas filtradas por departamento
  const reservas = (reservasRows.results || []).map(r => ({
    ...r,
    lineas: (reservaItemsRows.results || []).filter(li => Number(li.reservaId) === Number(r.id)),
  }));

  return Response.json({
    ok: true,
    itemsH: HEADERS_INV,
    itemsC,
    profesores: mergeProfesores(profesores.results, usuarios.results),
    prestamos: prestamos.results,
    reservas,
    aulas: sortAulas(aulas.results),
    cats: mergeCats(cats.results, itemRows),
    ciclos: cicloOrder.map(id => cicloMap[id]),
    pedidos: pedidosRows.results,
    solicitudes: solicitudesRows.results,
    user
  });
}
