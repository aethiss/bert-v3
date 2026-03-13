import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import type { ClientDistributionInput } from '../../shared/types/eligible';
import type { LocalServerSettings, LocalServerStatus } from '../../shared/types/localServer';
import type { EligibleDataService } from '../services/eligibleDataService';

const ACCESS_TOKEN_TTL_MS = 1000 * 60 * 60 * 3;
const API_VERSION = 'v1';

interface SessionInfo {
  alias: string;
  expiresAt: number;
  lastSeenAt: number;
}

interface LocalApiServerDependencies {
  eligibleDataService: EligibleDataService;
}

export interface LocalApiServer {
  start(settings: LocalServerSettings): Promise<LocalServerStatus>;
  stop(): Promise<void>;
  getStatus(): LocalServerStatus;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Invalid JSON payload.');
  }
}

function createAccessToken(): string {
  return randomBytes(32).toString('hex');
}

export function createLocalApiServer(deps: LocalApiServerDependencies): LocalApiServer {
  let server: Server | null = null;
  let currentSettings: LocalServerSettings = {
    interfaceName: '',
    bindIp: '0.0.0.0',
    port: 4860,
    oneTimePassword: ''
  };
  let startedAt: number | null = null;
  const sessions = new Map<string, SessionInfo>();

  function getStatus(): LocalServerStatus {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
      if (session.expiresAt <= now) {
        sessions.delete(token);
      }
    }

    return {
      running: Boolean(server),
      bindIp: currentSettings.bindIp,
      port: currentSettings.port,
      startedAt: startedAt ? new Date(startedAt).toISOString() : null,
      activeClients: sessions.size
    };
  }

  function getAuthorizedSession(req: IncomingMessage): SessionInfo | null {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return null;
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      return null;
    }

    const session = sessions.get(token);
    if (!session) {
      return null;
    }

    if (session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return null;
    }

    session.lastSeenAt = Date.now();
    return session;
  }

  async function requestHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const host = req.headers.host ?? `${currentSettings.bindIp}:${currentSettings.port}`;
    const url = new URL(req.url ?? '/', `http://${host}`);

    if (method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        apiVersion: API_VERSION,
        running: true,
        serverTime: new Date().toISOString()
      });
      return;
    }

    if (method === 'POST' && url.pathname === '/auth/login') {
      const body = (await readJsonBody(req)) as { alias?: unknown; oneTimePassword?: unknown };
      const alias = typeof body.alias === 'string' ? body.alias.trim() : '';
      const oneTimePassword =
        typeof body.oneTimePassword === 'string' ? body.oneTimePassword.trim() : '';

      if (!alias || alias.length > 128) {
        sendJson(res, 400, { error: 'Invalid alias. It must be between 1 and 128 characters.' });
        return;
      }

      if (!currentSettings.oneTimePassword || oneTimePassword !== currentSettings.oneTimePassword) {
        sendJson(res, 401, { error: 'Invalid oneTimePassword.' });
        return;
      }

      const token = createAccessToken();
      const expiresAt = Date.now() + ACCESS_TOKEN_TTL_MS;
      sessions.set(token, {
        alias,
        expiresAt,
        lastSeenAt: Date.now()
      });

      sendJson(res, 200, {
        accessToken: token,
        tokenType: 'Bearer',
        expiresAt: new Date(expiresAt).toISOString(),
        alias
      });
      return;
    }

    const session = getAuthorizedSession(req);
    if (!session) {
      sendJson(res, 401, { error: 'Unauthorized.' });
      return;
    }

    if (method === 'GET' && url.pathname === '/ping') {
      sendJson(res, 200, {
        ok: true,
        serverTime: new Date().toISOString(),
        alias: session.alias
      });
      return;
    }

    if (method === 'GET' && url.pathname === '/search') {
      const searchId = (url.searchParams.get('id') ?? '').trim();
      if (!searchId) {
        sendJson(res, 400, { error: 'Missing required query parameter: id.' });
        return;
      }

      const result = await deps.eligibleDataService.searchDistributionMember(searchId);
      sendJson(res, 200, { result });
      return;
    }

    if (method === 'POST' && url.pathname === '/distribution') {
      const body = (await readJsonBody(req)) as {
        subOperator?: unknown;
        cycleCode?: unknown;
        memberId?: unknown;
      };

      const subOperator = typeof body.subOperator === 'string' ? body.subOperator.trim() : '';
      const cycleCode = typeof body.cycleCode === 'number' ? body.cycleCode : NaN;
      const memberId = typeof body.memberId === 'number' ? body.memberId : NaN;

      const payload: ClientDistributionInput = {
        subOperator: subOperator || session.alias,
        cycleCode,
        memberId
      };

      const saved = await deps.eligibleDataService.saveClientDistribution(payload);
      sendJson(res, 201, {
        ok: true,
        distributionId: saved.id,
        subOperator: payload.subOperator
      });
      return;
    }

    sendJson(res, 404, { error: 'Not found.' });
  }

  return {
    async start(settings: LocalServerSettings): Promise<LocalServerStatus> {
      if (server) {
        return getStatus();
      }

      const port = Number.isInteger(settings.port) ? settings.port : 4860;
      const bindIp = settings.bindIp?.trim() || '0.0.0.0';
      const oneTimePassword = settings.oneTimePassword.trim();
      if (!oneTimePassword) {
        throw new Error('Missing one-time password. Configure it before starting the server.');
      }

      currentSettings = {
        interfaceName: settings.interfaceName.trim(),
        bindIp,
        port,
        oneTimePassword
      };

      sessions.clear();
      server = createServer((req, res) => {
        void requestHandler(req, res).catch((error) => {
          const message =
            error instanceof Error ? error.message : 'Unexpected local server error.';
          sendJson(res, 500, { error: message });
        });
      });

      await new Promise<void>((resolve, reject) => {
        server?.once('error', reject);
        server?.listen(port, bindIp, () => resolve());
      });

      startedAt = Date.now();
      return getStatus();
    },
    async stop(): Promise<void> {
      if (!server) {
        return;
      }

      const active = server;
      server = null;
      startedAt = null;
      sessions.clear();

      await new Promise<void>((resolve, reject) => {
        active.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
    getStatus
  };
}
