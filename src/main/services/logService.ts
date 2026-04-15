import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppLogFileInfo } from '../../shared/types/log';

const LOG_RETENTION_DAYS = 7;
const FILE_NAME_REGEX = /^\d{2}-\d{2}-\d{4}\.txt$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toLogFileName(date: Date): string {
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}.txt`;
}

function toLocalTimestamp(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function normalizeLogValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.replace(/\s+/g, ' ').trim();
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseDateFromFileName(fileName: string): Date | null {
  if (!FILE_NAME_REGEX.test(fileName)) {
    return null;
  }

  const [day, month, yearWithExt] = fileName.split('-');
  const year = yearWithExt?.replace('.txt', '');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getDate() !== Number(day) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getFullYear() !== Number(year)
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

export interface AppLogService {
  logAction(action: string): Promise<void>;
  logInfo(scope: string, message: string, details?: unknown): Promise<void>;
  logError(scope: string, error: unknown, details?: unknown): Promise<void>;
  logNetwork(payload: {
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
  }): Promise<void>;
  listRecentLogFiles(): Promise<AppLogFileInfo[]>;
  openLogFileByName(fileName: string): Promise<string>;
  exportRecentLogFiles(destinationDirectory: string): Promise<{ exportedCount: number; fileNames: string[] }>;
}

export function createAppLogService(userDataPath: string): AppLogService {
  const logsDirectory = path.join(userDataPath, 'logs');

  async function ensureLogsDirectory(): Promise<void> {
    await fs.mkdir(logsDirectory, { recursive: true });
  }

  async function pruneExpiredLogs(): Promise<void> {
    await ensureLogsDirectory();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const keepAfter = new Date(now);
    keepAfter.setDate(keepAfter.getDate() - (LOG_RETENTION_DAYS - 1));

    const entries = await fs.readdir(logsDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const parsedDate = parseDateFromFileName(entry.name);
      if (!parsedDate) {
        continue;
      }
      if (parsedDate < keepAfter) {
        await fs.unlink(path.join(logsDirectory, entry.name)).catch(() => undefined);
      }
    }
  }

  async function appendLine(level: string, scope: string, message: string, details?: unknown): Promise<void> {
    await pruneExpiredLogs();
    const now = new Date();
    const filePath = path.join(logsDirectory, toLogFileName(now));
    const payload = details === undefined ? '' : ` | details=${normalizeLogValue(details)}`;
    const line = `[${toLocalTimestamp(now)}] [${level}] [${scope}] ${normalizeLogValue(message)}${payload}\n`;
    await fs.appendFile(filePath, line, 'utf8');
  }

  async function listRecentLogFiles(): Promise<AppLogFileInfo[]> {
    await pruneExpiredLogs();
    const entries = await fs.readdir(logsDirectory, { withFileTypes: true }).catch(() => []);
    const files: AppLogFileInfo[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !FILE_NAME_REGEX.test(entry.name)) {
        continue;
      }

      const fullPath = path.join(logsDirectory, entry.name);
      const stat = await fs.stat(fullPath).catch(() => null);
      if (!stat) {
        continue;
      }

      files.push({
        fileName: entry.name,
        fullPath,
        size: stat.size,
        updatedAt: stat.mtime.toISOString()
      });
    }

    files.sort((left, right) => right.fileName.localeCompare(left.fileName));
    return files;
  }

  async function resolveLogPath(fileName: string): Promise<string> {
    if (!FILE_NAME_REGEX.test(fileName)) {
      throw new Error('Invalid log file name.');
    }
    const resolved = path.resolve(logsDirectory, fileName);
    if (!resolved.startsWith(path.resolve(logsDirectory) + path.sep)) {
      throw new Error('Invalid log file path.');
    }
    await fs.access(resolved);
    return resolved;
  }

  return {
    async logAction(action) {
      await appendLine('ACTION', 'renderer', action);
    },
    async logInfo(scope, message, details) {
      await appendLine('INFO', scope, message, details);
    },
    async logError(scope, error, details) {
      const errorMessage =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : typeof error === 'string'
            ? error
            : normalizeLogValue(error);

      await appendLine('ERROR', scope, errorMessage, {
        details,
        stack: error instanceof Error ? error.stack : undefined
      });
    },
    async logNetwork(payload) {
      const requestId = randomUUID();
      const base = `${payload.method.toUpperCase()} ${payload.url}`;

      if (payload.ok === true && typeof payload.status === 'number') {
        await appendLine(
          'NETWORK',
          payload.scope,
          `${base} -> ${payload.status}${payload.durationMs ? ` (${payload.durationMs}ms)` : ''}`
        );
        return;
      }

      await appendLine('NETWORK', payload.scope, `${base} -> REQUEST`, {
        requestId,
        requestBodyPreview: payload.requestBodyPreview
      });
      await appendLine('ERROR', `${payload.scope}:network`, `${base} -> FAILED`, {
        requestId,
        status: payload.status,
        statusText: payload.statusText,
        durationMs: payload.durationMs,
        errorMessage: payload.errorMessage,
        responseBodyPreview: payload.responseBodyPreview
      });
    },
    async listRecentLogFiles() {
      return listRecentLogFiles();
    },
    async openLogFileByName(fileName) {
      return resolveLogPath(fileName);
    },
    async exportRecentLogFiles(destinationDirectory) {
      const files = await listRecentLogFiles();
      await fs.mkdir(destinationDirectory, { recursive: true });

      const exportedFileNames: string[] = [];
      for (const file of files) {
        const targetPath = path.join(destinationDirectory, file.fileName);
        await fs.copyFile(file.fullPath, targetPath);
        exportedFileNames.push(file.fileName);
      }

      return {
        exportedCount: exportedFileNames.length,
        fileNames: exportedFileNames
      };
    }
  };
}
