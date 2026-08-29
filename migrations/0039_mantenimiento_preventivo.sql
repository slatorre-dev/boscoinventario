-- Plan preventivo: 1:1 con el ítem, columnas planas (mismo patrón que
-- fecha_adquisicion/precio/serie) — no hay historial de "versiones" del
-- plan, solo el estado actual.
ALTER TABLE inventario ADD COLUMN mantPlanIntervaloDias INTEGER;
ALTER TABLE inventario ADD COLUMN mantPlanUltimaRevision TEXT DEFAULT '';
ALTER TABLE inventario ADD COLUMN mantPlanProximaRevision TEXT DEFAULT '';
ALTER TABLE inventario ADD COLUMN mantPlanNota TEXT DEFAULT '';

-- Cada incidencia de mantenimiento distingue correctivo (avería real) de
-- preventivo (revisión rutinaria, con o sin hallazgo).
ALTER TABLE mantenimientos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'correctivo';

-- Responsables de mantenimiento: mismo patrón que aula_profesores/
-- modulo_profesores (migrations/0032, 0033) — autoservicio + asignación
-- admin. categoria='' significa "todo el departamento".
CREATE TABLE IF NOT EXISTS mantenimiento_responsables (
  categoria    TEXT NOT NULL DEFAULT '',
  departamento TEXT NOT NULL,
  usuario      TEXT NOT NULL,
  PRIMARY KEY (categoria, departamento, usuario)
);
CREATE INDEX IF NOT EXISTS idx_mantenimiento_responsables_usuario ON mantenimiento_responsables(usuario);
