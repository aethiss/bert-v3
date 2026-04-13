import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const sourceEnvPath = path.join(projectRoot, '.env');
const outputDirectory = path.join(projectRoot, 'build', 'runtime');
const outputEnvPath = path.join(outputDirectory, 'app.env');

const RUNTIME_ENV_KEYS = [
  'MAIN_VITE_CIAM_URL',
  'MAIN_VITE_DEV_MODE',
  'OIDC_JWT_URL',
  'RENDERER_VITE_API_URL',
  'RENDERER_VITE_ELIGIBLE_MEMBERS_PATH',
  'RENDERER_VITE_DEV_MODE',
  'RENDERER_VITE_ENVIROMENT',
  'VITE_API_URL'
];

function stripWrappingQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return new Map();
  }

  const values = new Map();
  const content = fs.readFileSync(filePath, 'utf-8');
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
    const rawValue = trimmed.slice(separatorIndex + 1);
    if (!key) {
      continue;
    }

    values.set(key, stripWrappingQuotes(rawValue));
  }

  return values;
}

function quoteValue(value) {
  return JSON.stringify(value);
}

const envValues = parseDotEnvFile(sourceEnvPath);
for (const key of RUNTIME_ENV_KEYS) {
  const processValue = process.env[key];
  if (typeof processValue === 'string' && processValue.trim()) {
    envValues.set(key, processValue.trim());
  }
}

const lines = [];
for (const key of RUNTIME_ENV_KEYS) {
  const value = envValues.get(key);
  if (typeof value === 'string' && value.trim()) {
    lines.push(`${key}=${quoteValue(value)}`);
  }
}

if (lines.length === 0) {
  console.warn('[prepare-runtime-env] No runtime environment values found. Skipping app.env generation.');
  if (fs.existsSync(outputEnvPath)) {
    fs.rmSync(outputEnvPath, { force: true });
  }
  process.exit(0);
}

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(outputEnvPath, `${lines.join('\n')}\n`, 'utf-8');
console.info(`[prepare-runtime-env] Generated ${path.relative(projectRoot, outputEnvPath)}`);
