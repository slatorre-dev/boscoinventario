# Nota de Trabajo - Bosco Inventario

**Estado:** v600 | 25/08/2026 | Multi-departamento (Fases 0-3) completo y
desplegado. Roadmap "Modo Cámara Inteligente" completo, ahora en fase de
pulido de precisión: "Añadir varios" (`detectarMultiples`) gana aprendizaje
de vocabulario del departamento (`ia_deteccion_ejemplos`), autoevaluación
de encuadre y aviso visual de filas de baja confianza (v596) — mismo gap
sigue abierto en "Revisar aula" (ver Pendiente #14). Volt migrado a
Cloudflare Workers AI. Modal Nuevo/Editar ítem mejorado (v597-v598, a
petición explícita del usuario, sin quitar campos): sección Mantenimiento
colapsable con auto-apertura si hay incidencia activa (opción "Pendiente"
renombrada a "Solicitar mantenimiento" en la etiqueta visible, mismo valor
guardado), indicador "X/18 campos completados" que además avisa cuál es
el único campo realmente obligatorio (nombre), memoria de último
Ubicación/Proveedor usado, categoría ya no se autoasigna (empieza vacía),
borrador de alta nueva en `localStorage` con oferta de restaurar, y botón
"📷 Usar cámara" junto al título para saltar del formulario manual al alta
por cámara sin perder el hueco de permisos ya validado. "Añadir varios"/
"Revisar aula" (v599) ya no exigen navegar antes a la vista de un aula
concreta — accesibles directo desde Inicio (⚡ Acciones rápidas), piden
la aula como primer paso si hace falta; "Añadir varios" además guarda
sesión en `localStorage` (sobrevive a cierres accidentales), ofrece
imprimir QR de lo recién creado y vuelve a la cámara sin cerrarse (modo
continuo, como ya tenía "Revisar aula"), y ambos muestran un contador de
progreso en vivo. Fix suelto de la misma sesión: `#mConf` (confirmDialog)
gana `z-index` propio — sin él, quedaba tapado e inaccesible si se abría
con otro modal `.mbg` posterior en el HTML ya abierto detrás (bug
preexistente, no visible hasta que el borrador de "Añadir varios" lo
disparó en pruebas). Modal manual de ítem gana botón "💾➕ Guardar y añadir
otro" (v600, solo en alta nueva) — guarda y reabre el modal en blanco sin
cerrarlo, para dar de alta varios a mano seguidos sin repetir el ciclo
completo cada vez (`saveItem(cerrarTrasGuardar)`). Otras piezas
recientes: vista global agrupada de solo lectura para superadmin en
⚙️ Aulas/Categorías/Ciclos, Mantenimiento como flujo real (tabla
`mantenimientos`, historial por ítem), Historial de ítems como timeline
estructurado, y Planificación de prácticas (reservas de material). Historial
completo sesión a sesión, con todo el
detalle técnico y las lecciones de cada bug: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)
(léelo si necesitas contexto de por qué algo se hizo así, o de un bug ya
resuelto). Este archivo es solo el estado operativo actual — no lo
narres desde cero en cada sesión, actualízalo con 2-3 frases.

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

## Cómo responder en este proyecto (ahorro de tokens)

Este CLAUDE.md se carga entero en cada turno — mantenlo así de corto y
sigue estas reglas de estilo para no gastar tokens de más:

- **No reexplores lo que ya está aquí documentado.** Arquitectura,
  credenciales, workflow, migraciones, permisos: ya están en este archivo.
  Solo léelos con Grep/Read si necesitas confirmar un detalle concreto que
  pueda haber cambiado, no para "entender el proyecto" desde cero.
- **Antes de recorrer todo el repo, comprueba si el dato ya está en
  `docs/`** (ver índice al final) — son archivos pequeños, mucho más
  baratos que grep+read de varios archivos de código.
- **No pegues código ni archivos completos en tu respuesta.** Cita
  `archivo:línea` (el editor del usuario lo abre directo) y muestra solo
  el fragmento que cambia.
