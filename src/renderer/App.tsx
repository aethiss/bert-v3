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
import { useAppSelector } from '@renderer/store/hooks';
import { selectIsAuthenticated } from '@renderer/store/selectors/authSelectors';

export function App() {
  const installerModeSetup = useInstallerModeSetup();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const [route, setRoute] = useState<ParsedRoute>(() => parseAppHash(window.location.hash));

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

  const appContent = useMemo(() => {
    if (!isAuthenticated) {
      return <LoginPage />;
    }

    if (route.appRoute === 'client') {
      return <DashboardPage />;
    }

    return <ServerPage route={route.server} onNavigate={navigateServer} />;
  }, [isAuthenticated, navigateServer, route]);

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
