# Ideas de Mejoras — Bosco Inventario

Registro de ideas pendientes para futuras sesiones. Las ya implementadas se han eliminado de esta lista.

---

## Gestión de Inventario

### Alertas de Stock Bajo — ✅ ya implementado (detectado 27/08/2026)
Resultó ya estar hecho, de forma equivalente al pedido original aunque no
como "banner": tarjeta clicable "⚠️ STOCK BAJO" con contador en Inicio
(lleva a `goLowStock()`, vista filtrada dedicada), aviso por aula en las
tarjetas de Inicio (`js/home.js`), stat compacto clicable en la toolbar
del inventario (`js/inventory.js`) y Volt entiende "¿stock bajo?" por voz
o texto. Esta entrada llevaba desactualizada en el roadmap.

### Filtro por Mantenimiento Pendiente — ✅ ya implementado (detectado 27/08/2026)
Resultó ya estar hecho: botón grande "🛠️ Mantenimiento — Revisiones
pendientes" en Inicio (`goMaintenance()`), lleva a una vista filtrada
dedicada con contador propio (tarjeta "Mantenimiento" en el resumen de
Inicio). Esta entrada llevaba desactualizada en el roadmap.

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
Fase 3 (frontend) también completada: selector de departamento activo para
`superadmin` en gestión de aulas/categorías/ciclos (ver `claude.md`, v532).

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

**Jerarquía/zona en la rejilla de aulas de Inicio para superadmin**
(25/08/2026) Mismo problema que el punto anterior pero en la vista "Por
aula/espacio" de Inicio: para cualquier departamento normal son solo 4-5
aulas (sin problema), pero la vista de superadmin llega a ~70 tarjetas
idénticas (las aulas globales del centro, todas en el mismo cubo
`iesjuanbosco`, sin campo que las distinga entre sí). Agrupar por
`departamento` no ayuda aquí — casi todas comparten el mismo departamento
genérico. Haría falta un campo nuevo opcional en `aulas` (zona/planta/
edificio) usado solo para agrupar esta rejilla cuando superadmin no tiene
un departamento activo elegido — cero impacto en la vista de cualquier
departamento normal. Sin diseñar en detalle, el usuario decidió aparcarlo
por ahora.
**Prioridad:** Baja

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
surgidas después del cierre (#11 código de barras, #12 onboarding, #13
unificación QR+cámara) también implementadas.

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
`docs/superpowers/specs/2026-08-01-enlaces-manual-datasheet-design.md`.

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

### 13. Unificar botones de QR y búsqueda por cámara — ✅ implementado (02/08/2026)
Un solo botón "🎥 Buscar con cámara (QR o S/N)" (`#gsCamara`,
`js/camara-unificada.js`) sustituye a los dos anteriores. Escaneo continuo
único con `BarcodeDetector` nativo (`qr_code` + formatos lineales), con
`jsQR` como fallback condicional solo si el navegador no soporta `qr_code`
nativamente. QR reusa el panel de acciones ya existente
(`_showQrActionsStandalone()` en `js/qr-scanner.js`); código de barras/S/N
reusa `buscarSeriePorCodigo`; sin detección tras ~3s, botón manual entrega
al flujo de IA existente (`js/camara-serie.js`) sin cambios. `#gsQr` y
`#gsSerie` se mantienen ocultos en el DOM como red de seguridad
reactivable sin deploy. Spec:
`docs/superpowers/specs/2026-08-02-unificar-camara-qr-serie-design.md`.

### 15. Crear ítem desde la búsqueda sin resultados — ✅ implementado (02/08/2026)
Pedido directo del usuario: buscar "cacharro" y no encontrarlo debía ofrecer
crearlo con ese nombre ya precargado, en vez de solo mostrar "sin
resultados". Implementado en los dos campos de búsqueda de la app:
- **Buscador global de Home** (`#gsInput`, `js/search.js`): botón
  "➕ Crear ítem nuevo: «query»" en el estado sin resultados →
  `gsCrearItemDesdeQuery(q)` → `openModal(null, {item:q})`.
- **Filtro dentro de una aula/categoría ya abierta** (`#srch`,
  `js/inventory.js`): mismo patrón, `invCrearItemDesdeBusqueda()`, con el
  añadido de precargar también la categoría cuando la vista actual es de
  categoría (`cf.type==='cat'` → `prefill.cat=cf.id`) — el aula **no** hizo
  falta pasarla explícita porque `openModal()` ya la deducía sola de
  `cf.type==='aula'` cuando no se pasa `aula` en el objeto precargado
  (comportamiento preexistente, reutilizado tal cual).
