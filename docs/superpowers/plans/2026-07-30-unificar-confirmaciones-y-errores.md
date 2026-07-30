# Unificar confirmaciones, errores y validación de formulario — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir los 19 `confirm()` nativos + 1 `alert()` por un modal propio reutilizable (`confirmDialog()`), traducir mensajes de error técnicos (`friendlyError()`), y añadir validación inline localizada en el modal de alta/edición de ítem.

**Architecture:** App vanilla JS sin módulos ES, ~28 `<script defer>` cargados en orden manual desde `index.html`. Se añade un archivo nuevo `js/ui-helpers.js` cargado en segunda posición (tras `state.js`) que expone funciones globales (`confirmDialog`, `friendlyError`, `markFieldError`, `clearFieldErrors`) consumidas por el resto de archivos. Se generaliza el modal `#mConf` ya existente en `index.html` en vez de crear un modal nuevo.

**Tech Stack:** HTML5 + CSS3 + JS vanilla (ES2017+, `async`/`await`, sin bundler ni TypeScript). Cloudflare Pages para deploy (git push → auto-deploy).

## Global Constraints

- Sin frameworks ni dependencias nuevas — todo JS vanilla consistente con el resto del proyecto.
- Sin módulos ES — funciones globales, orden de `<script>` importa.
- No se añade validación nueva en el modal de ítem más allá de los 3 campos ya validados (nombre, ciclo/departamento, módulo/asignatura) — solo se mejora cómo se comunica el fallo.
- No se toca `_bulkDelDialog` (diálogo de cuenta atrás de borrado masivo en `inventory.js`) — está fuera de alcance, resuelve un caso distinto.
- No se toca `confDel()` en `modal-item.js` (el único caso ya cableado a `#mConf` manualmente) salvo para hacerlo compatible con el nuevo `id="cIcon"` — sigue funcionando con su propio flujo interno de `onclick`/`btn.disabled`.
- Cambiar `VERSION` en `sw.js` (vXXX → vXXX+1) al final, como exige el workflow estándar del proyecto (CLAUDE.md).
- Sin test runner automatizado en el proyecto — verificación manual vía checklist, siguiendo el patrón ya usado en sesiones anteriores (Playwright ad-hoc si aplica, o verificación visual directa).

---

### Task 1: Generalizar el modal `#mConf` en `index.html`

**Files:**
- Modify: `index.html:1316-1326`

**Interfaces:**
- Consumes: nada (cambio de marcado puro).
- Produces: `#mConf` con `id="cIcon"` en el div del emoji, listo para que `confirmDialog()` (Task 2) lo controle.

- [ ] **Step 1: Añadir `id="cIcon"` al div del icono**

Reemplazar:
```html
<!-- CONFIRM -->
<div class="mbg" id="mConf">
  <div class="cbox">
    <div style="font-size:36px;margin-bottom:12px">🗑️</div>
    <div style="font-size:16px;font-weight:800;margin-bottom:6px" id="cTitle">¿Eliminar ítem?</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:22px" id="cSub"></div>
    <div style="display:flex;gap:10px;justify-content:center">
      <button class="btn" onclick="closeConf()">Cancelar</button>
      <button class="btn btn-d" id="cOk">Eliminar</button>
    </div>
  </div>
</div>
```
por:
```html
<!-- CONFIRM -->
<div class="mbg" id="mConf">
  <div class="cbox">
    <div style="font-size:36px;margin-bottom:12px" id="cIcon">🗑️</div>
    <div style="font-size:16px;font-weight:800;margin-bottom:6px" id="cTitle">¿Eliminar ítem?</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:22px" id="cSub"></div>
    <div style="display:flex;gap:10px;justify-content:center">
      <button class="btn" onclick="closeConf()">Cancelar</button>
      <button class="btn btn-d" id="cOk">Eliminar</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Verificar visualmente**

Abrir la app en navegador, disparar "eliminar ítem" (flujo existente de `confDel()`), confirmar que el modal se ve exactamente igual que antes (el icono 🗑️ sigue mostrándose, ahora con `id`).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "refactor: añadir id a icono de #mConf para generalizarlo"
```

---

### Task 2: Crear `js/ui-helpers.js` con `confirmDialog()` y `friendlyError()`

**Files:**
- Create: `js/ui-helpers.js`
- Modify: `index.html:1559` (insertar `<script>` nuevo)
- Modify: `js/modal-item.js:1047` (`closeConf()` debe resolver la promesa pendiente)

