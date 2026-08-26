# Módulos con varios profesores + autoservicio de asignación — diseño

**Fecha:** 26/08/2026
**Origen:** brainstorming de la sesión de autoasignación de departamento
(v618). Al diseñar el siguiente paso — que el profesor elija sus propios
módulos/asignaturas en el primer login — se detectó que el modelo de datos
actual (`ciclos.responsable`, un solo nombre de texto libre por módulo) no
admite que varios profesores impartan el mismo módulo: el segundo que se
asigna pisa al primero. Con la asignación pasando a ser autoservicio (cada
profesor se marca a sí mismo, sin que nadie centralice), ese riesgo de
pisarse sin darse cuenta deja de ser una rareza y pasa a ser probable.

## Problema

- `ciclos.responsable` es una columna `TEXT`, una PK compuesta
  `(cicloId, modCod, departamento)` → un único valor de texto por fila.
  Asignar el módulo a un segundo profesor sobrescribe al primero.
- Todo el sistema actual identifica al profesor por **nombre** (texto
  libre), no por su `usuario` (login real):
  - `functions/api/usuarios.js` → `userAssignModulos` recibe `nombre` y
    compara `row.responsable.toLowerCase() === nombre.toLowerCase()`.
  - `getUsers` → `modulosPorNombre` agrupa por
    `row.responsable.trim().toLowerCase()`, y cada usuario resuelve sus
    módulos por `modulosPorNombre[u.nombre.trim().toLowerCase()]`.
  - `importModulosCSV` ya resuelve el login real de cada fila
    (`usuariosCache[usuarioLogin]`) para *validar* al usuario, pero al
    final vuelve a escribir por `info.nombre` en `ciclos.responsable` —
    mismo punto de pisado si el CSV trae a dos profesores para la misma
    asignatura.
- Esta fragilidad (nombre en vez de login) ya existía; se decide
  corregirla de raíz aquí en vez de arrastrarla al nuevo flujo de
  autoservicio.

## Alcance

**Sí:**
- Tabla nueva de relación módulo↔profesor por login real, muchos-a-muchos.
- Reescribir `userAssignModulos`, `getUsers`, `importModulosCSV` para usar
  la tabla nueva en vez de `ciclos.responsable`.
- Nueva acción de autoservicio `selectModulos` (cualquier usuario marca
  sus propios módulos, nunca los de otro).
- `meta.js` expone `misModulos` (los del usuario logueado) y, por módulo,
  los correos de quien más lo imparte (`responsablesEmails`), no su
  nombre — puede haber varios, y el correo es inequívoco.
- Pantalla de onboarding `#pSeleccionarModulos` tras elegir departamento
  (opcional, con "Recordar más tarde"), y modal accesible en cualquier
  momento desde el menú Departamento ("📚 Mis módulos/asignaturas").

**No:**
- No se borra `ciclos.responsable` (evita un `ALTER TABLE ... DROP
  COLUMN` irreversible sobre datos de producción). Deja de leerse y
  escribirse desde el código nuevo; queda como dato histórico inerte.
- No se migra automáticamente ninguna asignación cuyo `responsable` no
  coincida exactamente (case-insensitive) con ningún `usuarios.nombre` —
  se lista aparte para revisión manual, no se adivina.
- No cambia la UI de "Gestionar ciclos y módulos" (altas/bajas de
  ciclos/asignaturas en sí) — solo quién las imparte.
- No se toca `ciclos.responsable` para lectura en ningún sitio nuevo; los
  únicos consumidores que quedan son históricos y no se tocan.

## Migración D1 — `migrations/0032_modulo_profesores.sql`

```sql
CREATE TABLE IF NOT EXISTS modulo_profesores (
  cicloId      TEXT NOT NULL,
  modCod       TEXT NOT NULL,
  departamento TEXT NOT NULL,
  usuario      TEXT NOT NULL,
  PRIMARY KEY (cicloId, modCod, departamento, usuario)
);
CREATE INDEX IF NOT EXISTS idx_modulo_profesores_usuario ON modulo_profesores(usuario);

-- Backfill: copia cada `ciclos.responsable` cuyo nombre coincide
-- exactamente (case-insensitive) con un usuario de ese mismo departamento.
INSERT OR IGNORE INTO modulo_profesores (cicloId, modCod, departamento, usuario)
SELECT c.cicloId, c.modCod, c.departamento, u.usuario
FROM ciclos c
JOIN usuarios u
  ON LOWER(TRIM(u.nombre)) = LOWER(TRIM(c.responsable))
  AND u.departamento = c.departamento
WHERE c.responsable IS NOT NULL AND TRIM(c.responsable) != '';
```

Verificación posterior a ejecutar a mano (no automática, es para revisión
humana — nombres que no migraron por no encontrar match exacto):

