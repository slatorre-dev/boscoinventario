-- Asigna un departamento "propio" a cada superadmin (no les quita la
-- visión global: isSuperAdmin() sigue viendo todo; esto solo les da un
-- departamento base para badge, y para poder usar Gestionar
-- aulas/categorías/ciclos sin ambigüedad, ver functions/api/config.js).
UPDATE usuarios SET departamento='iesjuanbosco' WHERE usuario='Admin';
UPDATE usuarios SET departamento='electricidadelectronica' WHERE usuario='Seba';
UPDATE usuarios SET departamento='tecnologia' WHERE usuario='jillescas';
