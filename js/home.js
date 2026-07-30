// ═════════════════════════════════════════════════════════
// HOME RENDER
// ═════════════════════════════════════════════════════════
function renderHome(){
  // Banner de préstamos
  renderLoanBanner();
  renderHeroMeta();
  startHeroCanvas();

  const loading = !itemsLoaded;
  const total=items.length;
  const low=items.filter(isLowStock).length;
  const mant=items.filter(needsMaintenance).length;
  const units=items.reduce((a,x)=>a+(Number(x.qty)||0),0);
  const oc = (typeof can==='function' && can('visibility.manage')) ? items.filter(x=>x.oculto==1).length : 0;
  const ocCard = (typeof can==='function' && can('visibility.manage'))
    ? `<div class="scard" onclick="goOcultos()" style="cursor:pointer"><div class="scard-icon">🙈</div><div class="scard-num">${oc}</div></div>`
    : '';
  document.getElementById('hStats').innerHTML= loading
    ? `<div class="scard scard-loading"><div class="scard-icon">📦</div><div class="scard-num skel"></div></div>
       <div class="scard scard-loading"><div class="scard-icon">🔢</div><div class="scard-num skel"></div></div>
       <div class="scard scard-loading"><div class="scard-icon">⚠️</div><div class="scard-num skel"></div></div>
       <div class="scard scard-loading"><div class="scard-icon">🛠️</div><div class="scard-num skel"></div></div>`
    : `<div class="scard"><div class="scard-icon">📦</div><div class="scard-num">${total}</div></div>
    <div class="scard"><div class="scard-icon">🔢</div><div class="scard-num">${units.toLocaleString()}</div></div>
    <div class="scard${low?' scard-alert':''}" ${low?'onclick="goLowStock()" style="cursor:pointer"':''}><div class="scard-icon">⚠️</div><div class="scard-num" style="color:var(--red)">${low}</div></div>
    <div class="scard${mant?' scard-alert':''}" ${mant?'onclick="goMaintenance()" style="cursor:pointer"':''}><div class="scard-icon">🛠️</div><div class="scard-num" style="color:var(--amber)">${mant}</div></div>${ocCard}`;
  const countHtml = loading ? `<span class="ccard-count skel skel-count"></span>` : null;
  document.getElementById('gAulas').innerHTML=AULAS.map(a=>{
    const n=items.filter(x=>x.aula===a.id).length;
    const w=loading ? 0 : items.filter(x=>x.aula===a.id&&isLowStock(x)).length;
    return`<div class="ccard ${a.th}" style="--ch:#2563eb" onclick="goAula('${a.id}')">
      ${loading ? `<span class="ccard-count skel skel-count"></span>` : `<span class="ccard-count">${n} ítems</span>`}
      <button class="ccard-edit" onclick="event.stopPropagation();openAulasModal()" title="Editar aulas">✏️</button>
      <div class="ccard-icon">${a.icon}</div>
      <div class="ccard-title">${a.name}</div>
      <div class="ccard-desc">${a.desc}${w?`<div class="ccard-warn">⚠ ${w} stock bajo</div>`:''}</div>
    </div>`;
  }).join('');
  const catEntries = loading ? sortedCatEntries() : sortedCatEntries().filter(([name])=>items.some(x=>x.cat===name));
  document.getElementById('gCats').innerHTML=catEntries.length
    ? catEntries.map(([name,c])=>{
        const n=items.filter(x=>x.cat===name).length;
        const w=loading ? 0 : items.filter(x=>x.cat===name&&isLowStock(x)).length;
        return`<div class="ccard" style="--ch:${c.c};--cbg:${c.bg}" onclick="goCat('${name.replace(/'/g,"\\'")}')">
          ${loading ? `<span class="ccard-count skel skel-count"></span>` : `<span class="ccard-count">${n} ítems</span>`}
          <div class="ccard-icon">${c.i}</div>
          <div class="ccard-title">${name}</div>
          <div class="ccard-desc">${w?`<div class="ccard-warn">⚠ ${w} stock bajo</div>`:''}</div>
        </div>`;
      }).join('')
    : `<div class="empty" style="grid-column:1/-1;padding:32px;text-align:center;color:var(--muted);font-size:13px">No hay ítems clasificados por categoría aún.</div>`;
  document.getElementById('gCiclos').innerHTML=CICLOS.map(c=>{
    const n=items.filter(x=>x.mod && x.mod.startsWith(c.id+'__')).length;
    return`<div class="ccard ${c.th}" onclick="openCiclo('${c.id}')">
      ${loading ? `<span class="ccard-count skel skel-count"></span>` : `<span class="ccard-count">${n} ítems</span>`}
      <div class="ccard-icon">${c.icon}</div>
      <div class="ccard-title">${c.name}</div>
      <div class="ccard-desc">${c.desc}</div>
    </div>`;
  }).join('');

}

