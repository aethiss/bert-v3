import { contextBridge, ipcRenderer } from 'electron';
import type { AppMode } from '../shared/types/appMode';
import type { InstallerModeState } from '../shared/types/ipc/installer';
import type { UpdaterState } from '../shared/types/ipc/updater';
import type {
  ClientConnectionSettings,
  LocalServerInterfaceInfo,
  LocalServerSettings,
  LocalServerStatus
} from '../shared/types/localServer';
import type { PrintSettings } from '../shared/types/printConfig';
import type { SupportedLocale } from '../shared/types/language';
import type { BertAppApi } from '../shared/types/preload';

const UPDATER_STATE_CHANGED_CHANNEL = 'updater:stateChanged';

const bertAppApi: BertAppApi = {
  version: process.env.npm_package_version ?? 'unknown',
  auth: {
    openCiamLogin() {
      return ipcRenderer.invoke('auth:openCiamLogin');
    },
    exchangeCode(exchangeKey: string) {
      return ipcRenderer.invoke('auth:exchangeCode', exchangeKey);
    },
    getUserInfo(jwt: string) {
      return ipcRenderer.invoke('auth:getUserInfo', jwt);
    },
    getPersistedUser() {
      return ipcRenderer.invoke('auth:getPersistedUser');
    },
    savePersistedUser(user) {
      return ipcRenderer.invoke('auth:savePersistedUser', user);
    },
    clearPersistedUser() {
      return ipcRenderer.invoke('auth:clearPersistedUser');
    }
  },
  installer: {
    getModeState() {
      return ipcRenderer.invoke('installer:getModeState') as Promise<InstallerModeState>;
    },
    setMode(mode: AppMode) {
      return ipcRenderer.invoke('installer:setMode', mode) as Promise<InstallerModeState>;
    }
  },
  updater: {
    getState() {
      return ipcRenderer.invoke('updater:getState') as Promise<UpdaterState>;
    },
    checkForUpdates() {
      return ipcRenderer.invoke('updater:checkForUpdates') as Promise<UpdaterState>;
    },
    downloadUpdate() {
      return ipcRenderer.invoke('updater:downloadUpdate') as Promise<UpdaterState>;
    },
    installUpdate() {
      return ipcRenderer.invoke('updater:installUpdate') as Promise<void>;
    },
    onStateChanged(listener: (state: UpdaterState) => void) {
      const wrappedListener = (_event: Electron.IpcRendererEvent, state: UpdaterState) => {
        listener(state);
      };

      ipcRenderer.on(UPDATER_STATE_CHANGED_CHANNEL, wrappedListener);
      return () => {
        ipcRenderer.removeListener(UPDATER_STATE_CHANGED_CHANNEL, wrappedListener);
      };
    }
  },
  config: {
    getAppVersion() {
      return ipcRenderer.invoke('config:getAppVersion') as Promise<string>;
    },
    getPrintSettings() {
      return ipcRenderer.invoke('config:getPrintSettings') as Promise<PrintSettings>;
    },
    setPrintSettings(settings: PrintSettings) {
      return ipcRenderer.invoke('config:setPrintSettings', settings) as Promise<PrintSettings>;
    },
    getLanguage() {
      return ipcRenderer.invoke('config:getLanguage') as Promise<SupportedLocale>;
    },
    setLanguage(language: SupportedLocale) {
      return ipcRenderer.invoke('config:setLanguage', language) as Promise<SupportedLocale>;
    },
    getServerInterfaces() {
      return ipcRenderer.invoke('config:getServerInterfaces') as Promise<LocalServerInterfaceInfo[]>;
    },
    getLocalServerSettings() {
      return ipcRenderer.invoke('config:getLocalServerSettings') as Promise<LocalServerSettings>;
    },
    setLocalServerSettings(settings: LocalServerSettings) {
      return ipcRenderer.invoke(
        'config:setLocalServerSettings',
        settings
      ) as Promise<LocalServerSettings>;
    },
    getLocalServerStatus() {
      return ipcRenderer.invoke('config:getLocalServerStatus') as Promise<LocalServerStatus>;
    },
    startLocalServer(settings: LocalServerSettings) {
      return ipcRenderer.invoke('config:startLocalServer', settings) as Promise<LocalServerStatus>;
    },
    stopLocalServer() {
      return ipcRenderer.invoke('config:stopLocalServer') as Promise<LocalServerStatus>;
    },
    getOperationsDashboard(query) {
      return ipcRenderer.invoke('config:getOperationsDashboard', query);
    },
    getClientConnectionSettings() {
      return ipcRenderer.invoke('config:getClientConnectionSettings') as Promise<ClientConnectionSettings>;
    },
    setClientConnectionSettings(settings: ClientConnectionSettings) {
      return ipcRenderer.invoke(
        'config:setClientConnectionSettings',
        settings
      ) as Promise<ClientConnectionSettings>;
    },
    resetDatabaseForDevelopment() {
      return ipcRenderer.invoke('config:resetDatabaseForDevelopment') as Promise<void>;
    }
  },
  logs: {
    logAction(action: string) {
      return ipcRenderer.invoke('logs:logAction', action) as Promise<void>;
    },
    logError(scope: string, message: string, details?: string) {
      return ipcRenderer.invoke('logs:logError', scope, message, details) as Promise<void>;
    },
    logNetwork(payload) {
      return ipcRenderer.invoke('logs:logNetwork', payload) as Promise<void>;
    },
    listRecentFiles() {
      return ipcRenderer.invoke('logs:listRecentFiles');
    },
    openFile(fileName: string) {
      return ipcRenderer.invoke('logs:openFile', fileName) as Promise<void>;
    },
    exportRecentFiles() {
      return ipcRenderer.invoke('logs:exportRecentFiles');
    }
  },
  eligibleData: {
    save(payload) {
      return ipcRenderer.invoke('eligibleData:save', payload);
    },
    sync(params) {
      return ipcRenderer.invoke('eligibleData:sync', params);
    },
    searchDistributionMember(query: string) {
      return ipcRenderer.invoke('eligibleData:searchDistributionMember', query);
    },
    getDistributionDetail(params) {
      return ipcRenderer.invoke('eligibleData:getDistributionDetail', params);
    },
    saveDistributionEvent(payload) {
      return ipcRenderer.invoke('eligibleData:saveDistributionEvent', payload);
    },
    getDistributionQueue() {
      return ipcRenderer.invoke('eligibleData:getDistributionQueue');
    },
    clearDistributionQueue() {
      return ipcRenderer.invoke('eligibleData:clearDistributionQueue');
    },
    saveClientDistributionHistory(payload) {
      return ipcRenderer.invoke('eligibleData:saveClientDistributionHistory', payload);
    },
    getClientDistributionHistory(query) {
      return ipcRenderer.invoke('eligibleData:getClientDistributionHistory', query);
    },
    hasData() {
      return ipcRenderer.invoke('eligibleData:hasData');
    },
    getOverviewSummary() {
      return ipcRenderer.invoke('eligibleData:getOverviewSummary');
    },
    clear() {
      return ipcRenderer.invoke('eligibleData:clear');
    }
  }
};

contextBridge.exposeInMainWorld('bertApp', bertAppApi);
