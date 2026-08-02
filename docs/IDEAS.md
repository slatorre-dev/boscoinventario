# Ideas de Mejoras — Bosco Inventario

Registro de ideas pendientes para futuras sesiones. Las ya implementadas se han eliminado de esta lista.

---

## Gestión de Inventario

### Alertas de Stock Bajo
Banner o notificación más visible cuando hay items por debajo del mínimo.
- Banner en la parte superior del inventario si hay items con stock bajo
- Número de items afectados + link para ver lista filtrada

**Prioridad:** Media

### Filtro por Mantenimiento Pendiente
Botón rápido para ver solo items que necesitan mantenimiento (`mant = '1'`).
- Botón en toolbar junto a filtros de categoría/estado
- Contador de items pendientes

**Prioridad:** Media

### Búsqueda Avanzada
Filtros combinados: "Consumibles en Aula 35 con stock bajo".
- Interfaz de filtros expandible (tipo_material + aula + categoría + estado + stock bajo + mantenimiento)
- Guardar búsquedas frecuentes

**Prioridad:** Baja

### Reporte de Stock por Categoría/Aula
Resumen visual de distribución del inventario.
- Gráficos pie/bar exportables a PDF
- Vista por categoría y por aula

**Prioridad:** Baja

### Notificaciones en Tiempo Real
Si otro usuario actualiza un item mientras lo estás viendo, avisarte.
- Polling cada 30s
- Toast o modal de actualización

**Prioridad:** Baja

### Merge/Consolidar Items Duplicados — parcialmente implementado (30/07/2026)
Detección hecha: filtro "⚠ Duplicados" en el modal de Auditoría
(`js/modal-auditoria.js`, `getDuplicados()`) — mismo nombre normalizado +
misma aula, excluyendo contenedores/hijos SET-/CONT-. Reusa selección
múltiple y edición/borrado en lote ya existentes.
Falta: fusión automática (consolidar cantidad en un solo item y borrar el
resto) — hoy el usuario debe decidir manualmente cuál conservar y editar/
borrar el resto desde la barra de bulk actions.

**Prioridad:** Baja (lo urgente ya cubierto por la detección)

### Control de Acceso por Aula
Profesores solo ven y editan items de su aula.
- Nueva columna en tabla Usuarios: `aula_default`
- Filtrar items por aula en renderizado (excepto admin)

**Prioridad:** Media-Alta

---

## Inventario General del Instituto

### Módulo Multi-Departamento — ✅ implementado (29/07/2026)
Hecho: tabla `departamentos`, columna `departamento` en tablas clave,
scoping backend completo, un ciclo/departamento con sus asignaturas/módulos
por cada uno de los 24 departamentos + 1 genérico. Detalle completo en
[PLAN_MULTIDEPARTAMENTO.md](PLAN_MULTIDEPARTAMENTO.md) y `claude.md`.
Queda pendiente la Fase 3 (frontend): selector de departamento para
`superadmin`, y las ideas de usabilidad de la siguiente sección.

### Multi-departamento — mejoras de usabilidad pendientes

**Preseleccionar Ciclo/Departamento cuando solo hay uno**
La mayoría de departamentos académicos (Matemáticas, Filosofía...) solo
tienen un "ciclo/departamento" propio en la lista filtrada. Si el select
de Ciclo/Departamento en "Nuevo ítem" solo tiene una opción real (aparte
de "Sin asignar"), preseleccionarla automáticamente — ahorra un clic en
la mayoría de altas de ítem.
**Prioridad:** Media

