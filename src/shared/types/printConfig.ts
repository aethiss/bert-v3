export type PrintFormat = 'A5' | '80mm' | '58mm';

export interface PrintSettings {
  format: PrintFormat;
  disabled: boolean;
}
