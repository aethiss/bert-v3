import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@ui/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ServerRouteComponentProps } from '@renderer/components/server/types';
import type { DistributionSearchResult } from '@shared/types/eligible';
import { searchDistributionMember } from '@renderer/services/eligibleDataService';
import { showErrorToast } from '@renderer/lib/errorToast';

function toPrincipleFlag(role: string | null): 'true' | 'false' {
  const normalized = (role ?? '').trim().toLowerCase();
  return normalized === 'principle' || normalized === 'principal' ? 'true' : 'false';
}

export function Distribution({ route, onNavigate }: ServerRouteComponentProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<DistributionSearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (): Promise<void> => {
    const normalized = query.trim();
    if (!normalized) {
      setResult(null);
      setHasSearched(false);
      onNavigate({
        ...route,
        section: 'distribution',
        distributionMode: 'search'
      });
      return;
    }

    setIsSearching(true);
    try {
      const searchResult = await searchDistributionMember(normalized);
      setResult(searchResult);
      setHasSearched(true);
      onNavigate({
        ...route,
        section: 'distribution',
        distributionMode: searchResult ? 'result' : 'search'
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <section className="server-content-block">
      <h1 className="server-page-title">Distribution</h1>
      <p className="server-label">Search&nbsp;&nbsp;Household</p>
      <div className="distribution-search-row">
        <Input
          aria-label="Household search"
          className="distribution-search-input"
          inputMode="numeric"
          pattern="[0-9]*"
          value={query}
          onChange={(event) => {
            const digitsOnly = event.target.value.replace(/\D/g, '');
            setQuery(digitsOnly);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void handleSearch();
            }
          }}
          placeholder="FamilyUniqueCode or documentNumber (numeric)"
        />
        <Button
          className="server-btn"
          onClick={() => void handleSearch()}
          disabled={isSearching}
        >
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {route.distributionMode === 'result' && result ? (
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
              <td>{result.member.id}</td>
              <td>{toPrincipleFlag(result.member.role)}</td>
              <td>N/A</td>
              <td>N/A</td>
              <td className="distribution-action-cell">
                <div className="distribution-action-content">
                  <button type="button" className="distribution-action-btn">
                    Distribute
                  </button>
                  <ExternalLink size={14} />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}

      {hasSearched && !result ? (
        <p className="distribution-empty">No eligible members found for the provided search value.</p>
      ) : null}
    </section>
  );
}
