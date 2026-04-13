import { ipcMain } from 'electron';
import type { UpdateService } from '../services/updateService';

const CHANNEL_GET_STATE = 'updater:getState';
const CHANNEL_CHECK_FOR_UPDATES = 'updater:checkForUpdates';
const CHANNEL_DOWNLOAD_UPDATE = 'updater:downloadUpdate';
const CHANNEL_INSTALL_UPDATE = 'updater:installUpdate';

export function registerUpdaterIpc(updateService: UpdateService): void {
  ipcMain.removeHandler(CHANNEL_GET_STATE);
  ipcMain.removeHandler(CHANNEL_CHECK_FOR_UPDATES);
  ipcMain.removeHandler(CHANNEL_DOWNLOAD_UPDATE);
  ipcMain.removeHandler(CHANNEL_INSTALL_UPDATE);

  ipcMain.handle(CHANNEL_GET_STATE, async () => updateService.getState());
  ipcMain.handle(CHANNEL_CHECK_FOR_UPDATES, async () => updateService.checkForUpdates());
  ipcMain.handle(CHANNEL_DOWNLOAD_UPDATE, async () => updateService.downloadUpdate());
  ipcMain.handle(CHANNEL_INSTALL_UPDATE, async () => {
    await updateService.installUpdate();
  });
}
