-- Formaliza como migración la tabla que functions/api/item.js
-- (ensureDeteccionLearningTable) ya autocreaba en runtime desde antes de
-- que existiera esta carpeta de migraciones — ver Pendiente #9 en claude.md.
-- CREATE TABLE IF NOT EXISTS: idempotente, no-op si ya existe (remoto y
-- local de tests).
CREATE TABLE IF NOT EXISTS ia_deteccion_ejemplos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT DEFAULT '',
  departamento TEXT DEFAULT '',
  tipo TEXT DEFAULT '',
  nombre TEXT DEFAULT '',
  categoria TEXT DEFAULT '',
  serie TEXT DEFAULT '',
  marca TEXT DEFAULT '',
  modelo TEXT DEFAULT '',
  texto_libre TEXT DEFAULT '',
  confianza REAL DEFAULT 0,
  imagen_base64 TEXT DEFAULT ''
);
