import { contextBridge, ipcRenderer } from 'electron';
import type { AppMode } from '../shared/types/appMode';
import type { InstallerModeState } from '../shared/types/ipc/installer';
import type {
  ClientConnectionSettings,
  LocalServerInterfaceInfo,
  LocalServerSettings,
  LocalServerStatus
} from '../shared/types/localServer';
import type { PrintSettings } from '../shared/types/printConfig';
import type { BertAppApi } from '../shared/types/preload';

const bertAppApi: BertAppApi = {
  version: '0.4.0',
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
  config: {
    getPrintSettings() {
      return ipcRenderer.invoke('config:getPrintSettings') as Promise<PrintSettings>;
    },
    setPrintSettings(settings: PrintSettings) {
      return ipcRenderer.invoke('config:setPrintSettings', settings) as Promise<PrintSettings>;
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
