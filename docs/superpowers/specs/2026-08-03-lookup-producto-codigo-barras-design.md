# Lookup de producto real al dar de alta desde código de barras — Diseño

**Fecha:** 03/08/2026
**Estado:** Aprobado, pendiente de plan de implementación
**Roadmap:** primera pieza de una revisión más amplia de cámara+IA
(detección de un solo aparato → captura de mesa → captura de aula
completa), ver conversación de esta sesión. Complementa la idea #2 ya
implementada (autocompletado marca/modelo desde OCR de la etiqueta) y la
mejora de lectura de código de barras
([`docs/superpowers/specs/2026-08-02-lectura-codigo-barras-design.md`](2026-08-02-lectura-codigo-barras-design.md)).

## Contexto

Hoy, cuando se detecta un código de barras (`BarcodeDetector`, en
`js/camara-unificada.js` y `js/camara-serie.js`) y no hay ningún ítem en
D1 con ese código como `serie`, el alta de ítem nuevo se prellena solo con
el código en el campo S/N — sin nombre ni marca. Para el caso de S/N leído
por OCR de una etiqueta (sin código de barras), la IA de visión ya
extrae marca/modelo de la propia foto y los prellena (idea #2, en
producción) — pero eso no existe para el camino de código de barras.

El usuario pidió explícitamente una búsqueda real en internet para
resolver "qué producto es" a partir del código detectado. Investigación
durante el diseño (ver conversación) descartó una búsqueda web genérica
por dos motivos: (1) un número de serie no es buscable en ninguna base de
datos pública — solo marca/modelo o un código de barras real de producto
lo son; (2) Cloudflare Workers AI no tiene búsqueda web nativa gratuita —
la única vía real (AI Gateway Web Search) exige un proveedor externo de
pago, lo que rompe el patrón "solo Cloudflare, gratis" que este proyecto
mantiene a propósito desde la retirada de GitHub Models (ver `CLAUDE.md`).
Se optó por una alternativa gratuita real pero acotada: **UPCitemdb**
(tier gratuito, sin API key, ~100 consultas/día), que resuelve códigos
EAN/UPC de productos de consumo reales.

## Objetivo y alcance

Cuando se detecta un código de barras de formato **EAN/UPC** (no
`code_128`) y no hay match en D1 (`match: 'ninguno'`), intentar un lookup
gratuito a UPCitemdb con ese código. Si devuelve datos útiles, prellenar
el nombre y la marca del ítem nuevo con el producto real encontrado, en
vez de dejar esos campos vacíos.

**Fuera de alcance explícito:**
- Lectura de S/N por OCR/IA (`buscarPorSerie`, sin código de barras) — no
  cambia nada, no existe ninguna base de datos pública que resuelva un
  número de serie.
- Códigos `code_128` — típicamente códigos internos/de activo, no de
  producto de consumo; UPCitemdb no los resolvería, así que no se intenta
  el lookup para ese formato.
- El modo "capturar S/N para el campo del formulario"
  (`_serieDestinoFormulario` en `js/camara-serie.js`, usado desde un ítem
  ya abierto) — ese modo solo rellena el campo S/N del formulario ya
  abierto, nunca nombre/marca, para no pisar lo que el usuario ya haya
  escrito.
- Sin categoría automática desde el producto de internet — los nombres de
  categoría de UPCitemdb (en inglés, genéricos de e-commerce) no encajan
  con las categorías reales del departamento; el usuario la sigue
  eligiendo como hoy.
- Sin caché de lookups ni reintentos con backoff — un único intento por
  detección, con timeout corto y fallback silencioso.

## Decisiones de diseño (por qué)

- **Solo formatos EAN/UPC, nunca `code_128`:** UPCitemdb es una base de
  datos de productos de consumo identificados por GTIN/EAN/UPC reales;
  un `code_128` casi nunca es ese tipo de código en este contexto (más
  bien códigos internos), así que intentarlo sería gastar cuota gratuita
  sin ninguna posibilidad real de acierto.
- **Fallback silencioso ante cualquier fallo:** el usuario ya conoció el
  riesgo de que este servicio gratuito falle en producción por el
  problema de IPs compartidas de Cloudflare Workers (muchos servicios
  gratuitos limitan por IP, y las IPs salientes de Workers se comparten
  con miles de otros proyectos globalmente) — decisión explícita de
  aceptar esa fragilidad porque la funcionalidad es puramente aditiva: en
  el peor caso (lookup falla siempre), el comportamiento es idéntico al
  actual, nunca peor.
- **Prellenar solo nombre y marca, no categoría:** evita el riesgo de
  colar una categoría inventada/no válida — mismo cuidado que ya se tomó
  en `buscarPorSerie`, donde `categoriaSugerida` solo se acepta si
  coincide EXACTAMENTE con una categoría real del departamento.
