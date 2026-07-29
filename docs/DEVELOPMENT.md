# Desarrollo — Bosco Inventario

Registro de desarrollo y mejoras implementadas en la aplicación.

## Sesiones de trabajo

### Sesión 27/05/2026 — Inventario agrupado por tags + normalización D1 (v424→v435)

#### Topbar y despliegue
- **v424-v425** Botón `Instalar` del topbar en modo icono para escritorio/PC (ahorro de espacio)
- **v426-v435** Incrementos sucesivos de `sw.js` para cache-bust en cada publicación

#### Inventario: agrupación visual para reducir ruido
- **v426** Vista agrupada al abrir inventario (sin búsqueda):
  - Consumibles agrupados por categoría
  - Grupos colapsados por defecto
  - Inventariables en bloque separado
- **v427-v428** Refinado visual de tarjetas de grupo y densidad para escritorio
- **v429** Subagrupación por tags dentro de cada categoría consumible (grupos plegables)
- **v430** Normalización de tags en agrupación visual:
  - Insensible a mayúsculas/minúsculas
  - Insensible a tildes
  - Singular/plural básico
- **v431-v432** Ajustes de ergonomía:
  - Eliminado botón “ver más” en subgrupos
  - Tarjetas de tags menos compactas
  - Fijado a 6 tags por fila en PC
- **v433** Inventariables también subagrupados por tags

#### Normalización avanzada de tags por familia
- **v434** Agrupación por familia raíz de tag para casos como:
  - `ruedas`, `ruedas goma`, `ruedas coche` → `ruedas`
  - Manteniendo deduplicación y visual homogénea

#### Persistencia en D1 (limpieza histórica real)
- **v435** Nueva acción backend para normalizar tags guardados en D1 (no solo vista):
  - Endpoint/action: `normalizeTagsCanonical` en `functions/api/config.js`
  - Mapeada en `js/api.js`
  - Protegida por permisos en `js/roles.js`
  - Lanzable desde UI en modal de categorías (`index.html` + `js/modal-cats.js`)
- Resultado:
  - Limpieza histórica item por item en D1
  - Unificación de variantes repetidas
  - Recarga automática de items/tags en cliente tras ejecutar

### Sesión 27/05/2026 — Historial visual + limpieza topbar (v417→v423)

#### Página de historial visual
- **v420** Nueva página `pHistorialPage` — timeline agrupado por día con avatares de color (verde=añadido, azul=editado, rojo=eliminado, amarillo=préstamo, gris=devolución, morado=sistema), frase natural "Juan editó **Multímetro #3**", hora a la derecha
- **v420** Botón "📋 Historial" en panel de acciones rápidas de la home (solo admin/superadmin/seba)
- **v421** Click en fila del historial con itemId: navega directamente al modal del ítem via `openItemRoute()`. Hover muestra fondo azul y flecha `→`. Préstamos/devoluciones/importaciones no son clicables.
- **v417-v419** Feed de actividad en home (chips de pulso) — descartado por estética, reemplazado por la página de historial

#### Limpieza topbar
- **v422** `conn-status`: eliminado texto "Sincronizado/Conectando", queda solo el punto de color. El texto pasa a `title` (tooltip al hover). Botón QR del topbar eliminado (duplicado del QR en buscador)
- **v423** Botón recargar 🔄 eliminado — F5 cumple la misma función

---

### Sesión 25/05/2026 — Usabilidad tablet/móvil + Volt NLP (v379→v390)

#### Fixes tablet/móvil
- **v380** `getInvRenderMode()`: en tablet con `view='list'` devolvía siempre 'cards' — corregido
- **v381** CSS: `.tw{display:none!important}` en `@media(pointer:coarse)` ocultaba la tabla en tablets — override con `min-width:640px`
- **v382** Toast préstamos vencidos: 2.5s (antes 5s), 11px, opacity 0.82
- **v383-v384** Icono logout: `⏻` (U+23FB, sin soporte Android) → SVG inline flecha salida; 20px en táctil
- **v386** `loan-banner` oculto en móvil/tablet táctil — el toast ya avisa al inicio

#### Mejoras inventario
- **v385** Botón Imprimir del topbar llamaba a `openPrintModal()` → ahora `openPrintChoiceModal()` (normal + QR)
- **v387** `saveItem()`: al editar ítem llama `renderInv()` en vez de `openSub()` — filtros y página del inventario se mantienen tras guardar

