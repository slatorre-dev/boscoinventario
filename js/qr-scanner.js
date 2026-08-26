let _qrStream = null;
let _qrScanning = false;
let _qrProcessingFrame = false;
let _qrDetectedItemId = null;
let _qrQuickProfesorPropio = null;
let _qrQuickPrestamoDevolver = null;

function openQrScanner() {
  const modal = document.getElementById('mQrScanner');
  const content = document.getElementById('qrScannerContent');
  const error = document.getElementById('qrError');
  const result = document.getElementById('qrResult');
  const actions = document.getElementById('qrActions');
  const video = document.getElementById('qrVideo');
  const titleEl = document.getElementById('qrModalTitle');
  if(titleEl) titleEl.textContent = '🔍 Escanear QR';

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
  _renderQrQuickActions(item);
  const maint = document.getElementById('qrActMaint');
  if(maint) maint.disabled = !can('items.write');
  const del = document.getElementById('qrActDelete');
  if(del) del.disabled = !can('items.write') && !can('items.delete');
}

// tituloModal: texto del encabezado del panel — permite distinguir de dónde
// vino el ítem (QR, código de barras, número de serie, foto/IA) reutilizando
// siempre el mismo panel de acciones (incluidas Devolver/Me lo llevo).
function _showQrActionsStandalone(itemId, tituloModal) {
  const modal = document.getElementById('mQrScanner');
  modal.classList.add('open');
  document.getElementById('qrScannerContent').style.display = 'none';
  document.getElementById('qrError').style.display = 'none';
  const titleEl = document.getElementById('qrModalTitle');
  if(titleEl) titleEl.textContent = tituloModal || '🔍 Escanear QR';
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

// ─── PRÉSTAMO/DEVOLUCIÓN RÁPIDOS (pensado para docentes) ──
// Tras detectar el ítem: si el docente actual ya tiene un préstamo activo
// de ese material, "Devolver" es la acción principal; si hay stock, "Me lo
// llevo" presta 1 unidad a su nombre usando su aula habitual (si solo
// tiene una elegida en 📌 Mis Cursos/Aulas). El flujo completo
// "Prestar / Devolver" (qrActLoan) sigue disponible como alternativa.
function _renderQrQuickActions(item){
  const wrap = document.getElementById('qrQuickActions');
  const btnDev = document.getElementById('qrQuickDevolver');
  const btnPres = document.getElementById('qrQuickPrestar');
  _qrQuickProfesorPropio = null;
  _qrQuickPrestamoDevolver = null;
  if(!wrap || !btnDev || !btnPres) return;

  const puedePrestar = typeof can === 'function' && can('loans.write');
  if(puedePrestar && typeof loanTeacherOptions === 'function'){
    const misOpciones = loanTeacherOptions();
    _qrQuickProfesorPropio = misOpciones.find(p => p.nombre.toLowerCase().trim() === (SESSION?.nombre||'').toLowerCase().trim()) || null;
  }

  if(puedePrestar && _qrQuickProfesorPropio && Array.isArray(prestamos)){
    _qrQuickPrestamoDevolver = prestamos.find(p =>
      Number(p.itemId) === Number(item.id) &&
      (p.estado === 'Activo' || p.estado === 'Parcial') &&
      String(p.profesorId) === String(_qrQuickProfesorPropio.id)
    ) || null;
  }

  btnDev.style.display = _qrQuickPrestamoDevolver ? 'flex' : 'none';
  btnPres.style.display = (puedePrestar && _qrQuickProfesorPropio && Number(item.qty) > 0) ? 'flex' : 'none';
  wrap.style.display = (btnDev.style.display === 'flex' || btnPres.style.display === 'flex') ? 'flex' : 'none';
}

async function qrQuickDevolver(){
  if(!requirePerm('loans.write')) return;
  const pres = _qrQuickPrestamoDevolver;
  if(!pres) return;
  const pendiente = Number(pres.cantidad) - Number(pres.cantidadDevuelta||0);
  if(!await confirmDialog({message:`¿Devolver ${pendiente} unidad${pendiente!==1?'es':''} de "${pres.itemNombre}"?`, confirmText:'Devolver'})) return;
  try {
    const res = await apiPost({action:'devolver', presId:pres.id, cantidadDevuelta:pendiente});
    if(!res.ok) throw new Error(res.error);
    const idx = prestamos.findIndex(x => Number(x.id) === Number(pres.id));
    if(idx>=0) prestamos[idx] = res.prestamo;
    if(res.nuevoQty !== null && res.nuevoQty !== undefined){
      const itemIdx = items.findIndex(x => Number(x.id) === Number(res.prestamo.itemId));
      if(itemIdx>=0) items[itemIdx].qty = res.nuevoQty;
    }
    toast('Devolución registrada','ok');
    qrResumeScan();
  } catch(err){ toast('Error: '+err.message,'err'); }
}

async function qrQuickPrestar(){
  if(!requirePerm('loans.write')) return;
  const item = items.find(x => Number(x.id) === Number(_qrDetectedItemId));
  const prof = _qrQuickProfesorPropio;
  if(!item || !prof) return;
  if(Number(item.qty) <= 0){ toast('Sin stock disponible','err'); return; }

  const aulaHabitual = (Array.isArray(MIS_AULAS) && MIS_AULAS.length === 1) ? MIS_AULAS[0] : '';
  const aulaTxt = aulaHabitual ? (AULAS.find(a=>a.id===aulaHabitual)?.name || aulaHabitual) : '';
  if(!await confirmDialog({message:`¿Prestarte 1 × "${item.item}"${aulaTxt?` para ${aulaTxt}`:''}?`, confirmText:'Me lo llevo'})) return;

  const f = new Date(); f.setDate(f.getDate()+7);
  const modInfo = findModulo(item.mod);
  const pres = {
    itemId: item.id, itemNombre: item.item, cantidad: 1, aulaOrigen: item.aula,
    aulaDestino: aulaHabitual, profesorId: prof.id, profesorNombre: prof.nombre,
    fechaPrevista: f.toISOString().split('T')[0], obs: '',
    moduloCod: modInfo ? item.mod : '', moduloNombre: modInfo ? modInfo.name : '',
  };
  try {
    const res = await apiPost({action:'prestar', prestamo:pres});
    if(!res.ok) throw new Error(res.error);
    prestamos.push(res.prestamo);
    const i = items.findIndex(x => Number(x.id) === Number(item.id));
    if(i>=0) items[i].qty = Number(items[i].qty) - 1;
    toast(`Préstamo registrado: 1 × ${item.item}`,'ok');
    qrResumeScan();
  } catch(err){ toast('Error: '+err.message,'err'); }
}
