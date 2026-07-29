# Plan de acción: inventario de todo el centro

**Estado:** Fases 0, 1 y 2 implementadas y desplegadas (29/07/2026). Fase 3
pendiente.

Bosco Inventario es el inventario general de todo el IES El Bosco, con cada
departamento gestionando el suyo propio desde la misma aplicación, aislado
del resto. Solo el rol `superadmin` puede ver todos los departamentos.

---

## Diagnóstico de partida (ya resuelto, Fases 0-2)

El esquema original (`migrations/0001_schema.sql`) era mono-departamento de
facto — diagnóstico con el que se arrancó este plan:

- `inventario`, `aulas`, `categorias`, `ciclos` no tenían columna `departamento`.
- `profesores.departamento` existía pero no se usaba para filtrar nada.
- `usuarios` no tenía `departamento` — el rol (`jefe/a departamento`,
  `profesor/a`, `consulta`, `superadmin`) era global, no por departamento.
- La marca y los textos de la app mencionaban explícitamente "Electricidad y
  Electrónica".

Todo esto está corregido — ver detalle técnico completo en
[`claude.md`](../claude.md#multi-departamento--estado-de-implementación-29072026)
y en las migraciones `0007_departamentos.sql` / `0008_aulas_seed.sql`.

## Departamentos del centro

Lista de partida (número de ítems ya cargados entre paréntesis; los que
están a 0 no tienen inventario aún):

**Bachillerato/ESO:** Artes Plásticas (0), Ciencias Naturales (5), Economía (2),
Educación Física y Deportiva (0), Filosofía (0), Física y Química (0),
Formación y Orientación Laboral (2), Francés (0), Geografía e Historia (0),
Inglés (0), Latín y Griego (1), Lengua Castellana y Literatura (0),
Matemáticas (4), Música (0), Tecnología (0)

**Formación Profesional:** Sanidad (2), Actividades Físicas y Deportivas (1),
Administración (2), Comercio (0), Edificación y Obra Civil (2),
Electricidad y Electrónica (4), Fabricación Mecánica (10), Imagen Personal (1),
Informática (1)

## Usuarios y correo institucional

Un profesor/a pertenece a un departamento identificado por su correo
`@iesjuanbosco.es`. Ejemplos ya conocidos:

| Usuario/correo | Departamento |
|---|---|
| slatorre@iesjuanbosco.es | Electricidad y Electrónica |
| ochacon@iesjuanbosco.es | Fabricación Mecánica |
| mcarbonell@iesjuanbosco.es | Informática |
| cmena@iesjuanbosco.es | Comercio |
| ayera@iesjuanbosco.es | Matemáticas |
| pblanco@iesjuanbosco.es | Geografía e Historia |
| jillescas@iesjuanbosco.es | Tecnología |
| calberca@iesjuanbosco.es | Filosofía |
| rsanchez@iesjuanbosco.es | Física y Química |
| ccarpio@iesjuanbosco.es | Ciencias Naturales |

Para departamentos sin nombre concreto todavía, se crearon cuentas genéricas
(hecho, migraciones `0005_departamentos_seed.sql` / `0006_profesores_seed.sql`):
usuario `departamento<slug>` (rol `jefe/a departamento`) y `profe1<slug>`
(rol `profesor`), contraseña = usuario, correo
`<usuario>@iesjuanbosco.es` (ej. `departamentomusica`, `profe1musica`). El
`<slug>` de cada departamento está en la tabla `departamentos` y coincide
con el usado en `migrations/0007_departamentos.sql`.

> ⚠️ Usuario = contraseña en las cuentas genéricas es débil para ~48 cuentas
> activas. Recomendado: forzar cambio de contraseña en el primer login. Ver
> [[docs/SECURITY.md]] — pendiente, no implementado aún.

## Decisiones de arquitectura (confirmadas con el usuario, 29/07/2026)

1. **Categorías por departamento**, no compartidas. Cada jefe/a de
   departamento define su propia lista de categorías.
2. **Superadmin ve todos los departamentos** (con selector); el resto de
   roles (`jefe/a departamento`, `profesor/a`, `consulta`) queda limitado
   estrictamente al propio departamento.

## Fases de implementación

### Fase 0 — Rebranding ✅ hecho
- Quitada la mención específica a "Electricidad y Electrónica" del título,
  `manifest.json` (name/short_name/description), meta tags, pantalla de
  login y carga — ahora dicen "Inventario IES Juan Bosco".
- Badge de departamento junto al logo, dinámico según el usuario logueado.
- `VERSION` de `sw.js` subida en cada paso (v474/v475).
- No se tocó `js/config.js` (aulas/ciclos de ejemplo hardcodeados, son solo
  fallback hasta que llegan datos de D1) ni `js/docs-dpto.js` (hub de
  documentación con links a SharePoint de un departamento concreto) — quedan
  pendientes si se quiere genericizar también.

### Fase 1 — Modelo de datos ✅ hecho
- Tabla `departamentos` (slug, nombre, icono, color, orden) — 24 filas seed,
  ver `migrations/0007_departamentos.sql`.
- Columna `departamento` (slug) en `usuarios`, `aulas`, `inventario`,
  `ciclos`. `categorias` y `ciclos` recreadas con PK compuesta incluyendo
  `departamento` (evita colisión de nombres de categoría/código de ciclo
  entre departamentos distintos).
- Como la base `boscoinventario` arrancó vacía (sin datos del departamento
  de Electricidad y Electrónica ni de ningún otro proyecto previo), no hizo
  falta backfill de datos reales — solo de los 49 usuarios de seed (ver
  Fase 2).

### Fase 2 — Auth y scoping ✅ hecho
- `_middleware.js` añade `data.departamento` resuelto desde `usuarios` tras
  validar credenciales.
- Cada handler (`item.js`, `list.js`, `meta.js`, `prestar.js`,
  `historial.js`, `config.js`, `usuarios.js`, `profesores.js`) filtra o
  verifica propiedad por `data.departamento`, salvo rol `superadmin`.
- Login con Google (`oauth/login-google.js`) mapea los 10 correos conocidos
  del centro a su departamento; el resto se crea sin departamento asignado.
- Detalle línea a línea en `claude.md`, sección "Multi-departamento".

### Fase 3 — Frontend (pendiente)
- Selector de departamento visible solo para `superadmin` (hoy ve todos los
  datos globalmente pero sin poder aislar la vista a uno en concreto).
- Campo "departamento" en el formulario de alta de usuarios/profesores desde
  la UI, para que `superadmin` pueda asignarlo sin tocar SQL directo.
- Estado vacío amigable para los departamentos con 0 ítems (todos, de
  momento — la base arrancó limpia).

### Fase 4 — Rollout por oleadas (pendiente, tras Fase 3)
1. Comunicar credenciales (`departamento<slug>` / `profe1<slug>`) a cada
   jefe/a de departamento real.
2. Confirmar que cada uno ve solo su propio inventario, aulas, categorías y
   préstamos — no los de otro departamento.
3. Dar de alta usuarios nominales (correo real) sustituyendo a las cuentas
   genéricas donde corresponda.

## Siguiente paso concreto
Empezar por la Fase 3: construir el selector de departamento para
`superadmin` en el frontend, y el campo de asignación de departamento en las
pantallas de alta de usuarios/profesores.
