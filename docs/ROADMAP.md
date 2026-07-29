# 🚀 Roadmap - Bosco Inventario

Plan de mejoras priorizadas por impacto y complejidad.

---

## 📋 Visión General

Este roadmap detalla las **35+ mejoras** identificadas en el análisis de código. Organizado por:
- **Prioridad:** CRÍTICO > ALTO > MEDIO > BAJO
- **Estimación:** Horas de trabajo
- **Impacto:** Qué área mejora (Seguridad, Performance, UX, etc.)
- **Dependencias:** Si requiere completar otra tarea primero

---

## 🔴 FASE 1: Crítico (Semanas 1-2 | 40h)

### [1.1] Migrar a Bearer Tokens ⚠️ CRÍTICO

**Problema:** Credenciales en URL y localStorage sin encripción

**Solución:**
- Cambiar `/api/auth` a usar `Authorization: Bearer` header
- Guardar solo token en memoria (no password)
- Implementar refresh tokens
- Session timeout (1 hora auto-logout)

**Cambios:**
- `functions/api/auth.js` - Generar JWT
- `functions/api/_middleware.js` - Validar Bearer token
- `js/api.js` - Cambiar headers
- `js/state.js` - Guardar solo token
- `js/auth.js` - Auto-logout en timeout

**Estimación:** 8 horas
**Impacto:** 🔒 Seguridad (crítica)
**Estado:** ⏳ NO INICIADO

---

### [1.2] Implementar Password Hashing

**Problema:** Contraseñas guardadas en plain text en BD

**Solución:**
- Usar bcrypt o Argon2
- Hash en inserción de usuario
- Validar con compareSync()
- Migrar usuarios existentes

**Cambios:**
- `npm install bcrypt`
- `functions/api/auth.js` - Hash password
- `functions/api/_middleware.js` - Validar hash
- Migration: 0004_hash_passwords.sql
- Script: hasear_usuarios_existentes.js

**Estimación:** 6 horas
**Impacto:** 🔒 Seguridad (crítica)
**Dependencias:** [1.1] Migrar a Bearer Tokens
**Estado:** ⏳ NO INICIADO

---

### [1.3] Añadir Rate-Limiting en Login

**Problema:** Sin protección contra fuerza bruta

**Solución:**
- Limitar 5 intentos fallidos por 5 minutos
- Bloquear cuenta temporalmente después
- Log de intentos fallidos

**Cambios:**
- Crear tabla `login_attempts`
- `functions/api/auth.js` - Verificar intentos
- Cloudflare rate-limiting rules

**Estimación:** 4 horas
**Impacto:** 🔒 Seguridad (crítica)
**Estado:** ⏳ NO INICIADO

---

### [1.4] Schema Validation con Zod

**Problema:** Sin validación de tipos en API

**Solución:**
- Instalar Zod para validación de esquema
- Validar todos los inputs en endpoints
- Mensaje de error claro

**Cambios:**
- `npm install zod`
- `functions/api/item.js` - Añadir ItemSchema
- `functions/api/auth.js` - AuthSchema
- Todos los endpoints: `.parse()` antes de usar datos

**Estimación:** 6 horas
**Impacto:** 🛡️ Confiabilidad
**Estado:** ⏳ NO INICIADO

---

### [1.5] Eliminar Contraseña de Backups

**Problema:** Exportación de datos incluye passwords en plain text

**Solución:**
- Excluir columna `password` de backups
- Opción de encriptar backup
- Aviso al usuario

**Cambios:**
- `functions/api/backup.js` - Excluir password
- `js/backup.js` - Aviso encriptación

**Estimación:** 3 horas
**Impacto:** 🔒 Seguridad (media)
**Estado:** ⏳ NO INICIADO

---

### [1.6] Crear Modal Genérico

**Problema:** 10 modales duplican código (40-50% del JS)

**Solución:**
- Crear clase `Modal` genérica
- Herencia para casos especiales
- Reducir de 2000+ líneas a ~500 líneas

**Cambios:**
- `js/core/Modal.js` - Clase base
- `js/core/ItemModal.js` - Hereda de Modal
- Refactorizar: `modal-item.js`, `modal-aulas.js`, etc.
- Tests para Modal

**Estimación:** 12 horas
**Impacto:** 📈 Mantenibilidad (crítica)
**Estado:** ⏳ NO INICIADO

---

### [1.7] Documentación API (OpenAPI/Swagger)

**Problema:** API endpoints no documentados

