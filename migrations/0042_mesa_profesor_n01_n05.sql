-- "Mesa del profesor" en las aulas N-01..N-05 (fabricacionmecanica), que
-- no tenían ningún ítem y por eso no salían en Inicio (renderHome solo
-- muestra aulas con ≥1 ítem). Petición del usuario, 01/10/2026.
-- Categoría "Mobiliario" creada para el departamento si no existía (mismo
-- color/icono que la de otros departamentos). Idempotente.

INSERT OR IGNORE INTO categorias (name, c, bg, i, orden, departamento)
SELECT 'Mobiliario',
       COALESCE((SELECT c  FROM categorias WHERE name='Mobiliario' LIMIT 1), '#64748b'),
       COALESCE((SELECT bg FROM categorias WHERE name='Mobiliario' LIMIT 1), '#f1f5f9'),
       COALESCE((SELECT i  FROM categorias WHERE name='Mobiliario' LIMIT 1), '🪑'),
       COALESCE((SELECT MAX(orden) FROM categorias WHERE departamento='fabricacionmecanica'), 0) + 1,
       'fabricacionmecanica';

INSERT INTO inventario (ref, aula, mod, item, qty, min, cat, loc, est, fecha, tipo_material, code, departamento)
SELECT 'IB', v.aula, '', 'Mesa del profesor', 1, 1, 'Mobiliario', '', 'Bueno', '', 'inventariable', v.code, 'fabricacionmecanica'
FROM (
  SELECT 'n01' AS aula, 'IB-01431' AS code UNION ALL
  SELECT 'n02', 'IB-01432' UNION ALL
  SELECT 'n03', 'IB-01433' UNION ALL
  SELECT 'n04', 'IB-01434' UNION ALL
  SELECT 'n05', 'IB-01435'
) v
WHERE NOT EXISTS (SELECT 1 FROM inventario i WHERE i.aula = v.aula AND i.item = 'Mesa del profesor')
  AND NOT EXISTS (SELECT 1 FROM inventario i WHERE i.code = v.code);
