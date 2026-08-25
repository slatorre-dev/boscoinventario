// ═════════════════════════════════════════════════════════
// HISTORIAL DE BÚSQUEDAS RECIENTES (inventario)
// ═════════════════════════════════════════════════════════
const RECENT_SEARCH_KEY = 'inv_recent_searches';
function getRecentSearches(){
  try { return JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) || '[]'); } catch(e) { return []; }
}
function renderSearchHistory(){
  const dl = document.getElementById('srchHistoryList');
  if(!dl) return;
  dl.innerHTML = getRecentSearches().map(q=>`<option value="${String(q).replace(/"/g,'&quot;')}"></option>`).join('');
}
function saveRecentSearch(q){
  q = String(q||'').trim();
  if(q.length<2) return;
  let list = getRecentSearches().filter(x=>x.toLowerCase()!==q.toLowerCase());
  list.unshift(q);
  list = list.slice(0,5);
  localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(list));
  renderSearchHistory();
}
document.addEventListener('DOMContentLoaded', renderSearchHistory);

// ═════════════════════════════════════════════════════════
// BÚSQUEDA GLOBAL
// ═════════════════════════════════════════════════════════
let gsIdx=-1;
let _gsMatches=[];

const SEARCH_SINONIMOS = {
  'polimetro':              ['multimetro','tester','avometro'],
  'multimetro':             ['polimetro','tester','avometro'],
  'osciloscopio':           ['osci','oscilos'],
  'fuente de alimentacion': ['fuente tension','psu'],
  'soldador':               ['cautin','estacion de soldadura'],
  'protoboard':             ['breadboard','proto'],
  'condensador':            ['capacitor'],
  'resistencia':            ['resistor'],
  'transistor':             ['mosfet'],
  'cable':                  ['latigillo','latiguillo','jumper'],
  'pinza':                  ['pinza amperimetrica','amperimetro pinza'],
  'generador de funciones': ['generador senales'],
  'ordenador':              ['computador','portatil'],
  'pantalla':               ['monitor','display'],
  'tablet':                 ['tableta','ipad'],
  'raspberry':              ['raspi'],
  'arduino':                ['arduino uno','arduino mega','arduino nano'],
};

function normalizeStr(s){
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
}

// ≤2 chars: coincidencia exacta de palabra; ≥3 chars: subcadena dentro de palabra
function wordMatch(textWords, pattern){
  if(pattern.length<=2) return textWords.includes(pattern);
  return textWords.some(tw=>tw.includes(pattern));
}

function itemSearchText(x){
  const code = typeof itemCode === 'function' ? itemCode(x) : x.code;
  const aula = typeof AULAS !== 'undefined' ? (AULAS.find(a=>a.id===x.aula)?.name || x.aula) : x.aula;
  return [code, x.ref, x.item, aula, x.loc, x.proveedor, x.tags, x.serie].join(' ');
}

function fuzzyMatch(query, text){
  const q=normalizeStr(query);
  const textWords=normalizeStr(text).split(/\s+/).filter(w=>w);
  return q.split(/\s+/).filter(w=>w).every(qWord=>{
    if(wordMatch(textWords,qWord)) return true;
    for(const [canonical,aliases] of Object.entries(SEARCH_SINONIMOS)){
      const normCanon=normalizeStr(canonical);
      const allForms=[normCanon,...aliases.map(normalizeStr)];
      // solo activar el grupo si qWord coincide con una forma larga o es exactamente una forma corta
      const triggered=allForms.includes(qWord)||allForms.some(f=>f.length>2&&f.includes(qWord));
      if(triggered && allForms.some(form=>wordMatch(textWords,form))) return true;
    }
    return false;
  });
}

// Mejora 3: puntuación de relevancia para ordenar resultados
function scoreMatch(x, q){
  const nq=normalizeStr(q);
  const nname=normalizeStr(x.item||'');
  if(nname===nq) return 4;
  if(nname.startsWith(nq)) return 3;
  const qWords=nq.split(/\s+/).filter(w=>w);
  if(qWords.length && qWords.every(w=>nname.split(/\s+/).some(nw=>nw.includes(w)))) return 2;
  return 1;
}

