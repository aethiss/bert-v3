import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Server as ServerIcon, Square as StopIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@ui/components/ui/input';
import { Select } from '@ui/components/ui/select';
import { showErrorToast } from '@renderer/lib/errorToast';
import { getInstallerModeState } from '@renderer/services/installerService';
import {
  getLocalServerSettings,
  getLocalServerStatus,
  getPrintSettings,
  resetDatabaseForDevelopment,
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
import { LanguageSettings } from '@renderer/components/server/configuration/LanguageSettings';
import { UpdateSettings } from '@renderer/components/shared/configuration/UpdateSettings';
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
  const intl = useIntl();
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
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

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
      toast.success(intl.formatMessage({ id: 'common.saved' }), {
        description: intl.formatMessage({ id: 'config.printer.updatedDescription' })
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
      toast.success(intl.formatMessage({ id: 'common.saved' }), {
        description: intl.formatMessage({ id: 'config.server.updatedDescription' })
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
        toast.success(intl.formatMessage({ id: 'config.server.stop' }), {
          description: intl.formatMessage({ id: 'config.server.stoppedDescription' })
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
      toast.success(intl.formatMessage({ id: 'config.server.running' }), {
        description: intl.formatMessage(
          { id: 'config.server.runningDescription' },
          { bindIp: status.bindIp, port: status.port }
        )
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsTogglingServer(false);
    }
  };

  const handleResetDatabase = async (): Promise<void> => {
    setIsResetting(true);
    try {
      await resetDatabaseForDevelopment();
      window.dispatchEvent(new Event('distribution-queue-updated'));
      window.dispatchEvent(new Event('local-server-status-updated'));
      toast.success(intl.formatMessage({ id: 'common.reset' }), {
        description: intl.formatMessage({ id: 'config.databaseReset.description' })
      });
      setIsResetConfirmOpen(false);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <section className="server-content-block">
      <h1 className="server-page-title">{intl.formatMessage({ id: 'config.title' })}</h1>
      <div className="configuration-layout">
        <aside className="configuration-sidebar">
          <button
            type="button"
            className={route.configurationTab === 'server' ? 'configuration-tab active' : 'configuration-tab'}
            onClick={() => navigateToConfigurationTab(route, onNavigate, 'server')}
          >
            {intl.formatMessage({ id: 'config.tabs.server' })}
          </button>
          <button
            type="button"
            className={route.configurationTab === 'printer' ? 'configuration-tab active' : 'configuration-tab'}
            onClick={() => navigateToConfigurationTab(route, onNavigate, 'printer')}
          >
            {intl.formatMessage({ id: 'config.tabs.printer' })}
          </button>
          <button
            type="button"
            className={route.configurationTab === 'log' ? 'configuration-tab active' : 'configuration-tab'}
            onClick={() => navigateToConfigurationTab(route, onNavigate, 'log')}
          >
            {intl.formatMessage({ id: 'config.tabs.log' })}
          </button>
          <button
            type="button"
            className={route.configurationTab === 'language' ? 'configuration-tab active' : 'configuration-tab'}
            onClick={() => navigateToConfigurationTab(route, onNavigate, 'language')}
          >
            {intl.formatMessage({ id: 'config.tabs.language' })}
          </button>
          <button
            type="button"
            className={route.configurationTab === 'updates' ? 'configuration-tab active' : 'configuration-tab'}
            onClick={() => navigateToConfigurationTab(route, onNavigate, 'updates')}
          >
            {intl.formatMessage({ id: 'config.tabs.updates' })}
          </button>
          <button
            type="button"
            className={route.configurationTab === 'developer' ? 'configuration-tab active' : 'configuration-tab'}
            onClick={() => navigateToConfigurationTab(route, onNavigate, 'developer')}
          >
            {intl.formatMessage({ id: 'config.tabs.developer' })}
          </button>
        </aside>

        {route.configurationTab === 'server' ? (
          <div className="configuration-form">
            <label className="server-form-label">
              {intl.formatMessage({ id: 'config.server.interface' })}
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
              <p className="server-form-label">{intl.formatMessage({ id: 'config.server.ipAddress' })}</p>
              <p className="server-form-muted">
                {serverSettings.bindIp || intl.formatMessage({ id: 'common.na' })}
              </p>
            </div>

            <hr className="server-divider" />

            <label className="server-form-label">
              {intl.formatMessage({ id: 'config.server.port' })}
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
              {intl.formatMessage({ id: 'config.server.otp' })}
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
              {intl.formatMessage(
                { id: 'config.server.statusLine' },
                {
                  status: isServerRunning
                    ? intl.formatMessage({ id: 'config.server.running' })
                    : intl.formatMessage({ id: 'config.server.stopped' }),
                  activeClients: activeClientCount
                }
              )}
            </p>
            <p className="server-form-muted">
              {intl.formatMessage(
                { id: 'config.server.appModeLine' },
                { mode: appMode ?? intl.formatMessage({ id: 'common.na' }) }
              )}
            </p>

            <div className="configuration-server-actions">
              <Button
                className="server-btn server-start-btn"
                onClick={() => void handleSaveServerSettings()}
                disabled={isLoadingServerTab || isSavingServerSettings || isTogglingServer}
              >
                {isSavingServerSettings
                  ? intl.formatMessage({ id: 'common.saving' })
                  : intl.formatMessage({ id: 'common.save' })}
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
                    {isTogglingServer
                      ? intl.formatMessage({ id: 'config.server.stopping' })
                      : intl.formatMessage({ id: 'config.server.stop' })}
                  </>
                ) : (
                  <>
                    <ServerIcon size={14} />
                    {isTogglingServer
                      ? intl.formatMessage({ id: 'config.server.starting' })
                      : intl.formatMessage({ id: 'config.server.start' })}
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}

        {route.configurationTab === 'printer' ? (
          <div className="configuration-form">
            <label className="server-form-label">
              {intl.formatMessage({ id: 'config.printer.size' })}
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
                <h3>{intl.formatMessage({ id: 'config.printer.disableTitle' })}</h3>
                <p>
                  {intl.formatMessage({ id: 'config.printer.disableDescription' })}
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
              {isSavingPrintSettings
                ? intl.formatMessage({ id: 'common.saving' })
                : intl.formatMessage({ id: 'common.save' })}
            </Button>
          </div>
        ) : null}

        {route.configurationTab === 'log' ? (
          <div className="server-placeholder" />
        ) : null}

        {route.configurationTab === 'language' ? (
          <LanguageSettings />
        ) : null}

        {route.configurationTab === 'updates' ? (
          <UpdateSettings />
        ) : null}

        {route.configurationTab === 'developer' ? (
          <div className="configuration-form">
            <p className="server-form-label">{intl.formatMessage({ id: 'config.developer.title' })}</p>
            <p className="server-form-muted">{intl.formatMessage({ id: 'config.developer.description' })}</p>
            <Button
              className="server-btn server-start-btn"
              onClick={() => {
                setIsResetConfirmOpen(true);
              }}
            >
              {intl.formatMessage({ id: 'config.developer.resetButton' })}
            </Button>
          </div>
        ) : null}
      </div>

      {isResetConfirmOpen ? (
        <div className="distribution-modal-backdrop" role="presentation">
          <div className="distribution-modal" role="dialog" aria-modal="true">
            <h2>{intl.formatMessage({ id: 'config.reset.confirmTitle' })}</h2>
            <p>{intl.formatMessage({ id: 'config.reset.confirmDescription' })}</p>
            <div className="distribution-modal-actions">
              <Button
                className="min-w-[124px]"
                onClick={() => void handleResetDatabase()}
                disabled={isResetting}
              >
                {isResetting
                  ? intl.formatMessage({ id: 'common.resetting' })
                  : intl.formatMessage({ id: 'common.reset' })}
              </Button>
              <Button
                variant="outline"
                className="min-w-[124px]"
                onClick={() => {
                  setIsResetConfirmOpen(false);
                }}
                disabled={isResetting}
              >
                {intl.formatMessage({ id: 'common.cancel' })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
