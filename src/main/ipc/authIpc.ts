import { BrowserWindow, ipcMain } from 'electron';
import type { CiamLoginResult, ExchangeCodeResult } from '../../shared/types/ipc/auth';
import type { PersistedUserProfile, UserInfoApiModel } from '../../shared/types/user';
import { getEnvValue } from '../services/envService';
import type { UserService } from '../services/userService';

const CHANNEL_OPEN_CIAM_LOGIN = 'auth:openCiamLogin';
const CHANNEL_EXCHANGE_CODE = 'auth:exchangeCode';
const CHANNEL_GET_USER_INFO = 'auth:getUserInfo';
const CHANNEL_GET_PERSISTED_USER = 'auth:getPersistedUser';
const CHANNEL_SAVE_PERSISTED_USER = 'auth:savePersistedUser';
const CHANNEL_CLEAR_PERSISTED_USER = 'auth:clearPersistedUser';

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
  const explicitUrl = getEnvValue('OIDC_JWT_URL');
  if (explicitUrl) {
    const parsed = new URL(explicitUrl);
    parsed.searchParams.set('key', exchangeKey);
    return parsed.toString();
  }

  const apiBase = getEnvValue('RENDERER_VITE_API_URL') ?? getEnvValue('VITE_API_URL');
  if (!apiBase) {
    throw new Error(
      'Missing exchange endpoint configuration. Set OIDC_JWT_URL or RENDERER_VITE_API_URL.'
    );
  }

  const parsed = new URL('/oidc/exchange_code/', apiBase);
  parsed.searchParams.set('key', exchangeKey);
  return parsed.toString();
}

function resolveUserInfoUrl(): string {
  const apiBase = getEnvValue('RENDERER_VITE_API_URL') ?? getEnvValue('VITE_API_URL');
  if (!apiBase) {
    throw new Error('Missing API base URL. Set RENDERER_VITE_API_URL or VITE_API_URL.');
  }

  return new URL('/api/v1/userinfo/', apiBase).toString();
}

function normalizeExchangeResponse(response: string): ExchangeCodeResult {
  const trimmed = response.trim();
  const unwrapped = trimmed.startsWith("'") && trimmed.endsWith("'") ? trimmed.slice(1, -1) : trimmed;

  const parseNestedJson = (value: string): unknown => {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (typeof parsed === 'string') {
        return JSON.parse(parsed) as unknown;
      }
      return parsed;
    } catch {
      return value;
    }
  };

  const parsed = parseNestedJson(unwrapped);

  if (typeof parsed === 'string') {
    return {
      idToken: parsed,
      refreshToken: null
    };
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const payload = parsed as { id_token?: unknown; refresh_token?: unknown };
    if (typeof payload.id_token === 'string' && payload.id_token.length > 0) {
      return {
        idToken: payload.id_token,
        refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : null
      };
    }
  }

  throw new Error('Exchange code response format is not valid.');
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

export function registerAuthIpc(
  getMainWindow: () => BrowserWindow | null,
  userService: UserService
): void {
  ipcMain.removeHandler(CHANNEL_OPEN_CIAM_LOGIN);
  ipcMain.removeHandler(CHANNEL_EXCHANGE_CODE);
  ipcMain.removeHandler(CHANNEL_GET_USER_INFO);
  ipcMain.removeHandler(CHANNEL_GET_PERSISTED_USER);
  ipcMain.removeHandler(CHANNEL_SAVE_PERSISTED_USER);
  ipcMain.removeHandler(CHANNEL_CLEAR_PERSISTED_USER);

  ipcMain.handle(CHANNEL_OPEN_CIAM_LOGIN, async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      throw new Error('Main window is not available.');
    }

    const ciamUrl = getEnvValue('MAIN_VITE_CIAM_URL');
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

    const tokenResponse = normalizeExchangeResponse(rawBody);
    if (!tokenResponse.idToken) {
      console.error('[auth] Exchange code returned empty id_token');
      throw new Error('Exchange code returned an empty id_token.');
    }

    console.info('[auth] JWT received', {
      jwt: maskToken(tokenResponse.idToken),
      hasRefreshToken: Boolean(tokenResponse.refreshToken)
    });
    return tokenResponse;
  });

  ipcMain.handle(CHANNEL_GET_USER_INFO, async (_event, jwt: string) => {
    if (!jwt) {
      throw new Error('Missing JWT token for user info request.');
    }

    const userInfoUrl = resolveUserInfoUrl();
    console.info('[auth] Fetching user info', { userInfoUrl });

    const response = await fetch(userInfoUrl, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${jwt}`
      }
    });

    const rawBody = await response.text();
    if (!response.ok) {
      console.error('[auth] User info request failed', {
        status: response.status,
        statusText: response.statusText,
        bodyPreview: rawBody.slice(0, 200)
      });
      throw new Error(`User info request failed (${response.status} ${response.statusText}).`);
    }

    const parsedBody = JSON.parse(rawBody) as UserInfoApiModel[];
    return parsedBody;
  });

  ipcMain.handle(CHANNEL_GET_PERSISTED_USER, async () => {
    return userService.getUserProfile();
  });

  ipcMain.handle(CHANNEL_SAVE_PERSISTED_USER, async (_event, profile: PersistedUserProfile) => {
    await userService.saveUserProfile(profile);
  });

  ipcMain.handle(CHANNEL_CLEAR_PERSISTED_USER, async () => {
    await userService.clearUserProfile();
  });
}
