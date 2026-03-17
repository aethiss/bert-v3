import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@ui/components/ui/input';
import { Select } from '@ui/components/ui/select';
import type { ClientConnectionSettings } from '@shared/types/localServer';
import type { PrintFormat } from '@shared/types/printConfig';
import type {
  ClientConfigurationTab,
  ClientRouteState,
  ClientRouteComponentProps
} from '@renderer/components/client/types';
import {
  getPrintSettings,
  resetDatabaseForDevelopment,
  savePrintSettings
} from '@renderer/services/configService';
import { showErrorToast } from '@renderer/lib/errorToast';

interface ClientConfigurationProps extends ClientRouteComponentProps {
  settings: ClientConnectionSettings;
  isConnected: boolean;
  isSubmittingConnection: boolean;
  onChangeSettings: (settings: ClientConnectionSettings) => void;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
  onAfterReset: () => void;
}

function navigateToConfigurationTab(
  route: ClientRouteState,
  onNavigate: (nextRoute: ClientRouteState) => void,
  tab: ClientConfigurationTab
) {
  onNavigate({
    ...route,
    section: 'configuration',
    configurationTab: tab
  });
}

export function Configuration({
  route,
  onNavigate,
  settings,
  isConnected,
  isSubmittingConnection,
  onChangeSettings,
  onConnect,
  onDisconnect,
  onAfterReset
}: ClientConfigurationProps) {
  const intl = useIntl();
  const [printFormat, setPrintFormat] = useState<PrintFormat>('A5');
  const [printDisabled, setPrintDisabled] = useState(false);
  const [isLoadingPrintSettings, setIsLoadingPrintSettings] = useState(false);
  const [isSavingPrintSettings, setIsSavingPrintSettings] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (route.configurationTab !== 'printer') {
      return;
    }

    let mounted = true;
    setIsLoadingPrintSettings(true);

    void getPrintSettings()
      .then((loaded) => {
        if (!mounted) {
          return;
        }
        setPrintFormat(loaded.format);
        setPrintDisabled(loaded.disabled);
      })
      .catch((error) => {
        if (mounted) {
          showErrorToast(error);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingPrintSettings(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [route.configurationTab]);

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

  const handleResetDatabase = async (): Promise<void> => {
    setIsResetting(true);
    try {
      await resetDatabaseForDevelopment();
      toast.success(intl.formatMessage({ id: 'common.reset' }), {
        description: intl.formatMessage({ id: 'config.databaseReset.description' })
      });
      setIsResetConfirmOpen(false);
      onAfterReset();
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
            className={route.configurationTab === 'connection' ? 'configuration-tab active' : 'configuration-tab'}
            onClick={() => navigateToConfigurationTab(route, onNavigate, 'connection')}
          >
            {intl.formatMessage({ id: 'config.tabs.connection' })}
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
            className={route.configurationTab === 'developer' ? 'configuration-tab active' : 'configuration-tab'}
            onClick={() => navigateToConfigurationTab(route, onNavigate, 'developer')}
          >
            {intl.formatMessage({ id: 'config.tabs.developer' })}
          </button>
        </aside>

        {route.configurationTab === 'connection' ? (
          <div className="configuration-form">
            <label className="server-form-label">
              {intl.formatMessage({ id: 'config.connection.serverIp' })}
              <Input
                className="server-form-control"
                value={settings.serverIp}
                onChange={(event) => {
                  onChangeSettings({
                    ...settings,
                    serverIp: event.target.value
                  });
                }}
              />
            </label>

            <label className="server-form-label">
              {intl.formatMessage({ id: 'config.connection.port' })}
              <Input
                className="server-form-control"
                inputMode="numeric"
                value={String(settings.serverPort)}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '');
                  onChangeSettings({
                    ...settings,
                    serverPort: digits ? Number(digits) : 0
                  });
                }}
              />
            </label>

            <label className="server-form-label">
              {intl.formatMessage({ id: 'config.connection.password' })}
              <Input
                className="server-form-control"
                value={settings.oneTimePassword}
                onChange={(event) => {
                  onChangeSettings({
                    ...settings,
                    oneTimePassword: event.target.value
                  });
                }}
              />
            </label>

            <label className="server-form-label">
              {intl.formatMessage({ id: 'config.connection.alias' })}
              <Input
                className="server-form-control"
                maxLength={128}
                value={settings.alias}
                onChange={(event) => {
                  onChangeSettings({
                    ...settings,
                    alias: event.target.value
                  });
                }}
              />
            </label>

            <p className="server-form-muted">
              {intl.formatMessage(
                { id: 'config.connection.stateLine' },
                {
                  status: isConnected
                    ? intl.formatMessage({ id: 'config.connection.connected' })
                    : intl.formatMessage({ id: 'config.connection.disconnected' })
                }
              )}
            </p>

            <Button
              className="server-btn server-start-btn"
              onClick={() => {
                if (isConnected) {
                  onDisconnect();
                  return;
                }
                void onConnect();
              }}
              disabled={
                isSubmittingConnection ||
                (!isConnected &&
                  (!settings.serverIp.trim() ||
                    !settings.serverPort ||
                    !settings.oneTimePassword.trim() ||
                    !settings.alias.trim()))
              }
            >
              {isSubmittingConnection
                ? intl.formatMessage({ id: 'config.connection.connecting' })
                : isConnected
                  ? intl.formatMessage({ id: 'actions.disconnect' })
                  : intl.formatMessage({ id: 'actions.connect' })}
            </Button>
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
                <p>{intl.formatMessage({ id: 'config.printer.disableDescription' })}</p>
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
