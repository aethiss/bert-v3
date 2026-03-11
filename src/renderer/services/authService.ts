import type { CiamLoginResult } from '@shared/types/ipc/auth';

export async function openCiamLogin(): Promise<CiamLoginResult> {
  return window.bertApp.auth.openCiamLogin();
}

export async function exchangeCode(exchangeKey: string): Promise<string> {
  return window.bertApp.auth.exchangeCode(exchangeKey);
}
