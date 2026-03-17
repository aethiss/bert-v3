import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
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

function formatDateTime(value: string): { date: string; time: string } {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: 'N/A', time: 'N/A' };
  }

  return {
    date: parsed.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }),
    time: parsed.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  };
}

export function Overview({ isConnected, alias, onNavigateToConnection }: ClientOverviewProps) {
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
    return alias.trim() ? `Overview · ${alias.trim()}` : 'Overview';
  }, [alias]);

  if (!isConnected) {
    return (
      <section className="server-content-block">
        <h1 className="server-page-title">Home</h1>
        <div className="server-row-headline">
          <p>Connect to Host to start distribution</p>
          <Button className="server-btn" onClick={onNavigateToConnection}>
            Connect
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
          placeholder="Search"
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <Search size={16} />
      </div>

      <div className="client-overview-table-wrap">
        <table className="operations-table" aria-label="Client distributions">
          <thead>
            <tr>
              <th>UUID</th>
              <th>Date</th>
              <th>Time</th>
              <th>Cycle</th>
              <th>Collected By</th>
            </tr>
          </thead>
          <tbody>
            {hasRows
              ? rows.map((row) => {
                  const dateTime = formatDateTime(row.createdAt);
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
                  No distributions recorded by this client in the current local history.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="operations-pagination">
        <p>{isLoading ? 'Loading...' : `${Math.min(total, rows.length)} of ${total} row(s) shown.`}</p>
        <div>
          <button
            type="button"
            className="operations-page-btn"
            disabled={page <= 1 || isLoading}
            onClick={() => {
              setPage((previous) => Math.max(1, previous - 1));
            }}
          >
            Previous
          </button>
          <button
            type="button"
            className="operations-page-btn"
            disabled={page >= totalPages || isLoading}
            onClick={() => {
              setPage((previous) => Math.min(totalPages, previous + 1));
            }}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
