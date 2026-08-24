CREATE TABLE mantenimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  fecha_apertura TEXT NOT NULL,
  nota_apertura TEXT DEFAULT '',
  responsable TEXT DEFAULT '',
  coste REAL,
  fecha_cierre TEXT DEFAULT '',
  nota_cierre TEXT DEFAULT '',
  creado_por TEXT DEFAULT '',
  creado_en TEXT DEFAULT ''
);
CREATE INDEX idx_mantenimientos_item_id ON mantenimientos(item_id);

ALTER TABLE inventario ADD COLUMN mantCoste REAL;

-- Backfill: ítems ya marcados en mantenimiento se convierten en 1 incidencia
-- abierta cada uno (se conserva su mantEstado actual tal cual, sin forzar
-- fecha/nota de cierre aunque ya diga Reparado/Resuelto — no hay forma de
-- reconstruir ese dato histórico).
INSERT INTO mantenimientos (item_id, estado, fecha_apertura, nota_apertura, responsable, creado_en)
  SELECT id,
    CASE WHEN mantEstado IN ('Pendiente','En reparación','Enviado a reparar externo','Reparado','Resuelto')
         THEN mantEstado ELSE 'Pendiente' END,
    COALESCE(NULLIF(mantFecha,''), date('now')),
    COALESCE(mantNota,''),
    COALESCE(mantResp,''),
    datetime('now')
  FROM inventario WHERE mant = 1 OR mant = '1';
