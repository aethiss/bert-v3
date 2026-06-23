import { BrowserWindow, app, shell } from 'electron';
import type { UpdaterPhase, UpdaterState } from '../../shared/types/ipc/updater';
import { getEnvValue } from './envService';
import type { AppLogService } from './logService';

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

function areVersionsEquivalent(firstVersion: string | null, secondVersion: string | null): boolean {
  if (!firstVersion || !secondVersion) {
    return false;
  }

  return normalizeVersion(firstVersion) === normalizeVersion(secondVersion);
}

function parseVersionParts(version: string): number[] | null {
  const normalized = normalizeVersion(version).slice(1);
  const parts = normalized.split('.').map((part) => Number.parseInt(part, 10));

  if (parts.length === 0 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    return null;
  }

  return parts;
}

function compareVersions(firstVersion: string, secondVersion: string): number {
  const firstParts = parseVersionParts(firstVersion);
  const secondParts = parseVersionParts(secondVersion);

  if (!firstParts || !secondParts) {
    return 0;
  }

  const maxLength = Math.max(firstParts.length, secondParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const firstPart = firstParts[index] ?? 0;
    const secondPart = secondParts[index] ?? 0;
    if (firstPart > secondPart) {
      return 1;
    }
    if (firstPart < secondPart) {
      return -1;
    }
  }

  return 0;
}

function extractVersionsFromMessage(message: string): string[] {
  const matches = message.match(/v?\d+(?:\.\d+)+/gi) ?? [];
  return [...new Set(matches)];
}

function resolveAvailableVersion(message: string, currentVersion: string): string | null {
  const versions = extractVersionsFromMessage(message);
  let candidate: string | null = null;

  for (const version of versions) {
    if (compareVersions(version, currentVersion) <= 0) {
      continue;
    }

    if (!candidate || compareVersions(version, candidate) > 0) {
      candidate = version;
    }
  }

  return candidate;
}

function markLoggedError(error: Error): Error {
  Object.defineProperty(error, '__logged', {
    value: true,
    configurable: true
  });
  return error;
}

function isLoggedError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && '__logged' in error;
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
  logService: AppLogService;
}

export function createUpdateService(options: UpdateServiceOptions): UpdateService {
  const listeners = new Set<(state: UpdaterState) => void>();
  const currentVersion = app.getVersion();
  const { logService } = options;

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

  async function fetchJsonWithNetworkLogging(params: {
    scope: string;
    url: string;
    token: string;
    failureMessage: string;
  }): Promise<string> {
    const startedAt = Date.now();
    try {
      const response = await fetch(params.url, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${params.token}`,
          accept: 'application/json'
        }
      });

      const rawBody = await response.text();
      const durationMs = Date.now() - startedAt;

      if (!response.ok) {
        await logService.logNetwork({
          scope: params.scope,
          method: 'GET',
          url: params.url,
          ok: false,
          status: response.status,
          statusText: response.statusText,
          durationMs,
          responseBodyPreview: rawBody.slice(0, 500),
          errorMessage: params.failureMessage
        });
        throw markLoggedError(
          new Error(`${params.failureMessage} (${response.status} ${response.statusText}). ${rawBody.slice(0, 200)}`)
        );
      }

      await logService.logNetwork({
        scope: params.scope,
        method: 'GET',
        url: params.url,
        ok: true,
        status: response.status,
        durationMs
      });

      return rawBody;
    } catch (error) {
      if (!isLoggedError(error)) {
        await logService.logError(params.scope, error);
      }
      throw error;
    }
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
      const rawBody = await fetchJsonWithNetworkLogging({
        scope: 'updater:checkForUpdates',
        url,
        token,
        failureMessage: 'Version check failed'
      });

      let payload: { message?: string };
      try {
        payload = JSON.parse(rawBody) as { message?: string };
      } catch {
        await logService.logError('updater:checkForUpdates', 'Version check returned an invalid JSON response.', {
          bodyPreview: rawBody.slice(0, 500),
          url
        });
        throw markLoggedError(new Error('Version check returned an invalid JSON response.'));
      }

      const message = (payload.message ?? '').trim();
      releaseNotes = message || null;
      const extractedVersion = resolveAvailableVersion(message, currentVersion);
      const fallbackVersion = extractVersionsFromMessage(message)[0] ?? null;
      const hasMatchingVersion = areVersionsEquivalent(extractedVersion ?? fallbackVersion, currentVersion);

      await logService.logInfo('updater:checkForUpdates', 'Version check payload parsed', {
        currentVersion,
        message,
        extractedVersion,
        fallbackVersion,
        hasMatchingVersion,
        availableVersionCandidate: extractedVersion ?? fallbackVersion,
        extractedVersions: extractVersionsFromMessage(message)
      });

      if (message.toLowerCase() === 'you are using the last version' || hasMatchingVersion) {
        phase = 'idle';
        availableVersion = fallbackVersion;
        downloadedVersion = null;
      } else {
        phase = 'available';
        availableVersion = extractedVersion ?? fallbackVersion;
        downloadedVersion = null;
      }

      return publishState();
    } catch (error) {
      if (!isLoggedError(error)) {
        await logService.logError('updater:checkForUpdates', error);
      }
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
      const rawBody = await fetchJsonWithNetworkLogging({
        scope: 'updater:downloadUpdate',
        url,
        token,
        failureMessage: 'Latest version request failed'
      });

      let payload: { download_url?: string };
      try {
        payload = JSON.parse(rawBody) as { download_url?: string };
      } catch {
        await logService.logError(
          'updater:downloadUpdate',
          'Latest version API returned an invalid JSON response.',
          {
            bodyPreview: rawBody.slice(0, 500),
            url
          }
        );
        throw markLoggedError(new Error('Latest version API returned an invalid JSON response.'));
      }

      const downloadUrl = payload.download_url?.trim();
      if (!downloadUrl) {
        await logService.logError('updater:downloadUpdate', 'Latest version API returned an empty download_url.', {
          bodyPreview: rawBody.slice(0, 500),
          url
        });
        throw markLoggedError(new Error('Latest version API returned an empty download_url.'));
      }

      await shell.openExternal(downloadUrl);
      phase = 'downloaded';
      downloadedVersion = availableVersion;
      return publishState();
    } catch (error) {
      if (!isLoggedError(error)) {
        await logService.logError('updater:downloadUpdate', error);
      }
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
