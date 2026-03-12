import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@ui/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ServerRouteComponentProps } from '@renderer/components/server/types';
import type { DistributionDetailData, DistributionSearchResult } from '@shared/types/eligible';
import {
  getDistributionDetail,
  saveDistributionEvent,
  searchDistributionMember
} from '@renderer/services/eligibleDataService';
import { showErrorToast } from '@renderer/lib/errorToast';
import { useAppSelector } from '@renderer/store/hooks';
import { selectCurrentUser } from '@renderer/store/selectors/authSelectors';

function toPrincipleFlag(role: string | null): 'true' | 'false' {
  const normalized = (role ?? '').trim().toLowerCase();
  return normalized === 'principle' || normalized === 'principal' ? 'true' : 'false';
}

function asAgeLabel(age: number | null): string {
  return typeof age === 'number' ? String(age) : 'N/A';
}

export function Distribution({ route, onNavigate }: ServerRouteComponentProps) {
  const currentUser = useAppSelector(selectCurrentUser);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<DistributionSearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detail, setDetail] = useState<DistributionDetailData | null>(null);
  const [selectedCycleCode, setSelectedCycleCode] = useState<number | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyInput, setVerifyInput] = useState('');
  const [isSavingDistribution, setIsSavingDistribution] = useState(false);
  const [blockingMessage, setBlockingMessage] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    if (!detail || selectedCycleCode === null) {
      return [];
    }

    return detail.members.filter((member) => member.cycleCode === selectedCycleCode);
  }, [detail, selectedCycleCode]);

  const selectedMember = useMemo(() => {
    return filteredMembers.find((member) => member.memberId === selectedMemberId) ?? null;
  }, [filteredMembers, selectedMemberId]);

  const handleSearch = async (): Promise<void> => {
    const normalized = query.trim();
    if (!normalized) {
      setResult(null);
      setHasSearched(false);
      setDetail(null);
      onNavigate({
        ...route,
        section: 'distribution',
        distributionMode: 'search'
      });
      return;
    }

    setIsSearching(true);
    setBlockingMessage(null);
    try {
      const searchResult = await searchDistributionMember(normalized);
      setResult(searchResult);
      setHasSearched(true);
      setDetail(null);
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

  const handleOpenDetail = async (): Promise<void> => {
    if (!result) {
      return;
    }

    setIsLoadingDetail(true);
    setBlockingMessage(null);
    try {
      const detailData = await getDistributionDetail({
        memberId: result.member.id,
        cycleCode: result.member.cycleCode,
        familyHhId: result.member.familyHhId
      });

      if (!detailData) {
        toast.error('Error', {
          description: 'Unable to load household details for distribution.'
        });
        return;
      }

      const defaultCycle = detailData.activeCycles[0]?.cycleCode ?? result.member.cycleCode;
      const defaultMember = detailData.members.find((member) => member.memberId === result.member.id);
      const fallbackMember = detailData.members.find((member) => member.cycleCode === defaultCycle);

      setDetail(detailData);
      setSelectedCycleCode(defaultCycle);
      setSelectedMemberId(defaultMember?.memberId ?? fallbackMember?.memberId ?? null);
      setNotes('');
      setBlockingMessage(null);

      onNavigate({
        ...route,
        section: 'distribution',
        distributionMode: 'detail'
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleConfirm = async (): Promise<void> => {
    if (!detail || selectedCycleCode === null || selectedMemberId === null || !selectedMember) {
      toast.error('Error', {
        description: 'Select a cycle and a collector member before confirming.'
      });
      return;
    }

    const mainOperator = currentUser?.id;
    const mainOperatorFDP = (currentUser?.fdp ?? '').trim();

    if (!Number.isFinite(mainOperator ?? null)) {
      toast.error('Error', {
        description: 'Missing logged user id. Please login again.'
      });
      return;
    }

    if (!mainOperatorFDP) {
      toast.error('Error', {
        description: 'Missing logged user FDP. Please login again.'
      });
      return;
    }

    const normalizedVerify = verifyInput.trim();
    const matchesFamilyCode = normalizedVerify === String(detail.household.familyUniqueCode);
    const matchesDocumentId =
      Boolean(selectedMember.documentNumber) && normalizedVerify === String(selectedMember.documentNumber);

    if (!matchesFamilyCode && !matchesDocumentId) {
      toast.error('Error', {
        description: 'Verification failed. Use FamilyUniqueCode or selected member Document ID.'
      });
      return;
    }

    setIsSavingDistribution(true);
    setBlockingMessage(null);
    try {
      await saveDistributionEvent({
        familyUniqueCode: detail.household.familyUniqueCode,
        memberId: selectedMemberId,
        cycleCode: selectedCycleCode,
        mainOperator: mainOperator as number,
        mainOperatorFDP,
        subOperator: null,
        appSignature: '1234567890',
        notes: notes.trim() || null
      });

      window.dispatchEvent(new Event('distribution-queue-updated'));

      setIsVerifyModalOpen(false);
      setVerifyInput('');
      toast.success('Saved', {
        description: 'Distribution saved locally.'
      });

      onNavigate({
        ...route,
        section: 'distribution',
        distributionMode: 'result'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.toLowerCase().includes('duplicate distribution blocked')) {
        const visibleMessage =
          'Distribution already recorded for this family in the selected cycle. Choose another cycle.';
        setBlockingMessage(visibleMessage);
        toast.error('Distribution blocked', {
          description: visibleMessage
        });
        return;
      }
      showErrorToast(error);
    } finally {
      setIsSavingDistribution(false);
    }
  };

  return (
    <section className="server-content-block">
      <h1 className="server-page-title">Distribution</h1>
      {blockingMessage ? <div className="distribution-blocking-alert">{blockingMessage}</div> : null}

      {route.distributionMode !== 'detail' ? (
        <>
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
            <Button className="server-btn" onClick={() => void handleSearch()} disabled={isSearching}>
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
                      <button
                        type="button"
                        className="distribution-action-btn"
                        onClick={() => void handleOpenDetail()}
                        disabled={isLoadingDetail}
                      >
                        {isLoadingDetail ? 'Loading...' : 'Distribute'}
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
        </>
      ) : null}

      {route.distributionMode === 'detail' && detail ? (
        <section className="distribution-detail-layout">
          <aside className="distribution-detail-sidebar">
            <p className="distribution-detail-section-title">Household Info</p>
            <dl className="distribution-info-list">
              <div>
                <dt>IDM ID</dt>
                <dd>{detail.household.idmId}</dd>
              </div>
              <div>
                <dt>Booklet</dt>
                <dd>{detail.household.booklet}</dd>
              </div>
              <div>
                <dt>Principle</dt>
                <dd>{detail.household.principle}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{detail.household.phone}</dd>
              </div>
              <div>
                <dt>Registration Date</dt>
                <dd>{detail.household.registrationDate}</dd>
              </div>
              <div>
                <dt>PBWGs</dt>
                <dd>{detail.household.pbwgs}</dd>
              </div>
              <div>
                <dt>Children 6-23</dt>
                <dd>{detail.household.children623}</dd>
              </div>
            </dl>

            <div className="distribution-sidebar-actions">
              <p className="distribution-detail-section-title">Actions</p>
              <button type="button" className="distribution-link-action" disabled>
                Distribution History
              </button>
              <button type="button" className="distribution-link-action" disabled>
                Reprint
              </button>
            </div>
          </aside>

          <section className="distribution-detail-main">
            <p className="distribution-detail-section-title">Active Cycles</p>
            <table className="distribution-detail-table">
              <thead>
                <tr>
                  <th>Collector</th>
                  <th>Cycle Name</th>
                  <th>Assistance Type</th>
                  <th>Quantity</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                </tr>
              </thead>
              <tbody>
                {detail.activeCycles.map((cycle) => (
                  <tr key={cycle.cycleCode}>
                    <td>
                      <input
                        type="radio"
                        name="selected-cycle"
                        checked={selectedCycleCode === cycle.cycleCode}
                        onChange={() => {
                          setSelectedCycleCode(cycle.cycleCode);
                          const fallbackMember = detail.members.find(
                            (member) => member.cycleCode === cycle.cycleCode
                          );
                          setSelectedMemberId(fallbackMember?.memberId ?? null);
                        }}
                      />
                    </td>
                    <td>{cycle.cycleName}</td>
                    <td>{cycle.assistanceType}</td>
                    <td>{cycle.quantity}</td>
                    <td>{cycle.startDate}</td>
                    <td>{cycle.endDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="distribution-detail-section-title">Household Members</p>
            <table className="distribution-detail-table">
              <thead>
                <tr>
                  <th>Collector</th>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={`${member.memberId}-${member.cycleCode}`}>
                    <td>
                      <input
                        type="radio"
                        name="selected-member"
                        checked={selectedMemberId === member.memberId}
                        onChange={() => {
                          setSelectedMemberId(member.memberId);
                        }}
                      />
                    </td>
                    <td>{member.fullName}</td>
                    <td>{member.documentNumber ?? member.memberId}</td>
                    <td>{asAgeLabel(member.age)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="distribution-detail-section-title">Notes</p>
            <textarea
              className="distribution-notes"
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
              placeholder="Type Notes Here"
              rows={4}
            />

            <div className="distribution-detail-footer">
              <Button
                className="server-btn"
                onClick={() => {
                  setIsVerifyModalOpen(true);
                }}
                disabled={selectedCycleCode === null || selectedMemberId === null}
              >
                Confirm
              </Button>
              <Button
                variant="outline"
                className="server-btn distribution-cancel-btn"
                onClick={() => {
                  onNavigate({
                    ...route,
                    section: 'distribution',
                    distributionMode: 'result'
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </section>
        </section>
      ) : null}

      {isVerifyModalOpen ? (
        <div className="distribution-modal-backdrop" role="presentation">
          <div className="distribution-modal" role="dialog" aria-modal="true">
            <h2>Confirm Distribution</h2>
            <p>Type FamilyUniqueCode or selected member Document ID to confirm.</p>
            <Input
              value={verifyInput}
              onChange={(event) => {
                setVerifyInput(event.target.value);
              }}
              placeholder="FamilyUniqueCode or Document ID"
            />
            <div className="distribution-modal-actions">
              <Button
                className="server-btn"
                onClick={() => void handleConfirm()}
                disabled={isSavingDistribution}
              >
                {isSavingDistribution ? 'Saving...' : 'Confirm'}
              </Button>
              <Button
                variant="outline"
                className="server-btn distribution-cancel-btn"
                onClick={() => {
                  setIsVerifyModalOpen(false);
                  setVerifyInput('');
                }}
                disabled={isSavingDistribution}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
