import { useCallback, useEffect, useMemo, useState } from 'react';
import { IntlProvider } from 'react-intl';
import { useInstallerModeSetup } from '@hooks/useInstallerModeSetup';
import { InstallerModeModal } from '@ui/components/installer/InstallerModeModal';
import { DashboardPage } from '@renderer/pages/DashboardPage';
import { LoginPage } from '@renderer/pages/LoginPage';
import { ServerPage } from '@renderer/pages/ServerPage';
import { ClientPage } from '@renderer/pages/ClientPage';
import type { ServerRouteState } from '@renderer/components/server/types';
import type { ExchangeCodeResult } from '@shared/types/ipc/auth';
import type { SupportedLocale } from '@shared/types/language';
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
import { eligibleApi } from '@renderer/store/api/eligibleApi';
import { getEligibleOverviewSummary } from '@renderer/services/eligibleDataService';
import {
  clearAuthSession,
  restoreOfflineSession,
  setOnlineAuthSession
} from '@renderer/store/authSlice';
import { setEligibleOverviewSummary } from '@renderer/store/eligibleSlice';
import { useAppDispatch, useAppSelector } from '@renderer/store/hooks';
import {
  selectCurrentUser,
  selectIsAuthenticated,
  selectIsOnline,
  selectJwt
} from '@renderer/store/selectors/authSelectors';
import {
  selectEligibleOverviewSummary,
  selectHasEligibleData
} from '@renderer/store/selectors/eligibleSelectors';
import { showErrorToast } from '@renderer/lib/errorToast';
import { isRtkLikeError, toErrorMessage } from '@renderer/lib/errorMessage';
import { getLanguage, getLocalServerStatus, saveLanguage } from '@renderer/services/configService';
import { AppUpdateNotifications } from '@renderer/components/shared/AppUpdateNotifications';
import { LocaleContext } from '@renderer/i18n/localeContext';
import { MESSAGES_BY_LOCALE } from '@renderer/i18n/messages';

