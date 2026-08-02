let _serieStream = null;
let _serieCapturing = false;
let _serieLeidaPendiente = '';
let _marcaPendiente = '';
let _modeloPendiente = '';
let _nombreSugeridoPendiente = '';
let _categoriaSugeridaPendiente = '';
let _serieCandidatosPorId = {};
let _serieTrack = null;
let _serieTorchOn = false;

const SERIE_PREF_QUICK = 'camara_quick_mode_v1';
const SERIE_PREF_ACCESS = 'camara_access_mode_v1';
const SERIE_PREF_LAST_AULA = 'cam_last_aula';
const SERIE_PREF_LAST_CAT = 'cam_last_cat';

function _seriePrefBoolGet(key, fallback = false) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === '1';
  } catch (e) {
    return fallback;
  }
}

function _seriePrefBoolSet(key, value) {
  try { localStorage.setItem(key, value ? '1' : '0'); } catch (e) { /* ignore */ }
}

function _serieQuickMode() {
  const chk = document.getElementById('serieQuickMode');
  return !!(chk ? chk.checked : _seriePrefBoolGet(SERIE_PREF_QUICK, false));
}

function _serieApplyAccessMode(enabled) {
  const modal = document.getElementById('mCamaraSerie');
  modal?.classList.toggle('camera-accessible', !!enabled);
}

function _seriePulseDetected() {
  const video = document.getElementById('serieVideo');
  if (!video) return;
  video.classList.add('camera-detected');
  setTimeout(() => video.classList.remove('camera-detected'), 220);
  if (navigator.vibrate) navigator.vibrate(70);
}

function _renderConfianzaBadge(conf) {
  const c = Math.max(0, Math.min(1, Number(conf || 0)));
  if (!c) return '';
  if (c >= 0.75) return `<div class="ai-confidence high">✅ Confianza alta (${Math.round(c * 100)}%)</div>`;
  if (c >= 0.5) return `<div class="ai-confidence mid">⚠️ Confianza media (${Math.round(c * 100)}%)</div>`;
  return `<div class="ai-confidence low">🛑 Confianza baja (${Math.round(c * 100)}%)</div>`;
}

function _mostrarExactoConConfirmacion(item, confianza) {
  const resultado = document.getElementById('serieResultado');
  const aula = (typeof AULAS !== 'undefined' ? AULAS.find(a => a.id === item.aula) : null);
  const aulaNombre = aula ? aula.name : (item.aula || 'Sin aula');
  resultado.style.display = 'block';
  resultado.innerHTML = `${_renderConfianzaBadge(confianza)}
    <div style="margin-bottom:10px">He encontrado una coincidencia, pero con baja confianza. ¿Quieres abrir esta ficha?</div>
    <div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:10px">
      <div style="font-weight:700">${escHtml(item.item || '')}</div>
      <div style="font-size:12px;color:var(--muted)">${escHtml(aulaNombre)}${item.serie ? ' · S/N: ' + escHtml(item.serie) : ''}</div>
    </div>
    <button class="btn btn-p" onclick="_abrirExactoSerieConfirmado(${Number(item.id)})">Abrir ficha sugerida</button>
    <button class="btn" onclick="serieReintentar()" style="margin-top:8px">Reintentar captura</button>`;
}

function _abrirExactoSerieConfirmado(id) {
  window._camaraReturnToScanner = _serieQuickMode();
  closeCamaraSerie();
  openItemRoute(id);
}

function _frameSharpnessScore(imageData) {
  const d = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  let score = 0;
  // Muestreo escalonado para no bloquear en móviles.
  for (let y = 2; y < h - 2; y += 3) {
    for (let x = 2; x < w - 2; x += 3) {
      const i = (y * w + x) * 4;
      const ir = d[i], ig = d[i + 1], ib = d[i + 2];
      const l = (ir * 299 + ig * 587 + ib * 114) / 1000;

      const i2 = (y * w + (x + 1)) * 4;
      const r2 = d[i2], g2 = d[i2 + 1], b2 = d[i2 + 2];
      const l2 = (r2 * 299 + g2 * 587 + b2 * 114) / 1000;

      const i3 = ((y + 1) * w + x) * 4;
      const r3 = d[i3], g3 = d[i3 + 1], b3 = d[i3 + 2];
      const l3 = (r3 * 299 + g3 * 587 + b3 * 114) / 1000;

      score += Math.abs(l - l2) + Math.abs(l - l3);
    }
  }
  return score;
}

