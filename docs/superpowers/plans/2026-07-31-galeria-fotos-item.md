# Galería de fotos por ítem (hasta 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir hasta 3 fotos por ítem de inventario, gestionables desde el modal de editar/crear ítem, sin afectar a los 10+ sitios existentes que muestran una sola foto como miniatura.

**Architecture:** Tabla D1 nueva `item_fotos` guarda cada foto en base64 (mismo patrón que hoy usa `inventario.foto`). La fila con `orden=1` es la "principal" y se espeja automáticamente en `inventario.foto` tras cada guardado — así ningún sitio existente (tabla, tarjetas, QR, impresión) necesita cambiar. La galería completa se carga solo bajo demanda al abrir el modal de un ítem, nunca en la carga masiva de `list.js`.

**Tech Stack:** Cloudflare Pages Functions (backend, `functions/api/item.js`), Vanilla JS (frontend, `js/modal-item.js`), D1 (SQLite), HTML/CSS sin build step.

## Global Constraints

- Máximo 3 fotos por ítem, validado en backend (no solo en frontend).
- Calidad de compresión JPEG: `0.40` (bajado desde `0.45`), redimensión a 360px máx — mismos valores para las 3 fotos, mismo mecanismo que ya usa `setMainPhotoFromFile()`.
- `inventario.foto` (columna existente) sigue siendo la fuente que leen los 10+ sitios existentes (tabla, tarjetas, tooltip rápido, QR scanner, impresión de etiquetas, `list.js`) — **ninguno de esos archivos se modifica en este plan**.
- `list.js` no incluye `item_fotos` en su `SELECT *` masivo — la galería completa se trae solo con un fetch bajo demanda al abrir el modal de edición.
- Verificación manual únicamente: no hay `wrangler pages dev` funcional en este entorno Windows (crash de libuv/workerd ya confirmado en sesión anterior) — toda verificación es contra producción tras deploy, con Playwright + `wrangler d1 execute`.
- Workflow de despliegue del proyecto: bump `VERSION` en `sw.js` → commit → `git push origin main` (Cloudflare Pages autodespliega). No usar `--no-verify` ni saltarse hooks.
- Toda acción nueva del backend debe registrarse en **ambos** `js/api.js:ENDPOINT_MAP` y `js/roles.js:ACTION_PERMISSIONS` — un bug de v522 (documentado en `CLAUDE.md`) fue exactamente olvidar este registro para una acción nueva, causando fallo silencioso.

---

## Task 1: Migración D1 — tabla `item_fotos` + copia de fotos existentes

**Files:**
- Create: `migrations/0024_item_fotos.sql`

**Interfaces:**
- Produces: tabla `item_fotos(id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, foto TEXT NOT NULL, orden INTEGER NOT NULL DEFAULT 1)`, poblada con una fila `orden=1` por cada ítem que ya tenía `inventario.foto` no vacía.

### Contexto para el implementador

Este proyecto usa Cloudflare D1 (SQLite remoto). Las migraciones son archivos `.sql` en `migrations/`, aplicados manualmente con `npx wrangler d1 execute boscoinventario --remote --file=migrations/00XX_descripcion.sql` (ver `CLAUDE.md`, sección "Workflow Estándar"). No hay ORM ni migraciones automáticas — el archivo se escribe y se ejecuta a mano.

La tabla `inventario` tiene hoy ~1800+ filas, algunas con `foto` en base64 (~22-30KB cada una) y otras con `foto` vacía o NULL. Solo las que tienen foto real deben copiarse.

- [ ] **Step 1: Escribir la migración**

Crear `migrations/0024_item_fotos.sql`:

```sql
CREATE TABLE item_fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  foto TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_item_fotos_item_id ON item_fotos(item_id);

INSERT INTO item_fotos (item_id, foto, orden)
  SELECT id, foto, 1 FROM inventario WHERE foto IS NOT NULL AND trim(foto) != '';
```

- [ ] **Step 2: Aplicar la migración en D1 remota**

```bash
npx wrangler d1 execute boscoinventario --remote --file=migrations/0024_item_fotos.sql
```

Expected: comando termina sin error, reporta `changes` igual al número de ítems con foto no vacía.

- [ ] **Step 3: Verificar el resultado**

```bash
npx wrangler d1 execute boscoinventario --remote --command="SELECT COUNT(*) as n FROM item_fotos"
```

