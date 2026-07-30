-- Los ítems de ejemplo sembrados en 0016 (pantalla multimedia, pizarra de
-- tiza en las 70 aulas globales, e ítems propios por departamento como
-- osciloscopio, microscopio, torno mecánico...) quedaron con
-- tipo_material='consumible' por defecto de item.js (columna creada con
-- DEFAULT 'consumible' + auto-migración que rellena vacíos como consumible),
-- pero son equipamiento fijo de aula/taller, no material que se consume y
-- repone. Sin este cambio, qty=1/min=1 dispara el aviso de stock bajo.

UPDATE inventario SET tipo_material='inventariable'
WHERE item IN ('Pantalla multimedia','Pizarra de tiza')
   OR departamento NOT IN ('','iesjuanbosco');
