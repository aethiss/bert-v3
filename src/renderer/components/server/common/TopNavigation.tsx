import { Printer, Unplug } from 'lucide-react';
import type { ServerSection } from '@renderer/components/server/types';
import { Button } from '@ui/components/ui/button';

export interface ServerTopNavItem {
  id: ServerSection;
  label: string;
}

interface TopNavigationProps {
  items: ServerTopNavItem[];
  activeSection: ServerSection;
  isDataReady: boolean;
  onSelect: (section: ServerSection) => void;
  userEmail: string;
  isOnline: boolean;
  authActionLabel: 'Login' | 'Logout';
  onAuthAction: () => void;
}

export function TopNavigation({
  items,
  activeSection,
  isDataReady,
  onSelect,
  userEmail,
  isOnline,
  authActionLabel,
  onAuthAction
}: TopNavigationProps) {
  return (
    <header className="server-top-nav">
      <div className="server-brand">
        <img
          className="server-brand-logo"
          src="https://uikit.wfp.org/cdn/logos/latest/wfp-logo-emblem-blue-all.svg"
          alt="World Food Programme"
        />
        <span className="server-brand-name">BeRT</span>
        <span className="server-brand-version">v.2.0</span>
      </div>

      <nav className="server-main-nav" aria-label="Main navigation">
        {items.map((item) => {
          const isDisabled = !isDataReady && item.id !== 'overview';
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
        <div className={isOnline ? 'server-status online' : 'server-status offline'}>
          <Unplug size={14} />
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        <img
          className="server-user-avatar"
          src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=face"
          alt="User avatar"
        />
        <span className="server-user-email">{userEmail}</span>
        <Button className="server-auth-btn" onClick={onAuthAction}>
          {authActionLabel}
        </Button>
      </div>
    </header>
  );
}
