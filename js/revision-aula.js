let _revisionStream = null;
let _revisionCapturing = false;
let _revisionAulaId = '';
let _revisionConfirmados = [];

function openRevisionAula() {
  const targetAulaId = (cf && cf.type === 'aula') ? cf.id : '';
  if (!targetAulaId) {
    // Entrada directa desde Home sin aula de contexto — si el usuario solo
    // tiene un aula propia (autoservicio "📌 Mis Cursos/Aulas"), entra
    // directo a ella y ahorra el selector.
    if (Array.isArray(MIS_AULAS) && MIS_AULAS.length === 1) {
      _iniciarRevisionAula(MIS_AULAS[0]);
      return;
    }
    _abrirRevisionAulaConPicker();
    return;
  }
  _iniciarRevisionAula(targetAulaId);
}

// Sin aula ya elegida (entrada directa desde Home) — pide primero cuál,
// sin pedir permiso de cámara todavía.
function _abrirRevisionAulaConPicker() {
  const modal = document.getElementById('mRevisionAula');
  const picker = document.getElementById('revisionAulaPicker');
  const sel = document.getElementById('revisionAulaPickerSel');
  const titulo = document.getElementById('revisionTitulo');
  const contador = document.getElementById('revisionSesionContador');

  titulo.textContent = '📷 Revisar aula';
  contador.style.display = 'none';
  sel.innerHTML = typeof renderAulaOptions === 'function' ? renderAulaOptions() : '';
  picker.style.display = 'block';
  document.getElementById('revisionVideo').style.display = 'none';
  document.getElementById('revisionEstado').style.display = 'none';
  document.getElementById('revisionResultado').style.display = 'none';
  document.getElementById('revisionCapturarBtn').style.display = 'none';
  document.getElementById('revisionResumenBtn').style.display = 'none';
  modal.classList.add('open');
}

function _confirmarAulaRevision() {
  const sel = document.getElementById('revisionAulaPickerSel');
  if (!sel.value) return;
  document.getElementById('revisionAulaPicker').style.display = 'none';
  _iniciarRevisionAula(sel.value);
}

function _actualizarContadorRevision() {
  const contador = document.getElementById('revisionSesionContador');
  if (!contador) return;
  if (!_revisionConfirmados.length) { contador.style.display = 'none'; return; }
  contador.textContent = `Confirmados hasta ahora: ${_revisionConfirmados.length}`;
  contador.style.display = 'block';
}

function _iniciarRevisionAula(aulaId) {
  _revisionAulaId = aulaId;
  _revisionConfirmados = [];

  const modal = document.getElementById('mRevisionAula');
  const video = document.getElementById('revisionVideo');
  const estado = document.getElementById('revisionEstado');
  const resultado = document.getElementById('revisionResultado');
  const capturarBtn = document.getElementById('revisionCapturarBtn');
  const resumenBtn = document.getElementById('revisionResumenBtn');
  const titulo = document.getElementById('revisionTitulo');

  const aulaNombre = (AULAS.find(a => a.id === _revisionAulaId) || {}).name || _revisionAulaId;
  titulo.textContent = `📷 Revisando: ${aulaNombre}`;
  _actualizarContadorRevision();

  modal.classList.add('open');
  document.getElementById('revisionAulaPicker').style.display = 'none';
  estado.style.display = 'none';
  resultado.style.display = 'none';
  resultado.innerHTML = '';
  capturarBtn.style.display = 'none';
  resumenBtn.style.display = 'inline-flex';
  _revisionCapturing = false;

  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Este navegador no permite acceder a la cámara', 'err');
    closeRevisionAula();
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      _revisionStream = stream;
      video.srcObject = stream;
      video.style.display = 'block';
      capturarBtn.style.display = 'inline-flex';
      video.onloadedmetadata = () => video.play();
    })
    .catch(err => {
      let msg = 'Error al acceder a la cámara: ' + err.message;
      if (err.name === 'NotAllowedError') msg = 'Acceso denegado a la cámara. Verifica los permisos.';
      else if (err.name === 'NotFoundError') msg = 'No se encontró cámara en tu dispositivo.';
      toast(msg, 'err');
      closeRevisionAula();
    });
}