async function _captureBestFrameBase64(video) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  let best = { score: -1, dataUrl: '' };
  // 3 intentos rápidos para elegir el frame más nítido.
  for (let i = 0; i < 3; i++) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const score = _frameSharpnessScore(img);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.62);
    if (score > best.score) best = { score, dataUrl };
    await new Promise(r => requestAnimationFrame(r));
  }

  if (!best.dataUrl) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    best.dataUrl = canvas.toDataURL('image/jpeg', 0.62);
  }
  return best.dataUrl.split(',')[1];
}

async function _setupSerieTorch() {
  const btn = document.getElementById('serieFlashBtn');
  if (!btn || !_serieTrack) return;
  _serieTorchOn = false;
  btn.textContent = '💡 Linterna';
  try {
    const caps = _serieTrack.getCapabilities ? _serieTrack.getCapabilities() : {};
    btn.style.display = caps.torch ? 'inline-flex' : 'none';
  } catch (e) {
    btn.style.display = 'none';
  }
}

async function toggleSerieFlash() {
  if (!_serieTrack) return;
  try {
    const caps = _serieTrack.getCapabilities ? _serieTrack.getCapabilities() : {};
    if (!caps.torch) return;
    _serieTorchOn = !_serieTorchOn;
    await _serieTrack.applyConstraints({ advanced: [{ torch: _serieTorchOn }] });
    const btn = document.getElementById('serieFlashBtn');
    if (btn) btn.textContent = _serieTorchOn ? '💡 Linterna encendida' : '💡 Linterna';
  } catch (e) {
    toast('No se pudo activar la linterna en este dispositivo', 'err');
  }
}

function openCamaraSerie() {
  const modal = document.getElementById('mCamaraSerie');
  const video = document.getElementById('serieVideo');
  const estado = document.getElementById('serieEstado');
  const resultado = document.getElementById('serieResultado');
  const capturarBtn = document.getElementById('serieCapturarBtn');
  const chkQuick = document.getElementById('serieQuickMode');
  const chkAccess = document.getElementById('serieAccessibleMode');

  modal.classList.add('open');
  estado.style.display = 'none';
  resultado.style.display = 'none';
  resultado.innerHTML = '';
  capturarBtn.style.display = 'none';
  _serieCapturing = false;
  _serieLeidaPendiente = '';
  _marcaPendiente = '';
  _modeloPendiente = '';
  _nombreSugeridoPendiente = '';
  _categoriaSugeridaPendiente = '';
  _serieCandidatosPorId = {};

  if (chkQuick) {
    chkQuick.checked = _seriePrefBoolGet(SERIE_PREF_QUICK, false);
    chkQuick.onchange = () => _seriePrefBoolSet(SERIE_PREF_QUICK, chkQuick.checked);
  }
  if (chkAccess) {
    chkAccess.checked = _seriePrefBoolGet(SERIE_PREF_ACCESS, false);
    _serieApplyAccessMode(chkAccess.checked);
    chkAccess.onchange = () => {
      _seriePrefBoolSet(SERIE_PREF_ACCESS, chkAccess.checked);
      _serieApplyAccessMode(chkAccess.checked);
    };
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Este navegador no permite acceder a la cámara', 'err');
    closeCamaraSerie();
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      _serieStream = stream;
      _serieTrack = stream.getVideoTracks?.()[0] || null;
      video.srcObject = stream;
      video.style.display = 'block';
      capturarBtn.style.display = 'inline-flex';
      video.onloadedmetadata = () => {
        video.play();
        _setupSerieTorch();
      };
    })
    .catch(err => {
      let msg = 'Error al acceder a la cámara: ' + err.message;
      if (err.name === 'NotAllowedError') msg = 'Acceso denegado a la cámara. Verifica los permisos.';
      else if (err.name === 'NotFoundError') msg = 'No se encontró cámara en tu dispositivo.';
      toast(msg, 'err');
      closeCamaraSerie();
    });
}

