# Migración a Cloudflare D1 + Workers
## Inventario IES Juan Bosco

> **Este documento es una guía paso a paso para migrar el backend de Google Apps Script + Google Sheets a Cloudflare D1 (base de datos SQL) + Cloudflare Workers (backend JS).**
> Se hará en un repo y página de Cloudflare nuevos, sin tocar el proyecto actual.

---

## Por qué merece la pena

| | Situación actual (GAS + Sheets) | Después (D1 + Workers) |
|---|---|---|
| Tiempo de carga | 5-30 segundos | < 200ms |
| Caché necesaria | Sí, para compensar | No hace falta |
| Coste | Gratuito | Gratuito (mismo plan Cloudflare) |
| Redespliegue manual | Sí, cada cambio en GAS | No, git push despliega todo |
| Límite de ejecución | 30s por petición en GAS | Sin límite práctico |

---

## Visión general del nuevo stack

```
Navegador
    │
    ├── GET/POST → https://inventario-v4.pages.dev/api/*
    │                        │
    │               Cloudflare Worker (backend JS)
    │                        │
    │               Cloudflare D1 (SQLite en el edge)
    │
    └── HTML/CSS/JS → Cloudflare Pages (igual que ahora)
```

El Worker es un archivo JS que recibe peticiones HTTP y hace queries SQL a D1.
Es el equivalente al `appscript.txt` actual, pero en JS moderno y sin los límites de GAS.

---

## Requisitos previos

- Cuenta en Cloudflare (ya la tienes)
- Node.js instalado (para usar Wrangler, la CLI de Cloudflare)
- Git instalado
- El repo actual funcionando (para exportar los datos)

### Instalar Wrangler (CLI de Cloudflare)

```bash
npm install -g wrangler
wrangler login
# Se abre el navegador para autenticarse con tu cuenta Cloudflare
```

---

## FASE 1 — Crear el nuevo proyecto

### Paso 1.1 — Crear repo nuevo en GitHub

1. Ve a github.com → **New repository**
2. Nombre: `inventarioDepartamentoV4` (o el que prefieras)
3. Privado o público según prefieras
4. Clonarlo en local:
```bash
git clone https://github.com/TU_USUARIO/inventarioDepartamentoV4.git
cd inventarioDepartamentoV4
```

### Paso 1.2 — Copiar el frontend del proyecto actual

Copia todos estos archivos/carpetas del repo actual al nuevo:
```
index.html
manifest.json
sw.js
favicon.svg
css/
js/
icons/
```

**No copies:** `appscript.txt`, `deploy.ps1`, `MIGRACION_CLOUDFLARE_D1.md`

### Paso 1.3 — Crear estructura de carpetas para el Worker

```bash
mkdir functions
mkdir functions/api
```

La carpeta `functions/` es especial en Cloudflare Pages — cada archivo JS dentro se convierte automáticamente en una ruta de API. Por ejemplo:
- `functions/api/list.js` → responde en `/api/list`
- `functions/api/item.js` → responde en `/api/item`

No necesitas configurar rutas manualmente.

### Paso 1.4 — Crear wrangler.toml (configuración de Cloudflare)

Crea el archivo `wrangler.toml` en la raíz del proyecto:

```toml
name = "inventario-departamento-v4"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "inventario-departamento"
database_id = "PENDIENTE_RELLENAR"
```

El `database_id` lo obtendrás en el Paso 2.1.

---

## FASE 2 — Crear la base de datos D1

### Paso 2.1 — Crear la base de datos

```bash
wrangler d1 create inventario-departamento
```

Wrangler te devuelve algo como:
```
✅ Successfully created DB 'inventario-departamento'
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copia ese `database_id` y ponlo en `wrangler.toml`.

### Paso 2.2 — Crear las tablas (schema.sql)

Crea el archivo `schema.sql` en la raíz:

```sql
-- Inventario de ítems
CREATE TABLE IF NOT EXISTS inventario (
  id        INTEGER PRIMARY KEY,
  ref       TEXT DEFAULT '',
  aula      TEXT DEFAULT '',
  mod       TEXT DEFAULT '',
  item      TEXT DEFAULT '',
  qty       INTEGER DEFAULT 0,
  min       INTEGER DEFAULT 0,
  cat       TEXT DEFAULT '',
  loc       TEXT DEFAULT '',
  est       TEXT DEFAULT '',
  util      TEXT DEFAULT '',
  fecha     TEXT DEFAULT '',
  mant      TEXT DEFAULT '',
  mantFecha TEXT DEFAULT '',
  mantNota  TEXT DEFAULT '',
  mantResp  TEXT DEFAULT '',
  mantEstado TEXT DEFAULT '',
  mantSolicitante TEXT DEFAULT '',
  mantSolicitanteEmail TEXT DEFAULT '',
  foto      TEXT DEFAULT '',
  obs       TEXT DEFAULT '',
  code      TEXT DEFAULT ''
);