```sql
SELECT DISTINCT c.departamento, c.responsable
FROM ciclos c
LEFT JOIN usuarios u
  ON LOWER(TRIM(u.nombre)) = LOWER(TRIM(c.responsable)) AND u.departamento = c.departamento
WHERE c.responsable IS NOT NULL AND TRIM(c.responsable) != '' AND u.usuario IS NULL;
```

Si esa consulta devuelve filas, se resuelven a mano con
`UPDATE`/`INSERT INTO modulo_profesores` puntuales — fuera del alcance de
esta migración automática.

Autocura en runtime igual que el resto del proyecto: cada función que
toque `modulo_profesores` la crea con `CREATE TABLE IF NOT EXISTS` antes
de usarla, por si esta migración aún no se ha aplicado en remoto.

## Backend — `functions/api/usuarios.js`

**`getUsers`:** sustituir el cálculo de `modulosPorNombre` y el
`responsable` de `todosModulos`:

```js
const [ciclosRows, profesRows] = await Promise.all([
  /* consulta ciclos existente, sin cambios */,
  env.DB.prepare(
    superadmin
      ? 'SELECT cicloId, modCod, departamento, usuario FROM modulo_profesores'
      : 'SELECT cicloId, modCod, departamento, usuario FROM modulo_profesores WHERE departamento=?'
  ).bind(...(superadmin ? [] : [dept])).all(),
]);
// email por usuario, para responsablesEmails
const emailPorUsuario = {}; // usuario -> email, de una query a usuarios ya cargada en memoria
const modulosPorUsuario = {}; // usuario -> [moduloId,...]
const emailsPorModulo = {};  // moduloId -> [email,...]
for (const row of profesRows.results) {
  const mid = `${row.cicloId}__${row.modCod}`;
  (modulosPorUsuario[row.usuario] ??= []).push(mid);
  (emailsPorModulo[mid] ??= []).push(emailPorUsuario[row.usuario] || '');
}
...
const todosModulos = ciclos.map(r => ({
  id: moduloId(r), cicloId: r.cicloId, cod: String(r.modCod), nombre: r.modNombre || '',
  responsablesEmails: emailsPorModulo[moduloId(r)] || [],
}));
const usuarios = usuariosRows.results.map(u => ({
  ...u,
  rol: rolNorm === 'superadmin' ? 'Jefe/a Departamento' : u.rol,
  modulos: modulosPorUsuario[u.usuario] || [],
}));
```

(`responsable` desaparece de la respuesta; el frontend deja de leerlo.)

**`userAssignModulos`:** cambia de recibir `nombre` a recibir `usuario`
(login del profesor destino):

```js
if (action === 'userAssignModulos') {
  const usuarioDestino = (body.usuario || '').trim();
  const modulos = Array.isArray(body.modulos) ? body.modulos.map(String) : [];
  if (!usuarioDestino) return Response.json({ ok: false, error: 'Usuario requerido' });
  if (!superadmin) {
    const target = await env.DB.prepare('SELECT departamento FROM usuarios WHERE usuario=?').bind(usuarioDestino).first();
    if (!target || target.departamento !== dept) return Response.json({ ok: false, error: 'No autorizado' }, { status: 403 });
  }
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS modulo_profesores (cicloId TEXT NOT NULL, modCod TEXT NOT NULL, departamento TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (cicloId, modCod, departamento, usuario))').run().catch(() => {});
  const targetDept = superadmin
    ? (await env.DB.prepare('SELECT departamento FROM usuarios WHERE usuario=?').bind(usuarioDestino).first())?.departamento || dept
    : dept;
  const actuales = await env.DB.prepare('SELECT cicloId, modCod FROM modulo_profesores WHERE usuario=? AND departamento=?').bind(usuarioDestino, targetDept).all();
  const idsActuales = new Set(actuales.results.map(r => `${r.cicloId}__${r.modCod}`));
  const idsNuevos = new Set(modulos);
  for (const id of idsNuevos) {
    if (idsActuales.has(id)) continue;
    const [cicloId, modCod] = id.split('__');
    await env.DB.prepare('INSERT OR IGNORE INTO modulo_profesores (cicloId, modCod, departamento, usuario) VALUES (?,?,?,?)').bind(cicloId, modCod, targetDept, usuarioDestino).run();
  }
  for (const id of idsActuales) {
    if (idsNuevos.has(id)) continue;
    const [cicloId, modCod] = id.split('__');
    await env.DB.prepare('DELETE FROM modulo_profesores WHERE cicloId=? AND modCod=? AND departamento=? AND usuario=?').bind(cicloId, modCod, targetDept, usuarioDestino).run();
  }
  await auditLog(env.DB, user, 'userAssignModulos', `Módulos asignados a ${usuarioDestino}: ${modulos.join(',')}`);
  return Response.json({ ok: true });
}
```

