import type { ClientTopNavItem } from '@renderer/components/client/common/TopNavigation';

export const FULL_CLIENT_NAV_ITEMS: ClientTopNavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'configuration', label: 'Configuration' }
];

export function resolveClientNavItems(): ClientTopNavItem[] {
  return FULL_CLIENT_NAV_ITEMS;
}
