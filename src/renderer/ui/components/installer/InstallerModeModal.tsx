import { useMemo, useState } from 'react';
import type { AppMode } from '@shared/types/appMode';

interface InstallerModeModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  onConfirm: (mode: AppMode) => Promise<void>;
}

export function InstallerModeModal({
  isOpen,
  isSubmitting,
  errorMessage,
  onConfirm
}: InstallerModeModalProps) {
  const [selectedMode, setSelectedMode] = useState<AppMode>('CLIENT');
  const [confirmed, setConfirmed] = useState(false);

  const canProceed = useMemo(() => !isSubmitting && confirmed, [isSubmitting, confirmed]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="installer-backdrop" role="presentation">
      <section className="installer-modal" role="dialog" aria-modal="true" aria-labelledby="installer-title">
        <header className="installer-titlebar">
          <p>BERT Setup</p>
          <button type="button" className="installer-close" aria-label="Close" disabled>
            ×
          </button>
        </header>

        <h2 id="installer-title" className="installer-main-title">
          Choose installation mode
        </h2>

        <div className="installer-grid">
          <button
            type="button"
            className={`mode-card ${selectedMode === 'SERVER' ? 'mode-card-selected' : ''}`}
            onClick={() => setSelectedMode('SERVER')}
            disabled={isSubmitting}
          >
            <span className="mode-icon" aria-hidden="true">
              <svg viewBox="0 0 64 64">
                <rect x="9" y="10" width="40" height="13" rx="2" />
                <rect x="9" y="26" width="40" height="13" rx="2" />
                <rect x="9" y="42" width="26" height="11" rx="2" />
                <rect x="37" y="42" width="18" height="11" rx="2" />
                <circle cx="16" cy="16.5" r="1.8" className="mode-icon-detail" />
                <circle cx="23" cy="16.5" r="1.8" className="mode-icon-detail" />
                <circle cx="16" cy="32.5" r="1.8" className="mode-icon-detail" />
                <circle cx="23" cy="32.5" r="1.8" className="mode-icon-detail" />
              </svg>
            </span>
            <span className="mode-card-label">SERVER</span>
          </button>

          <button
            type="button"
            className={`mode-card ${selectedMode === 'CLIENT' ? 'mode-card-selected' : ''}`}
            onClick={() => setSelectedMode('CLIENT')}
            disabled={isSubmitting}
          >
            <span className="mode-icon" aria-hidden="true">
              <svg viewBox="0 0 64 64">
                <rect x="10" y="10" width="44" height="32" rx="2" />
                <rect x="28" y="44" width="8" height="6" />
                <rect x="21" y="50" width="22" height="3" rx="1.5" />
              </svg>
            </span>
            <span className="mode-card-label">CLIENT</span>
          </button>
        </div>

        <div className="installer-warning">This choice cannot be changed later.</div>

        <label className="installer-checkbox-row">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={isSubmitting}
          />
          <span>I understand and want to continue</span>
        </label>

        {errorMessage ? <p className="installer-error">{errorMessage}</p> : null}

        <footer className="installer-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canProceed}
            onClick={() => {
              void onConfirm(selectedMode);
            }}
          >
            {isSubmitting ? 'Saving...' : 'Next'}
          </button>
        </footer>
      </section>
    </div>
  );
}
