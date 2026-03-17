import type { ReactElement } from 'react';
import { useIntl } from 'react-intl';
import type { ReceiptPayload } from './types';
import { formatReceiptDateTime } from './receiptHelpers';

type Props = {
  logoSrc: string;
  payload: ReceiptPayload;
};

function Row({ label, value, fallback }: { label: string; value: string; fallback: string }): ReactElement {
  return (
    <div className="receipt-row receipt-row-a5">
      <div className="receipt-row-label receipt-row-label-a5">{label}</div>
      <div className="receipt-row-value">{value || fallback}</div>
    </div>
  );
}

export function ReceiptA5({ logoSrc, payload }: Props): ReactElement {
  const intl = useIntl();

  return (
    <div className="receipt receipt-a5">
      <div className="receipt-header receipt-header-a5">
        <img src={logoSrc} alt={intl.formatMessage({ id: 'receipt.logoAlt' })} width={200} className="receipt-logo" />
        <div className="receipt-title receipt-title-a5">{payload.title}</div>
      </div>

      <div className="receipt-section receipt-section-a5">
        <Row
          label={intl.formatMessage({ id: 'receipt.label.headOfHousehold' })}
          value={payload.headOfHousehold}
          fallback={intl.formatMessage({ id: 'common.na' })}
        />
        <Row
          label={intl.formatMessage({ id: 'receipt.label.date' })}
          value={formatReceiptDateTime(payload.printedAtIso)}
          fallback={intl.formatMessage({ id: 'common.na' })}
        />
        <Row
          label={intl.formatMessage({ id: 'receipt.label.receiptId' })}
          value={payload.receiptId}
          fallback={intl.formatMessage({ id: 'common.na' })}
        />
        <Row
          label={intl.formatMessage({ id: 'receipt.label.householdId' })}
          value={payload.householdId}
          fallback={intl.formatMessage({ id: 'common.na' })}
        />
        <Row
          label={intl.formatMessage({ id: 'receipt.label.fdp' })}
          value={payload.fdp}
          fallback={intl.formatMessage({ id: 'common.na' })}
        />
        <Row
          label={intl.formatMessage({ id: 'receipt.label.collectedBy' })}
          value={payload.collectedBy}
          fallback={intl.formatMessage({ id: 'common.na' })}
        />
      </div>

      <div className="receipt-section receipt-section-a5">
        {payload.cycles.length > 0 ? (
          payload.cycles.map((cycle, index) => (
            <div key={`${cycle.cycleName}-${index}`} className="receipt-cycle receipt-cycle-a5">
              <div>
                <span className="receipt-bold">{intl.formatMessage({ id: 'receipt.label.cycle' })}</span>{' '}
                {cycle.cycleName || intl.formatMessage({ id: 'common.na' })}
              </div>
              <div>
                <span className="receipt-bold">{intl.formatMessage({ id: 'receipt.label.packageDescription' })}</span>{' '}
                {cycle.assistanceType || intl.formatMessage({ id: 'common.na' })}
              </div>
              <div>
                <span className="receipt-bold">{intl.formatMessage({ id: 'receipt.label.qty' })}</span>{' '}
                {cycle.quantity || intl.formatMessage({ id: 'common.na' })}
              </div>
              {index !== payload.cycles.length - 1 ? <div className="receipt-line" /> : null}
            </div>
          ))
        ) : (
          <div className="receipt-cycle receipt-cycle-a5">{intl.formatMessage({ id: 'receipt.noData' })}</div>
        )}
      </div>
    </div>
  );
}
