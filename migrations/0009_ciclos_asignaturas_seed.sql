-- Asignaturas de los departamentos académicos (Bachillerato/ESO): un
-- "ciclo/departamento" por departamento, con cada asignatura como
-- "módulo". Códigos (modCod) autogenerados M01.. ya que no hay código
-- oficial de asignatura. Horas a 0 (no aplica fuera de FP).

INSERT INTO ciclos (cicloId,cicloNombre,nivel,icon,th,desc,modCod,modNombre,modHoras,cicloOrden,modOrden,responsable,departamento) VALUES
('artesplasticas','Artes Plásticas','Otro','🎨','th-purple','Artes Plásticas','M01','Educación Plástica, Visual y Audiovisual (ESO)',0,1,1,'','artesplasticas'),
('artesplasticas','Artes Plásticas','Otro','🎨','th-purple','Artes Plásticas','M02','Expresión Artística',0,1,2,'','artesplasticas'),
('artesplasticas','Artes Plásticas','Otro','🎨','th-purple','Artes Plásticas','M03','Dibujo Artístico I y II',0,1,3,'','artesplasticas'),
('artesplasticas','Artes Plásticas','Otro','🎨','th-purple','Artes Plásticas','M04','Dibujo Técnico (en algunos centros pasa a Tecnología)',0,1,4,'','artesplasticas'),
('artesplasticas','Artes Plásticas','Otro','🎨','th-purple','Artes Plásticas','M05','Dibujo Técnico Aplicado a las Artes Plásticas y Diseño I y II',0,1,5,'','artesplasticas'),
('artesplasticas','Artes Plásticas','Otro','🎨','th-purple','Artes Plásticas','M06','Diseño',0,1,6,'','artesplasticas'),
('artesplasticas','Artes Plásticas','Otro','🎨','th-purple','Artes Plásticas','M07','Fundamentos Artísticos',0,1,7,'','artesplasticas'),
('artesplasticas','Artes Plásticas','Otro','🎨','th-purple','Artes Plásticas','M08','Proyectos Artísticos',0,1,8,'','artesplasticas'),
('artesplasticas','Artes Plásticas','Otro','🎨','th-purple','Artes Plásticas','M09','Volumen',0,1,9,'','artesplasticas'),
('artesplasticas','Artes Plásticas','Otro','🎨','th-purple','Artes Plásticas','M10','Técnicas de Expresión Gráfico-Plástica',0,1,10,'','artesplasticas'),
('artesplasticas','Artes Plásticas','Otro','🎨','th-purple','Artes Plásticas','M11','Cultura Audiovisual',0,1,11,'','artesplasticas'),
('artesplasticas','Artes Plásticas','Otro','🎨','th-purple','Artes Plásticas','M12','Creación de Contenidos Artísticos y Audiovisuales',0,1,12,'','artesplasticas'),

('cienciasnaturales','Ciencias Naturales','Otro','🔬','th-green','Ciencias Naturales','M01','Biología y Geología',0,1,1,'','cienciasnaturales'),
('cienciasnaturales','Ciencias Naturales','Otro','🔬','th-green','Ciencias Naturales','M02','Biología, Geología y Ciencias Ambientales',0,1,2,'','cienciasnaturales'),
('cienciasnaturales','Ciencias Naturales','Otro','🔬','th-green','Ciencias Naturales','M03','Ciencias Generales',0,1,3,'','cienciasnaturales'),
('cienciasnaturales','Ciencias Naturales','Otro','🔬','th-green','Ciencias Naturales','M04','Cultura Científica',0,1,4,'','cienciasnaturales'),
('cienciasnaturales','Ciencias Naturales','Otro','🔬','th-green','Ciencias Naturales','M05','Anatomía Aplicada',0,1,5,'','cienciasnaturales'),
('cienciasnaturales','Ciencias Naturales','Otro','🔬','th-green','Ciencias Naturales','M06','Investigación y Desarrollo Científico',0,1,6,'','cienciasnaturales'),

