# Plan de acción: de un departamento a todo el centro

**Estado:** planificado, sin implementar. **Fecha:** 29/07/2026.

Bosco Inventario nació como el inventario del departamento de Electricidad y
Electrónica del IES El Bosco. El objetivo ahora es convertirlo en el
inventario general de todo el centro, con cada departamento gestionando el
suyo desde la misma aplicación.

---

## Diagnóstico de partida

El esquema actual (`migrations/0001_schema.sql`) es mono-departamento de facto:

- `inventario`, `aulas`, `categorias`, `ciclos` no tienen columna `departamento`.
- `profesores.departamento` existe pero no se usa para filtrar nada.
- `usuarios` no tiene `departamento` — el rol (`jefe/a departamento`,
  `profesor/a`, `consulta`, `superadmin`) es global, no por departamento.
- La marca y los textos de la app mencionan explícitamente "Electricidad y
  Electrónica" en varios archivos (ver [[rebranding]] más abajo).

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

Para departamentos sin nombre concreto todavía, se crean cuentas genéricas:
usuario `departamentoXXX`, contraseña `departamentoXXX`, correo
`departamentoXXX@iesjuanbosco.es` (ej. `departamentoeconomia`,
`departamentomusica`).

> ⚠️ Usuario = contraseña en las cuentas genéricas es débil para ~24 cuentas
> activas. Recomendado: forzar cambio de contraseña en el primer login. Ver
> [[docs/SECURITY.md]] — pendiente, no implementado aún.

## Decisiones de arquitectura (confirmadas con el usuario, 29/07/2026)

1. **Categorías por departamento**, no compartidas. Cada jefe/a de
   departamento define su propia lista de categorías.
2. **Superadmin ve todos los departamentos** (con selector); el resto de
   roles (`jefe/a departamento`, `profesor/a`, `consulta`) queda limitado
   estrictamente al propio departamento.

## Fases de implementación

### Fase 0 — Rebranding
Pendiente de que termine la subida manual del repo a
`slatorre-dev/boscoinventario` para no pisar ese trabajo. Cuando esté listo:
- Renombrar menciones a `SQLInventarioElecFP`/`ELECFP` → `boscoinventario`.
- Quitar mención específica a "Electricidad y Electrónica" del título,
  `manifest.json` (name/short_name/description), meta tags.
- Archivos afectados detectados: `index.html`, `js/config.js`,
  `manifest.json`, `README.md`, `migration.sql`, `backup.json`, y sus copias
  en `migracionApache/`.
- Subir `VERSION` en `sw.js`.

### Fase 1 — Modelo de datos
- Tabla nueva `departamentos` (slug, nombre, icono, color, orden) — seed con
  los ~24 de la lista.
- Columna `departamento` (slug) en: `usuarios`, `aulas`, `inventario`
  (desnormalizada para filtrar rápido), `categorias`, `ciclos`/`modulos`.
- Migración: los datos actuales se backfillean como
  `electricidad-electronica`.

### Fase 2 — Auth y scoping
- `_middleware.js` añade `data.departamento` resuelto desde `usuarios` tras
  validar credenciales.
- Cada handler (`item.js`, `list.js`, `prestar.js`, `historial.js`, `config.js`...)
  filtra por `data.departamento`, salvo `superadmin`.
- Alta de usuarios nominales y cuentas genéricas por departamento.

### Fase 3 — Frontend
- `js/config.js`: CICLOS/AULAS/CATS ya se sobreescriben con datos D1 al
  login — solo falta que esas queries lleguen filtradas por `departamento`.
- Topbar/home muestran el nombre del departamento del usuario logueado.
- Selector de departamento visible solo para `superadmin`.
- Estado vacío amigable para los departamentos con 0 ítems.

### Fase 4 — Rollout por oleadas
1. Departamentos con datos reales ya cargados (Electricidad y Electrónica,
   Fabricación Mecánica, Ciencias Naturales, Economía, FOL, Matemáticas,
   Sanidad, Administración, Edificación y Obra Civil, Latín y Griego,
   Act. Físicas, Imagen Personal, Informática) — verificar que sus ítems
   migran con el `departamento` correcto.
2. Resto de departamentos (0 ítems) — cuenta creada y estructura vacía lista.
3. Comunicar credenciales a cada jefe/a de departamento.

## Siguiente paso concreto
Cuando el usuario confirme que `slatorre-dev/boscoinventario` está subido y
sincronizado con Cloudflare Pages (`boscoinventario.pages.dev`) y que todo
funciona igual que antes, se empieza por la Fase 0.
