# Restringir acceso de profesores al departamento compartido "IES Juan Bosco" — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El rol `profesor` deja de ver, editar, prestar/devolver y consultar historial de ítems, aulas, ubicaciones y ciclos archivados en el departamento compartido `iesjuanbosco`. Los roles `jefe/a departamento` y `superadmin` no cambian su comportamiento actual.

**Architecture:** Backend Cloudflare Workers (`functions/api/*.js`), sin frameworks, D1 como base de datos. En los 5 archivos que hoy comprueban `departamento='iesjuanbosco'` en sus queries SQL o condicionales JS, se añade una función `isProfesor(user)` (mismo patrón que la ya existente `isSuperAdmin(user)`, duplicada por archivo) y se calcula una variable local `genericDept` que vale `'iesjuanbosco'` normalmente pero un valor centinela `'__none__'` (que nunca existirá como valor real de `departamento`) cuando el usuario es profesor — así las cláusulas `OR departamento='${GENERIC_DEPT}'` dejan de macthear sin tener que reescribir cada condicional.

**Tech Stack:** JS (Cloudflare Workers runtime), SQL (D1/SQLite), sin test runner automatizado en el proyecto.

## Global Constraints

- No se modifica el comportamiento para `jefe/a departamento` ni `superadmin` — deben quedar bit-a-bit idénticos a como están hoy.
- No se borran ni mueven datos — los ítems archivados en `iesjuanbosco` siguen existiendo tal cual, solo se ocultan/deniegan para profesores.
- No se toca el frontend — `CICLOS`/`AULAS`/categorías que el frontend recibe ya vienen filtrados por estos mismos endpoints, así que el desplegable de "Nuevo ítem" (`js/modal-item.js:92`, puebla `<select id="f_ciclo">` directamente desde `CICLOS`) dejará de ofrecer el ciclo "IES Juan Bosco" a un profesor automáticamente, sin cambios adicionales.
- El valor centinela para "departamento que nunca existe" es la cadena literal `'__none__'` en los 5 archivos — debe ser idéntico en todos para consistencia, aunque cada archivo la calcula de forma independiente (no hay módulos ES para compartir una constante).
- Verificación manual únicamente (sin test runner) — no se dispone de entorno D1 local aislado para pruebas automatizadas; se hace revisión de código + verificación de sintaxis con `node --check`.
- Cambiar `VERSION` en `sw.js` al final, como exige el workflow estándar del proyecto (viene de v493 tras la sesión anterior).

---

### Task 1: `functions/api/list.js`

**Files:**
- Modify: `functions/api/list.js:5-7` (añadir `isProfesor`), `:85-89` (calcular `genericDept`), `:139` (query inventario), `:151` (query préstamos), `:154` (query aulas), `:160` (query ciclos)

**Interfaces:**
- Produces: `isProfesor(user): boolean`, variable local `genericDept: string` dentro de `onRequestGet`.

- [ ] **Step 1: Añadir `isProfesor` junto a `isSuperAdmin` (tras línea 7)**

```js
function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

function isProfesor(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'profesor';
}
```

- [ ] **Step 2: Calcular `genericDept` en `onRequestGet` (tras la línea `const superadmin = isSuperAdmin(user);`, línea 88)**

Reemplazar:
```js
export async function onRequestGet({ request, env, data }) {
  const user = data?.user || request.user;
  const dept = data?.departamento || request.departamento || '';
  const superadmin = isSuperAdmin(user);
```
por:
```js
export async function onRequestGet({ request, env, data }) {
  const user = data?.user || request.user;
  const dept = data?.departamento || request.departamento || '';
  const superadmin = isSuperAdmin(user);
  const genericDept = isProfesor(user) ? '__none__' : GENERIC_DEPT;
```

- [ ] **Step 3: Sustituir `GENERIC_DEPT` por `genericDept` en las 4 queries (líneas 139, 151, 154, 160)**

Línea 139:
```js
  const itemsQuery = superadmin
    ? 'SELECT * FROM inventario ORDER BY id'
    : `SELECT * FROM inventario WHERE (oculto IS NULL OR oculto != 1) AND (departamento=? OR departamento='${genericDept}') ORDER BY id`;
```

