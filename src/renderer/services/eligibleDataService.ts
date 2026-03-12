import type {
  DistributionSearchResult,
  EligibleMembersApiResponse,
  EligibleOverviewSummary
} from '@shared/types/eligible';

export async function saveEligibleData(
  payload: EligibleMembersApiResponse
): Promise<EligibleOverviewSummary> {
  return window.bertApp.eligibleData.save(payload);
}

export async function syncEligibleData(params: {
  fdpCode: string;
  jwt: string;
}): Promise<EligibleOverviewSummary> {
  return window.bertApp.eligibleData.sync(params);
}

export async function searchDistributionMember(
  query: string
): Promise<DistributionSearchResult | null> {
  return window.bertApp.eligibleData.searchDistributionMember(query);
}

export async function hasEligibleData(): Promise<boolean> {
  return window.bertApp.eligibleData.hasData();
}

export async function getEligibleOverviewSummary(): Promise<EligibleOverviewSummary> {
  return window.bertApp.eligibleData.getOverviewSummary();
}

export async function clearEligibleData(): Promise<void> {
  return window.bertApp.eligibleData.clear();
}
