# Mantenimiento como flujo real — diseño

**Fecha:** 25/08/2026
**Origen:** brainstorming de la sesión de planificación de prácticas (v588),
idea diferida a propósito para esa sesión, retomada tras cerrar "historial
de ítems como timeline" (v588→v590) en esta misma sesión. Backlog punto 14
en CLAUDE.md.

## Problema

Hoy `item.mant` es un checkbox + 4 campos planos en `inventario`
(`mantFecha`, `mantEstado` — ya un `<select>` con 4 opciones fijas:
Pendiente/En reparación/Reparado/Resuelto —, `mantResp`, `mantNota`),
usados en filtros/badges/CSV (`js/inventory.js`) y Volt
(`lista_mantenimiento`). Faltan piezas reales de un flujo de
mantenimiento: no hay coste, no hay cierre real (fecha/nota de qué se hizo,
distinta de la nota de apertura del problema), y solo existe **una**
incidencia por ítem — los campos se sobrescriben en cada edición, sin
guardar histórico de incidencias pasadas. También existen en el esquema
`mantSolicitante`/`mantSolicitanteEmail` (`HEADERS_INV`) pero **nunca se
escriben desde ninguna UI real** — solo se inicializan vacíos en
`js/multi-equipo.js`, indicio de un flujo de "solicitar mantenimiento sin
permiso de edición" que se planeó pero nunca se construyó.

## Alcance

- **Solo gestión para quien ya puede editar ítems** (jefe de departamento/
  profesor con permiso `items.write`) — decisión explícita del usuario. Un
  flujo de "reportar avería" para roles sin permiso de edición (que
  aprovecharía `mantSolicitante`/`mantSolicitanteEmail`) queda fuera de
  esta pieza, para otra sesión si se decide construirlo.
