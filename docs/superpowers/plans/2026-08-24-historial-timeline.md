# Historial de ítems como timeline estructurado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando se edita un ítem, el historial por ítem (`#mItemHistorial`) muestra qué campos cambiaron y sus valores antes/después, en vez del texto genérico "Actualizado: X" actual.

**Architecture:** La acción `update` de `functions/api/item.js` lee la fila vieja de `inventario` antes del `UPDATE`, calcula un diff de 8 campos clave, y lo guarda como JSON en la misma columna `resumen` del log (sin migración). El frontend (`js/modal-item.js`, `openHistorial()`) detecta si `resumen` es ese JSON y lo renderiza como lista de cambios con nombres de aula/asignatura resueltos; si no lo es (filas antiguas, otras acciones), muestra el texto plano de siempre.

**Tech Stack:** Cloudflare Pages Functions (JS, sin build), D1 (SQLite), Vanilla JS frontend sin build. Sin framework de test — verificación con scripts Node desechables (ver cada tarea) siguiendo la convención ya establecida en este proyecto (sin `package.json`, sin test runner instalado).

**Spec:** `docs/superpowers/specs/2026-08-24-historial-timeline-design.md`

## Global Constraints

- Sin migración D1 ni columna nueva — el diff se guarda como JSON en la columna `resumen` ya existente de la tabla `log`.
- Solo la acción `update` de ítems gana diff estructurado. `add`/`delete`/`toggleOculto`/`fotosSync`/`bulkImport` no cambian.
- Solo estos 8 campos entran en el diff: `item`, `aula`, `cat`, `mod`, `qty`, `min`, `est`, `loc`. Ningún otro campo de `HEADERS_INV` se compara.
- Si ningún campo clave cambió, `resumen` sigue siendo el texto plano de siempre (`itemAuditSummary('Actualizado', item)`) — nunca un `[]` vacío.
- El diff formateado se muestra **solo** en `js/modal-item.js` (`openHistorial()`, modal `#mItemHistorial`). `js/modal-historial.js` (vista general de todas las acciones) no cambia.
- Filas de log antiguas (texto plano) deben seguir mostrándose exactamente igual que hoy — cero cambios de comportamiento para ellas.
- No se toca la autenticación/scoping por departamento existente en `historial.js` ni en la acción `update` de `item.js`.

---

### Task 1: Backend — diff estructurado en la acción `update`

**Files:**
- Modify: `functions/api/item.js:79-88` (justo después de `itemAuditSummary`) y `functions/api/item.js:169-184` (bloque de la acción `update`)

**Interfaces:**
- Produces: `DIFF_FIELDS` (array de 8 strings) y `computeItemDiff(oldRow, newItem)` — función pura, top-level en `item.js`, que devuelve `Array<{campo: string, antes: string|number, despues: string|number}>` (solo las entradas que cambiaron). Task 2 no depende de esto directamente (el contrato real entre backend y frontend es el JSON ya serializado dentro de `log.resumen`), pero cualquier ajuste futuro al conjunto de campos debe tocar `DIFF_FIELDS` aquí.

- [ ] **Step 1: Escribir un script Node desechable que fije el comportamiento esperado de `computeItemDiff`**

Crea `scratchpad/verify-diff.js` (fuera del repo, en el directorio scratchpad de la sesión, o en cualquier ruta temporal — **no se commitea**) con el mismo cuerpo de función que se va a pegar en `item.js` en el Step 3, para confirmarlo de forma aislada antes de tocar el endpoint real:

