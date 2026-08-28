# Desarrollo — Bosco Inventario

Registro de desarrollo y mejoras implementadas en la aplicación.

## Sesiones de trabajo

### Sesiones 29/07/2026 → 25/08/2026 (v469 → v593) — movidas desde CLAUDE.md

_Bloque trasladado íntegro desde CLAUDE.md el 25/08/2026 para reducir el tamaño de ese archivo (que se carga entero en cada conversación). Contenido sin editar respecto al original._


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

- **25/08/2026: auditoría y reclasificación de `mod` huérfano (migración
  `0029`).** Lo que empezó como "revisar el ítem 225" (backlog desde
  v535-536) resultó ser 1.205 de los 1.206 ítems del departamento
  `electricidadelectronica` — prácticamente todo su inventario real.
  Causa: `inventario.mod` guardaba códigos de un esquema de ciclo/módulo
  anterior a la migración multi-departamento (`gs_mantelec__1058`,
  `gm_telecom__0361`, `gs_sea__0518`...) que nunca se remapeó a los 4
  ciclos reales actuales (`iea`/`it`/`mele`/`sea`, módulos `M01`-`M15`).
  Como `f_ciclo` y `f_mod` son obligatorios en `saveItem()`
  ([modal-item.js:1118-1119](../js/modal-item.js#L1118-L1119)), esto
  bloqueaba silenciosamente el guardado de cualquier ítem del
  departamento — no era un caso aislado. Los 1.205 valores se agrupaban
  en solo 44 códigos distintos (no 1.205 decisiones individuales); el
  grupo más grande (`gs_mantelec__1058`, 871 ítems) era un cajón genérico
  de componentes electrónicos sueltos sin módulo específico real.
  Mapeo hecho por Claude a partir del contenido de cada grupo (nombres de
  ítems) y la convención `gs_`=Grado Superior / `gm_`=Grado Medio del
  código viejo, sin intervención del profesorado — 306 ítems
  reclasificados a un módulo real concreto, 899 dejados sin asignar
  (`mod=''`) por ser genuinamente genéricos (el cajón de componentes,
  equipo de oficina/AV compartido, mobiliario) en vez de forzarlos a un
  módulo que no les correspondería. Backup de los valores previos
  guardado antes de aplicar (fuera del repo, scratchpad de la sesión).
  Detalle completo del mapeo grupo a grupo en
  `migrations/0029_reclasificar_modulos_electricidad.sql` (comentado por
  bloque). Verificado post-migración: 0 huérfanos restantes.
  **Pendiente real, no cerrado con esto:** los 899 ítems con `mod=''`
  siguen sin poder guardarse desde el modal individual mientras
  `saveItem()` exija `f_ciclo`+`f_mod` no vacíos — o se relaja esa
  validación para aceptar "Sin asignar", o el departamento los reclasifica
  uno a uno (ahora sí visibles como "Módulo/Ciclo faltante" en ⚙️
  Auditoría de datos, cosa que antes no pasaba porque el código viejo
  contaba como "relleno" aunque fuera basura). En paralelo, mismo
  hallazgo: la sesión también corrigió `saveAulas()`
  (`js/modal-aulas.js`) reasignando `orden=i` desde 0 para todas las
  aulas propias del departamento en cada guardado, en vez de solo las
  nuevas — colisionaba con el rango 1-70 reservado a las aulas globales
  del centro (`orden` 101+ para aulas propias, ver
  `migrations/0008_aulas_seed.sql`). `sw.js` → `v594`.

  **Cierre de sesión (v595):** a petición explícita del usuario ("lo
  reclasifico yo, no lo pongas más como error"), `saveItem()` deja de
  exigir `f_ciclo`/`f_mod` — se quitan las 2 líneas de validación
  obligatoria en `js/modal-item.js` (antes en 1118-1119). Ciclo y
  Módulo/Asignatura pasan a ser opcionales para cualquier ítem de
  cualquier departamento (ya existía la opción "Sin asignar" en ambos
  desplegables, solo no se aceptaba al guardar). Segundo ajuste, también
  pedido por el usuario en la misma sesión: en vez de dejar `mod` vacío
  sin más, si al guardar no hay ni ciclo ni módulo seleccionados aparece
  un diálogo (`confirmDialog()`, mismo patrón ya usado en el resto de la
  app) avisando que el ítem se asignará a "IES Juan Bosco", y al aceptar
  se guarda con `mod='iesjuanbosco__M01'` (el ciclo/módulo compartido ya
  existente, migración `0011`) — así ningún ítem queda sin ciclo/módulo
  en absoluto, solo sin uno específico. Cancelar el diálogo aborta el
  guardado, dando ocasión de elegir un ciclo real en vez de aceptar el
  genérico. El usuario reclasificará los 899 ítems de
  `electricidadelectronica` (dejados en `mod=''` por la migración `0029`,
  antes de este cambio) a su ritmo. `sw.js` → `v595`.

### 25/08/2026 (v595→v596): mejoras de precisión en "Añadir varios" (detectarMultiples)

A petición del usuario tras un brainstorming sobre qué falta del roadmap de
cámara+IA — de las dos funciones ya en producción que quedaban como
candidatas a "mejorar precisión, no reconstruir" (pendiente #14 de
`CLAUDE.md`), priorizó "Añadir varios" (`js/multi-equipo.js` +
`detectarMultiples` en `functions/api/item.js`) sobre "Revisar aula", con
dos síntomas concretos: objetos no detectados/mal contados, y nombres o
categorías genéricos que hay que corregir fila a fila. Tres cambios, todos
acotados a esos dos archivos, sin migración ni endpoint nuevo:

1. **Aprendizaje de vocabulario del departamento.** `detectarMultiples` no
   leía `ia_deteccion_ejemplos` — el aprendizaje por feedback (tabla
   sembrada por `registrarFeedbackDeteccion`) solo alimentaba el flujo de
   un único objeto (`buscarPorSerie`/`camara-serie.js`). Se añade la misma
   consulta (últimos 4 ejemplos del departamento) + `formatLearningExamples()`
   al prompt, y `confirmarCrearMulti()` ahora llama a
   `registrarFeedbackDeteccion` (`tipo:'alta_multi'`) por cada fila creada
   con el nombre/categoría ya corregidos por el usuario en la tabla editable
   — no el valor crudo de la IA. Como la tabla no filtra por `tipo` al leer
   los últimos 4 ejemplos, esto retroalimenta también al flujo individual
   con vocabulario visto en altas masivas, y viceversa.
2. **Autoevaluación de encuadre.** El prompt de `detectarMultiples` gana
   `encuadreOk`/`motivoEncuadre` (mismo patrón que ya tenía `buscarPorSerie`
   desde v560), pensado para el caso propio de una foto de mesa: mesa
   cortada fuera de encuadre, demasiado lejos para distinguir objetos, o
   borrosa. El motivo se muestra como toast `warn` junto a la lista
   detectada (o como único mensaje si no se detectó nada).
3. **La segunda pasada dejó de pisar la primera.** Cuando la primera pasada
   sale con confianza baja, la segunda pasada (prompt más corto, un solo
   intento) sustituía la lista entera si salía más larga — podía perder
   detecciones válidas de la primera. Ahora se unen por nombre normalizado,
   quedándose con la de mayor confianza por nombre repetido. Además, la
   `confianza` por objeto —que se calculaba pero se descartaba antes de
   responder al frontend— ahora llega a `multi-equipo.js`, que pinta de
   ámbar (con tooltip) las filas por debajo de 0.45 antes de confirmar, en
   vez de mostrarlas indistinguibles de las fiables.

Fuera de alcance a propósito (decisión explícita, no descuido): no se tocó
`revision-aula.js`, que reutiliza `buscarPorSerie` y por tanto ya recibe
`motivoEncuadre` en la respuesta pero nunca lo muestra ni ofrece repetir
foto con esa pista — mismo hueco de UX que aquí se cerró para el flujo de
mesa, pendiente de cerrar ahí. `sw.js` → `v596`. Sin migración D1.
Verificación: solo revisión de código, sin prueba con cámara real en esta
sesión (pendiente confirmar en producción con una foto de mesa real).

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

### 02/08/2026 (v560): mejora de calidad de reconocimiento visual (sin S/N)

Motivado por feedback directo del usuario tras probar la cámara: "el
reconocimiento es regular actualmente". Tres mejoras en `buscarPorSerie`
(`functions/api/item.js`) + `js/camara-serie.js`, deliberadamente sin
infraestructura nueva — ver detalle completo en
[`docs/IDEAS.md`](docs/IDEAS.md#14-mejora-de-calidad-de-reconocimiento-visual-sin-sn--implementado-02082026):
1. Autoevaluación de encuadre dentro del mismo prompt Moondream ya
   verificado (dos claves JSON nuevas, `encuadreOk`/`motivoEncuadre`) — se
   descartó explícitamente introducir `@cf/facebook/detr-resnet-50` (solo
   conoce las 80 clases de COCO, no herramientas de taller) y el modo
   `detect` de Moondream (exige nombrar de antemano el objeto a buscar,
   problema de huevo y gallina). Investigado con las docs reales de Workers
   AI antes de escribir código, para no repetir el patrón de "asumir un
   esquema y perder horas depurando" ya documentado varias veces en este
   archivo.
2. Tercera pasada dedicada a identificación de objeto cuando no hay ningún
   texto legible (antes terminaba en `match:'sin_lectura'` sin alternativa
   — mismo patrón que la pasada OCR-only ya existente, aplicado al caso
   simétrico).
3. Botón "📷 Probar otro ángulo" en resultados débiles, que conserva y
   fusiona el nombre/categoría sugeridos entre el primer y el segundo
   intento en vez de perderlos al reintentar desde cero.

Sin cambios de esquema D1, sin acción nueva registrada en `js/api.js`/
`js/roles.js` (solo amplía la respuesta ya existente de `buscarPorSerie`).
Una cuarta idea (similitud visual contra fotos ya guardadas del propio
inventario, vía Vectorize) se evaluó pero se dejó pendiente a petición
explícita del usuario — necesita un binding nuevo (mismo tipo de paso
manual en el dashboard que ya hizo falta para `AI`) y backfill con coste
de IA sobre `item_fotos`; ver punto 19 en Pendiente.

### 02/08/2026 (v561-v576): rediseño visual de Home/Inventario + captura de S/N desde el formulario

Sesión de 16 commits hecha directamente por el usuario (fuera de esta
conversación), ya pusheada a `origin/main` antes de documentarla aquí.

**Rediseño visual (14 commits `ui(...)`).** Iteración fuerte de
estilo/jerarquía visual en `css/styles.css` + ajustes puntuales de
`index.html`/`js/home.js`/`js/inventory.js`, con foco en mobile/tablet:
acciones rápidas de Home compactadas en una sola fila de iconos, cabecera y
toolbar de la subpágina de inventario reforzadas, tarjetas de inventario y
vista agrupada (categorías/tags) con más contraste, iconos de la barra
superior compactos en pantallas pequeñas (con una iteración revertida a
medio camino, `af021f9 ui(topbar): restaura vista móvil anterior`, antes de
llegar al resultado final), y ocultación del botón de presets de filtros.
Sin cambios de backend ni de datos.

**`fix(aulas): ordena aulas globales por numero` (`574adb1`).** Las 70 aulas
globales (`aula1`..`aula70`) se listaban ordenadas por la columna `orden`
tal cual, lo que no garantizaba orden numérico real. `list.js`/`meta.js`
ahora ordenan con un `CASE` que extrae el número de `aulaN` vía
`GLOB 'aula[0-9]*'` cuando aplica, y cae a `orden`/`id` para el resto (aulas
de departamento tipo `dept-tecnologia`). Nota: esto es una corrección del
`ORDER BY` de lectura, **no** arregla el bug ya documentado de escritura en
`saveAulas()` (`js/modal-aulas.js:78`, ver pendiente #14) — siguen siendo
dos problemas relacionados pero distintos.

**`feat(items): capture serial number from item form` (`7540495`).** Botón
📷 nuevo junto al campo "Nº de serie" del modal de ítem
(`btnSerieDesdeCamara` → `openCamaraSerieParaCampoSerie()`), que abre la
misma cámara de `js/camara-serie.js` pero en un modo dedicado
(`_serieDestinoFormulario`) que solo rellena el campo `f_serie` del
formulario abierto — sin buscar en D1 ni navegar a ninguna ficha, incluso
cuando la IA reconoce un S/N ya existente en otro ítem (`match:'ninguno' &&
serieLeida` también se acepta, porque para este modo el objetivo es
capturar el texto, no encontrar una coincidencia). Reusa código de
barras/OCR/candidatos fuzzy ya existentes, con render propio
(`_mostrarSerieCandidatosParaFormulario`) para el caso fuzzy.

**Regresión encontrada y corregida en la misma revisión.** El commit
anterior se editó a partir de una copia de `js/camara-serie.js` previa a las
mejoras de reconocimiento visual de v560 (mismo día, sesión anterior) —
como el nuevo modo toca varias de las mismas funciones (`_mostrarSerieError`,
`_mostrarVisualCandidatos`, `_mostrarSerieCrearNuevo`, las ramas de
`capturarSerie()`), el diff resultante **eliminó silenciosamente** el aviso
de encuadre (`motivoEncuadre`, 💡) y el botón "Probar otro ángulo"
(`_serieIntentoPrevio`) de v560, sin que nadie lo pidiera — el backend
(`functions/api/item.js`) nunca dejó de calcular `motivoEncuadre`, solo el
frontend dejó de leerlo. Detectado al revisar `sw.js` (salto de v560 a v576
sin commits intermedios documentados) y confirmado con `git show` del
commit. Restaurado en las mismas funciones, verificado que no interfiere
con el modo nuevo `_serieDestinoFormulario` (ese modo hace `return` antes de
llegar a las ramas restauradas, así que son mutuamente excluyentes por
diseño). **Lección para la próxima vez que se edite `camara-serie.js` fuera
de una sesión de Claude Code:** partir siempre de `git pull`/HEAD real antes
de editar, especialmente en un archivo que ha recibido cambios el mismo día
en más de una sesión — el propio patrón de "revisión final encuentra bugs en
la intersección de dos cambios que por separado parecían correctos", ya
documentado varias veces en este archivo, aplica igual cuando la segunda
mitad del cambio la hace un humano en vez de un agente.

### 02/08/2026 (v577): crear ítem desde la búsqueda sin resultados

Pedido directo del usuario: buscar algo que no existe (ej. "cacharro") debía
ofrecer crearlo con el nombre ya precargado. Implementado en los dos campos
de búsqueda — buscador global de Home (`js/search.js`,
`gsCrearItemDesdeQuery()`) y filtro dentro de una aula/categoría ya abierta
(`js/inventory.js`, `invCrearItemDesdeBusqueda()`) — ver detalle en
[`docs/IDEAS.md`](docs/IDEAS.md#15-crear-ítem-desde-la-búsqueda-sin-resultados--implementado-02082026).
Ambos reusan `openModal(null, {item:..., cat?:...})`, el mismo mecanismo de
precarga que ya usaba `duplicateItem()`. De paso se corrigió que el título
del modal decía "Duplicar ítem" para cualquier precarga, no solo al
duplicar — ahora distingue por si el objeto precargado trae `id` (duplicar)
o no (nombre nuevo). Sin cambios de backend ni de esquema.

### 03/08/2026 (v578): lookup de producto real vía código de barras — primera pieza del roadmap de revisión cámara+IA

Sesión iniciada como brainstorming abierto ("revisa la realización de
inventario con la cámara con IA... cómo mejorar la detección de objetos,
lector de QR y S/N, tanto a nivel de un solo aparato como en método de
captura de mesa o captura de un aula"). Se decompuso en 3 sub-proyectos
independientes por prioridad explícita del usuario: 1) detección de un solo
aparato por S/N, 2) captura de mesa, 3) captura de aula completa + revisión
de aula — cada uno con su propio spec/plan. Esta sesión solo cerró el
primero; #2 y #3 quedan para la próxima.

**Hallazgo de diseño clave:** un número de serie no es buscable en internet
(identificador único por unidad, sin base de datos pública que lo resuelva)
— lo que sí es buscable es un código de barras EAN/UPC real de producto de
consumo. Se investigó "AI Gateway Web Search" de Cloudflare (existe, pero
exige proveedor externo de pago vía proxy — rompe el patrón "solo
Cloudflare, gratis" que este proyecto mantiene a propósito desde la
retirada de GitHub Models) y se optó por una alternativa gratuita real y
acotada: **UPCitemdb** (`api.upcitemdb.com/prod/trial/lookup`, sin API key,
sin registro, ~100 consultas/día, con el riesgo conocido de que servicios
gratuitos limitados "por IP" pueden fallar en producción por el pool de IPs
compartido de Cloudflare Workers — aceptado explícitamente por el usuario
con fallback silencioso).

**Lo construido:**
1. `functions/api/item.js`, acción `buscarSeriePorCodigo`: nuevo parámetro
   opcional `formato` en la entrada; cuando `match:'ninguno'` Y el formato
   es EAN/UPC (nunca `code_128`) Y el código tiene forma numérica de 8-14
   dígitos, intenta el lookup a UPCitemdb con timeout de 4s (cubriendo
   tanto la petición como la lectura del cuerpo de la respuesta). Cualquier
   fallo colapsa silenciosamente a la respuesta ya existente, sin campo
   `producto` — el alta sigue funcionando exactamente igual que antes.
2. `js/camara-unificada.js` y `js/camara-serie.js`: ambos envían el
   `formato` detectado y, si la respuesta trae `producto:{nombre,marca}`,
   prellenan `f_item`/`f_proveedor` al abrir el modal de alta — mismo
   patrón que ya usaba el autocompletado marca/modelo por OCR (v543).
3. `js/camara-serie.js` ganó un 5º parámetro opcional `nombreProducto` en
   `_mostrarSerieCrearNuevo()`, con prioridad sobre la concatenación
   marca+modelo, sin afectar al llamante existente del flujo IA/OCR (que
   nunca pasa ese argumento).

**Proceso:** brainstorming → spec
([`docs/superpowers/specs/2026-08-03-lookup-producto-codigo-barras-design.md`](docs/superpowers/specs/2026-08-03-lookup-producto-codigo-barras-design.md))
→ plan
([`docs/superpowers/plans/2026-08-03-lookup-producto-codigo-barras.md`](docs/superpowers/plans/2026-08-03-lookup-producto-codigo-barras.md))
→ ejecución con subagent-driven-development en worktree aislado (4 tareas,
cada una con revisión individual) → revisión final de rama → merge a
`main`. La revisión final (modelo más capaz) encontró 1 hallazgo Important
real que ninguna revisión por tarea pudo ver — mismo patrón "intersección
de dos tareas" ya documentado varias veces en este archivo: la Tarea 1
truncó el título del producto a 120 caracteres pensando en el campo del
formulario, y la Tarea 3 metió ese mismo string en un botón `.btn` con
`white-space:nowrap` sin que ninguna de las dos revisiones viera el
resultado combinado — un título largo real (ej. "Apple iPhone 6, Space
Gray, 64 GB (T-Mobile)") desbordaba el botón en móvil. Corregido truncando
solo el texto visible del botón (40 caracteres), preservando el valor
completo para el campo real del formulario. Otros 4 hallazgos Minor
corregidos en el mismo pase: el backend aceptaba como "éxito" un resultado
con marca pero sin nombre (causaba que los dos frontends divergieran ante
la misma respuesta — corregido exigiendo nombre no vacío); el prellenado
programático no disparaba `_actualizarEnlacesManual()` (enlaces
Manual/Datasheet/Vídeo de v548, que dependen de eventos `input` que
`.value =` no dispara); sin validación de forma del código antes de gastar
cuota gratuita (añadido guard `/^\d{8,14}$/`); el timeout solo cubría la
cabecera HTTP, no la lectura del cuerpo de la respuesta.

**Incidente operativo durante la ejecución (no relacionado con el código de
la feature):** el subagente del bump de versión (Tarea 4) commiteó
directamente en `main` del repo principal en vez de en el worktree, pese a
instrucción explícita — mismo patrón de fallo ya documentado en las
sesiones v521/v531. Esta vez coincidió con una edición en vivo del usuario
en `index.html` (typo suelto "aña" que el usuario ya estaba corrigiendo sin
commitear) directamente en `main` mientras la sesión trabajaba en el
worktree en paralelo. Resuelto sin pérdida de datos: verificado que el
commit del usuario y su edición sin guardar eran ajenos al incidente,
`git reset --soft` solo del commit erróneo del subagente, bump de versión
rehecho a mano por el controlador directamente en el worktree (con
`git rev-parse --show-toplevel` verificado antes de commitear, dado el
historial de este fallo). De paso se encontró y limpió una corrupción
severa de `desktop.ini` de Google Drive dentro de `.git/refs`, `.git/objects`
y `.git/logs` (cientos de archivos, no solo los pocos ya documentados en
sesiones anteriores) que rompía `git log --all`/`git fsck` — limpiada con
el remedio ya documentado (`find .git -iname desktop.ini -type f -delete`).
**Lección reforzada:** el riesgo de que un subagente ignore "Work from:
&lt;worktree&gt;" y commitee en el repo principal ya se ha visto 3 veces en
este proyecto — para cambios triviales de un solo archivo (ej. bump de
versión), puede compensar que el controlador lo haga directamente en vez de
delegarlo, con revisión de todas formas.

**Verificación en producción — parcial, con gap documentado:** la skill de
Playwright que sesiones anteriores documentaron como instalada **no estaba
disponible en esta sesión/entorno** (es configuración de perfil de Claude
Code, no del repo — puede variar entre PCs/cuentas, ver sección de
herramientas más abajo). Se verificó lo que sí fue posible: `curl` directo
contra el backend ya desplegado en producción, confirmando en vivo (no solo
por inspección de código) que UPCitemdb responde correctamente desde
Cloudflare Workers con un código EAN real
(`0885909950805` → `{"nombre":"Apple iPhone 6, Space Gray, 64 GB
(T-Mobile)","marca":"Apple"}`), que `code_128` nunca dispara el lookup, que
un código no numérico tampoco, y que peticiones sin el parámetro `formato`
(compatibilidad con cualquier llamador antiguo) se comportan exactamente
igual que antes. **No verificado en esta sesión:** el comportamiento real
en navegador (que el prellenado del formulario funcione visualmente, que el
botón truncado se vea bien en móvil) — cubierto solo por las 3 revisiones
de código (por tarea + final + re-revisión), no por una prueba de UI real.
Pendiente repetir con Playwright quien tenga la skill disponible.

**Decisión de producto pendiente, señalada por la revisión final y no
resuelta esta sesión:** los títulos de producto reales de UPCitemdb (en
inglés, estilo e-commerce) ahora pueden alimentar la tabla de aprendizaje
few-shot de `buscarPorSerie` (`ia_deteccion_ejemplos`, v557) si el usuario
escanea varios códigos de barras seguidos — sin que nadie haya decidido si
eso diluye la adaptación de terminología del propio departamento que esa
tabla existe para lograr. Ver punto 20 en Pendiente.

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
  anteriores para verificación end-to-end en producción. **No disponible en
  la sesión del 03/08/2026 (v578)** pese a estar documentado aquí — confirma
  que esta lista depende del perfil/cuenta de Claude Code del PC concreto,
  no del repo; si falta, la verificación de producción cae a `curl` directo
  contra el backend (cubre lógica de servidor, no comportamiento de UI).
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

### 24/08/2026 (v577→v587): sesión hecha directamente por el usuario, sin Claude Code — FedCM en login Google + ajustes UI/UX

12 commits (10:49-12:00) hechos directamente por el usuario fuera de esta
herramienta, nunca documentados hasta ahora. Núcleo real: migración del
login con Google a **FedCM** (Federated Credential Management, el
reemplazo de Google para el login basado en cookies de terceros que los
navegadores están retirando) — 4 commits iterativos en `js/auth.js`:
activar `use_fedcm_for_button:true` → revertirlo ("restore GIS popup
compatibility") → añadir `google.accounts.id.initialize()` explícito por
JS con `ux_mode:'popup'` (quitando el bloque declarativo `#g_id_onload` de
`index.html`) → volver a activar `use_fedcm_for_button:true`, ahora sí
funcionando. Lección: FedCM y el modo popup declarativo no convivían bien
— hacía falta inicializar GIS explícitamente por JS *antes* de activar
FedCM. Resto de commits, sin relación entre sí: rebranding a "Inventario
IES Juan Bosco" (título de página), topbar/toolbar compactos en tablet (4
commits), Service Worker más seguro, unificación de campos de búsqueda de
inventario, onboarding de cámara no bloqueante, 4 columnas de aula en
tablet, accesibilidad por teclado en tarjetas de Home. Sin migración D1.

### 24/08/2026 (v587→v588): Planificación de prácticas (reservas de material) — primera pieza nueva tras investigar apps comerciales de inventario

Retomando el hilo de la sesión v578 (revisión cámara+IA), esta sesión
cambió de tema a petición del usuario: investigar apps comerciales de
gestión de inventario/activos (Snipe-IT, EZOfficeInventory, Asset Panda,
GLPI, más herramientas de reserva de laboratorio tipo Skedda/BookitLab)
para proponer mejoras nuevas — el usuario recordaba que en una
conversación anterior (perdida, nunca llegó a un archivo del repo) se
habían sugerido ideas como "planificación de prácticas" y "mejoras del
historial de ítems". Investigación + brainstorming completos vía
`superpowers:brainstorming` (clasificado como arquitectónico, con varias
rondas de `AskUserQuestion` para acotar alcance): de 4 candidatas
propuestas (planificación de prácticas, historial como timeline
estructurado, mantenimiento como flujo real, aprobación de préstamos +
garantía/depreciación), el usuario eligió centrar esta sesión solo en la
primera. El resto queda en el backlog general (ver más abajo), sin
implementar.

**Diseño acordado (spec:
[`docs/superpowers/specs/2026-08-24-planificacion-practicas-design.md`](docs/superpowers/specs/2026-08-24-planificacion-practicas-design.md)):**
reserva de un "kit" de varios ítems a la vez (ligado a un Ciclo/Asignatura,
una fecha y una franja horaria de **texto libre**) con bloqueo duro de
conflictos por coincidencia **exacta** de ítem+fecha+franja — limitación
explícitamente aceptada por el usuario a cambio de no modelar un horario
rígido de campanadas por departamento. El día de la práctica, "Confirmar
recogida" convierte el kit en préstamos reales de un clic. Sin edición de
reservas ya creadas (solo cancelar y recrear), sin aprobación previa, sin
notificación por email, sin comprobar contra préstamos activos actuales
(solo contra otras reservas pendientes del mismo hueco).

**Lo construido** (plan:
[`docs/superpowers/plans/2026-08-24-planificacion-practicas.md`](docs/superpowers/plans/2026-08-24-planificacion-practicas.md),
9 tareas + 1 ronda de correcciones, subagent-driven-development en
worktree aislado `worktree-reservas-practica`, cada tarea con revisión
individual limpia):
1. Migración `migrations/0027_reservas_practica.sql` — tablas
   `reservas_practica` (cabecera) + `reserva_items` (líneas), aplicada y
   verificada en D1 remoto.
2. Refactor `functions/api/prestar.js`: lógica de inserción en `prestamos`
   + descuento de stock, antes duplicada entre `prestar`/`prestarCaja`,
   extraída a `crearPrestamoDesdeLinea()` compartida — sin cambio de
   comportamiento, verificado con revisión dedicada.
3-4. Acciones nuevas `reservaCrear` (valida disponibilidad de TODAS las
   líneas antes de escribir nada, bloquea kits multi-departamento incluso
   para `superadmin`), `reservaConfirmar` (reusa el helper del punto 2),
   `reservaCancelar` (soft-cancel, nunca borra, por trazabilidad).
5. `functions/api/list.js` incluye `reservas` (con líneas anidadas) en la
   carga general, mismo scoping por departamento que `prestamos`.
6. Registro de las 3 acciones en `js/api.js`/`js/roles.js` (permiso
   `loans.write`) + estado global `reservas` en `js/state.js`/`js/auth.js`.
7. Frontend nuevo `js/reservas-practica.js` + modal `#mReservaPractica`:
   botón "📅 Planificar práctica" en Préstamos, lista editable de ítems
   (mismo patrón que `multi-equipo.js`).
8. Vista "📅 Ver reservas" (toggle, mismo patrón que el de vencidos ya
   existente) con "Confirmar recogida"/"Cancelar".
9. Bump de versión (v588).

**Revisión final de rama (modelo más capaz, diff completo de las 9 tareas
juntas) — el hallazgo más serio de todas las sesiones documentadas en este
archivo hasta la fecha:** `functions/api/list.js` cargaba las líneas de
cada reserva con `WHERE reservaId IN (?,?,?...)`, **un parámetro ligado
por cada reserva** — D1 tiene un límite duro documentado de **100
parámetros ligados por consulta**. Como las reservas en estado `recogida`
se retienen para siempre (nunca se filtran de esa carga, solo `cancelada`
se excluye) mientras que el frontend solo pinta las `pendiente`, cada
reserva confirmada queda como peso muerto que sigue consumiendo un hueco
de parámetro — la combinación de esas dos decisiones (cada una razonable
por separado, ninguna tarea individual lo vio) garantizaba que
`functions/api/list.js` **reventara para todo el departamento** (y mucho
antes para `superadmin`, sin filtro de departamento) en cuanto se
acumularan ~100 reservas no canceladas — dejando `loadData()` con
`items`/`prestamos`/`profesores` vacíos, "Error cargando inventario" para
TODA la app, no solo para reservas. Corregido sustituyendo el `IN()` por
un `JOIN` con un único parámetro ligado, movido dentro del `Promise.all`
ya existente. **Lección reforzada para el futuro:** cualquier consulta que
ligue un parámetro por fila de un array que puede crecer sin límite (no
solo IDs de un lote conocido de antemano) es un riesgo de límite de
plataforma, no solo de rendimiento — revisar esto explícitamente en
futuras revisiones de código que toquen D1.

Otros 5 hallazgos Important corregidos en el mismo pase (todos
intersección de dos tareas que por separado parecían correctas, patrón ya
documentado muchas veces en este archivo): franja horaria ligada sin
recortar en la consulta de conflictos mientras el valor guardado sí se
recortaba (bypasseaba en silencio el bloqueo — el propio objetivo de la
feature); líneas duplicadas del mismo ítem en una reserva podían
sobre-reservar sorteando el chequeo (arreglado agregando cantidad por
ítem antes de comprobar disponibilidad); sin guardia anti-doble-envío en
"Confirmar recogida"/"Cancelar" (doble clic descontaría stock dos veces —
mismo patrón ya arreglado una vez en `multi-equipo.js`, v547); el archivo
nuevo `js/reservas-practica.js` no estaba en la lista de precache del
Service Worker, y `filterProfSelect()` (función YA compartida por los dos
modales de préstamo preexistentes) pasó a depender de una variable de ese
archivo sin comprobar que existiera — un fallo de red al cargar ese único
archivo nuevo habría roto también los dos flujos de préstamo antiguos; los
3 `auditLog()` nuevos escribían el ID de la reserva en la columna que
`functions/api/historial.js` trata como ID real de ítem de inventario —
las entradas de auditoría de una reserva aparecían en el historial de un
ítem de inventario con el mismo número, autorizadas contra el
departamento de ESE ítem (fuga de información entre departamentos).
1 hallazgo Important resuelto como decisión de producto (ruling del
controlador, no un bug de código: el plan mandaba literalmente este
comportamiento): `reservaConfirmar` marcaba la reserva como `recogida`
aunque fallaran TODAS las líneas, dejándola inrecuperable (no hay edición
de reservas) — corregido para que solo pase a `recogida` si al menos una
línea tuvo éxito, si no queda `pendiente` para reintentar.

**Verificación end-to-end en producción con Playwright** (disponible en
esta sesión): login real, creación de reserva de kit vía UI, bloqueo de
conflicto confirmado con mensaje exacto de cuánto stock libre queda,
confirmado que franja distinta NO bloquea (limitación documentada, no
bug), "Confirmar recogida" verificado contra D1 real (stock descontado
exactamente lo prestado), "Cancelar" verificado (estado `cancelada` en
D1), regresión de préstamo normal (no vía reserva) confirmada sin cambios
tras el refactor del punto 2. Datos de prueba limpiados de producción al
terminar (préstamos de test devueltos, filas de reserva de test
borradas, stock restaurado al valor original).

**Incidente operativo — bloqueo de autenticación de wrangler:** el
subagente de la Task 1 (migración D1) quedó `BLOCKED` porque su sandbox
aislado no tenía sesión de `wrangler` ni `CLOUDFLARE_API_TOKEN` — y la
propia sesión del controlador tampoco la tenía cacheada en este PC/perfil.
El usuario ejecutó `npx wrangler login` en su propia terminal (necesario:
el flujo OAuth con callback a `localhost` no se puede completar desde una
herramienta de Bash no interactiva) y el controlador retomó desde ahí,
aplicando y verificando la migración directamente. **Corrupción de
`desktop.ini` de Google Drive dentro de `.git/`** reapareció también en
esta sesión (287 archivos esta vez, bloqueando `git fetch`) — mismo
remedio ya documentado (`find .git -iname desktop.ini -type f -delete`).

**Decisión de proceso explícita del controlador (documentada como ruling
en el ledger de la sesión, no en el código):** el paso final del plan
("Task 9") incluía literalmente `git push origin main` y verificación en
producción — el controlador partió esa tarea en dos: el bump de versión
se ejecutó como una tarea normal dentro del worktree (revisada como
cualquier otra), pero el push real a `origin/main` y la verificación en
producción se hicieron aparte, DESPUÉS del merge a `main` local y CON
confirmación explícita del usuario antes de tocar el remoto — coherente
con que un push a una rama compartida nunca debe hacerlo un subagente sin
supervisión.

### 24-25/08/2026 (v588→v592): fix suelto de reservas + Historial de ítems como timeline estructurado + Mantenimiento como flujo real — 2ª y 3ª ideas del brainstorming de v588

Continuación directa de la sesión anterior (v588), en la misma
conversación.

**Fix suelto, sin relación con las 2 piezas grandes de abajo (v589→v591).**
Dos correcciones pequeñas hechas directamente por el controlador (sin
worktree, cambio trivial): 1) franja horaria pasa de obligatoria a
opcional al planificar una práctica (`functions/api/prestar.js`,
`index.html`, `js/reservas-practica.js`) — a petición del usuario,
sin cambiar el resto del diseño de reservas de v588. 2) Auditoría del
patrón de bug encontrado en v588 (una consulta D1 que liga un parámetro
por fila de un array sin límite de crecimiento): se encontró y corrigió
un segundo caso real, `notificarVencidos` en `prestar.js`, que hacía
`UPDATE ... WHERE id IN (?,?,?...)` con un parámetro por préstamo vencido
sin notificar — mismo riesgo de reventar el límite de 100 parámetros de
D1 si un departamento acumulaba muchos vencidos sin que nadie visitara
Préstamos. Corregido con una subquery de parámetros fijos, mismo patrón
que la corrección de v588 en `list.js`.

**Las 2 piezas grandes de la sesión, cada una con su propio
brainstorming → spec → plan → subagent-driven-development en worktree
aislado → revisión final de rama → merge local a `main`:**

**1. Historial de ítems como timeline estructurado (v588→v590).** El log
por ítem (`functions/api/historial.js?itemId=`) pasa de un resumen de
texto genérico ("Item actualizado: X") a mostrar diff campo a campo
(`Aula: X → Y`) para los 8 campos clave (`item`, `aula`, `cat`, `mod`,
`qty`, `min`, `est`, `loc`). Sin migración D1: el diff se guarda como JSON
en la misma columna `resumen` de siempre (`functions/api/item.js`,
`computeItemDiff()`, comparando la fila vieja — ya leída para este
propósito — contra la nueva tras el `UPDATE`), y el frontend
(`js/modal-item.js`, `openHistorial()`) detecta si `resumen` es ese JSON
o texto plano, con fallback intacto para las miles de filas antiguas. La
vista general de historial (`js/modal-historial.js`, todas las acciones
del centro) queda deliberadamente fuera — solo la vista por ítem muestra
el diff.

Spec:
[`docs/superpowers/specs/2026-08-24-historial-timeline-design.md`](docs/superpowers/specs/2026-08-24-historial-timeline-design.md),
plan:
[`docs/superpowers/plans/2026-08-24-historial-timeline.md`](docs/superpowers/plans/2026-08-24-historial-timeline.md)
(2 tareas). Un implementador con modelo económico (haiku) sufrió un fallo
de persistencia de escritura (Edit/Write reportaban éxito pero los
cambios no llegaban al disco del worktree) — sin causa raíz confirmada,
resuelto reintentando con un modelo más capaz (sonnet), que desde
entonces se usó como modelo por defecto para implementadores en el resto
de la sesión. La revisión final de rama (modelo más capaz) encontró 2
hallazgos Important reales, ambos corregidos antes de mergear: 1) faltaba
el bump de versión del Service Worker — con `js/modal-item.js` servido
cache-first, usuarios ya instalados habrían seguido viendo el backend
nuevo (que ya escribe JSON) con el frontend viejo (que no lo detecta),
mostrando JSON crudo en vez de texto legible; 2) la vista general de
historial, aunque explícitamente fuera de alcance para renderizar el
diff, nunca se protegió contra recibirlo — mostraba JSON crudo para
cualquier fila `update`, contradiciendo la propia justificación de la
spec de mantener esa vista en texto plano. Corregido con un resumen corto
tipo "N campos modificados: Aula, Cantidad" reutilizando las mismas
etiquetas ya definidas para la vista por ítem.

**2. Mantenimiento como flujo real (v591→v592).** `item.mant` (checkbox +
4 campos planos, con `mantEstado` ya como `<select>` de 4 opciones fijas —
más built-out de lo que el backlog original describía) pasa a un flujo
con historial completo: tabla nueva `mantenimientos`
(`migrations/0028_mantenimientos.sql`, una fila por incidencia:
apertura/cierre/coste/responsable/notas), y los 6 campos `mant*` de
`inventario` (incluye `mantCoste` nuevo) pasan a ser un espejo puro
calculado siempre por el backend (`syncMantenimiento()` en
`functions/api/item.js`, llamada tras el `INSERT`/`UPDATE` genérico de
`add`/`update`, reutilizando la misma lectura de fila vieja ya añadida
para el historial-timeline). 5 estados: `Pendiente`/`En reparación`/
`Enviado a reparar externo` (abiertos) + `Reparado`/`Resuelto` (cierran,
exigen fecha+nota de cierre obligatoria — validada tanto en frontend como
rechazada en backend si el `mantEstado` no es uno de los 5 válidos).
Frontend: un único desplegable de estado sustituye al checkbox+select
antiguo, con campo Coste nuevo y campos de cierre condicionales; historial
de incidencias de solo lectura cargado bajo demanda
(`mantenimientosGet`, mismo patrón de `fotosGet`). Bulk-edit pierde la
opción "Quitar mantenimiento" (cerrar sin nota ya no tiene sentido con
coste/historial de por medio).

Spec:
[`docs/superpowers/specs/2026-08-25-mantenimiento-flujo-real-design.md`](docs/superpowers/specs/2026-08-25-mantenimiento-flujo-real-design.md),
plan:
[`docs/superpowers/plans/2026-08-25-mantenimiento-flujo-real.md`](docs/superpowers/plans/2026-08-25-mantenimiento-flujo-real.md)
(4 tareas). La revisión de la Task 2 (backend) encontró 1 hallazgo
Important real: `syncMantenimiento` no hacía nada si `mantEstado` llegaba
con un valor fuera de los 5 válidos (typo, dato corrupto), dejando ese
valor basura ya escrito en `inventario` por el `UPDATE` genérico sin
corregir — el endpoint es una API JSON plana, alcanzable directamente sin
pasar por el desplegable del frontend. Corregido rechazando la petición
con un helper `isValidMantEstado()` antes de cualquier escritura. La
revisión de la Task 3 (formulario) encontró otro hallazgo Important real:
los 3 campos nuevos (`f_mantCoste`/`f_mantFechaCierre`/`f_mantNotaCierre`)
no se habían añadido a las listas de seguimiento de cambios del modal
(`captureModalOriginalValues`/`attachModalChangeListeners`/
`checkModalForChanges`) ni a la de modo solo-lectura
(`setItemModalReadonly`) — editar solo esos campos no disparaba el aviso
de "cambios sin guardar", y quedaban editables para un rol sin
`items.write`. La misma Task 3 también encontró y corrigió por su cuenta
(autodisclosed, no pedido en el plan) una referencia colgante al checkbox
`f_mant` ya eliminado en `js/qr-scanner.js` (acción rápida "Mantenimiento"
del panel QR).

**Incidente operativo — límite de gasto mensual de la cuenta.** A media
Task 3, tras el primer fix, el implementador (subagente) chocó con
`"You've hit your monthly spend limit ... resets 10pm (Europe/Madrid)"`
— un límite duro de cuenta, no un error transitorio, que bloquea el
despacho de subagentes (`Agent`/`Task`) hasta esa hora. A petición
explícita del usuario de seguir en vez de esperar al reset, el resto de
la sesión se hizo con el controlador implementando y autorrevisando
directamente en el worktree (sin despachar subagentes): el fix de la
Task 3, la Task 4 completa, y la revisión final de rama — encontrando en
esa autorrevisión el mismo tipo de hallazgo que ya había aparecido en la
sesión de historial-timeline (versión de Service Worker sin subir),
corregido igual (v591→v592). Antes de mergear a `main`, el controlador
preguntó explícitamente al usuario si prefería esperar al reset para una
revisión final independiente con subagente — el usuario prefirió mergear
ya, confiando en la autorrevisión dado que cubrió expresamente el mismo
patrón de fallo (bugs en la intersección de tareas) que las revisiones de
rama de este proyecto llevan meses documentando. **Lección para la
próxima sesión:** si vuelve a aparecer este límite, no reintentar el
despacho de subagentes a ciegas (es un límite de cuenta, no un fallo de
red) — confirmar con el usuario si prefiere esperar al reset o seguir con
el controlador implementando directamente.

### 25/08/2026 (v592→v593): vista global agrupada de aulas/categorías/ciclos para superadmin

Fix de UX pedido directamente por el usuario tras la sesión anterior, sin
brainstorming previo de una sesión distinta — mismo hilo de conversación.
Queja real: sin elegir un departamento en `#deptActivoSelect`, los 3
modales de gestión (⚙️ Aulas/Categorías/Ciclos) daban 403; eligiendo uno
concreto, solo se veía/editaba ESE departamento, lo cual era limitante
para tener una vista de conjunto del centro. Clasificado inicialmente como
arquitectónico (tocaba directamente la zona de código que ya había
causado el bug de duplicación de aulas, v499-501) hasta que el usuario, en
la primera pregunta de brainstorming, eligió la opción más segura: **vista
de solo lectura**, no edición multi-departamento real — lo que redujo el
alcance a un cambio bounded, sin tocar el mecanismo de guardado
(`aulasSync`/`catsSync`/`ciclosSync` siguen intactos, "reemplazo completo
de un departamento a la vez").

**Comportamiento nuevo:** `isSuperAdmin && (!deptActivo || deptActivo ===
'iesjuanbosco')` → los 3 modales muestran las filas de TODOS los
departamentos, agrupadas por nombre real (helper nuevo `deptNombre(slug)`
en `js/config.js`), sin controles de edición/importar/guardar — "Exportar
CSV" se mantiene activo y gana una columna Departamento para que el
volcado completo tenga sentido. Elegir un departamento concreto sigue
comportándose exactamente igual que antes (Fase 3, v532).

Implementado directamente por el controlador (sin worktree, cambio
acotado a `js/modal-aulas.js`/`js/modal-cats.js`/`js/modal-ciclos.js` +
`index.html` + `css/styles.css` + `js/config.js`), verificado con
`node --check` en los 4 archivos JS y lectura completa del diff — **sin
Playwright disponible en esta sesión**, así que no se probó en un
navegador real antes de desplegar; pendiente de verificación visual por
el usuario.

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
  15. Convertir la tabla `ia_deteccion_ejemplos` en migración SQL formal
    (`migrations/0027_...`) para evitar dependencia de autocreación runtime
    en `item.js` y dejar el esquema auditado/reproducible desde cero.
  16. Añadir endpoint interno de métricas de calidad de cámara (por
    departamento): ratio exacto/fuzzy/sin lectura y top ambigüedades OCR,
    usando los datos ya capturados en `ia_deteccion_ejemplos`.
  17. Añadir limpieza programada (o por acción manual en Config) de
    `ia_deteccion_ejemplos` por antigüedad además del límite por cantidad,
    para controlar crecimiento en centros con uso intensivo de cámara.
  18. Evaluar uso opcional de ejemplos visuales reales (`imagen_base64`) en
    prompts future-proof de `buscarPorSerie` (ahora se usa few-shot textual
    por coste/latencia; la imagen queda guardada para iteración posterior).
  19. Similitud visual contra fotos ya guardadas del inventario (evaluada y
    diseñada a alto nivel en la sesión de v560, no implementada a petición
    explícita del usuario). Cloudflare Workers AI no tiene embeddings de
    imagen nativos — la vía realista es generar una descripción de texto de
    cada foto de `item_fotos` (una vez, en background) y usar Vectorize para
    buscar la más parecida a la descripción de una foto nueva. Requiere: (a)
    binding `VECTORIZE` nuevo en el dashboard de Cloudflare Pages (mismo tipo
    de paso manual que ya hizo falta para `AI`, ver más abajo), y (b) decidir
    el alcance/coste del backfill inicial sobre las fotos ya existentes
    (pueden ser cientos, cada una con su llamada a IA para generar la
    descripción a indexar) antes de arrancarlo.
20. Decidir si los títulos de producto reales de UPCitemdb (sesión v578, ver
    detalle arriba) deben excluirse de la tabla de aprendizaje few-shot
    `ia_deteccion_ejemplos` — hoy se guardan igual que cualquier alta manual,
    con el riesgo de diluir la adaptación de terminología del departamento
    con nombres de e-commerce en inglés si se escanean varios códigos de
    barras seguidos. Opciones sobre la mesa: tag distinto (`tipo:
    'alta_desde_codigo'`) excluido del `SELECT` de ejemplos, o dejarlo tal
    cual a propósito.
21. Piezas #2 (captura de mesa) y #3 (captura de aula completa + revisión de
    aula) del roadmap de mejora cámara+IA iniciado en la sesión v578 —
    priorizadas por el usuario en ese orden, sin diseñar aún. Nota: #2
    (captura de mesa/multi-objeto) y #3 (aula completa) YA tienen una
    primera versión en producción desde antes (`multi-equipo.js`/
    `detectarMultiples` y `revision-aula.js` respectivamente, ver
    Arquitectura de archivos clave) — esta pieza pendiente es sobre
    *mejorar* la precisión de detección de esas dos, no construirlas desde
    cero.
22. Repetir la verificación de producción de la sesión v578 con Playwright
    en cuanto la skill esté disponible en el PC/cuenta que retome el
    trabajo — quedó pendiente el comportamiento real de UI (prellenado
    visual del formulario, que el botón truncado se vea bien en móvil).
    Nota: Playwright SÍ estuvo disponible en la sesión del 24/08/2026
    (v588), pero esa verificación se centró en la feature nueva de esa
    sesión (reservas), no se aprovechó para repetir esta pendiente de v578.
23. 3 ideas del brainstorming de la sesión v588 (24/08/2026) — el usuario
    eligió centrar esa sesión solo en "planificación de prácticas" (ver
    entrada de sesión más arriba), retomadas en la sesión del 24/08/2026
    (v589-v591):
    - ~~**Historial de ítems como timeline estructurado**~~ ✅ hecho
      (v588→v590, ver entrada de sesión "Historial de ítems como timeline
      estructurado" más abajo).
    - ~~**Mantenimiento como flujo real**~~ ✅ hecho (v591→v592, ver
      entrada de sesión "Mantenimiento como flujo real" más abajo).
    - **Aprobación de préstamos + alertas de garantía/depreciación:**
      descartada a petición explícita del usuario (25/08/2026) — cualquier
      paso de aprobación previa por jefatura sobrecargaría al jefe de
      departamento con una tarea más, y ese no es el problema que se
      quería resolver. Si se retoma en el futuro, debe ser **opcional**
      (activable por departamento), nunca obligatoria por defecto. La
      mitad de alertas de garantía/depreciación (sin aprobación) sigue
      siendo una idea válida e independiente, no descartada.
24. Considerar si el patrón encontrado en la sesión v588 (una consulta D1
    que liga un parámetro por fila de un array sin límite de crecimiento,
    en vez de un JOIN con un parámetro fijo) existe en algún otro sitio
    del backend además del ya corregido en `list.js` — no se auditó el
    resto del proyecto en busca de la misma clase de bug, solo se corrigió
    donde la revisión final de rama lo encontró.

### 25/08/2026 (v593→v594): fix de `saveAulas()` colapsando el orden de aulas propias

Bug de código conocido desde v542 (documentado ahí, nunca corregido):
`saveAulas()` en `js/modal-aulas.js` reasignaba `orden = i` (empezando en
0) a **todas** las aulas propias del departamento en cada guardado desde
⚙️ Gestionar aulas, no solo a las nuevas. Las 70 aulas globales usan id
`aulaN` con `orden` 1-70 (`migrations/0008_aulas_seed.sql`), y las aulas
propias se sembraron con `orden` 101+ precisamente para aparecer después
de las globales — el `ORDER BY` de `meta.js`/`list.js` compara ambos
valores en la misma escala numérica
(`CASE WHEN id GLOB 'aula[0-9]*' THEN ... ELSE orden END`). Con la base 0,
cualquier departamento que guardara desde ese modal veía sus aulas propias
reordenadas al principio de la lista, intercaladas con `aula1`/`aula2`/
`aula3`, en vez de al final. Corregido cambiando `a.orden = i` por
`a.orden = 101 + i` — mismo offset que usa el seed original, preserva el
reordenado manual (▲/▼) porque sigue derivándose del índice del array tras
mover filas. Sin migración: los datos ya afectados en producción se habían
corregido a mano en D1 en su momento (ver nota de v542), este cambio solo
evita que el guardado vuelva a romperlo. `sw.js` → `v594`.

---

### Sesión 02/08/2026 — Hardening cámara+IA + feedback learning (v552→v557)

#### Objetivo
- Consolidar el modo cámara para uso real en taller con profesorado no técnico.
- Subir precisión IA sin proveedor adicional ni coste extra (Cloudflare-only).
- Cerrar ciclo de mejora con aprendizaje desde decisiones reales de usuario.

#### Cambios por versión
- **v552** (`3dc9cba`): robustez de flujo cámara y apertura de ítems/candidatos.
- **v553** (`d167317`): claridad UX, se explicita que cámara también permite alta.
- **v554** (`b5517d4`): mejoras para usuario novel (linterna, quick mode, accesibilidad, hint).
- **v555** (`9621d06`): doble pasada OCR, variantes OCR y mejor frame de captura.
- **v556** (`5b1eba0`): guía visual y capa de confianza IA para decisiones seguras.
- **v557** (`9d2c456`): aprendizaje por feedback real persistido en backend.

#### Implementación técnica de v557
- Backend (`functions/api/item.js`):
  - Acción nueva `registrarFeedbackDeteccion`.
  - Tabla autocreada `ia_deteccion_ejemplos`.
  - Retención: últimos 300 ejemplos por departamento.
  - Reuso de ejemplos recientes en prompt de `buscarPorSerie` (few-shot textual).
- Frontend:
  - `js/camara-serie.js`: envío automático de feedback en puntos clave:
    `exacto_auto`, `exacto_confirmado`, `fuzzy_seleccionado`, `texto_libre`,
    `alta_desde_serie`, `alta_desde_visual`.
  - `js/api.js`: registro de acción `registrarFeedbackDeteccion`.
  - `js/roles.js`: permiso de acción ligado a `serie.read`.
- Deploy:
  - `sw.js` actualizado a `v557` para cache-bust.

#### Resultado
- La app ya no depende solo de prompt estático: incorpora señal real de uso.
- La precisión puede seguir mejorando sesión a sesión con datos del propio centro.

#### Deuda técnica abierta
- Formalizar migración SQL para `ia_deteccion_ejemplos` (ahora runtime).
- Añadir métricas agregadas de calidad por departamento.
- Definir limpieza por antigüedad para dataset de feedback.

### Sesión 27/05/2026 — Inventario agrupado por tags + normalización D1 (v424→v435)

#### Topbar y despliegue
- **v424-v425** Botón `Instalar` del topbar en modo icono para escritorio/PC (ahorro de espacio)
- **v426-v435** Incrementos sucesivos de `sw.js` para cache-bust en cada publicación

#### Inventario: agrupación visual para reducir ruido
- **v426** Vista agrupada al abrir inventario (sin búsqueda):
  - Consumibles agrupados por categoría
  - Grupos colapsados por defecto
  - Inventariables en bloque separado
- **v427-v428** Refinado visual de tarjetas de grupo y densidad para escritorio
- **v429** Subagrupación por tags dentro de cada categoría consumible (grupos plegables)
- **v430** Normalización de tags en agrupación visual:
  - Insensible a mayúsculas/minúsculas
  - Insensible a tildes
  - Singular/plural básico
- **v431-v432** Ajustes de ergonomía:
  - Eliminado botón “ver más” en subgrupos
  - Tarjetas de tags menos compactas
  - Fijado a 6 tags por fila en PC
- **v433** Inventariables también subagrupados por tags

#### Normalización avanzada de tags por familia
- **v434** Agrupación por familia raíz de tag para casos como:
  - `ruedas`, `ruedas goma`, `ruedas coche` → `ruedas`
  - Manteniendo deduplicación y visual homogénea

#### Persistencia en D1 (limpieza histórica real)
- **v435** Nueva acción backend para normalizar tags guardados en D1 (no solo vista):
  - Endpoint/action: `normalizeTagsCanonical` en `functions/api/config.js`
  - Mapeada en `js/api.js`
  - Protegida por permisos en `js/roles.js`
  - Lanzable desde UI en modal de categorías (`index.html` + `js/modal-cats.js`)
- Resultado:
  - Limpieza histórica item por item en D1
  - Unificación de variantes repetidas
  - Recarga automática de items/tags en cliente tras ejecutar

### Sesión 27/05/2026 — Historial visual + limpieza topbar (v417→v423)

#### Página de historial visual
- **v420** Nueva página `pHistorialPage` — timeline agrupado por día con avatares de color (verde=añadido, azul=editado, rojo=eliminado, amarillo=préstamo, gris=devolución, morado=sistema), frase natural "Juan editó **Multímetro #3**", hora a la derecha
- **v420** Botón "📋 Historial" en panel de acciones rápidas de la home (solo admin/superadmin/seba)
- **v421** Click en fila del historial con itemId: navega directamente al modal del ítem via `openItemRoute()`. Hover muestra fondo azul y flecha `→`. Préstamos/devoluciones/importaciones no son clicables.
- **v417-v419** Feed de actividad en home (chips de pulso) — descartado por estética, reemplazado por la página de historial

#### Limpieza topbar
- **v422** `conn-status`: eliminado texto "Sincronizado/Conectando", queda solo el punto de color. El texto pasa a `title` (tooltip al hover). Botón QR del topbar eliminado (duplicado del QR en buscador)
- **v423** Botón recargar 🔄 eliminado — F5 cumple la misma función

---

### Sesión 25/05/2026 — Usabilidad tablet/móvil + Volt NLP (v379→v390)

#### Fixes tablet/móvil
- **v380** `getInvRenderMode()`: en tablet con `view='list'` devolvía siempre 'cards' — corregido
- **v381** CSS: `.tw{display:none!important}` en `@media(pointer:coarse)` ocultaba la tabla en tablets — override con `min-width:640px`
- **v382** Toast préstamos vencidos: 2.5s (antes 5s), 11px, opacity 0.82
- **v383-v384** Icono logout: `⏻` (U+23FB, sin soporte Android) → SVG inline flecha salida; 20px en táctil
- **v386** `loan-banner` oculto en móvil/tablet táctil — el toast ya avisa al inicio

#### Mejoras inventario
- **v385** Botón Imprimir del topbar llamaba a `openPrintModal()` → ahora `openPrintChoiceModal()` (normal + QR)
- **v387** `saveItem()`: al editar ítem llama `renderInv()` en vez de `openSub()` — filtros y página del inventario se mantienen tras guardar

#### Mejoras Volt (v388-v390)
- `SINONIMOS`: tabla 17 entradas (multímetro↔polímetro, osci→osciloscopio, fuente→fuente de alimentación…)
- `applySinonimos()`: expande keywords con alias antes de buscar
- `extractKeywords()`: pasa por `textToNumber()` — "dos osciloscopios" funciona
- `searchInventoryCandidates()`: fuzzy por prefijo común ≥4 chars
- Formulario préstamo: aviso `ag-loan-stock-warn` en tiempo real ("⚠ Quedarán N uds.")
- Voz fix duplicado Android: `_voiceSent` + `sessionCommitted` en closure propio evitan doble envío

---

### Sesión Mayo 2026 — Sesión 1 (v128→v133)

#### 1. Gestión de Tags (v129)
- Nueva variable `TAGS` para gestionar tags dinámicos
- Modal de categorías mejorado con sección de tags
- Autocompletado con dropdown real (no solo datalist)
- Tags se detectan automáticamente al escribir

#### 2. Permisos y Roles Fix (v130)
- Agregado `ubicacionesSync` a ACTION_PERMISSIONS
- Expandidos alias de roles ('jefe', 'professor')

#### 3. Búsqueda e Inventario Mejorada (v131)
- Búsqueda ampliada: ref, tags, proveedor, ubicación
- Nuevo filtro por tipo_material (Consumibles/Inventariables)

#### 4. Modal de Items — Tags (v131)
- Dropdown de tags con 8 sugerencias
- Validación: `cleanTag()` (sin espacios dobles, sin caracteres especiales)
- Detección automática de nuevos tags

#### 5. Modal de Items — Foto Mejorada (v131)
- Preview aumentado a 120px
- Viewer fullscreen al hacer click

#### 6. Mejora de Impresión (v132)
- Etiquetas QR: grid de 2→4 columnas
- Tamaño: 52mm→40mm altura, QR 30mm→20mm
- Modal con dos opciones: Etiquetas completas + Códigos QR solo

#### 7. Fix Modal de Impresión (v133)
- `openPrintModal()` usa `getFiltered()` sin depender de contexto
- Funciona desde home, aula, categoría, etc.

### Sesión Mayo 2026 — Sesión 2 (v134→v139)

#### 8. Separación de Modales de Impresión (v134→v137)
- Modal `mPrint` para inventario (checkboxes de columnas)
- Modal `mPrintQr` para QR (opciones de formato)
- Botón "Imprimir QR" abre el modal QR
- Botón "🖨️ Imprimir" abre modal de inventario

#### 9. Actualización Placeholder de Búsqueda (v138)
- Texto: "Buscar por nombre, ref, tags, ubicación, proveedor…"

#### 10. Indicador de Cambios Sin Guardar (v139)
- Puntito rojo (●) en título cuando hay cambios
- Confirmación "¿Descartar cambios?" al cerrar
- Detecta cambios en todos los campos
- Se resetea al guardar o cerrar

### Sesión Mayo 2026 — Sesión 3 (17/05/2026, v139→v147)

**Features sin documentar en commit inicial:**
- Función `showHistorialButton()` en roles.js (muestra botón de historial)

### Sesión Mayo 2026 — Sesión 4 (Continuación, v147→v158)

#### 11. Sistema de Auditoría e Historial de Cambios (v147→v156)
**Archivos nuevos:** `functions/api/historial.js`, `js/modal-historial.js`, `js/audit-log.js`

**Funcionalidad:**
- Endpoint `/api/historial` para obtener registro de cambios de items
- Modal para visualizar quién cambió qué y cuándo
- Campos registrados: usuario, item_id, campo modificado, valor anterior, valor nuevo, fecha
- Auditoría resiliente: no bloquea si falla el logging
- Control de acceso: visible solo a admins/jefes (inicialmente restrictivo, luego relajado)

**Notas técnicas:**
- `logItemAction()` registra cambios desde cliente
- Se llama automáticamente al guardar item
- Tabla `log` en BD almacena historial
- Ordenado por fecha (cambios más recientes primero)

#### 12. Fixes en Modal de Item (v155)
- **Cierre forzado:** Modal se cierra automáticamente después de guardar
- **Prompt evitado:** Resetea `modalHasChanges` tras guardado exitoso
- Evita confirmaciones innecesarias y modal desincronizado

#### 13. Mejoras en Control de Acceso (v153)
- Relajado: inicialmente solo jefe departamento, ahora más usuarios pueden ver historial
- Basado en roles y permisos existentes

#### 14. Bulk Inventory Actions (v158)
**Archivos:** `js/inventory.js`, `js/modal-item.js`, `index.html`

- Acciones en lote sobre múltiples items
- Probables acciones: cambiar estado, categoría, cantidad en bulk
- UI para seleccionar múltiples items
- Registra cambios en auditoría

#### 15. Easter Egg: Pac-Man Game (v150)
- Juego de Pac-Man del departamento (feature decorativa)

#### Estado actual
- **Versión SW:** v158
- **Nuevos archivos:** 3 (historial API + modals)
- **Nuevas tablas BD:** log (auditoría)

## Mejoras Implementadas

### Funcionalidad ✅
- [x] Historial de cambios — Auditoría completa (v147→v156)
- [x] Bulk inventory actions — Acciones en lote (v158)
- [x] Indicador de cambios sin guardar (v139)
- [x] Mejora de búsqueda con tags, ubicación, proveedor (v131)
- [x] Gestión de tags dinámica (v129)

## Mejoras Pendientes

### Funcionalidad
- [ ] Alertas de stock bajo — Banner/notificación más visible
- [ ] Filtro por mantenimiento pendiente — Botón rápido
- [ ] Búsqueda avanzada con filtros combinados
- [ ] Reporte de stock por categoría/aula
- [ ] Notificaciones en tiempo real
- [ ] Merge/consolidar items duplicados
- [ ] Control de acceso por aula (restringir a aula específica)

### Optimización
- [ ] Lazy loading de imágenes
- [ ] Caché inteligente
- [ ] Compresión de imágenes automática
- [ ] Paginación en listados >1000 items
- [ ] Indexación/búsqueda rápida
- [ ] Code splitting
- [ ] Debounce en búsqueda
- [ ] Web Workers para operaciones pesadas

## Notas Técnicas

### Arquitectura
- Service Worker con estrategia cache-first para SHELL
- D1 (Cloudflare) como base de datos
- Google Sheets para algunos datos (profesores, ubicaciones)
- PWA con manifest.json

### Campos detectados en item
```
ref, aula, item, foto, qty, min, tipo_material, cat, ciclo, mod, loc, 
est, util, proveedor, tags, fecha, mant, mantFecha, mantEstado, mantResp, 
mantNota, obs, es_contenedor, parent_id
```

### Tags
- Almacenados en memoria en variable `TAGS`
- Se cargan desde items al iniciar app
- Validación: máx 50 caracteres, sin caracteres especiales, acentos españoles preservados

### Búsqueda
- Campos incluidos: nombre, ref, tags, ubicación, proveedor, aula
- Búsqueda en tiempo real (sin debounce actualmente)

## Commits Recientes

**Sesión 2 (v134→v139):**
```
76145f9 — Add unsaved changes indicator in item modal (v138→v139)
6b95c3f — Update search placeholder to show all searchable fields (v137→v138)
bae6c39 — Fix: Remove duplicate openPrintModal/closePrintModal (v136→v137)
be4f995 — Fix: Imprimir QR button opens QR print modal (v135→v136)
8fd7454 — Separate print inventory and print QR modals (v134→v135)
```

**Sesión 4 (v147→v158):**
```
edb9817 — Add simple bulk inventory actions (v157→v158)
a880dbe — Include actor and item details in audit log (v156→v157)
13305b5 — Log item actions from client (v155→v156)
422ac4f — Make item audit logging resilient (v154→v155)
13856aa — Force close item modal after save (v154→v155)
f62cc3f — Avoid unsaved prompt after item save (v154→v155)
2e6fa5d — Include item actions in history (v153→v154)
1b1c577 — Improve history modal usability (v152→v153)
10320bf — Relax history access check (v151→v152)
193b15e — Fix audit history viewer (v150→v151)
45418d0 — Add department Pac-Man game (v149→v150)
```

## Estado de esa sesión (v158)

**Completado en esta sesión:**
✅ Auditoría e historial de cambios (una de las mejoras sugeridas)
✅ Bulk inventory actions (acciones en lote)
✅ Mejoras en UX (cierre automático de modal, prompt mejorado)
✅ Control de acceso al historial (relajado inicialmente)

**Próximos Pasos:**

1. **Performance & Auditoría:**
   - Considerar índices en tabla `log` si crece (campos: item_id, fecha, actor)
   - Limpieza de logs antiguos si es necesario
   - Paginación en historial si hay muchos cambios por item

2. **Bulk Actions:**
   - Completar UI para selección múltiple
   - Pruebas de rendimiento con muchos items
   - Feedback visual durante acciones en bulk

3. **Mejoras Sugeridas Pendientes:**
   - Alertas de stock bajo (banner en home)
   - Filtro por mantenimiento pendiente
   - Búsqueda avanzada con filtros combinados
   - Lazy loading de imágenes

4. **Documentación:**
   - Actualizar documentación de API (endpoints nuevos)
   - Documentar tabla `log` en schema
   - Guía de uso del historial para usuarios

---

## Sesión Mayo 2026 — Sesión 5 (v159→v166) — Auditoría de Datos

### Contexto
Se requería una herramienta para identificar y limpiar items con campos incompletos. El inventario tenía ~969 items con problemas en campos críticos (módulo, aula, categoría, etc.).

### Archivo Nuevo: `js/modal-auditoria.js`

#### Funcionalidad Principal
- Modal para auditar integridad de datos del inventario
- Identifica items con campos faltantes (5 campos críticos + 3 secundarios)
- Sistema dual de filtrado + agrupación
- Integración con bulk edit existente
- Control de acceso: requiere permiso `config.manage`

#### Variables de Estado
```js
let auditoriaData = [];              // items con problemas
let auditoriaFiltroActual = 'all';   // filtro: 'all' | 'cat' | 'mod' | 'aula' | 'ref' | 'loc' | 'proveedor'
let auditoriaSeleccionados = new Set(); // IDs de items seleccionados
let auditoriaAgrupar = 'none';       // agrupación: 'none' | 'cat' | 'aula'
let gruposColapsados = new Set();    // grupos colapsados
```

#### Campos Auditados
```js
const CAMPOS_CRITICOS = [
  { key: 'cat',  label: 'Categoría' },
  { key: 'mod',  label: 'Módulo/Ciclo' },
  { key: 'aula', label: 'Aula' },
];

const CAMPOS_SECUNDARIOS = [
  { key: 'ref',       label: 'Referencia' },
  { key: 'loc',       label: 'Ubicación' },
  { key: 'proveedor', label: 'Proveedor' },
];
```

#### Funciones Principales

**1. `openAuditoriaModal()` / `closeAuditoriaModal()`**
- Abre/cierra modal con validación de permisos
- Control z-index para layering correcto

**2. `cargarAuditoria()`**
- Carga datos desde array global `items`
- Analiza cada item buscando campos faltantes
- Inicializa tabla y filtros
- Renderiza con filtro actual

**3. `getItemProblemas(item)`**
- Devuelve array de etiquetas de campos faltantes
- Verifica campos vacíos o solo espacios

**4. `renderAuditoria(filtro)`**
- Router principal que delega a vista apropiada
- Actualiza contadores de filtro
- Muestra información contextual

**5. `renderAuditoriaFilas(items)`**
- Renderiza tabla normal sin agrupación
- Cada fila: checkbox, ref, nombre, aula, categoría, problemas, acción

**6. `renderAuditoriaAgrupada(items)`**
- Renderiza grupos colapsables
- Estructura: cabecera de grupo + filas del grupo
- Checkbox de grupo: selecciona/deselecciona todos
- Toggle colapso con click en cabecera
- Mostra contador de items en grupo

**7. `agruparAuditoria(modo)`**
- Cambia modo de agrupación
- Limpia estado colapsado (expande todos)
- Actualiza botones activos
- Redibuja tabla

**8. `getGrupos(items)`**
- Agrupa items por campo seleccionado
- Ordena grupos por cantidad de items (descendente)
- Items sin el campo de agrupación van a grupo final: "(Sin aula)" o "(Sin categoría)"
- Retorna array de pares [clave, items[]]

**9. `toggleGrupoAuditoria(key)`**
- Toggle estado colapsado de un grupo
- Muestra/oculta filas del grupo con `display:none`
- Actualiza símbolo: ▼ (expandido) / ▶ (colapsado)

**10. `seleccionarGrupo(key, checked)`**
- Selecciona/deselecciona todos los items de un grupo
- Actualiza `auditoriaSeleccionados`
- Redibuja tabla

**11. `filtrarAuditoria(filtro)`**
- Cambia filtro activo
- Actualiza botones activos
- Redibuja tabla

**12. `toggleAuditoriaItem(itemId)`**
- Selecciona/deselecciona item individual
- Muestra/oculta botón de edición en lote
- Redibuja

**13. `updateFiltroButtons()`**
- Calcula contador para cada tipo de problema
- Actualiza texto de botones: "Sin módulo (245)"
- Se ejecuta al cargar datos

**14. `abrirItemParaEditar(itemId)`**
- Abre modal de edición de item (sin cerrar auditoría)
- **Fix z-index:** aumenta z-index del modal auditoría a 500 antes de abrir item
- Al cerrar modal de item, restaura z-index a 501
- Permite navegar entre items sin perder contexto de auditoría

**15. `editarSeleccionados()`**
- Prepara edición en lote de items seleccionados
- Llena Set global `bulkSelected` con IDs
- Cierra modal de auditoría
- Muestra barra de bulk actions
- Integración con sistema existente de inventory.js

**16. `seleccionarTodos()`**
- Selecciona/deselecciona todos los items visibles (filtrados)
- Toggle: si todos seleccionados → deselecciona; si no → selecciona

**17. `escapeHtml(text)`**
- Sanitiza HTML para evitar XSS
- Usa `textContent` + `innerHTML`

---

### Cambios en `index.html`

#### Botón de Acceso
Añadido en menú Departamento:
```html
<button class="dept-menu-item" id="btnAuditoriaDept" data-perm="config.manage" 
        onclick="closeDeptMenu();openAuditoriaModal()">
  🔍 Auditoría de datos
</button>
```

#### Modal HTML Completo
```html
<div class="modal-backdrop" id="mAuditoriaBackdrop" onclick="closeAuditoriaModal()">
  <div class="modal" id="mAuditoria">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--border)">
      <h2 style="margin:0">🔍 Auditoría de Datos</h2>
      <button class="close-btn" onclick="closeAuditoriaModal()">✕</button>
    </div>

    <!-- Filtros y Agrupación -->
    <div id="auditoriaFiltros" style="margin-bottom:20px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
      <!-- Filtros de campos -->
      <span style="color:var(--muted);font-size:12px">Filtrar por:</span>
      <button class="abtn active" onclick="filtrarAuditoria('all')">Todos</button>
      <button class="abtn" onclick="filtrarAuditoria('cat')">Sin categoría</button>
      <button class="abtn" onclick="filtrarAuditoria('mod')">Sin módulo</button>
      <button class="abtn" onclick="filtrarAuditoria('aula')">Sin aula</button>
      <button class="abtn" onclick="filtrarAuditoria('ref')">Sin referencia</button>
      <button class="abtn" onclick="filtrarAuditoria('loc')">Sin ubicación</button>
      <button class="abtn" onclick="filtrarAuditoria('proveedor')">Sin proveedor</button>
      
      <!-- Separador -->
      <span style="color:var(--muted);font-size:12px;margin-left:4px">Agrupar por:</span>
      
      <!-- Agrupación -->
      <button class="abtn active" id="audGrpNone" onclick="agruparAuditoria('none')">Sin agrupar</button>
      <button class="abtn" id="audGrpCat" onclick="agruparAuditoria('cat')">Categoría</button>
      <button class="abtn" id="audGrpAula" onclick="agruparAuditoria('aula')">Aula</button>
    </div>

    <!-- Información y controles -->
    <div id="auditoriaInfo" style="margin-bottom:12px;font-size:13px;color:var(--text)"></div>
    
    <div style="margin-bottom:12px;display:flex;gap:8px">
      <button class="btn-primary" id="audSelAll" onclick="seleccionarTodos()" style="display:none">
        ☑️ Seleccionar todos
      </button>
      <button class="btn-accent" id="audEditMult" onclick="editarSeleccionados()" style="display:none">
        ✏️ Editar seleccionados
      </button>
    </div>

    <!-- Tabla -->
    <div style="max-height:calc(100vh - 320px);overflow-y:auto;border:1px solid var(--border);border-radius:6px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--surface2);sticky:top:0">
            <th style="padding:8px;text-align:center;width:32px">☑</th>
            <th style="padding:8px;text-align:left;min-width:80px">Ref</th>
            <th style="padding:8px;text-align:left;min-width:150px">Nombre</th>
            <th style="padding:8px;text-align:left;min-width:80px">Aula</th>
            <th style="padding:8px;text-align:left;min-width:100px">Categoría</th>
            <th style="padding:8px;text-align:left;min-width:200px">Campos faltantes</th>
            <th style="padding:8px;text-align:center;width:90px">Acción</th>
          </tr>
        </thead>
        <tbody id="auditoriaTbody"></tbody>
      </table>
    </div>

    <div id="auditoriaEmpty" style="padding:40px;text-align:center;color:var(--muted);display:none"></div>
  </div>
</div>
```

---

### Cambios en `js/modal-item.js`

#### Fix: Unsaved Changes Warning (v166)

**Problema:** Al navegar entre items en auditoría, el flag `modalHasChanges` persistía, mostrando falsa alarma de "cambios sin guardar"

**Solución:** Resetear flag al inicio de `openModal()`:
```js
function openModal(id) {
  // ... código existente ...
  eid = id;
  fillModalSelects();
  
  // NUEVO: Reset change detection para item nuevo
  modalHasChanges = false;
  updateModalIndicator();
  
  // ... resto del código ...
}
```

**Ubicación:** Al comienzo de la función, tras `fillModalSelects()`

---

### Cambios en CSS (`styles.css`)

Añadidas clases para auditoría (aplicadas inline en HTML):

```css
/* Modal auditoría ancho */
#mAuditoria .modal {
  width: 1200px;
  max-width: 100vw;
}

/* Tabla scrolleable */
#mAuditoria table {
  width: 100%;
  border-collapse: collapse;
}

#mAuditoria th, #mAuditoria td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

/* Badges de problemas */
.problemas-badge {
  background: var(--red-bg, #ffe0e0);
  color: var(--red);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  display: inline-block;
}

/* Header de grupo colapsable */
.auditoria-group-header {
  background: var(--surface2);
  cursor: pointer;
  font-weight: 600;
}

.auditoria-group-header:hover {
  background: var(--surface3);
}

/* Toggle collapso */
.group-toggle {
  font-size: 12px;
  color: var(--muted);
  user-select: none;
}
```

---

### Service Worker Update

Versión bumped de v158 → v166 en `sw.js` para forzar recarga de caché:

```js
const VERSION = 'v166';
```

**Cambios por versión:**
- v159: Auditoría básica + filtros
- v160: Fix z-index modal edición
- v161: Fix bulk edit integration
- v162: Fix agrupación items sin campo
- v163: Añadir columna categoría
- v164-165: (reservadas)
- v166: Fix unsaved changes warning

---

### Bugs Encontrados y Solucionados

| Bug | Versión | Causa | Solución |
|-----|---------|-------|----------|
| Datos no cargan | v159 | Variable `INVENTORY` equivocada | Usar `items` |
| Modal edición detrás de auditoría | v160 | z-index no configurado | Manipular z-index dinámicamente |
| Bulk edit no funciona | v161 | Llamada a función no existente | Integrar con sistema existente |
| Agrupación mezcla items sin campo | v162 | Lógica de agrupación incorrecta | Separar en grupo final "(Sin aula)" |
| Falta columna categoría | v163 | Columna no añadida a HTML/render | Añadir th y td |
| Falso aviso "cambios sin guardar" | v166 | Flag `modalHasChanges` no reseteado | Resetear al abrir nuevo item |

---

### Flujo de Uso Completo

1. **Acceso** → Menú Departamento → "🔍 Auditoría de datos"
2. **Cargar datos** → Se analizan ~969 items, se detectan problemas
3. **Filtrar** → Seleccionar campo problemático: "Sin módulo"
4. **Agrupar** → "Agrupar por Aula" → items organizados en grupos
5. **Seleccionar** → Clickear grupo o items individuales
6. **Editar** → Opción A: editar en lote (bulk); Opción B: editar individual
7. **Guardar** → Cambios se registran en auditoría automáticamente

---

### Características

✅ **Implementadas:**
- Modal amplio (1200px) con scroll
- Tabla con 7 columnas (checkbox, ref, nombre, aula, categoría, problemas, acción)
- Filtrado por 7 tipos de problemas
- Agrupación por categoría o aula
- Grupos colapsables con toggle
- Checkbox de grupo para selección masiva
- Edición individual sin cerrar modal
- Edición en lote con bulk actions existente
- Contador de items problemáticos
- Contador de items seleccionados
- Integración total con sistema existente
- Z-index correcto para modales superpuestos

⏳ **Backlog:**
- Indicador visual de progreso
- Marcar grupos como completados
- Vista estadística inicial (reporte de problemas)
- Filtros AND/OR combinados
- Exportar reporte CSV/PDF

---

### Commits Relacionados

```
7815642 Update IDEAS.md with audit UX improvements backlog (v166)
5c5117b Fix unsaved changes warning when opening new item from audit modal (v165→v166)
[anteriores: commits de auditoría v159→v165]
```

---

### 25/08/2026 (v596→v597): modal "Nuevo/Editar ítem" — completitud, mantenimiento colapsable, memoria de ubicación/proveedor y borrador de alta

Sesión pedida explícitamente por el usuario tras una revisión de código/UX
general del proyecto (sin cambios en esa parte, solo conversación) — el
foco se centró en el modal de alta/edición de ítem, con la premisa
explícita del usuario de **no quitar ni ocultar campos** ("todos los
campos son necesarios"). Cuatro piezas, todas en `js/modal-item.js` +
`index.html` + `css/styles.css`, sin cambios de esquema D1:

1. **Sección MANTENIMIENTO ahora colapsable** (`<details>`, mismo patrón ya
   existente en `mSecDetalles`/`mSecDocumentacion`/`mSecContenedor`) — se
   abre sola solo si el ítem editado ya tiene mantenimiento activo
   (`isMaintenanceMarked(m) || m?.mantEstado`), igual que las otras
   secciones. En una alta nueva queda plegada, reduciendo la pantalla
   inicial sin eliminar el campo.
2. **Indicador "X/18 campos completados"** en la cabecera del modal
   (`#mCompletion`, HTML nuevo en `.mh`), con barra de progreso fina.
   `updateModalCompletion()` cuenta 18 campos "core" de la ficha (no
   incluye mantenimiento/contenedor, condicionales por naturaleza) y se
   recalcula en cada tecleo reutilizando el listener que ya existía para
   detectar cambios sin guardar (`checkModalForChanges()`).
3. **"Recordar el último valor" ampliado a Ubicación y Proveedor**
   (`localStorage` `cam_last_loc`/`cam_last_proveedor`), mismo patrón ya
   usado para aula/categoría (`cam_last_aula`/`cam_last_cat`) — solo aplica
   a altas nuevas en blanco, nunca sobrescribe un valor real al editar o
   duplicar.
4. **Borrador de alta nueva en `localStorage`** (`item_draft_new_v1`) — solo
   para "Nuevo ítem" en blanco (`_isBlankNewItemSession`, no aplica a
   duplicar/prefill desde cámara o búsqueda sin resultados). Se guarda en
   cada tecleo, se ofrece restaurar (`confirmDialog`) al reabrir "Nuevo
   ítem" si hay uno pendiente, y se borra al guardar con éxito o al
   confirmar el descarte de cambios desde `closeM()`.

Refactor de acompañamiento: las 3 copias literales del array de 26 campos
del modal (`captureModalOriginalValues`, `attachModalChangeListeners`,
`checkModalForChanges`) se unificaron en una sola constante
`MODAL_TRACKED_FIELDS` — mismo patrón de duplicación ya señalado como
problema en `docs/ROADMAP.md` (ahí a nivel de modales completos, aquí solo
este array concreto).

**Verificación:** sin entorno D1/wrangler disponible en esta sesión (sandbox
sin red), así que se sirvió el frontend con `python3 -m http.server` y se
condujo con Playwright/Chromium headless, invocando `openModal()` real con
estado global mínimo simulado (`SESSION`/`AULAS`/`CICLOS`/`CATS`/`items`
asignados por variable suelta, no `window.X=`, porque son `let` de scope de
script — asignar a `window.X` no los toca). Casos probados end-to-end sin
errores de consola: alta nueva con secciones plegadas correctamente,
edición de un ítem con avería activa (Mantenimiento se autoexpande),
edición de un ítem sin incidencias (permanece plegada), guardado real
(`apiPost` interceptado) confirmando que ubicación/proveedor quedan en
`localStorage` y se precargan en la siguiente alta, y el ciclo completo de
borrador: guardar al teclear → descartar con confirmación → sin diálogo de
restauración si no hay borrador → diálogo de restauración con el borrador
correcto → campos repoblados. `sw.js` → `v597`.

### 25/08/2026 (v597→v598): feedback directo sobre la pieza anterior — 5 ajustes al modal de ítem

Continuación en la misma sesión, tras probar la v597 el usuario pidió 5
cambios concretos, todos en `js/modal-item.js`/`index.html`/`css/styles.css`:

1. **Opción "Pendiente" → "Solicitar mantenimiento"** en el desplegable de
   Estado de mantenimiento — solo cambia la etiqueta visible
   (`<option value="Pendiente">Solicitar mantenimiento</option>`), el valor
   guardado sigue siendo `"Pendiente"` a propósito (evita tocar los ~8
   archivos que ya comparan/muestran ese valor literal: `inventory.js`,
   `search.js`, `agente-widget.js`, `import.js`, `qr-scanner.js`).
2. **"Reparado"/"Resuelto" sin sentido en alta nueva** — señalado por el
   usuario, dejado tal cual a petición explícita ("déjalo de momento").
3. **Botón "📷 Usar cámara" junto al título** del modal (`#btnUsarCamaraAlta`,
   visible solo si `_isBlankNewItemSession`) — `usarCamaraParaAlta()` pide
   confirmación si hay cambios sin guardar, limpia el borrador si aplica,
   cierra el modal (`closeM(true)`) y abre `openCamaraUnificada()` (mismo
   botón que ya existía en Home). Verificado con Playwright que la llamada
   directa deja el modal de cámara con `open` — en el sandbox de esta
   sesión se cierra solo ~150ms después porque no hay cámara real
   disponible (comportamiento preexistente de `openCamaraUnificada()`
   ante el fallo de `getUserMedia`, no un bug nuevo).
4. **Indicador de completitud amplía con una pista de qué falta que sea
   obligatorio** (`#mCompletionHint`) — como el nombre es el único campo
   que `saveItem()` exige de verdad, el hint dice
   "⚠ Falta el nombre del ítem — es el único campo obligatorio" mientras
   está vacío, y cambia a "El resto es opcional, puedes completarlo más
   tarde" en cuanto se rellena. Pensado explícitamente para que "8/18" no
   dé la sensación de que hacen falta los 18.
5. **Categoría ya no se autoasigna** — antes, sin categoría "recordada"
   (`cam_last_cat`), caía en la primera categoría alfabética o en
   "Componentes electrónicos" a pelo; ahora `fillModalSelects()` añade una
   opción `<option value="">Sin categoría</option>` al principio del
   desplegable y `openModal()` ya no rellena ningún valor por defecto en
   alta nueva (`catSel.value = m?.cat || ''`). Los accesos a `CATS[x.cat]`
   en el resto de la app ya tenían fallback a `CATS['Otros']`, así que un
   ítem sin categoría no rompe nada al listarlo. El "recordar último" se
   mantiene para aula/ubicación/proveedor (equivocarse ahí pesa menos que
   guardar mal categorizado sin darse cuenta).

Mismo método de verificación que la pieza anterior (Playwright headless,
`openModal()`/`usarCamaraParaAlta()` reales con estado mínimo simulado):
alta en blanco con categoría vacía y aviso de nombre obligatorio, hint que
cambia al rellenar el nombre, botón de cámara oculto al editar un ítem
existente y visible en alta nueva, categoría real respetada al editar.
`sw.js` → `v598`.

### 25/08/2026 (v598→v599): "profesor con prisa" — acceso directo, borrador y modo continuo en Añadir varios/Revisar aula

Tercera pieza de la misma sesión. Pedido explícito: pensar en un profesor
con prisa haciendo el inventario de una clase y quitar fricción real de
`js/multi-equipo.js` (Añadir varios) y `js/revision-aula.js` (Revisar
aula), sin tocar qué detecta la IA. Cinco cambios:

1. **Acceso directo sin navegar antes a la vista de aula.**
   `openMultiEquipo()`/`openRevisionAula()` exigían `cf.type==='aula'`
   (bloqueaban con un toast si no). Ahora, si no hay aula en contexto,
   muestran un selector de aula propio dentro del modal (`#multiAulaPicker`/
   `#revisionAulaPicker`, reusan `renderAulaOptions()` de `modal-item.js`)
   **antes** de pedir permiso de cámara — evita disparar el permiso si
   luego cancelan. Dos botones nuevos en Inicio → Acciones rápidas
   ("📸 Inventariar aula", "📷 Revisar aula", clases CSS `.home-quick-btn.teal`/
   `.rose` nuevas) los hacen alcanzables en un toque, sin abrir antes el
   aula. El flujo desde dentro de una vista de aula no cambia (mismo
   camino rápido de siempre).
2. **Sesión de "Añadir varios" persistente en `localStorage`**
   (`multi_equipo_draft_v1`, un único slot — "la última sesión sin
   terminar", no una por aula). Se guarda en cada cambio de la lista
   editable (tras cada captura, tras editar/borrar una fila). Si se cierra
   el modal sin confirmar, el borrador **no se borra** — solo se limpia al
   crear con éxito o al declinar explícitamente la oferta de continuarlo.
   Al reabrir la misma aula con un borrador pendiente, un `confirmDialog`
   ofrece continuar donde se dejó.
3. **Ofrece imprimir QR justo después de crear.** `confirmarCrearMulti()`
   ahora pregunta "¿Imprimir ahora las etiquetas QR de estos N ítems?" tras
   el alta — reusa `printBulkItemQrs()` (`modal-item.js`), que ganó un
   parámetro opcional `itemsOverride` (antes solo imprimía la vista
   filtrada actual; con la lista explícita de recién creados sigue
   funcionando igual para sus llamadas existentes).
4. **Modo continuo en "Añadir varios"** (paridad con "Revisar aula", que ya
   lo tenía vía `revisionSiguiente()`): tras crear (y responder lo del QR),
   `_volverACapturarMultiTrasCrear()` limpia la lista y vuelve directo a
   la cámara para la siguiente mesa, sin cerrar el modal ni tener que
   volver a pulsar "Añadir varios" desde el aula.
5. **Contador de progreso en vivo** en la cabecera de ambos modales:
   "Añadidos en esta sesión: N" (multi-equipo, tras cada lote creado) y
   "Confirmados hasta ahora: N" (revisión, tras cada foto confirmada).

**Bug preexistente encontrado y corregido en el camino:** `#mConf`
(`confirmDialog`) no tenía `z-index` propio — con la misma clase `.mbg`
que cualquier otro modal (z-index:500 para todos), el que estuviera más
abajo en el HTML ganaba el pintado y tapaba el diálogo de confirmación,
dejándolo con `class="open"` pero inaccesible al clic. No se había notado
porque nada disparaba un `confirmDialog` con el modal de cámara ya abierto
detrás hasta el borrador de esta pieza — pero afectaba igual al
"¿Continuar?" ya existente de `confirmarCrearMulti()`, sin relación con mi
cambio. Fix: `#mConf{z-index:600}` en `css/styles.css`.

Verificado con Playwright headless + flags de dispositivo de cámara falso
de Chromium (`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`,
concede permiso sin diálogo real): picker de aula sin contexto previo en
ambos modales, cámara no solicitada hasta elegir aula, borrador guardado/
sobrevive al cierre/ofrecido y restaurado correctamente, contador de sesión
actualizado tras crear/confirmar, diálogo de imprimir QR con el conteo
correcto y `printBulkItemQrs` recibiendo la lista exacta de recién creados,
modal quedando abierto en modo continuo tras confirmar. `sw.js` → `v599`.

### 25/08/2026 (v599→v600): "Guardar y añadir otro" en el modal manual de ítem

Cuarta pieza de la sesión. Tras explicar que "Añadir varios" ya cubre el
caso de alta rápida en serie por foto, el usuario confirmó que el hueco
real estaba en el modal manual (`js/modal-item.js`) — cuando no hay foto
posible y hay que teclear cada ítem a mano, guardar cerraba el modal
entero y había que reabrir "＋ Nuevo ítem" desde cero para el siguiente.

- `saveItem()` gana un parámetro `cerrarTrasGuardar = true` (por defecto,
  sin cambiar el comportamiento de siempre). Botón nuevo
  `#btnSaveNew` ("💾➕ Guardar y añadir otro") junto a "Guardar", visible
  solo en alta nueva (`!existing`, oculto al editar), llama a
  `saveItem(false)`.
- Con `cerrarTrasGuardar=false`: guarda igual que siempre (mismo POST
  `add`, mismo toast "Ítem añadido"), pero en vez de `closeM(true)` llama
  a `openModal()` de nuevo — reabre el modal en blanco **sin cerrarlo
  visualmente** (ya estaba abierto, solo se resetean los campos y el
  foco vuelve a Nombre). Aula/ubicación/proveedor se mantienen vía el
  "recordar último" ya existente (v597), así que dar de alta 10 ítems
  seguidos del mismo sitio no obliga a re-elegir aula cada vez.
- Ambos botones se deshabilitan durante el guardado (evita doble envío
  si se hace doble clic), y se restauran los dos al terminar
  independientemente de cuál se pulsó.

Verificado con Playwright headless (`apiPost` interceptado): botón visible
solo en alta nueva y oculto al editar, tras "Guardar y añadir otro" el
modal permanece abierto con el nombre vacío y la aula ya seleccionada
conservada, ítem quedó creado en el array `items`; segundo ítem guardado
con el botón normal "Guardar" cierra el modal como siempre. Sin errores de
consola. `sw.js` → `v600`.

### 25/08/2026 (v600→v601): fix — el atajo "🛠️ Marcar mantenimiento" del panel post-QR quedó roto por la sección colapsable

Encontrado auditando el resto de flujos de la app (préstamos/mantenimiento/
reservas) a petición del usuario, no reportado por él. `qrQuickAction('maintenance')`
(`js/qr-scanner.js`) abre el ítem, pone `f_mantEstado='Pendiente'` y hace
`focus()` en `f_mantNota` — pero desde que "MANTENIMIENTO" pasa a ser un
`<details>` colapsado por defecto (v597, ver sesión anterior), ese código
nunca abría el `<details>`: el valor se rellenaba pero la sección seguía
plegada, y `.focus()` sobre un campo dentro de un `<details>` cerrado no
hace nada (el navegador no permite foco en contenido no renderizado) — el
profesor no veía ni la sección ni el cursor en la nota tras usar el atajo.

Fix de una línea: `document.getElementById('mSecMantenimiento').open = true;`
antes del `.focus()`. Verificado con Playwright: sección abierta, valor
"Pendiente", campo de nota realmente enfocado. `sw.js` → `v601`.

### 25/08/2026 (v601→v602): "profesor/a usando toda la app" — mantenimiento de un toque, pestaña Reservas, duplicar práctica

Quinta pieza de la sesión. Esta vez el ejercicio fue ponerse en el papel de
un profesor/a usando el programa entero (no solo altas por cámara):
préstamos, mantenimiento y planificación de prácticas. Préstamos ya estaba
bien resuelto (preselecciona al profesor logueado, aulas destino filtradas,
devolución a 7 días). Tres huecos reales, los tres implementados:

**1. "🛠️ Marcar mantenimiento" de un toque desde la lista.** Antes solo
existía el atajo del panel post-QR — desde la lista/tarjetas del
inventario había que abrir la ficha completa y bajar hasta la sección
Mantenimiento a mano. La lógica de "poner Estado=Pendiente + abrir la
sección + enfocar la nota" (antes solo en `qr-scanner.js`) se extrajo a
`_enfocarMantenimientoEnModal()` en `js/modal-item.js`, y
`abrirMantenimientoRapido(id)` (mismo archivo: `openModal(id)` +
`setTimeout(_enfocarMantenimientoEnModal, 50)`) es la nueva entrada
reusada tanto por `qrQuickAction('maintenance')` como por un botón nuevo
"🛠️ Marcar mantenimiento" en el menú "⋯ Más acciones" de `js/inventory.js`
(tabla y tarjetas, las dos copias duplicadas de ese menú).

**2. "Reservas" como pestaña propia en Préstamos**, no un checkbox
("📅 Ver reservas") con el mismo estilo que "🔴 Solo vencidos" y por tanto
invisible como destino real. `index.html`: tercer `<button class="pres-tab">`
junto a Activos/Historial. `goPrestamos()`/`setPresTab()` en
`js/prestamos.js` tratan `'reservas'` como un tab más (antes solo
`['activos','historial']`): oculta buscador/agrupar-por/vencidos (no
aplican), muestra `#presReservasContent` y llama a
`renderReservasPendientes()` en vez de `renderPrestamos()`. Se eliminó
`togglePresReservas()` (`js/reservas-practica.js`) y la variable global
`currentPresShowReservas` (`js/state.js`), ambas ya sin uso.

**3. "⧉ Duplicar" en cada reserva pendiente** (`duplicarReservaPractica(id)`,
`js/reservas-practica.js`) — para repetir la misma práctica en otra fecha
sin volver a teclear el material línea a línea. Abre "Planificar práctica"
normal y sobrescribe sus defaults con los de la reserva original (ciclo/
módulo, aula, profesor/a, observaciones, líneas de material) — **la fecha
se deja en blanco a propósito**, es lo único que tiene sentido cambiar al
repetir. Cada línea de material se revalida contra el stock *actual* (no
el de cuando se hizo la reserva original): si un ítem ya no tiene stock
disponible, esa línea no se copia y un toast avisa cuántas se descartaron.

Verificado con Playwright headless: mantenimiento rápido abre la sección y
enfoca la nota igual que el atajo QR; pestaña Reservas oculta el contenido
normal y el buscador, muestra la reserva de prueba; duplicar copia ciclo/
aula/profesor/obs y descarta correctamente la línea de un ítem sin stock
(qty=0) manteniendo la que sí tenía. Sin errores de consola. `sw.js` → `v602`.

### 25/08/2026 (v602→v603): Pedidos — de roto y solo local a real, compartido y con email

Sexta pieza de la sesión. Auditando el resto de la app apareció algo serio:
**"🛒 Pedidos" nunca ha notificado a nadie.** `togglePedido()` llamaba a
`apiPost({action:'notificarPedido', ...})`, que `js/api.js` enruta al
endpoint `/api/pedidos` — pero `functions/api/pedidos.js` **no existía**.
Cada clic en 🛒 disparaba un 404 silencioso (`.catch(()=>{})` se lo tragaba
sin avisar). Además, la lista entera vivía solo en `localStorage`
(`inv_pedidos`) — sin compartir entre dispositivos ni entre el profesor/a
que pide y el jefe/a de departamento que compra.

Arreglado de raíz, no parcheado:

1. **`migrations/0030_pedidos.sql`** — tabla `pedidos` nueva (`itemId`,
   `departamento`, `qty`, `nota`, `creadoPor`, `fecha`,
   `UNIQUE(itemId, departamento)`). **No la he podido aplicar en remoto**
   — sin acceso a wrangler/D1 en este sandbox (sin red hacia Cloudflare).
   Mismo patrón que `ia_deteccion_ejemplos` (`item.js`, ya señalado como
   pendiente de migración formal en `claude.md`): la tabla también se
   autocrea en runtime (`CREATE TABLE IF NOT EXISTS`) tanto en
   `pedidos.js` como en `list.js`, así que funciona igual sin esperar a
   que alguien ejecute la migración a mano.
2. **`functions/api/pedidos.js` (nuevo)** — acciones `pedidoAdd` (inserta
   o actualiza si ya existía, sin duplicar; en un alta real nueva manda
   email al jefe/a de departamento con `sendGmail()`, mismo helper que ya
   usa `notificarVencidos` en `prestar.js` — copiado, no importado, sigue
   el patrón de duplicación entre archivos ya documentado en el
   proyecto), `pedidoUpdate` (edición de cantidad/nota, sin re-notificar),
   `pedidoRemove`, `pedidoClear`. Todas registradas en `ENDPOINT_MAP`
   (`js/api.js`) y en `ACTION_PERMISSIONS` (`js/roles.js`, todas bajo
   `orders.write`) — sustituyen a la `notificarPedido` que nunca llegó a
   funcionar.
3. **`functions/api/list.js`** — añade `pedidos` al `Promise.all()` del
   bulk de login (mismo patrón que `prestamos`/`reservas`: scoped por
   `departamento`, superadmin ve todos), así la lista llega ya cargada
   sin una petición aparte.
4. **`js/modal-item.js`** — `pedidos` deja de leerse de `localStorage` al
   arrancar el script (`js/auth.js` la rellena en `loadData()` desde
   `res.pedidos`). `togglePedido()`/`removePedido()`/`clearPedidos()`
   pasan a ser `async`, con actualización optimista (UI al instante) y
   *rollback* si el servidor no confirma — capturando el valor anterior
   antes de mutar, no un `{qty:1,nota:''}` a ciegas (fallo que pillé y
   corregí en la propia sesión antes de subirlo). Los inputs de
   cantidad/nota de la lista pasan de `oninput` (guardaba solo en
   localStorage en cada tecla) a `oninput` (refleja local al instante) +
   `onchange` (`_syncPedido()`, sincroniza al salir del campo — evita
   spamear la red tecla a tecla).

Todos los sitios que ya leían `pedidos[id]`/`isPedido(id)` (menús ⋯ de
`inventory.js`, badge de Home) siguen funcionando sin tocarlos — la forma
del objeto en memoria no cambió, solo de dónde viene y adónde va.

Verificado con Playwright headless (`apiPost` interceptado, sin D1 real
disponible en este sandbox): carga inicial desde datos simulados de
`list`, añadir con confirmación optimista, quitar con fallo de red
simulado → revierte correctamente restaurando el valor original completo
(no un valor por defecto), editar cantidad desde la lista → sincroniza con
`pedidoUpdate`, vaciar → `pedidoClear`. Sin errores de consola. Revisión
manual del SQL (sin poder ejecutarlo contra D1 real desde este sandbox):
`.bind()` en todas las queries, mismo patrón de scoping por departamento
que el resto de endpoints. `sw.js` → `v603`.

**Actualización (25/08/2026, mismo día):** el usuario ejecutó
`migrations/0030_pedidos.sql` en remoto desde su VS Code local
(`npx wrangler d1 execute boscoinventario --remote --file=...`) —
2 queries ejecutadas (tabla + índice), 4 filas escritas. Migración
formalmente aplicada, ya no depende solo del autocreate en runtime. Antes
de eso, `git pull` falló con `fatal: bad object refs/desktop.ini` — el
mismo problema de siempre por vivir el repo dentro de Google Drive
(`H:\Mi unidad\...`, ver sección Entorno de este archivo); se resolvió
borrando los `desktop.ini` reinyectados dentro de `.git` y repitiendo el
pull.

---

### 25/08/2026 (v603→v604): contraseñas — de texto plano a hash PBKDF2

Séptima pieza de la sesión. La comparación con Snipe-IT/GLPI/Odoo señaló el
mayor riesgo de seguridad de la app: las contraseñas de `usuarios.password`
se guardaban **en texto plano** en D1. Cualquiera con acceso de lectura a
la base (un backup, un error de configuración, un vistazo desde el panel de
Cloudflare) veía las contraseñas de los 48+ profesores tal cual.

Cloudflare Workers no es Node.js — no hay `bcrypt` nativo (necesita
bindings en C). La solución idiomática en este runtime es **Web Crypto API**
(`crypto.subtle`, global, sin dependencias npm): PBKDF2, 100.000
iteraciones, SHA-256, salt aleatoria de 16 bytes por contraseña. Formato
guardado: `pbkdf2$100000$<salt hex>$<hash hex>`.

1. **Migración perezosa, sin script de migración masiva ni afectar a
   nadie.** `verifyPassword(password, stored)` acepta tanto el hash nuevo
   como (si `stored` no empieza por `pbkdf2$`) el texto plano antiguo, para
   no romper el login de las cuentas que aún no se han hasheado. En cada
   login correcto con una contraseña todavía en texto plano, se rehashea
   y reescribe inmediatamente (`UPDATE usuarios SET password=? WHERE
   usuario=?` con el nuevo hash) — sin intervención de nadie, sin pedir
   cambio de contraseña, sin downtime. Todas las cuentas quedan hasheadas
   de forma natural a medida que la gente entra; las que no vuelvan a
   entrar quedan igual de protegidas que antes (ni mejor ni peor) hasta
   que lo hagan.
2. **Duplicado en cada archivo que toca contraseñas** (patrón ya
   establecido en el proyecto, sin imports entre `functions/api/*.js`):
   `functions/api/_middleware.js` (login por usuario+password, la vía
   principal), `functions/api/auth.js` (login GET alternativo,
   `resetPassword`, `register`), `functions/api/perfil.js`
   (`changePassword` — verifica la actual con `verifyPassword` antes de
   aceptar la nueva), `functions/api/usuarios.js` (`userAdd`,
   `userResetPassword` — solo necesitan `hashPassword`, nunca verifican
   una contraseña anterior porque el superadmin no la conoce ni falta que
   la conozca), `functions/api/oauth/login-google.js` (la contraseña
   aleatoria de relleno que se genera para cuentas de Google, que nunca
   se usa para iniciar sesión con contraseña, también se hashea).
3. **Qué cambia para el superadmin y qué no.** Preguntado explícitamente,
   el usuario eligió hash real (no cifrado reversible). Sigue pudiendo
   **asignar/resetear** la contraseña de cualquier usuario exactamente
   igual que antes (`userResetPassword`, sin cambios de flujo ni de
   pantalla). Lo que ya **no** es posible, por diseño — es la naturaleza
   de un hash de un solo sentido, no una limitación añadida aparte — es
   que nadie, ni el propio superadmin, pueda **ver** la contraseña actual
   de otra persona (ni la suya pasada): no se guarda de forma reversible
   en ningún sitio.
4. **Cero impacto de usabilidad.** El flujo de login es idéntico byte a
   byte desde el cliente — usuario y contraseña de siempre, mismo
   formulario, mismos mensajes de error. Todo el trabajo extra ocurre en
   el servidor, en el momento de verificar.

Verificado con un script Node.js aislado (scratchpad, no forma parte del
repo) que reproduce exactamente `hashPassword`/`verifyPassword`/
`_pwTimingSafeEqual`: 12 aserciones — formato `pbkdf2$100000$<32 hex>$<64
hex>`, verificación correcta, rechazo correcto con contraseña incorrecta,
salt distinta en cada hash de la misma contraseña, compatibilidad con
texto plano heredado, casos límite de vacío/null, y comparación a tiempo
constante. Los 5 archivos pasan `node --check`. No he podido probar el
login real contra D1 (sin acceso a red/wrangler en este sandbox) — la
lógica de hash está verificada de forma aislada, pero el primer login real
tras el despliegue es quien lo confirma en producción.

`docs/SECURITY.md` actualizado (crítico #3 marcado como resuelto). `sw.js`
→ `v604`.

---

### 25/08/2026 (v604→v605): Fase 1 del plan de seguridad — auditoría del backup, sin cambios de código

Octava pieza de la sesión. Con la contraseña ya hasheada, el usuario pidió
un plan paso a paso para los 4 críticos restantes de `docs/SECURITY.md`.
Se propuso empezar por el #5 ("Exportación de datos incluye passwords",
`functions/api/backup.js`) por ser el de menor esfuerzo y riesgo.

Al auditarlo, resultó que **no había nada que arreglar**: la consulta real
en `runBackup()` es `SELECT usuario, nombre, rol, email FROM usuarios`
— sin la columna `password`, ya excluida desde antes de esta sesión. El
ejemplo "VULNERABLE" en `docs/SECURITY.md` (`SELECT * FROM usuarios`) era
genérico/ilustrativo y no reflejaba el código real del proyecto.

Se amplió la revisión a todo `functions/api/` (`grep -rn "password"`):
las únicas consultas que leen `password` son las de login/verificación
(`_middleware.js`, `auth.js`, `perfil.js`), siempre para comparar
internamente — nunca se devuelve al cliente (`delete row.password;` antes
de construir la respuesta en `_middleware.js` línea 51 y `auth.js` línea
165). Los listados de usuarios (`usuarios.js`, `list.js`) nunca
seleccionan esa columna. Ninguna ruta de exportación o listado expone
contraseña ni hash.

**Resultado:** `docs/SECURITY.md` (crítico #5 marcado como verificado sin
riesgo, tabla resumen actualizada a "3 críticos pendientes, 2
resueltos/verificados de 5, ~14h") y `claude.md` (Pendiente #3)
actualizados para reflejar el hallazgo. Sin cambios en
`functions/api/backup.js` ni en ningún otro archivo de código — este
`sw.js` → `v605` es puramente procedimental (convención de la sesión de
subir versión en cada pieza cerrada), no hay ningún asset de la shell
cacheada que haya cambiado.

Quedan 3 críticos pendientes: credenciales en URL + password en
localStorage (mismo origen, la pieza más grande — migrar a
`session_token` también para el login por contraseña, no solo Google
OAuth) y permisos revalidados solo en frontend (portar
`ACTION_PERMISSIONS` de `js/roles.js` al backend, endpoint por endpoint).
Plan completo y orden recomendado discutido con el usuario, sin empezar
todavía la Fase 3 (la de tokens de sesión) por ser la más invasiva —
queda para una sesión dedicada.

---

### 25/08/2026 13:45 — Sugerencias de interfaz (comparativa, sin implementar)

Novena pieza de la sesión, a petición del usuario ("en cuanto a la
interfaz? sugerencias? puedes comparar con otras aplicaciones o
interfaces?"). Auditoría rápida del estado actual de la UI —
`css/styles.css`, `index.html`, `js/home.js`, `js/inventory.js`,
`js/search.js` — comparada con Snipe-IT (gestión de activos, el más
cercano en propósito), Notion, Linear y Airtable (referencia en fluidez
de interfaz). Solo diagnóstico y propuestas — **nada de esto está
implementado todavía**.

**Veredicto general:** la interfaz ya está por delante de la mayoría de
herramientas internas de instituto gracias al trabajo de sesiones
anteriores: tarjetas de stat con estados de carga tipo *skeleton*
(`js/home.js`), accesibilidad por teclado en tarjetas (`tabindex`,
`Enter`/`Espacio` ya manejados), filtros con chips activos
(`renderActiveFilters`), acciones en bloque (`renderBulkBar`), ordenación
de columnas (`sort()`/`th2()` en `js/inventory.js`), presets de filtro
guardados (`renderPresetList`), y más de 25 breakpoints responsive en
`css/styles.css`.

**4 huecos concretos identificados, por prioridad:**

1. **Sin modo oscuro real.** Existe una clase `.dark` en
   `css/styles.css` pero solo se usa en los chips de filtro (línea
   ~2448) — resto incompleto de algún intento anterior, nunca se activó
   en el resto de la app ni hay botón para encenderlo. Como el proyecto
   ya centraliza colores en variables CSS (`--bg`, `--text`, `--accent`,
   etc. en `:root`), el coste de implementarlo es bajo: definir el juego
   de valores oscuros de cada variable, un botón de toggle, y recordar
   la preferencia en `localStorage`. Estándar en cualquier app moderna
   (GitHub, Notion, Linear, el propio Snipe-IT).
2. **El buscador rápido (`/` o Ctrl+K) solo funciona en Home.** En
   `js/search.js` línea 278, el atajo comprueba
   `document.getElementById('pH').classList.contains('active')` — si el
   usuario está dentro de un aula o con el modal de un ítem abierto, no
   hace nada. En Linear/Notion, Cmd+K funciona desde cualquier pantalla.
   Ampliar el atajo a toda la app es un cambio pequeño de alto impacto en
   velocidad para quien ya conoce el programa.
3. **Sin favoritos/ítems fijados.** Ya existe el historial de búsquedas
   recientes, pero no una forma de fijar los 5-10 ítems que un profesor
   pide constantemente (tornillos M4, cable...) para acceder en un clic
   desde Home — patrón habitual en Airtable/Notion (⭐ pin). Encaja con
   el perfil "profesor con prisa" ya trabajado en piezas anteriores de
   esta sesión.
4. **Sin recorrido de bienvenida para gente nueva.** Con 48+ cuentas y
   bastantes funciones (mantenimiento, pedidos, reservas, cámara IA...),
   un profesor nuevo puede no descubrir la mitad de lo que hay. Más
   barato que un tour interactivo: un banner/tooltip descartable la
   primera vez que se visita cada sección nueva.

**Recomendación dada al usuario:** empezar por el modo oscuro (#1) —
el más visible, el más pedido hoy en día, y el más barato dado que el
sistema de variables ya está listo. Pendiente de que el usuario decida
por cuál empezar.

---

### 25/08/2026 — Modo oscuro real (v606)

Primera de las 4 mejoras de interfaz sugeridas en la auditoría anterior,
a petición del usuario ("usando superpowers analiza la forma de
implementar esas 4 mejoras", brainstorming en modo *bounded*, aprobado
antes de tocar código). Sustituye el intento incompleto que ya existía
(`.dark .filter-chip`/`.dark .preset-panel` en `css/styles.css`, nunca
activado desde ningún botón) — y de paso corrige un bug independiente:
`.preset-panel` usaba `background: var(--surface)`, variable que no
existe en `:root` (fondo transparente de facto en cualquier modo).

- `css/styles.css`: bloque `body.dark{...}` redefine todas las
  variables de color de `:root` (`--bg`, `--white`, `--text`,
  `--accent`, los pares `-l` de estado, sombras `--sh`/`--shh`) con su
  equivalente oscuro — reutiliza el sistema de tokens que ya existía en
  vez de tocar cada regla suelta del CSS. `.preset-panel` pasa a
  `var(--white)` (con esto los 2 overrides `.dark` que quedaban se
  vuelven redundantes y se eliminan). Botón toggle `.theme-toggle-btn`
  con icono 🌙/☀️ intercambiado por CSS puro (`body.dark
  .theme-icon-dark{display:inline}`), sin JS de por medio.
- `index.html`: botón en `.topbar-right` junto a `#connStatus`, y script
  inline al inicio de `<body>` (antes de `#loadOverlay`) que aplica la
  clase `dark` según `localStorage('theme')` o, si no hay preferencia
  guardada, `prefers-color-scheme` — evita el parpadeo de tema al
  cargar.
- `js/ui-helpers.js`: `toggleTheme()` alterna la clase en `<body>` y
  persiste en `localStorage`, mismo patrón que `dept_activo_superadmin`
  en `js/config.js` — global por navegador, no por usuario/departamento.

Verificado con Playwright contra un servidor estático local (sin
backend, solo pantalla de login): toggle visible y funcional, contraste
legible en ambos modos, persistencia tras recargar sin parpadeo, sin
errores de consola relacionados con el tema.

Quedan 3 piezas de la misma auditoría sin implementar: buscador global
(Ctrl+K) fuera de Home, favoritos/ítems fijados, recorrido de
bienvenida.

---

### 25/08/2026 — Buscador global (Ctrl+K/"/") desde cualquier pantalla (v607)

Segunda de las 4 mejoras de interfaz de la auditoría anterior. El listener
de `js/search.js` (L277-282) solo actuaba si `#pH` (Home) estaba activa —
en cualquier otra pantalla (aula, préstamos, modal de ítem abierto...) el
atajo no hacía nada. En vez de construir un command palette nuevo, se
reutiliza `goHome()` (misma función que ya usa el logo de la marca) para
saltar a Home y enfocar `#gsInput`, sin tocar `globalSearch()` ni layout.

- El listener quita la condición `pH active` y añade 2 guardas: si hay un
  modal abierto (`.mbg.open`, mismo patrón que `mItem`/`mConf`/etc.) no
  actúa — evita cerrar de golpe un modal con cambios sin guardar. La
  tecla `/` solo se intercepta si el foco no está en un campo editable
  (input/textarea/select/contenteditable) distinto del propio buscador,
  para no robarle la `/` a quien esté escribiendo una referencia o nota;
  `Ctrl+K` sí se intercepta siempre (combinación de modificador, no un
  carácter que se escriba sin querer — mismo criterio que Linear/GitHub).
  Si Home no está activa, llama a `goHome()` antes de enfocar (ya limpia
  la búsqueda anterior vía `gsClear()`, como cualquier otra navegación a
  Home).

Verificado con Playwright vía `page.evaluate()` simulando estados de
página/foco (sin backend real disponible en este sandbox): Ctrl+K desde
Préstamos navega a Home y enfoca el buscador; con un modal `.mbg.open`
simulado, el atajo no navega; `/` dentro de un `<textarea>` normal no se
intercepta (el carácter se escribe). Sin errores de consola relacionados.

Quedan 2 piezas de la misma auditoría: favoritos/ítems fijados, recorrido
de bienvenida.

---

### 25/08/2026 — Favoritos/ítems fijados en Inicio (v608)

Tercera de las 4 mejoras de interfaz de la auditoría anterior. Patrón
Airtable/Notion (⭐ pin) para acceder en un clic desde Home a los 5-10
ítems que un profesor pide constantemente, sin pasar por el buscador cada
vez. Almacenamiento en `localStorage` (`inv_favoritos`) — personal por
navegador, no sincronizado entre dispositivos ni por departamento, mismo
criterio que el modo oscuro (v606): es un atajo de conveniencia, no un
dato de negocio que necesite vivir en D1.

- `js/ui-helpers.js`: `favoritos` (`Set` cargado de `localStorage` al
  arrancar), `isFavorito(id)`, `toggleFavorito(id)` — persiste y, si Home
  está activa, refresca la sección al vuelo.
- `js/inventory.js`: botón `⭐ Fijar en Inicio` / `Quitar de Inicio` en el
  menú `⋯ Más acciones` de tabla y tarjetas, mismo patrón que `🛒 Pedido`
  (clase `.activo` cuando ya está fijado).
- `js/home.js`: `renderFavoritos()` (llamada desde `renderHome()`) pinta
  la fila de chips en `#gFavoritos`/`#secFavoritos` — icono de categoría,
  nombre, cantidad (coloreada vía `isLowStock()`, ya solo aplica a
  consumibles como en el resto de la app) y una `✕` para desfijar sin
  abrir el ítem. Sección oculta por completo cuando no hay ningún
  favorito (sin estado vacío que enseñar — es opt-in desde el menú ⋯).
  Clic en el chip reutiliza `openItemRoute(id)` (la misma función que ya
  usa el buscador global) para abrir el ítem directamente.
- `index.html`: `#secFavoritos`/`#gFavoritos` insertados en `.home-body`
  justo debajo de las tarjetas de estadísticas, antes de "Por aula/
  espacio" — la posición más visible sin desplazar el resto del layout.
- `css/styles.css`: `.fav-chip`/`.fav-chip-qty`/`.fav-chip-x`, mismo
  sistema de variables que el resto (compatible con el modo oscuro de
  v606 sin overrides adicionales).

Verificado con Playwright (`page.evaluate()` inyectando ítems falsos, sin
backend disponible en este sandbox): fijar 2 ítems renderiza la fila con
nombre/cantidad correctos, desfijar uno deja el otro, desfijar el último
oculta la sección entera. Sin errores de consola.

Queda 1 pieza de la misma auditoría: recorrido de bienvenida para gente
nueva.

---

### 25/08/2026 — Recorrido de bienvenida por sección (v609)

Cuarta y última mejora de la auditoría de UI del 25/08/2026 — cierra la
ronda completa (modo oscuro v606, buscador global v607, favoritos v608).
Siguiendo la recomendación explícita de la propia auditoría ("más barato
que un tour interactivo: un banner/tooltip descartable la primera vez que
se visita cada sección nueva"), no se amplía el tour de 4 pantallas que ya
existe para cámara (`js/onboarding-camara.js`) — se generaliza el
mecanismo que ya usaba `#camaraHint` (banner descartable en Home) a las 3
secciones que la propia auditoría señaló como poco descubiertas:
Mantenimiento, Pedidos, Reservas.

- `js/ui-helpers.js`: `showFeatureHintOnce(key, elId)` /
  `dismissFeatureHint(key, elId)` — mismo mecanismo de
  `localStorage('hint_'+key+'_visto')` que ya usaba la cámara, ahora
  reutilizable sin duplicar lógica por cada sección nueva que lo
  necesite en el futuro.
- 3 banners estáticos nuevos con la clase `.feature-hint` (variables CSS,
  a diferencia de `.camara-hint` que tiene colores fijos — compatible con
  el modo oscuro de v606 sin overrides extra):
  - `js/nav.js` (`openSub()`): se oculta al entrar a cualquier
    subpágina y solo se muestra si `cf.type==='maintenance'` —
    `#pS`/`.sub-body` es compartido por aula/categoría/mantenimiento/
    etc., así que el reset explícito evita que quede visible al navegar
    a una vista donde no pinta nada.
  - `js/prestamos.js` (`goPrestamos()`): se muestra/oculta según
    `currentPresTab==='reservas'`, junto al resto de la lógica de tabs
    que ya existía.
  - `js/modal-item.js` (`openPedidos()`): se dispara al abrir el modal,
    debajo de la descripción que ya tenía.

Verificado con Playwright (`page.evaluate()`, sin backend disponible en
este sandbox): mecanismo genérico (mostrar → descartar → no reaparece)
probado sobre los 3 banners; integración real en `goMaintenance()`
confirmando que se oculta al navegar a `goAula()`; integración real en
`setPresTab('reservas')` alternando con `'activos'`. Sin errores de
consola en ningún caso.

Las 4 piezas de la auditoría de UI quedan cerradas.

---

### 25/08/2026 — Revisión de las 4 piezas de UI: 2 detalles menores corregidos (v610)

El usuario pidió revisar y comparar de nuevo con las apps comerciales
las 4 piezas de UI (v606-v609) que había implementado él mismo desde su
sesión local. Revisión del diff completo (`1a1754f`→`d0e566a`): las 4
siguen fielmente lo recomendado en la auditoría anterior, reutilizan
patrones ya existentes en el proyecto en vez de mecanismos nuevos, y
vienen probadas con Playwright y bien documentadas. Sin bugs de
correctitud. 2 detalles menores encontrados y corregidos en esta pieza:

1. **`--surface` no existe como variable CSS** — nunca se definió en
   `:root` ni en el nuevo `body.dark` (v606). Se usaba en
   `.mod-ciclo-group` (línea 297) y `.gsr-print-btn` (línea 1372) de
   `css/styles.css`; el propio trabajo de v606 ya había corregido un
   caso igual en `.preset-panel` (cambiado a `var(--white)`) pero dejó
   estos dos sin tocar — fondo transparente de facto en cualquier modo,
   no solo el oscuro. Sustituidos por `var(--surface2)` (coherente con
   las reglas vecinas de ambos selectores, que ya usan `--surface2`).
   Bug preexistente a v606, no introducido por esa pieza.
2. **`<meta name="theme-color">` fijo en `#2563eb`** (azul claro) —
   no seguía al modo oscuro. En móvil (Android/Chrome, splash de PWA)
   la barra de estado del navegador se quedaba azul clara con el resto
   de la app ya en oscuro. Corregido en los 2 sitios que tocan el tema:
   el script anti-parpadeo al inicio de `<body>` en `index.html`
   (aplica `#3b82f6` si detecta modo oscuro guardado o por
   `prefers-color-scheme`) y `toggleTheme()` en `js/ui-helpers.js`
   (alterna entre `#2563eb`/`#3b82f6` al hacer clic en el botón).

`sw.js` → `v610`.

---

### 26/08/2026 — Bloqueo de cuenta tras intentos de login fallidos (v611-v613)

Petición del usuario: limitar los intentos de login a 5, bloquear la
cuenta al 5º avisando de que contacte con el administrador, y avisar antes
de llegar al bloqueo.

- **`functions/api/auth.js`** (`action=login`, `GET /api/auth`): nuevas
  columnas `usuarios.intentos_fallidos`/`bloqueado` (helper
  `getUserForLogin()`, con autocura vía `ALTER TABLE ... ADD COLUMN` +
  reintento si la migración aún no se ha aplicado en remoto — mismo patrón
  que la columna `responsable` en `usuarios.js`). Antes de comprobar la
  contraseña se rechaza si `bloqueado=1` con el mensaje de contactar con el
  administrador. Contraseña incorrecta → incrementa `intentos_fallidos`;
  al llegar a 5 pone `bloqueado=1` y devuelve el mismo mensaje de bloqueo;
  con 2 o 1 intentos restantes añade el aviso al mensaje de error normal
  ("te quedan N intentos..."). Login correcto → resetea el contador a 0.
- **Deliberadamente NO tocado `_middleware.js`**: ese archivo re-verifica
  usuario+contraseña en cada llamada autenticada (todas las pantallas
  mandan `?u=&p=` en cada request, no solo en el login — ver sección "Auth
  actual" de `CLAUDE.md`). Contar ahí los fallos habría bloqueado cuentas
  legítimas sin que nadie intentara loguearse a propósito: un dispositivo
  con una sesión vieja en `localStorage` (contraseña cambiada desde otro
  dispositivo, por ejemplo) manda la contraseña caducada en cada petición
  de `loadData()` (meta+list), acumulando "intentos fallidos" solo por
  tener la app abierta. El límite de 5 intentos se aplica únicamente en la
  pantalla de login, que es donde tiene sentido (intentos deliberados de
  adivinar una contraseña).
- **`functions/api/usuarios.js`**: `getUsers` ahora selecciona también
  `bloqueado` (con la misma autocura de columna); acción nueva
  `userUnlock` (mismo scoping por departamento que `userResetPassword`/
  `userDelete`) resetea `bloqueado=0, intentos_fallidos=0`, con
  `auditLog`.
- **`js/roles.js`**: `userUnlock` mapeado a `config.manage`, igual que el
  resto de acciones de gestión de usuarios.
- **`js/prestamos.js`**: `_renderUsuariosList()` muestra una insignia
  "🔒 Bloqueada" y un botón "🔓 Desbloquear" (`_desbloquearUsuario()`,
  llama a `userUnlock` y refresca la fila) en la fila de cualquier usuario
  bloqueado dentro del modal 🔐 Usuarios.
- **`migrations/0031_intentos_login.sql`**: `ALTER TABLE usuarios ADD
  COLUMN intentos_fallidos/bloqueado` — **pendiente de aplicar en
  remoto** (`npx wrangler d1 execute boscoinventario --remote
  --file=migrations/0031_intentos_login.sql`) en la próxima sesión con
  acceso a `wrangler login`; la autocura en runtime hace que la función
  no rompa mientras tanto, pero conviene aplicarla para evitar el coste
  extra de las columnas fallidas en cada login/`getUsers` hasta entonces.
- No se tocó el login con Google (`oauth/login-google.js`): no usa
  contraseña, la autenticación la hace Google, no aplica fuerza bruta de
  contraseña ahí.

`sw.js` → `v613`.

---

### 26/08/2026 — Fix ENDPOINT_MAP + panel "🛡️ Accesos" (v614-v615)

**v614 — fix:** el botón "🔓 Desbloquear" del modal 🔐 Usuarios (añadido en
v611-v613) no funcionaba: `userUnlock` se quedó sin registrar en
`ENDPOINT_MAP` de `js/api.js` (la tabla que traduce cada `action` al
endpoint real — `/api/usuarios`, `/api/item`, etc.). Sin esa entrada,
`apiPost({action:'userUnlock',...})` llamaba a `/api/userUnlock`
(inexistente) y fallaba con `HTTP 405`. Detectado probando en producción
con Playwright: se bloqueó a propósito una cuenta de prueba
(`profe1electricidadelectronica`, 5 intentos fallidos reales) para
verificar el flujo end-to-end, y el botón de desbloqueo no respondía.
Mientras se aplicaba el fix, la cuenta de prueba se desbloqueó a mano por
`wrangler d1 execute`. Aplicada también la migración `0031_intentos_login.sql`
en remoto (antes solo con autocura en runtime).

**v615 — nuevo panel "🛡️ Gestionar accesos"** (menú ⚙️ Departamento, junto a
🔐 Usuarios), petición del usuario para tener control de accesos: quién ha
entrado, cuándo, con qué resultado, cuántos intentos.

- **`functions/api/auth.js`**: cada intento de login (correcto, incorrecto,
  bloqueado, o contra una cuenta ya bloqueada) se registra ahora en la
  tabla `log` ya existente (helper `logAccessAttempt()`) — accion
  `loginOk`/`loginFail`/`loginBlocked`, con IP (`CF-Connecting-IP`) y el
  contador `intento N/5` en el resumen. Reusa la tabla de
  auditoría/historial en vez de crear una tabla nueva — sin migración.
  Intentos contra un usuario que no existe se registran igual (usuario
  tal cual se escribió, sin nombre/rol), pero solo los ve el superadmin:
  el scoping por departamento de `historial.js` hace `JOIN` contra
  `usuarios.departamento`, que no existe para un login inventado.
- **`functions/api/historial.js`**: `mapLogRow()` clasifica
  `loginOk/loginFail/loginBlocked` como `tipo: 'Accesos'` — no hace falta
  tocar el endpoint en sí, ya devuelve todo el `log` con scoping por
  departamento del actor (igual que el resto del historial).
- **`js/modal-accesos.js`** (nuevo): modal con (1) aviso destacado en rojo
  de cuentas bloqueadas ahora mismo con botón "🔓 Desbloquear" directo
  (mismo `userUnlock` que el modal 🔐 Usuarios, sin tener que cambiar de
  pantalla) y (2) tabla de accesos (fecha, usuario, nombre, rol,
  resultado con badge de color, detalle) con filtro por usuario y por
  resultado. Reusa `apiGet('historial')` (filtrando `tipo==='Accesos'`
  client-side, igual que hace `modal-historial.js` con sus propios
  filtros) + `apiPost({action:'getUsers'})` para la lista de bloqueadas.
- **`index.html`/`js/roles.js`**: botón "🛡️ Gestionar accesos" en el menú
  Departamento con `data-perm="config.manage"` (mismo gate que Auditoría
  de datos — jefe/a de departamento o superadmin); `openAccesosModal()`
  además comprueba `requirePerm('config.manage')` por si se invoca desde
  otro sitio.
- **`css/styles.css`**: badges `.badge-loginok`/`loginfail`/`loginblocked`
  (verde/ámbar/rojo, mismo patrón que `.badge-add`/`.badge-delete`) +
  estilos del aviso de cuentas bloqueadas.
- No se tocó `_middleware.js` ni el login de Google — mismo razonamiento
  que en v611-v613 (ver esa entrada): solo se audita la pantalla de login
  real, no cada request autenticada con `u`+`p` en query params.

`sw.js` → `v615`.

---

### 26/08/2026 — Ajustes de Accesos + autoasignación de departamento (v616-v618)

**v616 — fix:** el modal `#mAccesos` reusa las clases `.historial-modal`
pero el CSS que le da el ancho grande (1120px) estaba atado solo al
selector `#mHistorial .historial-modal`, así que `#mAccesos` se quedaba
con el ancho de un modal normal (~520px) y la tabla se veía cortada.
Selectores extendidos a `#mHistorial,#mAccesos` en `css/styles.css`.

**v617 — cruce Accesos ↔ Historial de acciones**, petición del usuario:
pinchar el nombre de usuario en la tabla de 🛡️ Accesos (con tooltip "Ver
el historial de acciones de...") abre 📋 Historial de acciones ya
filtrado por ese usuario, mostrando tanto sus ítems/préstamos como sus
propios accesos (misma tabla `log`, sin petición nueva). `openHistorialModal()`
en `js/modal-historial.js` admite ahora un `presetUsuario` opcional: se
hizo `async` y espera a `cargarHistorial()` antes de rellenar el filtro
`filterUsuario` y llamar a `filtrarHistorial()` — antes disparaba la carga
sin esperarla, lo cual habría dejado el filtro vacío por condición de
carrera. `js/modal-accesos.js` añade `verHistorialDeUsuario(usuario)`
(cierra Accesos, abre Historial con ese usuario precargado).

**v618 — autoasignación de departamento en el primer login**, petición
del usuario: cualquier cuenta de Google con un correo `@iesjuanbosco.es`
no mapeado en `EMAIL_DEPT_MAP` (`oauth/login-google.js`) entra
automáticamente sin departamento asignado — hasta ahora se quedaba así
hasta que el superadmin se lo asignaba a mano desde 🔐 Usuarios. Ahora:

- **`functions/api/perfil.js`**: nueva acción `selectDepartamento` —
  valida que el departamento elegido exista en la tabla `departamentos`,
  y **solo deja aplicarlo si el usuario todavía no tiene ninguno**
  (mismo criterio ya usado en `updateProfile`, que bloquea el cambio de
  departamento a cualquiera que no sea superadmin); si ya tiene uno,
  responde pidiendo que se lo cambie su jefe/a de departamento o el
  administrador — evita que esto se convierta en un cambio de
  departamento libre para cualquier profesor en cualquier momento.
- **`js/auth.js`**: nueva pantalla obligatoria `#pSeleccionarDepartamento`
  (mismo patrón que `#pForcePassword`) — un desplegable con los
  departamentos (`loadDepartamentosInto()`, ver abajo) y un botón
  "Continuar" (`doSelectDepartamento()`). Se dispara desde una función
  común nueva, `_proceedAfterLogin()`, llamada al final de los 3 flujos
  de login (`doLogin`, `doForcePasswordChange`, `handleGoogleSignIn`) en
  vez de repetir `showUserChip();_showOverlay();loadData();` en cada uno.
  **Importante:** el mismo chequeo (`if(!SESSION.departamento)`) se añadió
  también al principio de `loadData()`, igual que ya existía para
  `passwordTemporal` — así una sesión que se quedó sin terminar de elegir
  departamento (cerró la pestaña a medias) lo vuelve a pedir en la
  siguiente carga de la app, no solo justo después de iniciar sesión.
  Esto también autocura cuentas ya existentes creadas sin departamento
  antes de este cambio, sin ninguna migración.
- **`js/reset.js`**: `loadRegisterDepartments()` (usada por el alta
  pública de profesor/a) se refactorizó a un helper compartido
  `loadDepartamentosInto(selectId, placeholder)` sobre el mismo endpoint
  público `/api/auth?action=departamentos`, reusado ahora también por el
  selector de `#pSeleccionarDepartamento`.
- **`js/roles.js`/`js/api.js`**: `selectDepartamento` mapeado a permiso
  `profile.write` (lo tienen todos los roles autenticados) y a endpoint
  `perfil`.
- No se tocó `oauth/login-google.js`: la lógica de creación de usuario
  (`ensureUser()`) sigue igual, solo cambia lo que pasa después en el
  cliente cuando `departamento` llega vacío.

`sw.js` → `v618`.

---

### 26/08/2026 — Módulos con varios profesores + autoservicio (v619)

Spec: `docs/superpowers/specs/2026-08-26-modulos-multiples-profesores-design.md`.
Plan: `docs/superpowers/plans/2026-08-26-modulos-multiples-profesores.md`.

Al diseñar que el profesor eligiera sus propios módulos/asignaturas tras
elegir departamento (siguiente paso natural tras la autoasignación de
departamento de v618), salió a la luz que `ciclos.responsable` (un solo
nombre de texto libre por módulo) no admite que dos profesores impartan
el mismo módulo — el segundo pisa al primero. Con la asignación pasando a
ser autoservicio (cada profesor se marca a sí mismo, sin nadie
centralizando), ese riesgo dejaba de ser una rareza.

- **Migración `0032_modulo_profesores.sql`**: tabla nueva
  `modulo_profesores(cicloId, modCod, departamento, usuario)`, PK
  compuesta, muchos-a-muchos real por **login**, no por nombre. Backfill
  desde `ciclos.responsable` emparejando por nombre exacto
  (case-insensitive, mismo departamento) — en producción emparejó las 28
  filas que había sin ningún nombre huérfano (verificado con la consulta
  de control antes de dar la migración por buena). `ciclos.responsable`
  **no se borra** (columna histórica inerte, no se vuelve a leer ni
  escribir desde código nuevo).
- **`functions/api/usuarios.js`**: nueva función compartida
  `reemplazarModulosUsuario(db, usuario, departamento, modulosNuevos)`
  (diff completo add+delete) usada por `userAssignModulos` (ahora recibe
  `usuario` en vez de `nombre`) y la acción nueva `selectModulos`
  (autoservicio — usa siempre `data.user`, nunca el body, mismo criterio
  que `selectDepartamento`). `importModulosCSV` mantiene su semántica de
  **fusión** (solo añade, nunca quita) pero ahora inserta directamente en
  `modulo_profesores` por login en vez de pisar `ciclos.responsable` por
  nombre — esto también arregla que antes, dos profesores en el mismo CSV
  para la misma asignatura, el segundo borraba al primero. De paso,
  resolver el departamento del usuario **destino** (en vez de usar el del
  actor) corrige el bug ya documentado de que un superadmin solo podía
  asignar módulos dentro de su propio departamento de referencia.
- **`functions/api/meta.js`**: expone `misModulos` (moduloId del usuario
  logueado) y, por módulo, `responsablesEmails` (correos de otros
  profesores que lo imparten, el propio usuario excluido) — visible para
  cualquier rol de su departamento, no solo admin (decisión ya tomada al
  diseñar esto: correo en vez de nombre, porque puede haber varios).
- **`js/prestamos.js`** (modal admin "📚 Módulos"): `saveModulosUsuario()`
  envía `usuario` en vez de `nombre`; el aviso de "ya lo imparte" pasa de
  un nombre a una lista de correos (`También: correo1, correo2 +N`),
  excluyendo el correo del profesor que se está editando.
- **`js/modal-mis-modulos.js`** (nuevo): checklist agrupada por ciclo
  compartida entre la pantalla de onboarding (`#pSeleccionarModulos`, tras
  guardar departamento) y el modal "📚 Mis módulos" — nuevo botón en la
  topbar general (`#topbarBtns`, visible para cualquier rol autenticado,
  **no** dentro de `#deptMenuWrap`: ese menú está oculto por completo sin
  permiso `config.manage`, así que un profesor normal nunca vería el botón
  si se hubiera puesto ahí — ver Global Constraints del plan).
- **`js/auth.js`**: flag en memoria `_justSelectedDepartamento` (nunca en
  `localStorage`) — se activa en `doSelectDepartamento()` y se consume una
  única vez dentro de `loadData()`, justo después de que `meta.ciclos`
  llega; si `misModulos` está vacío, muestra la pantalla de módulos en vez
  de continuar a Home. Al no persistir el flag, nunca "resucita" en una
  recarga de página ni en un login futuro — solo en el que sigue justo a
  elegir departamento por primera vez.
- **Verificado en producción** (Playwright + `wrangler d1 execute`, cuentas
  de prueba `profe1electricidadelectronica`/`departamentoelectricidadelectronica`,
  limpiadas al terminar): dos profesores en el mismo módulo sin pisarse;
  onboarding completo (departamento → módulos → "Recordar más tarde" sin
  guardar nada → no reaparece sola en la siguiente carga); botón "Mis
  módulos" funcionando en cualquier momento; importación CSV fusionando
  sin pisar asignaciones previas; aviso "También: correo" excluyendo
  correctamente el propio correo del usuario editado.
- Gap ya existente y sin relación con este cambio, detectado durante la
  verificación: `importModulosCSV` no está en `ACTION_PERMISSIONS`
  (`js/roles.js`), así que el gate de `apiPost()` lo bloquea para
  cualquier rol, incluido superadmin, cuando se llama vía `apiPost()` —
  la importación real desde la UI (`js/prestamos.js:importModulosCSV(input)`)
  usa esa misma llamada, así que **hoy no funciona desde el navegador**
  para nadie. No se ha corregido en esta sesión (fuera del alcance del
  plan); pendiente para una sesión futura — añadir
  `importModulosCSV: 'config.manage'` a `ACTION_PERMISSIONS`.

`sw.js` → `v619`.

---

### 26/08/2026 — Fix importModulosCSV: dos bugs de plumbing apilados (v620-v621)

El usuario reportó que "lo de los módulos" no iba bien tras v619 y pidió
arreglarlo. Diagnóstico: no era la tabla `modulo_profesores` ni el
listado — era específicamente el botón "📥 Importar módulos CSV" del
modal 🔐 Usuarios, que fallaba con "No tienes permisos para realizar esta
acción" para cualquier rol, incluido superadmin.

- **v620**: `importModulosCSV` no estaba en `ACTION_PERMISSIONS`
  (`js/roles.js`) — `canAction()` devuelve `false` para cualquier acción
  ausente del mapa, así que `apiPost()` la bloqueaba en el propio
  navegador antes de mandar nada al servidor. Añadido
  `importModulosCSV: 'config.manage'`.
- **v621**: al arreglar el permiso, la petición sí salía pero volvía con
  `HTTP 405` — `importModulosCSV` tampoco estaba en `ENDPOINT_MAP`
  (`js/api.js`), así que `apiPost()` construía la URL con el nombre de la
  acción como endpoint (`/api/importModulosCSV`, inexistente) en vez de
  `/api/usuarios?action=importModulosCSV`. Mismo patrón exacto que el bug
  de `userUnlock` de la sesión anterior (v614) — dos veces en la misma
  semana es señal de que añadir una acción nueva a este proyecto tiene 3
  sitios que tocar (`ACTION_PERMISSIONS`, `ENDPOINT_MAP`, el backend) y es
  fácil olvidar uno. Se hizo un chequeo cruzado de los dos mapas
  (`ACTION_PERMISSIONS` vs `ENDPOINT_MAP`) para confirmar que no queda
  ningún otro hueco de esta forma — no lo hay.
- Verificado end-to-end en producción vía `apiPost()` real (sin bypass):
  una fila ambigua (dos asignaturas con el mismo nombre en el
  departamento) devuelve el error esperado sin romper nada; una fila sin
  ambigüedad se aplica correctamente y queda en `modulo_profesores`.
  Datos de prueba limpiados al terminar.

`sw.js` → `v621`.

---

### 26/08/2026 — Autoservicio de aulas + menú "Mis Cursos/Aulas" (v622)

Extensión directa del autoservicio de módulos (v619): además de qué
módulos/asignaturas imparte, el profesorado puede marcar en qué aulas da
clase. Petición explícita del usuario: sin pantalla de onboarding (a
diferencia de los módulos), solo accesible desde un menú nuevo.

- **Migración**: tabla `aula_profesores(aula, usuario)`, PK compuesta —
  más simple que `modulo_profesores` porque `aulas.id` ya es única por sí
  sola (no hace falta departamento en la clave). Sin backfill (concepto
  nuevo, nada que migrar). Aplicada con `--command` en vez de `--file`
  porque la subida de archivo de wrangler falló varias veces por un fetch
  intermitente esa tarde — el contenido es idéntico, solo cambió el
  mecanismo de aplicarlo.
- **`functions/api/usuarios.js`**: `reemplazarAulasUsuario()` (mismo
  patrón de diff completo que `reemplazarModulosUsuario`) + acción
  `selectAulas` — autoservicio puro, siempre el actor autenticado, sin
  contraparte de admin (no se ha pedido). Sin restricción de departamento
  sobre qué aulas se pueden marcar — el frontend solo ofrece las aulas
  que el usuario ya ve en `AULAS` (global, ya scopeada), así que no hay
  forma de marcar algo que no pudiera ver de todas formas.
- **`functions/api/meta.js`**: `misAulas` (array de `aula.id`) para el
  usuario logueado.
- **UI**: el botón "📚 Mis módulos" de la topbar se convierte en un menú
  desplegable "📌 Mis Cursos/Aulas" (reusa el mismo componente visual que
  ⚙️ Departamento — `.dept-menu-wrap`/`.dept-menu`/`.dept-menu-item`,
  incluido su comportamiento responsive en móvil, sin escribir CSS
  nueva) con dos opciones: "📚 Módulos" y "🏫 Aulas". El modal de aulas
  (`js/modal-mis-aulas.js`) es una lista plana con buscador, sin agrupar
  por ciclo como los módulos — las aulas no tienen esa jerarquía.
- **Lección de esta sesión aplicada aquí**: antes de dar por cerrado el
  permiso/endpoint, se corrió el mismo chequeo cruzado
  `ACTION_PERMISSIONS` vs `ENDPOINT_MAP` que destapó los bugs de
  `userUnlock` e `importModulosCSV` — esta vez `selectAulas` se añadió a
  los dos mapas a la vez y se verificó antes de desplegar, sin repetir el
  fallo.
- Verificado en producción con Playwright + `wrangler d1 execute`
  (cuenta `profe1electricidadelectronica`): el menú se despliega con las
  dos opciones, el modal de aulas lista las 72 aulas visibles para su
  departamento, guardar persiste en `aula_profesores`, y una recarga
  completa de sesión carga `MIS_AULAS` sin mostrar ninguna pantalla de
  onboarding. Datos de prueba limpiados al terminar.

`sw.js` → `v622`.

---

### 26/08/2026 — Inicio filtrado a "mis aulas" (v623)

Pregunta abierta del usuario ("algo que se te ocurra para facilitar al
profesorado") → propuesta: usar `MIS_AULAS` (recién construido en v622)
para que Inicio no obligue a un profesor a buscar su aula entre las
decenas del departamento. El usuario pensaba que Inicio ya filtraba así
— no era el caso, solo excluía aulas sin ítems (filtro pre-existente sin
relación con el profesor logueado). Confirmó no tocar préstamos/reservas:
puede necesitar material de otra aula o departamento.

- **`js/home.js`** (`renderHome()`): `aulaEntries` gana un segundo filtro
  — si `roleLabel()==='Profesor/a'` **y** `MIS_AULAS.length>0` **y** no
  está activo `home_ver_todas_aulas` en `localStorage`, se cruza con
  `MIS_AULAS`. Jefe/a de departamento y superadmin nunca se filtran
  (`roleLabel()` no es `'Profesor/a'` para ellos). Un profesor que
  todavía no ha elegido ninguna aula ve todo, igual que hoy — el filtro
  solo se activa una vez hay datos que filtrar.
- Nueva función `toggleVerTodasAulas()`: alterna
  `localStorage.home_ver_todas_aulas` y vuelve a pintar Inicio — persiste
  entre sesiones, igual que el patrón ya usado para
  `home_sec_cats`/`home_sec_ciclos`.
- **`index.html`**: enlace `🏫 Ver solo mis aulas` / `🏫 Ver todas las
  aulas` junto al encabezado "Por aula / espacio", oculto por defecto y
  solo visible cuando aplica.
- Sin backend nuevo — toda la información ya existía desde v622.
- Verificado en producción con Playwright + `wrangler d1 execute`: con
  2 aulas marcadas, Inicio muestra solo esas 2 (de las 9 con ítems que
  tiene el departamento); "Ver todas las aulas" restaura las 9 y cambia
  el texto del enlace a "Ver solo mis aulas". No se pudo repetir la
  prueba con una cuenta de jefe/a de departamento por no tener su
  contraseña a mano — el filtro depende de `roleLabel()`, ya usado y
  verificado extensamente en el resto del proyecto, así que el riesgo de
  que se cuele para ese rol es bajo, pero queda sin comprobar
  explícitamente en esta sesión.

`sw.js` → `v623`.

---

### 26/08/2026 — Aviso de descubrimiento + alertas acotadas a "mis aulas" (v624)

Dos sugerencias propuestas ante la pregunta abierta del usuario ("otra
sugerencia para facilitar al profesorado"), ambas aprobadas: un aviso de
que el menú "📌 Mis Cursos/Aulas" existe (para quien nunca lo abre y por
tanto nunca activa el filtro de Inicio de v623), y que las tarjetas de
alerta de Inicio también respeten ese filtro — con la condición explícita
del usuario de dejar claro que las cifras se refieren a sus propias aulas.

- **Aviso descartable**: reutiliza el mecanismo genérico
  `showFeatureHintOnce(key, elId)`/`dismissFeatureHint(key, elId)` ya
  creado en v609 para Mantenimiento/Pedidos/Reservas — sin código nuevo
  de persistencia, solo un banner `.feature-hint` más (`#hintMisCursosAulas`,
  clave `misCursosAulas`) en `index.html`, arriba del todo en Inicio.
  Condición para mostrarlo: rol Profesor/a y (`MIS_MODULOS` vacío o
  `MIS_AULAS` vacío) — se oculta explícitamente en `renderHome()` si deja
  de cumplirse, no basta con omitir la llamada a `showFeatureHintOnce()`
  (ese helper nunca oculta un hint que ya estuviera visible de un render
  anterior, solo decide si mostrarlo la primera vez).
- **`js/home.js`**: el cálculo de `filtrarPorMisAulas` (antes calculado
  solo para el grid de aulas, ver v623) se sube al principio de
  `renderHome()` para poder reutilizarlo también en las tarjetas de
  cabecera. `low`/`mant` se calculan sobre `items` acotado a `MIS_AULAS`
  cuando el filtro está activo, y las etiquetas de esas dos tarjetas
  ganan un `<span class="scard-lbl-sub">(tus aulas)</span>` (clase nueva
  en `css/styles.css`, anula el `text-transform:uppercase`/`color:red`
  que heredaría de `.scard-alert .scard-lbl` para que se lea como una
  aclaración discreta, no como parte de la alerta). Las tarjetas de
  "Ítems"/"Unidades" no se tocan — siguen siendo el total del
  departamento, solo se acotaron las dos de alerta, que es lo que se
  pidió.
- **Deliberadamente sin tocar**: `goLowStock()`/`goMaintenance()` (el
  clic en esas tarjetas) siguen abriendo la vista completa del
  departamento sin acotar — acotar también ese destino tocaría el filtro
  central de `js/inventory.js` (usado por más sitios, no solo estas dos
  tarjetas) y no se pidió explícitamente. Queda anotado como posible
  inconsistencia menor (tarjeta acotada → lista sin acotar al clicar) por
  si se quiere cerrar en una sesión futura.
- Verificado en producción con Playwright + `wrangler d1 execute`: el
  aviso aparece para una cuenta sin módulos/aulas, se descarta con
  "Entendido" y no reaparece tras recargar; con una aula marcada, la
  tarjeta de Stock bajo pasó de mostrar el total del departamento (456) a
  solo el de esa aula (411), con la etiqueta "(tus aulas)" visible en el
  HTML de ambas tarjetas. Datos de prueba limpiados al terminar.

`sw.js` → `v624`.

---

### 26/08/2026 — Atajos cuando solo tienes un aula propia (v625)

Tercera ronda de sugerencias tras la pregunta abierta del usuario, ambas
aprobadas: aprovechar `MIS_AULAS` (v622) para saltar el selector de aula
en los flujos donde ya se pregunta por una, cuando el profesor solo tiene
una propia — sin cambios para quien tiene varias o ninguna, que siguen
viendo exactamente el mismo selector de siempre.

- **`js/multi-equipo.js`/`js/revision-aula.js`**: `openMultiEquipo()`/
  `openRevisionAula()` ya tenían una rama para "sin aula de contexto,
  entrada directa desde Home" que mostraba un `<select>` con todas las
  aulas (`_abrirMultiEquipoConPicker()`/`_abrirRevisionAulaConPicker()`).
  Antes de caer a esa rama, si `MIS_AULAS.length===1` se llama
  directamente a `_iniciarMultiEquipo(MIS_AULAS[0])`/
  `_iniciarRevisionAula(MIS_AULAS[0])`, igual que si se hubiera abierto
  ya dentro de esa aula (`cf.type==='aula'`).
- **`js/modal-item.js`** (`openModal()`, prefill de `f_aula`): la cadena
  de prioridad ya existente (ítem existente → aula actual del contexto →
  última aula usada en cámara `cam_last_aula` → primera aula de la lista
  como último recurso arbitrario) gana un escalón nuevo entre las dos
  últimas: si hay `MIS_AULAS` con una sola aula, se usa esa en vez de
  `AULAS[0]?.id` — solo cambia el último recurso, nunca compite con una
  señal más específica (aula actual o la usada hace un momento con la
  cámara, que puede ser otra distinta si el profesor está cubriendo una
  clase que no es la suya).
- **`js/agente-widget.js`** (intención `resumen_aula`): si
  `extraerAulaDeFrase(q)` no encuentra ninguna aula nombrada pero la
  frase contiene "mi aula"/"mis aulas" (regex `/\bmi(s)?\s+aula(s)?\b/`
  sobre `n`, ya normalizado en ese punto de la función) y
  `MIS_AULAS.length===1`, se resuelve esa aula directamente contra
  `AULAS` por id. Si la frase pide "mi aula" pero el usuario tiene 0 o
  varias, el mensaje de "¿de qué aula quieres el resumen?" se adapta para
  decírselo explícitamente (que aún no ha elegido ninguna, o que tiene
  varias y tiene que decir cuál) en vez del genérico de siempre.
- Verificado en producción con Playwright + `wrangler d1 execute`, cuenta
  de prueba con una sola aula marcada (`electricidadelectronica-aula35`):
  `openModal()` precargó esa aula en el desplegable; `_multiAulaId`/
  `_revisionAulaId` quedaron con esa misma aula sin mostrarse ningún
  picker; en el chat real de Volt, "¿Qué hay en mi aula?" devolvió
  directamente el resumen de Aula 35 sin pedir aclaración. Dato de prueba
  limpiado al terminar.

`sw.js` → `v625`.

---

### 26/08/2026 — Hints flotantes con flecha + dos hints estáticos nuevos (v626)

El usuario preguntó por el tour de cámara ("¿dónde está la guía de uso?"):
se le explicó que `js/onboarding-camara.js` es un tour de 4 pantallas
específico de cámara (localStorage `tour_camara_visto_v1`), no una guía
general — y que con la cuenta de pruebas usada toda la sesión ya estaba
descartado de antes. Propuesta y aprobada una mejora: más hints
descartables, y un nuevo tipo "flotante" con flecha que apunta a un botón
real en vez de vivir como banner fijo en el flujo.

- **`js/ui-helpers.js`** — `showPointerHintOnce(key, targetGetter, html)`/
  `dismissPointerHint(key)`/`_positionPointerHint(box, target)`: un único
  nodo compartido `#floatingHintBox` (creado perezosamente, reutilizado
  entre llamadas) posicionado con `getBoundingClientRect()` del elemento
  que devuelve `targetGetter` (una función, no un id fijo — permite
  recalcular qué botón está realmente visible). Misma clave de
  `localStorage` (`hint_<key>_visto`) que los banners estáticos de
  siempre, así que un hint estático puede sustituirse por uno flotante
  sin que reaparezca para quien ya lo había descartado. Reposiciona en
  `resize` mientras está visible; `box.dataset.key` guarda qué hint es el
  que se está mostrando ahora mismo, para poder ocultarlo desde fuera sin
  pisar un hint distinto que pueda estar activo.
- **CSS** (`css/styles.css`): `.pointer-hint`/`.pointer-hint-arrow` —
  burbuja `position:fixed` con flecha CSS (border-trick) apuntando hacia
  arriba, mismos tokens de color que `.feature-hint` (`--accent`/
  `--accent-l`) para que ambos estilos de hint se vean coherentes.
- **Sustituido el banner estático de "Mis Cursos/Aulas" (v624) por uno
  flotante**: `js/nav.js` gana `_misCursosHintTarget()` — devuelve
  `#btnMisCursos` si está visible (`offsetParent!==null`) o si no
  `#mobMenuBtn` (topbar colapsado a menú hamburguesa en móvil). Mismo
  disparador que antes en `renderHome()` (profesor sin módulos ni aulas
  elegidos), misma clave `misCursosAulas`. Se retira el `<div
  class="feature-hint" id="hintMisCursosAulas">` de `index.html` — ya no
  hace falta un elemento fijo en el DOM para este hint.
- **Dos hints estáticos nuevos** (mecanismo sin cambios, solo banners
  nuevos):
  - Inventario (`#hintInvFijar`, clave `invFijar`): "Abre el menú ⋮ de
    cualquier ítem para fijarlo en Inicio" — dispara en `renderInv()`
    (`js/inventory.js`) la primera vez que hay datos cargados. La función
    "Fijar en Inicio" vive dentro del menú contextual ⋮ de cada fila sin
    ninguna pista visual previa.
  - Ficha de ítem (`#hintItemFotos`, clave `itemFotos`): "puedes añadir
    hasta 3 fotos... y marcar cuál es la principal (★)" — dispara en
    `openModal()` (`js/modal-item.js`) tras `_setFotosEditingFromMain()`,
    solo si `!readonly` (no tiene sentido para quien solo puede ver la
    ficha, ni el botón de añadir/marcar principal aparece para ese rol).
- Verificado en producción con Playwright: cuenta de prueba
  `profe1electricidadelectronica` tenía la contraseña cambiada desde una
  sesión anterior (`password_temporal=0`, ya no era la de la tabla de
  credenciales) — reseteada temporalmente con `userResetPassword` desde
  `Seba` (superadmin) para poder volver a entrar. Con eso: el hint
  flotante apareció exactamente debajo de "📌 Mis Cursos/Aulas" (flecha
  centrada, posición confirmada por coordenadas — `top`/`left` cuadran
  con `getBoundingClientRect()` del botón), "Entendido" lo oculta y fija
  `hint_misCursosAulas_visto=1`; el hint de Inventario apareció en la
  vista de Aula 35; el hint de la ficha apareció al abrir "＋ Nuevo ítem".
  Ítem de prueba cerrado sin guardar.

`sw.js` → `v626`.

---

### 26/08/2026 — Asignación de aulas por admin, para cualquier usuario (v627)

El usuario notó la asimetría: desde 🔐 Usuarios de la app, un superadmin/
jefe puede asignar **módulos** a cualquier usuario gestionado (botón "📚
Módulos", acción `userAssignModulos`), pero las **aulas** solo existían
como autoservicio (`selectAulas`, siempre el propio actor logueado — el
comentario en `usuarios.js` decía literalmente "sin admin equivalente
todavía"). Pidió cerrar ese hueco para cualquier rol de usuario
gestionado (profesor, jefe/a, superadmin/admin).

- **`functions/api/usuarios.js`**: nueva acción `userAssignAulas` —
  mismo patrón que `userAssignModulos` (resuelve el departamento del
  usuario **destino**, no del actor; solo un jefe de un departamento
  distinto al del destino recibe 403; superadmin sin restricción),
  reutiliza `reemplazarAulasUsuario()` ya existente (creada para
  `selectAulas`, sin cambios). `getUsers` gana una tercera consulta
  (`aula_profesores JOIN usuarios`, con el mismo filtro por
  departamento que ya tenían las otras dos) y devuelve `usuarios[].aulas`
  igual que ya hacía con `.modulos`.
- **`js/prestamos.js`**: botón nuevo "🏫 Aulas (N)" junto a "📚 Módulos
  (N)" en cada fila de 🔐 Usuarios de la app. `openAulasUsuario(i)` /
  `_renderAulasUsuarioList(query)` / `_toggleAulaUsuario` /
  `filterAulasUsuario` / `closeAulasUsuario` / `saveAulasUsuario()` —
  lista plana sin agrupar (como `js/modal-mis-aulas.js`, el equivalente
  de autoservicio), contra `AULAS` con un `Set` propio
  (`_aulasUsuarioSeleccionadas`) en vez de `MIS_AULAS`. `_usuariosEditing`
  gana `_aulas: u.aulas || []` junto a `_modulos`.
- **`index.html`**: modal nuevo `#mAulasUsuario`, calcado de
  `#mModUsuario` pero con buscador plano en vez de grupos por ciclo.
- **`js/roles.js`/`js/api.js`**: `userAssignAulas` añadida a
  `ACTION_PERMISSIONS` (`config.manage`, igual que `userAssignModulos`)
  y a `ENDPOINT_MAP` (`usuarios`) — las dos a la vez, mismo cross-check
  que evitó el bug de `importModulosCSV` en v620-v621.
- **Limitación heredada, no nueva**: igual que ya pasaba con
  `openModulosUsuario()` (usa el `CICLOS` global del actor, no del
  departamento del usuario gestionado), `openAulasUsuario()` usa el
  `AULAS` global del actor — para un superadmin gestionando un usuario
  de otro departamento sin haber seleccionado ese departamento como
  activo (`#deptActivoSelect`), la lista de aulas a marcar sería la de
  su propio departamento de referencia, no la del usuario destino. No es
  un bug introducido aquí, es la misma arquitectura que ya tenía el
  equivalente de módulos; se deja igual por consistencia, sin ampliar el
  alcance de esta sesión.
- Verificado en producción con Playwright + `wrangler d1 execute`:
  logueado como `Seba` (superadmin), abierto 🔐 Usuarios → fila de
  `profe1electricidadelectronica` → "🏫 Aulas" → buscador filtra
  correctamente ("Aula 36" → 1 resultado) → marcar y guardar escribe la
  fila en `aula_profesores` (confirmado por consulta directa a D1) y
  actualiza el badge a "🏫 Aulas (1)" sin recargar. Fila de prueba
  borrada al terminar.

`sw.js` → `v627`.

---

### 26/08/2026 — Cuatro mejoras para el uso diario del profesorado (v628)

El usuario (perfil de docente/jefatura) pidió priorizar cuatro piezas de
un roadmap más amplio: plantillas de práctica, préstamo/devolución QR
rápido, solicitudes de material separadas de pedidos, y un "Modo clase"
móvil — dejando fuera, de momento, la pantalla "Mi jornada" como nuevo
Inicio.

- **Plantillas de práctica** (`js/reservas-practica.js`, `index.html`):
  sección "📋 Plantillas guardadas" dentro del modal de "Planificar
  práctica" + botón "💾 Guardar como plantilla". Personales y locales al
  navegador — `localStorage` con clave `reservas_plantillas_<usuario>`
  (namespaced por usuario para no mezclar plantillas en un PC compartido
  del taller), sin backend ni migración. Guarda solo ciclo/módulo, aula y
  material+cantidades — fecha, profesor/a y observaciones se rellenan de
  nuevo cada vez a propósito, porque cambian en cada uso. `aplicarPlantilla()`
  reutiliza el mismo criterio de filtrado que `duplicarReservaPractica()`
  (ya existente, sin tocar): descarta ítems que ya no existen o se
  quedaron sin stock, avisando cuántos se excluyeron.
- **Préstamo/devolución QR rápido** (`js/qr-scanner.js`, `index.html`,
  `css/styles.css`): tras `_showQrActions()`, `_renderQrQuickActions()`
  calcula si el docente logueado (emparejado por nombre contra
  `loanTeacherOptions()`, mismo criterio que usa el resto de la app para
  preseleccionar profesor) tiene un préstamo activo de ese ítem — si sí,
  botón principal "📥 Devolver (tú)"; si hay stock, "🙋 Me lo llevo" (1
  unidad, con su aula habitual si tiene exactamente una elegida en 📌 Mis
  Cursos/Aulas, mismo patrón que ya usan `revision-aula.js`/
  `multi-equipo.js`). Ambos piden confirmación (`confirmDialog`) y
  reutilizan sin cambios los endpoints `prestar`/`devolver` de
  `functions/api/prestar.js`. El botón "⌛ Prestar / Devolver" completo
  sigue como alternativa. Todo gateado por `loans.write` (`requirePerm` +
  oculto si no aplica).
- **Solicitudes de material** — flujo nuevo y deliberadamente separado de
  🛒 Pedidos (que exige un `itemId` ya existente en inventario): un
  docente pide algo aunque no esté dado de alta todavía.
  - Migración `0034_solicitudes_material.sql`: tabla `solicitudes_material`
    (departamento, nombre, cantidad, nota, estado, respuesta, creadoPor,
    creadoPorNombre, fecha, actualizadoEn) — aplicada en remoto.
  - `functions/api/solicitudes.js` (nuevo): `solicitudCrear` (cualquier
    docente, scoping por departamento del actor, sin más restricción de
    rol — mismo criterio que `pedidoAdd`) y `solicitudUpdate` (**valida
    en backend**, no solo en frontend, que el actor sea jefatura o
    superadmin, y que la solicitud pertenezca a su departamento —
    devuelve 403 si no).
  - `functions/api/list.js`: nueva tabla en `Promise.all`, scoping
    estricto por departamento (igual que `pedidos`, sin mezclar con el
    departamento genérico `iesjuanbosco`), expuesta como `solicitudes` en
    la respuesta.
  - `js/roles.js`/`js/api.js`: permisos `solicitudes.write` (añadido a
    `_PERMS_PROFE`) y `solicitudes.manage` (solo vía el comodín `*` de
    jefe/superadmin) en `ACTION_PERMISSIONS`; endpoints mapeados a
    `solicitudes` en `ENDPOINT_MAP`.
  - `js/solicitudes.js` (nuevo) + modal `#mSolicitudes`: formulario de
    alta + lista — "Mis solicitudes" para docentes, "Todas las
    solicitudes del departamento" para jefatura/superadmin (con
    `<select>` de estado inline, pide una respuesta opcional vía
    `prompt()`). Badge de pendientes en el botón de topbar (`#solBadge`,
    mismo patrón que `#pedBadge`).
  - Sin notificación por email al crear una solicitud (pedidos/préstamos
    sí notifican al jefe) — se puede añadir después con el mismo patrón
    de `sendGmail()` si hace falta; no estaba en el criterio de esta
    sesión y se dejó fuera para no ampliar el alcance.
- **Modo clase** (`js/modo-clase.js`, nuevo, página `#pModoClase`): vista
  móvil reducida con 4 botones grandes — Escanear QR (`openQrScanner()`),
  Preparar práctica (`openReservaPractica()`), Devolver material
  (`mcDevolverFoco()`, hace scroll al resumen de préstamos propios de la
  misma página en vez de abrir un picker nuevo — cada línea ya tiene su
  botón de devolución directa) y Solicitar material
  (`openSolicitudesModal()`). Resumen propio: préstamos activos,
  próximas reservas de práctica y solicitudes pendientes, todos
  filtrados por el mismo emparejamiento "profesor propio" que el QR
  rápido. Acceso desde topbar (🎒, gateado por `loans.write`) y desde
  Inicio; ruta `#modoclase` añadida a `navigateFromHash()`
  (`js/nav.js`). No sustituye Inicio/Inventario/Préstamos.
- Sin tocar: `js/prestamos.js` (excepto lectura, sin ediciones),
  `js/modal-item.js`, `js/state.js`/`js/api.js`/`js/roles.js` solo con
  las líneas mínimas de fontanería (nuevo estado `solicitudes`, nuevo
  endpoint, nuevos permisos) — nada de lo existente se reescribió.
- Verificación de esta sesión: `node --check` sobre los 9 archivos
  JS tocados/nuevos y los 2 backend nuevos/tocados (sin errores),
  balance de etiquetas `<div>`/`<button>`/`<span>`/`<select>` y de llaves
  CSS en `index.html`/`css/styles.css` (cuadrados), grep de colisión de
  nombres de función nueva contra todo `js/`+`functions/` (ninguna
  duplicada). No se probó en navegador real (sin Playwright en esta
  sesión) — pendiente verificación visual manual de los 4 flujos.

`sw.js` → `v628`. Migración `0034` aplicada en remoto
(`npx wrangler d1 execute boscoinventario --remote`).

---

### 26/08/2026 — QR rápido extendido a serie/foto + email de solicitudes (v629)

Dos ajustes pedidos justo después de v628: (1) el préstamo/devolución
rápido no debía depender solo de escanear un QR — también tenía que
funcionar identificando el ítem por número de serie o por foto al
objeto; (2) las solicitudes de material debían avisar por email al
jefe/a de departamento al crearse, igual que ya hace 🛒 Pedidos.

- **Préstamo/devolución rápido unificado en los 3 flujos de cámara**
  (`js/qr-scanner.js`, `js/camara-unificada.js`, `js/camara-serie.js`):
  la pieza clave ya existía — `_showQrActionsStandalone(itemId)`
  (`js/qr-scanner.js`) abre el panel de acciones con "📥 Devolver (tú)" /
  "🙋 Me lo llevo" (añadidos en v628) sobre cualquier ítem, sin importar
  cómo se identificó. Antes solo la detección de **QR** dentro de
  `camara-unificada.js` lo usaba (`_mostrarAccionesQrEnModalUnificado`);
  el resto de rutas (código de barras, número de serie leído por IA,
  candidato fuzzy, "foto al objeto"/visual) llamaban a `openItemRoute()`
  y abrían directamente la ficha completa, sin las acciones rápidas.
  Se sustituyeron esas llamadas por `_showQrActionsStandalone()` en 7
  puntos: `_abrirExactoSerieConfirmado()`, el match exacto por código de
  barras y por IA dentro de `capturarSerie()`, los candidatos de
  `_mostrarVisualCandidatos()` y de `serieAbrirCandidato()`
  (`camara-serie.js`), y el match exacto y `camaraUnifAbrirCandidato()`
  (`camara-unificada.js`) — más `_mostrarAccionesQrEnModalUnificado()`
  ahora acepta un segundo parámetro `titulo` para reenviarlo. No se tocó
  ninguna otra llamada a `openItemRoute()` del proyecto (favoritos,
  historial, búsqueda, Volt) — esas sí deben abrir la ficha completa,
  no forman parte de este flujo.
  - **Encabezado del panel dinámico**: como el mismo panel de
    `#mQrScanner` ahora se reutiliza desde código de barras/serie/foto y
    no solo desde QR, el título estático "🔍 Escanear QR" habría quedado
    engañoso. Se le puso `id="qrModalTitle"` (`index.html`) y
    `_showQrActionsStandalone(itemId, tituloModal)` acepta un segundo
    argumento opcional que lo sobrescribe ("🔢 Código detectado", "🔢
    Número de serie detectado", "📷 Objeto identificado", etc.);
    `openQrScanner()` lo resetea a "🔍 Escanear QR" al abrir el escáner
    normal, para que no quede un título de una sesión anterior.
  - El dato del ítem que necesitan las acciones rápidas (stock, aula,
    módulo, foto) sale siempre del array `items` ya cargado en memoria
    (`items.find()`), nunca de los objetos parciales que devuelven los
    endpoints de búsqueda (`buscarPorSerie`/`buscarSeriePorCodigo`
    devuelven filas completas en los matches exactos, pero los
    candidatos "visual"/fuzzy solo traen `id,item,ref,aula,cat`) — como
    todo el inventario del departamento ya está en `items` desde
    `loadData()`, esto funciona igual de bien que ya funcionaba para
    `openItemRoute()` antes del cambio, sin ninguna petición extra.
- **Email al crear una solicitud** (`functions/api/solicitudes.js`):
  añadidas `getGmailAccessToken()`/`sendGmail()` (mismo código que
  `pedidos.js`/`prestar.js`, sin factorizar — el proyecto ya duplica
  esas dos funciones en cada `functions/api/*.js` que envía correo, ver
  nota en `_middleware.js`/`docs/SECURITY.md` sobre el mismo patrón con
  el hash de contraseñas). Tras `solicitudCrear`, si el departamento
  tiene un/a jefe/a con email registrado, se le envía un aviso HTML con
  material/cantidad/comentario — silencioso si no hay credenciales
  Gmail configuradas o nadie con email, igual que `pedidoAdd`. **No**
  se añadió aviso al docente cuando jefatura cambia el estado
  (`solicitudUpdate`) — no se pidió esta vez; el docente ya puede
  consultarlo en 🧰 Solicitudes o en 🎒 Modo clase.
- Verificación: `node --check` en los 4 archivos JS tocados + el backend
  (sin errores), balance de etiquetas HTML y `grep` de todas las
  llamadas a `openItemRoute()` restantes en el proyecto para confirmar
  que solo quedaban las que debían quedar. No se probó en navegador real
  en esta sesión.

`sw.js` → `v629`.

---

### 27/08/2026 — Fix: aulas numeradas duplicadas quedaban varadas al final del listado (v630)

El usuario reportó que las aulas 35, 36, 38, 39, 40, 41 y 44 aparecían
**después** de todas las demás aulas ordenadas por número, justo tras
importar ítems que antes vivían en esas aulas.

Causa: el `ORDER BY` de `aulas` en `meta.js`/`list.js` (`CASE WHEN id GLOB
'aula[0-9]*' THEN CAST(SUBSTR(id,5) AS INTEGER) ELSE orden END, orden,
id`) solo reconoce como "numerada" una fila cuyo **id** tiene la forma
exacta `aulaN` (las 70 globales sembradas en
`migrations/0008_aulas_seed.sql`). Cualquier fila que represente la misma
aula pero con otro id — una fila propia de departamento creada a mano con
"+ Añadir aula" y renombrada "Aula 35" (id `aula_<timestamp>` o, tras el
slug de `saveAulas()`, `aula_35` — no cumple el GLOB porque el carácter
tras "aula" no es un dígito), importada por CSV de aulas
(`js/modal-aulas.js` línea ~169, id `aula_<timestamp>_<índice>`), o creada
por una restauración de backup que prefija el id con el departamento
(`functions/api/item.js`, sección `aulas` del restore) — cae en la rama
`ELSE orden`, y las aulas propias usan `orden` 101+ **a propósito** (ver
entrada v593→v594 más arriba) para ir después de las 70 globales. Cada
departamento con una fila propia "Aula N" duplicando el nombre de una
global termina con esa fila varada al final, sin importar el número que
lleve en el nombre.

Fix en `functions/api/meta.js` y `functions/api/list.js`: la consulta SQL
se simplifica a `ORDER BY orden, id` y el orden numérico real se calcula
ahora en JS, tras leer las filas — `aulaNum(row)` prueba primero el id
(`^aula(\d+)$`) y si no matchea busca un número en el **nombre**
(`/(\d+)/`). `sortAulas(rows)` ordena por ese número cuando existe en
cualquiera de las dos filas comparadas (con `orden`/`id` como desempate
para duplicados del mismo número), y deja las aulas sin número (talleres
de departamento tipo "Tecnología") al final, ordenadas por `orden`/`id`
como antes. Duplicado en ambos archivos siguiendo el patrón ya existente
del proyecto (sin módulo compartido entre `functions/api/*.js`).

Nota: esto corrige el **orden de lectura** para cualquier fila mal
etiquetada ya existente en producción, sin tocar los datos — no fusiona ni
borra los duplicados "Aula 35" que puedan haber quedado en el
departamento del usuario (una fila global sin dueño y otra propia con el
mismo nombre), que seguirán existiendo como dos entradas separadas
adyacentes en el listado. Verificado con un test aislado en Node
reproduciendo el escenario exacto reportado (35, 36, 38, 39, 40, 41, 44
como filas con id no-`aulaN`) — el resultado ordena 1..45 correctamente,
con el taller de departamento al final. `node --check` sobre los dos
archivos tocados, sin errores. No verificado contra D1 real (sin
credenciales `CLOUDFLARE_API_TOKEN` en este sandbox).

`sw.js` → `v630`.

---

### 27/08/2026 — Usabilidad para profesorado: buscador de material, plantillas desde Modo clase, franja normalizada, sin `prompt()` (v631)

Sesión de seguimiento a una revisión de usabilidad "puesto en el papel de
profesor/a" (sin código, solo análisis) — cinco mejoras concretas sobre
funciones ya existentes del profesorado, todas en frontend, sin cambios de
esquema D1:

1. **Guardar plantilla sin `prompt()` nativo** (`js/reservas-practica.js`):
   `guardarPlantillaActual()` usaba `prompt()` del navegador, rompiendo el
   estilo del resto de la app y sin validar en el sitio. Ahora es una fila
   inline en el propio panel de "Planificar práctica"
   (`resPlantillaGuardarInputWrap` en `index.html`, toggle con
   `toggleGuardarPlantillaInput()`), con `markFieldError()` si se intenta
   guardar sin nombre — mismo helper que ya usa el resto de formularios
   (`js/ui-helpers.js`).
2. **Buscador de ítems en "Añadir material" en vez de `<select>`+botón**:
   `res_itemSelect` sustituido por `res_itemResults`, una lista de
   resultados clicables (mismo patrón que `delPickerList` en
   `js/inventory.js`, ya usado en el picker de "Baja/Eliminar") — clic
   directo añade la línea, sin paso intermedio de seleccionar en un
   desplegable largo. Los ítems ya añadidos aparecen marcados y
   deshabilitados (`_renderReservaItemResults()`, refrescado también tras
   quitar una línea, aplicar plantilla o duplicar una reserva).
3. **Plantillas accesibles desde 🎒 Modo clase** (`js/modo-clase.js`):
   nueva tarjeta "📋 Tus plantillas de práctica" en el resumen de Modo
   clase con un chip por plantilla — `mcUsarPlantilla(id)` abre
   "Planificar práctica" y aplica la plantilla en un solo toque, en vez de
   tener que entrar primero al modal completo a buscarla.
4. **Solicitudes de material recientes visibles en Modo clase**
   (`js/solicitudes.js`, `_misSolicitudesRecientes()`): antes Modo clase
   solo miraba `_misSolicitudesPendientes()`, así que una solicitud recién
   aceptada/descartada por jefatura desaparecía del resumen sin que el
   profesor llegara a ver la respuesta. Ahora se incluyen también las
   resueltas en los últimos 7 días (por `actualizadoEn`), mostrando estado
   y la `respuesta` de jefatura si la hay. Tarjeta renombrada "🧰 Tus
   solicitudes" (ya no solo "pendientes").
5. **Franja horaria como desplegable en vez de texto libre**
   (`res_franja` en `index.html` + `onFranjaChange()`/`getFranjaValue()`
   en `js/reservas-practica.js`): opciones fijas (1ª-6ª hora, Recreo) +
   "Otra…" que revela un campo de texto (`res_franja_otra`) para casos no
   cubiertos. El backend (`functions/api/prestar.js:247-262`) ya comparaba
   `fecha`+`franja` exactos para evitar que dos profesores planifiquen la
   misma franja con el mismo material sin avisar — con texto libre ("1ª
   hora" vs. "9-10h" para el mismo hueco real) ese chequeo podía fallar en
   silencio; con vocabulario fijo compartido, dos profesores que eligen la
   misma opción siempre chocan correctamente. Sin cambio de backend: sigue
   viajando como el mismo string `franja`.

Explícitamente **no se tocó**: "Historial de cambios en modal de edición"
(pedido pendiente en `docs/IDEAS.md`) resultó ya estar implementado desde
antes — `openHistorial()`/`btnHistorial` en `js/modal-item.js` +
`GET /api/historial?itemId=` en `functions/api/historial.js` (accesible a
cualquier usuario del departamento del ítem, no solo jefatura/superadmin).
`docs/IDEAS.md` actualizado para reflejarlo.

Verificado con `node --check` sobre los tres archivos JS tocados. No
probado en navegador real en esta sesión (sandbox sin servidor Cloudflare
Pages disponible).

`sw.js` → `v631`.

---

### 27/08/2026 — Verificación en navegador real de v631 + cómo levantar el stack completo en sandbox sin credenciales Cloudflare

Sesión de seguimiento a la anterior (v631): la vez pasada no se pudo
probar en navegador por falta de servidor. Esta sesión sí lo consiguió,
contra la app real (frontend + `functions/api/` + D1), sin tocar la base
remota de producción ni necesitar `wrangler login`. Queda documentado el
método porque no es obvio y probablemente haga falta repetirlo:

**1. D1 local sembrada con las migraciones reales del proyecto** (no una
base de pega con 3 tablas): aplicar `migrations/0001_*.sql` en adelante,
en orden, con `npx wrangler d1 execute boscoinventario --local
--file=migrations/00XX_....sql`. Dos migraciones fallan en un replay
desde cero por asumir estado de una migración anterior no presente tal
cual en el historial real (`0019_pantallas_pizarras_inventariable.sql`:
columna `tipo_material` que en producción ya existía por otra vía;
`0021_restaurar_ciclos_electricidad.sql`: constraint UNIQUE porque
`0009`/`0010` ya habían sembrado esas filas) — son fallos esperados de
replay histórico, no bugs; se ignoran y se sigue con la siguiente
migración. El resto (hasta `0034`) aplica limpio y deja usuarios de
prueba ya sembrados (`Seba`/`Seba` superadmin, `profe1tecnologia` con la
misma contraseña, etc. — ver tabla de credenciales en este mismo
archivo) más aulas/ítems de ejemplo, sin tener que inventar datos a mano.

**2. `wrangler pages dev` — el binding D1 hay que dejar que lo lea de
`wrangler.toml`, NO pasarlo por `--d1=DB` en la CLI.** Con
`--d1=DB` (solo el nombre del binding, sin id), Pages crea una D1 local
**distinta y vacía** — un sqlite nuevo bajo un hash distinto en
`.wrangler/state/v3/d1/`, no el mismo que sembró el paso 1 — y todas las
peticiones fallan con `no such table: usuarios`. La solución es arrancar
sin ese flag: `npx wrangler pages dev . --port=8788 --local
--compatibility-date=2024-01-01` — al no pasarlo por CLI, wrangler sí lee
el `[[d1_databases]]` de `wrangler.toml` (mismo `database_id`) y reutiliza
el sqlite ya sembrado.

**3. El binding `[ai]` de `wrangler.toml` bloquea el arranque en
`--local`.** Cloudflare Workers AI no tiene emulación local — incluso en
modo `--local`, Miniflare intenta abrir una "remote proxy session" para
ese binding, y sin `CLOUDFLARE_API_TOKEN` (no disponible en este sandbox,
`wrangler login` es interactivo) el servidor entero no arranca. Solución
para pruebas locales: comentar temporalmente `[ai]`/`binding = "AI"` en
`wrangler.toml`, probar, y **revertir con `git checkout -- wrangler.toml`
al terminar** — ninguna de las funciones probadas en esta sesión
(Planificar práctica, Modo clase, Solicitudes) depende de IA.

**4. Cuentas `profe1<slug>` sembradas tienen `password_temporal=1`** —
fuerzan la pantalla de cambio de contraseña obligatorio en el primer
login. Para probar como "profesor" sin ese paso de por medio:
`UPDATE usuarios SET password_temporal=0 WHERE usuario='profe1tecnologia'`
contra la D1 **local** (jamás contra la remota).

**5. Chromium headless sin Playwright como dependencia del proyecto**:
el paquete `playwright` (no solo el CLI) está instalado global en
`/opt/node22/lib/node_modules` — un script Node suelto necesita
`NODE_PATH="$(npm root -g)" node script.js` para encontrarlo vía
`require('playwright')`. El binario real de Chromium pre-instalado vive
en `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (con el sufijo de
build `-1194`, que falta en la ruta "obvia" `.../chromium/...`). Lanzar
con `args:['--no-sandbox','--no-proxy-server']` — el proxy HTTPS del
sandbox intenta interceptar también las peticiones a `localhost` y las
tira con `ERR_TUNNEL_CONNECTION_FAILED`/`ERR_CERT_AUTHORITY_INVALID`;
esos errores de consola son ruido esperado (Google Fonts/Sign-In
externos, no alcanzables ni falta que hace) y no indican un fallo real
mientras no haya `PAGEERROR` de la propia app.

**Verificado con éxito, con capturas de pantalla, contra la app real:**
buscador de ítems en "Planificar práctica" (clic añade, ítem ya añadido
sale marcado "✓"), guardado de plantilla sin `prompt()` nativo (fila
inline, toast de confirmación), desplegable de franja con "Otra…"
revelando el campo de texto, plantilla usable en un toque desde 🎒 Modo
clase (`mcUsarPlantilla()`, abre y aplica en un solo paso), y solicitud
de material marcada "descartada" por jefatura (vía API, simulando el
flujo real) que sigue visible en Modo clase con el motivo — el caso
exacto que antes desaparecía. Cero `pageerror` de JS en consola en
cualquiera de los pasos.

Al terminar: servidor de `wrangler pages dev` detenido, `wrangler.toml`
revertido a como estaba (`git checkout --`), `.wrangler/` no se toca en
git (ya está en `.gitignore`) — ningún archivo quedó modificado por las
pruebas, el repo sigue exactamente en el commit ya pusheado de v631.

---

### 27/08/2026 (v631→v632): renombrar 🛒 Pedidos / 🧰 Solicitudes para no confundir al profesorado

El usuario, revisando el README recién actualizado, señaló un problema
real de UX: 🛒 Pedidos (pide más stock de un ítem **ya dado de alta**,
requiere `itemId`) y 🧰 Solicitudes de material (pide algo que **no
existe todavía** en inventario, texto libre, ver v628-v629) son dos
flujos con datos y backend distintos por una razón válida, pero de cara
al profesorado son dos botones para "quiero que me deis material" sin
ninguna pista de cuál usar — sobre todo si el ítem existe pero tiene
stock 0. Se valoraron dos soluciones: fusionar el punto de entrada (un
único buscador que cree Pedido o Solicitud según si el ítem existe) o
solo renombrar las etiquetas. El usuario eligió la segunda, más barata y
sin tocar lógica ni migraciones — deja la fusión de entrada pendiente si
el rename no basta (ver `docs/IDEAS.md`/pendientes).

Cambiado **solo texto visible**, mismos IDs/funciones/endpoints/tablas:
- 🛒 Pedidos → **"🛒 Reponer stock"**: botón de topbar (`#btnPed`,
  `index.html`), título del modal `#mPedidos` (antes decía literalmente
  "🛒 Solicitud de compra", que chocaba de frente con el nombre de la otra
  función), `<title>` e `<h1>` del PDF/impresión (`printPedidos()` en
  `js/modal-item.js`), mensaje de lista vacía, y los 3 botones por ítem en
  `js/inventory.js` (menú ⋯ de tabla/tarjetas y botón de lista, antes
  "🛒 Pedido" → ahora "🛒 Reponer", `title` a "Reponer stock").
- 🧰 Solicitudes → **"🧰 Pedir algo nuevo"**: botón de topbar
  (`#btnSolicitudes`), acceso rápido de Inicio (mantiene el subtítulo ya
  existente "Aunque no exista en el inventario"), botón de 🎒 Modo clase, y
  título del modal `#mSolicitudes`.
- Sin tocar: nombres de función (`togglePedido`, `crearSolicitud`...),
  endpoints, tablas D1, ni las cabeceras internas de la lista dentro del
  modal de Solicitudes ("Mis solicitudes"/"Todas las solicitudes del
  departamento") — esas solo se ven **después** de ya haber elegido el
  modal correcto, no son el punto de la ambigüedad.

Segundo ajuste, mismo hilo: el email de `solicitudCrear` (añadido en v629)
solo llegaba a jefatura de departamento. Pedido explícito del usuario:
también a quien hace la solicitud (`user.email`, copia de lo enviado) y
siempre a `inventarioelec@iesjuanbosco.es` como buzón central — esa
dirección ya era el `MAIL_FROM` por defecto de los tres módulos que mandan
correo (`pedidos.js`, `prestar.js`, `solicitudes.js`), así que actuar
también como destinatario fijo de supervisión es coherente con su rol
existente de buzón centralizado, no una excepción nueva por departamento.
Implementado con un `Set` para no duplicar envíos si alguna dirección
coincide (`functions/api/solicitudes.js:solicitudCrear`). Sin cambios en
`pedidoAdd` (`functions/api/pedidos.js`) — no se pidió esta vez, sigue
notificando solo a jefatura.

`sw.js` → `v632`. `node --check` sobre `solicitudes.js` sin errores. No
verificado en navegador ni contra Gmail real esta sesión (necesita las
credenciales OAuth de `env.GOOGLE_OAUTH_*`, no disponibles en local).

---

### 27/08/2026 (v632→v633): spike "profesor de taller/ESO" + fix del hint flotante que tapaba contenido

Sesión de brainstorming (spike, sin plan previo) pedida por el usuario:
ponerse en el papel de un profesor de taller/FP y de ESO para detectar
necesidades sin cubrir, y analizar el frontend en busca de mejoras de
usabilidad. Metodología: repaso de `docs/IDEAS.md`/`docs/ROADMAP.md`
(ambos desactualizados, útiles solo para no repetir ideas ya cerradas) +
recorrido real con Playwright en viewport móvil (390×844) contra la app
levantada en local (mismo método de v631: D1 local sembrada con las 34
migraciones, `wrangler pages dev` sin `--d1`, binding `[ai]` comentado
temporalmente).

**Necesidades de las personas** (profesor de taller/FP, profesor de ESO):
sin hallazgos nuevos — lo que se necesitaría ya está implementado
(préstamo de caja completa, reservas de práctica por franja, cámara+IA,
plantillas) o ya estaba anotado sin cerrar (`motivoEncuadre` no se
muestra en "Revisar aula" — pendiente #14 del `claude.md`; mantenimiento
sin prioridad/fecha prevista — `docs/IDEAS.md`).

**Hallazgo nuevo de frontend, con captura**: el hint flotante
"📌 Mis Cursos/Aulas" (`showPointerHintOnce()`, anclado a un botón del
topbar) tapaba contenido real en 3 pantallas — el título de la vista de
aula y, más grave, el campo "Fecha adquisición" del modal "Nuevo ítem"
por **encima** del propio modal. Causa raíz: `z-index:1000` del hint
(`.pointer-hint` en `css/styles.css:460`) contra `z-index:500` de
cualquier modal (`.mbg`, `css/styles.css:1096`) — nunca se pensó que un
modal pudiera abrirse mientras el hint estaba visible. Además, el hint
solo se reposicionaba en `resize`, nunca al navegar (la app usa
`history.pushState` para las vistas, que no dispara `hashchange`), así
que se quedaba anclado al mismo punto de pantalla mientras el contenido
de debajo cambiaba.

Arreglado con dos hooks genéricos, sin tocar los ~30 sitios que abren un
modal ni la lógica de cada vista:
1. `_push()` (`js/nav.js:6-15`, punto único por el que pasan `goHome`,
   `goAula`, `goCat`... antes de cambiar de vista) oculta el hint
   flotante sin marcarlo como visto — mismo criterio que ya usaba
   `renderHome()` cuando la condición dejaba de aplicar (comentario en
   `js/home.js:15-20`), solo que ahora cubre *cualquier* navegación, no
   solo esa.
2. `_watchModalsForPointerHint()` (`js/ui-helpers.js`, nuevo): un
   `MutationObserver` sobre `document.body` que oculta el hint en cuanto
   detecta un `.mbg.open` en el DOM — un solo observer genérico en vez de
   enganchar cada `classList.add('open')` existente.

El usuario decidió explícitamente **no** tocar los iconos sin texto de
"Acciones rápidas"/stats de aula/barra de acciones (otro hallazgo de la
misma sesión, ya estaba en el backlog como pendiente #18 del `claude.md`)
— en móvil, añadir texto obligaría a scroll para llegar a la rejilla de
aulas. Queda abierto para una idea que no cueste esa altura de pantalla.

Verificado en vivo con Playwright: hint visible en Inicio (correcto) →
`goAula()` → `display:none` sin marcarlo visto → captura confirma el
título "Tecnología" ya legible; hint visible en Inicio → `openModal()` →
`display:none` vía el observer → captura confirma el campo "Fecha
adquisición" ya libre. `node --check` sin errores en los 2 archivos
tocados (`js/nav.js`, `js/ui-helpers.js`). `sw.js` → `v633`.

---

### 27/08/2026 (v633→v634): recorrido guiado con flecha para "Acciones rápidas" (sin ocupar espacio permanente)

Cierre del "queda abierto" de la entrada anterior: el usuario pidió una
idea para que los 10 iconos de "Acciones rápidas" (con texto oculto en
móvil vía `.home-quick-btn span:not(.home-quick-ico){display:none}`, para
no empujar la rejilla de aulas hacia abajo) se pudieran identificar sin
añadir leyenda fija. Propuesta aceptada: generalizar el hint flotante con
flecha (ya arreglado en v633) a un **recorrido secuencial** — apunta a
cada icono uno detrás de otro con Saltar/Siguiente, se ve una sola vez por
navegador y no vuelve a ocupar espacio después. Mismo espíritu que el tour
de cámara de 4 pantallas (`onboarding-camara.js`), pero anclado a los
botones reales en vez de a una ilustración aparte.

- `js/ui-helpers.js`: `showPointerTourOnce(key, steps)` +
  `_renderPointerTourStep()`/`_pointerTourNext()`/`dismissPointerTour()` —
  motor genérico sobre el mismo `#floatingHintBox`/`_positionPointerHint()`
  que ya usaba `showPointerHintOnce`, así que hereda gratis el fix de v633
  (se oculta solo al navegar o al abrir un modal). Un solo recorrido puede
  estar activo a la vez — no se pisan porque nunca se llaman en el mismo
  render (ver siguiente punto).
- `js/home.js`: `_showAccionesRapidasTourIfNarrow()` construye los pasos
  leyendo el propio DOM de `.home-quick-grid` (icono/`<strong>`/`<small>`
  de cada `.home-quick-btn` ya visible) — sin duplicar copy a mano, y sin
  incluir botones ocultos por rol (`data-perm`) o por `display:none`
  explícito (`#btnGoHistorial`). Se comprueba en vivo si el texto está
  realmente oculto (`getComputedStyle` sobre el span, no un breakpoint
  hardcodeado) antes de lanzar el recorrido — en tablet/desktop, donde el
  texto ya se ve, no se muestra nada. Se llama solo en el `else` de
  `necesitaConfigurarCursos` (donde ya se ocultaba el hint de "Mis
  Cursos/Aulas") para que los dos flujos, que comparten el mismo
  `#floatingHintBox`, no compitan nunca en el mismo render: primero
  configurar cursos/aulas si hace falta, y solo cuando eso ya no aplica se
  ofrece el recorrido de iconos.
- `css/styles.css`: `.pointer-hint>button` (antes `.pointer-hint button`)
  para que la regla genérica del botón único no se cuele en el nuevo
  `.pointer-hint-tour-nav` (Saltar + contador + Siguiente, reutilizando las
  clases `.btn`/`.btn-p` ya globales en vez de inventar un estilo nuevo).

Verificado en vivo con Playwright simulando `MIS_MODULOS`/`MIS_AULAS` ya
configurados (sin poder escribir en la D1 local por bloqueo del archivo
mientras `wrangler pages dev` la tenía abierta — se mutó la variable en
memoria del propio JS de la página, mismo efecto observable): paso 1/10
correcto con captura, `Siguiente` avanza, `Terminar` oculta y marca
`hint_accionesRapidasTour_visto`, no reaparece en un `renderHome()`
posterior, y en viewport de escritorio (1280px, texto ya visible) no se
muestra nada en absoluto. Sin errores nuevos en consola. `node --check`
sin errores en `js/home.js`/`js/ui-helpers.js`. `sw.js` → `v634`.

---

### 27/08/2026 (v641-v642) — Modal "Requiere tu atención" para jefe/a departamento y superadmin

Brainstorming previo (`superpowers:brainstorming`, path bounded) sobre la
utilidad de un dashboard de Inicio diferenciado para jefe/a departamento y
superadmin. Conclusión: no hacía falta un dashboard nuevo — las señales de
gestión (Pedidos/Solicitudes, Mantenimiento, Préstamos vencidos, Accesos
bloqueados/contraseña temporal) ya existían, solo estaban dispersas en
vistas separadas que hay que recordar visitar una a una. La idea 18 de
"Pendiente" (`CLAUDE.md`) ya apuntaba a esto sin haberse construido nunca.

**v641 — primera versión (sección inline en Inicio):**
- `renderAtencionHoy()` (`js/home.js`), llamada desde `renderHome()`,
  gateada por `can('config.manage')` (jefe/a departamento + superadmin,
  vía el comodín `_PERMS_JEFE=['*']`). Se oculta entera si los 4
  contadores dan 0.
- 3 de las 4 señales no necesitaron ningún fetch nuevo — ya vivían en
  memoria desde `loadData()` (`js/auth.js`): `pedidos`/`solicitudes`
  (`Object.keys(pedidos).length` + `solBadgeCount()`), `mantenimiento`
  (`items.filter(needsMaintenance)`, que ya refleja los 5 estados de
  v591-592 vía `item.mantEstado`), `vencidos` (`getVencidos()` de
  `prestamos.js`). Solo Accesos necesitó una petición nueva
  (`apiPost({action:'getUsers'})`).
- Único cambio de backend: `functions/api/usuarios.js` `getUsers` no
  seleccionaba `password_temporal` (columna ya existente desde la
  migración `0014`, solo faltaba exponerla) — añadida a las dos variantes
  de la consulta (superadmin/scoped). Sin migración nueva.
- Desglose por departamento para superadmin: 100% agregación en cliente
  (`_atencionAgrupar`/`_atencionMerge` en `js/home.js`), sin endpoint
  nuevo — para superadmin, `items`/`prestamos`/`pedidos`/`solicitudes`/
  `usuarios` ya llegan de todos los departamentos sin scoping, cada fila
  con su `.departamento`; para jefe/a llegan pre-filtrados por el
  backend. Nombres de departamento vía `deptNombre()` (`js/config.js`),
  mismo patrón que la vista global agrupada de Aulas/Categorías/Ciclos
  (v593).
- CSS: reuso casi total de `.scard-compact`/`.sec-label`/`.dept-group-
  header` ya existentes — solo se añadió el envoltorio
  `.atencion-strip`/`.atencion-item`/`.atencion-breakdown`.
- Verificado desplegado en producción por API (no por navegador — ver
  v642 abajo): `getUsers` como `Seba` devolvió 59 usuarios, 45 con
  `password_temporal=1` (las cuentas genéricas) y 0 bloqueados.

**v642 — pasó de sección inline a modal cerrable**, a petición explícita
del usuario tras ver v641 en producción: quería que apareciera "al
iniciar sesión en una ventana aparte, que se pueda cerrar y no molestar
más", no una sección fija siempre visible en Inicio.
- Nuevo modal `#mAtencionHoy` (`index.html`), mismo patrón `.mbg`/
  `.modal`/`.mh`/`.mx` que el resto de modales de la app (ej.
  `mStockChoice`).
- `checkAtencionHoy()` (`js/home.js`, async) sustituye a
  `renderAtencionHoy()`: calcula las 4 señales, **espera** (`await`) la
  respuesta de Accesos antes de decidir si abre el modal — evita que el
  modal aparezca sin ese chip y luego "salte" al llegar el fetch.
  `closeAtencionHoyModal()` marca `sessionStorage.atencion_hoy_cerrado=1`
  — se olvida al cerrar la pestaña/navegador, así que la próxima sesión
  vuelve a evaluarse desde cero. Clic en un chip cierra el modal y
  además navega (`closeAtencionHoyModal();openStockChoiceModal()` etc.).
- **Bug real encontrado y corregido antes de desplegar** (no llegó a
  producción): el primer intento enganchó `checkAtencionHoy()` dentro de
  `renderHome()` con una guarda `_atencionHoyChecked` para que solo
  corriera una vez. Pero `renderHome()` se dispara dos veces por login:
  una primera vez vía `goHome()` al terminar la fase 1 de `loadData()`
  (`js/auth.js:528`, solo metadatos — `items`/`pedidos`/`solicitudes`/
  `prestamos` **aún vacíos**) y una segunda vez al terminar la fase 2
  (`auth.js:584`, datos ya completos). Con la guarda por variable, la
  primera pasada (datos vacíos → 0 chips → sin abrir modal) consumía el
  único disparo permitido, y la segunda pasada (con datos reales) nunca
  llegaba a ejecutarse — el modal jamás habría aparecido en el flujo
  normal de login. Solución: mover la llamada fuera de `renderHome()`, a
  `loadData()` mismo, justo después de `itemsLoaded=true` en la fase 2
  (`auth.js`), cuando los 4 arrays ya están poblados.
- `sw.js` → `v642`. Sin cambios de CSS ni de backend en este paso.

**Verificación:** `node --check` sin errores en los 3 JS tocados en
cada iteración. Desplegado y comprobado contra producción por HTTP/API
en ambos pasos (contenido estático servido + `getUsers` real) — sin
acceso a Playwright en esta sesión porque el perfil de Chrome
compartido (`ms-playwright-mcp`) estaba en uso por otra sesión de
Claude Code concurrente en la misma máquina; el usuario confirmó
manualmente que el comportamiento final era el esperado.

---

### 27/08/2026 (v643-v644) — Asistente guiado para planificar prácticas

Pedido del usuario: el modal "📅 Planificar práctica" (v588,
`js/reservas-practica.js`) ya reserva material para una sesión futura,
pero es un formulario de una sola pantalla — quería una guía que fuera
preguntando material/fecha/profesor uno a uno, disponible tanto desde
el propio modal como hablando con Volt. Brainstorming clasificó la
tarea como *bounded* (el flujo de reservas ya existe, esto añade una
capa de presentación encima) — sin tocar backend: reutiliza
`reservaCrear`/`reservaConfirmar` (`functions/api/prestar.js`, v588)
tal cual.

**1) Modo guiado en el modal** (`js/reservas-practica.js`,
`index.html`) — botón "🧑‍🏫 Modo guiado" que envuelve los campos ya
existentes en 5 pasos (`data-restep="1..5"` en el HTML: Ciclo/Aula →
Fecha/Franja → Profesor/a → Material → Resumen) con Atrás/Siguiente y
validación por paso (`_reservaWizardValidar()`). Es una capa de
`display:none` por paso sobre el mismo DOM/estado de siempre
(`_reservaLineas`, mismos `<select>`) — `guardarReservaPractica()` no
cambió. `_renderReservaLineas()`/`_renderPlantillasList()` ahora
también ocultan su contenido si el paso actual no es el suyo (antes
solo dependían de si había datos). Aplicar una plantilla o duplicar una
reserva ya existente salta directo al paso 5 (resumen), porque esos dos
flujos ya rellenan todos los campos de golpe. El modo (activado/no) se
recuerda por usuario en `localStorage`.

**2) Asistente conversacional en Volt** (`js/agente-widget.js`) — a
diferencia del resto de acciones de Volt (un solo turno + mini-
formulario inline dentro de la burbuja, ver `mostrarFormularioPrestamo`
v388), esto es una conversación real de varios turnos: mientras
`_practicaFlow` no es `null`, el principio de `sendChat()` enruta TODO
lo que se escriba directamente al paso activo (`_procesarPasoFlujoPractica`),
antes de que cualquier otro detector de intención pueda malinterpretar
una respuesta corta como "el jueves" o un nombre de ítem a medio flujo.
Pasos: material (busca con `searchInventoryCandidates()` ya existente,
detecta cantidad con `extraerCantidadDeFrase()`, "listo" para
continuar) → fecha (reutiliza `extraerFechaDevolucion()`, que ya
entendía "mañana"/"el jueves"/etc. desde v388, sin parser nuevo) →
franja (chips con las mismas 8 opciones fijas del modal) → profesor/a
(se salta preguntando si el nombre de sesión coincide con alguien de
`loanTeacherOptions()`, si no se pregunta y se acepta también texto
libre sin exigir que exista en la lista — el backend nunca validó ese
campo). Resumen final con botones Confirmar/Cancelar: al confirmar
siempre llama a `reservaCrear`; si la fecha resuelta es la de hoy,
encadena automáticamente `reservaConfirmar` (reserva + préstamo real en
un solo paso, sin lógica de descuento nueva — son las dos acciones ya
existentes, una detrás de otra). Ciclo/módulo se autorrellena igual que
el modal (una sola combinación propia → se usa sin preguntar); aula
queda deliberadamente sin preguntar en el chat (campo opcional, no
afecta al bloqueo de conflictos) para no alargar la conversación —
simplificación consciente frente al modal, que sí la pide.

**Bug real encontrado y corregido en producción (v643→v644):**
`normalizarEntradaUsuario()` convierte números en palabras a dígitos
("una" → "1", `textToNumber()`, v388) — la primera versión de
`detectarIntencionPlanificarPractica()` buscaba frases literales como
"planificar una practica", que dejaban de matchear en cuanto
`normalizarEntradaUsuario` transformaba "una" → "1" a mitad de frase.
"quiero planificar una práctica" funcionaba de casualidad (matcheaba
por el patrón suelto "quiero planificar"), pero "planificar una
práctica" sin ese prefijo cayó al parser central en vez de arrancar el
flujo. Corregido pasando a detección por regex de verbo+sustantivo
sueltos (`/\b(planificar|programar|preparar|organizar)\b/` +
`/\b(practica|clase)\b/`, ambos en cualquier posición) en vez de frases
completas — inmune a esa sustitución. Lección: cualquier detector de
intención nuevo en Volt debe probarse contra el texto ya pasado por
`normalizarEntradaUsuario()`, no contra la frase tal cual la escribe el
usuario.

**Disambiguación con el préstamo inmediato ya existente:** la palabra
"reservar" ya disparaba `detectarIntencionPrestamo()` (v322). El nuevo
flujo solo se activa con verbos explícitos de planificación, o con
"reservar"/"necesito" + "material"/"clase" cuando además hay una
referencia de fecha detectable — así "reservar el multímetro" (sin
fecha) sigue yendo al préstamo de siempre. Verificado en producción con
Playwright: dispara correctamente en ambos casos y no cruza en
ninguno.

**Verificación:** `node --check` sin errores en los 2 JS tocados.
Playwright contra producción (`boscoinventario.pages.dev`, usuario
`Seba`) en ambas iteraciones — sin atajos: wizard del modal completo
(validación por paso, plantilla salta a resumen, guardado real vía
`reservaCrear`), flujo de Volt completo con fecha "hoy" (búsqueda
ambigua → resolución por candidatos → `reservaCrear`+`reservaConfirmar`
encadenados → préstamo real con stock descontado), cancelar a medio
flujo, y la disambiguación con "reservar el multímetro". Datos de
prueba limpiados tras verificar (`reservaCancelar` en la reserva de
prueba del wizard; `devolver` en el préstamo real creado por Volt, con
observación explicando que era una prueba).

---

### 27/08/2026 (v645) — fix de móvil encontrado al probar el wizard con Playwright

Al verificar v643-v644 en un viewport de 390×844 (móvil real, no solo
escritorio) aparecieron dos fallos del modo guiado recién construido:

- **Desbordamiento horizontal del modal.** `.mf-right{display:flex;
  gap:10px}` (`css/styles.css:1272`) no tiene `flex-wrap`, y con 3
  botones simultáneos (Cancelar/Atrás/Siguiente o Cancelar/Atrás/
  Guardar) en 390px de ancho el footer no cabía — `modal.scrollWidth`
  336px vs `clientWidth` 334px, aparecía una barra de scroll horizontal
  fea dentro del modal. Fix: `style="flex-wrap:wrap;justify-content:
  flex-end"` inline en el `.mf-right` de `#mReservaPractica`
  (`index.html`) — scoped a este modal, no se tocó la regla global
  (otros modales con menos botones no lo necesitan, y no se auditaron
  todos — ver Pendiente).
- **"Guardar como plantilla" pulsable antes de tener material.** El
  botón vivía fuera de los `data-restep`, visible en cualquier paso;
  pulsarlo en el paso 1-3 disparaba el toast de error "Añade al menos
  un ítem". Fix: se oculta en `_renderReservaWizard()`
  (`js/reservas-practica.js`) cuando `_reservaWizardStep < 4`.

**Lección:** el bug de desbordamiento no se veía en el desktop donde se
construyó e implementó — solo apareció al forzar un viewport estrecho
de verdad con Playwright. Motivó la auditoría de más abajo (¿cuántos de
los otros 48 modales tienen el mismo problema sin detectar?).

**Verificación:** `node --check` limpio, redeploy a producción,
confirmado sin overflow (`scrollWidth === clientWidth`) en el mismo
viewport tras el fix.

---

### 27/08/2026 — Auditoría de código, diseño y usabilidad (a petición del usuario)

El usuario pidió, tras cerrar el asistente de prácticas: *"piensa como
programador, diseñador y profesor"* y propón mejoras — **sin
implementar nada todavía**, solo diagnóstico para retomar en la
siguiente sesión ("guárdalo para mañana"). Metodología: lectura de
código (Grep/wc por todo `js/`+`functions/api/`+`css/`) + sesión real
en producción con Playwright (escritorio como `Seba` y móvil 390×844 —
**no se probó con una cuenta `profesor` real**: dos intentos de login
con `profe1electricidadelectronica/profe1electricidadelectronica`
fallaron con "Credenciales incorrectas" — no se insistió por riesgo de
disparar el bloqueo de cuenta a los 5 intentos sobre una credencial que
podría ya estar en uso real; **queda sin verificar si esa cuenta de
ejemplo del propio `CLAUDE.md` sigue siendo válida** — comprobarlo es
en sí mismo un primer paso útil de la próxima sesión). Dos bugs reales
salieron de esta pasada y ya están corregidos (ver entrada v645
arriba).

**Código / arquitectura:**
- **Cero automatización de pruebas en todo el repo** — sin
  `package.json`, sin lint/prettier, sin ningún test (`find` no
  encontró ni un `.test.js`). Todo el QA es manual contra producción.
  A esta escala (18.4k líneas JS + 4.6k backend) ya se nota: el bug de
  v645 no se detectó hasta buscarlo activamente. Propuesta barata: unos
  pocos tests Playwright de los flujos críticos (login, préstamo,
  planificar práctica, alta de ítem), no una suite completa.
- **Archivos gigantes en scope global** (sin módulos):
  `js/agente-widget.js` 4383 líneas, `js/modal-item.js` 1900,
  `js/inventory.js` 1818, `js/prestamos.js` 1372. Cloudflare Pages
  Functions ya soporta `import`/`export` de ES modules entre archivos
  de `functions/api/` — no se ha comprobado si el frontend podría
  usar `<script type="module">` para partir los más grandes sin montar
  un bundler.
- **`GENERIC_DEPT = 'iesjuanbosco'` duplicado literal en 6 archivos**
  backend (`docs.js:205`, `historial.js:9`, `item.js:5`, `list.js:27`,
  `meta.js:121`, `prestar.js:9`) + `HEADERS_INV` en 2
  (`item.js`/`list.js`) — ya documentado como deuda conocida, sigue
  creciendo con cada archivo nuevo que lo necesita.
- **Seguridad** — reitera lo ya crítico en `docs/SECURITY.md`
  (credenciales en `?u=&p=`, permisos solo revalidados en frontend) +
  dos hallazgos nuevos: `auth.js:216` hace `console.log('Google
  Sign-In response:', response)` con la respuesta OAuth completa (sin
  confirmar si lleva algo sensible); `agente-widget.js:1027,1037`
  tienen `console.log('[Volt DEBUG] ...')` de depuración olvidados en
  producción.
- 369 `onclick=` + 520 `style=` inline en `index.html` — cierra la
  puerta a una CSP real, encarece cualquier refactor de estilos.

**Diseño / estética:**
- **Volt no respeta el tema claro/oscuro de la app.** `agente-widget.js`
  tiene 36 colores hex hardcodeados y **cero** usos de `var(--...)` —
  la app por defecto es clara (`:root` claro, `body.dark` la oscurece,
  `css/styles.css:18`), Volt siempre oscuro. Confirmado visualmente en
  captura móvil (fondo blanco de la app vs panel de Volt negro). Más
  visible ahora que aloja el asistente de prácticas.
- **Accesibilidad débil**: solo 11 atributos `aria-*` en 2351 líneas de
  `index.html` con 49 modales y decenas de botones solo-icono sin
  `aria-label`.
- **49 modales (`.mbg`) sin patrón compartido** — cada `.mf-right` es
  un caso aparte; el fix de v645 fue scoped a un solo modal, **no se
  auditaron los otros 48** por el mismo problema de desbordamiento en
  móvil.
- **FAB de Volt: umbral de arrastre de 3px demasiado sensible al
  tacto** (`agente-widget.js:470`, función `makeFabDraggable`/`onMove`)
  — descubierto porque el primer clic real de Playwright no abrió el
  panel (se interpretó como arrastre). En dedo, 3px se supera con
  facilidad sin intención de arrastrar.

**Usabilidad para profesorado:**
- **El panel "🔔 Requiere tu atención" (v641-642) no incluye reservas
  de práctica de hoy pendientes de "Confirmar recogida"** — comprobado
  en `js/home.js`, `reservas` no aparece en `checkAtencionHoy()`. Encaja
  como quinta señal con el mismo patrón ya construido.
- Tour guiado de 11 pasos en el primer login — fricción real para
  quien tiene 2 minutos antes de clase.
- Pestañas "Auditoría"/"CSV" de Volt visibles para cualquier rol
  (incluida `Consulta`, solo lectura) — no hay `data-perm`/`can()`
  detrás en `roles.js`, son funciones de jefatura/superadmin mostradas
  a todo el mundo.
- Asistente de prácticas por chat: solo admite un ítem por mensaje (no
  parsea "2 multímetros y 3 polímetros" de un tirón); no pregunta aula
  (trade-off consciente para no alargar la conversación, a revisar si
  el uso real lo echa en falta).

**Estado:** solo diagnóstico, nada implementado — decisión explícita
del usuario ("guárdalo para mañana"). Retomar priorizando (por impacto):
1) credenciales en query string, 2) tests E2E mínimos de los flujos
críticos, 3) Volt heredando el tema de la app (autocontenido, impacto
visual inmediato, sin tocar backend).

---

### 28/08/2026 (v646) — login tradicional deja de reenviar la contraseña real

Primer paso de la prioridad #1 de la auditoría del 27/08/2026
(credenciales en `?u=&p=`, `docs/SECURITY.md` ítem 1): no el refactor
completo a headers/Bearer (~8h estimadas, alto riesgo sin tests), sino
extender el mecanismo `session_token` que ya usaba el login de Google
(`login-google.js`) al login usuario/contraseña. Decidido con
`superpowers:brainstorming` (bounded, no architectural) — el único punto
que necesitó decisión del usuario: ¿reutilizar el token si ya existe, o
regenerarlo en cada login? Se eligió **reutilizar**, porque regenerar
(como hace Google) desconectaría en silencio a un segundo profesor que
inicia sesión en la misma cuenta genérica de departamento desde otro
dispositivo — con 48 cuentas compartidas en producción, no es un caso de
borde.

**Backend:** `auth.js` (`action=login`) genera `session_token` con
`randomToken()` (criptográfica, `crypto.getRandomValues` — no se copió el
generador más débil basado en `Math.random()` de `login-google.js`) solo
si el usuario no tiene uno ya; si existe, lo reutiliza. Se rota (nuevo
token) en los 3 puntos donde cambia la contraseña real: `perfil.js`
`changePassword` (devuelve el token nuevo en la respuesta, para que la
propia sesión que cambió la contraseña no se quede fuera),
`usuarios.js` `userResetPassword` (admin resetea a otro usuario — cierra
cualquier sesión abierta con el token viejo) y `auth.js` `resetPassword`
(flujo "olvidé mi contraseña"). `_middleware.js` no se tocó — ya
aceptaba `u+t` de forma genérica, no específica de Google.

**Frontend:** `js/auth.js` `doLogin()` ya no guarda `password` en
`SESSION`/`localStorage`, guarda `session_token`. La contraseña recién
tecleada solo se necesita un instante para el paso de contraseña
temporal obligatoria (`doForcePasswordChange`, como `oldPassword`) — se
guarda en `_pendingLoginPassword`, variable de módulo en memoria, nunca
persistida, descartada en cuanto se usa. `js/profile.js`
`doChangePassword()` actualiza `SESSION.session_token` con el que
devuelve el backend en vez de guardar la contraseña nueva.

**Bug propio encontrado y corregido antes de desplegar:** si la página
se recargaba a mitad del paso de contraseña temporal obligatoria (antes
de completarlo), `_pendingLoginPassword` se perdía (solo vive en
memoria) y el formulario habría fallado al enviarse sin explicar por
qué. `loadData()` (`js/auth.js`) ahora detecta ese caso
(`SESSION.passwordTemporal` true sin `_pendingLoginPassword`) y fuerza
login limpio en vez de mostrar un formulario roto. No existía antes
porque `SESSION.password` sí persistía en localStorage — el propio bug
es un efecto secundario directo de la mejora de seguridad.

**Hallazgo colateral corregido:** `js/audit-log.js` construía su propia
URL de fallback con `SESSION.password` si `urlWithAuth` no estaba
definida — dead code (`api.js` siempre carga antes, ambos `defer`),
eliminado en vez de dejarlo silenciosamente roto.

**Efecto secundario positivo, sin cambio de código:** `agente-widget.js`
(`getCreds()`) ya prefería `session_token` sobre `password` desde antes
— en cuanto todo el mundo tenga un token (universal tras este cambio),
Volt deja de mandar la contraseña real también, cerrando de paso el
ítem 8 de `docs/SECURITY.md` ("Agente IA puede enviar credenciales").

**Compatibilidad:** sesiones ya abiertas en el navegador antes del
despliegue (con `password` cacheado) siguen funcionando sin corte —
`urlWithAuth()` ya caía a `p=` si no había `session_token`. Empiezan a
usar token en su próximo login o cambio de contraseña, no de forma
forzada.

**Límite explícito, no resuelto hoy:** el token sigue viajando en la
query string (`t=` en vez de `p=`) — sacarlo a un header/Bearer real
sigue pendiente, es el refactor grande descartado por ahora. Lo ganado
es que ya no es la contraseña real reutilizable: es revocable sin que el
usuario tenga que cambiar su contraseña.

**Verificado con Playwright contra producción** (usuario de prueba
desechable `test_token_646` creado en D1 con `password_temporal=1` y
borrado al terminar, para no tocar cuentas reales): login tradicional →
`session_token` presente, sin `password` en `localStorage`; recarga de
página mantiene sesión solo con el token; cambio de contraseña
voluntario (`Seba`, contraseña nueva = igual a la vieja para no afectar
la cuenta real) rota el token y la misma pestaña sigue autenticada;
llamada con el token viejo tras la rotación devuelve 401 (confirma que
invalida sesiones antiguas, como se diseñó); flujo completo de
contraseña temporal obligatoria de punta a punta; recarga a mitad de ese
flujo bota a login en vez de romperse; login con la contraseña vieja
tras el cambio falla, con la nueva funciona y reutiliza el mismo token.
Google Sign-In sigue renderizando sin errores (ruta no tocada).

**Hallazgo nuevo, sin tocar hoy:** los 4 volcados SQL completos en
`Copias_SQL/*.sql` (`backup_20260524_1426.sql` y otros 3) están
**commiteados en el historial de git** (commit `0d6e6a0`) — incluyen la
tabla `usuarios` completa (contraseñas hasheadas, `session_token`).
`d1 export` no filtra columnas como sí hace `backup.js`. Si el repo de
GitHub es público, es una exposición real independiente de lo de hoy.
No se tocó (reescribir historial de git es delicado, necesita decisión
explícita del usuario) — pendiente de confirmar visibilidad del repo y
decidir qué hacer.

**Gap conocido, no cerrado hoy:** no hay manejo global de 401 en
`js/api.js` — si el token de una pestaña queda obsoleto (p. ej. dos
pestañas abiertas y se cambia la contraseña en una), la otra ve un toast
"No autorizado" sin más explicación en vez de un aviso claro de "inicia
sesión de nuevo". Ya existía este gap con Google OAuth (que ya rotaba
token en cada login); este cambio lo hace más frecuente al añadir 3
puntos más de rotación. Fuera de alcance de esta tarea (bounded, no se
amplió a un interceptor global sin pedirlo el usuario), candidato para
una mejora pequeña futura.

---

### 28/08/2026 — Tests automatizados de backend (primer sub-proyecto de la prioridad #2, Pendiente #21)

Primera suite de tests automatizados de todo el repo. Origen: prioridad
#2 de la auditoría del 27/08/2026 ("cero tests automatizados"), justo
detrás de la #1 (credenciales, ya en marcha con v646). Diseñado con
`superpowers:brainstorming` +
`docs/superpowers/specs/2026-08-28-tests-backend-design.md`, ejecutado
con `superpowers:subagent-driven-development` a partir de
`docs/superpowers/plans/2026-08-28-tests-backend.md` (6 tasks), y
cerrado con un pase de revisión final que corrigió 4 hallazgos
"Important" (documentado abajo). Alcance v1: solo backend
(`functions/api/*.js`, auth + scoping por departamento) — el frontend
(`js/*`, 18.4k líneas) queda como sub-proyecto 2, sin empezar.

**Stack:** Vitest 4 + `@cloudflare/vitest-plugin` (paquete oficial,
sucesor de `@cloudflare/vitest-pool-workers` para Vitest 4) contra un
binding D1 local (Miniflare/workerd), nunca la D1 remota
`boscoinventario`. Los handlers de `functions/api/*.js` se invocan por
import directo (`createPagesEventContext()`), no por HTTP — Pages
Functions no tiene un `main` único que compilar. Las migraciones reales
de `migrations/00XX_*.sql` se re-aplican contra la D1 local en cada
corrida (`tests/backend/apply-migrations.ts`), así un test roto por una
migración nueva con SQL inválido es señal, no ruido. `package.json`
nuevo en la raíz (no existía). Resultado: 5 archivos de test, 28 tests
(`npm test`), `.github/workflows/tests.yml` como check informativo en
cada push/PR a `main` — no bloquea el deploy automático de Cloudflare
Pages (decisión explícita, revisable después sin rehacer los tests).
Requiere Node ≥22 (`vitest@4.1.11`), ahora declarado en
`package.json`'s `engines`.

**Dos propiedades no obvias de este arnés, necesarias antes de tocarlo:**

1. **El aislamiento de storage entre tests es por ARCHIVO de test, no
   por cada `it()` individual** — confirmado empíricamente con un
   prototipo antes de escribir el plan (ver "Global Constraints" en
   `docs/superpowers/plans/2026-08-28-tests-backend.md`): una fila
   insertada/editada en un test seguía visible en el siguiente `it()`
   del mismo archivo. Por eso todo archivo de test que muta datos lleva
   su propio `beforeEach(() => resetAndSeed(env.DB))`
   (`tests/backend/seed.ts`) — un `beforeAll` no basta.
2. **`tests/backend/apply-migrations.ts` inyecta dos `ALTER TABLE`
   manuales justo después de aplicar la migración `0018`**
   (`inventario.tipo_material`, `inventario.parent_id`) — replican el
   self-heal que `list.js`/`item.js` hacen en runtime contra producción
   (`ALTER TABLE ... ADD COLUMN`, nunca vía una migración formal). Las
   migraciones numeradas `0019`/`0020` asumen que esas columnas ya
   existen (ciertas en producción, donde la app ya corrió antes de que
   se escribieran esas migraciones) pero un replay desde cero como el de
   este arnés no las tiene por sí solo. Si `migrations/` gana una
   migración nueva numerada por debajo de `19` que también necesite una
   de esas dos columnas, este punto de inyección puede necesitar
   revisarse.

**Revisión final (28/08/2026) — 4 hallazgos "Important" corregidos en un
único pase de fix, sin tocar `functions/api/*` en ningún caso:**

- **Documentación desactualizada** (este propio hallazgo): `CLAUDE.md`
  nunca se actualizó durante las 6 tasks pese a la regla del propio
  archivo. Corregido: Pendiente #21 punto 2 marcado 🟡 (backend
  cubierto, frontend/E2E sigue sin empezar), nota de Estado añadida sin
  número de versión (tooling interno, no funcionalidad desplegada),
  paso 7 añadido a "Para retomar desde un PC nuevo" (`npm ci && npm
  test`), y esta misma entrada.
- **`package.json` sin `engines`**: Node ≥22 es un requisito real
  (`vitest@4.1.11`) pero nada lo comunicaba a quien corriera `npm
  install`/`test` con una versión más vieja — solo un fallo confuso.
  Añadido `"engines": { "node": ">=22" }`.
- **`scoping.test.ts` solo cubría un deletreo real del rol "profesor"**:
  el seed (`tests/backend/seed.ts`) solo sembraba `rol='profesor'`
  (igual que las migraciones 0005/0006), pero `auth.js:371`
  (autoregistro público, `action=register`) asigna `rol='Profesor/a'`
  (mayúscula + slash) a cualquier profesor real que se registra por el
  formulario. `isProfesor()` (duplicada en `list.js`/`item.js`/
  `prestar.js`) compara en minúsculas contra exactamente `'profesor'` —
  `'Profesor/a'.toLowerCase()` es `'profesor/a'`, no matchea. Efecto
  real: un profesor autoregistrado SÍ recibe el bypass del departamento
  compartido `iesjuanbosco` que un `rol='profesor'` sembrado NO recibe —
  asimetría real de la app, ahora pinneada por un test nuevo (usuario
  `test-profesor-selfreg`, `tests/backend/seed.ts`; test "un profesor
  auto-registrado (rol 'Profesor/a'...) SI ve el departamento
  compartido", `tests/backend/scoping.test.ts`) en vez de arreglada — el
  fix de `isProfesor()` en sí queda fuera de alcance de esta revisión,
  pasa a Pendiente #24 de `CLAUDE.md`.
- **`prestar.js` sin test positivo**: `scoping.test.ts` solo probaba que
  un préstamo de un ítem de OTRO departamento se rechaza (403) — nunca
  que un préstamo del propio departamento se acepta de verdad.
  Relevante porque `prestar.js` resuelve el actor con `data?.user ||
  request.user` sin fallback a base de datos (a diferencia de
  `getAuditActor` en `item.js`, que re-consulta por `?u=` si `data.user`
  falta): si el paso de `data` por el arnés de test se rompiera en
  silencio, `user` sería `undefined`, el departamento de un usuario
  `undefined` sería `''` (no matchea nada) y el test negativo existente
  seguiría en verde sin haber verificado nada real de la cadena de auth.
  Añadido "un prestamo de un item del propio departamento del actor se
  acepta" (`tests/backend/scoping.test.ts`), verificado contra
  `crearPrestamoDesdeLinea()` (`functions/api/prestar.js:107`) antes de
  escribirlo — status 200, `body.ok===true`, fila real insertada en
  `prestamos` con la cantidad esperada.

Total tras el fix: 28 tests (27 de scoping+auth+middleware+seed+smoke
tras sumar el de rol `Profesor/a`, +1 del préstamo positivo). `git diff
functions/api/` vacío — el fix wave completo es aditivo (tests + docs +
`package.json`), cero cambios de comportamiento de producción.

**Dos hallazgos pre-existentes que esta suite dejó al descubierto, no
causados por este trabajo, documentados como Pendiente #24/#25 de
`CLAUDE.md`:**

1. La asimetría `isProfesor()` vs `rol='Profesor/a'` de autoregistro
   (detallada arriba) — el test la fija/pinea como comportamiento
   conocido, pero el bug de fondo en `list.js`/`item.js`/`prestar.js`
   sigue sin resolver.
2. `npm test` termina siempre con `close timed out after 10000ms`
   ("Tests closed successfully but something prevents Vite server from
   exiting") — no afecta exit code ni resultados, pero es ruido en cada
   corrida. Rastreado al binding `[ai]` (Workers AI) de `wrangler.toml`,
   que no cierra dentro del timeout de Vitest. Candidatos identificados,
   deliberadamente no aplicados en esta revisión (fuera del alcance
   acotado del fix wave): 1) `wrangler.test.toml` separado con solo el
   binding `DB`, sin `[ai]`; 2) apuntar el binding `ASSETS`
   (`vitest.config.ts`) a un directorio de fixtures pequeño en vez de la
   raíz del repo, por si esa es la causa real.

**Entorno de ejecución:** el worktree del plan (creado por defecto dentro
de `.claude/worktrees/`, es decir dentro de "Mi unidad") no sirvió para
correr `npm install` — Google Drive corrompe la escritura masiva de
archivos pequeños de `node_modules/` igual que ya le pasaba a `.git/`
(ver Entorno en `CLAUDE.md`), y un junction NTFS para redirigir solo
`node_modules` fuera de Drive falla porque `H:` es una unidad virtual sin
soporte de reparse points. Solución: worktree manual en
`C:\ClaudeWork\worktrees\...`, fuera de Drive por completo. Fusionado a
`main` con fast-forward (`git merge`, sin conflictos) y pusheado a
`origin/main` el 28/08/2026 — commits `eb3adfd..17522e9` (más
`4015e21`, trackeo de `boscoinventario.code-workspace`, sin relación con
este trabajo).

---

### 28/08/2026 (v647) — cuatro pendientes menores de la auditoría del 27/08/2026 (#7, #9, #18, #20)

Cuatro puntos pequeños e independientes de la lista de Pendientes, a
petición directa del usuario tras revisar qué quedaba abierto.

1. **#7 — Rol `Consulta` ya ve la galería completa de fotos.** El proyecto
   no tenía un permiso de solo-lectura para ítems: `fotosGet` exigía
   `items.write` en `ACTION_PERMISSIONS` (`js/roles.js`), así que
   `js/api.js` bloqueaba la llamada en el propio cliente (`canAction()`)
   antes de que llegara al backend — el backend (`functions/api/item.js`,
   acción `fotosGet`) nunca tuvo ninguna comprobación de permiso propia,
   solo scoping por departamento. Fix: permiso nuevo `items.read`, con
   vía libre para cualquier usuario logueado en `can()` — mismo patrón ya
   usado para `docs.read`/`serie.read` (línea "cualquiera autenticado
   puede leer, escribir sigue restringido por rol"). `fotosGet` pasa de
   `items.write` a `items.read`. Sin cambios de backend.

2. **#9 — `ia_deteccion_ejemplos` formalizada en `migrations/0038`.** La
   tabla se autocreaba en runtime desde `ensureDeteccionLearningTable()`
   (`functions/api/item.js:41`, con `CREATE TABLE IF NOT EXISTS`, patrón
   ya usado también por `log`/`app_meta`) sin migración dedicada. Se
   mantiene esa función tal cual (autosanación defensiva, igual que las
   otras dos tablas) — la migración nueva solo documenta el esquema real
   y lo deja trazable como el resto de tablas del proyecto. Aplicada a la
   D1 remota (`npx wrangler d1 execute boscoinventario --remote
   --file=migrations/0038_ia_deteccion_ejemplos.sql`): 0 filas
   leídas/escritas, confirmando que era un no-op (la tabla ya existía).
   Al llevar el prefijo numérico `00XX_`, `vitest.config.ts` la recoge
   sola en la próxima corrida de `npm test` sin tocar el arnés de tests.

3. **#18 — Ideas del brainstorming del 31/07/2026 volcadas a
   `docs/IDEAS.md`.** Nunca se habían escrito; antes de copiarlas tal
   cual se contrastó cada una contra el estado real del código para no
   dejar entradas obsoletas:
   - **Panel "Hoy requiere atención"** resultó ya implementado como el
     modal "🔔 Requiere tu atención" (v641-v642) — se documentó como
     🟡 parcial: cubre Pedidos/Solicitudes, Mantenimiento, Vencidos y
     Accesos, pero no Stock bajo ni datos faltantes de auditoría.
   - **Acciones en lote con preview/undo**: solo el borrado en lote tiene
     protección real (`_bulkDelDialog()`, cuenta atrás de 5s cancelable
     antes de ejecutar) — es un retraso previo, no una vista previa ni un
     undo posterior, y no cubre edición en lote (aula/categoría/tags).
   - Genuinamente sin implementar, añadidas tal cual: menú de acciones
     compacto con texto, vistas de filtro guardadas ("Mis vistas"), modal
     de ítem reorganizado por secciones, etiquetas de estado explícitas,
     microcopy en vacíos/errores, accesibilidad (sin auditar nunca), y
     niveles de severidad en Auditoría de Datos.
   Documentación pura, sin cambios de código.

4. **#20 — `goLowStock()`/`goMaintenance()` ahora sí acotan a "tus
   aulas".** Las tarjetas de Inicio ya calculaban sus contadores acotados
   a `MIS_AULAS` cuando aplica (v624), pero al clicarlas, `getBase()`
   (`js/inventory.js`) filtraba `isLowStock`/`needsMaintenance` sobre
   *todo* el departamento sin mirar `MIS_AULAS` — inconsistencia entre lo
   que el contador prometía y lo que la vista destino mostraba. La
   condición exacta ("¿es profesor con aulas propias elegidas y no ha
   pulsado ver todas?") vivía duplicada en una función local de
   `renderHome()`; para no repetirla una tercera vez (patrón de bug ya
   visto 3 veces en este proyecto, Pendiente #17) se extrajo a
   `debeFiltrarPorMisAulas()` en `js/config.js`, reusada ahora por
   `home.js` e `inventory.js`.

Los 4 puntos son solo frontend salvo la migración (#9, sin lógica nueva).
Sin tests de backend afectados (`js/roles.js`, `js/config.js`,
`js/inventory.js`, `js/home.js` no están cubiertos por la suite de
Vitest, que es solo de `functions/api/*.js`) — no se ha podido correr
`npm test` en esta sesión por el gotcha de siempre (repo dentro de
Google Drive, sin `node_modules` ya instalado en este checkout; requeriría
el worktree externo de la sesión anterior). Verificación manual: revisado
el orden de carga de scripts en `index.html` (`config.js` antes que
`roles.js`/`home.js`/`inventory.js`) para confirmar que
`debeFiltrarPorMisAulas()` y el nuevo permiso están disponibles cuando se
usan; sin verificación end-to-end con Playwright en esta sesión.

---

### 28/08/2026 (v648) — Pestañas Auditoría/CSV de Volt solo para superadmin

A petición directa del usuario, tras repasar el Pendiente #21: las
pestañas "🔍 Auditoría" y "📥 CSV" de Volt (`js/agente-widget.js`) son
herramientas de gestión masiva de datos (sugerir/aplicar correcciones en
lote, importar CSV completo), no de consulta diaria — no tenían ningún
gating de rol, cualquier usuario logueado las veía y podía usarlas.

Función nueva `applyAgentTabGating()`: oculta ambos botones de pestaña si
`userRole() !== 'superadmin'`, y si el usuario ya estaba en una de esas
pestañas cuando deja de tener acceso (no debería pasar en la práctica,
pero es gratis cubrirlo), lo devuelve a "💬 Chat" vía `switchTab('chat')`.

**Detalle no obvio:** no se puede aplicar este gating al construir el
panel (`buildWidget()`/`buildPanelHTML()`, línea ~504) porque esa función
se ejecuta en `DOMContentLoaded`, es decir **al cargar la página, antes
de que el usuario inicie sesión** — en ese momento `SESSION` no existe
todavía y `userRole()` cae al valor por defecto `'consulta'`, lo que
ocultaría las pestañas para todo el mundo, incluido superadmin. Se
engancha en su lugar a `openPanel()` (se ejecuta cada vez que se abre el
widget con el 🤖, siempre después del login) y se re-evalúa en cada
apertura, no solo una vez.

Sin cambios de backend — estas dos acciones (`auditAI`/`bulkImport` vía
CSV) ya pasaban por los mismos endpoints con scoping de departamento de
siempre; este cambio es puramente de visibilidad en el cliente, igual de
alcance que el resto de gating de rol del proyecto (`js/roles.js`,
`data-perm` en `applyRoleUI()`).

---

---

### 28/08/2026 — Diseño del proceso de modularización de JS (sin implementar)

A petición del usuario, sesión de análisis (con `superpowers:brainstorming`)
sobre el Pendiente #21 de `docs/ROADMAP.md` [2.2] "Modularizar JavaScript" —
un pendiente que llevaba desde antes de la migración multi-departamento sin
un proceso concreto detrás. Solo diagnóstico y diseño, **nada de código
tocado**, sin `VERSION` nueva.

Análisis con datos reales del repo (no solo intuición): los 4 archivos JS
más grandes (`agente-widget.js` 4397 líneas, `modal-item.js` 1900,
`inventory.js` 1818, `prestamos.js` 1372) cruzados con frecuencia de
cambio (`git log --oneline -- js/<archivo> | wc -l`) y acoplamiento real
(qué otros `.js` llaman a sus funciones vía `grep -l`). Resultado:
`agente-widget.js` es el más grande con diferencia pero tiene **0**
dependientes externos (ya es un IIFE autocontenido) — mejor candidato a
piloto; `modal-item.js` es el más acoplado (7 dependientes externos) —
el más arriesgado, se deja para el final.

**Hallazgo que fija el enfoque técnico:** varios `onclick="..."` de la app
no están en el HTML estático de `index.html`, se generan dentro de
plantillas JS inyectadas con `innerHTML` (ej. `js/inventory.js:8`, dentro
de `renderSubStats()`). Cualquier función así referenciada tiene que
seguir siendo global (`window.fn`) pase lo que pase con la técnica de
modularización elegida — no es una preferencia, es una restricción real
del código actual.

**Enfoque elegido:** `<script type="module">` nativo, **sin bundler**
(esbuild/Vite quedó descartado — añadiría un paso de build nuevo al
despliegue, hoy "`git push` → Cloudflare Pages despliega solo", riesgo
desproporcionado para un proyecto mantenido por una persona). Los módulos
nuevos pueden seguir leyendo los globales existentes (`SESSION`, `CATS`,
`apiCall`...) sin convertir `config.js`/`state.js`/`api.js`, lo que
permite hacerlo archivo por archivo en vez de una migración de golpe.

**Ritmo: oportunista**, decisión explícita del usuario — no es un proyecto
dedicado, se aplica la próxima vez que una tarea real toque uno de los
archivos grandes, extrayendo una sola pieza cohesionada cada vez (nunca el
archivo entero de una sesión). Alcance explícitamente descartado por ahora:
`index.html` y `css/styles.css` (sin forma nativa de trocear HTML sin JS
ni build step), TypeScript, y no resuelve la falta de tests de
frontend/E2E (Pendiente #21 original, sigue abierto aparte).

Diseño completo, con el checklist paso a paso del proceso, la tabla de
prioridad y un piloto concreto detallado (`js/agente-widget.js` →
`js/agente-voz.js`, el bloque de reconocimiento de voz, ~130 líneas
autocontenidas) en
[`docs/superpowers/specs/2026-08-28-modularizacion-js-design.md`](superpowers/specs/2026-08-28-modularizacion-js-design.md).
`docs/ROADMAP.md` [2.2] actualizado para enlazar a este diseño en vez de
la propuesta antigua (bundler + `js/main.js`, nunca detallada).

---

### 28/08/2026 (v649) — Volt hereda el tema claro/oscuro de la app

Cierra el hallazgo #3 de "Diseño / estética" de la auditoría del
27/08/2026, a petición del usuario tras pedirle una revisión "como
diseñador gráfico web" de la interfaz. El conteo original de esa
auditoría ("36 hex hardcodeados, 0 `var(--...)`") subestimaba el alcance
real: un grep de `#[0-9a-f]{3,6}` en `js/agente-widget.js` encontró **155
ocurrencias** (~30 colores distintos), repartidas entre el bloque
`<style>` inyectado (líneas 148-284) y decenas de `style="color:..."`
inline dentro de las plantillas de chat/formularios generadas con
concatenación de strings — Volt no es un componente pequeño, son 4400
líneas con su propio mini sistema de diseño paralelo al de la app.

**Decisión de diseño:** en vez de crear un espacio de tokens `--ag-*`
nuevo (que habría exigido diseñar una paleta clara desde cero para cada
uno de los ~30 colores), se reutilizan directamente los tokens que
`css/styles.css` ya define en `:root`/`body.dark` — `--bg`, `--white`,
`--surface2`, `--border`, `--text`, `--muted`, `--accent`, `--acc2`,
`--green`/`--green-l`, `--red`/`--red-l`, `--amber`/`--amber-l`, `--teal`.
Los tres tonos de gris "muted" (`#94a3b8`/`#64748b`/`#475569`) y los tres
de texto claro (`#f1f5f9`/`#e2e8f0`/`#cbd5e1`) que Volt usaba para dar
jerarquía dentro de su propio panel oscuro colapsan a un único
`var(--muted)`/`var(--text)` — el resto de la app tampoco tiene más de un
nivel de cada uno, así que era la propia inconsistencia de Volt la que
sobraba, no una pérdida real de jerarquía. Las paletas de "acento" de
Volt (verde/rojo/ámbar/morado/celeste, una por tipo de formulario rápido:
alta de ítem, préstamo, mantenimiento, actualizar stock, cambiar estado)
mapean 1:1 a los pares hue-existentes de la app (`--green`, `--red`,
`--amber`, `--acc2` para el morado, `--teal` para los dos celestes/cian
que Volt distinguía sin motivo real). Las burbujas del chat con texto
claro sobre fondo de color (`.ag-msg-user`, `.ag-btn-blue`) se dejaron con
`color:#fff` explícito en vez de `var(--text)` — con `var(--text)` en modo
claro habría quedado texto casi negro sobre azul, imposible de leer; ese
es exactamente el tipo de error que un mapeo ciego "todo lo que sea un
hex se convierte en su token más parecido" habría introducido.

**Excepciones deliberadas, sin tokenizar:**
- Overlay de escaneo QR/código de barras (`#000`/`#fff` en la función que
  monta `overlay.style.cssText`) — es un visor de cámara en vivo a
  pantalla completa, necesita fondo negro fijo para que el vídeo se vea
  con contraste sea cual sea el tema de la app, igual que cualquier
  visor de cámara nativo.
- Extremo del degradado del FAB (`#1d4ed8`) — color de marca fijo, mismo
  patrón que ya usa `css/styles.css:581` (`.mod-code`, gradiente
  `var(--accent)` + `#1d4ed8` literal) para otro elemento de marca.

**Un caso encontrado y corregido durante el mapeo:** `.ag-btn-blue` no
tenía `color` propio en la regla original, heredaba el `color` de
`.ag-btn` (pensado para fondo neutro oscuro). Al tokenizar `.ag-btn`
pasa a `color:var(--text)` (correcto sobre su fondo neutro
`var(--white)`), pero `.ag-btn-blue` sobrescribe el fondo a
`var(--accent)` (azul saturado) sin tocar el color de texto heredado —
en modo claro habría quedado texto oscuro sobre azul medio, contraste
insuficiente. Se añadió `color:#fff` explícito a `.ag-btn-blue` para
corregirlo antes de que llegara a producción.

**Verificación:** Playwright sirviendo el HTML estático con
`python -m http.server` (el panel de Volt se construye al cargar la
página, antes del login — no hace falta backend/D1 para comprobar
colores). Comparado el panel en modo oscuro (por defecto) y claro
(toggle `#btnTheme`) en escritorio, más una pasada en 390×844 (mismo
viewport que el bug de overflow de v645) para confirmar que la
tokenización no rompió el layout móvil. Sin regresión visual encontrada.

Sin cambios de backend ni de esquema — puramente CSS/JS de presentación,
`sw.js` → v649.

---

**Última actualización:** 28/08/2026 — Volt hereda el tema claro/oscuro de la app (v649, cierra el hallazgo #3 de la auditoría del 27/08/2026), + diseño del proceso de modularización de JS (sin implementar, ritmo oportunista), + pestañas Auditoría/CSV de Volt solo para superadmin (v648), + 4 pendientes menores cerrados en v647 (#7 permiso `items.read`, #9 migración `ia_deteccion_ejemplos`, #18 ideas volcadas a IDEAS.md, #20 scoping "tus aulas" en Stock bajo/Mantenimiento)