Ambos botones solo se muestran con permiso `items.write` (`can()`), aunque
`openModal()` ya bloquea la apertura igualmente si se accede sin permiso —
doble red de seguridad. Fix de acompañamiento en `js/modal-item.js`
(`openModal`): el título del modal decía "📋 Duplicar ítem" para *cualquier*
`src` no vacío (mecanismo ya existente, reusado por `duplicateItem()`) —
ahora solo lo dice si `src.id` existe, para no confundir a quien crea un
ítem nuevo desde una búsqueda con quien está duplicando uno ya existente.

### 14. Mejora de calidad de reconocimiento visual (sin S/N) — ✅ implementado (02/08/2026)
Motivado por feedback directo del usuario: "el reconocimiento es regular
actualmente". Tres mejoras en `buscarPorSerie` (`functions/api/item.js`) +
`js/camara-serie.js`, sin infraestructura nueva:
1. **Autoevaluación de encuadre**: el mismo prompt combinado ya existente
   gana dos claves más, `"encuadreOk"`/`"motivoEncuadre"` — si la IA
   considera que la foto dificulta identificar el objeto (lejos, varios
   objetos superpuestos, borrosa), devuelve una instrucción corta y
   accionable ("Acércate más", "Encuadra solo una pieza") que se muestra
   como aviso en los resultados débiles. Se descartó explícitamente usar un
   modelo de detección de objetos aparte (`@cf/facebook/detr-resnet-50`,
   solo reconoce las 80 clases de COCO, inútil para herramientas de taller)
   y el modo `detect` de Moondream (exige indicar de antemano qué buscar —
   problema de huevo y gallina cuando el objetivo es precisamente identificar
   qué es). Reusar el prompt ya verificado evita el riesgo de esquema
   desconocido que ya causó horas de depuración en v543.
2. **Tercera pasada dedicada a identificación de objeto**: cuando ni
   serie/texto ni descripción visual ni categoría salen de las dos pasadas
   existentes (caso: objeto sin ninguna etiqueta legible, antes terminaba en
   `match:'sin_lectura'` sin ninguna alternativa), una pasada nueva enfocada
   solo en "qué objeto es esto" (mismo patrón que la pasada OCR-only ya
   existente para el caso simétrico).
3. **Botón "📷 Probar otro ángulo"** en los resultados débiles (visual sin
   candidatos, o sin ninguna lectura) — reabre la cámara conservando el
   nombre/categoría sugeridos del primer intento (`_serieIntentoPrevio` en
   `js/camara-serie.js`), y los fusiona con el segundo intento si este
   también sale débil, en vez de perder esa información al reintentar desde
   cero.

Sin cambios de esquema D1, sin acción nueva registrada en `js/api.js`/
`js/roles.js` (solo se amplía la respuesta ya existente de `buscarPorSerie`).
Idea #15 (similitud visual contra fotos ya guardadas del propio inventario,
vía Vectorize) se evaluó en la misma sesión pero se dejó pendiente
explícitamente — necesita un binding nuevo (mismo tipo de paso manual en el
dashboard de Cloudflare que ya hizo falta para `AI`) y un backfill con coste
de IA sobre las fotos ya existentes en `item_fotos`; decisión del usuario:
no acometerla sin evaluar antes el coste/alcance del backfill.

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

### Completar acciones del panel post-escaneo (revisión externa, 24/08/2026)
El panel de acciones tras leer un QR (`js/qr-scanner.js`, `_showQrActions()`)
ya ofrece abrir ficha, prestar/devolver, mantenimiento, documentos y
borrar. Faltan dos acciones de un solo toque que hoy obligan a entrar en
la ficha completa: **mover de aula** y **marcar como averiado** directo
(sin pasar por el formulario de mantenimiento completo). Encaja como
extensión de `qrQuickAction()`, reusando los modales ya existentes.

**Prioridad:** Media

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
✅ Implementado (29/07/2026): `_pageSize` se guarda en `localStorage`
(`inv_page_size`) y se restaura automáticamente al volver.

**Prioridad:** Cerrado

### Modo Oscuro — ✅ implementado (25/08/2026, v606)
Toggle manual en la topbar (no en perfil), variables CSS de `:root`
redefinidas bajo `body.dark`, persistente en `localStorage`. Detalle en
`docs/DEVELOPMENT.md`, entrada 25/08/2026.

**Prioridad:** Cerrado

### Swipe en Cards Tablet
El swipe para prestar/ver ya funciona en móvil. Falta adaptar para tablet (pointer:coarse + min-width:640px).

**Prioridad:** Media

### QR Directo en Card
Ver QR del ítem sin necesidad de abrir el modal de edición.

**Prioridad:** Baja

