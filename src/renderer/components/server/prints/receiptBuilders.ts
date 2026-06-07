import type { PrintFormat } from '@shared/types/printConfig';
import type { EligibleFoodCommodityApiModel } from '@shared/types/eligible';
import { buildReceiptId, formatReceiptMetricValue, hideMiddleNumbers } from './receiptHelpers';
import type { ReceiptCommodityRow, ReceiptCycleRow, ReceiptPayload } from './types';

function resolveCommodityName(commodity: EligibleFoodCommodityApiModel, locale: string): string {
  const normalizedLocale = locale.toLowerCase();
  if (normalizedLocale.startsWith('ar')) {
    return (commodity.ar_name ?? commodity.en_name ?? '').trim();
  }

  return (commodity.en_name ?? commodity.ar_name ?? '').trim();
}

export interface ReceiptCycleSource {
  cycleName: string;
  foodCommodities: EligibleFoodCommodityApiModel[] | null | undefined;
}

export interface BuildReceiptPayloadParams {
  title: string;
  headOfHousehold: string;
  householdId: number | string;
  receiptSequence: number | string | null | undefined;
  fdpCode: string | null | undefined;
  fdpName: string | null | undefined;
  collectedByDocument: string | null | undefined;
  printedAtIso: string;
  cycles: ReceiptCycleSource[];
  format: PrintFormat;
  locale: string;
}

function mapCommodityRows(
  commodities: EligibleFoodCommodityApiModel[] | null | undefined,
  locale: string
): ReceiptCommodityRow[] {
  return (commodities ?? []).map((commodity) => ({
    name: resolveCommodityName(commodity, locale),
    quantity: String(commodity.quantity ?? 'N/A'),
    weight: formatReceiptMetricValue(commodity.weight),
    unit: (commodity.unit ?? '').trim() || 'N/A'
  }));
}

export function buildReceiptPayload(params: BuildReceiptPayloadParams): ReceiptPayload {
  return {
    title: params.title,
    headOfHousehold: params.headOfHousehold,
    receiptId: buildReceiptId({
      fdpCode: params.fdpCode,
      householdId: params.householdId,
      sequence: params.receiptSequence
    }),
    householdId: String(params.householdId),
    fdp: (params.fdpName ?? '').trim() || 'N/A',
    collectedBy: hideMiddleNumbers(params.collectedByDocument ?? ''),
    printedAtIso: params.printedAtIso,
    cycles: (params.cycles ?? []).map<ReceiptCycleRow>((cycle) => ({
      cycleName: cycle.cycleName,
      commodities: mapCommodityRows(cycle.foodCommodities, params.locale)
    })),
    format: params.format
  };
}
