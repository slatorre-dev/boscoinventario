# Nota de Trabajo - Bosco Inventario

**Estado:** v551 | 02/08/2026 | Multi-departamento (Fases 0, 1, 2 y 3 del
plan) completamente implementado y desplegado. Repo
`slatorre-dev/boscoinventario` en marcha, D1 propia (`boscoinventario`) con
24 departamentos + 1 genérico compartido (`iesjuanbosco`), aislamiento real
por departamento en todo el backend. **Roadmap "Modo Cámara Inteligente"
completo**: ideas #1-#8 en producción (búsqueda por número de serie, texto
libre, reconocimiento visual, multi-equipo, inventario andando, etc.) más
lectura de código de barras (mejora de #1), onboarding (tour guiado +
ayuda permanente), y unificación de los botones de QR + búsqueda por
cámara en uno solo — ver sesión del 01-02/08/2026 más abajo para el
detalle completo de las 5 piezas construidas hoy. **Volt** (el chatbot)
migrado a Cloudflare Workers AI tras la retirada de GitHub Models
(30/07/2026). Sin pendientes de diseño abiertos de esta sesión —
ver sección de Pendientes.

Inventario general del **IES El Bosco**: cada departamento gestiona su
propio inventario (aulas, categorías, ciclos, profesores, préstamos) desde
la misma app, aislado del resto. Solo `superadmin` ve todos los
departamentos. No usar mención específica de un departamento en textos
nuevos — detalle completo en
[docs/PLAN_MULTIDEPARTAMENTO.md](docs/PLAN_MULTIDEPARTAMENTO.md).

