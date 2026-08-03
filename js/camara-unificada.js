let _camUnifStream = null;
let _camUnifScanning = false;
let _camUnifUsarJsQR = false;
let _camUnifNoDetectadoTimer = null;
let _camUnifUltimoCodigoFallido = null;
let _camUnifUltimoFallidoTimestamp = 0;
let _camUnifUltimoQrNoInventarioTs = 0;
let _camUnifCandidatosPorId = {};
let _camUnifCodigoPendienteAlta = '';
let _camUnifProductoPendienteAlta = null;
let _camUnifTrack = null;
let _camUnifTorchOn = false;

const CAM_PREF_QUICK = 'camara_quick_mode_v1';
const CAM_PREF_ACCESS = 'camara_access_mode_v1';
const CAM_PREF_LAST_AULA = 'cam_last_aula';
const CAM_PREF_LAST_CAT = 'cam_last_cat';

function _camPrefBoolGet(key, fallback = false) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === '1';
  } catch (e) {
    return fallback;
  }
}

function _camPrefBoolSet(key, value) {
  try { localStorage.setItem(key, value ? '1' : '0'); } catch (e) { /* ignore */ }
}

function _camUnifQuickMode() {
  const chk = document.getElementById('camUnifQuickMode');
  return !!(chk ? chk.checked : _camPrefBoolGet(CAM_PREF_QUICK, false));
}

function _camUnifApplyAccessMode(enabled) {
  const modal = document.getElementById('mCamaraUnificada');
  modal?.classList.toggle('camera-accessible', !!enabled);
}

function _camUnifPulseDetected() {
  const video = document.getElementById('camaraUnifVideo');
  if (!video) return;
  video.classList.add('camera-detected');
  setTimeout(() => video.classList.remove('camera-detected'), 220);
  if (navigator.vibrate) navigator.vibrate(70);
}

async function _setupCamaraUnifTorch() {
  const btn = document.getElementById('camaraUnifFlashBtn');
  if (!btn || !_camUnifTrack) return;
  _camUnifTorchOn = false;
  btn.textContent = '💡 Linterna';
  try {
    const caps = _camUnifTrack.getCapabilities ? _camUnifTrack.getCapabilities() : {};
    btn.style.display = caps.torch ? 'inline-flex' : 'none';
  } catch (e) {
    btn.style.display = 'none';
  }
}

async function toggleCamaraUnifFlash() {
  if (!_camUnifTrack) return;
  try {
    const caps = _camUnifTrack.getCapabilities ? _camUnifTrack.getCapabilities() : {};
    if (!caps.torch) return;
    _camUnifTorchOn = !_camUnifTorchOn;
    await _camUnifTrack.applyConstraints({ advanced: [{ torch: _camUnifTorchOn }] });
    const btn = document.getElementById('camaraUnifFlashBtn');
    if (btn) btn.textContent = _camUnifTorchOn ? '💡 Linterna encendida' : '💡 Linterna';
  } catch (e) {
    toast('No se pudo activar la linterna en este dispositivo', 'err');
  }
}

