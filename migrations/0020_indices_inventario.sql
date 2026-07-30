-- Índices para tabla inventario. Casi toda query filtra primero por
-- departamento (scoping obligatorio, ver _middleware.js), así que los
-- compuestos (departamento, x) sirven a la vez de índice de "x" para el
-- caso normal (no-superadmin) y de filtro de departamento en sí.
CREATE INDEX IF NOT EXISTS idx_inventario_dept ON inventario(departamento);
CREATE INDEX IF NOT EXISTS idx_inventario_dept_aula ON inventario(departamento, aula);
CREATE INDEX IF NOT EXISTS idx_inventario_dept_ref ON inventario(departamento, ref);
CREATE INDEX IF NOT EXISTS idx_inventario_dept_cat ON inventario(departamento, cat);
CREATE INDEX IF NOT EXISTS idx_inventario_parent ON inventario(parent_id);
