// ═════════════════════════════════════════════════════════
// IMPORTACIÓN CSV
// ═════════════════════════════════════════════════════════
let impData = { rawText:'', headers:[], rows:[], mapping:{}, validRows:[], invalidRows:[] };
let backupData = null;

// Campos del inventario y sinónimos comunes para auto-detección
const IMP_FIELDS = [
  {k:'item',  label:'Nombre del ítem *', synonyms:['item','articulo','producto','nombre','descripcion','material']},
  {k:'code',  label:'Código inventario',  synonyms:['code','codigo inventario','codigo qr','qr','id qr','codigo interno']},
  {k:'ref',   label:'Referencia',         synonyms:['ref','referencia','codigo','sku']},
  {k:'aula',  label:'Aula',               synonyms:['aula','sala','ubicacion_aula','espacio','clase']},
  {k:'qty',   label:'Cantidad',           synonyms:['cantidad','qty','cant','unidades','stock','existencias']},
  {k:'min',   label:'Stock mínimo',       synonyms:['minimo','min','stock_minimo','reposicion']},
  {k:'tipo_material', label:'Tipo material', synonyms:['tipo_material','tipo material','tipo gestion','tipo_gestion','consumible','inventariable']},
  {k:'cat',   label:'Categoría',          synonyms:['categoria','cat','tipo','familia']},
  {k:'loc',   label:'Ubicación',          synonyms:['ubicacion','localizacion','localizado','sitio','estanteria']},
  {k:'est',   label:'Estado',             synonyms:['estado','condicion','status']},
  {k:'mant',  label:'Mantenimiento',      synonyms:['mantenimiento','reparacion','reparación','averia','avería','mant']},
  {k:'mantFecha',  label:'Fecha aviso mant.', synonyms:['fecha_mantenimiento','fecha_reparacion','aviso_mantenimiento','mant_fecha']},
  {k:'mantEstado', label:'Estado mant.',       synonyms:['estado_mantenimiento','estado_reparacion','mant_estado']},
  {k:'mantResp',   label:'Responsable mant.',  synonyms:['responsable_mantenimiento','responsable_reparacion','mant_responsable']},
  {k:'mantNota',   label:'Nota mant.',         synonyms:['nota_mantenimiento','nota_reparacion','motivo_reparacion','mant_nota']},
  {k:'util',  label:'Utilidad',           synonyms:['utilidad','uso','funcion','para_que']},
  {k:'proveedor', label:'Proveedor',       synonyms:['proveedor','supplier','tienda','url_proveedor','compra','enlace_compra']},
  {k:'tags',  label:'Tags',               synonyms:['tags','etiquetas','tag','keywords','palabras_clave']},
  {k:'fecha', label:'Última revisión',    synonyms:['fecha','revision','ultima_revision','actualizado']},
  {k:'obs',   label:'Observaciones',      synonyms:['observaciones','obs','notas','comentarios','comentario']},
];
const IMP_REQUIRED = ['item'];
const ESTADOS_VALIDOS = ['Bueno','Deteriorado','Avería','Baja'];
const CATEGORIAS_VALIDAS = () => Object.keys(CATS);