```js
const DIFF_FIELDS = ['item', 'aula', 'cat', 'mod', 'qty', 'min', 'est', 'loc'];

function computeItemDiff(oldRow, newItem) {
  if (!oldRow) return [];
  return DIFF_FIELDS
    .filter(f => String(oldRow[f] ?? '') !== String(newItem[f] ?? ''))
    .map(f => ({ campo: f, antes: oldRow[f] ?? '', despues: newItem[f] ?? '' }));
}

// Caso 1: dos campos cambian
const r1 = computeItemDiff(
  { item: 'Osciloscopio', aula: 'aula12', cat: 'Instrumentos', mod: '', qty: 3, min: 1, est: 'Bueno', loc: '' },
  { item: 'Osciloscopio', aula: 'aula14', cat: 'Instrumentos', mod: '', qty: 5, min: 1, est: 'Bueno', loc: '' }
);
console.assert(r1.length === 2, 'Caso 1: esperaba 2 diffs, obtuve ' + r1.length);
console.assert(r1.find(d => d.campo === 'aula').antes === 'aula12' && r1.find(d => d.campo === 'aula').despues === 'aula14', 'Caso 1: diff de aula incorrecto');
console.assert(r1.find(d => d.campo === 'qty').antes === 3 && r1.find(d => d.campo === 'qty').despues === 5, 'Caso 1: diff de qty incorrecto');

// Caso 2: ningún campo clave cambia (p. ej. solo cambió precio, fuera de DIFF_FIELDS)
const r2 = computeItemDiff(
  { item: 'Osciloscopio', aula: 'aula12', cat: 'Instrumentos', mod: '', qty: 3, min: 1, est: 'Bueno', loc: '' },
  { item: 'Osciloscopio', aula: 'aula12', cat: 'Instrumentos', mod: '', qty: 3, min: 1, est: 'Bueno', loc: '', precio: 199.9 }
);
console.assert(r2.length === 0, 'Caso 2: esperaba 0 diffs, obtuve ' + r2.length);

// Caso 3: null/undefined/'' se tratan como equivalentes (sin diff falso)
const r3 = computeItemDiff(
  { item: 'X', aula: null, cat: '', mod: undefined, qty: 1, min: 1, est: 'Bueno', loc: '' },
  { item: 'X', aula: '', cat: null, mod: '', qty: 1, min: 1, est: 'Bueno', loc: undefined }
);
console.assert(r3.length === 0, 'Caso 3: esperaba 0 diffs (equivalencia null/undefined/\'\'), obtuve ' + r3.length + ' -> ' + JSON.stringify(r3));

// Caso 4: oldRow ausente (fila borrada entre el SELECT de autorización y este punto) no debe lanzar excepción
const r4 = computeItemDiff(null, { item: 'X', aula: 'aula1', cat: '', mod: '', qty: 1, min: 1, est: '', loc: '' });
console.assert(Array.isArray(r4) && r4.length === 0, 'Caso 4: esperaba array vacío con oldRow null');

console.log('Todos los asserts pasaron (si no se imprimió ningún "Caso" arriba con fallo).');
```

- [ ] **Step 2: Ejecutar el script y confirmar que no hay ningún mensaje de assert fallido**

Run: `node scratchpad/verify-diff.js`
Expected: solo se imprime `Todos los asserts pasaron (si no se imprimió ningún "Caso" arriba con fallo).` — ningún `Caso N:` de error en la salida.

- [ ] **Step 3: Pegar `DIFF_FIELDS` y `computeItemDiff` en `functions/api/item.js`, justo después de `itemAuditSummary`**

En `functions/api/item.js`, localizar el cierre de `itemAuditSummary` (línea 88, `return \`${prefix}: ...\`;\n}`) e insertar justo después:

```js

const DIFF_FIELDS = ['item', 'aula', 'cat', 'mod', 'qty', 'min', 'est', 'loc'];

function computeItemDiff(oldRow, newItem) {
  if (!oldRow) return [];
  return DIFF_FIELDS
    .filter(f => String(oldRow[f] ?? '') !== String(newItem[f] ?? ''))
    .map(f => ({ campo: f, antes: oldRow[f] ?? '', despues: newItem[f] ?? '' }));
}
```

- [ ] **Step 4: Usar `computeItemDiff` en la acción `update`**

Localizar el bloque actual (alrededor de la línea 169):

```js
  if (action === 'update') {
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, item.id);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    item.es_contenedor = item.es_contenedor ? 1 : 0;
    item.parent_id = item.parent_id || null;
    item.tipo_material = item.es_contenedor ? 'inventariable' : (item.tipo_material || 'consumible');
    const sets = FIELDS_UPD.map(h => `${h}=?`).join(',');
    const vals = [...FIELDS_UPD.map(h => item[h] ?? null), item.id];
    await env.DB.prepare(`UPDATE inventario SET ${sets} WHERE id=?`).bind(...vals).run();
    await auditLog(env.DB, user, 'update', item.id, itemAuditSummary('Actualizado', item));
    return Response.json({ ok: true, item });
  }
```

Reemplazarlo por:

