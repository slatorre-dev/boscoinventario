let _qrStream = null;
let _qrScanning = false;
let _qrProcessingFrame = false;
let _qrDetectedItemId = null;

function openQrScanner() {
  const modal = document.getElementById('mQrScanner');
  const content = document.getElementById('qrScannerContent');
  const error = document.getElementById('qrError');
  const result = document.getElementById('qrResult');
  const actions = document.getElementById('qrActions');
  const video = document.getElementById('qrVideo');

  modal.classList.add('open');
  content.style.display = 'block';
  error.style.display = 'none';
  if(actions) actions.style.display = 'none';
  _qrDetectedItemId = null;
  result.textContent = 'Apunta la cámara a un código QR...';
  result.style.color = 'var(--muted)';
  _qrScanning = true;

  if(!navigator.mediaDevices?.getUserMedia){
    _qrScanning = false;
    error.style.display = 'block';
    content.style.display = 'none';
    error.textContent = 'Este navegador no permite acceder a la cámara desde aquí.';
    return;
  }

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false
  }).then(stream => {
    _qrStream = stream;
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play();
      _startQrProcessing(video);
    };
  }).catch(err => {
    _qrScanning = false;
    error.style.display = 'block';
    content.style.display = 'none';
    if (err.name === 'NotAllowedError') {
      error.textContent = 'Acceso denegado a la cámara. Por favor, verifica los permisos.';
    } else if (err.name === 'NotFoundError') {
      error.textContent = 'No se encontró cámara en tu dispositivo.';
    } else {
      error.textContent = 'Error al acceder a la cámara: ' + err.message;
    }
  });
}

function closeQrScanner() {
  _qrScanning = false;
  _stopQrStream();
  document.getElementById('mQrScanner').classList.remove('open');
}

function _stopQrStream() {
  if (_qrStream) {
    _qrStream.getTracks().forEach(track => track.stop());
    _qrStream = null;
  }
  const video = document.getElementById('qrVideo');
  if(video) video.srcObject = null;
}

function qrResumeScan() {
  closeQrScanner();
  setTimeout(openQrScanner, 120);
}

function _showQrActions(itemId) {
  const normQrText = v => (typeof normalizeStr === 'function'
    ? normalizeStr(v)
    : String(v || '').toLowerCase()).replace(/[^a-z0-9]/g, '');
  const norm = normQrText(itemId);
  const item = items.find(x =>
    String(x.id) === String(itemId) ||
    (typeof itemCode === 'function' && normQrText(itemCode(x)) === norm) ||
    normQrText(x.ref || '') === norm
  );
  const content = document.getElementById('qrScannerContent');
  const actions = document.getElementById('qrActions');
  const result = document.getElementById('qrResult');
  if(!item){
    result.textContent = 'QR detectado, pero el ítem no existe en los datos cargados.';
    result.style.color = 'var(--red)';
    return;
  }

  _qrDetectedItemId = item.id;
  content.style.display = 'none';
  actions.style.display = 'block';
  document.getElementById('qrActionsTitle').textContent = `${item.ref ? item.ref + ' · ' : ''}${item.item}`;
  const aula = AULAS.find(a => a.id === item.aula)?.name || item.aula || 'Sin aula';
  const mod = findModulo(item.mod);
  document.getElementById('qrActionsMeta').textContent = `${aula}${mod ? ' · ' + mod.name : ''} · Stock ${item.qty}`;
  document.getElementById('qrActionsPhoto').innerHTML = item.foto ? `<img src="${item.foto}" alt="">` : '📦';

  const loan = document.getElementById('qrActLoan');
  if(loan) {
    const activeLoans = (typeof prestamos !== 'undefined' && Array.isArray(prestamos) ? prestamos : []).some(p =>
      Number(p.itemId) === Number(item.id) &&
      (p.estado === 'Activo' || p.estado === 'Parcial')
    );
    loan.disabled = false;
    loan.title = Number(item.qty) <= 0 && activeLoans
      ? 'Sin stock para nuevo préstamo; puedes registrar devoluciones'
      : '';
  }
  const maint = document.getElementById('qrActMaint');
  if(maint) maint.disabled = !can('items.write');
  const del = document.getElementById('qrActDelete');
  if(del) del.disabled = !can('items.write') && !can('items.delete');
}

function _showQrActionsStandalone(itemId) {
  const modal = document.getElementById('mQrScanner');
  modal.classList.add('open');
  document.getElementById('qrScannerContent').style.display = 'none';
  document.getElementById('qrError').style.display = 'none';
  _showQrActions(itemId);
}

function qrQuickAction(action) {
  const id = _qrDetectedItemId;
  if(!id) return;
  if(action === 'open'){
    closeQrScanner();
    openItemRoute(id);
    return;
  }
  if(action === 'loan'){
    closeQrScanner();
    setTimeout(() => {
      if(typeof openPresDevModal === 'function'){
        openPresDevModal(id);
      } else {
        toast('No se pudo abrir préstamo/devolución', 'err');
      }
    }, 80);
    return;
  }
  if(action === 'docs'){
    closeQrScanner();
    openDocsModal(id);
    return;
  }
  if(action === 'delete'){
    closeQrScanner();
    openDelModal(id);
    return;
  }
  if(action === 'maintenance'){
    if(!can('items.write')){ toast('No tienes permisos para editar mantenimiento','err'); return; }
    closeQrScanner();
    openItemRoute(id);
    setTimeout(() => { if(typeof _enfocarMantenimientoEnModal === 'function') _enfocarMantenimientoEnModal(); }, 50);
  }
}

function _startQrProcessing(video) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  function processFrame() {
    if (!_qrScanning) return;

    if (_qrProcessingFrame) {
      requestAnimationFrame(processFrame);
      return;
    }

    _qrProcessingFrame = true;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    if (typeof jsQR === 'undefined') {
      _qrProcessingFrame = false;
      requestAnimationFrame(processFrame);
      return;
    }

    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });

    if (code) {
      const itemMatch = code.data.match(/item\/([a-zA-Z0-9_-]+)/);
      if (itemMatch) {
        const itemId = itemMatch[1];
        _qrScanning = false;
        document.getElementById('qrResult').textContent = 'QR detectado: ' + itemId;
        document.getElementById('qrResult').style.color = 'var(--green)';
        _stopQrStream();
        _showQrActions(itemId);
        _qrProcessingFrame = false;
        return;
      }
    }

    _qrProcessingFrame = false;
    requestAnimationFrame(processFrame);
  }

  processFrame();
}
