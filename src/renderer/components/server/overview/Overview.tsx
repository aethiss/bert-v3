import { House, UsersRound } from 'lucide-react';
import { useIntl } from 'react-intl';
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

function formatDate(value: string, locale: string): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

export function Overview({
  hasEligibleData,
  overviewSummary,
  isSynchronizing,
  isSynchronizeDisabled,
  isOnline,
  onSynchronize
}: OverviewProps) {
  const intl = useIntl();
  const cycles = overviewSummary.cycles;
  const firstCycle = cycles[0];
  const secondCycle = cycles[1];
  const firstCycleTag = (firstCycle?.assistancePackageName ?? '').slice(0, 4).toUpperCase();
  const secondCycleTag = (secondCycle?.assistancePackageName ?? '').slice(0, 4).toUpperCase();

  return (
    <section className="server-content-block">
      <h1 className="server-page-title">{intl.formatMessage({ id: 'overview.server.title' })}</h1>
      <div className="server-row-headline">
        <p>
          {intl.formatMessage({ id: 'overview.server.syncPrompt' })}
          <span className="overview-sync-meta">
            {intl.formatMessage({ id: 'overview.server.lastSync' })}:{' '}
            {overviewSummary.lastSynchronizedAt
              ? formatDate(overviewSummary.lastSynchronizedAt, intl.locale)
              : intl.formatMessage({ id: 'overview.server.never' })}
            {' • '}
            {isOnline
              ? intl.formatMessage({ id: 'status.online' })
              : intl.formatMessage({ id: 'status.offline' })}
          </span>
        </p>
        <Button
          className="server-btn"
          onClick={onSynchronize}
          disabled={isSynchronizing || isSynchronizeDisabled}
        >
          {isSynchronizing
            ? intl.formatMessage({ id: 'overview.server.synchronizing' })
            : intl.formatMessage({ id: 'overview.server.synchronize' })}
        </Button>
      </div>
      <hr className="server-divider" />

      {hasEligibleData ? (
        <div className="overview-cards-grid overview-cards-grid-with-sync">
          <article className="overview-card">
            <div className="overview-card-head">
              <p>
                {firstCycle?.cycleName ??
                  firstCycle?.assistancePackageName ??
                  intl.formatMessage({ id: 'overview.server.cycleFallback' }, { index: 1 })}
              </p>
              {firstCycleTag ? <span className="overview-chip">{firstCycleTag}</span> : null}
            </div>
            <p className="overview-card-value">{firstCycle?.householdCount ?? 0}</p>
            <p className="overview-card-sub">
              {formatDate(firstCycle?.startDate ?? '', intl.locale)} -{' '}
              {formatDate(firstCycle?.endDate ?? '', intl.locale)}
            </p>
          </article>

          <article className="overview-card">
            <div className="overview-card-head">
              <p>
                {secondCycle?.cycleName ??
                  secondCycle?.assistancePackageName ??
                  intl.formatMessage({ id: 'overview.server.cycleFallback' }, { index: 2 })}
              </p>
              {secondCycleTag ? <span className="overview-chip">{secondCycleTag}</span> : null}
            </div>
            <p className="overview-card-value">{secondCycle?.householdCount ?? 0}</p>
            <p className="overview-card-sub">
              {formatDate(secondCycle?.startDate ?? '', intl.locale)} -{' '}
              {formatDate(secondCycle?.endDate ?? '', intl.locale)}
            </p>
          </article>

          <article className="overview-card">
            <div className="overview-card-head">
              <p>{intl.formatMessage({ id: 'overview.server.members' })}</p>
              <UsersRound size={16} />
            </div>
            <p className="overview-card-value">{overviewSummary.totalMembers}</p>
          </article>

          <article className="overview-card">
            <div className="overview-card-head">
              <p>{intl.formatMessage({ id: 'overview.server.households' })}</p>
              <House size={16} />
            </div>
            <p className="overview-card-value">{overviewSummary.totalHouseholds}</p>
          </article>
        </div>
      ) : null}
    </section>
  );
}
