CREATE TABLE IF NOT EXISTS modulo_profesores (
  cicloId      TEXT NOT NULL,
  modCod       TEXT NOT NULL,
  departamento TEXT NOT NULL,
  usuario      TEXT NOT NULL,
  PRIMARY KEY (cicloId, modCod, departamento, usuario)
);
CREATE INDEX IF NOT EXISTS idx_modulo_profesores_usuario ON modulo_profesores(usuario);

-- Backfill: copia cada `ciclos.responsable` cuyo nombre coincide exactamente
-- (case-insensitive, mismo departamento) con un usuario existente. No se
-- borra `ciclos.responsable` — queda como dato histórico inerte.
INSERT OR IGNORE INTO modulo_profesores (cicloId, modCod, departamento, usuario)
SELECT c.cicloId, c.modCod, c.departamento, u.usuario
FROM ciclos c
JOIN usuarios u
  ON LOWER(TRIM(u.nombre)) = LOWER(TRIM(c.responsable))
  AND u.departamento = c.departamento
WHERE c.responsable IS NOT NULL AND TRIM(c.responsable) != '';