**Nueva acción `selectModulos`** (autoservicio — mismo criterio de
seguridad que `selectDepartamento`: usa siempre el actor autenticado,
nunca un valor del body):

```js
if (action === 'selectModulos') {
  const modulos = Array.isArray(body.modulos) ? body.modulos.map(String) : [];
  if (!dept) return Response.json({ ok: false, error: 'Selecciona primero tu departamento' });
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS modulo_profesores (cicloId TEXT NOT NULL, modCod TEXT NOT NULL, departamento TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (cicloId, modCod, departamento, usuario))').run().catch(() => {});
  const actuales = await env.DB.prepare('SELECT cicloId, modCod FROM modulo_profesores WHERE usuario=? AND departamento=?').bind(user.usuario, dept).all();
  const idsActuales = new Set(actuales.results.map(r => `${r.cicloId}__${r.modCod}`));
  const idsNuevos = new Set(modulos);
  for (const id of idsNuevos) {
    if (idsActuales.has(id)) continue;
    const [cicloId, modCod] = id.split('__');
    await env.DB.prepare('INSERT OR IGNORE INTO modulo_profesores (cicloId, modCod, departamento, usuario) VALUES (?,?,?,?)').bind(cicloId, modCod, dept, user.usuario).run();
  }
  for (const id of idsActuales) {
    if (idsNuevos.has(id)) continue;
    const [cicloId, modCod] = id.split('__');
    await env.DB.prepare('DELETE FROM modulo_profesores WHERE cicloId=? AND modCod=? AND departamento=? AND usuario=?').bind(cicloId, modCod, dept, user.usuario).run();
  }
  await auditLog(env.DB, user, 'selectModulos', `Módulos propios actualizados: ${modulos.join(',')}`);
  return Response.json({ ok: true });
}
```

Nota: `userAssignModulos` y `selectModulos` comparten casi toda la lógica
de diff-e-inserta/borra — se factoriza a una función local
`aplicarModulosUsuario(db, usuario, departamento, modulosNuevos)` en el
mismo archivo, para no duplicarla.

