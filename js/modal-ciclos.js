// ═════════════════════════════════════════════════════════
// MODAL GESTIÓN DE CICLOS Y MÓDULOS
// ═════════════════════════════════════════════════════════

const _CICLO_ICONS = ['📡','🔌','🔧','⚙️','💡','🖥️','🔋','🛠️','📻','🎛️'];
const _CICLO_TH    = ['th-blue','th-amber','th-purple','th-teal','th-pink','th-green'];

let ciclosEditing  = [];
let cicloExpandIdx = null;
let cicloAddingNew = false;

function openCiclosModal(){
  if(!requirePerm('config.manage')) return;
  const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
  if(isSuperAdmin && !deptActivo){
    toast('Elige un departamento en el selector de la barra superior primero', 'err');
    return;
  }
  const filtroDept = isSuperAdmin ? deptActivo : null;
  // "IES Juan Bosco" es un ciclo compartido entre departamentos — no se
  // gestiona desde aquí (evita duplicarlo bajo el departamento propio al
  // guardar). Para superadmin, filtra además por el departamento activo
  // (Fase 3) — cada ciclo agrupado ya trae su `departamento` (meta.js).
  ciclosEditing  = JSON.parse(JSON.stringify(CICLOS.filter(c =>
    c.id !== 'iesjuanbosco' &&
    (filtroDept ? c.departamento === filtroDept : true)
  )));
  cicloExpandIdx = null;
  cicloAddingNew = false;
  document.getElementById('mCiclos').classList.add('open');
  // Con listas largas (vista superadmin, 30+ ciclos), pintar decenas de
  // <input> de golpe mientras el modal todavía está en su transición de
  // apertura (transform+opacity) deja filas sin texto visible hasta que
  // el usuario interactúa. Un requestAnimationFrame antes de renderizar
  // asegura que el modal ya esté visible y en su tamaño final.
  requestAnimationFrame(() => requestAnimationFrame(_renderCiclos));
}
function closeCiclosModal(){ document.getElementById('mCiclos').classList.remove('open'); }

function _renderCiclos(){
  const el = document.getElementById('ciclosList');
  el.innerHTML = ciclosEditing.map((c, i) => {
    const isDpto   = c.id === 'departamento';
    const expanded = cicloExpandIdx === i;
    return `
      <div class="ciclo-block${expanded ? ' expanded' : ''}">
        <div class="ciclo-hdr" onclick="toggleCicloExpand(${i})">
          <span class="ciclo-icon-inp"><input value="${c.icon||'📚'}"
            onclick="event.stopPropagation()"
            onchange="ciclosEditing[${i}].icon=this.value.trim()"
            maxlength="2" title="Icono (emoji)"></span>
          <span class="nivel-badge ${c.nivel==='CFGM'?'badge-gm':'badge-gs'}">${c.nivel||'—'}</span>
          <span class="ciclo-name-inp"><input value="${c.name.replace(/"/g,'&quot;')}"
            onclick="event.stopPropagation()"
            onchange="ciclosEditing[${i}].name=this.value"
            placeholder="Nombre del ciclo/departamento"></span>
          <span class="ciclo-nmods">${c.modulos.length} asig./mód.</span>
          <span class="expand-arrow">${expanded?'▲':'▼'}</span>
          ${isDpto ? '<span style="width:28px"></span>' :
            `<button class="del-btn" onclick="event.stopPropagation();removeCicloRow(${i})" title="Eliminar ciclo/departamento">🗑</button>`}
        </div>
        ${expanded ? _renderMods(c, i) : ''}
      </div>`;
  }).join('');

  if(cicloAddingNew) el.innerHTML += _renderNewForm();
}

function _renderMods(c, ci){
  return `
    <div class="ciclo-mods">
      <div class="mods-hdr">
        <span>Código</span><span>Nombre asignatura/módulo</span><span>Horas</span><span></span>
      </div>
      ${c.modulos.map((m, mi) => `
        <div class="mod-row">
          <input class="mod-cod" value="${m.cod}"
            onchange="ciclosEditing[${ci}].modulos[${mi}].cod=this.value.trim()"
            placeholder="0000">
          <input class="mod-name" value="${m.name.replace(/"/g,'&quot;')}"
            onchange="ciclosEditing[${ci}].modulos[${mi}].name=this.value"
            placeholder="Nombre asignatura/módulo">
          <input class="mod-horas" type="number" min="0" value="${m.horas}"
            onchange="ciclosEditing[${ci}].modulos[${mi}].horas=Number(this.value)||0"
            placeholder="0">
          <button class="del-btn" onclick="removeModuloRow(${ci},${mi})" title="Eliminar asignatura/módulo">🗑</button>
        </div>`).join('')}
      <button class="add-aula-btn" style="margin-top:8px" onclick="addModuloRow(${ci})">＋ Añadir asignatura/módulo</button>
    </div>`;
}