#### Mejoras Volt (v388-v390)
- `SINONIMOS`: tabla 17 entradas (multímetro↔polímetro, osci→osciloscopio, fuente→fuente de alimentación…)
- `applySinonimos()`: expande keywords con alias antes de buscar
- `extractKeywords()`: pasa por `textToNumber()` — "dos osciloscopios" funciona
- `searchInventoryCandidates()`: fuzzy por prefijo común ≥4 chars
- Formulario préstamo: aviso `ag-loan-stock-warn` en tiempo real ("⚠ Quedarán N uds.")
- Voz fix duplicado Android: `_voiceSent` + `sessionCommitted` en closure propio evitan doble envío

---

### Sesión Mayo 2026 — Sesión 1 (v128→v133)

#### 1. Gestión de Tags (v129)
- Nueva variable `TAGS` para gestionar tags dinámicos
- Modal de categorías mejorado con sección de tags
- Autocompletado con dropdown real (no solo datalist)
- Tags se detectan automáticamente al escribir

#### 2. Permisos y Roles Fix (v130)
- Agregado `ubicacionesSync` a ACTION_PERMISSIONS
- Expandidos alias de roles ('jefe', 'professor')

#### 3. Búsqueda e Inventario Mejorada (v131)
- Búsqueda ampliada: ref, tags, proveedor, ubicación
- Nuevo filtro por tipo_material (Consumibles/Inventariables)

#### 4. Modal de Items — Tags (v131)
- Dropdown de tags con 8 sugerencias
- Validación: `cleanTag()` (sin espacios dobles, sin caracteres especiales)
- Detección automática de nuevos tags

#### 5. Modal de Items — Foto Mejorada (v131)
- Preview aumentado a 120px
- Viewer fullscreen al hacer click

#### 6. Mejora de Impresión (v132)
- Etiquetas QR: grid de 2→4 columnas
- Tamaño: 52mm→40mm altura, QR 30mm→20mm
- Modal con dos opciones: Etiquetas completas + Códigos QR solo

#### 7. Fix Modal de Impresión (v133)
- `openPrintModal()` usa `getFiltered()` sin depender de contexto
- Funciona desde home, aula, categoría, etc.

### Sesión Mayo 2026 — Sesión 2 (v134→v139)

#### 8. Separación de Modales de Impresión (v134→v137)
- Modal `mPrint` para inventario (checkboxes de columnas)
- Modal `mPrintQr` para QR (opciones de formato)
- Botón "Imprimir QR" abre el modal QR
- Botón "🖨️ Imprimir" abre modal de inventario

#### 9. Actualización Placeholder de Búsqueda (v138)
- Texto: "Buscar por nombre, ref, tags, ubicación, proveedor…"

#### 10. Indicador de Cambios Sin Guardar (v139)
- Puntito rojo (●) en título cuando hay cambios
- Confirmación "¿Descartar cambios?" al cerrar
- Detecta cambios en todos los campos
- Se resetea al guardar o cerrar

### Sesión Mayo 2026 — Sesión 3 (17/05/2026, v139→v147)

**Features sin documentar en commit inicial:**
- Función `showHistorialButton()` en roles.js (muestra botón de historial)

### Sesión Mayo 2026 — Sesión 4 (Continuación, v147→v158)

#### 11. Sistema de Auditoría e Historial de Cambios (v147→v156)
**Archivos nuevos:** `functions/api/historial.js`, `js/modal-historial.js`, `js/audit-log.js`

**Funcionalidad:**
- Endpoint `/api/historial` para obtener registro de cambios de items
- Modal para visualizar quién cambió qué y cuándo
- Campos registrados: usuario, item_id, campo modificado, valor anterior, valor nuevo, fecha
- Auditoría resiliente: no bloquea si falla el logging
- Control de acceso: visible solo a admins/jefes (inicialmente restrictivo, luego relajado)

**Notas técnicas:**
- `logItemAction()` registra cambios desde cliente
- Se llama automáticamente al guardar item
- Tabla `log` en BD almacena historial
- Ordenado por fecha (cambios más recientes primero)

#### 12. Fixes en Modal de Item (v155)
- **Cierre forzado:** Modal se cierra automáticamente después de guardar
- **Prompt evitado:** Resetea `modalHasChanges` tras guardado exitoso
- Evita confirmaciones innecesarias y modal desincronizado

#### 13. Mejoras en Control de Acceso (v153)
- Relajado: inicialmente solo jefe departamento, ahora más usuarios pueden ver historial
- Basado en roles y permisos existentes

