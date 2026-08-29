// ═════════════════════════════════════════════════════════
// HOME RENDER
// ═════════════════════════════════════════════════════════

// La rejilla de "Acciones rápidas" ya lleva título+subtítulo en el propio
// botón (ver index.html) — en móvil el CSS los oculta para no empujar la
// rejilla de aulas más abajo (.home-quick-btn span:not(.home-quick-ico)).
// En vez de reintroducir texto fijo, se enseña una vez con flecha apuntando
// a cada icono real (mismo mecanismo que "Mis Cursos/Aulas", generalizado
// en showPointerTourOnce) y no vuelve a ocupar espacio después.
function _showAccionesRapidasTourIfNarrow(){
  if(typeof showPointerTourOnce !== 'function') return;
  const grid = document.querySelector('.home-quick-grid');
  if(!grid) return;
  const botones = [...grid.querySelectorAll('.home-quick-btn')].filter(b => getComputedStyle(b).display !== 'none');
  if(!botones.length) return;
  const etiquetaOculta = botones.some(b => {
    const span = b.querySelector('span:not(.home-quick-ico)');
    return span && getComputedStyle(span).display === 'none';
  });
  if(!etiquetaOculta) return; // pantalla ancha: el texto ya se ve, no hace falta recorrido
  const steps = botones.map(b => {
    const ico = b.querySelector('.home-quick-ico')?.textContent || '';
    const titulo = b.querySelector('strong')?.textContent || '';
    const sub = b.querySelector('small')?.textContent || '';
    return { targetGetter: () => b, html: `${ico} <strong>${titulo}</strong><br>${sub}` };
  });
  showPointerTourOnce('accionesRapidasTour', steps);
}

// Modal "Requiere tu atención" — solo jefe/a departamento y superadmin
// (mismo permiso config.manage que ya gatea Aulas/Categorías/Ciclos y
// Accesos). Agrupa 4 señales que ya existen dispersas en otras vistas
// (Pedidos+Solicitudes, Mantenimiento, Préstamos vencidos, Accesos) para
// que no haga falta visitarlas una a una para saber si hay algo pendiente.
// Se abre sola una vez por sesión de navegador (sessionStorage, se olvida
// al cerrar la pestaña/navegador) — la llama loadData() (js/auth.js) en
// cuanto terminan de cargar items/pedidos/solicitudes/prestamos, no
// renderHome() (que se dispara antes, vía goHome(), con esos datos aún
// vacíos). Cerrarla (✕, clic fuera, o clic en un chip) no vuelve a
// abrirla en lo que dure esa sesión, aunque se vuelva a Inicio.
function _atencionAgrupar(lista, getDept){
  const porDepto = {};
  for(const x of lista){
    const d = getDept(x);
    if(!d) continue;
    porDepto[d] = (porDepto[d]||0) + 1;
  }
  return porDepto;
}

function _atencionMerge(...maps){
  const out = {};
  for(const m of maps) for(const k in m) out[k] = (out[k]||0) + m[k];
  return out;
}

function _atencionChip(icon, count, porDepto, label, onclick, cls){
  if(!count) return '';
  let detalle = '';
  if(porDepto){
    const entries = Object.entries(porDepto).sort((a,b)=>b[1]-a[1]);
    if(entries.length > 1){
      detalle = `<details class="atencion-breakdown"><summary>por departamento</summary>${
        entries.map(([slug,n])=>`<div class="atencion-breakdown-row"><span>${escHtml(deptNombre(slug))}</span><b>${n}</b></div>`).join('')
      }</details>`;
    }
  }
  return `<div class="atencion-item">
    <div class="scard-compact ${cls}" onclick="closeAtencionHoyModal();${onclick}" title="${escHtml(label)}: ${count}"><span class="icon">${icon}</span><span class="num">${count}</span><span class="lbl">${escHtml(label)}</span></div>
    ${detalle}
  </div>`;
}

