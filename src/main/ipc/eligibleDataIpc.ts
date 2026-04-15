import { ipcMain } from 'electron';
import type {
  ClientDistributionHistoryInput,
  ClientDistributionHistoryQuery,
  ClientDistributionHistoryResult,
  DistributionQueueItem,
  EligibleMembersApiResponse,
  LocalDistributionEventInput
} from '../../shared/types/eligible';
import { getEnvValue } from '../services/envService';
import type { AppLogService } from '../services/logService';
import type { EligibleDataService } from '../services/eligibleDataService';

const CHANNEL_SAVE_ELIGIBLE_DATA = 'eligibleData:save';
const CHANNEL_HAS_ELIGIBLE_DATA = 'eligibleData:hasData';
const CHANNEL_GET_OVERVIEW_SUMMARY = 'eligibleData:getOverviewSummary';
const CHANNEL_CLEAR_ELIGIBLE_DATA = 'eligibleData:clear';
const CHANNEL_SYNC_ELIGIBLE_DATA = 'eligibleData:sync';
const CHANNEL_SEARCH_DISTRIBUTION_MEMBER = 'eligibleData:searchDistributionMember';
const CHANNEL_GET_DISTRIBUTION_DETAIL = 'eligibleData:getDistributionDetail';
const CHANNEL_SAVE_DISTRIBUTION_EVENT = 'eligibleData:saveDistributionEvent';
const CHANNEL_GET_DISTRIBUTION_QUEUE = 'eligibleData:getDistributionQueue';
const CHANNEL_CLEAR_DISTRIBUTION_QUEUE = 'eligibleData:clearDistributionQueue';
const CHANNEL_SAVE_CLIENT_DISTRIBUTION_HISTORY = 'eligibleData:saveClientDistributionHistory';
const CHANNEL_GET_CLIENT_DISTRIBUTION_HISTORY = 'eligibleData:getClientDistributionHistory';

function resolveEligibleMembersUrl(fdpCode: string): string {
  const apiBase = getEnvValue('RENDERER_VITE_API_URL') ?? getEnvValue('VITE_API_URL');
  if (!apiBase) {
    throw new Error('Missing API base URL. Set RENDERER_VITE_API_URL or VITE_API_URL.');
  }

  const endpointPath =
    getEnvValue('RENDERER_VITE_ELIGIBLE_MEMBERS_PATH') ??
    getEnvValue('VITE_ELIGIBLE_MEMBERS_PATH') ??
    '/api/v1/active-cycles-householdsv5/';

  const normalizedPath = endpointPath.endsWith('/') ? endpointPath : `${endpointPath}/`;
  return new URL(`${normalizedPath}${fdpCode}`, apiBase).toString();
}