Documentación técnica detallada en `docs/` — este archivo es el resumen
operativo para retomar el trabajo desde cero, incluso desde otro PC. Ver
sección [Documentación en GitHub](#documentación-en-github-docs) al final.

---

## Para retomar desde un PC nuevo

1. `git clone https://github.com/slatorre-dev/boscoinventario.git` (o `git pull` si ya existe)
2. Leer este archivo entero + [docs/PLAN_MULTIDEPARTAMENTO.md](docs/PLAN_MULTIDEPARTAMENTO.md)
3. `npx wrangler login` (interactivo, abre navegador) — la cuenta de Cloudflare que tiene acceso al D1 es `slatorre@iesjuanbosco.es`
4. Todas las migraciones (`migrations/0001` a `0015`) ya están aplicadas en la base remota `boscoinventario` — no hace falta re-ejecutarlas salvo que se recree la base desde cero (ver [Modo de Operación](#modo-de-operación))
5. Credenciales de prueba: ver [Usuarios y credenciales](#usuarios-y-credenciales-actuales)
6. Antes de cualquier comando de `git`, comprobar que no hay `desktop.ini` corrompiendo `.git/` (ver [Entorno](#entorno)) — riesgo conocido por vivir el repo dentro de una carpeta sincronizada por Google Drive

---

## Contexto Actual

### Modo de Operación
- Base de datos: **Cloudflare D1 remota** (no local), base `boscoinventario`,
  ID `78646c8d-fcbf-456d-ab82-2428ba64c0b3` — propia e independiente,
  arranque limpio (no comparte datos con ningún proyecto anterior)
- Deployment: Git push → Cloudflare Pages auto-deploya (repo
  `slatorre-dev/boscoinventario`, sitio `boscoinventario.pages.dev`)
- Frontend: Vanilla JS + HTML5 + CSS3 (sin frameworks)
- Backend: Cloudflare Workers serverless (`functions/api/`)

### Workflow Estándar
1. Editar código localmente
2. Cambiar `VERSION` en `sw.js` (vXXX → vXXX+1)
3. Si el cambio toca esquema/datos: crear `migrations/00XX_descripcion.sql` y aplicarlo con `npx wrangler d1 execute boscoinventario --remote --file=migrations/00XX_descripcion.sql`
4. `git add` archivos concretos + `git commit -m "..."`
5. `git push origin main`
6. Cloudflare Pages despliega automáticamente
7. Usuarios reciben actualización (SW cache-bust)

### Entorno
- **Terminal:** PowerShell en VS Code
- **Node TLS (red corporativa):** `$env:NODE_TLS_REJECT_UNAUTHORIZED="0"` antes de comandos wrangler
- **Wrangler:** `npx wrangler` (instalado global en npm) — necesita `wrangler login` interactivo (no funciona en shells no interactivas)
- **Git remotes:** `origin` → `slatorre-dev/boscoinventario` (principal, único remoto al que se hace push); `slatorre` → `slatorre-dev/SQLInventarioElecFP` (proyecto **distinto y no relacionado**, no tocar nunca)
- **D1 backup:** `npx wrangler d1 export boscoinventario --remote --output backup_FECHA.sql`
- **Cuenta Cloudflare:** el D1 `boscoinventario` vive en la cuenta de `slatorre@iesjuanbosco.es`. Si `wrangler` da error de autenticación de cuenta al ejecutar comandos D1, borrar `.wrangler/cache/wrangler-account.json` (cachea la cuenta de una sesión anterior) y reintentar.
- **⚠️ Repo dentro de Google Drive** ("Mi unidad"): Drive puede reinyectar archivos `desktop.ini` dentro de `.git/` (incluido `.git/refs/`), rompiendo `git fetch`/`push` con errores tipo "bad object". Si pasa: `find .git -iname "desktop.ini" -type f -delete` y reintentar. Ideal a medio plazo: excluir `.git` de la sincronización de Drive, o mover el repo fuera de la carpeta sincronizada.
- **Disco `C:` puede llenarse** (pasó una vez en esta sesión, bloqueó todas las escrituras de archivo con `ENOSPC`): comprobar espacio libre si las ediciones empiezan a fallar sin motivo aparente.

---

## Usuarios y credenciales actuales

Todos con contraseña = lo indicado (patrón usuario=contraseña en las cuentas
genéricas — **inseguro a propósito de forma temporal**, ver [cambio de
contraseña obligatorio](#cambio-de-contraseña-obligatorio-cuentas-genéricas)).

| Usuario | Contraseña | Rol | Departamento | Correo |
|---|---|---|---|---|
| `Admin` | `Admin` | `superadmin` | `iesjuanbosco` | — |
| `Seba` | `Seba` | `superadmin` | `electricidadelectronica` | slatorre@iesjuanbosco.es |
| `jillescas` | `jillescas` | `superadmin` | `tecnologia` | jillescas@iesjuanbosco.es |
| `departamento<slug>` (×24) | = usuario | `jefe/a departamento` | `<slug>` propio | `<usuario>@iesjuanbosco.es` |
| `profe1<slug>` (×24) | = usuario | `profesor` | `<slug>` propio | `<usuario>@iesjuanbosco.es` |

`<slug>` de cada departamento (24 en total, tabla `departamentos`):
`artesplasticas, cienciasnaturales, economia, educacionfisicadeportiva,
filosofia, fisicaquimica, fol, frances, geografiahistoria, ingles,
latingriego, lenguacastellana, matematicas, musica, tecnologia, sanidad,
actividadesfisicas, administracion, comercio, edificacionobracivil,
electricidadelectronica, fabricacionmecanica, imagenpersonal, informatica`
— más el genérico `iesjuanbosco` (departamento compartido, ver más abajo).

Las 48 cuentas genéricas (`departamentoXXX`/`profe1XXX`) tienen
`password_temporal=1`: al hacer login deben cambiar la contraseña
obligatoriamente antes de usar el resto de la app. Los 3 superadmin no
llevan ese flag.

Login con Google (`@iesjuanbosco.es`) también funciona; mapa de 10 correos
conocidos → departamento en `functions/api/oauth/login-google.js`
(`EMAIL_DEPT_MAP`). Correos no mapeados se crean sin departamento asignado.
Botón de Google renderizado por JS (`initGoogleButton()` en `js/auth.js`,
via `google.accounts.id.renderButton()` en `#googleBtnContainer`, ya no el
`<div class="g_id_signin">` declarativo) con `disableAutoSelect()` previo —
si no, GIS reutiliza en silencio la última cuenta de Google "activa" del
navegador en vez de dejar elegir entre varias cuentas simultáneas (v487,
v488). v487 probó forzar el selector con `prompt()` manual, pero eso
disparó `origin_mismatch` en Google (error 400): el Client ID
`374986567801-...` estaba autorizado en Google Cloud Console solo para el
dominio del proyecto original (`inventarioelecfp`), no para
`boscoinventario.pages.dev` — se corrigió añadiendo el dominio nuevo a
"Authorized JavaScript origins" del OAuth Client ID, y v488 volvió al
enfoque `renderButton()` (más estándar, sin depender de `prompt()`).

---

## Multi-departamento — Estado de implementación

Plan completo, decisiones de arquitectura y lista de los 24 departamentos en
[docs/PLAN_MULTIDEPARTAMENTO.md](docs/PLAN_MULTIDEPARTAMENTO.md). Resumen de
lo ya construido:

### Fase 0 — Rebranding ✅ hecho
- Quitadas las menciones a "Electricidad/Electrónica" de `index.html`,
  `manifest.json`, `README.md` — ahora dicen "Inventario IES Juan Bosco".
- Badge junto al logo (`#brandDept`) muestra el departamento de **cualquier**
  usuario logueado (incluido `superadmin`, desde que tienen departamento de
  referencia — ver tabla de usuarios).
- Icono del botón de easter egg ("juego del departamento", `#deptGameIcon`)
  ahora es dinámico: emoji propio de `departamentos.icono` por usuario
  (migración `0013`). Icono de **fallback** (cuando no hay departamento)
  sustituido por `icons/imagenbosco.png` — misma imagen usada también en el
  favicon, el logo de la barra superior y el logo de la pantalla de login
  (antes todos usaban `favicon.svg` / `icons/dept-electricidad.svg`, resto
  del proyecto original de un solo departamento).

### Fase 1 — Modelo de datos ✅ hecho
- Tabla `departamentos` (slug, nombre, icono, color, orden) — 24 filas seed
  + icono real por departamento (`0007_departamentos.sql`, `0013_departamentos_iconos.sql`).
- Columna `departamento` (slug) en `usuarios`, `aulas`, `inventario`,
  `ciclos`. `categorias` y `ciclos` recreadas con PK compuesta incluyendo
  `departamento` (evita colisión de nombres de categoría/código de ciclo
  entre departamentos distintos).
- Seed de aulas (`0008_aulas_seed.sql`): 70 aulas globales (`aula1`..`aula70`,
  `departamento=''`, visibles para todos) + 1 aula propia por departamento
  (`dept-<slug>`).
- Seed de ciclos/asignaturas reales (`0009`, `0010`): un "ciclo/departamento"
  por cada uno de los 24 departamentos con sus asignaturas/módulos reales
  como "módulos" — ver detalle abajo.
- Departamento genérico compartido `iesjuanbosco` (`0011`) — ver sección
  dedicada abajo.

### Fase 2 — Auth y scoping backend ✅ hecho
- `_middleware.js` resuelve `data.departamento` (y `request.departamento`,
  compatibilidad) del usuario autenticado tras validar credenciales.
- Filtran/verifican por `departamento` (salvo rol `superadmin`, que ve todo):
  `meta.js`, `list.js` (inventario, aulas, categorías, ciclos, profesores,
  usuarios, préstamos vía join a `inventario.departamento`), `item.js`
  (add/update/delete/bulkImport, con verificación de propiedad en
  update/delete), `prestar.js` (prestar/prestarCaja/devolver verifican que el
  ítem sea del propio departamento), `historial.js` (log filtrado por el
  departamento del **actor**, vía join `log.usuario → usuarios.departamento`),
  `config.js` (aulasSync/catsSync/ciclosSync/normalizeCategoriesTags/
  normalizeTagsCanonical/renameTag/deleteTag — cada uno hace
  `DELETE ... WHERE departamento=?` + insert con `departamento` propio, nunca
  toca otros departamentos), `usuarios.js` (getUsers/userAdd/userUpdate/
  userDelete/userResetPassword), `profesores.js` (profAdd/profUpdate/
  profDelete).
- Login con Google (`oauth/login-google.js`): mapa `EMAIL_DEPT_MAP` con los
  10 correos conocidos del plan (slatorre→electricidadelectronica,
  ochacon→fabricacionmecanica, etc.). Correos no mapeados se crean sin
  departamento (no ven nada hasta que un superadmin se lo asigne).
- Frontend: `SESSION.departamento` (slug), `SESSION.departamentoNombre` y
  `SESSION.departamentoIcono` (resueltos en el login vía join a
  `departamentos`), `SESSION.passwordTemporal`.

### Fase 3 — Frontend ✅ hecho (v532)
- Selector de departamento (`#deptActivoSelect`, junto a `#brandDept` en la
  barra superior) visible solo para `superadmin`, persistido en
  `localStorage` (`dept_activo_superadmin`) — `js/config.js:deptActivo`,
  `js/auth.js:renderDeptActivoSelector()`.
- `superadmin` ya puede usar ⚙️ Gestionar aulas/categorías/ciclos eligiendo
  un departamento en el selector: `openAulasModal()`/`openCatsModal()`/
  `openCiclosModal()` filtran su lista editable por `deptActivo`, y
  `saveAulas()`/`saveCats()`/`saveCiclos()` mandan `departamentoDestino` al
  backend (`functions/api/config.js`, valida el slug contra la tabla
  `departamentos` antes de aplicar). El 403 original solo persiste si
  `superadmin` no ha elegido departamento todavía.
- Alcance deliberadamente acotado: el selector **solo** afecta a estos 3
  modales de gestión — Inicio/Inventario/Préstamos siguen mostrando todo el
  centro sin filtrar para `superadmin`, sin cambios.
- Gap resuelto sobre la marcha: `CATS` (objeto plano `{name:{c,bg,i}}`,
  usado intacto por 7 archivos del frontend) no llevaba `departamento` por
  entrada, a diferencia de `AULAS`/`CICLOS` — se expone un array separado
  `catsCrudo` (`meta.js`, solo para superadmin) con las filas crudas
  incluyendo `departamento`, usado solo por `modal-cats.js` para filtrar sin
  tocar `CATS`.
- Alta de usuarios/profesores con campo "departamento" **ya estaba resuelta
  antes de esta sesión** (contrario a lo que decía esta sección) — el select
  `.usr-dept` en `js/prestamos.js` (visible solo para `superadmin`) ya
  persiste correctamente en D1, verificado end-to-end con Playwright contra
  producción.

### Departamento "IES Juan Bosco" como bolsa compartida
- Creado en `0011_departamento_generico.sql`: departamento `iesjuanbosco` +
  aula propia (`dept-iesjuanbosco`) + ciclo/asignatura "IES Juan Bosco", para
  material que no pertenece a ningún departamento concreto.
- `GENERIC_DEPT = 'iesjuanbosco'` (constante duplicada en `list.js`, `meta.js`,
  `item.js`, `prestar.js`, `historial.js`): **cualquier** jefe/a de
  departamento o profesor (no solo superadmin) puede ver, crear, editar y
  eliminar ítems con `departamento='iesjuanbosco'`, y hacer préstamos/
  devoluciones sobre ellos — se suma a su propio departamento en todos los
  filtros, no lo sustituye.
- Al crear un ítem, `item.js` deriva el departamento a partir del
  Ciclo/Departamento elegido (`resolveItemDept()`): si el usuario selecciona
  el ciclo "IES Juan Bosco" en el formulario, el ítem se archiva ahí; si no,
  en su propio departamento. No hay checkbox nuevo — se reutiliza el
  desplegable de Ciclo/Departamento ya existente.
- `js/modal-ciclos.js` y `js/modal-aulas.js` excluyen el ciclo/aula
  compartidos (y las aulas globales) de sus listas editables — si no,
  "Guardar cambios" los duplicaría bajo el departamento del usuario que
  edita. Este era un bug latente ya presente desde el seed de aulas
  globales (`0008`), no introducido solo por lo de IES Juan Bosco.
- `config.js` bloquea con 403 que `superadmin` use `aulasSync`/`catsSync`/
  `ciclosSync`, **siempre**, tenga o no un `departamento` de referencia
  asignado — porque `meta.js`/`list.js` le siguen devolviendo TODAS las
  aulas/ciclos sin filtrar (ve todo el centro), así que su `AULAS`/`CICLOS`
  en el frontend no está scoped a un solo departamento y sincronizar
  corrompería varios a la vez. Se resuelve con el selector de departamento
  de la Fase 3 (cuando `superadmin` pueda "actuar como" un departamento
  concreto con datos ya filtrados).
- Los 3 superadmin tienen un `departamento` "de referencia" (migración
  `0015`, no les restringe nada — `isSuperAdmin()` sigue viendo todo):
  `Admin`→`iesjuanbosco`, `Seba`→`electricidadelectronica`,
  `jillescas`→`tecnologia`. Sirve para el badge y como base para la Fase 3.

### Ciclos/asignaturas reales sembrados (migraciones `0009`/`0010`)
- Terminología: "Ciclo" → **Ciclo/Departamento**, "Módulo" → **Asignatura/Módulo**
  en toda la UI (nuevo ítem, ⚙️ Gestionar ciclos, Volt, impresión/QR,
  breadcrumbs) — un mismo modelo de datos (`ciclos`, ya scoped por
  departamento) sirve tanto para ciclos formativos de FP como para
  asignaturas de departamentos académicos. No hizo falta tabla nueva.
- `0009`: 1 "ciclo/departamento" por cada uno de los 15 departamentos
  académicos (Artes Plásticas, Ciencias Naturales, Economía, Educación
  Física y Deportiva, Filosofía, Física y Química, FOL, Francés, Geografía e
  Historia, Inglés, Latín y Griego, Lengua Castellana y Literatura,
  Matemáticas, Música, Tecnología) con sus asignaturas reales como "módulos"
  (código autogenerado M01..). Sanidad: 2 ciclos formativos reales (TES,
  TAPC) con sus módulos oficiales.
- `0010`: ciclos formativos reales del resto de departamentos de FP —
  Actividades Físicas y Deportivas (TSEAS, TSAF), Administración (GA, AF,
  AD), Comercio (AC, GVEC), Edificación y Obra Civil (TPE), Electricidad y
  Electrónica (IT, IEA, MELE, SEA — sustituye a los ciclos hardcodeados de
  `js/config.js`, que siguen ahí solo como fallback local pre-login),
  Fabricación Mecánica (MEC, PPFM), Imagen Personal (EB, PCC, EDP),
  Informática (SMR, ASIR, DAW, DAM + CETI, curso de especialización —
  `nivel='CE'`).
- Mejoras de usabilidad relacionadas (v479/v480): en "Nuevo ítem", si el
  departamento solo tiene un ciclo propio (excluyendo el compartido
  `iesjuanbosco`), se preselecciona automáticamente; el desplegable de Aula
  se agrupa en "Aulas del centro" vs. "Aula del departamento"
  (`renderAulaOptions()` en `modal-item.js`, reutilizado también en los 3
  desplegables de aula de `js/prestamos.js`).

### Cambio de contraseña obligatorio (cuentas genéricas)
- Columna `usuarios.password_temporal` (migración `0014`), marcada en las 48
  cuentas `departamentoXXX`/`profe1XXX`.
- Al hacer login con el flag activo, o al reabrir la app con una sesión ya
  guardada que aún lo tenga (`loadData()` también lo comprueba, no solo el
  login), se muestra `#pForcePassword` — pantalla obligatoria, sin opción de
  saltarla — antes de cargar el inventario. Reutiliza
  `POST /api/perfil action=changePassword`, que limpia el flag al cambiar la
  contraseña.

### Gaps conocidos (no cubiertos, a valorar)
- `functions/api/docs.js` (documentos adjuntos en Drive) y `functions/api/backup.js`
  (backup completo) **no** filtran por departamento — quedan pendientes.
- `ubicaciones` (sitios sugeridos) se mantiene global, no por departamento.
- `userAssignModulos` en `usuarios.js`: si lo ejecuta un `superadmin`, solo
  tocará ciclos con `departamento` igual al suyo propio (o `''` si no tiene).

---

## Arquitectura de archivos clave

```
functions/api/          — Cloudflare Pages Functions (backend)
  _middleware.js        — Auth: lee u+p o u+token de query params, resuelve data.user + data.departamento
  intent-learning.js    — Aprendizaje Volt en D1
  perfil.js             — changePassword (también limpia password_temporal)
  prestar.js, item.js, list.js, historial.js, config.js, usuarios.js,
    profesores.js, meta.js — todos con scoping por departamento (ver arriba),
    todos con la misma constante GENERIC_DEPT='iesjuanbosco' duplicada
  item.js — además de add/update/delete/bulkImport: buscarPorSerie (serie/texto/visual
    vía IA, cascada), buscarSeriePorCodigo (mismo resultado sin IA, para código de
    barras ya decodificado en el cliente), detectarMultiples (alta masiva desde una
    foto). buscarPorSerie y buscarSeriePorCodigo comparten la función buscarSerieEnD1()
    (búsqueda exacta/fuzzy) — NO duplicar esa lógica si se toca alguna de las dos

js/
  agente-widget.js      — Agente Volt (NLP, chat, voz, aprendizaje)
  inventory.js          — Inventario principal, filtros, vistas, _pageSize persistente
  search.js             — Búsqueda global (#gsInput) + historial de búsquedas recientes (#srch)
  modal-item.js         — Modal edición/creación items, contenedores SET-/CONT-, renderAulaOptions(), preselección de ciclo único, enlaces manual/datasheet/vídeo junto a Proveedor
  modal-ciclos.js       — Gestión de ciclos/asignaturas propios (excluye el compartido iesjuanbosco)
  modal-aulas.js        — Gestión de aulas propias (excluye globales + iesjuanbosco)
  modal-auditoria.js    — Auditoría de datos: campos faltantes + filtro "Duplicados" (mismo nombre+aula), reusa selección/edición/borrado en lote de inventory.js
  roles.js              — Permisos por rol
  config.js             — CICLOS, AULAS, CATS (se sobreescriben con datos D1 al login, ya filtrados por departamento)
  state.js              — Estado global SESSION (departamento/departamentoNombre/departamentoIcono/passwordTemporal)
  auth.js               — Login, badge de departamento (#brandDept), icono de departamento (#deptGameIcon), cambio de contraseña obligatorio (#pForcePassword), dispara el tour de cámara tras loadData() exitoso
  prestamos.js          — Préstamos; desplegables de aula reutilizan renderAulaOptions()
  camara-unificada.js   — Botón único de Home (#gsCamara): escaneo continuo con BarcodeDetector (qr_code + barcode lineal) + jsQR condicional si el navegador no soporta qr_code nativo; QR reusa _showQrActionsStandalone() (qr-scanner.js), código/S/N reusa buscarSeriePorCodigo, botón manual tras ~3s sin detección entrega a camara-serie.js (IA)
  camara-serie.js       — Flujo IA de serie/texto/visual (buscarPorSerie), invocado por camara-unificada.js o directo — #gsSerie/#gsQr siguen en el DOM ocultos (display:none) como red de seguridad, ver sección Pendiente
  revision-aula.js      — Modo "Revisar aula" (#btnRevisionAula, solo en vista de aula): confirma/corrige ubicación foto a foto, reusa buscarPorSerie
  multi-equipo.js        — Modo "Añadir varios" (#btnMultiEquipo, solo en vista de aula): alta masiva desde una foto, lista editable, confirma vía bulkImport
  onboarding-camara.js  — Tour guiado (4 pantallas, primera vez tras login) + ayuda permanente (#gsAyuda) de las funciones de cámara, respeta rol (Consulta no ve #5/#6)
  qr-scanner.js         — _showQrActions() (panel de acciones tras detectar QR) + _showQrActionsStandalone() (wrapper reusado por camara-unificada.js) — #gsQr propio ya no es el punto de entrada normal, ver camara-unificada.js

sw.js                   — Service Worker, VERSION aquí (v551 actual)
migrations/             — SQL de migraciones D1, ver tabla completa abajo
```

### Migraciones D1 (todas aplicadas ya en remoto)

| Archivo | Contenido |
|---|---|
| `0001_schema.sql` | Schema inicial (heredado del proyecto original) |
| `0002_historial.sql` | Tabla `log` (auditoría) |
| `0003_superadmin.sql` | Comentario histórico, sin efecto real |
| `0004_google_oauth.sql` | Columnas Google Sign-In en `usuarios` |
| `0005_departamentos_seed.sql` | 24 usuarios `departamento<slug>` (jefe/a departamento) |
| `0006_profesores_seed.sql` | 24 usuarios `profe1<slug>` (profesor) |
| `0007_departamentos.sql` | Tabla `departamentos` (24 filas) + columna `departamento` en `usuarios`/`aulas`/`inventario`/`ciclos` + recompone PK de `categorias`/`ciclos` |
| `0008_aulas_seed.sql` | 70 aulas globales + 24 aulas propias de departamento |
| `0009_ciclos_asignaturas_seed.sql` | Asignaturas de 15 departamentos académicos + 2 ciclos reales de Sanidad |
| `0010_ciclos_fp_seed.sql` | Ciclos formativos reales del resto de departamentos de FP |
| `0011_departamento_generico.sql` | Departamento/aula/ciclo `iesjuanbosco` ("IES Juan Bosco") |
| `0012_superadmins_seed.sql` | Usuarios superadmin `Seba` y `jillescas` |
| `0013_departamentos_iconos.sql` | Icono (emoji) real por departamento en `departamentos.icono` |
| `0014_password_temporal.sql` | Columna `usuarios.password_temporal`, marcada en las 48 cuentas genéricas |
| `0015_superadmins_departamento.sql` | Departamento de referencia para los 3 superadmin |
| `0016_aulas_items_seed.sql` | Ítems de ejemplo: pantalla multimedia + pizarra de tiza en las 70 aulas globales, + 3-4 ítems propios de cada especialidad en las 24 aulas de departamento |
| `0017_pantallas_pizarras_iesjuanbosco.sql` | Reasigna la pantalla multimedia y la pizarra de tiza de las 70 aulas globales (sembradas en `0016` sin departamento) al departamento compartido `iesjuanbosco` |
| `0018_google_oauth_columnas.sql` | Añade `google_id`, `auth_method`, `created_at` a `usuarios` — `0004` asumía que ya existían (cierto en el proyecto original, no en esta base D1 sembrada desde cero) |
| `0019_pantallas_pizarras_inventariable.sql` | Marca `tipo_material='inventariable'` en los 222 ítems sembrados en `0016` (habían quedado como `'consumible'` por el default de `item.js`, disparando el aviso de stock bajo con qty=1/min=1) |
| `0020_indices_inventario.sql` | Índices en `inventario`: `departamento` solo, y compuestos `(departamento, aula)`, `(departamento, ref)`, `(departamento, cat)`, más `parent_id` — tabla no tenía ningún índice salvo la PK |
| `0021_limpiar_profesores_duplicados.sql` | Borra de `profesores` las filas que ya duplican (por nombre o email normalizado) un usuario de la app **del mismo departamento** — quedaron huérfanas de UI tras convertir el modal 👥 en "solo prestatarios externos" (v521) |
| `0022_notificado_vencido.sql` | Columna `prestamos.notificado_vencido`, evita reenviar el email de recordatorio de vencidos en cada visita a Préstamos (v522) |
| `0021_restaurar_ciclos_electricidad.sql` | Restaura ciclos de Electricidad/Electrónica borrados por error en una sesión anterior (número `0021` duplicado con `0021_limpiar_profesores_duplicados.sql` a propósito — ambas independientes, sin conflicto de columnas/tablas) |
| `0023_iconos_categorias_representativos.sql` | Iconos (emoji) más representativos por categoría, sustituyendo el genérico por defecto en varias filas de `categorias` |
| `0024_item_fotos.sql` | Tabla nueva `item_fotos(id, item_id, foto, orden)` — galería de hasta 3 fotos por ítem (v535-v536), copia las fotos ya existentes de `inventario.foto` como `orden=1` |
| `0025_fecha_adquisicion_precio.sql` | Columnas `inventario.fecha_adquisicion` (TEXT) y `inventario.precio` (REAL) — sección Detalles del modal de ítem (v537-v542) |
| `0026_inventario_serie.sql` | Columna `inventario.serie` (TEXT DEFAULT '') + índice compuesto `(departamento, serie)` — búsqueda por número de serie vía cámara (v543) |

---

## Auth actual (CRÍTICO pendiente)
- Credenciales van en query params `?u=usuario&p=password` — visible en logs/historial
- `_middleware.js` valida contra D1 y pasa `data.user` + `data.departamento` al handler
- **No usar `request.user`** — es inmutable en Workers, siempre leer de `data.user` (aunque por compatibilidad el middleware también lo espeja en `request.user`/`request.departamento`, código nuevo debe usar `data`)

---

## Agente Volt — Estado actual (v390)

Detalle completo en [`docs/BACKEND_APRENDIZAJE_INTENCIONES.md`](docs/BACKEND_APRENDIZAJE_INTENCIONES.md).

### Archivos
- `js/agente-widget.js` — todo el widget (NLP, chat, voz, aprendizaje)

### Aprendizaje de intenciones (backend D1)
- Tabla `intent_learning` en D1 (creada 24/05/2026)
- Endpoint `functions/api/intent-learning.js`: GET / POST / DELETE / clear / bulk-import
- Al abrir panel: carga desde backend, migra localStorage automáticamente una vez (flag `volt_intents_migrated_v1`)
- UI optimista: actualiza estado en memoria antes de confirmar backend
- Fallback: localStorage si backend falla

### Intenciones válidas (whitelist)
`prestamo | devolver | stock | estado | mantenimiento | buscar | resumen_aula | quien_tiene | stock_bajo | lista_mantenimiento`

### NLP (v388)
- `normalize(s)`: lowercase + quitar tildes + trim — usar SIEMPRE para comparar texto del usuario contra datos BD
- `detectarIntencion(q)`: sin LLM, reglas de puntuación
- `SINONIMOS`: tabla de 17 entradas del taller (multímetro=polímetro, osci=osciloscopio, fuente=fuente de alimentación…)
- `applySinonimos(words)`: expande keywords con formas canónicas y alias
- `extractKeywords(q)`: pasa por `textToNumber()` — "dos osciloscopios" = "2 osciloscopios"
- `searchInventoryCandidates()`: fuzzy por prefijo común ≥4 chars + sinónimos
- `extraerNombreItem(q)`: corta en verbos de acción y preposiciones de ubicación
- `extraerAulaDeFrase(q)`: regex "aula/clase N" + comprueba contra array AULAS
- Búsqueda de items usa `normalize()` en ambos lados

### Voz (v390)
- Botón `#ag-mic`, Web Speech API `es-ES`
- `continuous:false` + auto-session restart — evita texto basura en Android
- Pausa de 2s de silencio antes de enviar (`silenceTimer`)
- `sessionCommitted`: captura resultado final en closure propio (fix duplicado v390)
- `_voiceSent`: flag de un solo envío — evita condición de carrera timer+onend en Android
- `startSession()`: crea nueva instancia SpeechRecognition; `onend` reinicia si timer activo

### Historial chat persistente (v366)
- `HISTORY_KEY = 'volt_chat_history_v1'`, máx 40 mensajes en localStorage
- `saveHistory()` llamado en `appendMsg()` y `appendMsgHtml()`
- `restoreHistory()` en primer `renderChatReady()` con separador "— conversación anterior —"
- `limpiarPantallaChat()` borra localStorage

### Formulario préstamo (v388)
- Aviso `ag-loan-stock-warn` en tiempo real al cambiar cantidad: "⚠ Quedarán N uds. (mínimo: M)"
- Solo aparece si `qty - cantidad < min`

---

## Contenedores (v320-v325)
- Prefijo `SET-` → padre `SET-XXX-00`, hijos `SET-XXX-01..N`
- Prefijo `CONT-` → contenedor físico
- Funciones: `toggleGenerarUnidades()`, `saveGenerarUnidades()` en `modal-item.js`

---

## UX reciente (v482/v483)
- **Paginación persistente**: `_pageSize` (10/25/50 ítems del inventario) se
  guarda en `localStorage` (`inv_page_size`) al cambiarlo, y se restaura al
  recargar — antes se reseteaba cada sesión (`js/inventory.js`, `setPageSize()`).
- **Historial de búsquedas recientes**: últimas 5 búsquedas del campo
  `#srch` (filtro de inventario) guardadas en `localStorage`
  (`inv_recent_searches`), sugeridas vía `<datalist>` nativo del navegador al
  enfocar el campo — sin dropdown propio (`js/search.js`,
  `saveRecentSearch()`/`renderSearchHistory()`).

---

## Historial de sesiones

Movido a [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) (todas las sesiones
desde v317 + tabla de versionado completa). Última sesión, resumen:

- **29/07/2026 (v469-v483):** sesión larga de migración a multi-departamento
  y varias mejoras de usabilidad. En orden: 1) Repo subido y sincronizado en
  `slatorre-dev/boscoinventario` (origin reapuntado, remoto viejo `slatorre`
  intacto). 2) D1 propia `boscoinventario` creada e independiente de
  cualquier base anterior. 3) 48 usuarios de seed (`departamentoXXX`/
  `profe1XXX`) + 3 superadmin (`Admin`, `Seba`, `jillescas`). 4) Rebranding
  (Fase 0): sin menciones a Electricidad/Electrónica, badge de departamento.
  5) Aislamiento real por departamento (Fase 1+2): tabla `departamentos`,
  columna `departamento` en tablas clave, scoping en todos los endpoints.
  6) Seed de 94 aulas + ~540 filas de ciclos/asignaturas reales para los 24
  departamentos. 7) Departamento compartido `iesjuanbosco` usable por
  cualquier jefe/a de departamento, no solo superadmin. 8) Icono de
  departamento dinámico en el botón de easter egg. 9) Cambio de contraseña
  obligatorio en las 48 cuentas genéricas. 10) Mejoras de usabilidad:
  preselección de ciclo único, aulas agrupadas centro/departamento,
  paginación persistente, historial de búsquedas recientes.
  11) Documentación (`claude.md`, `docs/CONTEXT.md`, `docs/ARCHITECTURE.md`,
  `docs/PLAN_MULTIDEPARTAMENTO.md`, `docs/IDEAS.md`) reescrita para reflejar
  todo esto y quitar las referencias al proyecto antiguo de un solo
  departamento. Incidencias resueltas en el camino: remote `origin` con doble
  pushurl a repos viejos (corregido), desajuste de cuenta Cloudflare cacheada
  en `.wrangler/cache` (corregido), `desktop.ini` de Google Drive corrompiendo
  `.git/refs` (limpiado, riesgo de que reaparezca — ver Entorno), disco `C:`
  lleno bloqueando escrituras (resuelto por el usuario).
