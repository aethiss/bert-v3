export const UPDATER_STATE_CHANGED_CHANNEL = 'updater:stateChanged';

export type UpdaterPhase =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error';

export interface UpdaterState {
  phase: UpdaterPhase;
  isSupported: boolean;
  disableReason: string | null;
  currentVersion: string;
  availableVersion: string | null;
  downloadedVersion: string | null;
  releaseName: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  lastCheckedAt: string | null;
  downloadPercent: number | null;
  bytesPerSecond: number | null;
  transferredBytes: number | null;
  totalBytes: number | null;
  pendingDistributionCount: number;
  lastError: string | null;
  canCheck: boolean;
  canDownload: boolean;
  canInstall: boolean;
}
