import type { ReactElement } from 'react';
import type { ReceiptPayload } from './types';
import { formatReceiptDateTime } from './receiptHelpers';

type Props = {
  logoSrc: string;
  payload: ReceiptPayload;
};

function Row({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="receipt-row receipt-row-a5">
      <div className="receipt-row-label receipt-row-label-a5">{label}</div>
      <div className="receipt-row-value">{value || 'N/A'}</div>
    </div>
  );
}

export function ReceiptA5({ logoSrc, payload }: Props): ReactElement {
  return (
    <div className="receipt receipt-a5">
      <div className="receipt-header receipt-header-a5">
        <img src={logoSrc} alt="WFP logo" width={200} className="receipt-logo" />
        <div className="receipt-title receipt-title-a5">{payload.title}</div>
      </div>

      <div className="receipt-section receipt-section-a5">
        <Row label="Head Of Household" value={payload.headOfHousehold} />
        <Row label="Date" value={formatReceiptDateTime(payload.printedAtIso)} />
        <Row label="Receipt ID" value={payload.receiptId} />
        <Row label="Household ID" value={payload.householdId} />
        <Row label="FDP" value={payload.fdp} />
        <Row label="Collected By" value={payload.collectedBy} />
      </div>

      <div className="receipt-section receipt-section-a5">
        {payload.cycles.length > 0 ? (
          payload.cycles.map((cycle, index) => (
            <div key={`${cycle.cycleName}-${index}`} className="receipt-cycle receipt-cycle-a5">
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
              {index !== payload.cycles.length - 1 ? <div className="receipt-line" /> : null}
            </div>
          ))
        ) : (
          <div className="receipt-cycle receipt-cycle-a5">No data</div>
        )}
      </div>
    </div>
  );
}
