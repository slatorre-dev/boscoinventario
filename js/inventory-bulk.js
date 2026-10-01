// ═════════════════════════════════════════════════════════
// ACCIONES EN LOTE DEL INVENTARIO (selección, cambiar campo, eliminar,
// exportar, imprimir). Extraído de js/inventory.js (modularización
// oportunista, Pendiente #26 de claude.md). Script CLÁSICO, no módulo:
// sus funciones se llaman desde onclick= de index.html y de plantillas
// innerHTML de inventory.js, así que deben seguir siendo globales.
// Se carga justo después de inventory.js.
// ═════════════════════════════════════════════════════════

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
    box.innerHTML = '<div style="font-size:12px;color:var(--muted)">Marca los ítems seleccionados como pendientes de mantenimiento.</div>';
  } else if(action === 'plan-set'){
    box.innerHTML = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select id="bulkPlanIntervalo" onchange="onBulkPlanIntervaloChange()">${mantPlanIntervaloOptionsHtml('')}</select>
      <input id="bulkPlanIntervaloOtro" type="number" min="1" placeholder="Días" style="display:none;width:90px">
      <input id="bulkPlanNota" type="text" placeholder="Qué revisar (opcional)" style="flex:1;min-width:160px">
    </div>`;
  } else if(action === 'plan-off'){
    box.innerHTML = '<div style="font-size:12px;color:var(--muted)">Quita el plan de mantenimiento preventivo de los ítems seleccionados (no borra la última revisión ya hecha).</div>';
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

function onBulkPlanIntervaloChange(){
  const esOtro = document.getElementById('bulkPlanIntervalo').value === '__otro';
  document.getElementById('bulkPlanIntervaloOtro').style.display = esOtro ? '' : 'none';
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
  else if(action === 'mant') patch = { mantEstado: 'Pendiente' };
  else if(action === 'plan-set') {
    const sel = document.getElementById('bulkPlanIntervalo').value;
    const intervalo = sel === '__otro' ? parseInt(document.getElementById('bulkPlanIntervaloOtro').value,10) : parseInt(sel,10);
    if(!intervalo || intervalo < 1){ toast('Indica un intervalo válido','err'); return; }
    const fecha = new Date(); fecha.setDate(fecha.getDate()+intervalo);
    patch = { mantPlanIntervaloDias: intervalo, mantPlanProximaRevision: fecha.toISOString().slice(0,10), mantPlanNota: document.getElementById('bulkPlanNota').value.trim() };
  }
  else if(action === 'plan-off') patch = { mantPlanIntervaloDias: null, mantPlanProximaRevision: '' };
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
