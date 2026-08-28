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

function mergeCats(savedCats, inventoryCats) {
  const rows = (savedCats || []).filter(c => String(c.name || '').trim());
  const seen = new Set(rows.map(c => String(c.name).trim().toLowerCase()));
  const maxOrder = rows.reduce((max, c) => Math.max(max, Number(c.orden) || 0), 0);
  const missing = (inventoryCats || [])
    .map(c => String(c.cat || c.name || '').trim())
    .filter(Boolean)
    .filter(name => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
    .map((name, idx) => ({ name, ...defaultCatStyle(name), orden: maxOrder + idx + 1 }));
  return rows.concat(missing);
}

function mergeUbicaciones(savedRows, inventoryRows) {
  const rows = (savedRows || []).filter(r => String(r.name || '').trim());
  const seen = new Set(rows.map(r => String(r.name).trim().toLowerCase()));
  const maxOrder = rows.reduce((max, r) => Math.max(max, Number(r.orden) || 0), 0);
  const missing = (inventoryRows || [])
    .map(r => String(r.loc || r.name || '').trim())
    .filter(Boolean)
    .filter(name => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
    .map((name, idx) => ({ name, orden: maxOrder + idx + 1 }));
  return rows.concat(missing);
}

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

export async function onRequestGet({ request, env, data }) {
  const user = data?.user || request.user;
  const dept = data?.departamento || '';
  const superadmin = isSuperAdmin(user);
  const genericDept = isProfesor(user) ? '__none__' : GENERIC_DEPT;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS ubicaciones (name TEXT PRIMARY KEY, orden INTEGER DEFAULT 0)").run().catch(() => {});
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS modulo_profesores (cicloId TEXT NOT NULL, modCod TEXT NOT NULL, departamento TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (cicloId, modCod, departamento, usuario))").run().catch(() => {});
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS aula_profesores (aula TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (aula, usuario))").run().catch(() => {});

  const [aulas, cats, invCats, ubicaciones, invLocs, ciclosRows, departamentosRows, profesRows, misAulasRows] = await Promise.all([
    superadmin
      ? env.DB.prepare("SELECT * FROM aulas ORDER BY orden, id").all()
      : env.DB.prepare(`SELECT * FROM aulas WHERE departamento=? OR departamento='' OR departamento IS NULL OR departamento='${genericDept}' ORDER BY orden, id`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM categorias ORDER BY orden').all()
      : env.DB.prepare("SELECT * FROM categorias WHERE departamento=? ORDER BY orden").bind(dept).all(),
    superadmin
      ? env.DB.prepare("SELECT DISTINCT cat FROM inventario WHERE cat IS NOT NULL AND trim(cat) != '' ORDER BY cat").all()
      : env.DB.prepare(`SELECT DISTINCT cat FROM inventario WHERE cat IS NOT NULL AND trim(cat) != '' AND (departamento=? OR departamento='${genericDept}') ORDER BY cat`).bind(dept).all(),
    env.DB.prepare('SELECT * FROM ubicaciones ORDER BY orden, name').all().catch(() => ({ results: [] })),
    superadmin
      ? env.DB.prepare("SELECT DISTINCT loc FROM inventario WHERE loc IS NOT NULL AND trim(loc) != '' ORDER BY loc").all()
      : env.DB.prepare(`SELECT DISTINCT loc FROM inventario WHERE loc IS NOT NULL AND trim(loc) != '' AND (departamento=? OR departamento='${genericDept}') ORDER BY loc`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM ciclos ORDER BY cicloOrden, modOrden').all()
      : env.DB.prepare(`SELECT * FROM ciclos WHERE departamento=? OR departamento='${genericDept}' ORDER BY cicloOrden, modOrden`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT slug, nombre, icono FROM departamentos ORDER BY orden').all()
      : Promise.resolve({ results: [] }),
    superadmin
      ? env.DB.prepare('SELECT mp.cicloId, mp.modCod, mp.usuario, u.email FROM modulo_profesores mp JOIN usuarios u ON u.usuario = mp.usuario').all()
      : env.DB.prepare(`SELECT mp.cicloId, mp.modCod, mp.usuario, u.email FROM modulo_profesores mp JOIN usuarios u ON u.usuario = mp.usuario WHERE mp.departamento=? OR mp.departamento='${genericDept}'`).bind(dept).all(),
    env.DB.prepare('SELECT aula FROM aula_profesores WHERE usuario=?').bind(user.usuario).all(),
  ]);

  const emailsPorModulo = {};
  const misModulos = [];
  for (const row of (profesRows.results || [])) {
    const mid = `${row.cicloId}__${row.modCod}`;
    if (row.usuario === user.usuario) {
      misModulos.push(mid);
    } else {
      if (!emailsPorModulo[mid]) emailsPorModulo[mid] = [];
      emailsPorModulo[mid].push(row.email || '');
    }
  }

  const cicloMap = {}, cicloOrder = [];
  for (const r of ciclosRows.results) {
    if (!cicloMap[r.cicloId]) {
      cicloMap[r.cicloId] = { id: r.cicloId, name: r.cicloNombre, nivel: r.nivel, icon: r.icon, th: r.th, desc: r.desc, departamento: r.departamento || '', modulos: [] };
      cicloOrder.push(r.cicloId);
    }
    if (r.modCod) {
      const mid = `${r.cicloId}__${r.modCod}`;
      cicloMap[r.cicloId].modulos.push({ cod: r.modCod, name: r.modNombre, horas: r.modHoras, responsablesEmails: emailsPorModulo[mid] || [] });
    }
  }

  return Response.json({
    ok: true,
    aulas: sortAulas(aulas.results),
    cats: mergeCats(cats.results, invCats.results),
    catsPropias: cats.results.length > 0,
    catsCrudo: superadmin ? cats.results : undefined,
    ubicaciones: mergeUbicaciones(ubicaciones.results, invLocs.results),
    ciclos: cicloOrder.map(id => cicloMap[id]),
    misModulos,
    misAulas: (misAulasRows.results || []).map(r => r.aula),
    departamentos: superadmin ? departamentosRows.results : undefined,
    user
  });
}