### Historial de Cambios en Modal Edición — ✅ ya implementado (detectado 27/08/2026)
Resultó ya estar hecho: botón "📋 Historial" (`#btnHistorial`, visible para
cualquier ítem existente) dentro del modal de edición abre `openHistorial()`
(`js/modal-item.js`), que consulta `GET /api/historial?itemId=` — endpoint
que ya permite ver el log de un ítem concreto a cualquier usuario de su
departamento, no solo a jefatura/superadmin (a diferencia del historial
completo). Esta entrada quedaba desactualizada en el roadmap.

### Panel "Hoy requiere atención" — 🟡 parcialmente implementado (v641-v642)
De un brainstorming sin cerrar del 31/07/2026. Implementado como modal
"🔔 Requiere tu atención" (`checkAtencionHoy()` en `js/home.js`, solo
jefe/a departamento y superadmin): agrupa Pedidos/Solicitudes,
Mantenimiento, Préstamos vencidos y Accesos bloqueados/contraseña
temporal, con desglose por departamento para superadmin. Se abre sola una
vez por sesión de navegador al terminar de cargar datos.
Falta del pedido original: **Stock bajo** (hoy solo visible como tarjeta
aparte en Inicio) y **datos faltantes** (auditoría) no están en este
panel — añadirlos como chips más si se retoma.
**Prioridad:** Baja (lo grueso ya cubierto)

### Menú de acciones compacto con texto
Del mismo brainstorming del 31/07/2026, sin implementar. El menú de
acciones por fila (`toggleActionMenu()`, `js/inventory.js`) usa solo
iconos — un menú con icono+texto sería más descubrible para quien no ha
memorizado qué hace cada símbolo.
**Prioridad:** Baja

### Vistas de filtro guardadas ("Mis vistas")
Del mismo brainstorming del 31/07/2026, sin implementar. Guardar una
combinación de filtros del inventario (categoría + estado + tipo +
búsqueda) con un nombre, para volver a aplicarla en un clic — hoy los
filtros de `js/inventory.js` no persisten entre sesiones salvo el término
de búsqueda reciente (`#srch`, ya implementado arriba).
**Prioridad:** Baja

### Acciones en lote con preview/undo — parcialmente cubierto
Del mismo brainstorming del 31/07/2026. Hoy solo el borrado en lote tiene
protección (`_bulkDelDialog()` en `js/inventory.js`): confirmación +
cuenta atrás de 5s cancelable antes de ejecutar — pero es un retraso
previo a la acción, no una vista previa de los cambios ni un undo real
tras ejecutarla, y no cubre el resto de acciones en lote (editar
aula/categoría/tags en varios ítems a la vez, que se aplican sin ningún
paso intermedio). Falta: previsualizar el diff antes de confirmar en
ediciones en lote, y/o una ventana corta de deshacer tras cualquier acción
en lote, no solo el borrado.
**Prioridad:** Baja

### Modal de ítem reorganizado por secciones
Del mismo brainstorming del 31/07/2026, sin implementar. `modal-item.js`
sigue siendo un formulario largo sin agrupación visual (fieldsets/
secciones colapsables tipo "Identificación", "Ubicación", "Mantenimiento",
"Detalles") — a día de hoy no hay ningún separador de sección en el modal.
**Prioridad:** Media (el modal ha crecido mucho de campos desde 31/07/2026)

### Etiquetas de estado explícitas
Del mismo brainstorming del 31/07/2026, sin implementar. Estados como
"stock bajo", "en mantenimiento", "oculto" se comunican hoy por color/icono
en la tarjeta, pero no siempre con una etiqueta de texto explícita — relevante
para accesibilidad (ver ítem siguiente) y para quien no reconoce el código
de colores de un vistazo.
**Prioridad:** Baja

### Microcopy en vacíos/errores
Del mismo brainstorming del 31/07/2026, sin implementar. Revisar mensajes
de "sin resultados"/errores de red genéricos en toasts (`toast()`) y
vistas vacías, para que guíen a la acción siguiente en vez de solo
describir el problema.
**Prioridad:** Baja

### Accesibilidad
Del mismo brainstorming del 31/07/2026, sin implementar ni auditado.
Sin pasada de accesibilidad (contraste, `aria-label` en botones solo-icono,
navegación por teclado en modales) en ningún punto del proyecto hasta la
fecha.
**Prioridad:** Baja (sin urgencia detectada, pero nunca evaluado)

