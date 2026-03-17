import { app, BrowserWindow, nativeImage } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { initializeDatabase } from './database/database';
import { registerAuthIpc } from './ipc/authIpc';
import { registerConfigIpc } from './ipc/configIpc';
import { registerEligibleDataIpc } from './ipc/eligibleDataIpc';
import { registerInstallerIpc } from './ipc/installerIpc';
import { createRuntimeConfigService } from './services/configService';
import { createEligibleDataService } from './services/eligibleDataService';
import { loadDotEnvFromProjectRoot } from './services/envService';
import { createUserService } from './services/userService';
import { createLocalApiServer } from './server/localApiServer';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
const APP_ICON_RELATIVE_PATH = path.join('src', 'renderer', 'assets', 'branding', 'bert-icon.png');

function resolveAppIconPath(): string | null {
  const candidates = [
    path.join(app.getAppPath(), APP_ICON_RELATIVE_PATH),
    path.resolve(__dirname, '../../', APP_ICON_RELATIVE_PATH),
    path.join(process.cwd(), APP_ICON_RELATIVE_PATH),
    path.join(process.resourcesPath, APP_ICON_RELATIVE_PATH),
    path.join(process.resourcesPath, 'app.asar.unpacked', APP_ICON_RELATIVE_PATH)
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function createMainWindow(): Promise<void> {
  const appIconPath = resolveAppIconPath();

  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    ...(appIconPath ? { icon: appIconPath } : {}),
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
  const userService = createUserService(appDatabase.connection);
  const eligibleDataService = createEligibleDataService(appDatabase.connection);
  const localApiServer = createLocalApiServer({ eligibleDataService });
  registerInstallerIpc(configService);
  registerConfigIpc(configService, localApiServer, eligibleDataService);
  registerAuthIpc(() => mainWindow, userService);
  registerEligibleDataIpc(eligibleDataService);
  await createMainWindow();

  app.on('before-quit', () => {
    void localApiServer.stop();
    void appDatabase.close();
  });
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const appIconPath = resolveAppIconPath();
    if (appIconPath) {
      const dockIcon = nativeImage.createFromPath(appIconPath);
      const dock = app.dock;
      if (!dockIcon.isEmpty() && dock) {
        dock.setIcon(dockIcon);
      }
    }
  }

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