**Solución:**
- Crear `openapi.json` con especificación
- Auto-generar Swagger UI
- Documentar todos los endpoints

**Cambios:**
- `openapi.json` - Spec OpenAPI 3.0
- `functions/api/swagger.js` - Servir Swagger UI
- URL: `/api/swagger`

**Estimación:** 5 horas
**Impacto:** 📚 Documentación
**Estado:** ⏳ NO INICIADO

---

## 🟠 FASE 2: Alto (Semanas 3-4 | 35h)

### [2.1] Implementar Tests E2E

**Problema:** 0 tests automatizados

**Solución:**
- Vitest para unit tests
- Playwright para E2E tests
- Coverage mínimo 70%

**Cambios:**
- `npm install -D vitest playwright`
- `tests/unit/api.test.js` - Tests de utilidades
- `tests/e2e/login.spec.js` - Flujo login
- `tests/e2e/inventory.spec.js` - CRUD items
- GitHub Actions: CI/CD

**Estimación:** 14 horas
**Impacto:** 🧪 Testing
**Dependencias:** [1.6] Modal genérico
**Estado:** ⏳ NO INICIADO

---

### [2.2] Modularizar JavaScript (ES6 modules)

**Problema:** 20+ scripts globales sin dependencias claras

**Solución:**
- Convertir a ES6 modules
- Tree-shaking en build
- Lazy loading de modales

**Cambios:**
- `js/main.js` - Punto de entrada
- Convertir todos a `export/import`
- Bundler: esbuild (optional)

**Estimación:** 10 horas
**Impacto:** 📈 Mantenibilidad
**Dependencias:** [1.6] Modal genérico
**Estado:** ⏳ NO INICIADO

---

### [2.3] Error Handling Global

**Problema:** Error handling inconsistente y poco visible

**Solución:**
- Try-catch global
- Toast notifications para errores
- Logging estructurado

**Cambios:**
- `js/core/ErrorHandler.js`
- `js/ui/Toast.js`
- Envolver todos los apiCall() en try-catch
- Backend: error middleware

**Estimación:** 5 horas
**Impacto:** 🎯 UX
**Estado:** ⏳ NO INICIADO

---

### [2.4] Session Timeout & Auto-Logout

**Problema:** Sesión activa indefinidamente

**Solución:**
- Logout automático después de 1 hora inactividad
- Aviso visual antes de logout (5 min)
- Renovación de session activa

**Cambios:**
- `js/auth.js` - Timer de inactividad
- `js/ui/SessionWarning.js` - Modal de aviso
- `functions/api/_middleware.js` - Validar timestamp

**Estimación:** 4 horas
**Impacto:** 🔒 Seguridad
**Estado:** ⏳ NO INICIADO

---

### [2.5] Mejorar UX Modal (Tabs/Secciones)

**Problema:** Modal de item demasiado largo (20+ campos)

**Solución:**
- Organizar campos en tabs
- Campos requeridos en tab 1, opcionales en tab 2+
- Collapsable sections

**Cambios:**
- `js/core/Modal.js` - Soporte para tabs
- `index.html` - Restructurar modal
- CSS: Tab styling

**Estimación:** 6 horas
**Impacto:** 🎯 UX
**Dependencias:** [1.6] Modal genérico
**Estado:** ⏳ NO INICIADO

---

### [2.6] Performance: Lazy Loading de Imágenes

**Problema:** Todas las imágenes se cargan al start

**Solución:**
- Lazy loading con intersection observer
- Thumbnails comprimidas
- Redimensionar fotos al upload

**Cambios:**
- `js/core/ImageLoader.js`
- `js/modal-item.js` - Usar ImageLoader
- Service Worker: cache de thumbnails

**Estimación:** 5 horas
**Impacto:** ⚡ Performance
**Estado:** ⏳ NO INICIADO

---

## 🟡 FASE 3: Medio (Semana 5+ | 25h)

### [3.1] Migrar a TypeScript

**Problema:** Sin type safety

**Solución:**
- Instalar TypeScript
- Crear `tsconfig.json`
- Convertir archivos JS a TS gradualmente
- Generar tipos desde BD

**Estimación:** 15 horas
**Impacto:** 🛡️ Type safety
**Dependencias:** [2.2] Modularizar JS
**Estado:** ⏳ NO INICIADO

---

### [3.2] Mejorar Accesibilidad (WCAG 2.1)

**Problema:** Muchos elementos sin ARIA

**Solución:**
- Añadir ARIA labels
- Focus indicators visibles
- Navegación por teclado
- Test con lectores de pantalla