Comparar con:

```bash
npx wrangler d1 execute boscoinventario --remote --command="SELECT COUNT(*) as n FROM inventario WHERE foto IS NOT NULL AND trim(foto) != ''"
```

Expected: ambos comandos devuelven el mismo número `n`.

- [ ] **Step 4: Commit**

```bash
git add migrations/0024_item_fotos.sql
git commit -m "feat: migración item_fotos, copia fotos existentes como orden=1"
```

(La migración ya se aplicó en Step 2 — este commit solo registra el archivo `.sql` en el repo, siguiendo la convención del proyecto de versionar todas las migraciones aunque ya estén aplicadas en remoto.)

---

## Task 2: Backend — acciones `fotosGet` y `fotosSync` en `functions/api/item.js`

**Files:**
- Modify: `functions/api/item.js` (añadir dos bloques `if (action === ...)` dentro de `onRequestPost`)

**Interfaces:**
- Consumes: `itemDept(db, id)` (ya existe en el archivo, línea 72-75 — devuelve el `departamento` de un ítem o `''`), `isSuperAdmin(user)`, `getAuditActor(request, env, data)` (ya existen).
- Produces: acción `fotosGet` — body `{action:'fotosGet', itemId}`, responde `{ok:true, fotos:[{id, foto, orden}]}` ordenado por `orden`. Acción `fotosSync` — body `{action:'fotosSync', itemId, fotos:[{foto, orden}]}`, responde `{ok:true, fotoPrincipal:string}` (la foto que quedó en `orden=1`, o `''` si la galería quedó vacía — el frontend la usa para actualizar `item.foto` en memoria sin releer todo el ítem).

### Contexto para el implementador

`functions/api/item.js` maneja las acciones de un ítem individual (`add`, `update`, `delete`, `bulkImport`, `toggleOculto`, `restoreBackup`) dentro de un único `onRequestPost`. El patrón de verificación de propiedad ya existe para `update`/`delete` (líneas 104-110 y 121-127):

```js
if (!superadmin) {
  const currentDept = await itemDept(env.DB, item.id);
  if (currentDept !== dept && currentDept !== genericDept) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
  }
}
```

`dept` (línea 82: `const dept = user.departamento || '';`) y `genericDept` (línea 83) ya están calculados al inicio de `onRequestPost`, antes de cualquier bloque `if (action === ...)` — no hace falta recalcularlos.

- [ ] **Step 1: Añadir la acción `fotosGet`**

Localizar el final del bloque `if (action === 'delete') { ... }` (línea 121-134) en `functions/api/item.js` y añadir justo después:

```js
  if (action === 'fotosGet') {
    const itemId = body.itemId;
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, itemId);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    const rows = await env.DB.prepare('SELECT id, foto, orden FROM item_fotos WHERE item_id=? ORDER BY orden').bind(itemId).all();
    return Response.json({ ok: true, fotos: rows.results || [] });
  }
```

- [ ] **Step 2: Añadir la acción `fotosSync`**

Justo después del bloque de `fotosGet`:

```js
  if (action === 'fotosSync') {
    const itemId = body.itemId;
    const fotos = Array.isArray(body.fotos) ? body.fotos : [];
    if (fotos.length > 3) {
      return Response.json({ ok: false, error: 'Máximo 3 fotos por ítem' });
    }
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, itemId);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    await env.DB.prepare('DELETE FROM item_fotos WHERE item_id=?').bind(itemId).run();
    if (fotos.length) {
      const stmt = env.DB.prepare('INSERT INTO item_fotos (item_id, foto, orden) VALUES (?,?,?)');
      await env.DB.batch(fotos.map((f, i) => stmt.bind(itemId, f.foto, f.orden || (i + 1))));
    }
    const principal = fotos.find(f => (f.orden || 1) === 1);
    const fotoPrincipal = principal ? principal.foto : '';
    await env.DB.prepare('UPDATE inventario SET foto=? WHERE id=?').bind(fotoPrincipal, itemId).run();
    await auditLog(env.DB, user, 'fotosSync', itemId, `Fotos actualizadas (${fotos.length})`);
    return Response.json({ ok: true, fotoPrincipal });
  }
```