function renderLoanBanner(){
  const el = document.getElementById('loanBanner');
  if(!el) return;
  el.innerHTML = '';
}

// ═════════════════════════════════════════════════════════
// META DE CABECERA (fecha, departamento, recuento)
// ═════════════════════════════════════════════════════════
function renderHeroMeta(){
  const el = document.getElementById('heroMeta');
  if(!el) return;
  const dept = (typeof SESSION!=='undefined' && SESSION && SESSION.departamentoNombre) ? SESSION.departamentoNombre : 'IES Juan Bosco';
  const fecha = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}).replace('.','');
  const aulasN = (typeof AULAS!=='undefined' && AULAS) ? AULAS.length : 0;
  el.innerHTML = `<span><strong>${dept}</strong></span><span>${aulasN} espacios registrados</span><span>${fecha}</span>`;
}

// ═════════════════════════════════════════════════════════
// MAPA DE INVENTARIO — arte generativo de la cabecera
// Un punto por aula, tamaño según nº de ítems, deriva
// suavemente como un plano de planta en escaneo continuo.
// Se recalcula cada vez que cambian los datos (renderHome).
// ═════════════════════════════════════════════════════════
let _heroRaf = null;
function startHeroCanvas(){
  const canvas = document.getElementById('heroCanvas');
  if(!canvas || typeof AULAS==='undefined') return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w=0,h=0,dpr=Math.min(window.devicePixelRatio||1,2);
  function resize(){
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    canvas.width = w*dpr; canvas.height = h*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();

  const src = AULAS.slice(0,28);
  if(!src.length){ if(_heroRaf) cancelAnimationFrame(_heroRaf); return; }
  const nodes = src.map((a,i)=>{
    const n = (typeof items!=='undefined' && items) ? items.filter(x=>x.aula===a.id).length : 0;
    return {
      x: Math.random(), y: Math.random(),
      vx: (Math.random()-.5)*0.00028, vy: (Math.random()-.5)*0.00028,
      r: 1.6 + Math.min(n,20)*0.32,
      phase: Math.random()*Math.PI*2,
    };
  });

  if(_heroRaf) cancelAnimationFrame(_heroRaf);
  let t=0;
  function frame(){
    t+=1;
    ctx.clearRect(0,0,w,h);
    // líneas de red entre nodos cercanos
    ctx.lineWidth=1;
    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const a=nodes[i], b=nodes[j];
        const dx=(a.x-b.x)*w, dy=(a.y-b.y)*h;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(d<130){
          ctx.strokeStyle = `rgba(56,189,248,${(1-d/130)*0.12})`;
          ctx.beginPath();
          ctx.moveTo(a.x*w,a.y*h);
          ctx.lineTo(b.x*w,b.y*h);
          ctx.stroke();
        }
      }
    }
    // nodos
    nodes.forEach(nd=>{
      if(!reduceMotion){
        nd.x += nd.vx; nd.y += nd.vy;
        if(nd.x<0||nd.x>1) nd.vx*=-1;
        if(nd.y<0||nd.y>1) nd.vy*=-1;
      }
      const pulse = reduceMotion ? 1 : 1 + Math.sin(t*0.02+nd.phase)*0.15;
      const px=nd.x*w, py=nd.y*h, rr=nd.r*pulse;
      const grad = ctx.createRadialGradient(px,py,0,px,py,rr*3.2);
      grad.addColorStop(0,'rgba(125,211,252,.55)');
      grad.addColorStop(1,'rgba(125,211,252,0)');
      ctx.fillStyle=grad;
      ctx.beginPath(); ctx.arc(px,py,rr*3.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(224,242,254,.9)';
      ctx.beginPath(); ctx.arc(px,py,rr,0,Math.PI*2); ctx.fill();
    });
    _heroRaf = reduceMotion ? null : requestAnimationFrame(frame);
  }
  frame();

  window.addEventListener('resize', resize, {passive:true});
}
