// ═════════════════════════════════════════════════════════
// MODAL ITEM
// ═════════════════════════════════════════════════════════
let modalHasChanges = false;
let modalOriginalValues = {};

function markModalAsChanged(){
  modalHasChanges = true;
  updateModalIndicator();
}

function updateModalIndicator(){
  const titleEl = document.getElementById('mT');
  if(!titleEl) return;
  if(modalHasChanges){
    if(!titleEl.dataset.hasIndicator){
      titleEl.innerHTML += ' <span style="color:var(--red);font-size:16px;margin-left:6px">●</span>';
      titleEl.dataset.hasIndicator = 'true';
    }
  } else {
    titleEl.innerHTML = titleEl.textContent.replace(/\s●\s*$/, '');
    delete titleEl.dataset.hasIndicator;
  }
}

function resetModalChanges(){
  modalHasChanges = false;
  updateModalIndicator();
}

function captureModalOriginalValues(){
  const fields = ['f_ref', 'f_aula', 'f_item', 'f_qty', 'f_min', 'f_tipo_material', 'f_cat', 'f_ciclo', 'f_mod', 'f_loc', 'f_est', 'f_util', 'f_proveedor', 'f_tags', 'f_fecha', 'f_mant', 'f_mantFecha', 'f_mantEstado', 'f_mantResp', 'f_mantNota', 'f_obs', 'f_es_contenedor', 'f_parent_id', 'f_foto'];
  modalOriginalValues = {};
  fields.forEach(field => {
    const el = document.getElementById(field);
    if(el){
      if(el.type === 'checkbox'){
        modalOriginalValues[field] = el.checked;
      } else {
        modalOriginalValues[field] = el.value;
      }
    }
  });
  attachModalChangeListeners();
}

function attachModalChangeListeners(){
  const fields = ['f_ref', 'f_aula', 'f_item', 'f_qty', 'f_min', 'f_tipo_material', 'f_cat', 'f_ciclo', 'f_mod', 'f_loc', 'f_est', 'f_util', 'f_proveedor', 'f_tags', 'f_fecha', 'f_mant', 'f_mantFecha', 'f_mantEstado', 'f_mantResp', 'f_mantNota', 'f_obs', 'f_es_contenedor', 'f_parent_id'];
  fields.forEach(field => {
    const el = document.getElementById(field);
    if(el){
      el.removeEventListener('change', checkModalForChanges);
      el.removeEventListener('input', checkModalForChanges);
      el.addEventListener('change', checkModalForChanges);
      el.addEventListener('input', checkModalForChanges);
    }
  });
}

function checkModalForChanges(){
  const fields = ['f_ref', 'f_aula', 'f_item', 'f_qty', 'f_min', 'f_tipo_material', 'f_cat', 'f_ciclo', 'f_mod', 'f_loc', 'f_est', 'f_util', 'f_proveedor', 'f_tags', 'f_fecha', 'f_mant', 'f_mantFecha', 'f_mantEstado', 'f_mantResp', 'f_mantNota', 'f_obs', 'f_es_contenedor', 'f_parent_id'];
  let hasChanges = false;

  for(let field of fields){
    const el = document.getElementById(field);
    if(!el) continue;
    const currentVal = el.type === 'checkbox' ? el.checked : el.value;
    if(currentVal !== modalOriginalValues[field]){
      hasChanges = true;
      break;
    }
  }

  if(hasChanges !== modalHasChanges){
    modalHasChanges = hasChanges;
    updateModalIndicator();
  }
}

function renderAulaOptions(list){
  const rows = list || AULAS;
  const opt = a=>`<option value="${a.id}">${escHtml(a.name)}</option>`;
  const globales = rows.filter(a=>!a.departamento);
  const propias = rows.filter(a=>a.departamento);
  if(!globales.length || !propias.length) return rows.map(opt).join('');
  return `<optgroup label="Aulas del centro">${globales.map(opt).join('')}</optgroup>`
       + `<optgroup label="Aula del departamento">${propias.map(opt).join('')}</optgroup>`;
}

