// Gestión de aulas, categorías y ciclos
async function auditLog(db, user, accion, resumen) {
  const fecha = new Date().toISOString().replace('T',' ').slice(0,19);
  try {
    await db.prepare("CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT DEFAULT '', usuario TEXT DEFAULT '', nombre TEXT DEFAULT '', rol TEXT DEFAULT '', accion TEXT DEFAULT '', itemId TEXT DEFAULT '', resumen TEXT DEFAULT '')").run();
    await db.prepare('INSERT INTO log (fecha,usuario,nombre,rol,accion,itemId,resumen) VALUES (?,?,?,?,?,?,?)')
      .bind(fecha, user.usuario, user.nombre, user.rol, accion, '', resumen).run();
  } catch (error) {
    console.warn('auditLog failed', error?.message || error);
  }
}

const NORMALIZED_CATS = [
  { name:'Componentes electrónicos', c:'#2563eb', bg:'#eff6ff', i:'⚡', orden:1 },
  { name:'Material de taller', c:'#7c3aed', bg:'#f5f3ff', i:'📦', orden:2 },
  { name:'Equipos de medida', c:'#0891b2', bg:'#ecfeff', i:'📊', orden:3 },
  { name:'Herramientas', c:'#d97706', bg:'#fffbeb', i:'🔨', orden:4 },
  { name:'Informática', c:'#1d4ed8', bg:'#eff6ff', i:'💻', orden:5 },
  { name:'Material eléctrico', c:'#db2777', bg:'#fdf2f8', i:'🔌', orden:6 },
  { name:'Redes', c:'#0e7490', bg:'#f0fdfa', i:'🌐', orden:7 },
  { name:'Robótica y automatización', c:'#7e22ce', bg:'#faf5ff', i:'🤖', orden:8 },
  { name:'Otros', c:'#6b7280', bg:'#f9fafb', i:'🔧', orden:9 },
];

