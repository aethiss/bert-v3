import { ipcMain } from 'electron';
import type {
  ClientDistributionHistoryInput,
  ClientDistributionHistoryQuery,
  ClientDistributionHistoryResult,
  DistributionQueueItem,
  FamilyDistributionHistoryItem,
  EligibleMembersApiResponse,
  LocalDistributionEventInput,
  PushDistributionBatchResult,
  PushDistributionResult
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
const CHANNEL_PUSH_DISTRIBUTION_QUEUE = 'eligibleData:pushDistributionQueue';
const CHANNEL_GET_FAMILY_DISTRIBUTION_HISTORY = 'eligibleData:getFamilyDistributionHistory';
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

function resolveBulkDistributionPushUrl(): string {
  const apiBase = getEnvValue('RENDERER_VITE_API_URL') ?? getEnvValue('VITE_API_URL');
  if (!apiBase) {
    throw new Error('Missing API base URL. Set RENDERER_VITE_API_URL or VITE_API_URL.');
  }

  const endpointPath =
    getEnvValue('RENDERER_VITE_BULK_DISTRIBUTION_RESULT_V2_PATH') ??
    getEnvValue('VITE_BULK_DISTRIBUTION_RESULT_V2_PATH') ??
    '/api/v2/bulk-distribution-result-v2/';

  return new URL(endpointPath, apiBase).toString();
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
  ipcMain.removeHandler(CHANNEL_PUSH_DISTRIBUTION_QUEUE);
  ipcMain.removeHandler(CHANNEL_SAVE_CLIENT_DISTRIBUTION_HISTORY);
  ipcMain.removeHandler(CHANNEL_GET_CLIENT_DISTRIBUTION_HISTORY);
  ipcMain.removeHandler(CHANNEL_GET_FAMILY_DISTRIBUTION_HISTORY);

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
    CHANNEL_GET_FAMILY_DISTRIBUTION_HISTORY,
    async (_event, familyUniqueCode: number): Promise<FamilyDistributionHistoryItem[]> => {
      return eligibleDataService.getFamilyDistributionHistory(familyUniqueCode);
    }
  );

  ipcMain.handle(
    CHANNEL_PUSH_DISTRIBUTION_QUEUE,
    async (_event, params: { jwt: string; batchSize?: number }): Promise<PushDistributionResult> => {
      try {
        const jwt = params?.jwt?.trim();
        if (!jwt) {
          throw new Error('Missing JWT token for distribution push.');
        }

        const queue = await eligibleDataService.getDistributionQueue();
        const batchSize = Number.isInteger(params?.batchSize) && (params.batchSize ?? 0) > 0
          ? Math.min(params.batchSize ?? 50, 200)
          : 50;
        const endpointUrl = resolveBulkDistributionPushUrl();

        const batchResults: PushDistributionBatchResult[] = [];
        let totalInserted = 0;
        let totalFailed = 0;
        let totalDeletedLocalRows = 0;
        let totalReceived = 0;

        for (let offset = 0; offset < queue.length; offset += batchSize) {
          const batch = queue.slice(offset, offset + batchSize);
          totalReceived += batch.length;
          const requestPayload = batch.map((row) => ({
            familyUniqueCode: row.familyUniqueCode,
            memberID: row.memberId,
            distributionTime: row.createdAt,
            cycleCode: row.cycleCode,
            mainOperator: row.mainOperator,
            subOperator: row.subOperator ?? '',
            quantity: row.quantity,
            appSignature: row.appSignature,
            note: row.notes ?? ''
          }));

          const startedAt = Date.now();
          const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${jwt}`
            },
            body: JSON.stringify(requestPayload)
          });
          const durationMs = Date.now() - startedAt;
          const rawBody = await response.text();

          if (!response.ok) {
            await logService.logNetwork({
              scope: 'eligibleData:pushDistributionQueue',
              method: 'POST',
              url: endpointUrl,
              ok: false,
              status: response.status,
              statusText: response.statusText,
              durationMs,
              requestBodyPreview: JSON.stringify(requestPayload).slice(0, 500),
              responseBodyPreview: rawBody.slice(0, 700),
              errorMessage: 'Bulk distribution push failed'
            });
            throw new Error(
              `Bulk distribution push failed (${response.status} ${response.statusText}). ${rawBody.slice(0, 200)}`
            );
          }

          await logService.logNetwork({
            scope: 'eligibleData:pushDistributionQueue',
            method: 'POST',
            url: endpointUrl,
            ok: true,
            status: response.status,
            durationMs
          });

          const payload = JSON.parse(rawBody) as {
            total_received?: number;
            total_inserted?: number;
            total_failed?: number;
            failed_items?: Array<{ row?: number; item?: Record<string, unknown>; errors?: unknown }>;
          };

          const failedRows = new Set(
            (payload.failed_items ?? [])
              .map((item): number | null =>
                typeof item.row === 'number' && Number.isInteger(item.row) ? item.row : null
              )
              .filter((row): row is number => row !== null && row > 0)
          );

          const succeededIds = batch
            .filter((_, index) => !failedRows.has(index + 1))
            .map((item) => item.id);
          const deleted = await eligibleDataService.deleteDistributionQueueItems(succeededIds);

          const inserted = Number.isFinite(payload.total_inserted) ? Number(payload.total_inserted) : succeededIds.length;
          const failed = Number.isFinite(payload.total_failed) ? Number(payload.total_failed) : failedRows.size;
          totalInserted += inserted;
          totalFailed += failed;
          totalDeletedLocalRows += deleted.deleted;

          batchResults.push({
            batchIndex: Math.floor(offset / batchSize) + 1,
            totalReceived: batch.length,
            inserted,
            failed,
            deletedLocalRows: deleted.deleted,
            failedItems: (payload.failed_items ?? []).map((item) => ({
              row: Number.isInteger(item.row) ? (item.row as number) : -1,
              item: item.item ?? {},
              errors: item.errors
            }))
          });
        }

        return {
          batches: batchResults,
          totalReceived,
          totalInserted,
          totalFailed,
          totalDeletedLocalRows
        };
      } catch (error) {
        await logService.logError('eligibleData:pushDistributionQueue', error);
        throw error;
      }
    }
  );

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
