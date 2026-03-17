import { useEffect, useState } from 'react';
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
      toast.success('Saved', {
        description: 'Printing configuration updated.'
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
      toast.success('Database reset', {
        description: 'All local data has been cleared.'
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
      <h1 className="server-page-title">Configuration</h1>
      <div className="configuration-layout">
        <aside className="configuration-sidebar">
          <button
            type="button"
            className={route.configurationTab === 'connection' ? 'configuration-tab active' : 'configuration-tab'}
            onClick={() => navigateToConfigurationTab(route, onNavigate, 'connection')}
          >
            Connection
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
            className={route.configurationTab === 'developer' ? 'configuration-tab active' : 'configuration-tab'}
            onClick={() => navigateToConfigurationTab(route, onNavigate, 'developer')}
          >
            Developer
          </button>
        </aside>

        {route.configurationTab === 'connection' ? (
          <div className="configuration-form">
            <label className="server-form-label">
              Server IP
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
              Port
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
              Password
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
              Alias
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

            <p className="server-form-muted">Status: {isConnected ? 'Connected' : 'Disconnected'}</p>

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
              {isSubmittingConnection ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
            </Button>
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

        {route.configurationTab === 'developer' ? (
          <div className="configuration-form">
            <p className="server-form-label">Development only</p>
            <p className="server-form-muted">
              Reset will clear all local tables (eligible data, users, distributions, client history
              and runtime configuration).
            </p>
            <Button
              className="server-btn server-start-btn"
              onClick={() => {
                setIsResetConfirmOpen(true);
              }}
            >
              RESET
            </Button>
          </div>
        ) : null}
      </div>

      {isResetConfirmOpen ? (
        <div className="distribution-modal-backdrop" role="presentation">
          <div className="distribution-modal" role="dialog" aria-modal="true">
            <h2>Confirm Reset</h2>
            <p>This action will wipe local database data. Continue?</p>
            <div className="distribution-modal-actions">
              <Button
                className="min-w-[124px]"
                onClick={() => void handleResetDatabase()}
                disabled={isResetting}
              >
                {isResetting ? 'Resetting...' : 'Reset'}
              </Button>
              <Button
                variant="outline"
                className="min-w-[124px]"
                onClick={() => {
                  setIsResetConfirmOpen(false);
                }}
                disabled={isResetting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
