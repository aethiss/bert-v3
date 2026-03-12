- [X] Setup progetto repository GitHub
- [X] Installazione dipendenze e configurazione base di Electron, Vite, React e TypeScript
- [X] Creazione struttura cartelle per componenti UI, hooks, services e types
- [X] Configurazione build e script per avviare l'applicazione in modalità sviluppo
- [X] Configurare sqlite per la gestione dei dati localmente
- [X] Creare una finestra che emuli un installer di Windows, che permetta di scegliere tra modalità SERVER e CLIENT, e che salvi questa scelta nel database locale (questa scelta non puo' essere cambiata dopo, quindi deve essere chiara all'utente)
- [X] Creare una pagina di login, che permetta agli utenti di loggarsi nell'applicazione, e che salvi le credenziali in modo sicuro (vogliamo usare rtkQuery per gestire le richieste al server, quindi possiamo usare la cache di rtkQuery per salvare le credenziali in modo sicuro, e usarle per autenticare le richieste al server)
- [X] Creare tutte le sezioni dell'applicazione per la versione SERVER, seguendo dettagliatamente con la maggiore fedeltà possibile ai valori Figma (spaziature/font/size al pixel) - Le sezioni saranno SOLO DESIGN, al momento nessuna logica che involve le API. Assicurarsi che i componenti siano riutilizzabili e ben strutturati, e che seguano le best practice per la scrittura del codice. La logica della lista members/cycles sarà implementata in un secondo momento, dopo aver completato il design delle sezioni principali dell'applicazione.
- [X] Creare gli endpoint API riguardanti la gestione dei membri e dei cicli, con la stessa logica che abbiamo implementato nella POC, ma adattata alla nuova struttura del progetto. Assicurarsi che gli endpoint siano ben strutturati e seguano le best practice per la scrittura del codice, e che siano testati con test di unità e di integrazione.
- [X] Testare il funzionamento e la ricerca dei membri e dei cicli quando l'applicazione e' offline, e cioe' leggendo i dati dal database locale.
- [ ] Implementare la logica di distribuzione verso i membri delle famiglie, salvare i dati nel database locale.
- [ ] Implementare la logica di sincronizzazione dei dati tra il database locale e il server, assicurandosi che i dati vengano sincronizzati correttamente quando l'applicazione torna online.

TODO: I Prossimi task saranno definiti in base alla progressione dello sviluppo, e saranno aggiunti a questa lista.

OGNI TASK SARA' SVILUPPATO IN UN BRANCH DEDICATO. FARO' LA REVIEW DEL CODICE E PROVVEDERO' A DARE TUTTE LE INFORMAZIONI NECESSARIE, PARTENDO DAL CODICE DELLA POC (PROVA DI CONCETTO) CHE HO SVILUPPATO, E CHE DOVRAI ADATTARE ALLA NUOVA STRUTTURA DEL PROGETTO. MI ASPETTO CHE USI TUTTE LE BEST PRACTICE PER LA SCRITTURA DEL CODICE, CHE MANTENGA LA LOGICA BUSINESS ESISTENTE, E CHE SE NECESSARIO, LA MIGLIORI. OGNI TASK AVRA' CRITERI DI ACCETTAZIONE CHIARI, E DOVRA' PASSARE I TEST DI TYPECHECK PRIMA DI ESSERE MERGIATO SU MAIN.
