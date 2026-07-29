# Nota de Trabajo - Bosco Inventario

**Estado:** v468 | 29/07/2026 | Rebranding en curso a `boscoinventario`, expansión multi-departamento planificada, servidor Apache restaurado (docker-desktop stable, inventario-node pendiente)

Inventario general del **IES El Bosco**. Nació como el inventario de un solo
departamento y está pasando a ser el inventario de todo el centro, con cada
departamento gestionando el suyo desde la misma app. No usar mención
específica de un departamento en textos nuevos — ver
[docs/PLAN_MULTIDEPARTAMENTO.md](docs/PLAN_MULTIDEPARTAMENTO.md).

Documentación técnica detallada movida a `docs/` — este archivo es solo el
resumen operativo para trabajar sesión a sesión. Ver sección
[Documentación en GitHub](#documentación-en-github-docs) al final.

---

## Contexto Actual

### Modo de Operación
- Base de datos: **Cloudflare D1 remota** (no local, ID: `5e996989-1972-481e-a43a-136e25380906`, nombre técnico heredado `inventario-departamento`)
- Deployment: Git push → Cloudflare Pages auto-deploya (repo `slatorre-dev/boscoinventario`, sitio `boscoinventario.pages.dev` — sincronización pendiente de que termine la subida manual)
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
- **Wrangler:** `npx wrangler` (instalado global en npm)
- **Git remotes:** `origin` → slatorre-dev/boscoinventario (principal; subida manual en curso, repo anterior era sebantonio/SQLInventarioElecFP)
- **D1 backup:** `npx wrangler d1 export inventario-departamento --remote --output backup_FECHA.sql`

---

## Arquitectura de archivos clave

```
functions/api/          — Cloudflare Pages Functions (backend)
  _middleware.js        — Auth: lee u+p o u+token de query params, pasa user via data.user
  intent-learning.js    — NUEVO: aprendizaje Volt en D1
  prestar.js, item.js, list.js, historial.js, usuarios.js...

js/
  agente-widget.js      — Agente Volt (NLP, chat, voz, aprendizaje)
  inventory.js          — Inventario principal, filtros, vistas
  modal-item.js         — Modal edición/creación items, contenedores SET-/CONT-
  roles.js              — Permisos por rol
  config.js             — CICLOS, AULAS, CATS (se sobreescriben con datos D1 al login)
  state.js              — Estado global SESSION

sw.js                   — Service Worker, VERSION aquí
migrations/             — SQL de migraciones D1
  intent_learning.sql   — Tabla aprendizaje Volt
```

---

## Auth actual (CRÍTICO pendiente)
- Credenciales van en query params `?u=usuario&p=password` — visible en logs/historial
- `_middleware.js` valida contra D1 y pasa `data.user` al handler
- **No usar `request.user`** — es inmutable en Workers, siempre leer de `data.user`

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
desde v317 + tabla de versionado completa). Últimas dos sesiones, resumen:

- **29/07/2026:** acordado el paso a inventario general del centro.
  Creado [`docs/PLAN_MULTIDEPARTAMENTO.md`](docs/PLAN_MULTIDEPARTAMENTO.md)
  (lista de departamentos, mapeo usuario→departamento, decisiones de
  arquitectura). Documentación repartida en `docs/`. Repo en subida manual a
  `slatorre-dev/boscoinventario`, sync con Cloudflare Pages pendiente.
- **30/05/2026 (v468):** servidor Apache restaurado tras 24h de caída por un
  script `observed.service` que mataba procesos de alto CPU y tumbaba
  Docker Desktop. Los 8 contenedores (apache, mysql, n8n, influxdb, nodered,
  Mosquitto, Grafana, portainer) recuperados con persistencia validada.
  Pendiente: debuguear `inventario-node` (`DB undefined` en `auth.js:13`,
  wrapper mysql2 sin inicializar) — ver detalle en DEVELOPMENT.md.

---

## Pendiente (Próximas sesiones)

Backlog corto en [`docs/ROADMAP.md`](docs/ROADMAP.md), seguridad en
[`docs/SECURITY.md`](docs/SECURITY.md), expansión de departamentos en
[`docs/PLAN_MULTIDEPARTAMENTO.md`](docs/PLAN_MULTIDEPARTAMENTO.md). Próximo
paso inmediato: Fase 0 del plan multi-departamento (rebranding de archivos
de aplicación) en cuanto termine la subida manual del repo.

---

## Modo Ahorro de Tokens
- Respuestas cortas y directas (100-200 tokens por defecto)
- Solo archivos indicados, sin exploración automática
- Solo bloques modificados, no archivos completos
- Sin explicaciones salvo que se pidan

---

## Documentación en GitHub (`docs/`)
- `docs/PLAN_MULTIDEPARTAMENTO.md` — plan de expansión a todo el centro
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
