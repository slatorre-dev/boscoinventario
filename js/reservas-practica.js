// ═════════════════════════════════════════════════════════
// PLANIFICACIÓN DE PRÁCTICAS (RESERVAS DE MATERIAL)
// ═════════════════════════════════════════════════════════
let _reservaProfOptions = [];
let _reservaLineas = [];
let _reservaLineaRowId = 0;
let _reservaItemsDisponibles = [];
let _reservaConfirmSubmitting = false;

function openReservaPractica(){
  if(!requirePerm('loans.write')) return;
  _reservaLineas = [];
  _reservaLineaRowId = 0;

  const cicloSel = document.getElementById('res_ciclo');
  const ownCiclos = (typeof CICLOS !== 'undefined' ? CICLOS : []).filter(c => c.id !== 'iesjuanbosco');
  const opciones = ['<option value="">Sin asignar</option>'];
  ownCiclos.forEach(c => {
    (c.modulos || []).forEach(m => {
      opciones.push(`<option value="${escHtml(c.id)}__${escHtml(m.cod)}">${escHtml(c.name)} — ${escHtml(m.name)}</option>`);
    });
  });
  cicloSel.innerHTML = opciones.join('');
  cicloSel.value = (ownCiclos.length === 1 && (ownCiclos[0].modulos || []).length === 1)
    ? `${ownCiclos[0].id}__${ownCiclos[0].modulos[0].cod}` : '';

  const resFechaInput = document.getElementById('res_fecha');
  resFechaInput.value = '';
  resFechaInput.min = new Date().toISOString().slice(0,10);
  document.getElementById('res_franja').value = '';
  document.getElementById('res_franja_otra').value = '';
  document.getElementById('res_franja_otra').style.display = 'none';
  document.getElementById('res_obs').value = '';

  document.getElementById('res_profFiltQ').value = '';
  _reservaProfOptions = loanTeacherOptions();
  const profPropio = _reservaProfOptions.find(p => p.nombre.toLowerCase().trim() === (SESSION?.nombre||'').toLowerCase().trim());
  _renderProfSelectOptions('res_prof', _reservaProfOptions, profPropio ? profPropio.id : undefined);

  document.getElementById('res_aula').innerHTML = '<option value="">— Sin especificar —</option>' + renderAulaOptions();

  document.getElementById('res_itemFiltAula').innerHTML = '<option value="">Todas las aulas</option>' + renderAulaOptions();
  document.getElementById('res_itemFiltQ').value = '';
  filterReservaItems();

  _renderReservaLineas();
  _renderPlantillasList();
  toggleGuardarPlantillaInput(false);
  document.getElementById('mReservaPractica').classList.add('open');
}

function closeReservaPractica(){
  document.getElementById('mReservaPractica').classList.remove('open');
}

function filterReservaItems(){
  const aulaVal = document.getElementById('res_itemFiltAula').value;
  const q = normalize(document.getElementById('res_itemFiltQ').value);
  let filtered = items.filter(x => Number(x.qty) > 0);
  if(aulaVal) filtered = filtered.filter(x => String(x.aula) === String(aulaVal));
  if(q) filtered = filtered.filter(x => normalize(x.item + ' ' + (x.ref||'')).includes(q));
  filtered.sort((a,b) => a.item.localeCompare(b.item));
  _reservaItemsDisponibles = filtered;
  _renderReservaItemResults();
}

// Lista de resultados con clic directo (mismo patrón que delPickerList en
// inventory.js) en vez de <select>+botón "Añadir" — más rápido de usar con
// un inventario de taller de cientos de referencias.
function _renderReservaItemResults(){
  const list = document.getElementById('res_itemResults');
  if(!list) return;
  if(!_reservaItemsDisponibles.length){
    list.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:10px">Sin resultados</div>';
    return;
  }
  const yaAnadidos = new Set(_reservaLineas.map(l => String(l.itemId)));
  list.innerHTML = _reservaItemsDisponibles.slice(0,30).map(x => {
    const aulaNombre = AULAS.find(a=>a.id===x.aula)?.name || x.aula || '—';
    const anadido = yaAnadidos.has(String(x.id));
    return `<button type="button" class="btn" ${anadido?'disabled':''} style="width:100%;justify-content:space-between;text-align:left;padding:8px 10px;font-size:13px" onclick="anadirLineaReserva(${x.id})">
      <span>${anadido?'✓ ':''}${escHtml(x.item)}${x.ref?' <small style="color:var(--muted)">['+escHtml(x.ref)+']</small>':''}</span>
      <span style="font-size:11px;color:var(--muted);white-space:nowrap;margin-left:8px">${escHtml(aulaNombre)} · ${x.qty} uds.</span>
    </button>`;
  }).join('');
}