**Nota:** `auditLog` ya está definida en el archivo (línea 39-49) y toma `(db, user, accion, itemId, resumen)` — misma firma usada por `add`/`update`/`delete`, no requiere cambios.

- [ ] **Step 3: Verificar manualmente contra D1 remota tras el deploy (Task 5)**

Este step se ejecuta después de Task 5 (frontend) porque requiere la app desplegada para generar una petición real. Anotarlo aquí como recordatorio: `npx wrangler d1 execute boscoinventario --remote --command="SELECT * FROM item_fotos WHERE item_id=<id de prueba>"` tras probar la funcionalidad en el navegador.

- [ ] **Step 4: Commit**

```bash
git add functions/api/item.js
git commit -m "feat: acciones fotosGet y fotosSync en item.js"
```

---

## Task 3: Frontend — registrar las acciones nuevas en `ENDPOINT_MAP` y `ACTION_PERMISSIONS`

**Files:**
- Modify: `js/api.js:6` (`ENDPOINT_MAP`)
- Modify: `js/roles.js:34-37` (`ACTION_PERMISSIONS`)

**Interfaces:**
- Consumes: ninguna — este task solo registra nombres de acción ya definidos en Task 2.
- Produces: `apiPost({action:'fotosGet', ...})` y `apiPost({action:'fotosSync', ...})` resuelven al endpoint `item` y pasan el chequeo de permisos `canAction()`.

### Contexto para el implementador

Este es un task deliberadamente separado y **obligatorio** — un bug real de v522 (documentado en `CLAUDE.md`) fue añadir una acción nueva al backend sin registrarla en estos dos archivos, causando que la funcionalidad fallara en silencio (`apiPost` la trataba como endpoint desconocido). No fusionar este paso dentro de Task 2 ni saltarlo.

- [ ] **Step 1: Añadir a `ENDPOINT_MAP` en `js/api.js`**

Localizar (línea 6):

```js
  add:'item', update:'item', delete:'item', bulkImport:'item', restoreBackup:'item', toggleOculto:'item',
```

Reemplazar por:

```js
  add:'item', update:'item', delete:'item', bulkImport:'item', restoreBackup:'item', toggleOculto:'item', fotosGet:'item', fotosSync:'item',
```

- [ ] **Step 2: Añadir a `ACTION_PERMISSIONS` en `js/roles.js`**

Localizar (líneas 34-38):

```js
  add: 'items.write',
  update: 'items.write',
  delete: 'items.delete',
  bulkImport: 'import.write',
  restoreBackup: 'import.write',
```

Añadir justo después:

```js
  add: 'items.write',
  update: 'items.write',
  delete: 'items.delete',
  bulkImport: 'import.write',
  restoreBackup: 'import.write',
  fotosGet: 'items.write',
  fotosSync: 'items.write',
```

**Nota:** `fotosGet` usa el mismo permiso que `update`/`add` (`items.write`) por simplicidad — no existe hoy un permiso de solo-lectura más granular para ítems individuales, y quien puede abrir el modal de edición ya tiene ese permiso.

- [ ] **Step 3: Verificar que ambos archivos quedan sintácticamente correctos**

```bash
node --check js/api.js
node --check js/roles.js
```

Expected: ambos comandos terminan sin salida (sin error de sintaxis).

- [ ] **Step 4: Commit**

```bash
git add js/api.js js/roles.js
git commit -m "feat: registrar fotosGet/fotosSync en ENDPOINT_MAP y ACTION_PERMISSIONS"
```

---

## Task 4: Frontend — UI de galería en el modal de ítem (`js/modal-item.js` + `index.html`)

**Files:**
- Modify: `index.html:598-625` (sección `📦 INVENTARIO` del modal de ítem)
- Modify: `js/modal-item.js` (funciones de foto: `renderMainPhoto`, `setMainPhotoFromFile`, `fotoFileChanged`, `fotoPreviewClick`, más las nuevas de galería)

**Interfaces:**
- Consumes: `setMainPhotoFromFile(file)` (ya existe, línea 648-670 — se reutiliza con `QUALITY` cambiado de `0.45` a `0.40`), `apiPost` (`js/api.js`).
- Produces: array global `_fotosEditing` (`[{foto, orden}]`, máx 3 elementos) que Task 5 (guardado) consume para llamar a `fotosSync`. Función `renderFotosGaleria()` que pinta los slots.

