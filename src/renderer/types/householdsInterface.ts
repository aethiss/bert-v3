export interface IMember {
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

export interface IDistributionHistory {
  id: number;
  FDPcode: string;
  assistancePackageCode: string | null;
  assistancePackageName: string | null;
  collectedByCategory: string | null;
  collectedByName: string | null;
  collectedByNationalId: string;
  cooperatingPartner: string;
  cycleCode: string;
  distributedQuantity: string;
  fieldDistributionPoint: string;
  hDistributionInfo: string | null;
  hhCardValidationStatus: string;
  hhid: string;
  notes: string | null;
  operator: string;
  signature: string | null;
  sourcefile: string | null;
  timestamp: string;
  validityFlag: string;
}

export interface IActiveHousehold {
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
  members?: IMember[];
  distributionHistory?: IDistributionHistory[];
}

export interface IActiveCycle {
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
  households?: IActiveHousehold[];
}

export interface IActiveCyclesAPI {
  fdp_code: string;
  fdp_name: string;
  total_households: number;
  total_cycles: number;
  cycles: IActiveCycle[];
}

export interface IMemberDTO extends IMember {
  household: IActiveHousehold;
  activeCycle: IActiveCycle[];
}
