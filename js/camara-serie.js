let _serieStream = null;
let _serieCapturing = false;
let _serieLeidaPendiente = '';
let _marcaPendiente = '';
let _modeloPendiente = '';
let _nombreSugeridoPendiente = '';
let _categoriaSugeridaPendiente = '';

function openCamaraSerie() {
  const modal = document.getElementById('mCamaraSerie');
  const video = document.getElementById('serieVideo');
  const estado = document.getElementById('serieEstado');
  const resultado = document.getElementById('serieResultado');
  const capturarBtn = document.getElementById('serieCapturarBtn');

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

  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Este navegador no permite acceder a la cámara', 'err');
    closeCamaraSerie();
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      _serieStream = stream;
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
      closeCamaraSerie();
    });
}

function closeCamaraSerie() {
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
        if (resCodigo.ok && (resCodigo.match === 'exacto' || resCodigo.match === 'fuzzy')) {
          if (resCodigo.match === 'exacto') {
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
      }
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
    const imagenBase64 = dataUrl.split(',')[1];

    video.style.display = 'none';
    capturarBtn.style.display = 'none';
    estado.style.display = 'block';
    estado.textContent = 'Leyendo etiqueta...';
    resultado.style.display = 'none';

    const res = await apiPost({ action: 'buscarPorSerie', imagen: imagenBase64 });
    estado.style.display = 'none';
    if (!res.ok) {
      _mostrarSerieError(res.error || 'No se pudo leer la etiqueta, inténtalo de nuevo');
      return;
    }
    if (res.match === 'exacto') {
      closeCamaraSerie();
      if (typeof items !== 'undefined' && Array.isArray(items) && !items.some(x => x.id === res.item.id)) {
        items.push(res.item);
      }
      openItemRoute(res.item.id);
      return;
    }
    if (res.match === 'fuzzy') {
      _mostrarSerieCandidatos(res.candidatos);
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

function _mostrarSerieCandidatos(candidatos) {
  const resultado = document.getElementById('serieResultado');
  resultado.style.display = 'block';
  const filas = candidatos.map(c => {
    const aula = (typeof AULAS !== 'undefined' ? AULAS.find(a => a.id === c.aula) : null);
    const aulaNombre = aula ? aula.name : (c.aula || 'Sin aula');
    return `<div class="serie-candidato" onclick="closeCamaraSerie();openItemRoute(${c.id})" style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer">
      <div style="font-weight:600">${escHtml(c.item)}</div>
      <div style="font-size:12px;color:var(--muted)">${escHtml(aulaNombre)} · S/N: ${escHtml(c.serie)}</div>
    </div>`;
  }).join('');
  resultado.innerHTML = `<div style="margin-bottom:8px">No hay coincidencia exacta, ¿es alguno de estos?</div>${filas}<button class="btn" onclick="serieReintentar()">Reintentar</button>`;
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
  closeCamaraSerie();
  openModal();
  setTimeout(() => {
    const input = document.getElementById('f_serie');
    if (input) input.value = serie;
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
  closeCamaraSerie();
  openModal();
  setTimeout(() => {
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
