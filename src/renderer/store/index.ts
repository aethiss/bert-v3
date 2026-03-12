import { configureStore, isRejected, isRejectedWithValue, type Middleware } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { authApi } from './api/authApi';
import { eligibleApi } from './api/eligibleApi';
import { authReducer } from './authSlice';
import { eligibleReducer } from './eligibleSlice';
import { showErrorToast } from '@renderer/lib/errorToast';

const errorToastMiddleware: Middleware = () => (next) => (action) => {
  if (isRejectedWithValue(action) || isRejected(action)) {
    const typedAction = action as { payload?: unknown; error?: unknown };
    showErrorToast(typedAction.payload ?? typedAction.error);
  }

  return next(action);
};

export const store = configureStore({
  reducer: {
    auth: authReducer,
    eligible: eligibleReducer,
    [authApi.reducerPath]: authApi.reducer,
    [eligibleApi.reducerPath]: eligibleApi.reducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(authApi.middleware, eligibleApi.middleware, errorToastMiddleware)
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