- **29/07/2026 (v484-v485):** inventario sembrado con datos de ejemplo
  (migración `0016`) — pantalla multimedia + pizarra de tiza en las 70 aulas
  globales, y 3-4 ítems inventados propios de cada especialidad en las 24
  aulas de departamento (osciloscopio en Electricidad/Electrónica,
  microscopio en Ciencias Naturales, torno mecánico en Fabricación Mecánica,
  etc.). Después (`0017`), la pantalla multimedia y la pizarra de tiza de las
  70 aulas globales se reasignan del departamento vacío al compartido
  `iesjuanbosco`.
- **29/07/2026 (v486):** rebranding visual con la imagen `icons/imagenbosco.png`
  aportada por el usuario — sustituye al logo azul genérico (`favicon.svg`) y
  al fallback `icons/dept-electricidad.svg` (resto del proyecto original de
  un solo departamento) en: favicon, icono PWA (manifest.json), logo de la
  barra superior, logo de la pantalla de login, e icono de fallback del botón
  de easter egg. Requirió añadir reglas CSS (`.brand-logo .logo-img`,
  `.dept-game-icon img`) con `object-fit:cover` — los contenedores solo
  fijaban su propio tamaño, no el de la imagen hija, y el PNG (a diferencia
  del SVG anterior) se desbordaba sin esa regla. Verificado visualmente con
  Playwright (instalado temporalmente fuera del repo por los problemas de
  escritura conocidos en Google Drive, ver Entorno).
- **29-30/07/2026 (v487-v488):** login con Google no dejaba elegir entre
  varias cuentas activas del navegador (se quedaba con la primera, no la
  de `iesjuanbosco`). Causa raíz: el widget declarativo `g_id_signin`
  reutiliza en silencio la sesión de Google "activa" si el navegador tiene
  varias cuentas simultáneas — hace falta `disableAutoSelect()` antes de
  renderizar/pedir el login. v487 probó forzar esto con un botón propio que
  llamaba a `disableAutoSelect()` + `prompt()` manual en cada clic, pero
  `prompt()` disparó `origin_mismatch` (error 400 de Google): el Client ID
  OAuth solo tenía autorizado el dominio del proyecto original
  (`inventarioelecfp`) en Google Cloud Console, no `boscoinventario.pages.dev`
  — pendiente desde la migración de repo, nunca antes se había completado
  un login de Google en el dominio nuevo. Corregido añadiendo el dominio a
  "Authorized JavaScript origins" del Client ID. v488 volvió a un enfoque
  más estándar: `google.accounts.id.renderButton()` en vez de `prompt()`,
  con `disableAutoSelect()` llamado una vez al cargar la página. Con el
  origen ya autorizado, apareció un segundo fallo encadenado: 1) faltaba
  la variable de entorno `GOOGLE_OAUTH_CLIENT_ID` en Cloudflare Pages
  (nunca configurada tras la migración de proyecto — corregida desde el
  dashboard, Settings → Variables y secretos → Producción); 2) una vez
  resuelto eso, `login-google.js` fallaba con `D1_ERROR: no such column:
  google_id` — la migración `0004_google_oauth.sql` asumía que
  `google_id`/`auth_method`/`created_at` ya existían en `usuarios` (cierto
  en el proyecto original `inventarioelecfp`), pero esta base D1
  `boscoinventario` se sembró desde cero y nunca las tuvo. Corregido con
  la migración `0018` (v489).
- **30/05/2026 (v468):** servidor Apache restaurado tras 24h de caída por un
  script `observed.service` que mataba procesos de alto CPU y tumbaba
  Docker Desktop. Los 8 contenedores (apache, mysql, n8n, influxdb, nodered,
  Mosquitto, Grafana, portainer) recuperados con persistencia validada.
  Pendiente: debuguear `inventario-node` (`DB undefined` en `auth.js:13`,
  wrapper mysql2 sin inicializar) — ver detalle en DEVELOPMENT.md.