function openImportModal(){
  if(!SESSION){toast('Inicia sesión primero','err');return}
  if(!requirePerm('import.write')) return;
  impData = { rawText:'', headers:[], rows:[], mapping:{}, validRows:[], invalidRows:[] };
  backupData = null;
  impGoToStep(1);
  // Reset file input
  document.getElementById('impFileInput').value = '';
  clearBackupPreview();
  document.getElementById('mImport').classList.add('open');
  // Configurar drag & drop
  const drop = document.getElementById('impDrop');
  drop.ondragover = (e)=>{ e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = ()=>drop.classList.remove('over');
  drop.ondrop = (e)=>{
    e.preventDefault(); drop.classList.remove('over');
    if(e.dataTransfer.files.length) impHandleFile(e.dataTransfer.files[0]);
  };
  document.getElementById('impFileInput').onchange = (e)=>{
    if(e.target.files.length) impHandleFile(e.target.files[0]);
  };
}

function closeImport(){ document.getElementById('mImport').classList.remove('open'); }

function backupSectionCounts(data){
  const cats = data?.categorias || data?.cats || {};
  return {
    inventario: Array.isArray(data?.inventario) ? data.inventario.length : 0,
    aulas: Array.isArray(data?.aulas) ? data.aulas.length : 0,
    categorias: Array.isArray(cats) ? cats.length : Object.keys(cats || {}).length,
    ciclos: Array.isArray(data?.ciclos) ? data.ciclos.length : 0,
    profesores: Array.isArray(data?.profesores) ? data.profesores.length : 0
  };
}

function clearBackupPreview(){
  backupData = null;
  const box = document.getElementById('backupBox');
  if(box) box.style.display = 'none';
  const fileInput = document.getElementById('impFileInput');
  if(fileInput) fileInput.value = '';
}

function renderBackupPreview(data){
  backupData = data;
  const counts = backupSectionCounts(data);
  const exportedAt = data?.meta?.exportedAt ? new Date(data.meta.exportedAt).toLocaleString('es-ES') : 'fecha no disponible';
  document.getElementById('backupMeta').textContent = `Exportado: ${exportedAt}`;
  const labels = {
    inventario: 'Inventario',
    aulas: 'Aulas',
    categorias: 'Categorías',
    ciclos: 'Ciclos',
    profesores: 'Profesores'
  };
  document.getElementById('backupSections').innerHTML = Object.keys(labels).map(k => `
    <label class="backup-choice">
      <input type="checkbox" class="backup-check" value="${k}" ${counts[k] ? 'checked' : 'disabled'}>
      <span><strong>${labels[k]}</strong><small>${counts[k]} registro${counts[k]!==1?'s':''}</small></span>
    </label>
  `).join('');
  document.getElementById('backupBox').style.display = '';
}

function impHandleBackupFile(file){
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const data = JSON.parse(e.target.result);
      const counts = backupSectionCounts(data);
      if(!Object.values(counts).some(Boolean)){
        toast('El JSON no parece un backup válido','err');
        return;
      }
      impGoToStep(1);
      renderBackupPreview(data);
    }catch(err){
      toast('No se pudo leer el JSON','err');
    }
  };
  reader.onerror = ()=>toast('Error al leer el archivo','err');
  reader.readAsText(file, 'UTF-8');
}

async function restoreBackupJson(){
  if(!backupData){ toast('Carga primero un backup JSON','err'); return; }
  const sections = {};
  document.querySelectorAll('.backup-check:checked').forEach(el => sections[el.value] = true);
  if(!Object.keys(sections).length){ toast('Selecciona al menos una sección','err'); return; }
  const names = Object.keys(sections).join(', ');
  if(!await confirmDialog({message:`Se reemplazarán estas secciones: ${names}. ¿Continuar?`})) return;
  const btn = document.getElementById('backupRestoreBtn');
  btn.disabled = true;
  btn.textContent = 'Restaurando...';
  try{
    const res = await apiPost({action:'restoreBackup', sections, backup:backupData});
    if(!res.ok) throw new Error(res.error || 'Error al restaurar');
    toast('Backup restaurado','ok');
    closeImport();
    await loadData();
  }catch(err){
    toast(err.message || 'Error al restaurar backup','err');
  }finally{
    btn.disabled = false;
    btn.textContent = 'Restaurar selección';
  }
}

function impGoToStep(n){
  for(let i=1;i<=4;i++){
    document.getElementById('impStep'+i).classList.toggle('active', i===n);
    const dot = document.getElementById('sd'+i);
    dot.classList.remove('active','done');
    if(i<n) dot.classList.add('done');
    else if(i===n) dot.classList.add('active');
    if(i<4){
      const line = document.getElementById('sl'+i);
      line.classList.toggle('done', i<n);
    }
  }
  if(n===2) impRenderMapping();
  if(n===3) impRenderPreview();
}

