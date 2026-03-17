import { useMemo, useRef } from 'react';
import { useIntl } from 'react-intl';
import { useReactToPrint } from 'react-to-print';
import { Button } from '@ui/components/ui/button';
import type { ReceiptPayload } from './types';
import { Receipt58mm } from './Receipt58mm';
import { Receipt80mm } from './Receipt80mm';
import { ReceiptA5 } from './ReceiptA5';
import wfpLogoStandardBlackEn from '@renderer/assets/branding/wfp-logo-standard-black-en.svg';

type Props = {
  payload: ReceiptPayload;
  onClose: () => void;
  onPrinted: () => void;
};

const LOGO_URL = wfpLogoStandardBlackEn;

export function DistributionPrintPreview({ payload, onClose, onPrinted }: Props) {
  const intl = useIntl();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `receipt-${payload.householdId}-${payload.format}`,
    onAfterPrint: onPrinted
  });

  const layout = useMemo(() => {
    if (payload.format === '58mm') {
      return <Receipt58mm logoSrc={LOGO_URL} payload={payload} />;
    }
    if (payload.format === '80mm') {
      return <Receipt80mm logoSrc={LOGO_URL} payload={payload} />;
    }
    return <ReceiptA5 logoSrc={LOGO_URL} payload={payload} />;
  }, [payload]);

  return (
    <div className="print-preview-overlay" role="presentation">
      <div
        className="print-preview-shell"
        role="dialog"
        aria-modal="true"
        aria-label={intl.formatMessage({ id: 'print.previewAria' })}
      >
        <header className="print-preview-header">
          <h2>{intl.formatMessage({ id: 'print.previewTitle' })}</h2>
          <p>{intl.formatMessage({ id: 'print.previewFormat' }, { format: payload.format })}</p>
        </header>

        <section className="print-preview-content">
          <div ref={printRef}>{layout}</div>
        </section>

        <footer className="print-preview-actions">
          <Button variant="outline" className="server-btn distribution-cancel-btn" onClick={onClose}>
            {intl.formatMessage({ id: 'common.close' })}
          </Button>
          <Button className="server-btn" onClick={() => void handlePrint()}>
            {intl.formatMessage({ id: 'actions.print' })}
          </Button>
        </footer>
      </div>
    </div>
  );
}
