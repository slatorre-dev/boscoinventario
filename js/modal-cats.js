// ═════════════════════════════════════════════════════════
// MODAL GESTIÓN DE CATEGORÍAS
// ═════════════════════════════════════════════════════════
let catsEditing = [];

function sortCatsEditing(){
  catsEditing.sort((a,b)=>catNameCompare(a.name, b.name));
}

function syncTagsFromItems(){
  const seen = new Set(TAGS.map(t => t.toLowerCase()));
  for(const item of items){
    for(const tag of itemTags(item)){
      const t = tag.trim();
      if(!t) continue;
      const k = t.toLowerCase();
      if(!seen.has(k)){ seen.add(k); TAGS.push(t); }
    }
  }
  TAGS.sort(tagNameCompare);
}

function openCatsModal(){
  if(!requirePerm('categories.manage')) return;
  syncTagsFromItems();
  const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
  if(isSuperAdmin && !deptActivo){
    toast('Elige un departamento en el selector de la barra superior primero', 'err');
    return;
  }
  if(isSuperAdmin){
    // CATS (objeto global fusionado) mezcla todos los departamentos sin
    // distinguir origen — para superadmin usamos catsCrudo (Task 3 de
    // meta.js), que sí trae `departamento` por fila, filtrado por deptActivo.
    catsEditing = catsCrudo
      .filter(c => c.departamento === deptActivo)
      .map(c => ({name:c.name, c:c.c, bg:c.bg, i:c.i}));
  } else {
    catsEditing = sortedCatEntries().map(([name,v])=>({name, c:v.c, bg:v.bg, i:v.i}));
  }
  sortCatsEditing();
  renderCatsList();
  renderTagsList();
  _renderCatsAviso();
  document.getElementById('mCats').classList.add('open');
}