**`importModulosCSV`:** el bucle final ("Aplicar asignaciones acumuladas
por usuario") pasa a usar la misma `aplicarModulosUsuario()` en vez de
tocar `ciclos.responsable` por nombre — `porUsuario` ya tiene el
`usuarioLogin` real como clave, no hace falta ningún cambio en la fase de
resolución/matching por asignatura (`matchModuloPorNombre` no cambia, esa
parte no tiene relación con quién es el profesor).

## Backend — `functions/api/meta.js`

Junto a la consulta de `ciclosRows` ya existente, se añade una consulta a
`modulo_profesores` (con `usuarios.email`, vía `JOIN`) filtrada por el
`departamento` del actor (o global para superadmin), y se calcula:

```js
const misModulos = [];       // moduloId[] del usuario logueado
const emailsPorModulo = {};  // moduloId -> email[] (excluyendo al propio usuario)
for (const row of profesRows.results) {
  const mid = `${row.cicloId}__${row.modCod}`;
  if (row.usuario === user.usuario) misModulos.push(mid);
  else (emailsPorModulo[mid] ??= []).push(row.email || '');
}
```

Cada módulo devuelto en `ciclos[].modulos[]` gana
`responsablesEmails: emailsPorModulo[mid] || []`; la respuesta gana
`misModulos`.

## Frontend — `js/prestamos.js` (modal admin "📚 Módulos")

- `saveModulosUsuario()`: `apiPost({action:'userAssignModulos', usuario: u.usuario, modulos: ...})`
  en vez de `nombre: u.nombre.trim()`.
- `openModulosUsuario()`/`_renderModUsuarioGroups()`: `respActual` (un
  nombre) se sustituye por `respEmails` (array, de
  `_todosModulos[].responsablesEmails`, que en `getUsers` viene sin
  filtrar por ningún usuario concreto — el admin puede abrir el modal
  para distintos profesores en la misma sesión, así que la exclusión de
  "no mostrarte a ti mismo" se hace aquí, en el render, filtrando por el
  `email` del `u` que se está editando en ese momento):

  ```js
  const otrosEmails = (m.respEmails || []).filter(email => email && email.toLowerCase() !== (u.email||'').toLowerCase());
  const otroResp = otrosEmails.length
    ? `<span class="mod-otro-resp" title="${escHtml(otrosEmails.join(', '))}">También: ${escHtml(otrosEmails.slice(0,2).join(', '))}${otrosEmails.length>2?` +${otrosEmails.length-2}`:''}</span>`
    : '';
  ```
- El recuento `nMods`/badge por fila de usuario (`_usuariosEditing[i]._modulos`) no cambia de forma —
  sigue siendo un array de moduloId, solo cambia de dónde sale
  (`u.modulos` de `getUsers`, ya recalculado por login en vez de por nombre).

## Frontend — nuevo `js/modal-mis-modulos.js`

Checklist agrupada por ciclo, adaptada de `_renderModUsuarioGroups` pero
autoreferenciada (siempre el usuario logueado, sin parámetro de índice) y
reusada por dos puntos de entrada:

- `abrirSeleccionModulosOnboarding()`: rellena desde `CICLOS`/`misModulos`
  (ya en memoria tras el `meta.js` que acaba de correr dentro de
  `loadData()`), muestra `#pSeleccionarModulos` con botones "💾 Guardar y
  continuar" (llama a `selectModulos`, luego continúa a Home) y "Recordar
  más tarde" (continúa a Home sin guardar nada).
- `openMisModulosModal()`: mismo render, dentro de un modal nuevo
  (`#mMisModulos`) abierto desde el botón "📚 Mis módulos/asignaturas" del
  menú Departamento (visible para cualquier rol autenticado, sin
  `data-perm`, ya que es autoservicio).

## Frontend — `js/auth.js` / `index.html`

- `doSelectDepartamento()`: en vez de llamar directo a
  `showUserChip();_showOverlay();loadData();`, guarda un flag en memoria
  `_justSelectedDepartamento = true` y llama a `loadData()` igual.
- `loadData()`: justo después de que la Fase 1 (`meta`) resuelve con
  éxito y antes de continuar a Fase 2, si `_justSelectedDepartamento` es
  `true` y `meta.misModulos.length === 0`, lo pone a `false` y llama a
  `abrirSeleccionModulosOnboarding()` en vez de continuar — flag en
  memoria (no en `localStorage`), así que nunca resucita en una recarga
  de página ni en un login futuro, solo en el que sigue justo a elegir
  departamento.
- `index.html`: nueva página `#pSeleccionarModulos` (mismo patrón visual
  que `#pForcePassword`/`#pSeleccionarDepartamento`) y nuevo modal
  `#mMisModulos`; nuevo botón `📚 Mis módulos/asignaturas` en el menú
  Departamento, sin `data-perm` (autoservicio, cualquier rol).
- `js/roles.js`/`js/api.js`: `selectModulos` → permiso `profile.write`,
  endpoint `usuarios`.

## Seguridad

- `selectModulos` nunca lee `usuario`/`departamento` del body — siempre
  del actor autenticado (`data.user`). Ningún rol puede tocar los módulos
  de otra persona por esta vía, ni los de un departamento ajeno.
- `userAssignModulos` mantiene su scoping por departamento ya existente
  (jefe/a de departamento solo puede tocar usuarios de su propio
  departamento; superadmin, cualquiera) — solo cambia la clave de
  identidad (login en vez de nombre), no quién puede hacer qué.
- `responsablesEmails` expone correos de compañeros del mismo
  departamento a cualquier usuario autenticado de ese departamento (antes
  solo lo veía un admin vía `getUsers`) — alcance ya acordado con el
  usuario en el diseño previo.

## Testing (verificación manual en producción, sin entorno de test local)

1. Aplicar `migrations/0032_modulo_profesores.sql` con `wrangler d1
   execute --remote` y correr la consulta de verificación de nombres sin
   match — confirmar que la lista es corta/revisable antes de continuar.
2. Modal admin "📚 Módulos": asignar el mismo módulo a dos profesores
   distintos de un departamento de prueba → los dos quedan marcados,
   ninguno pisa al otro; el aviso de "También: correo@..." aparece en
   ambos al editar al otro.
3. Autoservicio: cuenta de prueba sin módulos entra por primera vez tras
   elegir departamento → aparece `#pSeleccionarDepartamento` → al
   guardar, aparece `#pSeleccionarModulos` → "Recordar más tarde" entra a
   Home sin guardar nada → reabrir sesión no vuelve a mostrarla sola.
4. Misma cuenta, ahora desde "📚 Mis módulos/asignaturas" en el menú
   Departamento → abre el modal, marca un módulo, guarda → aparece
   reflejado en `getUsers` (recuento de módulos de esa fila) y en
   `meta.js` (`misModulos`) en el siguiente `loadData()`.
5. Importar un CSV de módulos con dos filas para la misma asignatura y
   distinto `usuario` → ambos quedan asignados (antes el segundo pisaba
   al primero).
6. Verificar con `wrangler d1 execute` que `ciclos.responsable` no se
   modifica en ningún paso posterior a la migración (queda congelado con
   los valores de antes).
