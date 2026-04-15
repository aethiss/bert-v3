import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { TopNavigation } from '@renderer/components/client/common/TopNavigation';
import { resolveClientNavItems } from '@renderer/components/client/navigation/navigation';
import { Overview } from '@renderer/components/client/overview/Overview';
import { Distribution } from '@renderer/components/client/distribution/Distribution';
import { Configuration } from '@renderer/components/client/configuration/Configuration';
import type { ClientRouteState } from '@renderer/components/client/types';
import type { ClientConnectionSettings } from '@shared/types/localServer';
import type { ClientSession } from '@renderer/services/clientServerService';
import {
  getClientConnectionSettings,
  saveClientConnectionSettings
} from '@renderer/services/configService';
import { loginToLocalServer, pingLocalServer } from '@renderer/services/clientServerService';
import { showErrorToast } from '@renderer/lib/errorToast';

interface ClientPageProps {
  route: ClientRouteState;
  appVersion: string;
  onNavigate: (nextRoute: ClientRouteState) => void;
}

const DEFAULT_CONNECTION_SETTINGS: ClientConnectionSettings = {
  serverIp: '',
  serverPort: 4860,
  oneTimePassword: '',
  alias: ''
};

export function ClientPage({ route, appVersion, onNavigate }: ClientPageProps) {
  const intl = useIntl();
  const [settings, setSettings] = useState<ClientConnectionSettings>(DEFAULT_CONNECTION_SETTINGS);
  const [session, setSession] = useState<ClientSession | null>(null);
  const [isSubmittingConnection, setIsSubmittingConnection] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getClientConnectionSettings()
      .then((persisted) => {
        if (!mounted) {
          return;
        }
        setSettings(persisted);
      })
      .catch((error) => {
        if (mounted) {
          showErrorToast(error);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    const interval = window.setInterval(() => {
      void pingLocalServer(session).catch((error) => {
        setSession(null);
        showErrorToast(error);
      });
    }, 20_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [session]);

  useEffect(() => {
    if (!session && route.section === 'distribution') {
      onNavigate({
        ...route,
        section: 'overview',
        distributionMode: 'search'
      });
    }
  }, [onNavigate, route, session]);

  const handleConnect = useCallback(async (): Promise<void> => {
    setIsSubmittingConnection(true);
    try {
      const normalized: ClientConnectionSettings = {
        serverIp: settings.serverIp.trim(),
        serverPort: settings.serverPort,
        oneTimePassword: settings.oneTimePassword.trim(),
        alias: settings.alias.trim()
      };

      const nextSession = await loginToLocalServer(normalized);
      await saveClientConnectionSettings(normalized);
      setSession(nextSession);
      toast.success(intl.formatMessage({ id: 'config.connection.connected' }), {
        description: intl.formatMessage(
          { id: 'config.connection.connectedDescription' },
          { host: nextSession.host }
        )
      });

      if (route.section === 'configuration') {
        onNavigate({
          ...route,
          section: 'overview'
        });
      }
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsSubmittingConnection(false);
    }
  }, [intl, onNavigate, route, settings]);

  const handleDisconnect = useCallback(() => {
    setSession(null);
    toast.success(intl.formatMessage({ id: 'config.connection.disconnected' }), {
      description: intl.formatMessage({ id: 'config.connection.disconnectedDescription' })
    });
  }, [intl]);

  const content = useMemo(() => {
    if (route.section === 'distribution') {
      return <Distribution route={route} onNavigate={onNavigate} session={session} />;
    }

    if (route.section === 'configuration') {
      return (
        <Configuration
          route={route}
          onNavigate={onNavigate}
          settings={settings}
          isConnected={Boolean(session)}
          isSubmittingConnection={isSubmittingConnection}
          onChangeSettings={setSettings}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onAfterReset={() => {
            setSession(null);
            setSettings(DEFAULT_CONNECTION_SETTINGS);
            onNavigate({
              ...route,
              section: 'overview',
              configurationTab: 'connection'
            });
          }}
        />
      );
    }

    return (
      <Overview
        isConnected={Boolean(session)}
        alias={session?.alias ?? settings.alias}
        onNavigateToConnection={() => {
          onNavigate({
            ...route,
            section: 'configuration',
            configurationTab: 'connection'
          });
        }}
      />
    );
  }, [
    handleConnect,
    handleDisconnect,
    isSubmittingConnection,
    onNavigate,
    route,
    session,
    settings,
    setSettings
  ]);

  return (
    <main className="server-page">
      <section className="server-shell">
        <TopNavigation
          items={resolveClientNavItems()}
          activeSection={route.section}
          appVersion={appVersion}
          isConnected={Boolean(session)}
          connectedHost={session?.host ?? 'HOST'}
          alias={session?.alias ?? ''}
          onConnectionAction={() => {
            if (session) {
              handleDisconnect();
              return;
            }

            onNavigate({
              ...route,
              section: 'configuration',
              configurationTab: 'connection'
            });
          }}
          onSelect={(section) => {
            onNavigate({
              ...route,
              section
            });
          }}
        />
        {content}
      </section>
    </main>
  );
}
