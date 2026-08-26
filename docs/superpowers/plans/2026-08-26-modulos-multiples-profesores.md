# Módulos con varios profesores + autoservicio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir `ciclos.responsable` (un solo nombre de texto por módulo) por una tabla de relación módulo↔profesor por login real, que admite varios profesores por módulo; y construir el flujo de autoservicio para que cualquier profesor elija sus propios módulos (al elegir departamento por primera vez, o en cualquier momento desde un botón nuevo), sin que el superadmin tenga que hacerlo.

**Architecture:** Tabla nueva `modulo_profesores(cicloId, modCod, departamento, usuario)` (PK compuesta, muchos-a-muchos). `functions/api/usuarios.js` gana dos funciones auxiliares compartidas (`reemplazarModulosUsuario` — diff completo, para el modal admin y la nueva acción de autoservicio `selectModulos`; e inserción-solo para `importModulosCSV`, que mantiene su semántica de fusión ya documentada). `functions/api/meta.js` expone `misModulos` (los del usuario logueado) y `responsablesEmails` por módulo (correos de otros profesores que lo imparten). El frontend reutiliza la UI de checklist-por-ciclo ya existente (`js/prestamos.js`) adaptándola a correos en vez de nombres, y añade un archivo nuevo (`js/modal-mis-modulos.js`) que la reusa tanto en una pantalla de onboarding (tras elegir departamento) como en un modal accesible en cualquier momento desde un botón nuevo en la topbar (visible para cualquier rol, no solo jefe/a de departamento).

**Tech Stack:** Cloudflare Pages Functions (JS, sin build), D1 (SQLite), Vanilla JS frontend sin build. Sin framework de test — verificación con `wrangler d1 execute --remote` para la migración y Playwright contra producción para el frontend, siguiendo la convención ya establecida en `docs/superpowers/plans/2026-08-25-mantenimiento-flujo-real.md`.

**Spec:** `docs/superpowers/specs/2026-08-26-modulos-multiples-profesores-design.md`

## Global Constraints

- `ciclos.responsable` **no se borra** (columna histórica inerte) — ninguna tarea de este plan debe leerla ni escribirla.
- `selectModulos` (autoservicio) usa siempre `user.usuario`/`user.departamento` del actor autenticado (de `data.user`), nunca un valor del body — mismo criterio que `selectDepartamento` (`functions/api/perfil.js`).
- `userAssignModulos` mantiene su scoping por departamento ya existente (jefe/a de departamento solo toca usuarios de su propio departamento; superadmin, cualquiera) — solo cambia la clave de identidad (login en vez de nombre). Al resolver el departamento del **objetivo** por su propio login en vez de usar el departamento del actor, esto además corrige un bug ya documentado en `CLAUDE.md` ("`userAssignModulos` ejecutado por un superadmin solo toca ciclos de su propio departamento de referencia").
- `importModulosCSV` mantiene su semántica de **fusión** (solo añade, nunca quita módulos que el profesor ya tuviera) — no debe reutilizar el diff completo de `reemplazarModulosUsuario`.
- El botón nuevo de autoservicio ("📚 Mis módulos") va en la topbar general (`#topbarBtns`, visible para cualquier rol autenticado), **no** dentro de `#deptMenuWrap`/`#deptMenu` — ese menú está oculto por completo para cualquier rol sin permiso `config.manage` (jefe/a de departamento o superadmin), así que un profesor normal nunca lo vería si se colocara ahí.
- Todo cambio de `sw.js` sube `VERSION` (convención del proyecto, cache-bust de clientes).

---

### Task 1: Migración D1 — tabla `modulo_profesores`

**Files:**
- Create: `migrations/0032_modulo_profesores.sql`

**Interfaces:**
- Produces: tabla `modulo_profesores(cicloId, modCod, departamento, usuario)`, PK compuesta por las 4 columnas, índice `idx_modulo_profesores_usuario`. Las Tasks 2-4 escriben/leen contra esta tabla — pueden escribirse sin que la migración esté aplicada (cada función la crea también con `CREATE TABLE IF NOT EXISTS` como red de seguridad, mismo patrón que el resto del proyecto), pero la verificación end-to-end (Task 9) sí depende de que esté aplicada en remoto.

- [ ] **Step 1: Crear el archivo de migración**

Crear `migrations/0032_modulo_profesores.sql` con exactamente este contenido:

```sql
CREATE TABLE IF NOT EXISTS modulo_profesores (
  cicloId      TEXT NOT NULL,
  modCod       TEXT NOT NULL,
  departamento TEXT NOT NULL,
  usuario      TEXT NOT NULL,
  PRIMARY KEY (cicloId, modCod, departamento, usuario)
);
CREATE INDEX IF NOT EXISTS idx_modulo_profesores_usuario ON modulo_profesores(usuario);

-- Backfill: copia cada `ciclos.responsable` cuyo nombre coincide exactamente
-- (case-insensitive, mismo departamento) con un usuario existente. No se
-- borra `ciclos.responsable` — queda como dato histórico inerte.
INSERT OR IGNORE INTO modulo_profesores (cicloId, modCod, departamento, usuario)
SELECT c.cicloId, c.modCod, c.departamento, u.usuario
FROM ciclos c
JOIN usuarios u
  ON LOWER(TRIM(u.nombre)) = LOWER(TRIM(c.responsable))
  AND u.departamento = c.departamento
WHERE c.responsable IS NOT NULL AND TRIM(c.responsable) != '';
```

- [ ] **Step 2: Aplicar la migración en la D1 remota**

Run: `npx wrangler d1 execute boscoinventario --remote --file=migrations/0032_modulo_profesores.sql`

Si `npx wrangler whoami` falla o pide login interactivo, esta tarea queda **BLOCKED** — reportarlo así (incidente ya documentado en `CLAUDE.md`, el flujo OAuth de wrangler necesita un navegador real). Si hay sesión activa (comprobar con `npx wrangler whoami` antes de ejecutar), continuar.

Expected: sin errores. La tabla `modulo_profesores` queda creada y poblada con el backfill.

- [ ] **Step 3: Verificar el resultado y detectar nombres sin migrar**

Run: `npx wrangler d1 execute boscoinventario --remote --command "SELECT COUNT(*) as n FROM modulo_profesores"`
Expected: una fila con `n` > 0 si ya había algún `ciclos.responsable` relleno en producción (puede ser 0, no es un error si no había ninguno).

Run (consulta de revisión manual — nombres que NO se migraron por no encontrar match exacto):
```
npx wrangler d1 execute boscoinventario --remote --command "SELECT DISTINCT c.departamento, c.responsable FROM ciclos c LEFT JOIN usuarios u ON LOWER(TRIM(u.nombre)) = LOWER(TRIM(c.responsable)) AND u.departamento = c.departamento WHERE c.responsable IS NOT NULL AND TRIM(c.responsable) != '' AND u.usuario IS NULL"
```
Anotar el resultado en el resumen final de la Task 9 (si hay filas, son asignaciones que un jefe/a de departamento tendrá que rehacer a mano desde el modal admin — no es un error de la migración, es un dato que no se puede adivinar).

- [ ] **Step 4: Commit**

```bash
git add migrations/0032_modulo_profesores.sql
git commit -m "feat(modulos): migración tabla modulo_profesores (varios profesores por módulo)"
```

---

### Task 2: Backend `functions/api/usuarios.js` — helper compartido + `userAssignModulos` + `selectModulos`

**Files:**
- Modify: `functions/api/usuarios.js:209-230` (acción `userAssignModulos`, sustituir por completo)

