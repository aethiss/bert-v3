import type { PrintFormat } from '@shared/types/printConfig';

export interface ReceiptCommodityRow {
  name: string;
  quantity: string;
  weight: string;
  unit: string;
}

export interface ReceiptCycleRow {
  cycleName: string;
  commodities: ReceiptCommodityRow[];
}

export interface ReceiptPayload {
  title: string;
  headOfHousehold: string;
  receiptId: string;
  householdId: string;
  fdp: string;
  collectedBy: string;
  printedAtIso: string;
  cycles: ReceiptCycleRow[];
  format: PrintFormat;
}