('economia','Economía','Otro','💶','th-amber','Economía','M01','Economía y Emprendimiento (ESO)',0,1,1,'','economia'),
('economia','Economía','Otro','💶','th-amber','Economía','M02','Economía',0,1,2,'','economia'),
('economia','Economía','Otro','💶','th-amber','Economía','M03','Economía, Emprendimiento y Actividad Empresarial',0,1,3,'','economia'),
('economia','Economía','Otro','💶','th-amber','Economía','M04','Empresa y Diseño de Modelos de Negocio',0,1,4,'','economia'),
('economia','Economía','Otro','💶','th-amber','Economía','M05','Fundamentos de Administración y Gestión',0,1,5,'','economia'),

('educacionfisicadeportiva','Educación Física y Deportiva','Otro','🏃','th-orange','Educación Física y Deportiva','M01','Educación Física (ESO y Bachillerato)',0,1,1,'','educacionfisicadeportiva'),

('filosofia','Filosofía','Otro','📚','th-purple','Filosofía','M01','Filosofía (4.º ESO y 1.º Bachillerato)',0,1,1,'','filosofia'),
('filosofia','Filosofía','Otro','📚','th-purple','Filosofía','M02','Historia de la Filosofía (2.º Bachillerato)',0,1,2,'','filosofia'),
('filosofia','Filosofía','Otro','📚','th-purple','Filosofía','M03','Psicología',0,1,3,'','filosofia'),

('fisicaquimica','Física y Química','Otro','⚗️','th-teal','Física y Química','M01','Física y Química (ESO)',0,1,1,'','fisicaquimica'),
('fisicaquimica','Física y Química','Otro','⚗️','th-teal','Física y Química','M02','Física',0,1,2,'','fisicaquimica'),
('fisicaquimica','Física y Química','Otro','⚗️','th-teal','Física y Química','M03','Química',0,1,3,'','fisicaquimica'),
('fisicaquimica','Física y Química','Otro','⚗️','th-teal','Física y Química','M04','Cultura Científica (en algunos centros)',0,1,4,'','fisicaquimica'),

('fol','Formación y Orientación Laboral','Otro','💼','th-blue','Formación y Orientación Laboral','M01','Formación y Orientación Personal y Profesional (4.º ESO)',0,1,1,'','fol'),
('fol','Formación y Orientación Laboral','Otro','💼','th-blue','Formación y Orientación Laboral','M02','Emprendimiento y Diseño de Proyecto (cuando existe como optativa)',0,1,2,'','fol'),

('frances','Francés','Otro','🇫🇷','th-blue','Francés','M01','Francés',0,1,1,'','frances'),
('frances','Francés','Otro','🇫🇷','th-blue','Francés','M02','Segunda Lengua Extranjera (Francés I y II)',0,1,2,'','frances'),

('geografiahistoria','Geografía e Historia','Otro','🗺️','th-amber','Geografía e Historia','M01','Geografía e Historia',0,1,1,'','geografiahistoria'),
('geografiahistoria','Geografía e Historia','Otro','🗺️','th-amber','Geografía e Historia','M02','Historia del Mundo Contemporáneo',0,1,2,'','geografiahistoria'),
('geografiahistoria','Geografía e Historia','Otro','🗺️','th-amber','Geografía e Historia','M03','Historia de España',0,1,3,'','geografiahistoria'),
('geografiahistoria','Geografía e Historia','Otro','🗺️','th-amber','Geografía e Historia','M04','Geografía',0,1,4,'','geografiahistoria'),
('geografiahistoria','Geografía e Historia','Otro','🗺️','th-amber','Geografía e Historia','M05','Historia del Arte',0,1,5,'','geografiahistoria'),
('geografiahistoria','Geografía e Historia','Otro','🗺️','th-amber','Geografía e Historia','M06','Movimientos Culturales y Artísticos (en muchos centros)',0,1,6,'','geografiahistoria'),
('geografiahistoria','Geografía e Historia','Otro','🗺️','th-amber','Geografía e Historia','M07','Historia de la Música y la Danza (a veces Música)',0,1,7,'','geografiahistoria'),
('geografiahistoria','Geografía e Historia','Otro','🗺️','th-amber','Geografía e Historia','M08','Cultura Clásica (a veces Latín y Griego)',0,1,8,'','geografiahistoria'),

