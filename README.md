# Task 2 — Il "Cambio di Binario" delle API (Blue/Green Backend)
 
## 1. Modifiche applicate
 
### `docker-compose.yml`
Il servizio `backend` è stato duplicato in due servizi indipendenti che condividono
la stessa immagine/Dockerfile ma girano come container separati:
 
- `backend-blue` → container `sio-backend-blue`
- `backend-green` → container `sio-backend-green`
Entrambi:
- si connettono allo **stesso** `db`;
- restano sulla `backend-net` (nessuna porta pubblicata sull'host);
- ricevono una variabile `BACKEND_INSTANCE` (`blue` / `green`) usata solo a scopo
  diagnostico, per poter verificare *quale* istanza sta effettivamente rispondendo.
- possono essere costruiti da versioni diverse del codice tramite le variabili
  `BLUE_VERSION` / `GREEN_VERSION` (stesso pattern già usato per i frontend con
  `PROD_VERSION`/`TEST_VERSION`/`SVI_VERSION`), così da poter avere `backend-green`
  con un tag immagine diverso da `backend-blue` senza duplicare il Dockerfile.
### `backend/services/health.js`
Aggiunto il campo `instance` alla risposta di `/health`, valorizzato da
`BACKEND_INSTANCE`:
 
```json
{
  "status": "success",
  "data": { "service": "UP", "instance": "blue", "database": "CONNECTED", "uptime": 123.4 }
}
```
 
Serve esclusivamente a rendere visibile "chi risponde" durante i test di switch/
rollback — non è un requisito del cliente ma rende la dimostrazione verificabile.
 
### `gateway/default.conf`
Le tre `location /api/` (PROD/TEST/SVI) puntavano tutte a `http://sio-backend:3000`,
cioè al vecchio nome del servizio unico. Invece di modificare tre righe indipendenti
(e rischiare di dimenticarne una), ho introdotto un **upstream nginx unico**,
`sio-backend-api`, referenziato da tutti e tre gli ambienti:
 
```nginx
upstream sio-backend-api {
    server sio-backend-blue:3000;   # <-- versione LIVE attuale (BLUE)
    # server sio-backend-green:3000;
}
...
location /api/ {
    rewrite ^/api/(.*)$ /$1 break;
    proxy_pass http://sio-backend-api;
}
```
 
Questa è la richiesta del cliente: un solo punto di configurazione
che decide quale motore riceve il traffico, per tutti e tre gli ambienti
contemporaneamente.
 
## 2. Procedura di switch BLUE → GREEN
 
```bash
# 1. Build & avvio di entrambe le istanze backend (già presenti nel compose)
docker compose up -d --build backend-blue backend-green
 
# 2. Verifica che green sia sano PRIMA di spostare traffico
docker exec sio-gateway wget -qO- http://sio-backend-green:3000/health
# -> {"status":"success","data":{"service":"UP","instance":"green", ...}}
 
# 3. Edit gateway/default.conf: commenta la riga "blue", decommenta "green"
#    upstream sio-backend-api {
#        # server sio-backend-blue:3000;
#        server sio-backend-green:3000;
#    }
 
# 4. Reload "a caldo" del gateway, SENZA riavviarlo/spegnerlo
docker exec sio-gateway nginx -s reload
 
# 5. Conferma che il traffico ora arriva a green
curl http://localhost/api/health
# -> "instance": "green"
```
 
Il passo 4 è la chiave del task: `nginx -s reload` ricarica la configurazione senza
chiudere le connessioni esistenti né fermare il processo master → **zero downtime**
percepito dal frontend, che continua a chiamare `/api/...` sullo stesso gateway,
stessa porta, senza sapere nulla del cambio.
 
## 3. Procedura di rollback (GREEN → BLUE)
 
Esattamente speculare, ed è la parte che il cliente sottolinea come critica
("dovete poter tornare al motore vecchio in un istante"):
 
```bash
# 1. Ripristina la riga "blue" nell'upstream, commenta "green"
# 2. Reload a caldo
docker exec sio-gateway nginx -s reload
# 3. Conferma
curl http://localhost/api/health   # -> "instance": "blue"
```
 
Tempo di rollback: il tempo di un reload nginx, tipicamente sotto il secondo, e non
richiede riavviare né il gateway né alcun frontend. `backend-green` resta comunque
acceso e raggiungibile internamente per essere ispezionato/debuggato (log, `docker
exec`) senza fretta, dato che non riceve più traffico reale.
 
## 4. Riflessione: cosa succede ai dati scritti da GREEN in caso di rollback?
 
**Il dato rimane.** Il rollback qui agisce solo sul livello di **routing HTTP** (quale
processo backend riceve le richieste), non sul livello dati. Entrambi i backend
condividono lo stesso `db` e lo stesso schema — non c'è alcuna replica o database
separato per `green`. Quindi:
 
- Se `backend-green` esegue una `INSERT`/`UPDATE` (es. registra un nuovo accesso in
  pronto soccorso) e subito dopo si fa rollback a `blue`, quella riga **resta nel
  database** esattamente come se l'avesse scritta `blue`. `blue` la vedrà e la potrà
  leggere/modificare normalmente, perché opera sulle stesse tabelle.
- Questo è **corretto e voluto** per un rollback "di routing puro" come questo: se il
  bug in `green` è, ad esempio, un errore nel calcolo di un campo UI o in una
  validazione lato codice, i dati scritti prima di accorgersi del problema restano
  validi (non è detto siano "sbagliati": dipende dalla natura del bug).
- **Rischio reale**: se il bug in `green` riguarda proprio la logica di scrittura (es.
  un campo salvato nel formato sbagliato, una migrazione di schema mancante, un
  constraint non rispettato), il rollback del *routing* non annulla quelle scritture
  "sporche" già presenti nel DB. Il rollback qui protegge la disponibilità del
  servizio, non la consistenza dei dati già scritti da green.
- Per questo, in un contesto reale (specialmente sanitario, dove l'integrità del dato
  è critica quanto la disponibilità) uno schema blue/green "puro" a DB condiviso va
  usato solo quando le modifiche di `green` sono **backward-compatible** con lo schema
  esistente e non introducono side-effect distruttivi. Se `green` porta con sé
  modifiche di schema (nuove colonne obbligatorie, migrazioni, cambio di formato),
  serve una strategia più prudente: migrazioni sempre *additive e retro-compatibili*
  (mai rimuovere/rinominare colonne che blue usa ancora), oppure — per modifiche non
  compatibili — un vero e proprio "dual write" temporaneo o una feature flag lato
  applicativo, non solo uno switch di routing al Gateway.
## 5. Osservazioni critiche e possibili evoluzioni
 
- **Switch manuale via file + reload.** Funziona bene per una dimostrazione controllata,
  ma è un'operazione manuale, soggetta a errore umano (dimenticare di commentare una
  riga, editare l'ambiente sbagliato). In un'infrastruttura più matura questo passaggio
  andrebbe automatizzato: uno script/pipeline CI che genera il `default.conf` a partire
  da una variabile (`ACTIVE_BACKEND=blue|green`) invece di un edit manuale del file,
  o — meglio ancora — un **Ingress Controller come Traefik**, che supporta
  weighted round-robin tra due servizi (per un canary graduale, es. 10% → 50% → 100%
  su green) invece di uno switch netto 0%/100% come quello attuale con nginx statico.
- **Nessun health-check automatico pre-switch.** Qui la verifica che `green` sia sano
  prima dello switch (`/health`) è manuale. Un orchestratore come **Kubernetes**, con
  un `Service` che seleziona i pod via `label` (`version: blue` / `version: green`) e
  readiness probe, sposterebbe il traffico automaticamente solo verso pod già pronti,
  e un semplice `kubectl patch` sul selector del Service otterrebbe lo stesso identico
  effetto di switch istantaneo ottenuto qui con l'upstream nginx, ma con più garanzie
  (nessun traffico instradato verso un'istanza non ancora pronta).
- **PROD/TEST/SVI condividono lo stesso upstream.** Con la modifica attuale, spostare
  l'upstream su `green` sposta il traffico API per *tutti e tre* gli ambienti insieme.
  Nella pratica, ha più senso testare `green` prima su TEST/SVI e solo dopo, a fronte
  di esito positivo, promuoverlo su PROD: questo richiederebbe upstream distinti per
  ambiente (es. `sio-backend-api-test`, `sio-backend-api-prod`), a scapito di un po' di
  duplicazione ma con isolamento del rischio più corretto — un classico esempio di
  come una feature flag dinamica per-ambiente sarebbe più sicura di un'unica variabile
  di routing globale.