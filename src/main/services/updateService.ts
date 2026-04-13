import { BrowserWindow, app } from 'electron';
import {
  autoUpdater,
  type ProgressInfo,
  type UpdateInfo
} from 'electron-updater';
import type { UpdaterPhase, UpdaterState } from '../../shared/types/ipc/updater';

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UPDATER_STATE_CHANGED_CHANNEL = 'updater:stateChanged';

function serializeReleaseNotes(releaseNotes: UpdateInfo['releaseNotes']): string | null {
  if (typeof releaseNotes === 'string') {
    const normalized = releaseNotes.trim();
    return normalized || null;
  }

  if (!Array.isArray(releaseNotes)) {
    return null;
  }

  const entries = releaseNotes
    .map((entry) => {
      const note = entry as { version?: string | null; note?: string | null };
      const version = typeof note.version === 'string' ? note.version.trim() : '';
      const content = typeof note.note === 'string' ? note.note.trim() : '';
      if (!version && !content) {
        return null;
      }
      if (!version) {
        return content;
      }
      if (!content) {
        return version;
      }
      return `${version}\n${content}`;
    })
    .filter((value): value is string => Boolean(value));

  return entries.length > 0 ? entries.join('\n\n') : null;
}

function resolveDisableReason(): string | null {
  if (app.isPackaged) {
    if (process.platform === 'win32' || process.platform === 'darwin') {
      return null;
    }
    return 'Auto-update is supported only on packaged Windows and macOS builds.';
  }

  return 'Auto-update is available only in packaged application builds.';
}

function toIsoDate(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export interface UpdateService {
  start(): void;
  dispose(): void;
  getState(): Promise<UpdaterState>;
  checkForUpdates(): Promise<UpdaterState>;
  downloadUpdate(): Promise<UpdaterState>;
  installUpdate(): Promise<void>;
  onStateChanged(listener: (state: UpdaterState) => void): () => void;
}

export interface UpdateServiceOptions {
  getPendingDistributionCount: () => Promise<number>;
}

export function createUpdateService(options: UpdateServiceOptions): UpdateService {
  const listeners = new Set<(state: UpdaterState) => void>();
  const disableReason = resolveDisableReason();
  const isSupported = disableReason === null;
  const currentVersion = app.getVersion();

  let phase: UpdaterPhase = isSupported ? 'idle' : 'disabled';
  let availableInfo: UpdateInfo | null = null;
  let downloadedInfo: UpdateInfo | null = null;
  let lastCheckedAt: string | null = null;
  let lastError: string | null = null;
  let downloadProgress: ProgressInfo | null = null;
  let pendingDistributionCount = 0;
  let started = false;
  let checkTimer: NodeJS.Timeout | null = null;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

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
      isSupported,
      disableReason,
      currentVersion,
      availableVersion: availableInfo?.version ?? null,
      downloadedVersion: downloadedInfo?.version ?? null,
      releaseName: downloadedInfo?.releaseName ?? availableInfo?.releaseName ?? null,
      releaseDate:
        toIsoDate(downloadedInfo?.releaseDate) ?? toIsoDate(availableInfo?.releaseDate) ?? null,
      releaseNotes:
        serializeReleaseNotes(downloadedInfo?.releaseNotes) ??
        serializeReleaseNotes(availableInfo?.releaseNotes) ??
        null,
      lastCheckedAt,
      downloadPercent: typeof downloadProgress?.percent === 'number' ? downloadProgress.percent : null,
      bytesPerSecond:
        typeof downloadProgress?.bytesPerSecond === 'number' ? downloadProgress.bytesPerSecond : null,
      transferredBytes:
        typeof downloadProgress?.transferred === 'number' ? downloadProgress.transferred : null,
      totalBytes: typeof downloadProgress?.total === 'number' ? downloadProgress.total : null,
      pendingDistributionCount,
      lastError,
      canCheck: isSupported && phase !== 'checking' && phase !== 'downloading' && phase !== 'installing',
      canDownload: isSupported && phase === 'available',
      canInstall: isSupported && phase === 'downloaded' && pendingDistributionCount === 0
    };
  }

  async function publishState(): Promise<UpdaterState> {
    const state = await buildState();
    broadcast(state);
    return state;
  }

  function attachUpdaterEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      phase = 'checking';
      lastError = null;
      lastCheckedAt = new Date().toISOString();
      downloadProgress = null;
      void publishState();
    });

    autoUpdater.on('update-available', (info) => {
      phase = 'available';
      availableInfo = info;
      downloadedInfo = null;
      lastError = null;
      downloadProgress = null;
      void publishState();
    });

    autoUpdater.on('update-not-available', () => {
      phase = 'idle';
      availableInfo = null;
      downloadedInfo = null;
      lastError = null;
      downloadProgress = null;
      void publishState();
    });

    autoUpdater.on('download-progress', (progress) => {
      phase = 'downloading';
      downloadProgress = progress;
      lastError = null;
      void publishState();
    });

    autoUpdater.on('update-downloaded', (info) => {
      phase = 'downloaded';
      downloadedInfo = info;
      availableInfo = info;
      lastError = null;
      downloadProgress = null;
      void publishState();
    });

    autoUpdater.on('error', (error) => {
      phase = availableInfo ? 'available' : downloadedInfo ? 'downloaded' : 'error';
      lastError = formatError(error);
      downloadProgress = null;
      console.error('[updater] Update flow error', error);
      void publishState();
    });
  }

  async function runSilentCheck(): Promise<void> {
    try {
      await checkForUpdates();
    } catch (error) {
      console.warn('[updater] Silent update check failed', error);
    }
  }

  function start(): void {
    if (started) {
      return;
    }

    started = true;
    attachUpdaterEvents();
    void publishState();

    if (!isSupported) {
      return;
    }

    const initialDelay = 10_000;
    setTimeout(() => {
      void runSilentCheck();
    }, initialDelay);

    checkTimer = setInterval(() => {
      void runSilentCheck();
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

  async function checkForUpdates(): Promise<UpdaterState> {
    if (!isSupported) {
      return buildState();
    }

    await autoUpdater.checkForUpdates();
    return buildState();
  }

  async function downloadUpdate(): Promise<UpdaterState> {
    if (!isSupported) {
      return buildState();
    }

    if (phase === 'downloaded') {
      return buildState();
    }

    if (phase !== 'available') {
      throw new Error('No update is available to download right now.');
    }

    lastError = null;
    await autoUpdater.downloadUpdate();
    return buildState();
  }

  async function installUpdate(): Promise<void> {
    if (!isSupported) {
      return;
    }

    await refreshPendingDistributionCount();
    if (pendingDistributionCount > 0) {
      throw new Error(
        'Update installation is blocked until all pending distributions have been sent.'
      );
    }

    if (phase !== 'downloaded') {
      throw new Error('No downloaded update is ready to install.');
    }

    phase = 'installing';
    lastError = null;
    await publishState();

    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
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
