# Selector de departamento para superadmin + categorías sugeridas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desbloquear que `superadmin` gestione aulas/categorías/ciclos de un departamento concreto (Fase 3 del plan multi-departamento), y avisar a los 21 departamentos sin categorías propias con un set inicial sugerido.

**Architecture:** Un selector de departamento en la barra superior (visible solo para `superadmin`) persiste `deptActivo` en `localStorage`. Los 3 modales de gestión (aulas/categorías/ciclos) filtran por `deptActivo` al abrir y lo mandan como `departamentoDestino` al guardar; el backend usa ese valor en vez de `data.departamento` solo cuando el actor es `superadmin`. Por separado, `meta.js` expone `catsPropias:boolean`; el modal de categorías muestra un aviso + botón que rellena 6 categorías fijas en memoria si el departamento no tiene ninguna guardada.

**Tech Stack:** Cloudflare Pages Functions (backend, `functions/api/*.js`), Vanilla JS (frontend, `js/*.js`), D1 (SQLite), HTML/CSS sin build step.

## Global Constraints

- No modificar `meta.js`/`list.js` para que superadmin vea el inventario filtrado — fuera de alcance (ver spec, sección A "Fuera de alcance").
- El selector de departamento **solo** afecta a los 3 modales de gestión — Inicio/Inventario/Préstamos no cambian.
- Todo cambio de `sw.js` (VERSION) y despliegue sigue el workflow del proyecto: bump VERSION → commit → push a `origin main` (Cloudflare Pages autodespliega). No usar `--no-verify` ni saltarse hooks.
- Convención de nombres D1 ya existente: slug de departamento en minúsculas sin espacios (`tecnologia`, `electricidadelectronica`, etc.) — ver tabla `departamentos`.
- Todas las queries `WHERE departamento=?` existentes en `config.js` usan la variable local `dept`; el cambio de A debe reasignar esa única variable, no tocar cada query por separado.
- Los datos de prueba creados durante verificación manual (usuarios, categorías) deben limpiarse de D1 remota antes de dar una tarea por terminada.

---

## Task 1: Backend — `departamentoDestino` en aulasSync/catsSync/ciclosSync

**Files:**
- Modify: `functions/api/config.js:210-230` (función `isSuperAdmin`, bloque de rechazo `SYNC_ACTIONS_NEED_DEPT`, inicio de `onRequestPost`)

**Interfaces:**
- Consumes: `isSuperAdmin(user)` (ya existe en el archivo, línea 210-212).
- Produces: comportamiento de `dept` en `onRequestPost` — todas las acciones subsiguientes (`aulasSync`, `catsSync`, `ciclosSync`, `normalizeCategoriesTags`, etc.) siguen leyendo la variable local `dept` sin cambios en su propio código.

### Contexto para el implementador

`functions/api/config.js` maneja todas las acciones de sincronización de configuración (aulas, categorías, ciclos, ubicaciones). Actualmente:

```js
const SYNC_ACTIONS_NEED_DEPT = new Set(['aulasSync', 'catsSync', 'ciclosSync']);

export async function onRequestPost({ request, env, data }) {
  const body = await request.json();
  const { action } = body;
  const user = data?.user || request.user;
  const dept = user?.departamento || '';

  if (isSuperAdmin(user) && SYNC_ACTIONS_NEED_DEPT.has(action)) {
    return Response.json({ ok: false, error: 'Superadmin no puede gestionar aulas/categorías/ciclos directamente todavía — hazlo con un usuario del departamento correspondiente.' }, { status: 403 });
  }
  // ... resto de acciones usa `dept`
}
```

Un `superadmin` que manda `departamentoDestino: 'tecnologia'` en el body debe poder ejecutar `aulasSync`/`catsSync`/`ciclosSync` como si `dept` fuera `'tecnologia'`. Si no manda `departamentoDestino` (o no es superadmin), el comportamiento debe ser exactamente el actual — incluido el 403 para superadmin sin destino.

- [ ] **Step 1: Escribir test manual de verificación (documentado, sin framework de test en el repo)**

Este proyecto no tiene suite de tests automatizados para `functions/api/`. La verificación es manual vía `wrangler d1 execute` + llamada HTTP real tras el deploy (Task 6). Anota en un comentario temporal (borrar antes de commit) el escenario a probar: "superadmin manda `catsSync` con `departamentoDestino:'tecnologia'` y sin categorías previas en tecnologia — debe crear 1 fila con `departamento='tecnologia'`, no en el departamento propio del superadmin ni sin filtro".

- [ ] **Step 2: Modificar `isSuperAdmin` no cambia — reasignar `dept` en `onRequestPost`**

Reemplazar el bloque completo:

```js
export async function onRequestPost({ request, env, data }) {
  const body = await request.json();
  const { action } = body;
  const user = data?.user || request.user;
  const dept = user?.departamento || '';

  if (isSuperAdmin(user) && SYNC_ACTIONS_NEED_DEPT.has(action)) {
    // Aunque un superadmin tenga un departamento "propio" asignado (para
    // el badge y futuro uso), meta.js/list.js le siguen devolviendo TODAS
    // las aulas/ciclos sin filtrar (así ve todo el centro) — su AULAS/CICLOS
    // en el frontend no está scoped a un solo departamento. Sincronizar
    // desde aquí mezclaría/corrompería datos de varios departamentos.
    // Pendiente de resolverse con el selector de departamento (Fase 3).
    return Response.json({ ok: false, error: 'Superadmin no puede gestionar aulas/categorías/ciclos directamente todavía — hazlo con un usuario del departamento correspondiente.' }, { status: 403 });
  }
```

Por:

