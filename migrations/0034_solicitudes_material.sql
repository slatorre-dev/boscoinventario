-- Solicitudes de material: flujo separado de `pedidos` (que exige un ítem ya
-- existente en inventario). Aquí un docente pide algo que puede no existir
-- todavía como ítem — jefatura/superadmin decide si se convierte en pedido.
-- Se autocrea también en runtime (list.js y solicitudes.js) como red de
-- seguridad si esta migración aún no se ha ejecutado en remoto.
CREATE TABLE IF NOT EXISTS solicitudes_material (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  departamento     TEXT NOT NULL DEFAULT '',
  nombre           TEXT NOT NULL DEFAULT '',
  cantidad         INTEGER NOT NULL DEFAULT 1,
  nota             TEXT DEFAULT '',
  estado           TEXT NOT NULL DEFAULT 'pendiente',
  respuesta        TEXT DEFAULT '',
  creadoPor        TEXT DEFAULT '',
  creadoPorNombre  TEXT DEFAULT '',
  fecha            TEXT DEFAULT (datetime('now')),
  actualizadoEn    TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_solicitudes_departamento ON solicitudes_material(departamento, estado);