-- Usuarios de la app
CREATE TABLE IF NOT EXISTS usuarios (
  usuario   TEXT PRIMARY KEY,
  password  TEXT DEFAULT '',
  nombre    TEXT DEFAULT '',
  rol       TEXT DEFAULT 'profesor',
  email     TEXT DEFAULT ''
);

-- Profesores prestatarios
CREATE TABLE IF NOT EXISTS profesores (
  id           INTEGER PRIMARY KEY,
  nombre       TEXT DEFAULT '',
  departamento TEXT DEFAULT '',
  email        TEXT DEFAULT ''
);

-- Préstamos
CREATE TABLE IF NOT EXISTS prestamos (
  id               INTEGER PRIMARY KEY,
  itemId           INTEGER DEFAULT 0,
  itemNombre       TEXT DEFAULT '',
  cantidad         INTEGER DEFAULT 0,
  aulaOrigen       TEXT DEFAULT '',
  aulaDestino      TEXT DEFAULT '',
  profesorId       INTEGER DEFAULT 0,
  profesorNombre   TEXT DEFAULT '',
  gestionadoPor    TEXT DEFAULT '',
  fechaPrestamo    TEXT DEFAULT '',
  fechaPrevista    TEXT DEFAULT '',
  fechaDevolucion  TEXT DEFAULT '',
  cantidadDevuelta INTEGER DEFAULT 0,
  estado           TEXT DEFAULT 'activo',
  obs              TEXT DEFAULT ''
);

-- Aulas
CREATE TABLE IF NOT EXISTS aulas (
  id     TEXT PRIMARY KEY,
  name   TEXT DEFAULT '',
  icon   TEXT DEFAULT '',
  desc   TEXT DEFAULT '',
  th     TEXT DEFAULT '',
  orden  INTEGER DEFAULT 0
);

-- Categorías
CREATE TABLE IF NOT EXISTS categorias (
  name   TEXT PRIMARY KEY,
  c      TEXT DEFAULT '',
  bg     TEXT DEFAULT '',
  i      TEXT DEFAULT '',
  orden  INTEGER DEFAULT 0
);

-- Ciclos formativos
CREATE TABLE IF NOT EXISTS ciclos (
  cicloId     TEXT,
  cicloNombre TEXT DEFAULT '',
  nivel       TEXT DEFAULT '',
  icon        TEXT DEFAULT '',
  th          TEXT DEFAULT '',
  desc        TEXT DEFAULT '',
  modCod      TEXT DEFAULT '',
  modNombre   TEXT DEFAULT '',
  modHoras    INTEGER DEFAULT 0,
  cicloOrden  INTEGER DEFAULT 0,
  modOrden    INTEGER DEFAULT 0,
  PRIMARY KEY (cicloId, modCod)
);

-- Módulos (para emails de responsables)
CREATE TABLE IF NOT EXISTS modulos (
  cod         TEXT PRIMARY KEY,
  nombre      TEXT DEFAULT '',
  responsable TEXT DEFAULT ''
);

-- Documentos adjuntos
CREATE TABLE IF NOT EXISTS documentos (
  id          INTEGER PRIMARY KEY,
  itemId      INTEGER DEFAULT 0,
  itemNombre  TEXT DEFAULT '',
  aulaId      TEXT DEFAULT '',
  fileName    TEXT DEFAULT '',
  driveId     TEXT DEFAULT '',
  driveUrl    TEXT DEFAULT '',
  fecha       TEXT DEFAULT ''
);

-- Log de auditoría
CREATE TABLE IF NOT EXISTS log (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha   TEXT DEFAULT '',
  usuario TEXT DEFAULT '',
  nombre  TEXT DEFAULT '',
  rol     TEXT DEFAULT '',
  accion  TEXT DEFAULT '',
  itemId  TEXT DEFAULT '',
  resumen TEXT DEFAULT ''
);

