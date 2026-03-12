import type { CiamLoginResult } from '@shared/types/ipc/auth';
import type { PersistedUserProfile, UserInfoApiModel } from '@shared/types/user';

export async function openCiamLogin(): Promise<CiamLoginResult> {
  return window.bertApp.auth.openCiamLogin();
}

export async function exchangeCode(exchangeKey: string): Promise<string> {
  return window.bertApp.auth.exchangeCode(exchangeKey);
}

export async function getUserInfo(jwt: string): Promise<UserInfoApiModel[]> {
  return window.bertApp.auth.getUserInfo(jwt);
}

export async function getPersistedUser(): Promise<PersistedUserProfile | null> {
  return window.bertApp.auth.getPersistedUser();
}

export async function savePersistedUser(profile: PersistedUserProfile): Promise<void> {
  return window.bertApp.auth.savePersistedUser(profile);
}

export async function clearPersistedUser(): Promise<void> {
  return window.bertApp.auth.clearPersistedUser();
}
