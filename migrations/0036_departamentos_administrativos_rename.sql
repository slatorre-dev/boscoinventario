-- Los 4 departamentos administrativos de la migración 0035 (direccion,
-- secretaria, conserjeria, administracionoficina) siguen aislados entre sí
-- a nivel de datos (cada uno con su propio slug/aula/cuentas), pero deben
-- mostrarse como parte de la identidad "IES Juan Bosco" del centro, no
-- como un departamento académico más — se renombran con el prefijo
-- "IES Juan Bosco · " en departamentos.nombre y en el nombre de su aula.

UPDATE departamentos SET nombre='IES Juan Bosco · Dirección y Jefatura' WHERE slug='direccion';
UPDATE departamentos SET nombre='IES Juan Bosco · Secretaría' WHERE slug='secretaria';
UPDATE departamentos SET nombre='IES Juan Bosco · Conserjería' WHERE slug='conserjeria';
UPDATE departamentos SET nombre='IES Juan Bosco · Administración (Oficina)' WHERE slug='administracionoficina';

UPDATE aulas SET name='IES Juan Bosco · Dirección y Jefatura' WHERE id='dept-direccion';
UPDATE aulas SET name='IES Juan Bosco · Secretaría' WHERE id='dept-secretaria';
UPDATE aulas SET name='IES Juan Bosco · Conserjería' WHERE id='dept-conserjeria';
UPDATE aulas SET name='IES Juan Bosco · Administración (Oficina)' WHERE id='dept-administracionoficina';