- **30/07/2026 (v490-v498):** tras el fix de Google OAuth (v489), sesión de
  simplificación de UI y varios fixes menores. v491 probó un rediseño de la
  cabecera de Home (panel de taller + mapa generativo) — revertido en el
  mismo día (v492) por no encajar con el resto del diseño. v493 unificó
  confirmaciones/errores/validación inline de formulario en un solo patrón
  consistente. v494 restringió el departamento compartido `iesjuanbosco` a
  jefes de departamento y superadmin (antes accesible más ampliamente). v495
  fue la más grande: colapsables en Home (categorías/ciclos con >8 tarjetas),
  reducción de tabs de Préstamos de 6 a 2 (+ toggle de vencidos + selector de
  agrupación), y colapsado de las secciones Detalles/Documentación en el
  modal de Nuevo ítem — todo para reducir ruido visual en pantallas con
  mucho contenido. v496 ocultó en Home las aulas sin ítems del propio
  departamento (ruido para departamentos con poco inventario propio). v497
  hizo más visible el botón desplegable de categoría/ciclo en Home, y v498
  sustituyó la flecha diminuta de colapsar/expandir por una pastilla
  "Ocultar/Mostrar" más clara.
- **30/07/2026 (v499-v501):** `restoreBackup` (botón de restaurar backup
  desde JSON, en Config) daba "Acción desconocida" — el endpoint nunca se
  había implementado en el backend pese a que el frontend ya lo llamaba;
  v499 lo implementó completo (inventario, aulas, categorías, ciclos,
  contenedores). Al usarlo por primera vez apareció un bug: aulas globales
  ya existentes en la base (ej. `aula35`, sin `departamento` propio) se
  duplicaban en vez de reconocerse, porque el restore trataba cualquier fila
  sin `departamento` como "hay que crearla en `FALLBACK_DEPT`" en lugar de
  comprobar si ya existía como aula global — v500 corrigió esto (busca por
  `id` entre las aulas con `departamento=''` antes de decidir insertar) y de
  paso se fusionaron a mano las 7 aulas ya duplicadas en producción
  (`aula35/36/38/39/40/41/44`, items reasignados a la fila del departamento,
  fila global duplicada borrada; backup previo del `d1 export` guardado
  fuera del repo, en el scratchpad de la sesión — no versionado). v501 añadió dos
  mejoras: índices D1 en `inventario` (`migrations/0020`, tabla no tenía
  ninguno salvo la PK — compuestos `(departamento, aula/ref/cat)` porque casi
  toda query ya filtra por departamento primero) y un filtro "⚠ Duplicados"
  en el modal de Auditoría de datos (`js/modal-auditoria.js`) que detecta
  items con mismo nombre normalizado + misma aula (para no depender de SQL
  manual la próxima vez que pase algo así) — reusa la selección múltiple y
  edición/borrado en lote ya existentes, sin fusión automática.
- **31/07/2026 (v520-v521):** v520 corrigió que la cámara no se abría al
  añadir foto en "Nuevo ítem" (solo el selector de archivos genérico) — al
  input `f_foto_file` le faltaba `capture="environment"`, presente en los
  demás inputs de foto del proyecto (QR, docs, formulario de Volt). v521
  reorganizó el sistema de préstamos: 1) el modal 👥 pasa de "gestión de
  profesores" (mezclaba usuarios de la app + tabla `profesores` propia,
  con duplicidad de mantenimiento) a "solo prestatarios externos" (gente
  sin cuenta de login) — el selector de préstamo sigue viendo a todos
  (usuarios de la app + externos) porque el backend ya los fusiona sin
  duplicados (`list.js:mergeProfesores`, sin cambios); migración `0021`
  limpia de la tabla `profesores` las filas que ya duplicaban un usuario
  de la app. 2) Buscador de texto añadido al selector de profesor/a en
  ambos modales de préstamo (individual y caja completa), mismo patrón
  que el buscador de ítem ya existente. 3) El modal de "préstamo de caja
  completa" (antes solo abría con una caja ya fijada desde la fila del
  inventario) ganó un modo alternativo: botón nuevo "📦 Prestar caja"
  junto a "⌛ Nuevo préstamo" que abre el mismo modal con un selector
  propio (filtro de aula + buscador de texto) para elegir la caja sin
  partir de una fila. Implementado con subagent-driven-development en
  worktree aislado (`worktree-prestamos-prestatarios`) — incidencia en el
  camino: dos de los agentes despachados crearon su propio worktree
  aislado pese a instrucción explícita de no hacerlo, hubo que traer sus
  commits a mano (`cherry-pick` uno, `reset --soft` + recommit el otro).
  Migración `0021` ya aplicada en remoto (backup previo, resultó no-op:
  tabla `profesores` estaba vacía en producción). La revisión final de
  rama (antes de mergear) encontró y corrigió 3 problemas invisibles a
  nivel de tarea individual: la migración `0021` cruzaba departamentos
  (contradecía el spec, corregido a `WHERE EXISTS` correlacionado por
  `departamento` antes de aplicarla), elegir caja desde el nuevo selector
  borraba silenciosamente el profesor/fecha/observaciones ya rellenados
  (`_loadCajaIntoModal` ganó un parámetro `initForm` para separar "coger
  datos de la caja" de "inicializar el formulario"), y quedaron 5 sitios
  más con texto "profesor/a" sin migrar a "prestatario/a externo/a"
  (menú de departamento, botón de Préstamos, subtítulo del modal, CSV,
  toast) que dejaban la UI menos consistente que antes del cambio.
- **31/07/2026 (v522):** 4 mejoras en el flujo de Devolver material y
  préstamos vencidos, detectadas al revisar el código en la sesión
  anterior. 1) Aviso "⚠ Vencido desde el DD/MM/YYYY" en el modal Devolver
  cuando el préstamo está vencido (antes solo se veía en la tabla de
  fondo). 2) `confirmDevolver()` ya no hace `loadData()` completo tras
  cada devolución — el backend (`functions/api/prestar.js`, acción
  `devolver`) ahora devuelve el préstamo actualizado y el nuevo stock del
  ítem, y el frontend actualiza los arrays locales igual que ya hacían
  `confirmPrestar`/`confirmPrestarCaja`. 3) Aviso en vivo "⚠ Quedarán N
  unidad(es) sin devolver" si se deja una devolución parcial, mismo
  patrón que el aviso de stock bajo de Volt. 4) Recordatorio proactivo de
  préstamos vencidos: nuevo endpoint `notificarVencidos` en
  `functions/api/prestar.js` que envía un email (vía Gmail API, mecanismo
  ya existente) al jefe/a de departamento con la lista de vencidos sin
  notificar, marcándolos con la nueva columna `prestamos.notificado_vencido`
  para no reenviar en cada visita — sin cron real (el proyecto no tiene
  scheduled workers configurados en `wrangler.toml`), se dispara al
  visitar la página de Préstamos, una vez por sesión de página. Migración
  `0022_notificado_vencido.sql` aplicada en remoto (backup previo). Un
  bug Critical se detectó y corrigió en la revisión: la llamada inicial al
  nuevo endpoint usaba `fetch()` crudo con URL inexistente, payload sin
  el campo `action`, y sin los query params de autenticación (`?u=&p=`)
  que exige el resto del proyecto — la feature habría fallado siempre,
  en silencio (`.catch(()=>{})` tragaba el error sin avisar a nadie).
  Corregido usando `apiPost()` (ya existente) y registrando la acción
  nueva en `ENDPOINT_MAP` (`js/api.js`) y `ACTION_PERMISSIONS`
  (`js/roles.js`), gaps que tampoco existían antes de esta sesión.
  Implementado con subagent-driven-development en worktree aislado
  (`worktree-devolucion-vencidos`).
- **31/07/2026 (v531-v532):** dos piezas de trabajo. 1) Fix rápido: el
  buscador de préstamos (ítem individual y caja completa) no mostraba en
  qué aula estaba cada resultado al filtrar por "Todas las aulas" —
  `js/prestamos.js` (`_buildPresItemOptions`, `_fillPrestarInfo`,
  `_buildPresCajaOptions`, `_loadCajaIntoModal`) ahora muestra el nombre de
  aula junto a cada ítem/caja, mismo patrón `AULAS.find(a=>a.id===x.aula)`
  ya usado en el resto del proyecto. 2) Fase 3 del plan multi-departamento
  completa para los 3 modales de gestión: selector de departamento activo
  para `superadmin` (`#deptActivoSelect`, junto a `#brandDept`, persistido
  en `localStorage`) que desbloquea ⚙️ Gestionar aulas/categorías/ciclos
  (antes bloqueado con 403 para cualquier `superadmin`); backend
  (`functions/api/config.js`) acepta `departamentoDestino` explícito,
  validado contra la tabla `departamentos`. Además, aviso de "categorías
  genéricas" en ⚙️ Gestionar categorías + botón para crear un set inicial
  sugerido (Material fungible, Herramientas, Mobiliario, Audiovisual,
  Informática, Otros) para los 21 departamentos (de 24) que solo tenían la
  etiqueta genérica "Material didáctico" sin categorías propias en la
  tabla `categorias` — detectado al inicio de esta sesión al revisar qué
  categorías había realmente por departamento. Gap resuelto sobre la
  marcha: `CATS` (objeto plano usado por 7 archivos del frontend) no tenía
  `departamento` por entrada como sí tienen `AULAS`/`CICLOS` — se expuso
  `catsCrudo` (solo para `superadmin`) en vez de tocar `CATS`. También se
  verificó que la alta de usuarios/profesores con campo "departamento" ya
  estaba resuelta desde antes de esta sesión (el roadmap decía que faltaba,
  pero el código y una prueba end-to-end con Playwright contra producción
  confirmaron que ya funcionaba). Implementado con subagent-driven-development
  en el propio repo (sin worktree — instrucción explícita del usuario tras
  el incidente de v521/v522); un agente ignoró la instrucción y creó su
  propio worktree para Task 1, cuyo commit además quedó corrupto (borrado
  masivo de archivos no relacionados por un bug del entorno de worktree) —
  se extrajo el diff real y se aplicó a mano en el repo principal. La
  verificación end-to-end en producción (Playwright + `wrangler d1
  execute` contra la D1 remota) encontró un bug real antes de dar la
  sesión por cerrada: `catsPropias` (el flag que oculta el aviso de
  categorías genéricas) nunca se actualizaba tras guardar, solo en el
  siguiente login — el aviso seguía visible al reabrir el modal en la
  misma sesión tras crear las categorías sugeridas. Corregido y
  redesplegado (v533), reverificado en vivo confirmando el arreglo.
- **31/07/2026 (v534):** revisión final de rama (todo el diff de v531-v533
  junto, no solo por tarea) encontró un hallazgo Important que ninguna
  revisión individual podía ver: `js/modal-item.js` (`handleCatSelectChange`,
  crear categoría inline desde "＋ Añadir categoría..." en el formulario de
  Nuevo ítem) era un **cuarto** llamante de `catsSync` que ninguna tarea
  de v532 había migrado — para `superadmin` construía el payload desde
  `CATS` (mezcla de los 24 departamentos) sin mandar `departamentoDestino`,
  con riesgo de que una futura corrección ingenua del 403 volcase
  categorías de todo el centro en un solo departamento. Corregido con el
  mismo patrón ya usado en `modal-cats.js` (`catsCrudo` filtrado por
  `deptActivo`). De paso, 2 hallazgos Minor que se habían diferido durante
  la sesión: `logout()`/`_doAutoLogout()` no limpiaban `deptActivo` ni
  ocultaban el selector de departamento (quedaba visible sobre la pantalla
  de login y sobrevivía a un cambio de usuario en el mismo navegador), y
  `.brand-dept-select` no tenía ninguna regla CSS (ni base ni responsive).
