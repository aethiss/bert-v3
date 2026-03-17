import { Link2, Printer } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Button } from '@ui/components/ui/button';
import type { ClientSection } from '@renderer/components/client/types';
import wfpLogoEmblemBlue from '@renderer/assets/branding/wfp-logo-emblem-blue-all.svg';

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
  const intl = useIntl();

  return (
    <header className="server-top-nav">
      <div className="server-brand">
        <img
          className="server-brand-logo"
          src={wfpLogoEmblemBlue}
          alt={intl.formatMessage({ id: 'brand.wfp' })}
        />
        <span className="server-brand-name">BeRT-Client</span>
        <span className="server-brand-version">v2</span>
      </div>

      <nav className="server-main-nav" aria-label={intl.formatMessage({ id: 'nav.aria.client' })}>
        {items.map((item) => {
          const isDisabled = !isConnected && item.id === 'distribution';
          const labelId = `nav.client.${item.id}`;
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
              {intl.formatMessage({ id: labelId, defaultMessage: item.label })}
            </button>
          );
        })}
      </nav>

      <div className="server-status-area">
        <div className="server-status ready">
          <Printer size={14} />
          <span>{intl.formatMessage({ id: 'status.ready' })}</span>
        </div>
        <div className={isConnected ? 'server-status online' : 'server-status offline'}>
          <Link2 size={14} />
          <span>
            {isConnected
              ? intl.formatMessage({ id: 'status.connectedTo' }, { host: connectedHost })
              : intl.formatMessage({ id: 'status.disconnected' })}
          </span>
        </div>
        {isConnected && alias ? (
          <>
            <img
              className="server-user-avatar"
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=face"
              alt={intl.formatMessage({ id: 'nav.client.avatarAlt' })}
            />
            <span className="server-user-email">{alias}</span>
          </>
        ) : null}
        <Button className="server-auth-btn" onClick={onConnectionAction}>
          {isConnected
            ? intl.formatMessage({ id: 'actions.disconnect' })
            : intl.formatMessage({ id: 'actions.connect' })}
        </Button>
      </div>
    </header>
  );
}
