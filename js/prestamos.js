// ═════════════════════════════════════════════════════════
// PRÉSTAMOS
// ═════════════════════════════════════════════════════════
let _vencidosNotifCheckDone = false; // Bandera para notificar vencidos solo una vez por sesión

function getPrestamosActivos(){
  return prestamos.filter(p=>p.estado==='Activo'||p.estado==='Parcial');
}

function isVencido(pres){
  if(pres.estado!=='Activo'&&pres.estado!=='Parcial') return false;
  if(!pres.fechaPrevista) return false;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const prev = new Date(pres.fechaPrevista);
  return prev < hoy;
}

function esAdminOJefe(){
  const rol = (SESSION?.rol || '').toLowerCase().trim();
  return ['jefe departamento','jefe de departamento','administrador','admin','superadmin','super admin'].includes(rol);
}

function getVencidosParaUsuario(){
  const activos = getPrestamosActivos().filter(isVencido);
  if(esAdminOJefe()) return activos;
  const miNombre = (SESSION?.nombre || '').toLowerCase().trim();
  return activos.filter(p=>(p.profesorNombre||'').toLowerCase().trim()===miNombre);
}

function getVencidos(){
  return getPrestamosActivos().filter(isVencido);
}

function updatePresVencBadge(){
  const badge = document.getElementById('presVencBadge');
  if(!badge) return;
  const n = getVencidosParaUsuario().length;
  if(n > 0){
    badge.textContent = n > 99 ? '99+' : n;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function notificarVencidosAlBackend(){
  // Fire-and-forget: notificar al backend sobre vencidos, sin bloquear el render.
  // El flag _vencidosNotifCheckDone solo se marca en el momento exacto en que se
  // decide de verdad disparar la llamada — nunca antes, para no perder la
  // oportunidad de notificar en una visita posterior si los datos aún no
  // estaban cargados (ver loadData() en js/auth.js, fase 1 vs fase 2).
  if(_vencidosNotifCheckDone) return; // Ya notificado (o descartado) en esta carga de página
  if(!itemsLoaded) return; // Datos de préstamos aún no cargados (fase 2 de loadData() no ha terminado) — no marcar el flag
  if(!can('loans.write')) return; // Silencioso: no muestra error, solo no notifica
  if(getVencidos().length === 0) return; // Sin vencidos, no hay nada que notificar

  _vencidosNotifCheckDone = true;
  apiPost({action:'notificarVencidos'}).catch(()=>{}); // Silencioso: ignorar errores de red
}

function goPrestamos(tab){
  _push({page:'prestamos'}, '#prestamos');
  cf=null; currentCiclo=null;
  if(tab) currentPresTab = tab;
  document.getElementById('btnN').style.display='none';
  document.getElementById('btnE').style.display='none';
  _hideHomeButtons();
  if(typeof applyRoleUI === 'function') applyRoleUI();
  document.getElementById('bc').innerHTML=`<span class="bc-link" onclick="goHome()">Inicio</span><span class="sep">›</span><strong>📋 Préstamos</strong>`;

  // Stats
  const activos = getPrestamosActivos().length;
  const vencidos = getVencidos().length;
  const devueltos = prestamos.filter(p=>p.estado==='Devuelto').length;
  document.getElementById('presStats').innerHTML=`
    <div class="scard"><div class="scard-icon">🟡</div><div><div class="scard-num">${activos}</div><div class="scard-lbl">activos</div></div></div>
    <div class="scard"><div class="scard-icon">🔴</div><div><div class="scard-num" style="color:var(--red)">${vencidos}</div><div class="scard-lbl">vencidos</div></div></div>
    <div class="scard"><div class="scard-icon">✅</div><div><div class="scard-num">${devueltos}</div><div class="scard-lbl">devueltos (histórico)</div></div></div>
    <div class="scard"><div class="scard-icon">👥</div><div><div class="scard-num">${profesores.length}</div><div class="scard-lbl">profesores/as</div></div></div>
  `;
  document.getElementById('presMeta').textContent = `${prestamos.length} préstamo${prestamos.length!==1?'s':''} registrado${prestamos.length!==1?'s':''} en total`;

  // Tabs
  ['activos','historial'].forEach(t=>{
    document.getElementById('pt'+t.charAt(0).toUpperCase()+t.slice(1)).classList.toggle('active', currentPresTab===t);
  });

  // El toggle "solo vencidos" y el select de agrupar solo tienen sentido en la tab Activos
  const vencWrap = document.getElementById('presVencToggleWrap');
  if(vencWrap) vencWrap.style.display = currentPresTab==='activos' ? '' : 'none';
  const vencCheckbox = document.getElementById('presVencToggle');
  if(vencCheckbox) vencCheckbox.checked = currentPresOnlyVencidos;

  const groupSelect = document.getElementById('presGroupBy');
  if(groupSelect) groupSelect.value = currentPresGroupBy;
  const groupWrap = groupSelect ? groupSelect.closest('.pres-group-select') : null;
  if(groupWrap) groupWrap.style.display = currentPresTab==='activos' ? '' : 'none';

  // El buscador solo tiene sentido en las vistas de lista, ocultarlo en las vistas agrupadas
  const isGrouped = currentPresTab==='activos' && !!currentPresGroupBy;
  document.querySelector('#pPres .sbox').style.display = isGrouped ? 'none' : '';

  show('pPres');
  renderPrestamos();

  // Notificar al backend sobre vencidos, una sola vez por sesión de página
  // (toda la lógica de decisión, incluido el marcado del flag, vive dentro
  // de la función — ver notificarVencidosAlBackend())
  notificarVencidosAlBackend();
}

function setPresTab(tab){
  currentPresTab = tab;
  goPrestamos(tab);
}

function togglePresVencidos(){
  currentPresOnlyVencidos = document.getElementById('presVencToggle').checked;
  renderPrestamos();
}

function setPresGroupBy(val){
  currentPresGroupBy = val;
  localStorage.setItem('pres_group_by', val);
  const isGrouped = currentPresTab==='activos' && !!val;
  document.querySelector('#pPres .sbox').style.display = isGrouped ? 'none' : '';
  renderPrestamos();
}

function _presCardHtml(p){
  const venc = isVencido(p);
  const item = items.find(x=>Number(x.id)===Number(p.itemId));
  const aulaO = AULAS.find(a=>a.id===p.aulaOrigen)?.name || p.aulaOrigen;
  const aulaD = p.aulaDestino ? (AULAS.find(a=>a.id===p.aulaDestino)?.name || p.aulaDestino) : '—';
  const pendiente = Number(p.cantidad) - Number(p.cantidadDevuelta||0);
  const stateClass = p.estado==='Devuelto'?'devuelto':(p.estado==='Parcial'?'parcial':(venc?'vencido':''));
  const pillClass = stateClass;
  return `<div class="pres-card ${stateClass}">
    <div class="pres-info">
      <div class="pres-name">${escHtml(p.itemNombre)} ${item?`<span style="color:var(--muted);font-weight:400;font-size:12px">· ${escHtml(item.ref||'')}</span>`:''}</div>
      <div class="pres-prof">${escHtml(p.profesorNombre)}</div>
      <div class="pres-meta">
        <span>📅 ${escHtml(p.fechaPrestamo)}${p.fechaPrevista?` → ${escHtml(p.fechaPrevista)}`:''}</span>
        <span>🏫 ${escHtml(aulaO)}${p.aulaDestino?` → ${escHtml(aulaD)}`:''}</span>
        <span class="pres-pill ${pillClass}">${escHtml(p.estado)}${venc&&p.estado!=='Devuelto'?' (vencido)':''}</span>
      </div>
      ${p.obs?`<div style="font-size:11px;color:var(--muted);margin-top:4px">💬 ${escHtml(p.obs)}</div>`:''}
    </div>
    <div class="pres-actions">
      <div class="pres-qty-info">
        <div class="pres-qty-num">${pendiente}/${p.cantidad}</div>
        <div>pendiente</div>
      </div>
      ${p.estado!=='Devuelto'?`<button class="btn btn-sm btn-return" onclick="openDevolver(${p.id})">📥 Devolver</button>`:''}
    </div>
  </div>`;
}

function _renderGrouped(groupKey){
  const activos = getPrestamosActivos();
  const mc = document.getElementById('presContent');
  if(!activos.length){
    mc.innerHTML=`<div class="empty"><div class="ei">📋</div><div class="et">No hay préstamos activos</div></div>`;
    return;
  }

  // Agrupar
  const groups = {};
  activos.forEach(p=>{
    let key, label, sublabel='';
    if(groupKey==='profesor'){
      key = p.profesorId || p.profesorNombre;
      label = p.profesorNombre;
    } else if(groupKey==='aula'){
      key = p.aulaOrigen;
      label = AULAS.find(a=>a.id===p.aulaOrigen)?.name || p.aulaOrigen;
    } else {
      key = p.itemId;
      label = p.itemNombre;
      const it = items.find(x=>Number(x.id)===Number(p.itemId));
      sublabel = it ? (it.ref||'') : '';
    }
    if(!groups[key]) groups[key] = {label, sublabel, prestamos:[]};
    groups[key].prestamos.push(p);
  });

  // Ordenar grupos: primero los que tienen vencidos, luego alfabético
  const sorted = Object.values(groups).sort((a,b)=>{
    const aVenc = a.prestamos.some(isVencido);
    const bVenc = b.prestamos.some(isVencido);
    if(aVenc && !bVenc) return -1;
    if(!aVenc && bVenc) return 1;
    return a.label.localeCompare(b.label);
  });

  mc.innerHTML = sorted.map(g=>{
    const total = g.prestamos.reduce((s,p)=>s+(Number(p.cantidad)-Number(p.cantidadDevuelta||0)),0);
    const vencidos = g.prestamos.filter(isVencido).length;
    const badgeClass = vencidos ? 'warn' : '';
    const badgeTxt = vencidos ? `⚠ ${vencidos} vencido${vencidos!==1?'s':''}` : `${g.prestamos.length} préstamo${g.prestamos.length!==1?'s':''}`;

    // Ordenar préstamos del grupo: vencidos primero
    const sorted2 = [...g.prestamos].sort((a,b)=>(isVencido(b)?1:0)-(isVencido(a)?1:0));

    const rows = sorted2.map(p=>{
      const venc = isVencido(p);
      const pendiente = Number(p.cantidad)-Number(p.cantidadDevuelta||0);
      let meta = '';
      if(groupKey==='profesor'){
        meta = `${escHtml(p.itemNombre)}${items.find(x=>Number(x.id)===Number(p.itemId))?.ref?' ['+escHtml(items.find(x=>Number(x.id)===Number(p.itemId)).ref)+']':''} · ${pendiente} ud${pendiente!==1?'s':''}`;
      } else if(groupKey==='aula'){
        meta = `${escHtml(p.itemNombre)} — ${escHtml(p.profesorNombre)} · ${pendiente} ud${pendiente!==1?'s':''}`;
      } else {
        meta = `${escHtml(p.profesorNombre)} · ${pendiente} ud${pendiente!==1?'s':''}`;
      }
      const fechaTxt = p.fechaPrevista ? `devolver: ${escHtml(p.fechaPrevista)}` : `prestado: ${escHtml(p.fechaPrestamo)}`;
      return `<div class="pres-group-row">
        <div class="pres-group-row-info">
          <strong>${meta}</strong>
          <span class="${venc?'venc':''}">📅 ${fechaTxt}${venc?' ⚠ Vencido':''}</span>
        </div>
        <button class="btn btn-sm btn-return" onclick="openDevolver(${p.id})">📥 Devolver</button>
      </div>`;
    }).join('');

    return `<div class="pres-group">
      <div class="pres-group-header">
        <div>
          <div class="pres-group-title">${escHtml(g.label)}${g.sublabel?` <span style="font-weight:400;font-size:12px;color:var(--muted)">${escHtml(g.sublabel)}</span>`:''}</div>
          <div class="pres-group-meta">${total} unidad${total!==1?'es':''} fuera</div>
        </div>
        <span class="pres-group-badge ${badgeClass}">${badgeTxt}</span>
      </div>
      <div class="pres-group-body">${rows}</div>
    </div>`;
  }).join('');
}

function renderPrestamos(){
  updatePresVencBadge();
  if(currentPresTab==='activos' && currentPresGroupBy){
    _renderGrouped(currentPresGroupBy);
    return;
  }

  const q = document.getElementById('presSearch').value.toLowerCase();
  let data;
  if(currentPresTab==='activos'){
    data = currentPresOnlyVencidos ? getVencidos() : getPrestamosActivos();
  } else {
    data = prestamos.filter(p=>p.estado==='Devuelto');
  }

  if(q){
    data = data.filter(p=>[p.itemNombre,p.profesorNombre,p.obs].join(' ').toLowerCase().includes(q));
  }

  data.sort((a,b)=>{
    if(currentPresTab==='historial') return new Date(b.fechaDevolucion||b.fechaPrestamo) - new Date(a.fechaDevolucion||a.fechaPrestamo);
    return new Date(a.fechaPrevista||a.fechaPrestamo) - new Date(b.fechaPrevista||b.fechaPrestamo);
  });

  const mc = document.getElementById('presContent');
  if(!data.length){
    const msg = currentPresTab==='historial' ? 'No hay préstamos en el histórico'
      : currentPresOnlyVencidos ? '¡Sin préstamos vencidos! 🎉'
      : 'No hay préstamos activos';
    mc.innerHTML=`<div class="empty"><div class="ei">📋</div><div class="et">${msg}</div></div>`;
    return;
  }

  mc.innerHTML = data.map(_presCardHtml).join('');
}

// ─── PRESTAR ─────────────────────────────────────────────
function _fillPrestarInfo(item){
  const aulaNombre = AULAS.find(a=>a.id===item.aula)?.name || item.aula || '—';
  document.getElementById('prestarItemInfo').innerHTML = `
    <div style="font-weight:700;font-size:14px;margin-bottom:4px">${item.item}</div>
    <div style="font-size:12px;color:var(--muted)">
      ${item.ref?`<span style="font-family:var(--mono);background:var(--white);padding:2px 6px;border-radius:4px;margin-right:8px">${item.ref}</span>`:''}
      📍 ${escHtml(aulaNombre)} &nbsp;·&nbsp;
      Stock disponible: <strong style="color:var(--accent)">${item.qty} unidades</strong>
    </div>`;
}

function _buildPresItemOptions(filtered){
  document.getElementById('pres_item').innerHTML =
    '<option value="">— Seleccionar ítem —</option>' +
    filtered.map(x=>{
      const aulaNombre = AULAS.find(a=>a.id===x.aula)?.name || x.aula || '—';
      return `<option value="${x.id}">${x.item}${x.ref?' ['+x.ref+']':''} · ${aulaNombre} · ${x.qty} uds.</option>`;
    }).join('');
}

function filterPresItems(){
  const aulaVal = document.getElementById('pres_filtAula').value;
  const q = document.getElementById('pres_filtQ').value.toLowerCase().trim();
  let filtered = items.filter(x=>Number(x.qty)>0);
  if(aulaVal) filtered = filtered.filter(x=>String(x.aula)===String(aulaVal));
  if(q) filtered = filtered.filter(x=>(x.item+' '+(x.ref||'')).toLowerCase().includes(q));
  filtered.sort((a,b)=>a.item.localeCompare(b.item));
  _buildPresItemOptions(filtered);
  // reset selection
  prestarItemId = null;
  document.getElementById('prestarItemInfo').innerHTML='<div style="color:var(--muted);font-size:13px">Selecciona un ítem para ver su información</div>';
}

function onPresItemChange(val){
  if(!val){ prestarItemId=null; document.getElementById('prestarItemInfo').innerHTML='<div style="color:var(--muted);font-size:13px">Selecciona un ítem para ver su información</div>'; return; }
  const item = items.find(x=>String(x.id)===String(val));
  if(!item) return;
  prestarItemId = item.id;
  _fillPrestarInfo(item);
  document.getElementById('pres_aulaDest').innerHTML = '<option value="">— Sin especificar —</option>' +
    renderAulaOptions(AULAS.filter(a=>a.id!==item.aula));
  document.getElementById('pres_cant').max = item.qty;
  document.getElementById('pres_cant').value = 1;
}

function isOwnLoanTeacher(p){
  const sessionName = (SESSION?.nombre || '').toLowerCase().trim();
  const sessionUser = (SESSION?.usuario || '').toLowerCase().trim();
  return (
    String(p.usuario || '').toLowerCase().trim() === sessionUser ||
    String(p.nombre || '').toLowerCase().trim() === sessionName
  );
}

function isExternalLoanTeacher(p){
  // profesores.results (tabla propia) trae su departamento real; los que
  // vienen de usuarios de la app (source==='usuarios') ya llegan del
  // backend filtrados por el propio departamento del actor (list.js:153),
  // así que no hace falta comprobarlo aquí — cualquiera de los dos origenes
  // es un prestatario válido dentro del mismo departamento.
  const dep = String(p.departamento || '').toLowerCase().trim();
  return dep !== 'departamento';
}

function loanTeacherOptions(){
  return profesores
    .filter(p => String(p.nombre||'').trim() && String(p.nombre||'').trim().toLowerCase() !== 'departamento')
    .filter(p => isOwnLoanTeacher(p) || isExternalLoanTeacher(p));
}

let _presProfOptions = [];
let _cajaProfOptions = [];

function _renderProfSelectOptions(selectId, list, selectedId){
  const sel = document.getElementById(selectId);
  sel.innerHTML = '<option value="">— Seleccionar —</option>' +
    list.map(p=>`<option value="${p.id}" ${selectedId!==undefined && String(p.id)===String(selectedId)?'selected':''}>${escHtml(p.nombre)}${p.departamento?' ('+escHtml(p.departamento)+')':''}</option>`).join('');
}

function filterProfSelect(listVarName, inputId, selectId){
  const full = listVarName === '_presProfOptions' ? _presProfOptions : _cajaProfOptions;
  const q = normalize(document.getElementById(inputId).value);
  const filtered = q ? full.filter(p => normalize(p.nombre).includes(q)) : full;
  _renderProfSelectOptions(selectId, filtered);
}

function openPrestarPicker(){
  if(!requirePerm('loans.write')) return;
  document.getElementById('mPrestarPicker').classList.add('open');
}
function closePrestarPicker(){ document.getElementById('mPrestarPicker').classList.remove('open'); }

async function openPrestar(itemId){
  if(!requirePerm('loans.write')) return;
  if(!profesores.length){
    if(await confirmDialog({message:'No hay profesores registrados. ¿Quieres añadir alguno ahora?'})){ openProfModal(); }
    return;
  }

  const selector = document.getElementById('prestarItemSelector');

  if(itemId!==undefined && itemId!==null){
    const item = items.find(x=>Number(x.id)===Number(itemId));
    if(!item) return;
    if(Number(item.qty)<=0){ toast('No hay stock disponible para prestar','err'); return; }
    prestarItemId = itemId;
    selector.style.display = 'none';
    _fillPrestarInfo(item);
    document.getElementById('pres_aulaDest').innerHTML = '<option value="">— Sin especificar —</option>' +
      renderAulaOptions(AULAS.filter(a=>a.id!==item.aula));
    document.getElementById('pres_cant').value = 1;
    document.getElementById('pres_cant').max = item.qty;
  } else {
    prestarItemId = null;
    selector.style.display = '';
    // Filtro de aulas
    document.getElementById('pres_filtAula').innerHTML = '<option value="">Todas las aulas</option>' +
      renderAulaOptions();
    document.getElementById('pres_filtQ').value = '';
    // Lista de ítems (todos con stock, ordenados)
    const disponibles = items.filter(x=>Number(x.qty)>0).sort((a,b)=>String(a.item||'').localeCompare(String(b.item||'')));
    _buildPresItemOptions(disponibles);
    document.getElementById('prestarItemInfo').innerHTML = '<div style="color:var(--muted);font-size:13px">Selecciona un ítem para ver su información</div>';
    document.getElementById('pres_aulaDest').innerHTML = '<option value="">— Sin especificar —</option>';
    document.getElementById('pres_cant').value = 1;
    document.getElementById('pres_cant').max = 9999;
  }

  // Preseleccionar el usuario logueado si existe como profesor prestatario
  document.getElementById('pres_profFiltQ').value = '';
  _presProfOptions = loanTeacherOptions();
  const profPropio = _presProfOptions.find(p => p.nombre.toLowerCase().trim() === (SESSION?.nombre||'').toLowerCase().trim());
  document.getElementById('pres_prof').disabled = false;
  _renderProfSelectOptions('pres_prof', _presProfOptions, profPropio ? profPropio.id : undefined);

  const f = new Date(); f.setDate(f.getDate()+7);
  document.getElementById('pres_fecha').value = f.toISOString().split('T')[0];
  document.getElementById('pres_obs').value = '';

  document.getElementById('mPrestar').classList.add('open');
}
function closePrestar(){ document.getElementById('mPrestar').classList.remove('open'); }

// ─── PRÉSTAMO DE CAJA COMPLETA ────────────────────────────
let _prestarCajaId = null;

function _cajasConStock(){
  return items.filter(x => x.es_contenedor &&
    items.some(h => Number(h.parent_id)===Number(x.id) && Number(h.qty)>0)
  );
}

function _buildPresCajaOptions(filtered){
  document.getElementById('pres_cajaSelect').innerHTML =
    '<option value="">— Seleccionar caja —</option>' +
    filtered.map(x=>{
      const aulaNombre = AULAS.find(a=>a.id===x.aula)?.name || x.aula || '—';
      return `<option value="${x.id}">${x.item}${x.ref?' ['+x.ref+']':''} · ${aulaNombre}</option>`;
    }).join('');
}

function filterPresCajaItems(){
  const aulaVal = document.getElementById('pres_cajaFiltAula').value;
  const q = normalize(document.getElementById('pres_cajaFiltQ').value);
  let filtered = _cajasConStock();
  if(aulaVal) filtered = filtered.filter(x=>String(x.aula)===String(aulaVal));
  if(q) filtered = filtered.filter(x=>normalize(x.item+' '+(x.ref||'')).includes(q));
  filtered.sort((a,b)=>a.item.localeCompare(b.item));
  _buildPresCajaOptions(filtered);
  // reset selection
  _prestarCajaId = null;
  document.getElementById('prestarCajaNombre').textContent = '';
  document.getElementById('prestarCajaComponentes').innerHTML = '<div style="color:var(--muted);font-size:13px">Selecciona una caja para ver sus componentes</div>';
}

function onPresCajaSelectChange(val){
  if(!val) return;
  _loadCajaIntoModal(Number(val), false);
}

function openPrestarCaja(cajaId){
  if(!requirePerm('loans.write')) return;
  const selector = document.getElementById('prestarCajaSelector');

  if(cajaId!==undefined && cajaId!==null){
    selector.style.display = 'none';
    if(!_loadCajaIntoModal(Number(cajaId), true)) return;
  } else {
    selector.style.display = '';
    _prestarCajaId = null;
    document.getElementById('pres_cajaFiltAula').innerHTML = '<option value="">Todas las aulas</option>' +
      renderAulaOptions();
    document.getElementById('pres_cajaFiltQ').value = '';
    _buildPresCajaOptions(_cajasConStock().sort((a,b)=>a.item.localeCompare(b.item)));
    document.getElementById('prestarCajaNombre').textContent = '';
    document.getElementById('prestarCajaComponentes').innerHTML = '<div style="color:var(--muted);font-size:13px">Selecciona una caja para ver sus componentes</div>';

    document.getElementById('prestarCajaProfFiltQ').value = '';
    _cajaProfOptions = loanTeacherOptions();
    document.getElementById('prestarCajaProf').disabled = false;
    _renderProfSelectOptions('prestarCajaProf', _cajaProfOptions, undefined);

    document.getElementById('prestarCajaAulaDest').innerHTML = '<option value="">— Sin especificar —</option>' +
      renderAulaOptions();

    const f = new Date(); f.setDate(f.getDate()+7);
    document.getElementById('prestarCajaFecha').value = f.toISOString().split('T')[0];
    document.getElementById('prestarCajaObs').value = '';
  }

  document.getElementById('mPrestarCaja').classList.add('open');
}

function _loadCajaIntoModal(cajaId, initForm){
  const caja = items.find(x=>Number(x.id)===Number(cajaId));
  if(!caja) return false;
  const hijos = items.filter(x=>Number(x.parent_id)===Number(cajaId) && Number(x.qty)>0);
  if(!hijos.length){ toast('La caja no tiene componentes con stock','err'); return false; }
  _prestarCajaId = cajaId;

  const cajaAulaNombre = AULAS.find(a=>a.id===caja.aula)?.name || caja.aula || '—';
  document.getElementById('prestarCajaNombre').textContent = `${caja.ref ? caja.ref+' · ' : ''}${caja.item} · 📍 ${cajaAulaNombre}`;
  document.getElementById('prestarCajaComponentes').innerHTML = hijos.map(h=>
    `<div style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--border)">
      <span style="font-weight:600">${escHtml(h.item)}</span>
      <span style="color:var(--muted);font-size:12px"> · ${h.qty} ud.</span>
    </div>`
  ).join('');

  if(initForm){
    document.getElementById('prestarCajaProfFiltQ').value = '';
    _cajaProfOptions = loanTeacherOptions();
    const profPropioCaja = _cajaProfOptions.find(p => p.nombre.toLowerCase().trim() === (SESSION?.nombre||'').toLowerCase().trim());
    document.getElementById('prestarCajaProf').disabled = false;
    _renderProfSelectOptions('prestarCajaProf', _cajaProfOptions, profPropioCaja ? profPropioCaja.id : undefined);
  }

  document.getElementById('prestarCajaAulaDest').innerHTML = '<option value="">— Sin especificar —</option>' +
    renderAulaOptions();

  if(initForm){
    const f = new Date(); f.setDate(f.getDate()+7);
    document.getElementById('prestarCajaFecha').value = f.toISOString().split('T')[0];
    document.getElementById('prestarCajaObs').value = '';
  }
  return true;
}

function closePrestarCaja(){ document.getElementById('mPrestarCaja').classList.remove('open'); _prestarCajaId = null; }

async function confirmPrestarCaja(){
  const profId = document.getElementById('prestarCajaProf').value;
  if(!profId){ toast('Selecciona un/a profesor/a','err'); return; }
  const prof = profesores.find(p=>String(p.id)===String(profId));
  if(!prof) return;
  const btn = document.getElementById('btnPrestarCajaSave');
  btn.disabled = true; btn.textContent = '⏳ Registrando...';
  try {
    const res = await apiPost({
      action: 'prestarCaja',
      cajaId: _prestarCajaId,
      profesorId: prof.id,
      profesorNombre: prof.nombre,
      aulaDestino: document.getElementById('prestarCajaAulaDest').value,
      fechaPrevista: document.getElementById('prestarCajaFecha').value,
      obs: document.getElementById('prestarCajaObs').value.trim(),
      gestionadoPor: SESSION?.nombre || '',
      fechaPrestamo: new Date().toISOString().split('T')[0],
    });
    if(!res.ok) throw new Error(res.error);
    // Actualizar estado local
    for(const p of (res.prestamos || [])){
      prestamos.push(p);
      const idx = items.findIndex(x=>Number(x.id)===Number(p.itemId));
      if(idx>=0) items[idx].qty = Number(items[idx].qty) - Number(p.cantidad);
    }
    closePrestarCaja();
    toast(`Caja prestada: ${res.prestamos?.length || 0} componentes registrados`,'ok');
    if(cf) openSub(); else renderHome();
  } catch(err){ toast('Error: '+err.message,'err'); }
  finally { btn.disabled=false; btn.textContent='📦 Registrar préstamo de caja'; }
}

async function confirmPrestar(){
  if(prestarItemId===null||prestarItemId===undefined){ toast('Selecciona un ítem','err'); return; }
  const profId = document.getElementById('pres_prof').value;
  const cant = parseInt(document.getElementById('pres_cant').value)||0;
  if(!profId){ toast('Selecciona un/a profesor/a','err'); return; }
  if(cant<=0){ toast('Cantidad inválida','err'); return; }

  const item = items.find(x=>Number(x.id)===Number(prestarItemId));
  const prof = profesores.find(p=>String(p.id)===String(profId));
  if(!item){ toast('Ítem no encontrado','err'); return; }
  if(!prof){ toast('Profesor/a no encontrado/a','err'); return; }
  if(cant > Number(item.qty)){ toast(`Solo hay ${item.qty} disponible(s)`,'err'); return; }

  const modInfo = findModulo(item.mod);
  const pres = {
    itemId: item.id,
    itemNombre: item.item,
    cantidad: cant,
    aulaOrigen: item.aula,
    aulaDestino: document.getElementById('pres_aulaDest').value,
    profesorId: prof.id,
    profesorNombre: prof.nombre,
    fechaPrevista: document.getElementById('pres_fecha').value,
    obs: document.getElementById('pres_obs').value.trim(),
    moduloCod: modInfo ? item.mod : '',
    moduloNombre: modInfo ? modInfo.name : '',
  };

  const btn = document.getElementById('btnPrestarSave');
  btn.disabled = true; btn.textContent = '⏳ Registrando...';
  try {
    const res = await apiPost({action:'prestar', prestamo:pres});
    if(!res.ok) throw new Error(res.error);
    prestamos.push(res.prestamo);
    const i = items.findIndex(x=>Number(x.id)===Number(item.id));
    items[i].qty = Number(items[i].qty) - cant;
    closePrestar();
    toast(`Préstamo registrado: ${cant} × ${item.item}`,'ok');
    if(cf) openSub(); else renderHome();
  } catch(err){ toast('Error: '+err.message,'err'); }
  finally { btn.disabled=false; btn.textContent='📤 Registrar préstamo'; }
}

// ─── DEVOLVER ────────────────────────────────────────────
function formatFechaEs(iso){
  if(!iso) return '';
  const [y,m,d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
}

function openDevolver(presId){
  if(!requirePerm('loans.write')) return;
  const p = prestamos.find(x=>Number(x.id)===Number(presId));
  if(!p) return;
  devolverPresId = presId;
  const btn = document.getElementById('btnDevolverSave');
  btn.disabled = false; btn.textContent = '📥 Confirmar devolución';
  const pendiente = Number(p.cantidad) - Number(p.cantidadDevuelta||0);
  const vencidoHtml = isVencido(p)
    ? `<div style="color:var(--red);font-weight:600;margin-top:6px">⚠ Vencido desde el ${formatFechaEs(p.fechaPrevista)}</div>`
    : '';

  document.getElementById('devolverInfo').innerHTML = `
    <div style="font-weight:700;font-size:14px;margin-bottom:4px">${p.itemNombre}</div>
    <div style="font-size:12px;color:var(--muted)">
      Profesor: <strong>${p.profesorNombre}</strong><br>
      Pendiente de devolver: <strong style="color:var(--green)">${pendiente} unidad${pendiente!==1?'es':''}</strong>${Number(p.cantidadDevuelta)>0?` (de ${p.cantidad} prestadas)`:''}
    </div>
    ${vencidoHtml}`;

  const cantInput = document.getElementById('dev_cant');
  cantInput.value = pendiente;
  cantInput.max = pendiente;
  document.getElementById('dev_obs').value = '';

  checkDevolucionParcialWarn();
  document.getElementById('mDevolver').classList.add('open');
}
function closeDevolver(){ document.getElementById('mDevolver').classList.remove('open'); }

function checkDevolucionParcialWarn(){
  const warn = document.getElementById('dev_parcial_warn');
  const input = document.getElementById('dev_cant');
  if(!warn || !input) return;
  const cant = parseInt(input.value)||0;
  const max = parseInt(input.max)||0;
  const restante = max - cant;
  if(cant > 0 && restante > 0){
    warn.style.display = 'block';
    warn.textContent = `⚠ Quedarán ${restante} unidad${restante!==1?'es':''} sin devolver`;
  } else {
    warn.style.display = 'none';
  }
}

async function confirmDevolver(){
  const cant = parseInt(document.getElementById('dev_cant').value)||0;
  if(cant<=0){ toast('Cantidad inválida','err'); return; }

  const btn = document.getElementById('btnDevolverSave');
  btn.disabled = true; btn.textContent = '⏳ Devolviendo...';
  try {
    const res = await apiPost({action:'devolver', presId:devolverPresId, cantidadDevuelta:cant});
    if(!res.ok) throw new Error(res.error);
    const idx = prestamos.findIndex(x=>Number(x.id)===Number(devolverPresId));
    if(idx>=0) prestamos[idx] = res.prestamo;
    if(res.nuevoQty !== null && res.nuevoQty !== undefined){
      const itemIdx = items.findIndex(x=>Number(x.id)===Number(res.prestamo.itemId));
      if(itemIdx>=0) items[itemIdx].qty = res.nuevoQty;
    }
    closeDevolver();
    toast('Devolución registrada','ok');
    goPrestamos();
  } catch(err){ toast('Error: '+err.message,'err'); btn.disabled=false; btn.textContent='📥 Confirmar devolución'; }
}

// ─── PROFESORES (modal de gestión) ───────────────────────
let profEditing = [];

function openProfModal(){
  if(!requirePerm('profesores.manage')) return;
  profEditing = JSON.parse(JSON.stringify(
    profesores.filter(p =>
      String(p.nombre||'').trim() &&
      String(p.nombre||'').trim().toLowerCase() !== 'departamento' &&
      p.source !== 'usuarios'
    )
  ));
  renderProfList();
  document.getElementById('mProf').classList.add('open');
}
function closeProfModal(){ document.getElementById('mProf').classList.remove('open'); }

function renderProfList(){
  if(!profEditing.length){
    document.getElementById('profList').innerHTML='<div class="empty" style="padding:20px"><div class="et" style="font-size:13px">Aún no hay prestatarios externos. Pulsa "+ Añadir prestatario externo" para empezar.</div></div>';
    return;
  }
  document.getElementById('profList').innerHTML = profEditing.map((p,i)=>`
    <div class="prof-row">
      <input class="fi-w name-input" value="${escHtml(p.nombre||'')}" onchange="profEditing[${i}].nombre=this.value" placeholder="Nombre completo">
      <input class="fi-w dept-input" value="${escHtml(p.departamento||'')}" onchange="profEditing[${i}].departamento=this.value" placeholder="Departamento (opcional)">
      <button class="del-btn" onclick="removeProfRow(${i})" title="Eliminar">🗑</button>
    </div>
  `).join('');
}

function addProfRow(){
  profEditing.push({id:0, nombre:'', departamento:'', email:''}); // id 0 = nuevo
  renderProfList();
}

function importProfesoresCSV(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    const lines = e.target.result.trim().split('\n').filter(l => l.trim());
    if(!lines.length){ toast('CSV vacío','err'); return; }

    // Detectar cabecera
    const primera = lines[0].toLowerCase().replace(/\s/g,'');
    const tieneCabecera = primera.includes('nombre') || primera.includes('departamento') || primera.includes('email');
    const filas = tieneCabecera ? lines.slice(1) : lines;

    let importados = 0, omitidos = 0;
    filas.forEach(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g,''));
      const nombre = cols[0];
      if(!nombre) return;
      const departamento = cols[1] || '';
      const email = cols[2] || '';
      // Evitar duplicados por nombre (case-insensitive)
      if(profEditing.some(p => (p.nombre||'').toLowerCase() === nombre.toLowerCase())){ omitidos++; return; }
      profEditing.push({ id: 0, nombre, departamento, email });
      importados++;
    });

    renderProfList();
    input.value = '';
    const msg = `${importados} profesor/a(s) importado/a(s)${omitidos ? `, ${omitidos} omitido(s) por duplicado` : ''}. Revisa y pulsa Guardar.`;
    toast(msg, importados > 0 ? 'ok' : 'warn');
  };
  reader.readAsText(file, 'utf-8');
}