```js
export async function onRequestPost({ request, env, data }) {
  const body = await request.json();
  const { action } = body;
  const user = data?.user || request.user;
  const superadmin = isSuperAdmin(user);
  const departamentoDestino = String(body.departamentoDestino || '').trim();

  if (superadmin && SYNC_ACTIONS_NEED_DEPT.has(action) && !departamentoDestino) {
    // superadmin ve TODAS las aulas/categorías/ciclos sin filtrar (meta.js
    // no scopea para su rol) — sin un departamentoDestino explícito no hay
    // forma de saber a qué departamento debería aplicarse el guardado.
    // El frontend soluciona esto con el selector de departamento de la
    // barra superior (js/auth.js:renderDeptActivoSelector) — ver
    // docs/superpowers/specs/2026-07-31-selector-departamento-superadmin-y-categorias-sugeridas-design.md
    return Response.json({ ok: false, error: 'Elige un departamento en el selector de la barra superior antes de gestionar aulas/categorías/ciclos.' }, { status: 403 });
  }

  const dept = (superadmin && departamentoDestino) ? departamentoDestino : (user?.departamento || '');
```

**Nota:** todo el resto del archivo (`aulasSync`, `catsSync`, `ciclosSync`, `normalizeCategoriesTags`, `normalizeTagsCanonical`, `renameTag`, `deleteTag`, `configBackupsList`, `configBackupsRestore`, `snapshotBeforeSync`, `auditLog`) sigue leyendo `dept` sin ningún cambio — no tocar esas líneas.

- [ ] **Step 3: Verificar que no quedan referencias directas a `user?.departamento` más abajo en el archivo que deban usar `dept` en su lugar**

Ejecutar para confirmar que solo la línea de definición usa `user?.departamento`:

```bash
grep -n "user?.departamento\|user\.departamento" functions/api/config.js
```

Expected: una sola coincidencia, la de la línea recién escrita en Step 2.

- [ ] **Step 4: Commit**

```bash
git add functions/api/config.js
git commit -m "feat: superadmin puede gestionar aulas/categorías/ciclos con departamentoDestino explícito"
```

---

## Task 2: Backend — exponer `departamento` en ciclos agrupados de meta.js

**Files:**
- Modify: `functions/api/meta.js:137-144`

**Interfaces:**
- Consumes: `ciclosRows.results` (filas crudas de `SELECT * FROM ciclos`, cada una ya tiene columna `departamento`).
- Produces: cada objeto en el array `ciclos` de la respuesta JSON de `meta.js` incluye ahora `departamento` (string). Los objetos de `aulas` y `cats`/`invCats` ya lo incluían (vienen de `SELECT *` o construidos con datos crudos) — no requieren cambio.

### Contexto para el implementador

`meta.js` construye el array de ciclos agrupando filas por `cicloId` (un ciclo puede tener varias filas, una por módulo/asignatura). El objeto agrupado actual pierde la columna `departamento` de la fila original. Para que el frontend (Task 4) pueda filtrar `CICLOS` por `deptActivo` cuando el usuario es superadmin, cada ciclo agrupado necesita saber a qué departamento pertenece.

- [ ] **Step 1: Modificar el bloque de agrupación**

Reemplazar:

```js
  const cicloMap = {}, cicloOrder = [];
  for (const r of ciclosRows.results) {
    if (!cicloMap[r.cicloId]) {
      cicloMap[r.cicloId] = { id: r.cicloId, name: r.cicloNombre, nivel: r.nivel, icon: r.icon, th: r.th, desc: r.desc, modulos: [] };
      cicloOrder.push(r.cicloId);
    }
    if (r.modCod) cicloMap[r.cicloId].modulos.push({ cod: r.modCod, name: r.modNombre, horas: r.modHoras });
  }
```

Por:

```js
  const cicloMap = {}, cicloOrder = [];
  for (const r of ciclosRows.results) {
    if (!cicloMap[r.cicloId]) {
      cicloMap[r.cicloId] = { id: r.cicloId, name: r.cicloNombre, nivel: r.nivel, icon: r.icon, th: r.th, desc: r.desc, departamento: r.departamento || '', modulos: [] };
      cicloOrder.push(r.cicloId);
    }
    if (r.modCod) cicloMap[r.cicloId].modulos.push({ cod: r.modCod, name: r.modNombre, horas: r.modHoras });
  }
```

- [ ] **Step 2: Verificar manualmente contra D1 remota que la columna existe en todas las filas**

```bash
npx wrangler d1 execute boscoinventario --remote --command="SELECT DISTINCT departamento FROM ciclos ORDER BY departamento"
```

Expected: lista de slugs de los 24 departamentos + `iesjuanbosco`, sin valores NULL o vacíos inesperados (ya se sembraron con `departamento` en las migraciones `0009`/`0010`/`0011`).

- [ ] **Step 3: Commit**

```bash
git add functions/api/meta.js
git commit -m "feat: exponer departamento en ciclos agrupados de meta.js"
```

---

## Task 3: Backend — flag `catsPropias` y `catsCrudo` (por departamento) en meta.js

**Files:**
- Modify: `functions/api/meta.js:108-155` (función `onRequestGet`)

**Interfaces:**
- Consumes: `cats` (resultado ya obtenido de `SELECT * FROM categorias ...`, línea 119-121 — para superadmin ya es `SELECT * FROM categorias ORDER BY orden` sin filtro, cada fila incluye la columna `departamento` real de la tabla).
- Produces: la respuesta JSON de `meta.js` incluye `catsPropias: boolean` (para no-superadmin) y `catsCrudo: array` (solo para superadmin — filas crudas de `categorias` con su `departamento`, sin pasar por `mergeCats()`).

### Contexto para el implementador

`meta.js` ya ejecuta, para usuarios no-superadmin, `env.DB.prepare("SELECT * FROM categorias WHERE departamento=? ORDER BY orden").bind(dept).all()` (línea 121) y guarda el resultado en la variable `cats` (parte del array desestructurado de `Promise.all`, línea 115). El flag `catsPropias` debe indicar si ese departamento tiene alguna fila propia en la tabla `categorias` — no cuenta las categorías "huérfanas" que `mergeCats()` añade automáticamente a partir de `inventario.cat`.

