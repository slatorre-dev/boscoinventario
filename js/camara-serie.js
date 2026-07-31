let _serieStream = null;
let _serieCapturing = false;

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
  const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
  const imagenBase64 = dataUrl.split(',')[1];

  video.style.display = 'none';
  capturarBtn.style.display = 'none';
  estado.style.display = 'block';
  estado.textContent = 'Leyendo etiqueta...';
  resultado.style.display = 'none';

  try {
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
    if (res.match === 'ninguno') {
      _mostrarSerieCrearNuevo(res.serieLeida);
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

let _serieLeidaPendiente = '';

function _mostrarSerieCrearNuevo(serieLeida) {
  _serieLeidaPendiente = serieLeida;
  const resultado = document.getElementById('serieResultado');
  resultado.style.display = 'block';
  resultado.innerHTML = `
    <div style="margin-bottom:12px">No se encontró ningún ítem con el número de serie <strong>${escHtml(serieLeida)}</strong>.</div>
    <button class="btn btn-p" onclick="_crearItemDesdeSerie()">Crear ítem nuevo con S/N: ${escHtml(serieLeida)}</button>
    <button class="btn" onclick="serieReintentar()" style="margin-top:8px">Reintentar</button>`;
}

function _crearItemDesdeSerie() {
  const serie = _serieLeidaPendiente;
  closeCamaraSerie();
  openModal();
  setTimeout(() => {
    const input = document.getElementById('f_serie');
    if (input) input.value = serie;
  }, 50);
}

function serieReintentar() {
  closeCamaraSerie();
  setTimeout(openCamaraSerie, 120);
}
