import type { ServerRouteState } from '@renderer/components/server/types';

export type AppRoute = 'server' | 'client';

export interface ParsedRoute {
  appRoute: AppRoute;
  server: ServerRouteState;
}

export const DEFAULT_SERVER_ROUTE: ServerRouteState = {
  section: 'overview',
  distributionMode: 'search',
  configurationTab: 'server'
};

export function parseAppHash(hash: string): ParsedRoute {
  const normalized = hash.replace(/^#/, '');
  const segments = normalized.split('/').filter(Boolean);

  if (segments[0] === 'client') {
    return { appRoute: 'client', server: DEFAULT_SERVER_ROUTE };
  }

  if (segments[0] !== 'server') {
    return { appRoute: 'server', server: DEFAULT_SERVER_ROUTE };
  }

  const section = segments[1];

  if (section === 'overview' || section === 'home') {
    return {
      appRoute: 'server',
      server: { ...DEFAULT_SERVER_ROUTE, section: 'overview' }
    };
  }

  if (section === 'distribution') {
    return {
      appRoute: 'server',
      server: {
        ...DEFAULT_SERVER_ROUTE,
        section: 'distribution',
        distributionMode: segments[2] === 'result' ? 'result' : 'search'
      }
    };
  }

  if (section === 'configuration') {
    const rawTab = segments[2];
    const configurationTab =
      rawTab === 'server' || rawTab === 'printer' || rawTab === 'log' ? rawTab : 'server';

    return {
      appRoute: 'server',
      server: {
        ...DEFAULT_SERVER_ROUTE,
        section: 'configuration',
        configurationTab
      }
    };
  }

  if (section === 'operations') {
    return {
      appRoute: 'server',
      server: { ...DEFAULT_SERVER_ROUTE, section: 'operations' }
    };
  }

  if (section === 'data') {
    return {
      appRoute: 'server',
      server: { ...DEFAULT_SERVER_ROUTE, section: 'data' }
    };
  }

  return { appRoute: 'server', server: DEFAULT_SERVER_ROUTE };
}

export function toAppHash(route: ParsedRoute): string {
  if (route.appRoute === 'client') {
    return '#/client/dashboard';
  }

  const { section, distributionMode, configurationTab } = route.server;

  if (section === 'overview') {
    return '#/server/overview';
  }

  if (section === 'distribution') {
    return distributionMode === 'result'
      ? '#/server/distribution/result'
      : '#/server/distribution/search';
  }

  if (section === 'configuration') {
    return `#/server/configuration/${configurationTab}`;
  }

  return `#/server/${section}`;
}