function closeAtencionHoyModal(){
  sessionStorage.setItem('atencion_hoy_cerrado', '1');
  const modal = document.getElementById('mAtencionHoy');
  if(modal) modal.classList.remove('open');
}

// Llamada una sola vez por loadData() (js/auth.js, fase 2, justo tras
// itemsLoaded=true) — espera a las 4 señales, incluida Accesos (única que
// pide datos nuevos), antes de decidir si hay algo que mostrar.
async function checkAtencionHoy(){
  if(typeof can !== 'function' || !SESSION) return;
  if(sessionStorage.getItem('atencion_hoy_cerrado') === '1') return;

  if(!can('config.manage')){
    await _checkAtencionHoyProfesor();
    return;
  }

  const isSuperAdmin = typeof userRole === 'function' && userRole() === 'superadmin';
  const deptOfItem = id => items.find(x => String(x.id) === String(id))?.departamento || '';

  const solicitudesPendientes = (typeof solicitudes !== 'undefined' ? solicitudes : []).filter(s => s.estado === 'pendiente');
  const stockCount = Object.keys(pedidos).length + (typeof solBadgeCount === 'function' ? solBadgeCount() : 0);
  const stockPorDepto = isSuperAdmin ? _atencionMerge(
    _atencionAgrupar(Object.keys(pedidos), deptOfItem),
    _atencionAgrupar(solicitudesPendientes, s => s.departamento)
  ) : null;

  const mantLista = items.filter(needsAnyMaintenance);
  const mantPorDepto = isSuperAdmin ? _atencionAgrupar(mantLista, x => x.departamento) : null;

  const vencLista = typeof getVencidos === 'function' ? getVencidos() : [];
  const vencPorDepto = isSuperAdmin ? _atencionAgrupar(vencLista, p => deptOfItem(p.itemId)) : null;

  let accesos = { count: 0, porDepto: {} };
  try{
    const res = await apiPost({action:'getUsers'});
    const usuarios = (res && res.ok && Array.isArray(res.usuarios)) ? res.usuarios : [];
    const relevantes = usuarios.filter(u => u.bloqueado || u.password_temporal);
    accesos = { count: relevantes.length, porDepto: _atencionAgrupar(relevantes, u=>u.departamento) };
  } catch(e){ /* sin accesos si falla la red — no bloquea el resto de señales */ }

  // Puede haberse cerrado (u otra pestaña puede haberlo marcado) mientras
  // esperábamos la respuesta de Accesos.
  if(sessionStorage.getItem('atencion_hoy_cerrado') === '1') return;

  const chips = [
    _atencionChip('📦', stockCount, stockPorDepto, 'Pedidos/Solicitudes', 'openStockChoiceModal()', 'warn'),
    _atencionChip('🛠️', mantLista.length, mantPorDepto, 'Mantenimiento', 'goMaintenance()', 'warn'),
    _atencionChip('🔴', vencLista.length, vencPorDepto, 'Préstamos vencidos', "goPrestamos('activos')", 'alert'),
    _atencionChip('🔒', accesos.count, isSuperAdmin ? accesos.porDepto : null, 'Accesos', 'openAccesosModal()', 'alert'),
  ];

  const html = chips.filter(Boolean).join('');
  if(!html) return; // nada pendiente: no molestar con un modal vacío

  const body = document.getElementById('atencionHoyBody');
  const modal = document.getElementById('mAtencionHoy');
  if(!body || !modal) return;
  body.innerHTML = `<div class="atencion-strip">${html}</div>`;
  modal.classList.add('open');
}

