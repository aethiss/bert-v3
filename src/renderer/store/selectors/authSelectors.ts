import type { RootState } from '@renderer/store';
import type { PersistedUserProfile } from '@shared/types/user';

export const selectJwt = (state: RootState): string | null => state.auth.jwt;
export const selectIsAuthenticated = (state: RootState): boolean => Boolean(state.auth.user);
export const selectIsOnline = (state: RootState): boolean => state.auth.connectionStatus === 'online';
export const selectCurrentUser = (state: RootState): PersistedUserProfile | null => state.auth.user;