- **31/07/2026 (v535-v536): Galería de hasta 3 fotos por ítem.** Comparación
  del proyecto contra apps de inventario comerciales (Sortly, Snipe-IT)
  identificó que solo se permitía 1 foto por ítem — se implementó galería
  de hasta 3, gestionable desde el modal de editar/crear ítem. Arquitectura:
  tabla nueva `item_fotos(id, item_id, foto, orden)` (base64, mismo patrón
  que ya usaba `inventario.foto`), migración (`migrations/0024`) copió las
  386 fotos ya existentes como `orden=1`. La fila `orden=1` se espeja
  siempre en `inventario.foto` para que los 10+ sitios del frontend que ya
  muestran esa columna como miniatura (tabla, tarjetas, QR, impresión de
  etiquetas) no necesitaran ningún cambio — solo el modal de edición gestiona
  la galería completa. Backend nuevo: `fotosGet`/`fotosSync` en
  `functions/api/item.js`, con el mismo check de propiedad por departamento
  que ya usan `update`/`delete`, y registradas en `ENDPOINT_MAP`/
  `ACTION_PERMISSIONS` (lección de v522 aplicada desde el principio esta
  vez). Calidad de compresión bajada de 0.45 a 0.40. La galería completa se
  carga bajo demanda (`fotosGet`, no bloqueante) al abrir un ítem existente
  — `list.js` no cambia, sigue sin incluirla en la carga masiva. La revisión
  final de rama (modelo más capaz, diff completo de las 6 tareas) encontró
  un hallazgo Important que ninguna revisión por tarea podía ver:
  `js/docs.js` (archivo que este plan no tocó) llama a `renderMainPhoto()`
  para su propia lógica de sincronización con documentos de Drive
  (`syncMainPhotoFromDocs()`, `deleteExistingDoc()`) — pero esa función
  había pasado a reescribir también el estado completo de la galería
  (`_fotosEditing`), así que borrar un documento de Drive marcado como
  foto principal podía vaciar las 3 fotos reales al guardar, y sincronizar
  una foto desde un documento de Drive podía colar su URL (no base64) como
  si fuera una foto real de la galería — por una carrera entre la petición
  asíncrona `fotosGet` y la petición asíncrona `getDocs`, ambas disparadas
  sin orden garantizado dentro de `openModal()`. Corregido separando
  responsabilidades: `renderMainPhoto()` vuelve a ser solo compatibilidad
  visual (rellena `#f_foto`), y una función nueva `_setFotosEditingFromMain()`
  es el único punto que inicializa la galería, llamada explícitamente desde
  `openModal()`. Verificado end-to-end en producción con Playwright +
  `wrangler d1 execute` (ítem 1097 "100K"): añadir/eliminar/reordenar fotos,
  límite de 3, sincronización con `inventario.foto`, todo confirmado en D1
  real. Un ítem de prueba inicial (225, "Estaciones Soldadura") reveló un
  bug preexistente y no relacionado con esta feature: su campo `mod` no
  corresponde a ningún ciclo/asignatura activo, así que `saveItem()` lo
  bloquea con un error de validación al guardar, con o sin fotos — pendiente
  de investigar por separado, no se tocó como parte de esta sesión. Gaps
  conocidos, documentados y no corregidos (deuda aceptada explícitamente):
  el rol `Consulta` (solo lectura) nunca ve la galería completa porque
  `fotosGet` exige el permiso `items.write` y el proyecto no tiene hoy un
  permiso `items.read` más laxo; la migración `0024` no lleva
  `IF NOT EXISTS` (protegida solo por el error de re-ejecución, no
  destructiva). Implementado con subagent-driven-development en el propio
  repo (sin worktree).
- **31/07-01/08/2026 (v537-v542): 4 mejoras al modal de ítem.** 1) Fix de
  solape entre la galería de fotos (v535) y la fila Cantidad/Mínimo/Tipo —
  el más costoso de la sesión, 5 rondas de fix hasta dar con la causa
  estructural: `.item-stock-strip` compartía contenedor flex con
  `.photo-col`, así que cualquier ajuste de anchos/wrap en un viewport
  concreto rompía otro. Solución final (v541): sacar `.item-stock-strip`
  del HTML de `.photo-picker` — pasa a ser un bloque hermano en su propia
  línea, sin relación flex/grid con la galería, eliminando la competencia
  de espacio de raíz en vez de seguir ajustando parámetros. La revisión
  final de rama encontró que 2 rondas intermedias (v539/v540) habían dejado
  sin acotar otras 2 reglas `#mItem .photo-preview` en breakpoints
  `@media(960px)`/`@media(640px)` (mismo patrón de bug que la causa raíz
  original) — no reintroducían el solape gracias a la solución estructural,
  pero descuadraban el tamaño real de las miniaturas; corregido en v542.
  2) Campo nuevo `fecha_adquisicion` (columna D1 `TEXT`, migración `0025`)
  junto a Ref./Nombre en IDENTIFICACIÓN. 3) Campo nuevo `precio` (columna
  D1 `REAL`) junto a Proveedor en DETALLES — cuidado explícito de no
  confundir un precio real de `0` con "sin dato" (`=== '' ? null :
  parseFloat(...)`, nunca `||null`). 4) Bloque "Contenedor/Caja" (antes
  dentro de 📎 DOCUMENTACIÓN) movido a su propia sección colapsable
  "📦 CONTENEDOR/CAJA", con lógica de apertura automática separada e
  independiente en `openModal()`. Verificado end-to-end en producción con
  Playwright en 3 viewports (1280/700/480px) y `wrangler d1 execute` (ítem
  1097 "100K"). Bug lateral encontrado y corregido en D1 durante la
  verificación (no parte de este plan): el aula propia de Tecnología
  aparecía primera en el Home por `orden=0` en vez de `115` —
  `saveAulas()` (`js/modal-aulas.js:78`) reasigna `orden` por índice del
  array filtrado del departamento para todas las filas al guardar, no solo
  las nuevas; con 1 sola aula en el array, `orden` colapsó a 0. Se disparó
  por un guardado real de "Gestionar aulas" en esta misma sesión (verificación
  de A/C). Corregido el dato en D1 (`orden=115`); el bug de código en
  `saveAulas()` queda sin arreglar, pendiente para otra sesión — afecta a
  cualquier departamento con pocas aulas que guarde desde ese modal.
