import { ipcMain } from 'electron';
import type {
  DistributionQueueItem,
  EligibleMembersApiResponse,
  LocalDistributionEventInput
} from '../../shared/types/eligible';
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

function resolveEligibleMembersUrl(fdpCode: string): string {
  const apiBase = process.env.RENDERER_VITE_API_URL ?? process.env.VITE_API_URL;
  if (!apiBase) {
    throw new Error('Missing API base URL. Set RENDERER_VITE_API_URL or VITE_API_URL.');
  }

  const endpointPath =
    process.env.RENDERER_VITE_ELIGIBLE_MEMBERS_PATH ??
    process.env.VITE_ELIGIBLE_MEMBERS_PATH ??
    '/api/v1/active-cycles-households/';

  const normalizedPath = endpointPath.endsWith('/') ? endpointPath : `${endpointPath}/`;
  const url = new URL(`${normalizedPath}${fdpCode}`, apiBase);
  url.searchParams.set('include_documents', 'true');
  url.searchParams.set('include_distribution_reports', 'true');
  return url.toString();
}

export function registerEligibleDataIpc(eligibleDataService: EligibleDataService): void {
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
        cycleCode: number;
        familyHhId: string;
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
    CHANNEL_SYNC_ELIGIBLE_DATA,
    async (_event, params: { fdpCode: string; jwt: string }) => {
      if (!params?.fdpCode?.trim()) {
        throw new Error('Missing FDP code for eligible members sync.');
      }
      if (!params?.jwt?.trim()) {
        throw new Error('Missing JWT token for eligible members sync.');
      }

      const url = resolveEligibleMembersUrl(params.fdpCode.trim());
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${params.jwt.trim()}`
        }
      });

      const rawBody = await response.text();
      if (!response.ok) {
        throw new Error(
          `Eligible members request failed for ${url} (${response.status} ${response.statusText}): ${rawBody.slice(0, 180)}`
        );
      }

      const payload = JSON.parse(rawBody) as EligibleMembersApiResponse;
      return eligibleDataService.saveEligibleMembers(payload);
    }
  );
}
