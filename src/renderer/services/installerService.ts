import type { AppMode } from '@shared/types/appMode';
import type { InstallerModeState } from '@shared/types/ipc/installer';

export async function getInstallerModeState(): Promise<InstallerModeState> {
  return window.bertApp.installer.getModeState();
}

export async function setInstallerMode(mode: AppMode): Promise<InstallerModeState> {
  return window.bertApp.installer.setMode(mode);
}