#### 14. Bulk Inventory Actions (v158)
**Archivos:** `js/inventory.js`, `js/modal-item.js`, `index.html`

- Acciones en lote sobre múltiples items
- Probables acciones: cambiar estado, categoría, cantidad en bulk
- UI para seleccionar múltiples items
- Registra cambios en auditoría

#### 15. Easter Egg: Pac-Man Game (v150)
- Juego de Pac-Man del departamento (feature decorativa)

#### Estado actual
- **Versión SW:** v158
- **Nuevos archivos:** 3 (historial API + modals)
- **Nuevas tablas BD:** log (auditoría)

## Mejoras Implementadas

### Funcionalidad ✅
- [x] Historial de cambios — Auditoría completa (v147→v156)
- [x] Bulk inventory actions — Acciones en lote (v158)
- [x] Indicador de cambios sin guardar (v139)
- [x] Mejora de búsqueda con tags, ubicación, proveedor (v131)
- [x] Gestión de tags dinámica (v129)

## Mejoras Pendientes

### Funcionalidad
- [ ] Alertas de stock bajo — Banner/notificación más visible
- [ ] Filtro por mantenimiento pendiente — Botón rápido
- [ ] Búsqueda avanzada con filtros combinados
- [ ] Reporte de stock por categoría/aula
- [ ] Notificaciones en tiempo real
- [ ] Merge/consolidar items duplicados
- [ ] Control de acceso por aula (restringir a aula específica)

### Optimización
- [ ] Lazy loading de imágenes
- [ ] Caché inteligente
- [ ] Compresión de imágenes automática
- [ ] Paginación en listados >1000 items
- [ ] Indexación/búsqueda rápida
- [ ] Code splitting
- [ ] Debounce en búsqueda
- [ ] Web Workers para operaciones pesadas

## Notas Técnicas

### Arquitectura
- Service Worker con estrategia cache-first para SHELL
- D1 (Cloudflare) como base de datos
- Google Sheets para algunos datos (profesores, ubicaciones)
- PWA con manifest.json

### Campos detectados en item
```
ref, aula, item, foto, qty, min, tipo_material, cat, ciclo, mod, loc, 
est, util, proveedor, tags, fecha, mant, mantFecha, mantEstado, mantResp, 
mantNota, obs, es_contenedor, parent_id
```

### Tags
- Almacenados en memoria en variable `TAGS`
- Se cargan desde items al iniciar app
- Validación: máx 50 caracteres, sin caracteres especiales, acentos españoles preservados

### Búsqueda
- Campos incluidos: nombre, ref, tags, ubicación, proveedor, aula
- Búsqueda en tiempo real (sin debounce actualmente)

## Commits Recientes

**Sesión 2 (v134→v139):**
```
76145f9 — Add unsaved changes indicator in item modal (v138→v139)
6b95c3f — Update search placeholder to show all searchable fields (v137→v138)
bae6c39 — Fix: Remove duplicate openPrintModal/closePrintModal (v136→v137)
be4f995 — Fix: Imprimir QR button opens QR print modal (v135→v136)
8fd7454 — Separate print inventory and print QR modals (v134→v135)
```

**Sesión 4 (v147→v158):**
```
edb9817 — Add simple bulk inventory actions (v157→v158)
a880dbe — Include actor and item details in audit log (v156→v157)
13305b5 — Log item actions from client (v155→v156)
422ac4f — Make item audit logging resilient (v154→v155)
13856aa — Force close item modal after save (v154→v155)
f62cc3f — Avoid unsaved prompt after item save (v154→v155)
2e6fa5d — Include item actions in history (v153→v154)
1b1c577 — Improve history modal usability (v152→v153)
10320bf — Relax history access check (v151→v152)
193b15e — Fix audit history viewer (v150→v151)
45418d0 — Add department Pac-Man game (v149→v150)
```

## Estado Actual (v158)

**Completado en esta sesión:**
✅ Auditoría e historial de cambios (una de las mejoras sugeridas)
✅ Bulk inventory actions (acciones en lote)
✅ Mejoras en UX (cierre automático de modal, prompt mejorado)
✅ Control de acceso al historial (relajado inicialmente)

**Próximos Pasos:**

1. **Performance & Auditoría:**
   - Considerar índices en tabla `log` si crece (campos: item_id, fecha, actor)
   - Limpieza de logs antiguos si es necesario
   - Paginación en historial si hay muchos cambios por item

2. **Bulk Actions:**
   - Completar UI para selección múltiple
   - Pruebas de rendimiento con muchos items
   - Feedback visual durante acciones en bulk

