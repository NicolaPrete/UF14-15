# Task 4 — Il Tunnel per il Database
 
## 1. Perché serve un blocco diverso da `server{}` sulla 80
 
Le `location`/`server{}` già presenti in `gateway/conf.d/default.conf` vivono nel
contesto **`http {}`** di nginx: sanno interpretare richieste HTTP (verbo, header,
path) e instradarle in base a quello. Il protocollo con cui parla Postgres sulla
5432 non è HTTP: è un protocollo binario proprio (handshake, query in formato wire,
ecc.). Nginx non lo "capisce" e non deve capirlo — deve solo fare da tubo TCP grezzo
tra client e `db:5432`. Per questo serve il modulo **`stream`** (Livello 4 - TCP/UDP),
un contesto di primo livello **sorella** di `http {}`, non annidabile al suo interno.
 
Ho verificato che `nginx:alpine` include il modulo stream **compilato staticamente**
nel core (non serve `load_module`, a differenza di alcuni moduli dinamici come
`ngx_stream_geoip_module`): il blocco `stream {}` funziona quindi "out of the box"
sull'immagine ufficiale usata dal progetto.
 
## 2. Modifiche applicate
 
Il file `conf.d/default.conf` esistente **non poteva ospitare il blocco `stream`**
(è incluso dentro `http {}` tramite `include /etc/nginx/conf.d/*.conf;` nel
`nginx.conf` di default dell'immagine). Ho quindi:
 
1. Creato `gateway/nginx.conf`, che sostituisce il `nginx.conf` principale
   dell'immagine: mantiene invariato il blocco `http {}` (stesso comportamento di
   prima, stesso `include conf.d/*.conf`) e aggiunge, a fianco, un nuovo blocco
   `stream {}` con la regola richiesta:
```nginx
   stream {
       log_format  db_tunnel  '$remote_addr [$time_local] '
                               'bytes_in=$bytes_received bytes_out=$bytes_sent '
                               'session_time=$session_time status=$status';
       access_log  /var/log/nginx/db_tunnel_access.log  db_tunnel;
       error_log   /var/log/nginx/db_tunnel_error.log;
 
       server {
           listen 5432;
           proxy_pass db:5432;
           proxy_timeout 10m;
           proxy_connect_timeout 5s;
       }
   }
```
 
   Ho aggiunto un `log_format` dedicato (`db_tunnel`) perché il cliente chiede
   esplicitamente che il traffico sia **"mediato e registrato"**: i log HTTP di
   default non si applicano al contesto stream, serve una direttiva di logging
   propria — qui traccio IP sorgente, byte scambiati e durata sessione per ogni
   connessione al DB.
2. Spostato `default.conf` dentro `gateway/conf.d/default.conf` (prima era diretto in
   `gateway/`), perché ora **due file diversi** vanno montati su due path diversi del
   container: `gateway/nginx.conf` → `/etc/nginx/nginx.conf`, e la cartella
   `gateway/conf.d/` → `/etc/nginx/conf.d/`. Se avessi lasciato tutto nella stessa
   cartella e montato l'intera `./gateway` su `conf.d/`, il nuovo `nginx.conf`
   sarebbe finito *anche* dentro `conf.d/nginx.conf` e sarebbe stato incluso una
   seconda volta dentro `http {}` — un errore di configurazione che avrebbe impedito
   l'avvio di nginx (contesto `stream`/`events` non validi dentro `http`).
3. In `docker-compose.yml`, sul servizio `gateway`:
   - aggiunta `"5432:5432"` alla lista `ports` (**unico** cambiamento di esposizione
     porte in tutto il progetto: resta vero che è l'unico container a pubblicare
     porte);
   - i due volumi separati (`nginx.conf` e `conf.d/`);
   - `db` aggiunto a `depends_on`, dato che ora il Gateway media anche verso di lui
     direttamente (oltre che indirettamente tramite i backend).
   Il servizio `db` **non ha ricevuto alcuna modifica**: continua a non avere alcuna
   sezione `ports`, come richiesto dal vincolo di sicurezza.
 
## 3. Come collegare DBeaver/TablePlus
 
Nel client SQL, come host si usa l'indirizzo/hostname della macchina dove gira il
Gateway (es. `localhost` in locale), porta `5432`, credenziali normali del DB
(`sio_user` / `sio_password` / database `sio_db`). Nessuna configurazione diversa da
un collegamento diretto al DB — è proprio l'obiettivo del task: il Gateway è
"invisibile" dal punto di vista del protocollo.
 