Para superadmin, la misma query (línea 120, sin filtro) ya trae **todas** las categorías del centro, cada fila con su columna `departamento` intacta (confirmado con `PRAGMA table_info(categorias)`: la tabla tiene `departamento TEXT` como parte de su PK compuesta). Hoy esas filas se pierden al pasar por `mergeCats()` (que fusiona a un objeto plano `{name: {c,bg,i}}` sin `departamento`). En vez de cambiar `mergeCats()` o la forma de `CATS` (usada intacta por 7 archivos del frontend — `inventory.js`, `config.js`, `modal-item.js`, `import.js`, `search.js`, `nav.js`, `agente-widget.js`), exponemos las filas crudas en un campo nuevo y separado, solo para superadmin.

- [ ] **Step 1: Añadir los campos a la respuesta**

Localizar el bloque de retorno (alrededor de la línea 146):

```js
  return Response.json({
    ok: true,
    aulas: aulas.results,
    cats: mergeCats(cats.results, invCats.results),
    ubicaciones: mergeUbicaciones(ubicaciones.results, invLocs.results),
    ciclos: cicloOrder.map(id => cicloMap[id]),
    departamentos: superadmin ? departamentosRows.results : undefined,
    user
  });
```

Reemplazar por:

```js
  return Response.json({
    ok: true,
    aulas: aulas.results,
    cats: mergeCats(cats.results, invCats.results),
    catsPropias: cats.results.length > 0,
    catsCrudo: superadmin ? cats.results : undefined,
    ubicaciones: mergeUbicaciones(ubicaciones.results, invLocs.results),
    ciclos: cicloOrder.map(id => cicloMap[id]),
    departamentos: superadmin ? departamentosRows.results : undefined,
    user
  });
```

**Nota:** para `superadmin`, `catsPropias` sería siempre `true` (la query sin filtro nunca está vacía salvo base de datos vacía) — es el comportamiento esperado, el aviso de C es irrelevante para superadmin en vista global (ver spec, sección C). `catsCrudo` es el campo que Task 5 (modal-cats.js) usará para filtrar por `deptActivo`.

- [ ] **Step 2: Verificar manualmente con curl o wrangler que el flag aparece correctamente para un departamento sin categorías**

```bash
npx wrangler d1 execute boscoinventario --remote --command="SELECT COUNT(*) as n FROM categorias WHERE departamento='filosofia'"
```

Expected: `n: 0` (confirma que `filosofia` es de los 21 departamentos sin categorías propias, apto para probar el flag en `false`).

- [ ] **Step 3: Verificar que `catsCrudo` trae `departamento` en cada fila**

```bash
npx wrangler d1 execute boscoinventario --remote --command="SELECT name, departamento FROM categorias ORDER BY departamento LIMIT 5"
```

Expected: filas con `departamento='musica'` (las únicas categorías reales existentes hoy fuera de `electricidadelectronica`, según lo verificado al inicio de esta sesión).

- [ ] **Step 4: Commit**

```bash
git add functions/api/meta.js
git commit -m "feat: exponer catsPropias y catsCrudo en meta.js para gestión de categorías por departamento"
```

---

## Task 4: Frontend — selector de departamento activo para superadmin

**Files:**
- Modify: `index.html:49` (añadir el `<select>` junto a `#brandDept`)
- Modify: `js/config.js:18` (añadir `let deptActivo = ...;` junto a `let DEPARTAMENTOS = [];`)
- Modify: `js/auth.js:412` (tras cargar `meta`, pintar/restaurar el selector)
- Create: función `renderDeptActivoSelector()` y `onDeptActivoChange()` en `js/auth.js`

**Interfaces:**
- Consumes: `DEPARTAMENTOS` (array `{slug, nombre, icono}`, ya poblado en `js/auth.js:412`), `SESSION.rol` (ya normalizado en el resto del proyecto vía patrón `String(SESSION?.rol||'').trim().toLowerCase()`).
- Produces: variable global `deptActivo` (string, slug del departamento elegido o `''`/`null` si ninguno), persistida en `localStorage` bajo la clave `dept_activo_superadmin`. Los modales de Task 5 leen `deptActivo` directamente.

### Contexto para el implementador

Primero revisa `js/config.js:18` — ya existe `let DEPARTAMENTOS = [];` como variable global de módulo (mismo patrón que `AULAS`, `CATS`, `CICLOS`). Añade `deptActivo` junto a esa declaración, en el mismo archivo (`js/config.js`), no en uno nuevo — es donde el proyecto centraliza este tipo de estado global compartido entre módulos.

- [ ] **Step 1: Declarar `deptActivo` junto a `DEPARTAMENTOS`**

En `js/config.js`, localizar:

```js
let DEPARTAMENTOS = [];
```

Añadir justo debajo:

```js
let deptActivo = localStorage.getItem('dept_activo_superadmin') || '';
```

- [ ] **Step 2: Añadir el `<select>` en la barra superior**

En `index.html`, localizar:

```html
    <span class="brand-dept" id="brandDept"></span>
```

Añadir justo después (misma línea de contexto, dentro de `.brand-wrap`):

```html
    <span class="brand-dept" id="brandDept"></span>
    <select class="brand-dept-select" id="deptActivoSelect" style="display:none" onchange="onDeptActivoChange(this.value)" title="Departamento activo para gestión (aulas/categorías/ciclos)"></select>
```

- [ ] **Step 3: Escribir `renderDeptActivoSelector()` y `onDeptActivoChange()` en `js/auth.js`**

Añadir al final de `js/auth.js` (o cerca de `showUserChip()`, línea 331-346, mismo bloque temático):