function anadirLineaReserva(itemId){
  const item = _reservaItemsDisponibles.find(x => String(x.id) === String(itemId));
  if(!item) return;
  if(_reservaLineas.some(l => String(l.itemId) === String(itemId))){
    toast('Ese ítem ya está en la lista','err');
    return;
  }
  _reservaLineas.push({ _rowId: _reservaLineaRowId++, itemId: item.id, itemNombre: item.item, cantidad: 1, maxQty: Number(item.qty) });
  _renderReservaLineas();
  _renderReservaItemResults();
}

function _renderReservaLineas(){
  const body = document.getElementById('resLineasBody');
  const wrap = document.getElementById('resLineasWrap');
  const btnGuardar = document.getElementById('btnReservaGuardar');
  if(!_reservaLineas.length){
    wrap.style.display = 'none';
    btnGuardar.disabled = true;
    return;
  }
  wrap.style.display = 'block';
  btnGuardar.disabled = false;
  body.innerHTML = _reservaLineas.map(l => `
    <tr data-row-id="${l._rowId}">
      <td style="padding:4px">${escHtml(l.itemNombre)}</td>
      <td style="padding:4px"><input type="number" class="fi-w" min="1" max="${l.maxQty}" value="${l.cantidad}" style="width:70px" oninput="_reservaActualizarCant(${l._rowId},this.value)"></td>
      <td style="padding:4px;text-align:center"><button class="btn-icon-only" onclick="_reservaEliminarLinea(${l._rowId})" title="Eliminar" style="cursor:pointer;border:none;background:none;font-size:16px">🗑️</button></td>
    </tr>`).join('');
}

function _reservaActualizarCant(rowId, valor){
  const l = _reservaLineas.find(x => x._rowId === rowId);
  if(!l) return;
  l.cantidad = Math.max(1, Math.min(parseInt(valor,10) || 1, l.maxQty));
}

function _reservaEliminarLinea(rowId){
  _reservaLineas = _reservaLineas.filter(l => l._rowId !== rowId);
  _renderReservaLineas();
  _renderReservaItemResults();
}

// ─── PLANTILLAS DE PRÁCTICA ───────────────────────────────
// Personales y locales al navegador (localStorage, sin backend) — namespaced
// por usuario para no mezclar plantillas entre docentes en un PC compartido
// del taller. Guardan solo ciclo/módulo, aula y material+cantidades: fecha,
// profesor/a y observaciones se rellenan de nuevo cada vez a propósito.
function _plantillasStorageKey(){
  return 'reservas_plantillas_' + (SESSION?.usuario || 'anon');
}

function getPlantillas(){
  try { return JSON.parse(localStorage.getItem(_plantillasStorageKey()) || '[]'); }
  catch(e){ return []; }
}

function savePlantillas(list){
  try { localStorage.setItem(_plantillasStorageKey(), JSON.stringify(list)); }
  catch(e){ /* localStorage lleno o no disponible — silencioso */ }
}

