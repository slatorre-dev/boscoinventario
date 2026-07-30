# 🏗️ Arquitectura - Bosco Inventario

Documento técnico que explica cómo funciona la aplicación internamente.

---

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Componentes Principales](#componentes-principales)
4. [Flujos de Datos](#flujos-de-datos)
5. [Autenticación](#autenticación)
6. [Base de Datos](#base-de-datos)
7. [API Endpoints](#api-endpoints)
8. [PWA & Service Worker](#pwa--service-worker)
9. [Agente IA](#agente-ia)
10. [Seguridad (Estado Actual)](#seguridad-estado-actual)

---

## Visión General

Bosco Inventario es una aplicación web **PWA (Progressive Web App)** para
gestionar el inventario de todo el IES El Bosco. Cada departamento del
centro gestiona su propio inventario, aulas, categorías, ciclos y préstamos
desde la misma app, aislado del resto por una columna `departamento` en las
tablas clave — ver [PLAN_MULTIDEPARTAMENTO.md](PLAN_MULTIDEPARTAMENTO.md)
para el detalle de esa arquitectura multi-tenant.

```
┌─────────────────────────────────────────────────────────────┐
│                     ARQUITECTURA GLOBAL                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │  Browser    │◄────────►│ Cloudflare  │                 │
│  │ (Frontend)  │          │   Pages     │                 │
│  │  index.html │          │  (CDN)      │                 │
│  │  + JS       │          │             │                 │
│  └──────────────┘         └──────────────┘                 │
│         ▲                          │                        │
│         │ LocalStorage/            │ Functions/API         │
│         │ Service Worker            │                      │
│         │                          ▼                        │
│         │                   ┌──────────────┐               │
│         │                   │  Workers    │               │
│         │                   │ (Backend)    │               │
│         │                   │  /api/*      │               │
│         │                   └──────────────┘               │
│         │                          │                        │
│         │                          │ D1 Database           │
│         │                          ▼                        │
│         │                   ┌──────────────┐               │
│         └──────────────────►│  D1 SQLite  │               │
│      (si offline)            │  (Remota)   │               │
│                              └──────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Stack Tecnológico

| Capa | Tecnología | Versión | Rol |
|------|-----------|---------|-----|
| **Frontend** | Vanilla JS + HTML5 + CSS3 | ES2020 | UI/UX |
| **Frontend State** | localStorage + JS objects | - | Estado global sin framework |
| **Frontend PWA** | Service Worker | - | Offline-first |
| **Backend** | Cloudflare Workers | v1 | Endpoints API |
| **Database** | D1 (SQLite) | - | Persistencia |
| **Hosting** | Cloudflare Pages | - | CDN global |
| **Auth** | OAuth 2.0 (Google) | - | Autenticación |
| **IA** | GitHub Models (gpt-4o-mini) | - | Chat bot |
| **QR** | jsQR library | - | Scanner QR |

**Alternativa de Herencia:**
- Migrado desde: Google Apps Script + Google Sheets

---

## Componentes Principales

### 1. Frontend (Vanilla JavaScript)

#### index.html
- **Rol:** Punto de entrada único
- **Contiene:**
  - Estructura HTML5 semántica
  - Modales (add/edit items, aulas, categorías, etc.)
  - Navbar y topbar
  - PWA manifest link

#### js/state.js
- **Rol:** Estado global centralizado
- **Variables principales:**
  ```javascript
  let SESSION = { usuario, password, rol, loginTime }
  let items = []          // Array de ítems (28 columnas)
  let AULAS = []          // Ubicaciones pedagógicas
  let CICLOS = []         // Ciclos con módulos
  let CATS = []           // Categorías de ítems
  let UBICACIONES = []    // Ubicaciones físicas
  let TAGS = []           // Tags dinámicos
  ```
- **Problema:** Variables globales sin namespace (riesgo de colisiones)

#### js/api.js
- **Rol:** Wrapper de fetch para llamadas API
- **Función principal:**
  ```javascript
  async function apiCall(endpoint, method, data, headers)
  ```
- **⚠️ CRÍTICO:** Envía usuario+password en query params
  ```javascript
  let url = `/api/${endpoint}?u=${u}&p=${p}`;  // INSEGURO
  ```

#### js/modal-item.js
- **Rol:** Lógica del modal agregar/editar ítems
- **Funciones:** openModal, fillFields, saveItem, deleteItem
- **Problema:** 800+ líneas sin modularizar

#### js/agente-widget.js
- **Rol:** Chat IA flotante
- **Funciones:**
  - `streamAI()` - Llamar API IA con streaming
  - `mostrarFormularioNuevoItem()` - Formulario para crear ítems
  - `detectarIntencionAnadirItem()` - NLP simple
- **Tamaño:** 2000+ líneas
- **⚠️ Riesgo:** Puede enviar password a API IA

---

### 2. Backend (Cloudflare Workers)

#### functions/api/_middleware.js
- **Rol:** Middleware de autenticación
- **Proceso:**
  1. Extrae usuario + password de query/body
  2. Busca en BD de usuarios
  3. Valida password (INSEGURO: sin hash)
  4. Valida permisos de acción
  5. Inyecta `request.user` en contexto

**Flujo:**
```
Request → _middleware.js → Valida auth → Valida permisos → Endpoint
```

#### functions/api/item.js
- **Endpoint:** GET/POST/DELETE `/api/item`
- **Acciones:** add, edit, delete, get
- **Validación:** Usa `.bind()` con placeholders (✅ seguro contra SQL injection)

#### functions/api/auth.js
- **Endpoint:** `/api/auth`
- **Funciones:** login, logout, register (si habilitado)
- **Almacena:** Usuario + password en BD (⚠️ sin hashing)

#### functions/api/backup.js
- **Endpoint:** `/api/backup`
- **Función:** Exportar toda la BD como JSON
- **⚠️ Riesgo:** Incluye contraseñas en plain text

#### functions/api/proxy-ai.js
- **Endpoint:** `/api/proxy-ai` (antes `/proxy/ai`, movido para quedar bajo la
  protección de `_middleware.js` — vivía sin ninguna autenticación)
- **Función:** Proxy a GitHub Models API
- **Modelo:** gpt-4o-mini (gratis con GitHub Copilot)
- **Streaming:** Respuestas en tiempo real

---

### 3. Base de Datos (D1)

#### Tablas Principales (esquema real, tras multi-departamento)

```sql
-- Inventario de ítems (columnas reales de inventario, ver 0001_schema.sql)
inventario (
  id, ref, aula, mod, item, qty, min, cat, loc, est, util,
  fecha, mant, mantFecha, mantNota, mantResp, mantEstado,
  mantSolicitante, mantSolicitanteEmail, foto, obs, code,
  es_contenedor, parent_id, tipo_material, proveedor, tags, oculto,
  departamento          -- añadida en 0007_departamentos.sql
)

usuarios (
  usuario PRIMARY KEY, password, nombre, rol, email,
  departamento,         -- slug del departamento (añadida en 0007)
  google_id, auth_method, session_token   -- añadidas en 0004_google_oauth.sql
)

aulas (id PRIMARY KEY, name, icon, desc, th, orden, departamento)
-- departamento='' significa aula global (compartida por todo el centro)

categorias (name, c, bg, i, orden, departamento, PRIMARY KEY(name, departamento))
-- PK compuesta: dos departamentos pueden tener una categoría con el mismo nombre

ciclos (
  cicloId, cicloNombre, nivel, icon, th, desc,
  modCod, modNombre, modHoras, cicloOrden, modOrden, responsable,
  departamento, PRIMARY KEY(cicloId, modCod, departamento)
)

departamentos (slug PRIMARY KEY, nombre, icono, color, orden)  -- 0007_departamentos.sql, 24 filas

profesores (id PRIMARY KEY, nombre, departamento, email)
-- departamento aquí SÍ se usa para scoping (antes era solo decorativo)

prestamos (id, itemId, itemNombre, cantidad, aulaOrigen, aulaDestino,
  profesorId, profesorNombre, gestionadoPor, fechaPrestamo, fechaPrevista,
  fechaDevolucion, cantidadDevuelta, estado, obs)
-- sin columna departamento propia: se filtra vía JOIN a inventario.departamento

log (id, fecha, usuario, nombre, rol, accion, itemId, resumen)
-- sin columna departamento: se filtra vía JOIN usuario -> usuarios.departamento

ubicaciones (name PRIMARY KEY, orden)     -- global, no scoped por departamento
reset_tokens (token PRIMARY KEY, usuario, expires)
intent_learning (...)                     -- ver BACKEND_APRENDIZAJE_INTENCIONES.md
```

**Tablas sin scoping por departamento (gap conocido):** los documentos
adjuntos (`documentos`, gestionados desde `functions/api/docs.js`) y el
backup completo (`functions/api/backup.js`) no filtran por departamento
todavía.

#### Migrations
- `0001_schema.sql` - Schema inicial
- `0002_historial.sql` - Tabla historial
- `0003_superadmin.sql` - Usuario admin inicial
- `0004_google_oauth.sql` - Columnas para Google Sign-In
- `0005_departamentos_seed.sql` / `0006_profesores_seed.sql` - usuarios de ejemplo por departamento
- `0007_departamentos.sql` - tabla `departamentos` + columna `departamento` en tablas clave + recompone PK de `categorias`/`ciclos`
- `0008_aulas_seed.sql` - 70 aulas globales + 24 aulas propias de departamento

---

## Flujos de Datos

### Flujo 1: Login

```
1. Usuario ingresa credenciales en index.html
   ↓
2. js/auth.js → apiCall('/api/auth?action=login&u=...&p=...')
   ↓
3. functions/api/auth.js recibe
   ↓
4. _middleware.js valida usuario en BD
   ↓
5. Devuelve { ok: true, user, rol, token? }
   ↓
6. js/state.js guarda SESSION en localStorage
   ↓
7. UI se actualiza basada en rol
```

**Problema:** Password viaja en URL y localStorage

---

### Flujo 2: Agregar Ítem

```
1. Usuario hace click "+ Nuevo"
   ↓
2. js/modal-item.js → openModal()
   ↓
3. Modal se llena con dropdowns (AULAS, CICLOS, CATS)
   ↓
4. Usuario completa formulario + sube foto (base64)
   ↓
5. Click "Guardar" → apiCall('/api/item', 'POST', { action: 'add', item: {...} })
   ↓
6. functions/api/item.js
   - Valida permisos (¿es admin?)
   - INSERT en BD
   - Registra en historial (si existe tabla)
   ↓
7. Devuelve { ok: true, id }
   ↓
8. js/inventory.js recarga lista
   ↓
9. Modal cierra
```

---

### Flujo 3: PWA Offline

```
1. Usuario abre app por primera vez
   ↓
2. sw.js cachea:
   - HTML, CSS, JS principales
   - Imágenes
   - API responses recientes
   ↓
3. Si se desconecta internet:
   ↓
4. sw.js sirve desde caché
   ↓
5. API calls fallan silenciosamente (⚠️ no hay requeue)
   ↓
6. Cuando vuelve conexión:
   - No sincroniza automáticamente
   - Usuario debe recargar página
```

**Problema:** No hay queue de cambios offline

---

## Autenticación

### Método Actual: Query String + localStorage

```javascript
// API requests:
/api/item?u=profesor@school&p=mypassword123&action=add

// Almacenamiento:
localStorage.inv_session = {
  usuario: "profesor@school",
  password: "mypassword123",
  rol: "jefe/a departamento",
  loginTime: 1716518400000
}
```

**⚠️ Riesgos Críticos:**
- Password en URL → Visible en browser history, logs, proxies
- Password en localStorage → XSS accede directamente
- Sin expiración de sesión → Sesión activa indefinidamente
- Sin refresh tokens → Token no rota nunca

### Propuesta de Mejora: Bearer Tokens

```javascript
// POST /api/auth
{
  "usuario": "profesor@school",
  "password": "mypassword123"
}

// Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",  // JWT con exp: 1h
  "refreshToken": "rt_abc123...",             // Token para renovar
  "expiresIn": 3600
}

// Almacenar solo en memoria:
SESSION.accessToken = "eyJhbGciOiJIUzI1NiIs..."

// API requests:
fetch('/api/item', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIs...'
  }
})
```

---

## Base de Datos

### Conexión D1

```javascript
// En functions/api/*.js
export async function onRequestGet({ request, env, data }) {
  const db = env.DB;              // D1 binding from wrangler.toml
  const dept = data.departamento; // resuelto por _middleware.js

  const { results } = await db.prepare(
    `SELECT * FROM inventario WHERE id = ? AND departamento = ?`
  ).bind(id, dept).all();

  return Response.json(results);
}
```

Patrón real usado en todos los handlers: si `isSuperAdmin(data.user)` es
`true` se consulta sin filtrar; si no, se añade `WHERE departamento = ?`
(o se verifica ownership antes de un `UPDATE`/`DELETE`). Ver
`functions/api/list.js` e `item.js` como referencia.

### Queries Principales

```sql
-- Listar los ítems de un departamento
SELECT * FROM inventario WHERE departamento = ? ORDER BY id;

-- Buscar por categoría dentro del propio departamento
SELECT * FROM inventario WHERE cat = 'Herramientas' AND departamento = ? LIMIT 100;

-- Contar por estado (propio departamento)
SELECT est, COUNT(*) as total FROM inventario WHERE departamento = ? GROUP BY est;

-- Historial de cambios de un ítem
SELECT * FROM log WHERE itemId = ? ORDER BY id DESC;
```

---

## API Endpoints

### Autenticación

```
POST /api/auth?action=login&u=usuario&p=password
→ { ok: true, user, rol, session_id }

POST /api/auth?action=logout
→ { ok: true }
```

### Inventario (Items)

```
GET /api/item?id=123
→ { ok: true, item: {...} }

POST /api/item?action=add
Body: { item: {...} }
→ { ok: true, id: 456 }

POST /api/item?action=edit&id=123
Body: { item: {...} }
→ { ok: true }

DELETE /api/item?id=123
→ { ok: true }

GET /api/list
→ { ok: true, items: [...], count: 1000 }
```

### Configuración

```
GET /api/config
→ { AULAS, CICLOS, CATS, UBICACIONES }
```

### IA (Proxy)

```
POST /api/proxy-ai?u=usuario&p=password
Body: { model: "gpt-4o-mini", stream: true, messages: [...] }
→ Streaming response con chunks (formato OpenAI)
```

Ver **API.md** para documentación completa.

---

## PWA & Service Worker

### Service Worker (sw.js)

```javascript
const VERSION = 'v317';
const CACHE_SHELL = 'inventario-fp-shell-v317';
const CACHE_DYNAMIC = 'inventario-fp-dynamic-v317';

// Estrategia: Cache-first para assets, Network-first para API
```

**Caching Strategy:**
- **Shell (HTML/CSS/JS):** Cache-first (expires si VERSION cambia)
- **Images:** Cache-first (1 año)
- **API calls:** Network-first (fallback a caché stale)
- **Data (items, etc.):** Network-first

**Problema:**
- Service Worker versiona manualmente → risk de olvidar
- No hay sincronización en background
- Offline mode es degradado (solo lectura)

---

## Agente IA

### Arquitectura del Agente

```javascript
// agente-widget.js

// 1. Widget flotante en esquina
<div id="agente-widget">
  <button onclick="openChat()">💬 Asistente</button>
  <div id="chat-messages">...</div>
</div>

// 2. Detección de intención
if (detectarIntencionAnadirItem(query)) {
  mostrarFormularioNuevoItem(nombreInicial);
}

// 3. Streaming de respuesta
async function streamAI(prompt) {
  const response = await fetch('/api/proxy-ai?u=' + u + '&p=' + p, { method: 'POST', body: JSON.stringify({prompt}) });
  const reader = response.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    // Mostrar chunk por chunk en UI
  }
}
```

### Puntos de Integración

- **Búsqueda de ítems:** "¿Dónde está el multímetro?"
- **Crear ítems:** "Quiero agregar un Arduino Uno"
- **Consultas generales:** "¿Cuántos ítems hay?"

### ⚠️ Riesgo de Seguridad

Si se envía `SESSION` al modelo:
```javascript
getCreds() // Puede incluir password
→ Enviado a GitHub Models
```

**Recomendación:** Nunca enviar credenciales a APIs externas

---

## Seguridad (Estado Actual)

### ❌ Problemas Críticos Identificados

#### 1. Credenciales en URL
```javascript
// INSEGURO
/api/item?u=usuario&p=password&action=add
```
- Visible en browser history
- Logged en servidores
- Capturable por XSS

**Solución:** Bearer tokens + Authorization header

#### 2. Password sin Hashing
```javascript
// INSEGURO
SELECT * FROM usuarios WHERE usuario=? AND password=?
```
- Base de datos es plain text
- Si BD se filtra, compromete todos los usuarios
- Incumple regulaciones de datos

**Solución:** Bcrypt o Argon2

#### 3. Sin Rate-Limiting
- Fuerza bruta de login sin límite
- DOS posible en endpoints

**Solución:** Cloudflare rate-limit rules

#### 4. Sin Session Timeout
- Sesión activa indefinidamente
- Riesgo en dispositivos compartidos

**Solución:** Expiración de token + auto-logout

#### 5. Validación de Permisos solo en Frontend
```javascript
// INSEGURO
if (can('delete_item')) {
  // Frontend valida, pero backend confía en el cliente
}
```

**Solución:** Backend SIEMPRE re-valida

Ver **SECURITY.md** para detalles y recomendaciones.

---

## Diagrama de Secuencia: Agregar Ítem

```
Usuario          Browser         Backend         Database
  │                  │               │               │
  │─ "Nuevo Ítem"──→│               │               │
  │                  │               │               │
  │              openModal()         │               │
  │              (local)             │               │
  │                  │               │               │
  │── Completa form──│               │               │
  │                  │               │               │
  │─── Click Guardar─│               │               │
  │                  │               │               │
  │                  │─apiCall─────→│               │
  │                  │ (POST /api/   │               │
  │                  │  item)        │               │
  │                  │               │               │
  │                  │              _middleware     
  │                  │              (valida auth)
  │                  │               │               │
  │                  │              item.js         
  │                  │              (INSERT)────────→│
  │                  │               │              INSERT OK
  │                  │               │←─────────────│
  │                  │               │               │
  │                  │←─ {ok:true}──│               │
  │                  │               │               │
  │              reloadData()        │               │
  │              (local)             │               │
  │                  │               │               │
  │    ← Item added  │               │               │
```

---

## Próximas Mejoras (Roadmap)

1. **Refactorizar modales** → Componente genérico (reduce 50% código)
2. **Modularizar JS** → ES6 modules (mejor mantenimiento)
3. **Migrar a TypeScript** → Type safety
4. **Implementar testing** → Vitest + Playwright
5. **Mejorar seguridad** → Bearer tokens + hashing

Ver **ROADMAP.md** para plan detallado.

---

**Última actualización:** Mayo 2026 (v317+)
**Autor:** Análisis de código y arquitectura
**Revisor:** Necesita revisión de seguridad