function openCamaraUnificada() {
  if (typeof cerrarHintCamara === 'function') cerrarHintCamara();
  const modal = document.getElementById('mCamaraUnificada');
  const video = document.getElementById('camaraUnifVideo');
  const estado = document.getElementById('camaraUnifEstado');
  const resultado = document.getElementById('camaraUnifResultado');
  const btnIA = document.getElementById('camaraUnifBtnIA');
  const chkQuick = document.getElementById('camUnifQuickMode');
  const chkAccess = document.getElementById('camUnifAccessibleMode');

  modal.classList.add('open');
  estado.style.display = 'block';
  estado.textContent = 'Buscando QR o código... Si no existe, podrás añadirlo.';
  resultado.style.display = 'none';
  resultado.innerHTML = '';
  btnIA.style.display = 'none';
  _camUnifScanning = true;
  _camUnifCandidatosPorId = {};
  _camUnifCodigoPendienteAlta = '';
  _camUnifProductoPendienteAlta = null;

  if (chkQuick) {
    chkQuick.checked = _camPrefBoolGet(CAM_PREF_QUICK, false);
    chkQuick.onchange = () => _camPrefBoolSet(CAM_PREF_QUICK, chkQuick.checked);
  }
  if (chkAccess) {
    chkAccess.checked = _camPrefBoolGet(CAM_PREF_ACCESS, false);
    _camUnifApplyAccessMode(chkAccess.checked);
    chkAccess.onchange = () => {
      _camPrefBoolSet(CAM_PREF_ACCESS, chkAccess.checked);
      _camUnifApplyAccessMode(chkAccess.checked);
    };
  }

  _camUnifUsarJsQR = true;
  if (typeof BarcodeDetector !== 'undefined' && BarcodeDetector.getSupportedFormats) {
    BarcodeDetector.getSupportedFormats().then(formatos => {
      _camUnifUsarJsQR = !formatos.includes('qr_code');
    }).catch(() => { _camUnifUsarJsQR = true; });
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Este navegador no permite acceder a la cámara', 'err');
    closeCamaraUnificada();
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      _camUnifStream = stream;
      _camUnifTrack = stream.getVideoTracks?.()[0] || null;
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        _setupCamaraUnifTorch();
        _camUnifNoDetectadoTimer = setTimeout(() => {
          if (_camUnifScanning) document.getElementById('camaraUnifBtnIA').style.display = 'inline-flex';
        }, 3000);
        _iniciarEscaneoUnificado(video);
      };
    })
    .catch(err => {
      let msg = 'Error al acceder a la cámara: ' + err.message;
      if (err.name === 'NotAllowedError') msg = 'Acceso denegado a la cámara. Verifica los permisos.';
      else if (err.name === 'NotFoundError') msg = 'No se encontró cámara en tu dispositivo.';
      toast(msg, 'err');
      closeCamaraUnificada();
    });
}

function closeCamaraUnificada() {
  _camUnifScanning = false;
  if (_camUnifNoDetectadoTimer) { clearTimeout(_camUnifNoDetectadoTimer); _camUnifNoDetectadoTimer = null; }
  _camUnifTrack = null;
  _camUnifTorchOn = false;
  if (_camUnifStream) {
    _camUnifStream.getTracks().forEach(t => t.stop());
    _camUnifStream = null;
  }
  const video = document.getElementById('camaraUnifVideo');
  if (video) video.srcObject = null;
  document.getElementById('mCamaraUnificada').classList.remove('open');
}

function _iniciarEscaneoUnificado(video) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  let procesandoFrame = false;
  let detector = null;
  if (typeof BarcodeDetector !== 'undefined') {
    try {
      detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    } catch (e) { detector = null; }
  }

  async function procesarFrame() {
    if (!_camUnifScanning) return;
    if (procesandoFrame) { requestAnimationFrame(procesarFrame); return; }
    procesandoFrame = true;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    let manejado = false;

    if (detector) {
      try {
        const codigos = await detector.detect(canvas);
        if (codigos.length) {
          manejado = await _manejarDeteccionUnificada(codigos[0].rawValue, codigos[0].format);
        }
      } catch (e) { /* formato puntual no soportado, sigue con jsQR si aplica */ }
    }

    if (!manejado && _camUnifUsarJsQR && typeof jsQR !== 'undefined') {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
      if (code) {
        manejado = await _manejarDeteccionUnificada(code.data, 'qr_code');
      }
    }

    procesandoFrame = false;
    if (!manejado && _camUnifScanning) requestAnimationFrame(procesarFrame);
  }

  procesarFrame();
}