- **No narres pasos internos** ("voy a explorar...", "ahora voy a
  leer..."). Una frase de qué vas a hacer, y ya. El detalle va en las
  llamadas a herramientas, no en texto.
- **No repitas el plan antes de ejecutarlo** si ya fue aprobado — ejecuta
  y resume al final.
- **Cierre de tarea: 1-2 frases**, qué cambió y qué sigue. Nada de
  resúmenes largos de "lo que hice" salvo que se pida explícitamente.
- **Agrupa llamadas a herramientas independientes** en el mismo turno en
  vez de una por una.
- **Actualiza este archivo de forma incremental.** Cuando cierres una
  sesión: añade el detalle completo a `docs/DEVELOPMENT.md` (nueva
  entrada, fecha + versión), y aquí en CLAUDE.md solo actualiza el
  párrafo **Estado** de arriba (2-3 frases) — nunca añadas una narración
  de sesión larga directamente en este archivo, por muy relevante que
  parezca. Si una sección de referencia (arquitectura, credenciales...)
  cambia, edítala in place; no dupliques con una nota histórica aparte.
- **Modo Ahorro de Tokens general** (aplica siempre, no solo a este
  proyecto): respuestas cortas y directas por defecto, sin explicaciones
  salvo que se pidan, sin exploración automática más allá de lo
  necesario para la tarea.

---

## Para retomar desde un PC nuevo

1. `git clone https://github.com/slatorre-dev/boscoinventario.git` (o `git pull` si ya existe)
2. Leer este archivo entero + [docs/PLAN_MULTIDEPARTAMENTO.md](docs/PLAN_MULTIDEPARTAMENTO.md)
3. `npx wrangler login` (interactivo, abre navegador) — la cuenta de Cloudflare que tiene acceso al D1 es `slatorre@iesjuanbosco.es`
4. Todas las migraciones (`migrations/0001` a `0026`) ya están aplicadas en la base remota `boscoinventario` — no hace falta re-ejecutarlas salvo que se recree la base desde cero (ver [Modo de Operación](#modo-de-operación)). Nota: la tabla de aprendizaje IA (`ia_deteccion_ejemplos`) se autocrea en runtime por `functions/api/item.js` (sin migración dedicada)
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

Plan completo, decisiones de arquitectura y lista de los 24 departamentos
en [docs/PLAN_MULTIDEPARTAMENTO.md](docs/PLAN_MULTIDEPARTAMENTO.md).
Fases 0-3 completas y desplegadas (rebranding, modelo de datos, scoping
backend, selector de departamento activo para superadmin). Hechos que sí
hace falta tener presentes al tocar código:

- Tabla `departamentos` (24 filas: slug, nombre, icono, color, orden).
  Columna `departamento` (slug) en `usuarios`, `aulas`, `inventario`,
  `ciclos`; `categorias` y `ciclos` con PK compuesta incluyendo
  `departamento` (evita colisión de nombres entre departamentos).
- Scoping por `departamento` (salvo `superadmin`, que ve todo) ya
  implementado en: `meta.js`, `list.js`, `item.js` (add/update/delete/
  bulkImport, verifica propiedad), `prestar.js`, `historial.js` (filtra
  por depto del **actor**), `config.js` (aulasSync/catsSync/ciclosSync/
  normalizeCategoriesTags/normalizeTagsCanonical/renameTag/deleteTag),
  `usuarios.js`, `profesores.js`. **Gaps sin scoping:** `docs.js`,
  `backup.js` — ver Pendiente #1.
- `GENERIC_DEPT = 'iesjuanbosco'` (constante duplicada en `list.js`,
  `meta.js`, `item.js`, `prestar.js`, `historial.js`): departamento
  compartido — cualquier jefe/a de departamento o profesor (no solo
  superadmin) puede ver/crear/editar/eliminar ítems ahí y hacer
  préstamos, se suma a su propio departamento sin sustituirlo.
  `js/modal-ciclos.js`/`js/modal-aulas.js` excluyen el ciclo/aula
  compartidos (y las aulas globales) de sus listas editables.
- Selector `#deptActivoSelect` (solo superadmin, persistido en
  `localStorage` `dept_activo_superadmin` — `js/config.js:deptActivo`)
  desbloquea ⚙️ Gestionar aulas/categorías/ciclos para un departamento
  concreto (`departamentoDestino` validado en `config.js`). Sin
  departamento elegido (o eligiendo `iesjuanbosco`), esos 3 modales
  muestran vista de solo lectura agrupada por departamento (v593) en vez
  de 403 — helper `deptNombre(slug)` en `js/config.js`. Alcance acotado:
  Inicio/Inventario/Préstamos siguen sin filtrar para superadmin.
- `CATS` (objeto plano `{name:{c,bg,i}}`, usado por 7 archivos) no lleva
  `departamento` por entrada a diferencia de `AULAS`/`CICLOS` — se expone
  `catsCrudo` (solo superadmin, en `meta.js`) con las filas crudas para
  filtrar sin tocar `CATS`.
- Ciclos/asignaturas: terminología "Ciclo/Departamento" y
  "Asignatura/Módulo" en toda la UI — mismo modelo de datos (`ciclos`)
  sirve para ciclos de FP y asignaturas académicas. En "Nuevo ítem", si
  el departamento tiene un solo ciclo propio se preselecciona
  automáticamente (`renderAulaOptions()` en `modal-item.js`, reusado en
  `prestamos.js`).
- Cambio de contraseña obligatorio: columna `usuarios.password_temporal`
  (48 cuentas genéricas) fuerza `#pForcePassword` al login hasta cambiar
  contraseña (`POST /api/perfil action=changePassword` limpia el flag).
- Los 3 superadmin tienen un `departamento` "de referencia" (no
  restringe nada, solo badge/base del selector): `Admin`→`iesjuanbosco`,
  `Seba`→`electricidadelectronica`, `jillescas`→`tecnologia`.
- Otros gaps conocidos: `ubicaciones` (sitios sugeridos) sigue global,
  no por departamento; `userAssignModulos` ejecutado por un `superadmin`
  solo toca ciclos de su propio departamento de referencia.

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
    vía IA, cascada + segunda pasada OCR + variantes de ambigüedad OCR + ranking visual),
    buscarSeriePorCodigo (mismo resultado sin IA, para código de barras ya decodificado
    en el cliente), detectarMultiples (alta masiva desde una foto), registrarFeedbackDeteccion
    (aprendizaje por feedback real del usuario). buscarPorSerie y buscarSeriePorCodigo
    comparten la función buscarSerieEnD1() (búsqueda exacta/fuzzy) — NO duplicar esa
    lógica si se toca alguna de las dos

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

sw.js                   — Service Worker, VERSION aquí (v557 actual)
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

## Historial de sesiones

Todo el detalle sesión a sesión (versión por versión, bugs encontrados,
lecciones operativas) vive en [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)
— no lo dupliques aquí. Resumen de las últimas piezas grandes (detalle
completo en ese archivo): vista global agrupada para superadmin en
Aulas/Categorías/Ciclos (v593), Mantenimiento como flujo real (v592),
Historial de ítems como timeline (v590), Planificación de prácticas /
reservas de material (v588), FedCM en login Google (v587), lookup de
producto por código de barras vía UPCitemdb (v578), mejora de
reconocimiento visual + rediseño Home/Inventario + crear ítem desde
búsqueda sin resultados (v560-v577), cierre del roadmap "Modo Cámara
Inteligente" — botones QR+cámara unificados, Volt migrado a Cloudflare
Workers AI, onboarding de cámara (v543-v557).

## Pendiente (próximas sesiones)

1. Scoping por departamento de `docs.js` (documentos adjuntos) y
   `backup.js` — no filtran por departamento todavía.
2. Repartir credenciales (`departamentoXXX`/`profe1XXX`) a cada jefe/a de
   departamento real y comprobar que ven solo su propio inventario (más
   el compartido `iesjuanbosco`).
3. Seguridad crítica pendiente desde antes de la migración
   multi-departamento: credenciales en query params, contraseñas sin
   hash — ver [`docs/SECURITY.md`](docs/SECURITY.md).
4. Más ideas de usabilidad sugeridas (sin priorizar) en
   [`docs/IDEAS.md`](docs/IDEAS.md): estado vacío por departamento,
   alertas de stock bajo, modo oscuro, etc.
5. Recordatorio de vencidos (v522) solo actúa sobre el departamento de
   referencia del actor que visita Préstamos — no es un bug de
   seguridad, es una limitación funcional si hace falta cobertura
   completa sin depender de que alguien de cada departamento visite la
   página.
6. ~~Ítem `225` con `mod` huérfano~~ — auditado y corregido (25/08/2026,
   migración `0029`): eran 1.205 de 1.206 ítems de
   `electricidadelectronica` con códigos de un esquema de ciclo/módulo
   anterior a la migración multi-departamento. Reclasificados a los 4
   ciclos reales (306 ítems) o dejados sin asignar por ser genuinamente
   genéricos (899: componentes sueltos, equipo compartido, mobiliario).
   `saveItem()` ya no exige `f_ciclo`/`f_mod` (25/08/2026, v595) — Ciclo y
   Módulo pasan a ser opcionales para cualquier ítem, en cualquier
   departamento. Si se guarda sin ninguno de los dos, un diálogo avisa y
   asigna automáticamente el ciclo/módulo compartido `iesjuanbosco__M01`
   ("IES Juan Bosco") en vez de dejar el campo vacío — decisión explícita
   del usuario para que todo ítem quede clasificado en algo, aunque sea
   genérico, en vez de quedar sin ningún ciclo asociado. El usuario
   reclasificará los 899 ítems de `electricidadelectronica` a su ritmo.
7. Rol `Consulta` (solo lectura) nunca ve la galería completa de fotos
   (solo la principal) porque `fotosGet` exige `items.write` — el
   proyecto no tiene hoy un permiso `items.read` más laxo.
9. Convertir la tabla `ia_deteccion_ejemplos` en migración SQL formal
   (`migrations/0027_...`) — hoy se autocrea en runtime en `item.js`.
10. Endpoint interno de métricas de calidad de cámara por departamento
    (ratio exacto/fuzzy/sin lectura, top ambigüedades OCR) usando datos
    ya capturados en `ia_deteccion_ejemplos`.
11. Limpieza programada de `ia_deteccion_ejemplos` por antigüedad,
    además del límite actual por cantidad (300/departamento).
12. Similitud visual contra fotos ya guardadas del inventario (diseñada
    a alto nivel en v560, no implementada a petición del usuario) —
    requiere generar descripciones de texto de `item_fotos` + binding
    `VECTORIZE` nuevo + Vectorize para buscar la más parecida.
13. Decidir si los títulos de producto de UPCitemdb (v578) deben
    excluirse de la tabla de aprendizaje few-shot `ia_deteccion_ejemplos`
    (riesgo de diluir la terminología propia del departamento con
    nombres de e-commerce en inglés).
14. Piezas #2 (captura de mesa) y #3 (captura de aula completa) del
    roadmap de cámara+IA iniciado en v578 — ya tienen una primera
    versión en producción (`multi-equipo.js`/`detectarMultiples`,
    `revision-aula.js`); esto es sobre *mejorar* su precisión, no
    construirlas desde cero. Pieza #2 (captura de mesa) ya recibió su
    pasada de mejora (v596, `docs/DEVELOPMENT.md`): aprendizaje de
    vocabulario del departamento (antes solo alimentaba el flujo de un
    único objeto), autoevaluación de encuadre, y aviso visual de filas de
    baja confianza en vez de descartar ese dato. **Pendiente real:** pieza
    #3 (`revision-aula.js`) reutiliza `buscarPorSerie`, que ya devuelve
    `motivoEncuadre` en la respuesta — pero el frontend de "Revisar aula"
    nunca lo muestra ni ofrece repetir foto con esa pista, a diferencia de
    `camara-serie.js` que sí lo usa. Mismo hueco de UX, sin cerrar ahí
    todavía.
15. Repetir con Playwright la verificación de producción de v578
    (prellenado visual del formulario, botón truncado en móvil) —
    quedó pendiente, no se hizo en v588 pese a tener Playwright
    disponible esa sesión.
16. Aprobación de préstamos + garantía/depreciación: descartada a
    petición del usuario (25/08/2026) — sobrecargaría al jefe de
    departamento con una tarea más. Si se retoma, debe ser **opcional**
    (activable por departamento), nunca obligatoria por defecto. La
    mitad de alertas de garantía/depreciación (sin aprobación) sigue
    siendo una idea válida e independiente.
17. Auditar si el patrón de bug encontrado en v588 (consulta D1 que liga
    un parámetro por fila de un array sin límite de crecimiento, en vez
    de un JOIN con un parámetro fijo) existe en algún otro sitio del
    backend además de los 2 ya corregidos (`list.js`, `notificarVencidos`
    en `prestar.js`) — no se ha auditado el resto del proyecto.
18. Ideas de UI de un brainstorming sin cerrar (31/07/2026), nunca
    volcadas a `docs/IDEAS.md` — algunas ya cubiertas por trabajo
    posterior (QR unificado, vencidos más visibles), otras siguen
    abiertas: panel "Hoy requiere atención" (stock bajo + vencidos +
    mantenimiento + pedidos + datos faltantes en un sitio), menú de
    acciones compacto con texto, auditoría con niveles de severidad,
    vistas de filtro guardadas ("Mis vistas"), acciones en lote con
    preview/undo, modal de ítem reorganizado por secciones, etiquetas
    de estado explícitas, microcopy en vacíos/errores, accesibilidad.

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
- `docs/HANDOFF_2026-08-02_v557.md` — traspaso operativo completo de la fase de cámara+IA (v552-v557)
- `docs/MIGRACION_APACHE.md` — migración a Ubuntu + Apache + Node.js + SQLite
- `.claude/memory/` — memorias de sesiones para Claude (sincronizadas con git)
- Ver: https://github.com/slatorre-dev/boscoinventario
