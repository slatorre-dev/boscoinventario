# Nota de Trabajo - Bosco Inventario

**Estado:** v475 | 29/07/2026 | Multi-departamento: Fases 0, 1 y 2 del plan
implementadas y desplegadas. Repo `slatorre-dev/boscoinventario` en marcha,
D1 propia (`boscoinventario`) con 24 departamentos, aislamiento real por
departamento en el backend. Falta Fase 3 (selector de departamento para
superadmin en el frontend).

Inventario general del **IES El Bosco**: cada departamento gestiona su
propio inventario (aulas, categorías, ciclos, profesores, préstamos) desde
la misma app, aislado del resto. Solo `superadmin` ve todos los
departamentos. No usar mención específica de un departamento en textos
nuevos — detalle completo en
[docs/PLAN_MULTIDEPARTAMENTO.md](docs/PLAN_MULTIDEPARTAMENTO.md).

Documentación técnica detallada movida a `docs/` — este archivo es solo el
resumen operativo para trabajar sesión a sesión. Ver sección
[Documentación en GitHub](#documentación-en-github-docs) al final.

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
3. `git add` archivos concretos + `git commit -m "..."`
4. `git push origin main`
5. Cloudflare Pages despliega automáticamente
6. Usuarios reciben actualización (SW cache-bust)

### Entorno
- **Terminal:** PowerShell en VS Code
- **Node TLS (red corporativa):** `$env:NODE_TLS_REJECT_UNAUTHORIZED="0"` antes de comandos wrangler
- **Wrangler:** `npx wrangler` (instalado global en npm) — necesita `wrangler login` interactivo (no funciona en shells no interactivas)
- **Git remotes:** `origin` → `slatorre-dev/boscoinventario` (principal, único remoto al que se hace push); `slatorre` → `slatorre-dev/SQLInventarioElecFP` (proyecto **distinto y no relacionado**, no tocar nunca)
- **D1 backup:** `npx wrangler d1 export boscoinventario --remote --output backup_FECHA.sql`
- **Cuenta Cloudflare:** el D1 `boscoinventario` vive en la cuenta de `slatorre@iesjuanbosco.es`. Si `wrangler` da error de autenticación de cuenta al ejecutar comandos D1, borrar `.wrangler/cache/wrangler-account.json` (cachea la cuenta de una sesión anterior) y reintentar.

---

## Multi-departamento — Estado de implementación (29/07/2026)

Plan completo, decisiones de arquitectura y lista de los 24 departamentos en
[docs/PLAN_MULTIDEPARTAMENTO.md](docs/PLAN_MULTIDEPARTAMENTO.md). Resumen de
lo ya construido:

### Fase 0 — Rebranding (hecho)
- Quitadas las menciones a "Electricidad/Electrónica" de `index.html`,
  `manifest.json`, `README.md` — ahora dicen "Inventario IES Juan Bosco".
- Badge junto al logo (`#brandDept`) muestra el departamento del usuario
  logueado tras el login (oculto para `superadmin`).

### Fase 1 — Modelo de datos (hecho, migraciones `0007`/`0008`)
- Tabla nueva `departamentos` (slug, nombre, icono, color, orden) — 24 filas
  seed (ver `migrations/0007_departamentos.sql`).
- Columna `departamento` (TEXT, guarda el `slug`) añadida a: `usuarios`,
  `aulas`, `inventario`, `ciclos`.
- `categorias` y `ciclos` tenían PK global (`name` / `cicloId+modCod`) que
  colisionaría entre departamentos — se recrearon con PK compuesta
  (`name+departamento` / `cicloId+modCod+departamento`).
- `profesores.departamento` (ya existía, antes decorativo) ahora se usa de
  verdad para scoping: se rellena server-side con el departamento del actor,
  no con lo que mande el cliente.
- Seed de aulas (`migrations/0008_aulas_seed.sql`): 70 aulas globales
  (`aula1`..`aula70`, `departamento=''`, visibles para todos) + 1 aula propia
  por departamento (`dept-<slug>`, ej. `dept-musica`).
- Seed de usuarios (`migrations/0005`/`0006`): un usuario
  `departamento<slug>` (rol `jefe/a departamento`) y un `profe1<slug>` (rol
  `profesor`) por cada uno de los 24 departamentos, contraseña = usuario.

### Fase 2 — Auth y scoping backend (hecho)
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
- Frontend: `SESSION.departamento` (slug) y `SESSION.departamentoNombre`
  (nombre bonito, resuelto en el login vía join a `departamentos`).

### Fase 3 — Frontend, pendiente
- Selector de departamento visible solo para `superadmin` (hoy ve todo sin
  poder filtrar por uno en concreto).
- Alta de usuarios/profesores desde la UI no expone un campo "departamento"
  para que `superadmin` elija a qué departamento asignarlos — por ahora hay
  que hacerlo por SQL directo (`UPDATE usuarios SET departamento=? WHERE
  usuario=?`).

### Gaps conocidos (no cubiertos, a valorar)
- `functions/api/docs.js` (documentos adjuntos en Drive) y `functions/api/backup.js`
  (backup completo) **no** filtran por departamento — quedan pendientes.
- `ubicaciones` (sitios sugeridos) se mantiene global, no por departamento.
- `userAssignModulos` en `usuarios.js`: si lo ejecuta un `superadmin` sin
  departamento propio asignado, solo tocará ciclos con `departamento=''`.

---

## Arquitectura de archivos clave

```
functions/api/          — Cloudflare Pages Functions (backend)
  _middleware.js        — Auth: lee u+p o u+token de query params, resuelve data.user + data.departamento
  intent-learning.js    — Aprendizaje Volt en D1
  prestar.js, item.js, list.js, historial.js, usuarios.js... — todos con scoping por departamento (ver arriba)

js/
  agente-widget.js      — Agente Volt (NLP, chat, voz, aprendizaje)
  inventory.js          — Inventario principal, filtros, vistas
  modal-item.js         — Modal edición/creación items, contenedores SET-/CONT-
  roles.js              — Permisos por rol
  config.js             — CICLOS, AULAS, CATS (se sobreescriben con datos D1 al login, ya filtrados por departamento)
  state.js              — Estado global SESSION (incluye departamento/departamentoNombre)
  auth.js               — Login, badge de departamento (#brandDept)

sw.js                   — Service Worker, VERSION aquí
migrations/             — SQL de migraciones D1 (0001-0006 esquema/seed original, 0007-0008 multi-departamento)
```

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

Movido a [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) (todas las sesiones
desde v317 + tabla de versionado completa). Últimas sesiones, resumen:

- **29/07/2026 (v469-v475):** sesión larga de migración a multi-departamento.
  1) Repo subido y sincronizado en `slatorre-dev/boscoinventario` (origin
     reapuntado, remoto viejo `slatorre` intacto). 2) Creada D1 propia
     `boscoinventario` (independiente de cualquier base anterior), 7
     migraciones de esquema aplicadas + usuario `Admin`/`Admin` (superadmin).
  3) 24 usuarios `departamentoXXX` (jefe/a departamento) + 24 `profe1XXX`
     (profesor), uno por departamento, usuario=contraseña. 4) Rebranding
     (Fase 0): login/título/manifest ya no mencionan Electricidad/Electrónica,
     badge de departamento junto al logo tras login. 5) Aislamiento real por
     departamento implementado (Fase 1+2, ver sección arriba): tabla
     `departamentos`, columna `departamento` en las tablas clave, scoping en
     todos los endpoints backend. 6) Seed de 94 aulas (70 globales + 24
     propias de departamento). Pendiente: Fase 3 (selector de departamento
     para superadmin en frontend) y scoping de `docs.js`/`backup.js`.
