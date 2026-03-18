import fs from 'node:fs';
import path from 'node:path';

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadDotEnvFile(envPath: string): boolean {
  if (!fs.existsSync(envPath)) {
    return false;
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1);
    if (process.env[key] === undefined) {
      process.env[key] = stripWrappingQuotes(rawValue);
    }
  }

  return true;
}

export function loadDotEnvFromKnownLocations(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.join(process.resourcesPath, 'app.env'),
    path.join(process.resourcesPath, '.env')
  ];

  for (const candidate of candidates) {
    if (loadDotEnvFile(candidate)) {
      return candidate;
    }
  }

  return null;
}