function closeRevisionAula() {
  if (_revisionStream) {
    _revisionStream.getTracks().forEach(t => t.stop());
    _revisionStream = null;
  }
  const video = document.getElementById('revisionVideo');
  if (video) video.srcObject = null;
  const picker = document.getElementById('revisionAulaPicker');
  if (picker) picker.style.display = 'none';
  document.getElementById('mRevisionAula').classList.remove('open');
}

async function capturarRevision() {
  if (_revisionCapturing) return;
  _revisionCapturing = true;
  const video = document.getElementById('revisionVideo');
  const estado = document.getElementById('revisionEstado');
  const resultado = document.getElementById('revisionResultado');
  const capturarBtn = document.getElementById('revisionCapturarBtn');

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
  const imagenBase64 = dataUrl.split(',')[1];

  video.style.display = 'none';
  capturarBtn.style.display = 'none';
  estado.style.display = 'block';
  estado.textContent = 'Identificando equipo...';
  resultado.style.display = 'none';

  try {
    const res = await apiPost({ action: 'buscarPorSerie', imagen: imagenBase64 });
    estado.style.display = 'none';
    if (!res.ok) {
      _mostrarRevisionError(res.error || 'No se pudo identificar el equipo, inténtalo de nuevo');
      return;
    }
    if (res.match === 'exacto' || (res.match === 'fuzzy' && res.candidatos && res.candidatos.length === 1)) {
      const item = res.match === 'exacto' ? res.item : res.candidatos[0];
      _mostrarRevisionResultado(item);
      return;
    }
    if (res.match === 'fuzzy') {
      _mostrarRevisionFuzzy(res.candidatos);
      return;
    }
    _mostrarRevisionNoIdentificado();
  } catch (e) {
    estado.style.display = 'none';
    _mostrarRevisionError('No se pudo identificar el equipo, inténtalo de nuevo');
  } finally {
    _revisionCapturing = false;
  }
}

function _mostrarRevisionResultado(item) {
  if (typeof items !== 'undefined' && Array.isArray(items) && !items.some(x => String(x.id) === String(item.id))) {
    items.push(item);
  }
  const resultado = document.getElementById('revisionResultado');
  resultado.style.display = 'block';
  if (String(item.aula) === String(_revisionAulaId)) {
    if (!_revisionConfirmados.some(x => String(x.id) === String(item.id))) {
      _revisionConfirmados.push(item);
      _actualizarContadorRevision();
    }
    resultado.innerHTML = `
      <div style="padding:12px;border:1px solid var(--green);background:var(--green-l);border-radius:8px;margin-bottom:12px">
        <div style="font-weight:600;color:var(--green)">✓ ${escHtml(item.item)} confirmado</div>
      </div>
      <button class="btn btn-p" onclick="revisionSiguiente()">Siguiente</button>`;
    return;
  }
  const aulaReal = (AULAS.find(a => a.id === item.aula) || {}).name || item.aula || 'Sin aula';
  resultado.innerHTML = `
    <div style="padding:12px;border:1px solid var(--amber);background:var(--amber-l);border-radius:8px;margin-bottom:12px">
      <div style="font-weight:600;color:var(--amber)">⚠ ${escHtml(item.item)}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">Este ítem figura en ${escHtml(aulaReal)}</div>
    </div>
    <button class="btn btn-p" onclick='_corregirAulaRevision(${JSON.stringify(item.id)})'>Actualizar a esta aula</button>
    <button class="btn" onclick="revisionSiguiente()" style="margin-top:8px">Siguiente (sin corregir)</button>`;
}