function normText(v){
  return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const CAT_MATERIAL_TALLER = 'Material de taller';
function canonicalCategoryName(name){
  const raw = String(name || '').trim();
  const key = normText(raw);
  if(key === 'consumible' || key === 'consumibles') return CAT_MATERIAL_TALLER;
  return raw;
}

function splitTags(v){
  return String(v || '').split(/[;,]/).map(t=>t.trim()).filter(Boolean);
}

function addTag(tags, value){
  const tag = String(value || '').trim();
  if(!tag) return;
  if(!tags.some(t=>normText(t)===normText(tag))) tags.push(tag);
}

// Mapa: forma normalizada (minúsculas sin tildes) → forma canónica bonita
const TAG_CANONICAL_MAP = {
  // Componentes electrónicos
  'rele': 'Relés', 'reles': 'Relés', 'relay': 'Relés', 'relays': 'Relés',
  'resistencia': 'Resistencias', 'resistencias': 'Resistencias',
  'condensador': 'Condensadores', 'condensadores': 'Condensadores',
  'sensor': 'Sensores', 'sensores': 'Sensores',
  'smd': 'SMD',
  'led': 'LED', 'leds': 'LED',
  'diodo': 'Diodos', 'diodos': 'Diodos',
  'transistor': 'Transistores', 'transistores': 'Transistores',
  // Material eléctrico
  'cable': 'Cables', 'cables': 'Cables', 'manguera': 'Cables',
  'conector': 'Conectores', 'conectores': 'Conectores',
  'proteccion electrica': 'Protecciones eléctricas', 'protecciones electricas': 'Protecciones eléctricas',
  'diferencial': 'Protecciones eléctricas', 'magnetotermico': 'Protecciones eléctricas',
  'fusible': 'Fusibles', 'fusibles': 'Fusibles',
  '230v': '230V', '220v': '230V',
  // Herramientas
  'herramienta': 'Herramientas', 'herramientas': 'Herramientas',
  'soldadura': 'Soldadura',
  // Equipos de medida
  'medida': 'Medida',
  'multimetro': 'Multímetros', 'multimetros': 'Multímetros', 'polimetro': 'Multímetros', 'polimetros': 'Multímetros',
  'osciloscopio': 'Osciloscopios', 'osciloscopios': 'Osciloscopios',
  // Redes
  'router': 'Routers', 'routers': 'Routers',
  'switch': 'Switches', 'switches': 'Switches',
  'antena': 'Antenas', 'antenas': 'Antenas',
  'fibra optica': 'Fibra óptica', 'fibra': 'Fibra óptica',
  'telecom': 'Telecomunicaciones', 'telecomunicaciones': 'Telecomunicaciones',
  // Informática
  'ordenador': 'Ordenadores', 'ordenadores': 'Ordenadores',
  'raspberry pi': 'Raspberry Pi', 'raspberry': 'Raspberry Pi',
  // Robótica
  'arduino': 'Arduino',
  'esp32': 'ESP32', 'esp8266': 'ESP32',
  'domotica': 'Domótica', 'robotica': 'Robótica',
  // Consumibles
  'tornillo': 'Tornillería', 'tornilleria': 'Tornillería', 'tornillos': 'Tornillería',
  'consumible': 'Consumibles', 'consumibles': 'Consumibles',
  // Otros frecuentes
  'fuente': 'Fuentes de alimentación', 'fuentes': 'Fuentes de alimentación', 'fuente de alimentacion': 'Fuentes de alimentación',
  'rueda': 'Ruedas', 'ruedas': 'Ruedas',
  'api': 'API', 'apis': 'API',
  'pcb': 'PCB', 'placa': 'PCB', 'placas': 'PCB',
};

function canonicalTagFamily(tag){
  const key = normText(tag).replace(/\s+/g,' ').trim();
  if(!key) return '';
  return key;
}

function prettyTag(raw){
  const key = normText(raw).replace(/\s+/g,' ').trim();
  if(TAG_CANONICAL_MAP[key]) return TAG_CANONICAL_MAP[key];
  // Capitalizar primera letra si no está en el mapa
  const t = raw.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function normalizeTagsCanonical(value){
  const seen = new Set();
  const out = [];
  for(const raw of splitTags(value)){
    const family = canonicalTagFamily(raw);
    if(!family || seen.has(family)) continue;
    seen.add(family);
    out.push(prettyTag(raw));
  }
  out.sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
  return out.join(', ');
}

function normalizeItemCategoryAndTags(item){
  const text = normText([item.cat,item.item,item.ref,item.util,item.loc,item.obs].join(' '));
  const oldCatRaw = String(item.cat || '').trim();
  const oldCat = canonicalCategoryName(oldCatRaw);
  const tags = splitTags(item.tags);
  let cat = NORMALIZED_CATS.some(c=>normText(c.name)===normText(oldCat)) ? oldCat : 'Otros';

  const rules = [
    { cat:'Redes', tag:'Routers', keys:['router','routers'] },
    { cat:'Redes', tag:'Fibra óptica', keys:['fibra','optica','fo '] },
    { cat:'Redes', tag:'Telecomunicaciones', keys:['telecom','comunicacion'] },
    { cat:'Redes', tag:'Antenas', keys:['antena','antenas'] },
    { cat:'Redes', tag:'Switches', keys:['switch','ethernet','rj45','wifi','wi-fi','access point','punto de acceso'] },
    { cat:'Informática', tag:'Ordenadores', keys:['ordenador','ordenadores','pc','portatil','portátil','monitor','teclado','raton','ratón'] },
    { cat:'Informática', tag:'Raspberry Pi', keys:['raspberry'] },
    { cat:'Robótica y automatización', tag:'Arduino', keys:['arduino'] },
    { cat:'Robótica y automatización', tag:'ESP32', keys:['esp32','esp8266'] },
    { cat:'Robótica y automatización', tag:'Domótica', keys:['domotica','domótica','knx'] },
    { cat:'Robótica y automatización', tag:'Robótica', keys:['robot','robotica','robótica','servo','motor','sensor'] },
    { cat:'Material eléctrico', tag:'Protecciones eléctricas', keys:['proteccion','protección','diferencial','magnetotermico','magnetotérmico','fusible'] },
    { cat:'Material eléctrico', tag:'Cables', keys:['cable','cables','manguera'] },
    { cat:'Material eléctrico', tag:'Conectores', keys:['conector','conectores','enchufe','regleta','borne'] },
    { cat:'Material eléctrico', tag:'230V', keys:['230v','220v','ac '] },
    { cat:'Herramientas', tag:'Herramienta', keys:['herramienta','destornillador','alicate','pinza','cutter','taladro','ingletadora','soldador'] },
    { cat:'Herramientas', tag:'Soldadura', keys:['soldadura','soldador','estaño','estano'] },
    { cat:'Equipos de medida', tag:'Medida', keys:['medida','tester','multimetro','multímetro','osciloscopio','vatimetro','vatímetro','pinza amperimetrica','fuente laboratorio'] },
    { cat:'Componentes electrónicos', tag:'SMD', keys:['smd'] },
    { cat:'Componentes electrónicos', tag:'Resistencias', keys:['resistencia','resistencias','res '] },
    { cat:'Componentes electrónicos', tag:'Condensadores', keys:['condensador','condensadores','cond-'] },
    { cat:'Componentes electrónicos', tag:'Relés', keys:['rele','relé','relay'] },
    { cat:'Componentes electrónicos', tag:'Sensores', keys:['sensor','sensores'] },
    { cat:CAT_MATERIAL_TALLER, tag:'Tornillería', keys:['tornillo','tuerca','arandela','tornilleria','tornillería'] },
    { cat:CAT_MATERIAL_TALLER, tag:'Consumible', keys:['consumible','brida','cinta','termorretractil','termorretráctil'] },
  ];

  for(const rule of rules){
    if(rule.keys.some(k=>text.includes(normText(k)))){
      cat = rule.cat;
      addTag(tags, rule.tag);
    }
  }

  const oldCatNorm = normText(oldCat);
  const majorNorms = new Set(NORMALIZED_CATS.map(c=>normText(c.name)));
  if(oldCat && oldCatNorm !== normText(cat) && !majorNorms.has(oldCatNorm)) addTag(tags, oldCat);

  return { cat, tags: tags.sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'})).join(', ') };
}

function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

const SYNC_ACTIONS_NEED_DEPT = new Set(['aulasSync', 'catsSync', 'ciclosSync']);

export async function onRequestPost({ request, env, data }) {
  const body = await request.json();
  const { action } = body;
  const user = data?.user || request.user;
  const dept = user?.departamento || '';

  if (isSuperAdmin(user) && SYNC_ACTIONS_NEED_DEPT.has(action)) {
    // Aunque un superadmin tenga un departamento "propio" asignado (para
    // el badge y futuro uso), meta.js/list.js le siguen devolviendo TODAS
    // las aulas/ciclos sin filtrar (así ve todo el centro) — su AULAS/CICLOS
    // en el frontend no está scoped a un solo departamento. Sincronizar
    // desde aquí mezclaría/corrompería datos de varios departamentos.
    // Pendiente de resolverse con el selector de departamento (Fase 3).
    return Response.json({ ok: false, error: 'Superadmin no puede gestionar aulas/categorías/ciclos directamente todavía — hazlo con un usuario del departamento correspondiente.' }, { status: 403 });
  }

  if (action === 'aulasSync') {
    const aulas = body.aulas || [];
    await env.DB.prepare('DELETE FROM aulas WHERE departamento=?').bind(dept).run();
    if (aulas.length) {
      const stmt = env.DB.prepare('INSERT INTO aulas (id,name,icon,desc,th,orden,departamento) VALUES (?,?,?,?,?,?,?)');
      await env.DB.batch(aulas.map(a => stmt.bind(a.id,a.name,a.icon,a.desc,a.th,a.orden||0,dept)));
    }
    await auditLog(env.DB, user, 'aulasSync', `Sincronizadas ${aulas.length} aulas`);
    return Response.json({ ok: true });
  }

  if (action === 'catsSync') {
    const incoming = body.cats || [];
    const seen = new Set();
    const cats = incoming
      .map(c => ({ ...c, name: canonicalCategoryName(c?.name) }))
      .filter(c => {
        const name = String(c?.name || '').trim();
        if(!name) return false;
        const key = normText(name);
        if(seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    await env.DB.prepare('DELETE FROM categorias WHERE departamento=?').bind(dept).run();
    if (cats.length) {
      const stmt = env.DB.prepare('INSERT INTO categorias (name,c,bg,i,orden,departamento) VALUES (?,?,?,?,?,?)');
      await env.DB.batch(cats.map(c => stmt.bind(c.name,String(c.c||'#6b7280'),String(c.bg||'#f9fafb'),String(c.i||'🏷️'),c.orden||0,dept)));
    }
    await auditLog(env.DB, user, 'catsSync', `Sincronizadas ${cats.length} categorías`);
    return Response.json({ ok: true });
  }

  if (action === 'normalizeCategoriesTags') {
    await env.DB.prepare("ALTER TABLE inventario ADD COLUMN tags TEXT DEFAULT ''").run().catch(() => {});
    const inv = await env.DB.prepare('SELECT * FROM inventario WHERE departamento=?').bind(dept).all();
    const rows = inv.results || [];
    const updates = [];
    for (const item of rows) {
      const next = normalizeItemCategoryAndTags(item);
      if (next.cat !== (item.cat || '') || next.tags !== (item.tags || '')) {
        updates.push({ id:item.id, ...next });
      }
    }
    if (updates.length) {
      const stmt = env.DB.prepare('UPDATE inventario SET cat=?, tags=? WHERE id=?');
      await env.DB.batch(updates.map(u => stmt.bind(u.cat, u.tags, u.id)));
    }
    await env.DB.prepare('DELETE FROM categorias WHERE departamento=?').bind(dept).run();
    const catStmt = env.DB.prepare('INSERT INTO categorias (name,c,bg,i,orden,departamento) VALUES (?,?,?,?,?,?)');
    await env.DB.batch(NORMALIZED_CATS.map(c => catStmt.bind(c.name,c.c,c.bg,c.i,c.orden,dept)));
    await auditLog(env.DB, user, 'normalizeCategoriesTags', `Normalizadas categorias y tags en ${updates.length} items`);
    const items = await env.DB.prepare('SELECT * FROM inventario WHERE departamento=? ORDER BY id').bind(dept).all();
    return Response.json({ ok: true, updated: updates.length, cats: NORMALIZED_CATS, items: items.results || [] });
  }

  if (action === 'normalizeTagsCanonical') {
    await env.DB.prepare("ALTER TABLE inventario ADD COLUMN tags TEXT DEFAULT ''").run().catch(() => {});
    const inv = await env.DB.prepare('SELECT id, tags FROM inventario WHERE departamento=?').bind(dept).all();
    const rows = inv.results || [];
    const updates = [];
    for (const item of rows) {
      const nextTags = normalizeTagsCanonical(item.tags || '');
      const current = String(item.tags || '').trim();
      if (nextTags !== current) updates.push({ id:item.id, tags:nextTags });
    }
    if (updates.length) {
      const stmt = env.DB.prepare('UPDATE inventario SET tags=? WHERE id=?');
      await env.DB.batch(updates.map(u => stmt.bind(u.tags, u.id)));
    }
    await auditLog(env.DB, user, 'normalizeTagsCanonical', `Normalizados tags en ${updates.length} items`);
    const items = await env.DB.prepare('SELECT * FROM inventario WHERE departamento=? ORDER BY id').bind(dept).all();
    return Response.json({ ok: true, updated: updates.length, items: items.results || [] });
  }

  if (action === 'renameTag') {
    const oldTag = String(body.oldTag || '').trim();
    const newTag = String(body.newTag || '').trim();
    if (!oldTag || !newTag) return Response.json({ ok: false, error: 'Faltan parámetros' });
    const inv = await env.DB.prepare('SELECT id, tags FROM inventario WHERE departamento=?').bind(dept).all();
    const rows = inv.results || [];
    const updates = [];
    const oldLower = oldTag.toLowerCase();
    for (const item of rows) {
      const tags = splitTags(item.tags || '');
      let changed = false;
      const next = tags.map(t => { if (t.toLowerCase() === oldLower) { changed = true; return newTag; } return t; });
      if (changed) updates.push({ id: item.id, tags: next.join(', ') });
    }
    if (updates.length) {
      const stmt = env.DB.prepare('UPDATE inventario SET tags=? WHERE id=?');
      await env.DB.batch(updates.map(u => stmt.bind(u.tags, u.id)));
    }
    await auditLog(env.DB, user, 'renameTag', `Tag "${oldTag}" → "${newTag}" en ${updates.length} ítems`);
    const updated = await env.DB.prepare('SELECT * FROM inventario WHERE departamento=? ORDER BY id').bind(dept).all();
    return Response.json({ ok: true, updated: updates.length, items: updated.results || [] });
  }

  if (action === 'deleteTag') {
    const tag = String(body.tag || '').trim();
    if (!tag) return Response.json({ ok: false, error: 'Falta parámetro tag' });
    const inv = await env.DB.prepare('SELECT id, tags FROM inventario WHERE departamento=?').bind(dept).all();
    const rows = inv.results || [];
    const tagLower = tag.toLowerCase();
    const updates = [];
    for (const item of rows) {
      const tags = splitTags(item.tags || '');
      const filtered = tags.filter(t => t.toLowerCase() !== tagLower);
      if (filtered.length !== tags.length) updates.push({ id: item.id, tags: filtered.join(', ') });
    }
    if (updates.length) {
      const stmt = env.DB.prepare('UPDATE inventario SET tags=? WHERE id=?');
      await env.DB.batch(updates.map(u => stmt.bind(u.tags, u.id)));
    }
    await auditLog(env.DB, user, 'deleteTag', `Tag "${tag}" eliminado de ${updates.length} ítems`);
    const updated = await env.DB.prepare('SELECT * FROM inventario WHERE departamento=? ORDER BY id').bind(dept).all();
    return Response.json({ ok: true, updated: updates.length, items: updated.results || [] });
  }

  if (action === 'ubicacionesSync') {
    const ubicaciones = body.ubicaciones || [];
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS ubicaciones (name TEXT PRIMARY KEY, orden INTEGER DEFAULT 0)").run();
    await env.DB.prepare('DELETE FROM ubicaciones').run();
    if (ubicaciones.length) {
      const stmt = env.DB.prepare('INSERT INTO ubicaciones (name,orden) VALUES (?,?)');
      await env.DB.batch(ubicaciones.map((u, i) => stmt.bind(String(u.name || '').trim(), u.orden || i + 1)));
    }
    await auditLog(env.DB, user, 'ubicacionesSync', `Sincronizadas ${ubicaciones.length} ubicaciones`);
    return Response.json({ ok: true });
  }

  if (action === 'ciclosSync') {
    const ciclos = body.ciclos || [];
    await env.DB.prepare("ALTER TABLE ciclos ADD COLUMN responsable TEXT DEFAULT ''").run().catch(() => {});
    // Preservar responsables antes de borrar
    const existentes = await env.DB.prepare('SELECT cicloId, modCod, responsable FROM ciclos WHERE departamento=?').bind(dept).all();
    const respMap = {};
    for (const r of (existentes.results || [])) {
      respMap[`${r.cicloId}__${r.modCod}`] = r.responsable || '';
      if (!respMap[String(r.modCod)]) respMap[String(r.modCod)] = r.responsable || '';
    }
    await env.DB.prepare('DELETE FROM ciclos WHERE departamento=?').bind(dept).run();
    const rows = [];
    ciclos.forEach((c, ci) => (c.modulos||[]).forEach((m, mi) => {
      const modKey = `${c.id}__${m.cod}`;
      rows.push({ cicloId:c.id, cicloNombre:c.name, nivel:c.nivel||'', icon:c.icon||'', th:c.th||'', desc:c.desc||'', modCod:m.cod, modNombre:m.name, modHoras:m.horas||0, cicloOrden:ci, modOrden:mi, responsable: respMap[modKey] || respMap[String(m.cod)] || '' });
    }));
    if (rows.length) {
      const stmt = env.DB.prepare('INSERT INTO ciclos (cicloId,cicloNombre,nivel,icon,th,desc,modCod,modNombre,modHoras,cicloOrden,modOrden,responsable,departamento) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
      await env.DB.batch(rows.map(r => stmt.bind(r.cicloId,r.cicloNombre,r.nivel,r.icon,r.th,r.desc,r.modCod,r.modNombre,r.modHoras,r.cicloOrden,r.modOrden,r.responsable,dept)));
    }
    await auditLog(env.DB, user, 'ciclosSync', `Sincronizados ${ciclos.length} ciclos`);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'Acción desconocida' });
}
