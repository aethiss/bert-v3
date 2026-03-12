import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { EligibleOverviewSummary } from '@shared/types/eligible';

interface EligibleState {
  summary: EligibleOverviewSummary;
}

const emptySummary: EligibleOverviewSummary = {
  hasData: false,
  fdpCode: null,
  fdpName: null,
  totalCycles: 0,
  totalHouseholds: 0,
  totalMembers: 0,
  pendingDistributionCount: 0,
  lastSynchronizedAt: null,
  cycles: []
};

const initialState: EligibleState = {
  summary: emptySummary
};

const eligibleSlice = createSlice({
  name: 'eligible',
  initialState,
  reducers: {
    setEligibleOverviewSummary(state, action: PayloadAction<EligibleOverviewSummary>) {
      state.summary = action.payload;
    },
    clearEligibleOverviewSummary(state) {
      state.summary = emptySummary;
    }
  }
});

export const { setEligibleOverviewSummary, clearEligibleOverviewSummary } = eligibleSlice.actions;
export const eligibleReducer = eligibleSlice.reducer;