- **30/05/2026 (v468):** servidor Apache restaurado tras 24h de caída por un
  script `observed.service` que mataba procesos de alto CPU y tumbaba
  Docker Desktop. Los 8 contenedores (apache, mysql, n8n, influxdb, nodered,
  Mosquitto, Grafana, portainer) recuperados con persistencia validada.
  Pendiente: debuguear `inventario-node` (`DB undefined` en `auth.js:13`,
  wrapper mysql2 sin inicializar) — ver detalle en DEVELOPMENT.md.

---

## Pendiente (Próximas sesiones)

Backlog corto en [`docs/ROADMAP.md`](docs/ROADMAP.md), seguridad en
[`docs/SECURITY.md`](docs/SECURITY.md), plan multi-departamento en
[`docs/PLAN_MULTIDEPARTAMENTO.md`](docs/PLAN_MULTIDEPARTAMENTO.md). Próximos
pasos concretos:

1. **Fase 3 del plan multi-departamento**: selector de departamento para
   `superadmin` en el frontend; campo departamento en alta de
   usuarios/profesores desde la UI.
2. Scoping por departamento de `docs.js` (documentos adjuntos) y `backup.js`.
3. Repartir credenciales (`departamentoXXX`/`profe1XXX`) a cada jefe/a de
   departamento real y comprobar que ven solo su propio inventario.
4. Seguridad crítica pendiente desde antes de la migración multi-departamento
   (sin relación con lo anterior): credenciales en query params, contraseñas
   sin hash — ver `docs/SECURITY.md`.

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
- `docs/IDEAS.md` — ideas sugeridas sin priorizar
- `docs/DEVELOPMENT.md` — registro de sesiones de desarrollo y versionado
- `docs/MIGRACION_APACHE.md` — migración a Ubuntu + Apache + Node.js + SQLite
- `.claude/memory/` — memorias de sesiones para Claude (sincronizadas con git)
- Ver: https://github.com/slatorre-dev/boscoinventario
