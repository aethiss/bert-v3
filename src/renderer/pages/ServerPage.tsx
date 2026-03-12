import { useMemo } from 'react';
import { TopNavigation } from '@renderer/components/server/common/TopNavigation';
import { resolveServerNavItems } from '@renderer/components/server/navigation/navigation';
import { Configuration } from '@renderer/components/server/configuration/Configuration';
import { Data } from '@renderer/components/server/data/Data';
import { Distribution } from '@renderer/components/server/distribution/Distribution';
import { Operations } from '@renderer/components/server/operations/Operations';
import { Overview } from '@renderer/components/server/overview/Overview';
import type { ServerRouteState } from '@renderer/components/server/types';

interface ServerPageProps {
  route: ServerRouteState;
  onNavigate: (nextRoute: ServerRouteState) => void;
}

export function ServerPage({ route, onNavigate }: ServerPageProps) {
  const navItems = useMemo(
    () => resolveServerNavItems(route.section, route.overviewMode),
    [route.overviewMode, route.section]
  );

  const content = useMemo(() => {
    if (route.section === 'overview') {
      return <Overview route={route} onNavigate={onNavigate} />;
    }

    if (route.section === 'distribution') {
      return <Distribution route={route} onNavigate={onNavigate} />;
    }

    if (route.section === 'configuration') {
      return <Configuration route={route} onNavigate={onNavigate} />;
    }

    if (route.section === 'operations') {
      return <Operations />;
    }

    return <Data />;
  }, [onNavigate, route]);

  return (
    <main className="server-page">
      <section className="server-shell">
        <TopNavigation
          items={navItems}
          activeSection={route.section}
          onSelect={(section) => {
            const nextOverviewMode = section === 'overview' ? route.overviewMode : 'data';
            onNavigate({
              ...route,
              section,
              overviewMode: nextOverviewMode
            });
          }}
        />
        {content}
      </section>
    </main>
  );
}
