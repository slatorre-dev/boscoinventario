# Selector de departamento para superadmin (Fase 3) + aviso de categorías genéricas

**Fecha:** 31/07/2026
**Origen:** Ideas A, B, C propuestas tras revisar backlog de UX del usuario — ver conversación previa. B se verificó ya implementado (sin trabajo pendiente); este spec cubre A y C.

## Contexto

`superadmin` ve todo el centro sin filtrar (`meta.js`, `list.js`), pero `config.js` bloquea con 403 que use `aulasSync`/`catsSync`/`ciclosSync` porque su `AULAS`/`CATS`/`CICLOS` en frontend mezcla los 24 departamentos — sincronizar corrompería varios a la vez. Esto es la Fase 3 pendiente del plan multi-departamento (ver `CLAUDE.md`).

Además, 21 de 24 departamentos (todos salvo `electricidadelectronica` y `musica`) no tienen ninguna fila propia en la tabla `categorias` — solo la etiqueta genérica "Material didáctico" heredada del seed de ítems de ejemplo (`migrations/0016`). Sin categorías propias, el jefe/a de departamento no puede organizar su inventario por tipo de material.

## B — Verificado, sin trabajo pendiente

Alta de usuarios con campo departamento ya está implementado end-to-end:
- `js/prestamos.js:901-920` — select `.usr-dept` visible solo si `SESSION.rol === 'superadmin'`, poblado con `DEPARTAMENTOS`.
- `functions/api/usuarios.js:117-148` (`userAdd`/`userUpdate`) — ya acepta y persiste `departamento` cuando el actor es superadmin.
- Import CSV (`js/prestamos.js:1131`) también soporta la columna `departamento`.
- Verificado en producción (`boscoinventario.pages.dev`) con Playwright: usuario de prueba creado con `departamento='tecnologia'`, confirmado en D1 remoto, luego eliminado.

No requiere ninguna acción. El roadmap en `CLAUDE.md` (pendiente #2) debe actualizarse para reflejar esto.

## A — Selector de departamento para superadmin

### Alcance
El selector **solo** afecta a los 3 modales de gestión (aulas/categorías/ciclos). Inicio, Inventario y Préstamos siguen mostrando todo el centro sin cambios — cero riesgo sobre la vista global que superadmin ya usa hoy.

### Backend (`functions/api/config.js`)
- `aulasSync`, `catsSync`, `ciclosSync` aceptan un campo opcional `departamentoDestino` en el body.
- Si `departamentoDestino` viene informado **y** el actor es superadmin (`isSuperAdmin(user)`): se usa ese valor en lugar de `dept` (`data.departamento`) para todas las queries `WHERE departamento=?` de esa acción específica.
- Si no viene, o el actor no es superadmin: comportamiento idéntico al actual (incluido el 403 de las líneas 222-229 para superadmin sin `departamentoDestino`).
- Mensaje del 403 existente se aclara: menciona que debe elegir un departamento en el selector de la barra superior antes de gestionar.

### Frontend
- Nuevo `<select id="deptActivoSelect">` junto a `#brandDept` en la barra superior. Visible solo si `SESSION.rol` normalizado es `superadmin`. Poblado con `DEPARTAMENTOS` (ya cargado vía `meta.js` para superadmin).
- Selección persiste en `localStorage` (`dept_activo_superadmin`) y en variable global `deptActivo`, restaurada al cargar la app.
- `openAulasModal()` / `openCatsModal()` / `openCiclosModal()`: si `SESSION.rol === 'superadmin'`, filtran `AULAS`/`CATS`/`CICLOS` en memoria por `deptActivo` antes de construir `aulasEditing`/`catsEditing`/`ciclosEditing` — mismo patrón que ya usan para excluir aulas/ciclos globales o compartidos (`modal-aulas.js:11`).
- `saveAulas()` / `saveCats()` / `saveCiclos()`: si `SESSION.rol === 'superadmin'`, incluyen `departamentoDestino: deptActivo` en el payload de `aulasSync`/`catsSync`/`ciclosSync`.
- Si superadmin no ha elegido `deptActivo`: los modales muestran el 403 actual (backend ya lo rechaza sin `departamentoDestino`).

### Fuera de alcance
- No cambia `meta.js`/`list.js` — superadmin sigue viendo todo el inventario/aulas/ciclos sin filtrar en el resto de la app.
- No implica "suplantación completa": no oculta funciones de superadmin ni cambia permisos, solo dirige a qué departamento escriben estas 3 acciones concretas.

## C — Aviso de categorías genéricas + set sugerido

### Backend (`functions/api/meta.js`)
- En la respuesta `GET`, añadir `catsPropias: cats.results.length > 0` (reutilizando la query ya existente de la línea 121, sin coste adicional). Se calcula sobre el departamento del actor (`dept`); no aplica a superadmin en vista global (ver A — con `deptActivo` fijado, el flag pasaría a calcularse igual que para un jefe/a normal, pero eso es una extensión futura fuera de este spec si hiciera falta dentro de los modales de gestión de A).

### Frontend (`js/modal-cats.js`)
- `openCatsModal()`: si `!catsPropias` (guardado en estado global al cargar meta), muestra un aviso encima de `#catsList`: *"Tu departamento aún no tiene categorías propias — tus ítems usan solo la etiqueta genérica. Puedes crear un primer set de categorías para empezar a organizarlos."* + botón **"✨ Crear categorías sugeridas"**.
- Al pulsar el botón: añade 6 filas fijas a `catsEditing` (mismo array en memoria que ya usa `addCatRow()`):
  - Material fungible
  - Herramientas
  - Mobiliario
  - Audiovisual
  - Informática
  - Otros
  
  Cada una con icono/color derivados de `defaultCatStyle()`/`suggestCatIcon()` ya existentes en el frontend (o portados si solo viven en `meta.js` — verificar duplicado como ya ocurre con `CAT_ICON_SUGGESTIONS`).
- Llama a `renderCatsList()`. **No auto-guarda** — el jefe/a de departamento edita nombres/iconos/colores y pulsa "Guardar cambios" como en cualquier otro cambio del modal (mismo patrón que "Importar CSV" de aulas).
- El aviso desaparece la próxima vez que se abra el modal una vez guardado (`catsPropias` pasa a `true` tras el siguiente `GET` de meta).

### Fuera de alcance
- No analiza el inventario existente del departamento para sugerir categorías más específicas — el set es genérico y fijo para los 21 departamentos.
- No migra automáticamente los ítems existentes (con `cat='Material didáctico'`) a las categorías nuevas — el jefe/a decide manualmente si reclasifica, esto no es parte de C.