function _renderPlantillasList(){
  const wrap = document.getElementById('resPlantillasWrap');
  const list = document.getElementById('resPlantillasList');
  if(!wrap || !list) return;
  const plantillas = getPlantillas();
  if(!plantillas.length){ wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  list.innerHTML = plantillas.map(p => `
    <div class="res-plant-chip">
      <button type="button" class="res-plant-use" onclick="aplicarPlantilla('${p.id}')" title="Aplicar esta plantilla">📋 ${escHtml(p.nombre)} <span class="res-plant-count">(${(p.lineas||[]).length})</span></button>
      <button type="button" class="res-plant-del" onclick="eliminarPlantilla('${p.id}')" title="Eliminar plantilla">🗑</button>
    </div>`).join('');
}

// Fila de guardado inline en el propio panel, en vez de prompt() nativo del
// navegador (rompía el estilo del resto de la app y no validaba en el sitio).
function toggleGuardarPlantillaInput(show){
  if(show && !_reservaLineas.length){ toast('Añade al menos un ítem antes de guardar la plantilla','err'); return; }
  document.getElementById('resPlantillaGuardarBtnWrap').style.display = show ? 'none' : '';
  document.getElementById('resPlantillaGuardarInputWrap').style.display = show ? 'flex' : 'none';
  const input = document.getElementById('resPlantillaNombreInput');
  input.classList.remove('field-error');
  input.parentElement.querySelector('.field-error-msg')?.remove();
  if(show){
    input.value = '';
    input.focus();
  }
}

function guardarPlantillaActual(){
  if(!_reservaLineas.length){ toast('Añade al menos un ítem antes de guardar la plantilla','err'); return; }
  const input = document.getElementById('resPlantillaNombreInput');
  const nombre = (input.value || '').trim();
  if(!nombre){ markFieldError('resPlantillaNombreInput', 'Escribe un nombre'); input.focus(); return; }

  const cicloVal = document.getElementById('res_ciclo').value;
  const [cicloId, moduloCod] = cicloVal ? cicloVal.split('__') : ['', ''];
  const cicloInfo = cicloId ? CICLOS.find(c => c.id === cicloId) : null;
  const moduloInfo = cicloInfo ? (cicloInfo.modulos||[]).find(m => String(m.cod) === moduloCod) : null;

  const plantilla = {
    id: 'pl_' + Date.now(),
    nombre,
    cicloId: cicloId || '',
    moduloCod: moduloCod || '',
    moduloNombre: moduloInfo ? moduloInfo.name : '',
    aulaDestino: document.getElementById('res_aula').value,
    lineas: _reservaLineas.map(l => ({ itemId: l.itemId, itemNombre: l.itemNombre, cantidad: l.cantidad })),
    creadoEn: new Date().toISOString(),
  };
  const lista = getPlantillas();
  lista.push(plantilla);
  savePlantillas(lista);
  _renderPlantillasList();
  toggleGuardarPlantillaInput(false);
  toast(`Plantilla "${escHtml(nombre)}" guardada`,'ok');
}

// Filtra igual que duplicarReservaPractica(): descarta ítems que ya no
// existen o se quedaron sin stock, avisando cuántos se excluyeron.
function aplicarPlantilla(id){
  const p = getPlantillas().find(x => x.id === id);
  if(!p) return;

  const cicloVal = p.cicloId ? `${p.cicloId}__${p.moduloCod}` : '';
  const cicloSel = document.getElementById('res_ciclo');
  if(cicloVal && [...cicloSel.options].some(o => o.value === cicloVal)) cicloSel.value = cicloVal;
  const aulaSel = document.getElementById('res_aula');
  if(p.aulaDestino && [...aulaSel.options].some(o => o.value === p.aulaDestino)) aulaSel.value = p.aulaDestino;

  const lineasOriginales = p.lineas || [];
  _reservaLineas = lineasOriginales.map(l => {
    const itemActual = items.find(x => Number(x.id) === Number(l.itemId));
    const maxQty = itemActual ? Number(itemActual.qty) : 0;
    return { _rowId: _reservaLineaRowId++, itemId: l.itemId, itemNombre: l.itemNombre, cantidad: Math.min(l.cantidad, maxQty), maxQty };
  }).filter(l => l.maxQty > 0);
  _renderReservaLineas();
  _renderReservaItemResults();

  const descartadas = lineasOriginales.length - _reservaLineas.length;
  toast(descartadas > 0
    ? `Plantilla aplicada — ${descartadas} ítem${descartadas!==1?'s':''} sin stock disponible no se incluy${descartadas!==1?'eron':'ó'}, revisa el material`
    : `Plantilla "${escHtml(p.nombre)}" aplicada`, descartadas > 0 ? 'warn' : 'ok');
}

async function eliminarPlantilla(id){
  const lista = getPlantillas();
  const p = lista.find(x => x.id === id);
  if(!p) return;
  if(!await confirmDialog({message:`¿Eliminar la plantilla "${p.nombre}"?`, danger:true, confirmText:'Eliminar'})) return;
  savePlantillas(lista.filter(x => x.id !== id));
  _renderPlantillasList();
}

// Desplegable con las franjas habituales del centro (con "Otra…" como
// escape hatch) en vez de texto libre — normaliza el valor para que el
// chequeo de choque de reservas (mismo día+franja) del backend compare
// exactamente lo mismo entre dos profesores, en vez de depender de que
// ambos tecleen la franja igual.
function onFranjaChange(){
  const esOtra = document.getElementById('res_franja').value === '__otra';
  document.getElementById('res_franja_otra').style.display = esOtra ? '' : 'none';
  if(esOtra) document.getElementById('res_franja_otra').focus();
}

function getFranjaValue(){
  const sel = document.getElementById('res_franja').value;
  return sel === '__otra' ? document.getElementById('res_franja_otra').value.trim() : sel;
}

async function guardarReservaPractica(){
  const fecha = document.getElementById('res_fecha').value;
  const franja = getFranjaValue();
  const profId = document.getElementById('res_prof').value;
  if(!fecha){ toast('Indica la fecha de la práctica','err'); return; }
  if(!profId){ toast('Selecciona un/a profesor/a','err'); return; }
  if(!_reservaLineas.length){ toast('Añade al menos un ítem','err'); return; }
  const prof = profesores.find(p => String(p.id) === String(profId));
  if(!prof) return;

  const cicloVal = document.getElementById('res_ciclo').value;
  const [cicloId, moduloCod] = cicloVal ? cicloVal.split('__') : ['', ''];
  const cicloInfo = cicloId ? CICLOS.find(c => c.id === cicloId) : null;
  const moduloInfo = cicloInfo ? (cicloInfo.modulos||[]).find(m => String(m.cod) === moduloCod) : null;

  const btn = document.getElementById('btnReservaGuardar');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    const res = await apiPost({
      action: 'reservaCrear',
      cicloId: cicloId || '',
      moduloCod: moduloCod || '',
      moduloNombre: moduloInfo ? moduloInfo.name : '',
      aulaDestino: document.getElementById('res_aula').value,
      profesorId: prof.id,
      profesorNombre: prof.nombre,
      fecha, franja,
      obs: document.getElementById('res_obs').value.trim(),
      lineas: _reservaLineas.map(l => ({ itemId: l.itemId, itemNombre: l.itemNombre, cantidad: l.cantidad })),
    });
    if(!res.ok) throw new Error(res.error);
    reservas.push({ ...res.reserva, lineas: res.lineas });
    closeReservaPractica();
    toast('Práctica planificada','ok');
    if(document.getElementById('pPres').classList.contains('active') && typeof renderReservasPendientes === 'function') renderReservasPendientes();
  } catch(err){ toast('Error: '+err.message,'err'); }
  finally { btn.disabled=false; btn.textContent='📅 Guardar reserva'; }
}

