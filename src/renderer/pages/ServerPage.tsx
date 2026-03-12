import { useMemo } from 'react';
import { TopNavigation } from '@renderer/components/server/common/TopNavigation';
import { resolveServerNavItems } from '@renderer/components/server/navigation/navigation';
import { Configuration } from '@renderer/components/server/configuration/Configuration';
import { Data } from '@renderer/components/server/data/Data';
import { Distribution } from '@renderer/components/server/distribution/Distribution';
import { Operations } from '@renderer/components/server/operations/Operations';
import { Overview } from '@renderer/components/server/overview/Overview';
import type { ServerRouteState } from '@renderer/components/server/types';
import type { EligibleOverviewSummary } from '@shared/types/eligible';

interface ServerPageProps {
  route: ServerRouteState;
  onNavigate: (nextRoute: ServerRouteState) => void;
  hasEligibleData: boolean;
  overviewSummary: EligibleOverviewSummary;
  isSynchronizing: boolean;
  onSynchronize: () => void;
  userEmail: string;
  isOnline: boolean;
  authActionLabel: 'Login' | 'Logout';
  onAuthAction: () => void;
}

export function ServerPage({
  route,
  onNavigate,
  hasEligibleData,
  overviewSummary,
  isSynchronizing,
  onSynchronize,
  userEmail,
  isOnline,
  authActionLabel,
  onAuthAction
}: ServerPageProps) {
  const navItems = useMemo(() => resolveServerNavItems(), []);

  const content = useMemo(() => {
    if (route.section === 'overview') {
      return (
        <Overview
          hasEligibleData={hasEligibleData}
          overviewSummary={overviewSummary}
          isSynchronizing={isSynchronizing}
          onSynchronize={onSynchronize}
        />
      );
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
  }, [hasEligibleData, isSynchronizing, onNavigate, onSynchronize, overviewSummary, route]);

  return (
    <main className="server-page">
      <section className="server-shell">
        <TopNavigation
          items={navItems}
          activeSection={route.section}
          isDataReady={hasEligibleData}
          userEmail={userEmail}
          isOnline={isOnline}
          authActionLabel={authActionLabel}
          onAuthAction={onAuthAction}
          onSelect={(section) => {
            onNavigate({
              ...route,
              section
            });
          }}
        />
        {content}
      </section>
    </main>
  );
}
