# Unificar botones de QR y búsqueda por cámara — Diseño

**Fecha:** 02/08/2026
**Estado:** Aprobado, pendiente de plan de implementación
**Roadmap:** idea #13 de [`docs/IDEAS.md`](../../IDEAS.md#inventario-por-cámara--modo-cámara-inteligente)

## Contexto

Home tiene hoy dos botones de cámara separados: "Escanear QR" (`#gsQr`,
abre `js/qr-scanner.js`, escaneo continuo con la librería `jsQR`) y
"Buscar con la cámara" (`#gsSerie`, abre `js/camara-serie.js`, foto fija +
IA, con intento previo de código de barras vía `BarcodeDetector` nativo
desde v549). El usuario tiene que decidir de antemano cuál de los dos
pulsar según lo que va a fotografiar — carga cognitiva evitable, ya que
técnicamente la cámara puede decidir sola qué está viendo.

## Objetivo y alcance

Un solo botón "🎥 Buscar con cámara (QR o S/N)" en Home, que abre un modo
de escaneo continuo único capaz de reconocer QR propio de la app, código
de barras de fábrica, o (si no detecta ninguno de los dos tras varios
segundos) ofrecer pasar a foto fija + OCR de IA bajo demanda del usuario.

**Fuera de alcance:**
- No cambia el comportamiento de resultado según lo detectado: un QR
  sigue abriendo el panel de acciones rápidas ya existente
  (`_showQrActions()`), un código de barras/S/N sigue abriendo la ficha
  directa o candidatos (comportamiento ya existente de
  `buscarSeriePorCodigo`/`buscarPorSerie`) — unificar el punto de entrada
  no implica unificar también la salida.
- No cambia el backend — reutiliza `buscarSeriePorCodigo` y
  `buscarPorSerie` tal cual existen hoy, sin modificarlos.
- No introduce reconocimiento visual/multi-equipo/inventario-andando en
  este flujo — esas 3 funciones siguen teniendo sus propios puntos de
  entrada (dentro de la cascada de `buscarPorSerie` para reconocimiento
  visual/texto libre; botones propios en vista de aula para multi-equipo
  e inventario andando).
- No cambia `js/multi-equipo.js` ni `js/revision-aula.js` — ninguno de
  los dos usa escaneo continuo, quedan fuera de esta unificación.

## Decisiones de diseño (por qué)

- **Un solo bucle de escaneo continuo con `BarcodeDetector`, no dos
  motores corriendo en paralelo por defecto:** `BarcodeDetector` (ya
  integrado en `camara-serie.js` desde v549 para código de barras) admite
  el formato `qr_code` en su lista de `formats` — un solo detector puede
  cubrir QR + código de barras lineal en la misma pasada por frame, sin
  necesitar `jsQR` en el caso común. Menos código, un solo bucle de
  `requestAnimationFrame` en vez de mantener dos módulos con patrones de
  captura distintos.
- **`jsQR` como fallback condicional, no eliminado:** el soporte de
  `qr_code` en `BarcodeDetector` varía entre navegadores. Al abrir el
  modo unificado, se comprueba `BarcodeDetector.getSupportedFormats()` —
  si `qr_code` no aparece en la lista, se activa `jsQR` en paralelo sobre
  el mismo frame (dos detectores, un solo bucle de captura) solo para
  cubrir ese hueco puntual. Esto evita perder cobertura de QR en
  cualquier navegador, sin asumir que `BarcodeDetector` es universal para
  ese formato.
- **Botón manual para pasar a IA, no automático tras N segundos:** el
  bucle de escaneo no tiene coste (cámara + CPU local, sin llamadas de
  red), así que no hay presión para forzar una transición automática. Un
  botón visible tras ~3 segundos sin detección da control explícito al
  usuario — evita disparar una llamada a IA (con coste real de Workers
  AI) en un momento en que el usuario aún está acomodando el encuadre.
- **Resultado NO se unifica, solo el punto de entrada:** el panel de
  acciones rápidas de QR y la apertura directa de ficha por S/N son dos
  comportamientos ya en producción y ya entendidos por el profesorado —
  cambiar el resultado sería una regresión de UX sin beneficio claro,
  fuera del problema real que esta idea busca resolver (elegir el botón
  correcto de antemano).

## Flujo

1. Un solo botón en `.gsearch-extra-btns` (Home): "🎥 Buscar con cámara
   (QR o S/N)", sustituye a `#gsQr` y `#gsSerie`.
2. Abre un modal único con escaneo continuo (mismo patrón de captura de
   frames que ya usa `js/qr-scanner.js`, adaptado): `getUserMedia()` +
   `requestAnimationFrame()` dibujando cada frame en un `canvas`.
3. Al abrir, se comprueba `typeof BarcodeDetector !== 'undefined' &&
   BarcodeDetector.getSupportedFormats` (donde exista) para decidir si
   `qr_code` está cubierto nativamente o si hace falta activar `jsQR` en
   paralelo sobre el mismo frame.