**Interfaces:**
- Consumes: nada de Task 1 más allá del esquema (la tabla se autocura igualmente si la migración no llegó a aplicarse).
- Produces: `moduloIdStr(row)` (ya existe como `moduloId(row)`, sin cambios), `reemplazarModulosUsuario(db, usuarioLogin, departamento, modulosNuevos)` (función async, sin retorno, hace diff completo add+delete contra `modulo_profesores`) — la Task 3 la reutiliza tal cual en la nueva acción `selectModulos`. Acción `userAssignModulos` pasa a esperar `{action:'userAssignModulos', usuario, modulos}` (antes `nombre`) — la Task 6 (frontend) depende de este cambio de nombre de campo.

- [ ] **Step 1: Localizar el bloque a sustituir**

En `functions/api/usuarios.js:209-230`, localizar:

```js
  if (action === 'userAssignModulos') {
    const nombre = (body.nombre || '').trim();
    const modulos = Array.isArray(body.modulos) ? body.modulos.map(String) : [];
    const legacyByCode = modulos.length > 0 && modulos.every(m => !m.includes('__'));
    if (!nombre) return Response.json({ ok: false, error: 'Nombre requerido' });
    await env.DB.prepare("ALTER TABLE ciclos ADD COLUMN responsable TEXT DEFAULT ''").run().catch(() => {});
    const rows = superadmin
      ? await env.DB.prepare('SELECT cicloId, modCod, responsable FROM ciclos').all()
      : await env.DB.prepare('SELECT cicloId, modCod, responsable FROM ciclos WHERE departamento=?').bind(dept).all();
    for (const row of rows.results) {
      const id = moduloId(row);
      const esMio = modulos.includes(id) || (legacyByCode && modulos.includes(String(row.modCod)));
      const eraMio = (row.responsable || '').toLowerCase() === nombre.toLowerCase();
      if (esMio && !eraMio) {
        await env.DB.prepare('UPDATE ciclos SET responsable=? WHERE cicloId=? AND modCod=? AND departamento=?').bind(nombre, row.cicloId, row.modCod, dept).run();
      } else if (!esMio && eraMio) {
        await env.DB.prepare("UPDATE ciclos SET responsable='' WHERE cicloId=? AND modCod=? AND departamento=?").bind(row.cicloId, row.modCod, dept).run();
      }
    }
    await auditLog(env.DB, user, 'userAssignModulos', `Módulos asignados a ${nombre}: ${modulos.join(',')}`);
    return Response.json({ ok: true });
  }
```

- [ ] **Step 2: Reemplazar por la versión nueva**

Sustituir ese bloque completo por:

```js
  if (action === 'userAssignModulos') {
    const usuarioDestino = String(body.usuario || '').trim();
    const modulos = Array.isArray(body.modulos) ? body.modulos.map(String) : [];
    if (!usuarioDestino) return Response.json({ ok: false, error: 'Usuario requerido' });
    const targetRow = await env.DB.prepare('SELECT departamento FROM usuarios WHERE usuario=?').bind(usuarioDestino).first();
    if (!targetRow) return Response.json({ ok: false, error: 'Usuario no encontrado' });
    if (!superadmin && targetRow.departamento !== dept) {
      return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    await reemplazarModulosUsuario(env.DB, usuarioDestino, targetRow.departamento || '', modulos);
    await auditLog(env.DB, user, 'userAssignModulos', `Módulos asignados a ${usuarioDestino}: ${modulos.join(',')}`);
    return Response.json({ ok: true });
  }

  if (action === 'selectModulos') {
    const modulos = Array.isArray(body.modulos) ? body.modulos.map(String) : [];
    if (!dept) return Response.json({ ok: false, error: 'Selecciona primero tu departamento' });
    await reemplazarModulosUsuario(env.DB, user.usuario, dept, modulos);
    await auditLog(env.DB, user, 'selectModulos', `Módulos propios actualizados: ${modulos.join(',')}`);
    return Response.json({ ok: true });
  }
```

Nota: el bug pre-existente (`userAssignModulos` de un superadmin solo tocaba ciclos de su propio departamento de referencia, documentado en `CLAUDE.md`) queda corregido: `targetRow.departamento` es el departamento real del usuario destino, no el del actor.

- [ ] **Step 3: Añadir la función compartida `reemplazarModulosUsuario`**

Justo después de `function moduloId(row) { ... }` (`functions/api/usuarios.js:15-17`), insertar:

```js
// Diff completo entre lo que el usuario tiene hoy en `modulo_profesores` y
// `modulosNuevos` (array de moduloId, formato `cicloId__modCod`) — añade lo
// que falta, borra lo que sobra. Usada por `userAssignModulos` (admin,
// cualquier usuario destino) y `selectModulos` (autoservicio, siempre el
// propio actor) — nunca por `importModulosCSV`, que solo añade (ver esa
// acción más abajo).
async function reemplazarModulosUsuario(db, usuarioLogin, departamento, modulosNuevos) {
  await db.prepare('CREATE TABLE IF NOT EXISTS modulo_profesores (cicloId TEXT NOT NULL, modCod TEXT NOT NULL, departamento TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (cicloId, modCod, departamento, usuario))').run().catch(() => {});
  const actuales = await db.prepare('SELECT cicloId, modCod FROM modulo_profesores WHERE usuario=? AND departamento=?').bind(usuarioLogin, departamento).all();
  const idsActuales = new Set((actuales.results || []).map(r => moduloId(r)));
  const idsNuevos = new Set(modulosNuevos.filter(id => id.includes('__')));
  for (const id of idsNuevos) {
    if (idsActuales.has(id)) continue;
    const [cicloId, modCod] = id.split('__');
    await db.prepare('INSERT OR IGNORE INTO modulo_profesores (cicloId, modCod, departamento, usuario) VALUES (?,?,?,?)').bind(cicloId, modCod, departamento, usuarioLogin).run();
  }
  for (const id of idsActuales) {
    if (idsNuevos.has(id)) continue;
    const [cicloId, modCod] = id.split('__');
    await db.prepare('DELETE FROM modulo_profesores WHERE cicloId=? AND modCod=? AND departamento=? AND usuario=?').bind(cicloId, modCod, departamento, usuarioLogin).run();
  }
}
```

- [ ] **Step 4: Verificar sintaxis**

Run: `node --check functions/api/usuarios.js`
Expected: sin salida (sin errores de sintaxis).

- [ ] **Step 5: Commit**

```bash
git add functions/api/usuarios.js
git commit -m "feat(modulos): userAssignModulos por login + nueva accion selectModulos"
```

---

### Task 3: Backend `functions/api/usuarios.js` — `getUsers` y `importModulosCSV`

**Files:**
- Modify: `functions/api/usuarios.js:100-132` (acción `getUsers`)
- Modify: `functions/api/usuarios.js` (acción `importModulosCSV`, bloque final "Aplicar asignaciones")

**Interfaces:**
- Consumes: `reemplazarModulosUsuario` no se usa aquí (`importModulosCSV` mantiene su propia lógica de solo-inserción, ver Step 2).
- Produces: `getUsers` devuelve `todosModulos[].responsablesEmails` (array, ya no `.responsable` string) y `usuarios[].modulos` calculado por login — la Task 6 (frontend `js/prestamos.js`) depende de este cambio de forma.

- [ ] **Step 1: Reescribir `getUsers`**

En `functions/api/usuarios.js:100-132`, localizar el bloque completo de `if (action === 'getUsers') { ... }` (empieza en la línea 100, termina en la línea 132 con el primer `}` que cierra el `if`) y sustituirlo por:

```js
  if (action === 'getUsers') {
    // Autocura las columnas de bloqueo por intentos de login si la migración
    // 0031 aún no se ha aplicado en remoto — mismo patrón que la tabla de
    // módulos más abajo.
    await env.DB.prepare('ALTER TABLE usuarios ADD COLUMN intentos_fallidos INTEGER DEFAULT 0').run().catch(() => {});
    await env.DB.prepare('ALTER TABLE usuarios ADD COLUMN bloqueado INTEGER DEFAULT 0').run().catch(() => {});
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS modulo_profesores (cicloId TEXT NOT NULL, modCod TEXT NOT NULL, departamento TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (cicloId, modCod, departamento, usuario))').run().catch(() => {});
    const [usuariosRows, ciclosRows, profesRows] = await Promise.all([
      superadmin
        ? env.DB.prepare('SELECT usuario, nombre, rol, email, departamento, bloqueado FROM usuarios ORDER BY usuario').all()
        : env.DB.prepare('SELECT usuario, nombre, rol, email, departamento, bloqueado FROM usuarios WHERE departamento=? ORDER BY usuario').bind(dept).all(),
      superadmin
        ? env.DB.prepare('SELECT cicloId, modCod, modNombre FROM ciclos WHERE modCod IS NOT NULL').all()
        : env.DB.prepare('SELECT cicloId, modCod, modNombre FROM ciclos WHERE modCod IS NOT NULL AND departamento=?').bind(dept).all(),
      superadmin
        ? env.DB.prepare('SELECT mp.cicloId, mp.modCod, mp.usuario, u.email FROM modulo_profesores mp JOIN usuarios u ON u.usuario = mp.usuario').all()
        : env.DB.prepare('SELECT mp.cicloId, mp.modCod, mp.usuario, u.email FROM modulo_profesores mp JOIN usuarios u ON u.usuario = mp.usuario WHERE mp.departamento=?').bind(dept).all(),
    ]);
    const ciclos = ciclosRows?.results || [];
    const profes = profesRows?.results || [];
    // Mapear usuario -> lista de moduloId, y moduloId -> lista de emails
    const modulosPorUsuario = {};
    const emailsPorModulo = {};
    for (const row of profes) {
      const mid = moduloId(row);
      if (!modulosPorUsuario[row.usuario]) modulosPorUsuario[row.usuario] = [];
      modulosPorUsuario[row.usuario].push(mid);
      if (!emailsPorModulo[mid]) emailsPorModulo[mid] = [];
      emailsPorModulo[mid].push(row.email || '');
    }
    const todosModulos = ciclos.map(r => ({
      id: moduloId(r), cicloId: r.cicloId, cod: String(r.modCod), nombre: r.modNombre || '',
      responsablesEmails: emailsPorModulo[moduloId(r)] || [],
    }));
    const usuarios = usuariosRows.results.map(u => {
      const rolNorm = String(u.rol || '').trim().toLowerCase();
      return {
        ...u,
        rol: rolNorm === 'superadmin' ? 'Jefe/a Departamento' : u.rol,
        modulos: modulosPorUsuario[u.usuario] || [],
      };
    });
    return Response.json({ ok: true, usuarios, todosModulos });
  }
```

- [ ] **Step 2: Reescribir el bloque final de `importModulosCSV`**

Localizar (dentro de la acción `importModulosCSV`, ya existente en el archivo):

```js
    // Aplicar asignaciones acumuladas por usuario, fusionando con lo que ya tenían.
    for (const [usuarioLogin, info] of Object.entries(porUsuario)) {
      const existentes = await env.DB.prepare('SELECT cicloId, modCod, responsable FROM ciclos WHERE departamento=?').bind(info.departamento).all();
      for (const row of existentes.results) {
        const id = moduloId(row);
        const yaEraSuyo = (row.responsable || '').toLowerCase() === info.nombre.toLowerCase();
        const debeSerSuyo = info.modIds.has(id) || yaEraSuyo;
        if (debeSerSuyo && !yaEraSuyo) {
          await env.DB.prepare('UPDATE ciclos SET responsable=? WHERE cicloId=? AND modCod=? AND departamento=?')
            .bind(info.nombre, row.cicloId, row.modCod, info.departamento).run();
        }
      }
    }
```

Sustituir por (ahora inserta directamente en `modulo_profesores` por login, sin necesidad de comparar por nombre — sigue sin borrar nunca una asignación existente, mismo comportamiento de fusión de siempre):

```js
    // Aplicar asignaciones acumuladas por usuario, fusionando con lo que ya
    // tenían (solo inserta, nunca borra — a diferencia de
    // reemplazarModulosUsuario, que sí hace diff completo).
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS modulo_profesores (cicloId TEXT NOT NULL, modCod TEXT NOT NULL, departamento TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (cicloId, modCod, departamento, usuario))').run().catch(() => {});
    for (const [usuarioLogin, info] of Object.entries(porUsuario)) {
      for (const id of info.modIds) {
        const [cicloId, modCod] = id.split('__');
        await env.DB.prepare('INSERT OR IGNORE INTO modulo_profesores (cicloId, modCod, departamento, usuario) VALUES (?,?,?,?)')
          .bind(cicloId, modCod, info.departamento, usuarioLogin).run();
      }
    }
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check functions/api/usuarios.js`
Expected: sin salida.

- [ ] **Step 4: Commit**

```bash
git add functions/api/usuarios.js
git commit -m "feat(modulos): getUsers e importModulosCSV usan modulo_profesores"
```

---

### Task 4: Backend `functions/api/meta.js` — `misModulos` + `responsablesEmails`

**Files:**
- Modify: `functions/api/meta.js:113-157`

**Interfaces:**
- Consumes: nada de tareas anteriores más allá del esquema.
- Produces: respuesta JSON de `/api/meta` gana `misModulos: string[]` (moduloId del usuario logueado) y cada `ciclos[].modulos[]` gana `responsablesEmails: string[]` — la Task 7 (frontend, `js/auth.js`/`js/modal-mis-modulos.js`) depende de estos dos campos.

- [ ] **Step 1: Añadir la creación de tabla junto a la de `ubicaciones`**

En `functions/api/meta.js:113`, localizar:

```js
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS ubicaciones (name TEXT PRIMARY KEY, orden INTEGER DEFAULT 0)").run().catch(() => {});
```

Justo después, añadir:

```js
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS modulo_profesores (cicloId TEXT NOT NULL, modCod TEXT NOT NULL, departamento TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (cicloId, modCod, departamento, usuario))").run().catch(() => {});
```

- [ ] **Step 2: Añadir la consulta de `modulo_profesores` al `Promise.all`**

En `functions/api/meta.js:115-135`, localizar:

```js
  const [aulas, cats, invCats, ubicaciones, invLocs, ciclosRows, departamentosRows] = await Promise.all([
    superadmin
      ? env.DB.prepare("SELECT * FROM aulas ORDER BY CASE WHEN id GLOB 'aula[0-9]*' THEN CAST(SUBSTR(id,5) AS INTEGER) ELSE orden END, orden, id").all()
      : env.DB.prepare(`SELECT * FROM aulas WHERE departamento=? OR departamento='' OR departamento IS NULL OR departamento='${genericDept}' ORDER BY CASE WHEN id GLOB 'aula[0-9]*' THEN CAST(SUBSTR(id,5) AS INTEGER) ELSE orden END, orden, id`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM categorias ORDER BY orden').all()
      : env.DB.prepare("SELECT * FROM categorias WHERE departamento=? ORDER BY orden").bind(dept).all(),
    superadmin
      ? env.DB.prepare("SELECT DISTINCT cat FROM inventario WHERE cat IS NOT NULL AND trim(cat) != '' ORDER BY cat").all()
      : env.DB.prepare(`SELECT DISTINCT cat FROM inventario WHERE cat IS NOT NULL AND trim(cat) != '' AND (departamento=? OR departamento='${genericDept}') ORDER BY cat`).bind(dept).all(),
    env.DB.prepare('SELECT * FROM ubicaciones ORDER BY orden, name').all().catch(() => ({ results: [] })),
    superadmin
      ? env.DB.prepare("SELECT DISTINCT loc FROM inventario WHERE loc IS NOT NULL AND trim(loc) != '' ORDER BY loc").all()
      : env.DB.prepare(`SELECT DISTINCT loc FROM inventario WHERE loc IS NOT NULL AND trim(loc) != '' AND (departamento=? OR departamento='${genericDept}') ORDER BY loc`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM ciclos ORDER BY cicloOrden, modOrden').all()
      : env.DB.prepare(`SELECT * FROM ciclos WHERE departamento=? OR departamento='${genericDept}' ORDER BY cicloOrden, modOrden`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT slug, nombre, icono FROM departamentos ORDER BY orden').all()
      : Promise.resolve({ results: [] }),
  ]);
```

