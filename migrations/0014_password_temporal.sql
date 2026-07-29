ALTER TABLE usuarios ADD COLUMN password_temporal INTEGER DEFAULT 0;

UPDATE usuarios SET password_temporal=1 WHERE usuario LIKE 'departamento%' OR usuario LIKE 'profe1%';
