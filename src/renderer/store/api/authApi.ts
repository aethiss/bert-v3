import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '@renderer/store';
import { getApiBaseUrl } from './apiConfig';
import { exchangeCode } from '@services/authService';

function normalizeExchangeResponse(response: string): string {
  const trimmed = response.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({
    baseUrl: getApiBaseUrl(),
    prepareHeaders: (headers, { getState }) => {
      const jwt = (getState() as RootState).auth.jwt;
      if (jwt) {
        headers.set('authorization', `Bearer ${jwt}`);
      }

      return headers;
    }
  }),
  endpoints: (build) => ({
    exchangeCode: build.query<string, string>({
      async queryFn(exchangeKey) {
        try {
          const jwt = await exchangeCode(exchangeKey);
          return { data: normalizeExchangeResponse(jwt) };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Exchange code failed.';
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: message,
              data: error
            }
          };
        }
      }
    })
  })
});

export const { useLazyExchangeCodeQuery } = authApi;