// Rama reducida para profesorado sin config.manage: solo revisiones
// preventivas de sus propias categorías de mantenimiento asignadas
// (MIS_MANT_CATEGORIAS) — sin desglose por departamento (ya está acotado
// a lo suyo). Si no tiene categorías asignadas o no hay nada vencido, no
// se abre nada (mismo criterio que la rama de jefatura).
async function _checkAtencionHoyProfesor(){
  if(!Array.isArray(MIS_MANT_CATEGORIAS) || !MIS_MANT_CATEGORIAS.length) return;
  const propias = items.filter(x => needsPreventiveMaintenance(x)
    && (MIS_MANT_CATEGORIAS.includes('') || MIS_MANT_CATEGORIAS.includes(x.cat))
    && (!debeFiltrarPorMisAulas() || MIS_AULAS.includes(x.aula)));
  if(!propias.length) return;
  if(sessionStorage.getItem('atencion_hoy_cerrado') === '1') return;

  const chip = _atencionChip('🛠️', propias.length, null, 'Revisiones preventivas pendientes', 'goMaintenance()', 'warn');
  if(!chip) return;
  const body = document.getElementById('atencionHoyBody');
  const modal = document.getElementById('mAtencionHoy');
  if(!body || !modal) return;
  body.innerHTML = `<div class="atencion-strip">${chip}</div>`;
  modal.classList.add('open');
}

