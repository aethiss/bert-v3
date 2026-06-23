import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { Button } from '@ui/components/ui/button';
import {
  exportDistributionReport,
  exportUndistributedHouseholdReport,
  pushDistributionQueue
} from '@renderer/services/eligibleDataService';
import { isAuthExpiredError } from '@renderer/lib/authExpiry';
import { showErrorToast } from '@renderer/lib/errorToast';
import { useAppSelector } from '@renderer/store/hooks';
import { selectIsOnline, selectJwt } from '@renderer/store/selectors/authSelectors';

type Props = {
  pendingDistributionCount: number;
  isSynchronizing: boolean;
  onSynchronize: () => Promise<void> | void;
  onAuthExpired: () => Promise<void> | void;
};

export function Data({
  pendingDistributionCount,
  isSynchronizing,
  onSynchronize,
  onAuthExpired
}: Props) {
  const intl = useIntl();
  const [isPushConfirmOpen, setIsPushConfirmOpen] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isReportExporting, setIsReportExporting] = useState(false);
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
      toast.info(intl.formatMessage({ id: 'data.syncingAfterPushTitle' }), {
        description: intl.formatMessage({ id: 'data.syncingAfterPushDescription' })
      });
      void onSynchronize();
    } catch (error) {
      if (isAuthExpiredError(error)) {
        setIsPushConfirmOpen(false);
        toast.error(intl.formatMessage({ id: 'data.pushAuthExpiredTitle' }), {
          description: intl.formatMessage({ id: 'data.pushAuthExpiredDescription' })
        });
        await onAuthExpired();
        return;
      }

      showErrorToast(error);
    } finally {
      setIsPushing(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    setIsExporting(true);
    try {
      const result = await exportDistributionReport();
      if (result.cancelled) {
        return;
      }
      toast.success(intl.formatMessage({ id: 'data.exportCompletedTitle' }), {
        description: intl.formatMessage(
          { id: 'data.exportCompletedDescription' },
          { count: result.rowCount }
        )
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Export cancelled.') {
        showErrorToast(error);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportUndistributedHouseholds = async (): Promise<void> => {
    setIsReportExporting(true);
    try {
      const result = await exportUndistributedHouseholdReport();
      if (result.cancelled) {
        return;
      }
      toast.success(intl.formatMessage({ id: 'data.undistributedReportCompletedTitle' }), {
        description: intl.formatMessage(
          { id: 'data.undistributedReportCompletedDescription' },
          { count: result.rowCount }
        )
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Export cancelled.') {
        showErrorToast(error);
      }
    } finally {
      setIsReportExporting(false);
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
            {isSynchronizing ? (
              <p className="data-syncing-message">{intl.formatMessage({ id: 'data.syncingAfterPushDescription' })}</p>
            ) : null}
          </div>
          <Button
            className="server-btn data-action-btn"
            disabled={pendingDistributionCount === 0 || isPushing || isSynchronizing || !isOnline || !jwt}
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
        <div className="data-export-report-list">
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
          <div className="data-section-row">
            <p className="data-section-title">
              {intl.formatMessage({ id: 'data.undistributedReportSectionTitle' })}
            </p>
            <Button
              className="server-btn data-action-btn"
              onClick={() => void handleExportUndistributedHouseholds()}
              disabled={isReportExporting}
            >
              {isReportExporting
                ? intl.formatMessage({ id: 'data.undistributedReportExporting' })
                : intl.formatMessage({ id: 'data.undistributedReportExport' })}
            </Button>
          </div>
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
                disabled={isPushing || isSynchronizing}
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
                disabled={isPushing || isSynchronizing}
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
