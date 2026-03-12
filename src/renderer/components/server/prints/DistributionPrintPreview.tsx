import { useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button } from '@ui/components/ui/button';
import type { ReceiptPayload } from './types';
import { Receipt58mm } from './Receipt58mm';
import { Receipt80mm } from './Receipt80mm';
import { ReceiptA5 } from './ReceiptA5';

type Props = {
  payload: ReceiptPayload;
  onClose: () => void;
  onPrinted: () => void;
};

const LOGO_URL = 'https://uikit.wfp.org/cdn/logos/latest/wfp-logo-standard-black-en.svg';

export function DistributionPrintPreview({ payload, onClose, onPrinted }: Props) {
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
      <div className="print-preview-shell" role="dialog" aria-modal="true" aria-label="Print preview">
        <header className="print-preview-header">
          <h2>Print Preview</h2>
          <p>Format: {payload.format}</p>
        </header>

        <section className="print-preview-content">
          <div ref={printRef}>{layout}</div>
        </section>

        <footer className="print-preview-actions">
          <Button variant="outline" className="server-btn distribution-cancel-btn" onClick={onClose}>
            Close
          </Button>
          <Button className="server-btn" onClick={() => void handlePrint()}>
            Print
          </Button>
        </footer>
      </div>
    </div>
  );
}
