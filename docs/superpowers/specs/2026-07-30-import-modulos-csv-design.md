# Import CSV de asignaciones profesor-módulo

## Objetivo

La asignación de qué profesor imparte cada asignatura/módulo (campo
`responsable` en la tabla `ciclos`) se hacía siempre a mano, módulo por
módulo, desde el modal "📚 Módulos" de cada usuario en Gestión de
Usuarios. Permitir hacerlo en bloque desde un CSV, útil cuando llega un
cuadrante de horarios completo de jefatura de estudios.

## Formato

Una fila por asignación: columnas `usuario,asignatura`. El mismo usuario
puede aparecer en varias filas si imparte varias asignaturas.

`asignatura` es el **nombre** de la asignatura/módulo (ej.
"Electrotecnia"), no un código interno — el sistema busca la
coincidencia dentro del departamento del usuario de esa fila usando
distancia de edición (misma tolerancia ya construida para el
reconocimiento de intención de Volt, portada a `functions/api/usuarios.js`
como `levenshtein()`/`matchModuloPorNombre()`).

## Reglas de matching

1. Coincidencia exacta (normalizada: minúsculas, sin tildes) → usa esa.
2. Si hay más de una coincidencia exacta → ambiguo, no se aplica esa fila.
3. Si no hay exacta, se buscan candidatas por contención de substring o
   distancia de edición tolerada según longitud (0 para ≤4 letras, 1
   para ≤7, 2 para más largas) — mismo criterio que Volt.
4. Si hay empate entre dos candidatas igual de parecidas → ambiguo, no se
   aplica.
5. Si no hay ninguna candidata → sin coincidencia, no se aplica.

Ninguna fila ambigua o sin coincidencia se aplica en silencio — todas se
reportan en el resultado (`resultados: [{usuario, asignatura, ok, error|moduloEncontrado}]`)
para que el jefe/a de departamento revise manualmente esos casos.

## Alcance de la búsqueda

Se busca solo entre los módulos del **departamento del usuario de la
fila** (no de todos los departamentos) — evita falsos positivos cuando
dos departamentos tienen asignaturas con nombres parecidos.

## Backend

`functions/api/usuarios.js`, nueva acción `importModulosCSV`:
- Recibe `rows: [{usuario, asignatura}]`.
- Por fila: busca el usuario, valida que un no-superadmin solo pueda
  tocar usuarios de su propio departamento, busca el match dentro del
  departamento del usuario objetivo, acumula por usuario.
- Al final, aplica las asignaciones acumuladas por usuario **fusionando**
  con lo que ya tuviera asignado (no reemplaza la lista completa, a
  diferencia de `userAssignModulos` que sí la reemplaza — decisión: el
  CSV añade, no borra asignaciones existentes que no aparezcan en él).

## Frontend

Botón "📚 Importar módulos CSV" en el modal de Usuarios de la
aplicación, junto a los de importar/exportar usuarios ya existentes
(`js/prestamos.js`, `importModulosCSV(input)`). Tras importar, refresca
la lista de usuarios (`getUsers`) para reflejar los nuevos módulos
asignados sin necesitar recargar la página.

## Fuera de alcance

- No se toca `userAssignModulos` (la asignación manual desde el modal,
  que sí reemplaza la lista completa) — es un endpoint distinto con
  semántica distinta a propósito.
- No se corrige el bug preexistente de `userAssignModulos` que hardcodea
  el `departamento` del actor en vez del usuario objetivo en los
  `UPDATE ciclos` — queda anotado pero no se toca en esta tarea.
