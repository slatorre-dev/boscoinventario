# Onboarding de funciones de cámara (tour + ayuda permanente) — Diseño

**Fecha:** 02/08/2026
**Estado:** Aprobado, pendiente de plan de implementación
**Roadmap:** cierra el gap de descubribilidad del roadmap "Modo Cámara
Inteligente" — ver [`docs/IDEAS.md`](../../IDEAS.md#inventario-por-cámara--modo-cámara-inteligente)

## Contexto

En dos días de trabajo se construyeron e implementaron en producción 8
funciones de cámara (#1-#8 del roadmap) más lectura de código de barras
— pero ninguna tiene onboarding: el profesorado no sabe que existen, ni
cómo usarlas, ni dónde encontrarlas. Trabajo técnico completo sin trabajo
de adopción. Detectado explícitamente por el usuario tras cerrar el
roadmap técnico.

## Objetivo y alcance

Dos piezas complementarias:
1. **Tour guiado**, disparado automáticamente una vez por navegador tras
   el primer login, con las 4 funciones más representativas.
2. **Ayuda permanente**, accesible en cualquier momento desde un botón
   "❓" en Home, con las 8+ funciones completas explicadas.

**Fuera de alcance:**
- Sin persistencia en D1 del estado "tour visto" — solo `localStorage`,
  por navegador, no por usuario/cuenta.
- Sin segundo botón de ayuda duplicado en la vista de aula (donde viven
  los botones de #5/#6) — un solo punto de ayuda, accesible desde Home,
  que explica también dónde encontrar esas dos funciones.
- Sin analítica/tracking de cuántos usuarios completan el tour, lo saltan,
  o abren la ayuda — pura funcionalidad de UI, sin instrumentación nueva.
- Sin vídeo ni capturas de pantalla reales — el contenido es texto +
  iconos/emoji, mismo estilo visual ya usado en el resto de la app (sin
  producción de assets nuevos).

## Decisiones de diseño (por qué)

- **Tour + ayuda permanente combinados, no solo uno de los dos:** un tour
  que aparece una vez y se cierra no sirve de referencia cuando alguien
  lo olvida meses después; una ayuda permanente sin nada que la anuncie
  la primera vez tiene el mismo problema de descubribilidad que ya
  existe hoy. Las dos piezas resuelven problemas distintos y
  complementarios.
- **Tour cubre solo 4 de las 8+ funciones (#1, #5, #6, #3):** un tour con
  8+ pantallas se cierra sin terminar de leer. Se priorizan por uso
  esperado: #1 es la entrada más común (buscar por serie ya cubre
  también código de barras y texto libre, mismo botón/cascada interna,
  sin necesitar pantalla propia), #6 es la más "wow" para convencer del
  valor de la cámara, #5 es la más útil para auditorías periódicas pero
  la menos obvia de descubrir sin que alguien la señale, #3 muestra que
  la cámara funciona incluso sin etiqueta legible.
- **Ayuda permanente sí cubre las 8+ funciones completas:** a diferencia
  del tour (que prioriza enganchar rápido), la ayuda es para cuando el
  profesorado ya sabe que la cámara existe y busca algo concreto — ahí
  sí vale la pena la lista completa.
- **`localStorage`, no D1:** el estado "ya vi el tour" es puramente
  informativo, sin ningún caso de uso que requiera seguirlo entre
  dispositivos — añadir una columna D1 y su migración sería
  sobre-ingeniería para una bandera sin consecuencias funcionales.
  Mismo patrón que otros flags ya existentes en el proyecto (ej.
  `volt_intents_migrated_v1`).
- **Un solo botón de ayuda en Home, no duplicado en vista de aula:**
  menos UI que mantener; el modal de ayuda menciona explícitamente que
  #5/#6 se acceden desde dentro de una aula concreta, así que no hace
  falta repetir el punto de entrada en ese contexto.
- **El modal de ayuda puede reabrir el tour:** evita duplicar contenido
  — si alguien quiere volver a ver el recorrido paso a paso tras
  consultar la ayuda rápida, reutiliza el mismo componente en vez de
  mantener dos versiones del mismo contenido.

## Flujo

### Tour guiado

1. Tras un login exitoso (mismo punto donde ya se resuelve la sesión y
   se carga `Home`), se comprueba `localStorage.getItem('tour_camara_visto_v1')`.
2. Si no existe, se abre un modal nuevo (`#mTourCamara`) con 4 pantallas
   navegables mediante botones "Siguiente"/"Atrás", más un botón
   "Saltar" visible en todo momento:
   - Pantalla 1 — #1 Buscar por número de serie: "Apunta la cámara a la
     etiqueta de un equipo y encuéntralo al instante en el inventario."
   - Pantalla 2 — #6 Multi-equipo en una foto: "Fotografía una mesa
     entera con varios equipos nuevos y créalos todos de golpe."
   - Pantalla 3 — #5 Inventario andando: "Recorre un aula fotografiando
     cada equipo, uno tras otro, y confirma que todo está donde debe."
   - Pantalla 4 — #3 Reconocimiento visual: "Aunque el equipo no tenga
     ninguna etiqueta legible, la cámara puede reconocerlo igual."
3. Al llegar a la última pantalla, al pulsar "Saltar", o al cerrar el
   modal por cualquier vía, se marca
   `localStorage.setItem('tour_camara_visto_v1', '1')` — no vuelve a
   aparecer automáticamente en ese navegador, sea cual sea la vía de
   cierre.

### Ayuda permanente

1. Botón nuevo "❓" en `.gsearch-extra-btns` (`index.html`, junto al
   botón ya existente "🔢 Buscar con la cámara").
2. Abre un modal (`#mAyudaCamara`) con una lista simple (icono + título +
   una línea de descripción cada una, sin carrusel, todo visible de un
   vistazo o con scroll simple) cubriendo las 8+ funciones:
   - Buscar por número de serie (incluye código de barras y texto libre,
     mencionados como parte de la misma cascada, no como entradas
     separadas).
   - Reconocimiento visual sin etiqueta.
   - Autocompletado de marca/modelo al dar de alta.
   - Multi-equipo en una foto — con nota explícita: "disponible dentro
     de la vista de una aula concreta, botón 📸 Añadir varios".
   - Inventario andando — con nota explícita: "disponible dentro de la
     vista de una aula concreta, botón 📷 Revisar aula".
3. Al final del modal, botón "▶ Ver tour guiado" que cierra este modal y
   abre `#mTourCamara` desde el principio — reutiliza el mismo
   componente del tour, sin duplicar el contenido de las 4 pantallas.

## Errores y casos límite

- `localStorage` no disponible (modo incógnito estricto, navegador con
  almacenamiento deshabilitado): el tour podría reaparecer en cada
  sesión — aceptable, es un caso raro y el peor escenario es ver el tour
  más de una vez, no perder ninguna funcionalidad.
- Usuario que nunca ha usado ningún ítem/aula todavía (departamento
  recién creado): el tour y la ayuda funcionan igual, son contenido
  estático sin depender de datos reales del inventario.
- Reabrir el tour desde la ayuda permanente después de ya haberlo visto
  la primera vez: funciona igual, sin relanzar el flag de "primera vez"
  ni ningún efecto colateral — es solo mostrar el mismo modal bajo
  demanda.

## Archivos afectados

- Modificar: `index.html` — botón "❓" nuevo en `.gsearch-extra-btns`,
  modal nuevo `#mTourCamara` (4 pantallas), modal nuevo `#mAyudaCamara`
  (lista completa).
- Nuevo: `js/onboarding-camara.js` — lógica de apertura automática tras
  login (comprobación de `localStorage`), navegación entre pantallas del
  tour, apertura/cierre de la ayuda permanente, puente entre ambos
  modales ("Ver tour guiado" desde la ayuda).
- Modificar: el punto exacto donde se resuelve un login exitoso (a
  determinar en el plan de implementación, revisando `js/auth.js`/`loadData()`)
  — para disparar la comprobación del tour tras cargar `Home`.
- Sin backend, sin migración D1, sin nuevas acciones en `js/api.js` ni
  `js/roles.js` — todo cliente.

## Testing / verificación

Verificación manual/Playwright en producción:
1. Borrar `localStorage` (o usar una sesión de navegador limpia), hacer
   login → confirmar que el tour se abre automáticamente mostrando la
   pantalla 1.
2. Navegar las 4 pantallas con "Siguiente"/"Atrás" → confirmar contenido
   correcto en cada una y que los botones de navegación funcionan en
   ambos sentidos.
3. Cerrar el tour a mitad de camino (botón "Saltar" o cerrar el modal) →
   confirmar que `localStorage` queda marcado y recargar la página no
   vuelve a mostrar el tour automáticamente.
4. Con el tour ya visto, hacer login de nuevo → confirmar que NO se abre
   automáticamente.
5. Click en el botón "❓" de Home → confirmar que abre la ayuda completa
   con las 8+ funciones listadas, incluyendo las notas de "disponible
   desde una aula concreta" para #5/#6.
6. Desde la ayuda, click en "Ver tour guiado" → confirmar que abre el
   tour desde la pantalla 1, sin duplicar ni romper el flag de
   `localStorage` ya marcado.
