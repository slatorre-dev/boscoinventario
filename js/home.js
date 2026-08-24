// ═════════════════════════════════════════════════════════
// HOME RENDER
// ═════════════════════════════════════════════════════════
function renderHome(){
  // Banner de préstamos
  renderLoanBanner();

  const loading = !itemsLoaded;
  const total=items.length;
  const low=items.filter(isLowStock).length;
  const mant=items.filter(needsMaintenance).length;
  const units=items.reduce((a,x)=>a+(Number(x.qty)||0),0);
  const oc = (typeof can==='function' && can('visibility.manage')) ? items.filter(x=>x.oculto==1).length : 0;
  const ocCard = (typeof can==='function' && can('visibility.manage'))
    ? `<div class="scard" onclick="goOcultos()" style="cursor:pointer"><div class="scard-icon">🙈</div><div class="scard-copy"><div class="scard-num">${oc}</div><div class="scard-lbl">Ocultos</div></div></div>`
    : '';
  document.getElementById('hStats').innerHTML= loading
    ? `<div class="scard scard-loading"><div class="scard-icon">📦</div><div class="scard-copy"><div class="scard-num skel"></div><div class="scard-lbl">Ítems</div></div></div>
       <div class="scard scard-loading"><div class="scard-icon">🔢</div><div class="scard-copy"><div class="scard-num skel"></div><div class="scard-lbl">Unidades</div></div></div>
       <div class="scard scard-loading"><div class="scard-icon">⚠️</div><div class="scard-copy"><div class="scard-num skel"></div><div class="scard-lbl">Stock bajo</div></div></div>
       <div class="scard scard-loading"><div class="scard-icon">🛠️</div><div class="scard-copy"><div class="scard-num skel"></div><div class="scard-lbl">Mantenimiento</div></div></div>`
    : `<div class="scard"><div class="scard-icon">📦</div><div class="scard-copy"><div class="scard-num">${total}</div><div class="scard-lbl">Ítems</div></div></div>
    <div class="scard"><div class="scard-icon">🔢</div><div class="scard-copy"><div class="scard-num">${units.toLocaleString()}</div><div class="scard-lbl">Unidades</div></div></div>
    <div class="scard${low?' scard-alert':''}" ${low?'onclick="goLowStock()" style="cursor:pointer"':''}><div class="scard-icon">⚠️</div><div class="scard-copy"><div class="scard-num" style="color:var(--red)">${low}</div><div class="scard-lbl">Stock bajo</div></div></div>
    <div class="scard${mant?' scard-alert':''}" ${mant?'onclick="goMaintenance()" style="cursor:pointer"':''}><div class="scard-icon">🛠️</div><div class="scard-copy"><div class="scard-num" style="color:var(--amber)">${mant}</div><div class="scard-lbl">Mantenimiento</div></div></div>${ocCard}`;
  const countHtml = loading ? `<span class="ccard-count skel skel-count"></span>` : null;
  const aulaEntries = loading ? AULAS : AULAS.filter(a=>items.some(x=>x.aula===a.id));
  document.getElementById('gAulas').innerHTML=aulaEntries.length
    ? aulaEntries.map(a=>{
    const n=items.filter(x=>x.aula===a.id).length;
    const w=loading ? 0 : items.filter(x=>x.aula===a.id&&isLowStock(x)).length;
    return`<div class="ccard ${a.th}" style="--ch:#2563eb" role="button" tabindex="0" aria-label="Abrir ${escHtml(a.name)}" onclick="goAula('${a.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goAula('${a.id}')}" >
      ${loading ? `<span class="ccard-count skel skel-count"></span>` : `<span class="ccard-count">${n} ítems</span>`}
      <button class="ccard-edit" onclick="event.stopPropagation();openAulasModal()" title="Editar aulas">✏️</button>
      <div class="ccard-icon">${a.departamento ? escHtml(a.icon) : '<img src="icons/iconoaula.png" alt="" loading="lazy">'}</div>
      <div class="ccard-title">${escHtml(a.name)}</div>
      <div class="ccard-desc">${escHtml(a.desc)}${w?`<div class="ccard-warn">⚠ ${w} stock bajo</div>`:''}</div>
    </div>`;
  }).join('')
    : `<div class="empty" style="grid-column:1/-1;padding:32px;text-align:center;color:var(--muted);font-size:13px">No hay ítems clasificados por aula aún.</div>`;
  const catEntries = loading ? sortedCatEntries() : sortedCatEntries().filter(([name])=>items.some(x=>x.cat===name));
  document.getElementById('gCats').innerHTML=catEntries.length
    ? catEntries.map(([name,c])=>{
        const n=items.filter(x=>x.cat===name).length;
        const w=loading ? 0 : items.filter(x=>x.cat===name&&isLowStock(x)).length;
        return`<div class="ccard" style="--ch:${c.c};--cbg:${c.bg}" role="button" tabindex="0" aria-label="Abrir categoría ${escHtml(name)}" onclick="goCat('${name.replace(/'/g,"\\'")}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goCat('${name.replace(/'/g,"\\'")}')}" >
          ${loading ? `<span class="ccard-count skel skel-count"></span>` : `<span class="ccard-count">${n} ítems</span>`}
          <div class="ccard-icon">${escHtml(c.i)}</div>
          <div class="ccard-title">${escHtml(name)}</div>
          <div class="ccard-desc">${w?`<div class="ccard-warn">⚠ ${w} stock bajo</div>`:''}</div>
        </div>`;
      }).join('')
    : `<div class="empty" style="grid-column:1/-1;padding:32px;text-align:center;color:var(--muted);font-size:13px">No hay ítems clasificados por categoría aún.</div>`;
  document.getElementById('gCiclos').innerHTML=CICLOS.map(c=>{
    const n=items.filter(x=>x.mod && x.mod.startsWith(c.id+'__')).length;
    return`<div class="ccard ${c.th}" role="button" tabindex="0" aria-label="Abrir ${escHtml(c.name)}" onclick="openCiclo('${c.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCiclo('${c.id}')}" >
      ${loading ? `<span class="ccard-count skel skel-count"></span>` : `<span class="ccard-count">${n} ítems</span>`}
      <div class="ccard-icon">${escHtml(c.icon)}</div>
      <div class="ccard-title">${escHtml(c.name)}</div>
      <div class="ccard-desc">${escHtml(c.desc)}</div>
    </div>`;
  }).join('');

  const secCats = document.getElementById('homeSecCats');
  if(secCats) secCats.open = homeSectionOpenState('cats', catEntries.length);
  const secCiclos = document.getElementById('homeSecCiclos');
  if(secCiclos) secCiclos.open = homeSectionOpenState('ciclos', CICLOS.length);
}

function homeSectionOpenState(key, count){
  const stored = localStorage.getItem('home_sec_'+key);
  if(stored !== null) return stored === '1';
  return count <= 8;
}

function onHomeSecToggle(el, key){
  localStorage.setItem('home_sec_'+key, el.open ? '1' : '0');
}

function renderLoanBanner(){
  const el = document.getElementById('loanBanner');
  if(!el) return;
  el.innerHTML = '';
}