```js
function renderDeptActivoSelector(){
  const sel = document.getElementById('deptActivoSelect');
  if(!sel) return;
  const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
  if(!isSuperAdmin || !Array.isArray(DEPARTAMENTOS) || !DEPARTAMENTOS.length){
    sel.style.display = 'none';
    return;
  }
  sel.style.display = 'inline-block';
  sel.innerHTML = '<option value="">— Elige departamento para gestionar —</option>' +
    DEPARTAMENTOS.map(d => `<option value="${d.slug}" ${deptActivo===d.slug?'selected':''}>${d.icono||''} ${d.nombre}</option>`).join('');
}

function onDeptActivoChange(value){
  deptActivo = value || '';
  localStorage.setItem('dept_activo_superadmin', deptActivo);
}
```

- [ ] **Step 4: Llamar a `renderDeptActivoSelector()` tras cargar `DEPARTAMENTOS` en `loadData()`**

En `js/auth.js`, localizar (dentro de `loadData()`):

```js
    if(meta.departamentos && meta.departamentos.length) DEPARTAMENTOS = meta.departamentos;
```

Añadir justo después:

```js
    if(meta.departamentos && meta.departamentos.length) DEPARTAMENTOS = meta.departamentos;
    renderDeptActivoSelector();
```

- [ ] **Step 5: Verificación manual (requiere deploy — ver Task 8)**

No hay entorno de desarrollo local funcional para este proyecto (`wrangler pages dev` falla en Windows con un crash nativo de libuv/workerd — ya confirmado en sesión anterior). La verificación de este task se hace en conjunto con Task 5 tras el deploy de Task 8, con Playwright contra `boscoinventario.pages.dev`.

- [ ] **Step 6: Commit**

```bash
git add index.html js/config.js js/auth.js
git commit -m "feat: selector de departamento activo para superadmin en barra superior"
```

---

## Task 5: Frontend — modales de gestión filtran y guardan con `deptActivo`

**Files:**
- Modify: `js/modal-aulas.js:6-14` (`openAulasModal`), `js/modal-aulas.js:81-91` (`saveAulas`)
- Modify: `js/modal-cats.js:23-31` (`openCatsModal`), `js/modal-cats.js:79-99` (`saveCats`)
- Modify: `js/modal-ciclos.js:12-26` (`openCiclosModal`), y la función `saveCiclos` (buscar en el archivo, no incluida en el extracto ya visto — seguir el mismo patrón que `saveAulas`/`saveCats`)

**Interfaces:**
- Consumes: `deptActivo` (de Task 4, `js/config.js`), `SESSION.rol`.
- Produces: ningún cambio de interfaz pública — mismo comportamiento visible para jefe/a de departamento normal (superadmin es el único caso nuevo).

### Contexto para el implementador

Los 3 modales ya filtran su array editable al abrir (ej. `modal-aulas.js:11` excluye aulas globales/compartidas) y llaman a `apiPost({action:'...Sync', ...})` al guardar. Para superadmin, hay que añadir un filtro adicional por `deptActivo` al abrir, y el campo `departamentoDestino` al guardar. Para jefe/a de departamento normal (no superadmin), `deptActivo` es siempre `''` (nunca se le muestra el selector) y por tanto no debe alterar su comportamiento actual.

- [ ] **Step 1: Modificar `openAulasModal()` en `js/modal-aulas.js`**

Reemplazar:

```js
function openAulasModal(){
  if(!requirePerm('config.manage')) return;
  // Solo el aula propia del departamento se gestiona aquí — las aulas
  // globales del centro y la compartida "IES Juan Bosco" no son editables
  // desde cada departamento (evita duplicarlas al guardar).
  aulasEditing = JSON.parse(JSON.stringify(AULAS.filter(a=>a.departamento && a.departamento!=='iesjuanbosco'))); // copia profunda
  renderAulasList();
  document.getElementById('mAulas').classList.add('open');
}
```

Por:

```js
function openAulasModal(){
  if(!requirePerm('config.manage')) return;
  const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
  if(isSuperAdmin && !deptActivo){
    toast('Elige un departamento en el selector de la barra superior primero', 'err');
    return;
  }
  // Solo el aula propia del departamento se gestiona aquí — las aulas
  // globales del centro y la compartida "IES Juan Bosco" no son editables
  // desde cada departamento (evita duplicarlas al guardar). Para superadmin,
  // "propia" significa el departamento elegido en deptActivo (Fase 3).
  const filtroDept = isSuperAdmin ? deptActivo : null;
  aulasEditing = JSON.parse(JSON.stringify(AULAS.filter(a =>
    a.departamento && a.departamento !== 'iesjuanbosco' &&
    (filtroDept ? a.departamento === filtroDept : true)
  ))); // copia profunda
  renderAulasList();
  document.getElementById('mAulas').classList.add('open');
}
```

- [ ] **Step 2: Modificar `saveAulas()` en `js/modal-aulas.js`**

Localizar:

```js
  try {
    const res = await apiPost({action:'aulasSync', aulas:aulasEditing});
    if(!res.ok) throw new Error(res.error);
```

Reemplazar por:

```js
  try {
    const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
    const payload = {action:'aulasSync', aulas:aulasEditing};
    if(isSuperAdmin && deptActivo) payload.departamentoDestino = deptActivo;
    const res = await apiPost(payload);
    if(!res.ok) throw new Error(res.error);
```

**Importante:** no tocar el resto del cuerpo de `saveAulas()` (línea `AULAS = aulasEditing;` etc.) — para superadmin, `AULAS` global mezcla todos los departamentos (viene sin filtrar de `meta.js`), así que sobreescribir `AULAS = aulasEditing` con solo las del departamento activo rompería la vista global de superadmin en el resto de la app. Este es un gap conocido a documentar, no a resolver en este plan (ver Step 3).

- [ ] **Step 3: Ajustar la actualización de estado local para no romper la vista global de superadmin**

Inmediatamente después de la línea `if(!res.ok) throw new Error(res.error);` en `saveAulas()`, localizar:

