# Relazione Tecnica — Task 1: Isolamento Infrastrutturale e Protezione del Dato Sanitario

Progetto: HIS-AFP · Repository: `pietro2356/his-afp`

## 1. Situazione di partenza

Il `docker-compose.yml` originale definisce una singola rete "di default" (quella
creata implicitamente da Compose). Tutti i servizi — `db`, `backend`, `fe-prod`,
`fe-test`, `fe-sio`, `gateway` — condividono lo stesso spazio L2/L3 e possono
risolversi a vicenda via DNS interno.

Due criticità concrete:

- **`db` esponeva la porta 5432 sull'host** (`5432:5432`), quindi era raggiungibile
  anche da fuori Docker, non solo dagli altri container.
- **Rete piatta**: un frontend compromesso (es. `fe-prod`) poteva risolvere il nome
  `db` o `sio-postgres` e tentare una connessione diretta al database, saltando
  completamente backend e gateway.

## 2. Modifiche applicate

Ho modificato `docker-compose.yml`:

1. **Due reti bridge dedicate**, dichiarate esplicitamente:
   - `frontend-net`: contiene `fe-prod`, `fe-test`, `fe-sio` e il `gateway`.
   - `backend-net`: contiene `db`, `backend` e il `gateway`.
2. **Il `gateway` è l'unico servizio su entrambe le reti** → è l'unico "ponte" possibile
   tra le due zone, coerente col vincolo di sicurezza richiesto.
3. **Rimossa la pubblicazione della porta 5432** del database verso l'host: nessuna
   sezione `ports` sul servizio `db`. Resta risolvibile via DNS solo all'interno di
   `backend-net`.
4. **Hardening aggiuntivo**: `backend-net` è marcata `internal: true`. Questo impedisce
   a qualunque container su quella rete (compreso un eventuale `backend` compromesso)
   di raggiungere Internet o reti esterne — utile perché `backend` e `db` non hanno
   alcun bisogno di uscire in rete pubblica (ho verificato che le uniche chiamate HTTP
   in `backend/` sono verso l'endpoint Prometheus/metrics locale, nessuna dipendenza
   esterna a runtime).
5. **`gateway` dipende esplicitamente anche da `backend`** (`depends_on`), non solo
   dai frontend, dato che ora media anche le chiamate `/api/`.

Il resto della configurazione (porte del gateway 80/8080/8999, routing nginx per
PROD/TEST/SVI, variabili d'ambiente) resta invariato.

## 3. Come validare (comandi da eseguire dopo `docker compose up -d --build`)

```bash
# 1. Il DB non deve avere porte pubblicate sull'host
docker port sio-postgres
# -> nessun output = 5432 NON è raggiungibile da fuori Docker

# 2. Da fe-prod il nome "db" / "sio-postgres" NON deve risolvere
docker exec sio-fe-prod getent hosts db
docker exec sio-fe-prod getent hosts sio-postgres
# -> entrambi devono fallire (exit code != 0, nessun IP restituito)

docker exec sio-fe-prod ping -c1 -W1 db
# -> "bad address 'db'" o "Name or service not known"

# 3. Controprova positiva: dal backend il DB DEVE risolvere (stessa rete)
docker exec sio-backend getent hosts db
# -> restituisce l'IP del container db

# 4. Verifica che il gateway sia l'unico container con porte pubblicate
docker compose ps
# -> solo "sio-gateway" mostra colonna PORTS non vuota (80, 8080, 8999)

# 5. I test funzionali/Postman vanno ora puntati al Gateway, non ai container:
#    baseURL = http://localhost/api        (ambiente PROD)
#    baseURL = http://localhost:8080/api   (ambiente TEST)
#    baseURL = http://localhost:8999/api   (ambiente SVI)
```

`fe-prod` non ha nemmeno un client Postgres installato nell'immagine nginx:alpine,
quindi il fallimento è garantito sia a livello applicativo (nessun tool) sia — punto
verificato sopra — a livello di rete/DNS, che è il livello richiesto dal vincolo di
sicurezza ("il Database deve risultare inesistente").

## 4. Osservazioni critiche sull'architettura attuale

Segnalo alcuni limiti che, a mio avviso, andrebbero affrontati in un'evoluzione del
progetto, oltre al perimetro stretto di questo task:

- **Segreti in chiaro nel compose file.** `POSTGRES_PASSWORD` e `JWT_SECRET` sono
  hard-coded nel `docker-compose.yml` e finiscono quindi in Git. Per un sistema che
  tratta dati sanitari questo è un problema serio a prescindere dalla rete: andrebbero
  spostati in un `.env` escluso da Git (o meglio in un secret manager: Docker Secrets,
  Vault, AWS/Azure Key Vault) prima di qualsiasi audit di sicurezza reale.
- **Gateway nginx statico e "a config file".** Instradamento tra i tre ambienti fatto
  con tre blocchi `server{}` fissi su tre porte diverse (80/8080/8999). Funziona per un
  contesto didattico/dimostrativo, ma non scala: ogni nuovo ambiente o servizio richiede
  di editare a mano il file e riavviare il gateway. Un **Ingress Controller dedicato
  (es. Traefik)** userebbe invece *service discovery* automatico via label sui
  container/Deployment, TLS automatico (Let's Encrypt), e routing per hostname invece
  che per porta — più vicino a uno standard "un solo ingresso HTTPS pubblico" piuttosto
  che tre porte diverse esposte per tre ambienti.
- **Tre ambienti (prod/test/sio) sullo stesso host Docker Compose.** Va bene per la
  demo, ma nella realtà prod e non-prod non dovrebbero mai condividere lo stesso host
  fisico/VM né la stessa rete backend, per limitare il "blast radius" di un incidente
  in test. Con **Kubernetes** (o anche solo più stack Compose separati) si potrebbero
  avere namespace/cluster distinti per prod e non-prod, con policy di rete (
  `NetworkPolicy`) che formalizzano lo stesso principio di segregazione applicato qui
  a livello di Compose, ma in modo dichiarativo e verificabile in CI.
- **`AUTH_ENABLED` iniettata come variabile d'ambiente statica al boot.** Per attivare/
  disattivare l'autenticazione oggi serve ricreare il container. Un sistema di
  **feature flag dinamici** (es. Unleash, LaunchDarkly, o anche solo un endpoint
  `/config` interrogato a runtime con caching breve) permetterebbe di attivare/
  disattivare funzionalità o forzare l'autenticazione in produzione senza downtime,
  e soprattutto senza il rischio — presente oggi — che l'ambiente PROD parta per
  errore con `AUTH_ENABLED=false`.
- **Nessun TLS end-to-end.** Il gateway espone HTTP in chiaro sulle porte 80/8080/8999.
  Per dati sanitari reali servirebbe HTTPS obbligatorio (anche solo terminato sul
  gateway, con certificati validi) e possibilmente mTLS tra gateway e backend.
- **`restart: always` senza healthcheck.** Nessun servizio definisce `healthcheck`:
  Docker riavvia un container "morto" ma non uno che risponde 500 in loop. Aggiungere
  healthcheck su `backend` e `db` renderebbe `depends_on` effettivamente affidabile
  (con `condition: service_healthy`) invece che un semplice ordine di avvio.