**Cambios:**
- `index.html` - ARIA attributes
- `css/styles.css` - Focus states
- Audit con axe DevTools

**Estimación:** 8 horas
**Impacto:** ♿ Accesibilidad
**Estado:** ⏳ NO INICIADO

---

### [3.3] Offline Mode Completo

**Problema:** Sin sincronización offline

**Solución:**
- Queue de cambios offline
- Sincronizar cuando vuelva conexión
- Conflicto resolution (último gana)

**Cambios:**
- `js/core/OfflineQueue.js`
- `sw.js` - Background sync
- DB local con IndexedDB

**Estimación:** 10 horas
**Impacto:** 📱 PWA
**Estado:** ⏳ NO INICIADO

---

### [3.4] 2FA (Two-Factor Authentication)

**Problema:** Sin segundo factor de autenticación

**Solución:**
- TOTP (Google Authenticator)
- SMS backup codes
- Recuperación de cuenta

**Estimación:** 8 horas
**Impacto:** 🔒 Seguridad
**Estado:** ⏳ NO INICIADO

---

## 📊 Matriz de Priorización

```
         IMPACTO ALTO
             │
             │  [1.1] Bearer
             │  [1.2] Hashing  [2.1] Tests
             │  [1.6] Modal       [2.4] Timeout
             │  [1.3] RateLimit
────────────┼──────────────────────────────────────
             │  [2.5] UX Modal
             │  [2.6] Lazy Load  [3.1] TypeScript
             │  [3.2] Accessibility
             │
    BAJO │  [3.4] 2FA
        └─────────────────────────────────────────
            ESFUERZO BAJO ←──→ ESFUERZO ALTO
```

---

## 📅 Timeline Estimado

**Total:** ~100 horas de desarrollo

```
Semana 1 (40h):  FASE 1 - Crítico
  [1.1] Bearer tokens (8h)
  [1.2] Hashing (6h)
  [1.3] Rate-limiting (4h)
  [1.4] Zod validation (6h)
  [1.5] Backup security (3h)
  [1.6] Modal genérico (12h)
  [1.7] OpenAPI docs (5h)

Semana 2-3 (35h): FASE 2 - Alto
  [2.1] Tests E2E (14h)
  [2.2] ES6 modules (10h)
  [2.3] Error handling (5h)
  [2.4] Session timeout (4h)
  [2.5] UX Modal (6h)

Semana 4+ (25h): FASE 3 - Medio
  [3.1] TypeScript (15h)
  [3.2] Accessibility (8h)
  [3.3] Offline sync (10h)
  [3.4] 2FA (8h)
```

---

## ✅ Tracking de Progreso

- [x] Análisis completado
- [ ] FASE 1 iniciada
- [ ] FASE 2 iniciada
- [ ] FASE 3 iniciada
- [ ] Todo completado

### Estado Actual (v317)

| Tarea | Estado | Estimación | Asignado |
|-------|--------|-----------|----------|
| 1.1 - Bearer tokens | ⏳ TODO | 8h | - |
| 1.2 - Hashing | ⏳ TODO | 6h | - |
| 1.3 - Rate-limiting | ⏳ TODO | 4h | - |
| 1.4 - Zod | ⏳ TODO | 6h | - |
| 1.5 - Backup | ⏳ TODO | 3h | - |
| 1.6 - Modal genérico | ⏳ TODO | 12h | - |
| 1.7 - OpenAPI | ⏳ TODO | 5h | - |
| 2.1 - Tests | ⏳ TODO | 14h | - |
| 2.2 - ES6 modules | ⏳ TODO | 10h | - |
| 2.3 - Errors | ⏳ TODO | 5h | - |
| 2.4 - Timeout | ⏳ TODO | 4h | - |
| 2.5 - UX | ⏳ TODO | 6h | - |
| 3.1 - TypeScript | ⏳ TODO | 15h | - |
| 3.2 - A11y | ⏳ TODO | 8h | - |
| 3.3 - Offline | ⏳ TODO | 10h | - |
| 3.4 - 2FA | ⏳ TODO | 8h | - |

---

## 🎯 Próximos Pasos (Hoy)

1. ✅ Crear DEVELOPMENT.md, ARCHITECTURE.md, API.md, ROADMAP.md, SECURITY.md
2. ⏳ Crear branch `feature/security-refactor`
3. ⏳ Iniciar [1.1] - Migrar a Bearer tokens

---

**Última actualización:** Mayo 2026 (v317+)
**Mantener actualizado:** Al completar cada tarea