async function _manejarDeteccionUnificada(valor, formato) {
  if (formato === 'qr_code') {
    const itemMatch = valor.match(/item\/([a-zA-Z0-9_-]+)/);
    if (!itemMatch) {
      if ((Date.now() - _camUnifUltimoQrNoInventarioTs) > 2000) {
        _camUnifUltimoQrNoInventarioTs = Date.now();
        toast('QR detectado, pero no es un QR de inventario válido', 'warn');
      }
      return false;
    }
    _camUnifScanning = false;
    _camUnifPulseDetected();
    if (_camUnifNoDetectadoTimer) { clearTimeout(_camUnifNoDetectadoTimer); _camUnifNoDetectadoTimer = null; }
    document.getElementById('camaraUnifEstado').textContent = 'QR detectado: ' + itemMatch[1];
    if (_camUnifStream) { _camUnifStream.getTracks().forEach(t => t.stop()); _camUnifStream = null; }
    _mostrarAccionesQrEnModalUnificado(itemMatch[1]);
    return true;
  }

  _camUnifScanning = false;
  if (_camUnifNoDetectadoTimer) { clearTimeout(_camUnifNoDetectadoTimer); _camUnifNoDetectadoTimer = null; }

  if (valor === _camUnifUltimoCodigoFallido && (Date.now() - _camUnifUltimoFallidoTimestamp) < 2000) {
    _camUnifScanning = true;
    document.getElementById('camaraUnifEstado').textContent = 'Buscando QR o código... Si no existe, podrás añadirlo.';
    return false;
  }

  document.getElementById('camaraUnifEstado').textContent = 'Comprobando código...';
  try {
    _camUnifCodigoPendienteAlta = String(valor || '').trim();
    const res = await apiPost({ action: 'buscarSeriePorCodigo', codigo: valor, formato });
    if (!res.ok) {
      throw new Error(res.error || 'No se pudo comprobar el código');
    }
    if (res.ok && (res.match === 'exacto' || res.match === 'fuzzy')) {
      if (res.match === 'exacto') {
        _camUnifPulseDetected();
        window._camaraReturnToScanner = _camUnifQuickMode();
        document.getElementById('camaraUnifEstado').textContent = 'Código encontrado. Abriendo ficha...';
        closeCamaraUnificada();
        if (typeof items !== 'undefined' && Array.isArray(items) && !items.some(x => x.id === res.item.id)) {
          items.push(res.item);
        }
        openItemRoute(res.item.id);
        return true;
      }
      document.getElementById('camaraUnifEstado').style.display = 'none';
      const video = document.getElementById('camaraUnifVideo');
      if (video) video.style.display = 'none';
      const resultado = document.getElementById('camaraUnifResultado');
      resultado.style.display = 'block';
      _camUnifCandidatosPorId = {};
      const filas = res.candidatos.map(c => {
        _camUnifCandidatosPorId[String(c.id)] = c.serie || '';
        const aula = (typeof AULAS !== 'undefined' ? AULAS.find(a => a.id === c.aula) : null);
        const aulaNombre = aula ? aula.name : (c.aula || 'Sin aula');
        return `<div class="serie-candidato" onclick="camaraUnifAbrirCandidato(${c.id})" style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer">
          <div style="font-weight:600">${escHtml(c.item)}</div>
          <div style="font-size:12px;color:var(--muted)">${escHtml(aulaNombre)} · S/N: ${escHtml(c.serie)}</div>
        </div>`;
      }).join('');
      resultado.innerHTML = `<div style="margin-bottom:8px">No hay coincidencia exacta, ¿es alguno de estos?</div>${filas}
      <button class="btn btn-p" onclick="camaraUnifCrearItemDesdeCodigo()">➕ Añadir ítem nuevo con este código</button>
      <button class="btn" onclick="camaraUnifReintentar()" style="margin-top:8px">Reintentar</button>`;
      return true;
    }

    _camUnifProductoPendienteAlta = res.producto || null;
    document.getElementById('camaraUnifEstado').style.display = 'none';
    document.getElementById('camaraUnifResultado').style.display = 'block';
    document.getElementById('camaraUnifResultado').innerHTML = '<div style="margin-bottom:8px">No se encontró ningún ítem para ese código.</div><button class="btn btn-p" onclick="camaraUnifCrearItemDesdeCodigo()">➕ Añadir ítem nuevo con este código</button><button class="btn" onclick="camaraUnifReintentar()" style="margin-top:8px">Reintentar</button>';
    return true;
  } catch (e) {
    _camUnifUltimoCodigoFallido = valor;
    _camUnifUltimoFallidoTimestamp = Date.now();
    toast('No se pudo comprobar el código, revisa tu conexión', 'err');
  }

  _camUnifScanning = true;
  document.getElementById('camaraUnifEstado').textContent = 'Buscando QR o código... Si no existe, podrás añadirlo.';
  return false;
}

