import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '@renderer/store';
import { getApiBaseUrl } from './apiConfig';
import { exchangeCode, getUserInfo, savePersistedUser } from '@services/authService';
import type { PersistedUserProfile, UserInfoApiModel } from '@shared/types/user';
import type { ExchangeCodeResult } from '@shared/types/ipc/auth';

function toPersistedUserProfile(
  response: UserInfoApiModel[] | UserInfoApiModel
): PersistedUserProfile {
  const user = Array.isArray(response) ? response[0] : response;
  if (!user || !user.email) {
    throw new Error('User info response does not include a valid user.');
  }

  return {
    email: user.email,
    fdp: user.fdp,
    fieldOffice: user.fieldOffice
  };
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
    exchangeCode: build.query<ExchangeCodeResult, string>({
      async queryFn(exchangeKey) {
        try {
          const tokenResponse = await exchangeCode(exchangeKey);
          return { data: tokenResponse };
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
    }),
    getUserInfo: build.query<PersistedUserProfile, string>({
      async queryFn(jwt) {
        try {
          const response = await getUserInfo(jwt);
          const profile = toPersistedUserProfile(response);
          await savePersistedUser(profile);
          return { data: profile };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'User info request failed.';
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

export const { useLazyExchangeCodeQuery, useLazyGetUserInfoQuery } = authApi;
