-- Bloqueo de cuenta tras demasiados intentos de login fallidos seguidos
-- (5 intentos), con aviso al usuario a partir de 2 intentos restantes.
-- Ver functions/api/auth.js (login) y functions/api/usuarios.js (userUnlock).
ALTER TABLE usuarios ADD COLUMN intentos_fallidos INTEGER DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN bloqueado INTEGER DEFAULT 0;
