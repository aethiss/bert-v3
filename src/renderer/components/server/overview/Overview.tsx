import { House, UsersRound } from 'lucide-react';
import { Button } from '@ui/components/ui/button';
import type { EligibleOverviewSummary } from '@shared/types/eligible';

interface OverviewProps {
  hasEligibleData: boolean;
  overviewSummary: EligibleOverviewSummary;
  isSynchronizing: boolean;
  isSynchronizeDisabled: boolean;
  isOnline: boolean;
  onSynchronize: () => void;
}

function formatDate(value: string): string {
  if (!value) {
    return '01/Jan/2026';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '01/Jan/2026';
  }

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function Overview({
  hasEligibleData,
  overviewSummary,
  isSynchronizing,
  isSynchronizeDisabled,
  isOnline,
  onSynchronize
}: OverviewProps) {
  const cycles = overviewSummary.cycles;
  const firstCycle = cycles[0];
  const secondCycle = cycles[1];
  const firstCycleTag = (firstCycle?.assistancePackageName ?? '').slice(0, 4).toUpperCase();
  const secondCycleTag = (secondCycle?.assistancePackageName ?? '').slice(0, 4).toUpperCase();

  return (
    <section className="server-content-block">
      <h1 className="server-page-title">Overview</h1>
      <div className="server-row-headline">
        <p>
          Synchronize data to start using the Application
          <span className="overview-sync-meta">
            Last sync:{' '}
            {overviewSummary.lastSynchronizedAt
              ? formatDate(overviewSummary.lastSynchronizedAt)
              : 'Never'}
            {' • '}
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </p>
        <Button
          className="server-btn"
          onClick={onSynchronize}
          disabled={isSynchronizing || isSynchronizeDisabled}
        >
          {isSynchronizing ? 'Synchronizing...' : 'Synchronize'}
        </Button>
      </div>
      <hr className="server-divider" />

      {hasEligibleData ? (
        <div className="overview-cards-grid overview-cards-grid-with-sync">
          <article className="overview-card">
            <div className="overview-card-head">
              <p>{firstCycle?.cycleName ?? firstCycle?.assistancePackageName ?? 'Cycle 1'}</p>
              {firstCycleTag ? <span className="overview-chip">{firstCycleTag}</span> : null}
            </div>
            <p className="overview-card-value">{firstCycle?.householdCount ?? 0}</p>
            <p className="overview-card-sub">
              {formatDate(firstCycle?.startDate ?? '')} - {formatDate(firstCycle?.endDate ?? '')}
            </p>
          </article>

          <article className="overview-card">
            <div className="overview-card-head">
              <p>{secondCycle?.cycleName ?? secondCycle?.assistancePackageName ?? 'Cycle 2'}</p>
              {secondCycleTag ? <span className="overview-chip">{secondCycleTag}</span> : null}
            </div>
            <p className="overview-card-value">{secondCycle?.householdCount ?? 0}</p>
            <p className="overview-card-sub">
              {formatDate(secondCycle?.startDate ?? '')} - {formatDate(secondCycle?.endDate ?? '')}
            </p>
          </article>

          <article className="overview-card">
            <div className="overview-card-head">
              <p>Members</p>
              <UsersRound size={16} />
            </div>
            <p className="overview-card-value">{overviewSummary.totalMembers}</p>
          </article>

          <article className="overview-card">
            <div className="overview-card-head">
              <p>Households</p>
              <House size={16} />
            </div>
            <p className="overview-card-value">{overviewSummary.totalHouseholds}</p>
          </article>
        </div>
      ) : null}
    </section>
  );
}
