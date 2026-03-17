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
    <div className="receipt-row receipt-row-58">
      <div className="receipt-row-label receipt-row-label-58">{label}</div>
      <div className="receipt-row-value">{value || fallback}</div>
    </div>
  );
}

export function Receipt58mm({ logoSrc, payload }: Props): ReactElement {
  const intl = useIntl();

  return (
    <div className="receipt receipt-58">
      <div className="receipt-header">
        <img src={logoSrc} alt={intl.formatMessage({ id: 'receipt.logoAlt' })} width={120} className="receipt-logo" />
        <div className="receipt-separator">========================</div>
        <div className="receipt-title receipt-title-58">{payload.title}</div>
        <div className="receipt-plus">++++++++++++++++++++++++++++++</div>
      </div>

      <div className="receipt-section">
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
        <div className="receipt-separator">========================</div>
      </div>

      <div className="receipt-section">
        {payload.cycles.length > 0 ? (
          payload.cycles.map((cycle, index) => (
            <div key={`${cycle.cycleName}-${index}`} className="receipt-cycle receipt-cycle-58">
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
              {index !== payload.cycles.length - 1 ? (
                <div className="receipt-plus">++++++++++++++++++++++++++++++</div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="receipt-cycle receipt-cycle-58">{intl.formatMessage({ id: 'receipt.noData' })}</div>
        )}
      </div>

      <div className="receipt-footer">
        <div className="receipt-separator">========================</div>
        <div className="receipt-footer-text">{intl.formatMessage({ id: 'receipt.footerThanks' })}</div>
        <div className="receipt-separator">========================</div>
      </div>
    </div>
  );
}
