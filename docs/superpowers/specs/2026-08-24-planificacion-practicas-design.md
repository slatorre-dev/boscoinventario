# Planificación de prácticas (reservas de material) — Diseño

**Fecha:** 24/08/2026
**Estado:** Pendiente de aprobación del usuario (spec recién escrita)
**Origen:** investigación de apps comerciales de inventario/gestión de
activos orientadas a centros educativos (Snipe-IT, EZOfficeInventory,
Asset Panda, GLPI, y herramientas de reserva de equipos de laboratorio
como Skedda/BookitLab/LabArchives Scheduler), contrastada con lo que ya
tiene Bosco Inventario — ver conversación de esta sesión para el detalle
de la investigación y las decisiones tomadas pregunta a pregunta.

## Contexto

Hoy el préstamo de material (`js/prestamos.js`, `functions/api/prestar.js`)
solo soporta "prestar ahora mismo": un profesor pide un ítem (o una caja
completa) y el stock se descuenta al instante. No existe forma de reservar
con antelación material para una sesión de prácticas futura sin bloquearlo
ya — si dos profesores cuentan con el mismo osciloscopio el mismo día, el
choque solo se descubre cuando uno de los dos llega al taller y no está.

El historial por ítem (`functions/api/historial.js`, endpoint `?itemId=`)
ya existe, y las tablas `prestamos`/`inventario` ya soportan todo lo
necesario para un préstamo real — esta pieza añade una capa de
**reserva previa** encima de ese flujo ya existente, sin tocarlo.

## Objetivo y alcance

Permitir a un profesor o jefe/a de departamento reservar con antelación un
conjunto de material ("kit de práctica") para una sesión de clase futura
— ligada a un ciclo/asignatura, una fecha y una franja horaria — de forma
que:
1. El sistema impide que dos reservas choquen por el mismo ítem en el
   mismo hueco (bloqueo duro).
2. El día de la sesión, la reserva se convierte en préstamo real con un
   solo clic ("Confirmar recogida"), reutilizando la lógica de préstamo ya
   existente.

**Fuera de alcance explícito (decisiones tomadas en esta sesión):**
- **Sin horario rígido de campanadas.** La franja horaria es texto libre
  (ej. "10:00-11:00" o "3ª hora"). El bloqueo de conflictos solo detecta
  coincidencia **exacta** de texto — si dos profesores describen la misma
  hora real con textos distintos, el choque no se detecta. Limitación
  aceptada explícitamente a cambio de no modelar un sistema de horarios
  por departamento (mucha más pieza nueva, más fricción de configuración).
- **Sin edición de una reserva ya creada.** Solo cancelar (libera el
  bloqueo) y crear de nuevo. Editar implicaría re-ejecutar el chequeo de
  conflictos y reconciliar líneas de ítems — se deja para una iteración
  futura si la falta de edición resulta dolorosa en uso real.
- **Sin confirmación parcial.** "Confirmar recogida" convierte todo el kit
  a la vez en préstamos reales (una fila en `prestamos` por ítem del kit),
  igual que ya funciona "Prestar caja completa" hoy. Si al final no se
  recoge todo, se puede devolver parcialmente después con el flujo de
  devolución ya existente — no hace falta un estado intermedio nuevo.
- **Sin comprobar reservas contra préstamos activos actuales.** El
  chequeo de conflictos solo compara la reserva nueva contra OTRAS
  reservas pendientes (mismo ítem + misma fecha + misma franja exacta),
  nunca contra préstamos ya en curso que aún no se han devuelto — no hay
  forma fiable de saber si esos se habrán devuelto para la fecha futura de
  la reserva. Si el día de la recogida no hay stock real (alguien no ha
  devuelto algo), "Confirmar recogida" falla igual que fallaría un
  préstamo normal hecho a mano ese mismo día — comportamiento ya existente,
  no un caso nuevo a resolver aquí.
- **Sin aprobación de reservas.** Cualquier profesor de su departamento
  (+ el compartido `iesjuanbosco`) puede crear y confirmar sus propias
  reservas, igual que ya puede prestar material hoy — no se añade un paso
  de aprobación por jefatura.

## Decisiones de diseño (por qué)

- **Kit (varios ítems a la vez), no reserva por ítem individual:** encaja
  con cómo ya funciona el resto del proyecto — el alta de ítem exige un
  Ciclo/Asignatura, y `multi-equipo.js` ya tiene el patrón de "lista
  editable de líneas material" para una sesión. Una práctica real casi
  siempre necesita varios aparatos distintos a la vez.
- **Reutilizar la lógica de `prestar`/`prestarCaja`, no reimplementar el
  descuento de stock:** este proyecto ya se ha encontrado 3+ veces con
  bugs por duplicar la misma lógica en sitios distintos (`HEADERS_INV`
  duplicado en `list.js`/`item.js`, scoping de categorías duplicado,
  `buscarSerieEnD1()` extraída a propósito en v549 para evitar una cuarta
  copia) — "Confirmar recogida" debe llamar al mismo bloque de
  inserción+descuento que ya usan `prestar`/`prestarCaja`, extraído a una
  función compartida si hace falta, nunca una tercera copia del mismo
  patrón.
