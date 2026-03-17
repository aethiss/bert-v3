import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Button } from '@ui/components/ui/button';
import { Input } from '@ui/components/ui/input';
import type { ClientDistributionHistoryItem } from '@shared/types/eligible';
import { getClientDistributionHistory } from '@renderer/services/eligibleDataService';
import { showErrorToast } from '@renderer/lib/errorToast';

interface ClientOverviewProps {
  isConnected: boolean;
  alias: string;
  onNavigateToConnection: () => void;
}

function formatDateTime(
  value: string,
  locale: string,
  notAvailableLabel: string
): { date: string; time: string } {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: notAvailableLabel, time: notAvailableLabel };
  }

  return {
    date: parsed.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }),
    time: parsed.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    })
  };
}

export function Overview({ isConnected, alias, onNavigateToConnection }: ClientOverviewProps) {
  const intl = useIntl();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<ClientDistributionHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const onUpdate = () => {
      setRefreshTick((previous) => previous + 1);
    };
    window.addEventListener('client-distribution-history-updated', onUpdate);
    return () => {
      window.removeEventListener('client-distribution-history-updated', onUpdate);
    };
  }, []);

  useEffect(() => {
    if (!isConnected || !alias.trim()) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      return;
    }

    let mounted = true;
    setIsLoading(true);

    void getClientDistributionHistory({
      alias: alias.trim(),
      search,
      page,
      pageSize
    })
      .then((result) => {
        if (!mounted) {
          return;
        }

        setRows(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      })
      .catch((error) => {
        if (mounted) {
          showErrorToast(error);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [alias, isConnected, page, pageSize, refreshTick, search]);

  const hasRows = rows.length > 0;
  const connectedTitle = useMemo(() => {
    return alias.trim()
      ? intl.formatMessage({ id: 'overview.client.connectedTitle' }, { alias: alias.trim() })
      : intl.formatMessage({ id: 'overview.client.title' });
  }, [alias, intl]);

  if (!isConnected) {
    return (
      <section className="server-content-block">
        <h1 className="server-page-title">{intl.formatMessage({ id: 'overview.client.homeTitle' })}</h1>
        <div className="server-row-headline">
          <p>{intl.formatMessage({ id: 'overview.client.connectPrompt' })}</p>
          <Button className="server-btn" onClick={onNavigateToConnection}>
            {intl.formatMessage({ id: 'actions.connect' })}
          </Button>
        </div>
        <hr className="server-divider" />
      </section>
    );
  }

  return (
    <section className="server-content-block">
      <h1 className="server-page-title">{connectedTitle}</h1>

      <div className="operations-search-wrap">
        <Input
          value={search}
          className="operations-search-input server-form-control"
          placeholder={intl.formatMessage({ id: 'overview.client.searchPlaceholder' })}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <Search size={16} />
      </div>

      <div className="client-overview-table-wrap">
        <table className="operations-table" aria-label={intl.formatMessage({ id: 'overview.client.tableAria' })}>
          <thead>
            <tr>
              <th>{intl.formatMessage({ id: 'table.uuid' })}</th>
              <th>{intl.formatMessage({ id: 'table.date' })}</th>
              <th>{intl.formatMessage({ id: 'table.time' })}</th>
              <th>{intl.formatMessage({ id: 'table.cycle' })}</th>
              <th>{intl.formatMessage({ id: 'table.collectedBy' })}</th>
            </tr>
          </thead>
          <tbody>
            {hasRows
              ? rows.map((row) => {
                  const dateTime = formatDateTime(
                    row.createdAt,
                    intl.locale,
                    intl.formatMessage({ id: 'common.na' })
                  );
                  return (
                    <tr key={row.id}>
                      <td>{row.memberId}</td>
                      <td>{dateTime.date}</td>
                      <td>{dateTime.time}</td>
                      <td>{row.cycleName}</td>
                      <td>{row.collectedBy}</td>
                    </tr>
                  );
                })
              : null}
            {!hasRows && !isLoading ? (
              <tr>
                <td colSpan={5}>
                  {intl.formatMessage({ id: 'overview.client.empty' })}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="operations-pagination">
        <p>
          {isLoading
            ? intl.formatMessage({ id: 'common.loading' })
            : intl.formatMessage(
                { id: 'overview.client.rowsShown' },
                { shown: Math.min(total, rows.length), total }
              )}
        </p>
        <div>
          <button
            type="button"
            className="operations-page-btn"
            disabled={page <= 1 || isLoading}
            onClick={() => {
              setPage((previous) => Math.max(1, previous - 1));
            }}
          >
            {intl.formatMessage({ id: 'common.previous' })}
          </button>
          <button
            type="button"
            className="operations-page-btn"
            disabled={page >= totalPages || isLoading}
            onClick={() => {
              setPage((previous) => Math.min(totalPages, previous + 1));
            }}
          >
            {intl.formatMessage({ id: 'common.next' })}
          </button>
        </div>
      </div>
    </section>
  );
}