Sustituir la línea de destructuring y añadir un último elemento al array (el resto de queries no cambia):

```js
  const [aulas, cats, invCats, ubicaciones, invLocs, ciclosRows, departamentosRows, profesRows] = await Promise.all([
    superadmin
      ? env.DB.prepare("SELECT * FROM aulas ORDER BY CASE WHEN id GLOB 'aula[0-9]*' THEN CAST(SUBSTR(id,5) AS INTEGER) ELSE orden END, orden, id").all()
      : env.DB.prepare(`SELECT * FROM aulas WHERE departamento=? OR departamento='' OR departamento IS NULL OR departamento='${genericDept}' ORDER BY CASE WHEN id GLOB 'aula[0-9]*' THEN CAST(SUBSTR(id,5) AS INTEGER) ELSE orden END, orden, id`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM categorias ORDER BY orden').all()
      : env.DB.prepare("SELECT * FROM categorias WHERE departamento=? ORDER BY orden").bind(dept).all(),
    superadmin
      ? env.DB.prepare("SELECT DISTINCT cat FROM inventario WHERE cat IS NOT NULL AND trim(cat) != '' ORDER BY cat").all()
      : env.DB.prepare(`SELECT DISTINCT cat FROM inventario WHERE cat IS NOT NULL AND trim(cat) != '' AND (departamento=? OR departamento='${genericDept}') ORDER BY cat`).bind(dept).all(),
    env.DB.prepare('SELECT * FROM ubicaciones ORDER BY orden, name').all().catch(() => ({ results: [] })),
    superadmin
      ? env.DB.prepare("SELECT DISTINCT loc FROM inventario WHERE loc IS NOT NULL AND trim(loc) != '' ORDER BY loc").all()
      : env.DB.prepare(`SELECT DISTINCT loc FROM inventario WHERE loc IS NOT NULL AND trim(loc) != '' AND (departamento=? OR departamento='${genericDept}') ORDER BY loc`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT * FROM ciclos ORDER BY cicloOrden, modOrden').all()
      : env.DB.prepare(`SELECT * FROM ciclos WHERE departamento=? OR departamento='${genericDept}' ORDER BY cicloOrden, modOrden`).bind(dept).all(),
    superadmin
      ? env.DB.prepare('SELECT slug, nombre, icono FROM departamentos ORDER BY orden').all()
      : Promise.resolve({ results: [] }),
    superadmin
      ? env.DB.prepare('SELECT mp.cicloId, mp.modCod, mp.usuario, u.email FROM modulo_profesores mp JOIN usuarios u ON u.usuario = mp.usuario').all()
      : env.DB.prepare(`SELECT mp.cicloId, mp.modCod, mp.usuario, u.email FROM modulo_profesores mp JOIN usuarios u ON u.usuario = mp.usuario WHERE mp.departamento=? OR mp.departamento='${genericDept}'`).bind(dept).all(),
  ]);
```

- [ ] **Step 3: Calcular `misModulos`/`emailsPorModulo` y usarlos al construir `cicloMap`**

En `functions/api/meta.js:137-144`, localizar:

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

Sustituir por:

```js
  const emailsPorModulo = {};
  const misModulos = [];
  for (const row of (profesRows.results || [])) {
    const mid = `${row.cicloId}__${row.modCod}`;
    if (row.usuario === user.usuario) {
      misModulos.push(mid);
    } else {
      if (!emailsPorModulo[mid]) emailsPorModulo[mid] = [];
      emailsPorModulo[mid].push(row.email || '');
    }
  }

  const cicloMap = {}, cicloOrder = [];
  for (const r of ciclosRows.results) {
    if (!cicloMap[r.cicloId]) {
      cicloMap[r.cicloId] = { id: r.cicloId, name: r.cicloNombre, nivel: r.nivel, icon: r.icon, th: r.th, desc: r.desc, departamento: r.departamento || '', modulos: [] };
      cicloOrder.push(r.cicloId);
    }
    if (r.modCod) {
      const mid = `${r.cicloId}__${r.modCod}`;
      cicloMap[r.cicloId].modulos.push({ cod: r.modCod, name: r.modNombre, horas: r.modHoras, responsablesEmails: emailsPorModulo[mid] || [] });
    }
  }
```

- [ ] **Step 4: Añadir `misModulos` a la respuesta**

En `functions/api/meta.js:146-156`, localizar:

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

Sustituir por (añade `misModulos` justo después de `ciclos`):

```js
  return Response.json({
    ok: true,
    aulas: aulas.results,
    cats: mergeCats(cats.results, invCats.results),
    catsPropias: cats.results.length > 0,
    catsCrudo: superadmin ? cats.results : undefined,
    ubicaciones: mergeUbicaciones(ubicaciones.results, invLocs.results),
    ciclos: cicloOrder.map(id => cicloMap[id]),
    misModulos,
    departamentos: superadmin ? departamentosRows.results : undefined,
    user
  });
```

- [ ] **Step 5: Verificar sintaxis**

Run: `node --check functions/api/meta.js`
Expected: sin salida.

- [ ] **Step 6: Commit**

```bash
git add functions/api/meta.js
git commit -m "feat(modulos): meta.js expone misModulos y responsablesEmails"
```

---

### Task 5: Permisos y mapeo de endpoint — `js/roles.js`, `js/api.js`

**Files:**
- Modify: `js/roles.js` (`ACTION_PERMISSIONS`, junto a `selectDepartamento`)
- Modify: `js/api.js` (`ENDPOINT_MAP`, junto a `userAssignModulos`)

**Interfaces:**
- Consumes: nada.
- Produces: `canAction('selectModulos')` resuelve a `true` para cualquier rol autenticado (permiso `profile.write`, lo tienen todos) — la Task 7 depende de esto para que `apiPost({action:'selectModulos',...})` no sea bloqueado en el propio cliente.

- [ ] **Step 1: `js/roles.js`**

Localizar:

```js
  selectDepartamento: 'profile.write',
  userAssignModulos: 'config.manage',
```

Sustituir por:

```js
  selectDepartamento: 'profile.write',
  selectModulos: 'profile.write',
  userAssignModulos: 'config.manage',
```

- [ ] **Step 2: `js/api.js`**

Localizar:

```js
  getUsers:'usuarios', userAdd:'usuarios', userUpdate:'usuarios',
  userDelete:'usuarios', userResetPassword:'usuarios', userAssignModulos:'usuarios', userUnlock:'usuarios',
```

Sustituir por:

```js
  getUsers:'usuarios', userAdd:'usuarios', userUpdate:'usuarios',
  userDelete:'usuarios', userResetPassword:'usuarios', userAssignModulos:'usuarios', userUnlock:'usuarios', selectModulos:'usuarios',
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check js/roles.js && node --check js/api.js`
Expected: sin salida.

- [ ] **Step 4: Commit**

```bash
git add js/roles.js js/api.js
git commit -m "feat(modulos): permiso y endpoint de selectModulos"
```

---

### Task 6: Frontend `js/prestamos.js` — modal admin "📚 Módulos" a correos

