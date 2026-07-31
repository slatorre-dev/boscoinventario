# Búsqueda por número de serie (cámara) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un botón de cámara que fotografía la etiqueta de un equipo, extrae el número de serie con IA de visión (GitHub Models), y busca ese ítem en el inventario del departamento del usuario.

**Architecture:** Migración D1 añade `inventario.serie`. Backend: acción nueva `buscarPorSerie` en `functions/api/item.js` que llama a GitHub Models (mismo mecanismo que `proxy-ai.js`) pidiendo el S/N en JSON, y busca match exacto/fuzzy en D1. Frontend: módulo nuevo `js/camara-serie.js` (modal de cámara, captura foto fija, llama al backend, muestra resultado/candidatos), botón nuevo junto al de QR, campo `serie` nuevo en el modal de ítem.

**Tech Stack:** Cloudflare D1 (SQL), Cloudflare Pages Functions (backend JS), Vanilla JS + `getUserMedia`/`canvas` (frontend), GitHub Models `gpt-4o-mini` (vision, vía `env.GITHUB_TOKEN` ya configurado).

## Global Constraints

- Toda acción nueva de backend se registra en `ENDPOINT_MAP` (`js/api.js`) y `ACTION_PERMISSIONS` (`js/roles.js`) en la misma tarea que la crea — lección de v522, nunca dejarlo para después.
- `buscarPorSerie` es de solo lectura, disponible para cualquier usuario logueado (sin restricción de rol) — mismo tratamiento que `docs.read`, que `can()` concede siempre.
- Scoping por departamento: un usuario ve/encuentra por S/N solo ítems de su propio departamento + el compartido `iesjuanbosco` (constante `GENERIC_DEPT`), salvo `superadmin` que ve todo — mismo patrón ya usado en `item.js`/`list.js`.
- Cambiar `VERSION` en `sw.js` (v542 → v543) como parte del commit final.
- Migraciones nuevas van numeradas después de la última existente (`0025_fecha_adquisicion_precio.sql` es la última) → esta es `0026`.
- Aplicar la migración en remoto con `npx wrangler d1 execute boscoinventario --remote --file=migrations/0026_inventario_serie.sql` (con `$env:NODE_TLS_REJECT_UNAUTHORIZED="0"` antes si hace falta, ver CLAUDE.md) — no local.

---

### Task 1: Migración D1 — columna `serie`

**Files:**
- Create: `migrations/0026_inventario_serie.sql`

**Interfaces:**
- Produces: columna `inventario.serie` (`TEXT DEFAULT ''`), índice `idx_inventario_dept_serie` sobre `(departamento, serie)`. Todas las tareas siguientes asumen que esta columna ya existe en D1 remoto.

- [ ] **Step 1: Escribir la migración**

```sql
ALTER TABLE inventario ADD COLUMN serie TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_inventario_dept_serie ON inventario(departamento, serie);
```

- [ ] **Step 2: Aplicar en remoto**

Run: `npx wrangler d1 execute boscoinventario --remote --file=migrations/0026_inventario_serie.sql`
Expected: salida sin error, resumen de "1 query executed" o similar (ALTER TABLE no devuelve filas).

- [ ] **Step 3: Verificar columna e índice creados**

Run: `npx wrangler d1 execute boscoinventario --remote --command="PRAGMA table_info(inventario)"`
Expected: la lista de columnas incluye una fila con `name: "serie"`.

Run: `npx wrangler d1 execute boscoinventario --remote --command="SELECT name FROM sqlite_master WHERE type='index' AND name='idx_inventario_dept_serie'"`
Expected: una fila con `idx_inventario_dept_serie`.

- [ ] **Step 4: Commit**

```bash
git add migrations/0026_inventario_serie.sql
git commit -m "feat: añade columna inventario.serie (número de serie)"
```

---

### Task 2: Campo `serie` en `HEADERS_INV` y modal de ítem (alta/edición manual)

Antes de construir la búsqueda por cámara, el campo debe poder guardarse/editarse a mano — así Task 3 (backend de búsqueda) y Task 4 (frontend de cámara) tienen datos reales contra los que probar.

