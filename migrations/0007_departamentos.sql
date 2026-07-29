CREATE TABLE IF NOT EXISTS departamentos (
  slug   TEXT PRIMARY KEY,
  nombre TEXT DEFAULT '',
  icono  TEXT DEFAULT '🏫',
  color  TEXT DEFAULT '#2563eb',
  orden  INTEGER DEFAULT 0
);

INSERT OR REPLACE INTO departamentos (slug,nombre,orden) VALUES
('artesplasticas','Artes Plásticas',1),
('cienciasnaturales','Ciencias Naturales',2),
('economia','Economía',3),
('educacionfisicadeportiva','Educación Física y Deportiva',4),
('filosofia','Filosofía',5),
('fisicaquimica','Física y Química',6),
('fol','Formación y Orientación Laboral',7),
('frances','Francés',8),
('geografiahistoria','Geografía e Historia',9),
('ingles','Inglés',10),
('latingriego','Latín y Griego',11),
('lenguacastellana','Lengua Castellana y Literatura',12),
('matematicas','Matemáticas',13),
('musica','Música',14),
('tecnologia','Tecnología',15),
('sanidad','Sanidad',16),
('actividadesfisicas','Actividades Físicas y Deportivas',17),
('administracion','Administración',18),
('comercio','Comercio',19),
('edificacionobracivil','Edificación y Obra Civil',20),
('electricidadelectronica','Electricidad y Electrónica',21),
('fabricacionmecanica','Fabricación Mecánica',22),
('imagenpersonal','Imagen Personal',23),
('informatica','Informática',24);

ALTER TABLE usuarios ADD COLUMN departamento TEXT DEFAULT '';
ALTER TABLE aulas ADD COLUMN departamento TEXT DEFAULT '';
ALTER TABLE inventario ADD COLUMN departamento TEXT DEFAULT '';

-- ciclos tenía PK (cicloId,modCod) global; dos departamentos distintos
-- pueden reutilizar el mismo código de ciclo/módulo, así que la PK pasa
-- a incluir departamento. Se añade también "responsable" (antes creada
-- ad-hoc por el código de la app) para no perderla al recrear la tabla.
CREATE TABLE ciclos_new (
  cicloId     TEXT,
  cicloNombre TEXT DEFAULT '',
  nivel       TEXT DEFAULT '',
  icon        TEXT DEFAULT '',
  th          TEXT DEFAULT '',
  desc        TEXT DEFAULT '',
  modCod      TEXT DEFAULT '',
  modNombre   TEXT DEFAULT '',
  modHoras    INTEGER DEFAULT 0,
  cicloOrden  INTEGER DEFAULT 0,
  modOrden    INTEGER DEFAULT 0,
  responsable TEXT DEFAULT '',
  departamento TEXT DEFAULT '',
  PRIMARY KEY (cicloId, modCod, departamento)
);
INSERT INTO ciclos_new (cicloId,cicloNombre,nivel,icon,th,desc,modCod,modNombre,modHoras,cicloOrden,modOrden,departamento)
  SELECT cicloId,cicloNombre,nivel,icon,th,desc,modCod,modNombre,modHoras,cicloOrden,modOrden,'' FROM ciclos;
DROP TABLE ciclos;
ALTER TABLE ciclos_new RENAME TO ciclos;

-- categorias tenía name como PK única global; con multi-departamento dos
-- departamentos distintos pueden querer el mismo nombre de categoría
-- (p.ej. "Herramientas"), así que la PK pasa a ser compuesta (name,departamento).
CREATE TABLE categorias_new (
  name        TEXT DEFAULT '',
  c           TEXT DEFAULT '',
  bg          TEXT DEFAULT '',
  i           TEXT DEFAULT '',
  orden       INTEGER DEFAULT 0,
  departamento TEXT DEFAULT '',
  PRIMARY KEY (name, departamento)
);
INSERT INTO categorias_new (name,c,bg,i,orden,departamento)
  SELECT name,c,bg,i,orden,'' FROM categorias;
DROP TABLE categorias;
ALTER TABLE categorias_new RENAME TO categorias;

UPDATE usuarios SET departamento = REPLACE(usuario,'departamento','') WHERE usuario LIKE 'departamento%';
UPDATE usuarios SET departamento = REPLACE(usuario,'profe1','') WHERE usuario LIKE 'profe1%';
