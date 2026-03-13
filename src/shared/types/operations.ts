export interface OperationCycleProgress {
  cycleCode: number;
  cycleName: string;
  totalHouseholds: number;
  distributedCount: number;
}

export interface OperationOverviewBar {
  alias: string;
  distributedCount: number;
}

export interface OperationClientCycleStat {
  cycleCode: number;
  cycleName: string;
  distributedCount: number;
  totalHouseholds: number;
}

export interface OperationClientStat {
  alias: string;
  isConnected: boolean;
  lastSeenAt: string | null;
  totalDistributed: number;
  cycles: OperationClientCycleStat[];
}

export interface OperationDistributionRow {
  id: number;
  subOperator: string;
  memberId: number;
  date: string;
  time: string;
  cycleCode: number;
  cycleName: string;
  status: string;
  createdAt: string;
}

export interface OperationsDashboard {
  serverRunning: boolean;
  sessionStartedAt: string | null;
  totalDistributions: number;
  totalEligibleHouseholds: number;
  cycleProgress: OperationCycleProgress[];
  overviewBars: OperationOverviewBar[];
  clients: OperationClientStat[];
  distributions: {
    items: OperationDistributionRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface OperationsDashboardQuery {
  search: string;
  page: number;
  pageSize: number;
}