('ingles','Inglés','Otro','🇬🇧','th-blue','Inglés','M01','Lengua Extranjera: Inglés (ESO)',0,1,1,'','ingles'),
('ingles','Inglés','Otro','🇬🇧','th-blue','Inglés','M02','Inglés I y II (Bachillerato)',0,1,2,'','ingles'),
('ingles','Inglés','Otro','🇬🇧','th-blue','Inglés','M03','Segunda Lengua Extranjera cuando es Inglés',0,1,3,'','ingles'),

('latingriego','Latín y Griego','Otro','🏛️','th-purple','Latín y Griego','M01','Latín (ESO)',0,1,1,'','latingriego'),
('latingriego','Latín y Griego','Otro','🏛️','th-purple','Latín y Griego','M02','Latín I y II',0,1,2,'','latingriego'),
('latingriego','Latín y Griego','Otro','🏛️','th-purple','Latín y Griego','M03','Griego I y II',0,1,3,'','latingriego'),
('latingriego','Latín y Griego','Otro','🏛️','th-purple','Latín y Griego','M04','Literatura Universal (habitualmente)',0,1,4,'','latingriego'),
('latingriego','Latín y Griego','Otro','🏛️','th-purple','Latín y Griego','M05','Cultura Clásica (habitualmente)',0,1,5,'','latingriego'),

('lenguacastellana','Lengua Castellana y Literatura','Otro','📖','th-green','Lengua Castellana y Literatura','M01','Lengua Castellana y Literatura (ESO)',0,1,1,'','lenguacastellana'),
('lenguacastellana','Lengua Castellana y Literatura','Otro','📖','th-green','Lengua Castellana y Literatura','M02','Lengua Castellana y Literatura I y II',0,1,2,'','lenguacastellana'),
('lenguacastellana','Lengua Castellana y Literatura','Otro','📖','th-green','Lengua Castellana y Literatura','M03','Literatura Universal (en algunos centros se asigna aquí)',0,1,3,'','lenguacastellana'),
('lenguacastellana','Lengua Castellana y Literatura','Otro','📖','th-green','Lengua Castellana y Literatura','M04','Literatura Dramática (a veces Artes Escénicas)',0,1,4,'','lenguacastellana'),

('matematicas','Matemáticas','Otro','📐','th-blue','Matemáticas','M01','Matemáticas (ESO)',0,1,1,'','matematicas'),
('matematicas','Matemáticas','Otro','📐','th-blue','Matemáticas','M02','Matemáticas A',0,1,2,'','matematicas'),
('matematicas','Matemáticas','Otro','📐','th-blue','Matemáticas','M03','Matemáticas B',0,1,3,'','matematicas'),
('matematicas','Matemáticas','Otro','📐','th-blue','Matemáticas','M04','Matemáticas I',0,1,4,'','matematicas'),
('matematicas','Matemáticas','Otro','📐','th-blue','Matemáticas','M05','Matemáticas II',0,1,5,'','matematicas'),
('matematicas','Matemáticas','Otro','📐','th-blue','Matemáticas','M06','Matemáticas Aplicadas a las Ciencias Sociales I y II',0,1,6,'','matematicas'),
('matematicas','Matemáticas','Otro','📐','th-blue','Matemáticas','M07','Matemáticas Generales',0,1,7,'','matematicas'),

