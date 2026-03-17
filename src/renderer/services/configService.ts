import type {
  ClientConnectionSettings,
  LocalServerInterfaceInfo,
  LocalServerSettings,
  LocalServerStatus
} from '@shared/types/localServer';
import type { OperationsDashboard, OperationsDashboardQuery } from '@shared/types/operations';
import type { PrintSettings } from '@shared/types/printConfig';

export async function getPrintSettings(): Promise<PrintSettings> {
  return window.bertApp.config.getPrintSettings();
}

export async function savePrintSettings(settings: PrintSettings): Promise<PrintSettings> {
  return window.bertApp.config.setPrintSettings(settings);
}

export async function getServerInterfaces(): Promise<LocalServerInterfaceInfo[]> {
  return window.bertApp.config.getServerInterfaces();
}

export async function getLocalServerSettings(): Promise<LocalServerSettings> {
  return window.bertApp.config.getLocalServerSettings();
}

export async function saveLocalServerSettings(
  settings: LocalServerSettings
): Promise<LocalServerSettings> {
  return window.bertApp.config.setLocalServerSettings(settings);
}

export async function getLocalServerStatus(): Promise<LocalServerStatus> {
  return window.bertApp.config.getLocalServerStatus();
}

export async function startLocalServer(settings: LocalServerSettings): Promise<LocalServerStatus> {
  return window.bertApp.config.startLocalServer(settings);
}

export async function stopLocalServer(): Promise<LocalServerStatus> {
  return window.bertApp.config.stopLocalServer();
}

export async function getOperationsDashboard(
  query: OperationsDashboardQuery
): Promise<OperationsDashboard> {
  return window.bertApp.config.getOperationsDashboard(query);
}

export async function getClientConnectionSettings(): Promise<ClientConnectionSettings> {
  return window.bertApp.config.getClientConnectionSettings();
}

export async function saveClientConnectionSettings(
  settings: ClientConnectionSettings
): Promise<ClientConnectionSettings> {
  return window.bertApp.config.setClientConnectionSettings(settings);
}

export async function resetDatabaseForDevelopment(): Promise<void> {
  return window.bertApp.config.resetDatabaseForDevelopment();
}