```js
  if (action === 'update') {
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, item.id);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
    const oldRow = await env.DB.prepare(
      `SELECT ${DIFF_FIELDS.join(',')} FROM inventario WHERE id=?`
    ).bind(item.id).first();
    item.es_contenedor = item.es_contenedor ? 1 : 0;
    item.parent_id = item.parent_id || null;
    item.tipo_material = item.es_contenedor ? 'inventariable' : (item.tipo_material || 'consumible');
    const sets = FIELDS_UPD.map(h => `${h}=?`).join(',');
    const vals = [...FIELDS_UPD.map(h => item[h] ?? null), item.id];
    await env.DB.prepare(`UPDATE inventario SET ${sets} WHERE id=?`).bind(...vals).run();
    const diffs = computeItemDiff(oldRow, item);
    const resumenUpdate = diffs.length ? JSON.stringify(diffs) : itemAuditSummary('Actualizado', item);
    await auditLog(env.DB, user, 'update', item.id, resumenUpdate);
    return Response.json({ ok: true, item });
  }
```

(Nota: la variable se llama `resumenUpdate`, no `resumen`, para no chocar con ningún otro `resumen` ya declarado en el mismo scope del archivo — comprobar con una búsqueda rápida de `resumen` dentro de esta función antes de nombrar la variable, y ajustar el nombre si hiciera falta.)

- [ ] **Step 5: Revisión estática — confirmar que no queda ningún otro `SELECT ... FROM inventario WHERE id=?` duplicado innecesariamente cerca**

Leer `functions/api/item.js` completo una vez desde el principio del bloque `if (action === 'update')` hasta su `return`, confirmando: el `oldRow` se lee antes de cualquier mutación de `item`, `computeItemDiff` se llama después del `UPDATE` real (para no afectar el resultado del propio guardado), y `auditLog` recibe `resumenUpdate` (no el `itemAuditSummary(...)` directo).

- [ ] **Step 6: Borrar el script desechable**

Run: `rm scratchpad/verify-diff.js` (o la ruta temporal usada) — no debe quedar rastro de este archivo en `git status`.

- [ ] **Step 7: Commit**

```bash
git add functions/api/item.js
git commit -m "feat(historial): guarda diff campo a campo al actualizar un item"
```

---

### Task 2: Frontend — render del diff en `openHistorial()`

**Files:**
- Modify: `js/modal-item.js:1413` (justo antes de `async function openHistorial(){`) y `js/modal-item.js:1434` (la celda `<td>` de Detalle dentro de `openHistorial()`)

**Interfaces:**
- Consumes: el JSON que Task 1 escribe en `log.resumen` para la acción `update` — forma `Array<{campo: string, antes: string|number, despues: string|number}>`, o texto plano para cualquier otra fila (acciones distintas de `update`, o filas anteriores a este cambio).
- Consumes también los globales ya existentes del proyecto: `AULAS` (array de `{id, name, ...}`, definido en `js/config.js`), `findModulo(modId)` (función global en `js/config.js`, devuelve `{cod, name, ciclo}` o `null`), `escHtml(v)` (función ya definida en el propio `js/modal-item.js:577`).
- Produces: `_formatHistorialDetalle(resumenRaw)` — función pura, top-level en `js/modal-item.js`, devuelve un string HTML ya escapado, listo para insertar directo en el `<td>`.

- [ ] **Step 1: Escribir un script Node desechable que fije el comportamiento esperado de `_formatHistorialDetalle`**

Crea `scratchpad/verify-historial-render.js` (no se commitea) con el mismo cuerpo de funciones que se va a pegar en `modal-item.js` en el Step 3, usando stubs mínimos de `AULAS`/`findModulo`/`escHtml` (las mismas firmas que ya existen en el proyecto):

