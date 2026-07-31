-- Marks whether an expired loan has already generated a reminder email to the
-- department head (functions/api/prestar.js, action notificarVencidos) — avoids
-- resending the same notice on each visit to the Loans page.
ALTER TABLE prestamos ADD COLUMN notificado_vencido INTEGER DEFAULT 0;