**Files:**
- Modify: `js/prestamos.js:1016-1017` (`_renderModUsuarioGroups`, línea de `otroResp`)
- Modify: `js/prestamos.js:1070-1080` (`openModulosUsuario`, mapa de responsables)
- Modify: `js/prestamos.js:1125-1135` (`saveModulosUsuario`)

**Interfaces:**
- Consumes: `getUsers` (Task 3) devuelve `todosModulos[].responsablesEmails` en vez de `.responsable`; `userAssignModulos` (Task 2) espera `usuario` en vez de `nombre`.
- Produces: nada nuevo (última pieza del flujo admin ya existente).

- [ ] **Step 1: `_renderModUsuarioGroups` — aviso por correos**

En `js/prestamos.js:1015-1023`, localizar:

```js
    const rows = modsFiltrados.map(m => {
      const otroResp = m.respActual && m.respActual.toLowerCase() !== (u.nombre||'').toLowerCase()
        ? `<span class="mod-otro-resp">(${escHtml(m.respActual)})</span>` : '';
      return `<label class="mod-check-row">
        <input type="checkbox" value="${m.mid}" ${m.checked?'checked':''} onchange="_toggleModUsuario('${m.mid}',this.checked)">
        <span class="mod-check-name">${escHtml(m.name)}</span>
        ${otroResp}
      </label>`;
    }).join('');
```

Sustituir por:

```js
    const rows = modsFiltrados.map(m => {
      const otrosEmails = (m.respEmails || []).filter(email => email && email.toLowerCase() !== (u.email||'').toLowerCase());
      const otroResp = otrosEmails.length
        ? `<span class="mod-otro-resp" title="${escHtml(otrosEmails.join(', '))}">También: ${escHtml(otrosEmails.slice(0,2).join(', '))}${otrosEmails.length>2?` +${otrosEmails.length-2}`:''}</span>`
        : '';
      return `<label class="mod-check-row">
        <input type="checkbox" value="${m.mid}" ${m.checked?'checked':''} onchange="_toggleModUsuario('${m.mid}',this.checked)">
        <span class="mod-check-name">${escHtml(m.name)}</span>
        ${otroResp}
      </label>`;
    }).join('');
```

- [ ] **Step 2: `openModulosUsuario` — `respMap` por emails**

En `js/prestamos.js:1070-1080`, localizar:

```js
  // Mapa de responsables actuales desde backend (disponible solo tras redespliegue GAS)
  const respMap = {};
  _todosModulos.forEach(m=>{ respMap[String(m.id || m.cod)] = m.responsable || ''; });

  _modUsuarioCiclos = cicloOrder.map(cid => {
    const c = cicloMap[cid];
    const mods = c.mods.map(m => {
      const mid = String(m.id || m.cod);
      const respActual = respMap[mid] || '';
      return { ...m, mid, checked: seleccionados.has(mid) || seleccionados.has(String(m.cod)), respActual };
    });
    return { cid, name: c.name, nivel: c.nivel, mods };
  }).filter(c => c.mods.length);
```

Sustituir por:

```js
  // Mapa de responsables actuales desde backend (correos, puede haber varios)
  const respMap = {};
  _todosModulos.forEach(m=>{ respMap[String(m.id || m.cod)] = m.responsablesEmails || []; });

  _modUsuarioCiclos = cicloOrder.map(cid => {
    const c = cicloMap[cid];
    const mods = c.mods.map(m => {
      const mid = String(m.id || m.cod);
      const respEmails = respMap[mid] || [];
      return { ...m, mid, checked: seleccionados.has(mid) || seleccionados.has(String(m.cod)), respEmails };
    });
    return { cid, name: c.name, nivel: c.nivel, mods };
  }).filter(c => c.mods.length);
```

- [ ] **Step 3: `saveModulosUsuario` — enviar `usuario`, sincronizar `_todosModulos` por email**

En `js/prestamos.js:1118-1139`, localizar:

```js
async function saveModulosUsuario(){
  if(_modUsuarioIdx === null) return;
  const u = _usuariosEditing[_modUsuarioIdx];
  if(!u.nombre.trim()){ toast('Guarda primero el nombre del usuario antes de asignar módulos','err'); return; }
  const btn = document.getElementById('btnSaveModUsuario');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    const res = await apiPost({ action:'userAssignModulos', nombre: u.nombre.trim(), modulos: u._modulos || [] });
    if(!res.ok) throw new Error(res.error);
    toast(`Módulos actualizados para ${u.nombre}`,'ok');
    // Sincronizar responsable en _todosModulos local
    _todosModulos.forEach(m=>{
      const mid = String(m.id || m.cod);
      const esMio = (u._modulos||[]).includes(mid);
      const eraMio = (m.responsable||'').toLowerCase() === u.nombre.toLowerCase();
      if(esMio) m.responsable = u.nombre;
      else if(eraMio) m.responsable = '';
    });
    closeModulosUsuario();
  } catch(e){ toast('Error: '+e.message,'err'); }
  finally { btn.disabled=false; btn.textContent='💾 Guardar módulos'; }
}
```

Sustituir por:

```js
async function saveModulosUsuario(){
  if(_modUsuarioIdx === null) return;
  const u = _usuariosEditing[_modUsuarioIdx];
  if(!u.nombre.trim()){ toast('Guarda primero el nombre del usuario antes de asignar módulos','err'); return; }
  const btn = document.getElementById('btnSaveModUsuario');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    const res = await apiPost({ action:'userAssignModulos', usuario: u.usuario, modulos: u._modulos || [] });
    if(!res.ok) throw new Error(res.error);
    toast(`Módulos actualizados para ${u.nombre}`,'ok');
    // Sincronizar responsablesEmails en _todosModulos local (si el usuario
    // no tiene email guardado, no se puede reflejar aquí — se verá bien en
    // el próximo getUsers)
    if(u.email){
      _todosModulos.forEach(m=>{
        const mid = String(m.id || m.cod);
        if(!m.responsablesEmails) m.responsablesEmails = [];
        const idx = m.responsablesEmails.findIndex(e=>e.toLowerCase()===u.email.toLowerCase());
        const esMio = (u._modulos||[]).includes(mid);
        if(esMio && idx===-1) m.responsablesEmails.push(u.email);
        else if(!esMio && idx!==-1) m.responsablesEmails.splice(idx,1);
      });
    }
    closeModulosUsuario();
  } catch(e){ toast('Error: '+e.message,'err'); }
  finally { btn.disabled=false; btn.textContent='💾 Guardar módulos'; }
}
```

- [ ] **Step 4: Verificar sintaxis**

Run: `node --check js/prestamos.js`
Expected: sin salida.

- [ ] **Step 5: Commit**

```bash
git add js/prestamos.js
git commit -m "feat(modulos): modal admin de modulos usa correos, no nombres"
```

---

### Task 7: Frontend — nuevo `js/modal-mis-modulos.js` + markup en `index.html` + `js/config.js`

**Files:**
- Modify: `js/config.js:41-42` (declarar `MIS_MODULOS`)
- Create: `js/modal-mis-modulos.js`
- Modify: `index.html:305-320` (nueva página `#pSeleccionarModulos`, justo después de `#pSeleccionarDepartamento`)
- Modify: `index.html:85` (nuevo botón `#btnMisModulos` en la topbar, junto a `btnPrint`)
- Modify: `index.html:1497` (nuevo modal `#mMisModulos`, justo después de `#mModUsuario`)
- Modify: `index.html` (script tags, añadir `js/modal-mis-modulos.js`)
- Modify: `js/roles.js:131-144` (`applyRoleUI`, regla para `btnMisModulos`)
- Modify: `sw.js` (precache + `VERSION`)