**Files:**
- Modify: `functions/api/item.js:1` (añadir `'serie'` a `HEADERS_INV`)
- Modify: `index.html:678-684` (input nuevo `f_serie` en la sección Detalles)
- Modify: `js/modal-item.js:40`, `js/modal-item.js:56`, `js/modal-item.js:69`, `js/modal-item.js:825` (añadir `'f_serie'` a los 4 arrays de campos), `js/modal-item.js:845` (precarga al abrir modal existente), `js/modal-item.js:1051-1087` (`saveItem()`, añadir `serie` al payload `v`)

**Interfaces:**
- Consumes: ninguna nueva (usa `escHtml`, `apiPost`, `items` ya existentes).
- Produces: `item.serie` viaja en el payload de `add`/`update` junto al resto de campos — Task 3 depende de que esta columna ya se pueble desde el modal para poder probar la búsqueda contra datos reales.

- [ ] **Step 1: Añadir `serie` a `HEADERS_INV` en el backend**

En `functions/api/item.js:1`, añadir `'serie'` al array (después de `'code'`, antes de `'es_contenedor'`, para agrupar con los otros campos identificadores):

```js
const HEADERS_INV = ['id','ref','aula','mod','item','qty','min','cat','loc','est','util','proveedor','tags','fecha','fecha_adquisicion','precio','mant','mantFecha','mantNota','mantResp','mantEstado','mantSolicitante','mantSolicitanteEmail','foto','obs','code','serie','es_contenedor','parent_id','tipo_material','oculto'];
```

- [ ] **Step 2: Añadir el input `f_serie` en el HTML del modal**

En `index.html`, dentro de `.m-section-details-body` (línea ~678-684), añadir una línea nueva junto a Proveedor:

```html
<div><label class="fl">Nº de serie</label><input class="fi-w" id="f_serie" placeholder="S/N de fábrica"></div>
```//
Insertarla justo después del div de `f_proveedor` (línea 680) y antes de `f_precio`.

- [ ] **Step 3: Registrar `f_serie` en los arrays de campos de `modal-item.js`**

En `js/modal-item.js`, añadir `'f_serie'` a los arrays de las líneas 40, 56, 69 y 825 (mismo patrón que `f_proveedor`, junto a él en cada array):

```js
const fields = ['f_ref', 'f_aula', 'f_item', 'f_qty', 'f_min', 'f_tipo_material', 'f_cat', 'f_ciclo', 'f_mod', 'f_loc', 'f_est', 'f_util', 'f_proveedor', 'f_serie', 'f_tags', 'f_fecha', 'f_mant', 'f_mantFecha', 'f_mantEstado', 'f_mantResp', 'f_mantNota', 'f_obs', 'f_es_contenedor', 'f_parent_id', 'f_foto'];
```
(ajustar el array de la línea 825, que no incluye `'f_foto'`, y los de 56/69, que tampoco lo incluyen — mantener el resto del array igual, solo insertar `'f_serie'` tras `'f_proveedor'`).

- [ ] **Step 4: Precargar el valor al abrir un ítem existente**

En `js/modal-item.js:845`, junto a la línea de `f_ref`, añadir:

```js
document.getElementById('f_serie').value = id ? (m?.serie||'') : '';
```

- [ ] **Step 5: Incluir `serie` en el payload de guardado**

En `js/modal-item.js`, dentro de `saveItem()` (objeto `v`, línea ~1076), añadir junto a `proveedor`:

```js
serie:document.getElementById('f_serie').value.trim(),
```

- [ ] **Step 6: Verificar manualmente en producción tras deploy**

(Este paso se ejecuta tras el deploy final de Task 6 — anotarlo aquí, verificar al final.) Abrir un ítem, escribir un número de serie, guardar, reabrir el modal, confirmar que el valor persiste. Confirmar en D1: `npx wrangler d1 execute boscoinventario --remote --command="SELECT id, item, serie FROM inventario WHERE serie != '' LIMIT 5"`.

- [ ] **Step 7: Commit**

```bash
git add functions/api/item.js index.html js/modal-item.js
git commit -m "feat: campo número de serie editable en modal de ítem"
```

---

### Task 3: Backend — acción `buscarPorSerie`

**Files:**
- Modify: `functions/api/item.js` (nueva rama `if (action === 'buscarPorSerie')`)
- Modify: `js/api.js:6` (registrar en `ENDPOINT_MAP`)
- Modify: `js/roles.js` (registrar en `ACTION_PERMISSIONS`, tratar como lectura universal en `can()`)