3. **Mejoras Sugeridas Pendientes:**
   - Alertas de stock bajo (banner en home)
   - Filtro por mantenimiento pendiente
   - Búsqueda avanzada con filtros combinados
   - Lazy loading de imágenes

4. **Documentación:**
   - Actualizar documentación de API (endpoints nuevos)
   - Documentar tabla `log` en schema
   - Guía de uso del historial para usuarios

---

## Sesión Mayo 2026 — Sesión 5 (v159→v166) — Auditoría de Datos

### Contexto
Se requería una herramienta para identificar y limpiar items con campos incompletos. El inventario tenía ~969 items con problemas en campos críticos (módulo, aula, categoría, etc.).

### Archivo Nuevo: `js/modal-auditoria.js`

#### Funcionalidad Principal
- Modal para auditar integridad de datos del inventario
- Identifica items con campos faltantes (5 campos críticos + 3 secundarios)
- Sistema dual de filtrado + agrupación
- Integración con bulk edit existente
- Control de acceso: requiere permiso `config.manage`

#### Variables de Estado
```js
let auditoriaData = [];              // items con problemas
let auditoriaFiltroActual = 'all';   // filtro: 'all' | 'cat' | 'mod' | 'aula' | 'ref' | 'loc' | 'proveedor'
let auditoriaSeleccionados = new Set(); // IDs de items seleccionados
let auditoriaAgrupar = 'none';       // agrupación: 'none' | 'cat' | 'aula'
let gruposColapsados = new Set();    // grupos colapsados
```

#### Campos Auditados
```js
const CAMPOS_CRITICOS = [
  { key: 'cat',  label: 'Categoría' },
  { key: 'mod',  label: 'Módulo/Ciclo' },
  { key: 'aula', label: 'Aula' },
];

const CAMPOS_SECUNDARIOS = [
  { key: 'ref',       label: 'Referencia' },
  { key: 'loc',       label: 'Ubicación' },
  { key: 'proveedor', label: 'Proveedor' },
];
```

#### Funciones Principales

**1. `openAuditoriaModal()` / `closeAuditoriaModal()`**
- Abre/cierra modal con validación de permisos
- Control z-index para layering correcto

**2. `cargarAuditoria()`**
- Carga datos desde array global `items`
- Analiza cada item buscando campos faltantes
- Inicializa tabla y filtros
- Renderiza con filtro actual

**3. `getItemProblemas(item)`**
- Devuelve array de etiquetas de campos faltantes
- Verifica campos vacíos o solo espacios

**4. `renderAuditoria(filtro)`**
- Router principal que delega a vista apropiada
- Actualiza contadores de filtro
- Muestra información contextual

**5. `renderAuditoriaFilas(items)`**
- Renderiza tabla normal sin agrupación
- Cada fila: checkbox, ref, nombre, aula, categoría, problemas, acción

**6. `renderAuditoriaAgrupada(items)`**
- Renderiza grupos colapsables
- Estructura: cabecera de grupo + filas del grupo
- Checkbox de grupo: selecciona/deselecciona todos
- Toggle colapso con click en cabecera
- Mostra contador de items en grupo

**7. `agruparAuditoria(modo)`**
- Cambia modo de agrupación
- Limpia estado colapsado (expande todos)
- Actualiza botones activos
- Redibuja tabla

**8. `getGrupos(items)`**
- Agrupa items por campo seleccionado
- Ordena grupos por cantidad de items (descendente)
- Items sin el campo de agrupación van a grupo final: "(Sin aula)" o "(Sin categoría)"
- Retorna array de pares [clave, items[]]

**9. `toggleGrupoAuditoria(key)`**
- Toggle estado colapsado de un grupo
- Muestra/oculta filas del grupo con `display:none`
- Actualiza símbolo: ▼ (expandido) / ▶ (colapsado)

**10. `seleccionarGrupo(key, checked)`**
- Selecciona/deselecciona todos los items de un grupo
- Actualiza `auditoriaSeleccionados`
- Redibuja tabla

**11. `filtrarAuditoria(filtro)`**
- Cambia filtro activo
- Actualiza botones activos
- Redibuja tabla

**12. `toggleAuditoriaItem(itemId)`**
- Selecciona/deselecciona item individual
- Muestra/oculta botón de edición en lote
- Redibuja

**13. `updateFiltroButtons()`**
- Calcula contador para cada tipo de problema
- Actualiza texto de botones: "Sin módulo (245)"
- Se ejecuta al cargar datos