**Interfaces:**
- Consumes: `CICLOS` (ya en memoria, `js/config.js`, ahora con `.modulos[].responsablesEmails` gracias a Task 4), `MIS_MODULOS` (nuevo global, poblado en Task 8), `selectModulos` (Task 2, vía `apiPost`).
- Produces: `abrirSeleccionModulosOnboarding()`, `saltarSeleccionModulos()`, `guardarSeleccionModulosOnboarding()`, `openMisModulosModal()`, `closeMisModulosModal()`, `guardarMisModulosModal()` — la Task 8 (`js/auth.js`) llama a `abrirSeleccionModulosOnboarding()`.

- [ ] **Step 1: `js/config.js` — declarar `MIS_MODULOS`**

En `js/config.js:41-42`, localizar:

```js
// CICLOS Y MÓDULOS
// ═════════════════════════════════════════════════════════
let CICLOS = [
```

Sustituir por (añade la declaración justo antes, sin tocar el resto):

```js
// CICLOS Y MÓDULOS
// ═════════════════════════════════════════════════════════
let MIS_MODULOS = []; // moduloId[] que imparte el usuario logueado (ver meta.js:misModulos)
let CICLOS = [
```

- [ ] **Step 2: Crear `js/modal-mis-modulos.js`**

Crear el archivo con exactamente este contenido:

```js
// Autoservicio de módulos/asignaturas — checklist agrupada por ciclo,
// reusada por dos puntos de entrada: la pantalla de onboarding tras elegir
// departamento (js/auth.js:abrirSeleccionModulosOnboarding) y el modal
// "📚 Mis módulos" accesible en cualquier momento desde la topbar.
// Misma UI que el modal admin (js/prestamos.js:_renderModUsuarioGroups)
// pero autoreferenciada: siempre el usuario logueado, nunca un índice de
// _usuariosEditing.

let _misModulosCiclos = []; // [{cid,name,nivel,mods:[{mid,cod,name,checked,otrosEmails}]}]
let _misModulosSeleccionados = new Set();
let _misModulosExpanded = new Set();
let _misModulosBodyId = '';
let _misModulosSearchId = '';

function _construirMisModulosCiclos(){
  const cicloMap = {};
  const cicloOrder = [];
  CICLOS.forEach(c => {
    if(c.id === 'departamento') return;
    cicloMap[c.id] = { name: c.name, nivel: c.nivel || '', mods: [] };
    cicloOrder.push(c.id);
    c.modulos.forEach(m => cicloMap[c.id].mods.push({
      mid: `${c.id}__${m.cod}`, cod: String(m.cod), name: m.name,
      otrosEmails: m.responsablesEmails || []
    }));
  });
  _misModulosCiclos = cicloOrder.map(cid => {
    const c = cicloMap[cid];
    const mods = c.mods.map(m => ({ ...m, checked: _misModulosSeleccionados.has(m.mid) }));
    return { cid, name: c.name, nivel: c.nivel, mods };
  }).filter(c => c.mods.length);
}

function _renderMisModulosGroups(query){
  const q = normalizeStr(query || '');
  const body = document.getElementById(_misModulosBodyId);
  if(!body) return;
  const html = _misModulosCiclos.map(c => {
    const modsFiltrados = q ? c.mods.filter(m => normalizeStr(m.name).includes(q)) : c.mods;
    if(!modsFiltrados.length) return '';
    const nMarcados = c.mods.filter(m => m.checked).length;
    const expanded = !!q || _misModulosExpanded.has(c.cid) || nMarcados > 0;
    const rows = modsFiltrados.map(m => {
      const otroResp = m.otrosEmails.length
        ? `<span class="mod-otro-resp" title="${escHtml(m.otrosEmails.join(', '))}">También: ${escHtml(m.otrosEmails.slice(0,2).join(', '))}${m.otrosEmails.length>2?` +${m.otrosEmails.length-2}`:''}</span>`
        : '';
      return `<label class="mod-check-row">
        <input type="checkbox" value="${m.mid}" ${m.checked?'checked':''} onchange="_toggleMisModulo('${m.mid}',this.checked)">
        <span class="mod-check-name">${escHtml(m.name)}</span>
        ${otroResp}
      </label>`;
    }).join('');
    return `<div class="mod-ciclo-group">
      <div class="mod-ciclo-title" style="cursor:pointer;display:flex;align-items:center;gap:6px" onclick="_toggleMisModulosCicloExpand('${c.cid}')">
        <span style="font-size:11px;color:var(--muted)">${expanded?'▼':'▶'}</span>
        <span>${escHtml(c.name)}${c.nivel?' · '+escHtml(c.nivel):''}</span>
        ${nMarcados?`<span class="usr-mod-badge" style="margin-left:auto">${nMarcados}</span>`:''}
      </div>
      ${expanded ? rows : ''}
    </div>`;
  }).join('');
  body.innerHTML = html || '<p style="color:var(--muted);font-size:13px">Sin resultados.</p>';
}

function _toggleMisModulosCicloExpand(cid){
  if(_misModulosExpanded.has(cid)) _misModulosExpanded.delete(cid);
  else _misModulosExpanded.add(cid);
  _renderMisModulosGroups(document.getElementById(_misModulosSearchId)?.value || '');
}

function _toggleMisModulo(mid, checked){
  if(checked) _misModulosSeleccionados.add(mid);
  else _misModulosSeleccionados.delete(mid);
  for(const c of _misModulosCiclos){
    const m = c.mods.find(mm => mm.mid === mid);
    if(m){ m.checked = checked; if(checked) _misModulosExpanded.add(c.cid); break; }
  }
  _renderMisModulosGroups(document.getElementById(_misModulosSearchId)?.value || '');
}

function filterMisModulos(){
  _renderMisModulosGroups(document.getElementById(_misModulosSearchId)?.value || '');
}

// ─── Onboarding (tras elegir departamento) ────────────────
function abrirSeleccionModulosOnboarding(){
  _misModulosBodyId = 'onboardingModulosBody';
  _misModulosSearchId = 'onboardingModulosSearch';
  _misModulosSeleccionados = new Set(MIS_MODULOS);
  _misModulosExpanded = new Set();
  _construirMisModulosCiclos();
  document.getElementById('onboardingModulosSearch').value = '';
  _renderMisModulosGroups('');
  show('pSeleccionarModulos');
}

function saltarSeleccionModulos(){
  showUserChip();
  _showOverlay();
  loadData();
}

async function guardarSeleccionModulosOnboarding(){
  const btn = document.getElementById('onboardingModulosBtn');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    const res = await apiPost({ action:'selectModulos', modulos:[..._misModulosSeleccionados] });
    if(!res.ok) throw new Error(res.error || 'Error al guardar los módulos');
    MIS_MODULOS = [..._misModulosSeleccionados];
    showUserChip();
    _showOverlay();
    loadData();
  } catch(err){
    toast('Error: '+(err.message||'error de conexión'), 'err');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Guardar y continuar';
  }
}

// ─── Modal "Mis módulos" (accesible en cualquier momento) ──
function openMisModulosModal(){
  _misModulosBodyId = 'mMisModulosBody';
  _misModulosSearchId = 'misModulosSearch';
  _misModulosSeleccionados = new Set(MIS_MODULOS);
  _misModulosExpanded = new Set();
  _construirMisModulosCiclos();
  document.getElementById('misModulosSearch').value = '';
  _renderMisModulosGroups('');
  document.getElementById('mMisModulos').classList.add('open');
}

function closeMisModulosModal(){
  document.getElementById('mMisModulos').classList.remove('open');
}

async function guardarMisModulosModal(){
  const btn = document.getElementById('btnGuardarMisModulos');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    const res = await apiPost({ action:'selectModulos', modulos:[..._misModulosSeleccionados] });
    if(!res.ok) throw new Error(res.error || 'Error al guardar los módulos');
    MIS_MODULOS = [..._misModulosSeleccionados];
    toast('Módulos actualizados', 'ok');
    closeMisModulosModal();
  } catch(err){
    toast('Error: '+(err.message||'error de conexión'), 'err');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Guardar';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const onboardingSearch = document.getElementById('onboardingModulosSearch');
  if(onboardingSearch) onboardingSearch.addEventListener('input', filterMisModulos);
  const modalSearch = document.getElementById('misModulosSearch');
  if(modalSearch) modalSearch.addEventListener('input', filterMisModulos);
});
```

