# Historial de ítems como timeline estructurado — diseño

**Fecha:** 24/08/2026
**Origen:** brainstorming de la sesión de planificación de prácticas (v588),
idea diferida a propósito para esa sesión. Backlog punto 14 en CLAUDE.md.

## Problema

El historial por ítem (`js/modal-item.js:openHistorial()`, modal
`#mItemHistorial`, backend `functions/api/historial.js?itemId=`) muestra cada
entrada de log con una columna "Detalle" de texto plano. Para la acción
`update`, ese texto viene de `itemAuditSummary('Actualizado', item)`
(`functions/api/item.js`), que solo repite ref/aula/nombre del ítem **tal
como quedó**, sin decir qué campo cambió ni su valor anterior. Apps
comerciales de referencia (Snipe-IT, itemit, AssetControl Cloud) muestran un
diff campo a campo por cada edición.

Las demás acciones que tocan un ítem (`add`, `delete`, `toggleOculto`,
`fotosSync`, `bulkImport`) ya generan texto específico (ref+nombre, cantidad
de fotos, etc.) — no tienen el mismo problema, así que quedan fuera de
alcance.

## Alcance

- Solo la acción `update` de `functions/api/item.js` gana diff estructurado.
- Solo los campos clave para seguimiento operativo: `item` (nombre), `aula`,
  `cat`, `mod`, `qty`, `min`, `est`, `loc`. El resto de `HEADERS_INV` (foto,
  proveedor, precio, fecha_adquisicion, serie, tags, obs, mant*, code,
  es_contenedor, parent_id, tipo_material, oculto, ref) se ignora a propósito
  para no meter ruido (ej. diff de foto en base64) ni sobrecargar el diseño.
- Solo se renderiza el diff en la vista **por ítem**
  (`#mItemHistorial`/`openHistorial()`). La vista general de historial
  (`js/modal-historial.js`, todas las acciones del centro/departamento) sigue
  mostrando el resumen tal cual — ahí conviven decenas de acciones no-item
  (préstamos, usuarios, config...) y un JSON crudo sería ruido.
- Sin migración D1. Sin columna nueva. Sin cambios de permisos/scoping (la
  autorización de `historial.js?itemId=` y de `item.js` acción `update` no
  cambian).

## Backend — `functions/api/item.js`, acción `update`

Antes del `UPDATE`, se añade un `SELECT` de los campos clave por `id` (hoy no
se leía la fila vieja en absoluto):

```js
const DIFF_FIELDS = ['item','aula','cat','mod','qty','min','est','loc'];
const oldRow = await env.DB.prepare(
  `SELECT ${DIFF_FIELDS.join(',')} FROM inventario WHERE id=?`
).bind(item.id).first();
```

Después del `UPDATE` ya existente, se comparan los `DIFF_FIELDS` uno a uno
(`String(oldRow[f] ?? '') !== String(item[f] ?? '')`, tratando
`null`/`undefined`/`''` como equivalentes para no generar diffs falsos) y se
construye:

```js
const diffs = DIFF_FIELDS
  .filter(f => String(oldRow?.[f] ?? '') !== String(item[f] ?? ''))
  .map(f => ({ campo: f, antes: oldRow?.[f] ?? '', despues: item[f] ?? '' }));
```

`auditLog` para esta acción pasa a recibir:
- `JSON.stringify(diffs)` si `diffs.length > 0`.
- El texto plano de siempre (`itemAuditSummary('Actualizado', item)`) si
  `diffs.length === 0` (ej. el guardado solo tocó foto/proveedor/precio, o
  reguardó los mismos valores) — nunca se escribe un `[]` vacío ni una fila
  sin información útil.

`oldRow` puede venir `null` si el ítem se borró entre el `SELECT` inicial de
autorización y este punto (carrera improbable, ya posible hoy con el resto
del flujo) — en ese caso `oldRow?.[f]` es `undefined` y se normaliza a `''`
igual que cualquier otro campo ausente, sin lanzar excepción.

## Frontend — `js/modal-item.js`, `openHistorial()`

Por cada fila del historial, en vez de `escHtml(l.resumen)` directo en la
celda "Detalle":

1. Intentar `JSON.parse(l.resumen)`.
2. Si es un array no vacío de objetos con `campo`/`antes`/`despues`,
   renderizar una lista compacta, una línea por campo cambiado:
   `<b>{label}:</b> {antesFmt} → {despuesFmt}`.
3. Si el `parse` falla o la forma no coincide (miles de filas antiguas en
   texto plano, o acciones que no sean `update`), renderizar
   `escHtml(l.resumen)` exactamente como hoy — sin ningún cambio de
   compatibilidad hacia atrás.

Mapeo de etiquetas y resolución de valores (constante local a
`modal-item.js`, junto a `openHistorial()` — no se extrae a un módulo
compartido, es la única consumidora):

```js
const FIELD_LABELS = {
  item: 'Nombre', aula: 'Aula', cat: 'Categoría', mod: 'Asignatura/Módulo',
  qty: 'Cantidad', min: 'Mínimo', est: 'Estado', loc: 'Ubicación'
};
```

- `aula`: valor resuelto vía `AULAS.find(a => a.id === valor)?.name`
  (mismo patrón ya usado en el resto del proyecto, ej. `inventory.js`).
- `mod`: valor resuelto vía `findModulo(valor)` (helper global ya existente
  en `inventory.js`, usado igual que en las columnas de tabla de inventario:
  `m ? m.cod+' '+m.name : valor||'—'`).
- Resto de campos (`item`, `cat`, `qty`, `min`, `est`, `loc`): se muestran
  tal cual (ya son texto legible en la propia fila de `inventario`).
- Valor vacío/`''` en `antes` o `despues`: se muestra `—` (mismo patrón que
  el resto de la UI para "sin dato").

## Testing

- Editar un ítem cambiando aula + cantidad a la vez → el historial por ítem
  muestra 2 líneas de diff (`Aula: X → Y`, `Cantidad: N → M`) en la entrada
  `update` más reciente.
- Editar un ítem cambiando solo `precio`/`foto`/`proveedor` (fuera de
  `DIFF_FIELDS`) → la entrada cae al texto plano de siempre
  (`itemAuditSummary`), sin diff vacío.
- Abrir el historial de un ítem con filas antiguas (`resumen` en texto
  plano, de antes de este cambio) → siguen mostrándose igual que hoy, sin
  errores de parseo visibles.
- Verificar que la vista general de historial (`js/modal-historial.js`) no
  cambia su render para las mismas filas nuevas (sigue mostrando el JSON
  crudo como texto, sin formatear) — confirma que el alcance quedó
  correctamente limitado a la vista por ítem.
- Flujo de cámara (`revision-aula.js`, `_corregirAulaRevision()`) que hace
  `update` con `{...item, aula: nuevaAula}` → debe generar un diff de una
  sola línea (`Aula: X → Y`), verificando que la lógica no asume que el
  `update` siempre viene del formulario completo del modal.