('musica','Música','Otro','🎵','th-purple','Música','M01','Música (ESO)',0,1,1,'','musica'),
('musica','Música','Otro','🎵','th-purple','Música','M02','Lenguaje y Práctica Musical',0,1,2,'','musica'),
('musica','Música','Otro','🎵','th-purple','Música','M03','Análisis Musical I y II',0,1,3,'','musica'),
('musica','Música','Otro','🎵','th-purple','Música','M04','Coro y Técnica Vocal I y II',0,1,4,'','musica'),
('musica','Música','Otro','🎵','th-purple','Música','M05','Historia de la Música y la Danza (habitualmente)',0,1,5,'','musica'),
('musica','Música','Otro','🎵','th-purple','Música','M06','Proyectos Artísticos de Música, Danza y Arte Dramático',0,1,6,'','musica'),
('musica','Música','Otro','🎵','th-purple','Música','M07','Artes Escénicas I y II (en algunos centros)',0,1,7,'','musica'),

('tecnologia','Tecnología','Otro','⚙️','th-teal','Tecnología','M01','Tecnología y Digitalización (ESO)',0,1,1,'','tecnologia'),
('tecnologia','Tecnología','Otro','⚙️','th-teal','Tecnología','M02','Digitalización',0,1,2,'','tecnologia'),
('tecnologia','Tecnología','Otro','⚙️','th-teal','Tecnología','M03','Tecnología',0,1,3,'','tecnologia'),
('tecnologia','Tecnología','Otro','⚙️','th-teal','Tecnología','M04','Proyectos de Robótica',0,1,4,'','tecnologia'),
('tecnologia','Tecnología','Otro','⚙️','th-teal','Tecnología','M05','Desarrollo Digital',0,1,5,'','tecnologia'),
('tecnologia','Tecnología','Otro','⚙️','th-teal','Tecnología','M06','Tecnología e Ingeniería I y II',0,1,6,'','tecnologia'),
('tecnologia','Tecnología','Otro','⚙️','th-teal','Tecnología','M07','Programación y Robótica (cuando existe)',0,1,7,'','tecnologia'),
('tecnologia','Tecnología','Otro','⚙️','th-teal','Tecnología','M08','Informática (según la oferta autonómica)',0,1,8,'','tecnologia'),
('tecnologia','Tecnología','Otro','⚙️','th-teal','Tecnología','M09','Dibujo Técnico (en algunos institutos)',0,1,9,'','tecnologia');

-- Sanidad: dos ciclos formativos reales (Grado Medio y Grado Superior)

INSERT INTO ciclos (cicloId,cicloNombre,nivel,icon,th,desc,modCod,modNombre,modHoras,cicloOrden,modOrden,responsable,departamento) VALUES
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M01','Mantenimiento mecánico preventivo del vehículo',0,1,1,'','sanidad'),
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M02','Dotación sanitaria',0,1,2,'','sanidad'),
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M03','Atención sanitaria inicial en situaciones de emergencia',0,1,3,'','sanidad'),
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M04','Atención sanitaria especial en situaciones de emergencia',0,1,4,'','sanidad'),
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M05','Evacuación y traslado de pacientes',0,1,5,'','sanidad'),
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M06','Apoyo psicológico en situaciones de emergencia',0,1,6,'','sanidad'),
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M07','Planes de emergencias y dispositivos de riesgos previsibles',0,1,7,'','sanidad'),
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M08','Teleemergencias',0,1,8,'','sanidad'),
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M09','Anatomofisiología y patología básicas',0,1,9,'','sanidad'),
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M10','Digitalización aplicada al sistema productivo (1.º-TES)',0,1,10,'','sanidad'),
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M11','Sostenibilidad aplicada al sistema productivo (1.º-TES)',0,1,11,'','sanidad'),
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M12','Itinerario personal para la empleabilidad I (1.º-TES)',0,1,12,'','sanidad'),
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M13','Itinerario personal para la empleabilidad II (2.º-TES)',0,1,13,'','sanidad'),
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M14','Proyecto intermodular de Emergencias Sanitarias (2.º-TES)',0,1,14,'','sanidad'),
('tes','Técnico en Emergencias Sanitarias (TES)','CFGM','🚑','th-green','Grado Medio · Sanidad','M15','Fase de formación en empresa (2.º-TES)',0,1,15,'','sanidad'),

