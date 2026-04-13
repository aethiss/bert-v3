import { useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import type { UpdaterPhase, UpdaterState } from '@shared/types/ipc/updater';
import { subscribeToUpdaterState } from '@renderer/services/updaterService';

function hasPhaseChanged(previous: UpdaterPhase | null, next: UpdaterPhase): boolean {
  return previous !== next;
}

export function AppUpdateNotifications() {
  const intl = useIntl();
  const previousStateRef = useRef<UpdaterState | null>(null);
  const announcedAvailableVersionRef = useRef<string | null>(null);
  const announcedDownloadedVersionRef = useRef<string | null>(null);

  useEffect(() => {
    return subscribeToUpdaterState((nextState) => {
      const previousState = previousStateRef.current;
      previousStateRef.current = nextState;

      if (!nextState.isSupported) {
        return;
      }

      if (
        nextState.phase === 'available' &&
        nextState.availableVersion &&
        (hasPhaseChanged(previousState?.phase ?? null, nextState.phase) ||
          announcedAvailableVersionRef.current !== nextState.availableVersion)
      ) {
        announcedAvailableVersionRef.current = nextState.availableVersion;
        toast.info(intl.formatMessage({ id: 'updater.toast.availableTitle' }), {
          description: intl.formatMessage(
            { id: 'updater.toast.availableDescription' },
            { version: nextState.availableVersion ?? nextState.currentVersion }
          )
        });
      }

      if (
        nextState.phase === 'downloaded' &&
        nextState.downloadedVersion &&
        (hasPhaseChanged(previousState?.phase ?? null, nextState.phase) ||
          announcedDownloadedVersionRef.current !== nextState.downloadedVersion)
      ) {
        announcedDownloadedVersionRef.current = nextState.downloadedVersion;
        toast.success(intl.formatMessage({ id: 'updater.toast.downloadedTitle' }), {
          description: intl.formatMessage(
            { id: 'updater.toast.downloadedDescription' },
            { version: nextState.downloadedVersion ?? nextState.currentVersion }
          )
        });
      }
    });
  }, [intl]);

  return null;
}
