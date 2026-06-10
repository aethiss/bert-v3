export interface PersistedUserProfile {
  id: number | null;
  email: string;
  corporatePartner: string | null;
  fdp: string | null;
  fieldOffice: string | null;
}

export interface UserInfoApiModel extends Record<string, unknown> {
  id?: number | null;
  email: string;
  accessLevel?: string | null;
  corporatepartner: string | null;
  fdp: string | null;
  fieldOffice: string | null;
}
