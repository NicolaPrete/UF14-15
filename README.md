# HIS-AFP — Sistema di Gestione Pronto Soccorso

Applicazione web per la gestione del triage e dell'accesso al Pronto Soccorso: dall'accettazione del paziente, alla
gestione del personale, fino al monitoraggio delle dimissioni.

Progetto sviluppato nell'ambito delle Unità Formative **UF14 (Architettura Applicativa)** e **UF15 (Sviluppo
Frontend)** del corso di Alta Formazione Professionale dell'istituto G. Marconi di Rovereto.

## Stack tecnologico

| Livello       | Tecnologia                                  |
|---------------|----------------------------------------------|
| Frontend      | Angular 21 (standalone, signal-based), TypeScript, PrimeNG, Tailwind CSS |
| Backend       | Node.js, Express                              |
| Database      | PostgreSQL                                    |
| Reverse proxy | NGINX (gateway unico verso frontend e backend)|
| Container     | Docker, Docker Compose                        |

> Tutto il codice frontend è scritto in TypeScript con tipizzazione esplicita: ogni entità di dominio (paziente,
> operatore, criteri di ricerca, ecc.) è modellata tramite interfacce/tipi personalizzati dedicati (cartella
> `core/*/*.model.ts`), senza l'uso della keyword `any`.

## Funzionalità principali

### Accettazione e anagrafica pazienti
- Ricerca del paziente per Codice Fiscale, oppure per Nome, Cognome e Data di Nascita, **prima** di ogni nuova
  accettazione (evita duplicati anagrafici)
- Se il paziente è già in anagrafica, il form di accettazione si apre precompilato con i dati storici (bloccati);
  l'operatore inserisce solo i dati sanitari del nuovo accesso
- Se il paziente è nuovo, la scheda anagrafica si compila da zero
- Elenco pazienti in carico e dettaglio/modifica singolo paziente (dati di residenza)

### Gestione del personale
- Anagrafica completa dello staff (Medici, Infermieri, Amministrativi)
- Creazione di nuovi operatori (username, password, ruolo) e modifica del ruolo di quelli esistenti
- Attivazione/disattivazione di un operatore
- Controllo di disponibilità dello username **in tempo reale**, mentre si digita, prima del salvataggio

### Monitor Dimessi (ultime 24h)
- Dashboard di sola consultazione per il coordinatore di reparto
- Mostra i pazienti dimessi (stato `DIM`) nelle ultime 24 ore: braccialetto, dati paziente, orario di ingresso e di
  dimissione
- Tabella ordinabile per orario di dimissione

### Altro
- Stato dei servizi (health check in tempo reale di backend/database)

## Struttura del progetto

```
UF14-15/
├── backend/                     # API REST (Node.js + Express)
│   ├── services/
│   │   ├── auth.js              # Autenticazione/autorizzazione
│   │   ├── patients.js          # Pazienti: accettazione, ricerca, dimissioni
│   │   ├── staff.js             # Gestione personale
│   │   ├── resources.js         # Patologie, modalità di arrivo, codici colore
│   │   ├── health.js            # Health check
│   │   └── ...
│   └── server.js
│
├── his-afp/                     # Frontend Angular
│   └── src/app/
│       ├── core/                # Servizi di business logic (signal-based)
│       │   ├── Pazienti/        # PatientManager: accettazione, ricerca, dimessi
│       │   ├── Staff/           # StaffManager: anagrafica operatori
│       │   ├── Risorse/         # GestioneRisorse: dati di riferimento (patologie, ecc.)
│       │   └── SystemStatus/    # Stato dei servizi
│       │
│       ├── features/            # Pagine applicative (una per rotta)
│       │   ├── accettazione-pz/ # Ricerca + Accettazione paziente
│       │   │   ├── ricerca-pz/           # Componente di ricerca (CF / anagrafica)
│       │   │   └── form-accettazione-pz/ # Componente form (precompilabile)
│       │   ├── gestione-personale/       # Anagrafica staff
│       │   ├── dimessi-24h/              # Monitor Dimessi
│       │   ├── lista-pz/                 # Elenco pazienti in carico
│       │   ├── modifica-pz/              # Dettaglio/modifica paziente
│       │   └── stato-servizi/            # Stato dei servizi
│       │
│       ├── pattern/              # Componenti riusabili (es. tabella pazienti)
│       └── ui/                   # Componenti di layout (header, ecc.)
│
├── db/
│   └── init.sql                 # Schema e dati di esempio
│
├── gateway/
│   └── default.conf             # Configurazione NGINX (reverse proxy)
│
├── docs/
│   ├── API.md                   # Documentazione delle API
│   └── DATABASE.md              # Struttura del database
│
├── postman/                     # Collection Postman per testare le API
└── docker-compose.yml
```

## Avvio dell'applicazione

**Requisiti:** Docker e Docker Compose.

```bash
docker-compose up -d --build
```

L'applicazione è raggiungibile tramite il gateway NGINX su una delle seguenti porte (servono tutte lo stesso identico
build del frontend, cambia solo un'etichetta ambiente mostrata in testata):

| Porta | Ambiente |
|-------|----------|
| 80    | PROD     |
| 8080  | TEST     |
| 8999  | SVI      |

Per fermare i servizi:

```bash
docker-compose down
```

Per ripartire da un ambiente pulito (rimuove anche i volumi, es. il database):

```bash
docker-compose down -v
```

Per ricompilare un singolo servizio (es. dopo una modifica al backend):

```bash
docker-compose up -d --build --no-deps backend
```

> **Nota tecnica:** il frontend chiama il backend tramite path relativi (`/api/...`), instradati dal gateway NGINX
> verso il backend sulla rete Docker interna. Non è quindi necessario esporre la porta del backend (3000) sull'host:
> l'app funziona correttamente accedendo solo tramite le porte del gateway sopra elencate, anche in ambienti come
> GitHub Codespaces.

## Sviluppo locale del frontend (senza rebuild dell'immagine Docker)

```bash
cd his-afp
npm install
npx ng serve
```

Il proxy di sviluppo (`proxy.conf.json`) inoltra le chiamate `/api/**` al gateway in ascolto su `http://localhost`
(porta 80). Prima di lanciare `ng serve`, avvia quindi almeno database, backend e gateway:

```bash
docker-compose up -d db backend gateway
```

(non serve avviare `fe-prod`/`fe-test`/`fe-sio`: con `ng serve` il frontend statico containerizzato non serve, il
proxy punta direttamente al gateway)

## Test

```bash
cd his-afp
npx ng test --watch=false
```

## Accessi diretti (per debug/sviluppo)

- **Database PostgreSQL:** `localhost:5432` (user: `sio_user`, password: `sio_password`, database: `sio_db`)

## Documentazione e API testing

- Documentazione API: [docs/API.md](docs/API.md)
- Struttura del database: [docs/DATABASE.md](docs/DATABASE.md)
- Collection Postman per testare le API: cartella `postman/collections` (suddivise per capitoli, coerenti con
  `docs/API.md`)

## Licenza

Questo progetto è concesso in licenza sotto la Licenza MIT — vedere il file [LICENSE](LICENSE) per i dettagli.