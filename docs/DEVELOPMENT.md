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

**Última actualización:** 17/05/2026 — Sesión 5 (v166)
