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
