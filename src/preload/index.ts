import { contextBridge, ipcRenderer } from 'electron';
import type { AppMode } from '../shared/types/appMode';
import type { InstallerModeState } from '../shared/types/ipc/installer';
import type { BertAppApi } from '../shared/types/preload';

const bertAppApi: BertAppApi = {
  version: '0.3.0',
  auth: {
    openCiamLogin() {
      return ipcRenderer.invoke('auth:openCiamLogin');
    },
    exchangeCode(exchangeKey: string) {
      return ipcRenderer.invoke('auth:exchangeCode', exchangeKey);
    }
  },
  installer: {
    getModeState() {
      return ipcRenderer.invoke('installer:getModeState') as Promise<InstallerModeState>;
    },
    setMode(mode: AppMode) {
      return ipcRenderer.invoke('installer:setMode', mode) as Promise<InstallerModeState>;
    }
  }
};

contextBridge.exposeInMainWorld('bertApp', bertAppApi);
