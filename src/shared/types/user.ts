export interface PersistedUserProfile {
  id: number | null;
  email: string;
  fdp: string | null;
  fieldOffice: string | null;
}

export interface UserInfoApiModel extends Record<string, unknown> {
  id?: number | null;
  email: string;
  fdp: string | null;
  fieldOffice: string | null;
}
