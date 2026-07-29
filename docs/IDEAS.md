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

### Merge/Consolidar Items Duplicados
Detectar y fusionar items iguales accidentalmente creados.
- Detectar por nombre similar o misma referencia
- Interfaz para seleccionar y fusionar, consolidando cantidad

**Prioridad:** Media

### Control de Acceso por Aula
Profesores solo ven y editan items de su aula.
- Nueva columna en tabla Usuarios: `aula_default`
- Filtrar items por aula en renderizado (excepto admin)

**Prioridad:** Media-Alta

---

## Inventario General del Instituto

### Módulo Multi-Departamento
Actualmente la app gestiona el inventario de un solo departamento (Electricidad/FP). La idea es extenderla para que el **instituto completo** pueda inventariar todos sus departamentos desde una misma instancia.

**Casos de uso:**
- Jefatura de estudios ve el inventario global de todos los departamentos
- Cada jefe de departamento gestiona solo el suyo
- Inventario compartido (sala de actos, biblioteca, aulas comunes)
- Coordinación de recursos entre departamentos ("¿alguien tiene un proyector libre?")

**Enfoque técnico:**
- Nueva columna `departamento_id` en tabla `items`
- Nueva tabla `departamentos` (id, nombre, color, responsable_id)
- Roles extendidos: `superadmin_instituto` > `admin_departamento` > `jefe` > `profesor` > `alumno`
- Filtro global por departamento en la UI (selector en navbar o home)
- Cada departamento tiene su propia vista pero comparten la misma base D1
- Opción: instancias D1 separadas por departamento (más aislamiento, más coste)

**Ventajas del enfoque single-D1:**
- Sin coste adicional de infraestructura
- Búsquedas cruzadas entre departamentos
- Un solo deploy de Cloudflare Pages

**Pasos de implementación:**
1. Migración D1: añadir tabla `departamentos` + columna `departamento_id` en `items` y `usuarios`
2. Backend: filtrar todos los endpoints por `departamento_id` del usuario autenticado
3. Frontend: selector de departamento en home/navbar para superadmin
4. Panel de superadmin con stats globales del instituto
5. Importación masiva por departamento (CSV/Excel)

**Prioridad:** Alta — alto impacto institucional

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

### Búsqueda con Historial de Términos Recientes
Últimas 5 búsquedas en localStorage, mostrar al hacer foco en el campo de búsqueda.

**Prioridad:** Media

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

### Índices en Tabla Items (D1)
```sql
CREATE INDEX idx_items_ref ON items(ref);
CREATE INDEX idx_items_name ON items(item);
CREATE INDEX idx_items_tags ON items(tags);
CREATE INDEX idx_items_aula ON items(aula);
```
**Prioridad:** Alta — urgente si el inventario crece

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

- **Última actualización:** 26/05/2026
- **Versión actual:** v415
