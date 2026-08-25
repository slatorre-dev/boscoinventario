-- Pedidos: lista de material a comprar, compartida por todo el departamento
-- (antes solo en localStorage del navegador, sin sincronizar entre
-- dispositivos, y con una notificación por email que nunca funcionó porque
-- el endpoint /api/pedidos no existía — ver functions/api/pedidos.js).
-- Se autocrea también en runtime (list.js y pedidos.js) como red de
-- seguridad si esta migración aún no se ha ejecutado en remoto.
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  itemId INTEGER NOT NULL,
  departamento TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL DEFAULT 1,
  nota TEXT DEFAULT '',
  creadoPor TEXT DEFAULT '',
  fecha TEXT DEFAULT (datetime('now')),
  UNIQUE(itemId, departamento)
);
CREATE INDEX IF NOT EXISTS idx_pedidos_departamento ON pedidos(departamento);
