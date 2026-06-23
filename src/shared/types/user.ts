export interface PersistedUserProfile {
  id: number | null;
  email: string;
  corporatePartner: string | null;
  mainCorporatePartner?: string | null;
  fdp: string | null;
  fdpEnName?: string | null;
  fdpArName?: string | null;
  fieldOffice?: string | null;
}

export interface UserInfoApiModel extends Record<string, unknown> {
  id?: number | null;
  email: string;
  accessLevel?: string | null;
  corporatepartner: string | null;
  maincorporatepartner: string | null;
  fdp: string | null;
  fdp_enName: string | null;
  fdp_ar_name: string | null;
  fieldOffice?: string | null;
}
