# 🔒 Security - Bosco Inventario

Documento de seguridad: vulnerabilidades conocidas, recomendaciones y mejores prácticas.

---

## 📋 Tabla de Contenidos

1. [Vulnerabilidades Críticas](#vulnerabilidades-críticas)
2. [Vulnerabilidades Altas](#vulnerabilidades-altas)
3. [Mejores Prácticas](#mejores-prácticas)
4. [Checklist de Seguridad](#checklist-de-seguridad)
5. [Incidentes de Seguridad](#incidentes-de-seguridad)
6. [Auditoría de Seguridad](#auditoría-de-seguridad)

---

## 🔴 Vulnerabilidades Críticas

### 1. Credenciales en URL

**Severidad:** CRÍTICA (CVSS 9.8)  
**CWE:** CWE-598 (Use of GET Request with Sensitive Query Strings)

**Descripción:**
```javascript
// VULNERABLE
const url = `/api/item?u=${usuario}&p=${password}&action=add`;
fetch(url).then(...);
```

**Riesgos:**
- ✗ Visible en browser history (`Ctrl+H`)
- ✗ Logged en servidores de acceso (proxy, CDN, firewall)
- ✗ Capturado por JavaScript malicioso (XSS)
- ✗ Capturado por network sniffer (MITM sin HTTPS)
- ✗ Cacheado por navegador

**Evidencia en Código:**
- `js/api.js` - Todas las llamadas apiCall()
- `functions/api/auth.js` - Recibe query params

**Impacto:**
- Acceso no autorizado a cuenta
- Robo de datos sensibles
- Suplantación de identidad

---

### 2. Password en localStorage Sin Encripción

**Severidad:** CRÍTICA (CVSS 9.0)

**Descripción:**
```javascript
// VULNERABLE
localStorage.inv_session = JSON.stringify({
  usuario: "teacher@school.es",
  password: "MyPassword123",  // ← PLAIN TEXT
  rol: "profesor"
});
```

**Riesgos:**
- ✗ XSS accede directamente a `localStorage.inv_session`
- ✗ Sincronización cross-device expone credenciales
- ✗ Malware local accede a localStorage
- ✗ DevTools → Application → localStorage

**Explotación (Browser Console):**
```javascript
JSON.parse(localStorage.inv_session).password  // "MyPassword123"
```

**Impacto:**
- Compromiso de cuenta
- Acceso ilimitado a datos

---

### 3. Password Sin Hashing en BD

**Severidad:** CRÍTICA (CVSS 10.0)

**Descripción:**
```sql
-- VULNERABLE
CREATE TABLE usuarios (
  usuario TEXT PRIMARY KEY,
  password TEXT,  -- ← PLAIN TEXT en la BD
  rol TEXT
);

-- Login:
SELECT * FROM usuarios WHERE usuario=? AND password=?;
```

**Riesgos:**
- ✗ Si BD se filtra, todos los passwords expuestos
- ✗ DBAdmin puede leer passwords directamente
- ✗ Backups exponen credenciales
- ✗ Incumplimiento GDPR/LOPD

**Impacto Potencial:**
- Brechas masivas de datos
- Multas regulatorias (GDPR: 4% revenue)
- Pérdida de confianza

**Solución:**
```javascript
// functions/api/auth.js
const bcrypt = require('bcrypt');

// Al crear usuario:
const hashedPassword = await bcrypt.hash(password, 10);

// Al validar:
const isValid = await bcrypt.compare(password, hashedPassword);
```

---

### 4. Validación de Permisos Solo en Frontend

**Severidad:** CRÍTICA (CVSS 9.1)

**Descripción:**
```javascript
// VULNERABLE - Frontend
function can(permission) {
  if (!SESSION) return false;
  const perms = ROLE_PERMISSIONS[SESSION.rol] || [];
  return perms.includes('*') || perms.includes(permission);
}

// Backend CONFÍA en el rol enviado por cliente
export async function onRequestPost({ request, env }) {
  const user = await validateAuth(request);  // ← Solo valida existencia
  // No re-valida permisos
  if (action === 'delete') {
    // Ejecuta sin verificar permiso
    await db.prepare('DELETE FROM inventario WHERE id = ?').bind(id).run();
  }
}
```

**Ataque (DevTools Console):**
```javascript
// Cambiar rol en memoria
SESSION.rol = 'superadmin';

// Ahora todas las acciones están permitidas en frontend
// Y backend acepta porque no re-valida
```

**Riesgo:**
- ✗ Usuario no-admin puede eliminar datos
- ✗ Profesor puede ver datos privados
- ✗ Consulta puede modificar ítems

**Solución:**
```javascript
// Backend SIEMPRE re-valida
export async function onRequestPost({ request, env }) {
  const user = await validateAuth(request);
  
  // RE-VALIDAR permiso en BD
  const rolData = await env.DB.prepare(
    'SELECT * FROM roles WHERE role = ?'
  ).bind(user.rol).first();
  
  if (!rolData.permissions.includes('delete_item')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Ahora ejecutar
  await db.prepare('DELETE FROM inventario WHERE id = ?').bind(id).run();
}
```

---

### 5. Exportación de Datos Incluye Passwords

**Severidad:** CRÍTICA (CVSS 8.7)

**Descripción:**
```javascript
// functions/api/backup.js - VULNERABLE
export async function onRequest({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM usuarios'
  ).all();
  
  // ← Incluye passwords en plain text
  const backup = {
    usuarios: results,  // { usuario, password, rol }
    items: [...],
    prestamos: [...]
  };
  
  return Response.json(backup);
}
```

**Riesgo:**
- ✗ Archivo backup descargado sin encripción
- ✗ Contraseñas de todos los usuarios expuestas
- ✗ Ataque cuando usuario guarda archivo

---

## 🟠 Vulnerabilidades Altas

### 6. Sin Rate-Limiting en Login

**Severidad:** ALTA (CVSS 7.5)  
**Ataque:** Fuerza bruta

**Vulnerabilidad:**
```javascript
// functions/api/auth.js - SIN LIMITE
export async function onRequestPost({ request, env }) {
  const { usuario, password } = body;
  
  const user = await env.DB.prepare(
    'SELECT * FROM usuarios WHERE usuario = ? AND password = ?'
  ).bind(usuario, password).first();
  
  // ← Puede intentarse millones de veces sin restricción
}
```

**Ataque:**
```bash
#!/bin/bash
# Fuerza bruta
for i in {1..100000}; do
  curl "https://inventario.pages.dev/api/auth?action=login&u=admin@school.es&p=pass$i"
done
```

**Solución Cloudflare:**
```
Dashboard → Security → WAF → Rules
Add rule: 
  - If: (http.request.uri.path contains "/api/auth") 
    AND (cf.threat_score > 50)
  - Then: Challenge
```

---

### 7. Sin Session Timeout

**Severidad:** ALTA (CVSS 7.1)

**Vulnerabilidad:**
- Sesión activa indefinidamente
- Riesgo en dispositivos compartidos

**Solución:**
```javascript
// js/auth.js
const SESSION_TIMEOUT = 3600000;  // 1 hora

function checkSessionExpiry() {
  if (!SESSION) return;
  
  const now = Date.now();
  const loginTime = SESSION.loginTime;
  
  if (now - loginTime > SESSION_TIMEOUT) {
    logout();  // Auto-logout
  }
}

// Ejecutar cada minuto
setInterval(checkSessionExpiry, 60000);
```

---

### 8. Agente IA Puede Enviar Credenciales

**Severidad:** ALTA (CVSS 8.0)

**Vulnerabilidad:**
```javascript
// js/agente-widget.js
function getCreds() {
  if (SESSION && SESSION.usuario) {
    return { u: SESSION.usuario, p: SESSION.password };
    // ← Credenciales enviadas a API IA externa
  }
}

// Enviado al proxy IA del backend:
POST /api/proxy-ai
Body: {
  "prompt": "...",
  "credentials": { "u": "teacher@school.es", "p": "MyPassword123" }
}
```

**Riesgo:**
- ✗ Credenciales viajan a un proveedor IA externo (tercero)
- ✗ El proveedor IA podría logearlas
- ✗ MITM podría capturarlas

**Solución:**
```javascript
// NUNCA enviar credenciales
function getCreds() {
  return null;  // O solo userId sin password
}

// Si necesitas context, usar solo público:
POST /api/proxy-ai
Body: {
  "prompt": "¿Cuántos Arduinos hay?",
  "user_id": "123",  // Solo ID, no credenciales
  "context": "inventario"  // Contexto sin datos sensibles
}
```

---

### 9. Sin Validación en API (Inyección)

**Severidad:** ALTA (CVSS 8.6)

**Estado Actual:**
```javascript
// functions/api/item.js - PARCIALMENTE SEGURO
const vals = HEADERS_INV.map(h => item[h] ?? null);
await env.DB.prepare(`
  INSERT INTO inventario (${HEADERS_INV.join(',')}) 
  VALUES (${Array(vals.length).fill('?').join(',')})
`).bind(...vals).run();  // ← Usa .bind() ✅
```

**Mejora Necesaria:**
```javascript
// Sin validación de tipos
if (typeof item.qty !== 'number') {
  return Response.json({ error: 'qty debe ser número' }, { status: 400 });
}

// O usar Zod
const ItemSchema = z.object({
  item: z.string().min(1),
  qty: z.number().int().min(0),
  ref: z.string(),
});

const validated = ItemSchema.parse(item);
```

---

### 10. Sin Logs de Auditoría

**Severidad:** ALTA (CVSS 7.0)

**Problema:**
- No hay traza de quién hizo qué
- Imposible detectar comportamiento anómalo
- Incumplimiento regulatorio

**Solución:**
```javascript
// Crear tabla de auditoría
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  usuario TEXT,
  accion TEXT,  -- 'login', 'delete_item', 'edit_item'
  recurso TEXT,  -- ID del ítem/usuario modificado
  detalles JSON,
  ip TEXT,
  user_agent TEXT,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// En cada endpoint crítico
await auditLog(env.DB, user, 'delete_item', itemId, { item, reason });
```

---

## 🟡 Vulnerabilidades Medias

### 11. CORS Permisivo Potencial

**Verificar:** `functions/api/_middleware.js`
```javascript
// ¿Tiene CORS headers?
// Access-Control-Allow-Origin: *  ← INSEGURO
// Debe ser: Access-Control-Allow-Origin: https://inventario.pages.dev
```

---

### 12. Tokens JWT Sin Expiración

**Futura:** Cuando se implemente JWT
```javascript
// INSEGURO - Sin expiración
jwt.sign({ user }, secret);

// SEGURO - Con expiración
jwt.sign({ user }, secret, { expiresIn: '1h' });
```

---

## ✅ Mejores Prácticas

### 1. Autenticación

```javascript
✅ Usar Bearer tokens con JWT
✅ Expiración de token: 1 hora
✅ Refresh token: 30 días
✅ Password hash: bcrypt (min 10 rounds)
✅ HTTPS obligatorio
✅ Secure cookies (HttpOnly, SameSite=Strict)
```

### 2. Autorización

```javascript
✅ Re-validar permisos en backend
✅ Usar roles con granularidad fina
✅ Logging de acciones críticas
✅ Audit trail completo
```

### 3. Datos Sensibles

```javascript
✅ Nunca enviar password en URL
✅ Nunca guardar password en localStorage
✅ Encriptar datos en transit (HTTPS)
✅ Encriptar datos en reposo (si necesario)
✅ No incluir credenciales en logs
```

### 4. Input Validation

```javascript
✅ Usar schema validation (Zod)
✅ Validar tipos
✅ Validar rangos
✅ Validar formato (email, date)
✅ Sanitizar strings
```

### 5. Error Handling

```javascript
✅ No exponer stack traces en producción
✅ Mensajes de error genéricos para usuario
✅ Logging detallado en servidor
✅ Alertas para errores críticos
```

---

## ✓ Checklist de Seguridad

- [ ] Auditoría de contraseñas: Ninguna debe ser "123456", "password", etc.
- [ ] HTTPS obligatorio (✅ Cloudflare lo maneja)
- [ ] Headers de seguridad:
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] Content-Security-Policy: restrictivo
- [ ] Rate-limiting en login (5 intentos / 5 min)
- [ ] Session timeout (1 hora)
- [ ] Logging de auditoría en acciones críticas
- [ ] Backup encriptado
- [ ] Validación de datos en API (Zod)
- [ ] Password hashing (bcrypt)
- [ ] Bearer tokens (no URL)
- [ ] Permisos validados en backend
- [ ] Prueba XSS (intentar `<script>alert(1)</script>` en inputs)
- [ ] Prueba SQL Injection (intentar `' OR '1'='1`)
- [ ] Test de CORS
- [ ] Análisis de dependencias (npm audit)

---

## 📋 Incidentes de Seguridad

**Ninguno reportado hasta la fecha (v317)**

Si descubres una vulnerabilidad:
1. NO la publiques en GitHub issues (es público)
2. Reporta en privado: [admin email/canal]
3. Proporciona: descripción, pasos reproducción, impacto potencial

---

## 🔍 Auditoría de Seguridad

### Checklist Manual

```bash
# 1. Revisar localStorage
console.log(localStorage);
# ¿Hay password? ✗

# 2. Revisar Network tab
# ¿Hay URL con password? ✗

# 3. Revisar BD
wrangler d1 execute boscoinventario --remote --command \
  "SELECT * FROM usuarios LIMIT 1;"
# ¿Password es plain text? ✗

# 4. Intentar XSS
# En campo búsqueda: <img src=x onerror=alert(1)>
# ¿Funciona alert? ✗

# 5. Intentar SQL Injection
# En búsqueda: ' OR '1'='1
# ¿Devuelve todos los items? ✗

# 6. Cambiar rol en DevTools
# SESSION.rol = 'superadmin'
# ¿Funciona? ✗

# 7. npm audit
npm audit
# ¿Vulnerabilidades? 
```

### Herramientas Recomendadas

```bash
# Escaneo de seguridad
npm install -g snyk
snyk test

# OWASP ZAP (automático)
# https://www.zaproxy.org/

# Auditoría de seguridad en línea
# https://securityheaders.com
# https://csp-evaluator.withgoogle.com

# Análisis de dependencias
npm audit
npm audit fix

# Linting de seguridad
npm install -D eslint-plugin-security
```

---

## 📚 Referencias

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [GDPR Compliance](https://gdpr-info.eu/)
- [Cloudflare Security](https://www.cloudflare.com/security/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

## 🚨 Resumen de Críticos

| # | Vulnerabilidad | Riesgo | Solución | Estimación |
|---|---|---|---|---|
| 1 | Credenciales en URL | CRÍTICA | Bearer tokens | 8h |
| 2 | Password en localStorage | CRÍTICA | Solo token | 2h |
| 3 | Password sin hash | CRÍTICA | bcrypt | 6h |
| 4 | Permisos solo frontend | CRÍTICA | Re-validar backend | 4h |
| 5 | Backup con passwords | CRÍTICA | Excluir credenciales | 2h |

**Total Críticos: 5**
**Horas para resolver: ~22h**

---

**Última actualización:** Agosto 2026 (v558)
**Próxima auditoría:** Después de implementar cambios críticos