// Parser CSV simple pero robusto (acepta comas dentro de comillas, escape "")
function parseCSV(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  // Quitar BOM si lo hay
  if(text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  for(let i=0; i<text.length; i++){
    const c = text[i], next = text[i+1];
    if(inQuotes){
      if(c === '"' && next === '"'){ field += '"'; i++; }
      else if(c === '"'){ inQuotes = false; }
      else field += c;
    } else {
      if(c === '"'){ inQuotes = true; }
      else if(c === ',' || c === ';'){ row.push(field); field = ''; }
      else if(c === '\n' || c === '\r'){
        if(field !== '' || row.length){ row.push(field); rows.push(row); }
        row = []; field = '';
        if(c === '\r' && next === '\n') i++;
      } else field += c;
    }
  }
  if(field !== '' || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c && String(c).trim() !== ''));
}

// Normalizar texto para matching (sin acentos, minúsculas, sin guiones bajos)
function normalize(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[\s_\-]+/g,'').trim();
}

function impHandleFile(file){
  const lower = file.name.toLowerCase();
  if(lower.endsWith('.json')){
    impHandleBackupFile(file);
    return;
  }
  if(!lower.endsWith('.csv')){
    toast('El archivo debe ser .csv o .json','err');
    return;
  }
  clearBackupPreview();
  const reader = new FileReader();
  reader.onload = (e)=>{
    // Detectar encoding: intentar UTF-8 estricto; si falla o hay caracteres de reemplazo, usar windows-1252
    let text;
    try {
      text = new TextDecoder('utf-8', {fatal:true}).decode(e.target.result);
    } catch {
      text = new TextDecoder('windows-1252').decode(e.target.result);
    }
    // Si UTF-8 fue válido pero tiene caracteres de reemplazo (U+FFFD), asumir windows-1252
    if(text.includes('�')){
      text = new TextDecoder('windows-1252').decode(e.target.result);
    }
    impData.rawText = text;
    const parsed = parseCSV(impData.rawText);
    if(parsed.length < 2){
      toast('El CSV no tiene datos suficientes (necesita cabecera + al menos 1 fila)','err');
      return;
    }
    impData.headers = parsed[0].map(h => String(h).trim());
    impData.rows = parsed.slice(1);

    // Auto-mapeo
    impData.mapping = {};
    IMP_FIELDS.forEach(f => {
      const idx = impData.headers.findIndex(h => {
        const nh = normalize(h);
        return nh === normalize(f.k) || f.synonyms.some(s => normalize(s) === nh);
      });
      if(idx >= 0) impData.mapping[f.k] = idx;
    });

    impGoToStep(2);
  };
  reader.onerror = ()=>toast('Error al leer el archivo','err');
  reader.readAsArrayBuffer(file);
}

function impRenderMapping(){
  const div = document.getElementById('impMapping');
  div.innerHTML = IMP_FIELDS.map(f => {
    const opts = '<option value="-1">— No importar —</option>' +
      impData.headers.map((h,i)=>`<option value="${i}" ${impData.mapping[f.k]===i?'selected':''}>${h}</option>`).join('');
    return `<div class="map-row">
      <div style="font-size:12px;font-weight:600">${f.label}${IMP_REQUIRED.includes(f.k)?' <span style="color:var(--red)">*</span>':''}</div>
      <div class="map-arrow">→</div>
      <select class="fi" onchange="impData.mapping['${f.k}']=parseInt(this.value);if(this.value==='-1')delete impData.mapping['${f.k}']">${opts}</select>
    </div>`;
  }).join('');
}

