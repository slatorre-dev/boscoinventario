# Galería de fotos por ítem (hasta 3)

**Fecha:** 31/07/2026
**Origen:** comparación de boscoinventario contra apps de inventario comerciales (Sortly, Snipe-IT) — hoy solo 1 foto por ítem, se pidió galería.

## Contexto

`inventario.foto` es hoy una columna `TEXT` con la imagen en base64 (canvas → `toDataURL('image/jpeg', 0.45)`, redimensionada a 360px máx antes de codificar — `js/modal-item.js:setMainPhotoFromFile()`). Tamaño real medido en D1: ~22-30KB por foto. Se usa como miniatura en 10+ sitios del frontend: tabla de inventario, tarjetas de Home, tooltip rápido (`quick-item`), QR scanner, impresión de etiquetas, exportación CSV/print (`js/inventory.js`, `js/search.js`, `js/qr-scanner.js`).

`list.js` (backend) hace `SELECT * FROM inventario` una sola vez al cargar toda la app — no paginado, trae los ~1800+ ítems del departamento de golpe.

## Alcance

Galería de hasta **3 fotos por ítem**, calidad JPEG **0.40** (bajada desde 0.45), gestionable solo desde el modal de editar/crear ítem. Los 10+ sitios existentes que muestran `item.foto` como miniatura **no cambian** — siguen mostrando una sola imagen (la "principal" de la galería).

### Fuera de alcance
- Carrusel/galería en tabla, tarjetas, QR scanner, impresión de etiquetas — siguen mostrando solo la miniatura principal.
- Migración a almacenamiento externo (R2 u otro) — se mantiene el patrón base64 inline en D1, en una tabla nueva.
- Cambios en `docs.js` (documentos adjuntos) — sistema separado, no se toca.

## Arquitectura de datos

**Tabla nueva** `item_fotos`:
```sql
CREATE TABLE item_fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  foto TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 1
);
```

- La fila con `orden=1` es la "foto principal". Tras cada `fotosSync` exitoso, el backend sincroniza `inventario.foto` con el valor de esa fila (o `''` si la galería queda vacía) — así los 10+ sitios existentes que leen `inventario.foto` directamente no requieren ningún cambio.
- Máximo 3 filas por `item_id`, validado en backend (no solo en frontend).

**Migración** (`migrations/00XX_item_fotos.sql`):
```sql
CREATE TABLE item_fotos (...);
INSERT INTO item_fotos (item_id, foto, orden)
  SELECT id, foto, 1 FROM inventario WHERE foto IS NOT NULL AND foto != '';
```
`inventario.foto` no se vacía ni se elimina — sigue siendo la columna que leen los sitios existentes, ahora mantenida en sincronía por `fotosSync` en vez de escrita directamente por el modal.

## Backend (`functions/api/item.js`)

Dos acciones nuevas, mismo patrón `action` que el resto del archivo:

- **`fotosGet`** — `{action:'fotosGet', itemId}`. Verifica que el ítem pertenece al departamento del actor (mismo check de propiedad ya usado en `update`/`delete`). Devuelve `{ok:true, fotos:[{id, foto, orden}]}` ordenado por `orden`.
- **`fotosSync`** — `{action:'fotosSync', itemId, fotos:[{foto, orden}]}`. Verifica propiedad del ítem. Rechaza con error si `fotos.length > 3`. Hace `DELETE FROM item_fotos WHERE item_id=?` + reinsert (mismo patrón `DELETE+INSERT` que `aulasSync`/`catsSync` en `config.js`), luego `UPDATE inventario SET foto=? WHERE id=?` con la foto de `orden=1` (o `''`).

Ninguna de las dos se incluye en `list.js` — la carga masiva de ítems sigue trayendo solo `inventario.foto` (columna ya existente), sin cambio de peso.

## Frontend (`js/modal-item.js`)

- La sección actual de foto (`#f_foto`, un solo preview + input file) se sustituye por una fila de hasta 3 slots de miniatura + botón "＋ Añadir foto" (deshabilitado/oculto al llegar a 3). Cada foto muestra un botón eliminar; si hay más de una foto, un botón "hacer principal" que reordena esa foto a `orden=1`.
- Reutiliza `setMainPhotoFromFile()` para cada foto añadida, cambiando `QUALITY` de `0.45` a `0.40` (mismo `MAX=360`).
- **Carga**: al abrir el modal de un ítem existente, llamada a `fotosGet` en paralelo con el resto del render del modal (no bloquea la apertura).
- **Ítem nuevo**: la galería empieza vacía; no puede sincronizarse hasta que el ítem tenga un `id` real (tras el primer guardado exitoso de alta).
- **Guardado**: `saveItem()` (o la función equivalente que ya persiste el ítem) llama a `fotosSync` después de que el ítem tenga `id` — junto al resto del payload de guardado, no como acción separada con su propio botón.

## Errores y validación

- Backend rechaza `fotosSync` con más de 3 fotos (defensa en profundidad, aunque el frontend ya deshabilita el botón de añadir al llegar al límite).
- Si `fotosGet` falla al abrir el modal (red, permisos), el modal se abre igual con la galería vacía y un aviso — no bloquea la edición del resto del ítem.
- Si `fotosSync` falla al guardar, el resto del guardado del ítem (nombre, cantidad, etc.) no se ve afectado — mismo patrón de error aislado que ya usan otras sub-acciones del modal.

## Verificación

Sin entorno de desarrollo local funcional en este proyecto (`wrangler pages dev` crashea en Windows) — verificación manual con Playwright contra producción tras el deploy, más `wrangler d1 execute` para confirmar los datos en D1 real. Casos a probar: subir 3 fotos a un ítem nuevo, editar un ítem existente (ya migrado, con 1 foto) y añadir 2 más, cambiar cuál es la principal y confirmar que `inventario.foto`/las miniaturas existentes se actualizan, eliminar todas las fotos y confirmar que las miniaturas vuelven a mostrar el icono vacío.
