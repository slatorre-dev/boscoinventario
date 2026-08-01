# Autocompletado de marca/modelo desde la etiqueta (número de serie)

**Fecha:** 01/08/2026
**Origen:** idea #2 del roadmap "Modo Cámara Inteligente" del usuario, explícitamente dejada fuera de alcance en la spec original de `buscarPorSerie` (`2026-08-01-busqueda-por-numero-serie-design.md`). Ahora se implementa como extensión pequeña de esa feature ya en producción.

## Contexto

`buscarPorSerie` (`functions/api/item.js`) ya llama a Cloudflare Workers AI (`@cf/moondream/moondream3.1-9B-A2B`, `task:'query'`, `reasoning:true`) con una foto de etiqueta, pidiendo JSON `{"serie": "VALOR"|null}`. Cuando no hay match (`match:'ninguno'`), el frontend (`js/camara-serie.js:_mostrarSerieCrearNuevo()`) ofrece "Crear ítem nuevo con S/N: X", que abre el modal de alta y precarga solo el campo `f_serie`.

El proyecto no tiene campos separados "marca"/"modelo" — usa `item` (nombre completo del ítem, ej. "Osciloscopio Rigol DS1054Z") y `proveedor` (texto libre, marca/tienda/URL).

## Alcance

Ampliar el mismo prompt de `buscarPorSerie` para que, en la misma llamada a la IA, también extraiga marca y modelo visibles en la etiqueta. Cuando el resultado es `match:'ninguno'`, la respuesta incluye `marca`/`modelo` (pueden venir vacíos). Al crear el ítem nuevo desde ese flujo, el modal de alta precarga además `f_item` (con "Marca Modelo" si ambos se detectaron) y `f_proveedor` (con la marca).

### Fuera de alcance
- No se toca el caso `match:'exacto'`/`'fuzzy'` — ya hay un ítem real, no aplica autocompletado.
- No se crean campos nuevos en `inventario` — se reusan `item`/`proveedor` existentes.
- No se autocompleta categoría, aula, ni otros campos — solo nombre y proveedor.
- Sigue siendo una sola llamada a la IA (no dos), sin coste ni latencia adicional.

## Backend (`functions/api/item.js`, acción `buscarPorSerie`)

Prompt ampliado:
```
Analiza esta etiqueta de equipo y responde SOLO con JSON:
{"serie": "VALOR o null", "marca": "VALOR o null", "modelo": "VALOR o null"}
Extrae el número de serie (S/N, Serial Number, Service Tag), la marca del
fabricante, y el modelo del equipo, si son visibles. No añadas explicaciones.
```

Parseo: además de `serieLeida`, se extraen `marca`/`modelo` del mismo JSON parseado. Cuando el flujo llega a `match:'ninguno'`, la respuesta pasa a ser `{ok:true, match:'ninguno', serieLeida, marca, modelo}` (strings vacíos si no se detectaron, mismo patrón que `serieLeida`).

Los casos `exacto`/`fuzzy`/`sin_lectura` no cambian su forma de respuesta.

## Frontend (`js/camara-serie.js`)

- `_mostrarSerieCrearNuevo(serieLeida, marca, modelo)` guarda los 3 valores en variables de módulo (`_serieLeidaPendiente`, `_marcaPendiente`, `_modeloPendiente`).
- `_crearItemDesdeSerie()` precarga, además de `f_serie`:
  - `f_item`: `` `${marca} ${modelo}`.trim() `` si al menos uno de los dos vino no vacío; si ambos vacíos, no toca `f_item` (queda como lo deja `openModal()` para alta nueva, vacío).
  - `f_proveedor`: `marca` si vino no vacía; si no, no la toca.
- El texto del botón "Crear ítem nuevo" se enriquece cuando hay marca/modelo detectados, ej. "Crear ítem nuevo: TP-Link Archer TX3000E (S/N: 220A4S1002886)" en vez de solo mostrar el S/N — mejor feedback de que la IA detectó algo más.

## Testing

Verificación manual en producción con la misma foto de prueba ya usada (router TP-Link Archer TX3000E) — comprobar que `marca`/`modelo` llegan pobladas razonablemente (aunque sea con algún error de OCR, igual que pasó con el S/N) y que el modal de alta aparece con `f_item`/`f_proveedor` ya rellenados.