function impRenderPreview(){
  // Procesar filas validando
  impData.validRows = [];
  impData.invalidRows = [];

  // Map de aulas para detectar (por id, name o desc)
  const aulasMap = {};
  AULAS.forEach(a => {
    aulasMap[normalize(a.id)] = a.id;
    aulasMap[normalize(a.name)] = a.id;
  });
  // Asegurar que existe "departamento" como fallback
  let aulaDepartamento = AULAS.find(a =>
    normalize(a.id) === 'departamento' || normalize(a.name).includes('departamento')
  );
  const aulaFallback = aulaDepartamento ? aulaDepartamento.id : (AULAS[0]?.id || 'departamento');

  impData.rows.forEach((row, idx) => {
    const item = {};
    let valid = true;
    let errors = [];
    let aulaCambiada = false;

    IMP_FIELDS.forEach(f => {
      const colIdx = impData.mapping[f.k];
      if(colIdx == null || colIdx < 0) return;
      let val = String(row[colIdx]||'').trim();

      if(f.k === 'qty' || f.k === 'min'){
        const n = parseInt(val.replace(/[^\d-]/g,'')) || 0;
        item[f.k] = Math.max(0, n);
      } else if(f.k === 'aula'){
        if(!val){ item.aula = aulaFallback; aulaCambiada=true; }
        else {
          const found = aulasMap[normalize(val)];
          if(found) item.aula = found;
          else { item.aula = aulaFallback; aulaCambiada = true; }
        }
      } else if(f.k === 'est'){
        // Normalizar estado
        const nv = normalize(val);
        const match = ESTADOS_VALIDOS.find(e => normalize(e) === nv);
        item.est = match || (val ? 'Bueno' : '');
      } else if(f.k === 'mant'){
        const nv = normalize(val);
        item.mant = ['1','si','sí','s','true','x','ok','reparacion','reparación','mantenimiento','averia','avería'].some(v => normalize(v) === nv) ? '1' : '';
      } else if(f.k === 'mantEstado'){
        const nv = normalize(val);
        const estados = ['Pendiente','En reparación','Reparado','Resuelto'];
        item.mantEstado = estados.find(e => normalize(e) === nv) || (val || 'Pendiente');
      } else if(f.k === 'tipo_material'){
        const nv = normalize(val);
        item.tipo_material = nv.includes('invent') ? 'inventariable' : 'consumible';
      } else if(f.k === 'mantFecha'){
        if(/^\d{4}-\d{2}-\d{2}$/.test(val)) item.mantFecha = val;
        else if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)){
          const [d,m,y] = val.split('/');
          item.mantFecha = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        } else item.mantFecha = val;
      } else if(f.k === 'cat'){
        const nv = normalize(val);
        const match = CATEGORIAS_VALIDAS().find(c => normalize(c) === nv);
        item.cat = match || (val || 'Otros');
      } else if(f.k === 'fecha'){
        // Aceptar yyyy-mm-dd o dd/mm/yyyy
        if(/^\d{4}-\d{2}-\d{2}$/.test(val)) item.fecha = val;
        else if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)){
          const [d,m,y] = val.split('/');
          item.fecha = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        } else item.fecha = val;
      } else {
        item[f.k] = val;
      }
    });

    // Defaults
    if(!item.aula) { item.aula = aulaFallback; aulaCambiada = true; }
    if(item.qty == null) item.qty = 1;
    if(item.min == null) item.min = 0;
    if(!item.est) item.est = 'Bueno';
    if(!item.tipo_material) item.tipo_material = 'inventariable';
    if(!item.cat) item.cat = 'Otros';
    item.mod = item.mod || '';

    // Validación
    if(!item.item || !item.item.trim()){
      valid = false;
      errors.push('Sin nombre');
    }

    if(valid){
      impData.validRows.push({...item, _aulaCambiada:aulaCambiada, _rowNum:idx+2});
    } else {
      impData.invalidRows.push({...item, _row:row, _errors:errors, _rowNum:idx+2});
    }
  });

  // Stats
  const total = impData.rows.length;
  const validos = impData.validRows.length;
  const invalidos = impData.invalidRows.length;
  const aulasReasignadas = impData.validRows.filter(r=>r._aulaCambiada).length;

  document.getElementById('impSummary').innerHTML = `
    <div class="import-stat ok">
      <div class="import-stat-num">${validos}</div>
      <div class="import-stat-lbl">listos para importar</div>
    </div>
    <div class="import-stat ${aulasReasignadas?'warn':''}">
      <div class="import-stat-num">${aulasReasignadas}</div>
      <div class="import-stat-lbl">→ Departamento</div>
    </div>
    <div class="import-stat ${invalidos?'err':''}">
      <div class="import-stat-num">${invalidos}</div>
      <div class="import-stat-lbl">errores (se omiten)</div>
    </div>
  `;

  // Preview tabla (solo primeras 50)
  const showRows = [...impData.validRows.slice(0, 50), ...impData.invalidRows.slice(0, 10)];
  const cols = IMP_FIELDS.filter(f => impData.mapping[f.k] != null && impData.mapping[f.k] >= 0);
  const html = `<table>
    <thead><tr><th>#</th>${cols.map(c=>`<th>${c.label.replace(' *','')}</th>`).join('')}<th>Estado</th></tr></thead>
    <tbody>${showRows.map(r => {
      const isInvalid = r._errors;
      return `<tr class="${isInvalid?'bad':''}">
        <td style="font-family:var(--mono);color:var(--muted)">${r._rowNum}</td>
        ${cols.map(c=>{
          let v = r[c.k] != null ? String(r[c.k]) : '';
          if(c.k === 'aula'){ const a = AULAS.find(x=>x.id===v); v = a?a.name:v; if(r._aulaCambiada)v+=' ⚠'; }
          return `<td title="${v}">${v}</td>`;
        }).join('')}
        <td>${isInvalid?`<span style="color:var(--red);font-weight:700">${r._errors.join(', ')}</span>`:'<span style="color:var(--green)">✓</span>'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
  document.getElementById('impPreview').innerHTML = html;

  // Habilitar/deshabilitar botón
  const btn = document.getElementById('impConfirmBtn');
  btn.disabled = validos === 0;
  btn.textContent = validos === 0 ? 'Sin ítems válidos' : `📥 Importar ${validos} ítem${validos!==1?'s':''}`;
}

