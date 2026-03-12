import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInstallerModeSetup } from '@hooks/useInstallerModeSetup';
import { InstallerModeModal } from '@ui/components/installer/InstallerModeModal';
import { DashboardPage } from '@renderer/pages/DashboardPage';
import { LoginPage } from '@renderer/pages/LoginPage';
import { ServerPage } from '@renderer/pages/ServerPage';
import type { ServerRouteState } from '@renderer/components/server/types';
import {
  parseAppHash,
  toAppHash,
  type ParsedRoute
} from '@renderer/navigation/appHashNavigation';
import {
  clearPersistedUser,
  getPersistedUser,
  openCiamLogin
} from '@renderer/services/authService';
import { authApi } from '@renderer/store/api/authApi';
import {
  clearAuthSession,
  restoreOfflineSession,
  setOnlineAuthSession
} from '@renderer/store/authSlice';
import { useAppDispatch, useAppSelector } from '@renderer/store/hooks';
import {
  selectCurrentUser,
  selectIsAuthenticated,
  selectIsOnline
} from '@renderer/store/selectors/authSelectors';

export function App() {
  const dispatch = useAppDispatch();
  const installerModeSetup = useInstallerModeSetup();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isOnline = useAppSelector(selectIsOnline);
  const currentUser = useAppSelector(selectCurrentUser);
  const [route, setRoute] = useState<ParsedRoute>(() => parseAppHash(window.location.hash));
  const [isHydratingAuth, setIsHydratingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;

    const hydrateUser = async () => {
      try {
        const persistedUser = await getPersistedUser();
        if (!mounted || !persistedUser) {
          return;
        }

        dispatch(restoreOfflineSession(persistedUser));
      } finally {
        if (mounted) {
          setIsHydratingAuth(false);
        }
      }
    };

    void hydrateUser();

    return () => {
      mounted = false;
    };
  }, [dispatch]);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseAppHash(window.location.hash));
    };

    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (!window.location.hash) {
      window.location.hash = '#/server/home';
    }
  }, [isAuthenticated, installerModeSetup.mode]);

  const navigateServer = useCallback((nextServerRoute: ServerRouteState) => {
    const next = {
      appRoute: 'server' as const,
      server: nextServerRoute
    };

    const nextHash = toAppHash(next);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
      return;
    }

    setRoute(next);
  }, []);

  const runOnlineLoginFlow = useCallback(async () => {
    const ciamResult = await openCiamLogin();

    const exchangeRequest = dispatch(
      authApi.endpoints.exchangeCode.initiate(ciamResult.exchangeKey, { forceRefetch: true })
    );
    let jwt = '';
    try {
      jwt = await exchangeRequest.unwrap();
    } finally {
      exchangeRequest.unsubscribe();
    }

    const userInfoRequest = dispatch(authApi.endpoints.getUserInfo.initiate(jwt, { forceRefetch: true }));
    let profile;
    try {
      profile = await userInfoRequest.unwrap();
    } finally {
      userInfoRequest.unsubscribe();
    }

    dispatch(
      setOnlineAuthSession({
        jwt,
        refreshToken: ciamResult.refreshToken,
        exchangeKey: ciamResult.exchangeKey,
        user: profile
      })
    );
  }, [dispatch]);

  const handleServerAuthAction = useCallback(async () => {
    try {
      if (isOnline) {
        await clearPersistedUser();
        dispatch(clearAuthSession());
        return;
      }

      await runOnlineLoginFlow();
    } catch (error) {
      console.error('[auth] Unable to complete auth action from server navigation', error);
    }
  }, [dispatch, isOnline, runOnlineLoginFlow]);

  const appContent = useMemo(() => {
    if (isHydratingAuth) {
      return null;
    }

    if (!isAuthenticated) {
      return <LoginPage />;
    }

    if (route.appRoute === 'client') {
      return <DashboardPage />;
    }

    return (
      <ServerPage
        route={route.server}
        onNavigate={navigateServer}
        userEmail={currentUser?.email ?? ''}
        isOnline={isOnline}
        authActionLabel={isOnline ? 'Logout' : 'Login'}
        onAuthAction={() => {
          void handleServerAuthAction();
        }}
      />
    );
  }, [
    currentUser?.email,
    handleServerAuthAction,
    isAuthenticated,
    isHydratingAuth,
    isOnline,
    navigateServer,
    route
  ]);

  return (
    <>
      {appContent}
      <InstallerModeModal
        isOpen={!installerModeSetup.isLoading && !installerModeSetup.isLocked}
        isSubmitting={installerModeSetup.isSubmitting}
        errorMessage={installerModeSetup.errorMessage}
        onConfirm={installerModeSetup.setMode}
      />
    </>
  );
}