- [ ] **Step 3: `index.html` — página de onboarding `#pSeleccionarModulos`**

En `index.html:320-322`, localizar:

```html
    </div>
  </div>
</div>

<!-- ══ HOME ══ -->
```

(la primera línea es el cierre de `#pSeleccionarDepartamento`). Insertar la nueva página justo antes del comentario `<!-- ══ HOME ══ -->`:

```html
    </div>
  </div>
</div>

<!-- ══ SELECCIÓN DE MÓDULOS/ASIGNATURAS (opcional, tras elegir departamento) ══ -->
<div class="page" id="pSeleccionarModulos">
  <div class="login-wrap">
    <div class="login-card" style="width:min(560px,100%)">
      <div class="login-icon" style="font-size:30px">📚</div>
      <h1>¿Qué módulos o asignaturas impartes?</h1>
      <p class="login-sub">Opcional — puedes hacerlo ahora o más tarde desde el botón "📚 Mis módulos" de la barra superior.</p>
      <input type="text" id="onboardingModulosSearch" class="fi-w" placeholder="🔍 Buscar asignatura..." style="margin-bottom:12px">
      <div id="onboardingModulosBody" style="max-height:40vh;overflow-y:auto;display:flex;flex-direction:column;gap:12px;margin-bottom:16px;text-align:left"></div>
      <button class="login-btn" id="onboardingModulosBtn" onclick="guardarSeleccionModulosOnboarding()">💾 Guardar y continuar</button>
      <div class="login-footer">
        <button class="login-link" onclick="saltarSeleccionModulos()">Recordar más tarde</button>
      </div>
    </div>
  </div>
</div>

<!-- ══ HOME ══ -->
```

- [ ] **Step 4: `index.html` — botón en topbar**

En `index.html:85`, localizar:

```html
      <button class="tbtn" id="btnPrint" style="display:none" onclick="openPrintChoiceModal()" title="Imprimir inventario">🖨️ Imprimir</button>
```

Justo después, insertar (visible para cualquier rol autenticado, fuera de `#deptMenuWrap` a propósito — ver Global Constraints):

```html
      <button class="tbtn" id="btnMisModulos" style="display:none" onclick="openMisModulosModal()">📚 Mis módulos</button>
```

- [ ] **Step 5: `index.html` — modal "Mis módulos"**

Localizar el cierre del modal `#mModUsuario` (justo antes del comentario `<!-- MODAL GESTIÓN DE AULAS -->`):

```html
      <div class="mf" style="margin-top:18px">
        <div></div>
        <div class="mf-right">
          <button class="btn" onclick="closeModulosUsuario()">Cancelar</button>
          <button class="btn btn-p" id="btnSaveModUsuario" onclick="saveModulosUsuario()">💾 Guardar módulos</button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- MODAL GESTIÓN DE AULAS -->
```

Insertar el modal nuevo justo antes de `<!-- MODAL GESTIÓN DE AULAS -->`:

```html
<!-- MODAL "MIS MÓDULOS" (autoservicio, cualquier rol) -->
<div class="mbg" id="mMisModulos" style="z-index:600" onclick="if(event.target===this)closeMisModulosModal()">
  <div class="modal" style="width:min(520px,100%)">
    <div class="mh"><div class="mt">📚 Mis módulos/asignaturas</div><button class="mx" onclick="closeMisModulosModal()">✕</button></div>
    <p style="font-size:13px;color:var(--muted);margin-bottom:10px">Marca los módulos o asignaturas que impartes.</p>
    <input type="text" id="misModulosSearch" class="fi-w" placeholder="🔍 Buscar asignatura..." oninput="filterMisModulos()" style="margin-bottom:12px">
    <div id="mMisModulosBody" style="max-height:55vh;overflow-y:auto;display:flex;flex-direction:column;gap:12px"></div>
    <div class="mf" style="margin-top:18px">
      <div></div>
      <div class="mf-right">
        <button class="btn" onclick="closeMisModulosModal()">Cancelar</button>
        <button class="btn btn-p" id="btnGuardarMisModulos" onclick="guardarMisModulosModal()">💾 Guardar</button>
      </div>
    </div>
  </div>
</div>

<!-- MODAL GESTIÓN DE AULAS -->
```

- [ ] **Step 6: `index.html` — incluir el script nuevo**

Localizar:

```html
<script defer src="js/modal-historial.js"></script>
<script defer src="js/modal-accesos.js"></script>
```

Sustituir por:

```html
<script defer src="js/modal-historial.js"></script>
<script defer src="js/modal-accesos.js"></script>
<script defer src="js/modal-mis-modulos.js"></script>
```

- [ ] **Step 7: `js/roles.js` — visibilidad de `btnMisModulos`**

En `js/roles.js:131-144`, localizar:

```js
function applyRoleUI(){
  const isAdmin = can('config.manage');
  const rules = [
    ['btnN',   'items.write',  'flex'],
    ['btnDeptGame', null,      'flex'],
    ['btnPres','loans.write',  'flex'],
    ['btnPed', 'orders.write', 'flex'],
    ['btnPrint', null,         'flex'],
    ['gsCamara', null,         'inline-flex']
  ];
```

Sustituir por (añade la fila de `btnMisModulos`, visible siempre que haya sesión — `permission: null`):

```js
function applyRoleUI(){
  const isAdmin = can('config.manage');
  const rules = [
    ['btnN',   'items.write',  'flex'],
    ['btnDeptGame', null,      'flex'],
    ['btnPres','loans.write',  'flex'],
    ['btnPed', 'orders.write', 'flex'],
    ['btnPrint', null,         'flex'],
    ['btnMisModulos', null,    'flex'],
    ['gsCamara', null,         'inline-flex']
  ];
```

- [ ] **Step 8: `sw.js` — precache y versión**

Localizar:

```js
  './js/modal-historial.js',
  './js/modal-accesos.js',
  './js/modal-auditoria.js',
```

Sustituir por:

```js
  './js/modal-historial.js',
  './js/modal-accesos.js',
  './js/modal-mis-modulos.js',
  './js/modal-auditoria.js',
```

Subir `VERSION` (comprobar el valor actual en `sw.js` antes de fijar el siguiente número — sigue la secuencia ya usada esta sesión, v618 en el momento de escribir este plan, así que este cambio sube a v619; si al ejecutar el valor real ya es otro, usar el siguiente entero).

- [ ] **Step 9: Verificar sintaxis**

Run: `node --check js/config.js && node --check js/modal-mis-modulos.js && node --check js/roles.js`
Expected: sin salida.

- [ ] **Step 10: Commit**

```bash
git add js/config.js js/modal-mis-modulos.js index.html js/roles.js sw.js
git commit -m "feat(modulos): UI de autoservicio - onboarding, modal y boton en topbar"
```

---

### Task 8: Frontend `js/auth.js` — enganchar el onboarding tras elegir departamento

**Files:**
- Modify: `js/auth.js:1-21` (declarar el flag, junto a `_proceedAfterLogin`)
- Modify: `js/auth.js:36-53` (`doSelectDepartamento`)
- Modify: `js/auth.js:453-461` y `js/auth.js:497` (`loadData`)

