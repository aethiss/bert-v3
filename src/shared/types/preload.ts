import type { AppMode } from './appMode';
import type {
  DistributionQueueItem,
  DistributionDetailData,
  LocalDistributionEventInput,
  DistributionSearchResult,
  EligibleMembersApiResponse,
  EligibleOverviewSummary
} from './eligible';
import type { CiamLoginResult, ExchangeCodeResult } from './ipc/auth';
import type { InstallerModeState } from './ipc/installer';
import type { PrintSettings } from './printConfig';
import type { PersistedUserProfile, UserInfoApiModel } from './user';

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
  config: {
    getPrintSettings(): Promise<PrintSettings>;
    setPrintSettings(settings: PrintSettings): Promise<PrintSettings>;
  };
  eligibleData: {
    save(payload: EligibleMembersApiResponse): Promise<EligibleOverviewSummary>;
    sync(params: { fdpCode: string; jwt: string }): Promise<EligibleOverviewSummary>;
    searchDistributionMember(query: string): Promise<DistributionSearchResult | null>;
    getDistributionDetail(params: {
      memberId: number;
      cycleCode: number;
      familyHhId: string;
    }): Promise<DistributionDetailData | null>;
    saveDistributionEvent(payload: LocalDistributionEventInput): Promise<{ id: number }>;
    getDistributionQueue(): Promise<DistributionQueueItem[]>;
    clearDistributionQueue(): Promise<{ deleted: number }>;
    hasData(): Promise<boolean>;
    getOverviewSummary(): Promise<EligibleOverviewSummary>;
    clear(): Promise<void>;
  };
}