```js
const AULAS = [{ id: 'aula12', name: 'Aula 12' }, { id: 'aula14', name: 'Aula 14' }];
function findModulo(modId) {
  if (modId !== 'cicloX__M01') return null;
  return { cod: 'M01', name: 'Electrónica Digital' };
}
function escHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const HISTORIAL_DIFF_FIELDS_LABELS = {
  item: 'Nombre', aula: 'Aula', cat: 'Categoría', mod: 'Asignatura/Módulo',
  qty: 'Cantidad', min: 'Mínimo', est: 'Estado', loc: 'Ubicación'
};

function _formatHistorialValor(campo, valor) {
  if (valor === '' || valor === null || valor === undefined) return '—';
  if (campo === 'aula') {
    const a = AULAS.find(x => x.id === valor);
    return a ? a.name : String(valor);
  }
  if (campo === 'mod') {
    const m = findModulo(valor);
    return m ? `${m.cod} ${m.name}` : String(valor);
  }
  return String(valor);
}

function _formatHistorialDetalle(resumenRaw) {
  let diffs = null;
  try {
    const parsed = JSON.parse(resumenRaw);
    if (Array.isArray(parsed) && parsed.length && parsed.every(d => d && typeof d === 'object' && 'campo' in d && 'antes' in d && 'despues' in d)) {
      diffs = parsed;
    }
  } catch (e) { /* no es JSON: cae al texto plano */ }

  if (!diffs) return escHtml(resumenRaw);

  return diffs.map(d => {
    const label = HISTORIAL_DIFF_FIELDS_LABELS[d.campo] || d.campo;
    const antes = _formatHistorialValor(d.campo, d.antes);
    const despues = _formatHistorialValor(d.campo, d.despues);
    return `<div><b>${escHtml(label)}:</b> ${escHtml(antes)} → ${escHtml(despues)}</div>`;
  }).join('');
}

// Caso 1: diff válido con aula y mod resueltos, y un campo sin lookup (qty)
const h1 = _formatHistorialDetalle(JSON.stringify([
  { campo: 'aula', antes: 'aula12', despues: 'aula14' },
  { campo: 'mod', antes: '', despues: 'cicloX__M01' },
  { campo: 'qty', antes: 3, despues: 5 }
]));
console.assert(h1.includes('Aula 12') && h1.includes('Aula 14'), 'Caso 1: nombres de aula no resueltos -> ' + h1);
console.assert(h1.includes('M01 Electrónica Digital'), 'Caso 1: módulo no resuelto -> ' + h1);
console.assert(h1.includes('—') , 'Caso 1: valor vacío de "antes" en mod debería mostrar — -> ' + h1);
console.assert(h1.includes('3') && h1.includes('5'), 'Caso 1: qty no aparece -> ' + h1);

// Caso 2: resumen en texto plano (fila antigua o acción distinta de update) -> fallback intacto
const h2 = _formatHistorialDetalle('Actualizado: Osciloscopio - ref OSC-01 - aula aula12');
console.assert(h2 === escHtml('Actualizado: Osciloscopio - ref OSC-01 - aula aula12'), 'Caso 2: fallback de texto plano roto -> ' + h2);

// Caso 3: JSON válido pero de otra forma (no es un array de diffs) -> también cae a texto plano
const h3 = _formatHistorialDetalle(JSON.stringify({ foo: 'bar' }));
console.assert(h3 === escHtml(JSON.stringify({ foo: 'bar' })), 'Caso 3: JSON no-diff no cayó a texto plano -> ' + h3);

// Caso 4: array JSON vacío (no debería ocurrir tras Task 1, pero por robustez) -> cae a texto plano, no a lista vacía
const h4 = _formatHistorialDetalle('[]');
console.assert(h4 === escHtml('[]'), 'Caso 4: array vacío debería caer a texto plano -> ' + h4);

// Caso 5: un valor con caracteres a escapar no debe quedar sin escapar en el HTML resultante
const h5 = _formatHistorialDetalle(JSON.stringify([{ campo: 'item', antes: '<script>', despues: 'Multímetro & pinzas' }]));
console.assert(!h5.includes('<script>'), 'Caso 5: XSS no escapado -> ' + h5);
console.assert(h5.includes('&amp;'), 'Caso 5: & no escapado -> ' + h5);

console.log('Todos los asserts pasaron (si no se imprimió ningún "Caso" arriba con fallo).');
```

- [ ] **Step 2: Ejecutar el script y confirmar que no hay ningún mensaje de assert fallido**

Run: `node scratchpad/verify-historial-render.js`
Expected: solo se imprime `Todos los asserts pasaron (si no se imprimió ningún "Caso" arriba con fallo).` — ningún `Caso N:` de error en la salida.

- [ ] **Step 3: Pegar las funciones reales en `js/modal-item.js`, justo antes de `openHistorial()`**

En `js/modal-item.js`, localizar la línea `async function openHistorial(){` (línea 1413) e insertar justo antes:

