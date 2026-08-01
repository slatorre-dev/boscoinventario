# Enlaces a manual/datasheet/vídeo del equipo — Diseño

**Fecha:** 01/08/2026
**Estado:** Aprobado, pendiente de plan de implementación
**Roadmap:** idea #7 de [`docs/IDEAS.md`](../../IDEAS.md#inventario-por-cámara--modo-cámara-inteligente)

## Contexto

Roadmap original: "Una vez identificado el modelo de un equipo (vía #2 o
#3), ofrecer enlaces a su manual/datasheet/vídeos. Necesita decidir la
fuente (búsqueda web real vía alguna API, o una base de enlaces curada a
mano por el centro) — no es solo un cambio de prompt, es una pieza nueva
de infraestructura."

La decisión de diseño de esta sesión (búsqueda web automática, sin API de
pago ni base de datos curada) simplifica radicalmente la estimación
original: no hace falta infraestructura nueva, es una función JS que
construye URLs de búsqueda a partir de datos que el modal de ítem ya
tiene.

## Objetivo y alcance

En el modal de edición/creación de ítem, mostrar 3 enlaces (manual,
datasheet, vídeo) que abren una búsqueda web ya formada con marca+nombre
del equipo, para cualquier ítem que tenga esos dos campos rellenados — no
solo los creados vía cámara (ideas #2/#3), también los cientos de ítems
ya inventariados a mano que tengan proveedor y nombre.

**Fuera de alcance:**
- Sin API de búsqueda de pago, sin scraping, sin verificación de que el
  resultado de búsqueda contenga realmente un manual — son enlaces de
  búsqueda, no enlaces directos a un documento.
- Sin base de datos de enlaces curados a mano, sin campo nuevo en D1, sin
  posibilidad de "guardar" un enlace bueno para reutilizar — puro cálculo
  en el momento a partir de campos ya existentes.
- Sin integración con el flujo de cámara (ideas #1-#4) más allá de que
  esos flujos ya rellenan `f_proveedor`/`f_item`, que es lo que este
  diseño consume — no se añade nada a `camara-serie.js`,
  `revision-aula.js` ni `multi-equipo.js`.
- Sin campo "modelo" nuevo — se usa lo que ya existe (`f_proveedor` +
  `f_item`), sin tocar el esquema de `inventario`.

## Decisiones de diseño (por qué)

- **Búsqueda web automática, no base curada:** una base curada arranca
  vacía (0 utilidad el primer día) y requiere mantenimiento humano
  continuo sin que nadie en el centro lo haya pedido explícitamente. Una
  búsqueda web funciona desde el primer minuto para cualquier equipo, sin
  mantenimiento.
- **3 enlaces separados (manual/datasheet/vídeo), no uno genérico:** cada
  query se especializa con una palabra clave distinta (`manual pdf`,
  `datasheet`, `tutorial video`), dando resultados más precisos que una
  sola búsqueda ambigua que mezcle los 3 conceptos.
- **Solo en el modal de edición del ítem, no en el flujo de cámara:** el
  modal de edición es el único punto que sirve tanto a ítems nuevos (vía
  cámara) como a los cientos de ítems ya inventariados a mano —
  ponerlo solo en el flujo de cámara dejaría fuera a la mayoría del
  inventario existente sin razón técnica que lo justifique.
- **Condicionado a `f_proveedor` + `f_item` con contenido:** sin proveedor
  la búsqueda sería demasiado genérica para ser útil (ej. buscar solo
  "multímetro manual pdf" no apunta a un modelo concreto) — mejor no
  mostrar los enlaces que mostrar unos inútiles.
- **`f_proveedor` + `f_item` concatenados, sin campo modelo nuevo:** evita
  tocar el esquema de `inventario` por una feature que no lo necesita —
  el nombre del ítem ya suele incluir el modelo cuando viene del flujo de
  cámara (ideas #2/#3 precargan "Marca Modelo" en `f_item`), y para
  ítems inventariados a mano, el nombre que el profesor haya puesto ahí
  es la mejor información disponible sin pedirle que rellene un campo
  nuevo.

## Flujo

1. En el modal de edición/creación de ítem, sección DETALLES, junto al
   campo Proveedor (`#f_proveedor` en `index.html`), tres enlaces
   pequeños: "📄 Manual", "📋 Datasheet", "🎥 Vídeo".
2. Visibles/habilitados solo cuando tanto `#f_proveedor` como `#f_item`
   tienen contenido no vacío (trim). Si falta alguno, los 3 enlaces no se
   muestran (o se muestran deshabilitados con un tooltip explicando por
   qué) — decisión de implementación menor, cualquiera de las dos formas
   es aceptable.
3. Cada enlace abre una nueva pestaña (`target="_blank"`) apuntando a una
   URL de búsqueda construida en JS puro, sin llamada a ningún backend:
   - Manual: query = `${proveedor} ${item} manual pdf`
   - Datasheet: query = `${proveedor} ${item} datasheet`
   - Vídeo: query = `${proveedor} ${item} tutorial video`

   Motor de búsqueda: Google (`https://www.google.com/search?q=`), mismo
   criterio que cualquier enlace de búsqueda ya usado en el proyecto (si
   existiera alguno; si no, es la opción por defecto razonable sin
   depender de configuración adicional).
4. Los 3 enlaces se recalculan en vivo si el usuario edita `f_proveedor` o
   `f_item` mientras el modal está abierto — mismo patrón de reactividad
   ya usado en el modal para otros avisos en tiempo real (ej. el aviso de
   stock bajo al cambiar cantidad).

## Errores y casos límite

- `f_proveedor` o `f_item` vacíos → enlaces no visibles/deshabilitados,
  sin mensaje de error (es un estado normal, no un fallo).
- Caracteres especiales en proveedor/nombre (ej. `&`, `+`, tildes) → deben
  pasar por `encodeURIComponent()` antes de construir la URL de búsqueda,
  para no romper el query string.
- Proveedor o nombre extremadamente largos → sin truncado especial
  necesario, una URL de búsqueda de Google tolera queries largos sin
  problema práctico para este caso de uso.

## Archivos afectados

- Modificar: `index.html` — 3 enlaces nuevos junto a `#f_proveedor` en la
  sección DETALLES del modal de ítem.
- Modificar: `js/modal-item.js` — función de recálculo de las 3 URLs,
  enganchada a los eventos `input`/`change` de `#f_proveedor` y `#f_item`
  (o recalculada al abrir el modal y en cada edición relevante, según el
  patrón ya usado por el aviso de stock bajo existente en el mismo
  archivo).
- Sin cambios de backend, sin migración D1, sin nuevas acciones en
  `js/api.js` ni `js/roles.js`.

## Testing / verificación

Verificación manual (o con Playwright) en producción:
1. Abrir un ítem existente con proveedor y nombre rellenados → los 3
   enlaces aparecen y apuntan a URLs de búsqueda con las queries
   esperadas (verificar el `href` generado, no hace falta seguir el
   enlace real).
2. Abrir un ítem sin proveedor → los 3 enlaces no aparecen o aparecen
   deshabilitados.
3. Editar el campo proveedor con el modal abierto → los 3 `href` se
   actualizan en vivo reflejando el nuevo valor.
4. Nombre/proveedor con caracteres especiales (`&`, tildes) → la URL
   generada los codifica correctamente vía `encodeURIComponent`, sin
   romper el query string.
