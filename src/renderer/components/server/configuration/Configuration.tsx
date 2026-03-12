import { useEffect, useState } from 'react';
import { Server as ServerIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@ui/components/ui/button';
import { Input } from '@ui/components/ui/input';
import { Select } from '@ui/components/ui/select';
import { showErrorToast } from '@renderer/lib/errorToast';
import { getPrintSettings, savePrintSettings } from '@renderer/services/configService';
import type {
  ConfigurationTab,
  ServerRouteState,
  ServerRouteComponentProps
} from '@renderer/components/server/types';
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

export function Configuration({ route, onNavigate }: ServerRouteComponentProps) {
  const [printFormat, setPrintFormat] = useState<PrintFormat>('A5');
  const [printDisabled, setPrintDisabled] = useState(false);
  const [isLoadingPrintSettings, setIsLoadingPrintSettings] = useState(false);
  const [isSavingPrintSettings, setIsSavingPrintSettings] = useState(false);

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
              <Select className="server-form-control" defaultValue="wifi">
                <option value="wifi">Wifi - 10.0.0.1</option>
              </Select>
            </label>

            <div className="server-form-display">
              <p className="server-form-label">IP Address</p>
              <p className="server-form-muted">10.0.0.1</p>
            </div>

            <hr className="server-divider" />

            <label className="server-form-label">
              Port
              <Input className="server-form-control" defaultValue="3000" />
            </label>

            <label className="server-form-label">
              Password
              <Input className="server-form-control" defaultValue="Password" />
            </label>

            <Button className="server-btn server-start-btn">
              <ServerIcon size={14} />
              Start Server
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

        {route.configurationTab === 'log' ? (
          <div className="server-placeholder" />
        ) : null}
      </div>
    </section>
  );
}
