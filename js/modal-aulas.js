// ═════════════════════════════════════════════════════════
// MODAL GESTIÓN DE AULAS
// ═════════════════════════════════════════════════════════
let aulasEditing = [];

function openAulasModal(){
  if(!requirePerm('config.manage')) return;
  // Solo el aula propia del departamento se gestiona aquí — las aulas
  // globales del centro y la compartida "IES Juan Bosco" no son editables
  // desde cada departamento (evita duplicarlas al guardar).
  aulasEditing = JSON.parse(JSON.stringify(AULAS.filter(a=>a.departamento && a.departamento!=='iesjuanbosco'))); // copia profunda
  renderAulasList();
  document.getElementById('mAulas').classList.add('open');
}
function closeAulasModal(){document.getElementById('mAulas').classList.remove('open')}

function renderAulasList(){
  document.getElementById('aulasList').innerHTML = aulasEditing.map((a,i)=>`
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
    const res = await apiPost({action:'aulasSync', aulas:aulasEditing});
    if(!res.ok) throw new Error(res.error);
    AULAS = aulasEditing;
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
  const h = 'Nombre,Descripción,Icono';
  const rows = aulasEditing.map(a => [a.name, a.desc, a.icon].map(csvCell).join(','));
  downloadText('aulas.csv', 'text/csv;charset=utf-8', '﻿' + [h, ...rows].join('\n'));
  toast('CSV exportado', 'ok');
}
