# Reconocimiento visual y búsqueda por texto libre con cámara — Diseño

**Fecha:** 01/08/2026
**Estado:** Aprobado, pendiente de plan de implementación
**Roadmap:** ideas #3 y #4 de [`docs/IDEAS.md`](../../IDEAS.md#inventario-por-cámara--modo-cámara-inteligente)

## Contexto

El botón de cámara existente (`#gsSerie`, `js/camara-serie.js` +
`functions/api/item.js` acción `buscarPorSerie`) solo resuelve el caso #1
del roadmap: foto de etiqueta → lee número de serie → busca match exacto/
fuzzy o permite dar de alta. Quedan pendientes:

- **#3 — Reconocimiento visual:** fotografiar un objeto sin etiqueta legible
  (osciloscopio, PLC, Arduino...) y que la IA proponga nombre/categoría sin
  depender de leer texto.
- **#4 — Buscar cualquier texto con la cámara:** apuntar a un texto visible
  que no sea necesariamente un número de serie (ej. "Arduino UNO R3" escrito
  en una caja) y buscarlo en el inventario.

## Objetivo y alcance

Extender el flujo ya existente de `buscarPorSerie` para cubrir los 3 casos
(serie / texto libre / reconocimiento visual) con **una sola foto y una sola
llamada a la IA**, resueltos en cascada determinista por el backend. Sin
botón nuevo, sin segunda llamada a IA, sin migración D1.

**Fuera de alcance:** `js/qr-scanner.js` no se toca; no se generaliza el
buscador global (`js/search.js`) más allá de reusarlo tal cual; ideas #5,
#6, #7, #9, #10 del roadmap quedan pendientes sin relación con este trabajo.

## Decisiones de diseño (por qué)

- **Un solo botón, cascada interna:** menor carga cognitiva para
  profesorado sin experiencia técnica — apuntar con la cámara sin tener que
  clasificar de antemano "esto tiene etiqueta" vs "esto no tiene etiqueta".
- **Backend decide, IA solo extrae:** pedirle a la IA que "clasifique" el
  tipo de contenido (serie/texto/visual) añade una oportunidad de fallo,
  como ya pasó con el bug del placeholder `"VALOR o null"` en la idea #2.
  La IA extrae todos los campos que vea (`serie`, `textoLibre`,
  `descripcionVisual`, `categoriaSugerida`, todos nullable) y el backend
  aplica un orden de prioridad fijo en código.
- **Una sola llamada a IA:** mismo coste/latencia que hoy, un prompt más
  largo en vez de una segunda ronda a Workers AI.
- **Texto libre reusa `globalSearch()`:** ya opera sobre el array `items` en
  memoria del frontend, sin necesidad de endpoint ni lógica de matching
  nueva — mismo comportamiento que el profesorado ya conoce del buscador
  global (`#gsInput`).
- **Categoría sugerida restringida a categorías reales del departamento:**
  la IA no puede inventar un nombre de categoría — el prompt incluye la
  lista real (`SELECT name FROM categorias WHERE departamento IN (?,
  'iesjuanbosco')`) y debe elegir un valor exacto de esa lista o `null`.
  Sin esto, el filtro SQL `WHERE cat=?` del paso de reconocimiento visual
  nunca encontraría coincidencias reales.

## Backend — `functions/api/item.js`, acción `buscarPorSerie`

Se mantiene el nombre de la acción (compatibilidad con `ENDPOINT_MAP`/
`ACTION_PERMISSIONS` ya registrados) — solo se amplía su lógica interna.

### 1. Antes de llamar a la IA

Cargar categorías reales del departamento del usuario (mismo scoping que ya
usa el resto del endpoint):

```sql
SELECT name FROM categorias WHERE departamento IN (?, 'iesjuanbosco') ORDER BY orden
```

(`superadmin` sin `deptActivo`: usar su propio `dept` de referencia, igual
que ya hace el resto de `buscarPorSerie` hoy — no se introduce ningún
comportamiento nuevo para `superadmin` en este diseño).

### 2. Prompt ampliado

Extiende el prompt actual (que ya pide `serie`, `marca`, `modelo`) para
pedir también:

```json
{
  "serie": "220A4S1002886",
  "marca": "TP-Link",
  "modelo": "Archer TX3000E",
  "textoLibre": "Arduino UNO R3",
  "descripcionVisual": "placa de desarrollo con microcontrolador",
  "categoriaSugerida": "Electrónica"
}
```

