// ═════════════════════════════════════════════════════════
// SUBPAGE / INVENTARIO
// ═════════════════════════════════════════════════════════
function renderSubStats(data,low){
  const units=data.reduce((a,x)=>a+(Number(x.qty)||0),0);
  const mant=data.filter(needsMaintenance).length;
  document.getElementById('sStats').innerHTML=`
    <div class="scard-compact" onclick="_subFilter=null;renderInv()" title="Ver todos los ítems"><span class="icon">📋</span><span class="num" id="sst-tipos">0</span></div>
    <div class="scard-compact" title="Unidades en stock"><span class="icon">🔢</span><span class="num" id="sst-units">0</span></div>
    <div class="scard-compact${low>0?' alert':''}" ${low>0?'onclick="_subFilter=\'lowstock\';renderInv()" title="Stock bajo"':' title="Sin stock bajo"'} ><span class="icon">⚠️</span><span class="num" id="sst-low">0</span></div>
    <div class="scard-compact${mant>0?' warn':''}" ${mant>0?'onclick="_subFilter=\'maintenance\';renderInv()" title="Necesita mantenimiento"':' title="Sin mantenimiento pendiente"'} ><span class="icon">🛠️</span><span class="num" id="sst-mant">0</span></div>
  `;
  animateCount(document.getElementById('sst-tipos'), data.length);
  animateCount(document.getElementById('sst-units'), units);
  animateCount(document.getElementById('sst-low'), low);
  animateCount(document.getElementById('sst-mant'), mant);
}

function toggleActionMenu(evt, itemId){
  evt.stopPropagation();
  const menu = document.getElementById(`am-${itemId}`);
  if(!menu) return;
  const isVisible = menu.style.display !== 'none';
  document.querySelectorAll('[id^="am-"]').forEach(m => m.style.display = 'none');
  if(!isVisible){
    const btn = evt.currentTarget;
    const r = btn.getBoundingClientRect();
    // Mover al body para escapar de cualquier filter/opacity del ancestro
    if(menu.parentElement !== document.body) document.body.appendChild(menu);
    menu.style.position = 'fixed';
    menu.style.top = (r.bottom + 4) + 'px';
    menu.style.left = Math.max(4, r.right - 180) + 'px';
    menu.style.right = 'auto';
    menu.style.display = 'block';
  }
}
document.addEventListener('click', () => {
  document.querySelectorAll('[id^="am-"]').forEach(m => m.style.display = 'none');
});

function getBase(){
  return items.filter(x=>{
    if(cf.type==='aula') return x.aula===cf.id;
    if(cf.type==='cat') return x.cat===cf.id;
    if(cf.type==='lowstock') return isLowStock(x);
    if(cf.type==='maintenance') return needsMaintenance(x);
    if(cf.type==='ocultos') return x.oculto==1;
    if(cf.type==='caja') return Number(x.parent_id)===Number(cf.id);
    return x.mod===cf.id;
  });
}

function getFiltered(){
  const q=document.getElementById('srch').value;
  const fc=document.getElementById('fCat').value;
  const fe=document.getElementById('fEst')?.value??'';
  const ft=document.getElementById('fTipo').value;
  return getBase().filter(x=>{
    if(_subFilter==='lowstock' && !isLowStock(x)) return false;
    if(_subFilter==='maintenance' && !needsMaintenance(x)) return false;
    if(fc&&x.cat!==fc)return false;
    if(fe&&x.est!==fe)return false;
    if(ft&&x.tipo_material!==ft)return false;
    if(q&&!fuzzyMatch(q,[typeof itemCode === 'function' ? itemCode(x) : x.code,x.ref,x.item,x.loc,x.proveedor,x.tags].join(' ')))return false;
    return true;
  }).sort((a,b)=>{
    let av=a[sk]??'',bv=b[sk]??'';
    if(sk==='qty'||sk==='min') return sa?Number(av)-Number(bv):Number(bv)-Number(av);
    return sa?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av));
  });
}

function setTwHeight(){
  const scroll = document.querySelector('#iContent .tw-scroll');
  if (!scroll) return;
  const topbarH = document.querySelector('.topbar')?.offsetHeight || 58;
  const pager   = document.querySelector('#iContent .pager');
  const pagerH  = pager ? pager.offsetHeight + 8 : 60;
  const h = Math.max(600, window.innerHeight - 20);
  scroll.style.maxHeight = h + 'px';
}

function setFilterTipo(value){
  const fTipo = document.getElementById('fTipo');
  if(fTipo) fTipo.value = value;
  
  // Actualizar estado visual de los botones
  document.querySelectorAll('.tipo-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  if(value === '') {
    document.querySelector('.tipo-btn-all')?.classList.add('active');
  } else if(value === 'consumible') {
    document.querySelector('.tipo-btn-consumible')?.classList.add('active');
  } else if(value === 'inventariable') {
    document.querySelector('.tipo-btn-inventariable')?.classList.add('active');
  }
  
  renderInv();
}

function renderActiveFilters(){
  const bar = document.getElementById('activeFiltersBar');
  if(!bar) return;
  const chips = [];
  const q = document.getElementById('srch')?.value || '';
  const fc = document.getElementById('fCat')?.value || '';
  const ft = document.getElementById('fTipo')?.value || '';
  const fe = document.getElementById('fEst')?.value || '';
  if(q) chips.push({label: `"${q}"`, clear: ()=>{ document.getElementById('srch').value=''; renderInv(); }});
  if(fc){
    const sel = document.getElementById('fCat');
    const txt = sel?.options[sel.selectedIndex]?.text || fc;
    chips.push({label: txt, clear: ()=>{ document.getElementById('fCat').value=''; renderInv(); }});
  }
  if(ft) chips.push({label: ft==='consumible'?'Consumibles':'Inventariables', clear: ()=>{ setFilterTipo(''); }});
  if(fe) chips.push({label: fe, clear: ()=>{ document.getElementById('fEst').value=''; renderInv(); }});
  if(!chips.length){ bar.innerHTML=''; bar.style.display='none'; return; }
  bar.style.display='flex';
  bar.innerHTML = chips.map((c,i)=>
    `<span class="filter-chip">${c.label}<button class="filter-chip-x" data-chip="${i}" title="Quitar filtro">×</button></span>`
  ).join('') +
  (chips.length>1 ? `<button class="filter-chip-clear" data-chip="all">✕ Limpiar todo</button>` : '');
  bar.querySelectorAll('[data-chip]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = btn.dataset.chip;
      if(idx==='all'){
        document.getElementById('srch').value='';
        document.getElementById('fCat').value='';
        setFilterTipo('');
        if(document.getElementById('fEst')) document.getElementById('fEst').value='';
        renderInv();
      } else {
        chips[Number(idx)].clear();
      }
    });
  });
}

function renderInv(){
  updateViewBtns();
  // Limpiar menús de acciones reparentados a <body> por toggleActionMenu() en el
  // render anterior — si no, cada re-render deja un nodo #am-<id> huérfano ahí,
  // acumulándose indefinidamente durante la sesión (y duplicando el id con la
  // fila nueva que renderConfInv() vuelve a generar).
  document.querySelectorAll('body > [id^="am-"]').forEach(m => m.remove());
  const mc=document.getElementById('iContent');
  if(!itemsLoaded){
    document.getElementById('iCount').textContent='';
    document.getElementById('iLow').textContent='';
    mc.innerHTML=`<div class="inv-loading-skeleton">${Array(6).fill(`<div class="skel-row"><div class="skel-cell skel" style="width:40%"></div><div class="skel-cell skel" style="width:20%"></div><div class="skel-cell skel" style="width:15%"></div><div class="skel-cell skel" style="width:15%"></div></div>`).join('')}</div>`;
    return;
  }
  renderActiveFilters();
  const data=getFiltered();
  const low=data.filter(isLowStock).length;
  document.getElementById('iCount').textContent=`${data.length} ítem${data.length!==1?'s':''}`;
  document.getElementById('iLow').textContent=low>0?`⚠ ${low} con stock bajo`:'';
  renderBulkBar();
  if(!data.length){
    const searchQ = document.getElementById('srch').value.trim();
    const hasFilter = searchQ || document.getElementById('fCat').value || document.getElementById('fTipo').value || document.getElementById('fEst')?.value;
    const canCreate = searchQ && typeof can === 'function' && can('items.write');
    mc.innerHTML=`<div class="empty">
      <span class="ei">${hasFilter ? '🔍' : '📭'}</span>
      <div class="et">${hasFilter ? 'No hay ítems con estos filtros.<br><small>Prueba a cambiar la búsqueda o los filtros.</small>' : 'Esta sección no tiene ítems todavía.'}</div>
      ${hasFilter ? `<button class="empty-btn" onclick="document.getElementById('srch').value='';document.getElementById('fCat').value='';document.getElementById('fTipo').value='';if(document.getElementById('fEst'))document.getElementById('fEst').value='';renderInv()">✕ Limpiar filtros</button>` : ''}
      ${canCreate ? `<button class="empty-btn" onclick="invCrearItemDesdeBusqueda()">➕ Crear ítem nuevo: "${escHtml(searchQ)}"</button>` : ''}
    </div>`;
    return;
  }
  const mode = getInvRenderMode();
  _lastInvRenderMode = mode;
  if(shouldGroupConsumibles(data)){
    renderConsumibleGroups(mc,data,mode);
    return;
  }
  const page = getInvPage(data);
  if(mode === 'table') rTable(page.items,mc);
  else if(mode === 'list') rList(page.items,mc);
  else rCards(page.items,mc);
  renderPager(mc,page);
  if(mode === 'table') requestAnimationFrame(setTwHeight);
}

let _consumibleGroupsOpen = Object.create(null);
let _consumibleTagGroupsOpen = Object.create(null);

function shouldGroupConsumibles(data){
  if(!_groupView) return false;
  return data.length > 0;
}
function setGroupView(v){
  _groupView = v;
  localStorage.setItem('inv_group_view', v ? 'true' : 'false');
  updateViewBtns();
  renderInv();
}

function groupItemsByCategory(data, targetType){
  const map = new Map();
  for(const x of data){
    if(materialType(x) !== targetType) continue;
    const key = String(x.cat || 'Sin categoría').trim() || 'Sin categoría';
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(x);
  }
  return [...map.entries()]
    .map(([name, items]) => ({
      key: name,
      name,
      items,
      refs: items.length,
      units: items.reduce((a,i)=>a+(Number(i.qty)||0),0),
      low: items.filter(isLowStock).length
    }))
    .sort((a,b)=>a.name.localeCompare(b.name,'es',{sensitivity:'base'}));
}

function groupConsumiblesByCategory(data){
  const map = new Map();
  const inventariables = [];
  for(const x of data){
    if(materialType(x) !== 'consumible'){
      inventariables.push(x);
      continue;
    }
    const key = String(x.cat || 'Sin categoría').trim() || 'Sin categoría';
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(x);
  }
  const groups = [...map.entries()]
    .map(([name, items]) => ({
      key: name,
      name,
      items,
      refs: items.length,
      units: items.reduce((a,i)=>a+(Number(i.qty)||0),0),
      low: items.filter(isLowStock).length
    }))
    .sort((a,b)=>a.name.localeCompare(b.name));
  return { groups, inventariables };
}

function renderItemsFragment(data, mode){
  const tmp = document.createElement('div');
  // En agrupado por tags siempre usamos tarjetas para evitar filas horizontales muy largas.
  rCards(data,tmp);
  return tmp.innerHTML;
}

function tagKeyForItem(item){
  const tags = itemTags(item);
  return tags.length ? tags[0] : 'Sin tag';
}

