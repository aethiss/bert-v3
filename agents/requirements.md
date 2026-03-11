# Mission
Bert v2 (versione 2) e' la nuova versione del sistema di distribuzione assistenza (BERT) che stiamo sviluppando.
Questa versione e' stata progettata per essere piu' scalabile, manutenibile e facile da estendere rispetto alla versione precedente.
L'applicazione si occupa di fornire un'interfaccia per la gestione di un sistema di distribuzione assistenza, con funzionalita' sia in modalita' SERVER che CLIENT.
Gli utenti, durante il primo run dell'applicazione, dopo averla installata, possono scegliere se configurare l'applicazione in modalita' SERVER o CLIENT, e in base alla scelta, l'applicazione si adattera' per fornire le funzionalita' appropriate.
Gli utenti possono loggarsi nell'applicazione, e quindi "sincronizzare" i dati facendo richiesta tramite delle API sviluppate, ed ottenere la lista dei cicli (cycles) al momento disponibili, con tutti i membri delle famiglie eligibili per ottenre un aiuto (distribution).
Una volta sincronizzati i dati, l'applicazione dovra' salvare questi dati localmente, in modo che siano disponibili anche offline.
L'utente potra ricercare i membri (members) delle famiglie, visualizzare i dettagli di ogni membro, e assegnare distribuzioni (distributions) a questi membri.
Se l'applicazione e' stata configurata in modalita' SERVER, dovra' anche fornire un'interfaccia per configurare le connessioni server, e visualizzare report (reports) sulle distribuzioni assegnate.
L'applicazione avra' un server HTTP integrato che gestira' le operazioni e la sincronizzazione dei dati con il backend, e permettera' di esporre delle API per la comunicazione tra client e server.
Se l'applicazione e' in modalita' CLIENT, dovra' comunicare (di solito in una rete locale) con il server tramite queste API per ottenere i dati necessari e sincronizzare le modifiche.
Dopo ogni assegnazione di una distribuzione, l'applicazione dovra' salvare localmente i dati aggiornati, e se e' in modalita' CLIENT, e permettere la stampa di una ricevuta (receipt) per ogni distribuzione assegnata, che includa i dettagli del membro, la distribuzione assegnata.

# Sviluppo
Per lo sviluppo di Bert v2, utilizzeremo Electron con Vite e React, usando TypeScript per garantire una buona esperienza di sviluppo e una base solida per il progetto.
La struttura del progetto sara' organizzata in modo da separare chiaramente le diverse responsabilita, con cartelle dedicate per componenti UI, hooks, servizi e tipi.
Seguiremo le best practice per la scalabilita' e manutenibilita' del codice, assicurandoci di mantenere una logica business chiara e coerente, e di evitare la duplicazione del codice.
Durante lo sviluppo, lavoreremo in branch dedicati per ogni task, e una volta completato ogni task, faremo merge su main.
Inoltre, ci assicureremo che il progetto sia sempre buildabile, e che i test di typecheck passino, per garantire la stabilita' del progetto durante lo sviluppo.
I Dati salvati localmente saranno gestiti in modo efficiente, e l'applicazione dovra' essere in grado di funzionare anche offline, sincronizzando i dati con il server quando la connessione e' disponibile. L'idea e' di usare sqlite per la gestione dei dati localmente, e di esporre delle API RESTful per la comunicazione tra client e server.
I Passi che faremo assieme sono definiti nel file TASKS.md, e ogni task sara' accompagnato da criteri di accettazione chiari per garantire che ogni funzionalita' sia implementata correttamente e in linea con gli obiettivi del progetto.