export function registerEligibleDataIpc(
  eligibleDataService: EligibleDataService,
  logService: AppLogService
): void {
  ipcMain.removeHandler(CHANNEL_SAVE_ELIGIBLE_DATA);
  ipcMain.removeHandler(CHANNEL_HAS_ELIGIBLE_DATA);
  ipcMain.removeHandler(CHANNEL_GET_OVERVIEW_SUMMARY);
  ipcMain.removeHandler(CHANNEL_CLEAR_ELIGIBLE_DATA);
  ipcMain.removeHandler(CHANNEL_SYNC_ELIGIBLE_DATA);
  ipcMain.removeHandler(CHANNEL_SEARCH_DISTRIBUTION_MEMBER);
  ipcMain.removeHandler(CHANNEL_GET_DISTRIBUTION_DETAIL);
  ipcMain.removeHandler(CHANNEL_SAVE_DISTRIBUTION_EVENT);
  ipcMain.removeHandler(CHANNEL_GET_DISTRIBUTION_QUEUE);
  ipcMain.removeHandler(CHANNEL_CLEAR_DISTRIBUTION_QUEUE);
  ipcMain.removeHandler(CHANNEL_SAVE_CLIENT_DISTRIBUTION_HISTORY);
  ipcMain.removeHandler(CHANNEL_GET_CLIENT_DISTRIBUTION_HISTORY);

  ipcMain.handle(CHANNEL_SAVE_ELIGIBLE_DATA, async (_event, payload: EligibleMembersApiResponse) => {
    return eligibleDataService.saveEligibleMembers(payload);
  });

  ipcMain.handle(CHANNEL_HAS_ELIGIBLE_DATA, async () => {
    return eligibleDataService.hasEligibleData();
  });

  ipcMain.handle(CHANNEL_GET_OVERVIEW_SUMMARY, async () => {
    return eligibleDataService.getOverviewSummary();
  });

  ipcMain.handle(CHANNEL_CLEAR_ELIGIBLE_DATA, async () => {
    await eligibleDataService.clearEligibleData();
  });

  ipcMain.handle(CHANNEL_SEARCH_DISTRIBUTION_MEMBER, async (_event, query: string) => {
    return eligibleDataService.searchDistributionMember(query);
  });

  ipcMain.handle(
    CHANNEL_GET_DISTRIBUTION_DETAIL,
    async (
      _event,
      params: {
        memberId: number;
        familyUniqueCode: number;
      }
    ) => {
      return eligibleDataService.getDistributionDetail(params);
    }
  );

  ipcMain.handle(CHANNEL_SAVE_DISTRIBUTION_EVENT, async (_event, payload: LocalDistributionEventInput) => {
    return eligibleDataService.saveDistributionEvent(payload);
  });

  ipcMain.handle(CHANNEL_GET_DISTRIBUTION_QUEUE, async (): Promise<DistributionQueueItem[]> => {
    return eligibleDataService.getDistributionQueue();
  });

  ipcMain.handle(CHANNEL_CLEAR_DISTRIBUTION_QUEUE, async (): Promise<{ deleted: number }> => {
    return eligibleDataService.clearDistributionQueue();
  });

  ipcMain.handle(
    CHANNEL_SAVE_CLIENT_DISTRIBUTION_HISTORY,
    async (_event, payload: ClientDistributionHistoryInput) => {
      return eligibleDataService.saveClientDistributionHistory(payload);
    }
  );

  ipcMain.handle(
    CHANNEL_GET_CLIENT_DISTRIBUTION_HISTORY,
    async (_event, query: ClientDistributionHistoryQuery): Promise<ClientDistributionHistoryResult> => {
      return eligibleDataService.getClientDistributionHistory(query);
    }
  );

  ipcMain.handle(
    CHANNEL_SYNC_ELIGIBLE_DATA,
    async (_event, params: { fdpCode: string; jwt: string }) => {
      try {
        if (!params?.fdpCode?.trim()) {
          throw new Error('Missing FDP code for eligible members sync.');
        }
        if (!params?.jwt?.trim()) {
          throw new Error('Missing JWT token for eligible members sync.');
        }

        const url = resolveEligibleMembersUrl(params.fdpCode.trim());
        const startedAt = Date.now();
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            authorization: `Bearer ${params.jwt.trim()}`
          }
        });

        const rawBody = await response.text();
        const durationMs = Date.now() - startedAt;
        if (!response.ok) {
          await logService.logNetwork({
            scope: 'eligibleData:sync',
            method: 'GET',
            url,
            ok: false,
            status: response.status,
            statusText: response.statusText,
            durationMs,
            responseBodyPreview: rawBody.slice(0, 500),
            errorMessage: 'Eligible members request failed'
          });
          throw new Error(
            `Eligible members request failed for ${url} (${response.status} ${response.statusText}): ${rawBody.slice(0, 180)}`
          );
        }

        await logService.logNetwork({
          scope: 'eligibleData:sync',
          method: 'GET',
          url,
          ok: true,
          status: response.status,
          durationMs
        });

        const payload = JSON.parse(rawBody) as EligibleMembersApiResponse;
        return eligibleDataService.saveEligibleMembers(payload);
      } catch (error) {
        await logService.logError('eligibleData:sync', error);
        throw error;
      }
    }
  );
}
