# Mantenimiento preventivo — diseño

**Fecha:** 28/08/2026
**Origen:** petición directa del usuario ("hay un modo de mantenimiento
pero solo es cuando el profesor lo marca al ver algo dañado; sería
conveniente establecer un plan de mantenimiento preventivo, y saber qué
profesores están dedicados a dicho mantenimiento"), con investigación
previa de referencias comerciales (CMMS: UpKeep, eMaint, Fiix/MPulse) y un
caso concreto relevante — **Snipe-IT** (gestión de activos IT, espíritu
similar a este proyecto) lleva años con "mantenimiento recurrente
automático" como petición abierta en su GitHub sin resolver, señal de que
hay que mantener el alcance acotado en vez de replicar un CMMS completo.

## Problema

Hoy el mantenimiento (`docs/superpowers/specs/2026-08-25-mantenimiento-flujo-real-design.md`)
es puramente **reactivo**: alguien tiene que notar un ítem dañado y
marcarlo a mano (`mantEstado`). No existe ningún mecanismo para programar
una revisión periódica (ej. "este multímetro se calibra cada 12 meses",
"estas herramientas eléctricas llevan revisión anual por normativa") ni
para saber qué profesorado se ha comprometido a hacerlas.

## Alcance

Confirmado con el usuario (4 decisiones cerradas antes de este diseño):

- **Plan por ítem individual**, sin plantilla por categoría. Para
  aplicarlo a varios ítems de golpe (ej. toda una categoría) se
  seleccionan y se usa una acción de "Editar en lote" nueva — reutiliza el
  mecanismo de lote ya existente en Inventario, sin una entidad
  "plantilla" que sincronizar cuando cambian los ítems de una categoría.
- **Cualquiera con `items.write`** en el departamento puede marcar una
  revisión preventiva como hecha — mismo criterio que ya existe para
  editar cualquier otro campo del ítem, sin capa de permisos nueva.
- **Responsables de mantenimiento**: autoservicio (mismo patrón que Aulas
  y Módulos ya existente) + asignación directa por jefatura/superadmin.
- **Notificación solo en pantalla**, calculada al visitar la app — mismo
  mecanismo que ya usa el aviso de préstamos vencidos, sin infraestructura
  nueva (sin Cloudflare Cron Triggers, sin email). Hereda la misma
  limitación ya documentada para vencidos (Pendiente #5 en `CLAUDE.md`):
  si nadie visita la pantalla correspondiente, no se evalúa.

Explícitamente fuera de alcance (YAGNI):
- Checklist estructurado de pasos — la nota de un plan es texto libre,
  igual que el resto del mantenimiento reactivo.
- Aviso "próximo a vencer" (ventana de N días antes). Solo hay estado
  binario vencida/no vencida — igual que ya funciona `getVencidos()` para
  préstamos, sin inventar un tercer estado nuevo en la UI.
- Mantenimiento basado en uso/ciclos (ej. "cada 50 préstamos") — todos los
  CMMS investigados lo ofrecen como opción, pero no hay ninguna señal de
  que se necesite aquí; solo intervalo de tiempo fijo.
- Coste de la revisión preventiva — el campo `coste` de `mantenimientos`
  ya existe y queda disponible si alguien lo rellena a mano al cerrar,
  pero no se pide como paso obligatorio del flujo preventivo.

## Modelo de datos

Migración `migrations/0039_mantenimiento_preventivo.sql`:

```sql
-- Plan preventivo: 1:1 con el ítem, igual que fecha_adquisicion/precio/serie
-- (columnas planas en inventario, no una tabla aparte — no hay historial de
-- "versiones" del plan, solo el estado actual).
ALTER TABLE inventario ADD COLUMN mantPlanIntervaloDias INTEGER;
ALTER TABLE inventario ADD COLUMN mantPlanUltimaRevision TEXT DEFAULT '';
ALTER TABLE inventario ADD COLUMN mantPlanProximaRevision TEXT DEFAULT '';
ALTER TABLE inventario ADD COLUMN mantPlanNota TEXT DEFAULT '';

-- Cada incidencia de mantenimiento ya sabe distinguir correctivo (avería
-- real) de preventivo (revisión rutinaria, con o sin hallazgo).
ALTER TABLE mantenimientos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'correctivo';

-- Responsables de mantenimiento: mismo patrón que aula_profesores/
-- modulo_profesores (migrations/0032, 0033) — tabla puente autoservicio +
-- asignación admin, sin columna `departamento` propia en el sentido de
-- "aislar filas": la autorización usa siempre departamento+categoría
-- juntos, igual que aula_profesores usa aula (global) sin duplicar dept.
CREATE TABLE mantenimiento_responsables (
  categoria TEXT NOT NULL DEFAULT '',  -- '' = todo el departamento
  departamento TEXT NOT NULL,
  usuario TEXT NOT NULL,
  PRIMARY KEY (categoria, departamento, usuario)
);
```

`mantPlanIntervaloDias IS NULL` = sin plan activo (no hace falta una
columna `activo` aparte). `mantPlanUltimaRevision`/`mantPlanProximaRevision`
son fechas `YYYY-MM-DD` (mismo formato que el resto de fechas de la app),
comparables lexicográficamente.

## Backend — `functions/api/item.js`

**`HEADERS_INV`** (y su copia en `list.js` — mismo aviso ya en el
comentario de la línea 1 de `item.js`) gana las 4 columnas nuevas de
`inventario`. Al estar en `HEADERS_INV`/`FIELDS_UPD` (que ya es
`HEADERS_INV.filter(h => h !== 'id')`, genérico), **se escriben solas** a
través de `add`/`update`/`bulkImport`/`restoreBackup` sin tocar código —
mismo mecanismo que ya usa `mantCoste`. El frontend calcula
`mantPlanProximaRevision` (hoy + intervalo) antes de enviarlo, tanto desde
el modal de ítem como desde el bulk-edit — no hace falta que el backend
recalcule nada al guardar un plan nuevo o editado.

**Acción nueva `mantenimientoMarcarRevisado`** (permiso `items.write`,
mismo chequeo de propiedad por departamento que `update`) — la única
lógica de servidor genuinamente nueva, porque toca dos sitios a la vez:

```js
// body: { itemId, nota }
// 1. Lee inventario.mantPlanIntervaloDias del ítem; si es NULL, error
//    ("Este ítem no tiene un plan de mantenimiento activo").
// 2. hoy = fecha de hoy; proxima = hoy + mantPlanIntervaloDias días.
// 3. INSERT INTO mantenimientos
//      (item_id, estado, fecha_apertura, nota_apertura, responsable,
//       fecha_cierre, nota_cierre, tipo, creado_por, creado_en)
//    VALUES (?, 'Resuelto', hoy, 'Revisión preventiva', user.usuario,
//            hoy, nota||'', 'preventivo', user.usuario, now)
// 4. UPDATE inventario SET mantPlanUltimaRevision=hoy,
//      mantPlanProximaRevision=proxima WHERE id=itemId
// 5. Devuelve { ok:true, mantPlanUltimaRevision, mantPlanProximaRevision }
//    para que el frontend actualice su copia local de `items` sin recargar.
```

Este `INSERT` usa siempre `estado='Resuelto'`, que **no** está en
`MANT_OPEN_STATES` — no interfiere con `syncMantenimiento()` (que busca la
incidencia abierta más reciente por `estado IN (...)`) aunque el ítem
tenga a la vez una avería correctiva real abierta. Los dos flujos son
independientes por diseño: una revisión preventiva se puede marcar hecha
aunque el ítem esté en mantenimiento correctivo, y viceversa.

**`mantenimientosGet`** (ya existente) no cambia de firma — el frontend
ahora pinta un icono distinto según `tipo` (🔧 correctivo / 🛡️ preventivo)
al listar el historial que ya carga.

## Backend — `functions/api/usuarios.js` (responsables)

Junto a `selectAulas`/`userAssignAulas` (mismo archivo, mismo estilo:
`CREATE TABLE IF NOT EXISTS` defensivo + diff-sync contra lo ya guardado):

- **`selectMantenimientoCategorias`** (permiso `profile.write`,
  autoservicio): body `{ categorias: string[] }` (acepta `''` = "todo el
  departamento" como una de las entradas del array). Compara contra lo ya
  guardado para `(usuario=login, departamento=SESSION.departamento)`,
  inserta lo nuevo / borra lo quitado — mismo patrón exacto que
  `selectAulas` (`js/modal-mis-aulas.js` línea 48 → `functions/api/usuarios.js`).
- **`userAssignMantenimiento`** (permiso `config.manage`, jefatura/
  superadmin): mismo diff-sync pero puede apuntar a cualquier usuario del
  departamento (o de cualquiera, si superadmin) — mismo patrón que
  `userAssignAulas`.
- **`getUsers`**: el `JOIN` que ya arma `modulo_profesores`/
  `aula_profesores` para la tabla de 🔐 Usuarios (líneas ~164-168) gana un
  tercer `JOIN` a `mantenimiento_responsables`, mismo criterio de scoping
  por departamento.

`ENDPOINT_MAP` (`js/api.js`): `mantenimientoMarcarRevisado:'item'`,
`selectMantenimientoCategorias:'usuarios'`, `userAssignMantenimiento:'usuarios'`.
`ACTION_PERMISSIONS` (`js/roles.js`): las 3 acciones con los permisos ya
indicados arriba (mismo valor que sus gemelas `mantenimientosGet`/
`selectAulas`/`userAssignAulas`).

`functions/api/meta.js` expone `misMantenimiento` (array de categorías)
junto a `misAulas`/`misModulos` ya existentes, para que `js/auth.js`
(cerca de la línea 525, donde ya hace `MIS_AULAS = ...`) rellene una
variable global nueva `MIS_MANT_CATEGORIAS` (declarada en `js/state.js`
junto a `MIS_AULAS`) al cargar sesión.

## Frontend — plan por ítem (`js/modal-item.js` + `index.html`)

Dentro de la sección ya colapsable `#mSecMantenimiento` (después de los
campos de coste/historial ya existentes), bloque nuevo "Plan preventivo":

1. Desplegable `f_mantPlanIntervalo`: `— Sin plan —` (vacío) + 30/90/180/
   365/730 días + `otro` (revela `f_mantPlanIntervaloOtro`,
   `<input type="number" min="1">`, al lado — mismo patrón ya usado para
   la franja horaria de reservas, v631 — "desplegable con opciones fijas +
   Otra…"). `saveItem()` lee `f_mantPlanIntervaloOtro` en vez de
   `f_mantPlanIntervalo` cuando su valor es `otro`; en cualquier otro caso
   usa el valor numérico del propio `<select>` directamente.
2. `f_mantPlanNota` (texto corto: qué hay que revisar).
3. Si el ítem ya tiene un plan activo (`item.mantPlanIntervaloDias`): texto
   de solo lectura "Última revisión: DD/MM/AAAA (o 'nunca')· Próxima:
   DD/MM/AAAA" con color de aviso (`--red`/`--amber`, mismos tokens que ya
   usa el resto del modal) si `mantPlanProximaRevision <= hoy`, y un botón
   "✅ Marcar revisado hoy" que llama a `mantenimientoMarcarRevisado` y
   actualiza el texto sin cerrar el modal.

`saveItem()` calcula `mantPlanProximaRevision` en JS (hoy + intervalo
elegido) justo antes de mandar el payload, solo si `f_mantPlanIntervalo`
tiene un valor Y (`mantPlanUltimaRevision` está vacía O cambió el
intervalo respecto al valor original) — si el profesor solo edita la nota
sin tocar el intervalo, la próxima revisión ya calculada no se recalcula
sola.

**Repetir aquí explícitamente la lección ya aprendida en la revisión de
v591→v592 (Task 3):** los 3 campos nuevos (`f_mantPlanIntervalo`,
`f_mantPlanNota`, y el estado interno de "Otra cantidad") deben añadirse a
`MODAL_TRACKED_FIELDS` (línea 8) y a las listas paralelas de
`captureModalOriginalValues`/`attachModalChangeListeners`/
`checkModalForChanges`/`setItemModalReadonly` — la vez anterior que se
añadieron campos `mant*` nuevos, exactamente este paso se olvidó y lo
detectó la revisión de código, no el desarrollo.

## Frontend — aplicación en lote (`js/inventory.js` + `index.html`)

`#bulkAction` gana 2 opciones nuevas:
- `plan-set` — "🛡️ Establecer plan de mantenimiento preventivo":
  `renderBulkActionControl()` muestra el mismo desplegable de intervalo +
  nota que el modal de ítem (control compartido, no reimplementado). En
  `applyBulkAction()`, el patch por ítem incluye `mantPlanIntervaloDias`,
  `mantPlanProximaRevision` (hoy + intervalo, calculado una vez para todo
  el lote) y `mantPlanNota` — reutiliza el bucle ya existente de llamadas
  `update` una por una (no hay endpoint de lote real en este proyecto para
  ninguna acción de bulk-edit, todas son N llamadas — confirmado leyendo
  `applyBulkAction()` actual, líneas 792-805).
- `plan-off` — "Quitar plan de mantenimiento preventivo": patch
  `{ mantPlanIntervaloDias: null, mantPlanProximaRevision: '' }` (mantiene
  `mantPlanUltimaRevision` como estaba, por si se reactiva luego). Sin
  nota obligatoria — a diferencia de cerrar una incidencia correctiva, no
  se está archivando nada, solo se deja de programar.

Así se cubre "aplicar a toda una categoría": seleccionar todos los ítems
de esa categoría (ya es posible hoy, filtro + "seleccionar todo") y usar
`plan-set` una vez.

## Frontend — visibilidad de revisiones pendientes

**Helper nuevo, `js/state.js`** (junto a `needsMaintenance`):
```js
function needsPreventiveMaintenance(item){
  return !!item.mantPlanIntervaloDias && !!item.mantPlanProximaRevision
    && item.mantPlanProximaRevision <= todayISO();
}
function needsAnyMaintenance(item){
  return needsMaintenance(item) || needsPreventiveMaintenance(item);
}
```
(`todayISO()` — no existe un helper compartido de "fecha de hoy" en el
proyecto hoy: cada archivo repite `new Date().toISOString().slice(0,10)`
inline donde lo necesita — ej. `js/modal-item.js:1021`,
`js/reservas-practica.js:35`. `needsPreventiveMaintenance`/`needsAnyMaintenance`
hacen lo mismo inline en `js/state.js`, sin crear un helper nuevo
compartido — coherente con que el resto del proyecto tampoco lo tiene.)

**Vista "Mantenimiento" de Inventario** (`js/inventory.js:46`, filtro
`cf.type==='maintenance'`): cambia el predicado de `needsMaintenance(x)` a
`needsAnyMaintenance(x)` — una sola vista mezcla correctivo y preventivo
pendientes, cada fila con su propio badge (🔧/🛡️) para distinguir el
motivo. Evita crear una vista/filtro paralelo.

**Inicio** (`js/home.js`, contador `mant` línea 165 y tarjeta
"Mantenimiento" línea 172/181): mismo cambio de predicado
(`needsMaintenance` → `needsAnyMaintenance`), sin más cambios — el badge
"(tus aulas)" y el resto de la lógica de `debeFiltrarPorMisAulas()` ya
existente se aplican igual.

**🔔 "Requiere tu atención" (`checkAtencionHoy()`, `js/home.js:84`)** —
hoy hace `return` inmediato si `!can('config.manage')` (línea 85). Pasa a
dos ramas:

- **Jefatura/superadmin** (rama actual, sin cambios de estructura): el
  chip "🛠️ Mantenimiento" ya existente (línea 118) cambia su fuente de
  `items.filter(needsMaintenance)` a `items.filter(needsAnyMaintenance)` —
  un único chip sigue cubriendo ambos motivos, igual que en Inventario.
- **Rama nueva, para cualquier profesor que NO tenga `config.manage` pero
  sí tenga `MIS_MANT_CATEGORIAS` no vacío**: calcula
  `items.filter(x => needsPreventiveMaintenance(x) && x.departamento === SESSION.departamento && (MIS_MANT_CATEGORIAS.includes('') || MIS_MANT_CATEGORIAS.includes(x.cat)))`.
  Si el resultado no está vacío, abre el mismo modal (`#mAtencionHoy`) con
  un único chip "🛠️ Revisiones preventivas pendientes" (sin desglose por
  departamento — ya está acotado a lo suyo) — reutiliza `_atencionChip()`
  con `porDepto=null`. Sin este bloque, no se abre nada para ese perfil
  (mismo criterio ya usado hoy: "nada pendiente, no molestar").

**"📌 Mis Cursos/Aulas"** (menú de topbar): tercera entrada "🛠️
Mantenimiento" → `js/modal-mis-mantenimiento.js` (archivo nuevo, calco
casi literal de `js/modal-mis-aulas.js`): lista las categorías del propio
departamento (`CATS`, ya llega filtrado por departamento) + una fila
especial arriba "Todo el departamento" (valor `''`), checkboxes,
`selectMantenimientoCategorias` al guardar.

**🔐 Usuarios**: botón "🛠️ Mantenimiento" junto al "🏫 Aulas" ya existente
en la fila de acciones de cada usuario → mismo modal de categorías pero
llamando a `userAssignMantenimiento`.

## Testing

- Crear un plan (intervalo 90 días) desde el modal de un ítem sin plan
  previo → guardar → `mantPlanProximaRevision` queda a hoy+90;
  `mantPlanUltimaRevision` vacío; el ítem no aparece aún como pendiente.
- Editar solo la nota del plan sin tocar el intervalo → `mantPlanProximaRevision`
  no cambia.
- Retroceder el reloj del entorno de test (o insertar directo en D1 una
  `mantPlanProximaRevision` pasada) → el ítem aparece en la vista
  "Mantenimiento" de Inventario con badge 🛡️, en el contador de Inicio, y
  en el chip de "🔔 Requiere tu atención" de jefatura.
- "✅ Marcar revisado hoy" sobre ese ítem → nueva fila en
  `mantenimientosGet` con `tipo='preventivo'`, `estado='Resuelto'`,
  apertura=cierre=hoy; `mantPlanUltimaRevision`=hoy;
  `mantPlanProximaRevision`=hoy+intervalo; el ítem deja de aparecer como
  pendiente en las 3 vistas de arriba.
- Ítem con una incidencia correctiva abierta (`mantEstado='Pendiente'`) Y
  un plan preventivo vencido a la vez → ambos badges visibles a la vez;
  marcar la revisión preventiva como hecha no toca la incidencia
  correctiva abierta, y viceversa.
- Bulk `plan-set` sobre 5 ítems seleccionados → los 5 quedan con el mismo
  intervalo y la misma `mantPlanProximaRevision`.
- Bulk `plan-off` sobre esos mismos 5 → `mantPlanIntervaloDias` vuelve a
  NULL en los 5, desaparecen de las vistas de pendientes.
- Profesor sin `config.manage`, sin categorías de mantenimiento
  autoasignadas → no ve el modal "🔔 Requiere tu atención" aunque haya
  revisiones vencidas en su departamento (mismo comportamiento que hoy,
  sin regresión).
- Ese mismo profesor se autoasigna una categoría con un ítem vencido
  (`selectMantenimientoCategorias`) → en su siguiente visita, ve la
  versión reducida del modal con solo ese chip.
- Jefatura asigna a un profesor una categoría vía `userAssignMantenimiento`
  → aparece reflejado en 🔐 Usuarios y el profesor lo ve en "📌 Mis
  Cursos/Aulas" sin tener que autoasignárselo.
- CSV de inventario (`inventoryCsvRows`) y `bulkImport`/`restoreBackup`
  siguen funcionando sin tocar código — las 4 columnas nuevas viajan solas
  al estar en `HEADERS_INV` (regresión, confirmar que no rompen ítems que
  no las llevan: deben leerse como `NULL`/`''` sin error).
