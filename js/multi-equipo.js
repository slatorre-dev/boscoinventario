let _multiStream = null;
let _multiCapturing = false;
let _multiSubmitting = false;
let _multiAulaId = '';
let _multiObjetos = [];
let _multiTotalSesion = 0;

// Sesión pendiente de confirmar en localStorage — un único slot ("la última
// sesión sin terminar"), no una por aula. Si se abre otra aula distinta con
// un borrador pendiente de una tercera, ese borrador antiguo queda huérfano
// y se sobreescribe sin avisar (caso raro, no justifica más complejidad).
const MULTI_DRAFT_KEY = 'multi_equipo_draft_v1';

function openMultiEquipo() {
  const targetAulaId = (cf && cf.type === 'aula') ? cf.id : '';
  if (!targetAulaId) {
    // Entrada directa desde Home sin aula de contexto — si el usuario solo
    // tiene un aula propia (autoservicio "📌 Mis Cursos/Aulas"), entra
    // directo a ella y ahorra el selector.
    if (Array.isArray(MIS_AULAS) && MIS_AULAS.length === 1) {
      _iniciarMultiEquipo(MIS_AULAS[0]);
      return;
    }
    _abrirMultiEquipoConPicker();
    return;
  }
  _iniciarMultiEquipo(targetAulaId);
}

// Sin aula ya elegida (entrada directa desde Home) — pide primero cuál,
// sin pedir permiso de cámara todavía.
function _abrirMultiEquipoConPicker() {
  const modal = document.getElementById('mMultiEquipo');
  const picker = document.getElementById('multiAulaPicker');
  const sel = document.getElementById('multiAulaPickerSel');
  const contador = document.getElementById('multiSesionContador');

  contador.style.display = 'none';
  sel.innerHTML = typeof renderAulaOptions === 'function' ? renderAulaOptions() : '';
  picker.style.display = 'block';
  document.getElementById('multiVideo').style.display = 'none';
  document.getElementById('multiEstado').style.display = 'none';
  document.getElementById('multiListaWrap').style.display = 'none';
  document.getElementById('multiCapturarBtn').style.display = 'none';
  document.getElementById('multiCrearBtn').style.display = 'none';
  modal.classList.add('open');
}

function _confirmarAulaMulti() {
  const sel = document.getElementById('multiAulaPickerSel');
  if (!sel.value) return;
  document.getElementById('multiAulaPicker').style.display = 'none';
  _iniciarMultiEquipo(sel.value);
}

function _actualizarContadorMulti() {
  const contador = document.getElementById('multiSesionContador');
  if (!contador) return;
  if (!_multiTotalSesion) { contador.style.display = 'none'; return; }
  contador.textContent = `Añadidos en esta sesión: ${_multiTotalSesion}`;
  contador.style.display = 'block';
}

async function _iniciarMultiEquipo(aulaId) {
  _multiAulaId = aulaId;
  _multiObjetos = [];
  _multiTotalSesion = 0;

  const modal = document.getElementById('mMultiEquipo');
  const video = document.getElementById('multiVideo');
  const estado = document.getElementById('multiEstado');
  const listaWrap = document.getElementById('multiListaWrap');
  const capturarBtn = document.getElementById('multiCapturarBtn');
  const crearBtn = document.getElementById('multiCrearBtn');
  const cicloSel = document.getElementById('multiCicloSel');

  // Corta cualquier cámara de una sesión anterior (p. ej. reabrir para otra
  // aula sin cerrar antes) y oculta el vídeo — si no, un <video> visible de
  // la sesión previa puede quedar tapando el diálogo de restaurar borrador
  // de más abajo, aunque el modal de confirmación tenga más z-index.
  if (_multiStream) {
    _multiStream.getTracks().forEach(t => t.stop());
    _multiStream = null;
  }
  video.srcObject = null;
  video.style.display = 'none';

  modal.classList.add('open');
  document.getElementById('multiAulaPicker').style.display = 'none';
  _actualizarContadorMulti();
  estado.style.display = 'none';
  listaWrap.style.display = 'none';
  document.getElementById('multiListaBody').innerHTML = '';
  if (cicloSel) cicloSel.innerHTML = '<option value="">Sin asignar</option>';
  capturarBtn.style.display = 'none';
  crearBtn.style.display = 'none';
  _multiCapturing = false;
  _multiSubmitting = false;

  const draft = _leerBorradorMulti();
  if (draft && String(draft.aulaId) === String(aulaId) && draft.objetos?.length) {
    const continuar = await confirmDialog({
      icon: '📝',
      title: 'Alta masiva sin terminar',
      message: `Tenías ${draft.objetos.length} ítem${draft.objetos.length !== 1 ? 's' : ''} detectado${draft.objetos.length !== 1 ? 's' : ''} sin confirmar en esta aula. ¿Continuar revisándolos?`,
      confirmText: 'Continuar'
    }).catch(() => false);
    if (continuar) {
      _multiObjetos = draft.objetos;
      _poblarSelectorCicloMulti();
      if (draft.mod && cicloSel) cicloSel.value = draft.mod;
      _renderMultiLista();
      return; // ya hay objetos que revisar, no hace falta abrir la cámara todavía
    }
    _borrarBorradorMulti();
  }

  _abrirCamaraMulti();
}

