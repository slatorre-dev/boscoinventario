# Lectura de código de barras (mejora de la búsqueda por número de serie) — Diseño

**Fecha:** 02/08/2026
**Estado:** Aprobado, pendiente de plan de implementación
**Roadmap:** mejora sobre la idea #1 ya implementada — ver
[`docs/IDEAS.md`](../../IDEAS.md#inventario-por-cámara--modo-cámara-inteligente)

## Contexto

La búsqueda por número de serie (#1, en producción) lee el S/N vía IA de
visión (Cloudflare Workers AI, OCR sobre foto de etiqueta) — funciona,
pero es más lento que decodificar un código de barras cuando el equipo
trae uno de fábrica con el S/N codificado ahí (común en electrónica e
informática de consumo). El OCR de IA también ya tuvo un error de lectura
documentado en producción (`220A4S1002886` leído como `220A$1002886`) —
decodificar un código de barras no tiene ese margen de error.

## Objetivo y alcance

Antes de enviar la foto capturada a la IA, intentar decodificar un código
de barras lineal en esa misma foto usando la API nativa del navegador. Si
se decodifica un valor, buscarlo directo en D1 (sin IA); si no hay match
o el navegador no soporta la API, seguir exactamente con el flujo actual
(IA), sin cambio de UX visible para el usuario.

**Fuera de alcance:**
- Solo códigos de barras lineales (Code128, EAN-13, EAN-8, UPC-A, UPC-E)
  — sin códigos 2D tipo DataMatrix (más comunes en equipos industriales,
  fuera del perfil de material de este centro).
- Sin escaneo continuo — se decodifica la MISMA foto fija ya capturada
  por el flujo existente, no un modo de cámara en bucle como
  `js/qr-scanner.js`. Sin botón nuevo, sin modal nuevo.
- Sin librería JS nueva — solo la API nativa `BarcodeDetector` del
  navegador (soportada en Chrome/Edge Android). Sin soporte nativo (ej.
  iOS Safari), se cae automáticamente al flujo IA existente sin fallar.
- No sustituye el flujo IA — lo complementa. La detección de marca/modelo
  (idea #2) sigue disponible cuando no hay barcode o no se encuentra en
  D1, porque en ese caso la foto sigue yendo a la IA como hoy.

## Decisiones de diseño (por qué)

- **Sobre la foto fija ya capturada, no escaneo continuo:** cero cambio
  de UX — mismo botón, mismo gesto de "apuntar y capturar" que el
  profesorado ya conoce de #1. Mezclar dos patrones de captura (foto fija
  para OCR, frames en vivo para barcode) en el mismo botón confundiría
  sin necesidad.
- **API nativa `BarcodeDetector` con fallback silencioso:** sin coste de
  librería nueva (~200KB+ de una alternativa tipo ZXing), sin dependencia
  externa que mantener. El fallback a IA cuando no hay soporte nativo
  significa que ningún usuario pierde funcionalidad — en el peor caso
  (navegador sin soporte), el comportamiento es idéntico al actual.
- **Buscar directo en D1 sin pasar por IA cuando hay barcode:** más
  rápido (sin latencia de llamada a Workers AI) y más fiable (sin el
  margen de error de OCR ya visto en producción) — decisión explícita del
  usuario tras plantear la alternativa de "enviar como pista a la IA".
- **Extraer la búsqueda D1 a una función compartida
  (`buscarSerieEnD1`):** este proyecto ya sufrió el mismo patrón de bug
  tres veces (`HEADERS_INV` duplicado, scoping de categorías duplicado,
  `data-perm` mal copiado) cuando una lógica se copia en dos sitios en
  vez de compartirse — decisión explícita del usuario de evitarlo desde
  el diseño, no descubrirlo en una revisión final como las veces
  anteriores.
- **Nueva acción de backend separada (`buscarSeriePorCodigo`), no una
  rama más de `buscarPorSerie`:** `buscarPorSerie` recibe una imagen y
  hace una llamada a IA; esta acción nueva recibe un texto ya decodificado
  y no llama a IA — contrato de entrada/salida distinto, más claro como
  acción propia que como una rama condicional dentro del mismo endpoint.

## Flujo

1. En `js/camara-serie.js`, dentro de `capturarSerie()`, justo después de
   dibujar el frame capturado en el `canvas` (ya existe en el código
   actual) y antes de convertir a base64 para `buscarPorSerie`:
   - Si `window.BarcodeDetector` existe, se instancia con `formats:
     ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e']` y se llama a
     `detect(canvas)`.
   - Si detecta un valor, se llama a la nueva acción `buscarSeriePorCodigo`
     con ese valor (texto, no imagen).
2. Backend, `buscarSeriePorCodigo` (`functions/api/item.js`): llama
   directamente a la función compartida `buscarSerieEnD1(env, valor, dept,
   superadmin, genericDept)` (ver refactor abajo) y devuelve su resultado
   tal cual (`match: 'exacto'|'fuzzy'|'ninguno'`) — sin ninguna llamada a
   `env.AI`.
3. Interpretación en el frontend:
   - `match: 'exacto'` o `'fuzzy'` → mismo comportamiento ya existente
     (abre el ítem, o muestra candidatos) — reusa las funciones
     `_mostrarSerieCandidatos()` ya existentes en `camara-serie.js`.
   - `match: 'ninguno'` → el código era válido pero no hay ningún ítem
     con ese S/N — cae al flujo actual: se envía la MISMA foto a
     `buscarPorSerie` (llamada a IA), preservando la detección de
     marca/modelo (#2) para el alta de un ítem nuevo.
4. Si `BarcodeDetector` no existe, o existe pero no detecta nada en la
   foto → se salta el paso 1-3 por completo y se sigue exactamente con el
   flujo actual (llamada directa a `buscarPorSerie` con la foto), sin
   ningún cambio de comportamiento respecto a hoy.

## Refactor necesario en el backend

`functions/api/item.js`'s `buscarPorSerie` tiene hoy, en un mismo bloque
`if (serieLeida) { ... }`, tanto la consulta exacta como la fuzzy
(Levenshtein) contra `inventario`, con su propio `deptFilter`/`deptBind`.
Se extrae a una función nueva:

```js
async function buscarSerieEnD1(env, serieLeida, dept, superadmin, genericDept) {
  const deptFilter = superadmin
    ? ''
    : ` AND (oculto IS NULL OR oculto != 1) AND (departamento=? OR departamento='${genericDept}')`;
  const deptBind = superadmin ? [] : [dept];

  const exact = await env.DB.prepare(`SELECT * FROM inventario WHERE serie=?${deptFilter}`)
    .bind(serieLeida, ...deptBind).first();
  if (exact) return { match: 'exacto', item: exact };

  const candidatesRes = await env.DB.prepare(`SELECT id, item, ref, aula, serie FROM inventario WHERE serie != ''${deptFilter}`)
    .bind(...deptBind).all();
  const candidatos = (candidatesRes.results || [])
    .map(r => ({ ...r, _dist: levenshtein(r.serie, serieLeida) }))
    .filter(r => r._dist <= 2)
    .sort((a, b) => a._dist - b._dist)
    .slice(0, 5)
    .map(({ _dist, ...r }) => r);

  if (candidatos.length) return { match: 'fuzzy', candidatos };
  return { match: 'ninguno' };
}
```

`buscarPorSerie` pasa a llamar a esta función en vez de tener la consulta
inline, y `buscarSeriePorCodigo` la reusa igual — una sola copia de la
lógica de scoping/fuzzy, no dos.

## Errores y casos límite

- Navegador sin `BarcodeDetector` (ej. iOS Safari): comportamiento
  idéntico al actual, sin mensaje de error — es un fallback silencioso,
  no un fallo.
- Foto con un código de barras parcialmente visible o borroso:
  `BarcodeDetector.detect()` simplemente no devuelve resultados; se trata
  igual que "no soportado" — cae al flujo IA.
- Código de barras detectado pero no es un número de serie real de
  inventario (ej. un código de otro producto en el embalaje, no el
  equipo en sí) → `match: 'ninguno'` en `buscarSeriePorCodigo`, cae a la
  IA, que puede leer el S/N real de la etiqueta por OCR como hoy.
- Múltiples códigos de barras en la misma foto (ej. embalaje con varios
  códigos de logística además del S/N): `BarcodeDetector.detect()` puede
  devolver varios resultados — se usa el primero detectado, sin lógica
  adicional de desambiguación (fuera de alcance, caso raro).

## Archivos afectados

- Modificar: `functions/api/item.js` — nueva función compartida
  `buscarSerieEnD1()`, refactor de `buscarPorSerie` para usarla, nueva
  acción `buscarSeriePorCodigo`.
- Modificar: `js/api.js` (`ENDPOINT_MAP`), `js/roles.js`
  (`ACTION_PERMISSIONS`) — registrar `buscarSeriePorCodigo` con el mismo
  permiso `serie.read` que `buscarPorSerie`.
- Modificar: `js/camara-serie.js` — intento de `BarcodeDetector` antes de
  la llamada a `buscarPorSerie`, con fallback a la ruta actual.
- Sin migración D1 — mismo esquema `inventario.serie` ya existente.

## Testing / verificación

Mismo patrón que las ideas anteriores del roadmap: verificación end-to-end
en producción con Playwright, cubriendo:
1. Navegador con `BarcodeDetector` simulado (mock de la API en el
   contexto de página) detectando un código con S/N ya existente en D1 →
   confirma que NO se llama a `buscarPorSerie`/IA, solo a
   `buscarSeriePorCodigo`, y abre el ítem correcto.
2. Barcode decodificado pero sin match en D1 (`match:'ninguno'`) →
   confirma que SÍ se llama después a `buscarPorSerie` con la misma foto,
   preservando el flujo de alta con marca/modelo.
3. `BarcodeDetector` no definido (navegador sin soporte, simulado
   eliminando la propiedad del objeto `window`) → confirma que el flujo
   va directo a `buscarPorSerie` sin ningún error ni retraso perceptible.
4. Regresión: verificar que `buscarPorSerie` sigue funcionando igual que
   antes del refactor (mismo comportamiento exacto/fuzzy/ninguno) tras
   extraer `buscarSerieEnD1()` — comparar contra un caso ya conocido de
   sesiones anteriores.
