// ═════════════════════════════════════════════════════════
// SERVICE WORKER — Inventario FP
// Estrategia:
//   - SHELL (HTML/CSS/JS/iconos) -> cache-first con red de respaldo
//   - API Apps Script y Google Fonts woff2 -> siempre red (no cachear)
//   - Resto -> stale-while-revalidate (devuelve cache rapido y actualiza en background)
// Para forzar a los clientes a coger version nueva basta con subir VERSION.
// ═════════════════════════════════════════════════════════

const VERSION = 'v475';
const CACHE_SHELL   = 'inventario-fp-shell-' + VERSION;
const CACHE_RUNTIME = 'inventario-fp-runtime-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/config.js',
  './js/state.js',
  './js/roles.js',
  './js/api.js',
  './js/auth.js',
  './js/nav.js',
  './js/search.js',
  './js/home.js',
  './js/inventory.js',
  './js/modal-item.js',
  './js/modal-aulas.js',
  './js/modal-ubicaciones.js',
  './js/modal-cats.js',
  './js/modal-ciclos.js',
  './js/prestamos.js',
  './js/import.js',
  './js/docs.js',
  './js/docs-dpto.js',
  './js/pwa.js',
  './js/profile.js',
  './js/reset.js',
  './js/qr-scanner.js',
  './js/audit-log.js',
  './js/modal-historial.js',
  './js/dept-game.js',
  './js/agente-widget.js',
  './favicon.svg',
  './icons/qr-code.svg',
  './icons/dept-electricidad.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap'
];

// ─── INSTALL ─────────────────────────────────────────────
// addAll es atomico: si falla un solo recurso, falla todo el cache.
// Hacemos add() uno a uno con catch para tolerar fallos puntuales (ej. CDN caido).
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_SHELL).then(cache =>
      Promise.all(
        SHELL.map(url =>
          cache.add(new Request(url, { cache: 'reload' }))
            .catch(err => console.warn('[SW] No se pudo cachear', url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ────────────────────────────────────────────
// Limpia caches antiguos cuando cambia la VERSION.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_SHELL && k !== CACHE_RUNTIME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── FETCH ───────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = req.url;

  // Solo GET. POST/PUT/etc. siempre van a red.
  if (req.method !== 'GET') return;

  // Esquemas no http(s) — extensiones, chrome://, etc.
  if (!url.startsWith('http')) return;

  const parsedUrl = new URL(url);
  if (parsedUrl.origin === self.location.origin && parsedUrl.pathname.startsWith('/api/')) {
    return;
  }

  // ─── 1. API Apps Script: SIEMPRE RED ──────────────────
  // Si la cacheamos, mostrariamos datos viejos del inventario.
  if (url.includes('script.google.com') || url.includes('googleusercontent.com')) {
    return; // dejar pasar a la red
  }

  // ─── 2. Fuentes binarias de Google: SIEMPRE RED ───────
  // Las gestiona el propio navegador con sus headers de cache.
  if (url.includes('fonts.gstatic.com')) {
    return;
  }

  // ─── 3. SharePoint y otros iframes externos ───────────
  if (url.includes('sharepoint.com')) {
    return;
  }

  // ─── 4. CSS de Google Fonts: stale-while-revalidate ───
  if (url.includes('fonts.googleapis.com')) {
    e.respondWith(staleWhileRevalidate(req, CACHE_SHELL));
    return;
  }

  // ─── 5. SHELL local: cache-first ──────────────────────
  e.respondWith(cacheFirst(req));
});

// ─── ESTRATEGIAS ─────────────────────────────────────────

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type !== 'opaque') {
      const cache = await caches.open(CACHE_RUNTIME);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    // Sin red y sin cache: para navegacion devolvemos index.html
    if (req.destination === 'document') {
      return (await caches.match('./index.html')) || (await caches.match('./'));
    }
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then(res => {
      if (res && res.status === 200 && res.type !== 'opaque') cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || networkPromise || fetch(req);
}

// ─── MENSAJES DEL CLIENTE ────────────────────────────────
// Permite que la app pida saltar la espera tras un updatefound.
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