**Interfaces:**
- Consumes: `document.getElementById('mConf'|'cTitle'|'cIcon'|'cSub'|'cOk')` (Task 1); clase CSS `.btn-danger` (Task 3, con fallback a clase existente `.btn-d` si `.btn-danger` no existe todavía — ver Task 3).
- Produces:
  - `confirmDialog({title, message, confirmText, danger, icon}): Promise<boolean>` — usado por Tasks 4-6.
  - `friendlyError(err): string` — usado por Task 7.
  - `closeConf()` modificado: sigue cerrando el modal, además resuelve `false` en cualquier promesa pendiente de `confirmDialog()`.

- [ ] **Step 1: Escribir `js/ui-helpers.js`**

```js
// ═════════════════════════════════════════════════════════
// UI HELPERS — confirmación unificada + errores traducidos
// ═════════════════════════════════════════════════════════

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
```

- [ ] **Step 2: Insertar el `<script>` en `index.html`**

En `index.html`, la línea actual:
```html
<script defer src="js/state.js"></script>
<script defer src="js/roles.js"></script>
```
pasa a:
```html
<script defer src="js/state.js"></script>
<script defer src="js/ui-helpers.js"></script>
<script defer src="js/roles.js"></script>
```

- [ ] **Step 3: Modificar `closeConf()` en `js/modal-item.js:1047`**

Reemplazar:
```js
function closeConf(){document.getElementById('mConf').classList.remove('open')}
```
por:
```js
function closeConf(){
  const modal = document.getElementById('mConf');
  modal.classList.remove('open');
  if (modal._pendingResolve) {
    const resolve = modal._pendingResolve;
    modal._pendingResolve = null;
    resolve(false);
  }
}
```

Esto no rompe el flujo existente de `confDel()` (Task 0 fuera de alcance): ese flujo asigna su propio `cOk.onclick` directamente y llama a `closeConf()` manualmente tras el `apiPost` — como no pasa por `confirmDialog()`, `modal._pendingResolve` es `null` en ese caso y el `if` no hace nada.

- [ ] **Step 4: Verificar que no hay errores de carga**

Abrir la app en el navegador con la consola abierta (F12), recargar, confirmar que no aparecen errores `ReferenceError` ni `is not defined`. Ejecutar en consola: `typeof confirmDialog === 'function' && typeof friendlyError === 'function'` → debe imprimir `true`.

- [ ] **Step 5: Commit**

```bash
git add js/ui-helpers.js index.html js/modal-item.js
git commit -m "feat: añadir confirmDialog() y friendlyError() como helpers globales"
```

---

### Task 3: Estilos `.btn-danger` (si hace falta) y `.field-error`/`.field-error-msg`

**Files:**
- Modify: `css/styles.css` (añadir al final del archivo, o junto a las reglas de `.btn`/`.login-error` existentes)

**Interfaces:**
- Consumes: variable CSS `--red` (ya definida en `:root` de `styles.css`).
- Produces: clases `.field-error`, `.field-error-msg` usadas por Task 8. (`.btn-danger` no se crea si `.btn-d` ya cubre el mismo propósito — verificar primero.)

- [ ] **Step 1: Comprobar si `.btn-d` ya da estilo de "peligro" (rojo) al botón**

Buscar en `css/styles.css` la regla `.btn-d` (ya usada en `#cOk` del modal `#mConf`, `class="btn btn-d"`). Si ya pinta el botón en rojo/con énfasis de peligro, **no crear `.btn-danger` nueva** — en Task 2 usar `classList.toggle('btn-d', danger)` en vez de `'btn-danger'` (ya reflejado así en el Step 1 de Task 2). Este paso es solo de verificación, no de código.

- [ ] **Step 2: Añadir reglas `.field-error` y `.field-error-msg`**

Buscar la regla existente `.login-error` en `css/styles.css` para replicar el mismo lenguaje visual (color, tamaño de fuente). Añadir al final del archivo:

```css
/* FIELD ERROR (validación inline modal ítem) */
.field-error{border-color:var(--red)!important;box-shadow:0 0 0 2px rgba(220,38,38,.12)}
.field-error-msg{color:var(--red);font-size:12px;font-weight:600;margin-top:4px;display:block}
```

- [ ] **Step 3: Verificar visualmente**

No hay nada que renderice estas clases todavía (se usan en Task 8). Solo confirmar que el CSS no tiene errores de sintaxis: abrir la app, F12 → consola, sin errores de parseo de CSS (Chrome/Firefox no muestran error de sintaxis CSS en consola por defecto, así que basta con que la página cargue con sus estilos habituales intactos).

- [ ] **Step 4: Commit**

```bash
git add css/styles.css
git commit -m "style: añadir clases field-error para validación inline"
```

---

### Task 4: Migrar `confirm()`/`alert()` en `inventory.js`

**Files:**
- Modify: `js/inventory.js:781` (dentro de `applyBulkAction`, ya `async`)

**Interfaces:**
- Consumes: `confirmDialog()` (Task 2).
- Produces: nada nuevo — mismo comportamiento externo.