function exportProfesoresCSV(){
  const h = 'Nombre,Departamento,Email,Origen';
  const rows = profEditing.map(p => [p.nombre, p.departamento, p.email, p.source==='usuarios'?'Usuario app':'Externo'].map(csvCell).join(','));
  downloadText('profesores.csv', 'text/csv;charset=utf-8', '﻿' + [h, ...rows].join('\n'));
  toast('CSV exportado', 'ok');
}

function removeProfRow(idx){
  const p = profEditing[idx];
  const usados = prestamos.filter(pr=>String(pr.profesorId)===String(p.id) && (pr.estado==='Activo'||pr.estado==='Parcial')).length;
  if(usados > 0){
    toast(`No puedes eliminar: tiene ${usados} préstamo(s) activo(s)`,'err');
    return;
  }
  profEditing.splice(idx,1);
  renderProfList();
}

async function saveProfesores(){
  // Validación
  const validos = profEditing.filter(p=>p.nombre && p.nombre.trim());
  if(validos.length !== profEditing.length){
    if(!await confirmDialog({message:'Hay profesores sin nombre que se descartarán. ¿Continuar?'})) return;
  }

  // Calcular cambios respecto a profesores actuales (profEditing ya es
  // solo externos, ver openProfModal — todo aquí es editable)
  const toAdd = validos.filter(p=>!p.id);
  const toUpdate = validos.filter(p=>{
    if(!p.id) return false;
    const orig = profesores.find(x=>Number(x.id)===Number(p.id));
    if(!orig) return false;
    return orig.nombre!==p.nombre || orig.departamento!==p.departamento || orig.email!==p.email;
  });
  const idsValidos = new Set(validos.filter(p=>p.id).map(p=>String(p.id)));
  const toDelete = profesores.filter(p=>p.source !== 'usuarios' && !idsValidos.has(String(p.id)));

  if(!toAdd.length && !toUpdate.length && !toDelete.length){
    closeProfModal(); return;
  }

  try {
    for(const p of toAdd){
      const res = await apiPost({action:'profAdd', profesor:p});
      if(!res.ok) throw new Error(res.error);
      profesores.push(res.profesor);
    }
    for(const p of toUpdate){
      const res = await apiPost({action:'profUpdate', profesor:p});
      if(!res.ok) throw new Error(res.error);
      const i = profesores.findIndex(x=>Number(x.id)===Number(p.id));
      if(i>=0) profesores[i] = p;
    }
    for(const p of toDelete){
      const res = await apiPost({action:'profDelete', id:p.id});
      if(!res.ok) throw new Error(res.error);
      profesores = profesores.filter(x=>Number(x.id)!==Number(p.id));
    }
    closeProfModal();
    toast('Prestatarios externos actualizados','ok');
    if(document.getElementById('pPres').classList.contains('active')) goPrestamos();
  } catch(err){
    toast('Error: '+err.message,'err');
  }
}

