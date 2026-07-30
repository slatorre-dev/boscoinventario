# Simplificar interfaz: Home, Préstamos, Modal Nuevo ítem

**Estado:** diseño aprobado, pendiente de plan de implementación
**Fecha:** 30/07/2026

## Contexto

Revisión general de UX pedida por el usuario ("revisa la estructura del home,
prestamos... para hacer más dinámica y sencilla la interfaz") sin bug
concreto reportado. Usuario objetivo: profesor/a casual (uso puntual,
prestar/devolver) y jefe/a de departamento (uso frecuente, gestión completa)
por igual. Se identificaron 3 puntos de fricción independientes, todos
aprobados para implementar juntos.

## 1. Home — colapsar secciones "Por categoría" y "Por ciclo/departamento"

**Problema:** `pH` apila verticalmente hero + acciones rápidas + búsqueda +
stats + 3 grids (`gAulas`, `gCats`, `gCiclos`). En departamentos con muchas
categorías o ciclos, la página se hace muy larga antes de llegar a la
siguiente sección.

**Diseño:**
- Sección "Por aula" (`gAulas`) permanece siempre expandida — es la más usada.
- Secciones "Por categoría" (`gCats`) y "Por ciclo/departamento" (`gCiclos`)
  se envuelven en `<details>`/`<summary>` nativo, reusando el estilo visual
  de `.sec-label` como `<summary>`.
- **Regla de estado por defecto:** cada sección arranca cerrada solo si tiene
  más de 8 tarjetas; si tiene 8 o menos, arranca abierta (comportamiento
  igual al actual para departamentos con pocas categorías/ciclos).
- **Override de usuario:** si el usuario abre o cierra manualmente una
  sección, ese estado explícito se guarda en `localStorage`
  (`home_sec_cats`, `home_sec_ciclos`) y prevalece sobre la regla de tamaño
  en visitas futuras — mismo patrón que `inv_page_size` en
  `js/inventory.js`.
- Sin librerías nuevas. El conteo de tarjetas se calcula sobre los mismos
  arrays que ya renderiza `renderHome()` en `js/home.js`.

## 2. Préstamos — reducir 6 tabs a controles compactos

**Problema:** `pPres` tiene 6 tabs planas (`activos`, `vencidos`,
`devueltos`, `profesor`, `aula`, `material`). Las 3 últimas son vistas
agrupadas de los mismos préstamos activos, no filtros reales — mezclar
filtros y modos de agrupación en la misma fila de tabs es confuso.

**Diseño:**
- Tabs se reducen a 2: **"Activos"** y **"Historial"** (el histórico fusiona
  lo que hoy es la tab "devueltos").
- Dentro de "Activos": un toggle/checkbox **"Solo vencidos 🔴"** sustituye a
  la tab "vencidos" — es un filtro sobre la misma lista, no una vista
  distinta. El badge de contador de vencidos en `#presVencBadge` (topbar) no
  cambia.
- Las tabs "Por profesor / Por aula / Por material" se sustituyen por un
  único `<select>` **"Agrupar por: Sin agrupar / Profesor / Aula /
  Material"**, ubicado junto al buscador. Reutiliza `_renderGrouped()` ya
  existente en `js/prestamos.js` sin cambios de lógica interna — solo
  cambia cómo se selecciona el modo.
- **Persistencia:** el modo de agrupación elegido se guarda en
  `localStorage` (`pres_group_by`) y se restaura al volver a la página de
  Préstamos, igual patrón que `inv_page_size`.
- `currentPresTab` se simplifica a dos valores lógicos (`activos` con
  sub-filtro vencidos, `historial`); el agrupamiento pasa a ser una
  variable independiente (`currentPresGroupBy`), no un valor de tab.

## 3. Modal "Nuevo ítem" — colapsar secciones poco usadas

**Problema:** el modal tiene 6 secciones fijas siempre visibles
(Identificación, Clasificación, Inventario, Detalles, Mantenimiento,
Documentación) — mucho scroll para un alta simple.

**Diseño:**
- **Identificación, Clasificación, Inventario**: siempre visibles (datos
  núcleo de cualquier alta).
- **Mantenimiento**: sin cambios — sigue condicionada al checkbox `f_mant`
  como hoy (`toggleMaintFields()`).
- **Detalles** (Utilidad/Proveedor/Última revisión) y **Documentación**
  (Observaciones/Contenedor-Caja/Adjuntos/QR) pasan a `<details>` plegables:
  - Al crear un ítem nuevo: ambas arrancan cerradas.
  - Al editar un ítem existente: cada sección arranca abierta
    automáticamente si el ítem ya tiene datos en alguno de sus campos (p.ej.
    Documentación se abre si tiene observaciones, es contenedor, o tiene
    documentos adjuntos). Si no tiene datos, arranca cerrada igual que en
    creación.
  - Sin `localStorage` — el criterio es contenido existente, no preferencia
    de usuario (a diferencia de Home/Préstamos, donde si aplica persistencia
    explícita).

## Fuera de alcance

- No se tocan `js/modal-aulas.js`, `js/modal-ciclos.js`, `js/modal-cats.js`
  ni otros modales de gestión.
- No se cambia el modelo de datos ni endpoints backend — es una capa
  puramente de presentación/frontend (`index.html`, `js/home.js`,
  `js/prestamos.js`, `js/modal-item.js`, `css/styles.css`).
- No se añade ninguna librería externa; se usa `<details>`/`<summary>`
  nativo del navegador.

## Testing

- Verificar visualmente en navegador (Playwright o similar) los 3 cambios:
  Home con departamento de pocas categorías (abre por defecto) y con muchas
  (cierra por defecto); Préstamos con las 2 tabs + toggle vencidos +
  selector de agrupación; Modal ítem en creación (Detalles/Documentación
  cerradas) y en edición de un ítem con datos en esas secciones (abiertas
  automáticamente).
- Confirmar que `localStorage` persiste correctamente tras recargar página
  en Home y Préstamos.
