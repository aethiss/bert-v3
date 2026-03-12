import { Server as ServerIcon } from 'lucide-react';
import { Button } from '@ui/components/ui/button';
import { Input } from '@ui/components/ui/input';
import { Select } from '@ui/components/ui/select';
import type {
  ConfigurationTab,
  ServerRouteState,
  ServerRouteComponentProps
} from '@renderer/components/server/types';

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
        ) : (
          <div className="server-placeholder" />
        )}
      </div>
    </section>
  );
}