async function impDoImport(){
  impGoToStep(4);
  document.getElementById('impProgressWrap').style.display = 'block';
  document.getElementById('impResultWrap').style.display = 'none';

  const cleanItems = impData.validRows.map(r => {
    const {_aulaCambiada, _rowNum, ...item} = r;
    return item;
  });

  // Importación en lotes para no saturar Apps Script (max 200 por petición es seguro)
  const BATCH_SIZE = 100;
  const total = cleanItems.length;
  let done = 0;
  let added = 0;
  let errors = 0;

  const updateProgress = ()=>{
    const pct = total ? Math.round((done/total)*100) : 0;
    document.getElementById('impProgressBar').style.width = pct+'%';
    document.getElementById('impProgressText').textContent = `Importando... ${done}/${total} (${pct}%)`;
  };
  updateProgress();

  try {
    for(let i = 0; i < cleanItems.length; i += BATCH_SIZE){
      const batch = cleanItems.slice(i, i + BATCH_SIZE);
      const res = await apiPost({action:'bulkImport', items:batch});
      if(res.ok){
        added += res.imported || batch.length;
        // Añadir los items con su id real al estado local
        if(res.items) items.push(...res.items);
      } else {
        errors += batch.length;
        console.error('Error en lote:', res.error);
      }
      done += batch.length;
      updateProgress();
    }

    // Resultado
    document.getElementById('impProgressWrap').style.display = 'none';
    const resultWrap = document.getElementById('impResultWrap');
    resultWrap.style.display = 'block';

    if(errors === 0){
      document.getElementById('impResultIcon').textContent = '✅';
      document.getElementById('impResultTitle').textContent = '¡Importación completada!';
      document.getElementById('impResultMsg').innerHTML = `Se han añadido <strong>${added} ítem${added!==1?'s':''}</strong> al inventario.${impData.invalidRows.length?`<br>Se omitieron ${impData.invalidRows.length} fila(s) con errores.`:''}`;
    } else {
      document.getElementById('impResultIcon').textContent = '⚠️';
      document.getElementById('impResultTitle').textContent = 'Importación parcial';
      document.getElementById('impResultMsg').innerHTML = `Se añadieron <strong>${added}</strong> ítems, pero <strong>${errors}</strong> fallaron.<br>Comprueba la consola para más detalles.`;
    }

    // Refrescar vista
    if(cf) openSub(); else if(currentCiclo) openCiclo(currentCiclo.id); else renderHome();
    toast(`${added} ítem${added!==1?'s':''} importado${added!==1?'s':''}`,'ok');

  } catch(err){
    document.getElementById('impProgressWrap').style.display = 'none';
    const resultWrap = document.getElementById('impResultWrap');
    resultWrap.style.display = 'block';
    document.getElementById('impResultIcon').textContent = '❌';
    document.getElementById('impResultTitle').textContent = 'Error de importación';
    document.getElementById('impResultMsg').textContent = err.message || 'Error desconocido';
  }
}