**Interfaces:**
- Consumes: `GENERIC_DEPT`, `isSuperAdmin(user)`, `isProfesor(user)`, `getAuditActor(request, env, data)` (ya definidas en `item.js`), `env.GITHUB_TOKEN` (ya configurado en Cloudflare, usado hoy por `proxy-ai.js`).
- Produces: `POST /api/item {action:'buscarPorSerie', imagen:'<base64 sin prefijo data:>'}` → responde una de:
  - `{ok:true, match:'exacto', item:{...fila completa...}}`
  - `{ok:true, match:'fuzzy', candidatos:[{id, item, ref, aula, serie}, ...]}` (máx 5, ordenados por distancia ascendente)
  - `{ok:true, match:'ninguno', serieLeida:'XXXX'}`
  - `{ok:true, match:'sin_lectura'}`
  - `{ok:false, error:'...'}` (fallo de red/API externa)

  Task 4 (frontend) consume esta forma de respuesta tal cual — los 4 valores de `match` son el contrato exacto que la UI debe manejar.

- [ ] **Step 1: Añadir función de distancia de edición (Levenshtein) al final de `functions/api/item.js`**

```js
function levenshtein(a, b) {
  a = String(a || '').toUpperCase();
  b = String(b || '').toUpperCase();
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}
```

- [ ] **Step 2: Añadir la rama `buscarPorSerie` en `onRequestPost`, antes del `return Response.json({ ok: false, error: 'Accion desconocida' });` final**

```js
  if (action === 'buscarPorSerie') {
    const imagen = body.imagen;
    if (!imagen) return Response.json({ ok: false, error: 'Falta la imagen' });
    if (!env.GITHUB_TOKEN) return Response.json({ ok: false, error: 'GITHUB_TOKEN no configurado en Cloudflare' });

    let serieLeida = '';
    try {
      const aiResp = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.GITHUB_TOKEN}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extrae ÚNICAMENTE el número de serie (S/N, Serial Number, Service Tag) visible en esta etiqueta de equipo. Responde SOLO con JSON: {"serie": "VALOR"} o {"serie": null} si no ves ningún número de serie legible. No añadas explicaciones.' },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imagen}` } }
              ]
            }
          ],
          temperature: 0,
          max_tokens: 100
        })
      });
      if (!aiResp.ok) return Response.json({ ok: false, error: 'Error del servicio de IA' });
      const aiData = await aiResp.json();
      const raw = aiData?.choices?.[0]?.message?.content || '';
      const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
      serieLeida = String(parsed.serie || '').trim();
    } catch (e) {
      return Response.json({ ok: true, match: 'sin_lectura' });
    }

    if (!serieLeida) return Response.json({ ok: true, match: 'sin_lectura' });

    const deptFilter = superadmin
      ? ''
      : ` AND (departamento=? OR departamento='${genericDept}')`;
    const deptBind = superadmin ? [] : [dept];

    const exact = await env.DB.prepare(`SELECT * FROM inventario WHERE serie=?${deptFilter}`)
      .bind(serieLeida, ...deptBind).first();
    if (exact) return Response.json({ ok: true, match: 'exacto', item: exact });

    const candidatesRes = await env.DB.prepare(`SELECT id, item, ref, aula, serie FROM inventario WHERE serie != ''${deptFilter}`)
      .bind(...deptBind).all();
    const candidatos = (candidatesRes.results || [])
      .map(r => ({ ...r, _dist: levenshtein(r.serie, serieLeida) }))
      .filter(r => r._dist <= 2)
      .sort((a, b) => a._dist - b._dist)
      .slice(0, 5)
      .map(({ _dist, ...r }) => r);

    if (candidatos.length) return Response.json({ ok: true, match: 'fuzzy', candidatos });
    return Response.json({ ok: true, match: 'ninguno', serieLeida });
  }
