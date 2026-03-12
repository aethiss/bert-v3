import type { RootState } from '@renderer/store';
import type { EligibleOverviewSummary } from '@shared/types/eligible';

export const selectEligibleOverviewSummary = (state: RootState): EligibleOverviewSummary =>
  state.eligible.summary;

export const selectHasEligibleData = (state: RootState): boolean => state.eligible.summary.hasData;
