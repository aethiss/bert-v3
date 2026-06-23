export interface IOffline {
  ISOFFLINE?: boolean;
}

export interface IUserInfo extends IOffline {
  id?: number;
  accessLevel: string;
  corporatepartner: string | null;
  email: string;
  fdp: string | null;
  fdp_enName: string | null;
  fdp_ar_name: string | null;
  fieldOffice?: string | null;
  is_active: boolean;
  is_staff: boolean;
  maincorporatepartner: string | null;
  permission_matrix: Record<string, unknown>;
  roles: Record<string, unknown>;
}