function _abrirCamaraMulti() {
  const video = document.getElementById('multiVideo');
  const capturarBtn = document.getElementById('multiCapturarBtn');

  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Este navegador no permite acceder a la cámara', 'err');
    closeMultiEquipo();
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      _multiStream = stream;
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
      closeMultiEquipo();
    });
}

function closeMultiEquipo() {
  if (_multiStream) {
    _multiStream.getTracks().forEach(t => t.stop());
    _multiStream = null;
  }
  const video = document.getElementById('multiVideo');
  if (video) video.srcObject = null;
  const picker = document.getElementById('multiAulaPicker');
  if (picker) picker.style.display = 'none';
  document.getElementById('mMultiEquipo').classList.remove('open');
  // El borrador NO se borra al cerrar — si hay objetos sin confirmar,
  // deben seguir ahí para ofrecer continuar en la próxima sesión (ver
  // _iniciarMultiEquipo). Solo se borra al crear con éxito o al declinar
  // explícitamente la restauración.
}

async function capturarMulti() {
  if (_multiCapturing) return;
  _multiCapturing = true;
  const video = document.getElementById('multiVideo');
  const estado = document.getElementById('multiEstado');
  const capturarBtn = document.getElementById('multiCapturarBtn');
  const listaWrap = document.getElementById('multiListaWrap');

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
  const imagenBase64 = dataUrl.split(',')[1];

  video.style.display = 'none';
  capturarBtn.style.display = 'none';
  estado.style.display = 'block';
  estado.textContent = 'Identificando equipos...';
  listaWrap.style.display = 'none';

  try {
    const res = await apiPost({ action: 'detectarMultiples', imagen: imagenBase64 });
    estado.style.display = 'none';
    if (!res.ok) {
      toast(res.error || 'No se pudo analizar la foto, inténtalo de nuevo', 'err');
      _volverACapturarMulti();
      return;
    }
    if (!res.objetos || !res.objetos.length) {
      toast(res.motivoEncuadre || 'No se detectó ningún equipo, prueba otra foto o mejora la luz/encuadre', 'err');
      _volverACapturarMulti();
      return;
    }
    if (res.motivoEncuadre) toast(res.motivoEncuadre, 'warn');
    _multiObjetos = res.objetos.map((o, i) => ({ _rowId: i, nombre: o.nombre, cantidad: o.cantidad, categoriaSugerida: o.categoriaSugerida || '', confianza: Number(o.confianza) || 0 }));
    _poblarSelectorCicloMulti();
    _renderMultiLista();
  } catch (e) {
    estado.style.display = 'none';
    toast('No se pudo analizar la foto, inténtalo de nuevo', 'err');
    _volverACapturarMulti();
  } finally {
    _multiCapturing = false;
  }
}

function _volverACapturarMulti() {
  const video = document.getElementById('multiVideo');
  const capturarBtn = document.getElementById('multiCapturarBtn');
  video.style.display = 'block';
  capturarBtn.style.display = 'inline-flex';
}