```js
    AULAS = aulasEditing;
```

Reemplazar por:

```js
    if(isSuperAdmin && deptActivo){
      // AULAS de superadmin mezcla TODOS los departamentos (meta.js no
      // filtra para su rol) — reemplazar el array entero con solo las
      // del departamento activo rompería la vista global. En su lugar,
      // sustituir solo las filas de ese departamento dentro del array
      // ya existente.
      AULAS = AULAS.filter(a => a.departamento !== deptActivo).concat(aulasEditing);
    } else {
      AULAS = aulasEditing;
    }
```

- [ ] **Step 4: Aplicar el mismo patrón en `js/modal-cats.js`, usando `catsCrudo` (Task 3) para superadmin**

`CATS` (objeto `{name: {c,bg,i}}`, poblado por `mergeCats()` en `meta.js`) no tiene campo `departamento` por entrada — se usa igual en 7 archivos del frontend (`js/inventory.js`, `js/config.js`, `js/modal-item.js`, `js/import.js`, `js/search.js`, `js/nav.js`, `js/agente-widget.js`), así que **no se toca**. Task 3 añadió un campo nuevo y separado, `meta.catsCrudo` (solo para superadmin), con las filas crudas de `categorias` incluyendo `departamento`. Guarda ese array en una variable global nueva.

En `js/config.js`, junto a `deptActivo` (Step 1 de este mismo task), añadir:

```js
let catsCrudo = [];
```

En `js/auth.js`, dentro de `loadData()`, localizar:

```js
    if(meta.cats && meta.cats.length) setCatsFromEntries(meta.cats.map(c=>[c.name,{c:c.c,bg:c.bg,i:c.i}]));
```

Añadir justo después:

```js
    if(meta.cats && meta.cats.length) setCatsFromEntries(meta.cats.map(c=>[c.name,{c:c.c,bg:c.bg,i:c.i}]));
    if(Array.isArray(meta.catsCrudo)) catsCrudo = meta.catsCrudo;
```

Ahora en `js/modal-cats.js`, `openCatsModal()` actual:

```js
function openCatsModal(){
  if(!requirePerm('categories.manage')) return;
  syncTagsFromItems();
  catsEditing = sortedCatEntries().map(([name,v])=>({name, c:v.c, bg:v.bg, i:v.i}));
  sortCatsEditing();
  renderCatsList();
  renderTagsList();
  document.getElementById('mCats').classList.add('open');
}
```

Reemplazar por:

```js
function openCatsModal(){
  if(!requirePerm('categories.manage')) return;
  syncTagsFromItems();
  const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
  if(isSuperAdmin && !deptActivo){
    toast('Elige un departamento en el selector de la barra superior primero', 'err');
    return;
  }
  if(isSuperAdmin){
    // CATS (objeto global fusionado) mezcla todos los departamentos sin
    // distinguir origen — para superadmin usamos catsCrudo (Task 3 de
    // meta.js), que sí trae `departamento` por fila, filtrado por deptActivo.
    catsEditing = catsCrudo
      .filter(c => c.departamento === deptActivo)
      .map(c => ({name:c.name, c:c.c, bg:c.bg, i:c.i}));
  } else {
    catsEditing = sortedCatEntries().map(([name,v])=>({name, c:v.c, bg:v.bg, i:v.i}));
  }
  sortCatsEditing();
  renderCatsList();
  renderTagsList();
  _renderCatsAviso();
  document.getElementById('mCats').classList.add('open');
}
```

(La llamada a `_renderCatsAviso()` se añade aquí y se implementa en Task 7 — si Task 7 aún no se ha ejecutado, comentar esa línea temporalmente o implementar Task 7 antes de probar este modal end-to-end.)

Ahora `saveCats()` — localizar:

```js
  try {
    const res = await apiPost({action:'catsSync', cats:payload});
    if(!res.ok) throw new Error(res.error);
    setCatsFromEntries(clean.map(c=>[c.name, {c:c.c, bg:c.bg, i:c.i}]));
```

Reemplazar por:

```js
  try {
    const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
    const body = {action:'catsSync', cats:payload};
    if(isSuperAdmin && deptActivo) body.departamentoDestino = deptActivo;
    const res = await apiPost(body);
    if(!res.ok) throw new Error(res.error);
    if(isSuperAdmin && deptActivo){
      // CATS global mezcla todos los departamentos — no reemplazar entero.
      // catsCrudo sí se puede reconstruir por completo para ese departamento.
      catsCrudo = catsCrudo.filter(c => c.departamento !== deptActivo)
        .concat(payload.map(c => ({...c, departamento: deptActivo})));
    } else {
      setCatsFromEntries(clean.map(c=>[c.name, {c:c.c, bg:c.bg, i:c.i}]));
    }
    fillCatFilter();
    fillModalSelects();
    if(typeof renderHome === 'function') renderHome();
    closeCatsModal();
    toast('Categorías guardadas y sincronizadas','ok');
  } catch(err) {
    toast(friendlyError(err),'err');
  }
}
```

**Nota:** el resto del cuerpo de `saveCats()` (`fillCatFilter()`, `fillModalSelects()`, `renderHome()`, `closeCatsModal()`, el `toast` de éxito y el `catch`) no cambia respecto al original — solo se modificó el bloque `try` mostrado arriba.

- [ ] **Step 5: Repetir el patrón de Steps 1-3 en `js/modal-ciclos.js`**

`openCiclosModal()` actual (ya tiene `departamento` disponible en cada ciclo gracias a Task 2):

```js
function openCiclosModal(){
  if(!requirePerm('config.manage')) return;
  // "IES Juan Bosco" es un ciclo compartido entre departamentos — no se
  // gestiona desde aquí (evita duplicarlo bajo el departamento propio al guardar).
  ciclosEditing  = JSON.parse(JSON.stringify(CICLOS.filter(c=>c.id!=='iesjuanbosco')));
  cicloExpandIdx = null;
  cicloAddingNew = false;
  document.getElementById('mCiclos').classList.add('open');
  requestAnimationFrame(() => requestAnimationFrame(_renderCiclos));
}
```