export function App() {
  const dispatch = useAppDispatch();
  const installerModeSetup = useInstallerModeSetup();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isOnline = useAppSelector(selectIsOnline);
  const jwt = useAppSelector(selectJwt);
  const currentUser = useAppSelector(selectCurrentUser);
  const hasEligibleData = useAppSelector(selectHasEligibleData);
  const eligibleOverviewSummary = useAppSelector(selectEligibleOverviewSummary);
  const [route, setRoute] = useState<ParsedRoute>(() => parseAppHash(window.location.hash));
  const [isHydratingAuth, setIsHydratingAuth] = useState(true);
  const [locale, setLocale] = useState<SupportedLocale>('en');
  const [isHydratingLocale, setIsHydratingLocale] = useState(true);
  const [isSynchronizing, setIsSynchronizing] = useState(false);
  const [isLocalServerRunning, setIsLocalServerRunning] = useState(false);

  const refreshEligibleSummary = useCallback(async () => {
    const summary = await getEligibleOverviewSummary();
    dispatch(setEligibleOverviewSummary(summary));
  }, [dispatch]);

  useEffect(() => {
    let mounted = true;

    const hydrateUser = async () => {
      try {
        const persistedUser = await getPersistedUser();
        if (!mounted || !persistedUser) {
          await refreshEligibleSummary();
          return;
        }

        dispatch(restoreOfflineSession(persistedUser));
        await refreshEligibleSummary();
      } catch (error) {
        showErrorToast(error);
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
  }, [dispatch, refreshEligibleSummary]);

  useEffect(() => {
    let mounted = true;

    void getLanguage()
      .then((persistedLocale) => {
        if (!mounted) {
          return;
        }
        setLocale(persistedLocale);
      })
      .catch((error) => {
        if (mounted) {
          showErrorToast(error);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsHydratingLocale(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      showErrorToast(event.error ?? event.message);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      showErrorToast(event.reason);
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const onDistributionQueueUpdated = () => {
      void refreshEligibleSummary();
    };

    window.addEventListener('distribution-queue-updated', onDistributionQueueUpdated);
    return () => {
      window.removeEventListener('distribution-queue-updated', onDistributionQueueUpdated);
    };
  }, [refreshEligibleSummary]);

  useEffect(() => {
    if (!isAuthenticated || route.appRoute !== 'server') {
      return;
    }

    const interval = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      void refreshEligibleSummary();
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isAuthenticated, refreshEligibleSummary, route.appRoute]);

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
    const refreshLocalServerStatus = async () => {
      try {
        const status = await getLocalServerStatus();
        setIsLocalServerRunning(status.running);
      } catch {
        setIsLocalServerRunning(false);
      }
    };

    void refreshLocalServerStatus();

    const onLocalServerStatusChanged = () => {
      void refreshLocalServerStatus();
    };

    window.addEventListener('local-server-status-updated', onLocalServerStatusChanged);
    return () => {
      window.removeEventListener('local-server-status-updated', onLocalServerStatusChanged);
    };
  }, []);

  useEffect(() => {
    if (installerModeSetup.isLoading || !installerModeSetup.mode) {
      return;
    }

    const isClientMode = installerModeSetup.mode === 'CLIENT';
    const hasHash = Boolean(window.location.hash);
    const parsed = parseAppHash(window.location.hash);

    if (!hasHash) {
      window.location.hash = isClientMode ? '#/client/overview' : '#/server/overview';
      return;
    }

    if (isClientMode && parsed.appRoute !== 'client') {
      window.location.hash = '#/client/overview';
      return;
    }

    if (!isClientMode && parsed.appRoute !== 'server') {
      window.location.hash = '#/server/overview';
    }
  }, [installerModeSetup.isLoading, installerModeSetup.mode]);

  useEffect(() => {
    if (!isAuthenticated || route.appRoute !== 'server') {
      return;
    }

    if (!hasEligibleData && route.server.section !== 'overview') {
      window.location.hash = '#/server/overview';
    }
  }, [hasEligibleData, isAuthenticated, route]);

  const navigateServer = useCallback((nextServerRoute: ServerRouteState) => {
    const next = {
      appRoute: 'server' as const,
      server: nextServerRoute,
      client: route.client
    };

    const nextHash = toAppHash(next);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
      return;
    }

    setRoute(next);
  }, [route.client]);

  const handleSetLocale = useCallback(async (nextLocale: SupportedLocale): Promise<void> => {
    if (nextLocale === locale) {
      return;
    }

    const previousLocale = locale;
    setLocale(nextLocale);
    try {
      const persistedLocale = await saveLanguage(nextLocale);
      setLocale(persistedLocale);
    } catch (error) {
      setLocale(previousLocale);
      throw error;
    }
  }, [locale]);

  const runOnlineLoginFlow = useCallback(async () => {
    const ciamResult = await openCiamLogin();

    const exchangeRequest = dispatch(
      authApi.endpoints.exchangeCode.initiate(ciamResult.exchangeKey, { forceRefetch: true })
    );
    let tokenResponse: ExchangeCodeResult;
    try {
      tokenResponse = await exchangeRequest.unwrap();
    } finally {
      exchangeRequest.unsubscribe();
    }

    const jwt = tokenResponse.idToken;
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
        refreshToken: tokenResponse.refreshToken ?? ciamResult.refreshToken,
        exchangeKey: ciamResult.exchangeKey,
        user: profile
      })
    );
    await refreshEligibleSummary();
  }, [dispatch, refreshEligibleSummary]);

  const synchronizeEligibleData = useCallback(async () => {
    const fdpCode = (currentUser?.fdp ?? currentUser?.fieldOffice ?? '').trim();
    if (!fdpCode) {
      throw new Error('Missing FDP code for synchronization.');
    }
    if (!jwt?.trim()) {
      throw new Error('Missing JWT token for synchronization.');
    }

    setIsSynchronizing(true);
    const syncRequest = dispatch(
      eligibleApi.endpoints.getEligibleMembers.initiate(
        { fdpCode, jwt: jwt.trim() },
        { forceRefetch: true }
      )
    );

    try {
      await syncRequest.unwrap();
      await refreshEligibleSummary();
    } finally {
      syncRequest.unsubscribe();
      setIsSynchronizing(false);
    }
  }, [currentUser?.fdp, currentUser?.fieldOffice, dispatch, jwt, refreshEligibleSummary]);

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
      if (!isRtkLikeError(error)) {
        showErrorToast(toErrorMessage(error));
      }
    }
  }, [dispatch, isOnline, runOnlineLoginFlow]);

  const appContent = useMemo(() => {
    if (isHydratingAuth || isHydratingLocale || installerModeSetup.isLoading) {
      return null;
    }

    if (installerModeSetup.mode === 'CLIENT') {
      if (route.appRoute !== 'client') {
        return <DashboardPage />;
      }

      return <ClientPage route={route.client} onNavigate={(nextRoute) => {
        const next = {
          appRoute: 'client' as const,
          server: route.server,
          client: nextRoute
        };

        const nextHash = toAppHash(next);
        if (window.location.hash !== nextHash) {
          window.location.hash = nextHash;
          return;
        }

        setRoute(next);
      }} />;
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
        hasEligibleData={hasEligibleData}
        overviewSummary={eligibleOverviewSummary}
        isSynchronizing={isSynchronizing}
        isSynchronizeDisabled={!isOnline || eligibleOverviewSummary.pendingDistributionCount > 0}
        onSynchronize={() => {
          void (async () => {
            try {
              await synchronizeEligibleData();
            } catch (error) {
              if (!isRtkLikeError(error)) {
                showErrorToast(toErrorMessage(error));
              }
            }
          })();
        }}
        pendingDistributionCount={eligibleOverviewSummary.pendingDistributionCount}
        userEmail={currentUser?.email ?? ''}
        isOnline={isOnline}
        isLocalServerRunning={isLocalServerRunning}
        authActionLabel={isOnline ? 'Logout' : 'Login'}
        onAuthAction={() => {
          void handleServerAuthAction();
        }}
      />
    );
  }, [
    currentUser?.email,
    eligibleOverviewSummary,
    handleServerAuthAction,
    hasEligibleData,
    installerModeSetup.isLoading,
    installerModeSetup.mode,
    isAuthenticated,
    isHydratingAuth,
    isHydratingLocale,
    isLocalServerRunning,
    isOnline,
    isSynchronizing,
    navigateServer,
    route,
    synchronizeEligibleData
  ]);

  const localeContextValue = useMemo(() => {
    return {
      locale,
      setLocale: handleSetLocale
    };
  }, [handleSetLocale, locale]);

  return (
    <IntlProvider locale={locale} messages={MESSAGES_BY_LOCALE[locale]} defaultLocale="en">
      <LocaleContext.Provider value={localeContextValue}>
        <AppUpdateNotifications />
        {appContent}
        <InstallerModeModal
          isOpen={!installerModeSetup.isLoading && !installerModeSetup.isLocked}
          isSubmitting={installerModeSetup.isSubmitting}
          errorMessage={installerModeSetup.errorMessage}
          onConfirm={installerModeSetup.setMode}
        />
      </LocaleContext.Provider>
    </IntlProvider>
  );
}
