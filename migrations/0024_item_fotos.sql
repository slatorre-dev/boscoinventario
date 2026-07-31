CREATE TABLE item_fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  foto TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_item_fotos_item_id ON item_fotos(item_id);

INSERT INTO item_fotos (item_id, foto, orden)
  SELECT id, foto, 1 FROM inventario WHERE foto IS NOT NULL AND trim(foto) != '';
