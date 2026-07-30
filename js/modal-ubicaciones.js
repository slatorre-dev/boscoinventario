// Gestion de ubicaciones sugeridas
let ubicacionesEditing = [];

function openUbicacionesModal(){
  if(!requirePerm('config.manage')) return;
  ubicacionesEditing = JSON.parse(JSON.stringify(UBICACIONES || []));
  renderUbicacionesList();
  document.getElementById('mUbicaciones').classList.add('open');
}

function closeUbicacionesModal(){
  document.getElementById('mUbicaciones').classList.remove('open');
}

function renderUbicacionesList(){
  const el = document.getElementById('ubicacionesList');
  if(!ubicacionesEditing.length){
    el.innerHTML = '<div class="empty" style="padding:20px"><div class="et" style="font-size:13px">Sin ubicaciones guardadas.</div></div>';
    return;
  }
  el.innerHTML = ubicacionesEditing.map((u,i)=>`
    <div class="aula-row">
      <div style="display:flex;flex-direction:column;gap:1px">
        <button class="del-btn" onclick="moveUbicacionRow(${i},-1)" title="Subir" ${i===0?'disabled':''} style="font-size:10px;padding:1px 4px">▲</button>
        <button class="del-btn" onclick="moveUbicacionRow(${i},1)" title="Bajar" ${i===ubicacionesEditing.length-1?'disabled':''} style="font-size:10px;padding:1px 4px">▼</button>
      </div>
      <input class="fi-w name-input" value="${escHtml(u.name || '')}" onchange="ubicacionesEditing[${i}].name=this.value" placeholder="Ubicacion">
      <button class="del-btn" onclick="removeUbicacionRow(${i})" title="Eliminar">🗑</button>
    </div>
  `).join('');
}

function moveUbicacionRow(i, dir){
  const j = i + dir;
  if(j < 0 || j >= ubicacionesEditing.length) return;
  [ubicacionesEditing[i], ubicacionesEditing[j]] = [ubicacionesEditing[j], ubicacionesEditing[i]];
  renderUbicacionesList();
}

function addUbicacionRow(){
  ubicacionesEditing.push({ name:'Nueva ubicacion', orden: ubicacionesEditing.length + 1 });
  renderUbicacionesList();
}

async function removeUbicacionRow(idx){
  const u = ubicacionesEditing[idx];
  const usadas = items.filter(x => String(x.loc || '').trim().toLowerCase() === String(u.name || '').trim().toLowerCase()).length;
  if(usadas > 0 && !await confirmDialog({message:`Esta ubicacion se usa en ${usadas} item(s). Si la eliminas, esos items conservaran el texto de ubicacion. ¿Continuar?`})) return;
  ubicacionesEditing.splice(idx, 1);
  renderUbicacionesList();
}

async function saveUbicaciones(){
  const clean = ubicacionesEditing
    .map((u,i) => ({ name: String(u.name || '').trim(), orden: i + 1 }))
    .filter(u => u.name);
  const keys = clean.map(u => u.name.toLowerCase());
  if(new Set(keys).size !== keys.length){ toast('Hay ubicaciones duplicadas','err'); return; }
  try{
    const res = await apiPost({ action:'ubicacionesSync', ubicaciones: clean });
    if(!res.ok) throw new Error(res.error);
    UBICACIONES = clean;
    fillLocationSuggestions();
    closeUbicacionesModal();
    toast('Ubicaciones guardadas','ok');
  }catch(err){
    toast('Error al sincronizar: ' + err.message, 'err');
  }
}
