# Migrazioni DB in scenario Blue/Green

`db/init.sql` viene eseguito da Postgres **solo la prima volta** che il volume
`pg_data` è vuoto (meccanismo `docker-entrypoint-initdb.d`). Su un database già
popolato, le migrazioni successive vanno applicate manualmente/da pipeline,
**non** aggiungendole a `init.sql`.

Pattern seguito: **Expand → Migrate → Contract**.

| Fase | Cosa succede | File |
|---|---|---|
| 1. Expand | Si aggiunge lo schema nuovo in forma **additiva e nullable/con default**, mentre `blue` serve ancora il 100% del traffico. `blue` continua a funzionare senza modifiche perché ignora semplicemente la colonna nuova. | `001_add_priorita_clinica.sql` |
| 2. Migrate | Si accende `backend-green` (che scrive/legge il nuovo campo), lo si testa in parallelo a `blue` tramite lo switch del Gateway (vedi Task 2/3), eventualmente con rollback istantaneo se qualcosa non va. | — (switch Gateway) |
| 3. Contract | Solo dopo aver deciso di non tornare più a `blue` (e averlo spento), si fa il backfill dei dati storici e si stringono i vincoli (`NOT NULL`, rimozione default, eventuale drop di colonne deprecate). | `002_enforce_priorita_clinica_NOT_RUN_YET.sql` |

## Come applicare la migrazione 001 a caldo (zero downtime)

```bash
docker exec -i sio-postgres psql -U sio_user -d sio_db \
  < db/migrations/001_add_priorita_clinica.sql
```

`ADD COLUMN ... DEFAULT NULL` su Postgres è un'operazione di solo metadata:
non riscrive la tabella e non prende lock lunghi, quindi è sicura da eseguire
mentre `blue` sta ancora rispondendo al traffico in produzione.

## Regola generale da rispettare finché blue e green coesistono

- ✅ Aggiungere colonne/tabelle nuove, nullable o con `DEFAULT`.
- ✅ Aggiungere nuovi valori a un `ENUM` (in coda, mai rinominare quelli esistenti).
- ❌ Rinominare o eliminare colonne/tabelle che `blue` usa ancora.
- ❌ Aggiungere vincoli `NOT NULL` senza `DEFAULT` su colonne esistenti.
- ❌ Cambiare il tipo di una colonna esistente in modo non retro-compatibile.

Qualunque modifica non retro-compatibile va scomposta in più migrazioni
additive, distribuite nel tempo, con il "contract" finale eseguito solo a
`blue` ormai spento.