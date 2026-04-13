import type { UpdaterState } from '@shared/types/ipc/updater';

function getFallbackState(): UpdaterState {
  return {
    phase: 'disabled',
    isSupported: false,
    disableReason: 'Updater API is unavailable in the current preload context.',
    currentVersion: window.bertApp?.version ?? 'unknown',
    availableVersion: null,
    downloadedVersion: null,
    releaseName: null,
    releaseDate: null,
    releaseNotes: null,
    lastCheckedAt: null,
    downloadPercent: null,
    bytesPerSecond: null,
    transferredBytes: null,
    totalBytes: null,
    pendingDistributionCount: 0,
    lastError: null,
    canCheck: false,
    canDownload: false,
    canInstall: false
  };
}

function hasUpdaterApi(): boolean {
  return typeof window.bertApp?.updater?.getState === 'function';
}

export async function getUpdaterState(): Promise<UpdaterState> {
  if (!hasUpdaterApi()) {
    return getFallbackState();
  }
  return window.bertApp.updater.getState();
}

export async function checkForUpdates(): Promise<UpdaterState> {
  if (!hasUpdaterApi()) {
    return getFallbackState();
  }
  return window.bertApp.updater.checkForUpdates();
}

export async function downloadUpdate(): Promise<UpdaterState> {
  if (!hasUpdaterApi()) {
    return getFallbackState();
  }
  return window.bertApp.updater.downloadUpdate();
}

export async function installUpdate(): Promise<void> {
  if (!hasUpdaterApi()) {
    return;
  }
  return window.bertApp.updater.installUpdate();
}

export function subscribeToUpdaterState(listener: (state: UpdaterState) => void): () => void {
  if (!hasUpdaterApi()) {
    return () => undefined;
  }
  return window.bertApp.updater.onStateChanged(listener);
}