function closeCamaraSerie() {
  _serieTrack = null;
  _serieTorchOn = false;
  if (_serieStream) {
    _serieStream.getTracks().forEach(t => t.stop());
    _serieStream = null;
  }
  const video = document.getElementById('serieVideo');
  if (video) video.srcObject = null;
  document.getElementById('mCamaraSerie').classList.remove('open');
}

async function capturarSerie() {
  if (_serieCapturing) return;
  _serieCapturing = true;
  const video = document.getElementById('serieVideo');
  const estado = document.getElementById('serieEstado');
  const resultado = document.getElementById('serieResultado');
  const capturarBtn = document.getElementById('serieCapturarBtn');

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

  try {
    if (window.BarcodeDetector) {
      let codigos = [];
      try {
        const detector = new BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        codigos = await detector.detect(canvas);
      } catch (e) {
        // Falla silenciosa: solo cubre new BarcodeDetector()/detect() —
        // ej. formato no soportado por este navegador concreto. Se sigue
        // con el flujo normal de IA sin interrumpir al usuario.
      }
      if (codigos.length) {
        const resCodigo = await apiPost({ action: 'buscarSeriePorCodigo', codigo: codigos[0].rawValue });
        if (!resCodigo.ok) {
          _mostrarSerieError(resCodigo.error || 'No se pudo comprobar el código detectado');
          video.style.display = 'none';
          capturarBtn.style.display = 'none';
          return;
        }
        if (resCodigo.ok && (resCodigo.match === 'exacto' || resCodigo.match === 'fuzzy')) {
          if (resCodigo.match === 'exacto') {
            _seriePulseDetected();
            window._camaraReturnToScanner = _serieQuickMode();
            closeCamaraSerie();
            if (typeof items !== 'undefined' && Array.isArray(items) && !items.some(x => x.id === resCodigo.item.id)) {
              items.push(resCodigo.item);
            }
            openItemRoute(resCodigo.item.id);
            return;
          }
          _mostrarSerieCandidatos(resCodigo.candidatos);
          video.style.display = 'none';
          capturarBtn.style.display = 'none';
          return;
        }
        _mostrarSerieCrearNuevo(String(codigos[0].rawValue || '').trim(), '', '');
        video.style.display = 'none';
        capturarBtn.style.display = 'none';
        return;
      }
    }

    const imagenBase64 = await _captureBestFrameBase64(video);

    video.style.display = 'none';
    capturarBtn.style.display = 'none';
    estado.style.display = 'block';
    estado.textContent = 'Leyendo etiqueta (optimizando imagen)...';
    resultado.style.display = 'none';

    const res = await apiPost({ action: 'buscarPorSerie', imagen: imagenBase64 });
    estado.style.display = 'none';
    const confianza = Number(res?.confianzaSerie || 0) || 0;
    if (!res.ok) {
      _mostrarSerieError(res.error || 'No se pudo leer la etiqueta, inténtalo de nuevo');
      return;
    }
    if (res.match === 'exacto') {
      if (confianza > 0 && confianza < 0.45) {
        _mostrarExactoConConfirmacion(res.item, confianza);
        return;
      }
      _seriePulseDetected();
      window._camaraReturnToScanner = _serieQuickMode();
      closeCamaraSerie();
      if (typeof items !== 'undefined' && Array.isArray(items) && !items.some(x => x.id === res.item.id)) {
        items.push(res.item);
      }
      openItemRoute(res.item.id);
      return;
    }
    if (res.match === 'fuzzy') {
      _mostrarSerieCandidatos(res.candidatos, confianza);
      return;
    }
    if (res.match === 'texto' && res.textoLibre && res.textoLibre.trim().length >= 2) {
      closeCamaraSerie();
      const gsInput = document.getElementById('gsInput');
      if (gsInput) {
        gsInput.value = res.textoLibre;
        if (typeof globalSearch === 'function') globalSearch(res.textoLibre);
        gsInput.focus();
      }
      return;
    }
    if (res.match === 'visual') {
      _mostrarVisualCandidatos(res.candidatos, res.nombreSugerido, res.categoriaSugerida);
      return;
    }
    if (res.match === 'ninguno') {
      _mostrarSerieCrearNuevo(res.serieLeida, res.marca, res.modelo);
      return;
    }
    _mostrarSerieError('No se pudo leer ningún número de serie, prueba a acercar la cámara o mejorar la luz');
  } catch (e) {
    estado.style.display = 'none';
    _mostrarSerieError('No se pudo leer la etiqueta, inténtalo de nuevo');
  } finally {
    _serieCapturing = false;
  }
}