Línea 151 (dentro del array `Promise.all`, query de préstamos):
```js
    superadmin
      ? env.DB.prepare('SELECT p.* FROM prestamos p JOIN inventario i ON i.id=p.itemId ORDER BY p.id').all()
      : env.DB.prepare(`SELECT p.* FROM prestamos p JOIN inventario i ON i.id=p.itemId WHERE i.departamento=? OR i.departamento='${genericDept}' ORDER BY p.id`).bind(dept).all(),
```
(nota: la rama `superadmin` de esta línea ya existía igual, solo cambia la rama no-superadmin — confirmar contra el archivo real antes de aplicar, el texto de la rama superadmin de arriba es orientativo si difiere ligeramente del original, mantener la rama superadmin EXACTAMENTE como está y solo tocar la cláusula `GENERIC_DEPT` de la rama no-superadmin).

Línea 154 (aulas):
```js
    superadmin
      ? env.DB.prepare('SELECT * FROM aulas ORDER BY orden').all()
      : env.DB.prepare(`SELECT * FROM aulas WHERE departamento=? OR departamento='' OR departamento IS NULL OR departamento='${genericDept}' ORDER BY orden`).bind(dept).all(),
```

Línea 160 (ciclos):
```js
    superadmin
      ? env.DB.prepare('SELECT * FROM ciclos ORDER BY cicloOrden, modOrden').all()
      : env.DB.prepare(`SELECT * FROM ciclos WHERE departamento=? OR departamento='${genericDept}' ORDER BY cicloOrden, modOrden`).bind(dept).all(),
```

Solo cambia `${GENERIC_DEPT}` → `${genericDept}` en las 4 queries; el resto de cada línea permanece idéntico al original.

- [ ] **Step 4: Verificar sintaxis**

```bash
node --check "functions/api/list.js"
```
Esperado: sin salida (válido).

- [ ] **Step 5: Commit**

```bash
git add functions/api/list.js
git commit -m "feat: profesores no ven iesjuanbosco en list.js (inventario/prestamos/aulas/ciclos)"
```

---

### Task 2: `functions/api/meta.js`

**Files:**
- Modify: `functions/api/meta.js:55-57` (añadir `isProfesor`), `:59-62` (calcular `genericDept`), `:68` (aulas), `:74` (categorías de inventario), `:78` (ubicaciones de inventario), `:81` (ciclos)

**Interfaces:**
- Produces: `isProfesor(user): boolean`, variable local `genericDept` dentro de `onRequestGet`.

- [ ] **Step 1: Añadir `isProfesor` junto a `isSuperAdmin` (tras línea 57)**

```js
function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

function isProfesor(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'profesor';
}
```

- [ ] **Step 2: Calcular `genericDept` en `onRequestGet`**

Reemplazar:
```js
export async function onRequestGet({ request, env, data }) {
  const user = data?.user || request.user;
  const dept = data?.departamento || '';
  const superadmin = isSuperAdmin(user);
```
por:
```js
export async function onRequestGet({ request, env, data }) {
  const user = data?.user || request.user;
  const dept = data?.departamento || '';
  const superadmin = isSuperAdmin(user);
  const genericDept = isProfesor(user) ? '__none__' : GENERIC_DEPT;
```

- [ ] **Step 3: Sustituir `GENERIC_DEPT` por `genericDept` en las 4 queries (líneas 68, 74, 78, 81)**

Línea 68 (aulas):
```js
      : env.DB.prepare(`SELECT * FROM aulas WHERE departamento=? OR departamento='' OR departamento IS NULL OR departamento='${genericDept}' ORDER BY orden`).bind(dept).all(),
```
Línea 74 (categorías de inventario):
```js
      : env.DB.prepare(`SELECT DISTINCT cat FROM inventario WHERE cat IS NOT NULL AND trim(cat) != '' AND (departamento=? OR departamento='${genericDept}') ORDER BY cat`).bind(dept).all(),
```
Línea 78 (ubicaciones de inventario):
```js
      : env.DB.prepare(`SELECT DISTINCT loc FROM inventario WHERE loc IS NOT NULL AND trim(loc) != '' AND (departamento=? OR departamento='${genericDept}') ORDER BY loc`).bind(dept).all(),
```
Línea 81 (ciclos):
```js
      : env.DB.prepare(`SELECT * FROM ciclos WHERE departamento=? OR departamento='${genericDept}' ORDER BY cicloOrden, modOrden`).bind(dept).all(),
```