### Colores hardcodeados en `css/styles.css` fuera de los tokens del tema
(28/08/2026) Surgió como paso 2 de una revisión de diseño ("piensa como
diseñador gráfico web") tras arreglar que Volt no heredaba el tema
(v649). Un grep de `#[0-9a-f]{3,6}` fuera de `:root`/`body.dark` en
`css/styles.css` encontró **~150 ocurrencias**, muchas más de lo que
parecía a simple vista con el caso que las disparó
(`.home-hero h2{color:#243b53}`). Al mirarlo con más detalle el
diagnóstico cambia respecto a lo que se pensó primero: la mayoría **no
son fugas del sistema de tokens**, son pares fondo+texto autocontenidos
(badges de rol, chips de historial, los 10 colores pastel de "Acciones
rápidas" de Inicio, cabeceras de ciclo/categoría con degradado fijo,
estilos de impresión) — un chip claro con texto oscuro sigue siendo
legible da igual el tema de la app alrededor. Incluso `.home-hero h2` en
concreto resultó ser consistente: vive dentro de `.home-hero`, que
también tiene un fondo degradado claro **fijo** (no depende de
`var(--bg)`), así que el texto oscuro es coherente con su propia
tarjeta, no una fuga real.

**Lo que falta para cerrar esto de verdad:** separar los casos que sí son
bugs (texto/color apoyado directamente en `var(--bg)`/`var(--white)` de
la página, que si no se ve bien en oscuro) de los que son decoración
intencional — y eso requiere verlos con datos reales en modo oscuro
(Inicio, tarjetas de aula, modales), no solo grep. Necesita el stack
completo corriendo (`wrangler pages dev` + D1 local), no basta con
servir el HTML estático como se hizo para verificar Volt. Aparcado a
petición del usuario (era mucho más grande de lo estimado al proponerlo).
**Prioridad:** Baja (nada confirmado roto todavía, solo una sospecha sin
verificar)

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

- Bearer tokens en lugar de `?u=&p=` en query params (visible en logs) —
  único punto real de esta lista que sigue sin empezar
- ~~Password hashing~~ ✅ resuelto (25/08/2026): PBKDF2 vía `crypto.subtle`,
  ver `docs/SECURITY.md` ítem 3
- ~~Rate-limiting en endpoints críticos~~ ✅ resuelto, con diseño distinto
  al de "rate-limiting" clásico (25-26/08/2026): bloqueo de cuenta tras 5
  intentos fallidos (`migrations/0031_intentos_login.sql`), persistente
  hasta desbloqueo por superadmin — ver `docs/SECURITY.md` ítem 6
- Branch propuesta: `feature/security-refactor`

**Prioridad:** Alta — el punto que queda (Bearer tokens) sigue bloqueando
igual que antes; los otros dos ya no aplican como bloqueante.

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

### Niveles de Severidad
De un brainstorming sin cerrar del 31/07/2026, sin implementar. Hoy
`modal-auditoria.js` trata todos los campos faltantes por igual — separar
por severidad (ej. "sin aula" bloquea más que "sin proveedor") ayudaría a
priorizar qué corregir primero en departamentos con muchos ítems
pendientes de auditar.

**Prioridad:** Baja

### Exportar Reporte de Auditoría
CSV o PDF con items problemáticos agrupados por aula/categoría.

**Prioridad:** Baja

---

## Mantenimiento

### Mantenimiento como orden de trabajo (revisión externa, 24/08/2026)
La tabla `mantenimientos` (migración `0028`, v592) ya cubre estado,
responsable, coste y fechas de apertura/cierre — es una base real, no
hay que reconstruirla. Evolución razonable, sin necesidad de imitar
GLPI/MaintainX enteros:
- Prioridad (baja/media/alta).
- Fecha prevista de resolución.
- Fotos antes/después (reusando `item_fotos` o una tabla dedicada).
- Próxima revisión (mantenimiento preventivo, no solo correctivo).

**Prioridad:** Media

---

## Modelo de datos

### Ubicaciones jerárquicas y movimientos de stock (revisión externa, 24/08/2026)
Ideas sugeridas: ubicaciones con más niveles (centro/edificio/planta/aula/
armario/balda), tabla `movimientos_stock` para trazar entradas/salidas de
consumibles, y campos configurables por categoría. Son mejoras de fondo
razonables, pero acercan el proyecto a un ERP — justo lo que el propio
análisis que las propuso advertía evitar. Solo abordar si aparece una
necesidad real (p. ej. un departamento con almacenes/armarios propios que
hoy no se puede representar), no de forma especulativa.

**Prioridad:** Baja

---

## Estado

- **Última actualización:** 28/08/2026
- **Versión actual:** v649
- **Roadmap "Modo Cámara Inteligente":** completo — ideas #1-#8 implementadas
  y en producción, #9 resultó ya cubierta por código existente (sin
  cambios necesarios), #10 descartada por bajo valor frente a su
  complejidad. Tres ideas nuevas surgidas después del cierre original
  (#11 código de barras, #12 onboarding, #13 unificación de botones QR+S/N)
  también implementadas. Sin pendientes abiertos del roadmap de cámara.
  Detalle completo de las sesiones en `CLAUDE.md`.