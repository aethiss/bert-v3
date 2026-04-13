export interface IFoodCommodity {
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

export interface IMember {
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

export interface IFamilyCycle {
  code: number;
  quantity: string;
}

export interface IActiveHousehold {
  FamilyUniqueCode: number | string;
  address: string | null;
  status: string;
  eligible: boolean;
  fdp_id: string;
  fdp_name: string;
  Number_of_Children_between_6_and_23_Months: number;
  members?: IMember[];
  distributionHistory?: IDistributionHistory[];
  cycles?: IFamilyCycle[];
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
  foodCommodities?: IFoodCommodity[];
}

export interface IActiveCyclesAPI {
  fdp_code: string;
  fdp_name: string;
  total_households: number;
  total_cycles: number;
  cycles: IActiveCycle[];
  families: IActiveHousehold[];
}

export interface IMemberDTO extends IMember {
  household: IActiveHousehold;
  activeCycle: IActiveCycle[];
}