4. Cada frame se pasa a `BarcodeDetector.detect()` con `formats:
   ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e']` (más
   `jsQR` en paralelo si `qr_code` no está soportado nativamente).
5. Según el primer resultado detectado:
   - Si es un QR de la app (mismo patrón de reconocimiento ya usado en
     `qr-scanner.js`: `code.data.match(/item\/([a-zA-Z0-9_-]+)/)`) →
     mismo comportamiento actual, abre el panel de acciones rápidas
     (`_showQrActions()`, reutilizado sin cambios).
   - Si es cualquier otro código (barcode lineal) → llama a la acción ya
     existente `buscarSeriePorCodigo` con el valor decodificado, mismo
     comportamiento actual (abre ficha si `exacto`, candidatos si
     `fuzzy`, sigue escaneando si `ninguno`).
6. Si pasan ~3 segundos sin ninguna detección, aparece un botón "No lo
   detecta, buscar con IA" — al pulsarlo, se congela el frame actual
   (captura una foto fija del mismo `canvas` ya en uso) y se sigue
   exactamente el flujo ya existente de `buscarPorSerie` (OCR de
   serie/texto libre/reconocimiento visual vía IA), reutilizando la
   cascada completa ya construida.
7. El bucle de escaneo se detiene al: detectar algo con match útil, pulsar
   "buscar con IA" (transición a foto fija), o cerrar el modal.

## Errores y casos límite

- Navegador sin `getUserMedia` en absoluto: mismo mensaje de error ya
  usado en ambos módulos actuales ("Este navegador no permite acceder a
  la cámara").
- `BarcodeDetector` no existe en absoluto (ej. navegador muy antiguo):
  todo el escaneo continuo depende entonces solo de `jsQR` (QR) — sin
  detección de código de barras en el bucle continuo, pero el botón "No
  lo detecta, buscar con IA" sigue disponible igual, y esa vía SÍ intenta
  `BarcodeDetector` de nuevo sobre la foto fija si estuviera disponible
  (aunque si no existe en absoluto, tampoco estará ahí — coherente, sin
  comportamiento sorprendente).
- Código de barras detectado con `buscarSeriePorCodigo` devolviendo
  `match:'ninguno'`: el bucle de escaneo continuo sigue corriendo (no se
  detiene, no cae automáticamente a IA) — el usuario puede seguir
  intentando otro ángulo/código, o pulsar el botón de IA si ya pasaron
  los ~3 segundos.
- Cámara detecta un QR Y un código de barras en el mismo frame (ej. una
  caja con ambos): se usa el primer resultado que el detector devuelva en
  su array — sin lógica de desambiguación adicional (mismo criterio ya
  aceptado en la mejora de código de barras para múltiples códigos en una
  foto).

## Archivos afectados

- Nuevo o renombrado: módulo unificado de cámara (a decidir nombre exacto
  en el plan de implementación — candidatos: fusionar dentro de
  `js/camara-serie.js` ampliado, o un archivo nuevo `js/camara-unificada.js`
  que orqueste el escaneo continuo y delegue en las funciones ya
  existentes de `qr-scanner.js`/`camara-serie.js` sin duplicar lógica).
- Modificar: `index.html` — un solo botón sustituye a `#gsQr`/`#gsSerie`,
  modal único (puede reusar/fusionar la estructura de `#mQrScanner`/
  `#mCamaraSerie` existentes).
- Sin cambios de backend — `buscarSeriePorCodigo` y `buscarPorSerie` se
  reutilizan sin modificar.
- Sin migración D1.
- A decidir en el plan: si `js/qr-scanner.js` y las partes de
  `js/camara-serie.js` dedicadas a la foto fija se mantienen como
  archivos separados (con el nuevo módulo orquestando ambos) o se
  fusionan en uno solo — cualquiera de las dos es válida, la decisión
  depende de cuánto código quede realmente compartido tras el diseño
  detallado en el plan.

## Testing / verificación

Mismo patrón que el resto del roadmap: verificación end-to-end en
producción con Playwright, con mocks para no depender de códigos reales:
1. Mock de `BarcodeDetector` devolviendo un QR válido (`rawValue`
   conteniendo `item/<id>`) → confirma que abre el panel de acciones
   rápidas, no la búsqueda de serie.
2. Mock de `BarcodeDetector` devolviendo un código de barras/S/N válido
   con match exacto en D1 → confirma que llama a `buscarSeriePorCodigo` y
   abre la ficha directa, sin pasar por `jsQR` ni por IA.
3. Mock de `BarcodeDetector.getSupportedFormats()` sin `qr_code` en la
   lista → confirma que `jsQR` se activa en paralelo y sigue detectando
   QR igual.
4. Sin detección tras varios segundos → confirma que aparece el botón
   "No lo detecta, buscar con IA", y que pulsarlo transiciona
   correctamente al flujo de foto fija existente.
5. Regresión: confirmar que el flujo de foto fija + IA (una vez
   transicionado) sigue funcionando exactamente igual que antes de esta
   unificación (mismos 4 casos de la cascada: serie/texto/visual/código
   de barras vía OCR, sin escaneo continuo).
