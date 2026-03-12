import type { ServerRouteState } from '@renderer/components/server/types';

export type AppRoute = 'server' | 'client';

export interface ParsedRoute {
  appRoute: AppRoute;
  server: ServerRouteState;
}

export const DEFAULT_SERVER_ROUTE: ServerRouteState = {
  section: 'overview',
  overviewMode: 'empty',
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

  if (section === 'home') {
    return {
      appRoute: 'server',
      server: { ...DEFAULT_SERVER_ROUTE, section: 'overview', overviewMode: 'empty' }
    };
  }

  if (section === 'overview') {
    return {
      appRoute: 'server',
      server: { ...DEFAULT_SERVER_ROUTE, section: 'overview', overviewMode: 'data' }
    };
  }

  if (section === 'distribution') {
    return {
      appRoute: 'server',
      server: {
        ...DEFAULT_SERVER_ROUTE,
        section: 'distribution',
        overviewMode: 'data',
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
        overviewMode: 'data',
        configurationTab
      }
    };
  }

  if (section === 'operations') {
    return {
      appRoute: 'server',
      server: { ...DEFAULT_SERVER_ROUTE, section: 'operations', overviewMode: 'data' }
    };
  }

  if (section === 'data') {
    return {
      appRoute: 'server',
      server: { ...DEFAULT_SERVER_ROUTE, section: 'data', overviewMode: 'data' }
    };
  }

  return { appRoute: 'server', server: DEFAULT_SERVER_ROUTE };
}

export function toAppHash(route: ParsedRoute): string {
  if (route.appRoute === 'client') {
    return '#/client/dashboard';
  }

  const { section, overviewMode, distributionMode, configurationTab } = route.server;

  if (section === 'overview') {
    return overviewMode === 'empty' ? '#/server/home' : '#/server/overview';
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
