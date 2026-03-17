# BeRT Release Checklist

## Prerequisites
1. Open a terminal in the repository root.
2. Update `main`:
   ```bash
   git checkout main
   git pull
   ```
3. Use Node `24.x` (project requirement):
   ```bash
   node -v
   ```
   It must return `v24.*`.
4. Install dependencies:
   ```bash
   npm ci
   ```

## Build On macOS (run on a Mac)
1. Run:
   ```bash
   npm run dist:mac
   ```
2. Check generated artifacts in `release/` (`.dmg` and `.zip`).
3. Install from the `.dmg` and launch the app.

## Build On Windows 11 (run on Windows)
1. Run (if dependencies are not installed yet on that machine):
   ```bash
   npm ci
   ```
2. Run:
   ```bash
   npm run dist:win
   ```
3. Check generated artifact in `release/` (NSIS setup `.exe`).
4. Install from the setup file and launch the app.

## Minimal Smoke Test
1. Verify the app starts and the icon is correct.
2. Verify login works.
3. Verify language switch EN/AR and persistence after restart.
4. Verify the basic distribution/print flow.
5. If there is an issue, share:
   - screenshot
   - terminal output of the `dist:*` command
