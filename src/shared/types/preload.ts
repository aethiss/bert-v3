import type { AppMode } from './appMode';
import type {
  ClientDistributionHistoryInput,
  ClientDistributionHistoryQuery,
  ClientDistributionHistoryResult,
  DistributionQueueItem,
  DistributionDetailData,
  LocalDistributionEventInput,
  DistributionSearchResult,
  EligibleMembersApiResponse,
  EligibleOverviewSummary
} from './eligible';
import type { CiamLoginResult, ExchangeCodeResult } from './ipc/auth';
import type { InstallerModeState } from './ipc/installer';
import type { UpdaterState } from './ipc/updater';
import type {
  ClientConnectionSettings,
  LocalServerInterfaceInfo,
  LocalServerSettings,
  LocalServerStatus
} from './localServer';
import type { OperationsDashboard, OperationsDashboardQuery } from './operations';
import type { PrintSettings } from './printConfig';
import type { PersistedUserProfile, UserInfoApiModel } from './user';
import type { SupportedLocale } from './language';
import type { AppLogFileInfo, ExportLogsResult, RendererNetworkLogPayload } from './log';

export interface BertAppApi {
  version: string;
  auth: {
    openCiamLogin(): Promise<CiamLoginResult>;
    exchangeCode(exchangeKey: string): Promise<ExchangeCodeResult>;
    getUserInfo(jwt: string): Promise<UserInfoApiModel[]>;
    getPersistedUser(): Promise<PersistedUserProfile | null>;
    savePersistedUser(user: PersistedUserProfile): Promise<void>;
    clearPersistedUser(): Promise<void>;
  };
  installer: {
    getModeState(): Promise<InstallerModeState>;
    setMode(mode: AppMode): Promise<InstallerModeState>;
  };
  updater: {
    getState(): Promise<UpdaterState>;
    checkForUpdates(): Promise<UpdaterState>;
    downloadUpdate(): Promise<UpdaterState>;
    installUpdate(): Promise<void>;
    onStateChanged(listener: (state: UpdaterState) => void): () => void;
  };
  config: {
    getAppVersion(): Promise<string>;
    getPrintSettings(): Promise<PrintSettings>;
    setPrintSettings(settings: PrintSettings): Promise<PrintSettings>;
    getLanguage(): Promise<SupportedLocale>;
    setLanguage(language: SupportedLocale): Promise<SupportedLocale>;
    getServerInterfaces(): Promise<LocalServerInterfaceInfo[]>;
    getLocalServerSettings(): Promise<LocalServerSettings>;
    setLocalServerSettings(settings: LocalServerSettings): Promise<LocalServerSettings>;
    getLocalServerStatus(): Promise<LocalServerStatus>;
    startLocalServer(settings: LocalServerSettings): Promise<LocalServerStatus>;
    stopLocalServer(): Promise<LocalServerStatus>;
    getOperationsDashboard(query: OperationsDashboardQuery): Promise<OperationsDashboard>;
    getClientConnectionSettings(): Promise<ClientConnectionSettings>;
    setClientConnectionSettings(
      settings: ClientConnectionSettings
    ): Promise<ClientConnectionSettings>;
    resetDatabaseForDevelopment(): Promise<void>;
  };
  logs: {
    logAction(action: string): Promise<void>;
    logError(scope: string, message: string, details?: string): Promise<void>;
    logNetwork(payload: RendererNetworkLogPayload): Promise<void>;
    listRecentFiles(): Promise<AppLogFileInfo[]>;
    openFile(fileName: string): Promise<void>;
    exportRecentFiles(): Promise<ExportLogsResult>;
  };
  eligibleData: {
    save(payload: EligibleMembersApiResponse): Promise<EligibleOverviewSummary>;
    sync(params: { fdpCode: string; jwt: string }): Promise<EligibleOverviewSummary>;
    searchDistributionMember(query: string): Promise<DistributionSearchResult | null>;
    getDistributionDetail(params: {
      memberId: number;
      familyUniqueCode: number;
    }): Promise<DistributionDetailData | null>;
    saveDistributionEvent(payload: LocalDistributionEventInput): Promise<{ id: number }>;
    getDistributionQueue(): Promise<DistributionQueueItem[]>;
    clearDistributionQueue(): Promise<{ deleted: number }>;
    saveClientDistributionHistory(payload: ClientDistributionHistoryInput): Promise<{ id: number }>;
    getClientDistributionHistory(
      query: ClientDistributionHistoryQuery
    ): Promise<ClientDistributionHistoryResult>;
    hasData(): Promise<boolean>;
    getOverviewSummary(): Promise<EligibleOverviewSummary>;
    clear(): Promise<void>;
  };
}
