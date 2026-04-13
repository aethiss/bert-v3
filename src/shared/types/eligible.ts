export interface EligibleFoodCommodityApiModel {
  id: number;
  unique_id: string;
  en_name: string;
  ar_name: string;
  description: string | null;
  kcal: number | null;
  unit: string | null;
  quantity: number | null;
  weight: number | null;
}

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
  foodCommodities?: EligibleFoodCommodityApiModel[];
}

export interface EligibleFamilyCycleApiModel {
  code: number;
  quantity: string;
}

export interface EligibleFamilyApiModel {
  FamilyUniqueCode: number | string;
  address: string | null;
  status: string;
  eligible: boolean;
  fdp_id: string;
  fdp_name: string;
  Number_of_Children_between_6_and_23_Months: number;
  members?: EligibleMemberApiModel[];
  distributionHistory?: Array<Record<string, unknown>>;
  cycles?: EligibleFamilyCycleApiModel[];
}

export interface EligibleMemberApiModel {
  id: number;
  family: number | string;
  role: string | null;
  firstName: string | null;
  lastName: string | null;
  fatherName: string | null;
  motherName: string | null;
  motherLastName: string | null;
  cityOfBirth: string | null;
  dateOfBirth: string | null;
  documentNumber: string | null;
  status: string;
}

export interface EligibleMembersApiResponse {
  fdp_code: string;
  fdp_name: string;
  total_households: number;
  total_cycles: number;
  cycles: EligibleCycleApiModel[];
  families: EligibleFamilyApiModel[];
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
  pendingDistributionCount: number;
  lastSynchronizedAt: string | null;
  cycles: EligibleCycleSummary[];
}

export type DistributionSearchMatch = 'familyUniqueCode' | 'documentNumber';

export interface DistributionSearchMember {
  id: number;
  fullName: string;
  role: string | null;
  documentNumber: string | null;
  familyUniqueCode: number;
}

export interface DistributionSearchResult {
  match: DistributionSearchMatch;
  member: DistributionSearchMember;
}

export interface DistributionHouseholdInfo {
  familyUniqueCode: number;
  idmId: string;
  booklet: string;
  principle: string;
  phone: string;
  registrationDate: string;
  pbwgs: string;
  children623: number;
}

export interface DistributionActiveCycle {
  cycleCode: number;
  cycleName: string;
  assistanceType: string;
  quantity: string;
  startDate: string;
  endDate: string;
}

export interface DistributionHouseholdMember {
  memberId: number;
  fullName: string;
  documentNumber: string | null;
  age: number | null;
  role: string | null;
}

export interface DistributionDetailData {
  household: DistributionHouseholdInfo;
  activeCycles: DistributionActiveCycle[];
  members: DistributionHouseholdMember[];
  selectedMemberId: number;
}

export interface LocalDistributionEventInput {
  familyUniqueCode: number;
  memberId: number;
  cycleCode: number;
  mainOperator: number;
  mainOperatorFDP: string;
  subOperator: string | null;
  appSignature: string;
  notes: string | null;
}

export interface DistributionQueueItem {
  id: number;
  familyUniqueCode: number;
  memberId: number;
  cycleCode: number;
  mainOperator: number;
  mainOperatorFDP: string;
  subOperator: string | null;
  appSignature: string;
  notes: string | null;
  status: string;
  createdAt: string;
}

export interface ClientDistributionInput {
  subOperator: string;
  cycleCode: number;
  memberId: number;
}

export interface ClientDistributionHistoryInput {
  alias: string;
  host: string;
  memberId: number;
  familyUniqueCode: number;
  cycleCode: number;
  cycleName: string;
  collectedBy: string;
}

export interface ClientDistributionHistoryItem {
  id: number;
  alias: string;
  host: string;
  memberId: number;
  familyUniqueCode: number;
  cycleCode: number;
  cycleName: string;
  collectedBy: string;
  createdAt: string;
}

export interface ClientDistributionHistoryQuery {
  alias: string;
  search: string;
  page: number;
  pageSize: number;
}

export interface ClientDistributionHistoryResult {
  items: ClientDistributionHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
