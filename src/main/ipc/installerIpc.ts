import { ipcMain } from 'electron';
import type { AppMode } from '../../shared/types/appMode';
import type { InstallerModeState } from '../../shared/types/ipc/installer';
import type { RuntimeConfigService } from '../services/configService';

const CHANNEL_GET_STATE = 'installer:getModeState';
const CHANNEL_SET_MODE = 'installer:setMode';

function toInstallerModeState(mode: AppMode | null): InstallerModeState {
  return {
    mode,
    isLocked: mode !== null
  };
}

export function registerInstallerIpc(configService: RuntimeConfigService): void {
  ipcMain.removeHandler(CHANNEL_GET_STATE);
  ipcMain.removeHandler(CHANNEL_SET_MODE);

  ipcMain.handle(CHANNEL_GET_STATE, async () => {
    const mode = await configService.getApplicationMode();
    return toInstallerModeState(mode);
  });

  ipcMain.handle(CHANNEL_SET_MODE, async (_event, requestedMode: AppMode) => {
    const mode = await configService.setApplicationMode(requestedMode);
    return toInstallerModeState(mode);
  });
}
