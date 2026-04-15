export interface AppLogFileInfo {
  fileName: string;
  fullPath: string;
  size: number;
  updatedAt: string;
}

export interface ExportLogsResult {
  directory: string;
  exportedCount: number;
  fileNames: string[];
}

export interface RendererNetworkLogPayload {
  scope: string;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  durationMs?: number;
  ok?: boolean;
  requestBodyPreview?: string;
  responseBodyPreview?: string;
  errorMessage?: string;
}