function _mostrarRevisionFuzzy(candidatos) {
  const resultado = document.getElementById('revisionResultado');
  resultado.style.display = 'block';
  const filas = candidatos.map(c => {
    const aulaNombre = (AULAS.find(a => a.id === c.aula) || {}).name || c.aula || 'Sin aula';
    return `<div class="serie-candidato" onclick='_mostrarRevisionResultado(${JSON.stringify(c)})' style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer">
      <div style="font-weight:600">${escHtml(c.item)}</div>
      <div style="font-size:12px;color:var(--muted)">${escHtml(aulaNombre)}</div>
    </div>`;
  }).join('');
  resultado.innerHTML = `<div style="margin-bottom:8px">¿Es alguno de estos?</div>${filas}<button class="btn" onclick="revisionSiguiente()">Ninguno, siguiente</button>`;
}

function _mostrarRevisionNoIdentificado() {
  const resultado = document.getElementById('revisionResultado');
  resultado.style.display = 'block';
  resultado.innerHTML = `
    <div style="margin-bottom:12px;color:var(--muted)">No identificado, prueba otra foto.</div>
    <button class="btn btn-p" onclick="revisionSiguiente()">Siguiente</button>`;
}

function _mostrarRevisionError(msg) {
  const resultado = document.getElementById('revisionResultado');
  resultado.style.display = 'block';
  resultado.innerHTML = `
    <div style="color:var(--red);margin-bottom:12px">${escHtml(msg)}</div>
    <button class="btn" onclick="revisionSiguiente()">Reintentar</button>`;
}

async function _corregirAulaRevision(itemId) {
  const item = items.find(x => String(x.id) === String(itemId));
  if (!item) {
    toast('No se encontró el ítem para actualizar', 'err');
    return;
  }
  const updated = { ...item, aula: _revisionAulaId };
  try {
    const res = await apiPost({ action: 'update', item: updated });
    if (!res.ok) throw new Error(res.error || 'Error al actualizar');
    const idx = items.findIndex(x => String(x.id) === String(itemId));
    if (idx >= 0) items[idx] = updated;
    if (!_revisionConfirmados.some(x => String(x.id) === String(updated.id))) {
      _revisionConfirmados.push(updated);
      _actualizarContadorRevision();
    }
    toast('Aula actualizada', 'ok');
    revisionSiguiente();
  } catch (e) {
    toast('No se pudo actualizar el aula: ' + (e.message || ''), 'err');
  }
}

function revisionSiguiente() {
  const estado = document.getElementById('revisionEstado');
  const resultado = document.getElementById('revisionResultado');
  const video = document.getElementById('revisionVideo');
  const capturarBtn = document.getElementById('revisionCapturarBtn');
  resultado.style.display = 'none';
  resultado.innerHTML = '';
  estado.style.display = 'none';
  video.style.display = 'block';
  capturarBtn.style.display = 'inline-flex';
}

function terminarRevisionAula() {
  const esperados = items.filter(x => String(x.aula) === String(_revisionAulaId));
  const confirmadosIds = new Set(_revisionConfirmados.map(x => String(x.id)));
  const noVerificados = esperados.filter(x => !confirmadosIds.has(String(x.id)));

  closeRevisionAula();

  const aulaNombre = (AULAS.find(a => a.id === _revisionAulaId) || {}).name || _revisionAulaId;
  const listaConfirmados = _revisionConfirmados.length
    ? _revisionConfirmados.map(x => x.item).join(', ')
    : 'ninguno';
  let message = `Confirmados (${_revisionConfirmados.length}): ${listaConfirmados}.`;
  if (noVerificados.length) {
    const listaNoVerificados = noVerificados.map(x => x.item).join(', ');
    message += ` No verificados (${noVerificados.length}): ${listaNoVerificados}. "No verificado" no significa ausente — puede que no se haya fotografiado durante esta revisión.`;
  }

  confirmDialog({
    title: `📋 Resumen de revisión: ${aulaNombre}`,
    message,
    confirmText: 'Cerrar'
  }).catch(() => {});
}
