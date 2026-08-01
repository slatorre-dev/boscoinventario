# Inventario andando (modo revisión rápida por aula) — Diseño

**Fecha:** 01/08/2026
**Estado:** Aprobado, pendiente de plan de implementación
**Roadmap:** idea #5 de [`docs/IDEAS.md`](../../IDEAS.md#inventario-por-cámara--modo-cámara-inteligente)

## Contexto

Roadmap original: "Recorrer el taller apuntando la cámara a cada equipo,
confirmando ubicación/estado uno tras otro sin abrir el modal completo cada
vez." Se apoya en la cascada de reconocimiento ya construida (`buscarPorSerie`,
ideas #1/#3/#4, ya en producción) y necesita una UI nueva de "modo revisión"
más ligera que el modal de edición normal.

## Objetivo y alcance

Un profesor entra al modo revisión desde una aula concreta ya elegida en la
app, fotografía equipos uno tras otro sin abrir el modal de edición
completo, y cada foto se resuelve como: confirmado en esta aula, encontrado
pero registrado en otra aula (con corrección al instante), o no
identificado. Al terminar, un resumen simple: qué se confirmó vs. qué
ítems esperados en el aula nunca aparecieron.

**Fuera de alcance:**
- No hay captura continua/en vivo (cámara en bucle) — foto fija + botón
  "Siguiente", mismo patrón que `js/camara-serie.js`.
- No se puede crear un ítem nuevo desde este modo (ya cubierto por el flujo
  general de cámara).
- No se persiste ninguna fecha de "última verificación" en D1 — el
  resumen de confirmados/no-encontrados es efímero, vive solo en memoria
  del navegador durante la sesión de revisión y se pierde al cerrar el
  modal.
- No se generaliza ni modifica `buscarPorSerie` — se reutiliza tal cual.
- No cubre edición de estado/cantidad/mantenimiento durante la revisión —
  solo confirmar presencia, y como único caso especial, corregir el aula
  de un ítem mal ubicado.

## Decisiones de diseño (por qué)

- **Selección de aula manual, no automática:** más fiable que detectar el
  aula por el primer objeto reconocido (que fallaría en silencio si ese
  primer objeto no se reconoce) y no depende de GPS/geolocalización, que
  esta app no usa en ningún otro sitio.
- **Solo confirmar presencia, sin edición completa:** cubre el caso de uso
  principal (auditar que el inventario declarado coincide con la realidad
  del aula) sin duplicar el modal de edición ya existente. Editar
  cantidad/estado/mantenimiento durante la revisión queda fuera para no
  convertir esto en un segundo modal de edición a mantener en paralelo.
- **Reusa `buscarPorSerie` sin cambios:** cero código de IA nuevo. El modo
  revisión solo interpreta el resultado (`match: 'exacto'|'fuzzy'`, y
  comparando `item.aula` contra el aula que se está revisando) en vez de
  abrir modales de creación como hace el flujo general.
- **Corrección de aula al instante:** si un ítem aparece fotografiado en
  un aula distinta a la registrada, ofrecer corregirlo ahí mismo
  (reutilizando la acción `update` ya existente en `functions/api/item.js`,
  cambiando solo el campo `aula`) es todo el propósito de auditar así — un
  aviso sin acción obligaría a repetir el trabajo después en el modal
  normal.
- **Resumen efímero, sin persistencia D1:** evita decidir de golpe qué
  significa "última verificación" para el resto de la app (quién la ve,
  para qué se usa después, si dispara alertas) — eso es una feature aparte
  si se necesita en el futuro. Este diseño se limita a informar en el
  momento.

## Flujo

1. **Entrada:** en la vista de aula (`cf.type==='aula'` en `js/nav.js`,
   renderizada por `openSub()`), aparece un botón nuevo "📷 Revisar aula"
   en la barra `.action-strip` (`index.html`, junto a "＋ Añadir ítem",
   "⌛ Nuevo préstamo", etc.) — visible solo cuando `cf.type==='aula'`,
   oculto en las demás vistas de sub-página (categoría, stock bajo,
   mantenimiento...), mismo patrón de mostrar/ocultar por tipo que ya usan
   `btnN`/`btnE` en `js/nav.js`.
