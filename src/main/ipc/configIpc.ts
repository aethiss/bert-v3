import { ipcMain } from 'electron';
import { networkInterfaces } from 'node:os';
import type { LocalServerInterfaceInfo, LocalServerSettings } from '../../shared/types/localServer';
import type { PrintSettings } from '../../shared/types/printConfig';
import type { RuntimeConfigService } from '../services/configService';
import type { LocalApiServer } from '../server/localApiServer';

const CHANNEL_GET_PRINT_SETTINGS = 'config:getPrintSettings';
const CHANNEL_SET_PRINT_SETTINGS = 'config:setPrintSettings';
const CHANNEL_GET_SERVER_INTERFACES = 'config:getServerInterfaces';
const CHANNEL_GET_LOCAL_SERVER_SETTINGS = 'config:getLocalServerSettings';
const CHANNEL_SET_LOCAL_SERVER_SETTINGS = 'config:setLocalServerSettings';
const CHANNEL_GET_LOCAL_SERVER_STATUS = 'config:getLocalServerStatus';
const CHANNEL_START_LOCAL_SERVER = 'config:startLocalServer';
const CHANNEL_STOP_LOCAL_SERVER = 'config:stopLocalServer';

function listLocalInterfaces(): LocalServerInterfaceInfo[] {
  const all = networkInterfaces();
  const interfaces: LocalServerInterfaceInfo[] = [];

  for (const [name, addresses] of Object.entries(all)) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4') {
        continue;
      }
      if (address.address.startsWith('169.254.')) {
        continue;
      }

      interfaces.push({
        name,
        address: address.address,
        family: 'IPv4',
        internal: address.internal
      });
    }
  }

  interfaces.sort((left, right) => {
    if (left.internal === right.internal) {
      return left.name.localeCompare(right.name);
    }
    return left.internal ? 1 : -1;
  });

  return interfaces;
}

export function registerConfigIpc(
  configService: RuntimeConfigService,
  localApiServer: LocalApiServer
): void {
  ipcMain.removeHandler(CHANNEL_GET_PRINT_SETTINGS);
  ipcMain.removeHandler(CHANNEL_SET_PRINT_SETTINGS);
  ipcMain.removeHandler(CHANNEL_GET_SERVER_INTERFACES);
  ipcMain.removeHandler(CHANNEL_GET_LOCAL_SERVER_SETTINGS);
  ipcMain.removeHandler(CHANNEL_SET_LOCAL_SERVER_SETTINGS);
  ipcMain.removeHandler(CHANNEL_GET_LOCAL_SERVER_STATUS);
  ipcMain.removeHandler(CHANNEL_START_LOCAL_SERVER);
  ipcMain.removeHandler(CHANNEL_STOP_LOCAL_SERVER);

  ipcMain.handle(CHANNEL_GET_PRINT_SETTINGS, async () => {
    return configService.getPrintSettings();
  });

  ipcMain.handle(CHANNEL_SET_PRINT_SETTINGS, async (_event, settings: PrintSettings) => {
    return configService.setPrintSettings(settings);
  });

  ipcMain.handle(CHANNEL_GET_SERVER_INTERFACES, async () => {
    return listLocalInterfaces();
  });

  ipcMain.handle(CHANNEL_GET_LOCAL_SERVER_SETTINGS, async () => {
    return configService.getLocalServerSettings();
  });

  ipcMain.handle(
    CHANNEL_SET_LOCAL_SERVER_SETTINGS,
    async (_event, settings: LocalServerSettings) => {
      return configService.setLocalServerSettings(settings);
    }
  );

  ipcMain.handle(CHANNEL_GET_LOCAL_SERVER_STATUS, async () => {
    return localApiServer.getStatus();
  });

  ipcMain.handle(CHANNEL_START_LOCAL_SERVER, async (_event, settings: LocalServerSettings) => {
    const mode = await configService.getApplicationMode();
    if (mode === 'CLIENT') {
      throw new Error('Local server can be started only when application mode is SERVER.');
    }

    const saved = await configService.setLocalServerSettings(settings);
    return localApiServer.start(saved);
  });

  ipcMain.handle(CHANNEL_STOP_LOCAL_SERVER, async () => {
    await localApiServer.stop();
    return localApiServer.getStatus();
  });
}