```

- [ ] **Step 3: Registrar la acción en `ENDPOINT_MAP`**

En `js/api.js:6`, añadir `buscarPorSerie:'item'` al objeto (mismo grupo que `fotosGet`/`fotosSync`):

```js
const ENDPOINT_MAP = {
  add:'item', update:'item', delete:'item', bulkImport:'item', restoreBackup:'item', toggleOculto:'item', fotosGet:'item', fotosSync:'item', buscarPorSerie:'item',
  ...
```

- [ ] **Step 4: Registrar el permiso en `roles.js`**

En `js/roles.js`, dentro de `ACTION_PERMISSIONS` (junto a `fotosGet`), añadir:

```js
buscarPorSerie: 'serie.read',
```

Y en la función `can()` (línea ~85-91), tratar `serie.read` igual que `docs.read` (lectura universal para cualquier sesión válida):

```js
function can(permission){
  if(!SESSION) return false;
  if(permission === 'docs.read' || permission === 'serie.read') return true;
  if(SUPERADMIN_ONLY.includes(permission)) return userRole() === 'superadmin';
  const perms = ROLE_PERMISSIONS[userRole()] || ROLE_PERMISSIONS.consulta;
  return perms.includes('*') || perms.includes(permission);
}
```

- [ ] **Step 5: Verificar con una llamada directa (curl) contra producción tras deploy**

(Se ejecuta tras Task 6.) Con una imagen de etiqueta real convertida a base64:

Run (PowerShell): `$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("ruta\a\etiqueta.jpg")); Invoke-RestMethod -Method Post -Uri "https://boscoinventario.pages.dev/api/item?u=Seba&p=Seba" -Body (@{action='buscarPorSerie'; imagen=$b64} | ConvertTo-Json) -ContentType "application/json"`

Expected: JSON con `ok:true` y uno de los 4 valores de `match`.

- [ ] **Step 6: Commit**

```bash
git add functions/api/item.js js/api.js js/roles.js
git commit -m "feat: acción buscarPorSerie — OCR de número de serie vía GitHub Models"
```

---

### Task 4: Frontend — modal de cámara y botón

**Files:**
- Create: `js/camara-serie.js`
- Modify: `index.html` (botón nuevo junto a `gsQr` línea ~313-319; modal nuevo junto a `mQrScanner` línea ~1504-1533; script tag nuevo junto a `js/qr-scanner.js`)

**Interfaces:**
- Consumes: `apiPost({action:'buscarPorSerie', imagen})` (Task 3), `openItemRoute(id)` (`js/nav.js:205`), `openModal()` (`js/modal-item.js`, para el caso "crear ítem nuevo con S/N"), `toast(msg, type)` (`js/inventory.js:1718`), `escHtml(v)` (`js/modal-item.js`).
- Produces: `openCamaraSerie()` (abre el modal, llamada desde el `onclick` del botón nuevo), `closeCamaraSerie()`.

- [ ] **Step 1: Crear `js/camara-serie.js`**

```js
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
```

- [ ] **Step 2: Añadir el botón nuevo en `index.html`, junto al botón de QR (línea ~313-319)**

```html
<button class="gsearch-qr" id="gsSerie" onclick="openCamaraSerie()" title="Buscar por número de serie">
  📷
</button>
```
Insertar justo después del `</button>` que cierra `gsQr` (línea 319), antes de `<div class="gsr" id="gsResults"...`.

- [ ] **Step 3: Añadir el modal nuevo en `index.html`, junto a `mQrScanner` (después de la línea 1533)**

```html
<div class="mbg" id="mCamaraSerie" onclick="if(event.target===this)closeCamaraSerie()">
  <div class="modal" style="max-width:600px">
    <div class="mh"><div class="mt">📷 Buscar por número de serie</div><button class="mx" onclick="closeCamaraSerie()">✕</button></div>
    <video id="serieVideo" style="width:100%;max-width:500px;border-radius:8px;margin-bottom:16px;display:none" autoplay playsinline></video>
    <div id="serieEstado" style="display:none;font-size:13px;color:var(--muted);margin:16px 0;text-align:center">Leyendo etiqueta...</div>
    <div id="serieResultado" style="display:none"></div>
    <div class="mf" style="margin-top:16px;gap:8px">
      <button class="btn btn-p" id="serieCapturarBtn" style="display:none" onclick="capturarSerie()">Capturar</button>
      <button class="btn" onclick="closeCamaraSerie()">Cerrar</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Registrar el script nuevo**

En `index.html`, añadir junto a `js/qr-scanner.js` (línea ~1707):

```html
<script defer src="js/camara-serie.js"></script>
```

- [ ] **Step 5: Verificar manualmente con Playwright contra producción (tras deploy de Task 6)**

