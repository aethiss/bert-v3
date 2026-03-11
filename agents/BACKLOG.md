# BERT v3 Backlog

## Done
- [x] Bootstrap progetto produzione con Electron + Vite + React + TypeScript.
- [x] Separazione struttura iniziale: `main`, `preload`, `renderer`, `shared`.
- [x] Layer renderer iniziali: `ui`, `hooks`, `services`, `types`, `pages`.
- [x] Config TypeScript separata (`main`, `preload`, `renderer`) con `typecheck` dedicato.
- [x] Setup Node 24 (`.nvmrc` + `engines` in `package.json`).

## Next
- [ ] Definire bootstrap di configurazione primo avvio (scelta modalita SERVER/CLIENT).
- [ ] Definire modulo autenticazione e sessione utente.
- [ ] Progettare storage locale SQLite (schema iniziale + migration strategy).
- [ ] Introdurre i18n (EN/AR) con supporto RTL.
- [ ] Definire contratto API locale per sync e operazioni distribuzione.
- [ ] Strutturare design system UI allineato a Figma (base + componenti riusabili).

## Notes
- Ogni feature va sviluppata su branch dedicato e mergiata in `main` a completamento.
- Mantenere sempre progetto buildabile e `typecheck` verde.