**Agrupar aulas globales vs. propias en el desplegable**
El select de Aula mezcla las 70 aulas globales del centro con la aula
propia del departamento. Usar `<optgroup>` ("Aulas del centro" / "Aula del
departamento") ayuda a distinguirlas de un vistazo.
**Prioridad:** Media

**Forzar cambio de contraseña en el primer login de cuentas genéricas — ✅ implementado (29/07/2026)**
Columna `usuarios.password_temporal` (migración `0014`), marcada en las 48
cuentas `departamentoXXX`/`profe1XXX`. Al hacer login con el flag activo,
el frontend muestra `#pForcePassword` (pantalla obligatoria, sin opción de
saltarla) en vez de cargar el inventario; reutiliza el endpoint existente
`POST /api/perfil action=changePassword`, que además limpia el flag. Si se
cierra la pestaña sin cambiarla, `loadData()` vuelve a mostrar la pantalla
obligatoria en el siguiente acceso (comprobación en el arranque, no solo en
el momento del login).

**Selector de departamento para superadmin con contexto persistente**
Parte de la Fase 3 ya planificada: que al elegir un departamento desde el
selector, quede fijado en `localStorage` (como aula/paginación) para no
tener que re-seleccionarlo en cada sesión.
**Prioridad:** Media

**Estado vacío por departamento**
Todos los departamentos arrancan con 0 ítems. Un estado vacío tipo
"Añade tu primer ítem" con CTA directo (en vez de tabla vacía) ayuda en
el primer uso real de cada jefe/a de departamento.
**Prioridad:** Media-Alta

---

## Inventario por Cámara — "Modo Cámara Inteligente"

Roadmap de 10 sub-ideas propuesto por el usuario (31/07/2026), pensado como
posible diferenciador de Bosco Inventario frente a otros inventarios
comerciales. Implementado con Cloudflare Workers AI (modelo
`@cf/moondream/moondream3.1-9B-A2B`, gratuito, sin API externa de pago) en
vez del enfoque local Roboflow+ONNX que se había considerado antes —
detalle técnico completo en `CLAUDE.md`, sesiones del 01/08/2026 y
01-02/08/2026.

**Roadmap original completo:** #1-#8 implementados y en producción, #9
resultó ya cubierto por código existente sin cambios necesarios, #10
descartada por bajo valor frente a su complejidad. Dos ideas nuevas
surgidas después del cierre (#11 código de barras, #12 onboarding)
también implementadas. Una idea más (#13, unificar botones QR+cámara)
propuesta a última hora, pendiente de diseñar.

### 1. Buscar por número de serie — ✅ implementado (01/08/2026)
Foto de etiqueta → OCR extrae el S/N → busca el ítem (match exacto, fuzzy
por distancia de Levenshtein, o crea uno nuevo si no existe). Botón
"Buscar por Nº de serie" en el Home, junto al de QR. Columna
`inventario.serie` nueva (migración `0026`). Backend: acción `buscarPorSerie`
en `functions/api/item.js`. Spec:
`docs/superpowers/specs/2026-08-01-busqueda-por-numero-serie-design.md`.

### 2. Alta automática de artículos (marca/modelo) — ✅ implementado (01/08/2026)
Ampliación de la idea #1: la misma foto también extrae marca y modelo del
fabricante (una sola llamada a la IA, sin coste extra) y precarga el
nombre del ítem y el proveedor en el modal de alta cuando no se encuentra
el S/N. Spec:
`docs/superpowers/specs/2026-08-01-autocompletado-marca-modelo-design.md`.

### 8. Número de serie como identificador único — ✅ implementado (01/08/2026)
Consecuencia directa de la idea #1: al buscar por S/N con match exacto, se
evita crear un duplicado — se encuentra y abre el ítem ya existente en vez
de darlo de alta otra vez.

### 3. Reconocimiento visual (categoría/nombre sin S/N) — ✅ implementado (01/08/2026)
Fotografiar un objeto sin etiqueta legible y que la IA proponga nombre y
categoría, buscando candidatos en el inventario por nombre/categoría antes
de ofrecer alta. Mismo prompt ampliado que #1 (una sola llamada a IA para
serie/texto libre/visual, sin coste extra). Backend: rama `match:'visual'`
de `buscarPorSerie`. Spec:
`docs/superpowers/specs/2026-08-01-reconocimiento-visual-y-texto-libre-design.md`.

### 4. Buscar cualquier texto con la cámara — ✅ implementado (01/08/2026)
Texto en una etiqueta que no es un número de serie (ej. "Arduino UNO R3")
se envía al buscador global existente (`js/search.js`) en vez de asumir
que es siempre un S/N. Misma rama de `buscarPorSerie` que #3 (`match:'texto'`).
Spec: `docs/superpowers/specs/2026-08-01-reconocimiento-visual-y-texto-libre-design.md`.

### 5. Inventario andando (revisión rápida por aula) — ✅ implementado (02/08/2026)
Botón "📷 Revisar aula" dentro de la vista de una aula concreta — recorre
el aula foto a foto, confirma en verde si el ítem detectado está en el
aula correcta, avisa en ámbar con corrección de un clic si está en otra.
Resumen final (confirmados vs. no verificados) efímero, sin persistir en
D1. Reutiliza `buscarPorSerie` sin cambios de backend. Spec:
`docs/superpowers/specs/2026-08-01-inventario-andando-design.md`.

### 6. Añadir múltiples equipos de una foto — ✅ implementado (02/08/2026)
Botón "📸 Añadir varios" dentro de la vista de una aula concreta —
fotografía una mesa con varios equipos nuevos, la IA propone una lista
editable (nombre/cantidad/categoría por fila) antes de confirmar. Backend
nuevo `detectarMultiples`; la creación reutiliza `bulkImport` ya existente
(usado por importación CSV) sin modificarlo. Spec:
`docs/superpowers/specs/2026-08-01-multi-equipo-foto-design.md`.

### 7. Buscar manuales/datasheets del equipo detectado — ✅ implementado (02/08/2026)
3 enlaces (Manual/Datasheet/Vídeo) junto al campo Proveedor del modal de
ítem, visibles si Proveedor+Nombre tienen contenido — abren una búsqueda
de Google ya formada (`proveedor + nombre + "manual pdf"`, etc.), sin API
de pago ni base de enlaces curados (decisión que simplificó radicalmente
la estimación original del roadmap). Spec:
`docs/superpowers/specs/2026-08-02-enlaces-manual-datasheet-design.md`.

### 11. Lectura de código de barras (mejora de #1) — ✅ implementado (02/08/2026)
Idea nueva, no numerada en el roadmap original de 10, propuesta por el
usuario tras cerrar #1-#10. Antes de enviar la foto a la IA, intenta
decodificar un código de barras lineal (Code128/EAN/UPC) con la API
nativa `BarcodeDetector` del navegador — si decodifica un valor, lo busca
directo en D1 sin pasar por IA (más rápido, sin margen de error de OCR).
Sin soporte del navegador, cae automáticamente al flujo IA existente sin
cambio de comportamiento. Requirió extraer `buscarSerieEnD1()` como
función compartida entre el flujo IA (`buscarPorSerie`) y el nuevo
(`buscarSeriePorCodigo`), decisión explícita para no repetir el patrón de
bug de lógica duplicada ya visto 3 veces en este proyecto. Spec:
`docs/superpowers/specs/2026-08-02-lectura-codigo-barras-design.md`.

### 12. Onboarding de las funciones de cámara — ✅ implementado (02/08/2026)
No es una función nueva — hace descubribles las 8+ funciones anteriores,
que se construyeron sin ningún tipo de introducción para el profesorado.
Tour guiado de 4 pantallas (#1, #6, #5, #3) tras el primer login de cada
navegador (`localStorage`, sin D1), más botón "❓" permanente en Home con
ayuda completa de las 8+ funciones. El tour/ayuda respetan el rol del
usuario — el rol `Consulta` (solo lectura) no ve las 2 funciones de
solo-escritura (#5/#6) que nunca podría usar. Spec:
`docs/superpowers/specs/2026-08-02-onboarding-camara-design.md`.

### 13. Unificar botones de QR y búsqueda por cámara — pendiente, sin diseñar
Propuesta del usuario (02/08/2026): un solo botón "Buscar con cámara (QR
o S/N)" en vez de los dos actuales (`#gsQr` para QR propio de la app,
`#gsSerie` para serie/texto/visual/código de barras) — la cámara decide
internamente qué tipo de código está viendo. Complejidad principal:
`js/qr-scanner.js` usa escaneo continuo (frames en bucle) mientras que
`js/camara-serie.js` usa foto fija con botón "Capturar" — son dos
patrones de UX distintos a conciliar. Sin brainstorming ni spec todavía
— ver detalle completo en `CLAUDE.md`, sección "Pendiente prioritario de
esta sesión".

**Prioridad:** Alta (primer punto a retomar en la próxima sesión)

### 9. Generar QR automáticamente tras el alta — ✅ ya cubierto (sin cambios, 02/08/2026)
El modal de ítem ya llama a `renderItemQr()` (`js/modal-item.js`) al
abrirse, tanto en alta como en edición — cualquier ítem creado por
cualquier flujo de cámara (#1/#2/#3/#6) ya tiene su QR generado y visible
ahí mismo, sin pasos extra ni ir aparte al QR scanner. El hueco que esta
idea buscaba cerrar no existía realmente; descartada sin implementación.

### 10. Modo "Inspector" (cámara en vivo, verde/rojo/amarillo) — descartada (02/08/2026)
Cámara en bucle con detección continua, aportaba poco frente a su coste
de implementación (presupuesto de llamadas IA por segundo, latencia) una
vez ya cubierto el caso de uso principal (auditar un aula) por la idea #5
(inventario andando, foto a foto). Descartada, no se retoma salvo que
surja una necesidad real que #5 no cubra.

---

## UX y Usabilidad

### Búsqueda con Historial de Términos Recientes — ✅ implementado (29/07/2026)
Últimas 5 búsquedas del campo de filtro del inventario (`#srch`) guardadas en
`localStorage` (`inv_recent_searches`), mostradas vía `<datalist>` nativo al
enfocar el campo — sin dropdown propio que mantener.

### Aulas Ordenadas por Uso Reciente
Contador de visitas en localStorage, las aulas más usadas aparecen primero en home.

**Prioridad:** Media

### Paginación Persistente entre Sesiones
Guardar `_pageSize` en localStorage para que el usuario no tenga que reconfigurar al volver.

**Prioridad:** Baja

### Modo Oscuro
Variables CSS ya preparadas, solo falta toggle en perfil de usuario.

**Prioridad:** Media

### Swipe en Cards Tablet
El swipe para prestar/ver ya funciona en móvil. Falta adaptar para tablet (pointer:coarse + min-width:640px).

**Prioridad:** Media

### QR Directo en Card
Ver QR del ítem sin necesidad de abrir el modal de edición.

**Prioridad:** Baja

### Historial de Cambios en Modal Edición
Ver el log de cambios de un ítem directamente desde el modal de edición.

**Prioridad:** Media

---

## Volt — Agente IA

### Sugerencias Contextuales
Tras una acción, Volt sugiere la siguiente lógica: "¿prestar otro al mismo profesor?", "¿ver el historial de este ítem?".

**Prioridad:** Media

### Comando Resumen Global de Préstamos
"¿Qué está prestado ahora?" — resumen de todos los préstamos activos sin filtrar por ítem.

**Prioridad:** Media

### Edición Inline en Resultados de Volt
Botón ✏️ por fila en tablas de resultados para editar sin salir del chat.

**Prioridad:** Baja

---

## Performance

### Índices en Tabla Inventario (D1) — ✅ implementado (30/07/2026)
`migrations/0020_indices_inventario.sql`. La tabla real es `inventario`
(no `items`), y casi toda query ya filtra por `departamento` primero (ver
scoping backend), así que se usaron compuestos en vez de índices simples:
`departamento` solo, `(departamento, aula)`, `(departamento, ref)`,
`(departamento, cat)`, y `parent_id` (para contenedores). No se indexó
`item`/`tags` — la búsqueda usa `LIKE '%x%'`, que no aprovecha índice B-tree.

### Lazy Loading de Imágenes
`loading="lazy"` en `<img>` del listado; cargar fotos de modal solo al abrir.

**Prioridad:** Media

### Compresión de Imágenes Automática
Reducir a máx 1000x1000px y comprimir JPEG al 80% al subir. Thumbnail 200x200px.

**Prioridad:** Media

### Web Workers para Operaciones Pesadas
Filtrado de muchos items, exportación CSV, procesamiento de búsqueda en thread separado.

**Prioridad:** Baja

---

## Seguridad (FASE 1) — Pendiente crítico

- Bearer tokens en lugar de `?u=&p=` en query params (visible en logs)
- Password hashing (bcrypt)
- Rate-limiting en endpoints críticos
- Branch propuesta: `feature/security-refactor`

**Prioridad:** Alta — bloquea despliegue a más usuarios

---

## Auditoría de Datos — Mejoras UX pendientes

### Indicador Visual de Progreso
"5/243 items completados" o barra de progreso durante auditoría en lote.

**Prioridad:** Media

### Vista Estadística Inicial
Panel de resumen antes de entrar al trabajo: "969 items con problemas: 250 sin módulo, 180 sin aula..."

**Prioridad:** Alta

### Filtros AND/OR en Auditoría
Pasar de filtros exclusivos a lógica combinada: "Sin módulo Y sin aula".

**Prioridad:** Media

### Exportar Reporte de Auditoría
CSV o PDF con items problemáticos agrupados por aula/categoría.

**Prioridad:** Baja

---

## Estado

- **Última actualización:** 02/08/2026
- **Versión actual:** v550
- **Roadmap "Modo Cámara Inteligente":** completo — ideas #1-#8 implementadas
  y en producción, #9 resultó ya cubierta por código existente (sin
  cambios necesarios), #10 descartada por bajo valor frente a su
  complejidad. Dos ideas nuevas surgidas después (#11 código de barras,
  #12 onboarding) también implementadas. Pendiente sin diseñar: #13
  (unificar botones QR + búsqueda por cámara). Detalle completo de las
  sesiones en `CLAUDE.md`.