function _renderNewForm(){
  return `
    <div class="ciclo-block new-ciclo-form">
      <div class="ncf-grid">
        <div>
          <label class="ncf-lbl">Nivel</label>
          <select id="ncNivel" class="sinput">
            <option value="CFGM">Grado Medio (CFGM)</option>
            <option value="CFGS">Grado Superior (CFGS)</option>
            <option value="ESO">ESO</option>
            <option value="Bachillerato">Bachillerato</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div>
          <label class="ncf-lbl">Nombre del ciclo/departamento</label>
          <input id="ncNombre" class="sinput" placeholder="Ej: Instalaciones Eléctricas / Matemáticas">
        </div>
      </div>
      <div class="ncf-sep">Primera asignatura/módulo (obligatorio)</div>
      <div class="ncf-mods">
        <div>
          <label class="ncf-lbl">Código</label>
          <input id="ncModCod" class="sinput" placeholder="0000">
        </div>
        <div>
          <label class="ncf-lbl">Nombre asignatura/módulo</label>
          <input id="ncModNombre" class="sinput" placeholder="Nombre de la asignatura/módulo">
        </div>
        <div>
          <label class="ncf-lbl">Horas</label>
          <input id="ncModHoras" class="sinput" type="number" min="0" placeholder="0">
        </div>
      </div>
      <div class="ncf-btns">
        <button class="btn" onclick="cancelNewCiclo()">Cancelar</button>
        <button class="btn btn-p" onclick="confirmAddCiclo()">＋ Añadir ciclo/departamento</button>
      </div>
    </div>`;
}

function toggleCicloExpand(i){
  cicloExpandIdx = cicloExpandIdx === i ? null : i;
  _renderCiclos();
}

async function removeCicloRow(idx){
  const c = ciclosEditing[idx];
  const usados = items.filter(x => x.mod && x.mod.startsWith(c.id + '__')).length;
  if(usados > 0){
    if(!await confirmDialog({message:`Este ciclo tiene ${usados} ítem(s) asignados. Si lo eliminas, esos ítems conservarán el valor anterior. ¿Continuar?`})) return;
  }
  ciclosEditing.splice(idx, 1);
  if(cicloExpandIdx === idx) cicloExpandIdx = null;
  else if(cicloExpandIdx > idx) cicloExpandIdx--;
  _renderCiclos();
}

function addModuloRow(cicloIdx){
  ciclosEditing[cicloIdx].modulos.push({cod:'', name:'', horas:0});
  _renderCiclos();
}

async function removeModuloRow(cicloIdx, modIdx){
  const c   = ciclosEditing[cicloIdx];
  const mid = c.id + '__' + c.modulos[modIdx].cod;
  const usados = items.filter(x => x.mod === mid).length;
  if(usados > 0){
    if(!await confirmDialog({message:`Este módulo tiene ${usados} ítem(s) asignados. ¿Continuar?`})) return;
  }
  c.modulos.splice(modIdx, 1);
  _renderCiclos();
}

function showNewCicloForm(){
  cicloAddingNew = true;
  cicloExpandIdx = null;
  _renderCiclos();
  document.getElementById('ncNombre') && document.getElementById('ncNombre').focus();
}

function cancelNewCiclo(){
  cicloAddingNew = false;
  _renderCiclos();
}

function confirmAddCiclo(){
  const nivel      = document.getElementById('ncNivel').value;
  const nombre     = document.getElementById('ncNombre').value.trim();
  const modCod     = document.getElementById('ncModCod').value.trim();
  const modNombre  = document.getElementById('ncModNombre').value.trim();
  const modHoras   = Number(document.getElementById('ncModHoras').value) || 0;

  if(!nombre)              { toast('Introduce el nombre del ciclo', 'err'); return; }
  if(!modCod || !modNombre){ toast('El primer módulo necesita código y nombre', 'err'); return; }

  const prefix = nivel === 'CFGM' ? 'gm_' : 'gs_';
  const slug   = nombre.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').substring(0,20);
  let newId = prefix + slug;
  if(ciclosEditing.some(c => c.id === newId)) newId += '_' + Date.now().toString().slice(-4);

  const nonDpto = ciclosEditing.filter(c => c.id !== 'departamento');
  const iconIdx = nonDpto.length % _CICLO_ICONS.length;
  const thIdx   = nonDpto.length % _CICLO_TH.length;

  const newCiclo = {
    id: newId, name: nombre, nivel,
    icon: _CICLO_ICONS[iconIdx], th: _CICLO_TH[thIdx],
    desc: `${nivel === 'CFGM' ? 'Grado Medio' : 'Grado Superior'} · ${nombre}`,
    modulos: [{cod: modCod, name: modNombre, horas: modHoras}]
  };

  const dptoIdx = ciclosEditing.findIndex(c => c.id === 'departamento');
  if(dptoIdx >= 0) ciclosEditing.splice(dptoIdx, 0, newCiclo);
  else ciclosEditing.push(newCiclo);

  cicloAddingNew = false;
  cicloExpandIdx = dptoIdx >= 0 ? dptoIdx : ciclosEditing.length - 1;
  _renderCiclos();
}

