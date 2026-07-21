-- =============================================================================
-- Migrazione 002 (CONTRAZIONE) — NON eseguire finché "blue" è ancora attivo
-- o anche solo raggiungibile/re-instradabile con un rollback.
--
-- Da lanciare solo quando:
--   1. backend-green serve il 100% del traffico da un periodo di
--      osservazione sufficiente (es. giorni/settimane a seconda del rischio),
--   2. si è deciso di NON voler più fare rollback a blue,
--   3. backend-blue è stato spento/rimosso dal docker-compose.yml,
--   4. tutte le righe storiche sono state eventualmente "backfillate".
--
-- Da questo momento in poi il campo diventa parte integrante e obbligatoria
-- dello schema, e solo allora è sicuro stringere il vincolo.
-- =============================================================================

-- 1. Backfill delle righe storiche rimaste NULL (valore neutro/di default
--    concordato col dominio clinico, es. priorità "non calcolata" = 0)
UPDATE sio.admissions
SET priorita_clinica = 0
WHERE priorita_clinica IS NULL;

-- 2. Solo ora si può stringere il vincolo, perché nessun writer (blue) che
--    ignora il campo è più in gioco
ALTER TABLE sio.admissions
    ALTER COLUMN priorita_clinica SET NOT NULL;

ALTER TABLE sio.admissions
    ALTER COLUMN priorita_clinica DROP DEFAULT;