// ═════════════════════════════════════════════════════════
// MODAL GESTIÓN DE AULAS
// ═════════════════════════════════════════════════════════
let aulasEditing = [];
// true cuando el superadmin no ha elegido un departamento concreto (o ha
// elegido el compartido "IES Juan Bosco") — muestra TODAS las aulas de
// TODOS los departamentos, agrupadas, de solo lectura. Editar de verdad
// sigue exigiendo elegir un departamento concreto en el selector.
let aulasReadonlyGlobal = false;

function openAulasModal(){
  if(!requirePerm('config.manage')) return;
  const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
  aulasReadonlyGlobal = isSuperAdmin && (!deptActivo || deptActivo === 'iesjuanbosco');
  // Solo el aula propia del departamento se gestiona aquí — las aulas
  // globales del centro y la compartida "IES Juan Bosco" no son editables
  // desde cada departamento (evita duplicarlas al guardar). Para superadmin,
  // "propia" significa el departamento elegido en deptActivo (Fase 3), salvo
  // en vista global, donde se listan las de todos los departamentos.
  const filtroDept = (isSuperAdmin && !aulasReadonlyGlobal) ? deptActivo : null;
  aulasEditing = JSON.parse(JSON.stringify(AULAS.filter(a =>
    a.departamento && a.departamento !== 'iesjuanbosco' &&
    (filtroDept ? a.departamento === filtroDept : true)
  ))); // copia profunda
  if(aulasReadonlyGlobal){
    aulasEditing.sort((a,b) => deptNombre(a.departamento).localeCompare(deptNombre(b.departamento), 'es') || a.name.localeCompare(b.name, 'es'));
  }
  renderAulasList();
  const editControls = document.getElementById('aulasEditControls');
  if(editControls) editControls.style.display = aulasReadonlyGlobal ? 'none' : '';
  const btnGuardar = document.getElementById('btnGuardarAulas');
  if(btnGuardar) btnGuardar.style.display = aulasReadonlyGlobal ? 'none' : '';
  document.getElementById('mAulas').classList.add('open');
}
function closeAulasModal(){document.getElementById('mAulas').classList.remove('open')}

function renderAulasList(){
  const box = document.getElementById('aulasList');
  if(aulasReadonlyGlobal){
    if(!aulasEditing.length){
      box.innerHTML = '<p style="color:var(--muted);font-size:13px">Ningún departamento tiene aulas propias todavía.</p>';
      return;
    }
    let lastDept = null, html = '';
    aulasEditing.forEach(a => {
      if(a.departamento !== lastDept){
        html += `<div class="dept-group-header">${escHtml(deptNombre(a.departamento))}</div>`;
        lastDept = a.departamento;
      }
      html += `<div class="aula-row aula-row-readonly"><span>${escHtml(a.icon)}</span><b>${escHtml(a.name)}</b>${a.desc ? ' — '+escHtml(a.desc) : ''}</div>`;
    });
    box.innerHTML = html;
    return;
  }
  box.innerHTML = aulasEditing.map((a,i)=>`
    <div class="aula-row">
      <div style="display:flex;flex-direction:column;gap:1px">
        <button class="del-btn" onclick="moveAulaRow(${i},-1)" title="Subir" ${i===0?'disabled':''} style="font-size:10px;padding:1px 4px">▲</button>
        <button class="del-btn" onclick="moveAulaRow(${i},1)" title="Bajar" ${i===aulasEditing.length-1?'disabled':''} style="font-size:10px;padding:1px 4px">▼</button>
      </div>
      <input class="icon-pick" value="${a.icon}" onchange="aulasEditing[${i}].icon=this.value" maxlength="2">
      <input class="fi-w name-input" value="${a.name}" onchange="aulasEditing[${i}].name=this.value" placeholder="Nombre">
      <input class="fi-w desc-input" value="${a.desc||''}" onchange="aulasEditing[${i}].desc=this.value" placeholder="Descripción">
      <button class="del-btn" onclick="removeAulaRow(${i})" title="Eliminar">🗑</button>
    </div>
  `).join('');
}

function moveAulaRow(i, dir){
  const j = i + dir;
  if(j < 0 || j >= aulasEditing.length) return;
  [aulasEditing[i], aulasEditing[j]] = [aulasEditing[j], aulasEditing[i]];
  renderAulasList();
}

function addAulaRow(){
  const newId = 'aula_'+Date.now();
  aulasEditing.push({id:newId, name:'Aula nueva', icon:'🏫', desc:'', th:TH_OPTIONS[aulasEditing.length%TH_OPTIONS.length]});
  renderAulasList();
}

