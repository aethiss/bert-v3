import type { AppMode } from './appMode';
import type { EligibleMembersApiResponse, EligibleOverviewSummary } from './eligible';
import type { CiamLoginResult, ExchangeCodeResult } from './ipc/auth';
import type { InstallerModeState } from './ipc/installer';
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
  eligibleData: {
    save(payload: EligibleMembersApiResponse): Promise<EligibleOverviewSummary>;
    sync(params: { fdpCode: string; jwt: string }): Promise<EligibleOverviewSummary>;
    hasData(): Promise<boolean>;
    getOverviewSummary(): Promise<EligibleOverviewSummary>;
    clear(): Promise<void>;
  };
}