Nota: la línea 707 (`_bulkDelDialog`) está fuera de alcance (ver Global Constraints) — no se toca.

- [ ] **Step 1: Migrar `applyBulkAction` (línea 781)**

Reemplazar:
```js
  if(!patch){ toast('Selecciona una accion en lote','err'); return; }
  if(!confirm(`Aplicar cambio a ${selected.length} item${selected.length!==1?'s':''}?`)) return;
```
por:
```js
  if(!patch){ toast('Selecciona una accion en lote','err'); return; }
  if(!await confirmDialog({message:`Aplicar cambio a ${selected.length} item${selected.length!==1?'s':''}?`})) return;
```

(`applyBulkAction` ya es `async function applyBulkAction()` — confirmado en lectura previa, línea 757.)

- [ ] **Step 2: Verificar manualmente**

En la app: seleccionar 2+ ítems del inventario, elegir una acción en lote (p.ej. cambiar categoría), pulsar aplicar. Confirmar que aparece el modal propio (no el `confirm()` nativo del navegador) y que Cancelar/Aceptar funcionan.

- [ ] **Step 3: Commit**

```bash
git add js/inventory.js
git commit -m "refactor: migrar confirm() de applyBulkAction a confirmDialog()"
```

---

### Task 5: Migrar `confirm()` en `modal-aulas.js`, `modal-ciclos.js`, `modal-ubicaciones.js`, `modal-cats.js`

**Files:**
- Modify: `js/modal-aulas.js:45-53` (`removeAulaRow`, no async hoy)
- Modify: `js/modal-ciclos.js:122-148` (`removeCicloRow`, `removeModuloRow`, no async hoy)
- Modify: `js/modal-ubicaciones.js:45-51` (`removeUbicacionRow`, no async hoy)
- Modify: `js/modal-cats.js:58-66` (`removeCatRow`, no async hoy), `js/modal-cats.js:92` (`normalizeCategoriesToTags`, ya async), `js/modal-cats.js:112` (`normalizeTagsCanonicalPersist`, ya async), `js/modal-cats.js:220-226` (`removeTag`, ya async)

**Interfaces:**
- Consumes: `confirmDialog()` (Task 2).
- Produces: nada nuevo.

Estas 4 funciones (`removeAulaRow`, `removeCicloRow`, `removeModuloRow`, `removeUbicacionRow`, `removeCatRow`) se invocan hoy desde `onclick="removeXRow(idx)"` en HTML generado dinámicamente por JS (no desde `index.html` estático) — convertirlas a `async` es seguro porque un `onclick` nunca espera el resultado de la función que llama, simplemente la dispara.

- [ ] **Step 1: Migrar `removeAulaRow` en `js/modal-aulas.js:45`**

Reemplazar:
```js
function removeAulaRow(idx){
  const a = aulasEditing[idx];
  const usadas = items.filter(x=>x.aula===a.id).length;
  if(usadas > 0){
    if(!confirm(`Esta aula tiene ${usadas} ítem(s) asignados. Si la eliminas, esos ítems quedarán sin aula. ¿Continuar?`)) return;
  }
  aulasEditing.splice(idx,1);
  renderAulasList();
}
```
por:
```js
async function removeAulaRow(idx){
  const a = aulasEditing[idx];
  const usadas = items.filter(x=>x.aula===a.id).length;
  if(usadas > 0){
    if(!await confirmDialog({message:`Esta aula tiene ${usadas} ítem(s) asignados. Si la eliminas, esos ítems quedarán sin aula. ¿Continuar?`})) return;
  }
  aulasEditing.splice(idx,1);
  renderAulasList();
}
```

- [ ] **Step 2: Migrar `removeCicloRow` y `removeModuloRow` en `js/modal-ciclos.js:122-148`**

