import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { Button } from '@ui/components/ui/button';
import {
  getDistributionQueue,
  pushDistributionQueue
} from '@renderer/services/eligibleDataService';
import { showErrorToast } from '@renderer/lib/errorToast';
import { useAppSelector } from '@renderer/store/hooks';
import { selectIsOnline, selectJwt } from '@renderer/store/selectors/authSelectors';

type Props = {
  pendingDistributionCount: number;
};

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value).replace(/"/g, '""');
  return `"${stringValue}"`;
}

function createDistributionCsv(rows: Awaited<ReturnType<typeof getDistributionQueue>>): string {
  const header = [
    'id',
    'familyUniqueCode',
    'memberId',
    'cycleCode',
    'mainOperator',
    'mainOperatorFDP',
    'subOperator',
    'quantity',
    'appSignature',
    'notes',
    'status',
    'createdAt'
  ];

  const lines = rows.map((row) =>
    [
      row.id,
      row.familyUniqueCode,
      row.memberId,
      row.cycleCode,
      row.mainOperator,
      row.mainOperatorFDP,
      row.subOperator,
      row.quantity,
      row.appSignature,
      row.notes,
      row.status,
      row.createdAt
    ]
      .map((value) => toCsvCell(value))
      .join(',')
  );

  return [header.join(','), ...lines].join('\n');
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function Data({ pendingDistributionCount }: Props) {
  const intl = useIntl();
  const [isPushConfirmOpen, setIsPushConfirmOpen] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const jwt = useAppSelector(selectJwt);
  const isOnline = useAppSelector(selectIsOnline);

  const pendingText = useMemo(() => {
    return intl.formatMessage(
      { id: 'data.pendingSummary' },
      { count: pendingDistributionCount }
    );
  }, [intl, pendingDistributionCount]);

  const handlePushDistribution = async (): Promise<void> => {
    setIsPushing(true);
    try {
      if (!isOnline || !jwt?.trim()) {
        throw new Error(intl.formatMessage({ id: 'data.pushRequiresOnline' }));
      }

      const result = await pushDistributionQueue({
        jwt: jwt.trim(),
        batchSize: 50
      });
      window.dispatchEvent(new Event('distribution-queue-updated'));
      toast.success(intl.formatMessage({ id: 'data.pushCompletedTitle' }), {
        description: intl.formatMessage(
          { id: 'data.pushCompletedDescription' },
          {
            inserted: result.totalInserted,
            failed: result.totalFailed,
            deleted: result.totalDeletedLocalRows
          }
        )
      });
      setIsPushConfirmOpen(false);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsPushing(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    setIsExporting(true);
    try {
      const rows = await getDistributionQueue();
      if (rows.length === 0) {
        toast.error(intl.formatMessage({ id: 'data.exportFailedTitle' }), {
          description: intl.formatMessage({ id: 'data.exportFailedDescription' })
        });
        return;
      }

      const csv = createDistributionCsv(rows);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadCsv(`distribution-report-${timestamp}.csv`, csv);
      toast.success(intl.formatMessage({ id: 'data.exportCompletedTitle' }), {
        description: intl.formatMessage(
          { id: 'data.exportCompletedDescription' },
          { count: rows.length }
        )
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="server-content-block">
      <h1 className="server-page-title">{intl.formatMessage({ id: 'data.title' })}</h1>

      <section className="data-section">
        <div className="data-section-row">
          <div>
            <p className="data-section-title">{intl.formatMessage({ id: 'data.syncSectionTitle' })}</p>
            <p className="data-section-warning">X {pendingText}</p>
          </div>
          <Button
            className="server-btn data-action-btn"
            disabled={pendingDistributionCount === 0 || isPushing || !isOnline || !jwt}
            onClick={() => {
              setIsPushConfirmOpen(true);
            }}
          >
            {isPushing
              ? intl.formatMessage({ id: 'data.pushing' })
              : intl.formatMessage({ id: 'data.pushDistribution' })}
          </Button>
        </div>
      </section>

      <section className="data-section data-section-export">
        <h2 className="data-export-title">{intl.formatMessage({ id: 'data.exportReportsTitle' })}</h2>
        <div className="data-section-row">
          <p className="data-section-title">{intl.formatMessage({ id: 'data.exportSectionTitle' })}</p>
          <Button
            className="server-btn data-action-btn"
            onClick={() => void handleExport()}
            disabled={isExporting}
          >
            {isExporting
              ? intl.formatMessage({ id: 'data.exporting' })
              : intl.formatMessage({ id: 'data.export' })}
          </Button>
        </div>
      </section>

      {isPushConfirmOpen ? (
        <div className="distribution-modal-backdrop" role="presentation">
          <div className="distribution-modal" role="dialog" aria-modal="true">
            <h2>{intl.formatMessage({ id: 'data.confirmPushTitle' })}</h2>
            <p>{intl.formatMessage({ id: 'data.confirmPushDescription' })}</p>
            <div className="distribution-modal-actions">
              <Button
                className="server-btn"
                onClick={() => void handlePushDistribution()}
                disabled={isPushing}
              >
                {isPushing
                  ? intl.formatMessage({ id: 'data.confirming' })
                  : intl.formatMessage({ id: 'actions.confirm' })}
              </Button>
              <Button
                variant="outline"
                className="server-btn distribution-cancel-btn"
                onClick={() => {
                  setIsPushConfirmOpen(false);
                }}
                disabled={isPushing}
              >
                {intl.formatMessage({ id: 'common.cancel' })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
