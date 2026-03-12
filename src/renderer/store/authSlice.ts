import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PersistedUserProfile } from '@shared/types/user';

interface AuthState {
  jwt: string | null;
  refreshToken: string | null;
  exchangeKey: string | null;
  user: PersistedUserProfile | null;
  connectionStatus: 'online' | 'offline';
}

interface OnlineAuthSessionPayload {
  jwt: string;
  refreshToken: string | null;
  exchangeKey: string;
  user: PersistedUserProfile;
}

const initialState: AuthState = {
  jwt: null,
  refreshToken: null,
  exchangeKey: null,
  user: null,
  connectionStatus: 'offline'
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setOnlineAuthSession(state, action: PayloadAction<OnlineAuthSessionPayload>) {
      state.jwt = action.payload.jwt;
      state.refreshToken = action.payload.refreshToken;
      state.exchangeKey = action.payload.exchangeKey;
      state.user = action.payload.user;
      state.connectionStatus = 'online';
    },
    restoreOfflineSession(state, action: PayloadAction<PersistedUserProfile>) {
      state.jwt = null;
      state.refreshToken = null;
      state.exchangeKey = null;
      state.user = action.payload;
      state.connectionStatus = 'offline';
    },
    clearAuthSession(state) {
      state.jwt = null;
      state.refreshToken = null;
      state.exchangeKey = null;
      state.user = null;
      state.connectionStatus = 'offline';
    }
  }
});

export const { setOnlineAuthSession, restoreOfflineSession, clearAuthSession } = authSlice.actions;
export const authReducer = authSlice.reducer;
