-- Elimina de `profesores` las filas que ya duplican un usuario de la app
-- del MISMO departamento (mismo nombre o mismo email, case-insensitive).
-- El backend ya las fusiona sin duplicados visibles dentro de un mismo
-- departamento (list.js:mergeProfesores), pero tras convertir el modal 👥
-- en "solo prestatarios externos" (ver js/prestamos.js:openProfModal)
-- estas filas quedarían huérfanas de UI para editarlas/borrarlas. La
-- comparación está acotada al mismo departamento a propósito: dos
-- personas con el mismo nombre en departamentos distintos no deben
-- afectarse entre sí (hay 24 departamentos, colisión de apellidos no es
-- improbable).
DELETE FROM profesores
WHERE EXISTS (
  SELECT 1 FROM usuarios u
  WHERE TRIM(u.nombre) != ''
    AND COALESCE(u.departamento,'') = COALESCE(profesores.departamento,'')
    AND ( LOWER(TRIM(u.nombre)) = LOWER(TRIM(profesores.nombre))
       OR (COALESCE(profesores.email,'') != '' AND LOWER(TRIM(u.email)) = LOWER(TRIM(profesores.email))) )
);
