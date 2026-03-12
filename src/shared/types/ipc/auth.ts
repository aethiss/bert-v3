export interface CiamLoginResult {
  exchangeKey: string;
  refreshToken: string | null;
  redirectUrl: string;
}

export interface ExchangeCodeResult {
  idToken: string;
  refreshToken: string | null;
}
