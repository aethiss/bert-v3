import type { Database } from 'sqlite';
import type { AppMode } from '../../shared/types/appMode';
import type { LocalServerSettings } from '../../shared/types/localServer';
import type { PrintSettings } from '../../shared/types/printConfig';
import type { RuntimeConfig } from '../types/config';

export const DEFAULT_CONFIG: RuntimeConfig = {
  mode: 'CLIENT',
  apiPort: 4860
};

const CONFIG_KEY_MODE = 'app.mode';
const CONFIG_KEY_API_PORT = 'server.apiPort';
const CONFIG_KEY_PRINT_FORMAT = 'print.defaultFormat';
const CONFIG_KEY_PRINT_DISABLED = 'print.disabled';
const CONFIG_KEY_SERVER_INTERFACE = 'server.interfaceName';
const CONFIG_KEY_SERVER_BIND_IP = 'server.bindIp';
const CONFIG_KEY_SERVER_OTP = 'server.oneTimePassword';
const DEFAULT_PRINT_FORMAT: PrintSettings['format'] = 'A5';
const DEFAULT_PRINT_DISABLED = false;
const DEFAULT_SERVER_INTERFACE = '';
const DEFAULT_SERVER_BIND_IP = '0.0.0.0';
const DEFAULT_SERVER_OTP = '';

export interface RuntimeConfigService {
  loadRuntimeConfig(): Promise<RuntimeConfig>;
  getApplicationMode(): Promise<AppMode | null>;
  setApplicationMode(mode: AppMode): Promise<AppMode>;
  getConfigValue(key: string): Promise<string | null>;
  setConfigValue(key: string, value: string): Promise<void>;
  getPrintSettings(): Promise<PrintSettings>;
  setPrintSettings(settings: PrintSettings): Promise<PrintSettings>;
  getLocalServerSettings(): Promise<LocalServerSettings>;
  setLocalServerSettings(settings: LocalServerSettings): Promise<LocalServerSettings>;
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
    const printFormat = await getConfigValue(CONFIG_KEY_PRINT_FORMAT);
    const printDisabled = await getConfigValue(CONFIG_KEY_PRINT_DISABLED);
    const serverInterface = await getConfigValue(CONFIG_KEY_SERVER_INTERFACE);
    const serverBindIp = await getConfigValue(CONFIG_KEY_SERVER_BIND_IP);
    const serverOtp = await getConfigValue(CONFIG_KEY_SERVER_OTP);

    if (!apiPort) {
      await setConfigValue(CONFIG_KEY_API_PORT, String(DEFAULT_CONFIG.apiPort));
    }
    if (!printFormat) {
      await setConfigValue(CONFIG_KEY_PRINT_FORMAT, DEFAULT_PRINT_FORMAT);
    }
    if (!printDisabled) {
      await setConfigValue(CONFIG_KEY_PRINT_DISABLED, String(DEFAULT_PRINT_DISABLED));
    }
    if (serverInterface === null) {
      await setConfigValue(CONFIG_KEY_SERVER_INTERFACE, DEFAULT_SERVER_INTERFACE);
    }
    if (!serverBindIp) {
      await setConfigValue(CONFIG_KEY_SERVER_BIND_IP, DEFAULT_SERVER_BIND_IP);
    }
    if (serverOtp === null) {
      await setConfigValue(CONFIG_KEY_SERVER_OTP, DEFAULT_SERVER_OTP);
    }
  }

  function toPrintFormat(raw: string | null): PrintSettings['format'] {
    if (raw === 'A5' || raw === '80mm' || raw === '58mm') {
      return raw;
    }
    return DEFAULT_PRINT_FORMAT;
  }

  function toPrintDisabled(raw: string | null): boolean {
    return raw === 'true';
  }

  async function getApplicationMode(): Promise<AppMode | null> {
    const rawMode = await getConfigValue(CONFIG_KEY_MODE);
    const normalizedMode = rawMode?.trim().toUpperCase();
    if (normalizedMode === 'SERVER' || normalizedMode === 'CLIENT') {
      return normalizedMode;
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

  async function getPrintSettings(): Promise<PrintSettings> {
    await ensureDefaultConfig();
    const rawFormat = await getConfigValue(CONFIG_KEY_PRINT_FORMAT);
    const rawDisabled = await getConfigValue(CONFIG_KEY_PRINT_DISABLED);

    return {
      format: toPrintFormat(rawFormat),
      disabled: toPrintDisabled(rawDisabled)
    };
  }

  async function setPrintSettings(settings: PrintSettings): Promise<PrintSettings> {
    const normalized: PrintSettings = {
      format: toPrintFormat(settings.format),
      disabled: Boolean(settings.disabled)
    };

    await setConfigValue(CONFIG_KEY_PRINT_FORMAT, normalized.format);
    await setConfigValue(CONFIG_KEY_PRINT_DISABLED, String(normalized.disabled));

    return normalized;
  }

  async function getLocalServerSettings(): Promise<LocalServerSettings> {
    await ensureDefaultConfig();
    const rawInterface = await getConfigValue(CONFIG_KEY_SERVER_INTERFACE);
    const rawBindIp = await getConfigValue(CONFIG_KEY_SERVER_BIND_IP);
    const rawPort = await getConfigValue(CONFIG_KEY_API_PORT);
    const rawOtp = await getConfigValue(CONFIG_KEY_SERVER_OTP);
    const parsedPort = Number.parseInt(rawPort ?? '', 10);

    return {
      interfaceName: rawInterface ?? DEFAULT_SERVER_INTERFACE,
      bindIp: rawBindIp ?? DEFAULT_SERVER_BIND_IP,
      port: Number.isInteger(parsedPort) ? parsedPort : DEFAULT_CONFIG.apiPort,
      oneTimePassword: rawOtp ?? DEFAULT_SERVER_OTP
    };
  }

  async function setLocalServerSettings(
    settings: LocalServerSettings
  ): Promise<LocalServerSettings> {
    const normalized: LocalServerSettings = {
      interfaceName: settings.interfaceName?.trim() ?? DEFAULT_SERVER_INTERFACE,
      bindIp: settings.bindIp?.trim() || DEFAULT_SERVER_BIND_IP,
      port: Number.isInteger(settings.port) ? settings.port : DEFAULT_CONFIG.apiPort,
      oneTimePassword: settings.oneTimePassword ?? DEFAULT_SERVER_OTP
    };

    await setConfigValue(CONFIG_KEY_SERVER_INTERFACE, normalized.interfaceName);
    await setConfigValue(CONFIG_KEY_SERVER_BIND_IP, normalized.bindIp);
    await setConfigValue(CONFIG_KEY_API_PORT, String(normalized.port));
    await setConfigValue(CONFIG_KEY_SERVER_OTP, normalized.oneTimePassword);

    return normalized;
  }

  return {
    loadRuntimeConfig,
    getApplicationMode,
    setApplicationMode,
    getConfigValue,
    setConfigValue,
    getPrintSettings,
    setPrintSettings,
    getLocalServerSettings,
    setLocalServerSettings
  };
}
