-- N-04 y N-05 las comparten Fabricación Mecánica y Electricidad/
-- Electrónica (01/10/2026). Un aula solo admite un departamento, así que
-- pasan a "aulas del centro" (departamento=''): ambos departamentos (y el
-- resto) las ven en sus listas, y cada uno sigue viendo solo SUS ítems
-- dentro (el scoping de ítems va por inventario.departamento, no por aula).
-- Ya no se editan desde ⚙️ Gestionar aulas de un departamento (las
-- globales se excluyen ahí, ver js/modal-aulas.js); solo superadmin.
UPDATE aulas SET departamento = '' WHERE id IN ('n04', 'n05');

-- Nombre coherente con el resto (N-01..N-11).
UPDATE aulas SET name = 'N-08' WHERE id = 'electricidadelectronica-aula41' AND name = 'N-8';