Reemplazar por:

```js
function openCiclosModal(){
  if(!requirePerm('config.manage')) return;
  const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
  if(isSuperAdmin && !deptActivo){
    toast('Elige un departamento en el selector de la barra superior primero', 'err');
    return;
  }
  const filtroDept = isSuperAdmin ? deptActivo : null;
  // "IES Juan Bosco" es un ciclo compartido entre departamentos — no se
  // gestiona desde aquí (evita duplicarlo bajo el departamento propio al
  // guardar). Para superadmin, filtra además por el departamento activo
  // (Fase 3) — cada ciclo agrupado ya trae su `departamento` (meta.js).
  ciclosEditing  = JSON.parse(JSON.stringify(CICLOS.filter(c =>
    c.id !== 'iesjuanbosco' &&
    (filtroDept ? c.departamento === filtroDept : true)
  )));
  cicloExpandIdx = null;
  cicloAddingNew = false;
  document.getElementById('mCiclos').classList.add('open');
  requestAnimationFrame(() => requestAnimationFrame(_renderCiclos));
}
```

Localizar `saveCiclos()` en el mismo archivo (buscar `function saveCiclos` — no estaba en el extracto ya leído, pero sigue el mismo patrón exacto que `saveAulas`/`saveCats`: construye un payload y llama a `apiPost({action:'ciclosSync', ...})`). Aplicarle el mismo cambio que Steps 2-3: añadir `departamentoDestino` al payload si superadmin, y al actualizar el estado local `CICLOS` tras guardar, sustituir solo las entradas del `deptActivo` en vez de reemplazar el array entero (mismo razonamiento que aulas — `CICLOS` de superadmin mezcla todos los departamentos).

- [ ] **Step 6: Verificación manual con Playwright contra producción (tras deploy de Task 8)**

Como superadmin (`Seba`/`Seba`):
1. Elegir "Tecnología" en el nuevo selector de departamento.
2. Abrir "🏫 Gestionar aulas" — confirmar que solo aparece el aula propia de Tecnología (no las de otros departamentos, no las globales).
3. Guardar sin cambios — confirmar que no da error 403.
4. Repetir con "📚 Gestionar ciclos y módulos".
5. Verificar en D1 que el guardado no alteró aulas/ciclos de otros departamentos:

```bash
npx wrangler d1 execute boscoinventario --remote --command="SELECT departamento, COUNT(*) as n FROM aulas GROUP BY departamento ORDER BY departamento"
```

Expected: mismos conteos que antes de la prueba, salvo el departamento elegido si se hicieron cambios reales.

- [ ] **Step 7: Commit**

```bash
git add js/modal-aulas.js js/modal-ciclos.js
git commit -m "feat: modales de aulas y ciclos filtran/guardan por departamento activo (superadmin)"
```

(Nota: el cambio de `js/modal-cats.js` de este mismo Task 5 — Step 4 — depende de `catsCrudo`, expuesto en Task 3. Si Task 3 aún no se ha ejecutado al llegar aquí, ejecutarla primero. El commit de `modal-cats.js` se hace junto con el de Task 7, ya que ambos tocan el mismo `openCatsModal()`.)

---

## Task 6: (fusionada con Task 8 — ver nota)

**Este task se saltó deliberadamente como paso separado.** En el diseño original del plan se contempló un deploy intermedio solo para A, antes de implementar C (Tasks 3 y 7). En la práctica, A (Tasks 1, 2, 4, 5) y C (Tasks 3, 7) comparten archivo (`meta.js`, `js/config.js`, `js/auth.js`) y se implementan en la misma sesión — un deploy intermedio solo añadiría un ciclo de espera extra sin beneficio. **Task 8 es el único deploy real de este plan** y cubre Tasks 1-5 y 7 juntas. Si por algún motivo A necesita verse en producción antes de que C esté lista (ej. el usuario quiere probar A primero), hacer un deploy manual ad-hoc con bump de versión siguiendo el mismo patrón que Task 8 Steps 1-2, sin crear una task nueva para ello.

---

## Task 7: Frontend — aviso de categorías genéricas en modal-cats.js

**Files:**
- Modify: `js/modal-cats.js:23-31` (`openCatsModal`)
- Modify: `index.html` (buscar el contenedor `#catsList` dentro del modal `#mCats` para insertar el aviso justo antes)

**Interfaces:**
- Consumes: `catsPropias` (de Task 3, boolean recibido en la respuesta de `meta.js` — debe guardarse en una variable accesible, ej. extendiendo el bloque de `loadData()` en `js/auth.js` donde ya se leen `meta.aulas`, `meta.cats`, etc.)
- Produces: ninguna interfaz nueva para otros módulos — cambio contenido en el modal de categorías.

### Contexto para el implementador

**Este task se ejecuta después de Task 5** (no antes) — Task 5 Step 4 ya modificó `openCatsModal()` para añadir el filtro por `deptActivo` de superadmin; este task modifica esa misma función otra vez, para añadir el aviso. Si se ejecutan en el orden inverso, el `openCatsModal()` de Step 3 de este task pisaría el cambio de Task 5 sin el filtro de superadmin — la versión de referencia usada en el Step 3 de abajo YA incluye el cambio de Task 5.

- [ ] **Step 1: Guardar `catsPropias` al cargar meta, en `js/auth.js`**

Localizar en `loadData()`:

```js
    if(meta.ciclos && meta.ciclos.length) CICLOS = meta.ciclos;
```

Añadir una línea nueva justo después (variable global nueva, declarar junto a `deptActivo` en `js/config.js`):

```js
    if(meta.ciclos && meta.ciclos.length) CICLOS = meta.ciclos;
    catsPropias = !!meta.catsPropias;
```

