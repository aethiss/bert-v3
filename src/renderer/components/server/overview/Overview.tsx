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

function formatDateTime(value: string, locale: string): string {
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
    hour: '2-digit',
    minute: '2-digit'
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

  return (
    <section className="server-content-block">
      <h1 className="server-page-title">{intl.formatMessage({ id: 'overview.server.title' })}</h1>
      <div className="server-row-headline">
        <p>
          {intl.formatMessage({ id: 'overview.server.syncPrompt' })}
          <span className="overview-sync-meta">
            {intl.formatMessage({ id: 'overview.server.lastSync' })}:{' '}
            {overviewSummary.lastSynchronizedAt
              ? formatDateTime(overviewSummary.lastSynchronizedAt, intl.locale)
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
        <div className="overview-cycles-list">
          {cycles.map((cycle, index) => (
            <article className="overview-cycle-row" key={cycle.cycleCode}>
              <div className="overview-cycle-main">
                <p className="overview-cycle-title">
                  {cycle.cycleName ??
                    cycle.assistancePackageName ??
                    intl.formatMessage({ id: 'overview.server.cycleFallback' }, { index: index + 1 })}
                </p>
                <p className="overview-cycle-total">
                  {intl.formatMessage({ id: 'overview.server.totalHouseholdsLabel' })} {cycle.householdCount ?? 0}
                </p>
                <p className="overview-cycle-date">
                  {formatDate(cycle.startDate ?? '', intl.locale)} -{' '}
                  {formatDate(cycle.endDate ?? '', intl.locale)}
                </p>
              </div>
              <span className="overview-cycle-tag">
                {intl.formatMessage({ id: 'overview.server.activeCycleTag' })}
              </span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
