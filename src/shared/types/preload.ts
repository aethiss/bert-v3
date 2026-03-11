import type { AppMode } from './appMode';
import type { InstallerModeState } from './ipc/installer';

export interface BertAppApi {
  version: string;
  installer: {
    getModeState(): Promise<InstallerModeState>;
    setMode(mode: AppMode): Promise<InstallerModeState>;
  };
}
