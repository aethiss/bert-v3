import { readdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });

for (const entry of readdirSync('.')) {
  if (entry.endsWith('.tsbuildinfo')) {
    rmSync(entry, { force: true });
  }
}
