export interface CiamLoginResult {
  exchangeKey: string;
  refreshToken: string | null;
  redirectUrl: string;
}