function _poblarSelectorCicloMulti() {
  const cicloSel = document.getElementById('multiCicloSel');
  if (!cicloSel) return;

  const ownCiclos = (typeof CICLOS !== 'undefined' ? CICLOS : []).filter(c => c.id !== 'iesjuanbosco');

  const opciones = ['<option value="">Sin asignar</option>'];
  ownCiclos.forEach(c => {
    (c.modulos || []).forEach(m => {
      opciones.push(`<option value="${escHtml(c.id)}__${escHtml(m.cod)}">${escHtml(c.name)} — ${escHtml(m.name)}</option>`);
    });
  });
  cicloSel.innerHTML = opciones.join('');

  const preseleccion = (ownCiclos.length === 1 && (ownCiclos[0].modulos || []).length === 1)
    ? `${ownCiclos[0].id}__${ownCiclos[0].modulos[0].cod}`
    : '';
  cicloSel.value = preseleccion;
}

function _renderMultiLista() {
  const listaWrap = document.getElementById('multiListaWrap');
  const body = document.getElementById('multiListaBody');
  const crearBtn = document.getElementById('multiCrearBtn');
  const capturarBtn = document.getElementById('multiCapturarBtn');

  const catNames = typeof CATS !== 'undefined' ? Object.keys(CATS) : [];

  body.innerHTML = _multiObjetos.map(o => {
    const catOpts = ['<option value="">Sin categoría</option>']
      .concat(catNames.map(c => `<option value="${escHtml(c)}"${c === o.categoriaSugerida ? ' selected' : ''}>${escHtml(c)}</option>`))
      .join('');
    const dudosa = (o.confianza || 0) < 0.45;
    const rowAttrs = dudosa ? ' style="background:var(--amber-l)" title="Detección poco fiable, revisa esta fila"' : '';
    const marca = dudosa ? '⚠️ ' : '';
    return `
    <tr data-row-id="${o._rowId}"${rowAttrs}>
      <td style="padding:4px">${marca}<input type="text" class="fi-w" value="${escHtml(o.nombre)}" oninput="_multiActualizarFila(${o._rowId},'nombre',this.value)" style="width:100%"></td>
      <td style="padding:4px"><input type="number" class="fi-w" min="1" value="${Number(o.cantidad) || 1}" oninput="_multiActualizarFila(${o._rowId},'cantidad',this.value)" style="width:100%"></td>
      <td style="padding:4px"><select class="fi-w" onchange="_multiActualizarFila(${o._rowId},'categoriaSugerida',this.value)" style="width:100%">${catOpts}</select></td>
      <td style="padding:4px;text-align:center"><button class="btn-icon-only" onclick="_multiEliminarFila(${o._rowId})" title="Eliminar fila" style="cursor:pointer;border:none;background:none;font-size:16px">🗑️</button></td>
    </tr>`;
  }).join('');

  listaWrap.style.display = 'block';
  capturarBtn.style.display = 'none';
  crearBtn.style.display = _multiObjetos.length ? 'inline-flex' : 'none';
  crearBtn.textContent = `Crear ${_multiObjetos.length} ítem${_multiObjetos.length !== 1 ? 's' : ''}`;
  _guardarBorradorMulti();
}

function _multiActualizarFila(rowId, campo, valor) {
  const row = _multiObjetos.find(o => o._rowId === rowId);
  if (!row) return;
  row[campo] = campo === 'cantidad' ? (parseInt(valor, 10) || 1) : valor;
  _guardarBorradorMulti();
}

function _multiEliminarFila(rowId) {
  _multiObjetos = _multiObjetos.filter(o => o._rowId !== rowId);
  _renderMultiLista();
}

