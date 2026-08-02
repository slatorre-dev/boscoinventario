const TOUR_CAMARA_KEY = 'tour_camara_visto_v1';

const TOUR_PANTALLAS = [
  {
    titulo: '📷 Novedades: búsqueda por cámara',
    texto: '<strong>🔢 Buscar por número de serie</strong><br>Apunta la cámara a la etiqueta de un equipo y encuéntralo al instante en el inventario.'
  },
  {
    titulo: '📷 Novedades: búsqueda por cámara',
    texto: '<strong>📸 Multi-equipo en una foto</strong><br>Fotografía una mesa entera con varios equipos nuevos y créalos todos de golpe.'
  },
  {
    titulo: '📷 Novedades: búsqueda por cámara',
    texto: '<strong>📷 Inventario andando</strong><br>Recorre un aula fotografiando cada equipo, uno tras otro, y confirma que todo está donde debe.'
  },
  {
    titulo: '📷 Novedades: búsqueda por cámara',
    texto: '<strong>🧩 Reconocimiento visual</strong><br>Aunque el equipo no tenga ninguna etiqueta legible, la cámara puede reconocerlo igual.'
  }
];

let _tourPaso = 0;

function _tourVisto() {
  try { return !!localStorage.getItem(TOUR_CAMARA_KEY); } catch (e) { return false; }
}

function _marcarTourVisto() {
  try { localStorage.setItem(TOUR_CAMARA_KEY, '1'); } catch (e) { /* localStorage no disponible, no bloquea nada */ }
}

function iniciarTourCamaraSiPrimeraVez() {
  if (_tourVisto()) return;
  openTourCamara(false);
}

function openTourCamara(reabierta) {
  _tourPaso = 0;
  _renderTourPaso();
  document.getElementById('mTourCamara').classList.add('open');
  if (reabierta) _marcarTourVisto();
}

function closeTourCamara() {
  _marcarTourVisto();
  document.getElementById('mTourCamara').classList.remove('open');
}

function _renderTourPaso() {
  const p = TOUR_PANTALLAS[_tourPaso];
  document.getElementById('tourTitulo').textContent = p.titulo;
  document.getElementById('tourContenido').innerHTML = p.texto;
  document.getElementById('tourPasos').textContent = `${_tourPaso + 1} / ${TOUR_PANTALLAS.length}`;
  document.getElementById('tourBtnAtras').style.display = _tourPaso === 0 ? 'none' : 'inline-flex';
  document.getElementById('tourBtnSiguiente').textContent = _tourPaso === TOUR_PANTALLAS.length - 1 ? 'Terminar' : 'Siguiente';
}

function tourSiguiente() {
  if (_tourPaso >= TOUR_PANTALLAS.length - 1) {
    closeTourCamara();
    return;
  }
  _tourPaso++;
  _renderTourPaso();
}

function tourAnterior() {
  if (_tourPaso <= 0) return;
  _tourPaso--;
  _renderTourPaso();
}

function openAyudaCamara() {
  document.getElementById('mAyudaCamara').classList.add('open');
}

function closeAyudaCamara() {
  document.getElementById('mAyudaCamara').classList.remove('open');
}