function renderHome(){
  // Banner de préstamos
  renderLoanBanner();
  renderFavoritos();

  const loading = !itemsLoaded;
  const esProfesor = typeof roleLabel === 'function' && roleLabel() === 'Profesor/a';
  const tieneMisAulas = esProfesor && Array.isArray(MIS_AULAS) && MIS_AULAS.length > 0;
  const filtrarPorMisAulas = debeFiltrarPorMisAulas();

  // Aviso descartable: sin esto, quien no abre nunca "📌 Mis Cursos/Aulas"
  // no descubre que puede elegir sus módulos/aulas — y las dos
  // personalizaciones de arriba (Inicio filtrado, aviso "también lo
  // imparte") se quedan sin usar. Se oculta explícitamente si ya no aplica
  // (no es profesor, o ya eligió ambas cosas), no solo se omite mostrarlo,
  // porque showPointerHintOnce() no oculta un hint que ya estaba visible.
  const necesitaConfigurarCursos = esProfesor && (!Array.isArray(MIS_MODULOS) || !MIS_MODULOS.length || !Array.isArray(MIS_AULAS) || !MIS_AULAS.length);
  if(necesitaConfigurarCursos){
    if(typeof showPointerHintOnce==='function') showPointerHintOnce('misCursosAulas', _misCursosHintTarget,
      '📌 <strong>Mis Cursos/Aulas</strong>: elige aquí tus módulos/asignaturas y las aulas en las que das clase — así verás solo lo tuyo en Inicio.');
  } else {
    const box = document.getElementById('floatingHintBox');
    if(box && box.dataset.key === 'misCursosAulas') box.style.display = 'none';
    // Recorrido de "Acciones rápidas" solo cuando ya no compite por el
    // mismo hint flotante con el aviso de arriba (prioridad: primero
    // configurar cursos/aulas, luego descubrir los iconos de Inicio).
    _showAccionesRapidasTourIfNarrow();
  }

  const total=items.length;
  const itemsParaAlertas = filtrarPorMisAulas ? items.filter(x=>MIS_AULAS.includes(x.aula)) : items;
  const low=itemsParaAlertas.filter(isLowStock).length;
  const mant=itemsParaAlertas.filter(needsAnyMaintenance).length;
  const units=items.reduce((a,x)=>a+(Number(x.qty)||0),0);
  const oc = (typeof can==='function' && can('visibility.manage')) ? items.filter(x=>x.oculto==1).length : 0;
  const ocCard = (typeof can==='function' && can('visibility.manage'))
    ? `<div class="scard" onclick="goOcultos()" style="cursor:pointer"><div class="scard-icon">🙈</div><div class="scard-copy"><div class="scard-num">${oc}</div><div class="scard-lbl">Ocultos</div></div></div>`
    : '';
  const lblStockBajo = filtrarPorMisAulas ? 'Stock bajo <span class="scard-lbl-sub">(tus aulas)</span>' : 'Stock bajo';
  const lblMant = filtrarPorMisAulas ? 'Mantenimiento <span class="scard-lbl-sub">(tus aulas)</span>' : 'Mantenimiento';
  document.getElementById('hStats').innerHTML= loading
    ? `<div class="scard scard-loading"><div class="scard-icon">📦</div><div class="scard-copy"><div class="scard-num skel"></div><div class="scard-lbl">Ítems</div></div></div>
       <div class="scard scard-loading"><div class="scard-icon">🔢</div><div class="scard-copy"><div class="scard-num skel"></div><div class="scard-lbl">Unidades</div></div></div>
       <div class="scard scard-loading"><div class="scard-icon">⚠️</div><div class="scard-copy"><div class="scard-num skel"></div><div class="scard-lbl">Stock bajo</div></div></div>
       <div class="scard scard-loading"><div class="scard-icon">🛠️</div><div class="scard-copy"><div class="scard-num skel"></div><div class="scard-lbl">Mantenimiento</div></div></div>`
    : `<div class="scard"><div class="scard-icon">📦</div><div class="scard-copy"><div class="scard-num">${total}</div><div class="scard-lbl">Ítems</div></div></div>
    <div class="scard"><div class="scard-icon">🔢</div><div class="scard-copy"><div class="scard-num">${units.toLocaleString()}</div><div class="scard-lbl">Unidades</div></div></div>
    <div class="scard${low?' scard-alert':''}" ${low?'onclick="goLowStock()" style="cursor:pointer"':''}><div class="scard-icon">⚠️</div><div class="scard-copy"><div class="scard-num" style="color:var(--red)">${low}</div><div class="scard-lbl">${lblStockBajo}</div></div></div>
    <div class="scard${mant?' scard-alert':''}" ${mant?'onclick="goMaintenance()" style="cursor:pointer"':''}><div class="scard-icon">🛠️</div><div class="scard-copy"><div class="scard-num" style="color:var(--amber)">${mant}</div><div class="scard-lbl">${lblMant}</div></div></div>${ocCard}`;
  const countHtml = loading ? `<span class="ccard-count skel skel-count"></span>` : null;
  let aulaEntries = loading ? AULAS : AULAS.filter(a=>items.some(x=>x.aula===a.id));
  if(filtrarPorMisAulas) aulaEntries = aulaEntries.filter(a=>MIS_AULAS.includes(a.id));
  const misAulasToggleWrap = document.getElementById('misAulasToggleWrap');
  if(misAulasToggleWrap){
    misAulasToggleWrap.style.display = tieneMisAulas ? 'inline' : 'none';
    const misAulasToggleBtn = document.getElementById('misAulasToggleBtn');
    if(misAulasToggleBtn) misAulasToggleBtn.textContent = filtrarPorMisAulas ? '🏫 Ver todas las aulas' : '🏫 Ver solo mis aulas';
  }
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

function toggleVerTodasAulas(){
  const actual = localStorage.getItem('home_ver_todas_aulas') === '1';
  localStorage.setItem('home_ver_todas_aulas', actual ? '0' : '1');
  renderHome();
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

function renderFavoritos(){
  const sec = document.getElementById('secFavoritos');
  const strip = document.getElementById('gFavoritos');
  if(!sec || !strip) return;
  const favs = [...favoritos].map(id=>items.find(x=>String(x.id)===id)).filter(Boolean);
  sec.style.display = favs.length ? '' : 'none';
  strip.style.display = favs.length ? '' : 'none';
  strip.innerHTML = favs.map(x=>{
    const cat=CATS[x.cat]||null;
    const low=isLowStock(x);
    return`<span class="fav-chip" onclick="openItemRoute('${String(x.id)}')" title="Abrir ${escHtml(x.item)}">
      ${cat?escHtml(cat.i):'📦'} ${escHtml(x.item)}
      <span class="fav-chip-qty ${low?'qlow':'qok'}">${x.qty}</span>
      <button class="fav-chip-x" onclick="event.stopPropagation();toggleFavorito('${String(x.id)}')" title="Quitar de fijados">✕</button>
    </span>`;
  }).join('');
}