function normalizeTagText(tag){
  return String(tag || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Agrupa variantes \u2192 forma can\u00f3nica bonita (mismo mapa que backend)
const TAG_CANONICAL_MAP = {
  'rel':'Rel\u00e9s','rele':'Rel\u00e9s','reles':'Rel\u00e9s','relay':'Rel\u00e9s','relays':'Rel\u00e9s',
  'resistencia':'Resistencias','resistencias':'Resistencias','resist':'Resistencias',
  'condensador':'Condensadores','condensadores':'Condensadores','condensad':'Condensadores','conden':'Condensadores',
  'sensor':'Sensores','sensores':'Sensores',
  'smd':'SMD','led':'LED','leds':'LED',
  'diodo':'Diodos','diodos':'Diodos',
  'transistor':'Transistores','transistores':'Transistores','transistor':'Transistores',
  'cable':'Cables','cables':'Cables','manguera':'Cables',
  'conector':'Conectores','conectores':'Conectores',
  'fusible':'Fusibles','fusibles':'Fusibles',
  '230v':'230V','220v':'230V',
  'herramienta':'Herramientas','herramientas':'Herramientas',
  'soldadura':'Soldadura',
  'medida':'Medida',
  'multimetro':'Mult\u00edmetros','multimetros':'Mult\u00edmetros',
  'polimetro':'Mult\u00edmetros','polimetros':'Mult\u00edmetros',
  'osciloscopio':'Osciloscopios','osciloscopios':'Osciloscopios',
  'router':'Routers','routers':'Routers',
  'switch':'Switches','switches':'Switches',
  'antena':'Antenas','antenas':'Antenas',
  'fibra':'Fibra \u00f3ptica','fibra optica':'Fibra \u00f3ptica',
  'telecom':'Telecomunicaciones','telecomunicaciones':'Telecomunicaciones',
  'ordenador':'Ordenadores','ordenadores':'Ordenadores',
  'raspberry':'Raspberry Pi','raspberry pi':'Raspberry Pi',
  'arduino':'Arduino','esp32':'ESP32','esp8266':'ESP32',
  'domotica':'Dom\u00f3tica','robotica':'Rob\u00f3tica',
  'tornillo':'Torniller\u00eda','tornillos':'Torniller\u00eda','tornilleria':'Torniller\u00eda',
  'consumible':'Consumibles','consumibles':'Consumibles',
  'fuente':'Fuentes de alimentaci\u00f3n','fuentes':'Fuentes de alimentaci\u00f3n',
  'fuente de alimentacion':'Fuentes de alimentaci\u00f3n',
  'rueda':'Ruedas','ruedas':'Ruedas',
  'api':'API','apis':'API',
  'pcb':'PCB','placa':'PCB','placas':'PCB',
  'proteccion electrica':'Protecciones el\u00e9ctricas',
  'protecciones electricas':'Protecciones el\u00e9ctricas',
  'diferencial':'Protecciones el\u00e9ctricas',
};

function tagFamilyKey(tag){
  if(!tag || tag === 'Sin tag') return 'sin tag';
  const key = normalizeTagText(tag);
  return TAG_CANONICAL_MAP[key] || tag || 'sin tag';
}

function firstTagWord(tag){
  const raw = String(tag || '').trim();
  if(!raw) return 'Sin tag';
  return raw.split(/\s+/)[0] || raw;
}

function pickBestTagLabel(labelsMap, fallback){
  const arr = [...labelsMap.entries()].sort((a,b)=>{
    if(b[1] !== a[1]) return b[1] - a[1];
    return a[0].length - b[0].length;
  });
  return arr[0]?.[0] || fallback;
}

function groupConsumiblesByTag(items){
  const map = new Map();
  for(const x of items){
    const tags = itemTags(x);
    const rawTag = tags.length ? tags[0] : 'Sin tag';
    const key = tagFamilyKey(rawTag);
    if(!map.has(key)) map.set(key, { items: [] });
    map.get(key).items.push(x);
  }
  return [...map.entries()]
    .map(([key, bucket]) => ({
      key,
      tag: key === 'sin tag' ? 'Sin tag' : key,
      items: bucket.items,
      refs: bucket.items.length,
      units: bucket.items.reduce((a,i)=>a+(Number(i.qty)||0),0),
      low: bucket.items.filter(isLowStock).length
    }))
    .sort((a,b)=>{
      if(a.key === 'sin tag') return 1;
      if(b.key === 'sin tag') return -1;
      return a.tag.localeCompare(b.tag,'es',{sensitivity:'base'});
    });
}

function tagIcon(tag){
  const t = String(tag || '').toLowerCase();
  if(/resist/.test(t)) return '🧱';
  if(/condens|capac/.test(t)) return '⚡';
  if(/cable|hilo|wire/.test(t)) return '🧵';
  if(/conector|jack|terminal/.test(t)) return '🔌';
  if(/diod|led/.test(t)) return '💡';
  if(/transist|mosfet/.test(t)) return '🧠';
  if(/fusible/.test(t)) return '🔥';
  if(/tornill|tuerca|arandela/.test(t)) return '🔩';
  if(/sensor/.test(t)) return '📡';
  if(/placa|pcb/.test(t)) return '🟩';
  if(/sin tag/.test(t)) return '🏷️';
  return '🔹';
}

function renderConsumibleTagGroups(catKey, items, mode){
  const catEncoded = encodeURIComponent(catKey);
  const tagGroups = groupConsumiblesByTag(items);
  const groupsHtml = tagGroups.map(g=>{
    const tagEncoded = encodeURIComponent(g.key);
    const stateKey = `${catKey}::${g.key}`;
    const isOpen = !!_consumibleTagGroupsOpen[stateKey];
    const icon = tagIcon(g.tag);
    return `<section class="cons-subgroup${isOpen?' open':''}">
      <button class="cons-subgroup-btn" type="button" onclick="toggleConsumibleTagGroup('${catEncoded}','${tagEncoded}')">
        <span class="cons-subgroup-title" title="${escHtml(g.tag)}"><span class="cons-subgroup-kind">TAG</span><span class="cons-subgroup-icon">${icon} </span>${escHtml(g.tag)}</span>
        <span class="cons-subgroup-metrics">${g.refs}</span>
        ${g.low?`<span class="cons-subgroup-low" title="Stock bajo">⚠ ${g.low}</span>`:''}
        <span class="cons-subgroup-chevron">${isOpen ? '▲' : '▼'}</span>
      </button>
      <div class="cons-subgroup-body${isOpen?' open':''}">${isOpen ? renderItemsFragment(g.items, mode) : ''}</div>
    </section>`;
  }).join('');
  return `<div class="cons-subgroups-wrap"><div class="cons-subgroups">${groupsHtml}</div></div>`;
}

function fmtNum(n){
  const v = Number(n) || 0;
  if(v >= 10000) return Math.round(v/1000)+'K+';
  if(v >= 1000)  return (v/1000).toFixed(1).replace('.0','')+'K';
  return String(v);
}

function renderConsumibleGroups(mc,data,mode){
  const pt = document.getElementById('pagerTop');
  if(pt){ pt.innerHTML=''; pt.style.display='none'; }
  const q = (document.getElementById('srch')?.value || '').trim();
  const ft = document.getElementById('fTipo')?.value || '';

  const hasConsumibles = data.some(x => materialType(x) === 'consumible');
  if(ft === 'inventariable' || !hasConsumibles){
    const invGroups = groupItemsByCategory(data, 'inventariable');
    const blocks = invGroups.map(g => {
      const k = encodeURIComponent(g.key);
      const isOpen = q ? true : !!_consumibleGroupsOpen[g.key];
      const catCfg = CATS[g.name] || CATS['Otros'] || { c:'#6b7280', bg:'#f3f4f6', i:CAT_ICON_FALLBACK };
      const matchBadge = q ? `<span class="cons-metric cons-metric-match">${fmtNum(g.refs)} coincid.</span>` : '';
      return `<section class="cons-group cons-group-inv${isOpen ? ' open' : ''}${q ? ' cons-group-filtered' : ''}">
        <button class="cons-group-btn" type="button" onclick="toggleConsumibleGroup('${k}')">
          <span class="cons-group-icon" style="background:${catCfg.bg};color:${catCfg.c}">${catCfg.i || CAT_ICON_GENERIC_HTML}</span>
          <span class="cons-group-main">
            <span class="cons-group-title"><span class="cons-group-kind">CATEGORÍA</span>${escHtml(g.name)}</span>
          </span>
          <span class="cons-metrics">
            ${matchBadge}
            ${!q ? `<span class="cons-metric">${fmtNum(g.refs)} refs</span>` : ''}
            ${!q ? `<span class="cons-metric">${fmtNum(g.units)} uds</span>` : ''}
            ${g.low ? `<span class="cons-metric warn">⚠ ${fmtNum(g.low)}</span>` : ''}
          </span>
          <span class="cons-group-chevron">${isOpen ? '▲' : '▼'}</span>
        </button>
        <div class="cons-group-body${isOpen ? ' open' : ''}">
          ${isOpen ? renderConsumibleTagGroups(g.key, g.items, mode) : ''}
        </div>
      </section>`;
    }).join('');
    mc.innerHTML = `<div class="cons-wrap">${blocks}</div>`;
    if(mode !== 'table') addCardSwipeListeners(mc);
    return;
  }

  const { groups, inventariables } = groupConsumiblesByCategory(data);

  // Inventariables: bloque simple sin subagrupación por tags
  const invOpen = q ? true : !!_consumibleGroupsOpen['__inventariable__'];
  const invBlock = inventariables.length
    ? `<section class="cons-group cons-group-inv${invOpen ? ' open' : ''}${q ? ' cons-group-filtered' : ''}">
        <button class="cons-group-btn" type="button" onclick="toggleConsumibleGroup('__inventariable__')">
          <span class="cons-group-icon" style="background:#eff6ff;color:#1d4ed8">📦</span>
          <span class="cons-group-main">
            <span class="cons-group-title"><span class="cons-group-kind">TIPO</span>Inventariables</span>
          </span>
          <span class="cons-metrics">
            ${q ? `<span class="cons-metric cons-metric-match">${fmtNum(inventariables.length)} coincid.</span>` : `<span class="cons-metric">${fmtNum(inventariables.length)} refs</span><span class="cons-metric">${fmtNum(inventariables.reduce((a,x)=>a+(Number(x.qty)||0),0))} uds</span>`}
          </span>
          <span class="cons-group-chevron">${invOpen ? '▲' : '▼'}</span>
        </button>
        <div class="cons-group-body${invOpen ? ' open' : ''}">
          ${invOpen ? renderConsumibleTagGroups('__inventariable__', inventariables, mode) : ''}
        </div>
      </section>`
    : '';

  const groupBlocks = groups.map(g => {
    const k = encodeURIComponent(g.key);
    // Con búsqueda activa: abrir automáticamente los grupos con resultados
    const isOpen = q ? true : !!_consumibleGroupsOpen[g.key];
    const catCfg = CATS[g.name] || CATS['Otros'] || { c:'#6b7280', bg:'#f3f4f6', i:CAT_ICON_FALLBACK };
    const matchBadge = q ? `<span class="cons-metric cons-metric-match">${fmtNum(g.refs)} coincid.</span>` : '';
    return `<section class="cons-group${isOpen ? ' open' : ''}${q ? ' cons-group-filtered' : ''}">
      <button class="cons-group-btn" type="button" onclick="toggleConsumibleGroup('${k}')">
        <span class="cons-group-icon" style="background:${catCfg.bg};color:${catCfg.c}">${catCfg.i || CAT_ICON_GENERIC_HTML}</span>
        <span class="cons-group-main">
          <span class="cons-group-title"><span class="cons-group-kind">CATEGORÍA</span>${escHtml(g.name)}</span>
        </span>
        <span class="cons-metrics">
          ${matchBadge}
          ${!q ? `<span class="cons-metric">${fmtNum(g.refs)} refs</span>` : ''}
          ${!q ? `<span class="cons-metric">${fmtNum(g.units)} uds</span>` : ''}
          ${g.low ? `<span class="cons-metric warn">⚠ ${fmtNum(g.low)}</span>` : ''}
        </span>
        <span class="cons-group-chevron">${isOpen ? '▲' : '▼'}</span>
      </button>
      <div class="cons-group-body${isOpen ? ' open' : ''}">
        ${isOpen ? renderConsumibleTagGroups(g.key, g.items, mode) : ''}
      </div>
    </section>`;
  }).join('');

  mc.innerHTML = `<div class="cons-wrap">${invBlock}${groupBlocks}</div>`;
  if(mode !== 'table') addCardSwipeListeners(mc);
}

function toggleConsumibleGroup(encodedKey){
  const key = decodeURIComponent(encodedKey);
  const wasOpen = !!_consumibleGroupsOpen[key];
  // Cerrar todos antes de abrir el seleccionado (acordeón)
  _consumibleGroupsOpen = Object.create(null);
  _consumibleTagGroupsOpen = Object.create(null);
  if(!wasOpen) _consumibleGroupsOpen[key] = true;
  renderInv();
}

function toggleConsumibleTagGroup(encodedCatKey, encodedTagKey){
  const catKey = decodeURIComponent(encodedCatKey);
  const tagKey = decodeURIComponent(encodedTagKey);
  const stateKey = `${catKey}::${tagKey}`;
  const wasOpen = !!_consumibleTagGroupsOpen[stateKey];
  // Cerrar todos los subgrupos de esta categoría antes de abrir el seleccionado
  Object.keys(_consumibleTagGroupsOpen).forEach(k => {
    if(k.startsWith(catKey + '::')) delete _consumibleTagGroupsOpen[k];
  });
  if(!wasOpen) _consumibleTagGroupsOpen[stateKey] = true;
  renderInv();
}

let _lastInvRenderMode = null;
let _invPage = 1;
let _pageSize = Number(localStorage.getItem('inv_page_size')) || 25;
let _pageSizeUserSet = !!localStorage.getItem('inv_page_size');
let _pageSig = '';
function renderInvKeepPage(){ const p=_invPage; _pageSig=''; renderInv(); _invPage=Math.min(p,Math.max(1,Math.ceil(getFiltered().length/_pageSize)||1)); renderInv(); }
function isTouchLike(){
  return matchMedia('(hover: none), (pointer: coarse)').matches;
}
function setView(v){
  view = v;
  localStorage.setItem('inv_view', v);
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===v));
  renderInv();
}
function getInvRenderMode(){
  if(window.innerWidth < 640) return 'cards';
  if(view==='table') return 'table';
  if(view==='list') return 'list';
  return 'cards';
}
function updateViewBtns(){
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  const gb = document.getElementById('btnGroupView');
  if(gb){ gb.textContent = _groupView ? 'Agrupado' : 'Lista'; gb.classList.toggle('active', _groupView); }
}

