Leggi agents/README.md, agents/requirements.md, agents/design-rules.md e agents/ARCHITECTURE.md.

Obiettivo:
prepara la base del progetto produzione partendo dalla versione test esistente.
Il progetto dovra' essere scalabile, con una struttura cartelle chiara e coerente, e mantenere la logica business esistente.
Ogni task la faremo assieme, in un branch dedicato, e una volta completato faremo merge su main.
Per ogni nuova feature, io forniro' anche il codice di partenza che ho usato nella versione di test, e tu dovrai adattarlo alla nuova struttura, mantenendo la logica business esistente, oppure migliorarla se necessario.

Cosa fara' questa applicazione:
- Applicazione desktop per la gestione di un sistema di distribuzione assistenza (BERT).
- Modalità SERVER e CLIENT.
- Interfaccia per assegnare distribuzioni, cercare membri, configurare connessioni server, e visualizzare report.
- Server HTTP integrato per operazioni backend e sincronizzazione.

Vincoli:
- mantieni il progetto buildabile
- usa naming coerente e componenti riusabili
- separa UI, hooks, services e types

Task:
- crea una applicazione Electron con Vite e React, usando TypeScript
- crea la struttura cartelle del progetto produzione seguendo le best practice per scalabilita' e manutenibilita'

Criteri di accettazione:
- il progetto compila
- la struttura e' pronta per scalare
- nessun file inutile
- i test di typecheck passano