### Contexto para el implementador

El HTML actual del bloque de foto (`index.html:598-625`) tiene: un `<input type="hidden" id="f_foto">` que guarda el base64 de la foto principal, un `<input type="file" id="f_foto_file">` oculto que dispara la subida, un `<div id="f_foto_preview">` que muestra la miniatura, y un botón "📷 Subir". `renderMainPhoto(src)` (línea 615-622 de `js/modal-item.js`) ya rellena `#f_foto` y `#f_foto_preview` a partir de un string base64.

Este task sustituye ese único slot por una fila de hasta 3 slots, manteniendo `#f_foto`/`#f_foto_preview` como el slot de la foto principal (slot 0) para minimizar cambios en el resto del archivo que ya lee `document.getElementById('f_foto').value` (ej. `saveItem()`, línea 1002).

- [ ] **Step 1: Sustituir el HTML del bloque de foto en `index.html`**

Reemplazar (líneas 601-624):

```html
        <div class="full">
          <label class="fl">Foto principal</label>
          <input type="hidden" id="f_foto">
          <input type="file" id="f_foto_file" accept="image/*" capture="environment" style="display:none" onchange="fotoFileChanged(this)">
          <div class="photo-picker">
            <div class="photo-col">
              <div class="photo-preview" id="f_foto_preview" onclick="fotoPreviewClick()" style="cursor:pointer"><span>📷</span></div>
              <div id="qrButtonContainer" style="display:none">
                <button type="button" class="btn btn-sm" onclick="printItemQr()" style="font-size:11px;padding:4px 6px;white-space:nowrap;width:100%">🖨️ QR</button>
              </div>
            </div>
            <div class="item-stock-strip">
              <div><label class="fl">Cantidad</label><input class="fi-w" id="f_qty" type="number" min="0" value="1"></div>
              <div><label class="fl">Mínimo</label><input class="fi-w" id="f_min" type="number" min="0" value="5"></div>
              <div><label class="fl">Tipo</label>
                <select class="fi-w" id="f_tipo_material">
                  <option value="consumible">Consumible</option>
                  <option value="inventariable">Inventariable</option>
                </select>
              </div>
              <div><label class="fl">Foto</label><button type="button" class="btn btn-sm fi-w" onclick="document.getElementById('f_foto_file').click()" style="font-size:12px" title="Subir imagen o hacer foto">📷 Subir</button></div>
            </div>
          </div>
        </div>
```

Por:

```html
        <div class="full">
          <label class="fl">Fotos (máx. 3)</label>
          <input type="hidden" id="f_foto">
          <input type="file" id="f_foto_file" accept="image/*" capture="environment" style="display:none" onchange="fotoFileChanged(this)">
          <div class="photo-picker">
            <div class="photo-col">
              <div id="fotosGaleria" class="fotos-galeria"></div>
              <div id="qrButtonContainer" style="display:none">
                <button type="button" class="btn btn-sm" onclick="printItemQr()" style="font-size:11px;padding:4px 6px;white-space:nowrap;width:100%">🖨️ QR</button>
              </div>
            </div>
            <div class="item-stock-strip">
              <div><label class="fl">Cantidad</label><input class="fi-w" id="f_qty" type="number" min="0" value="1"></div>
              <div><label class="fl">Mínimo</label><input class="fi-w" id="f_min" type="number" min="0" value="5"></div>
              <div><label class="fl">Tipo</label>
                <select class="fi-w" id="f_tipo_material">
                  <option value="consumible">Consumible</option>
                  <option value="inventariable">Inventariable</option>
                </select>
              </div>
            </div>
          </div>
        </div>
```

**Nota:** se elimina el botón "📷 Subir" de la franja lateral (`item-stock-strip`) porque cada slot de la nueva galería (Step 2) incluye su propio control de subida — evita duplicar la acción en dos sitios distintos del mismo formulario.

- [ ] **Step 2: Añadir CSS mínimo para `.fotos-galeria` en `css/styles.css`**

Buscar la regla existente `.photo-preview` en `css/styles.css` (ya usada por el slot actual) para mantener el mismo tamaño/estilo visual, y añadir justo después de esa regla:

