import type { ClientRouteState } from '@renderer/components/client/types';
import type { ServerRouteState } from '@renderer/components/server/types';

export type AppRoute = 'server' | 'client';

export interface ParsedRoute {
  appRoute: AppRoute;
  server: ServerRouteState;
  client: ClientRouteState;
}

export const DEFAULT_SERVER_ROUTE: ServerRouteState = {
  section: 'overview',
  distributionMode: 'search',
  configurationTab: 'server'
};

export const DEFAULT_CLIENT_ROUTE: ClientRouteState = {
  section: 'overview',
  distributionMode: 'search',
  configurationTab: 'connection'
};

function parseServerRoute(segments: string[]): ServerRouteState {
  const section = segments[1];

  if (section === 'overview' || section === 'home') {
    return { ...DEFAULT_SERVER_ROUTE, section: 'overview' };
  }

  if (section === 'distribution') {
    return {
      ...DEFAULT_SERVER_ROUTE,
      section: 'distribution',
      distributionMode:
        segments[2] === 'detail' ? 'detail' : segments[2] === 'result' ? 'result' : 'search'
    };
  }

  if (section === 'configuration') {
    const rawTab = segments[2];
    const configurationTab =
      rawTab === 'server' ||
      rawTab === 'printer' ||
      rawTab === 'log' ||
      rawTab === 'language' ||
      rawTab === 'updates' ||
      rawTab === 'developer'
        ? rawTab
        : 'server';

    return {
      ...DEFAULT_SERVER_ROUTE,
      section: 'configuration',
      configurationTab
    };
  }

  if (section === 'operations') {
    return { ...DEFAULT_SERVER_ROUTE, section: 'operations' };
  }

  if (section === 'data') {
    return { ...DEFAULT_SERVER_ROUTE, section: 'data' };
  }

  return DEFAULT_SERVER_ROUTE;
}

function parseClientRoute(segments: string[]): ClientRouteState {
  const section = segments[1];

  if (section === 'overview' || section === 'home') {
    return { ...DEFAULT_CLIENT_ROUTE, section: 'overview' };
  }

  if (section === 'distribution') {
    return {
      ...DEFAULT_CLIENT_ROUTE,
      section: 'distribution',
      distributionMode:
        segments[2] === 'detail' ? 'detail' : segments[2] === 'result' ? 'result' : 'search'
    };
  }

  if (section === 'configuration') {
    const rawTab = segments[2];
    const configurationTab =
      rawTab === 'connection' ||
      rawTab === 'printer' ||
      rawTab === 'updates' ||
      rawTab === 'developer'
        ? rawTab
        : 'connection';

    return {
      ...DEFAULT_CLIENT_ROUTE,
      section: 'configuration',
      configurationTab
    };
  }

  return DEFAULT_CLIENT_ROUTE;
}

export function parseAppHash(hash: string): ParsedRoute {
  const normalized = hash.replace(/^#/, '');
  const segments = normalized.split('/').filter(Boolean);

  if (segments[0] === 'client') {
    return {
      appRoute: 'client',
      server: DEFAULT_SERVER_ROUTE,
      client: parseClientRoute(segments)
    };
  }

  if (segments[0] === 'server') {
    return {
      appRoute: 'server',
      server: parseServerRoute(segments),
      client: DEFAULT_CLIENT_ROUTE
    };
  }

  return {
    appRoute: 'server',
    server: DEFAULT_SERVER_ROUTE,
    client: DEFAULT_CLIENT_ROUTE
  };
}

export function toAppHash(route: ParsedRoute): string {
  if (route.appRoute === 'client') {
    const { section, distributionMode, configurationTab } = route.client;

    if (section === 'overview') {
      return '#/client/overview';
    }

    if (section === 'distribution') {
      if (distributionMode === 'detail') {
        return '#/client/distribution/detail';
      }
      if (distributionMode === 'result') {
        return '#/client/distribution/result';
      }
      return '#/client/distribution/search';
    }

    return `#/client/configuration/${configurationTab}`;
  }

  const { section, distributionMode, configurationTab } = route.server;

  if (section === 'overview') {
    return '#/server/overview';
  }

  if (section === 'distribution') {
    if (distributionMode === 'detail') {
      return '#/server/distribution/detail';
    }
    if (distributionMode === 'result') {
      return '#/server/distribution/result';
    }
    return '#/server/distribution/search';
  }

  if (section === 'configuration') {
    return `#/server/configuration/${configurationTab}`;
  }

  return `#/server/${section}`;
}