En `js/config.js`, junto a la declaración de `deptActivo` (Task 4, Step 1), añadir:

```js
let catsPropias = true;
```

(Valor inicial `true` para no mostrar el aviso antes de que `meta` cargue — evita parpadeo del aviso en la primera pintura del modal si se abriera antes de tiempo, aunque en la práctica el modal solo es accesible tras login completo.)

- [ ] **Step 2: Añadir el contenedor del aviso en `index.html`**

Localizar el modal de categorías (buscar `id="mCats"` en `index.html`) y el contenedor `id="catsList"` dentro. Añadir un `<div>` vacío justo antes de `#catsList`, con un id fijo para que el JS lo rellene condicionalmente:

```html
<div id="catsAvisoGenerico" style="display:none"></div>
```

(Insertarlo inmediatamente antes de la línea que contiene `<div class="cat-list" id="catsList">` o equivalente — leer el HTML exacto del modal antes de decidir la posición, mantener el mismo estilo de contenedor que usa el resto del modal, ej. la misma clase de aviso que ya use el proyecto en otros modales si existe una genérica de tipo "banner informativo".)

- [ ] **Step 3: Añadir la llamada a `_renderCatsAviso()` en `openCatsModal()` (versión ya modificada por Task 5)**

Tras Task 5 Step 4, `openCatsModal()` en `js/modal-cats.js` debe verse así (confirmar releyendo el archivo antes de continuar — si no coincide, Task 5 no se aplicó primero):

```js
function openCatsModal(){
  if(!requirePerm('categories.manage')) return;
  syncTagsFromItems();
  const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
  if(isSuperAdmin && !deptActivo){
    toast('Elige un departamento en el selector de la barra superior primero', 'err');
    return;
  }
  if(isSuperAdmin){
    catsEditing = catsCrudo
      .filter(c => c.departamento === deptActivo)
      .map(c => ({name:c.name, c:c.c, bg:c.bg, i:c.i}));
  } else {
    catsEditing = sortedCatEntries().map(([name,v])=>({name, c:v.c, bg:v.bg, i:v.i}));
  }
  sortCatsEditing();
  renderCatsList();
  renderTagsList();
  document.getElementById('mCats').classList.add('open');
}
```

Añadir la llamada a `_renderCatsAviso()` justo antes de la línea `document.getElementById('mCats').classList.add('open');`:

```js
  sortCatsEditing();
  renderCatsList();
  renderTagsList();
  _renderCatsAviso();
  document.getElementById('mCats').classList.add('open');
}

function _renderCatsAviso(){
  const el = document.getElementById('catsAvisoGenerico');
  if(!el) return;
  const isSuperAdmin = String(SESSION?.rol || '').trim().toLowerCase() === 'superadmin';
  if(catsPropias || isSuperAdmin){
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  el.style.display = 'block';
  el.innerHTML = `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px">
      <strong>Tu departamento aún no tiene categorías propias</strong> — tus ítems usan solo la etiqueta genérica.
      <button class="btn btn-sm" style="margin-left:8px" onclick="addCategoriasSugeridas()">✨ Crear categorías sugeridas</button>
    </div>`;
}
```

- [ ] **Step 4: Escribir `addCategoriasSugeridas()`**

Añadir en `js/modal-cats.js`, junto a `addCatRow()`:

```js
const CATS_SUGERIDAS_GENERICO = [
  { name: 'Material fungible', i: '📦', c: '#d97706', bg: '#fffbeb' },
  { name: 'Herramientas',      i: '🔨', c: '#2563eb', bg: '#eff6ff' },
  { name: 'Mobiliario',        i: '🪑', c: '#059669', bg: '#ecfdf5' },
  { name: 'Audiovisual',       i: '📽️', c: '#7c3aed', bg: '#f5f3ff' },
  { name: 'Informática',       i: '💻', c: '#0891b2', bg: '#ecfeff' },
  { name: 'Otros',             i: '📁', c: '#6b7280', bg: '#f9fafb' },
];

function addCategoriasSugeridas(){
  const existentes = new Set(catsEditing.map(c => c.name.trim().toLowerCase()));
  const nuevas = CATS_SUGERIDAS_GENERICO.filter(c => !existentes.has(c.name.toLowerCase()));
  if(!nuevas.length){
    toast('Ya tienes todas las categorías sugeridas', 'ok');
    return;
  }
  catsEditing.push(...nuevas.map(c => ({name:c.name, i:c.i, c:c.c, bg:c.bg})));
  renderCatsList();
  toast(`${nuevas.length} categorías sugeridas añadidas — pulsa Guardar para aplicar`, 'ok');
}
```

**Nota:** usa `suggestCatIcon()` (ya existente en `js/config.js:215`) en vez del icono fijo si se prefiere consistencia total con el resto del proyecto — pero para estas 6 categorías genéricas fijas, un icono explícito por entrada es más simple y no depende de que el nombre calce con las regex de `CAT_ICON_SUGGESTIONS`. No cambiar esta decisión sin motivo — ya fue acordada con el usuario en el spec (icono/color "razonables", sin necesidad de portar `defaultCatStyle`).

- [ ] **Step 5: Verificación manual con Playwright contra producción (tras deploy de Task 8)**

Login como `departamentofilosofia`/`departamentofilosofia` (o cualquier cuenta de un departamento sin categorías propias — confirmado en Task 3 Step 2 que `filosofia` tiene 0). Abrir "🏷️ Gestionar categorías" — confirmar que aparece el aviso. Pulsar "Crear categorías sugeridas" — confirmar que aparecen 6 filas nuevas en la lista, editables. Pulsar "Guardar cambios" — confirmar que no da error. Reabrir el modal — confirmar que el aviso ya no aparece (`catsPropias` ahora `true`).

- [ ] **Step 6: Limpiar datos de prueba**

