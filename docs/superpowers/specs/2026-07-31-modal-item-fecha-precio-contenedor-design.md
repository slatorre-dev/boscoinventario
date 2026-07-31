# Modal de ítem: fix de solape de galería, fecha de adquisición, precio, sección de contenedor

**Fecha:** 31/07/2026
**Origen:** feedback tras el despliegue de la galería de fotos (v536) — problema visual detectado en captura + 3 mejoras de organización del modal de ítem.

## Contexto

`index.html` (bloque `#mItem`, líneas ~542-755) es el modal de crear/editar ítem. Tras añadir la galería de fotos (v535), la fila `.item-stock-strip` (Cantidad/Mínimo/Tipo) se solapa visualmente con las miniaturas de foto cuando hay 2-3 fotos. Además, se piden 2 campos nuevos (fecha de adquisición, precio) que requieren columnas D1 nuevas, y una reorganización: el bloque "Contenedor/Caja" vive hoy dentro de la sección 📎 DOCUMENTACIÓN sin ser documentación.

## Alcance

4 cambios independientes al mismo modal, agrupados en un solo spec porque comparten archivo (`index.html`, `js/modal-item.js`) y se implementan en la misma sesión — no porque dependan entre sí.

### Fuera de alcance
- No se cambia ningún otro modal ni vista (tabla, tarjetas, impresión, QR) para mostrar precio o fecha de adquisición — solo el modal de edición los captura, igual que otros campos "de detalle" existentes (ej. proveedor) no se muestran en la tabla principal hoy.
- No se añade validación de formato de precio más allá de `type="number"` nativo del navegador.
- No se toca la lógica de `toggleContenedorFields()`, generación de unidades, ni la lista de hijos de una caja — solo su ubicación en el HTML.

## Cambio 1 — Fix de solape galería/stock-strip

**Causa raíz:** `#mItem .photo-col` (`css/styles.css:954`) es `flex:0 0 auto` — con 3 fotos de 72×72px más gaps, su ancho renderizado crece hasta ~250px+. `#mItem .item-stock-strip` (línea 955) es `flex:1` dentro de `.photo-picker` (línea 941, `overflow:hidden`, sin `flex-wrap`) — cuando `.photo-col` crece, el espacio restante para `.item-stock-strip` se reduce por debajo de lo que sus 3 columnas (`grid-template-columns:minmax(0,.55fr) minmax(0,.55fr) minmax(0,1.4fr)`) necesitan para no solaparse visualmente con las miniaturas.

**Fix:**
- Reducir el tamaño de los slots de foto en `.foto-slot`/`.foto-slot .photo-preview` de 72×72px a 56×56px — mismo patrón visual, menos espacio ocupado.
- Añadir `flex-wrap:wrap` a `#mItem .photo-picker` para que, si aun así no cupieran uno junto al otro en pantallas estrechas, `.item-stock-strip` caiga a su propia línea en vez de comprimirse hasta solapar.
- Sin cambios de HTML ni JS — solo `css/styles.css`.

## Cambio 2 — Fecha de adquisición

**D1:** migración nueva `ALTER TABLE inventario ADD COLUMN fecha_adquisicion TEXT DEFAULT ''` (formato `YYYY-MM-DD`, igual que la columna `fecha` existente).

**Backend:** `functions/api/item.js:HEADERS_INV` gana `fecha_adquisicion` en la lista (afecta automáticamente a `add`/`update`/`bulkImport`, que ya iteran sobre `HEADERS_INV`/`FIELDS_UPD`).

