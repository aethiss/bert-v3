import type { PrintSettings } from '@shared/types/printConfig';

export async function getPrintSettings(): Promise<PrintSettings> {
  return window.bertApp.config.getPrintSettings();
}

export async function savePrintSettings(settings: PrintSettings): Promise<PrintSettings> {
  return window.bertApp.config.setPrintSettings(settings);
}