Reemplazar:
```js
function removeCicloRow(idx){
  const c = ciclosEditing[idx];
  const usados = items.filter(x => x.mod && x.mod.startsWith(c.id + '__')).length;
  if(usados > 0){
    if(!confirm(`Este ciclo tiene ${usados} ítem(s) asignados. Si lo eliminas, esos ítems conservarán el valor anterior. ¿Continuar?`)) return;
  }
  ciclosEditing.splice(idx, 1);
  if(cicloExpandIdx === idx) cicloExpandIdx = null;
  else if(cicloExpandIdx > idx) cicloExpandIdx--;
  _renderCiclos();
}

function addModuloRow(cicloIdx){
  ciclosEditing[cicloIdx].modulos.push({cod:'', name:'', horas:0});
  _renderCiclos();
}

function removeModuloRow(cicloIdx, modIdx){
  const c   = ciclosEditing[cicloIdx];
  const mid = c.id + '__' + c.modulos[modIdx].cod;
  const usados = items.filter(x => x.mod === mid).length;
  if(usados > 0){
    if(!confirm(`Este módulo tiene ${usados} ítem(s) asignados. ¿Continuar?`)) return;
  }
  c.modulos.splice(modIdx, 1);
  _renderCiclos();
}
```
por:
```js
async function removeCicloRow(idx){
  const c = ciclosEditing[idx];
  const usados = items.filter(x => x.mod && x.mod.startsWith(c.id + '__')).length;
  if(usados > 0){
    if(!await confirmDialog({message:`Este ciclo tiene ${usados} ítem(s) asignados. Si lo eliminas, esos ítems conservarán el valor anterior. ¿Continuar?`})) return;
  }
  ciclosEditing.splice(idx, 1);
  if(cicloExpandIdx === idx) cicloExpandIdx = null;
  else if(cicloExpandIdx > idx) cicloExpandIdx--;
  _renderCiclos();
}

function addModuloRow(cicloIdx){
  ciclosEditing[cicloIdx].modulos.push({cod:'', name:'', horas:0});
  _renderCiclos();
}

async function removeModuloRow(cicloIdx, modIdx){
  const c   = ciclosEditing[cicloIdx];
  const mid = c.id + '__' + c.modulos[modIdx].cod;
  const usados = items.filter(x => x.mod === mid).length;
  if(usados > 0){
    if(!await confirmDialog({message:`Este módulo tiene ${usados} ítem(s) asignados. ¿Continuar?`})) return;
  }
  c.modulos.splice(modIdx, 1);
  _renderCiclos();
}
```

- [ ] **Step 3: Migrar `removeUbicacionRow` en `js/modal-ubicaciones.js:45`**

Reemplazar:
```js
function removeUbicacionRow(idx){
  const u = ubicacionesEditing[idx];
  const usadas = items.filter(x => String(x.loc || '').trim().toLowerCase() === String(u.name || '').trim().toLowerCase()).length;
  if(usadas > 0 && !confirm(`Esta ubicacion se usa en ${usadas} item(s). Si la eliminas, esos items conservaran el texto de ubicacion. ¿Continuar?`)) return;
  ubicacionesEditing.splice(idx, 1);
  renderUbicacionesList();
}
```
por:
```js
async function removeUbicacionRow(idx){
  const u = ubicacionesEditing[idx];
  const usadas = items.filter(x => String(x.loc || '').trim().toLowerCase() === String(u.name || '').trim().toLowerCase()).length;
  if(usadas > 0 && !await confirmDialog({message:`Esta ubicacion se usa en ${usadas} item(s). Si la eliminas, esos items conservaran el texto de ubicacion. ¿Continuar?`})) return;
  ubicacionesEditing.splice(idx, 1);
  renderUbicacionesList();
}
```

- [ ] **Step 4: Migrar 4 casos en `js/modal-cats.js`**

Reemplazar (línea 58):
```js
function removeCatRow(idx){
  const cat = catsEditing[idx];
  const usados = items.filter(x=>x.cat===cat.name).length;
  if(usados > 0){
    if(!confirm(`Esta categoría tiene ${usados} ítem(s) asignados. Si la eliminas, esos ítems conservarán el nombre de categoría anterior. ¿Continuar?`)) return;
  }
  catsEditing.splice(idx,1);
  renderCatsList();
}
```
por:
```js
async function removeCatRow(idx){
  const cat = catsEditing[idx];
  const usados = items.filter(x=>x.cat===cat.name).length;
  if(usados > 0){
    if(!await confirmDialog({message:`Esta categoría tiene ${usados} ítem(s) asignados. Si la eliminas, esos ítems conservarán el nombre de categoría anterior. ¿Continuar?`})) return;
  }
  catsEditing.splice(idx,1);
  renderCatsList();
}
```

Reemplazar (línea 92, dentro de `normalizeCategoriesToTags`, ya `async`):
```js
  if(!confirm('Esto reducirá las categorías a grupos principales y moverá categorías como Routers, Fibra óptica, Telecomunicaciones, Ordenadores o Domótica a tags de los ítems. ¿Continuar?')) return;
```
por:
```js
  if(!await confirmDialog({message:'Esto reducirá las categorías a grupos principales y moverá categorías como Routers, Fibra óptica, Telecomunicaciones, Ordenadores o Domótica a tags de los ítems. ¿Continuar?'})) return;
```

Reemplazar (línea 112, dentro de `normalizeTagsCanonicalPersist`, ya `async`):
```js
  if(!confirm('Esto normalizará los tags guardados en D1 (mayúsculas, tildes y variantes como ruedas/ruedas goma/ruedas coche). ¿Continuar?')) return;
```
por:
```js
  if(!await confirmDialog({message:'Esto normalizará los tags guardados en D1 (mayúsculas, tildes y variantes como ruedas/ruedas goma/ruedas coche). ¿Continuar?'})) return;
```

