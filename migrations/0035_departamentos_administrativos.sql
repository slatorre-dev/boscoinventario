-- Departamentos administrativos del centro (Dirección/Jefatura, Secretaría,
-- Conserjería, Administración de oficina): mismo patrón que los 24
-- departamentos académicos/FP existentes (slug propio, aula dept-<slug>,
-- aislados entre sí y del resto). Slug 'administracionoficina' (no
-- 'administracion') para no chocar con el departamento FP ya existente
-- 'administracion' (Gestión Administrativa / Administración y Finanzas /
-- Asistencia a la Dirección).
--
-- Dirección y Jefatura comparten un único departamento/aula (misma
-- decisión del usuario), pero con dos cuentas propias (direccion@ y
-- jefatura@) para que cada persona inicie sesión con su propio usuario.
-- Administración (Oficina) se crea sin cuenta por ahora: el usuario no
-- dio un correo para ella.

INSERT OR REPLACE INTO departamentos (slug,nombre,icono,color,orden) VALUES
('direccion','Dirección y Jefatura','🧭','#1e3a8a',25),
('secretaria','Secretaría','📋','#6d28d9',26),
('conserjeria','Conserjería','🔑','#c2410c',27),
('administracionoficina','Administración (Oficina)','🧮','#b91c1c',28);

INSERT OR REPLACE INTO aulas (id,name,icon,desc,th,orden,departamento) VALUES
('dept-direccion','Dirección y Jefatura','🧭','Despacho de dirección y jefatura de estudios','th-blue',125,'direccion'),
('dept-secretaria','Secretaría','📋','Secretaría del centro','th-purple',126,'secretaria'),
('dept-conserjeria','Conserjería','🔑','Conserjería del centro','th-orange',127,'conserjeria'),
('dept-administracionoficina','Administración (Oficina)','🧮','Oficina de administración del centro','th-red',128,'administracionoficina');

INSERT INTO usuarios (usuario,password,nombre,rol,email,departamento,password_temporal) VALUES
('direccion','direccion','Dirección','jefe/a departamento','direccion@iesjuanbosco.es','direccion',1),
('jefatura','jefatura','Jefatura de Estudios','jefe/a departamento','jefatura@iesjuanbosco.es','direccion',1),
('secretaria','secretaria','Secretaría','jefe/a departamento','secretaria@iesjuanbosco.es','secretaria',1),
('conserjeria','conserjeria','Conserjería','jefe/a departamento','conserjeria@iesjuanbosco.es','conserjeria',1);