- Historial **completo** de incidencias pasadas por ítem (no solo "la
  incidencia actual").
- Cambiar el estado de mantenimiento a "Resuelto"/"Reparado" **no** toca
  automáticamente el estado general del ítem (`est`: Bueno/Deteriorado/
  Avería/Baja) — decisión humana aparte, sin sugerencia ni aviso.
- Sin cambios en Volt (`lista_mantenimiento` sigue leyendo los mismos
  campos espejo en `inventario`, que se siguen comportando igual desde su
  punto de vista: verdadero mientras haya una incidencia abierta).

## Modelo de estados

5 estados en `mantEstado` (antes 4: Pendiente/En reparación/Reparado/
Resuelto — se añade **Enviado a reparar externo**):

**Abiertos** (`mant=1`, incidencia activa, sin fecha/nota de cierre):
`Pendiente`, `En reparación`, `Enviado a reparar externo`

**Cierran la incidencia** (`mant=0`, exigen fecha + nota de cierre,
archivan la fila en `mantenimientos`): `Reparado`, `Resuelto` — dos formas
distintas de dar la incidencia por terminada (ej. reparado en el propio
centro vs. resuelto de otra forma: sustituido, dado de baja, etc.), ambas
tratadas igual a nivel de mecánica de cierre.

Transición directa de "Ninguno" a un estado de cierre está permitida
(sirve para anotar una reparación que ya ocurrió sin pasar por un estado
intermedio) — crea y cierra la incidencia en el mismo guardado.

## Modelo de datos

Migración `migrations/0028_mantenimientos.sql`:

```sql
CREATE TABLE mantenimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  fecha_apertura TEXT NOT NULL,
  nota_apertura TEXT DEFAULT '',
  responsable TEXT DEFAULT '',
  coste REAL,
  fecha_cierre TEXT DEFAULT '',
  nota_cierre TEXT DEFAULT '',
  creado_por TEXT DEFAULT '',
  creado_en TEXT DEFAULT ''
);
CREATE INDEX idx_mantenimientos_item_id ON mantenimientos(item_id);

ALTER TABLE inventario ADD COLUMN mantCoste REAL;

-- Backfill: ítems ya marcados en mantenimiento se convierten en 1 incidencia
-- abierta cada uno (se conserva su mantEstado actual tal cual, sin forzar
-- fecha/nota de cierre aunque ya diga Reparado/Resuelto — no hay forma de
-- reconstruir ese dato histórico, así que se deja la fila sin cerrar y el
-- usuario decide si la cierra formalmente la próxima vez que la vea).
INSERT INTO mantenimientos (item_id, estado, fecha_apertura, nota_apertura, responsable, creado_en)
  SELECT id,
    CASE WHEN mantEstado IN ('Pendiente','En reparación','Enviado a reparar externo','Reparado','Resuelto')
         THEN mantEstado ELSE 'Pendiente' END,
    COALESCE(NULLIF(mantFecha,''), date('now')),
    COALESCE(mantNota,''),
    COALESCE(mantResp,''),
    datetime('now')
  FROM inventario WHERE mant = 1 OR mant = '1';
```

`mantenimientos.item_id` no lleva `departamento` propio — la autorización
se resuelve siempre vía join a `inventario.departamento` (mismo patrón que
`item_fotos`), nunca duplicada en la tabla hija.

`inventario.mant`/`mantFecha`/`mantEstado`/`mantResp`/`mantNota`/`mantCoste`
pasan a ser un **espejo puro, calculado por el backend**: reflejan
siempre la incidencia abierta más reciente, o quedan vacíos si no hay
ninguna. El frontend sigue enviando `mantFecha`/`mantEstado`/`mantResp`/
`mantNota`/`mantCoste` como parte del payload del ítem (son la entrada que
lee `syncMantenimiento`, ver Backend) — la única diferencia es que **ya no
manda el booleano `mant`** en absoluto (el backend lo deriva siempre a
partir de `mantEstado`); si el payload llega sin esa clave, `item.mant`
es `undefined` y se guarda como `null`, tratado igual que `false` por
`isMaintenanceMarked()`/`needsMaintenance()` (ambas comparan con `=== true`
`=== 1`/`'1'`, nunca con truthiness genérica).

## Backend — `functions/api/item.js`

**`HEADERS_INV`** gana `mantCoste` (recordar añadirlo también a la copia
de `list.js` — lección ya documentada varias veces en este proyecto).
**`FIELDS_UPD`** no cambia — sigue incluyendo los 6 campos mant tal cual
(no hace falta excluirlos): el `UPDATE`/`INSERT` genérico los escribe
primero con lo que venga del formulario, y la función de sincronización
de abajo corre **después**, en la misma petición, y es quien de verdad
decide el valor final — su propio `UPDATE inventario SET mant=...` (rama
`isClosingNow`) o `UPDATE inventario SET mant=1,...` (rama `isOpenNow`)
sobrescribe lo que el paso genérico acabara de escribir. La única
petición que no dispara ninguna de las dos ramas es aquella en la que
`oldEstado` y `newEstado` son ambos `''` (nunca hubo ni hay incidencia),
caso en el que el valor que dejó el `UPDATE`/`INSERT` genérico ya era
vacío de todas formas — así que el resultado final es idéntico en
cualquier caso, sin necesidad de tocar `FIELDS_UPD`.

Función nueva `syncMantenimiento(db, itemId, oldRow, item, user)`,
llamada después del `INSERT`/`UPDATE` principal en las acciones `add` y
`update` (no en `bulkImport`/`restoreBackup` — esos ya mandan los campos
mant vacíos siempre, sin cambios):

```js
const MANT_OPEN_STATES = ['Pendiente', 'En reparación', 'Enviado a reparar externo'];
const MANT_CLOSE_STATES = ['Reparado', 'Resuelto'];

async function syncMantenimiento(db, itemId, oldRow, item, user) {
  const oldEstado = oldRow?.mantEstado || '';
  const newEstado = item.mantEstado || '';
  const wasOpen = MANT_OPEN_STATES.includes(oldEstado);
  const isOpenNow = MANT_OPEN_STATES.includes(newEstado);
  const isClosingNow = MANT_CLOSE_STATES.includes(newEstado);
  const hoy = new Date().toISOString().slice(0, 10);

  if (!oldEstado && !newEstado) return;

  if (isClosingNow) {
    const openRow = await db.prepare(
      `SELECT id FROM mantenimientos WHERE item_id=? AND estado IN (${MANT_OPEN_STATES.map(() => '?').join(',')}) ORDER BY id DESC LIMIT 1`
    ).bind(itemId, ...MANT_OPEN_STATES).first();
    const fechaCierre = item.mantFechaCierre || hoy;
    const notaCierre = item.mantNotaCierre || '';
    if (openRow) {
      await db.prepare(
        `UPDATE mantenimientos SET estado=?, responsable=?, coste=?, fecha_cierre=?, nota_cierre=? WHERE id=?`
      ).bind(newEstado, item.mantResp || '', item.mantCoste ?? null, fechaCierre, notaCierre, openRow.id).run();
    } else {
      await db.prepare(
        `INSERT INTO mantenimientos (item_id, estado, fecha_apertura, nota_apertura, responsable, coste, fecha_cierre, nota_cierre, creado_por, creado_en)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).bind(itemId, newEstado, item.mantFecha || hoy, item.mantNota || '', item.mantResp || '', item.mantCoste ?? null, fechaCierre, notaCierre, user?.usuario || '', new Date().toISOString()).run();
    }
    await db.prepare(
      `UPDATE inventario SET mant=0, mantFecha='', mantEstado='', mantResp='', mantNota='', mantCoste=NULL WHERE id=?`
    ).bind(itemId).run();
    Object.assign(item, { mant: 0, mantFecha: '', mantEstado: '', mantResp: '', mantNota: '', mantCoste: null });
    return;
  }

  if (isOpenNow && !wasOpen) {
    await db.prepare(
      `INSERT INTO mantenimientos (item_id, estado, fecha_apertura, nota_apertura, responsable, coste, creado_por, creado_en)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(itemId, newEstado, item.mantFecha || hoy, item.mantNota || '', item.mantResp || '', item.mantCoste ?? null, user?.usuario || '', new Date().toISOString()).run();
  } else if (isOpenNow && wasOpen) {
    const openRow = await db.prepare(
      `SELECT id FROM mantenimientos WHERE item_id=? AND estado IN (${MANT_OPEN_STATES.map(() => '?').join(',')}) ORDER BY id DESC LIMIT 1`
    ).bind(itemId, ...MANT_OPEN_STATES).first();
    if (openRow) {
      await db.prepare(
        `UPDATE mantenimientos SET estado=?, nota_apertura=?, responsable=?, coste=? WHERE id=?`
      ).bind(newEstado, item.mantNota || '', item.mantResp || '', item.mantCoste ?? null, openRow.id).run();
    }
  }

  if (isOpenNow) {
    await db.prepare(
      `UPDATE inventario SET mant=1, mantFecha=?, mantEstado=?, mantResp=?, mantNota=?, mantCoste=? WHERE id=?`
    ).bind(item.mantFecha || hoy, newEstado, item.mantResp || '', item.mantNota || '', item.mantCoste ?? null, itemId).run();
    Object.assign(item, { mant: 1, mantFecha: item.mantFecha || hoy, mantEstado: newEstado, mantResp: item.mantResp || '', mantNota: item.mantNota || '', mantCoste: item.mantCoste ?? null });
  }
}
```

`item.mantFechaCierre`/`item.mantNotaCierre` son campos de entrada
efímeros — solo los lee `syncMantenimiento`, **nunca** se añaden a
`HEADERS_INV`/`FIELDS_UPD` (no son columnas de `inventario`, solo llegan a
`mantenimientos.fecha_cierre`/`nota_cierre`).

**Acción `update`:** el `SELECT` de la fila vieja que ya existe para el
diff del historial-timeline (`DIFF_FIELDS`, ver
`docs/superpowers/specs/2026-08-24-historial-timeline-design.md`) se
amplía para incluir también `mant, mantEstado, mantFecha, mantResp,
mantNota, mantCoste` en la misma consulta — una sola lectura de la fila
vieja sirve a los dos propósitos (diff del historial + sync de
mantenimiento), sin duplicar el `SELECT`. `syncMantenimiento` se llama
después del `UPDATE` genérico y después de calcular el diff del
historial-timeline (el diff de historial NO debe incluir los campos mant,
quedan fuera de `DIFF_FIELDS` a propósito, sin cambios ahí).

**Acción `add`:** `syncMantenimiento(env.DB, newId, null, item, user)`
después del `INSERT`, para el caso (raro pero posible) de crear un ítem
con un `mantEstado` inicial ya puesto desde el mismo formulario.

**Acción nueva de solo lectura, `mantenimientosGet`:** recibe `itemId`,
devuelve el historial completo (`SELECT * FROM mantenimientos WHERE
item_id=? ORDER BY id DESC`), mismo patrón de verificación de propiedad
por departamento que ya usa `fotosGet` (verifica que el ítem pertenezca al
departamento del usuario, o sea del departamento compartido, antes de
devolver nada). Registrada en `ENDPOINT_MAP` (`js/api.js`) y
`ACTION_PERMISSIONS` (`js/roles.js`, mismo permiso `items.write` que ya
exige `fotosGet` — coherente con el alcance acotado de esta sesión, ver
gap ya aceptado para fotos en el punto 12 del backlog).

## Frontend — `js/modal-item.js` + `index.html`

La sección actual "🛠️ MANTENIMIENTO" (checkbox `f_mant` fuera de la
sección + bloque `#maintFields` con `f_mantFecha`/`f_mantEstado` de 4
opciones/`f_mantResp`/`f_mantNota`) se sustituye por:

1. Un único desplegable `f_mantEstado` con 6 opciones: `— Ninguno —`
   (valor `''`) + los 5 estados reales. **La opción "— Ninguno —" solo es
   seleccionable cuando no hay incidencia abierta** — si el ítem ya tiene
   una incidencia abierta, el desplegable solo ofrece los 3 estados
   abiertos + los 2 de cierre (quitar "Ninguno" de las `<option>` cuando
   `isMaintenanceMarked(item)` es cierto al abrir el modal, evita el caso
   ambiguo de "vaciar el estado sin pasar por un cierre formal" que el
   backend no sabe resolver de forma segura).
2. Mientras el estado elegido sea uno de los 3 abiertos: se muestran
   `f_mantFecha` (fecha de aviso, autorrellenada a hoy en incidencia
   nueva), `f_mantResp`, `f_mantNota`, `f_mantCoste` (nuevo, número,
   opcional, editable en cualquier momento mientras está abierta —
   ej. anotar un presupuesto recibido).
3. Al elegir uno de los 2 estados de cierre (`Reparado`/`Resuelto`):
   aparecen además `f_mantFechaCierre` (autorrellenada a hoy, editable) y
   `f_mantNotaCierre` (textarea, **obligatoria** — bloquea "Guardar
   cambios" con el mismo patrón de validación ya usado en el resto del
   modal, ej. `markFieldError('f_mantNotaCierre', ...)`, si está vacía).
4. Un enlace "📜 Ver historial de mantenimiento", sin contador, visible
   siempre que se esté editando un ítem ya existente (oculto al crear uno
   nuevo — no hay `itemId` todavía). Al pulsarlo, carga `mantenimientosGet`
   una sola vez (cacheado en una variable local `_mantHistorial`, mismo
   patrón que `_fotosEditing`) y renderiza una lista de solo lectura
   (fecha apertura→cierre, estado, responsable, coste, nota de apertura,
   nota de cierre), o el texto "Sin incidencias registradas todavía" si la
   respuesta viene vacía — sin modal nuevo, expandido inline dentro de la
   propia sección "🛠️ MANTENIMIENTO" (no justifica el peso de un modal
   aparte, a diferencia del historial de auditoría general del ítem).

`saveItem()` sigue mandando `mantEstado`/`mantFecha`/`mantResp`/`mantNota`/
`mantCoste` como hoy (mismos nombres de campo, mismo payload del `item`),
más los 2 nuevos `mantFechaCierre`/`mantNotaCierre` cuando aplique — sin
cambiar la mecánica de guardado (un único botón "Guardar cambios", una
sola llamada a `add`/`update`, sin flujo de guardado separado para
mantenimiento).

## Otros puntos de contacto

- **Bulk edit "mantenimiento"** (`js/inventory.js:663-664` construye el
  `<select id="bulkMant">` con 2 opciones, `js/inventory.js:776` arma el
  patch): hoy permite tanto "Marcar mantenimiento" (abre `Pendiente`) como
  "Quitar mantenimiento" (limpia `mant`/`mantEstado` sin pasar por ningún
  cierre formal). La opción de quitar se **elimina** — con coste/historial
  de por medio, cerrar una incidencia sin nota de qué se hizo deja de
  tener sentido, y la edición en lote no tiene sitio para pedir esa nota
  por cada ítem. El bulk-edit se queda solo con "Marcar mantenimiento"
  (`patch = { mantEstado: 'Pendiente' }`, ya no manda `mant` en absoluto —
  el backend lo deriva siempre en `syncMantenimiento`). Cerrar una
  incidencia real, con nota, sigue siendo posible desde el modal de cada
  ítem, uno a uno.
- **`needsMaintenance(item)`** (`js/state.js:72`, no confundir con
  `isMaintenanceMarked()` en `js/modal-item.js:702`, una comprobación
  local distinta y ya existente solo para el propio formulario) y su uso
  en filtros/badges/CSV de `js/inventory.js` no cambian — de hecho ya
  excluye explícitamente `mantEstado` en `'resuelto'`/`'reparado'` antes
  de mirar `item.mant`, código defensivo que ya anticipaba exactamente
  estos 2 estados terminales sin que nadie lo hubiera planeado así a
  propósito — confirma que la elección de estados terminales encaja con
  el código ya existente, sin tocar `js/state.js`.
- **Volt** (`lista_mantenimiento`) no cambia — sigue leyendo los mismos
  campos espejo.
- **`js/multi-equipo.js:198`**: sigue inicializando los 6 campos mant
  vacíos (incluye el nuevo `mantCoste: ''` en esa misma línea) — el alta
  masiva nunca abre una incidencia de mantenimiento, sin cambio de
  comportamiento.

## Testing

- Marcar un ítem sin incidencia previa como "Pendiente" con nota +
  responsable → guardar → el historial de mantenimiento del ítem muestra
  1 incidencia abierta; `inventario.mant=1`.
- Cambiar esa incidencia de "Pendiente" a "En reparación" (misma fila,
  sin cerrar) → el historial sigue mostrando 1 sola incidencia (no se
  duplica), con el estado actualizado.
- Cerrarla a "Resuelto" con nota de cierre → el historial pasa a mostrar
  la incidencia con `fecha_cierre`/`nota_cierre` rellenas;
  `inventario.mant` vuelve a `0` y el desplegable del modal vuelve a
  ofrecer "— Ninguno —"; el badge de mantenimiento desaparece de la
  tarjeta/tabla del ítem.
- Intentar cerrar sin rellenar la nota de cierre → bloqueado con el mismo
  patrón de validación inline que el resto del modal.
- Abrir una segunda incidencia tiempo después en el mismo ítem → el
  historial acumula 2 filas independientes, cada una con su propio
  coste/fechas/notas.
- Pasar directo de "— Ninguno —" a "Reparado" (sin pasar por un estado
  abierto) → crea y cierra la incidencia en el mismo guardado, visible de
  inmediato en el historial con `fecha_apertura` = `fecha_cierre` = hoy si
  no se cambia la fecha de aviso.
- CSV de inventario y filtro "Mantenimiento" de `js/inventory.js` siguen
  funcionando igual con una incidencia abierta (regresión, sin cambios
  esperados en su comportamiento).
- Bulk edit "Marcar mantenimiento" sobre varios ítems a la vez sigue
  abriendo una incidencia "Pendiente" por cada uno.
