import fs from 'node:fs';
import path from 'node:path';

export interface EnvLoadOptions {
  preferBundledAppEnv?: boolean;
  requiredKeys?: string[];
}

export interface EnvLoadResult {
  loadedPaths: string[];
  resolvedPath: string | null;
  missingKeys: string[];
}

export function getEnvValue(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

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
    if (getEnvValue(key) === undefined) {
      process.env[key] = stripWrappingQuotes(rawValue);
    }
  }

  return true;
}

function getCandidateEnvPaths(preferBundledAppEnv: boolean): string[] {
  const repoCandidates: string[] = [];
  const bundledCandidates: string[] = [];

  if (process.cwd()) {
    repoCandidates.push(path.resolve(process.cwd(), '.env'));
  }

  if (process.resourcesPath) {
    bundledCandidates.push(path.join(process.resourcesPath, 'app.env'));
    bundledCandidates.push(path.join(process.resourcesPath, '.env'));
  }

  const ordered = preferBundledAppEnv
    ? [...bundledCandidates, ...repoCandidates]
    : [...repoCandidates, ...bundledCandidates];

  return [...new Set(ordered)];
}

export function loadDotEnvFromKnownLocations(options: EnvLoadOptions = {}): EnvLoadResult {
  const requiredKeys = options.requiredKeys ?? [];
  const loadedPaths: string[] = [];
  const candidates = getCandidateEnvPaths(Boolean(options.preferBundledAppEnv));

  for (const candidate of candidates) {
    if (!loadDotEnvFile(candidate)) {
      continue;
    }

    loadedPaths.push(candidate);
    const missingKeys = requiredKeys.filter((key) => getEnvValue(key) === undefined);
    if (missingKeys.length === 0) {
      return {
        loadedPaths,
        resolvedPath: candidate,
        missingKeys
      };
    }
  }

  return {
    loadedPaths,
    resolvedPath: loadedPaths.at(-1) ?? null,
    missingKeys: requiredKeys.filter((key) => getEnvValue(key) === undefined)
  };
}
