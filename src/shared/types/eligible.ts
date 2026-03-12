export interface EligibleCycleApiModel {
  cycleId: string;
  cycleCode: number;
  startDate: string;
  endDate: string;
  cooperatingPartner: string | null;
  fieldDistributionPoint: string | null;
  assistancePackageName: string;
  cycleName: string;
  cycleNote: string | null;
  household_count: number;
  households?: EligibleHouseholdApiModel[];
}

export interface EligibleHouseholdApiModel {
  hhId: string;
  cycleCode: number;
  assignedStatus: string;
  householdSize: string;
  quantity: string;
  assistancePackageName: string;
  cooperatingPartner: string | null;
  fdp_id: string;
  fdp_name: string;
  Number_of_Children_between_6_and_23_Months: number;
  FamilyUniqueCode: number;
  address: string | null;
  status: string;
  eligible: boolean;
  members?: EligibleMemberApiModel[];
}

export interface EligibleMemberApiModel {
  id: number;
  family: number;
  role: string | null;
  firstName: string | null;
  lastName: string | null;
  fatherName: string | null;
  motherName: string | null;
  motherLastName: string | null;
  cityOfBirth: string | null;
  dateOfBirth: string | null;
  documentNumber: string | null;
  cycleCode: number;
  status: string;
}

export interface EligibleMembersApiResponse {
  fdp_code: string;
  fdp_name: string;
  total_households: number;
  total_cycles: number;
  cycles: EligibleCycleApiModel[];
}

export interface EligibleCycleSummary {
  cycleCode: number;
  cycleName: string;
  assistancePackageName: string;
  startDate: string;
  endDate: string;
  householdCount: number;
}

export interface EligibleOverviewSummary {
  hasData: boolean;
  fdpCode: string | null;
  fdpName: string | null;
  totalCycles: number;
  totalHouseholds: number;
  totalMembers: number;
  cycles: EligibleCycleSummary[];
}

export type DistributionSearchMatch = 'familyUniqueCode' | 'documentNumber';

export interface DistributionSearchMember {
  id: number;
  role: string | null;
  documentNumber: string | null;
  familyUniqueCode: number;
}

export interface DistributionSearchResult {
  match: DistributionSearchMatch;
  member: DistributionSearchMember;
}