- **Tablas nuevas en vez de extender `prestamos`:** una reserva no es un
  préstamo (no descuenta stock, no tiene fecha de devolución, puede
  cancelarse sin dejar rastro de préstamo). Forzarla dentro de `prestamos`
  con un `estado='reservado'` mezclaría dos conceptos con reglas de
  negocio distintas — más simple y más claro con tablas propias.
- **Bloqueo duro con coincidencia exacta de fecha+franja+ítem:** ya
  validado con el usuario (ver conversación) — es el trade-off elegido
  frente a modelar franjas fijas por departamento.

## Modelo de datos (migración `0027_reservas_practica.sql`)

```sql
CREATE TABLE reservas_practica (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  departamento  TEXT DEFAULT '',
  cicloId       TEXT DEFAULT '',
  moduloCod     TEXT DEFAULT '',
  moduloNombre  TEXT DEFAULT '',
  aulaDestino   TEXT DEFAULT '',
  profesorId    INTEGER DEFAULT 0,
  profesorNombre TEXT DEFAULT '',
  fecha         TEXT DEFAULT '',      -- YYYY-MM-DD
  franja        TEXT DEFAULT '',      -- texto libre, ej "10:00-11:00" / "3ª hora"
  estado        TEXT DEFAULT 'pendiente', -- pendiente | recogida | cancelada
  obs           TEXT DEFAULT '',
  creadoPor     TEXT DEFAULT '',
  creadoEn      TEXT DEFAULT ''
);

CREATE TABLE reserva_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reservaId  INTEGER NOT NULL REFERENCES reservas_practica(id),
  itemId     INTEGER NOT NULL,
  itemNombre TEXT DEFAULT '',
  cantidad   INTEGER DEFAULT 0
);

CREATE INDEX idx_reserva_items_reserva ON reserva_items(reservaId);
CREATE INDEX idx_reservas_fecha ON reservas_practica(departamento, fecha, estado);
```

Mismo patrón de scoping por `departamento` + `GENERIC_DEPT='iesjuanbosco'`
ya usado en el resto del backend (`prestar.js`, `item.js`, `list.js`).

## Flujo de datos

**1. Crear reserva** — nueva acción `reservaCrear` en
`functions/api/prestar.js` (mismo archivo que ya gestiona
préstamo/devolución, mismas helpers `isSuperAdmin`/`ownsItemDept`/
`auditLog` reutilizadas):
- Recibe cabecera (ciclo/módulo, aula, profesor, fecha, franja, obs) +
  array de líneas `[{itemId, cantidad}]`.
- Para cada línea: comprueba propiedad del ítem por departamento (igual
  que `prestar`/`prestarCaja`), y calcula disponibilidad =
  `inventario.qty` − `SUM(cantidad)` de otras filas `reserva_items` unidas
  a `reservas_practica` con `estado='pendiente'`, mismo `itemId`, misma
  `fecha`, misma `franja` (comparación exacta de string). Si la cantidad
  pedida supera lo disponible, aborta TODA la reserva (no crea nada
  parcial) con un error que dice qué ítem y cuánto queda libre.
- Si todas las líneas pasan el chequeo, inserta 1 fila en
  `reservas_practica` + N filas en `reserva_items`, todo en la misma
  request (D1 no tiene transacciones multi-statement reales desde
  Workers, así que si algo falla a mitad, limpia las filas ya insertadas
  antes de devolver el error — mismo cuidado que ya tiene `bulkImport`).
- `auditLog(..., 'reservaCrear', ...)` con resumen legible.

**2. Confirmar recogida** — nueva acción `reservaConfirmar`:
- Recibe `reservaId`.
- Verifica que la reserva exista, esté `pendiente`, y sea del propio
  departamento (o `iesjuanbosco`).
- Por cada línea de `reserva_items`, ejecuta el mismo bloque que
  `prestar`/`prestarCaja` (inserción en `prestamos` con
  `estado='Activo'` + `UPDATE inventario SET qty = qty - cantidad`) —
  extraído a una función compartida `crearPrestamoDesdeLinea()` para no
  triplicar la lógica.
- Marca `reservas_practica.estado='recogida'`.
- Si alguna línea falla por falta real de stock (alguien no devolvió
  algo), las líneas ya procesadas quedan como préstamos reales y se
  informa qué línea falló — el profesor decide si completa manualmente o
  ajusta cantidades desde el préstamo individual ya existente.
- `auditLog(..., 'reservaConfirmar', ...)`.

**3. Cancelar reserva** — nueva acción `reservaCancelar`: marca
`estado='cancelada'` (no borra la fila, para conservar trazabilidad en el
historial). Libera el hueco para el chequeo de conflictos de futuras
reservas (el `WHERE estado='pendiente'` ya la excluye automáticamente).

**4. Listar reservas** — se añade a la carga ya existente de préstamos en
`functions/api/list.js` (mismo scoping por departamento), como un array
nuevo `reservas` con sus líneas anidadas — sin endpoint GET separado,
igual que `prestamos` ya viaja dentro de la carga general.

