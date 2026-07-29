-- Departamento genérico "IES Juan Bosco": para material/asignaturas que no
-- pertenecen a ningún departamento concreto.

INSERT OR REPLACE INTO departamentos (slug,nombre,icono,color,orden) VALUES
('iesjuanbosco','IES Juan Bosco','🏫','#2563eb',0);

INSERT OR REPLACE INTO aulas (id,name,icon,desc,th,orden,departamento) VALUES
('dept-iesjuanbosco','IES Juan Bosco','🏫','Material genérico sin departamento asignado','th-blue',0,'iesjuanbosco');

INSERT INTO ciclos (cicloId,cicloNombre,nivel,icon,th,desc,modCod,modNombre,modHoras,cicloOrden,modOrden,responsable,departamento) VALUES
('iesjuanbosco','IES Juan Bosco','Otro','🏫','th-blue','Genérico, sin departamento asignado','M01','IES Juan Bosco',0,0,1,'','iesjuanbosco');
