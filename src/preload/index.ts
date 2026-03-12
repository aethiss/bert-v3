import { contextBridge, ipcRenderer } from 'electron';
import type { AppMode } from '../shared/types/appMode';
import type { InstallerModeState } from '../shared/types/ipc/installer';
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
