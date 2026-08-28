-- Añade la columna tipo_material a la tabla inventario.
-- Esta columna categoriza los ítems como 'consumible' o 'inventariable'.
-- Necesaria antes de las migraciones 0019 (que actualiza esta columna)
-- y 0037 (que inserta ítems con esta columna).

ALTER TABLE inventario ADD COLUMN tipo_material TEXT DEFAULT 'consumible';
