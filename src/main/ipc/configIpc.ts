import { ipcMain } from 'electron';
import type { PrintSettings } from '../../shared/types/printConfig';
import type { RuntimeConfigService } from '../services/configService';

const CHANNEL_GET_PRINT_SETTINGS = 'config:getPrintSettings';
const CHANNEL_SET_PRINT_SETTINGS = 'config:setPrintSettings';

export function registerConfigIpc(configService: RuntimeConfigService): void {
  ipcMain.removeHandler(CHANNEL_GET_PRINT_SETTINGS);
  ipcMain.removeHandler(CHANNEL_SET_PRINT_SETTINGS);

  ipcMain.handle(CHANNEL_GET_PRINT_SETTINGS, async () => {
    return configService.getPrintSettings();
  });

  ipcMain.handle(CHANNEL_SET_PRINT_SETTINGS, async (_event, settings: PrintSettings) => {
    return configService.setPrintSettings(settings);
  });
}
