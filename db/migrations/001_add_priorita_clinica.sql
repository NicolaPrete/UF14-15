-- =============================================================================
-- Migrazione 001 (ADDITIVA) — richiesta da backend-green
--
-- Scenario: la nuova versione del backend (green) introduce un algoritmo di
-- triage che calcola un punteggio numerico di priorità clinica e vuole
-- persisterlo sulla tabella "admissions". La versione blue, ancora in
-- produzione e ricevente traffico reale, NON conosce questo campo.
--
-- Regola seguita: aggiungere, mai rinominare/rimuovere/restringere.
--   - Colonna nuova, NULLABLE, con DEFAULT NULL -> nessun impatto sulle
--     INSERT/UPDATE già presenti nel codice di blue (che elenca le colonne
--     esplicitamente, non usa mai "INSERT INTO admissions VALUES (...)" con
--     posizione implicita).
--   - Nessun vincolo NOT NULL in questa fase: se lo fosse, ogni INSERT
--     eseguita da blue (che non imposta questo campo) fallirebbe.
--   - ADD COLUMN ... DEFAULT NULL su Postgres >= 11 è un'operazione di sola
--     metadata (non riscrive la tabella, non richiede un lock lungo) quindi
--     è sicura da eseguire mentre il sistema è live e serve traffico.
-- =============================================================================

ALTER TABLE sio.admissions
    ADD COLUMN IF NOT EXISTS priorita_clinica INTEGER DEFAULT NULL;

COMMENT ON COLUMN sio.admissions.priorita_clinica IS
    'Punteggio di priorità clinica calcolato dal nuovo algoritmo di triage (backend-green). '
    'NULL = riga scritta da una versione del backend che non conosce ancora questo campo (blue), '
    'o riga storica precedente alla migrazione.';

-- Nessun backfill in questa fase: le righe esistenti restano con
-- priorita_clinica = NULL. Il backfill (se necessario) va fatto in modo
-- asincrono/batch dopo che green è stabile, MAI in modo bloccante durante
-- questa migrazione.