**14. `abrirItemParaEditar(itemId)`**
- Abre modal de edición de item (sin cerrar auditoría)
- **Fix z-index:** aumenta z-index del modal auditoría a 500 antes de abrir item
- Al cerrar modal de item, restaura z-index a 501
- Permite navegar entre items sin perder contexto de auditoría

**15. `editarSeleccionados()`**
- Prepara edición en lote de items seleccionados
- Llena Set global `bulkSelected` con IDs
- Cierra modal de auditoría
- Muestra barra de bulk actions
- Integración con sistema existente de inventory.js

**16. `seleccionarTodos()`**
- Selecciona/deselecciona todos los items visibles (filtrados)
- Toggle: si todos seleccionados → deselecciona; si no → selecciona

**17. `escapeHtml(text)`**
- Sanitiza HTML para evitar XSS
- Usa `textContent` + `innerHTML`

---

### Cambios en `index.html`

#### Botón de Acceso
Añadido en menú Departamento:
```html
<button class="dept-menu-item" id="btnAuditoriaDept" data-perm="config.manage" 
        onclick="closeDeptMenu();openAuditoriaModal()">
  🔍 Auditoría de datos
</button>
```

#### Modal HTML Completo
```html
<div class="modal-backdrop" id="mAuditoriaBackdrop" onclick="closeAuditoriaModal()">
  <div class="modal" id="mAuditoria">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--border)">
      <h2 style="margin:0">🔍 Auditoría de Datos</h2>
      <button class="close-btn" onclick="closeAuditoriaModal()">✕</button>
    </div>

    <!-- Filtros y Agrupación -->
    <div id="auditoriaFiltros" style="margin-bottom:20px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
      <!-- Filtros de campos -->
      <span style="color:var(--muted);font-size:12px">Filtrar por:</span>
      <button class="abtn active" onclick="filtrarAuditoria('all')">Todos</button>
      <button class="abtn" onclick="filtrarAuditoria('cat')">Sin categoría</button>
      <button class="abtn" onclick="filtrarAuditoria('mod')">Sin módulo</button>
      <button class="abtn" onclick="filtrarAuditoria('aula')">Sin aula</button>
      <button class="abtn" onclick="filtrarAuditoria('ref')">Sin referencia</button>
      <button class="abtn" onclick="filtrarAuditoria('loc')">Sin ubicación</button>
      <button class="abtn" onclick="filtrarAuditoria('proveedor')">Sin proveedor</button>
      
      <!-- Separador -->
      <span style="color:var(--muted);font-size:12px;margin-left:4px">Agrupar por:</span>
      
      <!-- Agrupación -->
      <button class="abtn active" id="audGrpNone" onclick="agruparAuditoria('none')">Sin agrupar</button>
      <button class="abtn" id="audGrpCat" onclick="agruparAuditoria('cat')">Categoría</button>
      <button class="abtn" id="audGrpAula" onclick="agruparAuditoria('aula')">Aula</button>
    </div>

    <!-- Información y controles -->
    <div id="auditoriaInfo" style="margin-bottom:12px;font-size:13px;color:var(--text)"></div>
    
    <div style="margin-bottom:12px;display:flex;gap:8px">
      <button class="btn-primary" id="audSelAll" onclick="seleccionarTodos()" style="display:none">
        ☑️ Seleccionar todos
      </button>
      <button class="btn-accent" id="audEditMult" onclick="editarSeleccionados()" style="display:none">
        ✏️ Editar seleccionados
      </button>
    </div>

    <!-- Tabla -->
    <div style="max-height:calc(100vh - 320px);overflow-y:auto;border:1px solid var(--border);border-radius:6px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--surface2);sticky:top:0">
            <th style="padding:8px;text-align:center;width:32px">☑</th>
            <th style="padding:8px;text-align:left;min-width:80px">Ref</th>
            <th style="padding:8px;text-align:left;min-width:150px">Nombre</th>
            <th style="padding:8px;text-align:left;min-width:80px">Aula</th>
            <th style="padding:8px;text-align:left;min-width:100px">Categoría</th>
            <th style="padding:8px;text-align:left;min-width:200px">Campos faltantes</th>
            <th style="padding:8px;text-align:center;width:90px">Acción</th>
          </tr>
        </thead>
        <tbody id="auditoriaTbody"></tbody>
      </table>
    </div>

    <div id="auditoriaEmpty" style="padding:40px;text-align:center;color:var(--muted);display:none"></div>
  </div>
</div>
```

