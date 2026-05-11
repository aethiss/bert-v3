import { BrowserWindow, app, shell } from 'electron';
import type { UpdaterPhase, UpdaterState } from '../../shared/types/ipc/updater';
import { getEnvValue } from './envService';

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UPDATER_STATE_CHANGED_CHANNEL = 'updater:stateChanged';

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function normalizeVersion(version: string): string {
  const trimmed = version.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.toLowerCase().startsWith('v') ? trimmed : `v${trimmed}`;
}

function extractVersionFromMessage(message: string): string | null {
  const match = message.match(/v?\d+(?:\.\d+)+/i);
  return match?.[0] ?? null;
}

function resolveApiBase(): string {
  const apiBase = getEnvValue('RENDERER_VITE_API_URL') ?? getEnvValue('VITE_API_URL');
  if (!apiBase) {
    throw new Error('Missing API base URL. Set RENDERER_VITE_API_URL or VITE_API_URL.');
  }

  return apiBase;
}

function resolveCheckVersionUrl(clientVersion: string): string {
  const apiBase = resolveApiBase();
  const endpointPath =
    getEnvValue('RENDERER_VITE_CHECK_BERT_VERSION_PATH') ??
    getEnvValue('VITE_CHECK_BERT_VERSION_PATH') ??
    '/api/v1/check-bert-version/';

  const url = new URL(endpointPath, apiBase);
  url.searchParams.set('version', normalizeVersion(clientVersion));
  return url.toString();
}

function resolveLatestVersionUrl(): string {
  const apiBase = resolveApiBase();
  const endpointPath =
    getEnvValue('RENDERER_VITE_LAST_BERT_VERSION_PATH') ??
    getEnvValue('VITE_LAST_BERT_VERSION_PATH') ??
    '/api/v1/last-bert-version/';

  return new URL(endpointPath, apiBase).toString();
}

export interface UpdateService {
  start(): void;
  dispose(): void;
  getState(): Promise<UpdaterState>;
  checkForUpdates(jwt: string): Promise<UpdaterState>;
  downloadUpdate(jwt: string): Promise<UpdaterState>;
  installUpdate(): Promise<void>;
  onStateChanged(listener: (state: UpdaterState) => void): () => void;
}

export interface UpdateServiceOptions {
  getPendingDistributionCount: () => Promise<number>;
}

export function createUpdateService(options: UpdateServiceOptions): UpdateService {
  const listeners = new Set<(state: UpdaterState) => void>();
  const currentVersion = app.getVersion();

  let phase: UpdaterPhase = 'idle';
  let availableVersion: string | null = null;
  let downloadedVersion: string | null = null;
  let lastCheckedAt: string | null = null;
  let lastError: string | null = null;
  let releaseNotes: string | null = null;
  let pendingDistributionCount = 0;
  let started = false;
  let checkTimer: NodeJS.Timeout | null = null;

  function broadcast(state: UpdaterState): void {
    for (const listener of listeners) {
      listener(state);
    }

    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(UPDATER_STATE_CHANGED_CHANNEL, state);
      }
    }
  }

  async function refreshPendingDistributionCount(): Promise<number> {
    try {
      pendingDistributionCount = await options.getPendingDistributionCount();
    } catch (error) {
      console.warn('[updater] Unable to refresh pending distribution count', error);
      pendingDistributionCount = 0;
    }

    return pendingDistributionCount;
  }

  async function buildState(): Promise<UpdaterState> {
    await refreshPendingDistributionCount();

    return {
      phase,
      isSupported: true,
      disableReason: null,
      currentVersion,
      availableVersion,
      downloadedVersion,
      releaseName: null,
      releaseDate: null,
      releaseNotes,
      lastCheckedAt,
      downloadPercent: null,
      bytesPerSecond: null,
      transferredBytes: null,
      totalBytes: null,
      pendingDistributionCount,
      lastError,
      canCheck: phase !== 'checking' && phase !== 'downloading' && phase !== 'installing',
      canDownload: phase === 'available',
      canInstall: false
    };
  }

  async function publishState(): Promise<UpdaterState> {
    const state = await buildState();
    broadcast(state);
    return state;
  }

  function start(): void {
    if (started) {
      return;
    }

    started = true;
    void publishState();

    checkTimer = setInterval(() => {
      void refreshPendingDistributionCount()
        .then(() => publishState())
        .catch((error) => {
          console.warn('[updater] Silent state refresh failed', error);
        });
    }, UPDATE_CHECK_INTERVAL_MS);
  }

  function dispose(): void {
    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
    }
  }

  async function getState(): Promise<UpdaterState> {
    return buildState();
  }

  async function checkForUpdates(jwt: string): Promise<UpdaterState> {
    const token = jwt.trim();
    if (!token) {
      throw new Error('Missing JWT token for version check.');
    }

    phase = 'checking';
    lastCheckedAt = new Date().toISOString();
    lastError = null;
    await publishState();

    try {
      const url = resolveCheckVersionUrl(currentVersion);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json'
        }
      });

      const rawBody = await response.text();
      if (!response.ok) {
        throw new Error(`Version check failed (${response.status} ${response.statusText}). ${rawBody.slice(0, 200)}`);
      }

      let payload: { message?: string };
      try {
        payload = JSON.parse(rawBody) as { message?: string };
      } catch {
        throw new Error('Version check returned an invalid JSON response.');
      }

      const message = (payload.message ?? '').trim();
      releaseNotes = message || null;

      if (message.toLowerCase() === 'you are using the last version') {
        phase = 'idle';
        availableVersion = null;
        downloadedVersion = null;
      } else {
        phase = 'available';
        availableVersion = extractVersionFromMessage(message);
        downloadedVersion = null;
      }

      return publishState();
    } catch (error) {
      phase = 'error';
      lastError = formatError(error);
      await publishState();
      throw error;
    }
  }

  async function downloadUpdate(jwt: string): Promise<UpdaterState> {
    const token = jwt.trim();
    if (!token) {
      throw new Error('Missing JWT token for latest version download.');
    }

    if (phase !== 'available') {
      throw new Error('No update is available to download right now.');
    }

    phase = 'downloading';
    lastError = null;
    await publishState();

    try {
      const url = resolveLatestVersionUrl();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json'
        }
      });

      const rawBody = await response.text();
      if (!response.ok) {
        throw new Error(`Latest version request failed (${response.status} ${response.statusText}). ${rawBody.slice(0, 200)}`);
      }

      let payload: { download_url?: string };
      try {
        payload = JSON.parse(rawBody) as { download_url?: string };
      } catch {
        throw new Error('Latest version API returned an invalid JSON response.');
      }

      const downloadUrl = payload.download_url?.trim();
      if (!downloadUrl) {
        throw new Error('Latest version API returned an empty download_url.');
      }

      await shell.openExternal(downloadUrl);
      phase = 'downloaded';
      downloadedVersion = availableVersion;
      return publishState();
    } catch (error) {
      phase = 'available';
      lastError = formatError(error);
      await publishState();
      throw error;
    }
  }

  async function installUpdate(): Promise<void> {
    throw new Error('Automatic install is disabled. Download and run the installer manually.');
  }

  function onStateChanged(listener: (state: UpdaterState) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    start,
    dispose,
    getState,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    onStateChanged
  };
}