// ─── VISTA DE RESERVAS PENDIENTES ────────────────────────
// Pestaña propia dentro de Préstamos ("Reservas") — ver setPresTab()/
// goPrestamos() en prestamos.js, que llaman a renderReservasPendientes()
// directamente al entrar en esa pestaña.

function getReservasPendientes(){
  return (typeof reservas !== 'undefined' ? reservas : []).filter(r => r.estado === 'pendiente');
}

function _reservaCardHtml(r){
  const aulaNombre = AULAS.find(a=>a.id===r.aulaDestino)?.name || r.aulaDestino || '—';
  const lineasHtml = (r.lineas||[]).map(l => `<div style="font-size:12px;padding:2px 0">${escHtml(l.itemNombre)} · ${l.cantidad} ud.</div>`).join('');
  const puedeGestionar = typeof can !== 'function' || can('loans.write');
  const accionesHtml = puedeGestionar ? `
    <div class="pres-actions" style="flex-direction:column;gap:6px">
      <button class="btn btn-sm btn-return" onclick="confirmarRecogidaReserva(${r.id})">✅ Confirmar recogida</button>
      <button class="btn btn-sm" onclick="duplicarReservaPractica(${r.id})" title="Repetir esta práctica con el mismo material en otra fecha">⧉ Duplicar</button>
      <button class="btn btn-sm btn-d" onclick="cancelarReserva(${r.id})">✕ Cancelar</button>
    </div>` : '';
  return `<div class="pres-card">
    <div class="pres-info">
      <div class="pres-name">${escHtml(r.moduloNombre || 'Sin asignatura')}</div>
      <div class="pres-prof">${escHtml(r.profesorNombre)}</div>
      <div class="pres-meta">
        <span>📅 ${escHtml(r.fecha)}${r.franja ? ' · ' + escHtml(r.franja) : ''}</span>
        <span>🏫 ${escHtml(aulaNombre)}</span>
      </div>
      <div style="margin-top:6px">${lineasHtml}</div>
      ${r.obs?`<div style="font-size:11px;color:var(--muted);margin-top:4px">💬 ${escHtml(r.obs)}</div>`:''}
    </div>
    ${accionesHtml}
  </div>`;
}

function renderReservasPendientes(){
  const pendientes = getReservasPendientes().sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
  const el = document.getElementById('presReservasContent');
  if(!pendientes.length){
    el.innerHTML = `<div class="empty"><div class="ei">📅</div><div class="et">No hay prácticas planificadas</div></div>`;
    return;
  }
  el.innerHTML = pendientes.map(_reservaCardHtml).join('');
}

