# Préstamos: fuente única de prestatarios + buscadores

## Objetivo

Dos problemas detectados en el flujo de Préstamos:

1. Los prestatarios se gestionan por duplicado: la tabla `profesores`
   (modal 👥, CRUD manual + import CSV) y los usuarios de la app (⚙️
   Usuarios) alimentan el mismo selector, aunque el backend ya los fusiona
   sin duplicados visibles. Mantener ambos como "fuentes editables" es
   confuso y genera filas basura en `profesores` que coinciden con
   usuarios reales.
2. Faltan buscadores rápidos en dos selects largos: el de profesor/a en
   los modales de préstamo, y el de ítem/caja en el modal de préstamo de
   caja completa (que hoy solo se puede abrir con una caja ya fijada desde
   la fila del inventario).

## 1. Fuente única de prestatarios

- El modal 👥 pasa a ser exclusivamente **"Prestatarios externos"**:
  gente sin cuenta de login en la app (profesor de otro centro, personal
  externo, etc.).
- `openProfModal()` / `renderProfList()` (`js/prestamos.js`) filtran la
  lista a `source !== 'usuarios'` antes de poblar `profEditing` — hoy
  traen ambas fuentes y solo marcan las de `usuarios` como readonly.
- Botón `+ Añadir profesor/a` → `+ Añadir prestatario externo`. Mismo
  CRUD, mismo import/export CSV, sin cambios de comportamiento salvo el
  filtro de qué filas se listan.
- El selector de préstamo (`loanTeacherOptions()`) no cambia: sigue
  usando `profesores` (ya fusionado por el backend en
  `list.js:mergeProfesores`), que combina usuarios de la app + tabla
  `profesores` (ahora solo externos).
- **Migración `migrations/0021_limpiar_profesores_duplicados.sql`**:
  borra de `profesores` las filas cuyo nombre o email (normalizado:
  minúsculas, sin tildes, trim — mismo criterio que `normKey()` en
  `list.js`) coincide con algún `usuarios.nombre`/`usuarios.email` del
  mismo departamento. Antes de aplicar en remoto, exportar backup con
  `wrangler d1 export` (ya es práctica habitual en este proyecto).

## 2. Buscador de profesor/a

- Mismo patrón visual que el buscador de ítem ya existente
  (`pres_filtQ` + `<select id="pres_item">`): un `<input>` de texto
  encima del `<select>` de profesor, que filtra las opciones en vivo por
  nombre normalizado (sin tildes, case-insensitive) en `oninput`.
- Aplica en:
  - Modal préstamo individual: `<select id="pres_prof">`.
  - Modal préstamo de caja: `<select id="prestarCajaProf">`.
- Implementación: nueva función `filterProfSelect(inputId, selectId)`
  reutilizable por ambos modales, que reconstruye las `<option>` a partir
  de la lista ya calculada por `loanTeacherOptions()` (guardada en una
  variable de módulo al abrir el modal, para no recalcular el merge en
  cada tecla).
- No cambia `loanTeacherOptions()` ni la preselección del profesor
  logueado — solo el render inicial pasa a ir a través de la nueva
  función de filtro.

## 3. Selector de caja en el modal de préstamo de caja completa

- Hoy `openPrestarCaja(cajaId)` siempre requiere un `cajaId` (solo se
  llama desde el botón 📦⌛ de una fila de contenedor en el inventario).
- Se añade un botón **"📦 Prestar caja completa"** junto a los botones
  existentes "⌛ Nuevo préstamo" (mismos 3 sitios: home, vista de
  inventario, página de préstamos — `index.html:300,424,456`), que llama
  a `openPrestarCaja()` sin argumento.
- `openPrestarCaja(cajaId)` acepta `cajaId` opcional:
  - Con `cajaId` (uso actual): comportamiento sin cambios.
  - Sin `cajaId`: muestra un selector nuevo (`cajaSelector`, mismo
    patrón que `prestarItemSelector` del modal individual — filtro de
    aula + `<input>` buscador de texto + `<select>`), listando solo
    ítems contenedor (`es_contenedor` truthy) que tengan al menos un
    hijo con `qty > 0`. Al elegir uno, se recalculan componentes/aula
    destino igual que hace hoy el flujo con `cajaId` fijo.
- Reutiliza `renderAulaOptions()` y el patrón de filtro ya existente
  (`filterPresItems()` como referencia, adaptado a la lista de
  contenedores).

## Fuera de alcance

- No se toca `mergeProfesores()` en el backend (`list.js`) — ya
  deduplica correctamente.
- No se toca el modal Devolver ni la lista de préstamos activos — ya
  tienen buscador propio (`#pPres .sbox`).
- No se añade gestión de prestatarios externos desde ningún sitio nuevo
  fuera del modal 👥 ya existente.
