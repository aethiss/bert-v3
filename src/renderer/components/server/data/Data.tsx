import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@ui/components/ui/button';
import {
  clearDistributionQueue,
  getDistributionQueue
} from '@renderer/services/eligibleDataService';
import { showErrorToast } from '@renderer/lib/errorToast';

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
  const [isPushConfirmOpen, setIsPushConfirmOpen] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const pendingText = useMemo(() => {
    const label = pendingDistributionCount === 1 ? 'distribution' : 'distributions';
    return `${pendingDistributionCount} ${label} need to be pushed.`;
  }, [pendingDistributionCount]);

  const handlePushDistribution = async (): Promise<void> => {
    setIsPushing(true);
    try {
      const result = await clearDistributionQueue();
      window.dispatchEvent(new Event('distribution-queue-updated'));
      toast.success('Push completed', {
        description: `${result.deleted} local distribution(s) cleared.`
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
        toast.error('Export failed', {
          description: 'No local distributions available to export.'
        });
        return;
      }

      const csv = createDistributionCsv(rows);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadCsv(`distribution-report-${timestamp}.csv`, csv);
      toast.success('Export completed', {
        description: `${rows.length} row(s) exported to CSV.`
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="server-content-block">
      <h1 className="server-page-title">Data</h1>

      <section className="data-section">
        <div className="data-section-row">
          <div>
            <p className="data-section-title">Synchronize data and finish distribution</p>
            <p className="data-section-warning">X {pendingText}</p>
          </div>
          <Button
            className="server-btn data-action-btn"
            disabled={pendingDistributionCount === 0 || isPushing}
            onClick={() => {
              setIsPushConfirmOpen(true);
            }}
          >
            {isPushing ? 'Pushing...' : 'Push Distribution'}
          </Button>
        </div>
      </section>

      <section className="data-section data-section-export">
        <h2 className="data-export-title">Export Reports</h2>
        <div className="data-section-row">
          <p className="data-section-title">Export distribution report to excel</p>
          <Button
            className="server-btn data-action-btn"
            onClick={() => void handleExport()}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </section>

      {isPushConfirmOpen ? (
        <div className="distribution-modal-backdrop" role="presentation">
          <div className="distribution-modal" role="dialog" aria-modal="true">
            <h2>Confirm Push Distribution</h2>
            <p>
              Endpoint is not ready yet. This action will simulate push and clear all local
              distributions. Continue?
            </p>
            <div className="distribution-modal-actions">
              <Button
                className="server-btn"
                onClick={() => void handlePushDistribution()}
                disabled={isPushing}
              >
                {isPushing ? 'Confirming...' : 'Confirm'}
              </Button>
              <Button
                variant="outline"
                className="server-btn distribution-cancel-btn"
                onClick={() => {
                  setIsPushConfirmOpen(false);
                }}
                disabled={isPushing}
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
