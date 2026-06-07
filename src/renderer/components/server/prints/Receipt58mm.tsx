import type { ReactElement } from 'react';
import { useIntl } from 'react-intl';
import type { ReceiptPayload } from './types';
import { formatReceiptDateTime, splitReceiptId } from './receiptHelpers';
import { ReceiptCycleBlock } from './ReceiptCycleBlock';

type Props = {
  logoSrc: string;
  payload: ReceiptPayload;
};

function Row({
  label,
  value,
  fallback,
  kind,
  valueClassName
}: {
  label: string;
  value: string;
  fallback: string;
  kind?: 'text' | 'receiptId';
  valueClassName?: string;
}): ReactElement {
  const isReceiptId = kind === 'receiptId';
  const receiptIdParts = isReceiptId ? splitReceiptId(value) : null;
  return (
    <div className="receipt-row receipt-row-58">
      <div className="receipt-row-label receipt-row-label-58">{label}</div>
      <div className={`receipt-row-value${valueClassName ? ` ${valueClassName}` : ''}`}>
        {isReceiptId && receiptIdParts ? (
          <>
            <span className="receipt-row-value-receipt-id-prefix">{receiptIdParts.prefix}</span>
            <span className="receipt-row-value-receipt-id-sequence">-{receiptIdParts.sequence}</span>
          </>
        ) : (
          value || fallback
        )}
      </div>
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
          kind="receiptId"
          valueClassName="receipt-row-value-receipt-id"
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
            <ReceiptCycleBlock
              key={`${cycle.cycleName}-${index}`}
              cycle={cycle}
              index={index}
              total={payload.cycles.length}
              sizeClassName="receipt-cycle-58"
              separatorKind="plus"
              separatorText="++++++++++++++++++++++++++++++"
            />
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
