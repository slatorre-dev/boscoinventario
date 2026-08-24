const TOUR_CAMARA_KEY = 'tour_camara_visto_v1';
const HINT_CAMARA_KEY = 'hint_camara_visto_v1';

const TOUR_PANTALLAS = [
  {
    titulo: '📷 Novedades: búsqueda por cámara',
    texto: '<strong class="camera-help-tip" title="Busca por número de serie y también puede entender códigos de barras o texto libre en la misma cámara.">🔢 Buscar por número de serie</strong><br>Apunta la cámara a la etiqueta de un equipo y encuéntralo al instante en el inventario. Si no existe, podrás pulsar <strong class="camera-help-tip" title="Abre el alta del ítem usando lo que la cámara ya haya leído.">➕ Añadir ítem nuevo</strong> desde el propio flujo de cámara.<br><span class="camera-help-tip" title="Al cerrar una ficha o crear un ítem, la cámara vuelve a abrirse sola para seguir escaneando.">Modo clase rápida</span> significa justo eso: seguir escaneando sin volver al botón.'
  },
  {
    titulo: '📷 Novedades: búsqueda por cámara',
    texto: '<strong class="camera-help-tip" title="Permite crear varios equipos de una sola foto, pero solo dentro de una aula concreta.">📸 Multi-equipo en una foto</strong><br>Fotografía una mesa entera con varios equipos nuevos y créalos todos de golpe. Este modo necesita más espacio en pantalla, por eso también aparece en la ayuda como función de aula.<br><span class="camera-help-tip" title="Agranda textos, botones y controles para usar la cámara con más comodidad.">Modo accesible</span> solo cambia la interfaz para que sea más fácil pulsar y leer.' ,
    requiereEscritura: true
  },
  {
    titulo: '📷 Novedades: búsqueda por cámara',
    texto: '<strong class="camera-help-tip" title="Revisa un aula foto a foto para comprobar que cada equipo esté donde toca.">📷 Inventario andando</strong><br>Recorre un aula fotografiando cada equipo, uno tras otro, y confirma que todo está donde debe. Si activas el <span class="camera-help-tip" title="Al cerrar una ficha o crear un ítem, la cámara vuelve a abrirse sola para seguir escaneando.">modo clase rápida</span>, la cámara se relanza sola tras cada ficha.',
    requiereEscritura: true
  },
  {
    titulo: '📷 Novedades: búsqueda por cámara',
    texto: '<strong class="camera-help-tip" title="Cuando no hay una etiqueta legible, la cámara puede reconocer la forma o el tipo de equipo.">🧩 Reconocimiento visual</strong><br>Aunque el equipo no tenga ninguna etiqueta legible, la cámara puede reconocerlo igual.'
  }
];

let _tourPaso = 0;
let _tourPantallas = TOUR_PANTALLAS;
let _onboardingTrigger = null;

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

function mostrarHintCamaraSiPrimeraVez() {
  try {
    if (localStorage.getItem(HINT_CAMARA_KEY)) return;
  } catch (e) { return; }
  const hint = document.getElementById('camaraHint');
  if (!hint) return;
  const tourOpen = document.getElementById('mTourCamara')?.classList.contains('open');
  if (tourOpen) {
    setTimeout(mostrarHintCamaraSiPrimeraVez, 1200);
    return;
  }
  hint.style.display = 'flex';
}

function cerrarHintCamara() {
  const hint = document.getElementById('camaraHint');
  if (hint) hint.style.display = 'none';
  try { localStorage.setItem(HINT_CAMARA_KEY, '1'); } catch (e) { /* ignore */ }
}

function openTourCamara(reabierta) {
  _onboardingTrigger = document.activeElement;
  const puedeEscribir = typeof can === 'function' && can('items.write');
  _tourPantallas = TOUR_PANTALLAS.filter(p => !p.requiereEscritura || puedeEscribir);
  _tourPaso = 0;
  _renderTourPaso();
  document.getElementById('mTourCamara').classList.add('open');
  document.getElementById('tourBtnSaltar')?.focus();
  if (reabierta) _marcarTourVisto();
}

function closeTourCamara() {
  _marcarTourVisto();
  document.getElementById('mTourCamara').classList.remove('open');
  _onboardingTrigger?.focus();
  _onboardingTrigger = null;
}

function _renderTourPaso() {
  const p = _tourPantallas[_tourPaso];
  document.getElementById('tourTitulo').textContent = p.titulo;
  document.getElementById('tourContenido').innerHTML = p.texto;
  document.getElementById('tourPasos').textContent = `${_tourPaso + 1} / ${_tourPantallas.length}`;
  document.getElementById('tourBtnAtras').style.display = _tourPaso === 0 ? 'none' : 'inline-flex';
  document.getElementById('tourBtnSiguiente').textContent = _tourPaso === _tourPantallas.length - 1 ? 'Terminar' : 'Siguiente';
}

function tourSiguiente() {
  if (_tourPaso >= _tourPantallas.length - 1) {
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
  _onboardingTrigger = document.activeElement;
  const puedeEscribir = typeof can === 'function' && can('items.write');
  ['ayudaMultiEquipo', 'ayudaRevisionAula'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = puedeEscribir ? '' : 'none';
  });
  document.getElementById('mAyudaCamara').classList.add('open');
  document.getElementById('ayudaBtnVerTour')?.focus();
}

function closeAyudaCamara() {
  document.getElementById('mAyudaCamara').classList.remove('open');
  _onboardingTrigger?.focus();
  _onboardingTrigger = null;
}
