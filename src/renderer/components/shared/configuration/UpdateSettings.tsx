import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { showErrorToast } from '@renderer/lib/errorToast';
import {
  checkForUpdates,
  downloadUpdate,
  getUpdaterState,
  installUpdate,
  subscribeToUpdaterState
} from '@renderer/services/updaterService';
import type { UpdaterState } from '@shared/types/ipc/updater';

function formatDateTime(value: string | null, locale: string): string {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatBytes(value: number | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  if (value === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${amount.toFixed(amount >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function UpdateSettings() {
  const intl = useIntl();
  const [state, setState] = useState<UpdaterState | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const refreshState = useCallback(async () => {
    const nextState = await getUpdaterState();
    setState(nextState);
    return nextState;
  }, []);

  useEffect(() => {
    let mounted = true;

    void refreshState().catch((error) => {
      if (mounted) {
        showErrorToast(error);
      }
    });

    const unsubscribe = subscribeToUpdaterState((nextState) => {
      if (!mounted) {
        return;
      }
      setState(nextState);
      if (nextState.phase !== 'checking') {
        setIsChecking(false);
      }
      if (nextState.phase !== 'downloading') {
        setIsDownloading(false);
      }
      if (nextState.phase !== 'installing') {
        setIsInstalling(false);
      }
    });

    const onQueueUpdated = () => {
      void refreshState().catch((error) => {
        if (mounted) {
          showErrorToast(error);
        }
      });
    };

    window.addEventListener('distribution-queue-updated', onQueueUpdated);

    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener('distribution-queue-updated', onQueueUpdated);
    };
  }, [refreshState]);

  const handleCheckForUpdates = async (): Promise<void> => {
    setIsChecking(true);
    try {
      const nextState = await checkForUpdates();
      setState(nextState);
      if (nextState.phase === 'idle') {
        toast.success(intl.formatMessage({ id: 'updater.noUpdatesTitle' }), {
          description: intl.formatMessage({ id: 'updater.noUpdatesDescription' })
        });
      }
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleDownloadUpdate = async (): Promise<void> => {
    setIsDownloading(true);
    try {
      const nextState = await downloadUpdate();
      setState(nextState);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleInstallUpdate = async (): Promise<void> => {
    setIsInstalling(true);
    try {
      await installUpdate();
    } catch (error) {
      showErrorToast(error);
      setIsInstalling(false);
    }
  };

  const downloadProgressLabel = useMemo(() => {
    if (!state || state.phase !== 'downloading') {
      return null;
    }

    const percent = typeof state.downloadPercent === 'number' ? `${state.downloadPercent.toFixed(1)}%` : null;
    const transferred = formatBytes(state.transferredBytes);
    const total = formatBytes(state.totalBytes);

    if (percent && transferred && total) {
      return `${percent} · ${transferred} / ${total}`;
    }

    if (percent) {
      return percent;
    }

    if (transferred && total) {
      return `${transferred} / ${total}`;
    }

    return null;
  }, [state]);

  const statusLabel = state
    ? intl.formatMessage({ id: `updater.status.${state.phase}` })
    : intl.formatMessage({ id: 'common.loading' });

  return (
    <div className="configuration-form">
      <p className="server-form-label">{intl.formatMessage({ id: 'updater.title' })}</p>
      <p className="server-form-muted">{intl.formatMessage({ id: 'updater.description' })}</p>

      <div className="server-form-display">
        <p className="server-form-label">{intl.formatMessage({ id: 'updater.currentVersion' })}</p>
        <p className="server-form-muted">{state?.currentVersion ?? '...'}</p>
      </div>

      <div className="server-form-display">
        <p className="server-form-label">{intl.formatMessage({ id: 'common.status' })}</p>
        <p className="server-form-muted">{statusLabel}</p>
      </div>

      <div className="server-form-display">
        <p className="server-form-label">{intl.formatMessage({ id: 'updater.availableVersion' })}</p>
        <p className="server-form-muted">
          {state?.availableVersion ?? intl.formatMessage({ id: 'updater.availableVersionFallback' })}
        </p>
      </div>

      <div className="server-form-display">
        <p className="server-form-label">{intl.formatMessage({ id: 'updater.lastCheckedAt' })}</p>
        <p className="server-form-muted">
          {state
            ? formatDateTime(state.lastCheckedAt, intl.locale)
            : intl.formatMessage({ id: 'common.loading' })}
        </p>
      </div>

      {state?.releaseDate ? (
        <div className="server-form-display">
          <p className="server-form-label">{intl.formatMessage({ id: 'updater.releaseDate' })}</p>
          <p className="server-form-muted">{formatDateTime(state.releaseDate, intl.locale)}</p>
        </div>
      ) : null}

      {downloadProgressLabel ? (
        <div className="server-form-display">
          <p className="server-form-label">{intl.formatMessage({ id: 'updater.downloadProgress' })}</p>
          <p className="server-form-muted">{downloadProgressLabel}</p>
        </div>
      ) : null}

      {state?.pendingDistributionCount ? (
        <div className="server-form-display">
          <p className="server-form-label">{intl.formatMessage({ id: 'updater.installBlockTitle' })}</p>
          <p className="server-form-muted">
            {intl.formatMessage(
              { id: 'updater.installBlockDescription' },
              { count: state.pendingDistributionCount }
            )}
          </p>
        </div>
      ) : null}

      {state?.disableReason ? (
        <div className="server-form-display">
          <p className="server-form-label">{intl.formatMessage({ id: 'updater.disabledTitle' })}</p>
          <p className="server-form-muted">{state.disableReason}</p>
        </div>
      ) : null}

      {state?.lastError ? (
        <div className="server-form-display">
          <p className="server-form-label">{intl.formatMessage({ id: 'updater.lastError' })}</p>
          <p className="server-form-muted">{state.lastError}</p>
        </div>
      ) : null}

      {state?.releaseNotes ? (
        <div className="server-form-display">
          <p className="server-form-label">{intl.formatMessage({ id: 'updater.releaseNotes' })}</p>
          <p className="server-form-muted whitespace-pre-wrap">{state.releaseNotes}</p>
        </div>
      ) : null}

      <div className="configuration-server-actions">
        <Button
          className="server-btn server-start-btn"
          onClick={() => void handleCheckForUpdates()}
          disabled={!state || !state.canCheck || isChecking || isDownloading || isInstalling}
        >
          {isChecking
            ? intl.formatMessage({ id: 'updater.checkingButton' })
            : intl.formatMessage({ id: 'updater.checkButton' })}
        </Button>

        <Button
          className="server-btn server-start-btn"
          onClick={() => void handleDownloadUpdate()}
          disabled={!state || !state.canDownload || isDownloading || isChecking || isInstalling}
        >
          {isDownloading
            ? intl.formatMessage({ id: 'updater.downloadingButton' })
            : intl.formatMessage({ id: 'updater.downloadButton' })}
        </Button>

        <Button
          className="server-btn server-start-btn"
          onClick={() => void handleInstallUpdate()}
          disabled={!state || !state.canInstall || isInstalling || isChecking || isDownloading}
        >
          {isInstalling
            ? intl.formatMessage({ id: 'updater.installingButton' })
            : intl.formatMessage({ id: 'updater.installButton' })}
        </Button>
      </div>
    </div>
  );
}