2. Click abre un modal nuevo (`#mRevisionAula`), reutilizando la
   infraestructura de cámara ya existente (`getUserMedia` + canvas +
   captura de foto fija, mismo patrón que `js/camara-serie.js`).
3. Cámara abierta, botón "Capturar". Cada foto capturada llama a la acción
   `buscarPorSerie` ya existente (sin cambios de backend).
4. Según el resultado:
   - **`match: 'exacto'` o `'fuzzy'`, y `item.aula === aulaEnRevision`** →
     tarjeta verde "✓ [nombre del ítem] confirmado", se añade a una lista
     de confirmados en memoria (array en el frontend, no persistido).
   - **`match: 'exacto'` o `'fuzzy'`, pero `item.aula !== aulaEnRevision`**
     → tarjeta amarilla "⚠ Este ítem figura en [nombre del aula real]" +
     botón "Actualizar a esta aula", que llama a la acción `update` ya
     existente (`functions/api/item.js`) cambiando únicamente el campo
     `aula` del ítem al aula que se está revisando. Tras confirmar el
     cambio, se trata como confirmado en la lista de esta sesión.
   - **`match: 'texto'`, `'visual'` o `'sin_lectura'`** → tarjeta neutra
     "No identificado, prueba otra foto" — sin más acción, no se ofrece
     crear ítem nuevo en este modo (fuera de alcance).
5. Botón "Siguiente" limpia la tarjeta de resultado y vuelve a mostrar la
   cámara para la próxima foto, sin cerrar el modal — el profesor puede
   encadenar fotos de varios equipos sin volver a abrir nada.
6. Botón "Terminar revisión" cierra el modal de cámara y muestra un
   resumen: lista de ítems del aula confirmados durante la sesión, y lista
   de ítems que estaban esperados en el aula (`items.filter(x => x.aula
   === aulaEnRevision)`, ya cargados en el frontend) pero nunca aparecieron
   confirmados — etiquetados como "no verificado", sin implicar que estén
   ausentes (el profesor puede simplemente no haberlos fotografiado).

## Errores y casos límite

- Aula sin ítems esperados (departamento nuevo o aula recién creada): el
  resumen final solo muestra confirmados de la sesión, sin lista de "no
  verificados" vacía generando ruido visual.
- Cámara denegada o sin hardware disponible: mismo mensaje de error ya
  usado en `camara-serie.js` ("Acceso denegado a la cámara...", "No se
  encontró cámara...").
- Ítem fotografiado no pertenece al departamento del usuario (por scoping
  de `buscarPorSerie`, ya cubierto): sencillamente no aparece como
  candidato — comportamiento heredado del endpoint, sin cambio necesario
  aquí.
- Cerrar el modal de revisión sin pulsar "Terminar" (ej. botón atrás o
  clic fuera): se pierde el resumen de la sesión sin confirmación —
  aceptable dado que nada se ha persistido salvo los cambios de aula ya
  aplicados uno a uno (esos sí quedan guardados, por ser llamadas
  `update` individuales ya confirmadas en el momento).

## Archivos afectados (sin migración, sin cambios de backend)

- Nuevo: `js/revision-aula.js` — paralelo a `js/camara-serie.js`, mismo
  patrón de cámara, con su propia lógica de interpretación de resultados
  contra el aula en revisión.
- Modificar: `index.html` — nuevo botón en `.action-strip` (mostrado solo
  para `cf.type==='aula'`), nuevo modal `#mRevisionAula`.
- Modificar: `js/nav.js` — `openSub()` muestra/oculta el botón nuevo según
  `cf.type`, mismo patrón que `btnN`/`btnE`.

## Testing / verificación

Mismo patrón que las ideas #1-#4 ya implementadas: verificación end-to-end
en producción con Playwright, interceptando la respuesta de red de
`buscarPorSerie` con mocks controlados (exacto en la misma aula, exacto en
otra aula, sin match) para no depender de fotos reales ni del modelo de IA
en cada verificación, cubriendo:
1. Confirmación en la aula correcta → tarjeta verde, aparece en resumen final.
2. Ítem encontrado en otra aula → tarjeta amarilla, botón de corrección
   funciona y persiste en D1 (verificar con `wrangler d1 execute`).
3. Sin match → tarjeta neutra, no aparece en el resumen como confirmado.
4. Resumen final calcula correctamente confirmados vs. no verificados.
