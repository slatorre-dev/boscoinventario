# Multi-equipo en una foto (alta masiva) — Diseño

**Fecha:** 01/08/2026
**Estado:** Aprobado, pendiente de plan de implementación
**Roadmap:** idea #6 de [`docs/IDEAS.md`](../../IDEAS.md#inventario-por-cámara--modo-cámara-inteligente)

## Contexto

Roadmap original: "Fotografiar una mesa con varios objetos (4 fuentes de
alimentación, 2 multímetros, 1 osciloscopio) y que la IA proponga crear
varios ítems de golpe, con cantidades agrupadas." Requiere detección de
múltiples objetos distintos en una imagen — el prompt de `buscarPorSerie`
(ideas #1/#3/#4) asume un solo objeto/etiqueta central por foto, así que
esto necesita un prompt y una forma de respuesta distintos.

## Objetivo y alcance

Fotografiar una mesa con varios equipos nuevos (nunca inventariados), y
que la IA proponga una lista de ítems a crear (nombre + cantidad +
categoría sugerida por fila), editable por el profesor antes de
confirmar, creándolos todos de golpe en la aula ya elegida.

**Fuera de alcance:**
- No cubre ajustar cantidad de ítems YA existentes (eso sería una feature
  de auditoría de stock distinta, no de alta).
- No busca automáticamente cada objeto detectado contra el inventario
  existente antes de proponer la lista — la revisión humana en la lista
  editable cubre el riesgo de duplicado sin necesitar N búsquedas D1 en
  serie.
- No permite aula independiente por fila — todos los ítems de una misma
  foto van a la misma aula (la mesa fotografiada está en un solo sitio
  físico), elegida antes de fotografiar.
- No genera fotos individuales por ítem detectado — cada ítem se crea sin
  foto propia; añadir una foto a alguno de los ítems creados se hace
  después desde el modal de edición normal (galería ya existente, idea
  previa de galería de fotos).
- No introduce un endpoint de escritura nuevo — reutiliza `bulkImport`
  (`functions/api/item.js`), ya existente y en uso en producción.

## Decisiones de diseño (por qué)

- **Alta de equipos nuevos, no ajuste de cantidad existente:** fiel al
  texto original del roadmap ("proponga crear varios ítems de golpe").
- **Lista editable sin búsqueda automática de duplicados:** a diferencia
  de la idea #3 (un solo objeto, una sola búsqueda fuzzy es barata), aquí
  serían N búsquedas en serie por cada objeto detectado — mucho más lento
  y complejo. La revisión humana de la lista antes de confirmar ya cubre
  el mismo riesgo sin ese coste.
- **Aula común, categoría editable por fila:** los objetos de una misma
  foto comparten ubicación física por construcción (es una foto de una
  mesa), pero pueden ser de categorías distintas (una fuente de
  alimentación y un multímetro no comparten categoría) — permitir
  edición de categoría por fila sin complicar la UI con aula por fila,
  que sería sobre-ingeniería para un caso que la foto ya descarta por
  diseño.
- **Aula elegida antes de la foto:** mismo patrón que la idea #5
  (inventario andando) — consistencia entre features de cámara del
  mismo roadmap, el profesor entra al modo desde una aula ya
  seleccionada en la app.
- **Nueva acción de backend separada (`detectarMultiples`), no una rama
  más de `buscarPorSerie`:** `buscarPorSerie` ya devuelve formas de
  respuesta variadas según `match` (objeto único, array de candidatos,
  texto libre). Añadir una quinta forma (array de objetos detectados con
  cantidades) complicaría el contrato de un endpoint que ya cubre 3 casos
  de uso distintos — más claro como acción propia con su propio contrato.
- **Reutilizar `bulkImport` para la escritura final:** ya existe, ya
  funciona en producción (usado por la importación CSV), acepta un array
  de ítems y hace el batch insert con el mismo scoping de departamento
  que el resto del backend (`resolveItemDept()`). No hay razón para
  duplicar esa lógica en un endpoint nuevo.

## Flujo

1. **Entrada:** en la vista de aula (`cf.type==='aula'`, `openSub()` en
   `js/nav.js`), botón nuevo "📸 Añadir varios" en `.action-strip`
   (`index.html`), junto al botón de la idea #5 ("📷 Revisar aula") —
   visible solo en vista de aula, mismo patrón de mostrar/ocultar por
   `cf.type` que ya usan `btnN`/`btnE`.
2. Click abre un modal nuevo (`#mMultiEquipo`), reutilizando la
   infraestructura de cámara ya existente (mismo patrón `getUserMedia` +
   canvas + captura de foto fija que `js/camara-serie.js`).
3. Foto capturada envía la imagen en base64 a una acción nueva de backend,
   `detectarMultiples` (`functions/api/item.js`), que hace una sola
   llamada a Workers AI con un prompt distinto al de `buscarPorSerie`:
   pide identificar cada objeto distinguible en la foto y devolver un
   array `[{nombre, cantidad, categoriaSugerida}, ...]`. Igual que en la
   idea #3, `categoriaSugerida` se valida contra las categorías reales del
   departamento del usuario (mismo patrón de `categoriasDept` ya usado en
   `buscarPorSerie`) antes de devolverse — un valor que no encaje se
   descarta a `null` en esa fila.
4. La respuesta se renderiza como una lista editable en el modal: cada
   fila con nombre (campo de texto editable), cantidad (campo numérico
   editable) y categoría (select editable, poblado con las categorías
   reales del departamento). El profesor puede corregir cualquier campo o
   eliminar filas completas antes de confirmar.
5. Botón "Crear N ítems" arma el payload final (un array de ítems con
   `aula` = la aula elegida al entrar al modo, para todas las filas) y
   llama a la acción `bulkImport` ya existente sin modificarla.
6. Tras la respuesta exitosa, el modal se cierra y la vista de aula se
   refresca mostrando los ítems recién creados.

## Errores y casos límite

- La IA no detecta ningún objeto reconocible → mensaje "No se detectó
  ningún equipo, prueba otra foto o mejora la luz/encuadre", mismo tono
  que el resto de la app.
- La IA detecta un solo objeto → funciona igual, la lista editable
  simplemente tiene una sola fila (no es un caso especial a manejar
  aparte).
- El profesor elimina todas las filas de la lista → botón "Crear N ítems"
  deshabilitado o mensaje bloqueante cuando `N === 0`, para no llamar a
  `bulkImport` con un array vacío (que ya hoy responde `{ ok: false,
  error: 'Sin items' }` si se le llama así — comportamiento heredado, sin
  cambio necesario).
- Categoría sugerida por la IA en alguna fila no coincide con ninguna
  categoría real del departamento → esa fila queda con categoría vacía
  en el select (igual que el guard defensivo ya usado en `camara-serie.js`
  para la idea #3), el profesor la elige manualmente antes de confirmar.
- Departamento sin categorías propias (solo "Material didáctico"
  genérico) → la IA puede devolver `categoriaSugerida: null` en todas las
  filas sin romper el flujo; el select de categoría por fila simplemente
  parte vacío.

## Archivos afectados

- Modificar: `functions/api/item.js` — nueva acción `detectarMultiples`
  (lectura, llamada a IA con prompt propio); reutiliza `bulkImport` sin
  cambios para la escritura.
- Modificar: `js/api.js` (`ENDPOINT_MAP`), `js/roles.js`
  (`ACTION_PERMISSIONS`) — registrar `detectarMultiples` con el mismo
  permiso de lectura universal usado por `buscarPorSerie`
  (`serie.read`), evitando el gap detectado en la sesión de la idea
  original de vencidos (v522): toda acción nueva se registra en ambos
  sitios desde el principio.
- Nuevo: `js/multi-equipo.js` — paralelo a `js/camara-serie.js` y al
  `js/revision-aula.js` de la idea #5, mismo patrón de cámara, con su
  propia lógica de lista editable y confirmación vía `bulkImport`.
- Modificar: `index.html` — nuevo botón en `.action-strip` (mostrado solo
  para `cf.type==='aula'`), nuevo modal `#mMultiEquipo` con la lista
  editable.
- Modificar: `js/nav.js` — `openSub()` muestra/oculta el botón nuevo según
  `cf.type`, mismo patrón que el botón de la idea #5.
- Sin migración D1 — `bulkImport` ya inserta en el esquema actual sin
  cambios.

## Testing / verificación

Mismo patrón que las ideas anteriores del roadmap: verificación end-to-end
en producción con Playwright, interceptando la respuesta de red de
`detectarMultiples` con un array de prueba controlado (2-3 objetos con
categorías válidas e inválidas mezcladas) para verificar sin depender del
modelo de IA real:
1. Lista editable se renderiza con las filas correctas (nombre, cantidad,
   categoría) desde la respuesta mock.
2. Editar/eliminar una fila antes de confirmar se refleja en el payload
   final enviado a `bulkImport`.
3. Categoría inválida en una fila queda vacía en el select, no rompe el
   render de las demás filas.
4. Confirmar con N filas crea N ítems reales en D1 (verificar con
   `wrangler d1 execute`), todos con la aula correcta.
5. Confirmar con 0 filas no dispara la llamada a `bulkImport`.