- Instrucción explícita: si no hay ninguna etiqueta con número de serie,
  poner `serie: null` pero seguir extrayendo `textoLibre` si hay cualquier
  otro texto visible (nombre de producto, marca impresa sin S/N formal,
  etc.).
- `categoriaSugerida` debe ser exactamente uno de los nombres de categoría
  que se le pasan en el prompt, o `null` si ninguna encaja.
- Reutilizar la lección de la idea #2: ejemplo del JSON con valores
  realistas, nunca placeholders tipo `"VALOR"` — la IA puede copiarlos
  literalmente.

### 3. Cascada de resolución (código, no IA)

```
si serie          → flujo actual sin cambios (exacto / fuzzy / ninguno)
si no, textoLibre → match: 'texto', devuelve { textoLibre }, sin consulta D1
si no, descripcionVisual o categoriaSugerida →
    SELECT id, item, ref, aula, cat FROM inventario
    WHERE departamento scoping igual que el resto del endpoint
      AND (categoriaSugerida IS NULL OR cat = ?)
      AND item fuzzy-LIKE nombreSugerido (derivado de descripcionVisual)
    → match: 'visual', candidatos: [...] (puede ser array vacío),
      nombreSugerido, categoriaSugerida
si nada de lo anterior → match: 'sin_lectura' (ya existe)
```

`nombreSugerido` para el filtro LIKE: derivar de `descripcionVisual`
tomando palabras significativas (mismo criterio simple que ya usa el resto
del proyecto, sin nueva librería de fuzzy matching en backend).

## Frontend — `js/camara-serie.js`

- **`match: 'texto'`:** cerrar modal de cámara, poner el valor de
  `textoLibre` en `#gsInput` y llamar a `globalSearch()` (ya existente en
  `js/search.js`) — el profesorado ve la misma lista de resultados que ya
  conoce del buscador global, sin UI nueva que aprender.
- **`match: 'visual'` con candidatos:** misma UI que ya existe para
  `match: 'fuzzy'` (lista clicable de candidatos + "Reintentar"), añadiendo
  un botón "Crear ítem nuevo" al final de la lista — a diferencia de
  `fuzzy` (que compara un S/N exacto), aquí no hay garantía de que alguno
  de los candidatos sea realmente el objeto fotografiado.
- **`match: 'visual'` sin candidatos:** mismo patrón que `match: 'ninguno'`
  (abre modal de alta, `openModal()` + `setTimeout` para precargar campos),
  pero precargando `nombreSugerido` en `f_item` y seleccionando
  `categoriaSugerida` en el select de categoría del formulario, en vez de
  `marca`/`modelo` (que en este caso no aplican, no hay etiqueta).
- **Textos de UI:** el título del modal y el label del botón `#gsSerie`
  dejan de decir específicamente "Buscar por Nº de serie" y pasan a un
  texto genérico (p.ej. "Buscar con la cámara") que cubra los 3 casos —
  redacción exacta a decidir en implementación, revisando también el
  subtítulo dentro del modal `#mCamaraSerie`.

## Errores y casos límite

- Foto sin nada legible ni reconocible → `sin_lectura`, mismo mensaje de
  error ya existente ("prueba a acercar la cámara o mejorar la luz").
- Departamento sin categorías propias (ver gap conocido en `claude.md`,
  departamentos con solo "Material didáctico" genérico): la lista de
  categorías pasada al prompt puede tener un solo elemento o estar casi
  vacía — la IA debe poder devolver `categoriaSugerida: null` sin que eso
  rompa la cascada (cae a filtro solo por nombre, sin restricción de `cat`).
- `match: 'visual'` con candidatos y el usuario no encuentra el suyo →
  botón "Crear ítem nuevo" siempre disponible, igual que ya hace `fuzzy`
  para serie con su propio flujo de creación (reutilizar `_serieLeidaPendiente`-
  style de variables locales, pero para nombre/categoría en vez de serie).

## Testing / verificación

Mismo patrón que la sesión de la idea #1: verificación end-to-end en
producción con Playwright + foto real, cubriendo los 3 casos:
1. Foto con S/N legible → sigue funcionando igual que hoy (regresión).
2. Foto con texto sin S/N (ej. caja con "Arduino UNO R3" impreso) → abre
   buscador global con ese texto.
3. Foto de un objeto sin texto legible → propone candidatos por categoría/
   nombre, o abre alta precargada si no hay candidatos.