Reemplazar (línea 224-226, dentro de `removeTag`, ya `async`):
```js
  if(usados > 0){
    if(!confirm(`Este tag se usa en ${usados} ítem(s). ¿Continuar con la eliminación?`)) return;
  }
```
por:
```js
  if(usados > 0){
    if(!await confirmDialog({message:`Este tag se usa en ${usados} ítem(s). ¿Continuar con la eliminación?`})) return;
  }
```

- [ ] **Step 5: Verificar manualmente cada uno**

Para cada modal (⚙️ Gestionar aulas / ciclos / ubicaciones / categorías): abrir el modal, intentar eliminar una fila que tenga ítems asociados, confirmar que aparece el modal propio con el mensaje correcto y que Cancelar/Aceptar hacen lo esperado. Repetir para "Normalizar categorías" y "Normalizar tags" (⚙️ Gestionar categorías) y para eliminar un tag.

- [ ] **Step 6: Commit**

```bash
git add js/modal-aulas.js js/modal-ciclos.js js/modal-ubicaciones.js js/modal-cats.js
git commit -m "refactor: migrar confirm() de gestión de catálogos a confirmDialog()"
```

---

### Task 6: Migrar `confirm()` en `auth.js`, `prestamos.js`, `modal-item.js` (pedidos), `import.js`, `docs.js`, y `alert()` en `agente-widget.js`

**Files:**
- Modify: `js/auth.js:275-277` (`logout`, no async hoy)
- Modify: `js/prestamos.js:289-294` (`openPrestar`, no async hoy)
- Modify: `js/prestamos.js:589-594` (`saveProfesores`, ya async)
- Modify: `js/prestamos.js:768-774` (`_removeUsuarioRow`, no async hoy)
- Modify: `js/modal-item.js:1194-1201` (`clearPedidos`, no async hoy)
- Modify: `js/import.js:119-126` (`restoreBackupJson`, ya async)
- Modify: `js/docs.js:52-53` (`deleteExistingDoc`, ya async) y `js/docs.js:177-178` (`_dmDeleteDoc`, ya async)
- Modify: `js/agente-widget.js:3823-3826` (callback `.catch()`, no async — usar `toast` en vez de `confirmDialog`)

**Interfaces:**
- Consumes: `confirmDialog()`, `toast()` (Task 2, ya existente).
- Produces: nada nuevo.

- [ ] **Step 1: Migrar `logout()` en `js/auth.js:275`**

Reemplazar:
```js
function logout(){
  if(!confirm('¿Cerrar sesión?')) return;
```
por:
```js
async function logout(){
  if(!await confirmDialog({message:'¿Cerrar sesión?'})) return;
```

Verificar que todas las llamadas a `logout()` en `index.html`/otros JS son `onclick="logout()"` (fire-and-forget, compatible con `async`) — confirmar con búsqueda antes de aplicar.

- [ ] **Step 2: Migrar `openPrestar()` en `js/prestamos.js:289` (caso con rama positiva)**

Reemplazar:
```js
function openPrestar(itemId){
  if(!requirePerm('loans.write')) return;
  if(!profesores.length){
    if(confirm('No hay profesores registrados. ¿Quieres añadir alguno ahora?')){ openProfModal(); }
    return;
  }
```
por:
```js
async function openPrestar(itemId){
  if(!requirePerm('loans.write')) return;
  if(!profesores.length){
    if(await confirmDialog({message:'No hay profesores registrados. ¿Quieres añadir alguno ahora?'})){ openProfModal(); }
    return;
  }
```

- [ ] **Step 3: Migrar `saveProfesores()` en `js/prestamos.js:589-594`**

Reemplazar:
```js
async function saveProfesores(){
  // Validación
  const validos = profEditing.filter(p=>p.nombre && p.nombre.trim());
  if(validos.length !== profEditing.length){
    if(!confirm('Hay profesores sin nombre que se descartarán. ¿Continuar?')) return;
  }
```
por:
```js
async function saveProfesores(){
  // Validación
  const validos = profEditing.filter(p=>p.nombre && p.nombre.trim());
  if(validos.length !== profEditing.length){
    if(!await confirmDialog({message:'Hay profesores sin nombre que se descartarán. ¿Continuar?'})) return;
  }
```

- [ ] **Step 4: Migrar `_removeUsuarioRow()` en `js/prestamos.js:768`**