```css
.fotos-galeria{display:flex;gap:6px;flex-wrap:wrap}
.foto-slot{position:relative;width:72px;height:72px}
.foto-slot .photo-preview{width:100%;height:100%;margin:0}
.foto-slot .foto-slot-actions{position:absolute;top:-6px;right:-6px;display:flex;gap:2px}
.foto-slot .foto-slot-btn{width:18px;height:18px;border-radius:50%;border:1px solid var(--border);background:var(--white);font-size:10px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.foto-slot .foto-slot-principal-badge{position:absolute;bottom:2px;left:2px;background:var(--accent);color:#fff;font-size:9px;padding:1px 4px;border-radius:4px}
```

- [ ] **Step 3: Reescribir las funciones de foto en `js/modal-item.js`**

Localizar y reemplazar el bloque completo desde `renderMainPhoto` hasta `fotoPreviewClick` (líneas 615-685 aproximadamente — confirmar los límites exactos leyendo el archivo antes de reemplazar, ya que los números de línea pueden variar tras ediciones previas de la sesión):

```js
let _fotosEditing = []; // [{foto, orden}], máx 3

function renderMainPhoto(src){
  // Compatibilidad: sigue usado por openModal() para pre-rellenar el slot
  // principal antes de que fotosGet complete la carga de la galería.
  const input = document.getElementById('f_foto');
  if(input) input.value = src || '';
  _fotosEditing = src ? [{foto: src, orden: 1}] : [];
  renderFotosGaleria();
}

function renderFotosGaleria(){
  const el = document.getElementById('fotosGaleria');
  if(!el) return;
  const slots = [..._fotosEditing].sort((a,b)=>a.orden-b.orden);
  const html = slots.map((f, i) => `
    <div class="foto-slot">
      <div class="photo-preview has-photo" onclick="viewPhotoModalAt(${i})" style="cursor:pointer">
        <img src="${f.foto}" alt="Foto ${i+1}">
      </div>
      <div class="foto-slot-actions">
        ${i!==0?`<button type="button" class="foto-slot-btn" onclick="hacerFotoPrincipal(${i})" title="Hacer principal">★</button>`:''}
        <button type="button" class="foto-slot-btn" onclick="eliminarFoto(${i})" title="Eliminar">🗑</button>
      </div>
      ${i===0?'<span class="foto-slot-principal-badge">Principal</span>':''}
    </div>
  `).join('');
  const addBtn = slots.length < 3
    ? `<div class="foto-slot"><div class="photo-preview" onclick="document.getElementById('f_foto_file').click()" style="cursor:pointer"><span>📷</span></div></div>`
    : '';
  el.innerHTML = html + addBtn;
  const hidden = document.getElementById('f_foto');
  if(hidden) hidden.value = slots[0]?.foto || '';
}

function eliminarFoto(idx){
  _fotosEditing.splice(idx, 1);
  _fotosEditing = _fotosEditing.map((f, i) => ({foto: f.foto, orden: i + 1}));
  modalHasChanges = true;
  renderFotosGaleria();
}

function hacerFotoPrincipal(idx){
  const [chosen] = _fotosEditing.splice(idx, 1);
  _fotosEditing.unshift(chosen);
  _fotosEditing = _fotosEditing.map((f, i) => ({foto: f.foto, orden: i + 1}));
  modalHasChanges = true;
  renderFotosGaleria();
}

function viewPhotoModalAt(idx){
  const f = _fotosEditing[idx];
  if(!f) return;
  document.getElementById('photoViewImg').src = f.foto;
  document.getElementById('mPhotoView').classList.add('open');
}

function isMaintenanceMarked(item){
  return item?.mant === true || item?.mant === 1 || String(item?.mant || '').trim() === '1' || item?.est === 'Avería';
}
```

**Nota:** `viewPhotoModalAt` sustituye a la función `viewPhotoModal()` original que abría la vista ampliada de la foto única (línea 316 del archivo original, usa `#mPhotoView` y `#photoViewImg` — confirmado leyendo el código: `document.getElementById('photoViewImg').src = src`). Tras este cambio, `viewPhotoModal()` original queda sin llamantes (verificar con `grep -n "viewPhotoModal()" js/modal-item.js index.html` — si no queda ninguno fuera de su propia definición, eliminarla; `closePhotoModal()` no cambia).

- [ ] **Step 4: Reescribir `setMainPhotoFromFile`/`fotoFileChanged` para añadir a la galería en vez de reemplazar**

