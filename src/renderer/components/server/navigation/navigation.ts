import type { ServerSection } from '@renderer/components/server/types';
import type { ServerTopNavItem } from '@renderer/components/server/common/TopNavigation';

export const FULL_SERVER_NAV_ITEMS: ServerTopNavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'operations', label: 'Operations' },
  { id: 'data', label: 'Data' },
  { id: 'configuration', label: 'Configuration' }
];

export const HOME_SERVER_NAV_ITEMS: ServerTopNavItem[] = [
  { id: 'overview', label: 'Home' },
  { id: 'configuration', label: 'Configuration' }
];

export function resolveServerNavItems(
  section: ServerSection,
  overviewMode: 'empty' | 'data'
): ServerTopNavItem[] {
  if (section === 'overview' && overviewMode === 'empty') {
    return HOME_SERVER_NAV_ITEMS;
  }

  return FULL_SERVER_NAV_ITEMS;
}
