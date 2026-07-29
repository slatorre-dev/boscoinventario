-- Las pantallas multimedia y pizarras de tiza sembradas en 0016 para las 70
-- aulas genéricas pasan del departamento vacío ('') al departamento
-- compartido 'iesjuanbosco', para que queden archivadas ahí en vez de huérfanas.

UPDATE inventario SET departamento='iesjuanbosco'
WHERE item IN ('Pantalla multimedia','Pizarra de tiza') AND departamento='';