function camaraUnifReintentar() {
  if (_camUnifStream) { _camUnifStream.getTracks().forEach(t => t.stop()); _camUnifStream = null; }
  closeCamaraUnificada();
  setTimeout(openCamaraUnificada, 120);
}

function camaraUnifCrearItemDesdeCodigo() {
  const codigo = String(_camUnifCodigoPendienteAlta || '').trim();
  const producto = _camUnifProductoPendienteAlta;
  window._camaraReturnToScanner = _camUnifQuickMode();
  closeCamaraUnificada();
  openModal();
  setTimeout(() => {
    const serieInput = document.getElementById('f_serie');
    if (serieInput && codigo) serieInput.value = codigo;
    const aulaPref = localStorage.getItem(CAM_PREF_LAST_AULA) || '';
    const catPref = localStorage.getItem(CAM_PREF_LAST_CAT) || '';
    const aulaSel = document.getElementById('f_aula');
    if (aulaSel && aulaPref && [...aulaSel.options].some(o => o.value === aulaPref)) aulaSel.value = aulaPref;
    const catSel = document.getElementById('f_cat');
    if (catSel && catPref && [...catSel.options].some(o => o.value === catPref)) {
      catSel.value = catPref;
      catSel.dataset.prev = catPref;
    }
    const itemInput = document.getElementById('f_item');
    if (itemInput) {
      if (producto?.nombre) itemInput.value = producto.nombre;
      itemInput.focus();
    }
    if (producto?.marca) {
      const provInput = document.getElementById('f_proveedor');
      if (provInput) provInput.value = producto.marca;
    }
  }, 50);
}

async function camaraUnifAbrirCandidato(id) {
  window._camaraReturnToScanner = _camUnifQuickMode();
  closeCamaraUnificada();
  openItemRoute(id);
  if (typeof items !== 'undefined' && Array.isArray(items) && items.some(x => Number(x.id) === Number(id))) return;

  const serie = _camUnifCandidatosPorId[String(id)] || '';
  if (!serie) return;
  try {
    const res = await apiPost({ action: 'buscarSeriePorCodigo', codigo: serie });
    if (res.ok && res.match === 'exacto' && res.item) {
      if (!items.some(x => Number(x.id) === Number(res.item.id))) items.push(res.item);
      openItemRoute(res.item.id);
    }
  } catch (e) {
    // Si falla, dejamos el comportamiento por defecto (openItemRoute ya lanzó toast).
  }
}

function _mostrarAccionesQrEnModalUnificado(itemId) {
  closeCamaraUnificada();
  if (typeof _showQrActionsStandalone === 'function') {
    _showQrActionsStandalone(itemId);
  } else {
    openItemRoute(itemId);
  }
}

function camaraUnifPasarAIA() {
  const video = document.getElementById('camaraUnifVideo');
  if (!video || !video.videoWidth) {
    toast('La cámara aún no está lista, espera un momento', 'err');
    return;
  }
  _camUnifScanning = false;
  if (_camUnifNoDetectadoTimer) { clearTimeout(_camUnifNoDetectadoTimer); _camUnifNoDetectadoTimer = null; }
  if (_camUnifStream) { _camUnifStream.getTracks().forEach(t => t.stop()); _camUnifStream = null; }
  video.srcObject = null;
  closeCamaraUnificada();
  openCamaraSerie();
  const serieVideo = document.getElementById('serieVideo');
  const onReady = () => {
    serieVideo.removeEventListener('loadedmetadata', onReady);
    if (typeof capturarSerie === 'function') capturarSerie();
  };
  serieVideo.addEventListener('loadedmetadata', onReady);
}
