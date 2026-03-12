import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { syncEligibleData } from '@renderer/services/eligibleDataService';
import type { EligibleOverviewSummary } from '@shared/types/eligible';

export const eligibleApi = createApi({
  reducerPath: 'eligibleApi',
  baseQuery: fakeBaseQuery(),
  endpoints: (build) => ({
    getEligibleMembers: build.query<EligibleOverviewSummary, { fdpCode: string; jwt: string }>({
      async queryFn(params) {
        try {
          const summary = await syncEligibleData(params);
          return { data: summary };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: error,
              error: 'Unable to synchronize eligible members data.'
            }
          };
        }
      }
    })
  })
});

export const { useLazyGetEligibleMembersQuery } = eligibleApi;