Reemplazar:
```js
function _removeUsuarioRow(i){
  const u = _usuariosEditing[i];
  if(u.usuario === SESSION?.usuario){ toast('No puedes eliminar tu propia cuenta','err'); return; }
  if(!u._nuevo && !confirm(`¿Eliminar el usuario "${u.nombre||u.usuario}"? Esta acción no se puede deshacer.`)) return;
  _usuariosEditing.splice(i,1);
  _renderUsuariosList();
}
```
por:
```js
async function _removeUsuarioRow(i){
  const u = _usuariosEditing[i];
  if(u.usuario === SESSION?.usuario){ toast('No puedes eliminar tu propia cuenta','err'); return; }
  if(!u._nuevo && !await confirmDialog({message:`¿Eliminar el usuario "${u.nombre||u.usuario}"? Esta acción no se puede deshacer.`, danger:true, confirmText:'Eliminar'})) return;
  _usuariosEditing.splice(i,1);
  _renderUsuariosList();
}
```

- [ ] **Step 5: Migrar `clearPedidos()` en `js/modal-item.js:1194`**

Reemplazar:
```js
function clearPedidos(){
  if(!confirm('¿Vaciar toda la lista de pedido?')) return;
```
por:
```js
async function clearPedidos(){
  if(!await confirmDialog({message:'¿Vaciar toda la lista de pedido?'})) return;
```

- [ ] **Step 6: Migrar `restoreBackupJson()` en `js/import.js:125`**

Reemplazar:
```js
  if(!confirm(`Se reemplazarán estas secciones: ${names}. ¿Continuar?`)) return;
```
por:
```js
  if(!await confirmDialog({message:`Se reemplazarán estas secciones: ${names}. ¿Continuar?`})) return;
```

- [ ] **Step 7: Migrar `deleteExistingDoc()` en `js/docs.js:53` y `_dmDeleteDoc()` en `js/docs.js:178`**

Reemplazar (línea 53):
```js
async function deleteExistingDoc(docId, driveId){
  if(!confirm('¿Eliminar este documento de Drive?')) return;
```
por:
```js
async function deleteExistingDoc(docId, driveId){
  if(!await confirmDialog({message:'¿Eliminar este documento de Drive?', danger:true, confirmText:'Eliminar'})) return;
```

Reemplazar (línea 178):
```js
async function _dmDeleteDoc(docId, driveId){
  if(!confirm('¿Eliminar este documento de Drive?')) return;
```
por:
```js
async function _dmDeleteDoc(docId, driveId){
  if(!await confirmDialog({message:'¿Eliminar este documento de Drive?', danger:true, confirmText:'Eliminar'})) return;
```

- [ ] **Step 8: Migrar el `alert()` de cámara en `js/agente-widget.js:3825`**

Este caso está dentro de un callback `.catch(function(e){...})`, no en una función `async` propia — se usa `toast()` en vez de `confirmDialog()` (es un aviso, no una confirmación, tal como define la spec).

Reemplazar:
```js
    }).catch(function(e) {
      stop();
      alert('Error al acceder a la cámara: ' + e.message);
    });
```
por:
```js
    }).catch(function(e) {
      stop();
      toast('Error al acceder a la cámara: ' + e.message, 'err');
    });
```

- [ ] **Step 9: Verificar manualmente cada caso**

- Cerrar sesión (topbar) → modal propio, no diálogo nativo.
- Intentar prestar un ítem sin profesores registrados → modal propio con opción de ir a añadir profesor.
- Guardar profesores dejando alguno sin nombre → modal propio.
- Eliminar un usuario (⚙️ Gestionar usuarios) → modal propio en rojo ("Eliminar").
- Vaciar lista de pedidos → modal propio.
- Restaurar backup JSON → modal propio.
- Eliminar un documento adjunto (desde modal de ítem y desde el gestor de documentos) → modal propio en rojo.
- Escanear QR con la cámara bloqueada/denegada por el navegador → toast de error visible (no alert nativo).

- [ ] **Step 10: Commit**

```bash
git add js/auth.js js/prestamos.js js/modal-item.js js/import.js js/docs.js js/agente-widget.js
git commit -m "refactor: migrar confirm()/alert() restantes a confirmDialog()/toast()"
```

---

### Task 7: Aplicar `friendlyError()` en los mensajes de error más frecuentes

**Files:**
- Modify: `js/modal-item.js:1018` (`saveItem`, catch)
- Modify: `js/modal-item.js:1042` (`confDel`, catch)
- Modify: `js/modal-cats.js:86` (`saveCats`, catch)
- Modify: `js/modal-cats.js:106` (`normalizeCategoriesToTags`, catch)
- Modify: `js/docs.js:61` (`deleteExistingDoc`, catch)
- Modify: `js/docs.js:184` (`_dmDeleteDoc`, catch)

**Interfaces:**
- Consumes: `friendlyError()` (Task 2).
- Produces: nada nuevo — mismo `toast()` pero con mensaje traducido.

