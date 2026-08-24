// ═════════════════════════════════════════════════════════
// PLANIFICACIÓN DE PRÁCTICAS (RESERVAS DE MATERIAL)
// ═════════════════════════════════════════════════════════
let _reservaProfOptions = [];
let _reservaLineas = [];
let _reservaLineaRowId = 0;
let _reservaItemsDisponibles = [];

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

  document.getElementById('res_fecha').value = '';
  document.getElementById('res_franja').value = '';
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
  document.getElementById('res_itemSelect').innerHTML = '<option value="">— Seleccionar ítem —</option>' +
    filtered.map(x => {
      const aulaNombre = AULAS.find(a=>a.id===x.aula)?.name || x.aula || '—';
      return `<option value="${x.id}">${escHtml(x.item)}${x.ref?' ['+escHtml(x.ref)+']':''} · ${escHtml(aulaNombre)} · ${x.qty} uds.</option>`;
    }).join('');
}

function anadirLineaReserva(){
  const itemId = document.getElementById('res_itemSelect').value;
  if(!itemId){ toast('Selecciona un ítem','err'); return; }
  const item = _reservaItemsDisponibles.find(x => String(x.id) === String(itemId));
  if(!item) return;
  if(_reservaLineas.some(l => String(l.itemId) === String(itemId))){
    toast('Ese ítem ya está en la lista','err');
    return;
  }
  _reservaLineas.push({ _rowId: _reservaLineaRowId++, itemId: item.id, itemNombre: item.item, cantidad: 1, maxQty: Number(item.qty) });
  _renderReservaLineas();
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
}

async function guardarReservaPractica(){
  const fecha = document.getElementById('res_fecha').value;
  const franja = document.getElementById('res_franja').value.trim();
  const profId = document.getElementById('res_prof').value;
  if(!fecha){ toast('Indica la fecha de la práctica','err'); return; }
  if(!franja){ toast('Indica la franja horaria','err'); return; }
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

function togglePresReservas(){
  currentPresShowReservas = document.getElementById('presReservasToggle').checked;
  document.getElementById('presContent').style.display = currentPresShowReservas ? 'none' : '';
  document.getElementById('presReservasContent').style.display = currentPresShowReservas ? '' : 'none';
  if(currentPresShowReservas) renderReservasPendientes();
}

function getReservasPendientes(){
  return (typeof reservas !== 'undefined' ? reservas : []).filter(r => r.estado === 'pendiente');
}

function _reservaCardHtml(r){
  const aulaNombre = AULAS.find(a=>a.id===r.aulaDestino)?.name || r.aulaDestino || '—';
  const lineasHtml = (r.lineas||[]).map(l => `<div style="font-size:12px;padding:2px 0">${escHtml(l.itemNombre)} · ${l.cantidad} ud.</div>`).join('');
  return `<div class="pres-card">
    <div class="pres-info">
      <div class="pres-name">${escHtml(r.moduloNombre || 'Sin asignatura')}</div>
      <div class="pres-prof">${escHtml(r.profesorNombre)}</div>
      <div class="pres-meta">
        <span>📅 ${escHtml(r.fecha)} · ${escHtml(r.franja)}</span>
        <span>🏫 ${escHtml(aulaNombre)}</span>
      </div>
      <div style="margin-top:6px">${lineasHtml}</div>
      ${r.obs?`<div style="font-size:11px;color:var(--muted);margin-top:4px">💬 ${escHtml(r.obs)}</div>`:''}
    </div>
    <div class="pres-actions" style="flex-direction:column;gap:6px">
      <button class="btn btn-sm btn-return" onclick="confirmarRecogidaReserva(${r.id})">✅ Confirmar recogida</button>
      <button class="btn btn-sm btn-d" onclick="cancelarReserva(${r.id})">✕ Cancelar</button>
    </div>
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
  if(!await confirmDialog({message:'¿Confirmar la recogida? Se descontará el stock de todos los ítems de la reserva.', confirmText:'Confirmar'})) return;
  try {
    const res = await apiPost({action:'reservaConfirmar', reservaId});
    if(!res.ok) throw new Error(res.error);
    for(const p of (res.prestamos||[])){
      prestamos.push(p);
      const idx = items.findIndex(x=>Number(x.id)===Number(p.itemId));
      if(idx>=0) items[idx].qty = Number(items[idx].qty) - Number(p.cantidad);
    }
    const rIdx = reservas.findIndex(r=>Number(r.id)===Number(reservaId));
    if(rIdx>=0) reservas[rIdx].estado = 'recogida';
    if(res.fallos && res.fallos.length){
      toast(`Recogida parcial: ${res.fallos.length} línea(s) sin stock suficiente (${res.fallos.map(f=>f.itemNombre).join(', ')})`,'warn');
    } else {
      toast('Recogida confirmada','ok');
    }
    renderReservasPendientes();
    goPrestamos();
  } catch(err){ toast('Error: '+err.message,'err'); }
}

async function cancelarReserva(reservaId){
  if(!await confirmDialog({message:'¿Cancelar esta reserva? Se liberará el material para otras reservas.', danger:true, confirmText:'Cancelar reserva'})) return;
  try {
    const res = await apiPost({action:'reservaCancelar', reservaId});
    if(!res.ok) throw new Error(res.error);
    const rIdx = reservas.findIndex(r=>Number(r.id)===Number(reservaId));
    if(rIdx>=0) reservas[rIdx].estado = 'cancelada';
    toast('Reserva cancelada','ok');
    renderReservasPendientes();
  } catch(err){ toast('Error: '+err.message,'err'); }
}
