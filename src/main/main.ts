import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { initializeDatabase } from './database/database';
import { registerAuthIpc } from './ipc/authIpc';
import { registerInstallerIpc } from './ipc/installerIpc';
import { createRuntimeConfigService } from './services/configService';
import { loadDotEnvFromProjectRoot } from './services/envService';
import { createInternalHttpServer } from './server/httpServer';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.once('ready-to-show', () => window.show());

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow = window;
}

async function bootstrap(): Promise<void> {
  loadDotEnvFromProjectRoot();

  const appDatabase = await initializeDatabase(app.getPath('userData'));
  const configService = createRuntimeConfigService(appDatabase.connection);
  registerInstallerIpc(configService);
  registerAuthIpc(() => mainWindow);
  const config = await configService.loadRuntimeConfig();
  const httpServer = createInternalHttpServer(config.apiPort);

  await httpServer.start();
  await createMainWindow();

  app.on('before-quit', () => {
    void httpServer.stop();
    void appDatabase.close();
  });
}

app.whenReady().then(() => {
  void bootstrap().catch((error: unknown) => {
    console.error('Application bootstrap failed', error);
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('browser-window-created', (_, window) => {
  window.on('closed', () => {
    if (window === mainWindow) {
      mainWindow = null;
    }
  });
});