---

### Cambios en `js/modal-item.js`

#### Fix: Unsaved Changes Warning (v166)

**Problema:** Al navegar entre items en auditoría, el flag `modalHasChanges` persistía, mostrando falsa alarma de "cambios sin guardar"

**Solución:** Resetear flag al inicio de `openModal()`:
```js
function openModal(id) {
  // ... código existente ...
  eid = id;
  fillModalSelects();
  
  // NUEVO: Reset change detection para item nuevo
  modalHasChanges = false;
  updateModalIndicator();
  
  // ... resto del código ...
}
```

**Ubicación:** Al comienzo de la función, tras `fillModalSelects()`

---

### Cambios en CSS (`styles.css`)

Añadidas clases para auditoría (aplicadas inline en HTML):

```css
/* Modal auditoría ancho */
#mAuditoria .modal {
  width: 1200px;
  max-width: 100vw;
}

/* Tabla scrolleable */
#mAuditoria table {
  width: 100%;
  border-collapse: collapse;
}

#mAuditoria th, #mAuditoria td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

/* Badges de problemas */
.problemas-badge {
  background: var(--red-bg, #ffe0e0);
  color: var(--red);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  display: inline-block;
}

/* Header de grupo colapsable */
.auditoria-group-header {
  background: var(--surface2);
  cursor: pointer;
  font-weight: 600;
}

.auditoria-group-header:hover {
  background: var(--surface3);
}

/* Toggle collapso */
.group-toggle {
  font-size: 12px;
  color: var(--muted);
  user-select: none;
}
```

---

### Service Worker Update

Versión bumped de v158 → v166 en `sw.js` para forzar recarga de caché:

```js
const VERSION = 'v166';
```

**Cambios por versión:**
- v159: Auditoría básica + filtros
- v160: Fix z-index modal edición
- v161: Fix bulk edit integration
- v162: Fix agrupación items sin campo
- v163: Añadir columna categoría
- v164-165: (reservadas)
- v166: Fix unsaved changes warning

---

### Bugs Encontrados y Solucionados

| Bug | Versión | Causa | Solución |
|-----|---------|-------|----------|
| Datos no cargan | v159 | Variable `INVENTORY` equivocada | Usar `items` |
| Modal edición detrás de auditoría | v160 | z-index no configurado | Manipular z-index dinámicamente |
| Bulk edit no funciona | v161 | Llamada a función no existente | Integrar con sistema existente |
| Agrupación mezcla items sin campo | v162 | Lógica de agrupación incorrecta | Separar en grupo final "(Sin aula)" |
| Falta columna categoría | v163 | Columna no añadida a HTML/render | Añadir th y td |
| Falso aviso "cambios sin guardar" | v166 | Flag `modalHasChanges` no reseteado | Resetear al abrir nuevo item |

---

### Flujo de Uso Completo

1. **Acceso** → Menú Departamento → "🔍 Auditoría de datos"
2. **Cargar datos** → Se analizan ~969 items, se detectan problemas
3. **Filtrar** → Seleccionar campo problemático: "Sin módulo"
4. **Agrupar** → "Agrupar por Aula" → items organizados en grupos
5. **Seleccionar** → Clickear grupo o items individuales
6. **Editar** → Opción A: editar en lote (bulk); Opción B: editar individual
7. **Guardar** → Cambios se registran en auditoría automáticamente

---

### Características

✅ **Implementadas:**
- Modal amplio (1200px) con scroll
- Tabla con 7 columnas (checkbox, ref, nombre, aula, categoría, problemas, acción)
- Filtrado por 7 tipos de problemas
- Agrupación por categoría o aula
- Grupos colapsables con toggle
- Checkbox de grupo para selección masiva
- Edición individual sin cerrar modal
- Edición en lote con bulk actions existente
- Contador de items problemáticos
- Contador de items seleccionados
- Integración total con sistema existente
- Z-index correcto para modales superpuestos

⏳ **Backlog:**
- Indicador visual de progreso
- Marcar grupos como completados
- Vista estadística inicial (reporte de problemas)
- Filtros AND/OR combinados
- Exportar reporte CSV/PDF

---

### Commits Relacionados

```
7815642 Update IDEAS.md with audit UX improvements backlog (v166)
5c5117b Fix unsaved changes warning when opening new item from audit modal (v165→v166)
[anteriores: commits de auditoría v159→v165]
```

---

**Última actualización:** 17/05/2026 — Sesión 5 (v166)