function highlightText(text, query){
  const safe = escHtml(text);
  if(!query||!text) return safe;
  const words=normalizeStr(query).split(/\s+/).filter(w=>w.length>=2);
  if(!words.length) return safe;
  let result=safe.normalize('NFD');
  words.forEach(w=>{
    const pattern=w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').split('').map(c=>c+'[̀-ͯ]*').join('');
    result=result.replace(new RegExp(pattern,'gi'),m=>`<mark class="srch-hl">${m}</mark>`);
  });
  return result;
}

function extractItemLookup(raw){
  const value = String(raw || '').trim();
  if(!value) return '';
  const itemMatch = value.match(/(?:#|\/)item\/([^/?#\s]+)/i);
  return decodeURIComponent(itemMatch ? itemMatch[1] : value).trim();
}

function findItemByManualCode(raw){
  const lookup = extractItemLookup(raw);
  if(!lookup) return null;
  const norm = normalizeStr(lookup).replace(/[^a-z0-9]/g, '');
  return items.find(x => {
    const id = String(x.id || '');
    const code = typeof itemCode === 'function' ? itemCode(x) : (x.code || '');
    return normalizeStr(id).replace(/[^a-z0-9]/g, '') === norm ||
      normalizeStr(code).replace(/[^a-z0-9]/g, '') === norm ||
      normalizeStr(x.ref || '').replace(/[^a-z0-9]/g, '') === norm;
  }) || null;
}

function globalSearch(q){
  const res=document.getElementById('gsResults');
  const clr=document.getElementById('gsClear');
  q=q.trim();
  clr.style.display=q?'block':'none';
  if(q.length<2){res.classList.remove('open');gsIdx=-1;return;}
  const exact = findItemByManualCode(q);
  if(exact){
    res.innerHTML=`<div class="gsr-header">Código encontrado</div>
      <div class="gsr-item" tabindex="-1" role="option" data-idx="0" onclick="gsOpenItem('${String(exact.id).replace(/'/g,"\\'")}')">
        <span class="cpill" style="background:#eff6ff;color:#2563eb;flex-shrink:0;font-size:11px">${escHtml(typeof itemCode === 'function' ? itemCode(exact) : (exact.code || exact.id))}</span>
        <span class="gsr-name">${escHtml(exact.item)}</span>
        <span class="gsr-aula">📍 ${escHtml(AULAS.find(a=>a.id===exact.aula)?.name||exact.aula||'—')}</span>
        <span class="gsr-qty">${exact.qty}</span>
      </div>`;
    res.classList.add('open');
    gsIdx=-1;
    return;
  }
  _gsMatches=items.filter(x=>{
    return fuzzyMatch(q,itemSearchText(x));
  }).sort((a,b)=>scoreMatch(b,q)-scoreMatch(a,q));
  gsIdx=-1;
  if(!_gsMatches.length){
    const canCreate = typeof can === 'function' && can('items.write');
    res.innerHTML=`<div class="gsr-empty">Sin resultados para "<strong>${escHtml(q)}</strong>"</div>`
      +(canCreate ? `<div class="gsr-print-row"><button class="gsr-print-btn" onclick="gsCrearItemDesdeQuery('${q.replace(/'/g,"\\'")}')">➕ Crear ítem nuevo: "${escHtml(q)}"</button></div>` : '');
    res.classList.add('open');return;
  }
  const visible=_gsMatches.slice(0,14);
  res.innerHTML=`<div class="gsr-header">${_gsMatches.length} resultado${_gsMatches.length!==1?'s':''} encontrado${_gsMatches.length!==1?'s':''}</div>`
    +visible.map((x,i)=>{
      const cat=CATS[x.cat]||null;
      const aulaName=AULAS.find(a=>a.id===x.aula)?.name||x.aula||'—';
      const low=isLowStock(x);
      return`<div class="gsr-item" tabindex="-1" role="option" data-idx="${i}" onclick="gsGo('${x.aula}','${(x.item||'').replace(/'/g,"\\'")}')">
        ${cat?`<span class="cpill" style="background:${cat.bg};color:${cat.c};flex-shrink:0;font-size:11px">${escHtml(cat.i)}</span>`:'<span style="width:18px;flex-shrink:0"></span>'}
        <span class="gsr-name">${highlightText(x.item,q)}</span>
        <span class="gsr-aula">📍 ${escHtml(aulaName)}</span>
        <span class="gsr-qty ${low?'qlow':'qok'}">${x.qty}</span>
      </div>`;
    }).join('')
    +(_gsMatches.length>14?`<div class="gsr-more">+${_gsMatches.length-14} más — sigue escribiendo para filtrar</div>`:'')
    +`<div class="gsr-print-row">
        <button class="gsr-print-btn" onclick="gsSelectAll(event,'${q.replace(/'/g,"\\'")}')">☑️ Seleccionar todos (${_gsMatches.length})</button>
        <button class="gsr-print-btn" onclick="printGsResults(event,'${q.replace(/'/g,"\\'")}')">🖨️ Imprimir resultados (${_gsMatches.length})</button>
      </div>`;
  res.classList.add('open');
}

function gsKey(e){
  const res=document.getElementById('gsResults');
  const rows=[...res.querySelectorAll('.gsr-item')];
  if(!rows.length)return;
  if(e.key==='ArrowDown'){e.preventDefault();gsIdx=Math.min(gsIdx+1,rows.length-1);rows[gsIdx]?.focus();}
  else if(e.key==='ArrowUp'){e.preventDefault();gsIdx=Math.max(gsIdx-1,-1);if(gsIdx<0)document.getElementById('gsInput').focus();else rows[gsIdx]?.focus();}
  else if(e.key==='Escape'){gsClear();}
  else if(e.key==='Enter'&&gsIdx>=0){rows[gsIdx]?.click();}
}

function gsGo(aulaId,term){
  gsClear();
  goAula(aulaId);
  setTimeout(()=>{const s=document.getElementById('srch');if(s){s.value=term;renderInv();}},60);
}

function gsOpenItem(id){
  gsClear();
  openItemRoute(id);
}

function gsCrearItemDesdeQuery(q){
  gsClear();
  openModal(null, { item: q });
}

function gsSelectAll(e, q){
  e.stopPropagation();
  if(!_gsMatches.length) return;
  if(typeof bulkSelected === 'undefined'){ toast('Sistema de edición en lote no disponible','err'); return; }
  bulkSelected.clear();
  _gsMatches.forEach(x => bulkSelected.add(String(x.id)));
  const n = _gsMatches.length;
  gsClear();
  goSearchResults(q);
  toast(`${n} ítem${n!==1?'s':''} seleccionado${n!==1?'s':''} para acción en lote`,'ok');
}

function gsClear(){
  document.getElementById('gsInput').value='';
  document.getElementById('gsClear').style.display='none';
  document.getElementById('gsResults').classList.remove('open');
  gsIdx=-1;
  _gsMatches=[];
}

function printGsResults(e, q){
  e.stopPropagation();
  if(!_gsMatches.length) return;
  const cols = typeof PRINT_COLS !== 'undefined' ? PRINT_COLS.filter(c=>(_getPrintCols()||{})[c.key]??c.default) : [
    {key:'ref',label:'Referencia'},{key:'item',label:'Nombre'},{key:'aula',label:'Aula'},
    {key:'qty',label:'Cantidad'},{key:'cat',label:'Categoría'},{key:'loc',label:'Ubicación'},{key:'est',label:'Estado'}
  ];
  const fecha = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'});
  const total = _gsMatches.length;
  const uds = _gsMatches.reduce((s,x)=>s+(Number(x.qty)||0),0);
  const thead = cols.map(c=>`<th>${c.label}</th>`).join('');
  const tbody = _gsMatches.map(x=>{
    const low = typeof isLowStock==='function'&&isLowStock(x);
    const mant = typeof needsMaintenance==='function'&&needsMaintenance(x);
    const cat = (typeof CATS!=='undefined'&&CATS[x.cat])||(typeof CATS!=='undefined'&&CATS['Otros'])||{c:'#6b7280',bg:'#f9fafb',i:'🔧'};
    const ec = (typeof ESTC!=='undefined'&&ESTC[x.est])||'#6b7280';
    const mantInfo = [x.mantEstado,x.mantFecha,x.mantResp].filter(Boolean).join(' · ');
    const code = typeof itemCode==='function'?itemCode(x):(x.code||'');
    return '<tr>'+cols.map(c=>{
      if(c.key==='foto')  return `<td>${x.foto?`<img style="width:36px;height:36px;object-fit:cover;border-radius:4px" src="${escHtml(x.foto)}" alt="">`:''}</td>`;
      if(c.key==='ref')   return `<td><span style="font-family:monospace;font-size:11px;background:#f3f4f6;padding:1px 5px;border-radius:4px">${escHtml(x.ref||'—')}</span></td>`;
      if(c.key==='item')  return `<td style="font-weight:600">${escHtml(x.item)}</td>`;
      if(c.key==='aula')  return `<td>${escHtml((typeof AULAS!=='undefined'?AULAS.find(a=>a.id===x.aula)?.name:null)||x.aula||'—')}</td>`;
      if(c.key==='mod')   { const m=typeof findModulo==='function'?findModulo(x.mod):null; return `<td style="font-size:11px">${escHtml(m?m.cod+' '+m.name:x.mod||'—')}</td>`; }
      if(c.key==='qty')   return `<td style="text-align:center;font-weight:700;color:${low?'#dc2626':'#15803d'}">${x.qty}${low?' ⚠':''}</td>`;
      if(c.key==='min')   return `<td style="text-align:center">${x.min||'—'}</td>`;
      if(c.key==='cat')   return `<td>${x.cat?`<span style="background:${cat.bg};color:${cat.c};padding:1px 6px;border-radius:10px;font-size:11px">${escHtml(cat.i)} ${escHtml(x.cat)}</span>`:'—'}</td>`;
      if(c.key==='loc')   return `<td>${escHtml(x.loc||'—')}</td>`;
      if(c.key==='est')   return `<td><span style="display:inline-flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:${ec};display:inline-block"></span>${escHtml(x.est)}</span></td>`;
      if(c.key==='util')  return `<td style="font-size:11px">${escHtml(x.util||'—')}</td>`;
      if(c.key==='proveedor') return `<td style="font-size:11px">${escHtml(x.proveedor||'—')}</td>`;
      if(c.key==='tags')  return `<td style="font-size:11px">${escHtml(x.tags||'—')}</td>`;
      if(c.key==='mant')  return `<td style="font-size:11px">${mant?`🛠️ ${escHtml(mantInfo||'Pendiente')}`:'—'}</td>`;
      if(c.key==='obs')   return `<td style="font-size:11px">${escHtml(x.obs||'—')}</td>`;
      return '<td>—</td>';
    }).join('')+'</tr>';
  }).join('');
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Búsqueda: ${escHtml(q)}</title>
  <style>
    @page{size:A4 landscape;margin:10mm}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0}
    .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #2563eb;padding-bottom:6px;margin-bottom:10px}
    .head h1{font-size:18px;margin:0;color:#1e40af}
    .head p{font-size:11px;color:#555;margin:0;text-align:right}
    table{width:100%;border-collapse:collapse}
    th{background:#2563eb;color:#fff;padding:6px 8px;text-align:left;font-size:11px;white-space:nowrap}
    td{padding:5px 8px;border-bottom:1px solid #e5e7eb;vertical-align:middle}
    tr:nth-child(even) td{background:#f9fafb}
    .footer{margin-top:8px;font-size:10px;color:#9ca3af;text-align:right}
  </style></head><body>
  <div class="head">
    <h1>🔍 Búsqueda: "${escHtml(q)}"</h1>
    <p>IES El Bosco — Inventario Departamento<br>${total} tipos · ${uds} unidades · ${fecha}</p>
  </div>
  <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
  <div class="footer">Inventario IES Juan Bosco · ${fecha}</div>
  <script>window.onload=()=>setTimeout(()=>print(),150);<\/script>
  </body></html>`;
  const w=window.open('','_blank');
  if(!w){toast('El navegador bloqueó la ventana de impresión','err');return;}
  w.document.write(html);
  w.document.close();
}

document.addEventListener('click',e=>{
  if(!document.getElementById('gsWrap')?.contains(e.target)) document.getElementById('gsResults')?.classList.remove('open');
});

document.addEventListener('keydown',e=>{
  const isSlash=e.key==='/', isCtrlK=e.ctrlKey&&e.key==='k';
  if(!isSlash && !isCtrlK) return;
  if(document.querySelector('.mbg.open')) return;
  const inp=document.getElementById('gsInput');
  const active=document.activeElement;
  const editing=active && active!==inp && (['INPUT','TEXTAREA','SELECT'].includes(active.tagName) || active.isContentEditable);
  if(isSlash && editing) return;
  e.preventDefault();
  if(!document.getElementById('pH').classList.contains('active')) goHome();
  requestAnimationFrame(()=>{inp.focus();inp.select();});
});
