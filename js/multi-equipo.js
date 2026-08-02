let _multiStream = null;
let _multiCapturing = false;
let _multiSubmitting = false;
let _multiAulaId = '';
let _multiObjetos = [];

function openMultiEquipo() {
  if (!cf || cf.type !== 'aula') {
    toast('Abre primero la vista de un aula para añadir varios equipos', 'err');
    return;
  }
  _multiAulaId = cf.id;
  _multiObjetos = [];

  const modal = document.getElementById('mMultiEquipo');
  const video = document.getElementById('multiVideo');
  const estado = document.getElementById('multiEstado');
  const listaWrap = document.getElementById('multiListaWrap');
  const capturarBtn = document.getElementById('multiCapturarBtn');
  const crearBtn = document.getElementById('multiCrearBtn');
  const cicloSel = document.getElementById('multiCicloSel');

  modal.classList.add('open');
  estado.style.display = 'none';
  listaWrap.style.display = 'none';
  document.getElementById('multiListaBody').innerHTML = '';
  if (cicloSel) cicloSel.innerHTML = '<option value="">Sin asignar</option>';
  capturarBtn.style.display = 'none';
  crearBtn.style.display = 'none';
  _multiCapturing = false;
  _multiSubmitting = false;

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
  document.getElementById('mMultiEquipo').classList.remove('open');
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
      toast('No se detectó ningún equipo, prueba otra foto o mejora la luz/encuadre', 'err');
      _volverACapturarMulti();
      return;
    }
    _multiObjetos = res.objetos.map((o, i) => ({ _rowId: i, nombre: o.nombre, cantidad: o.cantidad, categoriaSugerida: o.categoriaSugerida || '' }));
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
    return `
    <tr data-row-id="${o._rowId}">
      <td style="padding:4px"><input type="text" class="fi-w" value="${escHtml(o.nombre)}" oninput="_multiActualizarFila(${o._rowId},'nombre',this.value)" style="width:100%"></td>
      <td style="padding:4px"><input type="number" class="fi-w" min="1" value="${Number(o.cantidad) || 1}" oninput="_multiActualizarFila(${o._rowId},'cantidad',this.value)" style="width:100%"></td>
      <td style="padding:4px"><select class="fi-w" onchange="_multiActualizarFila(${o._rowId},'categoriaSugerida',this.value)" style="width:100%">${catOpts}</select></td>
      <td style="padding:4px;text-align:center"><button class="btn-icon-only" onclick="_multiEliminarFila(${o._rowId})" title="Eliminar fila" style="cursor:pointer;border:none;background:none;font-size:16px">🗑️</button></td>
    </tr>`;
  }).join('');

  listaWrap.style.display = 'block';
  capturarBtn.style.display = 'none';
  crearBtn.style.display = _multiObjetos.length ? 'inline-flex' : 'none';
  crearBtn.textContent = `Crear ${_multiObjetos.length} ítem${_multiObjetos.length !== 1 ? 's' : ''}`;
}

function _multiActualizarFila(rowId, campo, valor) {
  const row = _multiObjetos.find(o => o._rowId === rowId);
  if (!row) return;
  row[campo] = campo === 'cantidad' ? (parseInt(valor, 10) || 1) : valor;
}

function _multiEliminarFila(rowId) {
  _multiObjetos = _multiObjetos.filter(o => o._rowId !== rowId);
  _renderMultiLista();
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
    toast(`${res.imported} ítem${res.imported !== 1 ? 's' : ''} creado${res.imported !== 1 ? 's' : ''}`, 'ok');
    closeMultiEquipo();
    if (typeof renderInv === 'function') renderInv();
  } catch (e) {
    toast('No se pudieron crear los ítems: ' + (e.message || ''), 'err');
  } finally {
    _multiSubmitting = false;
  }
}