**Frontend:**
- `index.html`, dentro de `.ref-nombre-row` (sección IDENTIFICACIÓN): añadir un tercer campo `<input type="date" id="f_fechaAdquisicion">` junto a Ref./Nombre. La fila pasa de 2 a 3 columnas; el input de nombre reduce su ancho relativo (ajuste de `grid-template-columns` o `flex-basis` en `.ref-nombre-row`, siguiendo el mismo patrón que las demás filas de 2-3 columnas del modal).
- `js/modal-item.js`: `openModal()` rellena `f_fechaAdquisicion` con `m?.fecha_adquisicion||''` (mismo patrón que el resto de campos simples). `saveItem()` añade `fechaAdquisicion: document.getElementById('f_fechaAdquisicion').value` al objeto `v` — usando el nombre de columna D1 real (`fecha_adquisicion`) como clave del payload, igual que ya hace el resto de campos con nombre snake_case en `HEADERS_INV`.

## Cambio 3 — Precio

**D1:** migración `ALTER TABLE inventario ADD COLUMN precio REAL DEFAULT NULL` (número simple, sin símbolo de moneda — se asume euros en toda la UI del proyecto, sin necesidad de guardar la unidad).

**Backend:** mismo patrón que Cambio 2 — `precio` se añade a `HEADERS_INV`.

**Frontend:**
- `index.html`, sección 🔧 DETALLES: nuevo `<input type="number" step="0.01" min="0" id="f_precio" placeholder="0.00">` junto a `#f_proveedor`.
- `js/modal-item.js`: `openModal()` rellena `f_precio` con `m?.precio ?? ''`. `saveItem()` añade `precio: parseFloat(document.getElementById('f_precio').value) || null` al objeto `v` (mismo patrón de parseo que `qty`/`min`, que ya usan `parseInt(...)||0` — aquí `null` en vez de `0` porque un precio de 0 y un precio "sin dato" son conceptos distintos, y forzar `0` falsearía el dato).

## Cambio 4 — Sección propia para Contenedor/Caja

**HTML:** el bloque completo actual dentro de `#mSecDocumentacion` (desde `<div class="full"><label class="fl">Contenedor / Caja</label>` hasta el cierre del `<div id="f_contenedor_hijos">`, incluyendo el checkbox, el selector de caja padre, la lista de hijos y el panel de generar unidades) se mueve a una nueva sección:

```html
<details class="m-section-details" id="mSecContenedor">
  <summary class="m-section-title">📦 CONTENEDOR / CAJA <span class="sec-label-arrow">▾</span></summary>
  <div class="m-section-details-body">
    <!-- contenido movido tal cual, sin cambios internos -->
  </div>
</details>
```

Ubicada en el HTML justo después de la sección 📦 INVENTARIO (cantidad/mínimo/tipo/fotos) y antes de 🔧 DETALLES.

**DOCUMENTACIÓN** se queda solo con: Observaciones, el bloque de QR del ítem, y Documentación adjunta (subir archivos/hacer foto) — sin cambios en esos tres.

**JS (`js/modal-item.js`):** en `openModal()`, la línea `secDocs.open = existing && (modalSectionShouldOpen(m, ['obs']) || esContenedor);` (línea ~891) se separa en dos:
- `secDocs.open = existing && modalSectionShouldOpen(m, ['obs']);` (ya no depende de `esContenedor`).
- Nueva línea `secContenedor.open = existing && esContenedor;` justo después, controlando la nueva sección.

Ningún otro cambio de lógica — `toggleContenedorFields()`, `saveHijosCaja()`, `toggleGenerarUnidades()`, `saveGenerarUnidades()` siguen operando sobre los mismos IDs de elemento, solo reubicados en el DOM.

## Verificación

Sin entorno de desarrollo local funcional (`wrangler pages dev` crashea en Windows) — verificación manual con Playwright contra producción tras deploy, más `wrangler d1 execute` para confirmar las columnas nuevas en D1 real. Casos a probar: abrir un ítem existente y confirmar que las 3 fotos ya no solapan con Cantidad/Mínimo/Tipo; crear un ítem nuevo con fecha de adquisición y precio, guardarlo, reabrir y confirmar que persisten; marcar un ítem como contenedor y confirmar que la sección CONTENEDOR/CAJA (no DOCUMENTACIÓN) se abre automáticamente al reabrirlo.