```js
const HISTORIAL_DIFF_FIELDS_LABELS = {
  item: 'Nombre', aula: 'Aula', cat: 'Categoría', mod: 'Asignatura/Módulo',
  qty: 'Cantidad', min: 'Mínimo', est: 'Estado', loc: 'Ubicación'
};

function _formatHistorialValor(campo, valor){
  if(valor === '' || valor === null || valor === undefined) return '—';
  if(campo === 'aula'){
    const a = AULAS.find(x => x.id === valor);
    return a ? a.name : String(valor);
  }
  if(campo === 'mod'){
    const m = findModulo(valor);
    return m ? `${m.cod} ${m.name}` : String(valor);
  }
  return String(valor);
}

function _formatHistorialDetalle(resumenRaw){
  let diffs = null;
  try {
    const parsed = JSON.parse(resumenRaw);
    if(Array.isArray(parsed) && parsed.length && parsed.every(d => d && typeof d === 'object' && 'campo' in d && 'antes' in d && 'despues' in d)){
      diffs = parsed;
    }
  } catch(e) { /* no es JSON: cae al texto plano */ }

  if(!diffs) return escHtml(resumenRaw);

  return diffs.map(d => {
    const label = HISTORIAL_DIFF_FIELDS_LABELS[d.campo] || d.campo;
    const antes = _formatHistorialValor(d.campo, d.antes);
    const despues = _formatHistorialValor(d.campo, d.despues);
    return `<div><b>${escHtml(label)}:</b> ${escHtml(antes)} → ${escHtml(despues)}</div>`;
  }).join('');
}

```

- [ ] **Step 4: Usar `_formatHistorialDetalle` en la celda de Detalle**

Dentro de `openHistorial()`, localizar (línea 1434):

```js
            <td style="font-size:12px;word-break:break-word">${escHtml(l.resumen)}</td>
```

Reemplazar por:

```js
            <td style="font-size:12px;word-break:break-word">${_formatHistorialDetalle(l.resumen)}</td>
```

- [ ] **Step 5: Confirmar que `js/config.js` (dueño de `AULAS`/`findModulo`) se carga antes que `js/modal-item.js` en `index.html`**

Run: `grep -n "src=\"js/config.js\"\|src=\"js/modal-item.js\"" index.html`
Expected: la línea de `js/config.js` aparece con un número menor que la de `js/modal-item.js` (ya confirmado antes de escribir este plan: `config.js` en la línea 1914, `modal-item.js` en la 1923 — si algo cambió, `AULAS`/`findModulo` deben seguir cargando primero).

- [ ] **Step 6: Borrar el script desechable**

Run: `rm scratchpad/verify-historial-render.js` — no debe quedar rastro de este archivo en `git status`.

- [ ] **Step 7: Commit**

```bash
git add js/modal-item.js
git commit -m "feat(historial): renderiza el diff de update como timeline en el historial por item"
```

---

## Verificación final (tras las 2 tareas, antes de mergear)

No forma parte de ninguna tarea individual — la hace el controlador de la sesión, como en el resto de features de este proyecto, con Playwright contra el entorno ya mergeado/desplegado:

1. Editar un ítem real cambiando aula + cantidad a la vez → abrir "📋 Historial" de ese ítem → confirmar que la entrada `update` más reciente muestra 2 líneas (`Aula: X → Y`, `Cantidad: N → M`), con el nombre de aula resuelto (no el id crudo).
2. Editar el mismo ítem cambiando solo un campo fuera del diff (ej. precio o proveedor) → confirmar que la entrada nueva muestra el texto plano de siempre, sin JSON crudo visible.
3. Abrir el historial de un ítem con filas antiguas (de antes de este cambio) → confirmar que se siguen viendo exactamente igual que antes (texto plano, sin errores en consola).
4. Confirmar en `js/modal-historial.js` (vista general de historial) que las filas `update` nuevas siguen mostrando el JSON como texto — sin formatear ahí, tal como especifica el alcance.
5. Usar el flujo "📷 Revisar aula" (`js/revision-aula.js`, `_corregirAulaRevision()`) para corregir el aula de un ítem detectado en el sitio equivocado → confirmar que el historial de ese ítem muestra un diff de una sola línea (`Aula: X → Y`), verificando que la lógica no asume que el `update` siempre viene del formulario completo del modal de edición.