-- Tokens de reset de contraseña
CREATE TABLE IF NOT EXISTS reset_tokens (
  token   TEXT PRIMARY KEY,
  usuario TEXT DEFAULT '',
  expires INTEGER DEFAULT 0
);
```

### Paso 2.3 — Aplicar el schema a D1

```bash
# En local (para pruebas)
wrangler d1 execute inventario-departamento --local --file=schema.sql

# En producción (Cloudflare)
wrangler d1 execute inventario-departamento --file=schema.sql
```

---

## FASE 3 — Migrar los datos

### Paso 3.1 — Exportar datos del proyecto actual

1. Abre la app actual en el navegador
2. Menú **⚙️ Departamento → Exportar / Backup**
3. Selecciona **"Backup completo JSON"**
4. Guarda el archivo `backup.json`

### Paso 3.2 — Crear script de migración

Crea el archivo `migrate.js` (se ejecuta una sola vez con Node.js):

```javascript
// migrate.js — ejecutar con: node migrate.js
const fs = require('fs');

const backup = JSON.parse(fs.readFileSync('backup.json', 'utf8'));

const lines = [];

// Función para escapar strings SQL
const esc = v => String(v ?? '').replace(/'/g, "''");

// Inventario
for (const it of (backup.inventario || [])) {
  lines.push(`INSERT OR IGNORE INTO inventario VALUES (${it.id},'${esc(it.ref)}','${esc(it.aula)}','${esc(it.mod)}','${esc(it.item)}',${it.qty||0},${it.min||0},'${esc(it.cat)}','${esc(it.loc)}','${esc(it.est)}','${esc(it.util)}','${esc(it.fecha)}','${esc(it.mant)}','${esc(it.mantFecha)}','${esc(it.mantNota)}','${esc(it.mantResp)}','${esc(it.mantEstado)}','${esc(it.mantSolicitante)}','${esc(it.mantSolicitanteEmail)}','${esc(it.foto)}','${esc(it.obs)}','${esc(it.code)}');`);
}

// Profesores
for (const p of (backup.profesores || [])) {
  lines.push(`INSERT OR IGNORE INTO profesores VALUES (${p.id},'${esc(p.nombre)}','${esc(p.departamento)}','${esc(p.email)}');`);
}

// Aulas
for (const a of (backup.aulas || [])) {
  lines.push(`INSERT OR IGNORE INTO aulas VALUES ('${esc(a.id)}','${esc(a.name)}','${esc(a.icon)}','${esc(a.desc)}','${esc(a.th)}',${a.orden||0});`);
}

// Categorías
for (const c of (backup.categorias || [])) {
  lines.push(`INSERT OR IGNORE INTO categorias VALUES ('${esc(c.name)}','${esc(c.c)}','${esc(c.bg)}','${esc(c.i)}',${c.orden||0});`);
}

// Ciclos
for (const ciclo of (backup.ciclos || [])) {
  for (const mod of (ciclo.modulos || [])) {
    lines.push(`INSERT OR IGNORE INTO ciclos VALUES ('${esc(ciclo.id)}','${esc(ciclo.name)}','${esc(ciclo.nivel)}','${esc(ciclo.icon)}','${esc(ciclo.th)}','${esc(ciclo.desc)}','${esc(mod.cod)}','${esc(mod.name)}',${mod.horas||0},${ciclo.orden||0},${mod.orden||0});`);
  }
}

fs.writeFileSync('migration.sql', lines.join('\n'));
console.log(`Generados ${lines.length} inserts en migration.sql`);
```

```bash
node migrate.js
```

Esto genera `migration.sql` con todos los datos.

### Paso 3.3 — Importar datos a D1

```bash
# En local
wrangler d1 execute inventario-departamento --local --file=migration.sql

# En producción
wrangler d1 execute inventario-departamento --file=migration.sql
```

### Paso 3.4 — Añadir usuarios manualmente

Los usuarios no se exportan en el backup (por seguridad, no incluye contraseñas). Añádelos a mano con SQL:

```bash
wrangler d1 execute inventario-departamento --command="INSERT INTO usuarios VALUES ('admin','TU_PASSWORD','Nombre Apellido','Jefe Departamento','email@iescorreo.es')"
```

Repite para cada usuario.

---

## FASE 4 — Crear el Worker (backend)

El Worker reemplaza el `appscript.txt`. Es un archivo JS que recibe peticiones y responde con JSON.

### Paso 4.1 — Estructura de archivos del Worker

```
functions/
  api/
    _middleware.js   ← autenticación compartida
    list.js          ← GET: devuelve items, profesores, prestamos...
    meta.js          ← GET: devuelve aulas, cats, ciclos (carga rápida)
    item.js          ← POST: add, update, delete
    prestar.js       ← POST: préstamos y devoluciones
    profesores.js    ← POST: CRUD profesores
    config.js        ← POST: aulas, cats, ciclos
    docs.js          ← POST: documentos
    auth.js          ← GET: login, reset contraseña
    usuarios.js      ← POST: gestión usuarios
    perfil.js        ← POST: perfil y contraseña
```

### Paso 4.2 — Middleware de autenticación (_middleware.js)

```javascript
// functions/api/_middleware.js
export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);

  // Rutas públicas (no requieren auth)
  const publicas = ['/api/auth'];
  if (publicas.some(r => url.pathname.startsWith(r))) {
    return next();
  }

  // Leer credenciales del header o query params
  const u = url.searchParams.get('u') || '';
  const p = url.searchParams.get('p') || '';

  if (!u || !p) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const user = await env.DB.prepare(
    'SELECT usuario, nombre, rol, email FROM usuarios WHERE usuario=? AND password=?'
  ).bind(u.trim(), p).first();

  if (!user) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  // Pasar el usuario al handler
  request.user = user;
  return next();
}
```

### Paso 4.3 — Endpoint de lista (list.js)

```javascript
// functions/api/list.js
export async function onRequestGet({ request, env }) {
  const user = request.user;

  // D1 permite queries en paralelo con Promise.all — mucho más rápido
  const [items, profesores, prestamos, aulas, cats, ciclosRows] = await Promise.all([
    env.DB.prepare('SELECT * FROM inventario ORDER BY id').all(),
    env.DB.prepare("SELECT * FROM profesores WHERE nombre != '' AND lower(nombre) != 'departamento'").all(),
    env.DB.prepare('SELECT * FROM prestamos ORDER BY id').all(),
    env.DB.prepare('SELECT * FROM aulas ORDER BY orden').all(),
    env.DB.prepare('SELECT * FROM categorias ORDER BY orden').all(),
    env.DB.prepare('SELECT * FROM ciclos ORDER BY cicloOrden, modOrden').all(),
  ]);

  // Reconstruir ciclos desde filas planas
  const cicloMap = {}, cicloOrder = [];
  for (const r of ciclosRows.results) {
    if (!cicloMap[r.cicloId]) {
      cicloMap[r.cicloId] = { id: r.cicloId, name: r.cicloNombre, nivel: r.nivel, icon: r.icon, th: r.th, desc: r.desc, modulos: [] };
      cicloOrder.push(r.cicloId);
    }
    if (r.modCod) cicloMap[r.cicloId].modulos.push({ cod: r.modCod, name: r.modNombre, horas: r.modHoras });
  }
  const ciclos = cicloOrder.map(id => cicloMap[id]);

  // Compresión: items como arrays (igual que en GAS)
  const HEADERS = ['id','ref','aula','mod','item','qty','min','cat','loc','est','util','fecha','mant','mantFecha','mantNota','mantResp','mantEstado','mantSolicitante','mantSolicitanteEmail','foto','obs','code'];
  const itemsC = items.results.map(it => HEADERS.map(h => it[h] ?? ''));

  return Response.json({
    ok: true,
    itemsH: HEADERS,
    itemsC,
    profesores: profesores.results,
    prestamos: prestamos.results,
    aulas: aulas.results,
    cats: cats.results,
    ciclos,
    user
  });
}
```

> **Nota**: `Promise.all` ejecuta las 6 queries en paralelo. En GAS las consultas eran secuenciales. Esto solo ya reduce el tiempo a la sexta parte.

### Paso 4.4 — Endpoint meta (meta.js)

```javascript
// functions/api/meta.js
export async function onRequestGet({ request, env }) {
  const user = request.user;

  const [aulas, cats, ciclosRows] = await Promise.all([
    env.DB.prepare('SELECT * FROM aulas ORDER BY orden').all(),
    env.DB.prepare('SELECT * FROM categorias ORDER BY orden').all(),
    env.DB.prepare('SELECT * FROM ciclos ORDER BY cicloOrden, modOrden').all(),
  ]);

  const cicloMap = {}, cicloOrder = [];
  for (const r of ciclosRows.results) {
    if (!cicloMap[r.cicloId]) {
      cicloMap[r.cicloId] = { id: r.cicloId, name: r.cicloNombre, nivel: r.nivel, icon: r.icon, th: r.th, desc: r.desc, modulos: [] };
      cicloOrder.push(r.cicloId);
    }
    if (r.modCod) cicloMap[r.cicloId].modulos.push({ cod: r.modCod, name: r.modNombre, horas: r.modHoras });
  }

  return Response.json({
    ok: true,
    aulas: aulas.results,
    cats: cats.results,
    ciclos: cicloOrder.map(id => cicloMap[id]),
    user
  });
}
```

### Paso 4.5 — Endpoint de ítems (item.js)

```javascript
// functions/api/item.js
export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const { action, item, id } = body;
  const user = request.user;

  if (action === 'add') {
    // Obtener siguiente ID
    const maxRow = await env.DB.prepare('SELECT MAX(id) as maxId FROM inventario').first();
    const newId = (maxRow.maxId || 0) + 1;
    item.id = newId;
    if (!item.code) item.code = `IB-${String(newId).padStart(5,'0')}`;

    const HEADERS = ['id','ref','aula','mod','item','qty','min','cat','loc','est','util','fecha','mant','mantFecha','mantNota','mantResp','mantEstado','mantSolicitante','mantSolicitanteEmail','foto','obs','code'];
    const placeholders = HEADERS.map(() => '?').join(',');
    const values = HEADERS.map(h => item[h] ?? '');

    await env.DB.prepare(`INSERT INTO inventario (${HEADERS.join(',')}) VALUES (${placeholders})`)
      .bind(...values).run();

    await auditLog(env.DB, user, 'add', newId, `Añadido: ${item.item} (${item.ref})`);
    return Response.json({ ok: true, item });
  }

  if (action === 'update') {
    const FIELDS = ['ref','aula','mod','item','qty','min','cat','loc','est','util','fecha','mant','mantFecha','mantNota','mantResp','mantEstado','mantSolicitante','mantSolicitanteEmail','foto','obs','code'];
    const sets = FIELDS.map(h => `${h}=?`).join(',');
    const values = [...FIELDS.map(h => item[h] ?? ''), item.id];
    await env.DB.prepare(`UPDATE inventario SET ${sets} WHERE id=?`).bind(...values).run();
    await auditLog(env.DB, user, 'update', item.id, `Actualizado: ${item.item}`);
    return Response.json({ ok: true, item });
  }

  if (action === 'delete') {
    await env.DB.prepare('DELETE FROM inventario WHERE id=?').bind(id).run();
    await auditLog(env.DB, user, 'delete', id, `Eliminado id=${id}`);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'Acción desconocida' });
}