async function confirmarRecogidaReserva(reservaId){
  if(_reservaConfirmSubmitting) return;
  if(!await confirmDialog({message:'¿Confirmar la recogida? Se descontará el stock de todos los ítems de la reserva.', confirmText:'Confirmar'})) return;
  _reservaConfirmSubmitting = true;
  try {
    const res = await apiPost({action:'reservaConfirmar', reservaId});
    if(!res.ok) throw new Error(res.error);
    for(const p of (res.prestamos||[])){
      prestamos.push(p);
      const idx = items.findIndex(x=>Number(x.id)===Number(p.itemId));
      if(idx>=0) items[idx].qty = Number(items[idx].qty) - Number(p.cantidad);
    }
    const rIdx = reservas.findIndex(r=>Number(r.id)===Number(reservaId));
    if(rIdx>=0 && res.estado) reservas[rIdx].estado = res.estado;
    if(res.fallos && res.fallos.length){
      const nombres = res.fallos.map(f=>f.itemNombre||'?').join(', ');
      if(!res.prestamos || !res.prestamos.length){
        toast(`No se pudo recoger ningún ítem: sin stock suficiente (${nombres})`,'err');
      } else {
        toast(`Recogida parcial: ${res.fallos.length} línea(s) sin stock suficiente (${nombres})`,'warn');
      }
    } else {
      toast('Recogida confirmada','ok');
    }
    renderReservasPendientes();
    goPrestamos();
  } catch(err){ toast('Error: '+err.message,'err'); }
  finally { _reservaConfirmSubmitting = false; }
}

// Repite una práctica ya planificada: mismo ciclo/módulo, aula, profesor/a
// y material, pero con la fecha en blanco a propósito (es lo único que
// tiene sentido cambiar al repetir). Si algún ítem original ya no tiene
// stock disponible, esa línea no se copia y se avisa.
function duplicarReservaPractica(reservaId){
  const r = reservas.find(x => Number(x.id) === Number(reservaId));
  if(!r) return;
  openReservaPractica(); // abre en blanco con sus valores por defecto habituales

  const cicloVal = r.cicloId ? `${r.cicloId}__${r.moduloCod}` : '';
  const cicloSel = document.getElementById('res_ciclo');
  if(cicloVal && [...cicloSel.options].some(o => o.value === cicloVal)) cicloSel.value = cicloVal;
  const aulaSel = document.getElementById('res_aula');
  if(r.aulaDestino && [...aulaSel.options].some(o => o.value === r.aulaDestino)) aulaSel.value = r.aulaDestino;
  if(r.profesorId){
    const profOpt = _reservaProfOptions.find(p => String(p.id) === String(r.profesorId));
    if(profOpt) _renderProfSelectOptions('res_prof', _reservaProfOptions, profOpt.id);
  }
  document.getElementById('res_obs').value = r.obs || '';

  const lineasOriginales = r.lineas || [];
  _reservaLineas = lineasOriginales.map(l => {
    const itemActual = items.find(x => Number(x.id) === Number(l.itemId));
    const maxQty = itemActual ? Number(itemActual.qty) : 0;
    return { _rowId: _reservaLineaRowId++, itemId: l.itemId, itemNombre: l.itemNombre, cantidad: Math.min(l.cantidad, maxQty), maxQty };
  }).filter(l => l.maxQty > 0);
  _renderReservaLineas();
  _renderReservaItemResults();

  const descartadas = lineasOriginales.length - _reservaLineas.length;
  toast(descartadas > 0
    ? `Práctica duplicada — ${descartadas} ítem${descartadas!==1?'s':''} sin stock disponible no se copi${descartadas!==1?'aron':'ó'}, revisa fecha y material`
    : 'Práctica duplicada — revisa la fecha antes de guardar', 'ok');
}

async function cancelarReserva(reservaId){
  if(_reservaConfirmSubmitting) return;
  if(!await confirmDialog({message:'¿Cancelar esta reserva? Se liberará el material para otras reservas.', danger:true, confirmText:'Cancelar reserva'})) return;
  _reservaConfirmSubmitting = true;
  try {
    const res = await apiPost({action:'reservaCancelar', reservaId});
    if(!res.ok) throw new Error(res.error);
    const rIdx = reservas.findIndex(r=>Number(r.id)===Number(reservaId));
    if(rIdx>=0) reservas[rIdx].estado = 'cancelada';
    toast('Reserva cancelada','ok');
    renderReservasPendientes();
  } catch(err){ toast('Error: '+err.message,'err'); }
  finally { _reservaConfirmSubmitting = false; }
}
