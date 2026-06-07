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
    <div className="receipt-row receipt-row-a5">
      <div className="receipt-row-label receipt-row-label-a5">{label}</div>
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
      </div>

      <div className="receipt-section receipt-section-a5">
        {payload.cycles.length > 0 ? (
          payload.cycles.map((cycle, index) => (
            <ReceiptCycleBlock
              key={`${cycle.cycleName}-${index}`}
              cycle={cycle}
              index={index}
              total={payload.cycles.length}
              sizeClassName="receipt-cycle-a5"
              separatorKind="line"
            />
          ))
        ) : (
          <div className="receipt-cycle receipt-cycle-a5">{intl.formatMessage({ id: 'receipt.noData' })}</div>
        )}
      </div>
    </div>
  );
}