// Aviso "tu departamento aún no tiene categorías propias" — solo para
// jefes/as de departamento y profesores (no superadmin, que siempre está
// viendo un departamento con datos ajenos o el suyo de referencia ya
// resuelto por deptActivo) cuando catsPropias es false (meta.js).
function _renderCatsAviso(){
  const el = document.getElementById('catsAvisoGenerico');
  if(!el) return;
  const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
  if(catsPropias || isSuperAdmin){
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  el.style.display = 'block';
  el.innerHTML = `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px">
      <strong>Tu departamento aún no tiene categorías propias</strong> — tus ítems usan solo la etiqueta genérica.
      <button class="btn btn-sm" style="margin-left:8px" onclick="addCategoriasSugeridas()">✨ Crear categorías sugeridas</button>
    </div>`;
}
function closeCatsModal(){document.getElementById('mCats').classList.remove('open')}

function renderCatsList(){
  sortCatsEditing();
  document.getElementById('catsList').innerHTML = catsEditing.map((cat,i)=>`
    <div class="cat-row">
      <input class="icon-pick" value="${cat.i}" onchange="catsEditing[${i}].i=this.value" maxlength="2" title="Icono emoji">
      <input class="fi-w name-input" value="${cat.name.replace(/"/g,'&quot;')}" onchange="onCatNameChange(${i},this.value)" placeholder="Nombre categoría">
      <div class="color-col">
        <input type="color" class="color-pick" value="${cat.c}" onchange="catsEditing[${i}].c=this.value" title="Color del texto">
        <span>texto</span>
      </div>
      <div class="color-col">
        <input type="color" class="color-pick" value="${cat.bg}" onchange="catsEditing[${i}].bg=this.value" title="Color de fondo">
        <span>fondo</span>
      </div>
      <button class="del-btn" onclick="removeCatRow(${i})" title="Eliminar">🗑</button>
    </div>
  `).join('');
}

function addCatRow(){
  catsEditing.push({name:'Nueva categoría', i:CAT_ICON_FALLBACK, c:'#6b7280', bg:'#f9fafb'});
  renderCatsList();
}

// Set fijo de categorías sugeridas para departamentos sin categorías
// propias todavía (ver _renderCatsAviso) — icono/color explícitos por
// entrada en vez de suggestCatIcon() (js/config.js:215): más simple para
// 6 nombres fijos y no depende de que calcen con las regex de
// CAT_ICON_SUGGESTIONS. Decisión acordada con el usuario, no cambiar sin motivo.
const CATS_SUGERIDAS_GENERICO = [
  { name: 'Material fungible', i: '📦', c: '#d97706', bg: '#fffbeb' },
  { name: 'Herramientas',      i: '🔨', c: '#2563eb', bg: '#eff6ff' },
  { name: 'Mobiliario',        i: '🪑', c: '#059669', bg: '#ecfdf5' },
  { name: 'Audiovisual',       i: '📽️', c: '#7c3aed', bg: '#f5f3ff' },
  { name: 'Informática',       i: '💻', c: '#0891b2', bg: '#ecfeff' },
  { name: 'Otros',             i: '📁', c: '#6b7280', bg: '#f9fafb' },
];

function addCategoriasSugeridas(){
  const existentes = new Set(catsEditing.map(c => c.name.trim().toLowerCase()));
  const nuevas = CATS_SUGERIDAS_GENERICO.filter(c => !existentes.has(c.name.toLowerCase()));
  if(!nuevas.length){
    toast('Ya tienes todas las categorías sugeridas', 'ok');
    return;
  }
  catsEditing.push(...nuevas.map(c => ({name:c.name, i:c.i, c:c.c, bg:c.bg})));
  renderCatsList();
  toast(`${nuevas.length} categorías sugeridas añadidas — pulsa Guardar para aplicar`, 'ok');
}

// Al escribir el nombre de una categoría nueva, sugiere un icono acorde
// (js/config.js:suggestCatIcon) — solo si el icono sigue siendo el
// genérico por defecto, para no pisar un icono ya elegido a mano.
function onCatNameChange(idx, value){
  const cat = catsEditing[idx];
  if(!cat) return;
  if(cat.i === CAT_ICON_FALLBACK) cat.i = suggestCatIcon(value);
  cat.name = value;
  renderCatsList();
}

async function removeCatRow(idx){
  const cat = catsEditing[idx];
  const usados = items.filter(x=>x.cat===cat.name).length;
  if(usados > 0){
    if(!await confirmDialog({message:`Esta categoría tiene ${usados} ítem(s) asignados. Si la eliminas, esos ítems conservarán el nombre de categoría anterior. ¿Continuar?`})) return;
  }
  catsEditing.splice(idx,1);
  renderCatsList();
}

async function saveCats(){
  for(const cat of catsEditing){
    if(!cat.name.trim()){toast('Hay categorías sin nombre','err');return}
  }
  const names = catsEditing.map(c=>c.name.trim().toLowerCase());
  if(new Set(names).size !== names.length){toast('Hay nombres de categoría duplicados','err');return}
  const clean = catsEditing.map(c=>({name:c.name.trim(), c:c.c, bg:c.bg, i:c.i})).sort((a,b)=>catNameCompare(a.name,b.name));
  const payload = clean.map((c,i)=>({name:c.name, c:c.c, bg:c.bg, i:c.i, orden:i+1}));
  try {
    const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
    const body = {action:'catsSync', cats:payload};
    if(isSuperAdmin && deptActivo) body.departamentoDestino = deptActivo;
    const res = await apiPost(body);
    if(!res.ok) throw new Error(res.error);
    if(isSuperAdmin && deptActivo){
      // CATS global mezcla todos los departamentos — no reemplazar entero.
      // catsCrudo sí se puede reconstruir por completo para ese departamento.
      catsCrudo = catsCrudo.filter(c => c.departamento !== deptActivo)
        .concat(payload.map(c => ({...c, departamento: deptActivo})));
    } else {
      setCatsFromEntries(clean.map(c=>[c.name, {c:c.c, bg:c.bg, i:c.i}]));
    }
    fillCatFilter();
    fillModalSelects();
    if(typeof renderHome === 'function') renderHome();
    closeCatsModal();
    toast('Categorías guardadas y sincronizadas','ok');
  } catch(err) {
    toast(friendlyError(err),'err');
  }
}

async function normalizeCategoriesToTags(){
  if(!requirePerm('categories.manage')) return;
  if(!await confirmDialog({message:'Esto reducirá las categorías a grupos principales y moverá categorías como Routers, Fibra óptica, Telecomunicaciones, Ordenadores o Domótica a tags de los ítems. ¿Continuar?'})) return;
  try{
    const res = await apiPost({action:'normalizeCategoriesTags'});
    if(!res.ok) throw new Error(res.error);
    if(res.items) items = res.items;
    if(res.cats) setCatsFromEntries(res.cats.map(c=>[c.name,{c:c.c,bg:c.bg,i:c.i}]));
    catsEditing = sortedCatEntries().map(([name,v])=>({name, c:v.c, bg:v.bg, i:v.i}));
    renderCatsList();
    fillModalSelects();
    fillCatFilter();
    if(typeof renderHome === 'function') renderHome();
    if(cf) renderInv();
    toast(`Categorías normalizadas: ${res.updated||0} ítems actualizados`, 'ok');
  }catch(err){
    toast(friendlyError(err), 'err');
  }
}

async function normalizeTagsCanonicalPersist(){
  if(!requirePerm('categories.manage')) return;
  if(!await confirmDialog({message:'Esto normalizará los tags guardados en D1 (mayúsculas, tildes y variantes como ruedas/ruedas goma/ruedas coche). ¿Continuar?'})) return;
  try{
    const res = await apiPost({action:'normalizeTagsCanonical'});
    if(!res.ok) throw new Error(res.error);
    if(res.items) items = res.items;
    const seen = new Set();
    TAGS = (items || []).flatMap(itemTags)
      .map(t => String(t || '').trim())
      .filter(Boolean)
      .filter(t => {
        const k = t.toLowerCase();
        if(seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort(tagNameCompare);
    renderTagsList();
    fillTagSuggestions();
    if(cf) renderInv();
    toast(`Tags normalizados en D1: ${res.updated||0} ítems actualizados`, 'ok');
  }catch(err){
    toast('Error al normalizar tags: ' + err.message, 'err');
  }
}

// ═════════════════════════════════════════════════════════
// GESTIÓN DE TAGS
// ═════════════════════════════════════════════════════════
function renderTagsList(){
  const list = document.getElementById('tagsList');
  if(!list) return;
  const sorted = [...TAGS].sort(tagNameCompare);
  list.innerHTML = sorted.map(tag => {
    const id = encodeURIComponent(tag);
    const esc = tag.replace(/'/g,"\\'");
    return `<div class="tag-row" id="tagrow-${id}">
      <span class="tag-name">${escHtml(tag)}</span>
      <button class="tag-edit-btn" onclick="startTagEdit('${id}')" title="Renombrar">✏️</button>
      <button class="del-btn" onclick="removeTag('${esc}')" title="Eliminar">🗑</button>
    </div>`;
  }).join('');
}

function startTagEdit(encodedTag){
  const tag = decodeURIComponent(encodedTag);
  const row = document.getElementById('tagrow-' + encodedTag);
  if(!row) return;
  row.innerHTML = `
    <input class="tag-edit-input" value="${escHtml(tag)}"
      onkeydown="if(event.key==='Enter'){event.preventDefault();confirmTagRename('${encodedTag}',this.value)}else if(event.key==='Escape')renderTagsList()">
    <button class="tag-edit-btn ok" onclick="confirmTagRename('${encodedTag}',this.previousElementSibling.value)" title="Guardar">✓</button>
    <button class="del-btn" onclick="renderTagsList()" title="Cancelar">✕</button>`;
  row.querySelector('input')?.select();
}

async function confirmTagRename(encodedOldTag, newTagRaw){
  const oldTag = decodeURIComponent(encodedOldTag);
  const newTag = (newTagRaw || '').trim();
  if(!newTag){ toast('El tag no puede estar vacío','err'); return; }
  if(newTag.toLowerCase() === oldTag.toLowerCase()){ renderTagsList(); return; }
  if(TAGS.some(t => t.toLowerCase() === newTag.toLowerCase())){
    toast('Ya existe un tag con ese nombre','err'); return;
  }
  const idx = TAGS.findIndex(t => t.toLowerCase() === oldTag.toLowerCase());
  if(idx !== -1) TAGS[idx] = newTag;
  for(const item of items){
    if(!item.tags) continue;
    const ts = itemTags(item);
    let changed = false;
    const next = ts.map(t => { if(t.toLowerCase()===oldTag.toLowerCase()){changed=true;return newTag;} return t; });
    if(changed) item.tags = next.join(', ');
  }
  renderTagsList();
  fillTagSuggestions();
  if(cf) renderInv();
  try{
    const res = await apiPost({action:'renameTag', oldTag, newTag});
    if(!res.ok) throw new Error(res.error);
    if(res.items) items = res.items;
    toast(`"${oldTag}" → "${newTag}" (${res.updated||0} ítems actualizados)`,'ok');
  }catch(err){
    toast('Error al guardar en servidor: '+err.message,'err');
  }
}

function addTagRow(){
  const input = document.getElementById('newTagInput');
  const tag = (input?.value || '').trim();
  if(!tag){
    toast('Escribe el nombre del tag','err');
    return;
  }
  if(TAGS.includes(tag)){
    toast('Este tag ya existe','err');
    return;
  }
  if(tag.length > 50){
    toast('El tag no puede exceder 50 caracteres','err');
    return;
  }
  TAGS.push(tag);
  TAGS.sort(tagNameCompare);
  input.value = '';
  renderTagsList();
  fillTagSuggestions();
  toast(`Tag "${tag}" añadido`,'ok');
}

async function removeTag(tag){
  const idx = TAGS.findIndex(t => t.toLowerCase() === tag.toLowerCase());
  if(idx === -1) return;
  const usados = items.filter(x => itemTags(x).some(t => t.toLowerCase() === tag.toLowerCase())).length;
  if(usados > 0){
    if(!await confirmDialog({message:`Este tag se usa en ${usados} ítem(s). ¿Continuar con la eliminación?`})) return;
  }
  TAGS.splice(idx, 1);
  for(const item of items){
    if(!item.tags) continue;
    const ts = itemTags(item).filter(t => t.toLowerCase() !== tag.toLowerCase());
    item.tags = ts.join(', ');
  }
  renderTagsList();
  fillTagSuggestions();
  if(cf) renderInv();
  if(usados > 0){
    try{
      const res = await apiPost({action:'deleteTag', tag});
      if(!res.ok) throw new Error(res.error);
      if(res.items) items = res.items;
      toast(`Tag "${tag}" eliminado de ${res.updated||usados} ítem(s)`,'ok');
    }catch(err){
      toast('Error al guardar en servidor: '+err.message,'err');
    }
  } else {
    toast(`Tag "${tag}" eliminado`,'ok');
  }
}
