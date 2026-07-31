-- Elimina de `profesores` las filas que ya duplican un usuario de la app
-- (mismo nombre o mismo email, case-insensitive). El backend ya las
-- fusiona sin duplicados visibles (list.js:mergeProfesores), pero tras
-- convertir el modal 👥 en "solo prestatarios externos" (ver
-- js/prestamos.js:openProfModal) estas filas quedarían huérfanas de UI
-- para editarlas/borrarlas.
DELETE FROM profesores
WHERE LOWER(TRIM(nombre)) IN (SELECT LOWER(TRIM(nombre)) FROM usuarios WHERE TRIM(nombre) != '')
   OR (email != '' AND LOWER(TRIM(email)) IN (SELECT LOWER(TRIM(email)) FROM usuarios WHERE TRIM(email) != ''));
