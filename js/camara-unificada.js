let _camUnifStream = null;
let _camUnifScanning = false;
let _camUnifUsarJsQR = false;
let _camUnifNoDetectadoTimer = null;

function openCamaraUnificada() {
  const modal = document.getElementById('mCamaraUnificada');
  const video = document.getElementById('camaraUnifVideo');
  const estado = document.getElementById('camaraUnifEstado');
  const resultado = document.getElementById('camaraUnifResultado');
  const btnIA = document.getElementById('camaraUnifBtnIA');

  modal.classList.add('open');
  estado.style.display = 'block';
  estado.textContent = 'Buscando QR o código...';
  resultado.style.display = 'none';
  resultado.innerHTML = '';
  btnIA.style.display = 'none';
  _camUnifScanning = true;

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
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
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
    if (!itemMatch) return false;
    _camUnifScanning = false;
    if (_camUnifNoDetectadoTimer) { clearTimeout(_camUnifNoDetectadoTimer); _camUnifNoDetectadoTimer = null; }
    document.getElementById('camaraUnifEstado').textContent = 'QR detectado: ' + itemMatch[1];
    if (_camUnifStream) { _camUnifStream.getTracks().forEach(t => t.stop()); _camUnifStream = null; }
    _mostrarAccionesQrEnModalUnificado(itemMatch[1]);
    return true;
  }

  _camUnifScanning = false;
  if (_camUnifNoDetectadoTimer) { clearTimeout(_camUnifNoDetectadoTimer); _camUnifNoDetectadoTimer = null; }
  document.getElementById('camaraUnifEstado').textContent = 'Comprobando código...';
  try {
    const res = await apiPost({ action: 'buscarSeriePorCodigo', codigo: valor });
    if (res.ok && (res.match === 'exacto' || res.match === 'fuzzy')) {
      if (res.match === 'exacto') {
        closeCamaraUnificada();
        if (typeof items !== 'undefined' && Array.isArray(items) && !items.some(x => x.id === res.item.id)) {
          items.push(res.item);
        }
        openItemRoute(res.item.id);
        return true;
      }
      document.getElementById('camaraUnifEstado').style.display = 'none';
      const resultado = document.getElementById('camaraUnifResultado');
      resultado.style.display = 'block';
      const filas = res.candidatos.map(c => {
        const aula = (typeof AULAS !== 'undefined' ? AULAS.find(a => a.id === c.aula) : null);
        const aulaNombre = aula ? aula.name : (c.aula || 'Sin aula');
        return `<div class="serie-candidato" onclick="closeCamaraUnificada();openItemRoute(${c.id})" style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer">
          <div style="font-weight:600">${escHtml(c.item)}</div>
          <div style="font-size:12px;color:var(--muted)">${escHtml(aulaNombre)} · S/N: ${escHtml(c.serie)}</div>
        </div>`;
      }).join('');
      resultado.innerHTML = `<div style="margin-bottom:8px">No hay coincidencia exacta, ¿es alguno de estos?</div>${filas}`;
      return true;
    }
  } catch (e) { /* fallo de red al comprobar el código: se sigue escaneando */ }

  _camUnifScanning = true;
  document.getElementById('camaraUnifEstado').textContent = 'Buscando QR o código...';
  return false;
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
  setTimeout(() => {
    if (typeof capturarSerie === 'function') capturarSerie();
  }, 400);
}
