# 📡 API Reference - Bosco Inventario

Documentación completa de todos los endpoints REST disponibles.

---

## 📋 Tabla de Contenidos

1. [Autenticación](#autenticación)
2. [Inventario (Items)](#inventario-items)
3. [Configuración](#configuración)
4. [Historial](#historial)
5. [Prestamos](#prestamos)
6. [Usuarios](#usuarios)
7. [IA (Proxy)](#ia-proxy)
8. [Códigos de Error](#códigos-de-error)
9. [Ejemplos CURL](#ejemplos-curl)

---

## Multi-departamento (scoping)

Todos los endpoints salvo `rol=superadmin` filtran automáticamente por el
departamento del usuario autenticado (resuelto en `_middleware.js` desde la
tabla `usuarios`) — no hace falta ni se debe enviar el departamento como
parámetro. `superadmin` ve todos los departamentos sin filtrar. Detalle
técnico completo en [ARCHITECTURE.md](ARCHITECTURE.md) y
[PLAN_MULTIDEPARTAMENTO.md](PLAN_MULTIDEPARTAMENTO.md).

---

## Autenticación

### POST /api/auth

Autentica usuario y devuelve sesión.

**⚠️ Nota:** Actualmente envía credenciales en URL. Ver SECURITY.md para mejoras.

```http
POST /api/auth?action=login&u=usuario@school.es&p=password
Content-Type: application/json

Response (200):
{
  "ok": true,
  "usuario": "usuario@school.es",
  "rol": "profesor",
  "sessionId": "sess_abc123"
}

Response (401):
{
  "ok": false,
  "error": "Credenciales inválidas"
}
```

**Parámetros Query:**
| Parámetro | Tipo | Obligatorio | Descripción |
|-----------|------|-----------|-------------|
| action | string | Sí | "login" o "logout" |
| u | string | Sí (login) | Username/email |
| p | string | Sí (login) | Password |

**Roles Válidos:**
- `superadmin` - Acceso total
- `jefe/a departamento` - Gestión de inventario
- `profesor` - Lectura + préstamos
- `consulta` - Solo lectura

---

### POST /api/auth (Logout)

```http
POST /api/auth?action=logout
Content-Type: application/json

Response (200):
{
  "ok": true
}
```

---

## Inventario (Items)

### GET /api/item

Obtiene un ítem específico.

```http
GET /api/item?id=123&u=usuario&p=password

Response (200):
{
  "ok": true,
  "item": {
    "id": 123,
    "ref": "R-10K",
    "item": "Multímetro Digital",
    "qty": 5,
    "qty_min": 2,
    "tipo_material": "Inventariable",
    "aula_id": "A35",
    "ubicacion": "Estantería A3",
    "categoria": "Herramientas",
    "ciclo_id": "CFGM",
    "modulo_id": "0363",
    "tags": ["medición", "electrónica"],
    "estado": "Bueno",
    "utilidad": "Mediciones en prácticas",
    "proveedor": "CoolComponent",
    "fecha": "2026-05-23",
    "foto": "data:image/jpeg;base64,/9j/4AAQ...",
    "fecha_creacion": "2024-01-15T10:30:00Z",
    "fecha_modificacion": "2026-05-23T14:22:00Z",
    "modificado_por": "admin@school.es"
  }
}
```

**Parámetros Query:**
| Parámetro | Tipo | Obligatorio | Descripción |
|-----------|------|-----------|-------------|
| id | integer | Sí | ID del ítem |
| u | string | Sí | Username |
| p | string | Sí | Password |

---

### POST /api/item (Add)

Añade un nuevo ítem.

```http
POST /api/item?u=usuario&p=password&action=add
Content-Type: application/json

Body:
{
  "item": {
    "ref": "R-10K",
    "item": "Multímetro Digital",
    "qty": 5,
    "qty_min": 2,
    "tipo_material": "Inventariable",
    "aula_id": "A35",
    "ubicacion": "Estantería A3",
    "categoria": "Herramientas",
    "ciclo_id": "CFGM",
    "modulo_id": "0363",
    "tags": "medición, electrónica",
    "estado": "Bueno",
    "utilidad": "Mediciones en prácticas",
    "proveedor": "CoolComponent",
    "foto": "data:image/jpeg;base64,/9j/4AAQ..."
  }
}

Response (201):
{
  "ok": true,
  "id": 456,
  "message": "Ítem creado exitosamente"
}

Response (401):
{
  "ok": false,
  "error": "No tienes permiso para crear ítems"
}

Response (400):
{
  "ok": false,
  "error": "Campo requerido: item"
}
```

**Campos Requeridos:**
- `item` (string) - Nombre del ítem
- `ref` (string) - Referencia única

**Campos Opcionales:**
- `qty` (number) - Cantidad (default: 1)
- `qty_min` (number) - Stock mínimo (default: 5)
- `tipo_material` (string) - Consumible/Inventariable/Contenedor
- `aula_id` (string) - ID de aula
- `ubicacion` (string) - Ubicación física
- `categoria` (string) - Categoría
- `ciclo_id` (string) - Ciclo formativo
- `modulo_id` (string) - Módulo
- `tags` (string) - CSV de tags
- `estado` (string) - Estado (Bueno/Deteriorado/Avería/Baja)
- `utilidad` (string) - Descripción de uso
- `proveedor` (string) - Proveedor/tienda
- `foto` (string) - Base64 encoded image
- `es_contenedor` (boolean) - Si es contenedor de componentes
- `parent_id` (integer) - Si es componente, ID del contenedor padre

**Permisos Requeridos:**
- `create_item` o rol `admin`/`jefe/a departamento`

---

### POST /api/item (Edit)

Edita un ítem existente.

```http
POST /api/item?u=usuario&p=password&action=edit&id=123
Content-Type: application/json

Body:
{
  "item": {
    "qty": 10,
    "estado": "Deteriorado",
    "mant_solicitado": true
  }
}

Response (200):
{
  "ok": true,
  "message": "Ítem actualizado exitosamente"
}
```

**Nota:** Solo se actualizen los campos incluidos en el body.

---

### DELETE /api/item

Elimina un ítem.

```http
DELETE /api/item?id=123&u=usuario&p=password

Response (200):
{
  "ok": true,
  "message": "Ítem eliminado exitosamente"
}

Response (404):
{
  "ok": false,
  "error": "Ítem no encontrado"
}

Response (403):
{
  "ok": false,
  "error": "No tienes permiso para eliminar ítems"
}
```

**Permisos Requeridos:**
- `delete_item` o rol `admin`/`jefe/a departamento`

---

### GET /api/list

Lista todos los ítems con filtros opcionales.

```http
GET /api/list?u=usuario&p=password&categoria=Audio&estado=Bueno&limit=50&offset=0

Response (200):
{
  "ok": true,
  "items": [
    { "id": 1, "item": "...", ... },
    { "id": 2, "item": "...", ... }
  ],
  "total": 1000,
  "count": 50
}
```

**Parámetros Query:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| categoria | string | Filtrar por categoría |
| estado | string | Bueno/Deteriorado/Avería/Baja |
| tipo_material | string | Consumible/Inventariable |
| aula_id | string | Filtrar por aula |
| ciclo_id | string | Filtrar por ciclo |
| tags | string | Filtrar por tag (LIKE) |
| search | string | Búsqueda en ref, item, proveedor |
| limit | number | Items por página (default: 100, max: 1000) |
| offset | number | Paginación offset (default: 0) |
| sort | string | Campo de ordenamiento (default: "fecha_creacion DESC") |

---

### POST /api/item (Acciones IA de cámara)

Estas acciones cuelgan del mismo endpoint `POST /api/item` con campo `action`.

#### action=buscarPorSerie

Analiza una imagen y resuelve uno de estos matches: `exacto`, `fuzzy`, `texto`, `visual`, `ninguno`, `sin_lectura`.

```http
POST /api/item?u=usuario&p=password
Content-Type: application/json

Body:
{
  "action": "buscarPorSerie",
  "imagen": "<base64-jpeg-sin-prefijo-data-uri>"
}
```

Respuesta típica:

```json
{
  "ok": true,
  "match": "exacto",
  "confianzaSerie": 0.82,
  "item": { "id": 1097, "item": "100K", "serie": "220A4S1002886" }
}
```

Notas:
- Usa Workers AI (`env.AI`) con dos pasadas OCR cuando hace falta.
- Añade variantes OCR para ambigüedades comunes.
- Inyecta pocos ejemplos recientes de uso real (few-shot textual por departamento).

#### action=buscarSeriePorCodigo

Busca directamente por código ya decodificado en cliente (sin OCR IA).

```http
POST /api/item?u=usuario&p=password
Content-Type: application/json

Body:
{
  "action": "buscarSeriePorCodigo",
  "codigo": "220A4S1002886"
}
```

#### action=detectarMultiples

Detecta varios objetos en una sola foto para alta masiva asistida.

```http
POST /api/item?u=usuario&p=password
Content-Type: application/json

Body:
{
  "action": "detectarMultiples",
  "imagen": "<base64-jpeg-sin-prefijo-data-uri>"
}
```

Respuesta:

```json
{
  "ok": true,
  "objetos": [
    { "nombre": "Multimetro digital", "cantidad": 2, "categoriaSugerida": "Herramientas" }
  ]
}
```

#### action=registrarFeedbackDeteccion (v557)

Guarda feedback real de usuario para aprendizaje continuo por departamento.

```http
POST /api/item?u=usuario&p=password
Content-Type: application/json

Body:
{
  "action": "registrarFeedbackDeteccion",
  "tipo": "exacto_confirmado",
  "nombre": "Osciloscopio Tektronix",
  "categoria": "Herramientas",
  "serie": "ABC123",
  "marca": "Tektronix",
  "modelo": "TBS1052B",
  "textoLibre": "",
  "confianza": 0.61,
  "imagen": "<base64-jpeg-opcional>"
}
```

Respuesta:

```json
{ "ok": true }
```

Permiso asociado en frontend (`ACTION_PERMISSIONS`): `serie.read`.

---

## Configuración

### GET /api/config

Obtiene configuración global (aulas, ciclos, categorías, etc.).

```http
GET /api/config?u=usuario&p=password

Response (200):
{
  "ok": true,
  "AULAS": [
    { "id": "A35", "name": "Aula 35 — Electrónica", "icon": "⚡", "nivel": 2 },
    { "id": "A36", "name": "Aula 36 — Programación", "icon": "💻", "nivel": 2 }
  ],
  "CICLOS": [
    {
      "id": "CFGM",
      "name": "CFGM Electrónica",
      "nivel": 2,
      "icon": "🔌",
      "modulos": [
        { "cod": "0363", "name": "Megafonía y sonorización", "horas": 240 },
        { "cod": "0364", "name": "Instalaciones de telefonía", "horas": 160 }
      ]
    }
  ],
  "CATS": [
    { "id": 1, "name": "Audio", "icon": "🔊" },
    { "id": 2, "name": "Video", "icon": "📹" },
    { "id": 3, "name": "Herramientas", "icon": "🔧" }
  ],
  "UBICACIONES": [
    "Estantería A1", "Estantería A2", "Armario Seguridad", ...
  ]
}
```

---

## Historial

### GET /api/historial

Obtiene historial de cambios de un ítem.

```http
GET /api/historial?id=123&u=usuario&p=password

Response (200):
{
  "ok": true,
  "historial": [
    {
      "id": 1001,
      "usuario": "admin@school.es",
      "accion": "create",
      "fecha": "2026-01-15T10:30:00Z",
      "cambios": { "item": "Multímetro", "qty": 5 }
    },
    {
      "id": 1002,
      "usuario": "jefe@school.es",
      "accion": "edit",
      "fecha": "2026-05-23T14:22:00Z",
      "cambios": { "estado": "Deteriorado" }
    }
  ]
}
```

---

## Prestamos

### POST /api/prestar

Registra un préstamo de ítem.

```http
POST /api/prestar?u=usuario&p=password&action=add
Content-Type: application/json

Body:
{
  "item_id": 123,
  "cantidad": 2,
  "profesor": "Juan García",
  "aula_destino": "A35",
  "fecha_devolucion_estimada": "2026-05-30",
  "observaciones": "Para práctica de amplificadores"
}

Response (201):
{
  "ok": true,
  "prestamo_id": 456
}
```

---

## Usuarios

### GET /api/usuarios

Lista usuarios del departamento.

```http
GET /api/usuarios?u=admin&p=password

Response (200):
{
  "ok": true,
  "usuarios": [
    { "usuario": "jefe@school.es", "rol": "jefe/a departamento", "activo": true },
    { "usuario": "prof1@school.es", "rol": "profesor", "activo": true }
  ]
}
```

**Permisos Requeridos:**
- `view_usuarios` o rol `admin`/`jefe/a departamento`

---

## IA (Proxy)

### POST /api/proxy-ai

Envía prompt al modelo IA y recibe respuesta con streaming. Vivía en
`/proxy/ai` (fuera de `/api/*`, sin ninguna autenticación — cualquiera podía
gastar el `GITHUB_TOKEN` del servidor). Movido a `/api/proxy-ai` para que
`functions/api/_middleware.js` lo proteja igual que el resto de endpoints
(requiere `?u=&p=` o `?u=&t=` válidos).

```http
POST /api/proxy-ai?u=usuario&p=password
Content-Type: application/json

Body:
{
  "model": "gpt-4o-mini",
  "stream": true,
  "messages": [{"role":"system","content":"..."},{"role":"user","content":"¿Cuántos multímetros hay disponibles?"}]
}

Response (200 - Streaming, formato OpenAI):
data: {"choices":[{"delta":{"content":"Hay "}}]}
data: {"choices":[{"delta":{"content":"5 multímetros disponibles"}}]}
data: [DONE]
```

**Modelo Usado:**
- `gpt-4o-mini` (GitHub Models)
- Gratis con GitHub Copilot

---

## Códigos de Error

| Código | Significado | Causa |
|--------|-----------|-------|
| 200 | OK | Operación exitosa |
| 201 | Created | Recurso creado |
| 400 | Bad Request | Parámetros inválidos o faltantes |
| 401 | Unauthorized | Credenciales inválidas o faltantes |
| 403 | Forbidden | Permiso insuficiente para la acción |
| 404 | Not Found | Recurso no encontrado |
| 409 | Conflict | Referencia duplicada (ref debe ser única) |
| 500 | Internal Server Error | Error en el servidor |
| 503 | Service Unavailable | BD no disponible |

---

## Ejemplos CURL

### Login

```bash
curl -X POST "https://inventario.pages.dev/api/auth?action=login&u=usuario@school.es&p=password"
```

### Listar Ítems

```bash
curl -X GET "https://inventario.pages.dev/api/list?u=usuario&p=password&categoria=Audio&limit=50"
```

### Crear Ítem

```bash
curl -X POST "https://inventario.pages.dev/api/item?u=usuario&p=password&action=add" \
  -H "Content-Type: application/json" \
  -d '{
    "item": {
      "ref": "R-10K",
      "item": "Multímetro Digital",
      "qty": 5,
      "categoria": "Herramientas"
    }
  }'
```

### Actualizar Ítem

```bash
curl -X POST "https://inventario.pages.dev/api/item?u=usuario&p=password&action=edit&id=123" \
  -H "Content-Type: application/json" \
  -d '{
    "item": {
      "estado": "Deteriorado"
    }
  }'
```

### Eliminar Ítem

```bash
curl -X DELETE "https://inventario.pages.dev/api/item?id=123&u=usuario&p=password"
```

### Chat IA

```bash
curl -X POST "https://inventario.pages.dev/proxy/ai" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "¿Cuántos ítems hay?",
    "stream": false
  }'
```

---

## Rate Limiting

**Estado Actual:** Sin rate-limiting implementado ⚠️

**Recomendación:** Implementar límites:
- Login: 5 intentos por 5 minutos
- API general: 100 requests por minuto

---

## Autenticación Recomendada (Futuro)

```http
POST /api/auth
Content-Type: application/json

Body:
{
  "usuario": "usuario@school.es",
  "password": "password"
}

Response:
{
  "ok": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "rt_abc123...",
  "expiresIn": 3600
}

# En requests posteriores:
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

**Última actualización:** Mayo 2026 (v317+)
**API Versión:** v1 (sin versionamiento formal)
**⚠️ Seguridad:** Revisar SECURITY.md para mejoras críticas