function _mostrarSerieError(msg) {
  const resultado = document.getElementById('serieResultado');
  resultado.style.display = 'block';
  resultado.innerHTML = `
    <div style="color:var(--red);margin-bottom:12px">${escHtml(msg)}</div>
    <button class="btn" onclick="serieReintentar()">Reintentar</button>`;
}

function _mostrarSerieCandidatos(candidatos, confianza = 0) {
  const resultado = document.getElementById('serieResultado');
  resultado.style.display = 'block';
  _serieCandidatosPorId = {};
  const filas = candidatos.map(c => {
    _serieCandidatosPorId[String(c.id)] = c.serie || '';
    const aula = (typeof AULAS !== 'undefined' ? AULAS.find(a => a.id === c.aula) : null);
    const aulaNombre = aula ? aula.name : (c.aula || 'Sin aula');
    return `<div class="serie-candidato" onclick="serieAbrirCandidato(${c.id})" style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer">
      <div style="font-weight:600">${escHtml(c.item)}</div>
      <div style="font-size:12px;color:var(--muted)">${escHtml(aulaNombre)} · S/N: ${escHtml(c.serie)}</div>
    </div>`;
  }).join('');
  resultado.innerHTML = `${_renderConfianzaBadge(confianza)}<div style="margin-bottom:8px">No hay coincidencia exacta, ¿es alguno de estos?</div>${filas}<button class="btn" onclick="serieReintentar()">Reintentar</button>`;
}

function _mostrarVisualCandidatos(candidatos, nombreSugerido, categoriaSugerida) {
  _nombreSugeridoPendiente = nombreSugerido || '';
  _categoriaSugeridaPendiente = categoriaSugerida || '';
  const resultado = document.getElementById('serieResultado');
  resultado.style.display = 'block';
  if (!candidatos || !candidatos.length) {
    const nombreTexto = nombreSugerido ? escHtml(nombreSugerido) : 'este objeto';
    resultado.innerHTML = `
      <div style="margin-bottom:12px">No se encontró ningún ítem parecido a <strong>${nombreTexto}</strong> en el inventario.</div>
      <button class="btn btn-p" onclick="_crearItemDesdeVisual()">Crear ítem nuevo${nombreSugerido ? ': ' + escHtml(nombreSugerido) : ''}</button>
      <button class="btn" onclick="serieReintentar()" style="margin-top:8px">Reintentar</button>`;
    return;
  }
  const filas = candidatos.map(c => {
    const aula = (typeof AULAS !== 'undefined' ? AULAS.find(a => a.id === c.aula) : null);
    const aulaNombre = aula ? aula.name : (c.aula || 'Sin aula');
    return `<div class="serie-candidato" onclick="closeCamaraSerie();openItemRoute(${c.id})" style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer">
      <div style="font-weight:600">${escHtml(c.item)}</div>
      <div style="font-size:12px;color:var(--muted)">${escHtml(aulaNombre)}${c.cat ? ' · ' + escHtml(c.cat) : ''}</div>
    </div>`;
  }).join('');
  resultado.innerHTML = `<div style="margin-bottom:8px">No se leyó ningún texto, ¿es alguno de estos?</div>${filas}
    <button class="btn btn-p" onclick="_crearItemDesdeVisual()" style="margin-top:8px">Ninguno, crear ítem nuevo</button>
    <button class="btn" onclick="serieReintentar()" style="margin-top:8px">Reintentar</button>`;
}