Verifica da riga di comando (serve un client `psql` sull'host, non nel container):
 
```bash
psql -h localhost -p 5432 -U sio_user -d sio_db -c "SELECT 1;"
```
 
Verifica che il traffico sia davvero mediato e loggato dal Gateway:
 
```bash
docker exec sio-gateway tail -f /var/log/nginx/db_tunnel_access.log
```
 
Ogni connessione (anche un semplice `telnet localhost 5432` o un tentativo fallito)
deve comparire lì con IP sorgente, byte trasferiti e durata.
 
## 4. "Spegnere una regola sul Gateway senza riavviare il DB"
 
Come richiesto dalla nota del cliente, chiudere l'accesso non tocca mai `db`:
 
```bash
# In gateway/nginx.conf: commentare il blocco "server { listen 5432; ... }"
# dentro stream{}, oppure rimuovere solo la entry "5432:5432" da ports: nel
# compose e ricreare il solo gateway.
docker exec sio-gateway nginx -s reload   # se si è modificato solo nginx.conf
```
 
Nota tecnica importante: a differenza del blocco `http{}`, che permette di attivare/
disattivare **singole location** con un reload trasparente, per il blocco `stream{}`
un `listen 5432` non può essere rimosso "a metà" senza reload — ma il reload stesso
resta comunque non distruttivo per le connessioni HTTP già in corso su 80/8080/8999,
quindi l'operazione resta a basso impatto. Se invece si vuole *anche* smettere di
pubblicare la porta sull'host (rimuovere `5432:5432` da `ports:`), quello richiede
necessariamente di ricreare il container gateway (`docker compose up -d gateway`),
che in quel caso è accettabile perché è un cambio di postura di sicurezza volontario
e pianificato, non un rilascio applicativo quotidiano.
 
## 5. Considerazione critica: questo tunnel è davvero sicuro?
 
Va detto chiaramente, perché il compito chiede di non limitarsi a "funziona quindi va
bene": **un tunnel TCP grezzo come questo espone di fatto lo stesso identico
protocollo Postgres all'esterno di prima**, solo passando attraverso il Gateway anziché
direttamente dal container `db`. Da un attaccante esterno che punti alla porta 5432
del Gateway, la superficie d'attacco (bruteforce di credenziali, exploit noti del
wire protocol Postgres, ecc.) è la stessa che avrebbe con `ports: ["5432:5432"]` sul
`db` — nginx qui non aggiunge crittografia, autenticazione, né ispezione del
protocollo: è letteralmente un "passacarte", come richiesto dal task, ma questo
implica anche che non offre protezione aggiuntiva reale oltre alla centralizzazione
del logging e a un unico punto dove poter spegnere l'accesso.
 
Cosa aggiungerei in un contesto reale (oltre lo scope stretto del task):
 
- **Allowlist IP a livello di `stream{}`**: nginx supporta `allow`/`deny` anche nel
  contesto stream. Andrebbe ristretto l'accesso alla 5432 solo agli IP/subnet noti
  del team Data Analysis, non a "chiunque raggiunga il Gateway":
```nginx
  server {
      listen 5432;
      allow 10.20.0.0/24;   # subnet ufficio Data Analysis
      deny  all;
      proxy_pass db:5432;
  }
```
- **TLS**: Postgres supporta connessioni cifrate (`sslmode=require`); il tunnel
  attuale lascia passare anche connessioni in chiaro. Andrebbe forzato SSL almeno
  lato `db` (`ssl = on` in `postgresql.conf`) o terminato con `proxy_ssl` lato nginx.
- **Meglio ancora: non esporre affatto il protocollo nativo del DB.** L'approccio più
  robusto per un caso d'uso di reportistica non è un tunnel diretto al motore
  transazionale di produzione, ma: un **utente Postgres dedicato e in sola lettura**
  (mai le credenziali applicative del backend) e, se possibile, una **replica
  read-only** separata dal DB primario — così un client BI mal configurato (query
  pesante, blocco di righe) non può impattare le performance/disponibilità del
  database che serve realmente i pazienti. In alternativa, un **bastion/SSH tunnel**
  con autenticazione a chiave e MFA offre un controllo di accesso molto più forte di
  un semplice `proxy_pass` TCP.
- Questi accorgimenti non sono stati implementati perché non richiesti esplicitamente
  dal task (che chiede il solo passacarte via `stream`), ma li segnalo perché,
  trattandosi di dati sanitari, andrebbero valutati seriamente prima di un utilizzo
  reale del tunnel oltre il contesto d'esame.