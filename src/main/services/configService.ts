import type { Database } from 'sqlite';
import type { AppMode } from '../../shared/types/appMode';
import type { RuntimeConfig } from '../types/config';

export const DEFAULT_CONFIG: RuntimeConfig = {
  mode: 'CLIENT',
  apiPort: 4860
};

const CONFIG_KEY_MODE = 'app.mode';
const CONFIG_KEY_API_PORT = 'server.apiPort';

export interface RuntimeConfigService {
  loadRuntimeConfig(): Promise<RuntimeConfig>;
  getApplicationMode(): Promise<AppMode | null>;
  setApplicationMode(mode: AppMode): Promise<AppMode>;
  getConfigValue(key: string): Promise<string | null>;
  setConfigValue(key: string, value: string): Promise<void>;
}

export function createRuntimeConfigService(db: Database): RuntimeConfigService {
  async function getConfigValue(key: string): Promise<string | null> {
    const result = await db.get<{ value: string }>(
      'SELECT value FROM config WHERE key = ?',
      key
    );

    return result?.value ?? null;
  }

  async function setConfigValue(key: string, value: string): Promise<void> {
    await db.run(
      `
      INSERT INTO config(key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
      `,
      key,
      value
    );
  }

  async function ensureDefaultConfig(): Promise<void> {
    const apiPort = await getConfigValue(CONFIG_KEY_API_PORT);

    if (!apiPort) {
      await setConfigValue(CONFIG_KEY_API_PORT, String(DEFAULT_CONFIG.apiPort));
    }
  }

  async function getApplicationMode(): Promise<AppMode | null> {
    const rawMode = await getConfigValue(CONFIG_KEY_MODE);
    if (rawMode === 'SERVER' || rawMode === 'CLIENT') {
      return rawMode;
    }

    return null;
  }

  async function setApplicationMode(mode: AppMode): Promise<AppMode> {
    const existingMode = await getApplicationMode();
    if (existingMode) {
      throw new Error('Application mode is already configured and cannot be changed.');
    }

    await setConfigValue(CONFIG_KEY_MODE, mode);
    return mode;
  }

  async function loadRuntimeConfig(): Promise<RuntimeConfig> {
    await ensureDefaultConfig();

    const rawMode = await getApplicationMode();
    const rawPort = await getConfigValue(CONFIG_KEY_API_PORT);

    const mode = rawMode ?? DEFAULT_CONFIG.mode;
    const parsedPort = Number.parseInt(rawPort ?? '', 10);
    const apiPort = Number.isInteger(parsedPort) ? parsedPort : DEFAULT_CONFIG.apiPort;

    return { mode, apiPort };
  }

  return {
    loadRuntimeConfig,
    getApplicationMode,
    setApplicationMode,
    getConfigValue,
    setConfigValue
  };
}