- **01/08/2026 (v543): Búsqueda de ítems por número de serie vía cámara +
  migración completa de Volt (el chatbot) — ambas ✅ completadas y
  verificadas end-to-end en producción**, tras un bloqueo largo por
  retirada de proveedor de IA (GitHub Models) que afectaba a las dos
  features, resuelto en la misma sesión. Idea propuesta por el usuario:
  "Modo Cámara Inteligente" con 10 sub-ideas
  (buscar por S/N, alta automática desde etiqueta, reconocimiento visual,
  modo "Inspector" en vivo, etc.) — esta sesión implementó las piezas #1
  (buscar por S/N), #2 (autocompletar marca/modelo, añadido más tarde en
  la misma sesión) y #8 (S/N como identificador único, consecuencia
  directa de #1). Roadmap completo de las 10 ideas, con las 3 hechas y las
  7 pendientes, en
  [`docs/IDEAS.md`](docs/IDEAS.md#inventario-por-cámara--modo-cámara-inteligente).

  **Diseño y plan:** brainstorming + writing-plans completos, guardados en
  `docs/superpowers/specs/2026-08-01-busqueda-por-numero-serie-design.md` y
  `docs/superpowers/plans/2026-08-01-busqueda-por-numero-serie.md`.
  Implementado con subagent-driven-development en worktree aislado
  (`.claude/worktrees/busqueda-serie`, rama `worktree-busqueda-serie`),
  6 tareas, todas revisadas individualmente + revisión final de rama.

  **Lo construido (código ya en `main`, desplegado):**
  1. Migración `migrations/0026_inventario_serie.sql` — columna
     `inventario.serie` (`TEXT DEFAULT ''`) + índice compuesto
     `(departamento, serie)`. Aplicada en remoto.
  2. Campo `serie` editable a mano en el modal de ítem (`f_serie`, junto a
     Proveedor en la sección Detalles) — funciona independientemente de la
     IA, ya operativo.
  3. Backend `functions/api/item.js`, acción nueva `buscarPorSerie`: recibe
     una foto en base64, pide a un modelo de IA con visión que extraiga el
     número de serie, busca en `inventario` (match exacto, fuzzy por
     distancia de Levenshtein ≤2, o "ninguno"), respetando scoping por
     departamento (+ `iesjuanbosco`) y excluyendo ítems `oculto=1` para
     no-superadmin. Registrada en `ENDPOINT_MAP` (`js/api.js`) y
     `ACTION_PERMISSIONS` (`js/roles.js`, permiso `serie.read` tratado como
     lectura universal igual que `docs.read` — lección de v522 aplicada
     desde el principio esta vez).
  4. Frontend `js/camara-serie.js` (módulo nuevo, mismo patrón de
     `getUserMedia`/canvas que `js/qr-scanner.js` pero captura una foto fija
     en vez de leer frames continuos) + modal HTML `#mCamaraSerie`.
  5. Botón nuevo visible tras login (`applyRoleUI()` en `js/roles.js`).

  **Hallazgos de la revisión final de rama (whole-branch), corregidos antes
  de mergear:** 1 Critical real — `functions/api/list.js` tiene su **propia
  copia independiente** de la constante `HEADERS_INV` (separada de la de
  `item.js`), y la Task 2 solo había añadido `'serie'` a la de `item.js` —
  como resultado, el campo nunca llegaba al frontend tras recargar (el
  `SELECT *` de `list.js` sí trae la columna, pero se proyecta a través de
  su `HEADERS_INV` local antes de mandarse al cliente), y peor: varias
  funciones de `js/modal-item.js` que hacen `update` con spread de una fila
  de `items` (ej. asignar un ítem a una caja/contenedor) mandaban
  `serie: undefined` → `NULL` en D1, **borrando silenciosamente el número de
  serie ya guardado**. Corregido añadiendo `'serie'` también al
  `HEADERS_INV` de `list.js`. 1 Important — `openItemRoute()` tras un match
  exacto podía fallar con "Ítem no encontrado" si el array local `items` no
  tenía aún ese ítem (creado en otra sesión tras el login); corregido
  empujando `res.item` al array `items` antes de llamar a `openItemRoute`.
  **Lección para futuras sesiones:** cuando una tabla tiene una constante
  tipo `HEADERS_INV` duplicada en más de un archivo backend (`item.js` vs
  `list.js`), un campo nuevo hay que añadirlo a AMBAS copias — ninguna
  revisión por tarea individual detecta esto si las tareas no tocan los dos
  archivos a la vez; solo la revisión final de rama lo vio. Recomendado a
  futuro: extraer `HEADERS_INV` a un módulo compartido en vez de mantener
  dos copias, o al menos dejar un comentario cruzado en cada archivo.

  **Bug de UX encontrado por el usuario ya en producción (v543, corregido
  sobre la marcha):** el botón nuevo (`#gsSerie`) y el botón de QR ya
  existente (`#gsQr`) compartían la misma clase CSS `.gsearch-qr`, con
  `position:absolute; right:52px` fijo — ambos quedaban exactamente
  superpuestos en vez de uno al lado del otro (el plan/spec nunca
  contempló que hubiera más de un botón en ese contenedor). Corregido en
  dos pasos: primero un ajuste rápido de `right` distinto para cada uno
  (insuficiente, seguía siendo confuso con dos iconos de cámara distintos
  muy juntos), y luego, a petición del usuario, un rediseño: ambos botones
  se sacaron **fuera** del cuadro de búsqueda (`.gsearch-wrap`) a una fila
  nueva `.gsearch-extra-btns` debajo, cada uno con icono + texto
  (`Escanear QR` / `Buscar por Nº de serie`), y el icono de serie cambió de
  📷 (se confundía con el de QR) a 🔢.

  **BLOQUEO grande encontrado durante la verificación en producción:
  GitHub Models fue retirado.** El plan original usaba GitHub Models
  (`https://models.inference.ai.azure.com`, mismo mecanismo que ya usaba
  `functions/api/proxy-ai.js` para el chatbot Volt desde hacía meses) para
  el OCR. Al probar en producción con una foto real (etiqueta de un router
  TP-Link, S/N `220A4S1002886`, proporcionada por el usuario), el endpoint
  devolvía `GITHUB_TOKEN no configurado en Cloudflare` — pero
  `wrangler pages secret list` confirmó que **ningún secret** estaba
  configurado en el proyecto de producción, ni siquiera para Volt (que por
  tanto llevaba tiempo roto en producción también, sin que nadie lo hubiera
  notado). Se generó un GitHub Personal Access Token nuevo y se subió como
  secret — pero siguió fallando con `non_ascii_header_value` (causado por
  cómo `Get-Content -Raw | wrangler pages secret put` en PowerShell
  manejaba el pipe; se corrigió subiendo el secret vía redirección de
  archivo `cmd /c "... < archivo.txt"` en vez de pipe). Tras corregir eso,
  el error cambió a `unauthorized` — y ahí se encontró la causa raíz real:
  **GitHub Models se retiró oficialmente el 30/07/2026**
  (`https://github.blog/changelog/2026-07-30-github-models-is-now-retired/`),
  un día antes de esta sesión. No era un problema de token, encoding, ni
  configuración — el servicio ya no existe. Afecta a **dos cosas**: esta
  feature nueva y Volt (`proxy-ai.js`), que llevaba roto en producción
  desde esa fecha sin que nadie lo detectara (nadie había usado el chat de
  Volt en ese día y medio, o el fallo pasó desapercibido).

  **Migración de proveedor — completada y funcionando.** Se migró a
  **Cloudflare Workers AI** en vez de OpenAI/Anthropic/DeepSeek — mismo
  proveedor que ya se usa para D1/Pages, tier gratuito con límite generoso
  para uso de instituto, sin necesitar ninguna cuenta ni token externo
  nuevo. `wrangler.toml` ganó un binding `[ai]`, pero **este archivo
  resultó NO ser lo que rige producción** — Cloudflare Pages con deploy
  automático vía Git no lee `wrangler.toml` para bindings de recursos, a
  diferencia de un deploy con `wrangler pages deploy` directo; el binding
  real hubo que añadirlo a mano en el dashboard del proyecto (Cloudflare
  dashboard → Workers & Pages → `boscoinventario` → Settings →
  Vinculaciones → "+ Agregar" → tipo "Workers AI" → nombre de variable
  exactamente `AI`, igual que ya existía el binding `DB` de D1 ahí mismo).

  **Recorrido completo de depuración hasta dar con la configuración que
  funciona** (útil como referencia para migrar Volt más adelante, mismo
  proveedor):
  1. Primer modelo probado, `@cf/meta/llama-3.2-11b-vision-instruct`, con
     payload `{prompt, image:[...bytes], max_tokens}` — falló primero por
     `atob()` con base64 corrupto (el archivo de request generado con
     PowerShell tenía BOM UTF-8 y una estructura JSON anidada por error de
     `ConvertTo-Json` sobre un objeto ya serializado; solución: generar el
     body con `[System.IO.File]::WriteAllText(..., New-Object
     System.Text.UTF8Encoding($false))`, sin BOM).
  2. Con el base64 limpio, ese modelo rechazó la petición porque exige
     aceptar una **licencia comunitaria de Meta que excluye explícitamente
     a usuarios domiciliados en la Unión Europea** — inválido para un
     instituto español, sin solución posible salvo cambiar de modelo.
  3. Se cambió a `@cf/moondream/moondream3.1-9B-A2B` (especializado en
     OCR/structured output según su descripción oficial, sin esa cláusula
     de exclusión geográfica) — pero con el mismo payload `{prompt, image:
     array de bytes}` dio `Type mismatch of '/image', 'string' not in
     'array','binary'`, porque **el schema de Moondream es completamente
     distinto** al de Llama Vision: no acepta un `prompt` libre, sino
     `{task: 'query'|'caption'|'point'|'detect', image: '<URL o data URI
     base64, como STRING>', question, reasoning, max_tokens}` — confirmado
     leyendo la documentación oficial
     (`https://developers.cloudflare.com/workers-ai/models/moondream3.1-9B-A2B/index.md`,
     accesible con `curl`, mucho más fiable que adivinar por prueba y
     error).
  4. Con el schema correcto, la llamada ya no fallaba (`ok:true`), pero el
     texto de respuesta venía vacío al leerlo de `aiData.answer` — Workers
     AI **envuelve la respuesta anidada** en `{result:{answer,...},
     usage:{...}}`, no la expone en la raíz del objeto devuelto por
     `env.AI.run()`. Corregido leyendo `aiData.result.answer`.
  5. Con el campo correcto, el modelo respondía JSON válido pero con
     `{"serie": null}` — no detectaba el número de serie real de la foto.
     Solución: activar `reasoning: true` (estaba en `false`) — con
     razonamiento activado, el modelo sí detectó el texto pequeño de la
     etiqueta (leyó `220A$1002886` frente al real `220A4S1002886`, un
     error de OCR menor y razonable en tipografía pequeña con caracteres
     parecidos).
  6. Verificado end-to-end en producción con una foto real (etiqueta de un
     router TP-Link Archer TX3000E) proporcionada por el usuario: el flujo
     completo cámara → foto → Workers AI → parseo → búsqueda en D1 (con
     `match:'ninguno'` correcto, ya que ningún ítem real tenía ese S/N
     guardado) funciona sin errores. Quitado el debug temporal (mensajes
     `debugRaw`/`debugFull` y el `(debug): + e.message` en el catch) una
     vez confirmado.

  **Configuración final que funciona** en
  `functions/api/item.js` (acción `buscarPorSerie`):
  ```js
  env.AI.run('@cf/moondream/moondream3.1-9B-A2B', {
    task: 'query',
    image: `data:image/jpeg;base64,${imagen}`,
    question: '...pide JSON {"serie": "VALOR"|null}...',
    reasoning: true,
    stream: false,
    max_tokens: 300
  })
  // respuesta en aiData.result.answer, NO aiData.answer
  ```

  **Volt (`functions/api/proxy-ai.js` + `js/agente-widget.js`) — también
  migrado a Workers AI y verificado, en la misma sesión.** Mismo motivo
  (GitHub Models retirado). Modelo elegido: **`@cf/zai-org/glm-4.7-flash`**
  (texto, multilingüe, function calling — se descartó Llama de Meta porque
  su licencia tiene la misma cláusula de exclusión de usuarios UE que ya
  bloqueó el modelo de visión de `buscarPorSerie`).

  **Recorrido de depuración** (Volt es más complejo que `buscarPorSerie`
  porque el frontend, `js/agente-widget.js:streamAI()`, espera streaming
  SSE real, no una sola respuesta):
  1. Primer intento: `env.AI.run(MODEL, {messages, stream:true})` devuelve
     un `ReadableStream` nativo — se escribió un `ReadableStream` custom en
     `proxy-ai.js` que traducía cada chunk al formato SSE OpenAI que el
     frontend ya parseaba (`data: {choices:[{delta:{content}}]}`). Quedó
     **colgado indefinidamente**: la conexión abría (`200 OK`,
     `Content-Type: text/event-stream`, confirmado con `curl -v`) pero
     nunca llegaban datos ni cierre. Causa: el método `pull()` del stream
     custom hacía un solo `reader.read()` por llamada y podía retornar sin
     encolar nada si ese chunk no traía contenido útil (línea vacía o el
     propio `[DONE]` de Workers AI, descartado) — el contrato de
     `ReadableStream` espera que `pull()` encole algo o cierre; si no hace
     ninguna de las dos cosas, el runtime sigue esperando.
  2. Fix: se cambió `pull()` a un `while(true)` que sigue leyendo hasta
     encolar contenido real o cerrar. **Seguía colgado.** Causa (más
     profunda, no confirmada del todo pero consistente con el síntoma): el
     stream nativo de Workers AI para modelos de texto no necesariamente
     emite líneas con el prefijo `data: ` en cada chunk de red (puede venir
     partido a mitad de un JSON entre dos `read()`), así que el filtro
     `line.startsWith('data: ')` podía descartar TODO un chunk sin nunca
     entrar a ninguna rama que decidiera encolar o seguir — el `while(true)`
     daba vueltas para siempre sin salir nunca ni fallar con un error
     diagnosticable.
  3. **Decisión: simplificar a respuesta única, sin streaming real.** Tras
     2 intentos fallidos de traducir el stream con causa no completamente
     verificable, se priorizó fiabilidad sobre la UX de escritura
     incremental: `proxy-ai.js` ahora llama a `env.AI.run(MODEL, {messages,
     max_tokens})` **sin** `stream:true` (una sola llamada, espera la
     respuesta completa) y la envuelve en un único chunk SSE seguido de
     `[DONE]` — el frontend no necesita ningún cambio porque sigue viendo
     el mismo formato, solo pierde el efecto de "escritura en vivo" (la
     respuesta de Volt aparece de golpe en vez de palabra por palabra).
  4. Con la llamada simplificada, `content` seguía vacío. Depurado
     volcando el objeto `aiData` completo: `finish_reason: "length"` con
     `message.content: null`, pero un campo `reasoning`/`reasoning_content`
     con una traza de pensamiento a medias — **GLM-4.7-Flash razona antes
     de responder por defecto, consumiendo sus propios tokens de esa
     cuota**, y con `max_tokens` bajo (el frontend manda 20-500 según el
     caso) el modelo se quedaba sin tokens a media traza de razonamiento,
     sin llegar nunca a generar el `content` real.
  5. **Fix final:** se añadió `chat_template_kwargs: {enable_thinking:
     false}` (patrón habitual para desactivar razonamiento en modelos
     GLM/Qwen) y se puso un mínimo de `max_tokens=500` como red de
     seguridad. El campo de lectura correcto es
     `aiData.choices[0].message.content` (formato OpenAI estándar para
     `env.AI.run()` sin streaming — distinto del `aiData.response` plano
     usado por otros modelos, y también distinto del `aiData.result.answer`
     anidado de Moondream; cada modelo/familia envuelve su respuesta de
     forma distinta, hay que confirmarlo con un volcado real, no asumirlo).
  6. Verificado en producción con 3 pruebas: saludo simple, pregunta
     técnica ("¿qué es un multímetro?", respuesta correcta y coherente), y
     respeto de `system` prompt (contar hasta 3 dio "1, 2, 3."). Sin debug
     residual en el código final.

  **Lección para el futuro:** si alguien quiere recuperar el streaming
  incremental de Volt, el punto de partida ya no es "cómo traducir el
  stream" sino "por qué el `ReadableStream` custom nunca emite ni cierra"
  — revisar si Workers AI expone algún ejemplo de proxy de streaming
  SSE→SSE ya hecho (la documentación de modelos de texto muestra pasar el
  stream nativo directo a `Response`, no traducirlo primero), o considerar
  si compensa el esfuerzo frente al enfoque actual de respuesta única, que
  ya funciona de forma fiable.

  **Autocompletado de marca/modelo al crear ítem desde S/N no encontrado —
  idea #2 del roadmap original, también completada en esta sesión.**
  Ampliado el mismo prompt de `buscarPorSerie` (una sola llamada a la IA,
  sin coste extra) para que además del número de serie extraiga marca y
  modelo visibles en la etiqueta. Cuando `match:'ninguno'`, la respuesta
  incluye `marca`/`modelo`, y el botón "Crear ítem nuevo" precarga además
  `f_item` (ej. "TP-Link Archer TX3000E") y `f_proveedor` (marca) en el
  modal de alta — spec en
  `docs/superpowers/specs/2026-08-01-autocompletado-marca-modelo-design.md`.
  Bug encontrado y corregido en el primer intento: el prompt usaba
  `{"serie": "VALOR o null", ...}` como plantilla de ejemplo, y el modelo a
  veces **copiaba ese texto literal** en vez de sustituirlo por el dato
  real — confirmado en producción (`serieLeida:"VALOR o null"`), rompiendo
  la lectura del S/N que antes funcionaba bien. Corregido reescribiendo el
  ejemplo del prompt con datos concretos reales (`{"serie":
  "220A4S1002886", "marca": "TP-Link", "modelo": "Archer TX3000E"}`) en vez
  de placeholders de texto, más una instrucción explícita de no copiar el
  ejemplo literalmente. **Lección de prompting reutilizable:** cuando se le
  pide a un modelo un JSON de ejemplo en el prompt, usar siempre valores
  de muestra realistas y coherentes con el dominio, nunca placeholders
  tipo "VALOR"/"XXX"/"TODO" — el modelo puede tratarlos como el resultado
  esperado en vez de como notación de plantilla. Verificado tras el fix
  con la misma foto real (router TP-Link Archer TX3000E): `serieLeida`
  volvió a leerse exacta (`220A4S1002886`, sin el error de OCR del intento
  original), `marca:"TP-Link"` y `modelo:"Archer TX3000E"` correctos.

  **Incidente de seguridad menor durante la sesión:** el primer GitHub
  Personal Access Token generado se pegó en texto plano en el chat de
  Claude Code — el usuario lo revocó y generó uno nuevo en cuanto se señaló
  el riesgo. Ninguno de los dos tokens de GitHub Models importa ya, dado
  que el servicio fue retirado, pero queda como recordatorio: **nunca pegar
  tokens/secrets en el chat**, pasarlos por un canal que no quede en el
  historial de la conversación si es posible, o revocarlos inmediatamente
  después de usarlos una vez expuestos.

  **Mejora suelta, no relacionada con la cámara, hecha en medio de la
  sesión:** el campo `fecha_adquisicion` (de la migración `0025`, sesión
  anterior) no se precargaba con ningún valor por defecto al dar de alta un
  ítem nuevo — el usuario pidió que se precargara con la fecha del día.
  Corregido en `js/modal-item.js` (línea de precarga de `f_fechaAdquisicion`
  en `openModal()`): si es alta nueva (`id` ausente), usa
  `new Date().toISOString().slice(0,10)`; si es edición de un ítem
  existente, sigue mostrando el valor guardado (o vacío si nunca se rellenó,
  sin forzar una fecha falsa).

- **01-02/08/2026 (v544-v550): cierre del roadmap "Modo Cámara
  Inteligente" — 4 piezas nuevas + cierre de las 2 ideas restantes del
  roadmap.** Continuación directa de la sesión anterior (v543, que dejó
  implementadas #1/#2/#3/#4/#8 del roadmap). Todo implementado con
  subagent-driven-development en worktrees aislados
  (`.claude/worktrees/<nombre>`), cada pieza con: brainstorming → spec en
  `docs/superpowers/specs/` → plan en `docs/superpowers/plans/` →
  ejecución por tareas con revisión individual + revisión final de rama →
  merge a `main` → deploy → verificación end-to-end en producción con
  Playwright (mocks de red para no depender de fotos reales ni del modelo
  de IA en cada verificación).

  **1. Idea #5 — Inventario andando / modo revisión rápida por aula
  (v545-v546).** Botón "📷 Revisar aula" nuevo, visible solo en vista de
  aula (`js/nav.js`, `openSub()`). Modo cámara ligero (`js/revision-aula.js`,
  mismo patrón de captura que `camara-serie.js`) que reutiliza
  `buscarPorSerie` sin cambios: por cada foto, compara el aula del ítem
  encontrado contra el aula que se está revisando — confirma en verde si
  coincide, avisa en ámbar con botón "Actualizar a esta aula" si está en
  otra (llama a la acción `update` ya existente con el patrón
  `{...item, aula: nuevaAula}`, nunca un objeto parcial). Resumen final
  efímero (solo en memoria del navegador, sin persistir "última
  verificación" en D1): confirmados vs. ítems esperados en el aula nunca
  fotografiados. **Bug real encontrado en la verificación de producción
  (no en la revisión de código):** el botón quedaba visible en TODAS las
  vistas, no solo en aula — causa raíz: `applyRoleUI()`
  (`js/roles.js:140-142`) hace un `querySelectorAll('[data-perm]')` que
  sobreescribe incondicionalmente la visibilidad de cualquier elemento con
  ese atributo, pisando la lógica condicional por `cf.type` que
  `openSub()` acababa de fijar. El botón se había creado con
  `data-perm="items.write"` copiando el patrón de sus vecinos en
  `.action-strip`, sin que ninguna revisión (ni por tarea, ni final de
  rama) lo detectara — solo apareció al probar la app real en el
  navegador. Corregido quitando `data-perm` del botón (`f6deef9`, fix
  desplegado aparte, fuera del ciclo normal de tareas). **Lección
  reutilizada en las 3 features siguientes de la sesión:** cualquier botón
  nuevo cuya visibilidad dependa de algo más que un permiso (ej. también
  de `cf.type`) NO debe llevar `data-perm` — cada plan posterior lo
  advirtió explícitamente en sus Global Constraints y cada revisión lo
  verificó como comprobación de máxima prioridad. Revisión final de rama
  encontró además 2 bugs Important reales: `functions/api/list.js` tenía
  su propia copia de `HEADERS_INV` (constante de columnas) sin las
  columnas `fecha_adquisicion`/`precio` que sí tenía la copia de
  `item.js` — mismo patrón de bug ya visto con `serie` en v543, ahora con
  columnas distintas; y `_corregirAulaRevision()` no tenía forma de
  recuperarse si el ítem detectado no estaba aún en el array `items` local
  del frontend (mismo fallo ya resuelto en v543 para el flujo general de
  cámara, no trasladado a esta feature nueva). Ambos corregidos.

  **2. Idea #6 — Multi-equipo en una foto / alta masiva (v547).** Botón
  "📸 Añadir varios" nuevo, también solo en vista de aula. Backend nuevo
  `detectarMultiples` (`functions/api/item.js`): una sola llamada a
  Workers AI pide identificar y agrupar por cantidad cada objeto distinto
  en la foto, devolviendo un array `[{nombre, cantidad,
  categoriaSugerida}]` (categoría validada contra las categorías reales
  del departamento, mismo patrón `categoriasDept` que #3). Frontend
  (`js/multi-equipo.js`) renderiza una lista editable (nombre/cantidad/
  categoría por fila, filas eliminables) antes de confirmar — sin
  búsqueda automática de duplicados por fila (la revisión humana de la
  lista ya cubre ese riesgo, evita N búsquedas D1 en serie). Confirmar
  reutiliza la acción `bulkImport` ya existente (usada por la importación
  CSV) sin modificarla, incluyendo el patrón real de refresco
  post-creación descubierto al revisar `js/import.js`:
  `items.push(...res.items)` + `renderInv()`, NO `loadData()` (que
  navegaría de vuelta a Home, UX equivocada). **Revisión final de rama
  encontró 1 Critical + 3 Important reales, todos plantados por el propio
  plan (código dado literal), no por los implementadores:** `est:
  'Operativo'` no es un estado válido en este proyecto (los reales son
  `Bueno/Deteriorado/Avería/Baja`) — cada ítem creado quedaba con un
  estado que rompía badges, filtros, y se sobrescribía silenciosamente a
  "Bueno" en la siguiente edición no relacionada; corregido a `'Bueno'`.
  `mod: ''` (sin ciclo/asignatura asignado) bloqueaba guardar el ítem
  después desde el modal normal — mismo bug ya documentado como backlog
  #11 desde la sesión de galería de fotos (ítem 225 "Estaciones
  Soldadura"), aquí lo habría reproducido en cada uso. Resuelto con una
  pieza de UI nueva no contemplada en el plan original, decidida en vivo
  con el usuario durante la revisión: selector de Ciclo/Asignatura
  compartido para todas las filas del lote, con preselección automática
  cuando el departamento tiene exactamente un ciclo con exactamente un
  módulo (mismo criterio que ya usa `openModal()` para altas individuales),
  pero siempre editable por si no aplica. Select de categoría por fila
  rompía con nombres que contienen `"` o `&` (el código intentaba marcar
  la opción sugerida con un `.replace()` de string sin escapar contra un
  HTML ya escapado — nunca coincidía); corregido construyendo el
  `<option selected>` de forma declarativa por fila en vez de post-hoc.
  Sin guardia contra doble-envío en "Crear ítems" (`bulkImport` no es
  idempotente, un doble clic crearía un lote duplicado completo);
  corregido con un flag `_multiSubmitting`, mismo patrón que
  `_multiCapturing` ya usaba la propia captura de foto.

  **3. Idea #7 — Enlaces a manual/datasheet/vídeo (v548).** La más
  simple de las 4: en el modal de editar/crear ítem, 3 enlaces junto al
  campo Proveedor ("📄 Manual", "📋 Datasheet", "🎥 Vídeo"), visibles solo
  si Proveedor + Nombre tienen contenido. Cada uno abre una búsqueda de
  Google en pestaña nueva (`proveedor + nombre + "manual pdf"` / `...
  "datasheet"` / `... "tutorial video"`), con `encodeURIComponent()`
  sobre el texto combinado. Sin backend, sin IA, sin migración —
  decisión de diseño clave que cambió por completo la estimación
  original del roadmap (que preveía "pieza nueva de infraestructura"
  asumiendo una API de búsqueda de pago o una base de enlaces curados a
  mano). Se recalculan en vivo con un listener `input` dedicado en
  `#f_proveedor`/`#f_item`, deliberadamente separado del sistema ya
  existente de detección de "cambios sin guardar" (`checkModalForChanges`)
  para no acoplar dos conceptos no relacionados. Sesión más limpia de
  las 4: ambas tareas de código pasaron revisión sin ningún hallazgo.

  **4. Mejora de #1 — Lectura de código de barras (v549).** Antes de
  enviar la foto a la IA, intenta decodificar un código de barras lineal
  (Code128/EAN/UPC) con la API nativa `BarcodeDetector` del navegador
  (sin librería nueva; sin soporte nativo —ej. iOS Safari— cae
  automáticamente al flujo actual sin cambio de comportamiento). Si
  decodifica un valor, lo busca directo en D1 sin pasar por IA (más
  rápido, sin el margen de error de OCR que ya causó un problema real en
  v543). Requirió un refactor deliberado de `buscarPorSerie`
  (`functions/api/item.js`): se extrajo la lógica de búsqueda
  exacta/fuzzy a una función compartida `buscarSerieEnD1()`, reusada
  tanto por el flujo IA existente como por la nueva acción
  `buscarSeriePorCodigo` — decisión tomada explícitamente en el diseño
  (no descubierta en una revisión) para evitar una cuarta instancia del
  mismo patrón de bug que ya había aparecido 3 veces en el proyecto
  (`HEADERS_INV` duplicado, scoping de categorías duplicado, `data-perm`
  mal copiado esta misma sesión). El refactor en sí verificado sin
  regresión (mismas formas de respuesta exacto/fuzzy/ninguno, rama
  `visual` posterior de la función intacta). **Revisión final de rama
  encontró 2 bugs Important reales en la integración nueva:** el camino
  `fuzzy` del código de barras dejaba la cámara en vivo + botón
  "Capturar" visibles y activos por encima de la lista de candidatos (el
  código nuevo se insertó ANTES de las líneas que ya ocultaban esos
  elementos en el flujo IA, sin replicar ese mismo ocultado en su propia
  rama `fuzzy`); corregido replicando el ocultado antes de mostrar
  candidatos. El `try/catch` alrededor del intento de código de barras
  envolvía también la llamada de red a `buscarSeriePorCodigo`, así que un
  fallo real de backend/sesión se camuflaba silenciosamente como "este
  navegador no soporta códigos de barras" y caía a un segundo intento
  (con IA) que fallaría por la misma razón; el fix inicial propuesto
  (dejar la llamada de red completamente sin `try/catch`) habría dejado
  colgado el flag `_serieCapturing` en `true` para siempre ante un error
  real — el implementador se desvió deliberadamente de la instrucción
  literal, ampliando en su lugar el `try/finally` externo ya existente
  (el mismo que ya protege el flujo IA) para que también cubriera el
  código nuevo, documentando el porqué; verificado en la re-revisión como
  la solución correcta.

  **5. Onboarding de las funciones de cámara (v550) — no es una función
  nueva, es hacer descubribles las 4 anteriores.** Detectado por el
  usuario tras cerrar el roadmap técnico: "hemos hecho muchas cosas con
  la cámara pero el usuario no sabe usarlas". Dos piezas: (a) tour
  guiado de 4 pantallas (#1 serie, #6 multi-equipo, #5 inventario
  andando, #3 reconocimiento visual — no las 8+, para no desanimar con
  demasiado contenido de golpe), disparado automáticamente tras el
  primer login de cada navegador (flag en `localStorage`,
  `tour_camara_visto_v1`, sin D1); (b) botón "❓" permanente junto al
  buscador de cámara en Home, con ayuda completa de las 8+ funciones
  (incluye nota explícita de que #5/#6 viven dentro de una aula, no en
  Home) y capacidad de reabrir el mismo tour bajo demanda. **Hallazgo real
  de la revisión final de rama, no contemplado ni en el spec ni en el
  plan originales:** el tour se dispara automáticamente para CUALQUIER
  usuario en su próximo login — incluido el rol `Consulta` (solo
  lectura), que no tiene permiso `items.write` y por tanto nunca ve los
  botones de #5/#6 en ninguna vista de aula. El tour le mostraba 2 de sus
  4 pantallas explicando funciones que ese usuario nunca podría usar, y
  la ayuda permanente listaba esas mismas 2 entradas sin ninguna
  condición. Corregido filtrando dinámicamente las pantallas del tour
  (`_tourPantallas = TOUR_PANTALLAS.filter(p => !p.requiereEscritura ||
  can('items.write'))`, recalculado en cada apertura, no hardcodeado por
  índice) y ocultando las 2 entradas correspondientes en la ayuda
  permanente con el mismo criterio. Ni el spec ni el plan de esta pieza
  mencionaban roles en ningún punto — atribuido explícitamente como
  defecto del diseño, no de la implementación (cada agente construyó
  exactamente lo que se le pidió). Segundo hallazgo, menor: ningún modal
  nuevo respondía a la tecla Escape, a diferencia de los ~16 modales ya
  existentes en la app (todos registrados en un único listener global en
  `js/auth.js`); corregido añadiendo ambos a esa misma cadena.

  **Patrón repetido en las 4 piezas, ya asumido como parte del proceso:**
  cada revisión final de rama (modelo más capaz, diff completo de todas
  las tareas juntas) encontró entre 1 y 4 hallazgos reales que ninguna
  revisión individual por tarea pudo ver — porque viven en la
  *intersección* de dos tareas que por separado parecían correctas
  (botón + `applyRoleUI()` global; plan con un valor de estado inventado
  + esquema real de estados; código nuevo insertado antes de líneas de
  UI que solo una rama del código nuevo replicaba; contenido de
  onboarding + sistema de permisos que nadie relacionó al diseñar el
  contenido). Ninguna de las 4 piezas se desplegó sin pasar por ese
  filtro final.

  **Pendiente explícito para la próxima sesión (pedido por el usuario,
  sin diseñar aún):** unificar los botones de "Escanear QR" (`#gsQr`,
  `js/qr-scanner.js`, ya existente antes de todo este roadmap) y "Buscar
  con la cámara" (`#gsSerie`) en Home en un solo botón — la cámara
  decidiría internamente si lo que ve es un QR, un código de barras, o
  necesita OCR de IA, en vez de que el usuario tenga que elegir de
  antemano cuál de los dos botones pulsar. Complejidad principal a
  resolver en el diseño: `js/qr-scanner.js` usa un patrón de escaneo
  continuo (frames en bucle) mientras que `js/camara-serie.js` usa foto
  fija — unificar la UX implica decidir si el nuevo botón único adopta
  uno de los dos patrones para todo, o mantiene ambos internamente según
  lo que detecte. Ver sección de Pendientes más abajo.

---

## Pendiente (Próximas sesiones)

### Unificar botones QR + cámara — ✅ implementado y verificado (02/08/2026, v551)

Home tenía dos botones separados: "Escanear QR" (`#gsQr`, escaneo continuo
con `jsQR`) y "Buscar con la cámara" (`#gsSerie`, foto fija + IA). Ahora un
solo botón "🎥 Buscar con cámara (QR o S/N)" (`#gsCamara`,
`js/camara-unificada.js`) abre un escaneo continuo único que decide
internamente qué está viendo: `BarcodeDetector` nativo con
`formats: ['qr_code','code_128','ean_13','ean_8','upc_a','upc_e']` en
cada frame, con `jsQR` como fallback condicional solo si
`BarcodeDetector.getSupportedFormats()` no incluye `qr_code` en ese
navegador. QR detectado reusa `_showQrActions()` sin cambios (vía un
wrapper `_showQrActionsStandalone()` en `js/qr-scanner.js` que solo
reabre `#mQrScanner` y delega); código de barras/S/N detectado reusa
`buscarSeriePorCodigo` sin cambios; sin detección tras ~3s, un botón
manual "No lo detecta, buscar con IA" congela el frame y entrega al
flujo `openCamaraSerie()`/`capturarSerie()` existente sin modificar.

**Riesgo de esta pieza, distinto a las 5 anteriores de la sesión:**
elimina los ÚNICOS 2 puntos de entrada existentes a QR/cámara, sin
feature flag ni entrada alternativa — a diferencia de las features
anteriores (todas aditivas, con un botón nuevo sin quitar nada). Decisión
explícita del usuario tras planteárselo en la revisión final: **`#gsQr` y
`#gsSerie` se mantienen en el DOM con `style="display:none"`** como red
de seguridad — si el flujo unificado falla en producción, reactivarlos
es cambiar un `display:none` por `display:flex` en `index.html`, sin
necesitar un deploy nuevo con `git revert`.

**Revisión final de rama encontró 3 bugs Important reales, ninguno
detectado por las revisiones por tarea:**
1. `js/roles.js` tenía entradas obsoletas `['gsQr', ...]`/`['gsSerie', ...]`
   apuntando a ids ya borrados — mismo patrón de "registro desincronizado"
   que ya causó 2 bugs reales antes en esta sesión (aunque esta vez
   inofensivo por casualidad, no por diseño: `#gsCamara` no tenía
   `display:none` inline que necesitara ser gestionado). Corregido
   reemplazando ambas entradas por una sola `['gsCamara', ...]`.
2. La rama `match:'fuzzy'` de código de barras en el flujo unificado no
   tenía botón "Reintentar" (a diferencia de `_mostrarSerieCandidatos()`
   en el flujo ya existente) y dejaba la cámara en vivo visible detrás de
   la lista de candidatos — mismo patrón de "UI no desmontada" ya visto
   con el código de barras original. Corregido añadiendo
   `camaraUnifReintentar()` (mismo patrón cierre+reapertura que
   `serieReintentar()`/`qrResumeScan()`) y ocultando el vídeo antes de
   mostrar candidatos.
3. Un fallo de red al comprobar un código detectado se ignoraba en
   silencio y, como el escaneo es continuo (a diferencia de la foto fija
   del flujo original), el mismo código seguía en el encuadre y disparaba
   la misma petición fallida en cada frame siguiente — un bucle de
   peticiones sin límite contra el backend. Corregido con cooldown de 2s
   por valor de código + un solo `toast()` de aviso por fallo real (no
   uno por frame saltado).

Verificado end-to-end en producción con Playwright (mockeando
`BarcodeDetector`/`getSupportedFormats` en el navegador, ya que el
entorno de test no tiene hardware de cámara real): QR abre panel de
acciones, código de barras exacto llama `buscarSeriePorCodigo`, fallback
a `jsQR` se activa cuando falta soporte de `qr_code`, botón de IA aparece
tras 3s y el handoff a `#mCamaraSerie` funciona (verificado aislado tras
un fallo inicial de timing en el propio script de prueba, no en la app),
caso fuzzy oculta la cámara y el botón Reintentar funciona, y
`#gsQr`/`#gsSerie` siguen en el DOM ocultos pero presentes.

### Volt (chatbot): ✅ migrado y verificado, con una limitación conocida

Detallado en la entrada de sesión del 01/08/2026 más abajo. Volt perdió el
efecto de streaming incremental (la respuesta aparece de golpe, no palabra
por palabra) tras la migración a Cloudflare Workers AI — ver la entrada de
sesión para la razón (un `ReadableStream` custom que nunca cerraba ni
emitía, causa raíz no confirmada del todo) y si alguien quiere recuperarlo
más adelante con más tiempo para depurar.

### Onboarding con rol Consulta: ✅ verificado (02/08/2026)

La sesión del 01-02/08/2026 desplegó el onboarding de cámara (v550) y
corrigió en la revisión final de rama que el tour/ayuda no debían mostrar
las 2 funciones de solo-escritura (#5/#6) al rol `Consulta`. No hay
ninguna cuenta de prueba conocida con ese rol entre las credenciales
documentadas (todas son superadmin/jefe de departamento/profesor), así
que se verificó mockeando `can()` en el navegador vía Playwright
(`window.can = perm => perm !== 'items.write'`) en vez de usar una cuenta
real — confirmado: con el mock activo, el tour muestra exactamente 2/2
pantallas (ninguna de #5/#6), la ayuda oculta ambos bloques
(`#ayudaMultiEquipo`/`#ayudaRevisionAula`); restaurando `can()` real
(sesión superadmin), ambos bloques vuelven a mostrarse correctamente —
confirma que el toggle es dinámico en ambos sentidos, sin quedar fijo en
un estado tras el primer cálculo.

### Entorno y herramientas de esta sesión (por si el PC nuevo no las tiene)

Claude Code en este PC tiene instalados los siguientes plugins/skills
(viven en `~/.claude/plugins/`, **configuración de perfil de Claude Code,
no del repo** — si el PC nuevo usa una cuenta/perfil distinto de Claude Code,
puede que no estén disponibles automáticamente y haya que reinstalarlos):
- **superpowers** (`superpowers-dev`): skills de brainstorming, writing-plans,
  subagent-driven-development, systematic-debugging, using-git-worktrees,
  code-review, etc. — usado extensamente en toda esta sesión y en las
  anteriores documentadas en este archivo.
- **caveman**: modo de comunicación ultra-comprimido (activo en esta sesión
  vía `/caveman full`).
- **supermemory**: memoria persistente cross-sesión indexada (búsqueda,
  guardado de contexto de proyecto).
- **playwright-skill**: automatización de navegador, usado en sesiones
  anteriores para verificación end-to-end en producción.
- **claude-code-plugins**: marketplace con `frontend-design` y otros skills
  de propósito general.

Credenciales/tokens usados en esta sesión que hay que tener en cuenta:
- El **GitHub Personal Access Token** generado y subido como secret
  `GITHUB_TOKEN` en Cloudflare Pages **ya no sirve para nada** (GitHub
  Models, el servicio al que apuntaba, fue retirado) — puede dejarse o
  borrarse del dashboard de Cloudflare, es indistinto.
- El **binding `AI`** de Cloudflare Workers AI (Vinculaciones del proyecto
  Pages, no un secret) es el que hay que verificar que sigue existiendo si
  algo deja de funcionar — nombre de variable exactamente `AI`.

Próximos pasos concretos (backlog general, no relacionado con lo de arriba):

1. ~~Icono de fallback del botón de easter egg~~ ✅ hecho (v486):
   sustituido por `icons/imagenbosco.png`, junto con favicon, logo de la
   barra superior y logo del login.
2. ~~Fase 3 del plan multi-departamento~~ ✅ hecho (v532): selector de
   departamento para `superadmin` en el frontend, con persistencia en
   `localStorage`; `superadmin` ya puede usar ⚙️ Gestionar
   aulas/categorías/ciclos. Campo departamento en alta de usuarios/
   profesores desde la UI ya estaba resuelto desde antes de esta sesión
   (verificado, no era un gap real).
3. Scoping por departamento de `docs.js` (documentos adjuntos) y `backup.js`.
4. Repartir credenciales (`departamentoXXX`/`profe1XXX`) a cada jefe/a de
   departamento real y comprobar que ven solo su propio inventario (más el
   compartido `iesjuanbosco`).
5. Seguridad crítica pendiente desde antes de la migración multi-departamento
   (sin relación con lo anterior): credenciales en query params, contraseñas
   sin hash — ver `docs/SECURITY.md`.
6. Ver más ideas de usabilidad sugeridas (pendientes) en
   [`docs/IDEAS.md`](docs/IDEAS.md): estado vacío por departamento, alertas
   de stock bajo, modo oscuro, índices D1, etc.
7. ~~Migración `0021_limpiar_profesores_duplicados.sql`~~ ✅ aplicada
   (v521, no-op: tabla `profesores` estaba vacía en producción).
8. ~~Devolver material: aviso de vencido, quitar `loadData()`, aviso de
   devolución parcial, recordatorio de vencidos~~ ✅ hecho (v522).
9. Recordatorio de vencidos (v522) solo actúa sobre el departamento de
   referencia del actor que visita Préstamos — un `superadmin` no dispara
   notificaciones de los otros 23 departamentos (mismo patrón de
   limitación que el resto de acciones de gestión de `superadmin`, ver
   Fase 3 más arriba). No es un bug de seguridad, es una limitación
   funcional a revisar si hace falta cobertura completa sin depender de
   que alguien de cada departamento visite la página.
10. ~~Galería de hasta 3 fotos por ítem~~ ✅ hecho (v535-v536).
11. Bug preexistente descubierto al verificar la galería de fotos (v535):
    el ítem `225` ("Estaciones Soldadura") tiene un campo `mod` que no
    corresponde a ningún ciclo/asignatura activo — `saveItem()` bloquea
    cualquier guardado de ese ítem (con o sin fotos) con un error de
    validación silencioso (el modal simplemente no se cierra, sin toast
    claro). Puede haber más ítems en la misma situación tras algún cambio
    histórico en `ciclos`/`migrations` — pendiente de auditar cuántos y
    decidir si `saveItem()` debería dar un mensaje más claro en vez de
    solo marcar el campo en rojo.
12. Rol `Consulta` (solo lectura) nunca ve la galería completa de fotos
    (solo la principal) porque `fotosGet` exige `items.write` — el
    proyecto no tiene hoy un permiso `items.read` más laxo. Deuda aceptada
    al cerrar la feature de galería (v535), revisar si conviene crear ese
    permiso más adelante.
13. ~~Fix modal ítem: solape galería/stock-strip, fecha adquisición,
    precio, sección contenedor~~ ✅ hecho (v537-v542).
14. Bug de código real en `js/modal-aulas.js:78` (`saveAulas()`): reasigna
    `orden = i` (índice del array filtrado del departamento) para TODAS
    las aulas al guardar desde ⚙️ Gestionar aulas, no solo las nuevas —
    con pocas aulas en el departamento, esto colapsa su `orden` a valores
    bajos (0, 1, 2...) que chocan con las 70 aulas globales (`orden` 1-70),
    alterando el orden de las tarjetas en el Home. Detectado en v542 cuando
    el aula de Tecnología apareció primera tras un guardado real del modal;
    corregido el dato en D1 (`UPDATE aulas SET orden=115 WHERE id='dept-
    tecnologia'`), pero el bug de código sigue sin arreglar — afecta a
    cualquier departamento con pocas aulas propias que use ese modal.

---

## Modo Ahorro de Tokens
- Respuestas cortas y directas (100-200 tokens por defecto)
- Solo archivos indicados, sin exploración automática
- Solo bloques modificados, no archivos completos
- Sin explicaciones salvo que se pidan

---

## Documentación en GitHub (`docs/`)
- `docs/PLAN_MULTIDEPARTAMENTO.md` — plan de expansión a todo el centro (estado de cada fase)
- `docs/CONTEXT.md` — contexto general del proyecto
- `docs/ARCHITECTURE.md` — arquitectura técnica, schema D1, estructura de archivos
- `docs/API.md` — endpoints del backend y variables de entorno
- `docs/BACKEND_APRENDIZAJE_INTENCIONES.md` — arquitectura del agente Volt
- `docs/SECURITY.md` — seguridad actual y pendiente
- `docs/ROADMAP.md` — hoja de ruta a corto/medio plazo
- `docs/IDEAS.md` — ideas sugeridas sin priorizar (con estado ✅/pendiente)
- `docs/DEVELOPMENT.md` — registro de sesiones de desarrollo y versionado
- `docs/MIGRACION_APACHE.md` — migración a Ubuntu + Apache + Node.js + SQLite
- `.claude/memory/` — memorias de sesiones para Claude (sincronizadas con git)
- Ver: https://github.com/slatorre-dev/boscoinventario