Solo cambia `${GENERIC_DEPT}` → `${genericDept}`; el resto de cada línea permanece idéntico.

- [ ] **Step 4: Verificar sintaxis**

```bash
node --check "functions/api/meta.js"
```

- [ ] **Step 5: Commit**

```bash
git add functions/api/meta.js
git commit -m "feat: profesores no ven iesjuanbosco en meta.js (aulas/cats/ubicaciones/ciclos)"
```

---

### Task 3: `functions/api/item.js`

**Files:**
- Modify: `functions/api/item.js:6-8` (añadir `isProfesor`), `:73-78` (calcular `genericDept` y pasarlo a `resolveItemDept`), `:13-17` (`resolveItemDept` acepta `genericDept`), `:102` (guard update), `:119` (guard delete)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `isProfesor(user): boolean`; `resolveItemDept(item, ownDept, superadmin, genericDept)` — firma ampliada con un 4º parámetro.

- [ ] **Step 1: Añadir `isProfesor` junto a `isSuperAdmin` (tras línea 8)**

```js
function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

function isProfesor(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'profesor';
}
```

- [ ] **Step 2: Ampliar `resolveItemDept` para aceptar `genericDept` (líneas 13-17)**

Reemplazar:
```js
function resolveItemDept(item, ownDept, superadmin){
  if (superadmin) return item.departamento || ownDept || '';
  const modCiclo = String(item.mod || '').split('__')[0];
  return modCiclo === GENERIC_DEPT ? GENERIC_DEPT : ownDept;
}
```
por:
```js
function resolveItemDept(item, ownDept, superadmin, genericDept){
  if (superadmin) return item.departamento || ownDept || '';
  const modCiclo = String(item.mod || '').split('__')[0];
  return modCiclo === genericDept ? genericDept : ownDept;
}
```

Nota: como un profesor nunca podrá tener seleccionado el ciclo `iesjuanbosco` en su formulario (el frontend ya no se lo ofrece, al no venir en su `CICLOS`), este cambio es defensivo — cubre también el caso de `bulkImport` con datos manuales que intenten forzar `mod` a `iesjuanbosco__...`.

- [ ] **Step 3: Calcular `genericDept` en `onRequestPost` y pasarlo a las 2 llamadas de `resolveItemDept`**

Reemplazar:
```js
export async function onRequestPost({ request, env, data }) {
  const body = await request.json();
  const { action, item, id } = body;
  const user = await getAuditActor(request, env, data);
  const superadmin = isSuperAdmin(user);
  const dept = user.departamento || '';
```
por:
```js
export async function onRequestPost({ request, env, data }) {
  const body = await request.json();
  const { action, item, id } = body;
  const user = await getAuditActor(request, env, data);
  const superadmin = isSuperAdmin(user);
  const dept = user.departamento || '';
  const genericDept = isProfesor(user) ? '__none__' : GENERIC_DEPT;
```

Buscar las llamadas a `resolveItemDept(item, dept, superadmin)` (una en `action==='add'`, línea 91; otra dentro de `bulkImport`, línea ~143 según el reporte de exploración previo) y añadir el 4º argumento:
```js
item.departamento = resolveItemDept(item, dept, superadmin, genericDept);
```

(Verificar el texto exacto de la llamada en `bulkImport` leyendo el archivo real antes de aplicar — debe seguir el mismo patrón `resolveItemDept(item, dept, superadmin)` con el mismo nombre de variables `item`/`dept`/`superadmin` ya en scope en ese bloque.)

- [ ] **Step 4: Ajustar los guards de `update` (línea 102) y `delete` (línea 119)**

Línea 102, dentro de `action === 'update'`:
```js
  if (action === 'update') {
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, item.id);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
```

Línea 119, dentro de `action === 'delete'`:
```js
  if (action === 'delete') {
    if (!superadmin) {
      const currentDept = await itemDept(env.DB, id);
      if (currentDept !== dept && currentDept !== genericDept) {
        return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }
```