function fillModalSelects(){
  document.getElementById('f_aula').innerHTML=renderAulaOptions();
  document.getElementById('f_ciclo').innerHTML='<option value="">Sin asignar</option>'+CICLOS.map(c=>`<option value="${c.id}" data-alias="${cicloAlias(c)}" data-full="${escHtml(c.icon+' '+c.name)}">${escHtml(c.icon+' '+c.name)}</option>`).join('');
  syncCicloLabels();
  document.getElementById('f_cat').innerHTML=sortedCatNames().map(c=>`<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('') + '<option value="__new_category__">＋ Añadir categoría...</option>';
  fillLocationSuggestions();
  fillTagSuggestions();
}

async function handleCatSelectChange(){
  const sel = document.getElementById('f_cat');
  if(sel.value !== '__new_category__') {
    sel.dataset.prev = sel.value;
    return;
  }
  const previous = sel.dataset.prev || sortedCatNames()[0] || '';
  if(!requirePerm('categories.manage', 'No tienes permisos para crear categorías')) {
    sel.value = previous;
    return;
  }
  const name = String(prompt('Nombre de la nueva categoría:') || '').trim();
  if(!name){
    sel.value = previous;
    return;
  }
  const exists = sortedCatNames().find(c => c.toLowerCase() === name.toLowerCase());
  if(exists){
    sel.value = exists;
    sel.dataset.prev = exists;
    toast('La categoría ya existe', 'ok');
    return;
  }
  const nextCats = Object.assign({}, CATS, { [name]: { i:'🏷️', c:'#6b7280', bg:'#f9fafb' } });
  const payload = sortedCatEntries(nextCats).map(([catName, v], i)=>({ name:catName, c:v.c, bg:v.bg, i:v.i, orden:i+1 }));
  try{
    const res = await apiPost({ action:'catsSync', cats:payload });
    if(!res.ok) throw new Error(res.error);
    setCatsFromEntries(sortedCatEntries(nextCats));
    fillModalSelects();
    sel.value = name;
    sel.dataset.prev = name;
    fillCatFilter();
    if(typeof renderHome === 'function') renderHome();
    toast('Categoría añadida', 'ok');
  }catch(err){
    sel.value = previous;
    toast('Error al crear categoría: ' + err.message, 'err');
  }
}

function fillLocationSuggestions(){
  const list = document.getElementById('locList');
  if(!list) return;
  const seen = new Set();
  const locs = [...(UBICACIONES || []).map(u => u.name), ...(items || []).map(x => x.loc)]
    .map(x => String(x || '').trim())
    .filter(Boolean)
    .filter(loc => {
      const key = loc.toLowerCase();
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a,b) => a.localeCompare(b, 'es', { sensitivity:'base' }));
  list.innerHTML = locs.map(loc => `<option value="${escHtml(loc)}"></option>`).join('');
}

function fillTagSuggestions(){
  const list = document.getElementById('tagList');
  if(!list) return;
  const seen = new Set();
  const tags = [...(TAGS || []), ...(items || []).flatMap(itemTags)]
    .map(x => String(x || '').trim())
    .filter(Boolean)
    .filter(tag => {
      const key = tag.toLowerCase();
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(tagNameCompare);
  list.innerHTML = tags.map(tag => `<option value="${escHtml(tag)}"></option>`).join('');
}

function cleanTag(tag){
  return String(tag || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-áéíóúñàèìòù]/gi, '')
    .trim()
    .substring(0, 50);
}

function _normTag(s){
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^\w\s]/g,' ').replace(/\s+/g,' ').trim();
}

function _trigrams(s){
  const set = new Set();
  if(s.length < 3){ set.add(s); return set; }
  for(let i=0;i<s.length-2;i++) set.add(s.slice(i,i+3));
  return set;
}

function tagTrigramSimilarity(a, b){
  const ta = _trigrams(_normTag(a));
  const tb = _trigrams(_normTag(b));
  if(!ta.size || !tb.size) return 0;
  const inter = [...ta].filter(g => tb.has(g)).length;
  return inter / (ta.size + tb.size - inter);
}

function findCanonicalTag(typed){
  if(!typed || !TAGS.length) return null;
  const normTyped = _normTag(typed);
  const exact = TAGS.find(t => _normTag(t) === normTyped);
  if(exact && exact !== typed) return exact;
  let best = null, bestScore = 0;
  for(const candidate of TAGS){
    const score = tagTrigramSimilarity(typed, candidate);
    if(score > bestScore){ bestScore = score; best = candidate; }
  }
  return bestScore >= 0.65 && best !== typed ? best : null;
}

function initTagsAutocomplete(){
  const input = document.getElementById('f_tags');
  if(!input) return;
  input.addEventListener('input', () => {
    fillTagSuggestions();
    showTagsDropdown();
  });
  input.addEventListener('blur', () => {
    setTimeout(() => hideTagsDropdown(), 150);
    const val = input.value.trim();
    if(val){
      const tags = val.split(',').map(cleanTag).filter(Boolean);
      const normalized = [];
      const changed = [];
      for(const t of tags){
        const canon = findCanonicalTag(t);
        if(canon){ normalized.push(canon); changed.push(`"${t}" → "${canon}"`); }
        else normalized.push(t);
      }
      const newTags = normalized.filter(t => !TAGS.includes(t) && t.length > 0);
      if(newTags.length){
        TAGS.push(...newTags);
        TAGS.sort(tagNameCompare);
        fillTagSuggestions();
      }
      input.value = normalized.join(', ');
      if(changed.length) toast(`Tag normalizado: ${changed.join(', ')}`, 'ok');
    }
  });
  input.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') e.preventDefault();
  });
}

function showTagsDropdown(){
  const input = document.getElementById('f_tags');
  if(!input) return;
  const val = (input.value || '').split(',').pop().trim().toLowerCase();
  const dd = document.getElementById('tagsDropdown');
  if(!dd) return;

  const suggestions = val
    ? TAGS.filter(t => t.toLowerCase().includes(val)).slice(0, 8)
    : TAGS.slice(0, 8);

  if(!suggestions.length){
    dd.style.display = 'none';
    return;
  }

  dd.innerHTML = suggestions.map(tag => `
    <div class="dd-item" onclick="addTagFromDropdown('${tag.replace(/'/g, '\\\'')}')">
      ${escHtml(tag)}
    </div>
  `).join('');
  dd.style.display = 'block';
}

function hideTagsDropdown(){
  const dd = document.getElementById('tagsDropdown');
  if(dd) dd.style.display = 'none';
}

function addTagFromDropdown(tag){
  const input = document.getElementById('f_tags');
  if(!input) return;
  const parts = input.value.split(',');
  parts[parts.length - 1] = tag;
  input.value = parts.join(', ');
  input.focus();
  hideTagsDropdown();
}

function viewPhotoModal(){
  const src = document.getElementById('f_foto')?.value;
  if(!src) return;
  const modal = document.getElementById('mPhotoView');
  if(!modal) return;
  document.getElementById('photoViewImg').src = src;
  modal.classList.add('open');
}

function closePhotoModal(){
  document.getElementById('mPhotoView')?.classList.remove('open');
}

function openPrintQrModal(){
  const data = typeof getFiltered === 'function' ? getFiltered() : items;
  if(!data || !data.length){
    toast('No hay ítems para imprimir','err');
    return;
  }
  document.getElementById('mPrintQr').classList.add('open');
}

function closePrintQrModal(){
  document.getElementById('mPrintQr').classList.remove('open');
}

function printFromModal(type){
  closePrintQrModal();
  const data = typeof getFiltered === 'function' ? getFiltered() : items;
  if(!data || !data.length){
    toast('No hay ítems para imprimir','err');
    return;
  }
  if(type === 'items'){
    printBulkItemQrs();
  } else if(type === 'qr'){
    printCompactQrCodes();
  }
}

function printCompactQrCodes(){
  const data = (typeof getFiltered === 'function' ? getFiltered() : items).filter(x=>x?.id);
  if(!data.length){ toast('No hay ítems para imprimir','err'); return; }
  const titulo = cf?.label || 'Inventario';
  const fecha = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'});
  const labels = data.map(it => `<article class="qr-label">
      <img src="${qrSrc(itemUrl(it.id),120)}" alt="QR">
      <span class="qr-code">${escHtml(itemCode(it))}</span>
    </article>`).join('');
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>QR ${escHtml(titulo)}</title>
  <style>
    @page{size:A4;margin:8mm}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;margin:0;color:#111;padding:0}
    .head{margin:0 0 6mm;border-bottom:1px solid #ddd;padding-bottom:3mm}
    .head h1{font-size:16px;margin:0 0 2px}
    .head p{font-size:10px;margin:0;color:#666}
    .sheet{display:grid;grid-template-columns:repeat(6,1fr);gap:3mm}
    .qr-label{border:1px solid #ddd;border-radius:3px;padding:2.5mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1mm;break-inside:avoid;page-break-inside:avoid}
    img{width:15mm;height:15mm}
    .qr-code{font-size:7px;font-weight:700;text-align:center;word-break:break-all;line-height:1.2}
  </style></head><body>
    <header class="head">
      <h1>Códigos QR · ${escHtml(titulo)}</h1>
      <p>${data.length} códigos · ${escHtml(fecha)}</p>
    </header>
    <main class="sheet">${labels}</main>
    <script>
      const imgs=[...document.images];
      Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r;})))
        .then(()=>setTimeout(()=>print(),150));
    <\/script>
  </body></html>`;
  const w = window.open('','_blank');
  if(!w){ toast('El navegador ha bloqueado la ventana de impresión','err'); return; }
  w.document.write(html);
  w.document.close();
}

const QR_SIMPLE_FIELDS = [
  { key:'item', label:'Nombre',     default:true  },
  { key:'aula', label:'Aula',       default:false },
  { key:'loc',  label:'Ubicación',  default:false },
  { key:'qty',  label:'Stock',      default:false },
  { key:'ref',  label:'Referencia', default:false },
  { key:'mod',  label:'Asignatura/Módulo', default:false },
];
const QR_SIMPLE_KEY = 'inv_qr_simple_fields';
const QR_SIMPLE_TIPO_KEY = 'inv_qr_simple_tipo';

function _getQrSimpleFields(){
  try{
    const saved = JSON.parse(localStorage.getItem(QR_SIMPLE_KEY));
    if(saved && typeof saved === 'object') return saved;
  }catch(e){}
  return Object.fromEntries(QR_SIMPLE_FIELDS.map(f=>[f.key, f.default]));
}

function openQrSimpleModal(){
  closePrintQrModal();
  const data = typeof getFiltered === 'function' ? getFiltered() : items;
  if(!data || !data.length){ toast('No hay ítems para imprimir','err'); return; }
  const sel = _getQrSimpleFields();
  const grid = document.getElementById('qrSimpleFields');
  grid.innerHTML = QR_SIMPLE_FIELDS.map(f=>`
    <label class="print-col-item">
      <input type="checkbox" id="qrf_${f.key}" ${sel[f.key]?'checked':''}>
      <span>${f.label}</span>
    </label>`).join('');
  const tipoSel = document.getElementById('qrSimpleTipo');
  if(tipoSel) tipoSel.value = localStorage.getItem(QR_SIMPLE_TIPO_KEY) || 'all';
  document.getElementById('mQrSimple').classList.add('open');
}

function closeQrSimpleModal(){
  document.getElementById('mQrSimple').classList.remove('open');
}

function printQrSimpleFromModal(){
  const sel = Object.fromEntries(QR_SIMPLE_FIELDS.map(f=>[f.key, document.getElementById('qrf_'+f.key)?.checked ?? f.default]));
  localStorage.setItem(QR_SIMPLE_KEY, JSON.stringify(sel));
  const tipo = document.getElementById('qrSimpleTipo')?.value || 'all';
  localStorage.setItem(QR_SIMPLE_TIPO_KEY, tipo);
  closeQrSimpleModal();
  printBulkQrLabels(sel, tipo);
}

function printBulkQrLabels(fields, tipo){
  const sel = fields || _getQrSimpleFields();
  const tipoFiltro = tipo || 'all';
  let data = typeof getFiltered === 'function' ? getFiltered() : items;
  if(tipoFiltro !== 'all'){
    data = data.filter(x => materialType(x) === tipoFiltro);
  }
  if(!data.length){
    toast('No hay ítems de ese tipo para imprimir','err');
    return;
  }
  const titulo = cf?.label || 'Inventario';
  const fecha = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'});
  const labels = data.map(it => {
    const url = itemUrl(it.id);
    const code = itemCode(it);
    const lines = [];
    if(sel.ref && it.ref) lines.push(escHtml(it.ref));
    if(sel.item && it.item) lines.push(escHtml(it.item));
    if(sel.aula){ const a = AULAS.find(a=>a.id===it.aula)?.name || it.aula; if(a) lines.push(escHtml(a)); }
    if(sel.loc && it.loc) lines.push(escHtml(it.loc));
    if(sel.qty && it.qty != null && it.qty !== '') lines.push('Stock: ' + escHtml(it.qty));
    if(sel.mod){ const m = findModulo(it.mod); if(m) lines.push(escHtml(m.cod)); }
    const extra = lines.length ? `<span class="qr-extra">${lines.join('<br>')}</span>` : '';
    return `<article class="qr-label">
      <img src="${qrSrc(url,140)}" alt="QR">
      <span class="qr-code">${escHtml(code)}</span>
      ${extra}
    </article>`;
  }).join('');
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>QR ${escHtml(titulo)}</title>
  <style>
    @page{size:A4;margin:8mm}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;margin:0;color:#111;padding:0}
    .head{margin:0 0 6mm;border-bottom:1px solid #ddd;padding-bottom:3mm}
    .head h1{font-size:16px;margin:0 0 2px}
    .head p{font-size:10px;margin:0;color:#666}
    .sheet{display:grid;grid-template-columns:repeat(5,1fr);gap:4mm}
    .qr-label{border:1px solid #ddd;border-radius:3px;padding:3mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:1.5mm;break-inside:avoid;page-break-inside:avoid}
    img{width:18mm;height:18mm}
    .qr-code{font-size:8px;font-weight:700;text-align:center;word-break:break-all;line-height:1.2}
    .qr-extra{font-size:7px;text-align:center;color:#333;line-height:1.25;word-break:break-word}
  </style></head><body>
    <header class="head">
      <h1>Códigos QR · ${escHtml(titulo)}</h1>
      <p>${data.length} códigos · ${escHtml(fecha)}</p>
    </header>
    <main class="sheet">${labels}</main>
    <script>
      const imgs=[...document.images];
      Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r;})))
        .then(()=>setTimeout(()=>print(),150));
    <\/script>
  </body></html>`;
  const w = window.open('','_blank');
  if(!w){ toast('El navegador ha bloqueado la ventana de impresión','err'); return; }
  w.document.write(html);
  w.document.close();
}

function updateModSelect(){
  const cId = document.getElementById('f_ciclo').value;
  const sel = document.getElementById('f_mod');
  if(!cId){ sel.innerHTML='<option value="">Sin asignar</option>'; return; }
  const c = CICLOS.find(x=>x.id===cId);
  sel.innerHTML='<option value="">Sin asignar</option>'+c.modulos.map(m=>`<option value="${cId}__${m.cod}">${m.name}</option>`).join('');
}

// Muestra el nombre completo en la lista desplegable, pero la abreviatura en el campo cerrado.
function syncCicloLabels(){
  const sel = document.getElementById('f_ciclo');
  if(!sel) return;
  const isMobile = () => window.innerWidth <= 600;
  const collapse = () => {
    Array.from(sel.options).forEach(o=>{ if(o.dataset.full) o.textContent = o.dataset.full; });
    if(isMobile()){
      const o = sel.selectedOptions[0];
      if(o && o.dataset.alias) o.textContent = o.dataset.alias;
    }
  };
  const expand = () => Array.from(sel.options).forEach(o=>{ if(o.dataset.full) o.textContent = o.dataset.full; });
  if(!sel._aliasBound){
    sel.addEventListener('mousedown', expand);
    sel.addEventListener('focus', expand);
    sel.addEventListener('blur', collapse);
    sel.addEventListener('change', collapse);
    sel._aliasBound = true;
  }
  collapse();
}

function itemUrl(id){
  const base = location.protocol.startsWith('http')
    ? location.origin + location.pathname.replace(/index\.html$/,'')
    : 'https://inventarioelec.pages.dev/';
  return base.replace(/#.*$/,'') + '#item/' + encodeURIComponent(itemCode(id) || id);
}

function itemCode(itemOrId){
  const item = typeof itemOrId === 'object' ? itemOrId : items.find(x=>String(x.id)===String(itemOrId));
  if(item?.code) return String(item.code).trim().toUpperCase();
  const id = typeof itemOrId === 'object' ? itemOrId?.id : itemOrId;
  const n = Number(id);
  if(Number.isFinite(n) && n > 0) return 'IB-' + String(n).padStart(5, '0');
  const raw = String(id || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return raw ? 'IB-' + raw.slice(0, 8) : '';
}

function qrSrc(text, size=220){
  return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size +
    '&margin=10&data=' + encodeURIComponent(text);
}

function escHtml(v){
  return String(v ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
}

function renderItemQr(item){
  const box = document.getElementById('itemQrBox');
  const btnContainer = document.getElementById('qrButtonContainer');
  if(!box) return;
  
  // Nunca mostrar el cuadro QR grande en el modal
  box.style.display = 'none';
  
  // Solo mostrar el botón pequeño si es un item existente
  if(!item?.id){
    if(btnContainer) btnContainer.style.display = 'none';
    return;
  }
  if(btnContainer) btnContainer.style.display = 'flex';
}

let _quickQrItemId = null;

function openItemQr(id){
  const item = items.find(x=>Number(x.id)===Number(id));
  if(!item) return;
  _quickQrItemId = item.id;
  const url = itemUrl(item.id);
  const code = itemCode(item);
  document.getElementById('quickQrImg').src = qrSrc(url);
  document.getElementById('quickQrTitle').textContent = `${code} · ${item.ref ? item.ref+' · ' : ''}${item.item}`;
  document.getElementById('quickQrUrl').textContent = url;
  document.getElementById('mItemQr').classList.add('open');
}

function closeItemQr(){
  document.getElementById('mItemQr')?.classList.remove('open');
}

async function copyQuickItemQrUrl(){
  const url = document.getElementById('quickQrUrl')?.textContent || '';
  if(!url) return;
  try{
    await navigator.clipboard.writeText(url);
    toast('Enlace del ítem copiado','ok');
  }catch(e){
    prompt('Copia el enlace del ítem:', url);
  }
}

function printQuickItemQr(){
  if(!_quickQrItemId) return;
  printItemQr(_quickQrItemId);
}

function renderMainPhoto(src){
  const input = document.getElementById('f_foto');
  const preview = document.getElementById('f_foto_preview');
  if(input) input.value = src || '';
  if(!preview) return;
  preview.innerHTML = src ? `<img src="${src}" alt="Foto principal">` : '<span>📷</span>';
  preview.classList.toggle('has-photo', !!src);
}

function isMaintenanceMarked(item){
  return item?.mant === true || item?.mant === 1 || String(item?.mant || '').trim() === '1' || item?.est === 'Avería';
}

function fillMaintenanceResponsibles(){
  const list = document.getElementById('mantRespList');
  if(!list) return;
  list.innerHTML = profesores
    .map(p => p.nombre ? `<option value="${escHtml(p.nombre)}">${escHtml(p.departamento || '')}</option>` : '')
    .join('');
}

function toggleMaintFields(){
  const checked = document.getElementById('f_mant')?.checked;
  const box = document.getElementById('maintFields');
  if(box) box.classList.toggle('show', !!checked);
  if(checked){
    const fecha = document.getElementById('f_mantFecha');
    const estado = document.getElementById('f_mantEstado');
    if(fecha && !fecha.value) fecha.value = new Date().toISOString().split('T')[0];
    if(estado && !estado.value) estado.value = 'Pendiente';
  }
}

function setMainPhotoFromFile(file){
  if(!file || !file.type.startsWith('image/')) return Promise.resolve(false);
  const MAX = 360, QUALITY = 0.45;
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if(w > MAX || h > MAX){
        if(w >= h){ h = Math.round(h*MAX/w); w = MAX; }
        else       { w = Math.round(w*MAX/h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      renderMainPhoto(canvas.toDataURL('image/jpeg', QUALITY));
      resolve(true);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    img.src = url;
  });
}

function fotoFileChanged(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  setMainPhotoFromFile(file).then(ok => {
    if (!ok) toast('No se pudo cargar la imagen', 'err');
    input.value = '';
  });
}

function fotoPreviewClick() {
  const src = document.getElementById('f_foto')?.value;
  if (src) viewPhotoModal();
  else document.getElementById('f_foto_file')?.click();
}

function fillParentSelect(currentId){
  const sel = document.getElementById('f_parent_id');
  if(!sel) return;
  const contenedores = items.filter(x => x.es_contenedor && Number(x.id) !== Number(currentId));
  sel.innerHTML = '<option value="">— Sin caja padre —</option>' +
    contenedores.map(x => `<option value="${x.id}">${x.ref ? x.ref+' · ' : ''}${x.item}</option>`).join('');
}

function toggleContenedorFields(){
  const esContenedor = document.getElementById('f_es_contenedor')?.checked;
  const tipo = document.getElementById('f_tipo_material');
  const parentRow = document.getElementById('f_parent_row');
  const hijosRow = document.getElementById('f_contenedor_hijos');
  if(parentRow) parentRow.style.display = esContenedor ? 'none' : '';
  if(hijosRow) hijosRow.style.display = esContenedor ? '' : 'none';
  if(esContenedor){
    if(tipo) tipo.value = 'inventariable';
    const sel = document.getElementById('f_parent_id');
    if(sel) sel.value = '';
    const srch = document.getElementById('f_hijos_search');
    if(srch) srch.value = '';
    renderHijosList();
  }
}

function renderHijosList(){
  const list = document.getElementById('f_hijos_list');
  if(!list) return;
  const q = (document.getElementById('f_hijos_search')?.value || '').toLowerCase().trim();
  // Todos los ítems candidatos: no contenedores, no la propia caja
  const candidatos = items
    .filter(x => !x.es_contenedor && Number(x.id) !== Number(eid))
    .filter(x => !q || x.item.toLowerCase().includes(q) || (x.ref||'').toLowerCase().includes(q))
    .sort((a,b) => {
      const aEs = Number(a.parent_id) === Number(eid);
      const bEs = Number(b.parent_id) === Number(eid);
      if(aEs !== bEs) return aEs ? -1 : 1;
      return String(a.item||'').localeCompare(String(b.item||''));
    });
  if(!candidatos.length){
    list.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:8px">Sin resultados</div>';
    return;
  }
  list.innerHTML = candidatos.map(x => {
    const enCaja = eid && x.parent_id && Number(x.parent_id) === Number(eid);
    const otraCaja = x.parent_id && Number(x.parent_id) && !enCaja ? items.find(p=>Number(p.id)===Number(x.parent_id)) : null;
    return `<label style="display:flex;align-items:center;gap:8px;padding:5px 4px;border-bottom:1px solid var(--border);cursor:pointer;font-size:13px">
      <input type="checkbox" data-hijo-id="${x.id}" ${enCaja?'checked':''} style="width:16px;height:16px;flex-shrink:0">
      <span style="flex:1">
        <span style="font-weight:${enCaja?'600':'400'}">${x.item}</span>
        <span style="color:var(--muted);font-size:11px"> ${x.ref ? '· '+x.ref : ''} · ${x.qty} ud.</span>
        ${otraCaja ? `<span style="font-size:10px;color:#b45309;margin-left:4px">(en: ${otraCaja.item})</span>` : ''}
      </span>
    </label>`;
  }).join('');
}

async function saveHijosCaja(){
  if(!eid){ toast('Guarda primero la caja','err'); return; }
  const checks = document.querySelectorAll('#f_hijos_list input[data-hijo-id]');
  const btn = document.querySelector('#f_contenedor_hijos .btn-loan');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    const batch = [];
    for(const chk of checks){
      const hijoId = Number(chk.dataset.hijoId);
      const hijo = items.find(x=>Number(x.id)===hijoId);
      if(!hijo) continue;
      const nuevoParent = chk.checked ? Number(eid) : null;
      if(Number(hijo.parent_id||0) === Number(nuevoParent||0)) continue;
      batch.push({ hijo, nuevoParent });
    }
    for(const { hijo, nuevoParent } of batch){
      const updated = { ...hijo, parent_id: nuevoParent };
      const res = await apiPost({ action:'update', item: updated });
      if(!res.ok) throw new Error(res.error);
      const idx = items.findIndex(x=>Number(x.id)===Number(hijo.id));
      items[idx] = updated;
    }
    renderHijosList();
    toast(`Componentes de la caja actualizados`,'ok');
  } catch(e){ toast('Error: '+e.message,'err'); }
  finally { btn.disabled=false; btn.textContent='💾 Guardar selección'; }
}

function setItemModalReadonly(readonly){
  const modal = document.querySelector('#mItem .modal');
  modal?.classList.toggle('item-readonly', !!readonly);
  ['f_ref','f_aula','f_item','f_qty','f_min','f_tipo_material','f_cat','f_ciclo','f_mod','f_loc','f_est','f_util','f_proveedor','f_tags','f_fecha','f_mant','f_mantFecha','f_mantEstado','f_mantResp','f_mantNota','f_obs','f_es_contenedor','f_parent_id']
    .forEach(id => {
      const el = document.getElementById(id);
      if(el) el.disabled = !!readonly;
    });
}

function openModal(id=null, src=null){
  const existing = id !== null && id !== undefined;
  if(!existing && !requirePerm('items.write')) return;
  if(existing && !SESSION) return;
  eid=id; fillModalSelects();
  modalHasChanges = false;
  updateModalIndicator();
  const m = existing ? items.find(x=>Number(x.id)===Number(id)) : src;
  if(existing && !m) return;
  const readonly = existing && !can('items.write');
  fillMaintenanceResponsibles();
  initTagsAutocomplete();
  document.getElementById('mT').textContent = existing ? (readonly ? 'Ver ítem' : 'Editar ítem') : src ? '📋 Duplicar ítem' : 'Nuevo ítem';
  document.getElementById('f_ref').value = id ? (m?.ref||'') : '';
  document.getElementById('f_aula').value=m?.aula||(cf?.type==='aula'?cf.id:AULAS[0]?.id);
  document.getElementById('f_item').value=m?.item||'';
  renderMainPhoto(m?.foto||'');
  document.getElementById('f_qty').value = id ? (m?.qty??1) : 1;
  document.getElementById('f_min').value=m?.min??0;
  document.getElementById('f_tipo_material').value=materialType(m || src || {});
  const catSel = document.getElementById('f_cat');
  catSel.value=m?.cat||sortedCatNames()[0]||'Componentes electrónicos';
  catSel.dataset.prev = catSel.value;
  const ownCiclos = CICLOS.filter(c=>c.id!=='iesjuanbosco');
  const itemCiclo = m?.mod ? m.mod.split('__')[0]
    : cf?.type==='mod' ? cf.ciclo.id
    : (!existing && !src && ownCiclos.length===1) ? ownCiclos[0].id
    : '';
  document.getElementById('f_ciclo').value = itemCiclo;
  syncCicloLabels();
  updateModSelect();
  document.getElementById('f_mod').value = m?.mod || (cf?.type==='mod'?cf.id:'');
  document.getElementById('f_loc').value=m?.loc||'';
  document.getElementById('f_est').value=m?.est||'Bueno';
  document.getElementById('f_util').value=m?.util||'';
  document.getElementById('f_proveedor').value=m?.proveedor||'';
  document.getElementById('f_tags').value=m?.tags||'';
  document.getElementById('f_fecha').value=m?.fecha||new Date().toISOString().split('T')[0];
  document.getElementById('f_mant').checked=isMaintenanceMarked(m);
  document.getElementById('f_mantFecha').value=m?.mantFecha||'';
  document.getElementById('f_mantEstado').value=m?.mantEstado||'Pendiente';
  document.getElementById('f_mantResp').value=m?.mantResp||'';
  document.getElementById('f_mantNota').value=m?.mantNota||'';
  toggleMaintFields();
  document.getElementById('f_obs').value=m?.obs||'';
  const esContenedor = m?.es_contenedor == 1 || m?.es_contenedor === true;
  document.getElementById('f_es_contenedor').checked = esContenedor;
  fillParentSelect(id);
  document.getElementById('f_parent_id').value = m?.parent_id || '';
  toggleContenedorFields();
  if(esContenedor && existing){ renderHijosList(); }
  initDocSection(id);
  renderItemQr(existing ? m : null);
  setItemModalReadonly(readonly);
  const btnH = document.getElementById('btnHistorial');
  if (btnH) btnH.style.display = existing ? '' : 'none';
  document.getElementById('mItem').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.body.dataset.scrollY = window.scrollY;

  resetModalChanges();
  captureModalOriginalValues();
  
  // Auto-focus en nombre para escribir directo
  setTimeout(() => document.getElementById('f_item').focus(), 0);
}

function duplicateItem(id){
  if(!requirePerm('items.write')) return;
  const src = items.find(x=>x.id===id);
  if(src) openModal(null, src);
}

function _autoRef(name){
  const esContenedor = document.getElementById('f_es_contenedor')?.checked;
  const clean = name.normalize('NFD').split('').filter(c=>c.charCodeAt(0)<0x300||c.charCodeAt(0)>0x36F).join('');
  const short = clean.replace(/[^a-zA-Z]/g,'').slice(0,3).toUpperCase();
  if(!short) return '';
  const prefix = esContenedor ? 'CONT-' + short : short.charAt(0).toUpperCase() + short.slice(1).toLowerCase();
  const pat = esContenedor
    ? new RegExp('^CONT-' + short + '-\\d+$')
    : new RegExp('^' + prefix + '-\\d+$');
  const nums = items.filter(x=>x.id!==eid).map(x=>x.ref||'').filter(r=>pat.test(r)).map(r=>parseInt(r.split('-').pop())||0);
  return prefix + '-' + (nums.length ? Math.max(...nums)+1 : 1);
}
function closeM(force=false){
  if(!force && modalHasChanges){
    if(!confirm('Hay cambios sin guardar. ¿Descartar cambios?')) return;
  }
  document.getElementById('mItem').classList.remove('open');
  document.body.style.overflow = '';
  const sy = parseInt(document.body.dataset.scrollY || '0', 10);
  window.scrollTo(0, sy);
  setItemModalReadonly(false);
  resetModalChanges();
}

async function copyItemQrUrl(){
  const url = document.getElementById('itemQrUrl')?.textContent || '';
  if(!url) return;
  try{
    await navigator.clipboard.writeText(url);
    toast('Enlace del ítem copiado','ok');
  }catch(e){
    prompt('Copia el enlace del ítem:', url);
  }
}

function printItemQr(itemId){
  if(itemId === undefined) itemId = eid;
  if(!itemId) return;
  const it = items.find(x=>Number(x.id)===Number(itemId));
  if(!it) return;
  const url = itemUrl(it.id);
  const code = itemCode(it);
  const aula = AULAS.find(a=>a.id===it.aula)?.name || it.aula || '';
  const mod = findModulo(it.mod);
  const title = `${code} · ${it.ref ? it.ref + ' · ' : ''}${it.item}`;
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>QR ${escHtml(it.ref || it.item)}</title>
  <style>
    @page{size:80mm 55mm;margin:6mm}
    body{font-family:Arial,sans-serif;margin:0;color:#111}
    .label{display:flex;gap:12px;align-items:center}
    img{width:132px;height:132px}
    h1{font-size:15px;margin:0 0 5px;line-height:1.2}
    .meta{font-size:11px;line-height:1.35;color:#333}
    .url{font-size:8px;line-height:1.25;color:#666;margin-top:7px;word-break:break-all}
  </style></head><body>
    <div class="label">
      <img src="${qrSrc(url,260)}" alt="QR">
      <div>
        <h1>${escHtml(title)}</h1>
        <div class="meta">${escHtml(aula)}${mod ? '<br>' + escHtml(mod.cod + ' · ' + mod.name) : ''}</div>
        <div class="url">${escHtml(code)} · ${escHtml(url)}</div>
      </div>
    </div>
    <script>const img=document.querySelector('img');img.onload=()=>setTimeout(()=>print(),100);<\/script>
  </body></html>`;
  const w = window.open('','_blank');
  if(!w){ toast('El navegador ha bloqueado la ventana de impresión','err'); return; }
  w.document.write(html);
  w.document.close();
}

function printBulkItemQrs(){
  const data = (typeof getFiltered === 'function' ? getFiltered() : items)
    .filter(x => x?.id);
  if(!data.length){
    toast('No hay ítems para imprimir QR','err');
    return;
  }
  const titulo = cf?.label || 'Inventario';
  const fecha = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'});
  const labels = data.map(it => {
    const url = itemUrl(it.id);
    const code = itemCode(it);
    const aula = AULAS.find(a=>a.id===it.aula)?.name || it.aula || '';
    const mod = findModulo(it.mod);
    const title = `${code} · ${it.ref ? it.ref + ' · ' : ''}${it.item || ''}`;
    return `<article class="label">
      <img src="${qrSrc(url,220)}" alt="QR">
      <div class="info">
        <h2>${escHtml(title)}</h2>
        <div class="meta">${escHtml(aula)}${mod ? '<br>' + escHtml(mod.cod + ' · ' + mod.name) : ''}</div>
        <div class="url">${escHtml(code)} · ${escHtml(url)}</div>
      </div>
    </article>`;
  }).join('');
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Etiquetas QR ${escHtml(titulo)}</title>
  <style>
    @page{size:A4;margin:10mm}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;margin:0;color:#111}
    .head{margin:0 0 8mm;border-bottom:1px solid #ddd;padding-bottom:4mm}
    .head h1{font-size:18px;margin:0 0 3px}
    .head p{font-size:11px;margin:0;color:#555}
    .sheet{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}
    .label{min-height:40mm;border:1px solid #d7dce5;border-radius:4px;padding:3mm;display:flex;flex-direction:column;gap:2mm;align-items:center;justify-content:center;text-align:center;break-inside:avoid;page-break-inside:avoid}
    img{width:20mm;height:20mm;flex:0 0 20mm}
    h2{font-size:9px;line-height:1.1;margin:0;overflow-wrap:anywhere;font-weight:600}
    .meta{font-size:7px;line-height:1.2;color:#555}
    .url{font-size:6px;line-height:1.1;color:#777;word-break:break-all}
  </style></head><body>
    <header class="head">
      <h1>Etiquetas QR · ${escHtml(titulo)}</h1>
      <p>IES El Bosco · ${data.length} etiquetas · ${escHtml(fecha)}</p>
    </header>
    <main class="sheet">${labels}</main>
    <script>
      const imgs=[...document.images];
      Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r;})))
        .then(()=>setTimeout(()=>print(),150));
    <\/script>
  </body></html>`;
  const w = window.open('','_blank');
  if(!w){ toast('El navegador ha bloqueado la ventana de impresión','err'); return; }
  w.document.write(html);
  w.document.close();
}

async function saveItem(){
  const name=document.getElementById('f_item').value.trim();
  if(!name){toast('El nombre es obligatorio','err');return}
  if(!document.getElementById('f_ciclo').value){toast('El ciclo/departamento es obligatorio','err');return}
  if(!document.getElementById('f_mod').value){toast('La asignatura/módulo es obligatoria','err');return}
  const refRaw = document.getElementById('f_ref').value.trim();
  const v={
    code: eid ? itemCode(items.find(x=>x.id===eid) || eid) : '',
    ref: refRaw || _autoRef(name),
    aula:document.getElementById('f_aula').value,
    item:name,
    foto:document.getElementById('f_foto').value,
    qty:parseInt(document.getElementById('f_qty').value)||0,
    min:parseInt(document.getElementById('f_min').value)||0,
    tipo_material: document.getElementById('f_tipo_material').value || 'inventariable',
    cat:document.getElementById('f_cat').value,
    mod:document.getElementById('f_mod').value,
    loc:document.getElementById('f_loc').value.trim(),
    est:document.getElementById('f_est').value,
    util:document.getElementById('f_util').value.trim(),
    proveedor:document.getElementById('f_proveedor').value.trim(),
    tags:document.getElementById('f_tags').value.trim(),
    fecha:document.getElementById('f_fecha').value,
    mant:document.getElementById('f_mant').checked ? '1' : '',
    mantFecha:document.getElementById('f_mantFecha').value,
    mantNota:document.getElementById('f_mantNota').value.trim(),
    mantResp:document.getElementById('f_mantResp').value.trim(),
    mantEstado:document.getElementById('f_mantEstado').value,
    obs:document.getElementById('f_obs').value.trim(),
    es_contenedor: document.getElementById('f_es_contenedor').checked ? 1 : 0,
    parent_id: document.getElementById('f_parent_id').value ? Number(document.getElementById('f_parent_id').value) : null,
  };
  const btn = document.getElementById('btnSave');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    if(eid){
      const item={...items.find(x=>x.id===eid),...v};
      const res = await apiPost({action:'update', item});
      if(!res.ok) throw new Error(res.error);
      const i=items.findIndex(x=>x.id===eid); items[i]=item;
      await uploadPendingDocs(eid, item.item, item.aula);
      if(typeof logHistorial === 'function') logHistorial('itemUpdate', item.id, item.item, `Item actualizado: ${item.item} (${item.ref || item.code || item.id})`);
      fillTagSuggestions();
      toast('Ítem actualizado','ok');
    } else {
      const res = await apiPost({action:'add', item:v});
      if(!res.ok) throw new Error(res.error);
      items.push(res.item);
      await uploadPendingDocs(res.item.id, res.item.item, res.item.aula);
      if(typeof logHistorial === 'function') logHistorial('itemAdd', res.item.id, res.item.item, `Item añadido: ${res.item.item} (${res.item.ref || res.item.code || res.item.id})`);
      fillTagSuggestions();
      toast('Ítem añadido','ok');
    }
    modalHasChanges = false;
    closeM(true);
    if(cf){
      const all = getBase();
      renderInvKeepPage();
      renderSubStats(all, all.filter(isLowStock).length);
    } else {
      renderHome();
    }
  } catch(err) { toast('Error: '+err.message,'err'); }
  finally { btn.disabled=false; btn.textContent='💾 Guardar'; }
}

// ═════════════════════════════════════════════════════════
// DELETE ITEM
// ═════════════════════════════════════════════════════════
let dId=null;
function confDel(id){
  if(!requirePerm('items.delete')) return;
  const it=items.find(x=>x.id===id);dId=id;
  document.getElementById('cTitle').textContent = '¿Eliminar ítem?';
  document.getElementById('cSub').textContent=`"${it?.item}" será eliminado permanentemente.`;
  document.getElementById('cOk').onclick = async () => {
    const btn = document.getElementById('cOk');
    btn.disabled = true; btn.textContent = '⏳';
    try {
      const res = await apiPost({action:'delete', id:dId});
      if(!res.ok) throw new Error(res.error);
      if(typeof logHistorial === 'function' && it) logHistorial('itemDelete', dId, it.item, `Item eliminado: ${it.item} (${it.ref || it.code || it.id})`);
      items = items.filter(x=>x.id!==dId);
      closeConf();
      if(cf){ const all=getBase(); renderInvKeepPage(); renderSubStats(all,all.filter(isLowStock).length); } else renderHome();
      toast('Ítem eliminado','ok');
    } catch(err) { toast('Error: '+err.message,'err'); }
    finally { btn.disabled=false; btn.textContent='Eliminar'; }
  };
  document.getElementById('mConf').classList.add('open');
}
function closeConf(){document.getElementById('mConf').classList.remove('open')}

// ═════════════════════════════════════════════════════════
// BAJA DE MATERIAL
// ═════════════════════════════════════════════════════════
let bajaId = null;

function openBaja(id){
  if(!requirePerm('items.write')) return;
  bajaId = id;
  const it = items.find(x=>x.id===id);
  if(!it) return;
  const qty = Number(it.qty)||0;
  const tipo = materialType(it);
  document.getElementById('bajaItemName').textContent = `${it.ref ? it.ref+' — ' : ''}${it.item}`;
  document.getElementById('bajaQtyActual').textContent = qty;
  document.getElementById('bajaCantidad').max = qty;
  document.getElementById('bajaCantidad').value = 1;
  document.getElementById('bajaMotivo').value = '';
  document.getElementById('bajaMotivo').placeholder = tipo === 'consumible'
    ? 'Ej: consumido en practicas, agotado, reposicion necesaria...'
    : 'Ej: equipo irreparable, obsoleto, perdido, sustituido...';
  document.getElementById('bajaFecha').value = new Date().toISOString().split('T')[0];
  updateBajaRestante();
  document.getElementById('mBaja').classList.add('open');
}

function updateBajaRestante(){
  const it = items.find(x=>x.id===bajaId);
  if(!it) return;
  const qty = Number(it.qty)||0;
  const cant = Math.min(Number(document.getElementById('bajaCantidad').value)||1, qty);
  const restante = qty - cant;
  const el = document.getElementById('bajaQtyRestante');
  el.textContent = restante;
  el.style.color = restante === 0 ? 'var(--red)' : 'var(--green)';
  document.getElementById('bajaNote').textContent = restante === 0
    ? '⚠ El ítem pasará a estado Baja (sin stock).'
    : `El ítem mantendrá ${restante} unidad${restante!==1?'es':''} en activo.`;
}

function closeBaja(){ document.getElementById('mBaja').classList.remove('open'); bajaId = null; }

async function saveBaja(){
  const motivo = document.getElementById('bajaMotivo').value.trim();
  if(!motivo){ toast('Escribe el motivo de la baja','err'); return; }
  const it = items.find(x=>x.id===bajaId);
  if(!it) return;
  const qty = Number(it.qty)||0;
  const cant = Math.min(Number(document.getElementById('bajaCantidad').value)||1, qty);
  if(cant < 1){ toast('La cantidad debe ser al menos 1','err'); return; }
  const fecha = document.getElementById('bajaFecha').value;
  const restante = qty - cant;
  const obsNuevo = `[BAJA ${fecha}: ${cant} ud.] ${motivo}${it.obs ? '\n'+it.obs : ''}`;
  const updated = {
    ...it,
    qty: restante,
    est: restante === 0 ? 'Baja' : it.est,
    fecha,
    obs: obsNuevo
  };
  const btn = document.getElementById('btnBaja');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try{
    const res = await apiPost({action:'update', item:updated});
    if(!res.ok) throw new Error(res.error);
    const idx = items.findIndex(x=>x.id===bajaId);
    items[idx] = updated;
    if(typeof logHistorial === 'function') logHistorial('itemBaja', updated.id, updated.item, `Baja de ${cant} unidad${cant!==1?'es':''}: ${updated.item}. Motivo: ${motivo}`);
    closeBaja();
    if(cf){ const all=getBase(); renderInvKeepPage(); renderSubStats(all,all.filter(isLowStock).length); } else renderHome();
    toast(restante===0 ? 'Ítem dado de baja completamente' : `${cant} unidad${cant!==1?'es':''} dada${cant!==1?'s':''} de baja · Quedan ${restante}`,'ok');
  }catch(err){ toast('Error: '+err.message,'err'); }
  finally{ btn.disabled=false; btn.textContent='⛔ Confirmar baja'; }
}

// ═════════════════════════════════════════════════════════
// SOLICITUD DE COMPRA (PEDIDOS)
// ═════════════════════════════════════════════════════════
let pedidos = JSON.parse(localStorage.getItem('inv_pedidos')||'{}');

function savePedidosLocal(){ localStorage.setItem('inv_pedidos', JSON.stringify(pedidos)); }

function isPedido(id){ return !!pedidos[id]; }

function updatePedBadge(){
  const n = Object.keys(pedidos).length;
  const badge = document.getElementById('pedBadge');
  if(!badge) return;
  badge.textContent = n;
  badge.style.display = n > 0 ? 'inline' : 'none';
}

function togglePedido(id){
  if(pedidos[id]){
    delete pedidos[id];
  } else {
    const it = items.find(x=>x.id===id);
    pedidos[id] = { qty: Math.max(1, (Number(it?.min)||1) - (Number(it?.qty)||0)), nota:'' };
    if(it) apiPost({action:'notificarPedido', item:{id:it.id, item:it.item, ref:it.ref, aula:AULAS.find(a=>a.id===it.aula)?.name||it.aula, qty:it.qty, min:it.min}}).catch(()=>{});
  }
  savePedidosLocal();
  updatePedBadge();
  if(cf) openSub(); else renderHome();
}

function openPedidos(){
  if(!requirePerm('orders.write')) return;
  renderPedidosList();
  document.getElementById('mPedidos').classList.add('open');
}
function closePedidos(){ document.getElementById('mPedidos').classList.remove('open'); }

function renderPedidosList(){
  const ids = Object.keys(pedidos);
  const el = document.getElementById('pedList');
  if(!ids.length){
    el.innerHTML=`<div class="ped-empty">🛒 No hay ítems en la lista de pedido.<br><span style="font-size:12px">Usa el botón 🛒 en cada ítem para añadirlos.</span></div>`;
    return;
  }
  el.innerHTML = ids.map(id=>{
    const it = items.find(x=>String(x.id)===String(id));
    if(!it) return '';
    const aula = AULAS.find(a=>a.id===it.aula)?.name||it.aula;
    return`<div class="ped-row">
      <div style="flex:1">
        <div class="ped-name">${it.item}</div>
        <div class="ped-meta">${it.ref?it.ref+' · ':''}${aula} · Stock actual: ${it.qty}</div>
        <input style="margin-top:6px;width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--white)" placeholder="Nota (opcional)" value="${pedidos[id].nota||''}" oninput="pedidos['${id}'].nota=this.value;savePedidosLocal()">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <span style="font-size:10px;color:var(--muted)">Cantidad</span>
        <input class="ped-qty" type="number" min="1" value="${pedidos[id].qty||1}" oninput="pedidos['${id}'].qty=Number(this.value)||1;savePedidosLocal()">
        <button class="ped-del" onclick="removePedido('${id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function removePedido(id){
  delete pedidos[id];
  savePedidosLocal();
  updatePedBadge();
  renderPedidosList();
  if(cf) openSub(); else renderHome();
}

function clearPedidos(){
  if(!confirm('¿Vaciar toda la lista de pedido?')) return;
  pedidos = {};
  savePedidosLocal();
  updatePedBadge();
  renderPedidosList();
  if(cf) openSub(); else renderHome();
}

function printPedidos(){
  const ids = Object.keys(pedidos);
  if(!ids.length){ toast('La lista de pedido está vacía','err'); return; }
  const fecha = new Date().toLocaleDateString('es-ES');
  const filas = ids.map(id=>{
    const it = items.find(x=>String(x.id)===String(id));
    if(!it) return '';
    const aula = AULAS.find(a=>a.id===it.aula)?.name||it.aula;
    return `<tr>
      <td>${it.ref||'—'}</td>
      <td><strong>${it.item}</strong></td>
      <td>${aula}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:center;font-weight:700">${pedidos[id].qty}</td>
      <td>${pedidos[id].nota||''}</td>
    </tr>`;
  }).join('');
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Solicitud de compra — ${fecha}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:13px}
    h1{font-size:20px;margin-bottom:4px}
    .sub{color:#666;font-size:12px;margin-bottom:24px}
    table{width:100%;border-collapse:collapse}
    th{background:#2563eb;color:#fff;padding:8px 10px;text-align:left;font-size:12px}
    td{padding:7px 10px;border-bottom:1px solid #e5e7eb}
    tr:nth-child(even) td{background:#f9fafb}
    .footer{margin-top:32px;font-size:11px;color:#999}
  </style></head><body>
  <h1>🛒 Solicitud de compra</h1>
  <div class="sub">IES Juan Bosco · Generado el ${fecha}</div>
  <table>
    <thead><tr><th>Ref.</th><th>Ítem</th><th>Aula</th><th>Stock actual</th><th>Cantidad a pedir</th><th>Nota</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="footer">Inventario Taller FP</div>
  </body></html>`;
  const w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
  w.print();
}

async function openHistorial(){
  if(!eid) return;
  const it = items.find(x=>Number(x.id)===Number(eid));
  document.getElementById('histModalTitle').textContent = `📋 Historial — ${it ? it.item : '#' + eid}`;
  document.getElementById('histBody').innerHTML = '<p style="color:var(--muted);text-align:center">Cargando...</p>';
  document.getElementById('mItemHistorial').classList.add('open');
  try {
    const res = await apiGet('historial', { itemId: eid });
    const logs = res.logs || [];
    if (!logs.length) {
      document.getElementById('histBody').innerHTML = '<p style="color:var(--muted);text-align:center">Sin historial para este ítem.</p>';
      return;
    }
    document.getElementById('histBody').innerHTML =
      `<table class="tw" style="width:100%">
        <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
        <tbody>${logs.map(l =>
          `<tr>
            <td style="white-space:nowrap;font-size:12px">${l.fecha}</td>
            <td style="font-size:13px">${l.usuario}</td>
            <td style="font-size:12px">${l.accion}</td>
            <td style="font-size:12px;word-break:break-word">${l.resumen}</td>
          </tr>`
        ).join('')}</tbody>
      </table>`;
  } catch (e) {
    document.getElementById('histBody').innerHTML = `<p style="color:var(--danger)">Error al cargar historial.</p>`;
  }
}

function closeHistorial(){
  document.getElementById('mItemHistorial').classList.remove('open');
}

// ── GENERAR UNIDADES ──────────────────────────────────────────
function toggleGenerarUnidades(){
  const panel = document.getElementById('genUnidadesPanel');
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : '';
  const refInput = document.getElementById('f_ref');
  if(!visible){
    const nombre = document.getElementById('f_item').value.trim();
    const prefijo = 'SET-' + nombre.slice(0,3).toUpperCase().replace(/[^A-Z]/g,'');
    document.getElementById('genUnidadesPrefijo').value = prefijo;
    // Forzar ref del padre y bloquear el campo para evitar conflictos
    refInput.value = prefijo + '-00';
    refInput.readOnly = true;
    refInput.style.opacity = '0.5';
    renderGenUnidadesTable();
  } else {
    // Al cancelar, restaurar el campo ref
    refInput.readOnly = false;
    refInput.style.opacity = '';
  }
}

function renderGenUnidadesTable(){
  const qty = Math.min(50, Math.max(1, Number(document.getElementById('genUnidadesQty').value) || 2));
  const prefijo = document.getElementById('genUnidadesPrefijo').value.trim() || 'UNIT';
  const nombre = document.getElementById('f_item').value.trim() || 'Unidad';
  const ESTADOS = ['Bueno','Deteriorado','Avería','Baja'];
  const container = document.getElementById('genUnidadesTable');
  // Conservar obs/estado ya introducidos si se re-renderiza
  // Mostrar ref del padre
  const padreRefEl = document.getElementById('genUnidadesPadreRef');
  if(padreRefEl) padreRefEl.textContent = `Padre: ${prefijo}-00 · Hijos: ${prefijo}-01 … ${prefijo}-${String(qty).padStart(2,'0')}`;

  const prev = {};
  container.querySelectorAll('tr[data-idx]').forEach(tr => {
    const i = tr.dataset.idx;
    prev[i] = {
      est: tr.querySelector('.gen-est')?.value || 'Bueno',
      obs: tr.querySelector('.gen-obs')?.value || ''
    };
  });
  let html = `<table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr style="background:var(--accent);color:#fff">
      <th style="padding:5px 8px;text-align:left;width:110px">Ref.</th>
      <th style="padding:5px 8px;text-align:left">Nombre</th>
      <th style="padding:5px 8px;text-align:left;width:120px">Estado</th>
      <th style="padding:5px 8px;text-align:left">Observaciones</th>
    </tr></thead><tbody>`;
  for(let i=1; i<=qty; i++){
    const n = String(i).padStart(2,'0');
    const ref = `${prefijo}-${n}`;
    const p = prev[i] || {est:'Bueno', obs:''};
    const opts = ESTADOS.map(e=>`<option${e===p.est?' selected':''}>${e}</option>`).join('');
    html += `<tr data-idx="${i}" style="border-bottom:1px solid var(--border)">
      <td style="padding:4px 8px;font-family:var(--mono);color:var(--muted)">${ref}</td>
      <td style="padding:4px 8px">${nombre} #${n}</td>
      <td style="padding:4px 6px"><select class="fi-w gen-est" style="font-size:11px;padding:3px 6px">${opts}</select></td>
      <td style="padding:4px 6px"><input class="fi-w gen-obs" type="text" placeholder="Nota opcional..." value="${escHtml(p.obs)}" style="font-size:11px;padding:3px 6px"></td>
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function saveGenerarUnidades(){
  const qty = Math.min(50, Math.max(1, Number(document.getElementById('genUnidadesQty').value) || 2));
  const prefijo = document.getElementById('genUnidadesPrefijo').value.trim() || 'SET-UNIT';
  const nombre = document.getElementById('f_item').value.trim();
  if(!nombre){ toast('El ítem padre necesita nombre','err'); return; }

  const rows = document.getElementById('genUnidadesTable').querySelectorAll('tr[data-idx]');
  const btn = document.querySelector('#genUnidadesPanel .btn-loan');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';

  try {
    let padreId = eid ? Number(eid) : null;
    let padre = padreId ? items.find(x=>Number(x.id)===padreId) : null;

    if(!padreId){
      // Padre aún no guardado — construir y guardar ahora
      const refPadre = `${prefijo}-00`;
      const v = {
        ref: refPadre,
        item: nombre,
        aula: document.getElementById('f_aula').value,
        mod: document.getElementById('f_mod').value,
        cat: document.getElementById('f_cat').value,
        loc: document.getElementById('f_loc').value.trim(),
        qty: parseInt(document.getElementById('f_qty').value)||0,
        min: parseInt(document.getElementById('f_min').value)||0,
        est: document.getElementById('f_est').value,
        obs: document.getElementById('f_obs').value.trim(),
        tags: document.getElementById('f_tags').value.trim(),
        proveedor: document.getElementById('f_proveedor').value.trim(),
        fecha: document.getElementById('f_fecha').value,
        tipo_material: 'inventariable',
        es_contenedor: 1,
        parent_id: null,
      };
      const r = await apiPost({action:'add', item:v});
      if(!r.ok) throw new Error(r.error);
      padre = {...v, id: r.item?.id || r.id};
      items.push(padre);
      padreId = padre.id;
      eid = padreId;
      document.getElementById('f_es_contenedor').checked = true;
      modalHasChanges = false;
      updateModalIndicator();
    } else {
      // Padre ya existe — actualizar ref a SET-XXX-00 y asegurar es_contenedor
      const padreUpd = {...padre, es_contenedor:1, tipo_material:'inventariable', ref:`${prefijo}-00`};
      const r = await apiPost({action:'update', item:padreUpd});
      if(!r.ok) throw new Error(r.error);
      const idx = items.findIndex(x=>Number(x.id)===padreId);
      items[idx] = padreUpd;
      padre = padreUpd;
      document.getElementById('f_es_contenedor').checked = true;
      document.getElementById('f_ref').value = padreUpd.ref;
    }

    let creados = 0;
    for(const row of rows){
      const i = row.dataset.idx;
      const n = String(i).padStart(2,'0');
      const est = row.querySelector('.gen-est')?.value || 'Bueno';
      const obs = row.querySelector('.gen-obs')?.value || '';
      const hijo = {
        ref: `${prefijo}-${n}`,
        item: `${nombre} #${n}`,
        aula: padre.aula,
        mod: padre.mod || '',
        cat: padre.cat || '',
        loc: padre.loc || '',
        qty: 1, min: 0,
        est, obs,
        tipo_material: 'inventariable',
        es_contenedor: 0,
        parent_id: padreId,
        tags: padre.tags || '',
        foto: padre.foto || '',
        fecha: new Date().toISOString().split('T')[0]
      };
      const r = await apiPost({action:'add', item:hijo});
      if(r.ok){
        items.push({...hijo, id: r.item?.id || r.id});
        creados++;
      }
    }

    const refInput = document.getElementById('f_ref');
    refInput.readOnly = false;
    refInput.style.opacity = '';
    toggleGenerarUnidades();
    renderHijosList();
    toast(`Padre + ${creados} unidades creadas correctamente`,'ok');
  } catch(e){ toast('Error: '+e.message,'err'); }
  finally { btn.disabled=false; btn.textContent='✅ Crear unidades'; }
}
