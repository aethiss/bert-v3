import type { RootState } from '@renderer/store';

export const selectJwt = (state: RootState): string | null => state.auth.jwt;
export const selectIsAuthenticated = (state: RootState): boolean => Boolean(state.auth.jwt);
