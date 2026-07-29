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

const GENERIC_DEPT = 'iesjuanbosco'; // "IES Juan Bosco": bolsa compartida, visible/editable por cualquier departamento

function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

export async function onRequestGet({ request, env, data }) {
  const user = data?.user || request.user;
  const dept = data?.departamento || '';
  const superadmin = isSuperAdmin(user);
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS ubicaciones (name TEXT PRIMARY KEY, orden INTEGER DEFAULT 0)").run().catch(() => {});

  const [aulas, cats, invCats, ubicaciones, invLocs, ciclosRows] = await Promise.all([
    superadmin
      ? env.DB.prepare('SELECT * FROM aulas ORDER BY orden').all()
      : env.DB.prepare(`SELECT * FROM aulas WHERE departamento=? OR departamento='' OR departamento IS NULL OR departamento='${GENERIC_DEPT}' ORDER BY orden`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM categorias ORDER BY orden').all()
      : env.DB.prepare("SELECT * FROM categorias WHERE departamento=? ORDER BY orden").bind(dept).all(),
    superadmin
      ? env.DB.prepare("SELECT DISTINCT cat FROM inventario WHERE cat IS NOT NULL AND trim(cat) != '' ORDER BY cat").all()
      : env.DB.prepare(`SELECT DISTINCT cat FROM inventario WHERE cat IS NOT NULL AND trim(cat) != '' AND (departamento=? OR departamento='${GENERIC_DEPT}') ORDER BY cat`).bind(dept).all(),
    env.DB.prepare('SELECT * FROM ubicaciones ORDER BY orden, name').all().catch(() => ({ results: [] })),
    superadmin
      ? env.DB.prepare("SELECT DISTINCT loc FROM inventario WHERE loc IS NOT NULL AND trim(loc) != '' ORDER BY loc").all()
      : env.DB.prepare(`SELECT DISTINCT loc FROM inventario WHERE loc IS NOT NULL AND trim(loc) != '' AND (departamento=? OR departamento='${GENERIC_DEPT}') ORDER BY loc`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM ciclos ORDER BY cicloOrden, modOrden').all()
      : env.DB.prepare(`SELECT * FROM ciclos WHERE departamento=? OR departamento='${GENERIC_DEPT}' ORDER BY cicloOrden, modOrden`).bind(dept).all(),
  ]);

  const cicloMap = {}, cicloOrder = [];
  for (const r of ciclosRows.results) {
    if (!cicloMap[r.cicloId]) {
      cicloMap[r.cicloId] = { id: r.cicloId, name: r.cicloNombre, nivel: r.nivel, icon: r.icon, th: r.th, desc: r.desc, modulos: [] };
      cicloOrder.push(r.cicloId);
    }
    if (r.modCod) cicloMap[r.cicloId].modulos.push({ cod: r.modCod, name: r.modNombre, horas: r.modHoras });
  }

  return Response.json({
    ok: true,
    aulas: aulas.results,
    cats: mergeCats(cats.results, invCats.results),
    ubicaciones: mergeUbicaciones(ubicaciones.results, invLocs.results),
    ciclos: cicloOrder.map(id => cicloMap[id]),
    user
  });
}
