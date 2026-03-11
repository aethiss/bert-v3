import type { AppMode } from './appMode';
import type { CiamLoginResult } from './ipc/auth';
import type { InstallerModeState } from './ipc/installer';

export interface BertAppApi {
  version: string;
  auth: {
    openCiamLogin(): Promise<CiamLoginResult>;
    exchangeCode(exchangeKey: string): Promise<string>;
  };
  installer: {
    getModeState(): Promise<InstallerModeState>;
    setMode(mode: AppMode): Promise<InstallerModeState>;
  };
}
