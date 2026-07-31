ALTER TABLE inventario ADD COLUMN serie TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_inventario_dept_serie ON inventario(departamento, serie);