async function removeAulaRow(idx){
  const a = aulasEditing[idx];
  const usadas = items.filter(x=>x.aula===a.id).length;
  if(usadas > 0){
    if(!await confirmDialog({message:`Esta aula tiene ${usadas} ítem(s) asignados. Si la eliminas, esos ítems quedarán sin aula. ¿Continuar?`})) return;
  }
  aulasEditing.splice(idx,1);
  renderAulasList();
}

function _slugAulaId(name){
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')
    .replace(/_+/g,'_').replace(/^_|_$/g,'').slice(0,30) || ('aula_'+Date.now());
}

async function saveAulas(){
  // Validación: nombres no vacíos
  for(const a of aulasEditing){
    if(!a.name.trim()){toast('Hay aulas sin nombre','err');return}
  }
  // Asegurar que cada aula tiene un th asignado
  aulasEditing.forEach((a,i)=>{ if(!a.th) a.th = TH_OPTIONS[i%TH_OPTIONS.length]; a.orden = i; });

  // Convertir IDs de timestamp en slugs legibles para aulas recién creadas
  const existingIds = new Set(AULAS.map(a=>a.id));
  aulasEditing.forEach(a=>{
    if(/^aula_\d{13}$/.test(a.id) && !existingIds.has(a.id)){
      let slug = _slugAulaId(a.name);
      let candidate = slug, n = 2;
      while(aulasEditing.some(b=>b!==a && b.id===candidate)) candidate = slug+'_'+n++;
      a.id = candidate;
    }
  });

  try {
    const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
    const payload = {action:'aulasSync', aulas:aulasEditing};
    if(isSuperAdmin && deptActivo) payload.departamentoDestino = deptActivo;
    const res = await apiPost(payload);
    if(!res.ok) throw new Error(res.error);
    if(isSuperAdmin && deptActivo){
      // AULAS de superadmin mezcla TODOS los departamentos (meta.js no
      // filtra para su rol) — reemplazar el array entero con solo las
      // del departamento activo rompería la vista global. En su lugar,
      // sustituir solo las filas de ese departamento dentro del array
      // ya existente.
      AULAS = AULAS.filter(a => a.departamento !== deptActivo).concat(aulasEditing);
    } else {
      AULAS = aulasEditing;
    }
    closeAulasModal();
    renderHome();
    toast('Aulas guardadas y sincronizadas','ok');
  } catch(err) {
    toast('Error al sincronizar: '+err.message,'err');
  }
}

function importAulasCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const lines = e.target.result.trim().split('\n').filter(l => l.trim());
    if (!lines.length) { toast('CSV vacío', 'err'); return; }

    // Detectar si la primera línea es cabecera
    const primera = lines[0].toLowerCase().replace(/\s/g,'');
    const tieneCabecera = primera.includes('nombre') || primera.includes('aula');
    const filas = tieneCabecera ? lines.slice(1) : lines;

    let importadas = 0;
    filas.forEach(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const nombre = cols[0];
      if (!nombre) return;
      const desc = cols[1] || '';
      const icono = cols[2] || '🏫';
      // Evitar duplicados por nombre
      if (aulasEditing.some(a => a.name.toLowerCase() === nombre.toLowerCase())) return;
      aulasEditing.push({ id: 'aula_' + Date.now() + '_' + importadas, name: nombre, desc, icon: icono, th: TH_OPTIONS[aulasEditing.length % TH_OPTIONS.length] });
      importadas++;
    });

    renderAulasList();
    input.value = '';
    toast(`${importadas} aulas importadas. Pulsa Guardar para aplicar.`, 'ok');
  };
  reader.readAsText(file, 'utf-8');
}

function exportAulasCSV(){
  if(aulasReadonlyGlobal){
    const h = 'Departamento,Nombre,Descripción,Icono';
    const rows = aulasEditing.map(a => [deptNombre(a.departamento), a.name, a.desc, a.icon].map(csvCell).join(','));
    downloadText('aulas.csv', 'text/csv;charset=utf-8', '﻿' + [h, ...rows].join('\n'));
    toast('CSV exportado', 'ok');
    return;
  }
  const h = 'Nombre,Descripción,Icono';
  const rows = aulasEditing.map(a => [a.name, a.desc, a.icon].map(csvCell).join(','));
  downloadText('aulas.csv', 'text/csv;charset=utf-8', '﻿' + [h, ...rows].join('\n'));
  toast('CSV exportado', 'ok');
}
