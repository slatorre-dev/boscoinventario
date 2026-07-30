-- La migración 0004_google_oauth.sql asumía que google_id, auth_method y
-- created_at ya existían en usuarios (cierto en el proyecto original,
-- inventarioelecfp) y solo añadía session_token. Esta base D1 (boscoinventario)
-- se sembró desde cero y nunca tuvo esas 3 columnas, así que login-google.js
-- fallaba con "no such column: google_id" al crear/consultar usuarios de Google.

ALTER TABLE usuarios ADD COLUMN google_id TEXT DEFAULT NULL;
ALTER TABLE usuarios ADD COLUMN auth_method TEXT DEFAULT NULL;
ALTER TABLE usuarios ADD COLUMN created_at TEXT DEFAULT NULL;