async function auditLog(db, user, accion, itemId, resumen) {
  const fecha = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await db.prepare('INSERT INTO log (fecha,usuario,nombre,rol,accion,itemId,resumen) VALUES (?,?,?,?,?,?,?)')
    .bind(fecha, user.usuario, user.nombre, user.rol, accion, String(itemId), resumen).run();
}
```

### Paso 4.6 — Adaptar el frontend (js/api.js y js/state.js)

El frontend necesita cambiar la URL base y el formato de las peticiones.

**js/state.js** — cambiar la URL:
```javascript
// Antes (GAS):
let API_URL = 'https://script.google.com/macros/s/XXXXXXX/exec';

// Después (Worker):
let API_URL = '';  // vacío = mismo origen (Cloudflare Pages)
```

**js/api.js** — adaptar las llamadas:
```javascript
// GET: antes usaba query params con u y p
// Después: igual, el middleware los lee de los query params
function urlWithAuth(endpoint, params = {}) {
  const u = encodeURIComponent(SESSION?.usuario || '');
  const p = encodeURIComponent(SESSION?.password || '');
  let url = `/api/${endpoint}?u=${u}&p=${p}`;
  for (const [key, val] of Object.entries(params)) {
    if (val != null) url += `&${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
  }
  return url;
}

async function apiGet(endpoint, params = {}) {
  const r = await fetch(urlWithAuth(endpoint, params));
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function apiPost(endpoint, payload) {
  const u = SESSION?.usuario || '';
  const p = SESSION?.password || '';
  const r = await fetch(`/api/${endpoint}?u=${encodeURIComponent(u)}&p=${encodeURIComponent(p)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
```

**js/auth.js** — cambiar las llamadas:
```javascript
// Antes:
const meta = await apiGet('meta');
const res  = await apiGet('list');

// Después: igual, solo cambia que ya no se pasa action
// El endpoint lo determina la URL /api/meta y /api/list
```

---

## FASE 5 — Desplegar en Cloudflare

### Paso 5.1 — Crear nueva página en Cloudflare Pages

1. Ve a **dash.cloudflare.com → Workers & Pages → Create**
2. Conecta con GitHub → selecciona el nuevo repo `inventarioDepartamentoV4`
3. **Build settings**: dejar todo vacío (no hay build, es HTML estático)
4. Haz clic en **Save and Deploy**

### Paso 5.2 — Vincular la base de datos D1 a la página

1. En Cloudflare Pages → tu nuevo proyecto → **Settings → Functions**
2. En **D1 database bindings** → **Add binding**
3. Variable name: `DB`
4. D1 database: selecciona `inventario-departamento`
5. Guardar

### Paso 5.3 — Redesplegar

```bash
git add .
git commit -m "migración inicial a D1 + Workers"
git push
```

Cloudflare desplegará automáticamente.

### Paso 5.4 — Verificar

1. Abre la nueva URL de Cloudflare Pages
2. Intenta hacer login
3. Comprueba que cargan los datos
4. Prueba añadir un ítem, prestar, etc.

---

## FASE 6 — Funcionalidades pendientes del Worker

Estas funcionalidades del GAS actual también hay que portarlas al Worker. Son más sencillas una vez tienes la estructura base:

| Funcionalidad | Archivo Worker | Complejidad |
|---|---|---|
| Préstamos y devoluciones | `functions/api/prestar.js` | Media |
| CRUD profesores | `functions/api/profesores.js` | Baja |
| Aulas / Cats / Ciclos sync | `functions/api/config.js` | Baja |
| Documentos (Drive) | `functions/api/docs.js` | Alta* |
| Perfil y contraseña | `functions/api/perfil.js` | Baja |
| Gestión usuarios | `functions/api/usuarios.js` | Media |
| Reset contraseña por email | `functions/api/auth.js` | Media** |
| Alertas stock bajo | dentro de `item.js` | Baja |
| Notificaciones email | cualquier Worker | Alta*** |
| Historial por ítem | `functions/api/list.js` | Baja |

> \* **Documentos**: los archivos están en Google Drive. Se puede mantener Drive para los docs y solo migrar los metadatos a D1, o migrar también los archivos a Cloudflare R2 (almacenamiento de objetos, similar a S3, gratuito hasta 10GB).

> \*\* **Reset contraseña por email**: en Workers se usa la API de **Resend** o **SendGrid** para enviar emails (el `MailApp` de GAS no existe en Workers).

> \*\*\* **Notificaciones email**: lo mismo — requiere configurar un servicio de email externo. Resend tiene un plan gratuito generoso (3.000 emails/mes).

---

## Resumen de comandos clave

```bash
# Instalar Wrangler
npm install -g wrangler

# Autenticarse con Cloudflare
wrangler login

# Crear base de datos D1
wrangler d1 create inventario-departamento

# Aplicar schema
wrangler d1 execute inventario-departamento --file=schema.sql

# Importar datos migrados
wrangler d1 execute inventario-departamento --file=migration.sql

# Probar en local (sin subir a Cloudflare)
wrangler pages dev . --d1=DB=inventario-departamento

# Subir todo (se hace con git push, Cloudflare despliega automáticamente)
git push
```

---

## Orden recomendado para empezar

1. **Instalar Wrangler y crear la BD** (Fases 1 y 2) — 1 hora
2. **Migrar los datos** (Fase 3) — 30 minutos
3. **Implementar los endpoints básicos** `list`, `meta`, `item` (Fase 4) — 2-3 horas
4. **Conectar el frontend** y verificar que carga — 1 hora
5. **Ir añadiendo el resto de endpoints** uno a uno

No hace falta hacerlo todo de golpe. Puedes tener la app funcionando con lectura (sin guardar cambios) en unas pocas horas, e ir añadiendo escritura gradualmente.
