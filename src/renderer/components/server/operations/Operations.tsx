import { useEffect, useMemo, useState } from 'react';
import { Check, Search, WifiOff } from 'lucide-react';
import { Input } from '@ui/components/ui/input';
import { Button } from '@ui/components/ui/button';
import { getOperationsDashboard } from '@renderer/services/configService';
import { showErrorToast } from '@renderer/lib/errorToast';
import type { OperationsDashboard } from '@shared/types/operations';

const DEFAULT_DASHBOARD: OperationsDashboard = {
  serverRunning: false,
  sessionStartedAt: null,
  totalDistributions: 0,
  totalEligibleHouseholds: 0,
  cycleProgress: [],
  overviewBars: [],
  clients: [],
  distributions: {
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1
  }
};

const PAGE_SIZE = 10;

export function Operations() {
  const [dashboard, setDashboard] = useState<OperationsDashboard>(DEFAULT_DASHBOARD);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const next = await getOperationsDashboard({
          search,
          page,
          pageSize: PAGE_SIZE
        });
        if (mounted) {
          setDashboard(next);
        }
      } catch (error) {
        if (mounted) {
          showErrorToast(error);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 3000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [page, search]);

  const overviewMax = useMemo(() => {
    return Math.max(1, ...dashboard.overviewBars.map((item) => item.distributedCount));
  }, [dashboard.overviewBars]);

  return (
    <section className="server-content-block operations-content">
      <h1 className="server-page-title">Operations</h1>

      <section className="operations-top-grid">
        <article className="operations-card">
          <h2>Overview</h2>
          {dashboard.overviewBars.length === 0 ? (
            <p className="operations-muted">No distributions yet in current session.</p>
          ) : (
            <div className="operations-bars">
              {dashboard.overviewBars.map((item) => {
                const width = Math.max(
                  10,
                  Math.round((item.distributedCount / overviewMax) * 100)
                );
                return (
                  <div key={item.alias} className="operations-bar-row">
                    <span>{item.alias}</span>
                    <div className="operations-bar-track">
                      <div className="operations-bar-fill" style={{ width: `${width}%` }} />
                    </div>
                    <strong>{item.distributedCount}</strong>
                  </div>
                );
              })}
            </div>
          )}
          <p className="operations-muted">
            Session distributions: {dashboard.totalDistributions} / Eligible households:{' '}
            {dashboard.totalEligibleHouseholds}
          </p>
        </article>

        <article className="operations-card">
          <h2>Clients</h2>
          {dashboard.clients.length === 0 ? (
            <p className="operations-muted">No client sessions yet.</p>
          ) : (
            <div className="operations-client-list">
              {dashboard.clients.map((client) => (
                <div className="operations-client-item" key={client.alias}>
                  <div className="operations-client-head">
                    <div>
                      <p className="operations-client-alias">{client.alias}</p>
                      {client.cycles.slice(0, 2).map((cycle) => (
                        <p className="operations-client-cycle" key={`${client.alias}-${cycle.cycleCode}`}>
                          {cycle.cycleName}: {cycle.distributedCount}/{cycle.totalHouseholds}
                        </p>
                      ))}
                    </div>
                    <span className={client.isConnected ? 'operations-pill connected' : 'operations-pill disconnected'}>
                      {client.isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="operations-table-section">
        <div className="operations-table-header">
          <h2>Distributions ({dashboard.distributions.total})</h2>
          {dashboard.serverRunning ? (
            <p className="operations-live">
              <Check size={14} /> Live session
            </p>
          ) : (
            <p className="operations-live off">
              <WifiOff size={14} /> Server stopped
            </p>
          )}
        </div>

        <div className="operations-search-wrap">
          <Search size={14} />
          <Input
            className="operations-search-input"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search by alias or UUID (memberId)"
          />
        </div>

        <table className="operations-table">
          <thead>
            <tr>
              <th>Operator</th>
              <th>UUID</th>
              <th>Date</th>
              <th>Time</th>
              <th>Cycle</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.distributions.items.map((item) => (
              <tr key={item.id}>
                <td>{item.subOperator}</td>
                <td>{item.memberId}</td>
                <td>{item.date}</td>
                <td>{item.time}</td>
                <td>
                  {item.cycleName} ({item.cycleCode})
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {dashboard.distributions.items.length === 0 && !isLoading ? (
          <p className="operations-muted">No distributions found.</p>
        ) : null}

        <div className="operations-pagination">
          <p>
            {dashboard.distributions.items.length} of {dashboard.distributions.total} row(s) shown.
          </p>
          <div>
            <Button
              variant="outline"
              className="operations-page-btn"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || isLoading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              className="operations-page-btn"
              onClick={() =>
                setPage((prev) => Math.min(dashboard.distributions.totalPages, prev + 1))
              }
              disabled={page >= dashboard.distributions.totalPages || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </section>
  );
}
