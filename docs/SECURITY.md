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

### 1. Credenciales en URL — 🟡 MITIGADO PARCIALMENTE (28/08/2026, v646)

**Severidad:** CRÍTICA (CVSS 9.8) — mitigada para el dato más sensible (la
contraseña real), ver estado abajo. Sigue viajando un token en la URL.
**CWE:** CWE-598 (Use of GET Request with Sensitive Query Strings)

**Estado real del código (28/08/2026):** el login tradicional
(usuario/contraseña) ya no reenvía la contraseña real en cada petición —
extiende el `session_token` que ya usaba el login de Google
(`login-google.js`) a `auth.js`/`perfil.js`/`usuarios.js`. Detalle
completo, decisiones y verificación con Playwright en
`docs/DEVELOPMENT.md` 28/08/2026 (v646). Lo que **no** cambió: sigue
viajando un token (`t=`) en la query string en vez de en un header — el
refactor a Bearer/headers real (~8h estimadas) sigue pendiente, ver
Resumen de Críticos abajo. La diferencia práctica: un token es
revocable (rota al cambiar la contraseña) sin exponer la contraseña real
que la persona reutiliza en otros sitios.

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

### 3. Password Sin Hashing en BD — ✅ RESUELTO (25/08/2026)

**Severidad:** CRÍTICA (CVSS 10.0) — histórico, ver estado abajo

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

**Solución implementada (25/08/2026):** `bcrypt` no funciona en el runtime
de Cloudflare Workers (no es Node, sin bindings nativos) — se usó PBKDF2
vía la Web Crypto API nativa (`crypto.subtle`, sin dependencias externas),
100.000 iteraciones, SHA-256, salt aleatoria de 16 bytes por contraseña.
Formato almacenado: `pbkdf2$100000$<salt hex>$<hash hex>`.

```javascript
// Duplicado en cada functions/api/*.js que toca contraseñas
// (_middleware.js, auth.js, perfil.js, usuarios.js, oauth/login-google.js)
async function hashPassword(password){
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt:saltBytes, iterations:100000, hash:'SHA-256' }, keyMaterial, 256);
  return `pbkdf2$100000$${bytesToHex(saltBytes)}$${bytesToHex(new Uint8Array(bits))}`;
}
```

**Migración sin fricción para el usuario:** las 48+ cuentas existentes
seguían con la contraseña en claro en el momento del despliegue. En vez de
una migración masiva de una sola vez (imposible sin conocer las
contraseñas reales — un hash no se puede generar a partir de otro hash),
se usa migración perezosa: `verifyPassword()` acepta tanto el formato
hasheado como el texto plano antiguo, y en cuanto una cuenta inicia sesión
con éxito usando aún su contraseña en claro, se rehashea en ese mismo
instante. Nadie tiene que cambiar su contraseña ni hacer nada especial —
cada cuenta migra sola la próxima vez que se usa.

**Nota sobre el superadmin:** puede seguir asignando una contraseña nueva
a cualquier usuario (`userResetPassword`, sin necesitar la anterior) —
eso no cambia. Lo que ya no es posible, por diseño (decisión explícita del
usuario del proyecto, no una limitación técnica accidental), es que nadie
— ni siquiera el superadmin — pueda ver la contraseña actual de otro
usuario tal cual la escribió: el hash es irreversible a propósito.

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

### 5. Exportación de Datos Incluye Passwords — ✅ VERIFICADO SIN RIESGO (25/08/2026)

**Severidad:** CRÍTICA (CVSS 8.7) — histórico, ver estado abajo

**Descripción original (ejemplo genérico, no el código real del proyecto):**
```javascript
// Patrón VULNERABLE que se buscó explícitamente en el código
export async function onRequest({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM usuarios'
  ).all();

  // ← Incluiría passwords si se usara SELECT *
  const backup = {
    usuarios: results,  // { usuario, password, rol }
    items: [...],
    prestamos: [...]
  };

  return Response.json(backup);
}
```