function _mostrarSerieCrearNuevo(serieLeida, marca, modelo) {
  _serieLeidaPendiente = serieLeida;
  _marcaPendiente = marca || '';
  _modeloPendiente = modelo || '';
  const resultado = document.getElementById('serieResultado');
  resultado.style.display = 'block';
  const nombreDetectado = [marca, modelo].filter(Boolean).join(' ').trim();
  const botonTexto = nombreDetectado
    ? `Crear ítem nuevo: ${escHtml(nombreDetectado)} (S/N: ${escHtml(serieLeida)})`
    : `Crear ítem nuevo con S/N: ${escHtml(serieLeida)}`;
  resultado.innerHTML = `
    <div style="margin-bottom:12px">No se encontró ningún ítem con el número de serie <strong>${escHtml(serieLeida)}</strong>.</div>
    <button class="btn btn-p" onclick="_crearItemDesdeSerie()">${botonTexto}</button>
    <button class="btn" onclick="serieReintentar()" style="margin-top:8px">Reintentar</button>`;
}

function _crearItemDesdeSerie() {
  const serie = _serieLeidaPendiente;
  const marca = _marcaPendiente;
  const modelo = _modeloPendiente;
  window._camaraReturnToScanner = _serieQuickMode();
  closeCamaraSerie();
  openModal();
  setTimeout(() => {
    const input = document.getElementById('f_serie');
    if (input) input.value = serie;
    const aulaPref = localStorage.getItem(SERIE_PREF_LAST_AULA) || '';
    const catPref = localStorage.getItem(SERIE_PREF_LAST_CAT) || '';
    const aulaSel = document.getElementById('f_aula');
    if (aulaSel && aulaPref && [...aulaSel.options].some(o => o.value === aulaPref)) aulaSel.value = aulaPref;
    const catSel = document.getElementById('f_cat');
    if (catSel && catPref && [...catSel.options].some(o => o.value === catPref)) {
      catSel.value = catPref;
      catSel.dataset.prev = catPref;
    }
    const nombreDetectado = [marca, modelo].filter(Boolean).join(' ').trim();
    if (nombreDetectado) {
      const itemInput = document.getElementById('f_item');
      if (itemInput) itemInput.value = nombreDetectado;
    }
    if (marca) {
      const provInput = document.getElementById('f_proveedor');
      if (provInput) provInput.value = marca;
    }
  }, 50);
}

function _crearItemDesdeVisual() {
  const nombreSugerido = _nombreSugeridoPendiente;
  const categoriaSugerida = _categoriaSugeridaPendiente;
  window._camaraReturnToScanner = _serieQuickMode();
  closeCamaraSerie();
  openModal();
  setTimeout(() => {
    const aulaPref = localStorage.getItem(SERIE_PREF_LAST_AULA) || '';
    const aulaSel = document.getElementById('f_aula');
    if (aulaSel && aulaPref && [...aulaSel.options].some(o => o.value === aulaPref)) aulaSel.value = aulaPref;
    if (nombreSugerido) {
      const itemInput = document.getElementById('f_item');
      if (itemInput) itemInput.value = nombreSugerido;
    }
    if (categoriaSugerida) {
      const catSelect = document.getElementById('f_cat');
      if (catSelect && [...catSelect.options].some(o => o.value === categoriaSugerida)) {
        catSelect.value = categoriaSugerida;
        catSelect.dataset.prev = catSelect.value;
      }
    }
  }, 50);
}

function serieReintentar() {
  closeCamaraSerie();
  setTimeout(openCamaraSerie, 120);
}

async function serieAbrirCandidato(id) {
  window._camaraReturnToScanner = _serieQuickMode();
  closeCamaraSerie();
  openItemRoute(id);
  if (typeof items !== 'undefined' && Array.isArray(items) && items.some(x => Number(x.id) === Number(id))) return;

  const serie = _serieCandidatosPorId[String(id)] || '';
  if (!serie) return;
  try {
    const res = await apiPost({ action: 'buscarSeriePorCodigo', codigo: serie });
    if (res.ok && res.match === 'exacto' && res.item) {
      if (!items.some(x => Number(x.id) === Number(res.item.id))) items.push(res.item);
      openItemRoute(res.item.id);
    }
  } catch (e) {
    // Dejar el comportamiento por defecto si la recuperación falla.
  }
}
