CREATE TABLE IF NOT EXISTS reservas_practica (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  departamento   TEXT DEFAULT '',
  cicloId        TEXT DEFAULT '',
  moduloCod      TEXT DEFAULT '',
  moduloNombre   TEXT DEFAULT '',
  aulaDestino    TEXT DEFAULT '',
  profesorId     INTEGER DEFAULT 0,
  profesorNombre TEXT DEFAULT '',
  fecha          TEXT DEFAULT '',
  franja         TEXT DEFAULT '',
  estado         TEXT DEFAULT 'pendiente',
  obs            TEXT DEFAULT '',
  creadoPor      TEXT DEFAULT '',
  creadoEn       TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS reserva_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reservaId  INTEGER NOT NULL,
  itemId     INTEGER NOT NULL,
  itemNombre TEXT DEFAULT '',
  cantidad   INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_reserva_items_reserva ON reserva_items(reservaId);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas_practica(departamento, fecha, estado);
