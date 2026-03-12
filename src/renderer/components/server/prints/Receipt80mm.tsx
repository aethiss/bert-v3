import type { ReactElement } from 'react';
import type { ReceiptPayload } from './types';
import { formatReceiptDateTime } from './receiptHelpers';

type Props = {
  logoSrc: string;
  payload: ReceiptPayload;
};

function Row({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="receipt-row receipt-row-80">
      <div className="receipt-row-label receipt-row-label-80">{label}</div>
      <div className="receipt-row-value">{value || 'N/A'}</div>
    </div>
  );
}

export function Receipt80mm({ logoSrc, payload }: Props): ReactElement {
  return (
    <div className="receipt receipt-80">
      <div className="receipt-header">
        <img src={logoSrc} alt="WFP logo" width={120} className="receipt-logo" />
        <div className="receipt-separator">======================================</div>
        <div className="receipt-title receipt-title-80">{payload.title}</div>
        <div className="receipt-plus">++++++++++++++++++++++++++++++++++++++++++++++</div>
      </div>

      <div className="receipt-section">
        <Row label="Head Of Household" value={payload.headOfHousehold} />
        <Row label="Date" value={formatReceiptDateTime(payload.printedAtIso)} />
        <Row label="Receipt ID" value={payload.receiptId} />
        <Row label="Household ID" value={payload.householdId} />
        <Row label="FDP" value={payload.fdp} />
        <Row label="Collected By" value={payload.collectedBy} />
        <div className="receipt-separator">======================================</div>
      </div>

      <div className="receipt-section">
        {payload.cycles.length > 0 ? (
          payload.cycles.map((cycle, index) => (
            <div key={`${cycle.cycleName}-${index}`} className="receipt-cycle receipt-cycle-80">
              <div>
                <span className="receipt-bold">Cycle</span> {cycle.cycleName || 'N/A'}
              </div>
              <div>
                <span className="receipt-bold">Package Description</span>{' '}
                {cycle.assistanceType || 'N/A'}
              </div>
              <div>
                <span className="receipt-bold">QTY</span> {cycle.quantity || 'N/A'}
              </div>
              {index !== payload.cycles.length - 1 ? (
                <div className="receipt-plus">++++++++++++++++++++++++++++++++++++++++++++++</div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="receipt-cycle receipt-cycle-80">No data</div>
        )}
      </div>

      <div className="receipt-footer">
        <div className="receipt-separator">======================================</div>
        <div className="receipt-footer-text">** Thank you for using BeRT **</div>
        <div className="receipt-separator">======================================</div>
      </div>
    </div>
  );
}