Nota: se cubren los catch más representativos y de mayor uso real (guardar/eliminar ítem, categorías, documentos). No se persigue cobertura exhaustiva de los ~30 `catch` existentes en el proyecto (fuera de alcance según la spec) — puntos adicionales quedan para una iteración futura si se detectan más patrones recurrentes.

- [ ] **Step 1: `js/modal-item.js:1018` (`saveItem`)**

Reemplazar:
```js
  } catch(err) { toast('Error: '+err.message,'err'); }
  finally { btn.disabled=false; btn.textContent='💾 Guardar'; }
}
```
(la primera aparición, dentro de `saveItem`, línea ~1018) por:
```js
  } catch(err) { toast(friendlyError(err),'err'); }
  finally { btn.disabled=false; btn.textContent='💾 Guardar'; }
}
```

- [ ] **Step 2: `js/modal-item.js:1042` (`confDel`)**

Reemplazar:
```js
    } catch(err) { toast('Error: '+err.message,'err'); }
    finally { btn.disabled=false; btn.textContent='Eliminar'; }
  };
```
por:
```js
    } catch(err) { toast(friendlyError(err),'err'); }
    finally { btn.disabled=false; btn.textContent='Eliminar'; }
  };
```

- [ ] **Step 3: `js/modal-cats.js:86` (`saveCats`)**

Reemplazar:
```js
  } catch(err) {
    toast('Error al sincronizar: '+err.message,'err');
  }
}

async function normalizeCategoriesToTags(){
```
por:
```js
  } catch(err) {
    toast(friendlyError(err),'err');
  }
}

async function normalizeCategoriesToTags(){
```

- [ ] **Step 4: `js/modal-cats.js:106` (`normalizeCategoriesToTags`)**

Reemplazar:
```js
  }catch(err){
    toast('Error al normalizar: ' + err.message, 'err');
  }
}

async function normalizeTagsCanonicalPersist(){
```
por:
```js
  }catch(err){
    toast(friendlyError(err), 'err');
  }
}

async function normalizeTagsCanonicalPersist(){
```

- [ ] **Step 5: `js/docs.js:61` (`deleteExistingDoc`)**

Reemplazar:
```js
  }catch(e){ toast('Error: '+e.message,'err'); }
}

function renderDocList(){
```
por:
```js
  }catch(e){ toast(friendlyError(e),'err'); }
}

function renderDocList(){
```

- [ ] **Step 6: `js/docs.js:184` (`_dmDeleteDoc`)**

Reemplazar:
```js
  } catch(e){ toast('Error: '+e.message,'err'); }
}

async function saveDocsModal(){
```
por:
```js
  } catch(e){ toast(friendlyError(e),'err'); }
}

async function saveDocsModal(){
```

- [ ] **Step 7: Verificar manualmente**

Simular un error de red: en DevTools → Network → "Offline", intentar guardar un ítem. Confirmar que el toast dice "Sin conexión. Comprueba tu red e inténtalo de nuevo." en vez de un mensaje técnico crudo. Volver a "Online" después.

- [ ] **Step 8: Commit**

```bash
git add js/modal-item.js js/modal-cats.js js/docs.js
git commit -m "refactor: traducir mensajes de error técnicos con friendlyError()"
```

---

### Task 8: Validación inline en el modal de ítem (`saveItem()`)

**Files:**
- Modify: `js/ui-helpers.js` (añadir `markFieldError`/`clearFieldErrors`)
- Modify: `js/modal-item.js` (función `saveItem()` — localizar validaciones existentes de nombre/ciclo/módulo)

**Interfaces:**
- Consumes: clases `.field-error`/`.field-error-msg` (Task 3).
- Produces: `markFieldError(fieldId, message)`, `clearFieldErrors()` — funciones globales reutilizables por si otro formulario las necesita en el futuro, aunque hoy solo las usa `saveItem()`.

- [ ] **Step 1: Validaciones actuales en `saveItem()` (`js/modal-item.js:956-960`)**

El código real (ya confirmado, no requiere búsqueda adicional):
```js
async function saveItem(){
  const name=document.getElementById('f_item').value.trim();
  if(!name){toast('El nombre es obligatorio','err');return}
  if(!document.getElementById('f_ciclo').value){toast('El ciclo/departamento es obligatorio','err');return}
  if(!document.getElementById('f_mod').value){toast('La asignatura/módulo es obligatoria','err');return}
```
Los 3 campos son: `f_item` (nombre), `f_ciclo` (ciclo/departamento), `f_mod` (asignatura/módulo). Estos son los IDs a usar en `markFieldError()` en el Step 3.

- [ ] **Step 2: Añadir `markFieldError`/`clearFieldErrors` a `js/ui-helpers.js`**

