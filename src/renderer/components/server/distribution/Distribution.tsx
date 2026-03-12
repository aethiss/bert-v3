import { ExternalLink } from 'lucide-react';
import { Button } from '@ui/components/ui/button';
import { Input } from '@ui/components/ui/input';
import type { ServerRouteComponentProps } from '@renderer/components/server/types';

export function Distribution({ route, onNavigate }: ServerRouteComponentProps) {
  return (
    <section className="server-content-block">
      <h1 className="server-page-title">Distribution</h1>
      <p className="server-label">Search&nbsp;&nbsp;Household</p>
      <div className="distribution-search-row">
        <Input
          aria-label="Household search"
          className="distribution-search-input"
          defaultValue="12345678"
          placeholder="12345678"
        />
        <Button
          className="server-btn"
          onClick={() => {
            onNavigate({
              ...route,
              section: 'distribution',
              distributionMode: 'result'
            });
          }}
        >
          Search
        </Button>
      </div>

      {route.distributionMode === 'result' ? (
        <table className="distribution-table" aria-label="Distribution results">
          <thead>
            <tr>
              <th>UUID</th>
              <th>Principle</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>INV001</td>
              <td>Paid</td>
              <td>Credit Card</td>
              <td>Damascus,Midan , Abo Habel</td>
              <td className="distribution-action-cell">
                <span>Distribute</span>
                <ExternalLink size={14} />
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
