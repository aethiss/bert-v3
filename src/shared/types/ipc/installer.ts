import type { AppMode } from '../appMode';

export interface InstallerModeState {
  mode: AppMode | null;
  isLocked: boolean;
}
