-- Las categorías creadas manualmente desde ⚙️ Gestionar categorías nacían
-- todas con el mismo icono 🏷️ por defecto (js/modal-cats.js:addCatRow),
-- confuso al ser idéntico al icono de tags/etiquetas en la misma pantalla
-- de Home. Asigna iconos representativos a las 4 categorías reales ya
-- creadas en producción (departamento música) usando el mismo mapeo
-- nombre→icono que ahora sugiere js/config.js:suggestCatIcon() al crear
-- categorías nuevas.
UPDATE categorias SET i='📽️' WHERE name='Audiovisual' AND departamento='musica';
UPDATE categorias SET i='💻' WHERE name='Informatica' AND departamento='musica';
UPDATE categorias SET i='📚' WHERE name='Material didáctico' AND departamento='musica';
UPDATE categorias SET i='🪑' WHERE name='Mobiliario' AND departamento='musica';