## UI / Frontend

- **Botón nuevo "📅 Planificar práctica"** en Préstamos, junto a
  "⌛ Nuevo préstamo" / "📦 Prestar caja" (mismo patrón de 3 acciones ya
  usado, ver v521).
- **Modal nuevo**, en archivo propio `js/reservas-practica.js`
  (`prestamos.js` ya tiene 1267 líneas — mismo criterio que llevó a
  `multi-equipo.js`/`revision-aula.js` a ser archivos independientes en
  vez de crecer un archivo ya grande): selector de Ciclo/Asignatura
  (reutiliza `CICLOS` ya cargado), fecha,
  franja (input texto), selector de profesor/a (reutiliza el buscador ya
  existente de `_buildPresItemOptions`-style), selector de aula
  (`renderAulaOptions()` ya existente), y una lista editable de líneas de
  ítem con buscador — mismo patrón de filas añadir/quitar que
  `js/multi-equipo.js`, pero seleccionando ítems existentes por búsqueda
  en vez de detectarlos por foto.
- **Vista de reservas pendientes:** toggle nuevo en Préstamos ("📅 Ver
  reservas"), mismo patrón que el toggle de vencidos ya existente (v495) —
  no una pestaña nueva, para no repetir el problema de exceso de tabs ya
  resuelto en esa sesión. Cada reserva pendiente muestra kit, fecha,
  franja, profesor/a, aula, con botones "Confirmar recogida" y "Cancelar".
- **Backend:** registrar `reservaCrear`/`reservaConfirmar`/
  `reservaCancelar` en `ENDPOINT_MAP` (`js/api.js`) y
  `ACTION_PERMISSIONS` (`js/roles.js`) desde el principio — lección ya
  aprendida y repetida varias veces en este proyecto (v522, v543, v545).

## Errores y casos límite

- Reserva con cantidad pedida > stock disponible ya contando otras
  reservas del mismo hueco → bloqueada al crear, mensaje claro de cuánto
  queda libre.
- Confirmar recogida cuando el stock real ya no alcanza (préstamo activo
  no devuelto a tiempo) → línea a línea, ver flujo 2 arriba.
- Cancelar una reserva ya `recogida` → no permitido (solo se cancela en
  estado `pendiente`); una vez recogida, se gestiona como préstamo normal
  (devolución ya existente).
- Ítem borrado del inventario después de reservarlo pero antes de
  recoger → la línea de `reserva_items` queda huérfana; "Confirmar
  recogida" para esa línea falla con error claro, el resto del kit sigue
  su curso (mismo criterio que el punto anterior).
- `superadmin` sin departamento activo seleccionado → mismas reglas que
  ya aplican a `prestar`/`prestarCaja` hoy (no se cambia ese
  comportamiento en esta pieza).

## Archivos afectados

- Nuevo: `migrations/0027_reservas_practica.sql`.
- Modificar: `functions/api/prestar.js` — 3 acciones nuevas
  (`reservaCrear`/`reservaConfirmar`/`reservaCancelar`) + función
  compartida `crearPrestamoDesdeLinea()` extraída del cuerpo actual de
  `prestar`/`prestarCaja` para reutilizarla sin duplicar.
- Modificar: `functions/api/list.js` — incluye `reservas` (con líneas) en
  la carga general, mismo scoping que `prestamos`.
- Nuevo: `js/reservas-practica.js` — modal de creación + vista de
  reservas pendientes (botón "📅 Ver reservas" inyectado en el DOM de
  Préstamos, mismo patrón que `js/multi-equipo.js` se engancha a la vista
  de aula).
- Modificar: `js/api.js` (`ENDPOINT_MAP`), `js/roles.js`
  (`ACTION_PERMISSIONS`) — las 3 acciones nuevas.
- Modificar: `sw.js` — bump de `VERSION`.

## Testing / verificación

Mismo patrón end-to-end en producción ya usado en el resto del proyecto:
1. Crear una reserva de kit (2-3 ítems distintos) → confirma que aparece
   en "Ver reservas" con los datos correctos.
2. Intentar crear una segunda reserva para el mismo ítem, misma fecha,
   misma franja exacta, con cantidad que supera lo libre → confirma
   bloqueo con mensaje claro.
3. Misma fecha, franja con texto distinto (ej. "10-11h" vs "3ª hora") →
   confirma que NO se bloquea (limitación conocida y aceptada, se
   verifica que se comporta como está documentado, no como un bug).
4. Confirmar recogida de una reserva completa → confirma N filas nuevas
   en `prestamos`, stock descontado igual que un préstamo manual, reserva
   pasa a `recogida`.
5. Cancelar una reserva pendiente → confirma que libera el hueco (una
   reserva nueva para el mismo ítem/fecha/franja ya no choca).
6. Confirmar recogida cuando a una línea le falta stock real → confirma
   que el resto del kit se procesa igual y la línea fallida se informa
   con claridad.
7. Regresión: préstamo individual y "Prestar caja completa" sin pasar por
   una reserva → comportamiento idéntico al actual.