function _leerBorradorMulti() {
  try {
    const raw = localStorage.getItem(MULTI_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function _guardarBorradorMulti() {
  try {
    if (!_multiObjetos.length) { localStorage.removeItem(MULTI_DRAFT_KEY); return; }
    const mod = document.getElementById('multiCicloSel')?.value || '';
    localStorage.setItem(MULTI_DRAFT_KEY, JSON.stringify({ aulaId: _multiAulaId, objetos: _multiObjetos, mod, ts: Date.now() }));
  } catch (e) {
    // localStorage no disponible: no bloquea la sesión
  }
}

function _borrarBorradorMulti() {
  try { localStorage.removeItem(MULTI_DRAFT_KEY); } catch (e) { /* ignore */ }
}

// Tras crear con éxito: limpia la lista y vuelve directo a capturar la
// siguiente mesa sin cerrar el modal ni tener que volver a pulsar
// "Añadir varios" desde cero (modo continuo, igual que "Revisar aula").
function _volverACapturarMultiTrasCrear() {
  document.getElementById('multiListaWrap').style.display = 'none';
  document.getElementById('multiListaBody').innerHTML = '';
  document.getElementById('multiCrearBtn').style.display = 'none';
  _multiObjetos = [];
  _borrarBorradorMulti();
  if (_multiStream) {
    document.getElementById('multiVideo').style.display = 'block';
    document.getElementById('multiCapturarBtn').style.display = 'inline-flex';
  } else {
    _abrirCamaraMulti();
  }
}

async function confirmarCrearMulti() {
  if (_multiSubmitting) return;
  if (!_multiObjetos.length) return;
  if (typeof can === 'function' && !can('import.write')) {
    toast('No tienes permiso para crear varios ítems a la vez', 'err');
    return;
  }
  _multiSubmitting = true;
  try {
    const ok = await confirmDialog({
      title: 'Crear ítems',
      message: `Se crearán ${_multiObjetos.length} ítem${_multiObjetos.length !== 1 ? 's' : ''} nuevo${_multiObjetos.length !== 1 ? 's' : ''} en esta aula. ¿Continuar?`,
      confirmText: 'Crear'
    }).catch(() => false);
    if (!ok) return;

    const modSeleccionado = document.getElementById('multiCicloSel').value;
    const payload = _multiObjetos.map(o => ({
      ref: '', aula: _multiAulaId, mod: modSeleccionado, item: o.nombre, qty: o.cantidad, min: 1,
      cat: o.categoriaSugerida || '', loc: '', est: 'Bueno', util: '', proveedor: '', tags: '',
      fecha: new Date().toISOString().slice(0, 10), fecha_adquisicion: '', precio: null,
      mant: '', mantFecha: '', mantNota: '', mantResp: '', mantEstado: '', mantSolicitante: '', mantSolicitanteEmail: '',
      foto: '', obs: '', code: '', serie: '', es_contenedor: 0, parent_id: null, tipo_material: 'inventariable', oculto: 0
    }));

    const res = await apiPost({ action: 'bulkImport', items: payload });
    if (!res.ok) throw new Error(res.error || 'Error al crear los ítems');
    if (res.items) items.push(...res.items);
    _multiObjetos.forEach(o => {
      apiPost({
        action: 'registrarFeedbackDeteccion',
        tipo: 'alta_multi',
        nombre: o.nombre,
        categoria: o.categoriaSugerida || '',
        confianza: o.confianza || 0
      }).catch(() => {});
    });
    _multiTotalSesion += (res.imported || _multiObjetos.length);
    _actualizarContadorMulti();
    toast(`${res.imported} ítem${res.imported !== 1 ? 's' : ''} creado${res.imported !== 1 ? 's' : ''}`, 'ok');
    if (typeof renderInv === 'function') renderInv();

    const nuevos = res.items || [];
    if (nuevos.length && typeof printBulkItemQrs === 'function') {
      const imprimir = await confirmDialog({
        icon: '🖨️',
        title: 'Imprimir etiquetas QR',
        message: `¿Imprimir ahora las etiquetas QR de est${nuevos.length !== 1 ? 'os' : 'e'} ${nuevos.length} ítem${nuevos.length !== 1 ? 's' : ''} recién creado${nuevos.length !== 1 ? 's' : ''}?`,
        confirmText: 'Imprimir'
      }).catch(() => false);
      if (imprimir) printBulkItemQrs(nuevos);
    }

    _volverACapturarMultiTrasCrear();
  } catch (e) {
    toast('No se pudieron crear los ítems: ' + (e.message || ''), 'err');
  } finally {
    _multiSubmitting = false;
  }
}
