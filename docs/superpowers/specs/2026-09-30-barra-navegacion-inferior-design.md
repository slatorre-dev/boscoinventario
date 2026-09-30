# Barra de navegación inferior en móvil/tablet — diseño

**Fecha:** 30/09/2026 · **Estado:** diseño aprobado, sin implementar

## Origen

Tras simplificar el Inicio móvil (v659-v661), el usuario pidió una barra
de navegación inferior: hoy, en móvil, toda la navegación entre secciones
pasa por el menú ⋮ de la esquina superior derecha (la zona menos
alcanzable con el pulgar), la cámara solo existe en Inicio y no hay una
indicación visible de en qué sección estás.

## Alcance

- Solo **≤1024px** y **con sesión iniciada**. Nunca en `#pLogin`,
  `#pReset`, `#pForcePassword`, `#pSeleccionarDepartamento`,
  `#pSeleccionarModulos`, `#pSeleccionarAulas`.
- Escritorio (>1024px) sin ningún cambio: ni barra, ni cambios en el menú ⋮.
- **Inicio no cambia**: las 4 acciones grandes (Añadir ítem, Nuevo
  préstamo, Planificar práctica, Stock) se mantienen aunque Añadir y
  Prestar queden duplicados con la barra — decisión explícita del usuario.

## Pestañas

```
┌──────┬──────┬──────┬───────┬──────┐
│  🏠  │  🔍  │  ＋   │  ⌛   │  ☰   │
│Inicio│Buscar│Añadir│Prestar│ Más  │
└──────┴──────┴──────┴───────┴──────┘
```

| Pestaña | Acción | Visible si | Estado activo |
|---|---|---|---|
| 🏠 Inicio | `goHome()` | siempre | resaltada cuando `#pH` está activa |
| 🔍 Buscar | abre la capa de búsqueda a pantalla completa (ver abajo) | siempre | resaltada mientras la capa está abierta |
| ＋ Añadir | abre el modal `mAddChoice`: "🎥 Con cámara" → `openCamaraUnificada()`, "✍️ Manual" → `openModal()` | `can('items.write')` | nunca (es una acción) |
| ⌛ Prestar | `openPrestarPicker()` (directo a "Nuevo préstamo") + badge rojo con `getVencidosParaUsuario().length` si > 0 | `can('loans.write')` | nunca (es una acción) |
| ☰ Más | abre el menú existente `#topbarBtns` (`toggleMobMenu()`) presentado como hoja inferior | siempre | mientras la hoja está abierta |

- Pestañas ocultas por permiso no dejan hueco: la barra reparte el ancho
  entre las visibles (rol Consulta → 🏠 🔍 ☰).
- Devolver y ver vencidos siguen accesibles desde Inicio y desde ☰ Más
  (Préstamos) — decisión del usuario: Prestar va directo a crear.
- La visibilidad por permiso se re-evalúa donde ya se aplica el resto
  (`applyPermissions()` / `applyRoleUI()` en `js/roles.js`), no al cargar
  la página (antes del login `SESSION` no refleja el rol real — mismo
  problema ya resuelto para las pestañas de Volt en v648).

## Buscador a pantalla completa

- Capa nueva `#searchOverlay` (fija, pantalla completa, fondo `var(--bg)`)
  con cabecera "✕ Cerrar".
- **No duplica el buscador**: al abrir, se **mueve** el nodo existente
  `#gsWrap` (con `#gsInput`/`#gsResults`) dentro de la capa y se enfoca
  `#gsInput`; al cerrar, se devuelve a su sitio original en Inicio
  (guardando `parentNode`/`nextSibling`). Así `js/search.js` sigue
  funcionando sin cambios (IDs, historial de búsquedas, navegación con
  teclado, "crear ítem si no existe").
- `#gsResults` dentro de la capa se muestra como lista en flujo (no como
  desplegable flotante) y ocupa el alto disponible.
- Elegir un resultado navega como hoy y además cierra la capa.
- **Botón atrás**: abrir la capa hace `history.pushState({page:'buscar'},
  '', '#buscar')`; `navigateFromHash()` (`js/nav.js`) trata `buscar`
  cerrando la capa si está abierta (y si se llega por URL directa sin
  capa abierta, va a Inicio). ✕ cierra con `history.back()` para no
  dejar la entrada `#buscar` colgando.

## Convivencia con el resto de la UI

- **Altura**: ~60px + `env(safe-area-inset-bottom)`. El `body` recibe
  `padding-bottom` equivalente para que la barra no tape el final de las
  listas.
- **Capas (z-index)**: barra por debajo de los modales (`.mbg` usa 500)
  → la barra en ~400; la capa de búsqueda en ~450 (por debajo de modales,
  para que "crear ítem" desde la búsqueda abra su modal encima). El
  modal `mAddChoice` reutiliza `.mbg`/`.modal` como los demás.
- **Menú ☰ Más**: por debajo de 1024px, `#topbarBtns.open` se presenta
  como hoja inferior (anclada abajo, encima de la barra) en vez de
  desplegable superior, y el botón `#mobMenuBtn` (⋮) se oculta. Mismo
  contenido y mismo código de apertura/cierre — un único menú.
- **Volt** (`#agente-fab`): por defecto sube justo encima de la barra
  (`bottom` = altura de la barra + margen). Si el usuario lo había
  arrastrado (`volt_fab_pos`, inline), se respeta salvo que quede tapado
  por la barra: en ese caso se sube lo justo. Sin tocar
  `js/agente-widget.js` (reglas en `css/styles.css` +, si hace falta el
  ajuste de posición guardada, en `js/bottom-nav.js`).
- **Toasts** (`.toasts`, hoy `bottom:24px`): ≤1024px suben por encima de
  la barra.

## Archivos

- `index.html` — marcado de la barra, de `#searchOverlay` y del modal
  `mAddChoice`; `<script src="js/bottom-nav.js">`.
- `js/bottom-nav.js` (nuevo) — visibilidad por sesión/página/permiso,
  estado activo, badge de vencidos, abrir/cerrar capa de búsqueda
  (mover `#gsWrap`), modal de Añadir, ajuste de Volt.
- `js/nav.js` — enganche mínimo: marcar pestaña activa al navegar
  (desde `_push()`/`show()`) y caso `buscar` en `navigateFromHash()`.
- `css/styles.css` — barra, capa, hoja ☰, toasts y Volt ≤1024px.
- `sw.js` — `VERSION` +1.
- Sin cambios en `js/search.js`, `js/prestamos.js`,
  `js/agente-widget.js` (solo se llaman sus funciones). Al no modificar
  `prestamos.js`/`agente-widget.js`, no aplica la regla de
  modularización oportunista (Pendiente #26).
- Sin backend ni migraciones.

## Verificación

Playwright sobre HTML estático con sesión/datos simulados, a **390px,
768px y 1400px**, con roles **superadmin, profesor y consulta**:

- Barra visible solo ≤1024px y con sesión; ausente en login/selecciones.
- Pestañas correctas por rol; sin huecos.
- Sin scroll horizontal; la barra no tapa el final de listas ni modales.
- Buscar: abre con teclado enfocado, muestra resultados, elegir uno
  navega y cierra; ✕ y "atrás" cierran y devuelven `#gsWrap` a Inicio
  (el buscador de Inicio sigue funcionando después).
- Añadir: modal con las dos opciones, cada una abre su flujo.
- Prestar: abre "Nuevo préstamo"; badge con el número de vencidos.
- ☰ Más: hoja inferior con el menú completo; ⋮ superior oculto.
- Volt y toasts visibles por encima de la barra.
- Escritorio idéntico al actual.
