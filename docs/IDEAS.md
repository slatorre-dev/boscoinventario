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

## Inventario por Cámara

### Reconocimiento de Equipos con Modelo Local (Roboflow + ONNX)
Pasar la cámara del móvil por el taller para generar/actualizar el inventario automáticamente, sin API externa ni coste por uso.

**Enfoque técnico:**
- Modelo de detección basado en dataset público de **Roboflow Universe** (equipos de laboratorio electrónica: multímetros, osciloscopios, fuentes de alimentación...)
- Fine-tuning con fotos de los equipos específicos del taller (~20-30 fotos por tipo)
- Exportar como **ONNX** e integrar con `onnxruntime-web` — inferencia 100% local en el navegador
- **OCR complementario** con Tesseract.js para leer etiquetas (número de serie, modelo)
- Flujo: cámara detecta equipo → rellena campos del formulario → usuario confirma → guarda en D1

**Por qué sin API externa:**
- Sin coste por inferencia (todo local en el navegador)
- Sin dependencia de terceros para uso masivo en el instituto

**Pasos de implementación:**
1. Buscar dataset en Roboflow Universe ("electronics lab", "multimeter", "oscilloscope")
2. Añadir fotos propias de cada equipo del taller para fine-tune
3. Entrenar y exportar modelo ONNX
4. Nuevo módulo "Inventario por cámara" en la app (separado de Volt)
5. Integrar OCR para números de serie

**Prioridad:** Media-Alta

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

- **Última actualización:** 30/07/2026
- **Versión actual:** v501
