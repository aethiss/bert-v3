import { useCallback, useEffect, useState } from 'react';
import type { AppMode } from '@shared/types/appMode';
import { getInstallerModeState, setInstallerMode } from '@services/installerService';
import { showErrorToast } from '@renderer/lib/errorToast';
import { getUiMessage } from '@renderer/i18n/messages';

interface InstallerModeSetupState {
  mode: AppMode | null;
  isLocked: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  setMode: (mode: AppMode) => Promise<void>;
}

export function useInstallerModeSetup(): InstallerModeSetupState {
  const [mode, setModeValue] = useState<AppMode | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadState() {
      try {
        const state = await getInstallerModeState();
        if (!isMounted) return;

        setModeValue(state.mode);
        setIsLocked(state.isLocked);
      } catch {
        if (!isMounted) return;
        const message = getUiMessage(
          'installer.error.loadConfig',
          'Unable to load installer configuration.'
        );
        setErrorMessage(message);
        showErrorToast(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadState();

    return () => {
      isMounted = false;
    };
  }, []);

  const setMode = useCallback(async (nextMode: AppMode) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const state = await setInstallerMode(nextMode);
      setModeValue(state.mode);
      setIsLocked(state.isLocked);
    } catch {
      const message = getUiMessage(
        'installer.error.modeLocked',
        'Mode is already configured and cannot be changed.'
      );
      setErrorMessage(message);
      showErrorToast(message);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    mode,
    isLocked,
    isLoading,
    isSubmitting,
    errorMessage,
    setMode
  };
}
