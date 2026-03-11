import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('bertApp', {
  version: '0.1.0'
});
