-- Añade la columna parent_id a la tabla inventario.
-- Se usa para contenedores (prefijos SET-/CONT-): parent_id almacena el id
-- del contenedor padre para ítems que son componentes de un contenedor.
-- Necesaria antes de la migración 0020 que indexa esta columna.

ALTER TABLE inventario ADD COLUMN parent_id INTEGER DEFAULT NULL;