**Riesgo (si existiera):**
- ✗ Archivo backup descargado sin encripción
- ✗ Contraseñas de todos los usuarios expuestas
- ✗ Ataque cuando usuario guarda archivo

**Auditoría realizada (25/08/2026):** revisado `functions/api/backup.js` línea
por línea — la consulta real es
`SELECT usuario, nombre, rol, email FROM usuarios` (sin `password`), así
que el backup JSON subido a Drive nunca ha incluido esa columna. Se
revisó además cada `SELECT ... FROM usuarios` de todo `functions/api/`
(`grep -rn "password" functions/api`): las únicas consultas que sí leen
`password` son las de login/verificación (`_middleware.js`, `auth.js`,
`perfil.js`) y siempre para comparar internamente contra el valor
introducido — nunca se devuelve al cliente (`delete row.password;` antes
de construir la respuesta en `_middleware.js` y `auth.js`); los listados
de usuarios (`usuarios.js`, `list.js`) nunca seleccionan esa columna. No
había nada que corregir en código — el ejemplo de este documento no
reflejaba el estado real del proyecto en el momento en que se escribió.

---

## 🟠 Vulnerabilidades Altas

### 6. Sin Rate-Limiting en Login — ✅ MITIGADO (bloqueo por intentos, detectado 27/08/2026)

**Severidad original:** ALTA (CVSS 7.5) — mitigada, ver estado abajo
**Ataque:** Fuerza bruta

**Estado real del código (`functions/api/auth.js`, migración
`migrations/0031_intentos_login.sql`):** cada usuario tiene columnas
`intentos_fallidos`/`bloqueado`. Tras `MAX_INTENTOS_LOGIN` (5) intentos
fallidos seguidos, la cuenta se bloquea (`bloqueado=1`) y deja de aceptar
más intentos —aunque la contraseña correcta se escriba después— hasta que
un superadmin la desbloquea (`userUnlock` en `functions/api/usuarios.js`,
panel "🛡️ Gestionar accesos"). El aviso de error incluye cuántos intentos
quedan a partir de 2 restantes, para que el usuario no llegue al bloqueo
a ciegas. No es exactamente lo que sugería este documento (ventana
temporal tipo "5 intentos / 5 min" vía Cloudflare WAF) — es más estricto
(bloqueo persistente, no expira solo) — pero cumple el objetivo de
impedir fuerza bruta sin límite. Esta entrada llevaba desactualizada
desde que se implementó (25-26/08/2026, ver `docs/DEVELOPMENT.md`).

**Pendiente real, si se quisiera reforzar más:** WAF de Cloudflare a
nivel de red (protege contra fuerza bruta distribuida entre muchas
cuentas distintas, que el bloqueo por cuenta no cubre) — sigue siendo
una mejora válida, solo que ya no es la única defensa.

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

### 8. Agente IA Puede Enviar Credenciales — ✅ RESUELTO (efecto colateral de v646, 28/08/2026)

**Severidad original:** ALTA (CVSS 8.0) — resuelta sin tocar este archivo.

**Estado real:** `agente-widget.js` (`getCreds()`) ya prefería
`session_token` sobre `password` desde antes de este documento. Ahora
que el login tradicional también emite `session_token` (ver ítem 1,
`docs/DEVELOPMENT.md` v646), todo usuario tiene un token tras iniciar
sesión — Volt deja de mandar la contraseña real en la práctica, sin
haber tocado `agente-widget.js`.

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

### 10. Sin Logs de Auditoría — ✅ RESUELTO (ya implementado, entrada desactualizada desde su origen)

**Severidad original:** ALTA (CVSS 7.0) — no aplica al estado real del código

