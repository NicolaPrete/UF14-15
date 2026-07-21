# Task 3 — Zero-Downtime Backend & Database Migration
 
Questo task riusa l'infrastruttura del Task 2 (due container backend + switch al
Gateway) e la estende con il tema centrale: **cosa succede allo schema del database
quando `green` ha bisogno di una modifica che `blue` non conosce**.
 
## 1. Due container backend
 
Già soddisfatto dal Task 2: `sio-backend-blue` e `sio-backend-green`, stesso `db`,
stesso schema, nessuna porta pubblicata sull'host (vedi sezione Task 2 e Task 1 per
l'isolamento di rete).
 
## 2. Switch istantaneo del Gateway
 
Anche questo è già implementato nel Task 2 tramite l'`upstream sio-backend-api` in
`gateway/default.conf`, con switch via commento/decommento di una riga + `nginx -s
reload`.
 
Una nota di design importante, richiesta implicitamente dal "senza mai staccare la
spina" del cliente: ho **volutamente scelto `nginx -s reload` e non un
`docker compose restart gateway`**. Il Gateway è l'unico container che espone porte
verso l'host (Task 1): riavviarlo, anche per una manciata di secondi, causerebbe un
buco di connettività per *tutto* il traffico, compresi i frontend statici — non solo
per le API. Il `reload` invece fa ricaricare la configurazione al processo master di
nginx, che avvia nuovi worker con la config aggiornata e lascia terminare quelli
vecchi in modo graceful, senza mai chiudere il socket in ascolto sulla porta 80/8080/
8999. Un'alternativa "a variabile d'ambiente" (es. `ACTIVE_BACKEND=green` sostituita
via `envsubst` all'avvio del container, come già fa il frontend con `env.js`)
sembrerebbe più elegante, ma richiederebbe comunque di ricreare il container gateway
per rileggere la env var — motivo per cui ho preferito l'approccio a file + reload,
che è vero zero-downtime anche per il Gateway stesso.
 
## 3. Il dilemma del Database
 
È la parte nuova rispetto al Task 2. Ho creato `db/migrations/` con un caso concreto:
 
- **`001_add_priorita_clinica.sql`** — `backend-green` introduce un nuovo algoritmo
  di triage che calcola un punteggio di priorità clinica e lo vuole salvare su
  `admissions`. La migrazione aggiunge la colonna `priorita_clinica` **nullable, con
  `DEFAULT NULL`**, senza toccare nient'altro. Ho verificato nel codice
  (`backend/services/patients.js`) che le `INSERT` elencano esplicitamente le colonne
  (`INSERT INTO admissions (patient_id, braccialetto, stato, ...)`), quindi
  `backend-blue` continua a funzionare **senza alcuna modifica al proprio codice**:
  semplicemente non imposta e non conosce il nuovo campo, che per le sue righe resta
  `NULL`. Su Postgres ≥11 `ADD COLUMN ... DEFAULT NULL` è un'operazione di solo
  metadata (nessun riscrittura di tabella, nessun lock lungo), quindi applicabile a
  caldo mentre `blue` serve traffico reale.
- **`002_enforce_priorita_clinica_NOT_RUN_YET.sql`** — mostra la fase successiva
  ("contract"): backfill dei valori storici e solo *dopo* aver spento definitivamente
  `blue` si stringe il vincolo a `NOT NULL`. Il nome del file è deliberatamente
  esplicito ("NOT_RUN_YET") per marcare che non va eseguita nella stessa finestra
  operativa della 001.
- **`db/migrations/README.md`** — descrive il pattern generale
  **Expand → Migrate → Contract** e la regola pratica da seguire finché blue e green
  coesistono: si può sempre *aggiungere* (colonne, tabelle, valori enum in coda), mai
  *rinominare/restringere/eliminare* qualcosa che una delle due versioni usa ancora.
Rispondendo direttamente alla domanda del cliente ("se l'aggiornamento fallisce, i
dati devono restare integri"): con questo approccio un rollback del Gateway a `blue`
non "rompe" nulla a livello di schema, perché `blue` non ha mai smesso di essere
compatibile con la struttura del DB — la migrazione additiva non gli ha tolto né
richiesto nulla. Il rischio residuo (dati scritti da `green` prima di un rollback,
vedi riflessione nel Task 2) resta comunque presente e va gestito a livello applicativo,
non risolvibile dalla sola migrazione additiva.
 
## 4. Impatto sul Frontend e sessioni JWT
 
- **Il frontend NON deve essere ricaricato.** I frontend (`fe-prod`/`fe-test`/`fe-sio`)
  parlano sempre e solo con `http://<gateway>/api/...`: non conoscono l'esistenza di
  `blue`/`green`, l'URL non cambia. Lo switch è completamente trasparente lato
  browser: la prossima richiesta XHR/fetch dopo il reload del Gateway viene
  semplicemente instradata al nuovo backend, senza che l'utente se ne accorga né
  debba fare un refresh della pagina.
- **Le sessioni JWT restano valide *a patto che* `blue` e `green` condividano lo
  stesso `JWT_SECRET`** (già vero nella configurazione attuale: entrambi i servizi
  nel compose usano la stessa stringa). Un token emesso da `blue` viene verificato
  correttamente da `green` e viceversa, perché la verifica JWT è stateless (si basa
  sulla firma HMAC col secret, non su uno stato salvato lato server). Non c'è quindi
  bisogno di "migrare" le sessioni attive: continuano a funzionare invariate durante
  e dopo lo switch.
- **Rischio da non sottovalutare**: se `green` cambia la *struttura* del payload del
  token (nuovi claim obbligatori, algoritmo di firma diverso, secret ruotato) senza
  garantire retro-compatibilità, gli utenti già loggati su `blue` verrebbero
  disconnessi bruscamente al primo switch — un'esperienza peggiore di un semplice
  downtime pianificato, perché sembra un bug intermittente. La stessa logica
  "additiva" vista per il DB va applicata ai token: nuovi claim opzionali sì, secret o
  claim obbligatori esistenti rimossi/rinominati no, finché non si è sicuri che tutti
  gli utenti abbiano fatto un nuovo login (o si preveda un breve periodo in cui
  entrambi i formati di token sono accettati in validazione).
## 5. Orchestrazione Docker: nessun conflitto di porta
 
`backend-blue` e `backend-green` costruiscono dalla stessa immagine (`EXPOSE 3000`)
ma, come per `db`, **non pubblicano alcuna porta verso l'host** (`ports` è assente/
commentato). Questo evita per costruzione qualunque conflitto: se entrambi provassero
a fare il bind della 3000 sull'host si otterrebbe un errore all'avvio ("port is
already allocated"). Restando invece solo su `backend-net` con `container_name`
diversi, ciascuno riceve il proprio DNS interno univoco (`sio-backend-blue`,
`sio-backend-green`) e la propria porta 3000 "privata" nel proprio network
namespace — Docker non ha bisogno di negoziare nulla perché ogni container ha il
proprio stack di rete isolato. È esattamente lo stesso principio già applicato ai tre
frontend (`fe-prod`/`fe-test`/`fe-sio`), che condividono tutti la porta 80
internamente senza conflitti, per lo stesso motivo.