- **Extender `buscarSeriePorCodigo` en vez de crear una acción nueva:** el
  contrato de entrada/salida no cambia (sigue recibiendo un código y
  devolviendo `match`), solo se añade un campo opcional `formato` en la
  entrada y `producto` en la salida — no justifica una acción separada.

## Flujo de datos

1. **Cliente** (`js/camara-unificada.js` y `js/camara-serie.js`): cuando
   `BarcodeDetector` reporta un código con `format` igual a `ean_13`,
   `ean_8`, `upc_a` o `upc_e`, se incluye ese `formato` en la llamada a
   `buscarSeriePorCodigo` (hoy solo se manda `codigo`).
2. **Backend** (`buscarSeriePorCodigo`, `functions/api/item.js`): tras
   obtener `match: 'ninguno'` de `buscarSerieEnD1()`, si `formato` es uno
   de los EAN/UPC soportados, hace `fetch` a
   `https://api.upcitemdb.com/prod/trial/lookup?upc=<codigo>` con un
   `AbortController` de ~4s de timeout. Si la respuesta es `200`, tiene
   `code: 'OK'` y `items.length > 0`, se toma `items[0].title` (nombre) y
   `items[0].brand` (marca), truncando el nombre a una longitud razonable
   (ej. 120 caracteres) para no colar títulos de e-commerce excesivamente
   largos. Se añade `producto: { nombre, marca }` a la respuesta JSON ya
   existente (`{ ok: true, match: 'ninguno' }`).
3. Cualquier fallo (timeout, `fetch` rechazado, HTTP distinto de 200,
   `code` distinto de `'OK'`, JSON inválido, sin `items`) se captura y se
   omite el campo `producto` — la respuesta sigue siendo
   `{ ok: true, match: 'ninguno' }` exactamente como hoy, sin ningún error
   visible para el usuario.
4. **Cliente**, al recibir `match: 'ninguno'`: si `res.producto` viene
   informado, el flujo de "crear ítem nuevo con este código" prellena
   `f_item` con `producto.nombre` y `f_proveedor` con `producto.marca` —
   mismo patrón que `_crearItemDesdeSerie()` ya usa hoy para marca/modelo
   extraídos por OCR. Si `res.producto` no viene, comportamiento idéntico
   al actual (solo el código en el campo S/N).

## Errores y casos límite

- UPCitemdb no responde o excede el timeout (posible por el problema de
  IP compartida de Cloudflare Workers) → se trata igual que "sin datos de
  producto", el alta sigue con el comportamiento actual.
- UPCitemdb devuelve cuota agotada (403/429 o `code` de error) → mismo
  tratamiento, silencioso.
- El código de barras es EAN/UPC válido pero no existe en la base de
  UPCitemdb (equipo de marca poco común, o base de datos incompleta) →
  `items` vacío, mismo tratamiento silencioso.
- Título de producto en UPCitemdb con formato de listing de e-commerce
  (ej. incluye tamaño de paquete, "pack de 2", idioma distinto) → se deja
  tal cual (truncado a 120 caracteres); el usuario revisa y corrige antes
  de guardar, como con cualquier otro campo prellenado del formulario.

## Archivos afectados

- Modificar: `functions/api/item.js` — acción `buscarSeriePorCodigo`
  acepta `formato` opcional en el body, añade el lookup a UPCitemdb
  cuando aplica.
- Modificar: `js/camara-unificada.js` — pasa `formato` en la llamada a
  `buscarSeriePorCodigo`; `camaraUnifCrearItemDesdeCodigo()` prellena
  `f_item`/`f_proveedor` si hay `producto` en la respuesta guardada.
- Modificar: `js/camara-serie.js` — pasa `formato` en la llamada a
  `buscarSeriePorCodigo` dentro de `capturarSerie()`; el camino de
  "crear ítem nuevo" con código de barras (hoy llama a
  `_mostrarSerieCrearNuevo(codigo, '', '')` sin marca/modelo) pasa a
  recibir y usar `producto.nombre`/`producto.marca` si están presentes.
- Sin cambios en `js/api.js`/`js/roles.js` — mismo permiso `serie.read` ya
  registrado para `buscarSeriePorCodigo`.
- Sin migración D1.

## Testing / verificación

Mismo patrón que otras piezas de este roadmap: verificación end-to-end en
producción, cubriendo:
1. Código EAN/UPC real conocido, sin match en D1 → confirma que la
   respuesta incluye `producto` con nombre/marca reales y que el
   formulario de alta los prellena.
2. Lookup forzado a fallar (mock del `fetch` a UPCitemdb devolviendo
   error/timeout) → confirma que el alta sigue funcionando exactamente
   igual que antes de este cambio, sin errores visibles.
3. Código `code_128` sin match en D1 → confirma que NO se intenta el
   lookup (verificable por ausencia de llamada saliente en los logs del
   Worker).
4. Regresión: código EAN/UPC CON match en D1 (`exacto`/`fuzzy`) → confirma
   que el comportamiento no cambia (el lookup solo se intenta en la rama
   `ninguno`).
