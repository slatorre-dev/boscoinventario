// ═════════════════════════════════════════════════════════
// PWA — Service Worker + Install prompt + Update prompt
// ═════════════════════════════════════════════════════════
let deferredInstallPrompt = null;
let _waitingSW = null;
let _refreshing = false;

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    loadAppVersion();

    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('[PWA] Service worker registrado:', reg.scope);

        // Si ya hay uno esperando al cargar, avisamos.
        if(reg.waiting && navigator.serviceWorker.controller){
          _waitingSW = reg.waiting;
          showUpdateToast();
        }

        // Detectar nuevas versiones que entran en estado 'installed'.
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if(!newSW) return;
          newSW.addEventListener('statechange', () => {
            if(newSW.state === 'installed' && navigator.serviceWorker.controller){
              _waitingSW = newSW;
              showUpdateToast();
            }
          });
        });
      })
      .catch(err => console.warn('[PWA] Error al registrar SW:', err));

    // Cuando el SW nuevo toma el control, recargar UNA sola vez.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if(_refreshing) return;
      _refreshing = true;
      window.location.reload();
    });
  });
}

function loadAppVersion(){
  const el = document.getElementById('appVersion');
  if(!el) return;

  fetch('./sw.js', { cache: 'no-store' })
    .then(res => res.ok ? res.text() : '')
    .then(txt => {
      const match = txt.match(/const\s+VERSION\s*=\s*['"]([^'"]+)['"]/);
      if(match) el.textContent = match[1];
    })
    .catch(() => {});
}

// Toast que actualiza automáticamente en 10s o al hacer click
function showUpdateToast(){
  if(typeof toast !== 'function') return;
  const el = document.createElement('div');
  el.className = 'toast ok';
  el.style.cursor = 'pointer';
  el.innerHTML = `<span>🔄</span><span>Actualización disponible. Toca aquí cuando termines</span>`;
  el.onclick = () => {
    if(_waitingSW && !hasPendingUserWork()){
      _waitingSW.postMessage('SKIP_WAITING');
      el.innerHTML = '<span>⏳</span><span>Actualizando…</span>';
    }
  };
  const cont = document.getElementById('toasts');
  if(cont) cont.appendChild(el);

  // Actualizar automáticamente solo si no hay trabajo abierto del usuario.
  setTimeout(() => {
    if(_waitingSW && !hasPendingUserWork()){
      _waitingSW.postMessage('SKIP_WAITING');
    }
  }, 5000);
}

function hasPendingUserWork(){
  return !!document.querySelector('.mbg.open') ||
    !!document.querySelector('input:focus, textarea:focus, select:focus');
}

// Capturar el evento de instalación para mostrarlo cuando queramos
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('btnInstall');
  if(btn && document.getElementById('pH').classList.contains('active')) btn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const btn = document.getElementById('btnInstall');
  if(btn) btn.style.display = 'none';
  if(typeof toast === 'function') toast('¡App instalada correctamente!', 'ok');
});

function installPWA(){
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(result => {
    if(result.outcome === 'accepted' && typeof toast === 'function') toast('Instalando la app…', 'ok');
    deferredInstallPrompt = null;
    const btn = document.getElementById('btnInstall');
    if(btn) btn.style.display = 'none';
  });
}
