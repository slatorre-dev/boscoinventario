# Búsqueda por número de serie (cámara)

**Fecha:** 01/08/2026
**Origen:** propuesta del usuario — "Modo Cámara Inteligente" con 10 sub-ideas (buscar por S/N, alta automática, reconocimiento visual, modo Inspector, etc.). Esta spec cubre solo la primera pieza: buscar un ítem apuntando la cámara a su etiqueta de número de serie. El resto queda en backlog, ver "Fuera de alcance".

## Contexto

- `js/qr-scanner.js` ya abre cámara vía `getUserMedia({video:{facingMode:'environment'}})`, pinta frames en un `<canvas>` oculto y procesa con `jsQR` en bucle (`requestAnimationFrame`). Este flujo nuevo reutiliza la apertura de cámara pero **no** el bucle de frames — captura una sola foto fija.
- `functions/api/proxy-ai.js` ya proxya `POST` a GitHub Models (`gpt-4o-mini` u otros) con el token guardado en Cloudflare (`env.GITHUB_TOKEN`), protegido por `_middleware.js`. `gpt-4o-mini` soporta input de imagen (chat completions con `image_url` en el content array) — no hace falta servicio de visión nuevo.
- `inventario` no tiene hoy columna de número de serie de fábrica. `ref`/`code` son códigos internos Bosco (ver `migrations/0001_schema.sql`), campos distintos.
- Patrón de registro obligatorio para acciones nuevas del backend (lección de v522, ver CLAUDE.md): toda acción nueva debe registrarse en `ENDPOINT_MAP` (`js/api.js`) y `ACTION_PERMISSIONS` (`js/roles.js`) desde el principio, o falla en silencio.

## Alcance

Botón nuevo 📷 (junto al de QR existente) que abre un modal de cámara, captura **una foto fija** de una etiqueta, extrae el número de serie vía IA de visión, y busca ese número en el inventario del departamento del usuario (+ departamento compartido `iesjuanbosco`, mismo criterio que el resto de búsquedas).

- Match exacto → abre la ficha del ítem directo (`openItemRoute`, ya usado por QR scanner).
- Sin match exacto → fuzzy match (distancia de edición baja, tolera 1-2 caracteres — mismo espíritu que `fuzzyMatch` en `search.js`) → lista de candidatos para elegir.
- Sin ningún candidato → opción "Crear ítem nuevo con este número de serie", precarga el campo `serie` en el modal de alta, resto de campos vacíos.

