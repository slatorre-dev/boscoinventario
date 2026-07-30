# Alta pública de profesores/as (auto-registro sin aprobación)

## Objetivo

Permitir que un profesor sin cuenta pueda darse de alta él mismo desde la
pantalla de login, sin depender de que un jefe/a de departamento o
superadmin le cree la cuenta manualmente por SQL o desde el modal de
Usuarios.

## Flujo

1. En `pLogin`, el texto estático "Si no tienes cuenta, contacta con el
   administrador del centro" se sustituye por un enlace "¿No tienes
   cuenta? Crear una".
2. Ese enlace abre un formulario nuevo (`#registerForm`, mismo patrón que
   el ya existente `#recoveryForm`) con: **Nombre completo**, **Correo
   electrónico**, **Departamento** (select poblado desde un endpoint
   público nuevo).
3. Al enviar, sin ningún paso de aprobación intermedio:
   - Se valida que el email tenga formato válido y no exista ya en
     `usuarios`. Si existe, error claro pidiendo usar "olvidé mi
     contraseña" o contactar con su jefe/a de departamento — no se crea
     nada.
   - Se genera el `usuario` (login) a partir de la parte local del email,
     igual que hace `ensureUser()` en `oauth/login-google.js` (sufijo
     numérico si colisiona).
   - Se inserta el usuario con rol `Profesor/a`, el departamento elegido,
     y una contraseña aleatoria que nunca se comunica (se sobrescribe en
     el siguiente paso).
   - Se reutiliza el mecanismo de recuperación de contraseña ya existente
     (`reset_tokens`, token de un solo uso, expira en 1h): se genera un
     token, se manda al profesor un email de bienvenida con enlace
     `#reset/TOKEN` para elegir su contraseña.
   - Se manda un segundo email de notificación a
     `inventarioelec@iesjuanbosco.es` (o `env.MAIL_FROM`) con nombre,
     email y departamento del alta — de forma asíncrona (no bloquea la
     respuesta si falla).
4. El profesor hace clic en el enlace de su email y llega a la pantalla
   `pReset` ya existente — mismo flujo que "olvidé mi contraseña".

## Decisiones tomadas

- **Sin aprobación previa**: la cuenta queda operativa en cuanto se
  confirma la contraseña, no hay estado "pendiente".
- **Departamento**: lo elige el propio profesor en el formulario (no hay
  forma de inferirlo automáticamente sin sesión). Un select con los 24
  departamentos + el compartido `iesjuanbosco`.
- **Duplicados**: si el email ya existe, se rechaza con error — no se
  autogenera un usuario alternativo.
- **Rol por defecto**: `Profesor/a` (igual que el alta automática vía
  Google OAuth para correos `@iesjuanbosco.es` no mapeados).
- **Login/usuario**: se autogenera del email, no lo escribe el profesor.
- **Mecanismo de contraseña inicial**: se reutiliza al 100% el sistema de
  reset ya existente (`reset_tokens`, `sendResetEmail`), en vez de
  construir un token nuevo o el flag `password_temporal` (ese flag se usa
  hoy solo para las 48 cuentas genéricas sembradas, un caso distinto:
  cuenta ya creada de antemano con contraseña=usuario, no alta pública).

## Cambios de código

- `functions/api/auth.js`:
  - Refactor: `sendResetEmail` ahora usa un helper genérico `sendMail()`
    compartido con dos nuevas plantillas: `sendWelcomeEmail()` (al
    profesor) y `sendNewUserNotification()` (al admin).
  - Nueva acción pública `GET action=departamentos` — lista mínima
    (slug, nombre, icono) para poblar el select sin necesitar sesión.
  - Nueva acción `POST action=register` — valida, crea usuario, genera
    token de reset, manda los dos emails.
- `index.html`: nueva vista `#registerForm` en `pLogin`, enlace en el
  footer del login.
- `js/reset.js`: `showRegister()`, `loadRegisterDepartments()`,
  `submitRegister()`; `showLogin()` actualizado para ocultar también
  `#registerForm`.

## Fuera de alcance

- No hay paso de aprobación por un humano (explícitamente pedido así).

## Actualización 30/07/2026

Se restringió el email a `@iesjuanbosco.es` (mismo criterio que el login
de Google) — `functions/api/auth.js`, acción `register`, un `endsWith`
extra tras la validación de formato.