Si se usó una cuenta de departamento real (no una de prueba) para verificar, decidir con el usuario si las categorías creadas se mantienen (probablemente sí, ya que es exactamente la funcionalidad pedida) o se revierten manualmente vía:

```bash
npx wrangler d1 execute boscoinventario --remote --command="DELETE FROM categorias WHERE departamento='filosofia'"
```

- [ ] **Step 7: Commit**

```bash
git add js/modal-cats.js index.html js/config.js js/auth.js
git commit -m "feat: aviso de categorías genéricas + set inicial sugerido por departamento"
```

---

## Task 8: Deploy final y actualización de CLAUDE.md

**Files:**
- Modify: `sw.js:10` (`VERSION`)
- Modify: `CLAUDE.md` (sección "Pendiente (Próximas sesiones)" — marcar ítem 2 del roadmap como parcialmente resuelto, y añadir entrada a "Historial de sesiones")

**Interfaces:**
- Consumes: ninguna.
- Produces: build final desplegado, documentación del proyecto actualizada.

Este task asume que Tasks 1-5 y 7 ya están commiteadas localmente (cada una terminaba con su propio `git commit`, pero ninguna hizo `git push` todavía) — este es el único push real de todo el plan.

- [ ] **Step 1: Bump de versión**

En `sw.js`, incrementar `VERSION` una vez más (todas las tasks anteriores no tocaron `sw.js` — el bump se hace una sola vez aquí, al final, para no obligar a recargar la app en cada commit intermedio).

- [ ] **Step 2: Actualizar `CLAUDE.md`**

En la sección "Pendiente (Próximas sesiones)", ítem 2 ("Fase 3 del plan multi-departamento"), actualizar para reflejar que el selector de departamento activo para superadmin ya cubre los 3 modales de gestión (aulas, categorías y ciclos) — no solo 2, ya que el gap de `CATS` sin `departamento` por entrada se resolvió en Task 3 (`catsCrudo`) y Task 5 Step 4. Anotar también que B (alta de usuarios con departamento) ya estaba resuelta desde antes de esta sesión, confirmado por verificación manual con Playwright.

Añadir una entrada nueva en "Historial de sesiones" resumiendo el trabajo de esta sesión: verificación de B como ya implementado (sin cambios de código), selector de departamento activo para superadmin cubriendo aulas/categorías/ciclos (Fase 3 completa para estos 3 modales — sigue sin selector para el resto de la app, ver "Fuera de alcance" del spec), aviso de categorías genéricas con set sugerido para los 21 departamentos sin categorías propias, y el fix de aula visible en el buscador de préstamos (desplegado por separado, v531).

- [ ] **Step 3: Verificar que no quedan commits sin pushear**

```bash
git log origin/main..HEAD --oneline
```

Expected: lista de todos los commits de Tasks 1-5, 7 y este mismo Step 2, ninguno de ellos ya en `origin/main`.

- [ ] **Step 4: Commit final y push**

```bash
git add sw.js CLAUDE.md
git commit -m "docs: actualizar CLAUDE.md tras Fase 3 (selector departamento superadmin) y categorías sugeridas"
git push origin main
```

- [ ] **Step 5: Verificación end-to-end completa con Playwright contra producción**

Ejecutar Task 5 Step 6 (aulas y ciclos) y Task 7 Step 5 (categorías) ahora que el deploy es real. Además, verificar el caso de `modal-cats.js` con superadmin específicamente (no cubierto en los steps anteriores porque dependía de este deploy):

1. Login `Seba`/`Seba`, elegir "Tecnología" en el selector.
2. Abrir "🏷️ Gestionar categorías" — confirmar que NO aparece el aviso de categorías genéricas (irrelevante para superadmin, ver Task 3) y que la lista muestra solo categorías de Tecnología (si tiene alguna) o vacía (si no tiene, como es el caso real hoy).
3. Añadir una categoría de prueba, guardar, confirmar sin error 403.
4. Verificar en D1:

```bash
npx wrangler d1 execute boscoinventario --remote --command="SELECT name, departamento FROM categorias WHERE departamento='tecnologia'"
```

5. Limpiar el dato de prueba:

```bash
npx wrangler d1 execute boscoinventario --remote --command="DELETE FROM categorias WHERE departamento='tecnologia' AND name='<nombre de prueba usado>'"
```

---

## Self-Review Notes (completado durante la escritura del plan)

- **Cobertura del spec:** A cubierto por Tasks 1, 2, 4, 5 (incluye los 3 modales: aulas, categorías y ciclos). C cubierto por Tasks 3, 7. B confirmado sin trabajo (ya en el spec). Task 8 despliega todo y verifica end-to-end.
- **Gap detectado durante el diseño del plan, no visible en el spec original:** `CATS` (a diferencia de `AULAS`/`CICLOS`) no tenía `departamento` por entrada en la estructura que consume el frontend — filtrar categorías por `deptActivo` para superadmin no era directo con la forma actual de `meta.js`/`CATS`. Resuelto sin tocar `CATS` (usada intacta en 7 archivos del frontend): Task 3 expone un campo nuevo y separado, `catsCrudo` (solo para superadmin, filas crudas con `departamento`), que Task 5 Step 4 usa para filtrar/reconstruir sin afectar la vista global de superadmin en el resto de la app.
- **Consistencia de tipos:** `deptActivo` (string, slug o `''`), `catsPropias` (boolean) y `catsCrudo` (array de `{name,c,bg,i,orden,departamento}`) se usan con el mismo nombre y forma en todos los tasks que los consumen.
- **Orden de ejecución:** Task 5 Step 4 (filtro de categorías) debe ejecutarse antes que Task 7 Step 3 (aviso), porque ambas tocan `openCatsModal()` — señalado explícitamente en el "Contexto para el implementador" de Task 7.
- **Placeholders:** ninguno — todo paso de código incluye el código real a escribir.
