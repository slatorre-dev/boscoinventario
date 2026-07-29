# Nota de Trabajo - Bosco Inventario

**Estado:** v483 | 29/07/2026 | Multi-departamento (Fases 0, 1 y 2 del plan)
completamente implementado y desplegado. Repo `slatorre-dev/boscoinventario`
en marcha, D1 propia (`boscoinventario`) con 24 departamentos + 1 genérico
compartido (`iesjuanbosco`), aislamiento real por departamento en todo el
backend, ciclos formativos/asignaturas reales sembrados para los 24
departamentos, 3 usuarios `superadmin`, cambio de contraseña obligatorio en
cuentas genéricas. Falta Fase 3 (selector de departamento para superadmin en
el frontend) — ver [Pendiente](#pendiente-próximas-sesiones) al final.

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
  (migración `0013`). Sigue pendiente sustituir el icono de **fallback**
  (usado cuando no hay departamento, hoy `icons/dept-electricidad.svg`) por
  una imagen que el usuario quiere pegar — no se ha podido aplicar aún
  porque no hay forma de extraer bytes de una imagen pegada en el chat; hace
  falta que la guarde como archivo en el repo y me diga la ruta.

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

### Fase 3 — Frontend, pendiente
- Selector de departamento visible solo para `superadmin` (hoy ve todo sin
  poder filtrar/actuar como uno en concreto).
- Alta de usuarios/profesores desde la UI no expone un campo "departamento"
  para que `superadmin` elija a qué departamento asignarlos — por ahora hay
  que hacerlo por SQL directo (`UPDATE usuarios SET departamento=? WHERE
  usuario=?`).
- Consecuencia de no tener esto: `superadmin` **no puede** usar ⚙️ Gestionar
  aulas/categorías/ciclos (bloqueado explícitamente con 403 en `config.js` —
  ver "Departamento compartido" abajo).

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
- Icono de fallback del botón de easter egg pendiente de una imagen que el
  usuario tiene que guardar como archivo (ver Fase 0 arriba).

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

js/
  agente-widget.js      — Agente Volt (NLP, chat, voz, aprendizaje)
  inventory.js          — Inventario principal, filtros, vistas, _pageSize persistente
  search.js             — Búsqueda global (#gsInput) + historial de búsquedas recientes (#srch)
  modal-item.js         — Modal edición/creación items, contenedores SET-/CONT-, renderAulaOptions(), preselección de ciclo único
  modal-ciclos.js       — Gestión de ciclos/asignaturas propios (excluye el compartido iesjuanbosco)
  modal-aulas.js        — Gestión de aulas propias (excluye globales + iesjuanbosco)
  roles.js              — Permisos por rol
  config.js             — CICLOS, AULAS, CATS (se sobreescriben con datos D1 al login, ya filtrados por departamento)
  state.js              — Estado global SESSION (departamento/departamentoNombre/departamentoIcono/passwordTemporal)
  auth.js               — Login, badge de departamento (#brandDept), icono de departamento (#deptGameIcon), cambio de contraseña obligatorio (#pForcePassword)
  prestamos.js          — Préstamos; desplegables de aula reutilizan renderAulaOptions()

sw.js                   — Service Worker, VERSION aquí (v483 actual)
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
- **30/05/2026 (v468):** servidor Apache restaurado tras 24h de caída por un
  script `observed.service` que mataba procesos de alto CPU y tumbaba
  Docker Desktop. Los 8 contenedores (apache, mysql, n8n, influxdb, nodered,
  Mosquitto, Grafana, portainer) recuperados con persistencia validada.
  Pendiente: debuguear `inventario-node` (`DB undefined` en `auth.js:13`,
  wrapper mysql2 sin inicializar) — ver detalle en DEVELOPMENT.md.

---

## Pendiente (Próximas sesiones)

Backlog corto en [`docs/ROADMAP.md`](docs/ROADMAP.md), ideas de usabilidad en
[`docs/IDEAS.md`](docs/IDEAS.md), seguridad en [`docs/SECURITY.md`](docs/SECURITY.md),
plan multi-departamento en [`docs/PLAN_MULTIDEPARTAMENTO.md`](docs/PLAN_MULTIDEPARTAMENTO.md).
Próximos pasos concretos:

1. **Icono de fallback** del botón de easter egg — pendiente de que el
   usuario guarde como archivo la imagen que pegó en el chat y me diga la
   ruta (hoy sigue siendo `icons/dept-electricidad.svg` cuando no hay
   departamento).
2. **Fase 3 del plan multi-departamento**: selector de departamento para
   `superadmin` en el frontend (con persistencia en `localStorage`); campo
   departamento en alta de usuarios/profesores desde la UI. Esto también
   desbloquearía que `superadmin` use ⚙️ Gestionar aulas/categorías/ciclos.
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
