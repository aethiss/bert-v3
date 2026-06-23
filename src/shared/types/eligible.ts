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

export interface EligibleFoodBasketApiModel {
  id: number;
  unique_id: string;
  code: string;
  en_name: string;
  ar_name: string;
  description: string | null;
  commodities?: EligibleFoodCommodityApiModel[];
}

export interface EligibleCycleApiModel {
  cycleId: string;
  cycleCode: number;
  startDate: string;
  endDate: string;
  cooperatingPartner: string | null;
  fieldDistributionPoint: string | null;
  assistancePackageName: string;
  cycleEnName?: string | null;
  cycleArName?: string | null;
  cycleName: string;
  cycleNote: string | null;
  household_count: number;
  foodCommodities?: EligibleFoodCommodityApiModel[];
  food_basket?: EligibleFoodBasketApiModel[];
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
  principle_family_booklet?: string | null;
  principle_mobile?: string | null;
  createdDate?: string | null;
  bpw_count?: number | string | null;
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

export interface UndistributedHouseholdReportItem {
  householdId: string;
  principalPhoneNo: string;
  hhSubdistrict: string;
  cycleCode: string;
  cpEnName: string;
  fdpEnName: string;
}

export interface UndistributedHouseholdReportExportResult {
  filePath: string;
  rowCount: number;
  cancelled?: boolean;
}

export interface DistributionReportExportResult {
  filePath: string;
  rowCount: number;
  cancelled?: boolean;
}

export interface DistributionReportItem {
  transactionId: string;
  hhid: string;
  hhMembers: number;
  hhRegistrationDate: string;
  ageGroup: string;
  timestamp: string;
  hhSubdistrict: string;
  cycleCode: string;
  cycleName: string;
  foodBasket: string;
  quantity: string;
  partnerEnName: string;
  fdpEnName: string;
  fdpCode: string;
  collectedByName: string;
  collectedByNationalId: string;
  operator: string;
  remarks: string;
  sourcefile: string;
}

export type DistributionSearchMatch = 'familyUniqueCode' | 'familyBooklet' | 'documentNumber';

export interface DistributionSearchMember {
  id: number;
  fullName: string;
  principleFullName: string;
  fdpName: string;
  familyBooklet: string | null;
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
  cycleEnName?: string | null;
  cycleArName?: string | null;
  assistanceType: string;
  quantity: string;
  startDate: string;
  endDate: string;
  isDistributed: boolean;
  foodCommodities: EligibleFoodCommodityApiModel[];
}

export interface DistributionHouseholdMember {
  memberId: number;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  fatherName: string | null;
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
  quantity: number;
  appSignature: string;
  notes: string | null;
  deviceMacAddress: string;
}

export interface DistributionQueueItem {
  id: number;
  familyUniqueCode: number;
  memberId: number;
  cycleCode: number;
  mainOperator: number;
  mainOperatorFDP: string;
  subOperator: string | null;
  quantity: number;
  appSignature: string;
  notes: string | null;
  deviceMacAddress: string;
  status: string;
  createdAt: string;
}

export interface FamilyDistributionHistoryItem {
  id: number;
  familyUniqueCode: number;
  memberId: number;
  collectedByDocument: string | null;
  collectedByFirstName: string | null;
  collectedByLastName: string | null;
  collectedByFatherName: string | null;
  cycleCode: number;
  cycleName: string;
  quantity: number;
  subOperator: string | null;
  status: string;
  appSignature: string;
  notes: string | null;
  createdAt: string;
}

export interface PushDistributionFailedItem {
  row: number;
  item: Record<string, unknown>;
  errors: unknown;
}

export interface PushDistributionBatchResult {
  batchIndex: number;
  totalReceived: number;
  inserted: number;
  failed: number;
  deletedLocalRows: number;
  failedItems: PushDistributionFailedItem[];
}

export interface PushDistributionResult {
  batches: PushDistributionBatchResult[];
  totalReceived: number;
  totalInserted: number;
  totalFailed: number;
  totalDeletedLocalRows: number;
}

export interface ClientDistributionInput {
  subOperator: string;
  familyUniqueCode: number;
  cycleCode: number;
  memberId: number;
  notes: string | null;
  deviceMacAddress: string;
}

export interface ClientDistributionHistoryInput {
  alias: string;
  host: string;
  memberId: number;
  familyUniqueCode: number;
  cycleCode: number;
  cycleName: string;
  collectedBy: string;
  collectedByDocument: string | null;
  quantity: number;
  notes: string | null;
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
  collectedByDocument: string | null;
  quantity: number;
  notes: string | null;
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