async function saveCiclos(){
  for(const c of ciclosEditing){
    if(!c.name.trim()){ toast('Hay ciclos sin nombre', 'err'); return; }
    for(const m of c.modulos){
      if(!m.cod || !m.name.trim()){
        toast(`Módulo sin código o nombre en "${c.name}"`, 'err'); return;
      }
    }
  }
  try {
    const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
    const payload = {action:'ciclosSync', ciclos:ciclosEditing};
    if(isSuperAdmin && deptActivo) payload.departamentoDestino = deptActivo;
    const res = await apiPost(payload);
    if(!res.ok) throw new Error(res.error);
    if(isSuperAdmin && deptActivo){
      // CICLOS de superadmin mezcla TODOS los departamentos (meta.js no
      // filtra para su rol) — reemplazar el array entero con solo los
      // del departamento activo rompería la vista global. En su lugar,
      // sustituir solo las entradas de ese departamento dentro del array
      // ya existente.
      CICLOS = CICLOS.filter(c => c.departamento !== deptActivo).concat(ciclosEditing);
    } else {
      CICLOS = ciclosEditing;
    }
    closeCiclosModal();
    renderHome();
    toast('Ciclos guardados y sincronizados', 'ok');
  } catch(err){
    toast('Error al sincronizar: '+err.message, 'err');
  }
}

// Una fila por asignatura/módulo, agrupadas por ciclo/departamento —
// igual que el CSV de import, para poder editar en hoja de cálculo y
// reimportar sin perder la agrupación.
function exportCiclosCSV(){
  const h = 'CicloId,CicloNombre,Nivel,Icono,ModCodigo,ModNombre,ModHoras';
  const rows = [];
  ciclosEditing.forEach(c => {
    if(!c.modulos.length){ rows.push([c.id,c.name,c.nivel,c.icon,'','',''].map(csvCell).join(',')); return; }
    c.modulos.forEach(m => rows.push([c.id,c.name,c.nivel,c.icon,m.cod,m.name,m.horas].map(csvCell).join(',')));
  });
  downloadText('ciclos.csv', 'text/csv;charset=utf-8', '﻿' + [h, ...rows].join('\n'));
  toast('CSV exportado', 'ok');
}

function importCiclosCSV(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    const lines = e.target.result.trim().split('\n').filter(l => l.trim());
    if(!lines.length){ toast('CSV vacío', 'err'); return; }

    const primera = lines[0].toLowerCase().replace(/\s/g,'');
    const tieneCabecera = primera.includes('ciclo') || primera.includes('mod');
    const filas = tieneCabecera ? lines.slice(1) : lines;

    const porCiclo = {};
    const orden = [];
    let filasValidas = 0;
    filas.forEach(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g,''));
      const cicloId = cols[0], cicloNombre = cols[1];
      if(!cicloId || !cicloNombre) return;
      if(!porCiclo[cicloId]){
        porCiclo[cicloId] = { id: cicloId, name: cicloNombre, nivel: cols[2]||'', icon: cols[3]||'📚', th: 'th-blue', desc: cicloNombre, modulos: [] };
        orden.push(cicloId);
      }
      const modCod = cols[4], modNombre = cols[5];
      if(modCod && modNombre) porCiclo[cicloId].modulos.push({ cod: modCod, name: modNombre, horas: Number(cols[6])||0 });
      filasValidas++;
    });

    if(!filasValidas){ toast('No se encontraron filas válidas en el CSV', 'err'); return; }

    // Reemplaza los ciclos editados (salvo "departamento", que no se toca
    // desde import) con lo importado, evitando duplicar por id.
    const dptoIdx = ciclosEditing.findIndex(c => c.id === 'departamento');
    const dpto = dptoIdx >= 0 ? ciclosEditing[dptoIdx] : null;
    ciclosEditing = orden.map(id => porCiclo[id]).filter(c => c.id !== 'departamento');
    if(dpto) ciclosEditing.push(dpto);

    cicloExpandIdx = null;
    cicloAddingNew = false;
    _renderCiclos();
    input.value = '';
    toast(`${orden.length} ciclo(s)/departamento(s) importado(s). Revisa y pulsa Guardar.`, 'ok');
  };
  reader.readAsText(file, 'utf-8');
}
