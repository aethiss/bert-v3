export interface PersistedUserProfile {
  email: string;
  fdp: string | null;
  fieldOffice: string | null;
}

export interface UserInfoApiModel extends Record<string, unknown> {
  email: string;
  fdp: string | null;
  fieldOffice: string | null;
}