Localizar y reemplazar (buscar `function setMainPhotoFromFile` y `function fotoFileChanged` en el archivo):

```js
function setMainPhotoFromFile(file){
  if(!file || !file.type.startsWith('image/')) return Promise.resolve(false);
  if(_fotosEditing.length >= 3) return Promise.resolve(false);
  const MAX = 360, QUALITY = 0.40;
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if(w > MAX || h > MAX){
        if(w >= h){ h = Math.round(h*MAX/w); w = MAX; }
        else       { w = Math.round(w*MAX/h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
      _fotosEditing.push({foto: dataUrl, orden: _fotosEditing.length + 1});
      renderFotosGaleria();
      resolve(true);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    img.src = url;
  });
}

function fotoFileChanged(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if(_fotosEditing.length >= 3){ toast('Ya tienes 3 fotos, elimina una antes de añadir otra', 'err'); input.value=''; return; }
  setMainPhotoFromFile(file).then(ok => {
    if (!ok) toast('No se pudo cargar la imagen', 'err');
    modalHasChanges = true;
    input.value = '';
  });
}
```

**Nota:** `fotoPreviewClick()` (la función original que decidía entre "ver foto ampliada" o "abrir selector de archivo" según si había foto) ya no es necesaria — cada slot de `renderFotosGaleria()` tiene su propio `onclick` explícito (`viewPhotoModalAt` para slots con foto, el selector de archivo para el slot vacío de "añadir"). Eliminar la función `fotoPreviewClick` si queda sin ninguna otra llamada en el archivo (verificar con `grep -n fotoPreviewClick js/modal-item.js` antes de borrarla).

- [ ] **Step 5: Cargar la galería completa al abrir un ítem existente, en `openModal()`**

Localizar en `openModal()` (buscar `renderMainPhoto(m?.foto||'')`):

```js
  renderMainPhoto(m?.foto||'');
```

Reemplazar por:

```js
  renderMainPhoto(m?.foto||'');
  if(existing){
    apiPost({action:'fotosGet', itemId:id}).then(res => {
      if(res.ok && Array.isArray(res.fotos) && res.fotos.length){
        _fotosEditing = res.fotos.map(f => ({foto:f.foto, orden:f.orden}));
        renderFotosGaleria();
      }
    }).catch(()=>{}); // la galería completa es un extra — si falla, el modal ya se abrió con la foto principal
  }
```

**Nota:** esta llamada es intencionalmente no-bloqueante (no lleva `await`) — el modal se abre inmediatamente con la foto principal ya visible (vía `renderMainPhoto`), y la galería completa (si hay más de 1 foto) se rellena en cuanto responde el backend, sin retrasar la apertura del modal.

- [ ] **Step 6: Verificar sintaxis**

```bash
node --check js/modal-item.js
```

Expected: sin salida (sin error).

- [ ] **Step 7: Commit**

```bash
git add index.html js/modal-item.js css/styles.css
git commit -m "feat: UI de galería de hasta 3 fotos en modal de ítem"
```

---

## Task 5: Frontend — guardar la galería en `saveItem()`

**Files:**
- Modify: `js/modal-item.js` (función `saveItem`, líneas 988-1055 en la versión leída durante este plan — confirmar exacto antes de editar, pudo cambiar tras Task 4)

**Interfaces:**
- Consumes: `_fotosEditing` (array `[{foto, orden}]`, de Task 4), `apiPost({action:'fotosSync', itemId, fotos})` (de Task 2/3).
- Produces: ningún cambio de interfaz pública — `saveItem()` sigue siendo la única función que el botón "💾 Guardar" invoca.

### Contexto para el implementador

`saveItem()` ya tiene un patrón idéntico al que este task necesita: `uploadPendingDocs(eid, item.item, item.aula)` (o el equivalente para `add`, con `res.item.id`) se llama **después** de que el ítem tenga un `id` real, en ambas ramas (editar/crear). La sincronización de fotos sigue exactamente el mismo lugar y orden.

- [ ] **Step 1: Añadir la llamada a `fotosSync` en la rama de edición (`if(eid)`)**

Localizar en `saveItem()`:

