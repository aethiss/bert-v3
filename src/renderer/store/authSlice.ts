import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  jwt: string | null;
  refreshToken: string | null;
  exchangeKey: string | null;
}

interface AuthSessionPayload {
  jwt: string;
  refreshToken: string | null;
  exchangeKey: string;
}

const initialState: AuthState = {
  jwt: null,
  refreshToken: null,
  exchangeKey: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthSession(state, action: PayloadAction<AuthSessionPayload>) {
      state.jwt = action.payload.jwt;
      state.refreshToken = action.payload.refreshToken;
      state.exchangeKey = action.payload.exchangeKey;
    },
    clearAuthSession(state) {
      state.jwt = null;
      state.refreshToken = null;
      state.exchangeKey = null;
    }
  }
});

export const { setAuthSession, clearAuthSession } = authSlice.actions;
export const authReducer = authSlice.reducer;