Añadir al final del archivo:
```js
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
```

- [ ] **Step 3: Sustituir la validación en `saveItem()` de `js/modal-item.js:956-960`**

Reemplazar:
```js
async function saveItem(){
  const name=document.getElementById('f_item').value.trim();
  if(!name){toast('El nombre es obligatorio','err');return}
  if(!document.getElementById('f_ciclo').value){toast('El ciclo/departamento es obligatorio','err');return}
  if(!document.getElementById('f_mod').value){toast('La asignatura/módulo es obligatoria','err');return}
```
por:
```js
async function saveItem(){
  clearFieldErrors();
  const name=document.getElementById('f_item').value.trim();
  let hasError = false;
  if(!name){ markFieldError('f_item', 'El nombre es obligatorio'); hasError = true; }
  if(!document.getElementById('f_ciclo').value){ markFieldError('f_ciclo', 'Selecciona un ciclo/departamento'); hasError = true; }
  if(!document.getElementById('f_mod').value){ markFieldError('f_mod', 'Selecciona una asignatura/módulo'); hasError = true; }
  if(hasError){ toast('Revisa los campos marcados','err'); focusFirstError(); return; }
```

El resto de `saveItem()` (construcción de `v`, `apiPost`, etc.) permanece sin cambios.

- [ ] **Step 4: Verificar manualmente**

Abrir "Nuevo ítem", dejar el campo nombre vacío, pulsar Guardar. Confirmar: (a) el campo nombre se resalta en rojo, (b) aparece un mensaje pequeño debajo del campo, (c) la vista hace scroll/foco hacia él, (d) aparece también el toast "Revisa los campos marcados". Escribir algo en el campo y confirmar que el resaltado desaparece al escribir (evento `input`).

- [ ] **Step 5: Commit**

```bash
git add js/ui-helpers.js js/modal-item.js
git commit -m "feat: validación inline localizada en modal de ítem"
```

---

### Task 9: Barrido final — confirmar que no quedan `confirm()`/`alert()` fuera de alcance

**Files:**
- No modifica archivos de producto — solo verificación.

**Interfaces:**
- Consumes: nada.
- Produces: confirmación de cobertura completa.

- [ ] **Step 1: Grep de verificación**

Ejecutar:
```bash
grep -rn "confirm(\|alert(" js/ --include=*.js
```
Resultado esperado: únicamente coincidencias dentro de `_bulkDelDialog` (`js/inventory.js`, fuera de alcance) y ninguna otra.

- [ ] **Step 2: Si aparece algo inesperado**

Si el grep muestra un `confirm()`/`alert()` no cubierto por las Tasks 4-6, añadirlo siguiendo el mismo patrón (`if(!await confirmDialog({message:'...'})) return;`) antes de continuar.

- [ ] **Step 3: Commit (solo si Step 2 aplicó cambios)**

```bash
git add -A
git commit -m "refactor: migrar confirm()/alert() detectados en barrido final"
```

---

### Task 10: Actualizar versión y documentación de cierre

**Files:**
- Modify: `sw.js` (VERSION, siguiente número tras la actual v492)
- Modify: `CLAUDE.md` (nota de sesión, según workflow estándar del proyecto)

**Interfaces:**
- Consumes: nada.
- Produces: deploy consistente con el workflow del proyecto.

- [ ] **Step 1: Incrementar `VERSION` en `sw.js`**

Leer el valor actual de `VERSION` en `sw.js`, incrementarlo en 1 (p.ej. si es `'v492'`, pasa a `'v493'`).

- [ ] **Step 2: Añadir entrada breve en `CLAUDE.md`**

Añadir en la sección de historial de sesiones (siguiendo el formato ya usado en el archivo) una entrada resumiendo: unificación de `confirm()`/`alert()` nativos en `confirmDialog()`, traducción de errores técnicos con `friendlyError()`, validación inline en modal de ítem.

- [ ] **Step 3: Commit**

```bash
git add sw.js CLAUDE.md
git commit -m "chore(vXXX): unificar confirmaciones, errores y validación de formulario"
```

- [ ] **Step 4: Push**

Confirmar con el usuario antes de hacer `git push origin main` (acción visible/compartida — pedir confirmación explícita según las normas de seguridad de acciones, no asumir autorización).

---

## Post-Implementation Checklist

- [ ] Grep final sin resultados inesperados (Task 9).
- [ ] Los 8 flujos manuales de la Task 6/Step 9 verificados uno a uno.
- [ ] Validación inline verificada en modal de ítem (Task 8/Step 4).
- [ ] `sw.js` VERSION incrementado.
- [ ] Nada de `console.error`/excepciones nuevas al cargar la app (F12 limpio).