```js
    if(eid){
      const item={...items.find(x=>x.id===eid),...v};
      const res = await apiPost({action:'update', item});
      if(!res.ok) throw new Error(res.error);
      const i=items.findIndex(x=>x.id===eid); items[i]=item;
      await uploadPendingDocs(eid, item.item, item.aula);
      if(typeof logHistorial === 'function') logHistorial('itemUpdate', item.id, item.item, `Item actualizado: ${item.item} (${item.ref || item.code || item.id})`);
      fillTagSuggestions();
      toast('Ítem actualizado','ok');
    } else {
```

Reemplazar por:

```js
    if(eid){
      const item={...items.find(x=>x.id===eid),...v};
      const res = await apiPost({action:'update', item});
      if(!res.ok) throw new Error(res.error);
      const fotosRes = await apiPost({action:'fotosSync', itemId:eid, fotos:_fotosEditing});
      if(fotosRes.ok){ item.foto = fotosRes.fotoPrincipal || ''; }
      const i=items.findIndex(x=>x.id===eid); items[i]=item;
      await uploadPendingDocs(eid, item.item, item.aula);
      if(typeof logHistorial === 'function') logHistorial('itemUpdate', item.id, item.item, `Item actualizado: ${item.item} (${item.ref || item.code || item.id})`);
      fillTagSuggestions();
      toast('Ítem actualizado','ok');
    } else {
```

**Nota:** `fotosSync` se llama sin envolver en su propio `try/catch` separado — si falla, el error se propaga al `catch(err)` general de `saveItem()` (línea final del bloque `try`), que ya muestra un `toast(friendlyError(err),'err')`. Esto es intencional: si las fotos no se pueden guardar, el usuario debe enterarse, aunque el resto del ítem ya se haya actualizado correctamente (comportamiento aceptable — el spec no pide atomicidad entre ambas escrituras).

- [ ] **Step 2: Añadir la misma llamada en la rama de creación (`else`)**

Localizar justo después, en la misma función:

```js
    } else {
      const res = await apiPost({action:'add', item:v});
      if(!res.ok) throw new Error(res.error);
      items.push(res.item);
      await uploadPendingDocs(res.item.id, res.item.item, res.item.aula);
      if(typeof logHistorial === 'function') logHistorial('itemAdd', res.item.id, res.item.item, `Item añadido: ${res.item.item} (${res.item.ref || res.item.code || res.item.id})`);
      fillTagSuggestions();
      toast('Ítem añadido','ok');
    }
```

Reemplazar por:

```js
    } else {
      const res = await apiPost({action:'add', item:v});
      if(!res.ok) throw new Error(res.error);
      if(_fotosEditing.length){
        const fotosRes = await apiPost({action:'fotosSync', itemId:res.item.id, fotos:_fotosEditing});
        if(fotosRes.ok){ res.item.foto = fotosRes.fotoPrincipal || ''; }
      }
      items.push(res.item);
      await uploadPendingDocs(res.item.id, res.item.item, res.item.aula);
      if(typeof logHistorial === 'function') logHistorial('itemAdd', res.item.id, res.item.item, `Item añadido: ${res.item.item} (${res.item.ref || res.item.code || res.item.id})`);
      fillTagSuggestions();
      toast('Ítem añadido','ok');
    }
```

**Nota:** en la rama de creación, `fotosSync` solo se llama si `_fotosEditing.length` tiene algo — un ítem nuevo sin fotos no necesita esta llamada extra (evita una petición de red innecesaria en el caso más común de crear un ítem sin foto todavía).

- [ ] **Step 3: Limpiar `_fotosEditing` al cerrar el modal**

Buscar dónde se resetea el estado del modal al cerrarlo (función `closeM` o equivalente, ya usada en `saveItem()` vía `closeM(true)`) y confirmar que `_fotosEditing = []` se ejecuta ahí, o añadirlo directamente en `openModal()` al principio (antes de `renderMainPhoto`), para que abrir un ítem nuevo tras haber editado uno con fotos no arrastre las fotos del anterior:

Localizar en `openModal()`, antes de la línea `renderMainPhoto(m?.foto||'');`:

```js
  _fotosEditing = [];
```

- [ ] **Step 4: Verificar sintaxis**

```bash
node --check js/modal-item.js
```

Expected: sin salida.

- [ ] **Step 5: Commit**

```bash
git add js/modal-item.js
git commit -m "feat: guardar galería de fotos en saveItem() vía fotosSync"
```

---

