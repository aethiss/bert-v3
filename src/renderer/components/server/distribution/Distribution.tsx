import { useEffect, useRef, useState } from 'react';
import { ExternalLink, ScanLine, Search } from 'lucide-react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { Button } from '@ui/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ServerRouteComponentProps } from '@renderer/components/server/types';
import type {
  DistributionDetailData,
  DistributionSearchResult,
  FamilyDistributionHistoryItem
} from '@shared/types/eligible';
import { parseDocumentIdFromPdf417Payload } from '@shared/types/scanner';
import {
  getFamilyDistributionHistory,
  getDistributionDetail,
  saveDistributionEvent,
  searchDistributionMember
} from '@renderer/services/eligibleDataService';
import { getPrintSettings } from '@renderer/services/configService';
import { showErrorToast } from '@renderer/lib/errorToast';
import { useAppSelector } from '@renderer/store/hooks';
import { selectCurrentUser } from '@renderer/store/selectors/authSelectors';
import { DistributionPrintPreview } from '@renderer/components/server/prints/DistributionPrintPreview';
import { hideMiddleNumbers } from '@renderer/components/server/prints/receiptHelpers';
import type { ReceiptPayload } from '@renderer/components/server/prints/types';

function isPrincipleRole(role: string | null): boolean {
  const normalized = (role ?? '').trim().toLowerCase();
  return normalized === 'principle' || normalized === 'principal';
}

function asAgeLabel(age: number | null, fallback: string): string {
  return typeof age === 'number' ? String(age) : fallback;
}

function parseQuantity(value: string | null | undefined): number {
  if (!value) {
    return 1;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.round(parsed));
}

