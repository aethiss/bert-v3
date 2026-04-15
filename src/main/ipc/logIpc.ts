import { app, dialog, ipcMain, shell } from 'electron';
import type { AppLogFileInfo, ExportLogsResult, RendererNetworkLogPayload } from '../../shared/types/log';
import type { AppLogService } from '../services/logService';

const CHANNEL_LOG_ACTION = 'logs:logAction';
const CHANNEL_LOG_ERROR = 'logs:logError';
const CHANNEL_LOG_NETWORK = 'logs:logNetwork';
const CHANNEL_LIST_LOG_FILES = 'logs:listRecentFiles';
const CHANNEL_OPEN_LOG_FILE = 'logs:openFile';
const CHANNEL_EXPORT_LOG_FILES = 'logs:exportRecentFiles';

export function registerLogIpc(logService: AppLogService): void {
  ipcMain.removeHandler(CHANNEL_LOG_ACTION);
  ipcMain.removeHandler(CHANNEL_LOG_ERROR);
  ipcMain.removeHandler(CHANNEL_LOG_NETWORK);
  ipcMain.removeHandler(CHANNEL_LIST_LOG_FILES);
  ipcMain.removeHandler(CHANNEL_OPEN_LOG_FILE);
  ipcMain.removeHandler(CHANNEL_EXPORT_LOG_FILES);

  ipcMain.handle(CHANNEL_LOG_ACTION, async (_event, action: string) => {
    await logService.logAction(action);
  });

  ipcMain.handle(CHANNEL_LOG_ERROR, async (_event, scope: string, message: string, details?: unknown) => {
    await logService.logError(scope, message, details);
  });

  ipcMain.handle(CHANNEL_LOG_NETWORK, async (_event, payload: RendererNetworkLogPayload) => {
    await logService.logNetwork(payload);
  });

  ipcMain.handle(CHANNEL_LIST_LOG_FILES, async (): Promise<AppLogFileInfo[]> => {
    return logService.listRecentLogFiles();
  });

  ipcMain.handle(CHANNEL_OPEN_LOG_FILE, async (_event, fileName: string): Promise<void> => {
    const filePath = await logService.openLogFileByName(fileName);
    const openError = await shell.openPath(filePath);
    if (openError) {
      throw new Error(openError);
    }
  });

  ipcMain.handle(CHANNEL_EXPORT_LOG_FILES, async (): Promise<ExportLogsResult> => {
    const result = await dialog.showOpenDialog({
      title: 'Export log files',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      throw new Error('Export cancelled.');
    }

    const exportDirectory = result.filePaths[0];
    const exported = await logService.exportRecentLogFiles(exportDirectory);
    return {
      directory: exportDirectory,
      exportedCount: exported.exportedCount,
      fileNames: exported.fileNames
    };
  });
}
