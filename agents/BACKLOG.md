# BERT v3 Backlog

## Done
- [x] Bootstrap progetto produzione con Electron + Vite + React + TypeScript.
- [x] Separazione struttura iniziale: `main`, `preload`, `renderer`, `shared`.
- [x] Layer renderer iniziali: `ui`, `hooks`, `services`, `types`, `pages`.
- [x] Config TypeScript separata (`main`, `preload`, `renderer`) con `typecheck` dedicato.
- [x] Setup Node 24 (`.nvmrc` + `engines` in `package.json`).
- [x] Configurazione SQLite locale con inizializzazione DB persistente e tabella `config`.
- [x] Finestra installer Windows-like per selezione modalità `SERVER/CLIENT` al primo avvio, persistita su SQLite e non modificabile dopo il salvataggio.
- [x] Miglioramenti DX: alias import non relativi (`@renderer`, `@shared`) e setup `ESLint` + `Prettier`.
- [x] Flusso di login CIAM implementato: apertura finestra web modale da Electron, intercettazione `key`/`refresh_token` da redirect e chiusura automatica della finestra.
- [x] Exchange del `key` verso endpoint `oidc/exchange_code` con salvataggio JWT per sessione corrente e preparazione `Authorization: Bearer` per le richieste successive via RTK Query.
- [x] Pagina Login riallineata al design Figma (`01-Login`) con layout split e componenti UI riutilizzabili in stile shadcn.
- [x] Implementazione design delle sezioni `SERVER` (Overview, Distribution, Configuration) con navigazione interna testabile e placeholder dedicati per sezioni senza mock finale (`Operations`, `Data`, `Configuration/Printer`, `Configuration/Log`).
- [x] Rifattorizzazione struttura renderer per modularità: componenti server/client separati, naming allineato alle route e separazione della logica di hash navigation in modulo dedicato.
- [x] Flusso auth esteso con persistenza utente offline: tabella SQLite `user`, bootstrap sessione da database al riavvio e skip login quando i dati utente sono già presenti.
- [x] Integrazione endpoint `userInfo` nel flusso login con salvataggio locale di `email`, `fdp`, `fieldOffice` e stato online/offline dinamico nella top navigation (`Login` da offline, `Logout` da online).
- [x] Correzione parsing `exchange_code`: estrazione robusta di `id_token` (JWT effettivo) e `refresh_token` da payload stringificato.
- [x] Sistema toast globale error-first in alto a destra (`sonner`/shadcn) collegato a errori RTK Query, catch applicativi e runtime errors (`error`, `unhandledrejection`).
