import type { PrintFormat } from '@shared/types/printConfig';

export interface ReceiptCycleRow {
  cycleName: string;
  assistanceType: string;
  quantity: string;
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