// ─── PICKER PRESTAR / DEVOLVER ────────────────────────────
let _pickerItemId = null;

function openPresDevModal(itemId){
  const item = items.find(x=>Number(x.id)===Number(itemId));
  if(!item) return;
  _pickerItemId = itemId;

  document.getElementById('pickerItemName').textContent = item.item;

  const btnPrestar = document.getElementById('pickerBtnPrestar');
  const noStock = Number(item.qty) <= 0;
  btnPrestar.disabled = noStock;
  btnPrestar.style.opacity = noStock ? '0.4' : '1';

  const activeLoans = prestamos.filter(p=>
    Number(p.itemId)===Number(itemId) &&
    (p.estado==='Activo'||p.estado==='Parcial')
  );

  const loansEl = document.getElementById('pickerLoans');
  if(activeLoans.length){
    loansEl.innerHTML =
      `<div style="font-size:12px;color:var(--muted);margin-bottom:8px;font-weight:600">Préstamos activos:</div>` +
      activeLoans.map(p=>{
        const pendiente = Number(p.cantidad) - Number(p.cantidadDevuelta||0);
        const venc = isVencido(p);
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg);border-radius:8px;gap:8px;margin-bottom:6px;border:1px solid var(--border)">
          <div style="font-size:13px">
            <strong>${escHtml(p.profesorNombre)}</strong>
            <div style="font-size:11px;color:${venc?'var(--red)':'var(--muted)'};margin-top:2px">${pendiente} ud${pendiente!==1?'s':''} · devolver: ${escHtml(p.fechaPrevista||'—')}${venc?' ⚠ Vencido':''}</div>
          </div>
          <button class="btn btn-sm btn-return" onclick="closePresDevModal();openDevolver(${p.id})">📥 Devolver</button>
        </div>`;
      }).join('');
  } else {
    loansEl.innerHTML = `<div style="font-size:13px;color:var(--muted);text-align:center;padding:8px 0">Sin préstamos activos</div>`;
  }

  document.getElementById('mPresDevPicker').classList.add('open');
}

function closePresDevModal(){
  document.getElementById('mPresDevPicker').classList.remove('open');
}

// ─── GESTIÓN DE USUARIOS ──────────────────────────────────
let _usuariosEditing = [];
let _usuariosOriginal = [];
let _todosModulos = []; // módulos de la hoja Modulos con responsable actual
const ROLES_DISPONIBLES = [
  'Jefe/a Departamento',
  'Profesor/a',
  'Consulta'
];

function _rolBadgeClass(rol){
  const r = (rol||'').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if(r.includes('jefe')||r.includes('jefa')||r==='administrador'||r==='administradora'||r==='admin') return 'jefe';
  if(r.includes('profesor')) return 'prof';
  return 'lect';
}

function saveInactivitySetting(){
  const v = parseInt(document.getElementById('inactivityMinInput').value);
  if(isNaN(v) || v < 1){ toast('Introduce un valor válido (mínimo 1 minuto)','err'); return; }
  if(typeof setInactivityMinutes === 'function') setInactivityMinutes(v);
  if(typeof _resetInactivityTimer === 'function') _resetInactivityTimer();
  toast(`Cierre automático: ${v} minuto${v!==1?'s':''}`, 'ok');
}

async function openUsuariosModal(){
  if(!requirePerm('users.manage')) return;
  document.getElementById('usuariosList').innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center">Cargando...</p>';
  const inactEl = document.getElementById('inactivityMinInput');
  if(inactEl) inactEl.value = (typeof getInactivityMinutes === 'function') ? getInactivityMinutes() : 5;
  document.getElementById('mUsuarios').classList.add('open');
  try {
    const res = await apiPost({ action: 'getUsers' });
    if(!res.ok) throw new Error(res.error);
    _todosModulos = res.todosModulos || [];
    _usuariosEditing = res.usuarios.map(u=>({...u, _nuevo:false, _resetPass:'', _modulos: u.modulos || []}));
    _usuariosOriginal = res.usuarios.map(u=>u.usuario);
    _renderUsuariosList();
  } catch(e) {
    document.getElementById('usuariosList').innerHTML = `<p style="color:var(--red);font-size:13px">${e.message}</p>`;
  }
}

function closeUsuariosModal(){
  document.getElementById('mUsuarios').classList.remove('open');
}

function _renderUsuariosList(){
  const el = document.getElementById('usuariosList');
  if(!_usuariosEditing.length){
    el.innerHTML='<div class="empty" style="padding:20px"><div class="et" style="font-size:13px">Sin usuarios registrados.</div></div>';
    return;
  }
  const puedeAsignarDept = String(SESSION?.rol||'').trim().toLowerCase() === 'superadmin' && typeof DEPARTAMENTOS !== 'undefined' && DEPARTAMENTOS.length;
  el.innerHTML = _usuariosEditing.map((u,i)=>{
    const esSelf = u.usuario === SESSION?.usuario;
    const selfClass = esSelf ? ' usr-self' : '';
    const nMods = (u._modulos||[]).length;
    const modBadge = nMods > 0 ? `<span class="usr-mod-badge">${nMods}</span>` : '';
    const rolDisplay = (u.rol || '').toLowerCase().trim() === 'superadmin' ? 'Jefe/a Departamento' : u.rol;
    return `<div class="usr-row">
      <input class="fi-w usr-nombre${selfClass}" value="${escHtml(u.nombre||'')}" placeholder="Nombre completo *"
        onchange="_usuariosEditing[${i}].nombre=this.value" ${esSelf?'title="Es tu propia cuenta"':''}>
      <input class="fi-w usr-login${selfClass}" value="${escHtml(u.usuario||'')}" placeholder="Usuario *"
        onchange="_usuariosEditing[${i}].usuario=this.value" ${u._nuevo?'':'readonly title="El usuario no se puede cambiar"'}>
      <input class="fi-w usr-email${selfClass}" value="${escHtml(u.email||'')}" placeholder="Email"
        onchange="_usuariosEditing[${i}].email=this.value">
      <select class="fi-w usr-rol${esSelf?' usr-self':''}" onchange="_usuariosEditing[${i}].rol=this.value" ${esSelf?'disabled title="No puedes cambiar tu propio rol"':''}>
        ${ROLES_DISPONIBLES.map(r=>`<option value="${r}" ${rolDisplay===r?'selected':''}>${r}</option>`).join('')}
      </select>
      ${puedeAsignarDept ? `<select class="fi-w usr-dept" onchange="_usuariosEditing[${i}].departamento=this.value" title="Departamento">
        <option value="">— Sin departamento —</option>
        ${DEPARTAMENTOS.map(d=>`<option value="${escHtml(d.slug)}" ${u.departamento===d.slug?'selected':''}>${escHtml(d.icono||'')} ${escHtml(d.nombre)}</option>`).join('')}
      </select>` : ''}
      ${u._nuevo
        ? `<input class="fi-w usr-pass" placeholder="Contraseña inicial *" onchange="_usuariosEditing[${i}]._resetPass=this.value">`
        : `<button class="btn btn-sm" onclick="_promptResetPass(${i})" title="Resetear contraseña">🔑 Reset</button>`
      }
      <button class="btn btn-sm usr-mods-btn" onclick="openModulosUsuario(${i})" title="Asignar módulos que imparte">📚 Módulos${nMods>0?` (${nMods})`:''}</button>
      <button class="del-btn${selfClass}" onclick="_removeUsuarioRow(${i})" title="${esSelf?'No puedes eliminarte':'Eliminar usuario'}">🗑</button>
    </div>`;
  }).join('');
}

function addUsuarioRow(){
  _usuariosEditing.push({ usuario:'', nombre:'', email:'', rol:'Profesor/a', _nuevo:true, _resetPass:'', _modulos:[] });
  _renderUsuariosList();
}

async function _removeUsuarioRow(i){
  const u = _usuariosEditing[i];
  if(u.usuario === SESSION?.usuario){ toast('No puedes eliminar tu propia cuenta','err'); return; }
  if(!u._nuevo && !await confirmDialog({message:`¿Eliminar el usuario "${u.nombre||u.usuario}"? Esta acción no se puede deshacer.`, danger:true, confirmText:'Eliminar'})) return;
  _usuariosEditing.splice(i,1);
  _renderUsuariosList();
}

async function _promptResetPass(i){
  const u = _usuariosEditing[i];
  const nueva = prompt(`Nueva contraseña para "${u.nombre||u.usuario}":\n(mínimo 6 caracteres)`);
  if(!nueva) return;
  if(nueva.trim().length < 6){ toast('La contraseña debe tener al menos 6 caracteres','err'); return; }
  try {
    const newPassword = nueva.trim();
    const res = await apiPost({ action:'userResetPassword', usuario:u.usuario, newPassword, password:newPassword });
    if(!res.ok) throw new Error(res.error);
    toast(`Contraseña actualizada para ${u.nombre||u.usuario}`,'ok');
  } catch(e){ toast('Error: '+e.message,'err'); }
}

// ─── MÓDULOS POR USUARIO ──────────────────────────────────
let _modUsuarioIdx = null;
let _modUsuarioCiclos = []; // [{cid,name,nivel,mods:[{mid,cod,name,checked,respActual}]}]
let _modUsuarioExpanded = new Set(); // cid de ciclos expandidos manualmente

function _renderModUsuarioGroups(query){
  const u = _usuariosEditing[_modUsuarioIdx];
  const q = normalizeStr(query || '');
  const body = document.getElementById('mModUsuarioBody');

  const html = _modUsuarioCiclos.map(c => {
    const modsFiltrados = q ? c.mods.filter(m => normalizeStr(m.name).includes(q)) : c.mods;
    if(!modsFiltrados.length) return '';
    const nMarcados = c.mods.filter(m => m.checked).length;
    // Expandido si: hay búsqueda activa, se expandió a mano, o ya tiene módulos marcados (para no esconder lo ya asignado)
    const expanded = !!q || _modUsuarioExpanded.has(c.cid) || nMarcados > 0;
    const rows = modsFiltrados.map(m => {
      const otroResp = m.respActual && m.respActual.toLowerCase() !== (u.nombre||'').toLowerCase()
        ? `<span class="mod-otro-resp">(${escHtml(m.respActual)})</span>` : '';
      return `<label class="mod-check-row">
        <input type="checkbox" value="${m.mid}" ${m.checked?'checked':''} onchange="_toggleModUsuario('${m.mid}',this.checked)">
        <span class="mod-check-name">${escHtml(m.name)}</span>
        ${otroResp}
      </label>`;
    }).join('');
    return `<div class="mod-ciclo-group">
      <div class="mod-ciclo-title" style="cursor:pointer;display:flex;align-items:center;gap:6px" onclick="_toggleModCicloExpand('${c.cid}')">
        <span style="font-size:11px;color:var(--muted)">${expanded?'▼':'▶'}</span>
        <span>${escHtml(c.name)}${c.nivel?' · '+escHtml(c.nivel):''}</span>
        ${nMarcados?`<span class="usr-mod-badge" style="margin-left:auto">${nMarcados}</span>`:''}
      </div>
      ${expanded ? rows : ''}
    </div>`;
  }).join('');

  body.innerHTML = html || '<p style="color:var(--muted);font-size:13px">Sin resultados.</p>';
}

function _toggleModCicloExpand(cid){
  if(_modUsuarioExpanded.has(cid)) _modUsuarioExpanded.delete(cid);
  else _modUsuarioExpanded.add(cid);
  _renderModUsuarioGroups(document.getElementById('modUsuarioSearch').value);
}

function filterModUsuario(){
  _renderModUsuarioGroups(document.getElementById('modUsuarioSearch').value);
}

function openModulosUsuario(i){
  _modUsuarioIdx = i;
  const u = _usuariosEditing[i];
  const seleccionados = new Set(u._modulos || []);

  // Agrupar módulos por ciclo usando CICLOS de config.js
  const cicloMap = {};
  const cicloOrder = [];
  CICLOS.forEach(c => {
    if(c.id === 'departamento') return;
    cicloMap[c.id] = { name: c.name, nivel: c.nivel || '', mods: [] };
    cicloOrder.push(c.id);
    c.modulos.forEach(m => cicloMap[c.id].mods.push({ id: `${c.id}__${m.cod}`, cod: String(m.cod), name: m.name }));
  });

  // Módulos presentes en la hoja pero sin ciclo conocido → grupo "Otros"
  const idsConocidos = new Set(CICLOS.flatMap(c=>(c.id==='departamento'?[]:c.modulos.map(m=>`${c.id}__${m.cod}`))));
  const sinCiclo = _todosModulos.filter(m=>!idsConocidos.has(String(m.id || m.cod)));
  if(sinCiclo.length){
    cicloMap['__otros__'] = { name:'Otros módulos', nivel:'', mods: sinCiclo.map(m=>({id:m.id || String(m.cod), cod:m.cod, name:m.nombre || m.cod})) };
    cicloOrder.push('__otros__');
  }

  // Mapa de responsables actuales desde backend (disponible solo tras redespliegue GAS)
  const respMap = {};
  _todosModulos.forEach(m=>{ respMap[String(m.id || m.cod)] = m.responsable || ''; });

  _modUsuarioCiclos = cicloOrder.map(cid => {
    const c = cicloMap[cid];
    const mods = c.mods.map(m => {
      const mid = String(m.id || m.cod);
      const respActual = respMap[mid] || '';
      return { ...m, mid, checked: seleccionados.has(mid) || seleccionados.has(String(m.cod)), respActual };
    });
    return { cid, name: c.name, nivel: c.nivel, mods };
  }).filter(c => c.mods.length);

  document.getElementById('mModUsuarioTitle').textContent = `📚 Módulos de ${u.nombre||u.usuario}`;
  document.getElementById('modUsuarioSearch').value = '';
  _renderModUsuarioGroups('');
  document.getElementById('mModUsuario').classList.add('open');
}

function _toggleModUsuario(cod, checked){
  if(_modUsuarioIdx === null) return;
  const u = _usuariosEditing[_modUsuarioIdx];
  if(!u._modulos) u._modulos = [];
  if(checked){
    if(!u._modulos.includes(cod)) u._modulos.push(cod);
  } else {
    u._modulos = u._modulos.filter(c=>c!==cod);
  }
  // Mantener sincronizado el estado local para que el badge y el
  // colapsado reflejen el cambio sin tener que reabrir el modal.
  let cidTocado = null;
  for(const c of _modUsuarioCiclos){
    const m = c.mods.find(mm => mm.mid === cod);
    if(m){ m.checked = checked; cidTocado = c.cid; break; }
  }
  // Un grupo con algo marcado debe quedar expandido aunque no se haya
  // abierto a mano — re-render ligero solo para actualizar el badge.
  if(cidTocado) _modUsuarioExpanded.add(cidTocado);
  _renderModUsuarioGroups(document.getElementById('modUsuarioSearch')?.value || '');
}

function closeModulosUsuario(){
  document.getElementById('mModUsuario').classList.remove('open');
  // Actualizar badge en lista
  _renderUsuariosList();
}

async function saveModulosUsuario(){
  if(_modUsuarioIdx === null) return;
  const u = _usuariosEditing[_modUsuarioIdx];
  if(!u.nombre.trim()){ toast('Guarda primero el nombre del usuario antes de asignar módulos','err'); return; }
  const btn = document.getElementById('btnSaveModUsuario');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    const res = await apiPost({ action:'userAssignModulos', nombre: u.nombre.trim(), modulos: u._modulos || [] });
    if(!res.ok) throw new Error(res.error);
    toast(`Módulos actualizados para ${u.nombre}`,'ok');
    // Sincronizar responsable en _todosModulos local
    _todosModulos.forEach(m=>{
      const mid = String(m.id || m.cod);
      const esMio = (u._modulos||[]).includes(mid);
      const eraMio = (m.responsable||'').toLowerCase() === u.nombre.toLowerCase();
      if(esMio) m.responsable = u.nombre;
      else if(eraMio) m.responsable = '';
    });
    closeModulosUsuario();
  } catch(e){ toast('Error: '+e.message,'err'); }
  finally { btn.disabled=false; btn.textContent='💾 Guardar módulos'; }
}

function importUsuariosCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const lines = e.target.result.trim().split('\n').filter(l => l.trim());
    if (!lines.length) { toast('CSV vacío', 'err'); return; }

    // Detectar cabecera
    const primera = lines[0].toLowerCase().replace(/\s/g,'');
    const tieneCabecera = primera.includes('usuario') || primera.includes('nombre') || primera.includes('email');
    const filas = tieneCabecera ? lines.slice(1) : lines;

    let importados = 0, omitidos = 0;
    filas.forEach(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const usuario = cols[0];
      const nombre  = cols[1] || cols[0];
      const email   = cols[2] || '';
      const rol     = cols[3] || 'Profesor/a';
      const password = cols[4] || '';
      const departamento = cols[5] || '';

      if (!usuario) return;
      // Evitar duplicados
      if (_usuariosEditing.some(u => u.usuario.toLowerCase() === usuario.toLowerCase())) { omitidos++; return; }
      // El rol debe ser uno de los disponibles, si no forzar Profesor/a
      const rolFinal = ROLES_DISPONIBLES.includes(rol) ? rol : 'Profesor/a';
      const entry = { usuario, nombre, email, rol: rolFinal, _nuevo: true, _resetPass: password, _modulos: [] };
      // Columna departamento (slug) solo tiene efecto si la usa superadmin —
      // un jefe/a de departamento normal siempre crea en su propio departamento.
      if (String(SESSION?.rol||'').trim().toLowerCase() === 'superadmin' && departamento) entry.departamento = departamento;
      _usuariosEditing.push(entry);
      importados++;
    });

    _renderUsuariosList();
    input.value = '';
    const msg = `${importados} usuario(s) importado(s)${omitidos ? `, ${omitidos} omitido(s) por duplicado` : ''}. Revisa y pulsa Guardar.`;
    toast(msg, importados > 0 ? 'ok' : 'warn');
  };
  reader.readAsText(file, 'utf-8');
}

function exportUsuariosCSV(){
  const h = 'Usuario,Nombre,Email,Rol,Departamento,Módulos asignados';
  const rows = _usuariosEditing.map(u => [
    u.usuario, u.nombre, u.email,
    (u.rol||'').toLowerCase().trim()==='superadmin' ? 'Jefe/a Departamento' : u.rol,
    u.departamento || '',
    (u._modulos||[]).length
  ].map(csvCell).join(','));
  downloadText('usuarios.csv', 'text/csv;charset=utf-8', '﻿' + [h, ...rows].join('\n'));
  toast('CSV exportado', 'ok');
}

// Genera una plantilla real a partir de los usuarios y asignaturas ya
// cargados en el modal — una fila de ejemplo por usuario (o dos si
// tiene módulos propios asignados), para que quede claro el formato
// exacto sin tener que inventarse datos.
function downloadModulosCSVPlantilla(){
  if(!_usuariosEditing.length){ toast('Abre primero la lista de usuarios', 'err'); return; }
  const asignaturasDisponibles = (CICLOS || []).flatMap(c => c.id==='departamento' ? [] : c.modulos.map(m => m.name));

  const rows = [];
  _usuariosEditing.filter(u => u.usuario).slice(0, 3).forEach((u, i) => {
    const ejemplo1 = asignaturasDisponibles[i % Math.max(asignaturasDisponibles.length,1)] || 'Nombre de la asignatura';
    const ejemplo2 = asignaturasDisponibles[(i+1) % Math.max(asignaturasDisponibles.length,1)] || 'Otra asignatura';
    rows.push(`${u.usuario},${ejemplo1}`);
    if(ejemplo2 !== ejemplo1) rows.push(`${u.usuario},${ejemplo2}`);
  });
  if(!rows.length) rows.push('usuario_ejemplo,Nombre de la asignatura');

  const csv = '﻿usuario,asignatura\n' + rows.join('\n');
  downloadText('plantilla-modulos.csv', 'text/csv;charset=utf-8', csv);
  toast('Plantilla descargada', 'ok');
}

function importModulosCSV(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async function(e){
    const lines = e.target.result.trim().split('\n').filter(l => l.trim());
    if(!lines.length){ toast('CSV vacío', 'err'); return; }

    const primera = lines[0].toLowerCase().replace(/\s/g,'');
    const tieneCabecera = primera.includes('usuario') || primera.includes('asignatura') || primera.includes('modulo');
    const filas = tieneCabecera ? lines.slice(1) : lines;

    const rows = filas.map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g,''));
      return { usuario: cols[0] || '', asignatura: cols[1] || '' };
    }).filter(r => r.usuario && r.asignatura);

    if(!rows.length){ toast('No hay filas válidas en el CSV (usuario,asignatura)', 'err'); return; }

    input.value = '';
    try {
      const res = await apiPost({ action:'importModulosCSV', rows });
      if(!res.ok) throw new Error(res.error);
      const fallidas = res.resultados.filter(r => !r.ok);
      if(fallidas.length){
        console.warn('Filas sin coincidencia en importModulosCSV:', fallidas);
        toast(`${res.okCount}/${res.total} asignados. ${fallidas.length} sin coincidencia clara — revisa la consola (F12) para el detalle.`, 'warn');
      } else {
        toast(`${res.okCount}/${res.total} módulos asignados correctamente`, 'ok');
      }
      // Refrescar la lista de usuarios para ver los nuevos módulos asignados
      const usersRes = await apiPost({ action: 'getUsers' });
      if(usersRes.ok){
        _todosModulos = usersRes.todosModulos || [];
        const existentesPorUsuario = new Map(_usuariosEditing.map(u => [u.usuario, u]));
        _usuariosEditing = usersRes.usuarios.map(u => {
          const prev = existentesPorUsuario.get(u.usuario);
          return { ...u, _nuevo:false, _resetPass: prev?._resetPass || '', _modulos: u.modulos || [] };
        });
        _renderUsuariosList();
      }
    } catch(err){
      toast('Error al importar: '+err.message, 'err');
    }
  };
  reader.readAsText(file, 'utf-8');
}

async function saveUsuarios(){
  // Validar antes de enviar
  for(const u of _usuariosEditing){
    if(!u.nombre.trim() || !u.usuario.trim()){ toast('Nombre y usuario son obligatorios en todos los usuarios','err'); return; }
    if(u._nuevo && !u._resetPass.trim()){ toast(`Indica una contraseña para "${u.nombre||u.usuario}"`, 'err'); return; }
  }

  const btn = document.querySelector('#mUsuarios .btn-p');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    // Añadir nuevos
    for(const u of _usuariosEditing.filter(u=>u._nuevo)){
      const res = await apiPost({ action:'userAdd', usuario:{ usuario:u.usuario.trim(), nombre:u.nombre.trim(), email:u.email||'', rol:u.rol, password:u._resetPass.trim(), departamento:u.departamento } });
      if(!res.ok) throw new Error(res.error);
    }
    // Actualizar existentes
    for(const u of _usuariosEditing.filter(u=>!u._nuevo)){
      const res = await apiPost({ action:'userUpdate', usuario:{ usuario:u.usuario, nombre:u.nombre.trim(), email:u.email||'', rol:u.rol, departamento:u.departamento } });
      if(!res.ok) throw new Error(res.error);
    }
    // Eliminar los que se quitaron de la lista
    const editingLogins = new Set(_usuariosEditing.filter(u=>!u._nuevo).map(u=>u.usuario));
    for(const login of _usuariosOriginal){
      if(!editingLogins.has(login)){
        const res = await apiPost({ action:'userDelete', usuario:login });
        if(!res.ok) throw new Error(res.error);
      }
    }
    toast('Usuarios guardados correctamente','ok');
    closeUsuariosModal();
  } catch(e){ toast('Error: '+e.message,'err'); }
  finally { btn.disabled=false; btn.textContent='💾 Guardar cambios'; }
}