## Task 6: Deploy y verificación end-to-end en producción

**Files:**
- Modify: `sw.js` (`VERSION`)

**Interfaces:**
- Consumes: ninguna — paso de despliegue.
- Produces: build desplegado en `boscoinventario.pages.dev` con Tasks 1-5.

- [ ] **Step 1: Bump de versión**

Incrementar `VERSION` en `sw.js` al siguiente número tras el último desplegado (ver el valor actual en el archivo antes de decidir el nuevo).

- [ ] **Step 2: Commit y push**

```bash
git add sw.js
git commit -m "chore: bump version tras galería de fotos por ítem"
git push origin main
```

- [ ] **Step 3: Verificación manual con Playwright contra producción**

Login con cualquier cuenta de departamento (ej. `Seba`/`Seba`). Abrir un ítem existente con foto ya migrada (Task 1) — confirmar que aparece como "Principal" en el primer slot. Añadir una segunda foto — confirmar que aparece un segundo slot y el botón de añadir se mueve a la tercera posición. Añadir una tercera — confirmar que el botón de añadir desaparece (límite alcanzado). Pulsar "★ Hacer principal" en la segunda foto — confirmar que cambia de posición y de badge. Eliminar una foto — confirmar que el slot desaparece y el botón de añadir reaparece. Guardar — confirmar sin error. Reabrir el ítem — confirmar que el orden y el contenido persisten. Confirmar en la tabla de inventario que la miniatura mostrada es la foto marcada como "Principal".

- [ ] **Step 4: Verificar en D1 remota**

```bash
npx wrangler d1 execute boscoinventario --remote --command="SELECT item_id, orden, LENGTH(foto) as len FROM item_fotos WHERE item_id=<id del ítem de prueba> ORDER BY orden"
```

Expected: hasta 3 filas, `orden` consecutivo desde 1, `len` en el rango ~10-20KB por la calidad 0.40 (menor que los ~22-30KB medidos con calidad 0.45 antes de este plan).

```bash
npx wrangler d1 execute boscoinventario --remote --command="SELECT foto FROM inventario WHERE id=<id del ítem de prueba>"
```

Expected: coincide exactamente con la foto de `orden=1` en `item_fotos`.

- [ ] **Step 5: Limpiar datos de prueba si se usó un ítem real (no uno creado específicamente para probar)**

Si se creó un ítem nuevo solo para esta verificación, eliminarlo:

```bash
npx wrangler d1 execute boscoinventario --remote --command="DELETE FROM inventario WHERE id=<id de prueba>"
npx wrangler d1 execute boscoinventario --remote --command="DELETE FROM item_fotos WHERE item_id=<id de prueba>"
```

Si se usó un ítem real ya existente, revertir sus fotos al estado previo a la prueba (recuperar del backup de D1 o simplemente dejar las fotos de prueba si el usuario confirma que no importa mantenerlas).

---

## Self-Review Notes (completado durante la escritura del plan)

- **Cobertura del spec:** tabla `item_fotos` + migración → Task 1. `fotosGet`/`fotosSync` en backend → Task 2. Registro en `ENDPOINT_MAP`/`ACTION_PERMISSIONS` → Task 3 (explícitamente separado por el antecedente de bug v522). UI de galería → Task 4. Guardado → Task 5. Deploy + verificación → Task 6.
- **Fuera de alcance confirmado en el plan:** ningún task toca `js/inventory.js`, `js/search.js`, `js/qr-scanner.js` ni `list.js` — los 10+ sitios que muestran la miniatura principal quedan intactos, tal como pide el spec.
- **Consistencia de tipos:** `_fotosEditing` (array de `{foto, orden}`) se usa con el mismo nombre y forma en Tasks 4 y 5. `fotosGet`/`fotosSync` como nombres de acción son idénticos en Task 2 (backend), Task 3 (registro) y Tasks 4/5 (llamadas desde frontend).
- **Riesgo anotado explícitamente:** los números de línea exactos de `js/modal-item.js` citados en Tasks 4 y 5 pueden haberse desplazado por ediciones previas de la sesión (el archivo ya se tocó en el plan de "selector de departamento" anterior) — cada task incluye una nota pidiendo confirmar el contenido exacto antes de reemplazar, no solo el número de línea.
- **Placeholders:** ninguno — todo paso de código incluye el código real a escribir.
