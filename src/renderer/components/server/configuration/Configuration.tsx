import { useEffect, useMemo, useState } from 'react';
import { Server as ServerIcon, Square as StopIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@ui/components/ui/button';
import { Input } from '@ui/components/ui/input';
import { Select } from '@ui/components/ui/select';
import { showErrorToast } from '@renderer/lib/errorToast';
import { getInstallerModeState } from '@renderer/services/installerService';
import {
  getLocalServerSettings,
  getLocalServerStatus,
  getPrintSettings,
  getServerInterfaces,
  saveLocalServerSettings,
  savePrintSettings,
  startLocalServer,
  stopLocalServer
} from '@renderer/services/configService';
import type {
  ConfigurationTab,
  ServerRouteState,
  ServerRouteComponentProps
} from '@renderer/components/server/types';
import type { AppMode } from '@shared/types/appMode';
import type { LocalServerInterfaceInfo, LocalServerSettings } from '@shared/types/localServer';
import type { PrintFormat } from '@shared/types/printConfig';

function navigateToConfigurationTab(
  route: ServerRouteState,
  onNavigate: (nextRoute: ServerRouteState) => void,
  tab: ConfigurationTab
) {
  onNavigate({
    ...route,
    section: 'configuration',
    configurationTab: tab
  });
}

function toInterfaceOptionValue(networkInterface: LocalServerInterfaceInfo): string {
  return `${networkInterface.name}::${networkInterface.address}`;
}

export function Configuration({ route, onNavigate }: ServerRouteComponentProps) {
  const [printFormat, setPrintFormat] = useState<PrintFormat>('A5');
  const [printDisabled, setPrintDisabled] = useState(false);
  const [isLoadingPrintSettings, setIsLoadingPrintSettings] = useState(false);
  const [isSavingPrintSettings, setIsSavingPrintSettings] = useState(false);

  const [serverInterfaces, setServerInterfaces] = useState<LocalServerInterfaceInfo[]>([]);
  const [serverSettings, setServerSettings] = useState<LocalServerSettings>({
    interfaceName: '',
    bindIp: '0.0.0.0',
    port: 4860,
    oneTimePassword: ''
  });
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [activeClientCount, setActiveClientCount] = useState(0);
  const [isLoadingServerTab, setIsLoadingServerTab] = useState(false);
  const [isSavingServerSettings, setIsSavingServerSettings] = useState(false);
  const [isTogglingServer, setIsTogglingServer] = useState(false);
  const [appMode, setAppMode] = useState<AppMode | null>(null);

  useEffect(() => {
    if (route.configurationTab !== 'printer') {
      return;
    }

    let isMounted = true;
    setIsLoadingPrintSettings(true);
    void getPrintSettings()
      .then((settings) => {
        if (!isMounted) {
          return;
        }
        setPrintFormat(settings.format);
        setPrintDisabled(settings.disabled);
      })
      .catch((error) => {
        showErrorToast(error);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingPrintSettings(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [route.configurationTab]);

  useEffect(() => {
    if (route.configurationTab !== 'server') {
      return;
    }

    let isMounted = true;
    setIsLoadingServerTab(true);

    void Promise.all([getServerInterfaces(), getLocalServerSettings(), getLocalServerStatus()])
      .then(async ([interfaces, settings, status]) => {
        if (!isMounted) {
          return;
        }

        setServerInterfaces(interfaces);
        setServerSettings((previous) => {
          const preferred =
            interfaces.find(
              (item) =>
                item.name === settings.interfaceName &&
                item.address === settings.bindIp
            ) ??
            interfaces.find((item) => item.address === settings.bindIp) ??
            interfaces.find((item) => !item.internal) ??
            interfaces[0];

          if (!preferred) {
            return settings;
          }

          return {
            ...settings,
            interfaceName: preferred.name,
            bindIp: preferred.address,
            oneTimePassword: settings.oneTimePassword || previous.oneTimePassword
          };
        });

        setIsServerRunning(status.running);
        setActiveClientCount(status.activeClients);
        const modeState = await getInstallerModeState();
        if (isMounted) {
          setAppMode(modeState.mode);
        }
      })
      .catch((error) => {
        showErrorToast(error);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingServerTab(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [route.configurationTab]);

  const selectedInterfaceValue = useMemo(() => {
    return toInterfaceOptionValue({
      name: serverSettings.interfaceName,
      address: serverSettings.bindIp,
      family: 'IPv4',
      internal: false
    });
  }, [serverSettings.bindIp, serverSettings.interfaceName]);

  const handleSavePrintSettings = async (): Promise<void> => {
    setIsSavingPrintSettings(true);
    try {
      await savePrintSettings({
        format: printFormat,
        disabled: printDisabled
      });
      toast.success('Saved', {
        description: 'Printing configuration updated.'
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsSavingPrintSettings(false);
    }
  };

  const handleSaveServerSettings = async (): Promise<void> => {
    setIsSavingServerSettings(true);
    try {
      const nextSettings = {
        ...serverSettings,
        oneTimePassword: serverSettings.oneTimePassword.trim()
      };
      const saved = await saveLocalServerSettings(nextSettings);
      setServerSettings(saved);
      toast.success('Saved', {
        description: 'Server configuration updated.'
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsSavingServerSettings(false);
    }
  };

  const handleToggleServer = async (): Promise<void> => {
    setIsTogglingServer(true);
    try {
      if (isServerRunning) {
        const status = await stopLocalServer();
        setIsServerRunning(status.running);
        setActiveClientCount(status.activeClients);
        window.dispatchEvent(new Event('local-server-status-updated'));
        toast.success('Stopped', {
          description: 'Local server has been stopped.'
        });
        return;
      }

      const status = await startLocalServer({
        ...serverSettings,
        oneTimePassword: serverSettings.oneTimePassword.trim()
      });
      setIsServerRunning(status.running);
      setActiveClientCount(status.activeClients);
      window.dispatchEvent(new Event('local-server-status-updated'));
      toast.success('Running', {
        description: `Local server is listening on ${status.bindIp}:${status.port}.`
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsTogglingServer(false);
    }
  };

  return (
    <section className="server-content-block">
      <h1 className="server-page-title">Configuration</h1>
      <div className="configuration-layout">
        <aside className="configuration-sidebar">
          <button
            type="button"
            className={route.configurationTab === 'server' ? 'configuration-tab active' : 'configuration-tab'}
            onClick={() => navigateToConfigurationTab(route, onNavigate, 'server')}
          >
            Server
          </button>
          <button
            type="button"
            className={route.configurationTab === 'printer' ? 'configuration-tab active' : 'configuration-tab'}
            onClick={() => navigateToConfigurationTab(route, onNavigate, 'printer')}
          >
            Printer
          </button>
          <button
            type="button"
            className={route.configurationTab === 'log' ? 'configuration-tab active' : 'configuration-tab'}
            onClick={() => navigateToConfigurationTab(route, onNavigate, 'log')}
          >
            Log
          </button>
        </aside>

        {route.configurationTab === 'server' ? (
          <div className="configuration-form">
            <label className="server-form-label">
              Interface
              <Select
                className="server-form-control"
                value={selectedInterfaceValue}
                disabled={isLoadingServerTab || isSavingServerSettings || isTogglingServer}
                onChange={(event) => {
                  const [name, address] = event.target.value.split('::');
                  setServerSettings((previous) => ({
                    ...previous,
                    interfaceName: name ?? previous.interfaceName,
                    bindIp: address ?? previous.bindIp
                  }));
                }}
              >
                {serverInterfaces.map((networkInterface) => (
                  <option
                    key={toInterfaceOptionValue(networkInterface)}
                    value={toInterfaceOptionValue(networkInterface)}
                  >
                    {networkInterface.name} - {networkInterface.address}
                  </option>
                ))}
              </Select>
            </label>

            <div className="server-form-display">
              <p className="server-form-label">IP Address</p>
              <p className="server-form-muted">{serverSettings.bindIp || 'N/A'}</p>
            </div>

            <hr className="server-divider" />

            <label className="server-form-label">
              Port
              <Input
                className="server-form-control"
                inputMode="numeric"
                value={String(serverSettings.port)}
                disabled={isLoadingServerTab || isSavingServerSettings || isTogglingServer}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '');
                  setServerSettings((previous) => ({
                    ...previous,
                    port: digits ? Number(digits) : 0
                  }));
                }}
              />
            </label>

            <label className="server-form-label">
              One Time Password
              <Input
                className="server-form-control"
                value={serverSettings.oneTimePassword}
                disabled={isLoadingServerTab || isSavingServerSettings || isTogglingServer}
                onChange={(event) => {
                  setServerSettings((previous) => ({
                    ...previous,
                    oneTimePassword: event.target.value
                  }));
                }}
              />
            </label>

            <p className="server-form-muted">
              Status: {isServerRunning ? 'Running' : 'Stopped'} | Connected clients: {activeClientCount}
            </p>
            <p className="server-form-muted">App Mode: {appMode ?? 'N/A'}</p>

            <div className="configuration-server-actions">
              <Button
                className="server-btn server-start-btn"
                onClick={() => void handleSaveServerSettings()}
                disabled={isLoadingServerTab || isSavingServerSettings || isTogglingServer}
              >
                {isSavingServerSettings ? 'Saving...' : 'Save'}
              </Button>
              <Button
                className="server-btn server-start-btn"
                onClick={() => void handleToggleServer()}
                disabled={
                  isLoadingServerTab ||
                  isSavingServerSettings ||
                  isTogglingServer ||
                  (!isServerRunning &&
                    (!serverSettings.bindIp || !serverSettings.port || !serverSettings.oneTimePassword.trim()))
                }
              >
                {isServerRunning ? (
                  <>
                    <StopIcon size={14} />
                    {isTogglingServer ? 'Stopping...' : 'Stop Server'}
                  </>
                ) : (
                  <>
                    <ServerIcon size={14} />
                    {isTogglingServer ? 'Starting...' : 'Start Server'}
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}

        {route.configurationTab === 'printer' ? (
          <div className="configuration-form">
            <label className="server-form-label">
              Printing Size
              <Select
                className="server-form-control"
                value={printFormat}
                disabled={isLoadingPrintSettings || isSavingPrintSettings}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (nextValue === 'A5' || nextValue === '80mm' || nextValue === '58mm') {
                    setPrintFormat(nextValue);
                  }
                }}
              >
                <option value="A5">A5</option>
                <option value="80mm">80mm</option>
                <option value="58mm">58mm</option>
              </Select>
            </label>

            <section className="printing-disable-card">
              <div className="printing-disable-content">
                <h3>Disable Printing</h3>
                <p>
                  This option will allow the application to continue distributions without default
                  printing.
                </p>
              </div>
              <label className="printing-switch">
                <input
                  type="checkbox"
                  checked={printDisabled}
                  disabled={isLoadingPrintSettings || isSavingPrintSettings}
                  onChange={(event) => {
                    setPrintDisabled(event.target.checked);
                  }}
                />
                <span aria-hidden="true" />
              </label>
            </section>

            <Button
              className="server-btn server-start-btn"
              onClick={() => void handleSavePrintSettings()}
              disabled={isLoadingPrintSettings || isSavingPrintSettings}
            >
              {isSavingPrintSettings ? 'Saving...' : 'Save'}
            </Button>
          </div>
        ) : null}

        {route.configurationTab === 'log' ? (
          <div className="server-placeholder" />
        ) : null}
      </div>
    </section>
  );
}
