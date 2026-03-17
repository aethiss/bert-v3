import { Link2, Printer } from 'lucide-react';
import { Button } from '@ui/components/ui/button';
import type { ClientSection } from '@renderer/components/client/types';

export interface ClientTopNavItem {
  id: ClientSection;
  label: string;
}

interface ClientTopNavigationProps {
  items: ClientTopNavItem[];
  activeSection: ClientSection;
  isConnected: boolean;
  connectedHost: string;
  alias: string;
  onSelect: (section: ClientSection) => void;
  onConnectionAction: () => void;
}

export function TopNavigation({
  items,
  activeSection,
  isConnected,
  connectedHost,
  alias,
  onSelect,
  onConnectionAction
}: ClientTopNavigationProps) {
  return (
    <header className="server-top-nav">
      <div className="server-brand">
        <img
          className="server-brand-logo"
          src="https://uikit.wfp.org/cdn/logos/latest/wfp-logo-emblem-blue-all.svg"
          alt="World Food Programme"
        />
        <span className="server-brand-name">BeRT-Client</span>
        <span className="server-brand-version">v2</span>
      </div>

      <nav className="server-main-nav" aria-label="Client navigation">
        {items.map((item) => {
          const isDisabled = !isConnected && item.id === 'distribution';
          return (
            <button
              key={item.id}
              type="button"
              className={
                item.id === activeSection
                  ? `server-nav-item active${isDisabled ? ' disabled' : ''}`
                  : `server-nav-item${isDisabled ? ' disabled' : ''}`
              }
              onClick={() => {
                if (!isDisabled) {
                  onSelect(item.id);
                }
              }}
              disabled={isDisabled}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="server-status-area">
        <div className="server-status ready">
          <Printer size={14} />
          <span>Ready</span>
        </div>
        <div className={isConnected ? 'server-status online' : 'server-status offline'}>
          <Link2 size={14} />
          <span>{isConnected ? `Connected to ${connectedHost}` : 'Disconnected'}</span>
        </div>
        {isConnected && alias ? (
          <>
            <img
              className="server-user-avatar"
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=face"
              alt="Client operator avatar"
            />
            <span className="server-user-email">{alias}</span>
          </>
        ) : null}
        <Button className="server-auth-btn" onClick={onConnectionAction}>
          {isConnected ? 'Disconnect' : 'Connect'}
        </Button>
      </div>
    </header>
  );
}