('tapc','Técnico Superior en Anatomía Patológica y Citodiagnóstico (TAPC)','CFGS','🔬','th-green','Grado Superior · Sanidad','M01','Gestión de muestras biológicas',0,2,1,'','sanidad'),
('tapc','Técnico Superior en Anatomía Patológica y Citodiagnóstico (TAPC)','CFGS','🔬','th-green','Grado Superior · Sanidad','M02','Técnicas generales de laboratorio',0,2,2,'','sanidad'),
('tapc','Técnico Superior en Anatomía Patológica y Citodiagnóstico (TAPC)','CFGS','🔬','th-green','Grado Superior · Sanidad','M03','Biología molecular y citogenética',0,2,3,'','sanidad'),
('tapc','Técnico Superior en Anatomía Patológica y Citodiagnóstico (TAPC)','CFGS','🔬','th-green','Grado Superior · Sanidad','M04','Fisiopatología general',0,2,4,'','sanidad'),
('tapc','Técnico Superior en Anatomía Patológica y Citodiagnóstico (TAPC)','CFGS','🔬','th-green','Grado Superior · Sanidad','M05','Necropsias',0,2,5,'','sanidad'),
('tapc','Técnico Superior en Anatomía Patológica y Citodiagnóstico (TAPC)','CFGS','🔬','th-green','Grado Superior · Sanidad','M06','Procesamiento citológico y tisular',0,2,6,'','sanidad'),
('tapc','Técnico Superior en Anatomía Patológica y Citodiagnóstico (TAPC)','CFGS','🔬','th-green','Grado Superior · Sanidad','M07','Citología ginecológica',0,2,7,'','sanidad'),
('tapc','Técnico Superior en Anatomía Patológica y Citodiagnóstico (TAPC)','CFGS','🔬','th-green','Grado Superior · Sanidad','M08','Citología general',0,2,8,'','sanidad'),
('tapc','Técnico Superior en Anatomía Patológica y Citodiagnóstico (TAPC)','CFGS','🔬','th-green','Grado Superior · Sanidad','M09','Digitalización aplicada al sistema productivo (1.º-TAPC)',0,2,9,'','sanidad'),
('tapc','Técnico Superior en Anatomía Patológica y Citodiagnóstico (TAPC)','CFGS','🔬','th-green','Grado Superior · Sanidad','M10','Sostenibilidad aplicada al sistema productivo (1.º-TAPC)',0,2,10,'','sanidad'),
('tapc','Técnico Superior en Anatomía Patológica y Citodiagnóstico (TAPC)','CFGS','🔬','th-green','Grado Superior · Sanidad','M11','Itinerario personal para la empleabilidad I (1.º-TAPC)',0,2,11,'','sanidad'),
('tapc','Técnico Superior en Anatomía Patológica y Citodiagnóstico (TAPC)','CFGS','🔬','th-green','Grado Superior · Sanidad','M12','Itinerario personal para la empleabilidad II (2.º-TAPC)',0,2,12,'','sanidad'),
('tapc','Técnico Superior en Anatomía Patológica y Citodiagnóstico (TAPC)','CFGS','🔬','th-green','Grado Superior · Sanidad','M13','Proyecto intermodular de Anatomía Patológica y Citodiagnóstico (2.º-TAPC)',0,2,13,'','sanidad'),
('tapc','Técnico Superior en Anatomía Patológica y Citodiagnóstico (TAPC)','CFGS','🔬','th-green','Grado Superior · Sanidad','M14','Fase de formación en empresa (2.º-TAPC)',0,2,14,'','sanidad');