export function Distribution({ route, onNavigate }: ServerRouteComponentProps) {
  const intl = useIntl();
  const currentUser = useAppSelector(selectCurrentUser);
  const [query, setQuery] = useState('');
  const [isScanModeActive, setIsScanModeActive] = useState(false);
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
  const [printPreviewPayload, setPrintPreviewPayload] = useState<ReceiptPayload | null>(null);
  const [historyItems, setHistoryItems] = useState<FamilyDistributionHistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef<number | null>(null);

  const filteredMembers = detail?.members ?? [];

  const selectedMember = (() => {
    return filteredMembers.find((member) => member.memberId === selectedMemberId) ?? null;
  })();

  const selectedCycleMap = new Map(detail?.activeCycles.map((cycle) => [cycle.cycleCode, cycle]) ?? []);

  useEffect(() => {
    if (route.distributionMode === 'detail') {
      setIsScanModeActive(false);
    }
  }, [route.distributionMode]);

  useEffect(() => {
    if (!isScanModeActive || route.distributionMode === 'detail') {
      return;
    }

    const clearTimer = () => {
      if (scanTimerRef.current !== null) {
        window.clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };

    const finalizeScan = () => {
      clearTimer();
      const payload = scanBufferRef.current;
      scanBufferRef.current = '';
      setIsScanModeActive(false);

      const parsedDocumentId = parseDocumentIdFromPdf417Payload(payload);
      if (!parsedDocumentId) {
        toast.error(intl.formatMessage({ id: 'distribution.scanFailedTitle' }), {
          description: intl.formatMessage({ id: 'distribution.scanFailedDescription' })
        });
        return;
      }

      setQuery(parsedDocumentId);
      toast.success(intl.formatMessage({ id: 'distribution.documentScannedTitle' }), {
        description: intl.formatMessage(
          { id: 'distribution.documentScannedDescription' },
          { documentId: parsedDocumentId }
        )
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        scanBufferRef.current = '';
        clearTimer();
        setIsScanModeActive(false);
        toast.message(intl.formatMessage({ id: 'distribution.scanCancelled' }));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        finalizeScan();
        return;
      }

      if (event.key.length !== 1) {
        return;
      }

      event.preventDefault();
      scanBufferRef.current += event.key;
      clearTimer();
      scanTimerRef.current = window.setTimeout(() => {
        finalizeScan();
      }, 180);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      clearTimer();
    };
  }, [intl, isScanModeActive, route.distributionMode]);

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
        familyUniqueCode: result.member.familyUniqueCode
      });

      if (!detailData) {
        toast.error(intl.formatMessage({ id: 'common.error' }), {
          description: intl.formatMessage({ id: 'distribution.loadDetailError' })
        });
        return;
      }

      const defaultCycle = detailData.activeCycles[0]?.cycleCode ?? null;
      const defaultMember = detailData.members.find((member) => member.memberId === result.member.id);
      const fallbackMember = detailData.members[0] ?? null;

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
      toast.error(intl.formatMessage({ id: 'common.error' }), {
        description: intl.formatMessage({ id: 'distribution.selectCycleError' })
      });
      return;
    }

    const mainOperator = currentUser?.id;
    const mainOperatorFDP = (currentUser?.fdp ?? '').trim();

    if (!Number.isFinite(mainOperator ?? null)) {
      toast.error(intl.formatMessage({ id: 'common.error' }), {
        description: intl.formatMessage({ id: 'distribution.missingUserIdError' })
      });
      return;
    }

    if (!mainOperatorFDP) {
      toast.error(intl.formatMessage({ id: 'common.error' }), {
        description: intl.formatMessage({ id: 'distribution.missingUserFdpError' })
      });
      return;
    }

    const normalizedVerify = verifyInput.trim();
    const matchesFamilyCode = normalizedVerify === String(detail.household.familyUniqueCode);
    const matchesDocumentId =
      Boolean(selectedMember.documentNumber) && normalizedVerify === String(selectedMember.documentNumber);

    if (!matchesFamilyCode && !matchesDocumentId) {
      toast.error(intl.formatMessage({ id: 'common.error' }), {
        description: intl.formatMessage({ id: 'distribution.verificationFailedError' })
      });
      return;
    }

    setIsSavingDistribution(true);
    setBlockingMessage(null);
    try {
      const selectedCycle =
        detail.activeCycles.find((cycle) => cycle.cycleCode === selectedCycleCode) ?? null;
      await saveDistributionEvent({
        familyUniqueCode: detail.household.familyUniqueCode,
        memberId: selectedMemberId,
        cycleCode: selectedCycleCode,
        mainOperator: mainOperator as number,
        mainOperatorFDP,
        subOperator: null,
        quantity: parseQuantity(selectedCycle?.quantity),
        appSignature: '1234567890',
        notes: notes.trim() || null
      });

      window.dispatchEvent(new Event('distribution-queue-updated'));

      setIsVerifyModalOpen(false);
      setVerifyInput('');
      const printSettings = await getPrintSettings();
      if (printSettings.disabled) {
        toast.success(intl.formatMessage({ id: 'common.saved' }), {
          description: intl.formatMessage({ id: 'distribution.savedLocalDescription' })
        });
        onNavigate({
          ...route,
          section: 'distribution',
          distributionMode: 'search'
        });
        return;
      }

      setPrintPreviewPayload({
        title: intl.formatMessage({ id: 'distribution.receiptTitle' }),
        headOfHousehold: detail.household.principle || selectedMember.fullName,
        receiptId: '1234567890',
        householdId: String(detail.household.familyUniqueCode),
        fdp: currentUser?.fdp ?? intl.formatMessage({ id: 'common.na' }),
        collectedBy: hideMiddleNumbers(selectedMember.documentNumber ?? String(selectedMember.memberId)),
        printedAtIso: new Date().toISOString(),
        cycles: selectedCycle
          ? [
              {
                cycleName: selectedCycle.cycleName,
                assistanceType: selectedCycle.assistanceType,
                quantity: selectedCycle.quantity
              }
            ]
          : [],
        format: printSettings.format
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.toLowerCase().includes('duplicate distribution blocked')) {
        const visibleMessage = intl.formatMessage({ id: 'distribution.blockedDescription' });
        setBlockingMessage(visibleMessage);
        toast.error(intl.formatMessage({ id: 'distribution.blockedTitle' }), {
          description: visibleMessage
        });
        return;
      }
      showErrorToast(error);
    } finally {
      setIsSavingDistribution(false);
    }
  };

  const handleOpenHistory = async (): Promise<void> => {
    if (!detail) {
      return;
    }

    setIsLoadingHistory(true);
    try {
      const rows = await getFamilyDistributionHistory(detail.household.familyUniqueCode);
      setHistoryItems(rows);
      setIsHistoryOpen(true);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handlePrintHistoryItem = (item: FamilyDistributionHistoryItem): void => {
    const cycleMeta = selectedCycleMap.get(item.cycleCode);
    setPrintPreviewPayload({
      title: intl.formatMessage({ id: 'distribution.receiptTitle' }),
      headOfHousehold: detail?.household.principle ?? intl.formatMessage({ id: 'common.na' }),
      receiptId: item.appSignature,
      householdId: String(item.familyUniqueCode),
      fdp: currentUser?.fdp ?? intl.formatMessage({ id: 'common.na' }),
      collectedBy: String(item.memberId),
      printedAtIso: item.createdAt,
      cycles: [
        {
          cycleName: cycleMeta?.cycleName ?? `Cycle ${item.cycleCode}`,
          assistanceType: cycleMeta?.assistanceType ?? intl.formatMessage({ id: 'common.na' }),
          quantity: String(item.quantity)
        }
      ],
      format: 'A5'
    });
    setIsHistoryOpen(false);
  };

  return (
    <section className="server-content-block">
      <h1 className="server-page-title">{intl.formatMessage({ id: 'distribution.title' })}</h1>
      {blockingMessage ? <div className="distribution-blocking-alert">{blockingMessage}</div> : null}

      {route.distributionMode !== 'detail' ? (
        <>
          <p className="server-label">{intl.formatMessage({ id: 'distribution.searchHousehold' })}</p>
          <div className="distribution-search-row">
            <Input
              aria-label={intl.formatMessage({ id: 'distribution.householdSearchAria' })}
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
              placeholder={intl.formatMessage({ id: 'distribution.searchPlaceholder' })}
            />
            <Button
              className="server-btn distribution-search-btn"
              onClick={() => void handleSearch()}
              disabled={isSearching}
            >
              <Search className="distribution-btn-icon" />
              {isSearching
                ? intl.formatMessage({ id: 'distribution.searching' })
                : intl.formatMessage({ id: 'distribution.search' })}
            </Button>
            <Button
              className={`server-btn distribution-search-btn distribution-scan-btn${
                isScanModeActive ? ' active' : ''
              }`}
              variant={isScanModeActive ? 'outline' : 'default'}
              onClick={() => {
                if (isScanModeActive) {
                  scanBufferRef.current = '';
                  if (scanTimerRef.current !== null) {
                    window.clearTimeout(scanTimerRef.current);
                    scanTimerRef.current = null;
                  }
                  setIsScanModeActive(false);
                  return;
                }

                scanBufferRef.current = '';
                setIsScanModeActive(true);
                toast.message(intl.formatMessage({ id: 'distribution.scanListeningTitle' }), {
                  description: intl.formatMessage({ id: 'distribution.scanListeningDescription' })
                });
              }}
              disabled={isSearching}
            >
              <ScanLine className="distribution-btn-icon" />
              {isScanModeActive
                ? intl.formatMessage({ id: 'distribution.cancelScan' })
                : intl.formatMessage({ id: 'distribution.scanDocument' })}
            </Button>
          </div>

          {route.distributionMode === 'result' && result ? (
            <table className="distribution-table" aria-label={intl.formatMessage({ id: 'distribution.resultsAria' })}>
              <thead>
                <tr>
                  <th>{intl.formatMessage({ id: 'table.uuid' })}</th>
                  <th>{intl.formatMessage({ id: 'table.familyId' })}</th>
                  <th>{intl.formatMessage({ id: 'table.principle' })}</th>
                  <th>{intl.formatMessage({ id: 'table.phone' })}</th>
                  <th>{intl.formatMessage({ id: 'table.address' })}</th>
                  <th>{intl.formatMessage({ id: 'table.actions' })}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{result.member.id}</td>
                  <td>{result.member.familyUniqueCode}</td>
                  <td>
                    {isPrincipleRole(result.member.role)
                      ? intl.formatMessage({ id: 'common.yes' })
                      : intl.formatMessage({ id: 'common.no' })}
                  </td>
                  <td>{intl.formatMessage({ id: 'common.na' })}</td>
                  <td>{intl.formatMessage({ id: 'common.na' })}</td>
                  <td className="distribution-action-cell">
                    <div className="distribution-action-content">
                      <button
                        type="button"
                        className="distribution-action-btn"
                        onClick={() => void handleOpenDetail()}
                        disabled={isLoadingDetail}
                      >
                        {isLoadingDetail
                          ? intl.formatMessage({ id: 'common.loading' })
                          : intl.formatMessage({ id: 'distribution.distribute' })}
                      </button>
                      <ExternalLink size={14} />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : null}

          {hasSearched && !result ? (
            <p className="distribution-empty">{intl.formatMessage({ id: 'distribution.emptySearch' })}</p>
          ) : null}
        </>
      ) : null}

      {route.distributionMode === 'detail' && detail ? (
        <section className="distribution-detail-layout">
          <aside className="distribution-detail-sidebar">
            <p className="distribution-detail-section-title">{intl.formatMessage({ id: 'distribution.householdInfo' })}</p>
            <dl className="distribution-info-list">
              <div>
                <dt>{intl.formatMessage({ id: 'distribution.idmId' })}</dt>
                <dd>{detail.household.idmId}</dd>
              </div>
              <div>
                <dt>{intl.formatMessage({ id: 'distribution.booklet' })}</dt>
                <dd>{detail.household.booklet}</dd>
              </div>
              <div>
                <dt>{intl.formatMessage({ id: 'distribution.principle' })}</dt>
                <dd>{detail.household.principle}</dd>
              </div>
              <div>
                <dt>{intl.formatMessage({ id: 'distribution.phone' })}</dt>
                <dd>{detail.household.phone}</dd>
              </div>
              <div>
                <dt>{intl.formatMessage({ id: 'distribution.registrationDate' })}</dt>
                <dd>{detail.household.registrationDate}</dd>
              </div>
              <div>
                <dt>{intl.formatMessage({ id: 'distribution.pbwgs' })}</dt>
                <dd>{detail.household.pbwgs}</dd>
              </div>
              <div>
                <dt>{intl.formatMessage({ id: 'distribution.children623' })}</dt>
                <dd>{detail.household.children623}</dd>
              </div>
            </dl>

            <div className="distribution-sidebar-actions">
              <p className="distribution-detail-section-title">{intl.formatMessage({ id: 'distribution.actionsSection' })}</p>
              <Button
                variant="outline"
                className="server-btn"
                onClick={() => void handleOpenHistory()}
                disabled={isLoadingHistory}
              >
                {isLoadingHistory
                  ? intl.formatMessage({ id: 'common.loading' })
                  : intl.formatMessage({ id: 'distribution.distributionHistory' })}
              </Button>
            </div>
          </aside>

          <section className="distribution-detail-main">
            <p className="distribution-detail-section-title">{intl.formatMessage({ id: 'distribution.activeCycles' })}</p>
            <table className="distribution-detail-table">
              <thead>
                <tr>
                  <th>{intl.formatMessage({ id: 'table.collector' })}</th>
                  <th>{intl.formatMessage({ id: 'table.cycleName' })}</th>
                  <th>{intl.formatMessage({ id: 'table.assistanceType' })}</th>
                  <th>{intl.formatMessage({ id: 'table.quantity' })}</th>
                  <th>{intl.formatMessage({ id: 'table.startDate' })}</th>
                  <th>{intl.formatMessage({ id: 'table.endDate' })}</th>
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

            <p className="distribution-detail-section-title">{intl.formatMessage({ id: 'distribution.householdMembers' })}</p>
            <table className="distribution-detail-table">
              <thead>
                <tr>
                  <th>{intl.formatMessage({ id: 'table.collector' })}</th>
                  <th>{intl.formatMessage({ id: 'table.name' })}</th>
                  <th>{intl.formatMessage({ id: 'table.id' })}</th>
                  <th>{intl.formatMessage({ id: 'table.age' })}</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.memberId}>
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
                    <td>{asAgeLabel(member.age, intl.formatMessage({ id: 'common.na' }))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="distribution-detail-section-title">{intl.formatMessage({ id: 'distribution.notes' })}</p>
            <textarea
              className="distribution-notes"
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
              placeholder={intl.formatMessage({ id: 'distribution.notesPlaceholder' })}
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
                {intl.formatMessage({ id: 'actions.confirm' })}
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
                {intl.formatMessage({ id: 'common.cancel' })}
              </Button>
            </div>
          </section>
        </section>
      ) : null}

      {isVerifyModalOpen ? (
        <div className="distribution-modal-backdrop" role="presentation">
          <div className="distribution-modal" role="dialog" aria-modal="true">
            <h2>{intl.formatMessage({ id: 'distribution.confirmDistributionTitle' })}</h2>
            <p>{intl.formatMessage({ id: 'distribution.confirmDistributionDescription' })}</p>
            <Input
              value={verifyInput}
              onChange={(event) => {
                setVerifyInput(event.target.value);
              }}
              placeholder={intl.formatMessage({ id: 'distribution.verifyPlaceholder' })}
            />
            <div className="distribution-modal-actions">
              <Button
                className="server-btn"
                onClick={() => void handleConfirm()}
                disabled={isSavingDistribution}
              >
                {isSavingDistribution
                  ? intl.formatMessage({ id: 'common.saving' })
                  : intl.formatMessage({ id: 'actions.confirm' })}
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
                {intl.formatMessage({ id: 'common.cancel' })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isHistoryOpen ? (
        <div className="distribution-modal-backdrop" role="presentation">
          <div className="distribution-modal" role="dialog" aria-modal="true">
            <h2>{intl.formatMessage({ id: 'distribution.distributionHistory' })}</h2>
            {historyItems.length === 0 ? (
              <p>{intl.formatMessage({ id: 'distribution.historyEmpty' })}</p>
            ) : (
              <table className="distribution-detail-table">
                <thead>
                  <tr>
                    <th>{intl.formatMessage({ id: 'table.date' })}</th>
                    <th>{intl.formatMessage({ id: 'table.time' })}</th>
                    <th>{intl.formatMessage({ id: 'table.cycle' })}</th>
                    <th>{intl.formatMessage({ id: 'table.quantity' })}</th>
                    <th>{intl.formatMessage({ id: 'table.actions' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item) => {
                    const createdAt = new Date(item.createdAt);
                    const date = Number.isNaN(createdAt.getTime())
                      ? intl.formatMessage({ id: 'common.na' })
                      : createdAt.toLocaleDateString('en-GB');
                    const time = Number.isNaN(createdAt.getTime())
                      ? intl.formatMessage({ id: 'common.na' })
                      : createdAt.toLocaleTimeString('en-GB', { hour12: false });

                    return (
                      <tr key={item.id}>
                        <td>{date}</td>
                        <td>{time}</td>
                        <td>{item.cycleName}</td>
                        <td>{item.quantity}</td>
                        <td>
                          <Button
                            className="server-btn"
                            onClick={() => {
                              handlePrintHistoryItem(item);
                            }}
                          >
                            {intl.formatMessage({ id: 'actions.print' })}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div className="distribution-modal-actions">
              <Button
                variant="outline"
                className="server-btn distribution-cancel-btn"
                onClick={() => {
                  setIsHistoryOpen(false);
                }}
              >
                {intl.formatMessage({ id: 'common.close' })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {printPreviewPayload ? (
        <DistributionPrintPreview
          payload={printPreviewPayload}
          onClose={() => {
            setPrintPreviewPayload(null);
            onNavigate({
              ...route,
              section: 'distribution',
              distributionMode: 'search'
            });
          }}
          onPrinted={() => {
            toast.success(intl.formatMessage({ id: 'distribution.printedTitle' }), {
              description: intl.formatMessage({ id: 'distribution.printedDescription' })
            });
            setPrintPreviewPayload(null);
            onNavigate({
              ...route,
              section: 'distribution',
              distributionMode: 'search'
            });
          }}
        />
      ) : null}
    </section>
  );
}
