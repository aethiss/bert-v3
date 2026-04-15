import { Printer, Server as ServerIcon, Unplug } from 'lucide-react';
import { useIntl } from 'react-intl';
import type { ServerSection } from '@renderer/components/server/types';
import { Button } from '@ui/components/ui/button';
import wfpLogoEmblemBlue from '@renderer/assets/branding/wfp-logo-emblem-blue-all.svg';

export interface ServerTopNavItem {
  id: ServerSection;
  label: string;
}

interface TopNavigationProps {
  items: ServerTopNavItem[];
  activeSection: ServerSection;
  isDataReady: boolean;
  pendingDistributionCount: number;
  onSelect: (section: ServerSection) => void;
  userEmail: string;
  isOnline: boolean;
  isLocalServerRunning: boolean;
  appVersion: string;
  authActionLabel: 'Login' | 'Logout';
  onAuthAction: () => void;
}

export function TopNavigation({
  items,
  activeSection,
  isDataReady,
  pendingDistributionCount,
  onSelect,
  userEmail,
  isOnline,
  isLocalServerRunning,
  appVersion,
  authActionLabel,
  onAuthAction
}: TopNavigationProps) {
  const intl = useIntl();

  return (
    <header className="server-top-nav">
      <div className="server-brand">
        <img
          className="server-brand-logo"
          src={wfpLogoEmblemBlue}
          alt={intl.formatMessage({ id: 'brand.wfp' })}
        />
        <span className="server-brand-name">BeRT</span>
        <span className="server-brand-version">v{appVersion}</span>
      </div>

      <nav className="server-main-nav" aria-label={intl.formatMessage({ id: 'nav.aria.main' })}>
        {items.map((item) => {
          const isDisabled = !isDataReady && item.id !== 'overview';
          const labelId = `nav.server.${item.id}`;
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
            {item.id === 'data' && pendingDistributionCount > 0 ? (
              <span className="server-nav-badge">{pendingDistributionCount}</span>
            ) : null}
          </button>
          );
        })}
      </nav>

      <div className="server-status-area">
        <div className="server-status ready">
          <Printer size={14} />
          <span>{intl.formatMessage({ id: 'status.ready' })}</span>
        </div>
        <div className={isOnline ? 'server-status online' : 'server-status offline'}>
          <Unplug size={14} />
          <span>{isOnline ? intl.formatMessage({ id: 'status.online' }) : intl.formatMessage({ id: 'status.offline' })}</span>
        </div>
        <div className={isLocalServerRunning ? 'server-status local-server-on' : 'server-status local-server-off'}>
          <ServerIcon size={14} />
          <span>
            {isLocalServerRunning
              ? intl.formatMessage({ id: 'status.serverOn' })
              : intl.formatMessage({ id: 'status.serverOff' })}
          </span>
        </div>
        <img
          className="server-user-avatar"
          src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=face"
          alt={intl.formatMessage({ id: 'nav.server.avatarAlt' })}
        />
        <span className="server-user-email">{userEmail}</span>
        <Button className="server-auth-btn" onClick={onAuthAction}>
          {authActionLabel === 'Logout'
            ? intl.formatMessage({ id: 'actions.logout' })
            : intl.formatMessage({ id: 'actions.login' })}
        </Button>
      </div>
    </header>
  );
}