function getPageSig(data){
  return [
    cf?.type, cf?.id,
    document.getElementById('srch')?.value || '',
    document.getElementById('fCat')?.value || '',
    document.getElementById('fEst')?.value || '',
    document.getElementById('fTipo')?.value || '',
    sk, sa ? '1' : '0',
    data.length
  ].join('|');
}

function getInvPage(data){
  const sig = getPageSig(data);
  if(sig !== _pageSig){
    _pageSig = sig;
    _invPage = 1;
    if(!_pageSizeUserSet) _pageSize = isTouchLike() ? 10 : 25;
  }
  const pageSize = _pageSize;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  _invPage = Math.min(Math.max(1, _invPage), totalPages);
  const start = (_invPage - 1) * pageSize;
  const end = Math.min(start + pageSize, data.length);
  return {
    items: data.slice(start, end),
    start,
    end,
    total: data.length,
    page: _invPage,
    totalPages
  };
}

function renderPager(mc,page){
  const sizes = [10,25,30,50];
  const navHtml = `
    <button class="btn btn-sm" onclick="goInvPage(${page.page-1})" ${page.page<=1?'disabled':''}>‹ Anterior</button>
    <span class="pager-page">Página ${page.page} / ${page.totalPages}</span>
    <button class="btn btn-sm" onclick="goInvPage(${page.page+1})" ${page.page>=page.totalPages?'disabled':''}>Siguiente ›</button>`;
  mc.insertAdjacentHTML('beforeend',`
    <div class="pager">
      <div class="pager-info">Mostrando ${page.start+1}-${page.end} de ${page.total}</div>
      <div class="pager-controls">
        ${navHtml}
        <label class="pager-size">
          <span>Ítems</span>
          <select onchange="setPageSize(this.value)">
            ${sizes.map(n=>`<option value="${n}" ${n===_pageSize?'selected':''}>${n}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>
  `);
  const pt = document.getElementById('pagerTop');
  if(pt){
    if(page.totalPages > 1){
      const sizeSelTop = `<label class="pager-size"><span>Ítems</span><select onchange="setPageSize(this.value)">${sizes.map(n=>`<option value="${n}" ${n===_pageSize?'selected':''}>${n}</option>`).join('')}</select></label>`;
      pt.innerHTML = `<div class="pager-top-inner">${navHtml}${sizeSelTop}</div>`;
      pt.style.display = 'flex';
    } else {
      pt.innerHTML = '';
      pt.style.display = 'none';
    }
  }
}

function th2(k,l){const i=k===sk?(sa?'▲':'▼'):'↕';return`<th onclick="sort('${k}')" class="${k===sk?'srt':''}">${l} <span style="font-size:9px;opacity:.6">${i}</span></th>`}
function shortText(v,max=15){
  const s = String(v || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function itemTags(item){
  return String(item?.tags || '').split(/[;,]/).map(t=>t.trim()).filter(Boolean);
}

let bulkSelected = new Set();

function getSelectedItems(){
  return items.filter(x => bulkSelected.has(String(x.id)));
}

function renderBulkBar(){
  bulkSelected = new Set([...bulkSelected].filter(id => items.some(x => String(x.id) === String(id))));
  const bar = document.getElementById('bulkBar');
  if(!bar) return;
  const n = bulkSelected.size;
  bar.style.display = n ? 'flex' : 'none';
  document.getElementById('bulkCount').textContent = `${n} seleccionado${n!==1?'s':''}`;
}

function toggleBulkSelect(id, checked){
  if(checked) bulkSelected.add(String(id));
  else bulkSelected.delete(String(id));
  renderInv();
}

function toggleBulkPage(checked){
  getInvPage(getFiltered()).items.forEach(x => checked ? bulkSelected.add(String(x.id)) : bulkSelected.delete(String(x.id)));
  renderInv();
}

function clearBulkSelection(){
  bulkSelected.clear();
  renderInv();
}

function renderBulkActionControl(){
  const action = document.getElementById('bulkAction')?.value || '';
  const box = document.getElementById('bulkActionControl');
  if(!box) return;
  if(action === 'loc'){
    box.innerHTML = '<input id="bulkLoc" list="locList" placeholder="Nueva ubicacion">';
  } else if(action === 'cat'){
    box.innerHTML = `<select id="bulkCat">${sortedCatNames().map(c=>`<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}</select>`;
  } else if(action === 'mod'){
    box.innerHTML = `<select id="bulkCiclo" onchange="renderBulkModOptions()">${CICLOS.map(c=>`<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}</select><select id="bulkMod"></select>`;
    renderBulkModOptions();
  } else if(action === 'tipo'){
    box.innerHTML = '<select id="bulkTipo"><option value="consumible">Consumible</option><option value="inventariable">Inventariable</option></select>';
  } else if(action === 'tagsAdd' || action === 'tagsReplace'){
    box.innerHTML = '<input id="bulkTags" list="tagList" placeholder="tag1, tag2">';
  } else if(action === 'ref'){
    box.innerHTML = '<input id="bulkRef" type="text" placeholder="Nueva referencia (vacío para borrar)">';
  } else if(action === 'mant'){
    box.innerHTML = '<select id="bulkMant"><option value="1">Marcar mantenimiento</option><option value="">Quitar mantenimiento</option></select>';
  } else if(action === 'foto'){
    box.innerHTML = `<div style="display:flex;gap:8px;align-items:center">
      <input id="bulkFotoUrl" type="url" placeholder="URL de la imagen (Drive, etc.)" style="flex:1">
      <input id="bulkFotoFile" type="file" accept="image/*" style="flex:1" onchange="handleBulkPhotoUpload()">
    </div>
    <div id="bulkFotoPreview" style="margin-top:8px;padding:8px;border-radius:4px;background:var(--surface2);display:none">
      <img id="bulkFotoImg" style="max-width:100px;max-height:100px;border-radius:4px">
    </div>`;
  } else if(action === 'delete'){
    box.innerHTML = '<span style="color:#dc2626;font-weight:700;font-size:12px">⚠ Se eliminarán permanentemente</span>';
  } else {
    box.innerHTML = '';
  }
}

function renderBulkModOptions(){
  const cid = document.getElementById('bulkCiclo')?.value;
  const modSel = document.getElementById('bulkMod');
  const ciclo = CICLOS.find(c=>c.id===cid);
  if(!modSel || !ciclo) return;
  modSel.innerHTML = ciclo.modulos.map(m=>`<option value="${ciclo.id}__${m.cod}">${escHtml(m.cod)} - ${escHtml(m.name)}</option>`).join('');
}

function mergeTags(current, incoming, replace=false){
  const next = String(incoming || '').split(',').map(cleanTag).filter(Boolean);
  if(replace) return next.join(', ');
  const all = [...itemTags({tags:current}), ...next];
  return [...new Map(all.map(t=>[t.toLowerCase(), t])).values()].join(', ');
}

function handleBulkPhotoUpload(){
  const file = document.getElementById('bulkFotoFile')?.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    document.getElementById('bulkFotoUrl').value = dataUrl;
    const preview = document.getElementById('bulkFotoPreview');
    const img = document.getElementById('bulkFotoImg');
    if(preview && img){
      img.src = dataUrl;
      preview.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}

function _bulkDelDialog(selected){
  return new Promise(resolve => {
    if(!confirm(`⚠ ATENCIÓN\n\nVas a eliminar ${selected.length} ítem${selected.length!==1?'s':''} permanentemente.\n\n¿Estás seguro? Se pedirá una segunda confirmación.`)){
      resolve(false); return;
    }
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)';
    document.body.appendChild(overlay);
    let secs = 5;
    let tick;
    const cancel = () => { clearInterval(tick); overlay.remove(); resolve(false); };
    const confirm2 = () => { clearInterval(tick); overlay.remove(); resolve(true); };
    const render = () => {
      overlay.innerHTML = `<div style="background:#fff;border-radius:16px;padding:28px 32px;max-width:380px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.3)">
        <div style="font-size:32px;margin-bottom:8px">🗑️</div>
        <div style="font-size:18px;font-weight:800;color:#dc2626;margin-bottom:8px">Eliminar ${selected.length} ítem${selected.length!==1?'s':''}</div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:16px">Esta acción es <strong>irreversible</strong>.<br>Puedes cancelar en los próximos segundos.</div>
        <div style="font-size:48px;font-weight:900;color:#dc2626;margin-bottom:16px">${secs}</div>
        <button id="_bdCancel" style="padding:10px 24px;border-radius:8px;border:1.5px solid #e5e7eb;background:#f9fafb;cursor:pointer;font-size:14px;font-weight:600;margin-right:10px">Cancelar</button>
        <button id="_bdConfirm" ${secs>0?'disabled style="opacity:.35;cursor:not-allowed;':'style="cursor:pointer;'} padding:10px 24px;border-radius:8px;border:none;background:#dc2626;color:#fff;font-size:14px;font-weight:700">Eliminar ahora</button>
      </div>`;
      overlay.querySelector('#_bdCancel').onclick = cancel;
      overlay.querySelector('#_bdConfirm').onclick = secs > 0 ? null : confirm2;
    };
    render();
    tick = setInterval(() => {
      secs--;
      render();
      if(secs <= 0) clearInterval(tick);
    }, 1000);
  });
}

async function bulkDeleteWithCountdown(selected){
  if(!requirePerm('items.delete')) return;
  const confirmed = await _bulkDelDialog(selected);
  if(!confirmed) return;
  let ok = 0;
  for(const it of selected){
    try {
      const res = await apiPost({action:'delete', id:it.id});
      if(!res.ok) throw new Error(res.error);
      const idx = items.findIndex(x=>String(x.id)===String(it.id));
      if(idx >= 0) items.splice(idx, 1);
      ok++;
    } catch(e){ console.warn('[bulk delete]', it.id, e); }
  }
  bulkSelected.clear();
  toast(`${ok} ítem${ok!==1?'s':''} eliminado${ok!==1?'s':''}`,'ok');
  if(cf) openSub(); else renderHome();
}

async function applyBulkAction(){
  if(!requirePerm('items.write')) return;
  const selected = getSelectedItems();
  if(!selected.length) return;
  const action = document.getElementById('bulkAction').value;
  if(action === 'delete'){ bulkDeleteWithCountdown(selected); return; }
  let patch = null;
  if(action === 'loc') patch = { loc: document.getElementById('bulkLoc').value.trim() };
  else if(action === 'cat') patch = { cat: document.getElementById('bulkCat').value };
  else if(action === 'mod') patch = { mod: document.getElementById('bulkMod').value };
  else if(action === 'tipo') patch = { tipo_material: document.getElementById('bulkTipo').value };
  else if(action === 'ref') patch = { ref: document.getElementById('bulkRef').value.trim() };
  else if(action === 'mant') patch = { mant: document.getElementById('bulkMant').value, mantEstado: document.getElementById('bulkMant').value ? 'Pendiente' : '' };
  else if(action === 'foto') {
    const url = document.getElementById('bulkFotoUrl').value.trim();
    if(!url){ toast('Indica una URL o carga una imagen','err'); return; }
    patch = { foto: url };
  }
  else if(action === 'tagsAdd' || action === 'tagsReplace') {
    const tags = document.getElementById('bulkTags').value;
    if(!tags.trim()){ toast('Indica tags para aplicar','err'); return; }
    patch = { _tags: tags, _replaceTags: action === 'tagsReplace' };
  }
  if(!patch){ toast('Selecciona una accion en lote','err'); return; }
  if(!await confirmDialog({message:`Aplicar cambio a ${selected.length} item${selected.length!==1?'s':''}?`})) return;
  let ok = 0;
  for(const it of selected){
    const updated = {...it, ...patch};
    if('_tags' in patch){
      updated.tags = mergeTags(it.tags, patch._tags, patch._replaceTags);
      delete updated._tags; delete updated._replaceTags;
    }
    try{
      const res = await apiPost({action:'update', item:updated});
      if(!res.ok) throw new Error(res.error);
      const idx = items.findIndex(x=>String(x.id)===String(it.id));
      if(idx >= 0) items[idx] = updated;
      ok++;
    }catch(e){ console.warn('[bulk] update failed', it.id, e); }
  }
  fillTagSuggestions();
  bulkSelected.clear();
  toast(`${ok} item${ok!==1?'s':''} actualizado${ok!==1?'s':''}`,'ok');
  if(cf) openSub(); else renderHome();
}

function bulkExportSelected(){
  const selected = getSelectedItems();
  if(!selected.length) return;
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  downloadText(`inventario-seleccion-${stamp}.csv`, 'text/csv;charset=utf-8', inventoryCsvRows(selected));
  toast('Seleccion exportada','ok');
}

function bulkPrintSelected(){
  const selected = getSelectedItems();
  if(!selected.length) return;
  const sel = _getPrintCols();
  const cols = PRINT_COLS.filter(c=>sel[c.key]);
  if(!cols.length){ toast('Selecciona columnas en Imprimir','err'); return; }
  const bpPaper = _getPrintPaper();
  const bpPageSize = bpPaper.size === 'custom' ? `${bpPaper.w||210}mm ${bpPaper.h||297}mm` : (bpPaper.size||'A4 landscape');
  const bpMargin = bpPaper.size === 'custom' && Math.min(bpPaper.w||999,bpPaper.h||999) < 80 ? '3mm' : '10mm';
  const total = selected.length;
  const uds = selected.reduce((s,x)=>s+(Number(x.qty)||0),0);
  const fecha = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'});
  const thead = cols.map(c=>`<th>${c.label}</th>`).join('');
  const tbody = selected.map(x=>{
    const low = isLowStock(x);
    const mant = needsMaintenance(x);
    const cat = CATS[x.cat]||CATS['Otros']||{c:'#6b7280',bg:'#f9fafb',i:'🔧'};
    const ec = ESTC[x.est]||'#6b7280';
    const mantInfo = [x.mantEstado,x.mantFecha,x.mantResp].filter(Boolean).join(' · ');
    return '<tr>'+cols.map(c=>{
      if(c.key==='foto')  return `<td>${x.foto?`<img style="width:36px;height:36px;object-fit:cover;border-radius:4px" src="${escHtml(x.foto)}" alt="">`:''}</td>`;
      if(c.key==='ref')   return `<td><span style="font-family:monospace;font-size:11px;background:#f3f4f6;padding:1px 5px;border-radius:4px">${escHtml(x.ref||'—')}</span></td>`;
      if(c.key==='item')  return `<td style="font-weight:600">${escHtml(x.item)}</td>`;
      if(c.key==='aula')  return `<td>${escHtml(AULAS.find(a=>a.id===x.aula)?.name||x.aula||'—')}</td>`;
      if(c.key==='mod')   { const m=findModulo(x.mod); return `<td style="font-size:11px">${escHtml(m?m.cod+' '+m.name:x.mod||'—')}</td>`; }
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

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Inventario seleccion</title>
  <style>
    @page{size:${bpPageSize};margin:${bpMargin}}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0}
    .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #2563eb;padding-bottom:6px;margin-bottom:10px}
    .head h1{font-size:18px;margin:0;color:#1e40af}
    .head p{font-size:11px;color:#555;margin:0;text-align:right}
    table{width:100%;border-collapse:collapse}
    th{background:#2563eb;color:#fff;padding:6px 8px;text-align:left;font-size:11px;white-space:nowrap}
    td{padding:5px 8px;border-bottom:1px solid #e5e7eb;vertical-align:middle}
    tr:nth-child(even) td{background:#f9fafb}
  </style></head><body>
  <div class="head">
    <h1>Seleccion de inventario</h1>
    <p>IES El Bosco - Inventario Departamento<br>${total} tipos · ${uds} unidades · ${fecha}</p>
  </div>
  <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
  <script>window.onload=()=>setTimeout(()=>print(),150);<\/script>
  </body></html>`;
  const w = window.open('','_blank');
  if(!w){ toast('El navegador bloqueo la ventana de impresion','err'); return; }
  w.document.write(html);
  w.document.close();
}

async function toggleOcultoItem(id){
  if(!can('visibility.manage')) return;
  const it = items.find(x=>Number(x.id)===Number(id));
  if(!it) return;
  const nuevo = it.oculto == 1 ? 0 : 1;
  try{
    const res = await apiPost({action:'toggleOculto', id, oculto:nuevo});
    if(!res.ok) throw new Error(res.error);
    it.oculto = nuevo;
    toast(nuevo ? 'Ítem oculto para el resto' : 'Ítem visible para todos','ok');
    renderInv();
  }catch(e){ toast('No se pudo cambiar la visibilidad','err'); }
}

function ocultoBtnHtml(x){
  if(!can('visibility.manage')) return '';
  const oc = x.oculto == 1;
  return `<button class="btn btn-sm" onclick="event.stopPropagation();toggleOcultoItem(${x.id})" title="${oc?'Oculto al resto — clic para mostrar':'Visible — clic para ocultar al resto'}">${oc?'🙈':'👁️'}</button>`;
}

function itemActiveLoans(id){
  return (prestamos || []).filter(p => String(p.itemId)===String(id) && (p.estado==='Activo' || p.estado==='Parcial'));
}

function quickItemHtml(item){
  const aula = AULAS.find(a=>a.id===item.aula)?.name || item.aula || '—';
  const active = itemActiveLoans(item.id);
  const tags = itemTags(item);
  return `<div class="quick-item-card">
    <div class="quick-item-head">
      <div class="quick-item-photo">${item.foto?`<img src="${item.foto}" alt="">`:'📷'}</div>
      <div class="quick-item-title">
        <strong>${escHtml(item.item || '')}</strong>
        <span>${escHtml(item.ref || itemCode(item) || '')}</span>
      </div>
    </div>
    <div class="quick-item-grid">
      <div><span>Stock</span><strong>${item.qty ?? '—'} / mín. ${item.min ?? '—'}</strong></div>
      <div><span>Aula</span><strong>${escHtml(aula)}</strong></div>
      <div><span>Ubicación</span><strong>${escHtml(item.loc || '—')}</strong></div>
      <div><span>Estado</span><strong>${escHtml(item.est || '—')}</strong></div>
      <div><span>Utilidad</span><strong>${escHtml(item.util || '—')}</strong></div>
      <div><span>Proveedor</span><strong>${escHtml(item.proveedor || '—')}</strong></div>
    </div>
    ${tags.length?`<div class="quick-tags">${tags.slice(0,6).map(t=>`<span>${escHtml(t)}</span>`).join('')}</div>`:''}
    <div class="quick-loans">${active.length ? `${active.length} préstamo${active.length!==1?'s':''} activo${active.length!==1?'s':''}` : 'Sin préstamos activos'}</div>
  </div>`;
}

function showQuickItem(id, ev){
  const item = items.find(x=>Number(x.id)===Number(id));
  if(!item) return;
  let box = document.getElementById('quickItemPreview');
  if(!box){
    box = document.createElement('div');
    box.id = 'quickItemPreview';
    document.body.appendChild(box);
  }
  box.innerHTML = quickItemHtml(item);
  box.classList.add('show');
  moveQuickItem(ev);
}

function moveQuickItem(ev){
  const box = document.getElementById('quickItemPreview');
  if(!box || !box.classList.contains('show')) return;
  const x = Math.min((ev?.clientX || 20) + 18, window.innerWidth - 440);
  const y = Math.min((ev?.clientY || 20) + 18, window.innerHeight - 340);
  box.style.left = Math.max(12, x) + 'px';
  box.style.top = Math.max(12, y) + 'px';
}

function hideQuickItem(){
  document.getElementById('quickItemPreview')?.classList.remove('show');
}

function rTable(data,mc){
  mc.innerHTML=`<div class="tw"><div class="tw-scroll"><table>
    <thead><tr><th><input type="checkbox" onchange="toggleBulkPage(this.checked)" title="Seleccionar pagina"></th><th>Foto</th>${th2('ref','Ref.')}${th2('aula','Aula')}${th2('item','Ítem')}${th2('qty','Cant.')}<th>Mín.</th>${th2('cat','Categoría')}${th2('loc','Ubicación')}${th2('est','Estado')}${th2('util','Utilidad')}<th>Acciones</th></tr></thead>
    <tbody>${data.map(x=>{
      const low=isLowStock(x),mant=needsMaintenance(x),mantInfo=[x.mantEstado,x.mantFecha,x.mantResp].filter(Boolean).join(' · '),cat=CATS[x.cat]||CATS['Otros']||{c:'#6b7280',bg:'#f9fafb',i:'🔧'},ec=ESTC[x.est]||'#6b7280',tipo=materialType(x);
      const esContenedor = x.es_contenedor == 1;
      const parentItem = x.parent_id ? items.find(p=>Number(p.id)===Number(x.parent_id)) : null;
      const numHijos = esContenedor ? items.filter(h=>Number(h.parent_id)===Number(x.id)).length : 0;
      const tags = itemTags(x);
      const utilTitle = [mantInfo, x.util, x.proveedor, x.tags].filter(Boolean).join(' · ');
      const utilVisible = mant ? `🛠️ ${shortText(mantInfo || x.util || x.proveedor, 12)}` : (shortText(x.util || x.proveedor, 15) || '—');
      const selected = bulkSelected.has(String(x.id));
      return`<tr class="${selected?'bulk-row-selected':''}${x.oculto==1?' item-oculto':''}"${parentItem?' style="background:var(--bg2,#f9fafb)"':''}>
        <td><input class="bulk-check" type="checkbox" ${selected?'checked':''} onclick="event.stopPropagation()" onchange="toggleBulkSelect(${x.id},this.checked)" title="Seleccionar"></td>
        <td>${x.foto?`<img class="table-photo quick-item-trigger" src="${escHtml(x.foto)}" alt="" onclick="showQuickItem(${x.id},event)" onmouseenter="showQuickItem(${x.id},event)" onmousemove="moveQuickItem(event)" onmouseleave="hideQuickItem()">`:`<span class="table-photo table-photo-empty quick-item-trigger" onclick="showQuickItem(${x.id},event)" onmouseenter="showQuickItem(${x.id},event)" onmousemove="moveQuickItem(event)" onmouseleave="hideQuickItem()">📷</span>`}</td>
        <td><span class="rbadge">${escHtml(x.ref||'—')}</span></td>
        <td style="font-size:12px;color:var(--muted)">${escHtml(AULAS.find(a=>a.id===x.aula)?.name||x.aula)}</td>
        <td style="max-width:220px;font-weight:600" title="${escHtml(x.item)}">
          <div class="item-title-line">
            ${parentItem?'<span style="color:var(--muted);margin-right:4px">↳</span>':''}
            <span class="item-title-text item-title-link" onclick="openModal(${x.id})" onmouseenter="showQuickItem(${x.id},event)" onmousemove="moveQuickItem(event)" onmouseleave="hideQuickItem()">${escHtml(x.item)}</span>
            ${esContenedor?`<span title="Ver componentes" onclick="goCaja(${x.id})" style="cursor:pointer;font-size:10px;background:#eff6ff;color:#2563eb;border-radius:4px;padding:1px 5px;margin-left:4px">📦 ${numHijos}</span>`:''}
            ${parentItem?`<span style="font-size:10px;background:#f0fdf4;color:#15803d;border-radius:4px;padding:1px 5px;margin-left:4px" title="En caja: ${escHtml(parentItem.item)}">📦 ${escHtml(parentItem.ref||parentItem.item)}</span>`:''}
            <button type="button" class="qr-name-btn" onclick="event.stopPropagation();openItemQr(${x.id})" title="Ver QR" aria-label="Ver QR"><img class="qr-name-icon" src="icons/qr-code.svg" alt=""></button>
          </div>
        </td>
        <td><span class="qval ${low?'qlow':'qok'}">${x.qty}${low?' ⚠':''}</span></td>
        <td style="color:var(--muted);font-family:var(--mono);font-size:12px">${x.min}</td>
        <td>${x.cat?`<span class="cpill" style="background:${cat.bg};color:${cat.c}">${escHtml(cat.i)} ${escHtml(x.cat)}</span>`:'—'}<br><span class="cpill" style="background:${tipo==='inventariable'?'#f5f3ff':'#ecfdf5'};color:${tipo==='inventariable'?'#7c3aed':'#059669'};font-size:10px">${tipo==='inventariable'?'Inventariable':'Consumible'}</span>${tags.length?`<br><span class="tag-mini">${escHtml(tags.slice(0,3).join(', '))}</span>`:''}</td>
        <td style="color:var(--muted);font-size:12px" title="${escHtml(x.loc||'')}">${x.loc?escHtml(x.loc.length>10?x.loc.slice(0,10)+'…':x.loc):'—'}</td>
        <td>${x.est?`<span class="edot"><span class="dot" style="background:${ec}"></span>${escHtml(x.est)}</span>`:'—'}</td>
        <td style="color:var(--muted);font-size:12px" title="${escHtml(utilTitle)}"><span class="table-util-text">${escHtml(utilVisible)}</span></td>
        <td><div style="display:flex;gap:6px;position:relative">
          <button class="btn btn-sm" onclick="openModal(${x.id})" title="Editar">✏️</button>
          ${esContenedor
            ? `<button class="btn btn-sm btn-loan" onclick="openPrestarCaja(${x.id})" title="Prestar caja completa" style="font-size:16px;line-height:1">📦⌛</button>`
            : `<button class="btn btn-sm btn-loan" onclick="openPresDevModal(${x.id})" title="Prestar / Devolver" style="font-size:16px;line-height:1">⌛</button>`
          }
          <button class="btn btn-sm btn-d" onclick="openDelModal(${x.id})" title="Baja / Eliminar">🗑️</button>
          <div style="position:relative">
            <button class="btn btn-sm" onclick="toggleActionMenu(event,${x.id})" title="Más acciones">⋯</button>
            <div id="am-${x.id}" class="action-menu" style="display:none;position:absolute;right:0;top:100%;background:white;border:1px solid #ddd;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.12);z-index:1000;min-width:180px">
              <button class="action-menu-item" onclick="event.stopPropagation();duplicateItem(${x.id});document.getElementById('am-${x.id}').style.display='none'" title="Duplicar">⧉ Duplicar</button>
              <button class="action-menu-item" onclick="event.stopPropagation();openDocsModal(${x.id});document.getElementById('am-${x.id}').style.display='none'" title="Documentación">📌 Documentación</button>
              <button class="action-menu-item${isPedido(x.id)?' activo':''}" onclick="event.stopPropagation();togglePedido(${x.id});document.getElementById('am-${x.id}').style.display='none'" title="Pedido">🛒 Pedido</button>
              ${ocultoBtnHtml(x).replace(/class="btn btn-sm"/g,'class="action-menu-item"').replace(/onclick="/g,'onclick="event.stopPropagation();').replace(/">/g,';document.getElementById("am-${x.id}").style.display="none">">')}
            </div>
          </div>
        </div></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div></div>`;
}

function rCards(data,mc){
  mc.innerHTML=`<div class="cgrid">${data.map(x=>{
    const low=isLowStock(x),mant=needsMaintenance(x),mantStatus=x.mantEstado||'Pendiente',cat=CATS[x.cat]||CATS['Otros']||{c:'#6b7280',bg:'#f9fafb',i:'🔧'},ec=ESTC[x.est]||'#6b7280',mod=findModulo(x.mod),tipo=materialType(x),tags=itemTags(x);
    const esContenedor2 = x.es_contenedor == 1;
    const parentItem2 = x.parent_id ? items.find(p=>Number(p.id)===Number(x.parent_id)) : null;
    const numHijos2 = esContenedor2 ? items.filter(h=>Number(h.parent_id)===Number(x.id)).length : 0;
    const selected = bulkSelected.has(String(x.id));
    const activeLoans = itemActiveLoans(x.id);
    return`<div class="icard${low?' low':''}${parentItem2?' child-item':''}${selected?' bulk-card-selected':''}${x.oculto==1?' item-oculto':''}">
      <label class="bulk-card-check" onclick="event.stopPropagation()" title="Seleccionar">
        <input type="checkbox" ${selected?'checked':''} onchange="toggleBulkSelect(${x.id},this.checked)">
      </label>
      <div class="card-head">
        ${x.foto?`<img class="card-photo quick-item-trigger" src="${escHtml(x.foto)}" alt="Foto de ${escHtml(x.item)}" onclick="showQuickItem(${x.id},event)" onmouseenter="showQuickItem(${x.id},event)" onmousemove="moveQuickItem(event)" onmouseleave="hideQuickItem()">`:''}
        <div class="ch">
          <div class="card-title-wrap">
            <div class="item-title-line">
              <div class="cname item-title-link" onclick="openModal(${x.id})" onmouseenter="showQuickItem(${x.id},event)" onmousemove="moveQuickItem(event)" onmouseleave="hideQuickItem()">${parentItem2?'↳ ':''}${escHtml(x.item)}</div>
              <span class="cq-inline" style="color:${low?'var(--red)':'var(--green)'}">${x.qty}<span class="cq-min">mín.${x.min}</span></span>
              ${esContenedor2?`<span title="Ver componentes" onclick="goCaja(${x.id})" style="cursor:pointer;font-size:10px;background:#eff6ff;color:#2563eb;border-radius:4px;padding:1px 5px">📦 ${numHijos2}</span>`:''}
              <button type="button" class="qr-name-btn" onclick="openItemQr(${x.id})" title="Ver QR" aria-label="Ver QR"><img class="qr-name-icon" src="icons/qr-code.svg" alt=""></button>
            </div>
            <div class="cref">${escHtml(x.ref||'')}${parentItem2?` · <span style="color:#15803d;font-size:10px">📦 ${escHtml(parentItem2.ref||parentItem2.item)}</span>`:''}</div>
          </div>
          <div class="cqbox"><div class="cqbig" style="color:${low?'var(--red)':'var(--green)'}">${x.qty}</div><div class="cqmin">mín. ${x.min}</div></div>
        </div>
      </div>
      <div class="cfg">
        <div><div class="cfl">Aula</div><div class="cfv">${escHtml(AULAS.find(a=>a.id===x.aula)?.name||x.aula)}</div></div>
        <div><div class="cfl">Ubicación</div><div class="cfv">${escHtml(x.loc||'—')}</div></div>
      </div>
      ${activeLoans.length?`<div class="loan-chip">⌛ Prestado · ${activeLoans.length===1?escHtml(activeLoans[0].profesorNombre||'Prof.'):activeLoans.length+' personas'}</div>`:''}
      <button class="card-expand-btn" onclick="toggleCardExtra(this)">▼ Ver más</button>
      <div class="card-extra">
        <div class="cpills">
          ${x.est?`<span class="edot" style="font-size:12px"><span class="dot" style="background:${ec}"></span>${escHtml(x.est)}</span>`:''}
          ${mant?`<span class="cpill maintenance-pill">🛠️ ${escHtml(mantStatus)}</span>`:''}
          ${x.cat?`<span class="cpill" style="background:${cat.bg};color:${cat.c};font-size:11px">${escHtml(cat.i)} ${escHtml(x.cat)}</span>`:''}
          <span class="cpill" style="background:${tipo==='inventariable'?'#f5f3ff':'#ecfdf5'};color:${tipo==='inventariable'?'#7c3aed':'#059669'};font-size:11px">${tipo==='inventariable'?'Inventariable':'Consumible'}</span>
          ${mod?`<span class="cpill" style="background:#eff6ff;color:#1d4ed8;font-size:11px">${escHtml(mod.ciclo.icon||'📚')} ${escHtml(mod.name)}</span>`:''}
          ${tags.slice(0,4).map(t=>`<span class="tag-pill">${escHtml(t)}</span>`).join('')}
        </div>
        <div class="cfg cfg-extra">
          ${x.util?`<div><div class="cfl">Utilidad</div><div class="cfv" style="font-size:11px" title="${escHtml(x.util||'')}">${escHtml(shortText(x.util))}</div></div>`:''}
          ${x.proveedor?`<div><div class="cfl">Proveedor</div><div class="cfv" style="font-size:11px" title="${escHtml(x.proveedor||'')}">${escHtml(shortText(x.proveedor))}</div></div>`:''}
          <div><div class="cfl">Revisión</div><div class="cfv" style="font-family:var(--mono);font-size:11px">${escHtml(x.fecha||'—')}</div></div>
        </div>
        ${mant?`<div class="maint-note">
          <strong>${escHtml(mantStatus)}</strong>${x.mantFecha?` · ${escHtml(x.mantFecha)}`:''}${x.mantResp?` · ${escHtml(x.mantResp)}`:''}
          ${x.mantNota?`<br>${escHtml(x.mantNota)}`:''}
        </div>`:''}
        ${x.obs?`<div class="cobs">💬 ${escHtml(x.obs)}</div>`:''}
      </div>
      <div class="cfoot" style="position:relative">
        <button class="btn btn-sm" onclick="openModal(${x.id})" title="Editar">✏️</button>
        ${esContenedor2
          ? `<button class="btn btn-sm btn-loan" onclick="openPrestarCaja(${x.id})" title="Prestar caja completa" style="font-size:16px;line-height:1">📦⌛</button>`
          : `<button class="btn btn-sm btn-loan" onclick="openPresDevModal(${x.id})" title="Prestar / Devolver" style="font-size:16px;line-height:1">⌛</button>`
        }
        <button class="btn btn-sm btn-d" onclick="openDelModal(${x.id})" title="Baja / Eliminar">🗑️</button>
        <div style="position:relative">
          <button class="btn btn-sm" onclick="toggleActionMenu(event,${x.id})" title="Más acciones">⋯</button>
          <div id="am-${x.id}" class="action-menu" style="display:none;position:absolute;right:0;top:100%;background:white;border:1px solid #ddd;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.12);z-index:1000;min-width:180px">
            <button class="action-menu-item" onclick="event.stopPropagation();duplicateItem(${x.id});document.getElementById('am-${x.id}').style.display='none'" title="Duplicar">⧉ Duplicar</button>
            <button class="action-menu-item" onclick="event.stopPropagation();openDocsModal(${x.id});document.getElementById('am-${x.id}').style.display='none'" title="Documentación">📌 Documentación</button>
            <button class="action-menu-item${isPedido(x.id)?' activo':''}" onclick="event.stopPropagation();togglePedido(${x.id});document.getElementById('am-${x.id}').style.display='none'" title="Pedido">🛒 Pedido</button>
            ${ocultoBtnHtml(x).replace(/class="btn btn-sm"/g,'class="action-menu-item"').replace(/onclick="/g,'onclick="event.stopPropagation();').replace(/">/g,';document.getElementById("am-${x.id}").style.display="none">">')}
          </div>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
  addCardSwipeListeners(mc);
}

function addCardSwipeListeners(container){
  if(!('ontouchstart' in window)) return;
  container.querySelectorAll('.icard').forEach(function(card){
    var startX=0,startY=0,dx=0,swiping=false,overlay=null;
    card.addEventListener('touchstart',function(e){
      startX=e.touches[0].clientX;startY=e.touches[0].clientY;dx=0;swiping=false;
    },{passive:true});
    card.addEventListener('touchmove',function(e){
      var cx=e.touches[0].clientX-startX,cy=e.touches[0].clientY-startY;
      if(!swiping&&(Math.abs(cx)<30||Math.abs(cx)<Math.abs(cy)*1.5)) return;
      swiping=true;dx=cx;
      card.style.transition='none';
      card.style.transform='translateX('+Math.sign(dx)*Math.min(Math.abs(dx),100)+'px)';
      if(!overlay){overlay=document.createElement('div');overlay.className='swipe-overlay';card.appendChild(overlay);}
      if(dx<-20){overlay.className='swipe-overlay swipe-left';overlay.textContent='⌛ Prestar';}
      else if(dx>20){overlay.className='swipe-overlay swipe-right';overlay.textContent='📋 Ver';}
      else{overlay.className='swipe-overlay';overlay.textContent='';}
    },{passive:true});
    card.addEventListener('touchend',function(){
      if(!swiping) return;
      card.style.transition='transform .2s ease';card.style.transform='';
      if(overlay){overlay.remove();overlay=null;}
      if(dx<-60){var b=card.querySelector('.btn-loan');if(b) setTimeout(function(){b.click();},150);}
      else if(dx>60){var t=card.querySelector('.cname.item-title-link');if(t) setTimeout(function(){t.click();},150);}
    });
  });
}

function toggleCardExtra(btn){
  const extra=btn.nextElementSibling;
  extra.classList.toggle('open');
  btn.textContent=extra.classList.contains('open')?'▲ Ver menos':'▼ Ver más';
}

function rList(data,mc){
  mc.innerHTML=`<div class="list-view">${data.map(x=>{
    const low=isLowStock(x),mant=needsMaintenance(x),cat=CATS[x.cat]||CATS['Otros']||{c:'#6b7280',bg:'#f9fafb',i:'🔧'},ec=ESTC[x.est]||'#6b7280',tipo=materialType(x),tags=itemTags(x);
    const esContenedor = x.es_contenedor == 1;
    const parentItem = x.parent_id ? items.find(p=>Number(p.id)===Number(x.parent_id)) : null;
    const numHijos = esContenedor ? items.filter(h=>Number(h.parent_id)===Number(x.id)).length : 0;
    const selected = bulkSelected.has(String(x.id));
    return`<div class="list-row${low?' low':''}${selected?' bulk-list-selected':''}${x.oculto==1?' item-oculto':''}">
      <label class="list-check" onclick="event.stopPropagation()">
        <input type="checkbox" ${selected?'checked':''} onchange="toggleBulkSelect(${x.id},this.checked)">
      </label>
      ${x.foto?`<img class="list-photo quick-item-trigger" src="${escHtml(x.foto)}" alt="" onclick="showQuickItem(${x.id},event)" style="cursor:pointer">`:
        `<div class="list-photo-empty quick-item-trigger" onclick="showQuickItem(${x.id},event)" style="cursor:pointer">📷</div>`}
      <div class="list-info">
        <div class="list-name item-title-link" onclick="openModal(${x.id})">${parentItem?'↳ ':''}${escHtml(x.item)}${esContenedor?` 📦${numHijos}`:''}</div>
        <div class="list-meta">${x.ref?`<span class="list-badge">${escHtml(x.ref)}</span>`:''}${x.cat?` <span class="list-cat">${escHtml(cat.i)} ${escHtml(x.cat)}</span>`:''}${x.est?` <span class="list-status" style="color:${ec}">●</span>`:''}</div>
      </div>
      <div class="list-footer">
        <div class="list-qty ${low?'low':''}">
          <div class="list-qty-num">${x.qty}</div>
          <div class="list-qty-min">mín.${x.min}</div>
        </div>
        <div class="list-actions">
          <button class="list-action-btn" onclick="openModal(${x.id})" title="Editar">✏️</button>
          <button class="list-action-btn" onclick="openPresDevModal(${x.id})" title="Prestar">⌛</button>
          <button class="list-action-btn${isPedido(x.id)?' list-active':''}" onclick="togglePedido(${x.id})" title="Pedido">🛒</button>
          ${can('visibility.manage')?`<button class="list-action-btn" onclick="event.stopPropagation();toggleOcultoItem(${x.id})" title="${x.oculto==1?'Oculto al resto':'Ocultar al resto'}">${x.oculto==1?'🙈':'👁️'}</button>`:''}
          <button class="list-action-btn list-delete" onclick="openDelModal(${x.id})" title="Eliminar">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

window.addEventListener('resize',()=>{
  if(!document.getElementById('pS')?.classList.contains('active')) return;
  const nextMode = getInvRenderMode();
  if(nextMode !== _lastInvRenderMode) renderInv();
  else setTwHeight();
});
function invCrearItemDesdeBusqueda(){
  const nombre = document.getElementById('srch').value.trim();
  if(!nombre) return;
  const prefill = { item: nombre };
  if(cf && cf.type==='cat') prefill.cat = cf.id;
  openModal(null, prefill);
}

function sort(k){if(sk===k)sa=!sa;else{sk=k;sa=true}renderInv()}
function goInvPage(page){_invPage=page;renderInv();document.querySelector('#pS .srow')?.scrollIntoView({block:'start'})}
function setPageSize(v){_pageSize=Number(v)||25;_pageSizeUserSet=true;_invPage=1;localStorage.setItem('inv_page_size',String(_pageSize));renderInv()}

let _delItemId = null;
function openDelModal(itemId){
  if(!can('items.write') && !can('items.delete')){ requirePerm('items.write'); return; }
  const step1 = document.getElementById('delPickerStep1');
  const step2 = document.getElementById('delPickerStep2');
  const delBtn = document.getElementById('delBtnDelete');
  if(delBtn) delBtn.style.display = can('items.delete') ? '' : 'none';
  if(itemId !== undefined && itemId !== null){
    const item = items.find(x=>Number(x.id)===Number(itemId));
    if(!item) return;
    _delItemId = itemId;
    document.getElementById('delPickerName').textContent = item.item;
    document.getElementById('delBtnBaja').style.display = item.est !== 'Baja' && can('items.write') ? '' : 'none';
    step1.style.display = 'none';
    step2.style.display = 'flex';
  } else {
    _delItemId = null;
    document.getElementById('delPickerName').textContent = 'Baja / Eliminar';
    document.getElementById('delPickerSearch').value = '';
    step1.style.display = '';
    step2.style.display = 'none';
    delPickerFilter();
  }
  document.getElementById('mDelPicker').classList.add('open');
}
function closeDelModal(){
  document.getElementById('mDelPicker').classList.remove('open');
}
function delPickerFilter(){
  const q = document.getElementById('delPickerSearch').value.toLowerCase();
  const src = (cf ? getBase() : items).filter(x=>
    !q || x.item.toLowerCase().includes(q) || (x.ref||'').toLowerCase().includes(q)
  ).sort((a,b)=>String(a.item||'').localeCompare(String(b.item||'')));
  const list = document.getElementById('delPickerList');
  if(!src.length){
    list.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px">Sin resultados</div>';
    return;
  }
  list.innerHTML=src.slice(0,25).map(x=>`
    <button class="btn" style="width:100%;justify-content:space-between;text-align:left;padding:9px 12px;font-size:13px" onclick="delPickerSelect(${x.id})">
      <span>${escHtml(x.item)}</span>
      <span style="font-size:11px;color:var(--muted)">${escHtml(x.ref||'')}</span>
    </button>`).join('');
}
function delPickerSelect(itemId){
  const item = items.find(x=>Number(x.id)===Number(itemId));
  if(!item) return;
  _delItemId = itemId;
  document.getElementById('delPickerName').textContent = item.item;
  document.getElementById('delBtnBaja').style.display = item.est !== 'Baja' && can('items.write') ? '' : 'none';
  document.getElementById('delPickerStep1').style.display = 'none';
  document.getElementById('delPickerStep2').style.display = 'flex';
}

// ═════════════════════════════════════════════════════════
// EXPORT
// ═════════════════════════════════════════════════════════
function exportCSV(){
  const data=getFiltered();
  const h='Referencia,Aula,Módulo,Ítem,Cantidad,Mínimo,Tipo material,Categoría,Tags,Ubicación,Estado,Mantenimiento,Fecha aviso mant.,Estado mant.,Responsable mant.,Nota mant.,Utilidad,Proveedor,Revisión,Observaciones';
  const rows=data.map(x=>{
    const m = findModulo(x.mod);
    return [x.ref,AULAS.find(a=>a.id===x.aula)?.name||x.aula,m?`${m.cod} ${m.name}`:'',x.item,x.qty,x.min,materialType(x),x.cat,x.tags,x.loc,x.est,needsMaintenance(x)?'Sí':'',x.mantFecha,x.mantEstado,x.mantResp,x.mantNota,x.util,x.proveedor,x.fecha,x.obs].map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',');
  });
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent([h,...rows].join('\n'));a.download='inventario.csv';a.click();
  toast('CSV exportado','ok');
}

// ═════════════════════════════════════════════════════════
// IMPRIMIR
// ═════════════════════════════════════════════════════════
function openExportModal(){
  if(!requirePerm('import.write')) return;
  const filtered = cf ? getFiltered().length : items.length;
  document.getElementById('expFilteredCount').textContent = `${filtered} ítem${filtered!==1?'s':''} de la vista actual.`;
  document.getElementById('expAllItemsCount').textContent = `${items.length} ítem${items.length!==1?'s':''} en total.`;
  document.getElementById('expBackupCount').textContent =
    `${items.length} ítems · ${AULAS.length} aulas · ${Object.keys(CATS).length} categorías · ${CICLOS.length} ciclos · ${prestamos.length} préstamos · ${profesores.length} profesores/as.`;
  document.getElementById('mExport').classList.add('open');
}

function closeExportModal(){
  document.getElementById('mExport')?.classList.remove('open');
}

function csvCell(v){
  return `"${String(v ?? '').replace(/"/g,'""')}"`;
}

function downloadText(filename, mime, text){
  const blob = new Blob([text], {type: mime});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 800);
}

function inventoryCsvRows(data){
  const h='Referencia,Aula,Módulo,Ítem,Cantidad,Mínimo,Tipo material,Categoría,Tags,Ubicación,Estado,Mantenimiento,Fecha aviso mant.,Estado mant.,Responsable mant.,Nota mant.,Utilidad,Proveedor,Revisión,Observaciones';
  const rows=data.map(x=>{
    const m = findModulo(x.mod);
    return [x.ref,AULAS.find(a=>a.id===x.aula)?.name||x.aula,m?`${m.cod} ${m.name}`:'',x.item,x.qty,x.min,materialType(x),x.cat,x.tags,x.loc,x.est,needsMaintenance(x)?'Sí':'',x.mantFecha,x.mantEstado,x.mantResp,x.mantNota,x.util,x.proveedor,x.fecha,x.obs].map(csvCell).join(',');
  });
  return '\uFEFF' + [h,...rows].join('\n');
}

function exportAllItemsCSV(){
  const data = items.slice().sort((a,b)=>String(a.item||'').localeCompare(String(b.item||'')));
  downloadText('inventario-completo.csv', 'text/csv;charset=utf-8', inventoryCsvRows(data));
  closeExportModal();
  toast('CSV completo exportado','ok');
}

function exportFullBackup(){
  if(!requirePerm('import.write')) return;
  const now = new Date();
  const backup = {
    meta: {
      app: 'Inventario Taller FP',
      exportedAt: now.toISOString(),
      exportedBy: SESSION ? {usuario: SESSION.usuario, nombre: SESSION.nombre, rol: SESSION.rol, email: SESSION.email} : null,
      counts: {
        items: items.length,
        aulas: AULAS.length,
        categorias: Object.keys(CATS).length,
        ubicaciones: UBICACIONES.length,
        ciclos: CICLOS.length,
        prestamos: prestamos.length,
        profesores: profesores.length
      }
    },
    inventario: items,
    aulas: AULAS,
    categorias: CATS,
    ubicaciones: UBICACIONES,
    ciclos: CICLOS,
    prestamos,
    profesores
  };
  const stamp = now.toISOString().slice(0,19).replace(/[:T]/g,'-');
  downloadText(`backup-inventario-${stamp}.json`, 'application/json;charset=utf-8', JSON.stringify(backup, null, 2));
  closeExportModal();
  toast('Backup completo exportado','ok');
}

// ═════════════════════════════════════════════════════════
// MODAL IMPRIMIR — selector de columnas
// ═════════════════════════════════════════════════════════
const PRINT_COLS = [
  { key:'foto',      label:'Foto',          default:false },
  { key:'ref',       label:'Referencia',    default:true  },
  { key:'item',      label:'Nombre',        default:true  },
  { key:'aula',      label:'Aula',          default:true  },
  { key:'mod',       label:'Asignatura/Módulo', default:false },
  { key:'qty',       label:'Cantidad',      default:true  },
  { key:'min',       label:'Mínimo',        default:false },
  { key:'cat',       label:'Categoría',     default:true  },
  { key:'loc',       label:'Ubicación',     default:true  },
  { key:'est',       label:'Estado',        default:true  },
  { key:'util',      label:'Utilidad',      default:false },
  { key:'proveedor', label:'Proveedor',     default:false },
  { key:'tags',      label:'Tags',          default:false },
  { key:'mant',      label:'Mantenimiento', default:false },
  { key:'obs',       label:'Observaciones', default:false },
];
const PRINT_COLS_KEY = 'inv_print_cols';
const PRINT_PAPER_KEY = 'inv_print_paper';

// ─── PLANTILLA PEGATINAS ────────────────────────────────
// w/h en mm, cols = columnas por página, perPage calculado,
// mTop/mLeft = margen superior/izquierdo del folio, gX/gY = gap entre etiquetas
const LABEL_TPLS = {
  apli65:  { w:38.1, h:21.2, cols:5, perPage:65, mTop:10.7, mLeft:4.6,  gX:0,   gY:0   },
  apli40:  { w:52.5, h:29.7, cols:4, perPage:40, mTop:10.0, mLeft:5.0,  gX:0,   gY:0   },
  avery21: { w:63.5, h:38.1, cols:3, perPage:21, mTop:4.5,  mLeft:7.25, gX:2.5, gY:0   },
  apli24:  { w:70.0, h:37.0, cols:3, perPage:24, mTop:8.5,  mLeft:0,    gX:0,   gY:0   },
  apli10:  { w:99.1, h:57.0, cols:2, perPage:10, mTop:4.5,  mLeft:5.95, gX:0,   gY:0   },
  l8:      { w:105,  h:74.3, cols:2, perPage:8,  mTop:0,    mLeft:0,    gX:0,   gY:0   },
  l4:      { w:105,  h:148.5,cols:2, perPage:4,  mTop:0,    mLeft:0,    gX:0,   gY:0   },
};

function openPrintLabelsModal(){
  onLabelTplChange();
  document.getElementById('mPrintLabels').classList.add('open');
}
function closePrintLabelsModal(){
  document.getElementById('mPrintLabels').classList.remove('open');
}

function _resolveLabelTpl(){
  const id = document.getElementById('labelTpl')?.value || 'avery21';
  if(id === 'custom'){
    const w = parseFloat(document.getElementById('labelW')?.value);
    const h = parseFloat(document.getElementById('labelH')?.value);
    const cols = Math.max(1, parseInt(document.getElementById('labelCols')?.value) || 3);
    if(!w || !h) return null;
    const rows = Math.floor((297 - 10) / h);
    const mLeft = Math.max(0, (210 - cols * w) / 2);
    return { w, h, cols, perPage: cols * rows, mTop: 5, mLeft, gX: 0, gY: 0 };
  }
  return LABEL_TPLS[id] || LABEL_TPLS.avery21;
}

function onLabelTplChange(){
  const id = document.getElementById('labelTpl')?.value;
  const customDiv = document.getElementById('labelTplCustom');
  if(customDiv) customDiv.style.display = id === 'custom' ? 'flex' : 'none';
  const tpl = _resolveLabelTpl();
  const info = document.getElementById('labelPreviewInfo');
  if(!info) return;
  if(!tpl){ info.textContent = 'Indica las dimensiones de la pegatina'; return; }
  const total = getFiltered().length;
  const pages = Math.ceil(total / tpl.perPage);
  info.textContent = `${tpl.perPage} etiquetas/página · ${total} ítems · ~${pages} página${pages !== 1 ? 's' : ''}`;
}

function printLabels(){
  const tpl = _resolveLabelTpl();
  if(!tpl){ toast('Indica el tamaño y columnas de la pegatina','err'); return; }

  const fields = {
    nombre: document.getElementById('lf_nombre')?.checked ?? true,
    ref:    document.getElementById('lf_ref')?.checked ?? true,
    aula:   document.getElementById('lf_aula')?.checked ?? true,
    qty:    document.getElementById('lf_qty')?.checked ?? false,
    loc:    document.getElementById('lf_loc')?.checked ?? false,
    est:    document.getElementById('lf_est')?.checked ?? false,
    foto:   document.getElementById('lf_foto')?.checked ?? false,
    qr:     document.getElementById('lf_qr')?.checked ?? false,
  };
  const guides = document.getElementById('lf_guides')?.checked ?? true;

  const data = getFiltered();
  if(!data.length){ toast('No hay ítems para imprimir','err'); return; }
  closePrintLabelsModal();

  const { w, h, cols, perPage, mTop, mLeft, gX, gY } = tpl;

  // Fuentes adaptativas según altura de la pegatina
  const nameSize = h < 25 ? '6.5pt' : h < 40 ? '8pt' : h < 60 ? '9.5pt' : '11pt';
  const metaSize = h < 25 ? '5.5pt' : h < 40 ? '6.5pt' : h < 60 ? '7pt' : '8.5pt';
  const pad = h < 25 ? '1mm 1.5mm' : h < 40 ? '1.5mm 2mm' : '2.5mm 3mm';
  const clamp = h < 25 ? 1 : h < 40 ? 2 : 3;
  const border = guides ? `border:0.3px dashed #bbb;` : '';

  function labelCell(x){
    const aulaNombre = AULAS.find(a => a.id === x.aula)?.name || x.aula || '';
    let inner = '';
    if(fields.nombre)
      inner += `<div style="font-weight:700;font-size:${nameSize};line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${clamp};-webkit-box-orient:vertical;word-break:break-word">${escHtml(x.item||'')}</div>`;
    if(fields.ref && x.ref)
      inner += `<div style="font-family:monospace;font-size:${metaSize};color:#555;margin-top:0.4mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${escHtml(x.ref)}</div>`;
    if(fields.aula && aulaNombre && h >= 28)
      inner += `<div style="font-size:${metaSize};color:#444;margin-top:0.4mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${escHtml(aulaNombre)}</div>`;
    if(fields.qty && h >= 28)
      inner += `<div style="font-size:${metaSize};margin-top:0.4mm">Ud: <b>${x.qty??'—'}</b></div>`;
    if(fields.loc && x.loc && h >= 45)
      inner += `<div style="font-size:${metaSize};color:#666;margin-top:0.4mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${escHtml(x.loc)}</div>`;
    if(fields.est && x.est && h >= 45)
      inner += `<div style="font-size:${metaSize};color:#444;margin-top:0.4mm">${escHtml(x.est)}</div>`;
    const sideEl = (() => {
      if(fields.qr && h >= 25){
        const qrMm = h < 30 ? 12 : h < 50 ? 15 : 22;
        const qrPx = qrMm * 4;
        return `<img src="${qrSrc(itemUrl(x.id), qrPx)}" style="width:${qrMm}mm;height:${qrMm}mm;flex-shrink:0;display:block" alt="QR">`;
      }
      if(fields.foto && x.foto && h >= 35){
        const imgSize = h < 60 ? '13mm' : '22mm';
        return `<img src="${x.foto}" style="width:${imgSize};height:${imgSize};object-fit:cover;border-radius:2px;flex-shrink:0" alt="">`;
      }
      return '';
    })();
    if(sideEl)
      return `<div style="width:${w}mm;height:${h}mm;overflow:hidden;padding:${pad};box-sizing:border-box;${border};display:flex;gap:2mm;align-items:flex-start">
        <div style="flex:1;min-width:0">${inner}</div>${sideEl}
      </div>`;
    return `<div style="width:${w}mm;height:${h}mm;overflow:hidden;padding:${pad};box-sizing:border-box;${border}">${inner}</div>`;
  }

  function emptyCell(){
    return `<div style="width:${w}mm;height:${h}mm;${guides?'border:0.3px dashed #e5e5e5;':''}"></div>`;
  }

  // Agrupar en páginas
  const pageItems = [];
  for(let i = 0; i < data.length; i += perPage) pageItems.push(data.slice(i, i + perPage));

  const pagesHtml = pageItems.map(page => {
    const cells = page.map(x => labelCell(x));
    while(cells.length < perPage) cells.push(emptyCell());
    return `<div style="width:210mm;height:297mm;padding-top:${mTop}mm;padding-left:${mLeft}mm;box-sizing:border-box;page-break-after:always;overflow:hidden">
      <div style="display:grid;grid-template-columns:repeat(${cols},${w}mm);gap:${gY}mm ${gX}mm;line-height:1.3">
        ${cells.join('')}
      </div>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Pegatinas inventario</title>
  <style>
    @page{size:A4 portrait;margin:0}
    *{box-sizing:border-box}
    body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111}
  </style></head><body>
  ${pagesHtml}
  <script>window.onload=()=>setTimeout(()=>print(),200);<\/script>
  </body></html>`;

  const win = window.open('','_blank');
  if(!win){ toast('El navegador bloqueó la ventana de impresión','err'); return; }
  win.document.write(html);
  win.document.close();
}

function _getPrintPaper(){
  try { return JSON.parse(localStorage.getItem(PRINT_PAPER_KEY)) || {size:'A4 landscape'}; }
  catch(e){ return {size:'A4 landscape'}; }
}

function onPrintPaperChange(){
  const val = document.getElementById('printPaperSize')?.value;
  const custom = document.getElementById('printPaperCustom');
  if(custom) custom.style.display = val === 'custom' ? 'flex' : 'none';
}

function _getPrintCols(){
  try {
    const saved = JSON.parse(localStorage.getItem(PRINT_COLS_KEY));
    if(saved && typeof saved === 'object') return saved;
  } catch(e){}
  return Object.fromEntries(PRINT_COLS.map(c=>[c.key, c.default]));
}

function openPrintModal(){
  const sel = _getPrintCols();
  const grid = document.getElementById('printColGrid');
  grid.innerHTML = PRINT_COLS.map(c=>`
    <label class="print-col-item">
      <input type="checkbox" id="prcol_${c.key}" ${sel[c.key]?'checked':''}>
      <span>${c.label}</span>
    </label>`).join('');
  const paper = _getPrintPaper();
  const paperSel = document.getElementById('printPaperSize');
  if(paperSel){ paperSel.value = paper.size || 'A4 landscape'; }
  const customDiv = document.getElementById('printPaperCustom');
  if(customDiv){ customDiv.style.display = paper.size === 'custom' ? 'flex' : 'none'; }
  if(paper.size === 'custom'){
    const wEl = document.getElementById('printPaperW');
    const hEl = document.getElementById('printPaperH');
    if(wEl) wEl.value = paper.w || '';
    if(hEl) hEl.value = paper.h || '';
  }
  const filtered = getFiltered();
  const total = items.length;
  const info = document.getElementById('printFilterInfo');
  if(info){
    if(filtered.length < total){
      info.textContent = `🔍 Filtro activo: se imprimirán ${filtered.length} de ${total} ítems`;
      info.style.color = 'var(--primary,#6366f1)';
      info.style.fontWeight = '600';
    } else {
      info.textContent = `📋 Se imprimirán todos los ítems (${total})`;
      info.style.color = 'var(--muted)';
      info.style.fontWeight = '400';
    }
  }
  document.getElementById('mPrint').classList.add('open');
}

function closePrintModal(){
  document.getElementById('mPrint').classList.remove('open');
}

function openPrintChoiceModal(){
  document.getElementById('mPrintChoice').classList.add('open');
}
function closePrintChoiceModal(){
  document.getElementById('mPrintChoice').classList.remove('open');
}

function printColSelectAll(){
  PRINT_COLS.forEach(c=>{ document.getElementById('prcol_'+c.key).checked = true; });
}
function printColSelectNone(){
  PRINT_COLS.forEach(c=>{ document.getElementById('prcol_'+c.key).checked = false; });
}

function printInv(){
  const sel = Object.fromEntries(PRINT_COLS.map(c=>[c.key, document.getElementById('prcol_'+c.key)?.checked ?? c.default]));
  localStorage.setItem(PRINT_COLS_KEY, JSON.stringify(sel));
  const cols = PRINT_COLS.filter(c=>sel[c.key]);
  if(!cols.length){ toast('Selecciona al menos una columna','err'); return; }

  const paperVal = document.getElementById('printPaperSize')?.value || 'A4 landscape';
  let pageSize, pageMargin = '10mm';
  if(paperVal === 'custom'){
    const w = parseInt(document.getElementById('printPaperW')?.value);
    const h = parseInt(document.getElementById('printPaperH')?.value);
    if(!w || !h){ toast('Indica el ancho y alto del papel personalizado','err'); return; }
    pageSize = `${w}mm ${h}mm`;
    pageMargin = Math.min(w,h) < 80 ? '3mm' : '6mm';
    localStorage.setItem(PRINT_PAPER_KEY, JSON.stringify({size:'custom',w,h}));
  } else {
    pageSize = paperVal;
    localStorage.setItem(PRINT_PAPER_KEY, JSON.stringify({size:paperVal}));
  }
  closePrintModal();

  const titulo = cf?.label || 'Inventario';
  const data = getFiltered();
  const total = data.length;
  const uds = data.reduce((s,x)=>s+(Number(x.qty)||0),0);
  const fecha = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'});

  const thead = cols.map(c=>`<th>${c.label}</th>`).join('');
  const tbody = data.map(x=>{
    const low = isLowStock(x);
    const mant = needsMaintenance(x);
    const cat = CATS[x.cat]||CATS['Otros']||{c:'#6b7280',bg:'#f9fafb',i:'🔧'};
    const ec = ESTC[x.est]||'#6b7280';
    const mantInfo = [x.mantEstado,x.mantFecha,x.mantResp].filter(Boolean).join(' · ');
    return '<tr>'+cols.map(c=>{
      if(c.key==='foto')  return `<td>${x.foto?`<img style="width:36px;height:36px;object-fit:cover;border-radius:4px" src="${escHtml(x.foto)}" alt="">`:''}</td>`;
      if(c.key==='ref')   return `<td><span style="font-family:monospace;font-size:11px;background:#f3f4f6;padding:1px 5px;border-radius:4px">${escHtml(x.ref||'—')}</span></td>`;
      if(c.key==='item')  return `<td style="font-weight:600">${escHtml(x.item)}</td>`;
      if(c.key==='aula')  return `<td>${escHtml(AULAS.find(a=>a.id===x.aula)?.name||x.aula||'—')}</td>`;
      if(c.key==='mod')   { const m=findModulo(x.mod); return `<td style="font-size:11px">${escHtml(m?m.cod+' '+m.name:x.mod||'—')}</td>`; }
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

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Inventario ${escHtml(titulo)}</title>
  <style>
    @page{size:${pageSize};margin:${pageMargin}}
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
    <h1>${cf?.icon||'📦'} ${titulo}</h1>
    <p>IES El Bosco — Inventario Departamento<br>${total} tipos · ${uds} unidades · ${fecha}</p>
  </div>
  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
  </table>
  <div class="footer">Inventario Taller FP · ${fecha}</div>
  <script>window.onload=()=>setTimeout(()=>print(),150);<\/script>
  </body></html>`;

  const w = window.open('','_blank');
  if(!w){ toast('El navegador bloqueó la ventana de impresión','err'); return; }
  w.document.write(html);
  w.document.close();
}

// ═════════════════════════════════════════════════════════
// PRESETS DE FILTROS
// ═════════════════════════════════════════════════════════
const PRESETS_KEY='inv_filter_presets';

function getPresets(){ try{return JSON.parse(localStorage.getItem(PRESETS_KEY))||[];}catch(e){return[];} }
function savePresets(arr){ localStorage.setItem(PRESETS_KEY,JSON.stringify(arr)); }

function togglePresetPanel(){
  const panel=document.getElementById('presetPanel');
  if(!panel) return;
  const open=panel.classList.contains('open');
  panel.classList.toggle('open',!open);
  if(!open) renderPresetList();
}

function renderPresetList(){
  const list=document.getElementById('presetList');
  if(!list) return;
  const presets=getPresets();
  if(!presets.length){ list.innerHTML='<div class="preset-empty">Sin presets guardados</div>'; return; }
  list.innerHTML=presets.map((p,i)=>
    `<div class="preset-item">
      <button class="preset-apply-btn" onclick="applyPreset(${i})">${p.name}</button>
      <button class="preset-del-btn" onclick="deletePreset(${i})" title="Eliminar">✕</button>
    </div>`
  ).join('');
}

function saveCurrentPreset(){
  const name=(document.getElementById('presetNameInput')?.value||'').trim();
  if(!name){toast('Escribe un nombre para el preset','err');return;}
  const preset={
    name,
    srch:document.getElementById('srch')?.value||'',
    fCat:document.getElementById('fCat')?.value||'',
    fTipo:document.getElementById('fTipo')?.value||'',
    fEst:document.getElementById('fEst')?.value||'',
    subFilter:_subFilter||'',
  };
  const presets=getPresets();
  presets.push(preset);
  savePresets(presets);
  document.getElementById('presetNameInput').value='';
  renderPresetList();
  toast(`Preset "${name}" guardado`);
}

function applyPreset(idx){
  const p=getPresets()[idx];
  if(!p) return;
  if(document.getElementById('srch')) document.getElementById('srch').value=p.srch||'';
  if(document.getElementById('fCat')) document.getElementById('fCat').value=p.fCat||'';
  if(document.getElementById('fEst')) document.getElementById('fEst').value=p.fEst||'';
  setFilterTipo(p.fTipo||'');
  _subFilter=p.subFilter||null;
  document.getElementById('presetPanel')?.classList.remove('open');
  renderInv();
  toast(`"${p.name}" aplicado`);
}

function deletePreset(idx){
  const presets=getPresets();
  const name=presets[idx]?.name;
  presets.splice(idx,1);
  savePresets(presets);
  renderPresetList();
  if(name) toast(`Preset "${name}" eliminado`);
}

document.addEventListener('click',e=>{
  const wrap=document.getElementById('presetWrap');
  if(wrap&&!wrap.contains(e.target)) document.getElementById('presetPanel')?.classList.remove('open');
});

// ═════════════════════════════════════════════════════════
// TOAST
// ═════════════════════════════════════════════════════════
function toast(msg,type='ok'){
  const el=document.createElement('div');el.className=`toast ${type}`;
  const icon=type==='ok'?'✅':type==='warn'?'⚠️':'❌';
  el.innerHTML=`<span>${icon}</span><span>${msg}</span>`;
  document.getElementById('toasts').appendChild(el);
  const dur=type==='warn'?2500:3000;
  setTimeout(()=>{el.style.animation='ti .3s reverse forwards';setTimeout(()=>el.remove(),300)},dur);
  return el;
}

function initFabNuevoDraggable(){
  const fab=document.getElementById('fabNuevo');
  if(!fab) return;
  const POS_KEY='fab_nuevo_pos';
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(POS_KEY)||'null');}catch(e){}

  function applyPos(top,left){
    const W=fab.offsetWidth||44,H=fab.offsetHeight||44;
    top=Math.max(4,Math.min(top,window.innerHeight-H-4));
    left=Math.max(4,Math.min(left,window.innerWidth-W-4));
    fab.style.top=top+'px';
    fab.style.left=left+'px';
    fab.style.bottom='auto';
    fab.style.right='auto';
  }

  if(saved&&typeof saved.top==='number'&&typeof saved.left==='number') applyPos(saved.top,saved.left);

  let dragging=false,moved=false,startX=0,startY=0,startLeft=0,startTop=0;

  function onDown(e){
    if(e.button&&e.button!==0) return;
    const pt=e.touches?e.touches[0]:e;
    dragging=true; moved=false;
    startX=pt.clientX; startY=pt.clientY;
    const r=fab.getBoundingClientRect();
    startLeft=r.left; startTop=r.top;
    fab.style.transition='none';
    if(e.cancelable) e.preventDefault();
    if(e.touches){
      document.addEventListener('touchmove',onMove,{passive:true});
      document.addEventListener('touchend',onUp);
      document.addEventListener('touchcancel',onUp);
    }
  }

  function onMove(e){
    if(!dragging) return;
    const pt=e.touches?e.touches[0]:e;
    const dx=pt.clientX-startX,dy=pt.clientY-startY;
    if(Math.abs(dx)>4||Math.abs(dy)>4) moved=true;
    if(moved) applyPos(startTop+dy,startLeft+dx);
  }

  function onUp(){
    if(!dragging) return;
    dragging=false;
    document.removeEventListener('touchmove',onMove);
    document.removeEventListener('touchend',onUp);
    document.removeEventListener('touchcancel',onUp);
    fab.style.transition='';
    if(moved){
      const r=fab.getBoundingClientRect();
      try{localStorage.setItem(POS_KEY,JSON.stringify({top:r.top,left:r.left}));}catch(e){}
    } else {
      openModal();
    }
  }

  fab.addEventListener('mousedown',onDown);
  fab.addEventListener('touchstart',onDown,{passive:false});
  document.addEventListener('mousemove',onMove);
  document.addEventListener('mouseup',onUp);
  window.addEventListener('resize',()=>{if(fab.offsetWidth>0){const r=fab.getBoundingClientRect();applyPos(r.top,r.left);}});
}

document.addEventListener('DOMContentLoaded',initFabNuevoDraggable);
