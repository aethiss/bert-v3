import { BrowserWindow, ipcMain } from 'electron';
import type { CiamLoginResult } from '../../shared/types/ipc/auth';

const CHANNEL_OPEN_CIAM_LOGIN = 'auth:openCiamLogin';
const CHANNEL_EXCHANGE_CODE = 'auth:exchangeCode';

function tryParseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function extractTokens(rawUrl: string): CiamLoginResult | null {
  const parsed = tryParseUrl(rawUrl);
  if (!parsed) {
    return null;
  }

  const exchangeKey = parsed.searchParams.get('key');
  if (!exchangeKey) {
    return null;
  }

  return {
    exchangeKey,
    refreshToken: parsed.searchParams.get('refresh_token'),
    redirectUrl: rawUrl
  };
}

function maskToken(value: string): string {
  if (value.length <= 10) {
    return `${value.slice(0, 3)}***`;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function resolveExchangeCodeUrl(exchangeKey: string): string {
  const explicitUrl = process.env.OIDC_JWT_URL;
  if (explicitUrl) {
    const parsed = new URL(explicitUrl);
    parsed.searchParams.set('key', exchangeKey);
    return parsed.toString();
  }

  const apiBase = process.env.RENDERER_VITE_API_URL ?? process.env.VITE_API_URL;
  if (!apiBase) {
    throw new Error(
      'Missing exchange endpoint configuration. Set OIDC_JWT_URL or RENDERER_VITE_API_URL.'
    );
  }

  const parsed = new URL('/oidc/exchange_code/', apiBase);
  parsed.searchParams.set('key', exchangeKey);
  return parsed.toString();
}

function normalizeExchangeResponse(response: string): string {
  const trimmed = response.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

async function openCiamLoginWindow(
  parentWindow: BrowserWindow,
  ciamUrl: string
): Promise<CiamLoginResult> {
  return new Promise<CiamLoginResult>((resolve, reject) => {
    const ciamLoginWindow = new BrowserWindow({
      width: 900,
      height: 700,
      minWidth: 780,
      minHeight: 600,
      modal: true,
      parent: parentWindow,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    let settled = false;

    const resolveOnce = (result: CiamLoginResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
      ciamLoginWindow.close();
    };

    const rejectOnce = (error: Error): void => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const handleUrlCandidate = (candidateUrl: string): void => {
      const result = extractTokens(candidateUrl);
      if (result) {
        console.info('[auth] CIAM redirect captured', {
          exchangeKey: maskToken(result.exchangeKey),
          hasRefreshToken: Boolean(result.refreshToken),
          redirectUrl: result.redirectUrl
        });
        resolveOnce(result);
      }
    };

    ciamLoginWindow.webContents.on('will-redirect', (_event, targetUrl) => {
      handleUrlCandidate(targetUrl);
    });

    ciamLoginWindow.webContents.on('will-navigate', (_event, targetUrl) => {
      handleUrlCandidate(targetUrl);
    });

    ciamLoginWindow.webContents.on('did-navigate', (_event, targetUrl) => {
      handleUrlCandidate(targetUrl);
    });

    ciamLoginWindow.on('closed', () => {
      if (!settled) {
        rejectOnce(new Error('CIAM login window was closed before completing authentication.'));
      }
    });

    void ciamLoginWindow.loadURL(ciamUrl).catch((error: unknown) => {
      const normalizedError = error instanceof Error ? error : new Error('Unable to open CIAM URL.');
      rejectOnce(normalizedError);
      ciamLoginWindow.close();
    });
  });
}

export function registerAuthIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.removeHandler(CHANNEL_OPEN_CIAM_LOGIN);
  ipcMain.removeHandler(CHANNEL_EXCHANGE_CODE);

  ipcMain.handle(CHANNEL_OPEN_CIAM_LOGIN, async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      throw new Error('Main window is not available.');
    }

    const ciamUrl = process.env.MAIN_VITE_CIAM_URL;
    if (!ciamUrl) {
      throw new Error('Missing MAIN_VITE_CIAM_URL environment variable.');
    }

    console.info('[auth] Opening CIAM login window', { ciamUrl });
    return openCiamLoginWindow(mainWindow, ciamUrl);
  });

  ipcMain.handle(CHANNEL_EXCHANGE_CODE, async (_event, exchangeKey: string) => {
    if (!exchangeKey) {
      throw new Error('Missing exchange key.');
    }

    const exchangeUrl = resolveExchangeCodeUrl(exchangeKey);
    console.info('[auth] Exchanging code for JWT', {
      exchangeKey: maskToken(exchangeKey),
      exchangeUrl
    });

    const response = await fetch(exchangeUrl, { method: 'GET' });
    const rawBody = await response.text();

    if (!response.ok) {
      console.error('[auth] Exchange code failed', {
        status: response.status,
        statusText: response.statusText,
        bodyPreview: rawBody.slice(0, 200)
      });
      throw new Error(`Exchange code failed (${response.status} ${response.statusText}).`);
    }

    const jwt = normalizeExchangeResponse(rawBody);
    if (!jwt) {
      console.error('[auth] Exchange code returned empty body');
      throw new Error('Exchange code returned an empty token.');
    }

    console.info('[auth] JWT received', { jwt: maskToken(jwt) });
    return jwt;
  });
}