**Estado real:** el proyecto tiene tabla `log` (`functions/api/*.js`,
`auditLog()` duplicado en cada endpoint que toca datos, mismo patrón que
`GENERIC_DEPT`/`escHtml`) desde antes de que este documento se escribiera
— prácticamente toda acción relevante (alta/edición/baja de ítems,
préstamos, cambios de usuario, login fallido/bloqueado, solicitudes,
pedidos, reservas...) queda registrada con usuario, rol, fecha y resumen.
Expuesto en la app en dos sitios: el modal de historial completo
(`js/modal-historial.js`, solo jefatura/superadmin) y la página visual de
historial con timeline agrupado por día (`goHistorialPage()`), además del
historial por ítem accesible a cualquier usuario del departamento
(`GET /api/historial?itemId=`, ver `js/modal-item.js:openHistorial()`).
No había nada que implementar — esta entrada nunca reflejó el estado real
del proyecto.

---

## 🟡 Vulnerabilidades Medias

### 11a. Volcados SQL completos commiteados en git — ⚠️ NUEVO HALLAZGO (28/08/2026, sin resolver)

**Severidad:** ALTA si el repo es público, sin impacto si es privado —
no confirmado en esta sesión.

**Descripción:** `Copias_SQL/backup_20260524_1426.sql` y otros 3 archivos
de la misma carpeta están commiteados en el historial de git (commit
`0d6e6a0`) — son volcados de `wrangler d1 export`, que a diferencia de
`backup.js` (ítem 5, ya auditado) **no filtra columnas**: incluyen la
tabla `usuarios` completa, con contraseñas hasheadas (PBKDF2) y
`session_token` reales. `*.zip` está en `.gitignore` pero `*.sql` no.

**Riesgo:** si `slatorre-dev/boscoinventario` es un repo público de
GitHub, cualquiera puede descargar esos hashes y `session_token` del
historial (aunque se borren los archivos hoy, siguen en commits
anteriores accesibles). Un hash PBKDF2 no es igual de grave que
texto plano, pero sí es material para fuerza bruta offline sin límite de
intentos (a diferencia del login real, que bloquea tras 5 intentos).

**Pendiente:** confirmar visibilidad del repo. Si es público: (a) hacer
el repo privado es la mitigación inmediata más simple, y/o (b) añadir
`Copias_SQL/*.sql` a `.gitignore` hacia adelante, y/o (c) purgar del
historial con `git filter-repo`/BFG si se decide que el repo debe seguir
siendo público — esto último requiere coordinación (reescribe hashes de
commit, invalida cualquier clon existente) y decisión explícita del
usuario, no se ha hecho.

---

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
- [x] Bloqueo de cuenta tras intentos fallidos (5, persistente hasta desbloqueo admin — no es la ventana temporal "5 min" original, ver ítem 6)
- [ ] Session timeout (1 hora)
- [x] Logging de auditoría en acciones críticas (tabla `log`, ver ítem 10)
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
| 1 | Credenciales en URL | 🟡 Mitigado parcialmente 28/08/2026 (v646) | Falta sacar el token de la URL a headers | ~6h restantes |
| 2 | Password en localStorage | ✅ Resuelto 28/08/2026 (v646) | `SESSION` ya no escribe `password`, usa `session_token` | — (sesiones ya abiertas antes del cambio se limpian solas en su próximo login) |
| 3 | Password sin hash | ✅ Resuelto 25/08/2026 | PBKDF2 (`crypto.subtle`) | — |
| 4 | Permisos solo frontend | CRÍTICA | Re-validar backend | 4h |
| 5 | Backup con passwords | ✅ Verificado sin riesgo 25/08/2026 | Ya excluía `password` | — |

**Total Críticos pendientes: 2 de 5** (1 mitigado parcialmente, 3 resueltos/verificados)
**Horas para resolver lo pendiente: ~10h** (4h ítem 4 + ~6h restantes del ítem 1)

---

**Última actualización:** 28/08/2026 (v646) — login tradicional deja de
reenviar la contraseña real (ítem 1 mitigado parcialmente, ítem 2
resuelto, ítem 8 resuelto como efecto colateral); nuevo hallazgo sin
resolver: volcados SQL completos commiteados en git (ítem 11a).
**Próxima auditoría:** Después de implementar cambios críticos