Solo cambia `GENERIC_DEPT` → `genericDept` en ambos `if`.

- [ ] **Step 5: Verificar sintaxis**

```bash
node --check "functions/api/item.js"
```

- [ ] **Step 6: Commit**

```bash
git add functions/api/item.js
git commit -m "feat: profesores no pueden editar/eliminar ni archivar items en iesjuanbosco"
```

---

### Task 4: `functions/api/prestar.js`

**Files:**
- Modify: `functions/api/prestar.js:5-7` (añadir `isProfesor`), `:14-16` (`ownsItemDept` acepta `genericDept`), `:69-74` (calcular `genericDept`), `:79`, `:108`, `:163` (pasar `genericDept` a `ownsItemDept`)

**Interfaces:**
- Produces: `isProfesor(user): boolean`; `ownsItemDept(itemDeptValue, ownDept, genericDept)` — firma ampliada con un 3º parámetro.

- [ ] **Step 1: Añadir `isProfesor` junto a `isSuperAdmin` (tras línea 7)**

```js
function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

function isProfesor(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'profesor';
}
```

- [ ] **Step 2: Ampliar `ownsItemDept` (líneas 14-16)**

Reemplazar:
```js
function ownsItemDept(itemDeptValue, ownDept){
  return itemDeptValue === ownDept || itemDeptValue === GENERIC_DEPT;
}
```
por:
```js
function ownsItemDept(itemDeptValue, ownDept, genericDept){
  return itemDeptValue === ownDept || itemDeptValue === genericDept;
}
```

- [ ] **Step 3: Calcular `genericDept` en `onRequestPost` (tras línea 74)**

Reemplazar:
```js
export async function onRequestPost({ request, env, data }) {
  const body = await request.json();
  const { action } = body;
  const user = data?.user || request.user;
  const superadmin = isSuperAdmin(user);
  const dept = user?.departamento || '';
```
por:
```js
export async function onRequestPost({ request, env, data }) {
  const body = await request.json();
  const { action } = body;
  const user = data?.user || request.user;
  const superadmin = isSuperAdmin(user);
  const dept = user?.departamento || '';
  const genericDept = isProfesor(user) ? '__none__' : GENERIC_DEPT;
```

- [ ] **Step 4: Pasar `genericDept` en las 3 llamadas a `ownsItemDept` (líneas 79, 108, 163)**

Línea 79 (`prestarCaja`):
```js
    if (!superadmin && !ownsItemDept(await itemDept(env.DB, cajaId), dept, genericDept)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
```

Línea 108 (`prestar`):
```js
    if (!superadmin && !ownsItemDept(await itemDept(env.DB, pres.itemId), dept, genericDept)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
```

Línea 163 (`devolver`):
```js
    if (!superadmin && !ownsItemDept(await itemDept(env.DB, pres.itemId), dept, genericDept)) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
```

- [ ] **Step 5: Verificar sintaxis**

```bash
node --check "functions/api/prestar.js"
```

- [ ] **Step 6: Commit**

```bash
git add functions/api/prestar.js
git commit -m "feat: profesores no pueden prestar/devolver items de iesjuanbosco"
```

---

### Task 5: `functions/api/historial.js`

**Files:**
- Modify: `functions/api/historial.js:11-13` (añadir `isProfesor`), `:71-76` (calcular `genericDept`), `:87` (guard de historial de ítem)

**Interfaces:**
- Produces: `isProfesor(user): boolean`, variable local `genericDept` dentro de `onRequest`.

- [ ] **Step 1: Añadir `isProfesor` junto a `isSuperAdmin` (tras línea 13)**

```js
function isSuperAdmin(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'superadmin';
}

function isProfesor(user){
  return String(user?.rol || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === 'profesor';
}
```

- [ ] **Step 2: Calcular `genericDept` en `onRequest` (tras línea 76)**

