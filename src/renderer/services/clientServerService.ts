import type {
  ClientDistributionInput,
  DistributionDetailData,
  DistributionSearchResult
} from '@shared/types/eligible';
import type { ClientConnectionSettings } from '@shared/types/localServer';

export interface ClientSession {
  accessToken: string;
  alias: string;
  host: string;
  expiresAt: string;
}

interface LocalServerErrorPayload {
  error?: string;
}

interface JsonResponse<T> {
  status: number;
  data: T;
}

function normalizeBaseUrl(settings: Pick<ClientConnectionSettings, 'serverIp' | 'serverPort'>): string {
  const host = settings.serverIp.trim();
  if (!host) {
    throw new Error('Missing Server IP.');
  }

  const port = Number.isInteger(settings.serverPort) ? settings.serverPort : 0;
  if (!port || port < 1 || port > 65535) {
    throw new Error('Invalid Server Port.');
  }

  return `http://${host}:${port}`;
}

async function parseResponse<T>(response: Response): Promise<JsonResponse<T>> {
  const raw = await response.text();
  const json = raw ? (JSON.parse(raw) as T | LocalServerErrorPayload) : ({} as T);

  if (!response.ok) {
    const message = (json as LocalServerErrorPayload)?.error ?? `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return {
    status: response.status,
    data: json as T
  };
}

function withAuthHeader(session: ClientSession): HeadersInit {
  return {
    authorization: `Bearer ${session.accessToken}`,
    'content-type': 'application/json'
  };
}

export async function loginToLocalServer(settings: ClientConnectionSettings): Promise<ClientSession> {
  const baseUrl = normalizeBaseUrl(settings);
  const alias = settings.alias.trim();
  if (!alias || alias.length > 128) {
    throw new Error('Alias must be between 1 and 128 characters.');
  }

  const oneTimePassword = settings.oneTimePassword.trim();
  if (!oneTimePassword) {
    throw new Error('Missing one-time password.');
  }

  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      alias,
      oneTimePassword
    })
  });

  const parsed = await parseResponse<{ accessToken: string; expiresAt: string; alias: string }>(response);
  return {
    accessToken: parsed.data.accessToken,
    alias: parsed.data.alias,
    expiresAt: parsed.data.expiresAt,
    host: `${settings.serverIp.trim()}:${settings.serverPort}`
  };
}

export async function pingLocalServer(session: ClientSession): Promise<void> {
  const response = await fetch(`http://${session.host}/ping`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${session.accessToken}`
    }
  });

  await parseResponse(response);
}

export async function searchMemberOnLocalServer(
  session: ClientSession,
  query: string
): Promise<DistributionSearchResult | null> {
  const normalized = query.trim();
  if (!normalized) {
    return null;
  }

  const url = new URL(`http://${session.host}/search`);
  url.searchParams.set('id', normalized);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${session.accessToken}`
    }
  });

  const parsed = await parseResponse<{ result: DistributionSearchResult | null }>(response);
  return parsed.data.result;
}

export async function getDistributionDetailFromLocalServer(
  session: ClientSession,
  params: { memberId: number; familyUniqueCode: number }
): Promise<DistributionDetailData | null> {
  const url = new URL(`http://${session.host}/distribution/detail`);
  url.searchParams.set('memberId', String(params.memberId));
  url.searchParams.set('familyUniqueCode', String(params.familyUniqueCode));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${session.accessToken}`
    }
  });

  const parsed = await parseResponse<{ result: DistributionDetailData | null }>(response);
  return parsed.data.result;
}

export async function saveDistributionOnLocalServer(
  session: ClientSession,
  payload: ClientDistributionInput
): Promise<{ distributionId: number }> {
  const response = await fetch(`http://${session.host}/distribution`, {
    method: 'POST',
    headers: withAuthHeader(session),
    body: JSON.stringify(payload)
  });

  const parsed = await parseResponse<{ distributionId: number }>(response);
  return {
    distributionId: parsed.data.distributionId
  };
}
