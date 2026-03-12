import type { ServerTopNavItem } from '@renderer/components/server/common/TopNavigation';

export const FULL_SERVER_NAV_ITEMS: ServerTopNavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'operations', label: 'Operations' },
  { id: 'data', label: 'Data' },
  { id: 'configuration', label: 'Configuration' }
];

export function resolveServerNavItems(): ServerTopNavItem[] {
  return FULL_SERVER_NAV_ITEMS;
}
