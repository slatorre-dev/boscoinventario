// ═════════════════════════════════════════════════════════
// UI HELPERS — confirmación unificada, errores traducidos,
// validación inline de formularios
// ═════════════════════════════════════════════════════════

function toggleTheme() {
  const dark = document.body.classList.toggle('dark');
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute('content', dark ? '#3b82f6' : '#2563eb');
}

// Ítems fijados en Inicio — por navegador (localStorage), no sincronizado
// entre dispositivos ni por departamento: es un atajo personal, como el tema.
let favoritos = new Set();
try { favoritos = new Set(JSON.parse(localStorage.getItem('inv_favoritos') || '[]').map(String)); } catch (e) {}

function isFavorito(id) { return favoritos.has(String(id)); }

// Banners descartables de descubrimiento de funciones (mantenimiento,
// pedidos, reservas...) — mismo mecanismo que ya usaba #camaraHint,
// generalizado para no repetirlo por cada sección nueva.
function showFeatureHintOnce(key, elId) {
  try { if (localStorage.getItem('hint_' + key + '_visto')) return; } catch (e) { return; }
  const el = document.getElementById(elId);
  if (el) el.style.display = 'flex';
}

function dismissFeatureHint(key, elId) {
  const el = document.getElementById(elId);
  if (el) el.style.display = 'none';
  try { localStorage.setItem('hint_' + key + '_visto', '1'); } catch (e) {}
}

// Hint flotante con flecha, anclado a un botón real (getBoundingClientRect)
// en vez de a un banner fijo en el flujo — para features "escondidas" detrás
// de un botón concreto (ej. un menú). Comparte la misma clave de localStorage
// ('hint_<key>_visto') que showFeatureHintOnce/dismissFeatureHint, así que
// puede sustituir a un hint estático sin que reaparezca para quien ya lo vio.
// targetGetter: función que devuelve el elemento ancla vivo (se puede
// recalcular en cada resize, ej. topbar que colapsa a menú hamburguesa).
function showPointerHintOnce(key, targetGetter, html) {
  try { if (localStorage.getItem('hint_' + key + '_visto')) return; } catch (e) { return; }
  const target = typeof targetGetter === 'function' ? targetGetter() : document.getElementById(targetGetter);
  if (!target) return;
  let box = document.getElementById('floatingHintBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'floatingHintBox';
    box.className = 'pointer-hint';
    document.body.appendChild(box);
  }
  box.innerHTML = `<div class="pointer-hint-arrow"></div><span>${html}</span><button onclick="dismissPointerHint('${key}')">Entendido</button>`;
  box.dataset.key = key;
  box.style.display = 'block';
  const reposition = () => _positionPointerHint(box, typeof targetGetter === 'function' ? targetGetter() : target);
  reposition();
  window.addEventListener('resize', reposition);
  box._pointerHintReposition = reposition;
}

function dismissPointerHint(key) {
  const box = document.getElementById('floatingHintBox');
  if (box) {
    box.style.display = 'none';
    if (box._pointerHintReposition) window.removeEventListener('resize', box._pointerHintReposition);
  }
  try { localStorage.setItem('hint_' + key + '_visto', '1'); } catch (e) {}
}

function _positionPointerHint(box, target) {
  if (!target) { box.style.display = 'none'; return; }
  const r = target.getBoundingClientRect();
  box.style.top = (r.bottom + 12) + 'px';
  const maxLeft = window.innerWidth - box.offsetWidth - 8;
  const left = Math.max(8, Math.min(r.left + r.width / 2 - box.offsetWidth / 2, maxLeft));
  box.style.left = left + 'px';
  const arrow = box.querySelector('.pointer-hint-arrow');
  if (arrow) arrow.style.left = Math.max(10, Math.min(r.left + r.width / 2 - left - 8, box.offsetWidth - 26)) + 'px';
}

function toggleFavorito(id) {
  id = String(id);
  favoritos.has(id) ? favoritos.delete(id) : favoritos.add(id);
  try { localStorage.setItem('inv_favoritos', JSON.stringify([...favoritos])); } catch (e) {}
  if (typeof renderFavoritos === 'function' && document.getElementById('pH')?.classList.contains('active')) renderFavoritos();
}

function confirmDialog({title, message, confirmText = 'Continuar', danger = false, icon} = {}) {
  return new Promise(resolve => {
    const modal = document.getElementById('mConf');
    document.getElementById('cIcon').textContent = icon ?? (danger ? '🗑️' : '⚠️');
    document.getElementById('cTitle').textContent = title ?? (danger ? '¿Estás seguro?' : 'Confirmar');
    document.getElementById('cSub').textContent = message ?? '';
    const okBtn = document.getElementById('cOk');
    okBtn.textContent = confirmText;
    okBtn.classList.toggle('btn-d', danger);
    okBtn.disabled = false;
    okBtn.onclick = () => {
      modal._pendingResolve = null;
      closeConf();
      resolve(true);
    };
    modal._pendingResolve = resolve;
    modal.classList.add('open');
  });
}

function friendlyError(err) {
  const msg = String((err && err.message) || err || '');
  if (/\b401\b/.test(msg)) return 'Sesión caducada. Vuelve a iniciar sesión.';
  if (/\b403\b/.test(msg)) return 'No tienes permiso para hacer esto.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Sin conexión. Comprueba tu red e inténtalo de nuevo.';
  console.error(err);
  return 'No se pudo completar la acción. Inténtalo de nuevo.';
}

function markFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.classList.add('field-error');
  let msgEl = field.parentElement.querySelector('.field-error-msg');
  if (!msgEl) {
    msgEl = document.createElement('span');
    msgEl.className = 'field-error-msg';
    field.insertAdjacentElement('afterend', msgEl);
  }
  msgEl.textContent = message;
  const clear = () => { field.classList.remove('field-error'); if (msgEl) msgEl.remove(); field.removeEventListener('input', clear); field.removeEventListener('change', clear); };
  field.addEventListener('input', clear);
  field.addEventListener('change', clear);
}

function clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
  document.querySelectorAll('.field-error-msg').forEach(el => el.remove());
}

function focusFirstError() {
  const first = document.querySelector('.field-error');
  if (first) { first.scrollIntoView({behavior:'smooth', block:'center'}); first.focus(); }
}
