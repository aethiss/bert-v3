import { Fragment, type ReactElement } from 'react';
import { useIntl } from 'react-intl';
import type { ReceiptCycleRow } from './types';

type Props = {
  cycle: ReceiptCycleRow;
  index: number;
  total: number;
  sizeClassName: string;
  separatorKind: 'plus' | 'line';
  separatorText?: string;
};

export function ReceiptCycleBlock({
  cycle,
  index,
  total,
  sizeClassName,
  separatorKind,
  separatorText
}: Props): ReactElement {
  const intl = useIntl();

  return (
    <div className={`receipt-cycle ${sizeClassName}`}>
      <div>
        <span className="receipt-bold">{intl.formatMessage({ id: 'receipt.label.cycle' })}</span>{' '}
        {cycle.cycleName || intl.formatMessage({ id: 'common.na' })}
      </div>
      {(cycle.commodities ?? []).length > 0 ? (
        <div className="receipt-commodity-summary">
          {cycle.commodities.map((commodity, commodityIndex) => {
            const commodityName = commodity.name || intl.formatMessage({ id: 'common.na' });
            const commodityDetails = `${commodity.quantity} * ${commodity.weight} ${commodity.unit}`;
            return (
              <Fragment key={`${cycle.cycleName}-${index}-${commodityIndex}`}>
                {commodityIndex > 0 ? ', ' : null}
                <span className="receipt-commodity-name receipt-bold">{commodityName}</span>{' '}
                <span className="receipt-commodity-details">{commodityDetails}</span>
              </Fragment>
            );
          })}
        </div>
      ) : (
        <div>{intl.formatMessage({ id: 'receipt.noData' })}</div>
      )}
      {index !== total - 1 ? (
        separatorKind === 'plus' ? (
          <div className="receipt-plus">{separatorText ?? '++++++++++++++++++++++++++++++'}</div>
        ) : (
          <div className="receipt-line" />
        )
      ) : null}
    </div>
  );
}