Reemplazar:
```js
export async function onRequest(context) {
  const { request, env, data } = context;
  const url = new URL(request.url);
  const user = data?.user || request.user;
  const superadmin = isSuperAdmin(user);
  const dept = user?.departamento || '';
```
por:
```js
export async function onRequest(context) {
  const { request, env, data } = context;
  const url = new URL(request.url);
  const user = data?.user || request.user;
  const superadmin = isSuperAdmin(user);
  const dept = user?.departamento || '';
  const genericDept = isProfesor(user) ? '__none__' : GENERIC_DEPT;
```

- [ ] **Step 3: Ajustar el guard de la línea 87**

Reemplazar:
```js
          if (itemRow && itemRowDept !== dept && itemRowDept !== GENERIC_DEPT) {
            return json({ ok: false, error: 'No autorizado' }, { status: 403 });
          }
```
por:
```js
          if (itemRow && itemRowDept !== dept && itemRowDept !== genericDept) {
            return json({ ok: false, error: 'No autorizado' }, { status: 403 });
          }
```

- [ ] **Step 4: Verificar sintaxis**

```bash
node --check "functions/api/historial.js"
```

- [ ] **Step 5: Commit**

```bash
git add functions/api/historial.js
git commit -m "feat: profesores no ven historial de items de iesjuanbosco"
```

---

### Task 6: Verificación funcional manual

**Files:** ninguno — solo verificación.

- [ ] **Step 1: Verificar en D1 el valor real de rol de un usuario de prueba**

```bash
npx wrangler d1 execute boscoinventario --remote --command "SELECT usuario, rol, departamento FROM usuarios WHERE rol='profesor' LIMIT 3"
```
Confirmar que el valor de `rol` es exactamente `profesor` (minúsculas, sin variantes) tal como asume `isProfesor()`.

- [ ] **Step 2: Login como un profesor de prueba (p.ej. `profe1electricidadelectronica`) y verificar en la app desplegada**

- El inventario ya no debe mostrar ítems archivados en `iesjuanbosco` (las pantallas multimedia/pizarras de tiza de las 70 aulas genéricas).
- El desplegable de aula en "Nuevo ítem"/préstamos debe seguir mostrando las aulas globales del centro (`departamento=''`), pero no debe verse afectado por este cambio (no se tocó esa condición).
- El desplegable "Ciclo/Departamento" en "Nuevo ítem" ya no debe ofrecer la opción "IES Juan Bosco".
- Intentar prestar/devolver un ítem de `iesjuanbosco` (si el profesor conociera su ID por URL/API directa) debe devolver 403.

- [ ] **Step 3: Login como jefe/a de departamento de prueba (p.ej. `departamentoelectricidadelectronica`) y confirmar que NO ha cambiado nada**

- Sigue viendo, editando y prestando ítems de `iesjuanbosco` con normalidad.

- [ ] **Step 4: Login como superadmin y confirmar que no ha cambiado nada** (ve todo, sin relación con `genericDept`).

---

### Task 7: Actualizar versión y documentación

**Files:**
- Modify: `sw.js` (VERSION v493 → v494)
- Modify: `claude.md` (nota de sesión)

- [ ] **Step 1: Incrementar `VERSION` en `sw.js`**

De `'v493'` a `'v494'`.

- [ ] **Step 2: Añadir entrada en `claude.md`**

Resumir: el rol `profesor` deja de ver/editar/prestar ítems del departamento compartido `iesjuanbosco` (mecanismo: `isProfesor(user)` + variable `genericDept` centinela en los 5 backends afectados); jefes de departamento y superadmin sin cambios.

- [ ] **Step 3: Commit**

```bash
git add sw.js claude.md
git commit -m "chore(v494): restringir iesjuanbosco a jefes de departamento y superadmin"
```

- [ ] **Step 4: Push**

Pedir confirmación explícita antes de `git push origin main` (acción visible/compartida).

## Post-Implementation Checklist

- [ ] Los 5 archivos backend pasan `node --check`.
- [ ] Grep de verificación: `grep -rn "GENERIC_DEPT" functions/api/` debe seguir mostrando la constante definida y usada solo para calcular `genericDept` (o directamente en la rama `superadmin`, que no debe tocarse) — ninguna query debe seguir usando `${GENERIC_DEPT}` literal en la rama no-superadmin tras el cambio.
- [ ] Verificación funcional de Task 6 completada para los 3 roles.
- [ ] `sw.js` incrementado a v494.
