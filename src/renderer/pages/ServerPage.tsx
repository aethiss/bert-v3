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
  isSynchronizeDisabled: boolean;
  onSynchronize: () => void;
  pendingDistributionCount: number;
  userEmail: string;
  isOnline: boolean;
  isLocalServerRunning: boolean;
  appVersion: string;
  authActionLabel: 'Login' | 'Logout';
  onAuthAction: () => void;
}

export function ServerPage({
  route,
  onNavigate,
  hasEligibleData,
  overviewSummary,
  isSynchronizing,
  isSynchronizeDisabled,
  onSynchronize,
  pendingDistributionCount,
  userEmail,
  isOnline,
  isLocalServerRunning,
  appVersion,
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
          isSynchronizeDisabled={isSynchronizeDisabled}
          isOnline={isOnline}
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

    return <Data pendingDistributionCount={pendingDistributionCount} />;
  }, [
    hasEligibleData,
    isOnline,
    isSynchronizeDisabled,
    isSynchronizing,
    onNavigate,
    onSynchronize,
    pendingDistributionCount,
    overviewSummary,
    route
  ]);

  return (
    <main className="server-page">
      <section className="server-shell">
        <TopNavigation
          items={navItems}
          activeSection={route.section}
          isDataReady={hasEligibleData}
          pendingDistributionCount={pendingDistributionCount}
          userEmail={userEmail}
          isOnline={isOnline}
          isLocalServerRunning={isLocalServerRunning}
          appVersion={appVersion}
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