### Fuera de alcance
- Auto-rellenar marca/modelo/fabricante desde la etiqueta (idea #2 del roadmap del usuario) — el modal de alta se precarga solo con `serie`, nada más.
- Reconocimiento de objetos/categoría por foto (#3, #6).
- Modo "Inspector" con cámara en vivo comparando contra inventario (#10).
- Generación de QR tras alta (#9) — ya existe QR aparte, no se enlaza aquí.
- Búsqueda de manuales/datasheets (#7).
- Rate-limiting o cuota propia sobre GitHub Models — usa el mismo proxy/token compartido que ya usa Volt hoy, mismo riesgo de coste ya existente.

## Arquitectura de datos

Migración nueva `migrations/0025_inventario_serie.sql`:
```sql
ALTER TABLE inventario ADD COLUMN serie TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_inventario_dept_serie ON inventario(departamento, serie);
```
Mismo patrón que `0020_indices_inventario.sql` (índice compuesto por departamento, ya que casi toda query filtra por departamento primero).

Campo `serie` editable en el modal de ítem (`js/modal-item.js`), input de texto simple junto a `ref`/`code`, incluido en el payload normal de `add`/`update` (sin acción nueva de backend para esto — reusa `item.js` tal cual).

## Backend

Acción nueva en `functions/api/item.js`: **`buscarPorSerie`** — `{action:'buscarPorSerie', imagen: '<base64>'}`.

1. Verifica sesión (ya lo hace `_middleware.js`).
2. Llama internamente a GitHub Models (mismo mecanismo que `proxy-ai.js`, reusando `env.GITHUB_TOKEN`) con un prompt fijo pidiendo **solo** el número de serie visible en la imagen, respuesta en JSON estricto (`{"serie": "..."}` o `{"serie": null}` si no detecta ninguno).
3. Si `serie` es `null`/vacío → responde `{ok:true, encontrado:false, motivo:'sin_lectura'}`.
4. Si hay `serie` → busca en `inventario` del departamento del actor (+ `iesjuanbosco`):
   - Match exacto (`WHERE serie = ?`) → `{ok:true, match:'exacto', item:{...}}`.
   - Sin exacto → trae candidatos con `serie != ''` del mismo ámbito y calcula distancia de edición en JS (Workers no tiene función SQL nativa de edit distance), filtra los que quedan por debajo de un umbral (2 caracteres) → `{ok:true, match:'fuzzy', candidatos:[...]}` (máx 5, ordenados por distancia).
   - Sin candidatos → `{ok:true, match:'ninguno', serieLeida:'...'}` (el frontend usa `serieLeida` para precargar el alta).

Registrada desde el principio en `ENDPOINT_MAP` (`js/api.js`) y `ACTION_PERMISSIONS` (`js/roles.js`) con el mismo permiso que la búsqueda normal (sin restricción de rol — ver sección Permisos).

## Frontend

Módulo nuevo `js/camara-serie.js` (modal propio, no se mezcla con `qr-scanner.js` — features distintas: una es lectura continua de QR, otra es una foto fija + IA).

- Botón 📷 nuevo junto al botón de QR existente en la barra de búsqueda del inventario.
- Modal: abre cámara (mismo `getUserMedia` que QR), un botón "Capturar", dibuja el frame actual en canvas, convierte a base64 (JPEG, calidad reducida tipo `0.5` para no disparar payload) y llama a `apiPost('buscarPorSerie', {imagen})`.
- Mientras espera respuesta: spinner/estado "Leyendo etiqueta...".
- Resultado `exacto` → cierra modal, `openItemRoute(item.id)`.
- Resultado `fuzzy` → lista de candidatos (nombre + aula + serie leída de cada uno), click abre ese ítem.
- Resultado `ninguno` → botón "Crear ítem nuevo con S/N: XXXXX" → abre modal de alta con `serie` precargado.
- Resultado `sin_lectura` → mensaje "No se pudo leer ningún número de serie, prueba a acercar la cámara o mejorar la luz" + botón reintentar (vuelve a capturar sin cerrar modal).

## Manejo de errores

- Cámara denegada/no encontrada → mismos mensajes ya usados en `qr-scanner.js` (`NotAllowedError`/`NotFoundError`).
- Fallo de red al capturar/llamar al backend → `toast` de error, modal se queda abierto, permite reintentar sin recargar cámara.
- GitHub Models responde error/timeout → mensaje "No se pudo leer la etiqueta, inténtalo de nuevo" (mismo tratamiento que `sin_lectura`).
- Respuesta de IA no es JSON válido → tratada igual que `sin_lectura` (defensivo, sin excepción sin capturar).

## Permisos

Cualquier usuario logueado puede usar el botón (mismo nivel que búsqueda/QR scanner normal) — es solo lectura/búsqueda, no modifica datos salvo que el usuario decida crear un ítem nuevo (donde ya aplica el permiso `items.write` existente del modal de alta, sin cambios).

## Testing

- Verificar migración `0025` aplica limpia en remoto (`wrangler d1 execute`) y el índice queda creado.
- Prueba manual end-to-end con Playwright contra producción: no se puede simular una foto real de cámara headless, así que se probará llamando `apiPost('buscarPorSerie', {imagen})` directo con una imagen de etiqueta real (fotografiada aparte) para validar los 4 casos (exacto, fuzzy, ninguno, sin_lectura).
- Verificar que crear un ítem nuevo desde "Crear ítem con S/N" precarga correctamente el campo y guarda bien en D1.
- Confirmar que `buscarPorSerie` respeta scoping por departamento (un usuario de un departamento no encuentra por S/N un ítem de otro departamento que no sea `iesjuanbosco`).