**Interfaces:**
- Consumes: `abrirSeleccionModulosOnboarding()` (Task 7), `MIS_MODULOS`/`meta.misModulos` (Task 4/7).
- Produces: nada nuevo — cierra el flujo de extremo a extremo.

- [ ] **Step 1: Declarar el flag `_justSelectedDepartamento`**

En `js/auth.js:1-4`, localizar:

```js
// ═════════════════════════════════════════════════════════
// LOGIN
// ═════════════════════════════════════════════════════════

// Paso final común a todos los flujos de login
```

Insertar la declaración justo antes del comentario "Paso final común":

```js
// ═════════════════════════════════════════════════════════
// LOGIN
// ═════════════════════════════════════════════════════════

// Flag en memoria (nunca en localStorage): true solo entre guardar el
// departamento con éxito y el loadData() que sigue justo después. Así el
// paso de módulos nunca "resucita" en una recarga de página ni en un login
// futuro — solo en el que sigue justo a elegir departamento por primera vez.
let _justSelectedDepartamento = false;

// Paso final común a todos los flujos de login
```

- [ ] **Step 2: `doSelectDepartamento` — activar el flag antes de `loadData()`**

En `js/auth.js:40-46`, localizar:

```js
    SESSION.departamento = res.departamento;
    SESSION.departamentoNombre = res.departamentoNombre;
    SESSION.departamentoIcono = res.departamentoIcono;
    localStorage.setItem('inv_session', JSON.stringify(SESSION));
    showUserChip();
    _showOverlay();
    loadData();
```

Sustituir por:

```js
    SESSION.departamento = res.departamento;
    SESSION.departamentoNombre = res.departamentoNombre;
    SESSION.departamentoIcono = res.departamentoIcono;
    localStorage.setItem('inv_session', JSON.stringify(SESSION));
    _justSelectedDepartamento = true;
    showUserChip();
    _showOverlay();
    loadData();
```

- [ ] **Step 3: `loadData` — interceptar tras la Fase 1**

En `js/auth.js:497` (dentro de la Fase 1 de `loadData`), localizar:

```js
    if(meta.ciclos && meta.ciclos.length) CICLOS = meta.ciclos;
    catsPropias = !!meta.catsPropias;
```

Sustituir por:

```js
    if(meta.ciclos && meta.ciclos.length) CICLOS = meta.ciclos;
    MIS_MODULOS = Array.isArray(meta.misModulos) ? meta.misModulos : [];
    if(_justSelectedDepartamento){
      _justSelectedDepartamento = false;
      if(!MIS_MODULOS.length){
        _hideOverlay();
        abrirSeleccionModulosOnboarding();
        return;
      }
    }
    catsPropias = !!meta.catsPropias;
```

- [ ] **Step 4: Verificar sintaxis**

Run: `node --check js/auth.js`
Expected: sin salida.

- [ ] **Step 5: Commit**

```bash
git add js/auth.js
git commit -m "feat(modulos): onboarding de modulos tras elegir departamento"
```

---

### Task 9: Verificación end-to-end en producción + cierre de documentación

**Files:**
- Modify: `claude.md` (párrafo **Estado**)
- Modify: `docs/DEVELOPMENT.md` (nueva entrada de sesión)

**Interfaces:**
- Consumes: todas las tareas anteriores, ya desplegadas.

- [ ] **Step 1: Deploy**

```bash
git push origin main
```

Sondear hasta que `sw.js` en producción refleje la nueva `VERSION` (mismo patrón usado durante toda esta sesión):

```bash
for i in $(seq 1 12); do v=$(curl -s https://boscoinventario.pages.dev/sw.js | grep -o "VERSION = 'v[0-9]*'"); echo "intento $i: $v"; if echo "$v" | grep -q "vNNN"; then echo DEPLOYED; break; fi; sleep 10; done
```
(sustituir `vNNN` por el valor real fijado en la Task 7, Step 8).

- [ ] **Step 2: Escenario 1 — dos profesores en el mismo módulo (modal admin)**

Con Playwright, loguear como un superadmin (p.ej. `Seba`/`Seba`), abrir 🔐 Usuarios → 📚 Módulos de dos profesores distintos del mismo departamento, marcar el mismo módulo en ambos.

Verificar en D1: `npx wrangler d1 execute boscoinventario --remote --command "SELECT * FROM modulo_profesores WHERE cicloId='<cicloId>' AND modCod='<modCod>'"` → deben aparecer 2 filas (una por usuario), ninguna sustituida por la otra.

Reabrir el modal de cualquiera de los dos → debe verse "También: <email del otro>" en ese módulo.

- [ ] **Step 3: Escenario 2 — autoservicio completo (onboarding)**

Repetir el patrón ya usado en esta sesión para probar el bloqueo por intentos: bloquear/limpiar el departamento de una cuenta de prueba ficticia (`UPDATE usuarios SET departamento='' WHERE usuario='...'` vía wrangler), loguear con ella → debe aparecer `#pSeleccionarDepartamento` → guardar → debe aparecer `#pSeleccionarModulos` automáticamente → pulsar "Recordar más tarde" → debe entrar a Home sin guardar nada (`SELECT * FROM modulo_profesores WHERE usuario='...'` → 0 filas).

Recargar sesión (simular nuevo login) → confirmar que `#pSeleccionarModulos` **no** vuelve a aparecer sola.

- [ ] **Step 4: Escenario 3 — botón "Mis módulos" en cualquier momento**

Con la misma cuenta ya logueada, pulsar "📚 Mis módulos" en la topbar → debe abrir el modal, marcar un módulo, guardar → verificar en D1 que aparece la fila correspondiente en `modulo_profesores`.

- [ ] **Step 5: Escenario 4 — importación CSV no pisa asignaciones existentes**

Con una cuenta jefe/a de departamento de prueba, importar un CSV de módulos (`usuario,asignatura`) con dos filas para la misma asignatura y distintos `usuario` (uno de ellos ya con módulos asignados de antes) → verificar en D1 que el usuario que ya tenía módulos los conserva, y que ambos usuarios quedan con la nueva asignatura además de lo que ya tenían.

- [ ] **Step 6: Restaurar cualquier estado de cuentas de prueba tocado en los escenarios 2-5** (departamento, módulos) a como estaba antes de las pruebas, vía `wrangler d1 execute`, igual que se hizo con `profe1electricidadelectronica` en sesiones anteriores.

- [ ] **Step 7: Actualizar `claude.md`**

Actualizar el párrafo **Estado** (inicio del archivo) con 2-3 frases: módulos con varios profesores por login real (`modulo_profesores`), autoservicio de módulos igual que el de departamento (onboarding + botón "📚 Mis módulos" en topbar), y la corrección del bug ya documentado de `userAssignModulos` con superadmin. Quitar de la sección "Otros gaps conocidos" (Multi-departamento) la línea sobre ese bug, ya que queda resuelta.

- [ ] **Step 8: Añadir entrada en `docs/DEVELOPMENT.md`**

Añadir una entrada nueva (fecha + rango de versiones de `sw.js` de esta tarea) resumiendo: tabla `modulo_profesores`, reescritura de `userAssignModulos`/`getUsers`/`importModulosCSV`, `selectModulos`, onboarding + modal de autoservicio, y el resultado de la consulta de verificación de nombres sin migrar (Task 1, Step 3) — si hubo alguno, anotarlo aquí para que quede constancia de qué hay que revisar a mano.

- [ ] **Step 9: Commit y push final de documentación**

```bash
git add claude.md docs/DEVELOPMENT.md
git commit -m "docs: cierre sesion modulos con varios profesores + autoservicio"
git push origin main
```

- [ ] **Step 10: `git pull` de cierre** (para dejar la copia local exactamente igual a `origin/main`, tal como pidió el usuario)

```bash
git pull origin main
```