Abrir la app logueado, pulsar el botón 📷 nuevo, conceder permiso de cámara (o verificar que el modal se abre y pide permiso), confirmar que el botón "Capturar" aparece tras iniciar el stream. No se puede simular una foto real en headless — validar visualmente que el modal/flujo no lanza errores de JS en consola.

- [ ] **Step 6: Commit**

```bash
git add js/camara-serie.js index.html
git commit -m "feat: modal de cámara para buscar ítems por número de serie"
```

---

### Task 5: Aplicar rol/UI — mostrar el botón solo con sesión activa

**Files:**
- Modify: `js/roles.js:119-144` (`applyRoleUI()`)

**Interfaces:**
- Consumes: `can('serie.read')` (Task 3).
- Produces: visibilidad del botón `#gsSerie` sincronizada con sesión, igual que `#gsQr`.

- [ ] **Step 1: Añadir la regla en `applyRoleUI()`**

En `js/roles.js`, dentro del array `rules` (línea ~121-128), añadir junto a `gsQr`:

```js
['gsQr',   null,           'inline-flex'],
['gsSerie', null,          'inline-flex']
```
(mismo tratamiento que `gsQr`: `permission: null` significa "siempre visible si hay sesión", ya que `applyRoleUI()` solo se llama tras login).

- [ ] **Step 2: Verificar visualmente**

Cargar la app logueada, confirmar que el botón 📷 aparece junto al de QR en la barra de búsqueda.

- [ ] **Step 3: Commit**

```bash
git add js/roles.js
git commit -m "feat: mostrar botón de búsqueda por serie tras login"
```

---

### Task 6: Versión, deploy y verificación end-to-end

**Files:**
- Modify: `sw.js:10` (VERSION v542 → v543)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: deploy en producción (`boscoinventario.pages.dev`) con todas las tareas anteriores activas.

- [ ] **Step 1: Subir versión del Service Worker**

En `sw.js:10`, cambiar:
```js
const VERSION = 'v543';
```

- [ ] **Step 2: Commit y push**

```bash
git add sw.js
git commit -m "chore(v543): bump version tras búsqueda por número de serie"
git push origin main
```

- [ ] **Step 3: Esperar deploy de Cloudflare Pages**

Confirmar en el dashboard de Cloudflare Pages (o esperar ~1-2 min) que el deploy de `main` terminó con éxito.

- [ ] **Step 4: Ejecutar los pasos de verificación diferidos**

Ejecutar ahora Task 2 Step 6, Task 3 Step 5 y Task 4 Step 5 (verificación manual/curl contra producción ya desplegada).

- [ ] **Step 5: Verificar los 4 casos de `buscarPorSerie` con datos reales**

1. Guardar un ítem de prueba con un `serie` conocido (vía modal, Task 2).
2. Llamar `buscarPorSerie` con una imagen que contenga ese mismo número → esperar `match:'exacto'`.
3. Llamar con una imagen que contenga ese número con 1-2 caracteres distintos (simular error de OCR editando el JSON de prueba si hace falta, o probar con una etiqueta real parecida) → esperar `match:'fuzzy'`.
4. Llamar con una imagen de un número de serie que no existe en la base → esperar `match:'ninguno'` con `serieLeida` correcta.
5. Llamar con una imagen sin texto legible (ej. una foto en blanco) → esperar `match:'sin_lectura'`.

- [ ] **Step 6: Verificar scoping por departamento**

Con un usuario de un departamento normal (no superadmin), confirmar que `buscarPorSerie` NO encuentra un ítem con `serie` conocido que pertenezca a otro departamento (no `iesjuanbosco`). Con `superadmin`, confirmar que sí lo encuentra.

Run: `npx wrangler d1 execute boscoinventario --remote --command="SELECT id, item, serie, departamento FROM inventario WHERE serie != '' LIMIT 10"` para preparar los IDs/departamentos de prueba.

- [ ] **Step 7: Actualizar CLAUDE.md con el resumen de sesión**

Añadir una entrada nueva en la sección "Historial de sesiones" describiendo lo construido (feature nueva, migración `0026`, versión v543), siguiendo el mismo formato que las entradas anteriores.

- [ ] **Step 8: Commit final de documentación**

```bash
git add CLAUDE.md
git commit -m "docs: resumen de sesión — búsqueda por número de serie (v543)"
git push origin main
```
