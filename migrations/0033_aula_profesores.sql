CREATE TABLE IF NOT EXISTS aula_profesores (
  aula    TEXT NOT NULL,
  usuario TEXT NOT NULL,
  PRIMARY KEY (aula, usuario)
);
CREATE INDEX IF NOT EXISTS idx_aula_profesores_usuario ON aula_profesores(usuario);
