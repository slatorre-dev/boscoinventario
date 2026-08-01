/**
 * Agente IA — Widget flotante para inventarioelecfp.pages.dev
 * Uso: <script src="agente-widget.js"></script>  (antes de </body>)
 *
 * Requisitos:
 *   - La página ya tiene sesión iniciada: window._appState.usuario y .password
 *   - O bien se puede configurar AGENTE_USER / AGENTE_PASS como variables globales
 *   - Necesita cabeceras CORS en /api/* (ver README)
 */

(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  var API_BASE = '';          // vacío = mismo dominio (relativo)
  var AI_ENDPOINT = '/api/proxy-ai';  // Pages Function — el token vive en el servidor, requiere sesión (ver _middleware.js)
  var MODEL = 'glm-4.7-flash';   // Cloudflare Workers AI — el modelo real (@cf/zai-org/glm-4.7-flash) lo fija el backend (proxy-ai.js), este valor es solo informativo
  var AGENTE_NOMBRE = 'Volt';    // Nombre del agente IA
  var LEARN_KEY = 'volt_intent_examples_v1';
  var HISTORY_KEY = 'volt_chat_history_v1';
  var HISTORY_MAX = 40; // máximo de mensajes a persistir
  var FORM_CORRECTIONS_KEY = 'volt_form_corrections_v1';
  var FORM_CORRECTIONS_MAX = 60;

  // Obtener credenciales — usa SESSION global de la app (state.js)
  function getCreds() {
    var s = null;
    if (typeof SESSION !== 'undefined' && SESSION && SESSION.usuario) {
      s = SESSION;
    } else {
      try {
        var saved = localStorage.getItem('inv_session');
        if (saved) s = JSON.parse(saved);
      } catch(e) {}
    }
    if (!s || !s.usuario) return null;
    // Preferir session_token (OAuth) sobre password (login clásico)
    if (s.session_token) return { u: s.usuario, t: s.session_token };
    return { u: s.usuario, p: s.password || '' };
  }

  function applyCredsToUrl(url, creds) {
    if (!creds) return;
    url.searchParams.set('u', creds.u);
    if (creds.t) url.searchParams.set('t', creds.t);
    else url.searchParams.set('p', creds.p || '');
  }

  // ── API helpers ────────────────────────────────────────────────────────────
  function apiGet(path, params) {
    var creds = getCreds();
    var url = new URL(API_BASE + path, window.location.origin);
    applyCredsToUrl(url, creds);
    if (params) Object.keys(params).forEach(function(k){ url.searchParams.set(k, params[k]); });
    return fetch(url.toString()).then(function(r){ return r.json(); });
  }

  function apiPost(path, body) {
    var creds = getCreds();
    var url = new URL(API_BASE + path, window.location.origin);
    applyCredsToUrl(url, creds);
    return fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r){
      return r.json().catch(function(){ return {ok:false, error:'Respuesta inválida del servidor (HTTP '+r.status+')'}; });
    });
  }

  function decompressItems(data) {
    if (!data || !data.itemsH || !data.itemsC) return data && data.items ? data.items : [];
    return data.itemsC.map(function(row) {
      var obj = {};
      data.itemsH.forEach(function(h, i){ obj[h] = row[i]; });
      return obj;
    });
  }

  // ── GitHub Models streaming (formato OpenAI) ──────────────────────────────
  function streamAI(messages, systemExtra, onChunk) {
    var systemMsg = 'Eres VOLT, agente de inventario FP. Busca SIEMPRE en los resultados antes de responder. ' +
      'Reporta stock EXACTO. Si no aparece, di "No en inventario". ' +
      'Cuando el usuario quiera un material, localízalo y confirma disponibilidad. ' +
      'ACCIONES DISPONIBLES (se activan automáticamente con frases naturales):\n' +
      '- PEDIR PRÉSTAMO: "pedir prestado X", "me llevo el multímetro", "dame el soldador", ' +
      '"préstame el osciloscopio", "necesito el polímetro", "quiero coger la pistola de calor", ' +
      '"me hace falta el crimpeador", "voy a usar el taladro", "me lo llevo prestado", ' +
      '"apuntar el préstamo del multímetro"\n' +
      '- DEVOLVER: "devuelve el multímetro de Juan", "ya lo traigo", "voy a devolver el soldador", ' +
      '"cerrar el préstamo", "ya lo he traído de vuelta", "marcar como devuelto"\n' +
      '- ACTUALIZAR STOCK: "quedan 20 condensadores", "actualiza la cantidad a 50", ' +
      '"sube el stock a 10", "tenemos 5 más", "reducir stock a 3"\n' +
      '- CAMBIAR ESTADO: "el polímetro está en avería", "cambia estado a deteriorado", ' +
      '"ponlo como Bueno", "ya no funciona", "está estropeado", "catalogar como Baja"\n' +
      '- MANTENIMIENTO: "solicita mantenimiento para el soldador", "hay que revisarlo", ' +
      '"se ha roto el osciloscopio", "requiere reparación", "llevar al técnico"\n' +
      '- AÑADIR ÍTEM: "añade un polímetro en el aula 35", "dar de alta una impresora", ' +
      '"nuevo equipo en el taller", "inventariar un osciloscopio", "ha llegado nuevo material", ' +
      '"mete en inventario una fuente", "registrar entrada de material"\n' +
      '- EDITAR FICHA: "edita el osciloscopio", "abre la ficha del taladro", "cambia el aula", ' +
      '"mueve el polímetro al taller", "corrige la ubicación", "modifica los datos"\n' +
      '- CONSULTAS: "¿stock bajo?", "¿quién tiene el osciloscopio?", "¿qué hay en el Aula 35?", ' +
      '"¿qué necesita mantenimiento?", "¿está prestado?", "lista de préstamos activos", ' +
      '"¿cuántos multímetros hay?", "resumen del aula 14"\n' +
      'Cuando detectes una de estas intenciones, INDÍCALO brevemente. No inventes datos. ' +
      'Sé conciso. Responde en español. Usa tablas markdown si es útil.' +
      (systemExtra || '');

    var payload = {
      model: MODEL,
      max_tokens: 500,
      stream: true,
      messages: [{ role: 'system', content: systemMsg }].concat(messages)
    };

    var creds = getCreds();
    var aiUrl = new URL(API_BASE + AI_ENDPOINT, window.location.origin);
    applyCredsToUrl(aiUrl, creds);

    return fetch(aiUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(res) {
      if (!res.ok) return res.text().then(function(t){ throw new Error('API ' + res.status + ': ' + t); });
      var reader = res.body.getReader();
      var dec = new TextDecoder();
      var full = '';
      function pump() {
        return reader.read().then(function(ref) {
          if (ref.done) return full;
          dec.decode(ref.value).split('\n').forEach(function(line) {
            if (!line.startsWith('data: ') || line === 'data: [DONE]') return;
            try {
              var d = JSON.parse(line.slice(6));
              var delta = d.choices && d.choices[0].delta && d.choices[0].delta.content;
              if (delta) { full += delta; onChunk(delta); }
            } catch(e) {}
          });
          return pump();
        });
      }
      return pump();
    });
  }

  // ── CSS ────────────────────────────────────────────────────────────────────
  var css = `
    #agente-fab {
      position: fixed; top: 68px; right: 14px; z-index: 99998;
      height: 36px; padding: 0 18px; border-radius: 18px;
      background: linear-gradient(135deg, #1d4ed8, #0369a1);
      border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(29,78,216,.5);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; letter-spacing: .3px; font-family: inherit; transition: opacity .2s, box-shadow .2s; white-space: nowrap; gap: 7px;
      color: white;
    }
    #agente-fab:hover { opacity: .9; box-shadow: 0 6px 24px rgba(29,78,216,.7); }
    #agente-fab .fab-badge {
      position: absolute; top: -4px; right: -4px;
      background: #ef4444; color: white; border-radius: 50%;
      width: 18px; height: 18px; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }

    #agente-panel {
      position: fixed; top: 0; right: 0; z-index: 99999;
      width: 420px; height: 100vh; height: 100dvh; max-height: 100vh; max-height: 100dvh;
      background: #070d1a; border-left: 1px solid #1e293b;
      display: flex; flex-direction: column;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      transform: translateY(-100vh); transition: transform .3s cubic-bezier(.4,0,.2,1);
      box-shadow: none; pointer-events: none;
    }
    #agente-panel.open { transform: translateY(0); box-shadow: 0 8px 40px rgba(0,0,0,.6); pointer-events: auto; }

    @media (max-width: 480px) {
      #agente-panel { width: 100vw; top: 0; bottom: 0; height: 100dvh; max-height: 100dvh; }
    }
    @media (max-width: 640px) {
      #agente-fab .fab-txt { display: none; }
      #agente-fab { padding: 0 13px; }
    }

    .ag-header {
      background: #0a1628; border-bottom: 1px solid #1e293b;
      padding: 10px 14px; display: flex; align-items: center; gap: 10px;
      flex-shrink: 0;
    }
    .ag-header-title { flex: 1; }
    .ag-header-title .ag-title { font-size: 12px; font-weight: 700; color: #7dd3fc; letter-spacing: 1px; }
    .ag-header-title .ag-sub { font-size: 10px; color: #475569; }
    .ag-badge { padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
    .ag-badge-green { background: #d1fae5; color: #065f46; }
    .ag-badge-yellow { background: #fef3c7; color: #92400e; }
    .ag-badge-red { background: #fee2e2; color: #991b1b; }
    .ag-close { background: none; border: none; color: #475569; cursor: pointer; font-size: 18px; padding: 4px; }
    .ag-close:hover { color: #94a3b8; }

    .ag-tabs {
      display: flex; border-bottom: 1px solid #1e293b;
      background: #0a1628; overflow-x: auto; flex-shrink: 0;
    }
    .ag-tab {
      background: transparent; border: none; border-bottom: 2px solid transparent;
      color: #475569; padding: 8px 12px; cursor: pointer; font-size: 11px;
      font-weight: 600; white-space: nowrap; font-family: inherit;
      transition: all .15s;
    }
    .ag-tab.active { background: #1e293b; border-bottom-color: #38bdf8; color: #7dd3fc; }

    .ag-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
    .ag-panel { display: none; flex-direction: column; overflow-y: auto; padding: 14px; gap: 10px; min-height: 0; flex: 1; }
    .ag-panel.active { display: flex; }

    /* Chat — estructura fija: mensajes crece, resto fijo abajo */
    #ag-tab-chat { overflow: hidden; padding: 0; gap: 0; }
    .ag-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 14px; min-height: 0; }
    #ag-quick { flex-shrink: 0; }
    #ag-suggestions { flex-shrink: 0; }
    .ag-input-row { flex-shrink: 0; padding: 10px 14px; border-top: 1px solid #1e293b; display: flex; gap: 8px; }
    .ag-msg { max-width: 88%; padding: 9px 12px; border-radius: 10px; font-size: 12px; line-height: 1.6; }
    .ag-msg-user { background: #0369a1; color: #f1f5f9; align-self: flex-end; border-bottom-right-radius: 2px; }
    .ag-msg-ai { background: #1e293b; color: #e2e8f0; align-self: flex-start; border-bottom-left-radius: 2px; }
    .ag-msg-ai table { border-collapse: collapse; font-size: 11px; width: 100%; margin: 6px 0; }
    .ag-msg-ai th { background: #0f172a; color: #94a3b8; padding: 4px 8px; text-align: left; }
    .ag-msg-ai td { padding: 4px 8px; color: #e2e8f0; border-bottom: 1px solid #1e293b; }
    .ag-msg-ai strong { color: #f1f5f9; }
    .ag-msg-ai ul, .ag-msg-ai ol { padding-left: 16px; margin: 4px 0; }
    .ag-cursor { display: inline-block; width: 5px; height: 12px; background: #38bdf8; margin-left: 2px; animation: ag-blink 1s infinite; vertical-align: middle; }
    @keyframes ag-blink { 0%,100%{opacity:1} 50%{opacity:0} }
    .ag-dots { display: flex; gap: 4px; padding: 10px 14px; }
    .ag-dot { width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; animation: ag-bounce 1.2s ease-in-out infinite; }
    @keyframes ag-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
    .ag-intent-chip { align-self: flex-start; background: rgba(148,163,184,.1); border: 1px solid rgba(148,163,184,.2); border-radius: 6px; padding: 2px 8px; font-size: 10px; color: #64748b; font-style: italic; margin: -2px 0 2px; max-width: 88%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ag-quick { display: flex; flex-direction: column; gap: 6px; padding: 0 14px 10px; }
    .ag-quick-btn { background: #1e293b; border: 1px solid #334155; border-radius: 7px; color: #94a3b8; padding: 7px 10px; cursor: pointer; font-size: 11px; text-align: left; font-family: inherit; transition: all .15s; }
    .ag-quick-btn:hover { border-color: #38bdf8; color: #e2e8f0; }
    .ag-input { flex: 1; background: #0f172a; border: 1px solid #334155; border-radius: 7px; color: #f1f5f9; padding: 8px 10px; font-size: 12px; outline: none; font-family: inherit; }
    .ag-send { background: #0369a1; border: none; border-radius: 7px; color: white; padding: 8px 12px; cursor: pointer; font-size: 14px; }
    .ag-send:disabled { background: #1e293b; cursor: not-allowed; }
    .ag-mic-btn.listening { background: #dc2626 !important; animation: ag-mic-pulse 1s infinite; }
    @keyframes ag-mic-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.5)} 50%{box-shadow:0 0 0 6px rgba(220,38,38,0)} }

    /* Tablas genéricas */
    .ag-table-wrap { overflow-x: auto; }
    .ag-table { border-collapse: collapse; font-size: 11px; width: 100%; }
    .ag-table th { background: #1e293b; color: #94a3b8; padding: 5px 8px; text-align: left; white-space: nowrap; }
    .ag-table td { padding: 4px 8px; color: #e2e8f0; border-bottom: 1px solid #1e293b; white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
    .ag-table td:nth-child(2) { max-width: 260px; } /* columna descripción más ancha */
    .ag-table tr:nth-child(even) td { background: #111827; }

    /* Controles */
    .ag-btn { background: #1e293b; border: 1px solid #334155; border-radius: 7px; color: #f1f5f9; padding: 7px 12px; cursor: pointer; font-size: 11px; font-weight: 600; font-family: inherit; transition: opacity .15s; }
    .ag-btn:hover:not(:disabled) { opacity: .8; }
    .ag-btn:disabled { opacity: .4; cursor: not-allowed; }
    .ag-btn-blue { background: #0369a1; border-color: #7dd3fc; }
    .ag-label { color: #64748b; font-size: 10px; display: block; margin-bottom: 3px; }
    .ag-input-field { background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #f1f5f9; padding: 7px 9px; font-size: 11px; outline: none; width: 100%; box-sizing: border-box; font-family: inherit; }
    .ag-row { display: flex; gap: 8px; }
    .ag-col { flex: 1; }
    .ag-ai-result { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 10px; font-size: 11px; line-height: 1.7; color: #cbd5e1; margin-top: 4px; max-height: 300px; overflow-y: auto; }
    .ag-ai-result table { border-collapse: collapse; width: 100%; }
    .ag-ai-result th { background: #1e293b; color: #94a3b8; padding: 4px 8px; font-size: 10px; }
    .ag-ai-result td { padding: 4px 8px; border-bottom: 1px solid #1e293b; }
    .ag-ai-result strong { color: #f1f5f9; }
    .ag-section-title { color: #7dd3fc; font-size: 12px; font-weight: 700; margin: 0 0 4px; }
    .ag-badges { display: flex; gap: 6px; flex-wrap: wrap; }

    /* Item links en respuestas IA */
    .ag-item-link { color: #38bdf8; cursor: pointer; border-bottom: 1px dashed #38bdf8; transition: color .15s; }
    .ag-item-link:hover { color: #7dd3fc; border-bottom-color: #7dd3fc; }

    /* Login overlay */
    .ag-login { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; padding: 24px; }
    .ag-login input { width: 100%; max-width: 260px; }
    .ag-login-title { color: #7dd3fc; font-size: 14px; font-weight: 700; }
    .ag-login-sub { color: #475569; font-size: 11px; }
    .ag-err { color: #ef4444; font-size: 11px; }
  `;

  // ── Markdown → HTML simple ─────────────────────────────────────────────────
  function md2html(text) {
    var html = '';
    var lines = text.split('\n');
    var inTable = false;
    var tableLines = [];

    function flushTable() {
      if (!tableLines.length) return;
      var rows = tableLines.map(function(l){ return l.split('|').slice(1,-1).map(function(c){ return c.trim(); }); });
      html += '<table><thead><tr>' + rows[0].map(function(c){ return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
      rows.slice(2).forEach(function(r){ html += '<tr>' + r.map(function(c){ return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; });
      html += '</tbody></table>';
      tableLines = []; inTable = false;
    }

    lines.forEach(function(line) {
      if (line.startsWith('|')) { inTable = true; tableLines.push(line); return; }
      if (inTable) flushTable();
      if (!line.trim()) { html += '<br>'; return; }
      if (line.startsWith('### ')) { html += '<strong style="color:#38bdf8;display:block;margin:8px 0 4px">' + esc(line.slice(4)) + '</strong>'; return; }
      if (line.startsWith('## ')) { html += '<strong style="color:#7dd3fc;display:block;margin:10px 0 4px;font-size:12px">' + esc(line.slice(3)) + '</strong>'; return; }
      if (line.startsWith('- ')) { html += '<div style="padding-left:10px;margin-bottom:2px">· ' + inlineMd(line.slice(2)) + '</div>'; return; }
      html += '<div style="margin-bottom:2px">' + inlineMd(line) + '</div>';
    });
    if (inTable) flushTable();
    return html;
  }

  function inlineMd(text) {
    return esc(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function esc(t) {
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Estado global del widget ───────────────────────────────────────────────
  var state = {
    open: false,
    tab: 'chat',
    loading: false,
    dataLoaded: false,
    inventario: [],
    inventarioIndex: [],
    inventarioIndexSource: null,
    inventarioIndexLen: 0,
    messages: [],
    contextItem: null,  // último ítem en contexto (para "este", "esta", etc.)
    contextAula: null,  // última aula mencionada en la conversación
    learnedIntents: [],
    formCorrections: [],
    // csv
    csvParsed: [],
    // audit filter
    auditFiltro: 'todos',
  };

  // ── DOM refs ───────────────────────────────────────────────────────────────
  var el = {};

  // ── Render helpers ─────────────────────────────────────────────────────────
  function badge(color, text) {
    return '<span class="ag-badge ag-badge-' + color + '">' + esc(text) + '</span>';
  }

  function renderBadgeEl(color, text) {
    var s = document.createElement('span');
    s.className = 'ag-badge ag-badge-' + color;
    s.textContent = text;
    return s;
  }

  // ── Carga de datos ─────────────────────────────────────────────────────────
  // Usa los arrays globales de la app (items, prestamos) si ya están cargados.
  // Fallback: llamada directa a la API con credenciales de SESSION.
  function loadData() {
    if (state.dataLoaded || state.loading) return;

    // Intento 1: Datos ya en memoria de la app
    if (typeof items !== 'undefined' && Array.isArray(items) && items.length > 0) {
      state.inventario = items;
      rebuildInventoryIndex(true);
      state.dataLoaded = true;
      updateStatusBadge('green', '● ' + state.inventario.length + ' ítems');
      renderCurrentTab();
      return;
    }

    // Intento 2: Esperar a que items esté disponible (si la app se está cargando aún)
    var attempts = 0;
    var waitForItems = setInterval(function() {
      attempts++;
      if (typeof items !== 'undefined' && Array.isArray(items) && items.length > 0) {
        clearInterval(waitForItems);
        state.inventario = items;
        rebuildInventoryIndex(true);
        state.dataLoaded = true;
        updateStatusBadge('green', '● ' + state.inventario.length + ' ítems');
        renderCurrentTab();
        return;
      }
      if (attempts > 10) {
        clearInterval(waitForItems);
        // Si sigue sin cargar, ir a fallback API
        loadFromAPI();
      }
    }, 200);
  }

  function loadFromAPI() {
    if (state.loading) return;
    state.loading = true;
    updateStatusBadge('yellow', '⏳ Cargando desde API...');
    var creds = getCreds();
    if (!creds) { updateStatusBadge('red', '❌ Sin sesión'); state.loading = false; return; }
    var u = encodeURIComponent(creds.u), p = encodeURIComponent(creds.p);

    fetch('/api/list?u=' + u + '&p=' + p).then(function(r){ return r.json(); })
      .then(function(listData) {
        state.inventario = Array.isArray(listData) ? listData : decompressItems(listData);
        rebuildInventoryIndex(true);
        state.dataLoaded = true;
        state.loading = false;
        updateStatusBadge('green', '● ' + state.inventario.length + ' ítems');
        renderCurrentTab();
      }).catch(function(e) {
        state.loading = false;
        updateStatusBadge('red', '❌ Error: ' + e.message);
        console.error('[Agente]', e);
      });
  }

  function updateStatusBadge(color, text) {
    if (!el.statusBadge) return;
    el.statusBadge.className = 'ag-badge ag-badge-' + color;
    el.statusBadge.textContent = text;
  }

  // ── Drag del FAB ───────────────────────────────────────────────────────────
  function makeFabDraggable(fab) {
    var POS_KEY = 'volt_fab_pos';
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch(e) {}
    if (saved && typeof saved.top === 'number' && typeof saved.left === 'number') {
      applyPos(saved.top, saved.left);
    }

    function applyPos(top, left) {
      // Asegurar que está dentro del viewport
      var maxLeft = window.innerWidth - fab.offsetWidth - 4;
      var maxTop = window.innerHeight - fab.offsetHeight - 4;
      top = Math.max(4, Math.min(top, maxTop));
      left = Math.max(4, Math.min(left, maxLeft));
      fab.style.top = top + 'px';
      fab.style.left = left + 'px';
      fab.style.right = 'auto';
    }

    var dragging = false;
    var moved = false;
    var startX = 0, startY = 0;
    var startLeft = 0, startTop = 0;

    function onDown(e) {
      var pt = e.touches ? e.touches[0] : e;
      dragging = true;
      moved = false;
      startX = pt.clientX;
      startY = pt.clientY;
      var rect = fab.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      fab.style.transition = 'none';
      if (e.cancelable) e.preventDefault();
      if (e.touches) {
        document.addEventListener('touchmove', onMove, { passive: true });
        document.addEventListener('touchend', onUp);
        document.addEventListener('touchcancel', onUp);
      }
    }

    function onMove(e) {
      if (!dragging) return;
      var pt = e.touches ? e.touches[0] : e;
      var dx = pt.clientX - startX;
      var dy = pt.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      applyPos(startTop + dy, startLeft + dx);
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', onUp);
      fab.style.transition = '';
      if (moved) {
        // Guardar posición
        var rect = fab.getBoundingClientRect();
        try { localStorage.setItem(POS_KEY, JSON.stringify({ top: rect.top, left: rect.left })); } catch(e) {}
      } else {
        // No se movió → click normal
        togglePanel();
      }
    }

    fab.addEventListener('mousedown', onDown);
    fab.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    // Reajustar si cambia el tamaño de ventana
    window.addEventListener('resize', function() {
      var rect = fab.getBoundingClientRect();
      applyPos(rect.top, rect.left);
    });
  }

  // ── Build UI ───────────────────────────────────────────────────────────────
  function buildWidget() {
    // Styles
    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // FAB
    var fab = document.createElement('button');
    fab.id = 'agente-fab';
    fab.title = 'Habla con ' + AGENTE_NOMBRE + ' (arrastra para mover)';
    fab.innerHTML = '🤖<span class="fab-txt"> Habla con ' + AGENTE_NOMBRE + '</span>';
    document.body.appendChild(fab);
    el.fab = fab;
    makeFabDraggable(fab);

    // Panel
    var panel = document.createElement('div');
    panel.id = 'agente-panel';
    panel.innerHTML = buildPanelHTML();
    document.body.appendChild(panel);
    el.panel = panel;

    // Refs
    el.statusBadge = panel.querySelector('#ag-status');

    // Tab clicks
    panel.querySelectorAll('.ag-tab').forEach(function(t) {
      t.addEventListener('click', function() { switchTab(t.dataset.tab); });
    });

    // Close
    panel.querySelector('#ag-close').addEventListener('click', closePanel);

    // Chat input
    el.chatInput = panel.querySelector('#ag-chat-input');
    el.chatInput.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
    el.chatInput.addEventListener('input', updateSuggestions);
    panel.querySelector('#ag-send').addEventListener('click', sendChat);
    panel.querySelector('#ag-scan').addEventListener('click', startScan);
    panel.querySelector('#ag-mic').addEventListener('click', startMic);
    panel.querySelector('#ag-clear').addEventListener('click', function() { limpiarPantallaChat(true); });

    // Quick actions
    panel.querySelectorAll('.ag-quick-btn').forEach(function(b) {
      b.addEventListener('click', function(){ sendChat(b.dataset.q); });
    });

    // Messages container
    el.messages = panel.querySelector('#ag-messages');



    // Audit btn
    panel.querySelectorAll('.ag-audit-filter').forEach(function(b){
      b.addEventListener('click', function(){ state.auditFiltro = b.dataset.f; renderAudit(); });
    });
    panel.querySelector('#ag-audit-btn').addEventListener('click', auditAI);

    // CSV
    var fileInput = panel.querySelector('#ag-csv-file');
    fileInput.addEventListener('change', function(e){
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function(ev){ panel.querySelector('#ag-csv-text').value = ev.target.result; };
      r.readAsText(f, 'utf-8');
    });
    panel.querySelector('#ag-csv-analyze').addEventListener('click', analyzeCSV);
    panel.querySelector('#ag-csv-import').addEventListener('click', importCSV);

    // Populate selects after data loads (called from loadData)
    // No hacer loadData aquí — se hace al abrir el panel
  }

  function buildPanelHTML() {
    var today = new Date().toISOString().split('T')[0];
    return [
      '<div class="ag-header">',
        '<span style="font-size:18px">🤖</span>',
        '<div class="ag-header-title">',
          '<div class="ag-title">AGENTE INVENTARIO</div>',
          '<div class="ag-sub">IES Juan Bosco</div>',
        '</div>',
        '<span id="ag-status" class="ag-badge ag-badge-yellow">⏳ Iniciando...</span>',
        '<button id="ag-close" class="ag-close" title="Cerrar">✕</button>',
      '</div>',

      '<div class="ag-tabs">',
        '<button class="ag-tab active" data-tab="chat">💬 Chat</button>',
        '<button class="ag-tab" data-tab="audit">🔍 Auditoría</button>',
        '<button class="ag-tab" data-tab="csv">📥 CSV</button>',
      '</div>',

      '<div class="ag-body">',

        // ── Chat ──
        '<div id="ag-tab-chat" class="ag-panel active" style="padding:0;gap:0;">',
          '<div id="ag-messages" class="ag-messages">',
            '<div style="text-align:center;padding:30px 16px;color:#475569;font-size:11px">',
              'Conectando con el inventario...',
            '</div>',
          '</div>',
          '<div id="ag-quick" class="ag-quick" style="display:none">',
            '<div id="ag-stats-bar" style="display:none;gap:5px;flex-wrap:wrap;padding:0 10px 6px"></div>',
            '<div style="padding:8px 10px;color:#64748b;font-size:9px;line-height:1.35;background:#0f172a;border-radius:7px;margin:0 10px 8px;border:1px solid #1e293b">',
              '<strong style="color:#7dd3fc;display:block;margin-bottom:4px;font-size:9px">💡 PUEDES DECIRME:</strong>',
              '<div style="margin-left:4px;color:#94a3b8">',
                '<div style="margin-bottom:2px">🔍 "¿Dónde está la Fusionadora de fibra?"</div>',
                '<div style="margin-bottom:2px">📋 "¿Quién tiene el Osciloscopio?" · "Préstamos activos"</div>',
                '<div style="margin-bottom:2px">✅ "Dame el multímetro" · "Necesito el soldador" · "Me llevo el taladro"</div>',
                '<div style="margin-bottom:2px">↩ "Devuelvo el osciloscopio" · "Ya lo he traído" · "Cerrar préstamo"</div>',
                '<div style="margin-bottom:2px">📦 "Añade un polímetro en el Aula 35" · "Dar de alta nuevo equipo"</div>',
                '<div style="margin-bottom:2px">📊 "Quedan 10 resistencias" · "Actualiza el stock a 25"</div>',
                '<div style="margin-bottom:2px">🔧 "El soldador se ha roto" · "Solicitar mantenimiento"</div>',
                '<div>⚠️ "¿Stock bajo?" · "¿Qué hay en el Aula 14?" · "¿Qué necesita reparación?"</div>',
              '</div>',
            '</div>',
          '</div>',
          '<div id="ag-suggestions" class="ag-quick" style="display:none;padding:8px 14px;border-top:1px solid #1e293b;gap:4px"></div>',
          '<div class="ag-input-row">',
            '<button id="ag-scan" class="ag-send" title="Escanear código QR / código de barras" style="background:#1e293b">📷</button>',
            '<button id="ag-mic" class="ag-send ag-mic-btn" title="Hablar por micrófono" style="background:#1e293b">🎤</button>',
            '<button id="ag-clear" class="ag-send" title="Borrar pantalla del chat" style="background:#1e293b">🧹</button>',
            '<input id="ag-chat-input" class="ag-input" placeholder="Dame el multímetro · Devuelvo el soldador · ¿Qué hay en Aula 35?">',
            '<button id="ag-send" class="ag-send" disabled>➤</button>',
          '</div>',
        '</div>',



        // ── Auditoría ──
        '<div id="ag-tab-audit" class="ag-panel">',
          '<p class="ag-section-title">🔍 Auditoría de Datos Incompletos</p>',
          '<div id="ag-audit-badges" class="ag-badges"></div>',
          '<div class="ag-badges" style="margin-top:6px">',
            '<button class="ag-quick-btn ag-audit-filter" data-f="todos">Todos</button>',
            '<button class="ag-quick-btn ag-audit-filter" data-f="cat">Sin categoría</button>',
            '<button class="ag-quick-btn ag-audit-filter" data-f="aula">Sin aula</button>',
            '<button class="ag-quick-btn ag-audit-filter" data-f="ref">Sin referencia</button>',
          '</div>',
          '<div id="ag-audit-table" class="ag-table-wrap"></div>',
          '<button id="ag-audit-btn" class="ag-btn ag-btn-blue">🤖 Sugerir correcciones con IA</button>',
          '<div id="ag-audit-result" class="ag-ai-result" style="display:none"></div>',
        '</div>',

        // ── CSV ──
        '<div id="ag-tab-csv" class="ag-panel">',
          '<p class="ag-section-title">📥 Importar CSV</p>',
          '<div class="ag-row">',
            '<label class="ag-btn" style="cursor:pointer">📁 Cargar archivo<input id="ag-csv-file" type="file" accept=".csv,.txt" style="display:none"></label>',
            '<button id="ag-csv-analyze" class="ag-btn">🤖 Analizar</button>',
            '<button id="ag-csv-import" class="ag-btn" disabled>📤 Importar</button>',
          '</div>',
          '<textarea id="ag-csv-text" class="ag-input-field" rows="5" placeholder="Pega CSV o carga archivo...\n\nNombre,Cantidad,Aula,Categoria\nOsciloscopio,2,Aula 14,Instrumentacion" style="resize:vertical;font-size:10px;font-family:monospace"></textarea>',
          '<div id="ag-csv-badges" class="ag-badges"></div>',
          '<div id="ag-csv-result" class="ag-ai-result" style="display:none"></div>',
        '</div>',

      '</div>', // ag-body
    ].join('');
  }

  // ── Toggle / open / close ──────────────────────────────────────────────────
  function togglePanel() {
    if (state.open) closePanel(); else openPanel();
  }
  function openPanel() {
    state.open = true;
    el.panel.classList.add('open');
    el.fab.innerHTML = '✕ Cerrar';
    if (!state.dataLoaded) loadData();
    else renderCurrentTab();
    if (!LEARN_LOADED) cargarAprendizajes();
    if (!FORM_CORRECTIONS_LOADED) cargarCorreccionesD1();
  }
  function closePanel() {
    state.open = false;
    el.panel.classList.remove('open');
    el.fab.innerHTML = '🤖 Habla con ' + AGENTE_NOMBRE;
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────
  function switchTab(tab) {
    state.tab = tab;
    el.panel.querySelectorAll('.ag-tab').forEach(function(t){ t.classList.toggle('active', t.dataset.tab === tab); });
    el.panel.querySelectorAll('.ag-panel').forEach(function(p){ p.classList.toggle('active', p.id === 'ag-tab-' + tab); });
    renderCurrentTab();
  }

  function renderCurrentTab() {
    if (!state.dataLoaded) return;
    if (state.tab === 'chat') renderChatReady();
    if (state.tab === 'audit') renderAudit();
  }

  // ── Navegación a items desde el chat ──────────────────────────────────────
  function navigateToItem(id) {
    var item = state.inventario.find(function(i) { return String(i.id) === String(id); });
    if (item) state.contextItem = item;
    closePanel();
    if (typeof openItemRoute === 'function') openItemRoute(id);
    else if (typeof openModal === 'function') openModal(id);
  }
  // Exponer globalmente para onclick en botones generados dinámicamente
  window.navigateToItem = navigateToItem;

  function linkifyItems(container) {
    if (!state.inventario.length) return;
    var nameMap = [];
    state.inventario.forEach(function(item) {
      var n = item.nombre || item.item || item.name || '';
      if (n && n.length > 2) nameMap.push({ name: n, id: item.id });
    });
    nameMap.sort(function(a, b) { return b.name.length - a.name.length; });

    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) nodes.push(node);

    nodes.forEach(function(textNode) {
      var parent = textNode.parentNode;
      if (!parent || parent.classList && parent.classList.contains('ag-item-link')) return;
      var text = textNode.textContent;
      var fragments = [{ text: text, isLink: false }];
      var matched = false;

      nameMap.forEach(function(entry) {
        var newFrags = [];
        fragments.forEach(function(frag) {
          if (frag.isLink) { newFrags.push(frag); return; }
          var lower = frag.text.toLowerCase();
          var idx = lower.indexOf(entry.name.toLowerCase());
          if (idx === -1) { newFrags.push(frag); return; }
          matched = true;
          if (idx > 0) newFrags.push({ text: frag.text.slice(0, idx), isLink: false });
          newFrags.push({ text: frag.text.slice(idx, idx + entry.name.length), isLink: true, id: entry.id });
          if (idx + entry.name.length < frag.text.length) newFrags.push({ text: frag.text.slice(idx + entry.name.length), isLink: false });
        });
        fragments = newFrags;
      });

      if (!matched) return;
      var span = document.createElement('span');
      fragments.forEach(function(frag) {
        if (frag.isLink) {
          var a = document.createElement('span');
          a.className = 'ag-item-link';
          a.title = 'Ver item en inventario';
          a.textContent = frag.text;
          a.addEventListener('click', (function(id) { return function() { navigateToItem(id); }; })(frag.id));
          span.appendChild(a);
        } else {
          span.appendChild(document.createTextNode(frag.text));
        }
      });
      parent.replaceChild(span, textNode);
    });
  }

  // ── Chat ───────────────────────────────────────────────────────────────────
  var _historyRestored = false;
  function renderChatReady() {
    var sendBtn = el.panel.querySelector('#ag-send');
    sendBtn.disabled = false;
    if (state.messages.length === 0) {
      // Restaurar historial persistido la primera vez (limpia el "Conectando...")
      if (!_historyRestored) {
        _historyRestored = true;
        el.messages.innerHTML = '';
        restoreHistory();
      }
      injectarStatsPanel();
      el.panel.querySelector('#ag-quick').style.display = 'flex';
      el.chatInput.focus();
    }
  }

  // ── Búsqueda inteligente en inventario ─────────────────────────────────────
  // Palabras vacías a ignorar (stop words en español)
  // Sinónimos del taller — se expanden antes de buscar
  var SINONIMOS = {
    'polimetro': ['multimetro', 'tester', 'poli', 'avometro'],
    'multimetro': ['polimetro', 'tester', 'poli', 'avometro'],
    'osciloscopio': ['osci', 'oscilos', 'osciloscopi'],
    'fuente de alimentacion': ['fuente alimentacion', 'fuente de tension', 'fuente tension', 'fuente', 'psu'],
    'soldador': ['cautín', 'cautin', 'estacion de soldadura', 'estacion soldadura'],
    'protoboard': ['placa de pruebas', 'breadboard', 'proto'],
    'condensador': ['capacitor', 'condensadores', 'conden'],
    'resistencia': ['resistor', 'resistencias'],
    'transistor': ['bjt', 'mosfet', 'transistores'],
    'cable': ['cables', 'latigillo', 'latiguillo', 'jumper'],
    'pinza': ['pinzas', 'amperimetro de pinza', 'pinza amperimetrica'],
    'generador de funciones': ['generador de señales', 'generador señales', 'gen funciones'],
    'ordenador': ['pc', 'computador', 'ordenadores'],
    'pantalla': ['monitor', 'display', 'pantallas'],
    'tablet': ['tableta', 'ipad'],
    'raspberry': ['raspberry pi', 'raspi'],
    'arduino': ['arduino uno', 'arduino mega', 'arduino nano'],
  };

  var STOP_WORDS = ['donde', 'dónde', 'esta', 'está', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para', 'que', 'qué', 'cual', 'cuál',
    'tiene', 'tienes', 'hay', 'cuanto', 'cuánto', 'cuanta', 'cuánta', 'cuantos', 'cuántos',
    'quiero', 'quieres', 'necesito', 'necesitas', 'puedo', 'puedes', 'pedir', 'prestado',
    'prestada', 'prestame', 'prestar', 'prestamelo', 'prestamela', 'devolver', 'devuelvo',
    'devuelve', 'devuelto', 'devuelta', 'retornar', 'entregar', 'entrego', 'traigo',
    'busco', 'buscar', 'usar', 'coger', 'sacar', 'llevar', 'llevarme', 'dame', 'dejame',
    'actualiza', 'actualizar', 'cambia', 'cambiar', 'modifica', 'modificar', 'editar',
    'edita', 'corrige', 'corregir', 'mover', 'mueve', 'trasladar', 'traslada', 'abre',
    'abrir', 'ficha', 'datos', 'aula', 'ubicacion', 'ubicación', 'categoria', 'categoría',
    'ciclo', 'modulo', 'módulo', 'proveedor', 'referencia', 'nombre', 'estado',
    'cantidad', 'stock', 'unidades', 'existencias', 'me', 'te', 'se', 'su', 'sus', 'mi', 'tu', 'es', 'son',
    'y', 'o', 'pero', 'si', 'no', 'lo', 'le', 'les', 'sobre', 'como', 'cómo'];

  function applySinonimos(words) {
    var extra = [];
    // Busca sinónimos tanto por palabra suelta como por frases de 2-3 palabras
    var phrase = words.join(' ');
    Object.keys(SINONIMOS).forEach(function(canonical) {
      var aliases = SINONIMOS[canonical];
      // Si la consulta contiene un alias, añadir la forma canónica
      aliases.forEach(function(alias) {
        if (phrase.indexOf(alias) !== -1 && extra.indexOf(canonical) === -1) {
          canonical.split(' ').forEach(function(w) { if (extra.indexOf(w) === -1) extra.push(w); });
        }
      });
      // Si la consulta contiene la forma canónica, añadir alias
      if (phrase.indexOf(canonical) !== -1) {
        aliases.forEach(function(alias) {
          alias.split(' ').forEach(function(w) { if (w.length >= 3 && extra.indexOf(w) === -1) extra.push(w); });
        });
      }
    });
    return words.concat(extra.filter(function(w) { return words.indexOf(w) === -1; }));
  }

  function extractKeywords(query) {
    // Convertir números en palabras antes de parsear
    var q = normalize(normalizarEntradaUsuario(query || ''))
      .replace(/[¿?¡!.,;:()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    var words = q.split(' ').filter(function(w) {
      return w.length >= 3 && STOP_WORDS.indexOf(w) === -1;
    });
    return applySinonimos(words);
  }

  // Variantes singular/plural de una palabra normalizada
  function singularPlural(w) {
    var forms = [w];
    if (w.endsWith('es') && w.length > 4) forms.push(w.slice(0, -2)); // ordenadores → ordenador
    if (w.endsWith('s') && w.length > 3)  forms.push(w.slice(0, -1)); // cables → cable
    if (!w.endsWith('s')) {
      forms.push(w + 's');    // cable → cables
      forms.push(w + 'es');   // ordenador → ordenadores
    }
    return forms.filter(function(f, i, a) { return a.indexOf(f) === i; });
  }

  // Expande keywords con singular/plural + raíz parcial (≥4 chars, 75% longitud)
  function expandKeywords(words) {
    var out = [];
    words.forEach(function(w) {
      singularPlural(w).forEach(function(f) { if (out.indexOf(f) === -1) out.push(f); });
      if (w.length >= 4) {
        var raiz = w.slice(0, Math.max(4, Math.floor(w.length * 0.75)));
        if (out.indexOf(raiz) === -1) out.push(raiz);
      }
    });
    return out;
  }

  function getItemName(item) {
    return (item && (item.item || item.nombre || item.name || '')) || '';
  }

  function getItemRef(item) {
    return (item && (item.ref || item.referencia || '')) || '';
  }

  function cleanLookupText(value) {
    return normalize(value || '')
      .replace(/[^a-z0-9áéíóúüñ\s_-]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compactLookupText(value) {
    return cleanLookupText(value).replace(/[^a-z0-9]/g, '');
  }

  function uniqueWords(words) {
    var seen = {};
    return words.filter(function(w) {
      if (!w || seen[w]) return false;
      seen[w] = true;
      return true;
    });
  }

  function rebuildInventoryIndex(force) {
    var inv = state.inventario || [];
    if (!force && state.inventarioIndexSource === inv && state.inventarioIndexLen === inv.length) {
      return state.inventarioIndex;
    }

    state.inventarioIndex = inv.map(function(item) {
      var name = cleanLookupText(getItemName(item));
      var ref = cleanLookupText(getItemRef(item));
      var aula = cleanLookupText(item.aula || item.classroom || '');
      var cat = cleanLookupText(item.cat || item.categoria || item.category || '');
      var loc = cleanLookupText(item.loc || item.ubicacion || '');
      var tags = cleanLookupText(item.tags || '');
      var code = cleanLookupText(item.code || '');
      var id = String(item.id || '');
      var text = [name, ref, aula, cat, loc, tags, code, id].join(' ').replace(/\s+/g, ' ').trim();
      var tokens = uniqueWords(text.split(/\s+/).filter(function(w) { return w.length >= 2; }));
      return {
        item: item,
        name: name,
        ref: ref,
        aula: aula,
        cat: cat,
        loc: loc,
        tags: tags,
        code: code,
        id: id,
        compactRef: compactLookupText(ref),
        compactCode: compactLookupText(code),
        compactId: compactLookupText(id),
        text: text,
        tokens: tokens
      };
    });
    state.inventarioIndexSource = inv;
    state.inventarioIndexLen = inv.length;
    return state.inventarioIndex;
  }

  function searchInventoryCandidates(query, maxResults) {
    if (!state.inventario.length) return [];
    var index = rebuildInventoryIndex(false);
    var preparedQuery = normalizarEntradaUsuario(query || '');
    var nQuery = cleanLookupText(preparedQuery);
    var compactQuery = compactLookupText(preparedQuery);
    var keywords = extractKeywords(preparedQuery);
    var kwExp = expandKeywords(keywords);
    if (!nQuery && !keywords.length) return [];

    var candidatos = index.map(function(row) {
      var i = row.item;
      var name = row.name;
      var aula = row.aula;
      var cat = row.cat;
      var ref = row.ref;
      var score = 0;

      if (compactQuery) {
        if (row.compactId && row.compactId === compactQuery) score += 32;
        if (row.compactCode && row.compactCode === compactQuery) score += 30;
        if (row.compactRef && row.compactRef === compactQuery) score += 28;
        else if (row.compactRef && row.compactRef.indexOf(compactQuery) !== -1 && compactQuery.length >= 3) score += 12;
      }

      if (nQuery && name) {
        if (name === nQuery) score += 16;
        else if (name.indexOf(nQuery) !== -1) score += 10;
        else if (nQuery.indexOf(name) !== -1 && name.length > 3) score += 6;
        else if (nQuery.length >= 4) {
          // Fuzzy: prefijo común de al menos 4 chars
          var minLen = Math.min(nQuery.length, name.length);
          var common = 0;
          for (var ci = 0; ci < minLen; ci++) { if (nQuery[ci] === name[ci]) common++; else break; }
          if (common >= 4) score += Math.round(4 * common / nQuery.length);
        }
      }

      kwExp.forEach(function(kw) {
        if (!kw) return;
        // Forma exacta puntúa más que variante expandida
        var isExact = keywords.indexOf(kw) !== -1;
        var mul = isExact ? 1 : 0.6;
        if (name === kw) score += Math.round(14 * mul);
        else if (name.indexOf(kw + ' ') === 0 || name.indexOf(kw) === 0) score += Math.round(8 * mul);
        else if (name.indexOf(kw) !== -1) score += Math.round(5 * mul);

        if (ref === kw) score += Math.round(10 * mul);
        else if (ref && ref.indexOf(kw) !== -1) score += Math.round(6 * mul);

        if (aula && aula.indexOf(kw) !== -1) score += Math.round(2 * mul);
        if (cat && cat.indexOf(kw) !== -1) score += Math.round(1 * mul);
        if (row.loc && row.loc.indexOf(kw) !== -1) score += Math.round(1 * mul);
        if (row.tags && row.tags.indexOf(kw) !== -1) score += Math.round(2 * mul);
      });

      return { item: i, score: score };
    }).filter(function(x) {
      return x.score >= 6;
    });

    candidatos.sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return getItemName(a.item).localeCompare(getItemName(b.item));
    });

    return candidatos.slice(0, maxResults || 8);
  }

  // Devuelve los objetos completos de items que coinciden (no strings)
  function searchInventoryItems(query) {
    var candidatos = searchInventoryCandidates(query, 8);
    if (!candidatos.length) return null;
    if (candidatos.length === 1) return [candidatos[0].item];
    if (candidatos[0].score >= candidatos[1].score + 6) return [candidatos[0].item];
    return candidatos.map(function(c) { return c.item; });
  }

  function searchInventory(query) {
    if (!state.inventario.length) return null;

    var keywords = extractKeywords(query);
    console.log('[Volt DEBUG] Keywords extraídas:', keywords);

    if (keywords.length === 0) return null;

    // Buscar items que contengan AL MENOS UNA keyword (con variantes singular/plural y parcial)
    var kwExpanded = expandKeywords(keywords);
    var matches = rebuildInventoryIndex(false).filter(function(row) {
      return kwExpanded.some(function(kw) { return row.text.includes(kw); });
    }).map(function(row) { return row.item; });

    console.log('[Volt DEBUG] Matches encontrados:', matches.length);

    if (matches.length === 0) return null;

    // Si hay demasiados resultados, ordenar por relevancia (cuántas keywords coinciden)
    if (matches.length > 20) {
      matches.sort(function(a, b) {
        var textoA = (a.nombre || a.name || '').toLowerCase();
        var textoB = (b.nombre || b.name || '').toLowerCase();
        var scoreA = keywords.filter(function(kw){ return textoA.includes(kw); }).length;
        var scoreB = keywords.filter(function(kw){ return textoB.includes(kw); }).length;
        return scoreB - scoreA;
      });
      matches = matches.slice(0, 20);
    }

    // Formatear resultados para la IA
    var resultados = matches.map(function(i) {
      var qty = i.qty != null ? i.qty : (i.cantidad || 0);
      var min = i.min != null ? i.min : (i.stock_min || 0);
      var nombre = i.nombre || i.name || i.item || '(sin nombre)';
      var aula = i.aula || i.classroom || '—';
      var ref = i.ref || i.referencia || '—';
      return nombre + ' | Aula: ' + aula + ' | Stock: ' + qty + ' (mín: ' + min + ') | Ref: ' + ref;
    });

    return resultados;
  }

  // ── Detección de consultas de stock ───────────────────────────────────────
  function checkStockQuery(query) {
    var q = normalizarEntradaUsuario(query || '').toLowerCase();
    var menciona_stock_bajo = /stock\s+(bajo|minimo|mínimo|critic)|bajo\s+(de\s+)?stock|bajo\s+mín|escasea|agot|sin\s+stock|stock\s+cero|critico/.test(q);
    var menciona_listado_aula = /(items?|materiales?|que\s+hay|qué\s+hay)\s+.*(aula|en\s+el)/.test(q);

    if (!menciona_stock_bajo && !menciona_listado_aula) return null;

    // Extraer número de aula si se menciona
    var aulaMatch = q.match(/aula\s*(\d+|[a-z]+)/i);
    var aulaQ = aulaMatch ? aulaMatch[1].toLowerCase() : null;

    var inv = state.inventario;
    function qty(i){ return Number(i.qty != null ? i.qty : (i.cantidad || 0)); }
    function minimo(i){ return Number(i.min != null ? i.min : (i.stock_min || 0)); }

    // Filtrar por aula si se especificó
    var filtrados = inv;
    if (aulaQ) {
      filtrados = inv.filter(function(i) {
        var a = (i.aula || '').toLowerCase();
        return a.includes(aulaQ);
      });
    }

    if (menciona_stock_bajo) {
      // Items con stock REALMENTE bajo: qty < minimo Y minimo > 0
      var bajoMin = filtrados.filter(function(i) { return minimo(i) > 0 && qty(i) < minimo(i); });
      // Items sin stock
      var sinStock = filtrados.filter(function(i) { return qty(i) === 0; });

      if (bajoMin.length === 0 && sinStock.length === 0) {
        return '\n\n✅ NO HAY ITEMS BAJO STOCK MÍNIMO' + (aulaQ ? ' en aulas que contengan "' + aulaQ + '"' : '') +
          '. Todos los ' + filtrados.length + ' items revisados están OK. Responde explícitamente que no hay items con stock bajo.';
      }

      var lista = bajoMin.slice(0, 30).map(function(i) {
        var nombre = i.item || i.nombre || i.name || '';
        return nombre + ' | Aula: ' + (i.aula || '—') + ' | Stock: ' + qty(i) + ' | Mínimo: ' + minimo(i);
      });

      return '\n\n⚠️ ITEMS BAJO STOCK MÍNIMO' + (aulaQ ? ' (filtrado aula "' + aulaQ + '")' : '') + ' (' + bajoMin.length + ' total, sin stock: ' + sinStock.length + '):\n' +
        lista.join('\n') +
        '\n\nIMPORTANTE: Solo lista estos items. NO inventes otros. Si está vacío, di que no hay.';
    }

    if (menciona_listado_aula && aulaQ) {
      // Lista de items del aula (limitado para no exceder tokens)
      var lista2 = filtrados.slice(0, 30).map(function(i) {
        var nombre = i.item || i.nombre || i.name || '';
        return nombre + ' | Stock: ' + qty(i) + (minimo(i) > 0 ? ' (mín: ' + minimo(i) + ')' : '');
      });
      return '\n\n📦 ITEMS EN AULA "' + aulaQ + '" (' + filtrados.length + ' total' + (filtrados.length > 30 ? ', mostrando 30' : '') + '):\n' +
        lista2.join('\n') + '\n\nUSA ESTA LISTA. No inventes datos.';
    }

    return null;
  }

  // ── Contexto conversacional: extrae item/aula de mensajes anteriores ─────────
  function resolverContextoConversacional(q) {
    var n = normalize(q);
    var esReferencia = matchAny(n, [
      'ese', 'esa', 'ese mismo', 'esa misma', 'el mismo', 'la misma',
      'el anterior', 'la anterior', 'ese item', 'esa pieza', 'ese equipo',
      'cuantos hay', 'cuantas hay', 'y alli', 'y en el aula', 'y en la',
      'tambien', 'igualmente', 'los mismos', 'las mismas', 'y ahi', 'y alla'
    ]);

    var aulaDetectada = extraerAulaDeFrase(q);
    if (aulaDetectada) state.contextAula = aulaDetectada;
    else if (state.contextAula && esReferencia) aulaDetectada = state.contextAula;

    var itemCtx = state.contextItem || null;
    if (esReferencia && !itemCtx) {
      for (var i = state.messages.length - 2; i >= 0 && i >= state.messages.length - 8; i--) {
        var msg = state.messages[i];
        if (!msg || !msg.content) continue;
        var cands = searchInventoryCandidates(msg.content, 3);
        if (cands.length) { itemCtx = cands[0].item; state.contextItem = itemCtx; break; }
      }
    }

    return { item: itemCtx, aula: aulaDetectada, esReferencia: esReferencia };
  }

  // ── Ficha completa de un item (stock + ubicación + estado + préstamos) ────────
  function mostrarFichaItem(item) {
    var qty = item.qty != null ? item.qty : (item.cantidad || 0);
    var min = item.min != null ? item.min : (item.stock_min || 0);
    var nombre = item.item || item.nombre || item.name || '(sin nombre)';
    var aula = item.aula || '—';
    var loc = item.loc || item.ubicacion || '—';
    var estado = item.cond || item.estado_item || item.status || '—';
    var ref = item.ref || item.referencia || '—';
    var cat = item.cat || item.categoria || '—';
    var mant = (item.mant == 1 || item.mant === '1') ? '⚠ Pendiente' : '✅ OK';
    var prestActivos = (typeof prestamos !== 'undefined' ? prestamos : []).filter(function(p) {
      return p.estado === 'Activo' && String(p.itemId) === String(item.id);
    });
    var stockColor = (min > 0 && Number(qty) < Number(min)) ? '#ef4444' : '#34d399';

    var html =
      '<div style="margin-bottom:6px"><strong style="color:#7dd3fc;font-size:12px">' + esc(nombre) + '</strong>' +
      ' <span style="color:#475569;font-size:10px">· ' + esc(ref) + '</span>' +
      ' <button onclick="if(window.navigateToItem)window.navigateToItem(' + Number(item.id) + ')" ' +
      'style="font-size:9px;padding:2px 6px;background:#1e293b;border:1px solid #334155;border-radius:4px;color:#7dd3fc;cursor:pointer;margin-left:6px">✏ Editar ficha</button></div>' +
      '<table class="ag-table" style="width:100%;margin-top:4px"><tbody>' +
      '<tr><td style="color:#94a3b8;width:90px">Aula</td><td>' + esc(aula) + '</td>' +
          '<td style="color:#94a3b8;width:90px">Ubicación</td><td>' + esc(loc) + '</td></tr>' +
      '<tr><td style="color:#94a3b8">Stock</td><td style="color:' + stockColor + ';font-weight:700">' + qty +
          (min > 0 ? ' <span style="color:#64748b;font-weight:400">(mín: ' + min + ')</span>' : '') + '</td>' +
          '<td style="color:#94a3b8">Estado</td><td>' + esc(estado) + '</td></tr>' +
      '<tr><td style="color:#94a3b8">Categoría</td><td>' + esc(cat) + '</td>' +
          '<td style="color:#94a3b8">Mant.</td><td>' + mant + '</td></tr>' +
      '</tbody></table>';

    if (prestActivos.length) {
      html += '<div style="margin-top:6px;color:#fbbf24;font-size:10px">📤 Prestado a: ' +
        prestActivos.map(function(p) {
          return esc(p.profesorNombre || '—') + ' · ' + esc(p.aulaDestino || '—') + ' (' + p.cantidad + ' ud.)';
        }).join(', ') + '</div>';
    }

    state.contextItem = item;
    appendMsgHtml(html);
  }

  function ctxExtra() {
    if (!state.inventario.length) return '';
    var inv = state.inventario;
    var aulas = [];
    inv.forEach(function(i){ if(i.aula && aulas.indexOf(i.aula)<0) aulas.push(i.aula); });
    var bajoMin = inv.filter(function(i){ return Number(i.min||i.stock_min)>0 && Number(i.qty??i.cantidad) < Number(i.min||i.stock_min); });

    return '\n\n📦 INVENTARIO DISPONIBLE:\n' +
      'Total: ' + inv.length + ' items | Aulas: ' + (aulas.length > 0 ? aulas.join(', ') : 'no cargadas') + ' | Bajo stock: ' + bajoMin.length + '\n' +
      'El usuario preguntará por materiales. Usa SIEMPRE los resultados de búsqueda que se proporcionan.';
  }

  // ── Sugerencias inteligentes mientras escribe ────────────────────────────────
  function updateSuggestions() {
    var input = normalizarEntradaUsuario(el.chatInput.value.trim()).toLowerCase();
    var sugDiv = el.panel.querySelector('#ag-suggestions');
    if (!input || input.length < 2) { sugDiv.style.display = 'none'; return; }

    var suggestions = [];

    // Detectar patrón de búsqueda
    if (input.includes('dónde') || input.includes('donde') || input.includes('busco') || input.includes('buscar')) {
      suggestions.push({ text: '🔍 Buscar por aula', q: '¿' + input + '?' });
    }
    if (input.includes('quién') || input.includes('quien') || input.includes('tiene') ||
        input.includes('prestamos activos') || input.includes('préstamos activos')) {
      suggestions.push({ text: '📍 Ver préstamos activos', q: input });
    }
    if (input.includes('pedir') || input.includes('prestado') || input.includes('dame') ||
        input.includes('préstame') || input.includes('prestame') || input.includes('coger') ||
        input.includes('llevarme') || input.includes('prestar') || input.includes('necesito') ||
        input.includes('reservar') || input.includes('usar') || input.includes('sacar')) {
      suggestions.push({ text: '✅ Registrar préstamo', q: input });
    }
    if (input.includes('devolver') || input.includes('devuelvo') || input.includes('retornar') ||
        input.includes('traigo') || input.includes('entrego') || input.includes('devuelto') ||
        input.includes('devuelta') || input.includes('vuelta') || input.includes('cerrar prestamo') ||
        input.includes('cerrar préstamo')) {
      suggestions.push({ text: '↩ Registrar devolución', q: input });
    }
    if (input.includes('añadir') || input.includes('anadir') || input.includes('crear') ||
        input.includes('nuevo') || input.includes('agregar') || input.includes('dar de alta') ||
        input.includes('alta') || input.includes('inventariar') || input.includes('registrar entrada') ||
        input.includes('meter en inventario') || input.includes('ha llegado') || input.includes('hemos comprado')) {
      suggestions.push({ text: '📦 Crear nuevo item', q: input });
    }
    if (input.includes('editar') || input.includes('modificar') || input.includes('corregir') ||
        input.includes('cambiar aula') || input.includes('cambiar ubicacion') || input.includes('cambiar ubicación') ||
        input.includes('mover') || input.includes('trasladar') || input.includes('abre la ficha') ||
        input.includes('abrir ficha')) {
      suggestions.push({ text: '✏️ Abrir ficha para editar', q: input });
    }
    if (input.includes('stock') || input.includes('minimo') || input.includes('mínimo') ||
        input.includes('cantidad') || input.includes('unidades') || input.includes('reponer')) {
      suggestions.push({ text: '📊 Ver/actualizar stock', q: input });
    }
    if (input.includes('mantenimiento') || input.includes('reparar') || input.includes('avería') ||
        input.includes('averia') || input.includes('revisar') || input.includes('arreglar')) {
      suggestions.push({ text: '🔧 Mantenimiento / estado', q: input });
    }
    if (input.includes('aula') || input.includes('clase') || input.includes('taller') ||
        input.includes('laboratorio') || input.includes('sala')) {
      suggestions.push({ text: '🏫 Ver resumen del aula', q: '¿Qué hay en el ' + input + '?' });
    }
    if (input.includes('auditar') || input.includes('completo') || input.includes('incompleto')) {
      suggestions.push({ text: '⚠️ Ejecutar auditoría', q: input });
    }

    // Si no hay sugerencias específicas, mostrar materiales que coincidan
    if (!suggestions.length && state.inventario.length) {
      var matching = searchInventoryCandidates(input, 3).map(function(row) { return row.item; });

      matching.forEach(function(item) {
        var itemName = getItemName(item);
        suggestions.push({
          text: '🔗 ' + itemName + ' (' + (item.aula || '—') + ')',
          q: '¿Dónde está ' + itemName + '?'
        });
      });
    }

    if (suggestions.length) {
      sugDiv.innerHTML = '';
      suggestions.forEach(function(s) {
        var btn = document.createElement('button');
        btn.className = 'ag-quick-btn';
        btn.style.fontSize = '10px';
        btn.textContent = s.text;
        btn.addEventListener('click', function() { el.chatInput.value = s.q; el.chatInput.focus(); updateSuggestions(); });
        sugDiv.appendChild(btn);
      });
      sugDiv.style.display = 'flex';
    } else {
      sugDiv.style.display = 'none';
    }
  }

  // ── Detectar intención de préstamo ────────────────────────────────────────
  function detectarIntencionPrestamo(query) {
    var q = normalize(normalizarEntradaUsuario(query || ''));  // normalize() quita tildes → un solo patrón por palabra
    var scored = scoreIntentions(q);
    if (scored && scored.tipo === 'prestamo') return true;
    var patrones = ['pedir prestado', 'pedirlo prestado', 'pedirla prestada', 'prestamo',
      'prestar el', 'prestar la', 'prestar un', 'prestar una', 'prestamo de',
      'puedo pedir', 'me llevo', 'me lo llevo', 'me la llevo', 'cojo', 'cogemos', 'tomo prestado',
      'facilitar prestamo', 'dejar prestado', 'dejarme', 'lo quiero', 'la quiero',
      'lo necesito', 'la necesito', 'quiero pedir', 'quiero coger', 'quiero usar', 'reservar',
      'abre el formulario', 'abrir formulario', 'abrir el formulario', 'rellenar formulario',
      'quiero el', 'quiero la', 'pedirla', 'pedirlo', 'pidela', 'pidelo',
      'tramitar', 'tramitalo', 'gestionar prestamo', 'solicitar', 'solicito',
      'si por favor', 'dale', 'venga', 'adelante',
      // pedir / coger / llevar
      'dame el', 'dame la', 'dame un', 'dame una', 'deme el', 'deme la', 'deme un', 'deme una',
      'pasame el', 'pasame la', 'pasame un', 'pasame una',
      'prestame', 'prestamelo', 'prestamela', 'prestanos', 'prestanos el', 'prestanos la',
      'dejame', 'dejamelo', 'dejamela', 'dejanos', 'dejanos el', 'dejanos la',
      'me hace falta', 'nos hace falta', 'necesito usar', 'necesito coger', 'necesitamos usar',
      'necesito el', 'necesito la', 'necesito un', 'necesito una',
      'necesitamos el', 'necesitamos la', 'necesitamos un', 'necesitamos una',
      'voy a coger', 'voy a llevarme', 'voy a usar', 'voy a tomar', 'voy a pedir',
      'vamos a coger', 'vamos a usar', 'vamos a llevarnos', 'me lo llevo prestado', 'me la llevo prestada',
      'coger prestado', 'sacar prestado', 'sacar del almacen', 'sacar del inventario',
      'puedo usar', 'puedo coger', 'puedo llevarme', 'puedo tomar', 'puedes prestarme',
      'me lo cojo', 'me la cojo', 'cojo el', 'cojo la', 'cojo un', 'cojo una',
      'cogemos el', 'cogemos la', 'cogemos un', 'cogemos una',
      'me lo tomo', 'me la tomo', 'tomo el', 'tomo la', 'saco el', 'saco la', 'saco un', 'saco una',
      'llevarme el', 'llevarme la', 'llevarme un', 'llevarme una', 'llevarnos el', 'llevarnos la',
      'quiero cogerlo', 'quiero cogerla', 'quiero tomarlo', 'quiero tomarla',
      'quiero llevarmelo', 'quiero llevarmela', 'quiero sacarlo', 'quiero sacarla',
      'me interesa', 'me quedo con', 'me quedo ese', 'me quedo esa',
      'ese quiero', 'esa quiero', 'lo pido', 'la pido', 'lo solicito', 'la solicito',
      'ponlo a mi nombre', 'ponla a mi nombre', 'a mi nombre',
      // registrar préstamo
      'apuntar prestamo', 'anotar prestamo', 'registrar prestamo',
      'apunta un prestamo', 'anota un prestamo', 'registra un prestamo',
      'hacer el prestamo', 'abrir prestamo', 'nuevo prestamo', 'formalizar prestamo',
      'crear prestamo', 'dar salida', 'salida de material',
      // frases implícitas coloquiales
      'me llevo prestado', 'me llevo prestada', 'en prestamo',
      'para llevarme', 'quiero llevarlo', 'quiero llevarla'];
    if (patrones.some(function(p) { return q.includes(p); })) return true;

    // Si la última respuesta del agente mencionó abrir un formulario de préstamo,
    // tratar respuestas afirmativas cortas como confirmación
    var lastAI = null;
    for (var i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === 'assistant') { lastAI = normalize(state.messages[i].content); break; }
    }
    var afirmaciones = ['si', 'ok', 'vale', 'yes', 'claro', 'por supuesto', 'efectivamente', 'correcto'];
    if (lastAI && (lastAI.includes('prestamo') || lastAI.includes('formulario'))) {
      if (afirmaciones.indexOf(q) !== -1 || q.length < 12 && afirmaciones.some(function(a){ return q.startsWith(a); })) {
        return true;
      }
    }
    return false;
  }

  function detectarIntencionAnadirItem(query) {
    var q = normalizarEntradaUsuario(query || '').toLowerCase().trim();
    var n = normalize(q);
    var scored = scoreIntentions(n);
    if (scored && scored.tipo !== 'anadir' && scored.score >= 7) return false;
    if (scored && scored.tipo === 'anadir') return true;
    var patrones = ['añadir', 'anadir', 'agregar', 'crear', 'nuevo item', 'nuevo ítem', 'nuevo material',
      'añadir item', 'anadir item', 'agregar item', 'crear item', 'registro nuevo', 'registrar nuevo',
      'incluir material', 'meter item', 'poner item', 'nuevo producto', 'alta item', 'alta material',
      'incorporar', 'incorpora', 'incluir nuevo', 'añadir material', 'anadir material', 'agregar material',
      'meter material', 'crear material', 'registrar material', 'registrar equipo',
      // dar de alta
      'dar de alta', 'darlo de alta', 'darla de alta', 'quiero dar de alta', 'quiero registrar',
      'nueva alta', 'alta nuevo', 'alta nueva', 'alta de equipo', 'alta de instrumento',
      'alta en inventario', 'alta de material', 'alta de item',
      // inventariar
      'inventariar', 'inventariarlo', 'inventariarla', 'quiero inventariar', 'necesito inventariar',
      'meter inventario', 'registrar inventario',
      // entrada al inventario
      'entrada al inventario', 'entrada de material', 'entrada de item', 'entrada de ítem',
      'meter al inventario', 'meter en el inventario', 'poner al inventario', 'poner en el inventario',
      'añadir al inventario', 'agregar al inventario', 'anadir al inventario', 'incluir en el inventario',
      'apuntar en el inventario', 'registrar en inventario', 'registrar entrada',
      'nueva entrada', 'entrada nueva', 'dar entrada', 'recepcionar material',
      // nueva adquisición
      'nueva adquisicion', 'nueva adquisición', 'hemos adquirido', 'hemos comprado',
      'he comprado', 'han comprado', 'compra nueva', 'material comprado',
      'acaba de llegar', 'acabamos de recibir', 'nos han traído', 'nos han traido',
      'nos han dado', 'han llegado nuevos', 'han llegado nuevas', 'ha llegado nuevo', 'ha llegado nueva',
      'ha llegado material', 'llego material', 'recibido material',
      'llega nuevo', 'llega nueva', 'nuevo equipo', 'nuevo aparato', 'nuevo instrumento',
      'nuevo dispositivo', 'nueva herramienta', 'nueva maquina', 'nueva máquina',
      // quiero/necesito crear
      'quiero crear', 'necesito crear', 'necesito añadir', 'necesito agregar', 'necesito anadir',
      'quiero incluir', 'quiero dar entrada', 'dar entrada a', 'puedes crear', 'puedes añadir',
      'puedes anadir', 'puedes registrar'];
    return patrones.some(function(p) { return q.includes(p); });
  }

  // Palabras que indican cantidad (con tolerancia a typos frecuentes)
  var CANT_WORDS = /unidades?|uniade[s]?|uniades?|ud\.?s?|uds?|piezas?|items?|equipos?|cables?|rollos?|ejemplares?/;

  // Convierte números en letras (español) a dígitos — para dictado por voz
  function textToNumber(q) {
    var UNITS = {
      'cero':0,'un':1,'uno':1,'una':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,
      'seis':6,'siete':7,'ocho':8,'nueve':9,'diez':10,'once':11,'doce':12,
      'trece':13,'catorce':14,'quince':15,'dieciseis':16,'diecisiete':17,
      'dieciocho':18,'diecinueve':19,'veinte':20,'veintiun':21,'veintiuno':21,
      'veintidos':22,'veintitres':23,'veinticuatro':24,'veinticinco':25,
      'veintiseis':26,'veintisiete':27,'veintiocho':28,'veintinueve':29,
      'treinta':30,'cuarenta':40,'cincuenta':50,'sesenta':60,'setenta':70,
      'ochenta':80,'noventa':90,'cien':100,'ciento':100,'doscientos':200,
      'trescientos':300,'cuatrocientos':400,'quinientos':500,'seiscientos':600,
      'setecientos':700,'ochocientos':800,'novecientos':900,'mil':1000
    };
    // Reemplazar patrones compuestos: "treinta y dos" → 32, "ciento veinte" → 120
    return q.replace(/\b([a-záéíóúü]+(?:\s+y\s+[a-záéíóúü]+)?)\b/gi, function(match) {
      var m = normalize(match);
      // "X y Y" → suma
      var yMatch = m.match(/^(\w+)\s+y\s+(\w+)$/);
      if (yMatch && UNITS[yMatch[1]] !== undefined && UNITS[yMatch[2]] !== undefined) {
        return UNITS[yMatch[1]] + UNITS[yMatch[2]];
      }
      // palabra simple
      if (UNITS[m] !== undefined) return UNITS[m];
      return match;
    });
  }

  // Correcciones frecuentes de Web Speech y dictado en taller.
  var VOICE_CORRECTIONS = [
    [/\bvolt[,.]?\s+/gi, ''],
    [/\bbol[dt][,.]?\s+/gi, ''],
    [/\bpol[ií]\s+metro\b/gi, 'polimetro'],
    [/\bpoli\s+metro\b/gi, 'polimetro'],
    [/\bmulti\s+metro\b/gi, 'multimetro'],
    [/\btester\b/gi, 'multimetro'],
    [/\boscilo\s+scopio\b/gi, 'osciloscopio'],
    [/\bostiloscopio\b/gi, 'osciloscopio'],
    [/\boscilos?copio\b/gi, 'osciloscopio'],
    [/\bproto\s+board\b/gi, 'protoboard'],
    [/\bproto\s+bord\b/gi, 'protoboard'],
    [/\bfuente\s+de\s+tensi[oó]n\b/gi, 'fuente de alimentacion'],
    [/\bfuente\s+alimentaci[oó]n\b/gi, 'fuente de alimentacion'],
    [/\bestaci[oó]n\s+soldadura\b/gi, 'estacion de soldadura'],
    [/\bcaut[ií]n\b/gi, 'soldador'],
    [/\bclase\s+(\d+)\b/gi, 'aula $1'],
    [/\bde\s+volver\b/gi, 'devolver'],
    [/\bde\s+vuelvo\b/gi, 'devuelvo'],
    [/\bde\s+vuelve\b/gi, 'devuelve'],
    [/\bpr[eé]sta\s*me\b/gi, 'prestame'],
    [/\bpr[eé]sta\s*nos\b/gi, 'prestanos'],
    [/\bestoc\b/gi, 'stock'],
    [/\bestoque\b/gi, 'stock'],
    [/\ba\s*ver[ií]a\b/gi, 'averia'],
    [/\ba\s*veri[ao]d[ao]\b/gi, 'averiado'],
    [/\bactuali[sz]a\b/gi, 'actualiza'],
    [/\bmante\s*nimiento\b/gi, 'mantenimiento'],
    [/\bmante\s*nimineto\b/gi, 'mantenimiento'],
    [/\bdeteriora\s*d[ao]\b/gi, 'deteriorado'],
    [/\bcanti\s*dad\b/gi, 'cantidad'],
    [/\bhistori[ae]l\b/gi, 'historial'],
    [/\bprest[ae]mo\b/gi, 'prestamo']
  ];

  function normalizarEntradaUsuario(text) {
    var q = String(text || '').trim();
    if (!q) return '';
    q = q.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    q = textToNumber(q);
    VOICE_CORRECTIONS.forEach(function(rule) {
      q = q.replace(rule[0], rule[1]);
    });
    q = q.replace(/\baula\s+(\d+)\b/gi, 'Aula $1');
    q = q.replace(/\s+/g, ' ').trim();
    return q;
  }

  // Extrae cantidad numérica de una frase: "añadir 4 soldadores" → 4
  function extraerCantidadDeFrase(query) {
    var q = normalize(normalizarEntradaUsuario(query || ''));
    // "X unidades/ud/piezas..." en cualquier posición (incluyendo typos)
    var m = q.match(new RegExp('\\b(\\d+)\\s*(?:' + CANT_WORDS.source + ')\\b'));
    if (m) return parseInt(m[1], 10);
    // Número inmediatamente tras verbo (infinitivo o imperativo): "añadir 4 micrófonos", "añade 4 router"
    m = q.match(/(?:anadir|anade|agregar|agrega|crear|crea|registrar|registra|meter|mete|poner|pon|comprar|recibir|alta\s+de?)\s+(\d+)\b/);
    if (m) return parseInt(m[1], 10);
    // Coma + número: "micrófono, 4 unidades"
    m = q.match(/,\s*(\d+)\b/);
    if (m) return parseInt(m[1], 10);
    // Número al inicio: "4 soldadores"
    m = q.match(/^(\d+)\s+\w/);
    if (m) return parseInt(m[1], 10);
    // Número suelto al final (sin unidades): "router 3"
    m = q.match(/\s+(\d+)$/);
    if (m && parseInt(m[1], 10) <= 50) return parseInt(m[1], 10);
    return null;
  }

  function extraerNombreItem(query) {
    var q = normalize(normalizarEntradaUsuario(query || ''));
    // 1. Quitar el verbo de acción (primera aparición)
    var verbos = ['quiero anadir', 'quiero agregar', 'quiero crear', 'quiero añadir',
      'anade un', 'anade una', 'anade el', 'anade la', 'anade',
      'anadir un', 'anadir una', 'anadir el', 'anadir la', 'anadir',
      'añadir un', 'añadir una', 'añadir el', 'añadir la', 'añadir',
      'agrega un', 'agrega una', 'agrega el', 'agrega la', 'agrega',
      'agregar un', 'agregar una', 'agregar', 'crea un', 'crea una', 'crea',
      'crear un', 'crear una', 'crear', 'registra un', 'registra una', 'registra',
      'nuevo', 'nueva', 'registrar', 'incorporar', 'incorpora', 'meter', 'mete', 'poner', 'pon'];
    var resto = q;
    for (var i = 0; i < verbos.length; i++) {
      var idx = resto.indexOf(verbos[i]);
      if (idx !== -1) { resto = resto.substring(idx + verbos[i].length).trim(); break; }
    }
    // 2. Quitar número inicial con "unidades" (typos incluidos): "6 uniades del 555" → "del 555"
    resto = resto.replace(/^\d+\s*(?:unidades?|uniade[s]?|uniades?|ud\.?s?|uds?|piezas?)\s*(?:del?|de la|de los)?\s*/i, '').trim();
    // 2b. Quitar número inicial sin unidades: "3 routers" → "routers", "5 router" → "router"
    resto = resto.replace(/^\d+\s+/, '').trim();
    // 3. Quitar artículos iniciales
    resto = resto.replace(/^(un|una|el|la|los|las|de)\s+/i, '').trim();
    // 4. Cortar en cantidad + unidades en cualquier posición: "micrófono, 4 unidades" → "micrófono"
    resto = resto.replace(/,?\s*\d+\s*(?:unidades?|uniade[s]?|uniades?|ud\.?s?|uds?|piezas?|items?|equipos?)\b.*/i, '').trim();
    // 4b. Quitar número suelto al final si es plausible como cantidad (≤50): "router 3" → "router"
    resto = resto.replace(/\s+(\d+)$/, function(m, n) { return parseInt(n, 10) <= 50 ? '' : m; }).trim();
    // 5. Cortar en preposiciones de lugar/contexto
    var corte = resto.search(/\s+(?:en el|en la|en aula|en clase|en taller|en el aula|para el|para la|al aula)\b/i);
    if (corte > 0) resto = resto.substring(0, corte).trim();
    // 5. Cortar en puntuación
    return resto.split(/[.,;:?!]/)[0].trim() || '';
  }

  function buscarItemsSimilares(nombre, limite) {
    var n = normalize(nombre || '');
    if (!n || n.length < 3 || !state.inventario || !state.inventario.length) return [];
    var words = n.split(/\s+/).filter(function(w) {
      return w.length >= 3 && STOP_WORDS.indexOf(w) === -1;
    });
    if (!words.length) return [];

    var scored = state.inventario.map(function(item) {
      var nombreItem = item.item || item.nombre || item.name || '';
      var textoNombre = normalize(nombreItem);
      var textoCompleto = normalize([
        nombreItem,
        item.ref || item.referencia || '',
        item.cat || item.categoria || ''
      ].join(' '));
      var score = 0;
      if (textoNombre === n) score += 20;
      if (textoNombre.includes(n) || n.includes(textoNombre)) score += 12;
      words.forEach(function(w) {
        if (textoNombre.includes(w)) score += 5;
        else if (textoCompleto.includes(w)) score += 2;
      });
      return { item: item, score: score };
    }).filter(function(row) {
      return row.score >= 5;
    });

    scored.sort(function(a, b) { return b.score - a.score; });
    return scored.slice(0, limite || 5).map(function(row) { return row.item; });
  }

  function actualizarAvisoSimilares(formDiv) {
    var input = formDiv.querySelector('.ag-new-item-name');
    var box = formDiv.querySelector('.ag-new-item-similar');
    if (!input || !box) return;
    var similares = buscarItemsSimilares(input.value, 5);
    if (!similares.length) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    box.style.display = 'block';
    box.innerHTML =
      '<strong style="color:#fbbf24">⚠ Ya existen ' + similares.length + ' ítem' + (similares.length !== 1 ? 's' : '') + ' similar' + (similares.length !== 1 ? 'es' : '') + ':</strong>' +
      '<div style="margin-top:5px;display:grid;gap:3px">' +
        similares.map(function(it) {
          var qty = it.qty != null ? it.qty : (it.cantidad || 0);
          var nombreItem = it.item || it.nombre || it.name || '(sin nombre)';
          return '<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid #1f2937;padding-top:3px">' +
            '<span style="color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(nombreItem) + '</span>' +
            '<span style="color:#64748b;white-space:nowrap">' + esc(it.aula || '—') + ' · ' + qty + ' ud.</span>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div style="margin-top:5px;color:#64748b">Puedes crearlo igualmente si es un material distinto.</div>';
  }

  function mostrarFormularioNuevoItem(nombreInicial, fraseCompleta, cantidadInicial) {
    var formDiv = document.createElement('div');
    formDiv.className = 'ag-msg ag-msg-ai';
    formDiv.style.cssText = 'max-width:95%;background:#0f172a;border:1px solid #10b981;overflow:visible;';

    var aulaOptions = [];
    var cicloOptions = [];
    var catOptions = [];

    // Cargar aulas desde la lista oficial AULAS
    if (AULAS && AULAS.length > 0) {
      AULAS.forEach(function(a) {
        aulaOptions.push({id: a.id, name: a.name});
      });
    }

    // Cargar categorías del inventario
    if (state.inventario && state.inventario.length > 0) {
      state.inventario.forEach(function(i) {
        if (i.cat && catOptions.indexOf(i.cat) === -1) catOptions.push(i.cat);
      });
    }
    catOptions.sort();

    // Cargar ciclos
    if (CICLOS && CICLOS.length > 0) {
      CICLOS.forEach(function(c) {
        cicloOptions.push({id: c.id, name: c.name});
      });
    }

    var selectAula = '<select class="ag-input-field ag-new-item-aula" style="padding:7px"><option value="">-- Seleccionar aula --</option>' +
      aulaOptions.map(function(a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>'; }).join('') + '</select>';
    
    var selectCat = '<select class="ag-input-field ag-new-item-cat" style="padding:7px"><option value="">-- Seleccionar categoría --</option>' +
      catOptions.map(function(c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('') + '</select>';
    
    var selectCiclo = '<select class="ag-input-field ag-new-item-ciclo" style="padding:7px"><option value="">-- Seleccionar ciclo --</option>' +
      cicloOptions.map(function(c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') + '</select>';
    
    var selectMod = '<select class="ag-input-field ag-new-item-mod" style="padding:7px"><option value="">-- Seleccionar módulo --</option></select>';

    formDiv.innerHTML =
      '<div style="margin-bottom:10px"><strong style="color:#10b981">📦 Crear nuevo item:</strong></div>' +
      '<label class="ag-label">Nombre del item *</label>' +
      '<input class="ag-input-field ag-new-item-name" placeholder="Ej: Osciloscopio digital" value="' + esc(nombreInicial || '') + '">' +
      '<div class="ag-new-item-similar" style="display:none;margin-top:6px;padding:7px 8px;background:#111827;border:1px solid #334155;border-radius:6px;font-size:10px;color:#94a3b8;line-height:1.35"></div>' +
      '<div style="display:flex;gap:6px;margin-top:6px">' +
        '<div style="flex:1"><label class="ag-label">Tipo *</label>' +
        '<select class="ag-input-field ag-new-item-tipo" style="padding:7px"><option value="consumible">Consumible</option><option value="inventariable">Inventariable</option></select></div>' +
        '<div style="width:80px"><label class="ag-label">Cantidad</label>' +
        '<input class="ag-input-field ag-new-item-qty" type="number" min="0" value="1"></div>' +
        '<div style="width:80px"><label class="ag-label">Mínimo</label>' +
        '<input class="ag-input-field ag-new-item-min" type="number" min="0" value="0"></div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;margin-top:6px">' +
        '<div style="flex:1"><label class="ag-label">Aula *</label>' + selectAula + '</div>' +
        '<div style="flex:1"><label class="ag-label">Categoría *</label>' + selectCat + '</div>' +
      '</div>' +
      '<label class="ag-label" style="margin-top:6px">Ubicación</label>' +
      '<input class="ag-input-field ag-new-item-loc" placeholder="Ej: Armario metálico, Estantería A3...">' +
      '<div style="display:flex;gap:6px;margin-top:6px">' +
        '<div style="flex:1"><label class="ag-label">Ciclo/Departamento</label>' + selectCiclo + '</div>' +
        '<div style="flex:1"><label class="ag-label">Asignatura/Módulo</label>' + selectMod + '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">' +
        '<label class="ag-label" style="margin:0">Foto (opcional)</label>' +
        '<button type="button" class="ag-btn ag-new-item-foto-btn" style="padding:4px 10px;font-size:11px">📷 Seleccionar</button>' +
        '<input class="ag-new-item-foto" type="file" accept="image/*" capture="environment" style="display:none">' +
      '</div>' +
      '<div class="ag-new-item-foto-preview" style="margin-top:4px;max-height:100px;border-radius:4px;overflow:hidden"></div>' +
      '<label class="ag-label" style="margin-top:6px">Observaciones</label>' +
      '<textarea class="ag-input-field ag-new-item-obs" style="height:50px;resize:vertical" placeholder="Notas adicionales..."></textarea>' +
      '<div style="display:flex;gap:6px;margin-top:10px">' +
        '<button class="ag-btn ag-btn-blue ag-new-item-submit" style="flex:1">✅ Crear item</button>' +
        '<button class="ag-btn ag-new-item-cancel">Cancelar</button>' +
      '</div>' +
      '<div class="ag-new-item-result" style="margin-top:8px;font-size:11px"></div>';

    el.messages.appendChild(formDiv);
    el.messages.scrollTop = el.messages.scrollHeight;

    var nameInput = formDiv.querySelector('.ag-new-item-name');
    var cicloSelect = formDiv.querySelector('.ag-new-item-ciclo');
    var modSelect = formDiv.querySelector('.ag-new-item-mod');

    actualizarAvisoSimilares(formDiv);
    nameInput.addEventListener('input', function() { actualizarAvisoSimilares(formDiv); });
    nameInput.focus();

    // Cargar módulos cuando se selecciona un ciclo
    cicloSelect.addEventListener('change', function() {
      var cicloId = cicloSelect.value;
      modSelect.innerHTML = '<option value="">-- Seleccionar módulo --</option>';
      if (cicloId && CICLOS) {
        var ciclo = CICLOS.find(function(c) { return c.id === cicloId; });
        if (ciclo && ciclo.modulos && ciclo.modulos.length > 0) {
          ciclo.modulos.forEach(function(m) {
            var opt = document.createElement('option');
            opt.value = cicloId + '__' + m.cod;
            opt.textContent = m.name;
            modSelect.appendChild(opt);
          });
        }
      }
    });

    // Autocompletar DESPUÉS de registrar el listener de ciclo, para que el dispatchEvent('change') llene los módulos
    if (fraseCompleta) autocompletarFormulario(formDiv, fraseCompleta);
    if (cantidadInicial && cantidadInicial > 0) {
      var qtyInput = formDiv.querySelector('.ag-new-item-qty');
      if (qtyInput) qtyInput.value = cantidadInicial;
    }

    formDiv.querySelector('.ag-new-item-cancel').addEventListener('click', function() {
      formDiv.remove();
    });

    var fotoInput = formDiv.querySelector('.ag-new-item-foto');
    var fotoPreview = formDiv.querySelector('.ag-new-item-foto-preview');
    var fotoData = null;

    formDiv.querySelector('.ag-new-item-foto-btn').addEventListener('click', function() {
      fotoInput.click();
    });

    fotoInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) { fotoData = null; fotoPreview.innerHTML = ''; return; }
      var reader = new FileReader();
      reader.onload = function(event) {
        var MAX = 360, QUALITY = 0.45;
        var raw = new Image();
        raw.onload = function() {
          var w = raw.width, h = raw.height;
          if (w > MAX || h > MAX) {
            if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
            else        { w = Math.round(w * MAX / h); h = MAX; }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(raw, 0, 0, w, h);
          fotoData = canvas.toDataURL('image/jpeg', QUALITY);
          var img = document.createElement('img');
          img.src = fotoData;
          img.style.cssText = 'max-width:100%;max-height:100px;border-radius:4px';
          fotoPreview.innerHTML = '';
          fotoPreview.appendChild(img);
        };
        raw.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    formDiv.querySelector('.ag-new-item-submit').addEventListener('click', function() {
      var nombre = nameInput.value.trim();
      if (!nombre) { nameInput.focus(); nameInput.style.borderColor = '#ef4444'; return; }

      var tipo = formDiv.querySelector('.ag-new-item-tipo').value;
      var qty = Number(formDiv.querySelector('.ag-new-item-qty').value) || 1;
      var min = Number(formDiv.querySelector('.ag-new-item-min').value) || 0;
      var aula = formDiv.querySelector('.ag-new-item-aula').value || null;
      var cat = formDiv.querySelector('.ag-new-item-cat').value || null;
      var ciclo = formDiv.querySelector('.ag-new-item-ciclo').value || null;
      var mod = formDiv.querySelector('.ag-new-item-mod').value || null;
      var loc = formDiv.querySelector('.ag-new-item-loc').value.trim() || null;
      var obs = formDiv.querySelector('.ag-new-item-obs').value.trim();
      var resultEl = formDiv.querySelector('.ag-new-item-result');

      if (!aula) { formDiv.querySelector('.ag-new-item-aula').focus(); formDiv.querySelector('.ag-new-item-aula').style.borderColor = '#ef4444'; return; }
      if (!cat) { formDiv.querySelector('.ag-new-item-cat').focus(); formDiv.querySelector('.ag-new-item-cat').style.borderColor = '#ef4444'; return; }

      resultEl.innerHTML = '⏳ Creando item...';
      resultEl.style.color = '#94a3b8';

      var newItem = {
        item: nombre,
        ref: (typeof _autoRef === 'function') ? _autoRef(nombre) : null,
        aula: aula,
        qty: qty,
        min: min,
        cat: cat,
        loc: loc,
        tipo_material: tipo,
        proveedor: null,
        obs: obs || null,
        mod: mod,
        est: null,
        util: null,
        fecha: new Date().toISOString().split('T')[0],
        mant: 0,
        foto: fotoData || null,
        tags: '',
        es_contenedor: 0,
        oculto: 0
      };

      apiPost('/api/item', {
        action: 'add',
        item: newItem
      }).then(function(res) {
        if (res.ok && res.item) {
          resultEl.innerHTML = '✅ Item creado: ' + esc(nombre) + ' (#' + res.item.id + ')';
          resultEl.style.color = '#34d399';
          formDiv.querySelector('.ag-new-item-submit').disabled = true;
          formDiv.querySelector('.ag-new-item-submit').textContent = '✅ Guardado';
          detectarYGuardarCorreccion(formDiv, fraseCompleta);
          guardarAprendizaje(fraseCompleta, 'anadir');
          if (typeof items !== 'undefined' && Array.isArray(items)) {
            items.push(res.item);
            state.inventario = items;
            rebuildInventoryIndex(true);
          } else if (typeof loadData === 'function') {
            state.dataLoaded = false;
            setTimeout(function() { loadData(); }, 500);
          }
        } else {
          resultEl.innerHTML = '❌ Error: ' + (res.error || 'No se pudo crear el item');
          resultEl.style.color = '#ef4444';
        }
      }).catch(function(e) {
        resultEl.innerHTML = '❌ Error: ' + e.message;
        resultEl.style.color = '#ef4444';
      });
    });
  }

  function mostrarFormularioPrestamo(item, queryOriginal) {
    var formDiv = document.createElement('div');
    formDiv.className = 'ag-msg ag-msg-ai';
    formDiv.style.cssText = 'max-width:95%;background:#0f172a;border:1px solid #38bdf8';

    var qty = item.qty != null ? item.qty : (item.cantidad || 0);
    var nombreItem = item.item || item.nombre || item.name || '(sin nombre)';

    var min = Number(item.min || item.stock_min || 0);
    formDiv.innerHTML =
      '<div style="margin-bottom:10px"><strong style="color:#7dd3fc">📋 Solicitar préstamo:</strong><br>' +
      '<span style="color:#e2e8f0">' + esc(nombreItem) + '</span><br>' +
      '<small style="color:#64748b">Aula: ' + esc(item.aula || '—') + ' · Stock: ' + qty + (min > 0 ? ' · Mín: ' + min : '') + '</small></div>' +
      '<label class="ag-label">Profesor/a que lo solicita *</label>' +
      '<input class="ag-input-field ag-loan-prof" placeholder="Ej: Juan García">' +
      '<div style="display:flex;gap:6px;margin-top:6px">' +
        '<div style="flex:1"><label class="ag-label">Aula destino</label>' +
        '<input class="ag-input-field ag-loan-aula" placeholder="Aula 14"></div>' +
        '<div style="width:80px"><label class="ag-label">Cantidad</label>' +
        '<input class="ag-input-field ag-loan-qty" type="number" min="1" max="' + qty + '" value="1"></div>' +
      '</div>' +
      '<div class="ag-loan-stock-warn" style="display:none;margin-top:6px;padding:5px 8px;border-radius:6px;background:#7c2d12;color:#fca5a5;font-size:11px"></div>' +
      '<label class="ag-label" style="margin-top:6px">Devolución prevista</label>' +
      '<input class="ag-input-field ag-loan-date" type="date" min="' + new Date().toISOString().split('T')[0] + '">' +
      '<div style="display:flex;gap:6px;margin-top:10px">' +
        '<button class="ag-btn ag-btn-blue ag-loan-submit" style="flex:1">✅ Registrar préstamo</button>' +
        '<button class="ag-btn ag-loan-cancel">Cancelar</button>' +
      '</div>' +
      '<div class="ag-loan-result" style="margin-top:8px;font-size:11px"></div>';

    el.messages.appendChild(formDiv);
    el.messages.scrollTop = el.messages.scrollHeight;

    var profInput = formDiv.querySelector('.ag-loan-prof');

    // Autocompletar desde la frase original
    if (queryOriginal) {
      var autoMsgs = [];
      var profe = extraerProfesorDeFrase(queryOriginal);
      if (profe) { profInput.value = profe; autoMsgs.push('👤 ' + profe); }
      var cant = extraerCantidadDeFrase(queryOriginal);
      if (cant && cant > 1) {
        var qtyEl = formDiv.querySelector('.ag-loan-qty');
        if (qtyEl) { qtyEl.value = Math.min(cant, qty); autoMsgs.push('× ' + Math.min(cant, qty)); }
      }
      var fecha = extraerFechaDevolucion(queryOriginal);
      if (fecha) {
        var dateEl = formDiv.querySelector('.ag-loan-date');
        if (dateEl) { dateEl.value = fecha; autoMsgs.push('📅 ' + fecha); }
      }
      if (autoMsgs.length) {
        var loanResult = formDiv.querySelector('.ag-loan-result');
        if (loanResult) {
          loanResult.style.color = '#64748b';
          loanResult.innerHTML = '✨ ' + autoMsgs.join(' · ');
        }
      }
    }

    // Aviso stock al cambiar cantidad
    var qtyInput = formDiv.querySelector('.ag-loan-qty');
    var stockWarn = formDiv.querySelector('.ag-loan-stock-warn');
    function checkStockWarn() {
      if (!stockWarn || !min) return;
      var cant = Number(qtyInput.value) || 1;
      var restante = qty - cant;
      if (restante < min) {
        stockWarn.style.display = 'block';
        stockWarn.textContent = '⚠ Quedarán ' + restante + ' uds. (mínimo: ' + min + ')';
      } else {
        stockWarn.style.display = 'none';
      }
    }
    if (qtyInput) { qtyInput.addEventListener('input', checkStockWarn); checkStockWarn(); }

    // Enfocar el primer campo vacío obligatorio
    if (!profInput.value) profInput.focus();
    else { var aulaEl2 = formDiv.querySelector('.ag-loan-aula'); if (aulaEl2) aulaEl2.focus(); }

    formDiv.querySelector('.ag-loan-cancel').addEventListener('click', function() {
      formDiv.remove();
    });

    formDiv.querySelector('.ag-loan-submit').addEventListener('click', function() {
      var profesor = profInput.value.trim();
      if (!profesor) { profInput.focus(); profInput.style.borderColor = '#ef4444'; return; }

      var aula = formDiv.querySelector('.ag-loan-aula').value.trim();
      var cantidad = Number(formDiv.querySelector('.ag-loan-qty').value) || 1;
      var fecha = formDiv.querySelector('.ag-loan-date').value;
      var resultEl = formDiv.querySelector('.ag-loan-result');

      resultEl.innerHTML = '⏳ Registrando préstamo...';
      resultEl.style.color = '#94a3b8';

      var hoy = new Date().toISOString().replace('T',' ').slice(0,19);
      apiPost('/api/prestar', {
        action: 'prestar',
        prestamo: {
          itemId: item.id,
          itemNombre: item.item || item.nombre || item.name || '',
          cantidad: cantidad,
          aulaOrigen: item.aula || '',
          aulaDestino: aula,
          profesorId: '',
          profesorNombre: profesor,
          gestionadoPor: profesor,
          fechaPrestamo: hoy,
          fechaPrevista: fecha,
          fechaDevolucion: '',
          cantidadDevuelta: 0,
          estado: 'Activo',
          obs: ''
        }
      }).then(function(res) {
        resultEl.innerHTML = '✅ Préstamo registrado correctamente';
        resultEl.style.color = '#34d399';
        formDiv.querySelector('.ag-loan-submit').disabled = true;
        formDiv.querySelector('.ag-loan-submit').textContent = '✅ Guardado';
        guardarAprendizaje(queryOriginal, 'prestamo');
      }).catch(function(e) {
        resultEl.innerHTML = '❌ Error: ' + e.message;
        resultEl.style.color = '#ef4444';
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // PARSER CENTRAL DE INTENCIONES
  // ══════════════════════════════════════════════════════════════════
  function normalize(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  // Distancia de Levenshtein — usada para tolerar errores de transcripción
  // de voz (Web Speech) o typos de teclado al comparar contra los patrones
  // de intención, sin necesitar una lista infinita de correcciones manuales.
  function levenshtein(a, b) {
    if (a === b) return 0;
    var la = a.length, lb = b.length;
    if (!la) return lb;
    if (!lb) return la;
    if (Math.abs(la - lb) > 3) return Math.max(la, lb); // demasiado distinto, no compensa calcular
    var prev = new Array(lb + 1);
    for (var j = 0; j <= lb; j++) prev[j] = j;
    for (var i = 1; i <= la; i++) {
      var cur = [i];
      for (j = 1; j <= lb; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[lb];
  }

  // Tolerancia según longitud de palabra: cuanto más larga, más margen de error admite.
  function maxEditDistance(len) {
    if (len <= 4) return 0;   // palabras cortas: exigir exactitud (evita falsos positivos)
    if (len <= 7) return 1;
    return 2;
  }

  // ¿"text" contiene "pattern", exacto o con pequeñas variaciones de transcripción/typeo?
  // Primero intenta substring exacto (barato); si falla, compara pattern contra cada
  // ventana de palabras consecutivas de "text" de longitud similar, con distancia de edición.
  function fuzzyIncludes(text, pattern) {
    if (!text || !pattern) return false;
    if (text.indexOf(pattern) !== -1) return true;
    if (pattern.length < 5) return false; // patrones cortos: solo exacto, ambiguo tolerar error

    var patWords = pattern.split(' ');
    var textWords = text.split(' ');
    var n = patWords.length;
    for (var i = 0; i + n <= textWords.length; i++) {
      var window = textWords.slice(i, i + n).join(' ');
      if (Math.abs(window.length - pattern.length) > maxEditDistance(pattern.length) + 2) continue;
      if (levenshtein(window, pattern) <= maxEditDistance(pattern.length)) return true;
    }
    return false;
  }

  function matchAny(q, list) {
    return list.some(function(p) { return fuzzyIncludes(q, p); });
  }

  function detectarComandoLimpiarPantalla(query) {
    var n = normalize(query || '');
    return matchAny(n, [
      'borra la pantalla', 'borrar la pantalla', 'limpia la pantalla', 'limpiar la pantalla',
      'borra pantalla', 'limpia pantalla', 'borra el chat', 'borrar el chat',
      'limpia el chat', 'limpiar el chat', 'vaciar chat', 'vacia el chat',
      'borra conversacion', 'borrar conversacion', 'limpia conversacion',
      'nueva conversacion', 'reinicia el chat', 'reset chat'
    ]);
  }

  var INTENT_LABELS = {
    anadir: 'Añadir ítem',
    prestamo: 'Préstamo',
    devolver: 'Devolución',
    stock: 'Stock',
    estado: 'Estado',
    mantenimiento: 'Mantenimiento',
    editar: 'Editar ficha',
    quien_tiene: 'Préstamos activos',
    resumen_aula: 'Resumen aula',
    stock_bajo: 'Stock bajo',
    lista_mantenimiento: 'Lista mantenimiento'
  };

  var LEARN_LOADED = false; // flag: ya cargado desde backend en esta sesión
  var MIGRATE_FLAG = 'volt_intents_migrated_v1';
  var FORM_CORRECTIONS_LOADED = false;

  function apiCreds() {
    var c = getCreds();
    if (!c) return '';
    if (c.t) return '?u=' + encodeURIComponent(c.u) + '&t=' + encodeURIComponent(c.t);
    return '?u=' + encodeURIComponent(c.u) + '&p=' + encodeURIComponent(c.p || '');
  }

  // Carga aprendizajes desde backend; fallback a localStorage si falla
  function cargarAprendizajes(callback) {
    var creds = apiCreds();
    if (!creds) {
      _cargarAprendizajesLocal();
      if (callback) callback();
      return;
    }
    fetch('/api/intent-learning' + creds)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.ok && Array.isArray(data.items)) {
          state.learnedIntents = data.items.map(function(x) {
            return { phrase: x.phraseNorm, raw: x.phraseRaw, intent: x.intent, id: x.id, weight: x.weight };
          }).filter(function(x) { return INTENT_LABELS[x.intent]; });
          LEARN_LOADED = true;
          _migrarLocalStorageSiNecesario();
        } else {
          _cargarAprendizajesLocal();
        }
        if (callback) callback();
      })
      .catch(function() {
        _cargarAprendizajesLocal();
        if (callback) callback();
      });
  }

  function _cargarAprendizajesLocal() {
    try {
      var raw = localStorage.getItem(LEARN_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      state.learnedIntents = Array.isArray(parsed) ? parsed.filter(function(x) {
        return x && x.phrase && x.intent && INTENT_LABELS[x.intent];
      }).slice(-80) : [];
    } catch(e) {
      state.learnedIntents = [];
    }
  }

  function _migrarLocalStorageSiNecesario() {
    if (localStorage.getItem(MIGRATE_FLAG)) return;
    var raw = null;
    try { raw = localStorage.getItem(LEARN_KEY); } catch(e) {}
    if (!raw) { localStorage.setItem(MIGRATE_FLAG, '1'); return; }
    var items = [];
    try { items = JSON.parse(raw) || []; } catch(e) {}
    if (!Array.isArray(items) || !items.length) { localStorage.setItem(MIGRATE_FLAG, '1'); return; }
    var payload = items.filter(function(x) { return x.phrase && INTENT_LABELS[x.intent]; })
      .map(function(x) { return { phrase: x.raw || x.phrase, intent: x.intent }; });
    if (!payload.length) { localStorage.setItem(MIGRATE_FLAG, '1'); return; }
    fetch('/api/intent-learning/bulk-import' + apiCreds(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payload })
    }).then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.ok) {
          localStorage.setItem(MIGRATE_FLAG, '1');
          cargarAprendizajes(); // recargar desde backend tras migración
        }
      })
      .catch(function() {});
  }

  function guardarAprendizaje(frase, intent) {
    var phrase = normalize(frase || '');
    if (!phrase || !INTENT_LABELS[intent]) return false;
    // Actualización optimista en memoria
    state.learnedIntents = state.learnedIntents.filter(function(x) {
      return !(x.phrase === phrase && x.intent === intent);
    });
    state.learnedIntents.push({ phrase: phrase, raw: frase, intent: intent });
    // Persistir en backend
    var creds = apiCreds();
    if (creds) {
      fetch('/api/intent-learning' + creds, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase: frase, intent: intent })
      }).then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.ok) cargarAprendizajes(); // sincronizar IDs y weights
        })
        .catch(function() {
          // fallback: guardar en localStorage si backend falla
          try { localStorage.setItem(LEARN_KEY, JSON.stringify(state.learnedIntents.slice(-80))); } catch(e) {}
        });
    } else {
      try { localStorage.setItem(LEARN_KEY, JSON.stringify(state.learnedIntents.slice(-80))); } catch(e) {}
    }
    return true;
  }

  function learnedIntentScore(n, phrase) {
    if (!n || !phrase) return 0;
    if (n === phrase) return 28;
    if (n.includes(phrase) || phrase.includes(n)) return 22;
    var words = phrase.split(/\s+/).filter(function(w) { return w.length > 3; });
    if (!words.length) return 0;
    var hits = words.filter(function(w) { return fuzzyIncludes(n, w); }).length;
    return hits >= Math.ceil(words.length * 0.7) ? 14 : 0;
  }

  // ── Aprendizaje de correcciones en formulario de nuevo ítem ───────────────
  function _fraseWords(fraseN) {
    return fraseN.split(/\s+/).filter(function(w) { return w.length >= 3; });
  }

  function phraseSimilarity(fa, fb) {
    var wa = _fraseWords(fa);
    var wbSet = {};
    _fraseWords(fb).forEach(function(w) { wbSet[w] = 1; });
    if (!wa.length || !Object.keys(wbSet).length) return 0;
    var hits = wa.filter(function(w) { return wbSet[w]; }).length;
    return hits / Math.max(wa.length, Object.keys(wbSet).length);
  }

  // Carga correcciones desde D1; fallback a localStorage si falla o no hay sesión
  function cargarCorreccionesD1() {
    var creds = apiCreds();
    if (!creds) {
      _cargarCorreccionesLocal();
      return;
    }
    fetch('/api/form-corrections' + creds)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.ok && Array.isArray(data.items)) {
          state.formCorrections = data.items.map(function(x) {
            return { fraseN: x.fraseNorm, aulaId: x.aulaId, cicloId: x.cicloId, modCod: x.modCod, catId: x.catId, nombreItem: x.nombreItem || null };
          });
          FORM_CORRECTIONS_LOADED = true;
          // Sincronizar a localStorage como caché offline
          try { localStorage.setItem(FORM_CORRECTIONS_KEY, JSON.stringify(state.formCorrections)); } catch(e) {}
        } else {
          _cargarCorreccionesLocal();
        }
      })
      .catch(function() { _cargarCorreccionesLocal(); });
  }

  function _cargarCorreccionesLocal() {
    try { state.formCorrections = JSON.parse(localStorage.getItem(FORM_CORRECTIONS_KEY) || '[]'); } catch(e) { state.formCorrections = []; }
    FORM_CORRECTIONS_LOADED = true;
  }

  function cargarCorreccionesFormulario() {
    if (!FORM_CORRECTIONS_LOADED) _cargarCorreccionesLocal();
    return state.formCorrections;
  }

  function guardarCorreccionFormulario(entry) {
    // Actualización optimista en memoria
    state.formCorrections = state.formCorrections.filter(function(x) { return x.fraseN !== entry.fraseN; });
    state.formCorrections.push(entry);
    if (state.formCorrections.length > FORM_CORRECTIONS_MAX) state.formCorrections = state.formCorrections.slice(-FORM_CORRECTIONS_MAX);
    // Caché offline
    try { localStorage.setItem(FORM_CORRECTIONS_KEY, JSON.stringify(state.formCorrections)); } catch(e) {}
    // Persistir en D1
    var creds = apiCreds();
    if (creds) {
      fetch('/api/form-corrections' + creds, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fraseNorm: entry.fraseN, aulaId: entry.aulaId, cicloId: entry.cicloId, modCod: entry.modCod, catId: entry.catId, nombreItem: entry.nombreItem || null })
      }).catch(function() {});
    }
  }

  function consultarCorreccionAprendida(frase) {
    var fraseN = normalize(normalizarEntradaUsuario(frase));
    var list = cargarCorreccionesFormulario();
    var best = null, bestScore = 0;
    list.forEach(function(entry) {
      var score = phraseSimilarity(fraseN, entry.fraseN);
      if (score > bestScore) { bestScore = score; best = entry; }
    });
    return bestScore >= 0.55 ? best : null;
  }

  function detectarYGuardarCorreccion(formDiv, frase) {
    var sug = formDiv._voltSugerencias;
    if (!sug || !frase) return;
    var aulaFinal    = (formDiv.querySelector('.ag-new-item-aula')  || {}).value || null;
    var cicloFinal   = (formDiv.querySelector('.ag-new-item-ciclo') || {}).value || null;
    var modFinal     = (formDiv.querySelector('.ag-new-item-mod')   || {}).value || null;
    var catFinal     = (formDiv.querySelector('.ag-new-item-cat')   || {}).value || null;
    var nombreFinal  = (formDiv.querySelector('.ag-new-item-name')  || {}).value || null;
    if (nombreFinal) nombreFinal = nombreFinal.trim() || null;
    var cambios = [];
    if (aulaFinal   !== sug.aulaId)    cambios.push('aula');
    if (cicloFinal  !== sug.cicloId)   cambios.push('ciclo');
    if (modFinal    !== sug.modCod)    cambios.push('módulo');
    if (catFinal    !== sug.catId)     cambios.push('categoría');
    if (nombreFinal !== sug.nombreItem) cambios.push('nombre');
    if (!cambios.length) return;
    guardarCorreccionFormulario({
      fraseN:     normalize(normalizarEntradaUsuario(frase)),
      aulaId:     aulaFinal,
      cicloId:    cicloFinal,
      modCod:     modFinal,
      catId:      catFinal,
      nombreItem: nombreFinal,
      ts: Date.now()
    });
    var chip = document.createElement('div');
    chip.className = 'ag-intent-chip';
    chip.style.cssText = 'color:#34d399;border-color:rgba(52,211,153,.3);margin:4px 14px';
    chip.textContent = '🧠 Aprendido: la próxima vez usaré ' + cambios.join(', ') + ' correcto' + (cambios.length > 1 ? 's' : '');
    el.messages.appendChild(chip);
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function scorePatterns(n, rules) {
    return rules.reduce(function(total, rule) {
      var pattern = Array.isArray(rule) ? rule[0] : rule;
      var weight = Array.isArray(rule) ? rule[1] : 1;
      return total + (fuzzyIncludes(n, pattern) ? weight : 0);
    }, 0);
  }

  function scoreIntentions(n) {
    var scores = [
      { tipo: 'anadir', score: scorePatterns(n, [
        ['anade', 10], ['añade', 10], ['anadir', 10], ['añadir', 10], ['agregar', 9],
        ['dar de alta', 10], ['alta de material', 9], ['alta de item', 9], ['alta en inventario', 9],
        ['inventariar', 9], ['registrar entrada', 10], ['dar entrada', 9], ['nueva entrada', 9],
        ['meter en el inventario', 9], ['meter al inventario', 9], ['nuevo material', 8],
        ['nuevo item', 8], ['nuevo equipo', 7], ['ha llegado', 7], ['hemos comprado', 7],
        ['recibido material', 7], ['recepcionar material', 8], ['crear material', 7],
        ['registrar material', 7], ['registrar equipo', 7]
      ]) },
      { tipo: 'prestamo', score: scorePatterns(n, [
        ['prestamo', 8], ['pedir prestado', 10], ['prestame', 10], ['prestanos', 10],
        ['dame el', 8], ['dame la', 8], ['dejame', 8], ['necesito usar', 7],
        ['me llevo', 8], ['voy a usar', 7], ['vamos a usar', 7], ['cojo el', 7],
        ['saco el', 7], ['sacar prestado', 9], ['dar salida', 8], ['salida de material', 8],
        ['ponlo a mi nombre', 9], ['ponla a mi nombre', 9], ['registrar prestamo', 10],
        ['apuntar prestamo', 10], ['anotar prestamo', 10]
      ]) },
      { tipo: 'buscar', score: scorePatterns(n, [
        ['donde esta', 10], ['donde esta el', 10], ['donde esta la', 10],
        ['donde encuentro', 9], ['donde hay', 8], ['buscar', 8], ['busca', 8],
        ['busco', 8], ['localiza', 9], ['localizar', 9], ['encuentra', 8],
        ['ver ficha', 8], ['abre ficha', 8], ['abre la ficha', 8], ['abre el item', 8],
        ['informacion de', 7], ['info de', 7], ['datos de', 7], ['que stock tiene', 7],
        ['cuantos hay de', 8], ['cuantas hay de', 8], ['cuantos ', 6], ['cuantas ', 6],
        ['stock de', 7], ['ubicacion de', 8]
      ]) },
      { tipo: 'devolver', score: scorePatterns(n, [
        ['devolver', 10], ['devuelvo', 10], ['devuelve', 9], ['devolucion', 10],
        ['retornar', 8], ['entrego', 8], ['entregar', 8], ['lo traigo', 9],
        ['la traigo', 9], ['lo traemos', 9], ['la traemos', 9], ['he devuelto', 10],
        ['esta de vuelta', 10], ['cerrar prestamo', 9], ['registrar devolucion', 10],
        ['marcar como devuelto', 10], ['dar por devuelto', 10]
      ]) },
      { tipo: 'stock', score: scorePatterns(n, [
        ['stock', 7], ['cantidad', 6], ['unidades', 6], ['existencias', 6],
        ['quedan ', 7], ['tenemos ', 5], ['actualiza', 6], ['actualizar', 6],
        ['cambia la cantidad', 9], ['modificar cantidad', 9], ['corregir stock', 9],
        ['recuento', 7], ['inventario fisico', 8], ['hay en total', 8]
      ]) },
      { tipo: 'estado', score: scorePatterns(n, [
        ['estado', 7], ['marca como', 7], ['marcar como', 7], ['averia', 8],
        ['deteriorado', 8], ['deteriorada', 8], ['buen estado', 8], ['dar de baja', 8],
        ['no funciona', 8], ['esta fallando', 8], ['fuera de servicio', 8],
        ['inutilizable', 8], ['irreparable', 8]
      ]) },
      { tipo: 'mantenimiento', score: scorePatterns(n, [
        ['mantenimiento', 8], ['reparacion', 7], ['revision', 7], ['reparar', 7],
        ['revisar', 7], ['incidencia', 9], ['parte de averia', 9], ['reportar fallo', 8],
        ['solicita mantenimiento', 10], ['marcar para mantenimiento', 10],
        ['enviar a mantenimiento', 9], ['llevar a reparar', 9]
      ]) },
      { tipo: 'quien_tiene', score: scorePatterns(n, [
        ['quien tiene', 10], ['quien lo tiene', 10], ['prestamos activos', 10],
        ['prestamos pendientes', 9], ['que hay prestado', 9], ['material prestado', 8],
        ['prestado a', 8], ['quien se ha llevado', 9], ['a quien esta prestado', 10]
      ]) },
      { tipo: 'resumen_aula', score: scorePatterns(n, [
        ['que hay en', 9], ['resumen del aula', 10], ['inventario del aula', 10],
        ['listar aula', 8], ['items del aula', 9], ['material del aula', 9],
        ['material del taller', 9], ['contenido del aula', 8]
      ]) },
      { tipo: 'stock_bajo', score: scorePatterns(n, [
        ['stock bajo', 10], ['poco stock', 9], ['sin stock', 9], ['stock critico', 10],
        ['por debajo del minimo', 10], ['bajo minimo', 10], ['agotados', 8],
        ['lista de compra', 8], ['que hay que reponer', 9]
      ]) },
      { tipo: 'lista_mantenimiento', score: scorePatterns(n, [
        ['que necesita mantenimiento', 10], ['mantenimientos pendientes', 10],
        ['pendiente de mantenimiento', 9], ['lista de reparaciones', 9],
        ['incidencias abiertas', 10], ['partes pendientes', 9], ['que hay averiado', 8]
      ]) },
      { tipo: 'editar', score: scorePatterns(n, [
        ['editar', 8], ['edita', 8], ['abrir ficha', 9], ['abre la ficha', 9],
        ['modificar ficha', 9], ['actualizar ficha', 9], ['actualizar datos', 8],
        ['corregir ficha', 9], ['cambiar aula', 8], ['cambiar de aula', 8],
        ['cambiar ubicacion', 8], ['corrige ubicacion', 8], ['mover el', 7],
        ['mueve el', 7], ['trasladar el', 7], ['cambiar proveedor', 8],
        ['cambiar referencia', 8], ['cambiar nombre', 8]
      ]) }
    ];

    // Penalizaciones para evitar falsos positivos por palabras usadas como contexto
    var scoreByTipo = {};
    scores.forEach(function(row) { scoreByTipo[row.tipo] = row; });
    if (scoreByTipo.anadir.score > 0 && matchAny(n, ['prestamo', 'devolucion', 'devolver', 'stock bajo'])) scoreByTipo.anadir.score -= 8;
    if (scoreByTipo.mantenimiento.score > 0 && matchAny(n, ['ciclo de mantenimiento', 'modulo de mantenimiento'])) scoreByTipo.mantenimiento.score -= 7;
    if (scoreByTipo.stock.score > 0 && scoreByTipo.stock_bajo.score >= scoreByTipo.stock.score) scoreByTipo.stock.score -= 4;
    if (scoreByTipo.buscar.score > 0 && matchAny(n, ['actualiza', 'actualizar', 'cambia', 'cambiar', 'devolver', 'devuelvo', 'prestamo', 'prestame', 'dame'])) scoreByTipo.buscar.score -= 5;

    if (!LEARN_LOADED && !state.learnedIntents.length) _cargarAprendizajesLocal();
    state.learnedIntents.forEach(function(ex) {
      var learnedScore = learnedIntentScore(n, ex.phrase);
      if (!learnedScore) return;
      var row = scores.find(function(s) { return s.tipo === ex.intent; });
      if (row) row.score += learnedScore;
    });

    scores.sort(function(a, b) { return b.score - a.score; });
    scores[0].secondScore = scores[1] ? scores[1].score : 0;
    scores[0].confidence = Math.max(0, Math.min(1, scores[0].score / Math.max(12, scores[0].score + scores[0].secondScore)));
    scores[0].ambiguous = scores[0].score < 12 && (scores[0].score - scores[0].secondScore) < 3;
    return scores[0].score >= 7 ? scores[0] : null;
  }

  function detectarIntencion(q) {
    var n = normalize(normalizarEntradaUsuario(q));
    var scored = scoreIntentions(n);
    if (scored && scored.tipo !== 'anadir' && scored.tipo !== 'prestamo') {
      if (scored.tipo === 'stock') {
        var numScored = n.match(/\b(\d+)\s*(unidades?|uds?\.?|ud\.?|piezas?|ejemplares?|items?|existencias?)?\b/);
        return { tipo: 'stock', cantidad: numScored ? parseInt(numScored[1]) : null };
      }
      if (scored.tipo === 'estado') {
        var estadoScored = null;
        if (matchAny(n, ['averia', 'averiado', 'averiada', 'no funciona', 'estropeado', 'estropeada',
            'funciona mal', 'esta fallando', 'no arranca', 'no enciende', 'no prende', 'no va', 'fuera de servicio'])) estadoScored = 'Avería';
        else if (matchAny(n, ['deteriorado', 'deteriorada', 'mal estado', 'desgastado', 'desgastada', 'se ha deteriorado', 'funciona regular'])) estadoScored = 'Deteriorado';
        else if (matchAny(n, ['bueno', 'buena', 'buen estado', 'bien', 'ok', 'funciona', 'perfecto', 'perfecta'])) estadoScored = 'Bueno';
        else if (matchAny(n, ['baja', 'dar de baja', 'darlo de baja', 'darla de baja', 'desecho', 'inservible', 'inutilizable', 'irreparable', 'poner en baja'])) estadoScored = 'Baja';
        return { tipo: 'estado', estado: estadoScored };
      }
      return { tipo: scored.tipo };
    }

    if (/\b(cuantos|cuantas)\b.*\bhay\b/.test(n) ||
        matchAny(n, ['donde esta', 'donde estan', 'donde encuentro', 'localiza ', 'busca ', 'busco '])) {
      return { tipo: 'buscar' };
    }

    // DEVOLVER PRÉSTAMO
    if (matchAny(n, ['devolver', 'devuelve', 'devolvemos', 'retornar', 'retorna', 'regresa', 'regresar',
        'ya lo tengo', 'ya la tengo', 'lo devuelvo', 'la devuelvo', 'devolverlo', 'devolverla',
        'entregar', 'entrega', 'entrego', 'entregamos', 'ha vuelto', 'han vuelto', 'devolucion',
        'quiero devolver', 'voy a devolver', 'ya lo devuelvo', 'ya la devuelvo',
        'lo traigo', 'la traigo', 'lo traemos', 'la traemos', 'ya lo traje', 'ya la traje',
        'ya lo he traido', 'ya la he traido', 'lo he traido', 'la he traido',
        'lo he devuelto', 'la he devuelto', 'he devuelto', 'hemos devuelto',
        'ya esta de vuelta', 'esta de vuelta', 'viene de vuelta', 'ya ha llegado', 'ya esta aqui',
        'cerrar prestamo', 'finalizar prestamo', 'terminar prestamo', 'completar prestamo',
        'cerrar devolucion', 'registrar devolucion', 'anotar devolucion',
        'marcar como devuelto', 'marcar devuelto', 'dar por devuelto', 'dar por devuelta',
        'se devolvio', 'se ha devuelto', 'lo han devuelto', 'la han devuelto',
        'se entrego', 'se ha entregado', 'han entregado',
        'fin del prestamo', 'cierre de prestamo', 'proceso de devolucion'])) {
      return { tipo: 'devolver' };
    }

    // ACTUALIZAR STOCK / CANTIDAD
    if (matchAny(n, ['actualiza', 'actualizar', 'cambia la cantidad', 'cambiar cantidad', 'pon la cantidad',
        'modifica la cantidad', 'modificar cantidad', 'stock a ', 'cantidad a ', 'hay ahora',
        'quedan ', 'tenemos ', 'unidades a ', 'ponlo a ', 'ponla a ', 'ajusta', 'ajustar stock',
        'nueva cantidad', 'cambiar stock', 'modifica stock',
        'subir stock', 'bajar stock', 'reducir stock', 'aumentar stock', 'regularizar stock',
        'corregir stock', 'corregir cantidad', 'rectificar stock', 'rectificar cantidad',
        'inventario fisico', 'recuento', 'tras contar', 'contados ', 'contadas ',
        'actualiza el stock', 'actualiza las unidades', 'actualiza la cantidad',
        'actualizar el stock', 'actualizar las unidades', 'actualizar la cantidad',
        'pon stock', 'pon el stock', 'mete la cantidad', 'mete el stock',
        'cambia el numero', 'cambia las unidades', 'modificar las unidades',
        'sube el stock', 'baja el stock', 'sube la cantidad', 'baja la cantidad',
        'incrementar stock', 'decrementar stock', 'reponer stock', 'añadir al stock',
        'quitar del stock', 'sumar al stock', 'restar del stock', 'poner existencias',
        'existencias a ', 'hay en total', 'total de unidades'])) {
      var numMatch = n.match(/\b(\d+)\s*(unidades?|uds?\.?|ud\.?|piezas?|ejemplares?|items?|existencias?)?\b/);
      return { tipo: 'stock', cantidad: numMatch ? parseInt(numMatch[1]) : null };
    }

    // CAMBIAR ESTADO
    if (matchAny(n, ['cambia el estado', 'cambiar estado', 'marca como', 'marcar como', 'estado a',
        'esta en averia', 'esta deteriorado', 'en buen estado', 'en buenas condiciones',
        'averia', 'deteriorado', 'estado bueno', 'buen estado', 'de baja', 'dar de baja',
        'poner como', 'catalogar como', 'clasificar como', 'registrar como',
        'marcarlo como', 'marcarla como', 'cambiar su estado', 'cambiar el estado a',
        'se ha estropeado', 'ya no funciona', 'esta estropeado', 'esta estropeada',
        'funciona mal', 'funciona regular', 'esta en mal estado', 'se ha deteriorado', 'esta fallando',
        'no arranca', 'no enciende', 'no prende', 'no va', 'no va bien',
        'poner en baja', 'poner a baja', 'darlo de baja', 'darla de baja', 'mandar a baja',
        'retirar del servicio', 'fuera de servicio', 'inutilizable', 'irreparable'])) {
      var estado = null;
      if (matchAny(n, ['averia', 'averiado', 'averiada', 'no funciona', 'estropeado', 'estropeada',
          'funciona mal', 'esta fallando', 'no arranca', 'no enciende', 'no prende', 'no va', 'fuera de servicio'])) estado = 'Avería';
      else if (matchAny(n, ['deteriorado', 'deteriorada', 'mal estado', 'desgastado', 'desgastada', 'se ha deteriorado', 'funciona regular'])) estado = 'Deteriorado';
      else if (matchAny(n, ['bueno', 'buena', 'buen estado', 'bien', 'ok', 'funciona', 'perfecto', 'perfecta'])) estado = 'Bueno';
      else if (matchAny(n, ['baja', 'dar de baja', 'darlo de baja', 'darla de baja', 'desecho', 'inservible', 'inutilizable', 'irreparable', 'poner en baja'])) estado = 'Baja';
      return { tipo: 'estado', estado: estado };
    }

    // MARCAR MANTENIMIENTO
    if (matchAny(n, ['mantenimiento', 'mantenimineto', 'reparar', 'reparacion',
        'revisar', 'revision', 'solicita mantenimiento', 'pide mantenimiento',
        'necesita revision', 'necesita reparacion', 'esta roto',
        'averiar', 'hay que arreglarlo', 'hay que arreglarla', 'no funciona bien',
        'se ha roto', 'hay que revisarlo', 'hay que revisarla', 'hay que arreglar',
        'hace falta revisarlo', 'hace falta revisarla', 'hace falta arreglarlo',
        'necesita ser revisado', 'necesita ser reparado', 'necesita arreglo',
        'pedir revision', 'pedir reparacion', 'solicitar revision', 'solicitar reparacion',
        'marcar para reparar', 'marcar para mantenimiento', 'marcar para revision',
        'llevar al tecnico', 'hay que llevarlo al tecnico', 'requiere mantenimiento',
        'requiere revision', 'requiere reparacion', 'requiere atencion',
        'notificar mantenimiento', 'aviso de mantenimiento', 'tiene un fallo',
        'reportar averia', 'reportar fallo', 'reportar problema', 'abrir incidencia',
        'crear incidencia', 'parte de averia', 'parte de reparacion',
        'poner en mantenimiento', 'enviar a mantenimiento', 'mandar a mantenimiento',
        'llevar a reparar', 'necesita repararse'])) {
      return { tipo: 'mantenimiento' };
    }

    // CONSULTA: ¿QUIÉN TIENE X? / PRÉSTAMOS ACTIVOS
    if (matchAny(n, ['quien tiene', 'quien lo tiene', 'donde esta prestado', 'quien se lo llevo',
        'quien tiene cogido', 'a quien se lo preste', 'prestamos activos', 'prestamos pendientes',
        'quien lo tiene ahora', 'quien se lo llevo', 'que profesor tiene', 'que profesora tiene',
        'a quien esta prestado', 'a quien se lo di', 'quien tiene el prestamo',
        'prestamos de', 'que hay prestado', 'listar prestamos', 'ver prestamos', 'mostrar prestamos',
        'historial de prestamos', 'que esta prestado', 'quien tiene algo prestado',
        'material prestado', 'materiales prestados', 'prestado a', 'prestada a',
        'que se ha llevado', 'que se llevo', 'quien se ha llevado'])) {
      return { tipo: 'quien_tiene' };
    }

    // CONSULTA: RESUMEN DE AULA
    if (matchAny(n, ['que hay en', 'que tiene el aula', 'que tiene la clase',
        'resumen del aula', 'resumen de aula', 'inventario del aula', 'listar aula',
        'mostrar aula', 'ver aula', 'items del aula', 'que hay en el aula',
        'que materiales hay en', 'que equipos hay en', 'que items hay en',
        'que instrumentos hay en', 'que tenemos en el aula', 'que tenemos en la clase',
        'dame el listado del aula', 'dame el listado de', 'listado del aula', 'listado de la clase',
        'dame un resumen de', 'dame el resumen de', 'ver todo lo que hay en',
        'mostrar todo lo de', 'contenido del aula', 'contenido de la clase',
        'que esta en el aula', 'que esta en la clase', 'ver inventario del aula',
        'inventario de clase', 'inventario de taller', 'material del aula',
        'material de la clase', 'material del taller'])) {
      return { tipo: 'resumen_aula' };
    }

    // CONSULTA: STOCK BAJO
    if (matchAny(n, ['stock bajo', 'poco stock', 'quedan pocos', 'quedan pocas', 'hay poco',
        'hay poca', 'se acaba', 'se acaban', 'necesita reposicion',
        'reponer', 'reposicion', 'minimo', 'por debajo del minimo',
        'quedan muy pocos', 'quedan muy pocas', 'hay muy poco', 'hay muy poca',
        'casi sin stock', 'sin stock', 'stock critico', 'stock insuficiente',
        'punto de pedido', 'necesitar reponer', 'que hay que comprar', 'que falta comprar',
        'lista de compra', 'que necesitamos reponer', 'que hay que reponer',
        'agotados', 'agotadas', 'se acabo', 'se han acabado',
        'falta stock', 'falta material', 'hace falta reponer', 'bajo minimo',
        'por debajo de minimo', 'material agotado', 'materiales agotados'])) {
      return { tipo: 'stock_bajo' };
    }

    // CONSULTA: MANTENIMIENTO PENDIENTE
    if (matchAny(n, ['que necesita mantenimiento', 'mantenimientos pendientes',
        'pendiente de mantenimiento', 'items con mantenimiento', 'que hay que reparar',
        'lista de reparaciones', 'en reparacion', 'necesitan reparacion',
        'mostrar mantenimientos', 'ver mantenimientos', 'listar mantenimientos',
        'lista de mantenimiento', 'pendientes de reparar', 'pendientes de revision',
        'que esta para reparar', 'que esta roto', 'que esta averiado', 'que no funciona',
        'items en mantenimiento', 'items pendientes de mantenimiento',
        'por reparar', 'en cola de reparacion', 'que tienen fallo',
        'que tiene un fallo', 'que hay roto', 'que hay averiado',
        'incidencias abiertas', 'partes de averia', 'partes pendientes'])) {
      return { tipo: 'lista_mantenimiento' };
    }

    // EDITAR / ABRIR FICHA DE ITEM
    if (matchAny(n, ['editar item', 'editar material', 'editar ficha', 'edita el', 'edita la',
        'abrir ficha', 'abre la ficha', 'abre el item', 'abre el material',
        'modificar item', 'modificar material', 'modificar ficha', 'modifica el', 'modifica la',
        'corregir ficha', 'corrige el', 'corrige la', 'cambiar aula', 'cambia el aula',
        'cambiar de aula', 'cambiar a aula', 'pasar al aula', 'pasar a aula',
        'cambiar ubicacion', 'cambia la ubicacion', 'corrige ubicacion', 'modifica ubicacion',
        'mover a ', 'mueve a ', 'mover el', 'mover la', 'mueve el', 'mueve la',
        'trasladar a ', 'traslada a ', 'trasladar el', 'trasladar la', 'traslada el', 'traslada la',
        'llevar al aula', 'llevar a aula', 'cambiar categoria', 'cambiar ciclo', 'cambiar modulo',
        'cambiar proveedor', 'cambiar referencia', 'cambiar nombre', 'actualizar ficha',
        'actualizar datos', 'modificar datos'])) {
      return { tipo: 'editar' };
    }

    return null;
  }

  // ── Extraer aula desde frase ──────────────────────────────────────
  function extraerAulaDeFrase(q) {
    var n = normalize(normalizarEntradaUsuario(q));
    // Buscar patrones: "aula 35", "aula35", "en el aula 35", "clase 35"
    var m = n.match(/(?:aula|clase|taller|sala|lab)\s*(\w+)/i);
    if (m) {
      var candidato = m[1].toUpperCase();
      var found = AULAS && AULAS.find(function(a) {
        return normalize(a.name).includes(normalize(candidato)) ||
               normalize(a.id).includes(normalize(candidato));
      });
      return found || null;
    }
    // Buscar directamente por nombre de aula en el listado
    if (typeof AULAS !== 'undefined' && AULAS) {
      var sorted = AULAS.slice().sort(function(a, b) { return b.name.length - a.name.length; });
      for (var i = 0; i < sorted.length; i++) {
        if (n.includes(normalize(sorted[i].name))) return sorted[i];
      }
    }
    return null;
  }

  // ── Extraer ubicación desde frase ─────────────────────────────────
  function extraerUbicacionDeFrase(q) {
    var n = normalize(q);
    // Buscar patrón: "en el armario X", "en la estantería X", "en vitrina X"...
    var m = n.match(/\ben (?:el |la )?(?:armario|estanteria|vitrina|cajon|caja|mesa|balda|rack|panel)\s*([a-z0-9áéíóúüñ\s_-]{1,25}?)(?:\s*$|\s+(?:del|de|y|,|\.))/i);
    if (m) return (m[0].replace(/^en (?:el |la )?/i,'')).trim().replace(/\s+(del|de|y|,|\.).*$/i,'').trim();
    // Buscar ubicaciones existentes en el inventario que aparezcan en la frase
    if (state.inventario && state.inventario.length) {
      var locs = {};
      state.inventario.forEach(function(it) { if (it.loc) locs[normalize(it.loc)] = it.loc; });
      var keys = Object.keys(locs).sort(function(a,b){ return b.length - a.length; });
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].length > 3 && n.includes(keys[i])) return locs[keys[i]];
      }
    }
    return null;
  }

  // ── Detectar ciclo desde frase ────────────────────────────────────
  function extraerCicloDeFrase(q) {
    var n = normalize(q);
    if (typeof CICLOS === 'undefined' || !CICLOS || !CICLOS.length) return null;
    var CICLO_KW = {
      'gm_telecom':  [
        'telecom', 'telecomunicacion', 'telecomunicaciones',
        'instalaciones de telecom', 'inst telecom', 'gm telecom',
        'infraestructura comun', 'infraestructuras comunes',
        'domotica', 'domótica', 'megafonia', 'megafonía', 'sonorizacion', 'sonorización',
        'cctv', 'seguridad electronica', 'radiocomunicacion', 'radiocomunicaciones',
        'equipos microinformaticos', 'redes de datos', 'red de datos', 'telefonia',
        ' it ', ' it,', ' it.',
      ],
      'gm_electric': [
        'iea', 'electricas automaticas', 'electrica automatica',
        'instalacion electrica', 'instalaciones electricas', 'inst electr',
        'automatismos', 'automatismos industriales',
        'electrotecnia', 'distribucion electrica', 'instalaciones de distribucion',
        'solar fotovoltaica', 'fotovoltaica', 'maquinas electricas',
        'instalaciones interiores', 'instalaciones domoticas',
        'gm electric',
      ],
      'gs_mantelec': [
        'mantelec', 'mantenimiento electronico', 'mant electronico',
        'gs mantelec', ' me ', ' me,', ' me.',
        'circuitos analogicos', 'electronica analogica',
        'equipos microprogramables', 'microprogramable',
        'mantenimiento radiocomunicaciones', 'mant radiocomunicaciones',
        'mantenimiento voz y datos', 'mant voz datos',
        'electronica industrial', 'equipo de audio', 'equipo de video',
        'montaje electronico', 'infraestructura mant',
      ],
      'gs_sea': [
        ' sea ', ' sea,', ' sea.',
        'electrotecnico', 'electrotecnica', 'electrotecnicos',
        'sistemas electrotecnicos', 'sistemas electrotecnicos y automatizados',
        'automatizado', 'automatizados', 'gs sea',
        'ict', 'procesos ict',
        'tecnicas instalaciones electricas', 'tecnicas en instalaciones',
        'documentacion tecnica electrica', 'documentacion electrica',
        'sistemas y circuitos electricos', 'circuitos electricos',
        'inst domoticas y automaticas', 'domoticas y automaticas',
        'redes electricas', 'centros de transformacion', 'centro de transformacion',
        'configuracion inst domoticas', 'configuracion inst electricas',
        'gestion del montaje',
      ],
      'departamento': ['departamento', 'dpto', 'depto', 'material general', 'uso general'],
    };
    for (var id in CICLO_KW) {
      var kws = CICLO_KW[id];
      if (kws.some(function(k) { return n.includes(k) || n.endsWith(k.trim()) || n.startsWith(k.trim()); })) {
        return CICLOS.find(function(c) { return c.id === id; }) || null;
      }
    }
    // Buscar por alias exacto (IT, IEA, ME, SEA) como palabra completa
    var sorted = CICLOS.slice().sort(function(a, b) { return (b.name||'').length - (a.name||'').length; });
    for (var i = 0; i < sorted.length; i++) {
      var c = sorted[i];
      var alias = normalize(c.alias || '');
      if (alias && new RegExp('\\b' + alias + '\\b').test(n)) return c;
      if (c.name && n.includes(normalize(c.name))) return c;
    }
    return null;
  }

  // ── Detectar módulo desde frase ───────────────────────────────────
  var MOD_STOP = ['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'para', 'en', 'con', 'por'];
  function extraerModuloDeFrase(q, cicloFiltro) {
    var n = normalize(q);
    if (typeof CICLOS === 'undefined' || !CICLOS || !CICLOS.length) return null;
    var ciclosABuscar = cicloFiltro ? [cicloFiltro] : CICLOS;
    var mejorMatch = null;
    var mejorScore = 0;
    ciclosABuscar.forEach(function(ciclo) {
      (ciclo.modulos || []).forEach(function(mod) {
        var modN = normalize(mod.name);
        var words = modN.split(/\s+/).filter(function(w) {
          return w.length > 3 && MOD_STOP.indexOf(w) === -1;
        });
        var score = words.reduce(function(s, w) { return s + (n.includes(w) ? w.length : 0); }, 0);
        if (score > mejorScore) { mejorScore = score; mejorMatch = { mod: mod, ciclo: ciclo }; }
      });
    });
    return mejorScore >= 6 ? mejorMatch : null; // umbral: al menos ~2 palabras largas
  }

  // ── Sugerir categoría por nombre de ítem ─────────────────────────
  function sugerirCategoria(nombreItem) {
    var n = normalize(nombreItem || '');
    if (!n) return null;
    var CAT_KW = {
      'Equipos de medida':         ['multimetro', 'polimetro', 'osciloscopio', 'tester', 'voltimetro',
                                    'amperimetro', 'calibrador', 'generador de', 'fuente de alimentacion',
                                    'fuente alimentacion', 'luxometro', 'pinza amperimetrica', 'sonda',
                                    'vatimetro', 'frecuencimetro', 'analizador', 'medidor', 'otdr'],
      'Herramientas':              ['soldador', 'estacion de soldadura', 'estacion soldadura', 'desoldador',
                                    'destornillador', 'alicates', 'alicate', 'tenaza', 'llave inglesa',
                                    'llave allen', 'sierra', 'cutter', 'pistola de calor', 'pistola calor',
                                    'crimpeador', 'pelacables', 'pelahilos', 'taladro', 'estaño', 'flux',
                                    'pasta soldadura', 'estacion trabajo'],
      'Componentes electrónicos':  ['resistencia', 'condensador', 'capacitor', 'transistor', 'diodo',
                                    'tiristor', 'triac', 'mosfet', 'integrado', 'circuito integrado',
                                    'amplificador operacional', 'opamp', 'microcontrolador', 'cristal',
                                    'inductor', 'bobina', 'pulsador', 'potenciometro', 'encoder'],
      'Material de taller':        ['cable ', 'cables', 'hilo', 'conector', 'conectores', 'tornillo',
                                    'tuerca', 'brida', 'cinta aislante', 'termoretractil', 'etiqueta',
                                    'toner', 'tinta', 'papel'],
      'Material eléctrico':        ['magnetotermico', 'diferencial', 'contactor', 'guardamotor', 'cuadro',
                                    'regleta', 'borne', 'fusible', 'enchufe', 'toma de corriente',
                                    'panel solar', 'modulo solar', 'inversor', 'bateria', 'acumulador',
                                    'aerogenerador', 'cablecanal', 'tubo corrugado', 'tubo rigido'],
      'Redes':                     ['switch', 'router', 'hub', 'access point', 'patch panel', 'roseta',
                                    'cable ethernet', 'cable utp', 'cable ftp', 'latiguillo', 'rj45',
                                    'fibra optica', 'fusionadora', 'splitter', 'modem', 'antena',
                                    'pigtail', 'bandeja de fibra'],
      'Robótica y automatización': ['arduino', 'raspberry', 'esp32', 'esp8266', 'plc', 'hmi', 'variador',
                                    'servo', 'servomotor', 'stepper', 'robot', 'automata', 'sensor',
                                    'actuador', 'scada', 'microbit'],
      'Informática':               ['ordenador', 'portatil', 'laptop', 'monitor', 'teclado', 'raton',
                                    'impresora', 'disco duro', 'ssd', 'pendrive', 'tablet', 'webcam',
                                    'proyector', 'altavoz', 'auricular'],
    };
    var cats = typeof CATS !== 'undefined' ? Object.keys(CATS) : [];
    var mejorCat = null;
    var mejorScore = 0;
    for (var cat in CAT_KW) {
      if (cats.length && cats.indexOf(cat) === -1) continue;
      var kws = CAT_KW[cat];
      var score = kws.reduce(function(s, kw) { return s + (n.includes(kw) ? kw.length : 0); }, 0);
      if (score > mejorScore) { mejorScore = score; mejorCat = cat; }
    }
    return mejorScore > 0 ? mejorCat : null;
  }

  // ── Autocompletar formulario nuevo ítem desde frase ───────────────
  function autocompletarFormulario(formDiv, frase) {
    var msgs = [];

    // Corrección aprendida de una frase similar anterior
    var correccion = consultarCorreccionAprendida(frase);

    // Aula
    var aula = extraerAulaDeFrase(frase);
    var aulaEl = formDiv.querySelector('.ag-new-item-aula');
    if (aulaEl) {
      if (correccion && correccion.aulaId && !aula) {
        aulaEl.value = correccion.aulaId;
        msgs.push('🏫 ' + correccion.aulaId + ' (aprendido)');
      } else if (aula) {
        aulaEl.value = aula.id;
        msgs.push('🏫 ' + aula.name);
      }
    }

    // Ubicación
    var loc = extraerUbicacionDeFrase(frase);
    if (loc) {
      var locInput = formDiv.querySelector('.ag-new-item-loc');
      if (locInput) { locInput.value = loc; msgs.push('📍 ' + loc); }
    }

    // Ciclo: corrección aprendida tiene prioridad sobre extracción de la frase
    var cicloDetectado = extraerCicloDeFrase(frase);
    if (!cicloDetectado && typeof cf !== 'undefined' && cf && cf.type === 'mod' && cf.ciclo) {
      cicloDetectado = cf.ciclo;
    }
    if (correccion && correccion.cicloId && !cicloDetectado) {
      cicloDetectado = (typeof CICLOS !== 'undefined' ? CICLOS : []).find(function(c) { return c.id === correccion.cicloId; }) || null;
    }

    // Módulo: corrección aprendida tiene prioridad
    var modDetectado = cicloDetectado
      ? extraerModuloDeFrase(frase, cicloDetectado)
      : extraerModuloDeFrase(frase, null);
    if (modDetectado && !cicloDetectado) cicloDetectado = modDetectado.ciclo;

    if (cicloDetectado) {
      var cicloSel = formDiv.querySelector('.ag-new-item-ciclo');
      if (cicloSel) {
        var wasLearned = correccion && correccion.cicloId === cicloDetectado.id && !extraerCicloDeFrase(frase);
        cicloSel.value = cicloDetectado.id;
        cicloSel.dispatchEvent(new Event('change'));
        msgs.push('📚 ' + (cicloDetectado.alias || cicloDetectado.name) + (wasLearned ? ' (aprendido)' : ''));
      }
    }

    // Si el módulo no salió de la frase pero hay corrección aprendida, aplicarla
    if (!modDetectado && correccion && correccion.modCod && cicloDetectado) {
      var modSel2 = formDiv.querySelector('.ag-new-item-mod');
      if (modSel2 && modSel2.querySelector('option[value="' + correccion.modCod + '"]')) {
        modSel2.value = correccion.modCod;
        msgs.push('📖 (módulo aprendido)');
      }
    } else if (modDetectado) {
      var modSel = formDiv.querySelector('.ag-new-item-mod');
      if (modSel) { modSel.value = modDetectado.mod.cod; msgs.push('📖 ' + modDetectado.mod.name); }
    }

    // Nombre: si la corrección tiene nombre y difiere del actual, aplicar
    var nombreInput = formDiv.querySelector('.ag-new-item-name');
    if (correccion && correccion.nombreItem && nombreInput && correccion.nombreItem !== nombreInput.value.trim()) {
      nombreInput.value = correccion.nombreItem;
      msgs.push('📝 ' + correccion.nombreItem + ' (aprendido)');
      actualizarAvisoSimilares(formDiv);
    }

    // Categoría: corrección aprendida tiene prioridad
    var catSugerida = sugerirCategoria((nombreInput && nombreInput.value) || frase);
    if (correccion && correccion.catId && !catSugerida) catSugerida = correccion.catId;
    if (catSugerida) {
      var catSel = formDiv.querySelector('.ag-new-item-cat');
      if (catSel) { catSel.value = catSugerida; msgs.push('🏷️ ' + catSugerida); }
    }

    // Mostrar resumen de lo autocompletado
    if (msgs.length > 0) {
      var resultEl = formDiv.querySelector('.ag-new-item-result');
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = '<span style="color:#64748b">✨ Volt completó: </span>' +
          msgs.map(function(m) { return '<span style="color:#34d399;margin-right:6px">' + esc(m) + '</span>'; }).join('');
      }
    }

    // Guardar lo que Volt rellenó para detectar correcciones al enviar
    var _niName = formDiv.querySelector('.ag-new-item-name');
    formDiv._voltSugerencias = {
      aulaId:     aulaEl ? aulaEl.value || null : null,
      cicloId:    (formDiv.querySelector('.ag-new-item-ciclo') || {}).value || null,
      modCod:     (formDiv.querySelector('.ag-new-item-mod')   || {}).value || null,
      catId:      (formDiv.querySelector('.ag-new-item-cat')   || {}).value || null,
      nombreItem: _niName ? _niName.value.trim() || null : null
    };
  }

  // ── Extraer nombre de profesor/a de una frase ─────────────────────
  function extraerProfesorDeFrase(q) {
    var q0 = (q || '').trim();
    var m;
    // "Juan se lleva / coge / necesita / pide..."
    m = q0.match(/^([\wáéíóúüñÁÉÍÓÚÜÑ]+(?:\s+[\wáéíóúüñÁÉÍÓÚÜÑ]+)?)\s+(?:se\s+lleva|se\s+lo\s+lleva|coge|necesita|pide|quiere|solicita|toma|va\s+a)/i);
    if (m && m[1].length > 2 && !/^(dame|necesito|quiero|pedir|coger|tomar|llevar)$/i.test(m[1])) return m[1].trim();
    // "para [Nombre]" / "a nombre de [Nombre]" / "apunta que [Nombre]" / "es para [Nombre]"
    m = q0.match(/(?:para|a\s+nombre\s+de|es\s+para|lo\s+pide|la\s+pide|apunta(?:\s+que)?(?:\s+a)?|anota(?:\s+que)?(?:\s+a)?)\s+([\wáéíóúüñÁÉÍÓÚÜÑ]+(?:\s+[\wáéíóúüñÁÉÍÓÚÜÑ]+)?)/i);
    if (m && m[1].length > 2) return m[1].trim();
    return null;
  }

  // ── Extraer fecha de devolución prevista de una frase ─────────────
  function extraerFechaDevolucion(q) {
    var n = normalize(q || '');
    var today = new Date();
    var res = null;
    if (/\bhoy\b/.test(n))                                         { res = new Date(today); }
    else if (/\bmanana\b/.test(n))                                 { res = new Date(today); res.setDate(today.getDate()+1); }
    else if (/\bpasado\s+manana\b/.test(n))                       { res = new Date(today); res.setDate(today.getDate()+2); }
    else if (/\best[ae]\s+semana\b/.test(n))                      { res = new Date(today); res.setDate(today.getDate() + ((5-today.getDay()+7)%7 || 5)); }
    else if (/\b(?:semana\s+que\s+viene|proxima\s+semana)\b/.test(n)) { res = new Date(today); res.setDate(today.getDate()+7); }
    else if (/\b(?:en\s+un\s+mes|proximo\s+mes)\b/.test(n))       { res = new Date(today); res.setMonth(today.getMonth()+1); }
    else {
      var DIAS = { lunes:1, martes:2, miercoles:3, jueves:4, viernes:5, sabado:6, domingo:0 };
      for (var dia in DIAS) {
        if (new RegExp('\\b'+dia+'\\b').test(n)) {
          var diff = (DIAS[dia] - today.getDay() + 7) % 7 || 7;
          res = new Date(today); res.setDate(today.getDate()+diff); break;
        }
      }
      if (!res) {
        var md = n.match(/(?:hasta\s+el|para\s+el|el\s+dia)\s+(\d{1,2})/);
        if (md) { res = new Date(today); res.setDate(parseInt(md[1])); if (res <= today) res.setMonth(res.getMonth()+1); }
      }
    }
    return res ? res.toISOString().split('T')[0] : null;
  }

  // ── Obtener ítem en contexto actual de la app ─────────────────────
  function obtenerItemContextoApp() {
    if (state.contextItem) return state.contextItem;
    var globals = ['currentItem', 'selectedItem', '_currentItem'];
    for (var i = 0; i < globals.length; i++) {
      if (typeof window[globals[i]] !== 'undefined' && window[globals[i]] && window[globals[i]].id) return window[globals[i]];
    }
    var hm = window.location.hash.match(/[?&]?(?:item|id)[=\/](\d+)/i);
    if (hm) return state.inventario.find(function(it) { return String(it.id) === String(hm[1]); }) || null;
    return null;
  }

  // ── Stats dinámicas en el panel de bienvenida ─────────────────────
  function injectarStatsPanel() {
    var statsEl = el.panel.querySelector('#ag-stats-bar');
    if (!statsEl) return;
    var inv = state.inventario || [];
    var prestActivos = (typeof prestamos !== 'undefined' ? prestamos : []).filter(function(p) { return p.estado === 'Activo'; });
    var stockBajo = inv.filter(function(x) { return Number(x.min||0) > 0 && Number(x.qty != null ? x.qty : (x.cantidad||0)) < Number(x.min||0); });
    var mantPend  = inv.filter(function(x) { return x.mant == 1 || x.mant === '1'; });
    statsEl.innerHTML = '';
    var parts = [];
    if (prestActivos.length) parts.push({ txt: '📋 ' + prestActivos.length + ' prestados', q: 'préstamos activos', col: '#38bdf8' });
    if (stockBajo.length)    parts.push({ txt: '⚠ '  + stockBajo.length   + ' stock bajo',    q: 'stock bajo',        col: '#ef4444' });
    if (mantPend.length)     parts.push({ txt: '🔧 ' + mantPend.length    + ' mantenimiento', q: 'lista mantenimiento',col: '#fbbf24' });
    if (!parts.length) { statsEl.style.display = 'none'; return; }
    parts.forEach(function(p) {
      var b = document.createElement('button');
      b.className = 'ag-quick-btn';
      b.style.cssText = 'font-size:10px;padding:4px 8px;border-color:' + p.col + ';color:' + p.col;
      b.textContent = p.txt;
      b.addEventListener('click', function() { sendChat(p.q); });
      statsEl.appendChild(b);
    });
    statsEl.style.display = 'flex';
  }

  // ── Buscar préstamos activos por nombre de ítem o persona ─────────
  function buscarPrestamosActivos(q, personaQ) {
    var nItem = normalize(q || '');
    var nPerso = normalize(personaQ || '');
    var activos = (typeof prestamos !== 'undefined' ? prestamos : []).filter(function(p) {
      return p.estado === 'Activo';
    });
    if (!activos.length) return [];
    var res = activos.filter(function(p) {
      var okItem  = !nItem  || normalize(p.itemNombre||'').includes(nItem) || normalize(p.aulaDestino||'').includes(nItem);
      var okPerso = !nPerso || normalize(p.profesorNombre||'').includes(nPerso);
      return okItem && okPerso;
    });
    // Si con los dos filtros no hay nada, relajar al filtro de ítem solo
    if (!res.length && nItem) res = activos.filter(function(p) { return normalize(p.itemNombre||'').includes(nItem); });
    return res;
  }

  // ── Formulario: DEVOLVER préstamo ─────────────────────────────────
  function mostrarFormularioDevolucion(prestamosEncontrados, itemQuery, queryOriginal) {
    var formDiv = document.createElement('div');
    formDiv.className = 'ag-msg ag-msg-ai';
    formDiv.style.cssText = 'max-width:95%;background:#0f172a;border:1px solid #f59e0b';

    if (!prestamosEncontrados.length) {
      formDiv.innerHTML = '<div style="color:#fbbf24">⚠ No encontré préstamos activos' +
        (itemQuery ? ' para "' + esc(itemQuery) + '"' : '') + '.</div>';
      el.messages.appendChild(formDiv);
      el.messages.scrollTop = el.messages.scrollHeight;
      return;
    }

    var rows = prestamosEncontrados.slice(0, 8).map(function(p) {
      return '<tr>' +
        '<td><input type="checkbox" class="ag-dev-check" data-id="' + p.id + '" data-qty="' + (p.cantidad||1) + '" style="width:16px;height:16px"></td>' +
        '<td>' + esc(p.itemNombre || '—') + '</td>' +
        '<td>' + esc(p.profesorNombre || '—') + '</td>' +
        '<td style="text-align:center">' + (p.cantidad||1) + '</td>' +
        '<td style="color:#64748b">' + (p.fechaPrestamo||'').slice(0,10) + '</td>' +
      '</tr>';
    }).join('');

    formDiv.innerHTML =
      '<div style="margin-bottom:10px"><strong style="color:#fbbf24">↩ Devolver préstamo:</strong></div>' +
      '<table class="ag-table" style="width:100%;margin-bottom:10px">' +
        '<thead><tr><th></th><th>Ítem</th><th>Profesor</th><th>Cant.</th><th>Fecha</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '<div style="display:flex;gap:6px">' +
        '<button class="ag-btn ag-btn-blue ag-dev-submit" style="flex:1">✅ Confirmar devolución</button>' +
        '<button class="ag-btn ag-dev-cancel">Cancelar</button>' +
      '</div>' +
      '<div class="ag-dev-result" style="margin-top:8px;font-size:11px"></div>';

    el.messages.appendChild(formDiv);
    el.messages.scrollTop = el.messages.scrollHeight;

    formDiv.querySelector('.ag-dev-cancel').addEventListener('click', function() { formDiv.remove(); });
    formDiv.querySelector('.ag-dev-submit').addEventListener('click', function() {
      var checks = formDiv.querySelectorAll('.ag-dev-check:checked');
      if (!checks.length) { appendMsgInDiv(formDiv, '⚠ Marca al menos un préstamo', '#fbbf24'); return; }
      var resultEl = formDiv.querySelector('.ag-dev-result');
      resultEl.innerHTML = '⏳ Procesando...'; resultEl.style.color = '#94a3b8';
      var promises = Array.from(checks).map(function(chk) {
        return apiPost('/api/prestar', {
          action: 'devolver',
          prestamoId: Number(chk.dataset.id),
          cantidadDevuelta: Number(chk.dataset.qty)
        });
      });
      Promise.all(promises).then(function() {
        resultEl.innerHTML = '✅ Devolución registrada';
        resultEl.style.color = '#34d399';
        formDiv.querySelector('.ag-dev-submit').disabled = true;
        guardarAprendizaje(queryOriginal, 'devolver');
        if (typeof loadData === 'function') setTimeout(loadData, 500);
      }).catch(function(e) {
        resultEl.innerHTML = '❌ Error: ' + e.message;
        resultEl.style.color = '#ef4444';
      });
    });
  }

  // ── Formulario: ACTUALIZAR STOCK ──────────────────────────────────
  function mostrarFormularioStock(item, cantidadSugerida, queryOriginal) {
    var formDiv = document.createElement('div');
    formDiv.className = 'ag-msg ag-msg-ai';
    formDiv.style.cssText = 'max-width:95%;background:#0f172a;border:1px solid #8b5cf6';
    formDiv.innerHTML =
      '<div style="margin-bottom:8px"><strong style="color:#a78bfa">📦 Actualizar stock:</strong> ' + esc(item.item) + '</div>' +
      '<div style="color:#64748b;font-size:11px;margin-bottom:8px">Stock actual: <strong style="color:#e2e8f0">' + (item.qty||0) + '</strong> · Mínimo: ' + (item.min||0) + '</div>' +
      '<label class="ag-label">Nueva cantidad *</label>' +
      '<input class="ag-input-field ag-stock-qty" type="number" min="0" value="' + (cantidadSugerida !== null ? cantidadSugerida : item.qty||0) + '">' +
      '<label class="ag-label" style="margin-top:6px">Motivo (opcional)</label>' +
      '<input class="ag-input-field ag-stock-obs" placeholder="Ej: Reposición, inventario físico...">' +
      '<div style="display:flex;gap:6px;margin-top:10px">' +
        '<button class="ag-btn ag-btn-blue ag-stock-submit" style="flex:1">✅ Actualizar</button>' +
        '<button class="ag-btn ag-stock-cancel">Cancelar</button>' +
      '</div>' +
      '<div class="ag-stock-result" style="margin-top:8px;font-size:11px"></div>';

    el.messages.appendChild(formDiv);
    el.messages.scrollTop = el.messages.scrollHeight;
    formDiv.querySelector('.ag-stock-qty').focus();
    formDiv.querySelector('.ag-stock-cancel').addEventListener('click', function() { formDiv.remove(); });
    formDiv.querySelector('.ag-stock-submit').addEventListener('click', function() {
      var nuevaQty = Number(formDiv.querySelector('.ag-stock-qty').value);
      var resultEl = formDiv.querySelector('.ag-stock-result');
      resultEl.innerHTML = '⏳ Guardando...'; resultEl.style.color = '#94a3b8';
      var updated = Object.assign({}, item, { qty: nuevaQty });
      apiPost('/api/item', { action: 'update', item: updated }).then(function(res) {
        if (!res.ok) throw new Error(res.error);
        var idx = items.findIndex(function(x) { return String(x.id) === String(item.id); });
        if (idx >= 0) items[idx] = updated;
        rebuildInventoryIndex(true);
        resultEl.innerHTML = '✅ Stock actualizado a ' + nuevaQty;
        resultEl.style.color = '#34d399';
        formDiv.querySelector('.ag-stock-submit').disabled = true;
        guardarAprendizaje(queryOriginal, 'stock');
      }).catch(function(e) {
        resultEl.innerHTML = '❌ ' + e.message; resultEl.style.color = '#ef4444';
      });
    });
  }

  // ── Formulario: CAMBIAR ESTADO ────────────────────────────────────
  function mostrarFormularioEstado(item, estadoSugerido, queryOriginal) {
    var formDiv = document.createElement('div');
    formDiv.className = 'ag-msg ag-msg-ai';
    formDiv.style.cssText = 'max-width:95%;background:#0f172a;border:1px solid #06b6d4';
    var opts = ['Bueno','Deteriorado','Avería','Baja'].map(function(e) {
      return '<option value="' + e + '"' + (e === (estadoSugerido || item.est) ? ' selected' : '') + '>' + e + '</option>';
    }).join('');
    formDiv.innerHTML =
      '<div style="margin-bottom:8px"><strong style="color:#67e8f9">🔧 Cambiar estado:</strong> ' + esc(item.item) + '</div>' +
      '<div style="color:#64748b;font-size:11px;margin-bottom:8px">Estado actual: <strong style="color:#e2e8f0">' + esc(item.est||'—') + '</strong></div>' +
      '<label class="ag-label">Nuevo estado *</label>' +
      '<select class="ag-input-field ag-estado-sel" style="padding:7px">' + opts + '</select>' +
      '<label class="ag-label" style="margin-top:6px">Nota (opcional)</label>' +
      '<input class="ag-input-field ag-estado-obs" placeholder="Ej: Cable roto, pantalla rayada...">' +
      '<div style="display:flex;gap:6px;margin-top:10px">' +
        '<button class="ag-btn ag-btn-blue ag-estado-submit" style="flex:1">✅ Cambiar estado</button>' +
        '<button class="ag-btn ag-estado-cancel">Cancelar</button>' +
      '</div>' +
      '<div class="ag-estado-result" style="margin-top:8px;font-size:11px"></div>';

    el.messages.appendChild(formDiv);
    el.messages.scrollTop = el.messages.scrollHeight;
    formDiv.querySelector('.ag-estado-cancel').addEventListener('click', function() { formDiv.remove(); });
    formDiv.querySelector('.ag-estado-submit').addEventListener('click', function() {
      var nuevoEst = formDiv.querySelector('.ag-estado-sel').value;
      var obs = formDiv.querySelector('.ag-estado-obs').value.trim();
      var resultEl = formDiv.querySelector('.ag-estado-result');
      resultEl.innerHTML = '⏳ Guardando...'; resultEl.style.color = '#94a3b8';
      var updated = Object.assign({}, item, { est: nuevoEst, obs: obs || item.obs });
      apiPost('/api/item', { action: 'update', item: updated }).then(function(res) {
        if (!res.ok) throw new Error(res.error);
        var idx = items.findIndex(function(x) { return String(x.id) === String(item.id); });
        if (idx >= 0) items[idx] = updated;
        rebuildInventoryIndex(true);
        resultEl.innerHTML = '✅ Estado cambiado a ' + nuevoEst;
        resultEl.style.color = '#34d399';
        formDiv.querySelector('.ag-estado-submit').disabled = true;
        guardarAprendizaje(queryOriginal, 'estado');
      }).catch(function(e) {
        resultEl.innerHTML = '❌ ' + e.message; resultEl.style.color = '#ef4444';
      });
    });
  }

  // ── Formulario: MARCAR MANTENIMIENTO ─────────────────────────────
  function mostrarFormularioMantenimiento(item, queryOriginal) {
    var formDiv = document.createElement('div');
    formDiv.className = 'ag-msg ag-msg-ai';
    formDiv.style.cssText = 'max-width:95%;background:#0f172a;border:1px solid #f59e0b';
    formDiv.innerHTML =
      '<div style="margin-bottom:8px"><strong style="color:#fbbf24">🛠 Solicitar mantenimiento:</strong> ' + esc(item.item) + '</div>' +
      '<label class="ag-label">Responsable (opcional)</label>' +
      '<input class="ag-input-field ag-mant-resp" placeholder="Ej: Servicio técnico, Juan...">' +
      '<label class="ag-label" style="margin-top:6px">Descripción del problema *</label>' +
      '<textarea class="ag-input-field ag-mant-nota" style="height:60px;resize:vertical" placeholder="Ej: No enciende, cable pelado..."></textarea>' +
      '<label class="ag-label" style="margin-top:6px">Fecha límite (opcional)</label>' +
      '<input class="ag-input-field ag-mant-fecha" type="date">' +
      '<div style="display:flex;gap:6px;margin-top:10px">' +
        '<button class="ag-btn ag-btn-blue ag-mant-submit" style="flex:1">✅ Solicitar</button>' +
        '<button class="ag-btn ag-mant-cancel">Cancelar</button>' +
      '</div>' +
      '<div class="ag-mant-result" style="margin-top:8px;font-size:11px"></div>';

    el.messages.appendChild(formDiv);
    el.messages.scrollTop = el.messages.scrollHeight;
    formDiv.querySelector('.ag-mant-cancel').addEventListener('click', function() { formDiv.remove(); });
    formDiv.querySelector('.ag-mant-submit').addEventListener('click', function() {
      var nota = formDiv.querySelector('.ag-mant-nota').value.trim();
      if (!nota) { formDiv.querySelector('.ag-mant-nota').style.borderColor = '#ef4444'; return; }
      var resp = formDiv.querySelector('.ag-mant-resp').value.trim();
      var fecha = formDiv.querySelector('.ag-mant-fecha').value;
      var resultEl = formDiv.querySelector('.ag-mant-result');
      resultEl.innerHTML = '⏳ Guardando...'; resultEl.style.color = '#94a3b8';
      var updated = Object.assign({}, item, {
        mant: '1', mantEstado: 'Pendiente',
        mantNota: nota, mantResp: resp, mantFecha: fecha
      });
      apiPost('/api/item', { action: 'update', item: updated }).then(function(res) {
        if (!res.ok) throw new Error(res.error);
        var idx = items.findIndex(function(x) { return String(x.id) === String(item.id); });
        if (idx >= 0) items[idx] = updated;
        rebuildInventoryIndex(true);
        resultEl.innerHTML = '✅ Mantenimiento solicitado';
        resultEl.style.color = '#34d399';
        formDiv.querySelector('.ag-mant-submit').disabled = true;
        guardarAprendizaje(queryOriginal, 'mantenimiento');
      }).catch(function(e) {
        resultEl.innerHTML = '❌ ' + e.message; resultEl.style.color = '#ef4444';
      });
    });
  }

  // ── Respuesta: CONSULTAS DIRECTAS (sin LLM) ───────────────────────
  function respuestaConsultaDirecta(tipo, q) {
    var n = normalize(q);

    if (tipo === 'stock_bajo') {
      var bajos = (items || []).filter(function(x) { return x.min && Number(x.qty) < Number(x.min); });
      if (!bajos.length) { appendMsg('ai', '✅ No hay ítems con stock bajo en este momento.'); return true; }
      appendMsgHtml('<strong style="color:#fbbf24">⚠ ' + bajos.length + ' ítems con stock bajo:</strong>' +
        '<table class="ag-table" style="width:100%;margin-top:8px"><thead><tr><th>Ítem</th><th>Aula</th><th>Stock</th><th>Mín.</th></tr></thead><tbody>' +
        bajos.slice(0,15).map(function(x) {
          return '<tr><td>' + esc(x.item) + '</td><td>' + esc(x.aula||'—') + '</td>' +
            '<td style="color:#ef4444;font-weight:700">' + x.qty + '</td><td>' + x.min + '</td></tr>';
        }).join('') + '</tbody></table>');
      return true;
    }

    if (tipo === 'lista_mantenimiento') {
      var mant = (items || []).filter(function(x) { return x.mant == 1 || x.mant === '1'; });
      if (!mant.length) { appendMsg('ai', '✅ No hay ítems pendientes de mantenimiento.'); return true; }
      appendMsgHtml('<strong style="color:#fbbf24">🛠 ' + mant.length + ' ítems con mantenimiento pendiente:</strong>' +
        '<table class="ag-table" style="width:100%;margin-top:8px"><thead><tr><th>Ítem</th><th>Aula</th><th>Estado</th><th>Responsable</th></tr></thead><tbody>' +
        mant.slice(0,15).map(function(x) {
          return '<tr><td>' + esc(x.item) + '</td><td>' + esc(x.aula||'—') + '</td>' +
            '<td>' + esc(x.mantEstado||'Pendiente') + '</td><td>' + esc(x.mantResp||'—') + '</td></tr>';
        }).join('') + '</tbody></table>');
      return true;
    }

    if (tipo === 'resumen_aula') {
      var aula = extraerAulaDeFrase(q);
      if (!aula) { appendMsg('ai', '¿De qué aula quieres el resumen? Ej: "¿qué hay en el Aula 35?"'); return true; }
      var aulaItems = (items || []).filter(function(x) { return x.aula === aula.id; });
      if (!aulaItems.length) { appendMsg('ai', 'No encontré ítems en ' + esc(aula.name) + '.'); return true; }
      var bajos2 = aulaItems.filter(function(x) { return x.min && Number(x.qty) < Number(x.min); }).length;
      var mant2 = aulaItems.filter(function(x) { return x.mant == 1 || x.mant === '1'; }).length;
      appendMsgHtml('<strong style="color:#67e8f9">🏫 Resumen ' + esc(aula.name) + '</strong> — ' +
        aulaItems.length + ' ítems · <span style="color:#ef4444">⚠ ' + bajos2 + ' stock bajo</span> · <span style="color:#fbbf24">🛠 ' + mant2 + ' mantenimiento</span>' +
        '<table class="ag-table" style="width:100%;margin-top:8px"><thead><tr><th>Ítem</th><th>Cant.</th><th>Estado</th><th>Ubicación</th></tr></thead><tbody>' +
        aulaItems.slice(0,20).map(function(x) {
          var low = x.min && Number(x.qty) < Number(x.min);
          return '<tr><td>' + esc(x.item) + '</td>' +
            '<td style="color:' + (low?'#ef4444':'#34d399') + ';font-weight:700">' + x.qty + '</td>' +
            '<td>' + esc(x.est||'—') + '</td><td style="color:#64748b">' + esc(x.loc||'—') + '</td></tr>';
        }).join('') + '</tbody></table>');
      return true;
    }

    if (tipo === 'quien_tiene') {
      var activos = (typeof prestamos !== 'undefined' ? prestamos : []).filter(function(p) { return p.estado === 'Activo'; });
      if (!activos.length) { appendMsg('ai', 'No hay préstamos activos en este momento.'); return true; }
      var palabras = n.replace(/\b(quien|quien|tiene|prestado|cogido|lleva|el|la|los|las|un|una|que|se|lo|la)\b/g,'').trim();
      var filtrados = palabras.length > 2 ? activos.filter(function(p) {
        return normalize(p.itemNombre||'').includes(palabras) || normalize(p.profesorNombre||'').includes(palabras);
      }) : activos;
      appendMsgHtml('<strong style="color:#7dd3fc">📋 Préstamos activos' +
        (palabras.length > 2 ? ' para "' + esc(palabras) + '"' : '') + ' (' + filtrados.length + '):</strong>' +
        '<table class="ag-table" style="width:100%;margin-top:8px"><thead><tr><th>Ítem</th><th>Profesor</th><th>Cant.</th><th>Desde</th><th>Prevista</th></tr></thead><tbody>' +
        filtrados.slice(0,10).map(function(p) {
          return '<tr><td>' + esc(p.itemNombre||'—') + '</td><td>' + esc(p.profesorNombre||'—') + '</td>' +
            '<td>' + (p.cantidad||1) + '</td><td style="color:#64748b">' + (p.fechaPrestamo||'').slice(0,10) + '</td>' +
            '<td style="color:#f59e0b">' + (p.fechaPrevista||'—').slice(0,10) + '</td></tr>';
        }).join('') + '</tbody></table>');
      return true;
    }

    return false;
  }

  function confirmarAccionCritica(actionLabel, item, onConfirm) {
    var div = document.createElement('div');
    var itemName = getItemName(item) || 'este ítem';
    var qty = item.qty != null ? item.qty : (item.cantidad || 0);
    div.className = 'ag-msg ag-msg-ai';
    div.style.cssText = 'max-width:95%;background:#111827;border:1px solid #f59e0b';
    div.innerHTML =
      '<div style="margin-bottom:8px"><strong style="color:#fbbf24">Confirmación requerida</strong></div>' +
      '<div style="font-size:12px;line-height:1.5;margin-bottom:8px">Acción: <strong>' + esc(actionLabel) + '</strong><br>' +
      'Ítem: <strong>' + esc(itemName) + '</strong> · Aula: ' + esc(item.aula || '—') + ' · Stock: ' + qty + '</div>' +
      '<div style="display:flex;gap:6px">' +
        '<button class="ag-btn ag-btn-blue ag-confirm-yes" style="flex:1">Sí, continuar</button>' +
        '<button class="ag-btn ag-confirm-no">Cancelar</button>' +
      '</div>';
    el.messages.appendChild(div);
    el.messages.scrollTop = el.messages.scrollHeight;

    div.querySelector('.ag-confirm-no').addEventListener('click', function() {
      div.remove();
      appendMsg('ai', 'Acción: cancelada. Resultado: no se aplicaron cambios. Siguiente: puedes reformular con nombre exacto.');
    });
    div.querySelector('.ag-confirm-yes').addEventListener('click', function() {
      div.remove();
      onConfirm();
    });
  }

  function necesitaConfirmacionPorAmbiguedad(q, candidatos) {
    if (!candidatos || !candidatos.length) return false;
    var n = normalize(q || '');
    var kws = extractKeywords(q || '');
    if (matchAny(n, ['este', 'esta', 'ese', 'esa', 'el de aqui', 'la de aqui', 'el de la pantalla', 'el que tengo'])) return true;
    if (kws.length <= 1) return true;
    if (candidatos.length > 1 && (candidatos[0].score - candidatos[1].score) < 5) return true;
    return false;
  }

  // ── Seleccionar ítem con confirmación si hay varios ───────────────
  function seleccionarItemYEjecutar(q, callback, actionLabel) {
    var candidatos = searchInventoryCandidates(q, 6);
    if (!candidatos.length) {
      appendMsg('ai', 'Acción: no ejecutada. Resultado: no encontré un ítem claro. Siguiente: indica nombre o referencia.');
      return;
    }

    if (candidatos.length === 1 || candidatos[0].score >= candidatos[1].score + 6) {
      var elegido = candidatos[0].item;
      if (necesitaConfirmacionPorAmbiguedad(q, candidatos)) {
        confirmarAccionCritica(actionLabel || 'Actualizar ítem', elegido, function() {
          callback(elegido);
        });
        return;
      }
      callback(elegido);
      return;
    }

    var listMsg = document.createElement('div');
    listMsg.className = 'ag-msg ag-msg-ai';
    listMsg.innerHTML = '<strong>Acción: pendiente por ambigüedad.</strong><br><small style="color:#94a3b8">Resultado: encontré varios ítems. Siguiente: elige uno.</small><br><br>';
    candidatos.slice(0, 6).forEach(function(cand) {
      var item = cand.item;
      var btn = document.createElement('button');
      btn.className = 'ag-quick-btn';
      btn.style.cssText = 'display:block;margin:4px 0;width:100%;text-align:left';
      btn.innerHTML = '📦 ' + esc(getItemName(item) || '(sin nombre)') + ' <small style="color:#64748b">(Aula: ' + esc(item.aula||'—') + ' · ' + esc(item.est||'—') + ' · ' + (item.qty||0) + ' ud. · score ' + cand.score + ')</small>';
      btn.addEventListener('click', (function(it) { return function() { listMsg.remove(); callback(it); }; })(item));
      listMsg.appendChild(btn);
    });
    el.messages.appendChild(listMsg);
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function mostrarAprendizajeIntencion(frase, detectada) {
    if (detectada) return;
    if (!frase) return;
    if ((frase || '').trim().length < 12) return;
    var div = document.createElement('div');
    div.className = 'ag-msg ag-msg-ai';
    div.style.cssText = 'max-width:95%;background:#0b1220;border:1px dashed #334155;padding:8px';
    var actual = detectada && INTENT_LABELS[detectada] ? ' · detecté: ' + INTENT_LABELS[detectada] : '';
    div.innerHTML =
      '<div style="display:flex;gap:6px;align-items:center;justify-content:space-between;flex-wrap:wrap">' +
        '<span style="font-size:11px;color:#94a3b8">¿No era eso?' + esc(actual) + '</span>' +
        '<button class="ag-quick-btn ag-learn-open" style="font-size:10px;padding:5px 8px">Enseñar intención</button>' +
      '</div>' +
      '<div class="ag-learn-options" style="display:none;gap:5px;flex-wrap:wrap;margin-top:7px"></div>' +
      '<div class="ag-learn-result" style="font-size:11px;margin-top:6px;color:#94a3b8"></div>';
    el.messages.appendChild(div);
    el.messages.scrollTop = el.messages.scrollHeight;

    var opts = div.querySelector('.ag-learn-options');
    Object.keys(INTENT_LABELS).forEach(function(intent) {
      var btn = document.createElement('button');
      btn.className = 'ag-quick-btn';
      btn.style.fontSize = '10px';
      btn.textContent = INTENT_LABELS[intent];
      btn.addEventListener('click', function() {
        guardarAprendizaje(frase, intent);
        div.querySelector('.ag-learn-result').innerHTML = '✅ Aprendido: "' + esc(frase) + '" → ' + esc(INTENT_LABELS[intent]);
        opts.style.display = 'none';
        div.querySelector('.ag-learn-open').disabled = true;
      });
      opts.appendChild(btn);
    });

    div.querySelector('.ag-learn-open').addEventListener('click', function() {
      opts.style.display = opts.style.display === 'none' ? 'flex' : 'none';
      el.messages.scrollTop = el.messages.scrollHeight;
    });
  }

  function limpiarPantallaChat(mostrarAviso) {
    state.messages = [];
    state.contextItem = null;
    try { localStorage.removeItem(HISTORY_KEY); } catch(e) {}
    if (el.messages) el.messages.innerHTML = '';
    if (el.panel) {
      var quick = el.panel.querySelector('#ag-quick');
      var sug = el.panel.querySelector('#ag-suggestions');
      var send = el.panel.querySelector('#ag-send');
      if (quick) quick.style.display = 'flex';
      if (sug) sug.style.display = 'none';
      if (send) send.disabled = false;
    }
    if (mostrarAviso) appendMsg('ai', 'Pantalla borrada. Los aprendizajes guardados se mantienen.');
    if (el.chatInput) el.chatInput.focus();
  }

  function mostrarAyudaVolt() {
    appendMsgHtml(
      '<strong style="color:#7dd3fc">Qué puede hacer Volt</strong>' +
      '<div style="font-size:11px;line-height:1.55;margin-top:6px;color:#cbd5e1">' +
        '<div>📦 <strong>Añadir:</strong> "añade un osciloscopio en aula 40"</div>' +
        '<div>✅ <strong>Préstamos:</strong> "dame el multímetro", "me llevo el taladro"</div>' +
        '<div>↩ <strong>Devolver:</strong> "devuelvo el osciloscopio", "cerrar préstamo"</div>' +
        '<div>📊 <strong>Stock:</strong> "quedan 20 resistencias", "actualiza stock a 5"</div>' +
        '<div>🔧 <strong>Estado/mantenimiento:</strong> "está averiado", "solicitar reparación"</div>' +
        '<div>🔍 <strong>Consultas:</strong> "qué hay en aula 35", "quién tiene el soldador"</div>' +
        '<div>✏️ <strong>Editar:</strong> "abre la ficha del polímetro", "cambia el aula"</div>' +
        '<div style="margin-top:6px;color:#94a3b8">Comandos: borra la pantalla · ver aprendizajes · borra aprendizajes · deshacer última enseñanza</div>' +
      '</div>'
    );
  }

  function mostrarAprendizajesGuardados() {
    cargarAprendizajes(function() {
      if (!state.learnedIntents.length) {
        appendMsg('ai', 'No hay aprendizajes guardados todavía.');
        return;
      }
      appendMsgHtml(
        '<strong style="color:#7dd3fc">Aprendizajes guardados (' + state.learnedIntents.length + ')</strong>' +
        '<table class="ag-table" style="width:100%;margin-top:8px;font-size:10px"><thead><tr><th>Frase</th><th>Intención</th></tr></thead><tbody>' +
          state.learnedIntents.slice().reverse().slice(0, 20).map(function(ex) {
            return '<tr><td>' + esc(ex.raw || ex.phrase) + '</td><td>' + esc(INTENT_LABELS[ex.intent] || ex.intent) + '</td></tr>';
          }).join('') +
        '</tbody></table>' +
        (state.learnedIntents.length > 20 ? '<div style="font-size:10px;color:#94a3b8;margin-top:6px">Mostrando los 20 últimos.</div>' : '')
      );
    });
  }

  function borrarAprendizajesGuardados() {
    var creds = apiCreds();
    if (creds) {
      fetch('/api/intent-learning/clear' + creds, { method: 'POST' })
        .catch(function() {});
    }
    state.learnedIntents = [];
    try { localStorage.removeItem(LEARN_KEY); localStorage.removeItem(MIGRATE_FLAG); } catch(e) {}
    appendMsg('ai', 'Aprendizajes borrados. Volt seguirá usando sus reglas base.');
  }

  function deshacerUltimaEnsenanza() {
    var last = state.learnedIntents[state.learnedIntents.length - 1];
    if (!last) {
      appendMsg('ai', 'No hay ninguna enseñanza que deshacer.');
      return;
    }
    state.learnedIntents.pop();
    var creds = apiCreds();
    if (last.id && creds) {
      fetch('/api/intent-learning/' + last.id + creds, { method: 'DELETE' })
        .catch(function() {});
    } else {
      try { localStorage.setItem(LEARN_KEY, JSON.stringify(state.learnedIntents)); } catch(e) {}
    }
    appendMsg('ai', 'Deshecha la última enseñanza: "' + esc(last.raw || last.phrase) + '" → ' + esc(INTENT_LABELS[last.intent] || last.intent) + '.');
  }

  function gestionarComandoRapido(q) {
    var n = normalize(q || '');
    if (!n) return false;
    if (n === 'ayuda' || n === 'help' || n === 'que puedes hacer' || n === 'que sabes hacer' ||
        n === 'comandos' || n === 'muestra ayuda') {
      mostrarAyudaVolt();
      return true;
    }
    if (matchAny(n, ['ver aprendizajes', 'mostrar aprendizajes', 'lista aprendizajes',
        'aprendizajes guardados', 'que has aprendido'])) {
      mostrarAprendizajesGuardados();
      return true;
    }
    if (matchAny(n, ['borra aprendizajes', 'borrar aprendizajes', 'limpia aprendizajes',
        'elimina aprendizajes', 'reset aprendizajes'])) {
      borrarAprendizajesGuardados();
      return true;
    }
    if (matchAny(n, ['deshacer ultima enseñanza', 'deshacer ultima ensenanza',
        'deshaz ultima enseñanza', 'deshaz ultima ensenanza', 'deshacer ultimo aprendizaje',
        'deshaz ultimo aprendizaje'])) {
      deshacerUltimaEnsenanza();
      return true;
    }
    return false;
  }

  function appendMsgHtml(html) {
    var div = document.createElement('div');
    div.className = 'ag-msg ag-msg-ai';
    div.innerHTML = html;
    el.messages.appendChild(div);
    el.messages.scrollTop = el.messages.scrollHeight;
    saveHistory('ai', html);
  }

  function appendMsgInDiv(div, text, color) {
    var r = div.querySelector('.ag-dev-result') || div.querySelector('.ag-stock-result') || div.querySelector('.ag-mant-result');
    if (r) { r.innerHTML = text; r.style.color = color || '#e2e8f0'; }
  }

  function appendIntentChip(tipo, entidad) {
    var chip = document.createElement('div');
    chip.className = 'ag-intent-chip';
    chip.textContent = '🎯 ' + tipo + (entidad ? ' · ' + entidad : '');
    el.messages.appendChild(chip);
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function sendChat(text) {
    var input = el.chatInput;
    // Si text es un evento (cuando viene de click), ignorarlo
    var queryText = (typeof text === 'string') ? text : '';
    var qRaw = queryText || input.value.trim();
    var q = normalizarEntradaUsuario(qRaw);
    if (!q || state.loading) return;
    input.value = '';
    el.panel.querySelector('#ag-quick').style.display = 'none';

    if (detectarComandoLimpiarPantalla(q)) {
      limpiarPantallaChat(true);
      return;
    }

    // Añadir mensaje usuario
    state.messages.push({ role: 'user', content: q });
    appendMsg('user', q);

    if (gestionarComandoRapido(q)) return;

    // ── INTERCEPTAR ACCIÓN DE AÑADIR ITEM ─────────────────────
    if (detectarIntencionAnadirItem(q)) {
      var nombreExtraido = extraerNombreItem(q);
      var cantidadExtraida = extraerCantidadDeFrase(q);
      appendIntentChip('➕ añadir ítem', nombreExtraido);
      mostrarFormularioNuevoItem(nombreExtraido, q, cantidadExtraida);
      mostrarAprendizajeIntencion(q, 'anadir');
      return;
    }

    // ── CONTEXTO CONVERSACIONAL — actualizar aula/item del hilo ───────
    resolverContextoConversacional(q);

    // ── PARSER CENTRAL DE INTENCIONES ──────────────────────────
    var intencion = detectarIntencion(q);
    var _voltIntentChipShown = false;
    if (intencion) {
      var _emap={'prestamo':'préstamo','devolver':'devolución','stock':'stock','estado':'estado','mantenimiento':'mantenimiento','buscar':'búsqueda','resumen_aula':'resumen aula','quien_tiene':'quién tiene','stock_bajo':'stock bajo','lista_mantenimiento':'mantenimiento','editar':'editar'};
      appendIntentChip(_emap[intencion.tipo]||intencion.tipo, intencion.tipo!=='stock_bajo'&&intencion.tipo!=='lista_mantenimiento'?extraerNombreItem(q):null);
      _voltIntentChipShown = true;
      // Consultas directas sin ítem concreto
      if (intencion.tipo === 'stock_bajo' || intencion.tipo === 'lista_mantenimiento' ||
          intencion.tipo === 'resumen_aula' || intencion.tipo === 'quien_tiene') {
        respuestaConsultaDirecta(intencion.tipo, q);
        return;
      }
      // Búsqueda/consulta de ficha — mostrar ficha completa directamente
      if (intencion.tipo === 'buscar') {
        var ctx = resolverContextoConversacional(q);
        // Si es referencia al item anterior y ya lo tenemos en contexto
        var itemBuscar = ctx.esReferencia && ctx.item ? ctx.item : null;
        if (!itemBuscar) {
          var candsBuscar = searchInventoryCandidates(q, 4);
          // Si no hay candidatos, buscar en historial de mensajes
          if (!candsBuscar.length) {
            for (var mb = state.messages.length - 2; mb >= 0 && mb >= state.messages.length - 6; mb--) {
              var pmb = state.messages[mb];
              if (pmb && pmb.content) { candsBuscar = searchInventoryCandidates(pmb.content, 4); if (candsBuscar.length) break; }
            }
          }
          if (candsBuscar.length === 1 || (candsBuscar.length > 1 && candsBuscar[0].score >= candsBuscar[1].score + 5)) {
            itemBuscar = candsBuscar[0].item;
          }
        }
        if (itemBuscar) { mostrarFichaItem(itemBuscar); return; }
        // Varios candidatos — mostrar lista para elegir
        if (searchInventoryCandidates(q, 4).length > 1) {
          seleccionarItemYEjecutar(q, function(item) { mostrarFichaItem(item); }, 'Ver ficha');
          return;
        }
      }
      // Acciones que necesitan un ítem: buscar primero
      if (intencion.tipo === 'devolver') {
        var nDev = normalize(q);
        var termBusq = nDev.replace(/\b(devolver|devuelve|devolvemos|devolverlo|devolverla|quiero devolver|voy a devolver|retornar|retorna|regresar|regresa|entregar|entrega|entrego|entregamos|cerrar prestamo|finalizar prestamo|terminar prestamo|completar prestamo|cerrar devolucion|registrar devolucion|anotar devolucion|marcar como devuelto|marcar devuelto|dar por devuelto|dar por devuelta|ya lo devuelvo|ya la devuelvo|lo devuelvo|la devuelvo|lo traigo|la traigo|lo traemos|la traemos|ya lo traje|ya la traje|ya lo he traido|ya la he traido|lo he traido|la he traido|he devuelto|hemos devuelto|lo he devuelto|la he devuelto|ya esta de vuelta|esta de vuelta|viene de vuelta)\b/g,'').trim();
        termBusq = termBusq.replace(/\b(el|la|los|las|un|una|unos|unas|prestamo|devolucion)\b/g,'').replace(/\s+/g,' ').trim();
        // Separar "ítem de [persona]"
        var personaDevMatch = termBusq.match(/\bde\s+([\wà-ÿ]+(?:\s+[\wà-ÿ]+)?)\s*$/);
        var personaDev = null;
        var itemDev = termBusq;
        if (personaDevMatch) { personaDev = personaDevMatch[1].trim(); itemDev = termBusq.replace(personaDevMatch[0],'').trim(); }
        var prestActivos = buscarPrestamosActivos(itemDev, personaDev);
        if (!prestActivos.length) prestActivos = buscarPrestamosActivos('', null);
        mostrarFormularioDevolucion(prestActivos, itemDev || null, q);
        return;
      }
      if (intencion.tipo === 'stock') {
        seleccionarItemYEjecutar(q, function(item) {
          mostrarFormularioStock(item, intencion.cantidad, q);
        }, 'Actualizar stock');
        return;
      }
      if (intencion.tipo === 'estado') {
        seleccionarItemYEjecutar(q, function(item) {
          mostrarFormularioEstado(item, intencion.estado, q);
        }, 'Cambiar estado');
        return;
      }
      if (intencion.tipo === 'mantenimiento') {
        seleccionarItemYEjecutar(q, function(item) {
          mostrarFormularioMantenimiento(item, q);
        }, 'Solicitar mantenimiento');
        return;
      }
      if (intencion.tipo === 'editar') {
        seleccionarItemYEjecutar(q, function(item) {
          appendMsg('ai', 'Abro la ficha de "' + esc(item.item || item.nombre || item.name || 'este item') + '" para editarla.');
          navigateToItem(item.id);
        }, 'Editar ficha');
        return;
      }
    }

    // ── INTERCEPTAR ACCIÓN DE PRÉSTAMO ─────────────────────────
    if (detectarIntencionPrestamo(q)) {
      if (!_voltIntentChipShown) appendIntentChip('préstamo', extraerNombreItem(q));
      // Detectar referencias al ítem actual de la app ("este", "esta", "el de aquí"...)
      var nPrest = normalize(q);
      var refActual = matchAny(nPrest, ['este','esta','el de aqui','la de aqui','el actual','la actual',
        'este item','este equipo','este instrumento','el que tengo','la que tengo',
        'el de la pantalla','este mismo','esta misma','el que sale'])
        ? obtenerItemContextoApp() : null;

      // Buscar item en la pregunta actual; si no hay, buscar en mensajes anteriores
      var candidatosPrest = refActual ? [{ item: refActual, score: 99 }] : searchInventoryCandidates(q, 6);
      var encontrados = candidatosPrest.map(function(c) { return c.item; });
      if (!encontrados || encontrados.length === 0) {
        // Recorrer historial de mensajes recientes buscando el item mencionado
        for (var mi = state.messages.length - 2; mi >= 0 && mi >= state.messages.length - 6; mi--) {
          var prevMsg = state.messages[mi];
          if (prevMsg && prevMsg.content) {
            candidatosPrest = searchInventoryCandidates(prevMsg.content, 6);
            encontrados = candidatosPrest.map(function(c) { return c.item; });
            if (encontrados && encontrados.length > 0) break;
          }
        }
      }
      if (encontrados && encontrados.length > 0) {
        if (encontrados.length === 1 || (candidatosPrest.length > 1 && candidatosPrest[0].score >= candidatosPrest[1].score + 6)) {
          var elegidoPrest = candidatosPrest.length ? candidatosPrest[0].item : encontrados[0];
          if (necesitaConfirmacionPorAmbiguedad(q, candidatosPrest)) {
            confirmarAccionCritica('Registrar préstamo', elegidoPrest, function() {
              mostrarFormularioPrestamo(elegidoPrest, q);
            });
            return;
          }
          mostrarFormularioPrestamo(elegidoPrest, q);
          return;
        }
        // Si hay varios, pedir que elija
        var listaMsg = document.createElement('div');
        listaMsg.className = 'ag-msg ag-msg-ai';
        listaMsg.innerHTML = '<strong>Acción: préstamo pendiente.</strong><br><small style="color:#94a3b8">Resultado: encontré varios candidatos. Siguiente: elige uno.</small><br><br>';
        candidatosPrest.slice(0, 5).forEach(function(cand) {
          var item = cand.item;
          var btn = document.createElement('button');
          btn.className = 'ag-quick-btn';
          btn.style.cssText = 'display:block;margin:4px 0;width:100%;text-align:left';
          var qty = item.qty != null ? item.qty : (item.cantidad || 0);
          var nombreBtn = item.item || item.nombre || item.name || '(sin nombre)';
          btn.innerHTML = '📦 ' + esc(nombreBtn) + ' <small style="color:#64748b">(Aula: ' + esc(item.aula || '—') + ', Stock: ' + qty + ', score ' + cand.score + ')</small>';
          btn.addEventListener('click', (function(it) { return function() {
            listaMsg.remove();
            mostrarFormularioPrestamo(it, q);
          }; })(item));
          listaMsg.appendChild(btn);
        });
        el.messages.appendChild(listaMsg);
        el.messages.scrollTop = el.messages.scrollHeight;
        return;
      }
      // No encontró item — pedir al usuario que lo especifique
      appendMsg('ai', 'Acción: préstamo no iniciado. Resultado: no encontré el material solicitado. Siguiente: dime nombre o referencia exacta.');
      state.loading = false;
      el.panel.querySelector('#ag-send').disabled = false;
      return;
    }

    // Dots
    var dots = document.createElement('div');
    dots.className = 'ag-dots';
    [0,1,2].forEach(function(i){
      var d = document.createElement('div');
      d.className = 'ag-dot';
      d.style.animationDelay = (i * 0.2) + 's';
      dots.appendChild(d);
    });
    el.messages.appendChild(dots);
    el.messages.scrollTop = el.messages.scrollHeight;

    state.loading = true;
    el.panel.querySelector('#ag-send').disabled = true;

    // Búsqueda inteligente: detectar consultas de stock y filtrar localmente
    var contextExtra = ctxExtra();

    // Añadir contexto conversacional al prompt de la IA
    if (state.contextItem) {
      var ci = state.contextItem;
      contextExtra += '\n\nÍTEM EN CONTEXTO (mencionado anteriormente): ' +
        (ci.item || ci.nombre || '') + ' | Aula: ' + (ci.aula || '—') +
        ' | Stock: ' + (ci.qty != null ? ci.qty : '?') + ' | Ref: ' + (ci.ref || '—');
    }
    if (state.contextAula) {
      contextExtra += '\n\nAULA EN CONTEXTO (mencionada anteriormente): ' + (state.contextAula.name || state.contextAula.id || '');
    }

    var stockResults = checkStockQuery(q);
    if (stockResults) {
      contextExtra += stockResults;
    } else {
      var searchResults = searchInventory(q);
      // Si no hay resultados en query actual, buscar en historial reciente
      if ((!searchResults || !searchResults.length) && state.contextItem) {
        var qty2 = state.contextItem.qty != null ? state.contextItem.qty : '?';
        contextExtra += '\n\n📦 ITEM DEL CONTEXTO: ' + (state.contextItem.item || state.contextItem.nombre || '') +
          ' | Stock: ' + qty2 + ' | Aula: ' + (state.contextItem.aula || '—') +
          '\nEl usuario está preguntando sobre este item que mencionó antes.';
      } else if (searchResults && searchResults.length > 0) {
        contextExtra += '\n\n✅ RESULTADOS DE BÚSQUEDA para "' + q + '" (' + searchResults.length + ' encontrados):\n' +
          searchResults.join('\n') +
          '\n\nUSA ESTOS DATOS: Son resultados directos del inventario real.';
      } else {
        contextExtra += '\n\n❌ BÚSQUEDA para "' + q + '": No se encontraron coincidencias en el inventario.';
      }
    }

    var full = '';
    var aiDiv = null;

    streamAI(state.messages, contextExtra, function(delta) {
      if (!aiDiv) {
        dots.remove();
        aiDiv = document.createElement('div');
        aiDiv.className = 'ag-msg ag-msg-ai';
        el.messages.appendChild(aiDiv);
      }
      full += delta;
      aiDiv.innerHTML = md2html(full) + '<span class="ag-cursor"></span>';
      el.messages.scrollTop = el.messages.scrollHeight;
    }).then(function() {
      if (aiDiv) { aiDiv.innerHTML = md2html(full); linkifyItems(aiDiv); }
      state.messages.push({ role: 'assistant', content: full });
      mostrarAprendizajeIntencion(q, null);
      state.loading = false;
      el.panel.querySelector('#ag-send').disabled = false;
    }).catch(function(e) {
      dots.remove();
      appendMsg('ai', '❌ Error: ' + e.message);
      state.loading = false;
      el.panel.querySelector('#ag-send').disabled = false;
    });
  }

  function saveHistory(role, content) {
    try {
      var hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      hist.push({ role: role, content: content, ts: Date.now() });
      if (hist.length > HISTORY_MAX) hist = hist.slice(-HISTORY_MAX);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    } catch(e) {}
  }

  function restoreHistory() {
    try {
      var hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (!hist.length) return;
      // Separador visual
      var sep = document.createElement('div');
      sep.style.cssText = 'text-align:center;font-size:10px;color:#334155;padding:4px 0;border-top:1px solid #1e293b;margin-bottom:4px';
      sep.textContent = '— conversación anterior —';
      el.messages.appendChild(sep);
      hist.forEach(function(m) {
        var div = document.createElement('div');
        div.className = 'ag-msg ag-msg-' + (m.role === 'user' ? 'user' : 'ai');
        if (m.role === 'user') div.textContent = m.content;
        else div.innerHTML = m.content; // ya está en HTML
        el.messages.appendChild(div);
      });
      el.messages.scrollTop = el.messages.scrollHeight;
    } catch(e) {}
  }

  function appendMsg(role, html) {
    var div = document.createElement('div');
    div.className = 'ag-msg ag-msg-' + (role === 'user' ? 'user' : 'ai');
    if (role === 'user') { div.textContent = html; saveHistory(role, html); }
    else { var rendered = md2html(html); div.innerHTML = rendered; saveHistory(role, rendered); }
    el.messages.appendChild(div);
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  // ── Reconocimiento de voz ─────────────────────────────────────────────────
  var _recognition = null;
  var _manualMicStop = false;
  function startMic() {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      appendMsg('ai', '⚠ Tu navegador no soporta reconocimiento de voz. Prueba con Chrome en Android.');
      return;
    }
    var micBtn = el.panel.querySelector('#ag-mic');
    // Si ya está escuchando, parar y enviar lo acumulado
    if (_recognition) {
      var pendingVoiceText = normalizarEntradaUsuario(el.chatInput.value.trim());
      _manualMicStop = true;
      _recognition.stop();
      _recognition = null;
      micBtn.classList.remove('listening');
      micBtn.textContent = '🎤';
      el.chatInput.placeholder = 'Ej: ¿Dónde está...? | ¿Quién tiene...?';
      if (pendingVoiceText) setTimeout(function() { sendChat(pendingVoiceText); }, 100);
      return;
    }
    // Transcript acumulado entre sesiones de reconocimiento
    var accumulatedText = '';
    var silenceTimer = null;
    var userStopped = false;
    _manualMicStop = false;

    micBtn.classList.add('listening');
    micBtn.textContent = '⏹';
    el.chatInput.placeholder = '🎤 Escuchando... (pausa de 2s para enviar)';

    function resetMicUI() {
      micBtn.classList.remove('listening');
      micBtn.textContent = '🎤';
      el.chatInput.placeholder = 'Ej: ¿Dónde está...? | ¿Quién tiene...?';
    }

    var _voiceSent = false;
    function sendAndStop() {
      if (_voiceSent) return;
      _voiceSent = true;
      clearTimeout(silenceTimer);
      silenceTimer = null;
      userStopped = true;
      if (_recognition) { try { _recognition.stop(); } catch(e) {} }
      _recognition = null;
      resetMicUI();
      var text = normalizarEntradaUsuario(accumulatedText.trim());
      if (text) setTimeout(function() { sendChat(text); }, 200);
    }

    function startSession() {
      var r = new SpeechRecognition();
      r.lang = 'es-ES';
      r.continuous = false;      // más estable en móvil
      r.interimResults = true;

      var sessionCommitted = '';  // texto final confirmado en esta sesión

      r.onresult = function(e) {
        var interim = '';
        var finalNow = '';
        for (var i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalNow += e.results[i][0].transcript + ' ';
          else interim += e.results[i][0].transcript;
        }
        sessionCommitted = finalNow;
        el.chatInput.value = normalizarEntradaUsuario((accumulatedText + finalNow + interim).trim());
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(function() {
          silenceTimer = null;
          // Usar sessionCommitted (capturado en el closure del resultado final)
          var toAdd = sessionCommitted || interim;
          if (toAdd.trim()) accumulatedText = (accumulatedText + toAdd).trim() + ' ';
          sendAndStop();
        }, 2000);
      };

      r.onerror = function(e) {
        if (e.error === 'aborted') return;
        if (e.error === 'no-speech') return;
        clearTimeout(silenceTimer);
        silenceTimer = null;
        _recognition = null;
        resetMicUI();
        appendMsg('ai', '⚠ Error de micrófono: ' + e.error);
      };

      r.onend = function() {
        if (_manualMicStop) {
          _manualMicStop = false;
          userStopped = true;
          _voiceSent = true;
          clearTimeout(silenceTimer);
          silenceTimer = null;
          _recognition = null;
          return;
        }
        if (userStopped || _voiceSent) return;
        // Acumular lo que haya en el input (texto reconocido esta sesión)
        var currentText = el.chatInput.value.trim();
        var accumulated = accumulatedText.trim();
        if (currentText && currentText !== accumulated) {
          accumulatedText = currentText + ' ';
        }
        // Si el timer sigue activo, reiniciar sesión (el usuario aún habla)
        if (silenceTimer !== null) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
          setTimeout(function() {
            if (!userStopped && !_voiceSent) {
              _recognition = startSession();
            }
          }, 100);
        } else {
          // Sin timer activo — pausa real, enviar
          sendAndStop();
        }
      };

      r.start();
      return r;
    }

    _recognition = startSession();
  }

  // ── Escáner de QR / código de barras ──────────────────────────────────────
  function startScan() {
    if (!('BarcodeDetector' in window)) {
      // Fallback: input manual
      var codigo = prompt('Tu navegador no soporta escáner de cámara.\nEscribe el código manualmente (referencia o ID del item):');
      if (codigo) buscarPorCodigo(codigo.trim());
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast && toast('No se puede acceder a la cámara', 'err');
      return;
    }

    // Crear overlay con video
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center';
    overlay.innerHTML = '<div style="position:absolute;top:14px;left:14px;right:14px;color:#fff;font-family:monospace;font-size:13px;text-align:center">📷 Apunta a un código QR o código de barras</div>' +
      '<video autoplay playsinline style="max-width:90vw;max-height:70vh;border-radius:12px"></video>' +
      '<button style="position:absolute;top:10px;right:10px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:16px;cursor:pointer">✕</button>';
    document.body.appendChild(overlay);

    var video = overlay.querySelector('video');
    var closeBtn = overlay.querySelector('button');
    var stream = null;
    var detector = new window.BarcodeDetector({ formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'] });
    var scanning = true;

    function stop() {
      scanning = false;
      if (stream) stream.getTracks().forEach(function(t){ t.stop(); });
      overlay.remove();
    }
    closeBtn.addEventListener('click', stop);

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function(s) {
      stream = s;
      video.srcObject = s;
      function loop() {
        if (!scanning) return;
        detector.detect(video).then(function(codes) {
          if (codes && codes.length > 0) {
            var code = codes[0].rawValue;
            stop();
            buscarPorCodigo(code);
          } else {
            requestAnimationFrame(loop);
          }
        }).catch(function() { requestAnimationFrame(loop); });
      }
      video.addEventListener('loadedmetadata', loop);
    }).catch(function(e) {
      stop();
      toast('Error al acceder a la cámara: ' + e.message, 'err');
    });
  }

  function buscarPorCodigo(codigo) {
    if (!codigo) return;
    // Buscar en inventario por ref, id, o nombre
    var match = state.inventario.find(function(i) {
      return String(i.id) === codigo ||
        (i.ref || '').toLowerCase() === codigo.toLowerCase() ||
        (i.referencia || '').toLowerCase() === codigo.toLowerCase();
    });

    if (match) {
      // Insertar resultado directo en el chat
      var nombre = match.item || match.nombre || match.name || '(sin nombre)';
      var qty = match.qty != null ? match.qty : (match.cantidad || 0);
      appendMsg('user', '📷 Código escaneado: ' + codigo);
      var resultDiv = document.createElement('div');
      resultDiv.className = 'ag-msg ag-msg-ai';
      resultDiv.innerHTML = '✅ <strong>' + esc(nombre) + '</strong><br>' +
        '<small>Aula: ' + esc(match.aula || '—') + ' · Stock: ' + qty + ' · Ref: ' + esc(match.ref || '—') + '</small>';
      el.messages.appendChild(resultDiv);
      el.messages.scrollTop = el.messages.scrollHeight;
    } else {
      appendMsg('user', '📷 Código escaneado: ' + codigo);
      appendMsg('ai', '❌ No encuentro ningún ítem con código/referencia "' + codigo + '".');
    }
  }


  // ── Auditoría ──────────────────────────────────────────────────────────────
  var CAMPOS_AUDIT = { cat: 'Categoría', aula: 'Aula', ref: 'Referencia' };

  function getMissing(item) {
    return Object.keys(CAMPOS_AUDIT).filter(function(k){ return !item[k] && item[k] !== 0; }).map(function(k){ return CAMPOS_AUDIT[k]; });
  }

  function renderAudit() {
    var inv = state.inventario;
    var conProb = inv.filter(function(i){ return getMissing(i).length > 0; });

    // Filtro
    var filtrados = state.auditFiltro === 'todos' ? conProb
      : conProb.filter(function(i){ return !i[state.auditFiltro]; });

    // Badges
    var bd = el.panel.querySelector('#ag-audit-badges');
    bd.innerHTML = '';
    [
      ['red', conProb.length + ' con problemas'],
      ['green', (inv.length - conProb.length) + ' completos'],
      ['gray', inv.length + ' total'],
    ].forEach(function(b){ bd.appendChild(renderBadgeEl(b[0], b[1])); });

    // Tabla
    var html = '<table class="ag-table"><thead><tr><th>Nombre</th><th>Aula</th><th>Cat</th><th>Ref</th></tr></thead><tbody>';
    filtrados.slice(0, 40).forEach(function(item){
      html += '<tr>' +
        '<td>' + esc(item.nombre || '') + '</td>' +
        '<td style="color:' + (item.aula ? '#94a3b8' : '#ef4444') + '">' + esc(item.aula || '⚠️') + '</td>' +
        '<td style="color:' + (item.cat ? '#94a3b8' : '#ef4444') + '">' + esc(item.cat || '⚠️') + '</td>' +
        '<td style="color:' + (item.ref ? '#94a3b8' : '#f59e0b') + '">' + esc(item.ref || '—') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    if (filtrados.length > 40) html += '<p style="color:#475569;font-size:10px;padding:4px 0">... y ' + (filtrados.length - 40) + ' más</p>';
    el.panel.querySelector('#ag-audit-table').innerHTML = filtrados.length ? html : '<p style="color:#34d399;font-size:11px">✅ Sin problemas en este filtro</p>';
  }

  function auditAI() {
    var conProb = state.inventario.filter(function(i){ return getMissing(i).length > 0; });
    var result = el.panel.querySelector('#ag-audit-result');
    result.style.display = 'block';
    result.innerHTML = '⏳ Analizando...';
    var muestra = conProb.slice(0, 12).map(function(i){ return { nombre: i.nombre, aula: i.aula, cat: i.cat, ref: i.ref, proveedor: i.proveedor, faltantes: getMissing(i) }; });
    var prompt = 'Audita estos ' + conProb.length + ' items del inventario FP con campos incompletos (muestra los primeros ' + muestra.length + '):\n' + JSON.stringify(muestra) + '\nSugiere valores razonables basandote en el nombre. Tabla: Item | Campos faltantes | Sugerencia | Prioridad';
    var full = '';
    streamAI([{ role: 'user', content: prompt }], '', function(d){ full += d; result.innerHTML = md2html(full); })
      .catch(function(e){ result.innerHTML = '❌ ' + e.message; });
  }

  // ── CSV ────────────────────────────────────────────────────────────────────
  function parseCSV(text) {
    var lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    var headers = lines[0].split(',').map(function(h){ return h.trim().replace(/^"|"$/g,''); });
    return lines.slice(1).map(function(line){
      var vals = line.split(',').map(function(v){ return v.trim().replace(/^"|"$/g,''); });
      var obj = {};
      headers.forEach(function(h, i){ obj[h] = vals[i] || ''; });
      return obj;
    });
  }

  function analyzeCSV() {
    var text = el.panel.querySelector('#ag-csv-text').value.trim();
    if (!text) return;
    state.csvParsed = parseCSV(text);
    var result = el.panel.querySelector('#ag-csv-result');
    var bd = el.panel.querySelector('#ag-csv-badges');
    result.style.display = 'block';
    result.innerHTML = '⏳ Analizando CSV...';

    // Badges
    bd.innerHTML = '';
    if (state.csvParsed.length) {
      [
        ['green', state.csvParsed.length + ' filas'],
        ['blue', Object.keys(state.csvParsed[0]).length + ' columnas'],
        ['red', state.csvParsed.filter(function(r){ return !r['Nombre'] && !r['nombre']; }).length + ' sin nombre'],
      ].forEach(function(b){ bd.appendChild(renderBadgeEl(b[0], b[1])); });
    }

    var importBtn = el.panel.querySelector('#ag-csv-import');
    importBtn.disabled = state.csvParsed.length === 0;

    var prompt = 'Analiza este CSV de inventario FP (' + state.csvParsed.length + ' filas). Columnas: ' +
      Object.keys(state.csvParsed[0] || {}).join(', ') + '.\nPrimeras 5 filas:\n' + JSON.stringify(state.csvParsed.slice(0,5)) +
      '\nDetecta: campos vacios criticos, valores incoherentes, columnas no reconocidas. Resume que se importara y que problemas hay.';
    var full = '';
    streamAI([{ role: 'user', content: prompt }], '', function(d){ full += d; result.innerHTML = md2html(full); })
      .catch(function(e){ result.innerHTML = '❌ ' + e.message; });
  }

  function importCSV() {
    if (!state.csvParsed.length) return;
    var result = el.panel.querySelector('#ag-csv-result');
    result.style.display = 'block';
    result.innerHTML = '⏳ Importando ' + state.csvParsed.length + ' ítems...';
    apiPost('/api/item', { action: 'bulkImport', items: state.csvParsed })
      .then(function(res){ result.innerHTML = '✅ Importación completada.<br><small>' + JSON.stringify(res) + '</small>'; loadData(); })
      .catch(function(e){ result.innerHTML = '❌ Error: ' + e.message; });
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', buildWidget);
    } else {
      buildWidget();
    }
  }

  init();

})();
