import type { Database } from 'sqlite';
import { createHash } from 'node:crypto';
import type {
  ClientDistributionInput,
  ClientDistributionHistoryInput,
  ClientDistributionHistoryItem,
  ClientDistributionHistoryQuery,
  ClientDistributionHistoryResult,
  DistributionQueueItem,
  FamilyDistributionHistoryItem,
  DistributionActiveCycle,
  DistributionDetailData,
  EligibleFoodCommodityApiModel,
  EligibleFoodBasketApiModel,
  EligibleFamilyApiModel,
  DistributionHouseholdInfo,
  DistributionHouseholdMember,
  DistributionSearchResult,
  EligibleCycleApiModel,
  EligibleCycleSummary,
  EligibleMemberApiModel,
  EligibleMembersApiResponse,
  EligibleOverviewSummary,
  DistributionReportItem,
  UndistributedHouseholdReportItem,
  LocalDistributionEventInput
} from '../../shared/types/eligible';
import type { OperationsDashboardQuery } from '../../shared/types/operations';
import { getDeviceMacAddress } from '../utils/deviceInfo';

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asNullableNumericLike(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function formatDate(value: string | null | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  const day = String(parsed.getUTCDate()).padStart(2, '0');
  const month = parsed.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const year = parsed.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

function computeAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) {
    return null;
  }

  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  const dayDiff = now.getUTCDate() - birth.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function toDisplayName(firstName: string | null, lastName: string | null): string {
  const joined = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  return joined || 'N/A';
}

function getEligibleCycleDisplayName(cycle: EligibleCycleApiModel): string {
  return (
    asText(cycle.cycleName).trim() ||
    asText(cycle.cycleEnName).trim() ||
    asText(cycle.cycleArName).trim() ||
    `Cycle ${cycle.cycleCode}`
  );
}

function getEligibleCycleFoodCommodities(
  cycle: EligibleCycleApiModel
): EligibleFoodCommodityApiModel[] {
  const foodBasketCommodities = (cycle.food_basket ?? []).flatMap(
    (basket) => basket.commodities ?? []
  );
  if (foodBasketCommodities.length > 0) {
    return foodBasketCommodities;
  }

  return cycle.foodCommodities ?? [];
}

function getEligibleCycleFoodBaskets(cycle: EligibleCycleApiModel): EligibleFoodBasketApiModel[] {
  return cycle.food_basket ?? [];
}

function getEligibleFamilyBooklet(family: EligibleFamilyApiModel): string | null {
  return asNullableText(family.principle_family_booklet);
}

function getEligibleFamilyPhone(family: EligibleFamilyApiModel): string | null {
  return asNullableText(family.principle_mobile);
}

function getEligibleFamilyCreatedDate(family: EligibleFamilyApiModel): string | null {
  return asNullableText(family.createdDate);
}

function getEligibleFamilyBpwCount(family: EligibleFamilyApiModel): number {
  return asNumber(family.bpw_count);
}

function getAgeGroupLabel(dateOfBirth: string | null | undefined): string {
  const age = computeAge(dateOfBirth ?? null);
  if (age === null) {
    return '';
  }

  if (age < 18) {
    return '23 Months - 18 Yrs';
  }

  if (age <= 60) {
    return '18-60';
  }

  return '>60';
}

function formatReceiptSequence(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const numericValue = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(numericValue)) {
    return '';
  }

  return String(Math.trunc(numericValue)).padStart(4, '0');
}

function buildReceiptId(params: {
  fdpCode: string | null | undefined;
  householdId: number | string;
  sequence: number | string | null | undefined;
}): string {
  const fdpCode = (params.fdpCode ?? '').trim();
  const householdId = String(params.householdId).trim();
  const sequence = formatReceiptSequence(params.sequence);

  if (!fdpCode || !householdId || !sequence) {
    return '';
  }

  return `${fdpCode}-${householdId}-${sequence}`;
}

function formatFullName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim();
}

export function normalizeClientHistoryPagination(page: number, pageSize: number): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 10;
  return {
    page: safePage,
    pageSize: safePageSize,
    offset: (safePage - 1) * safePageSize
  };
}

export function buildOverviewSummaryFromPayload(
  payload: EligibleMembersApiResponse,
  totalMembers: number
): EligibleOverviewSummary {
  const cycles: EligibleCycleSummary[] = payload.cycles.slice(0, 2).map((cycle) => ({
    cycleCode: cycle.cycleCode,
    cycleName: getEligibleCycleDisplayName(cycle),
    assistancePackageName: cycle.assistancePackageName,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    householdCount: cycle.household_count
  }));

  return {
    hasData: payload.cycles.length > 0,
    fdpCode: payload.fdp_code,
    fdpName: payload.fdp_name,
    totalCycles: payload.total_cycles,
    totalHouseholds: payload.total_households,
    totalMembers,
    pendingDistributionCount: 0,
    lastSynchronizedAt: null,
    cycles
  };
}

export interface EligibleDataService {
  saveEligibleMembers(payload: EligibleMembersApiResponse): Promise<EligibleOverviewSummary>;
  getDistributionReport(): Promise<DistributionReportItem[]>;
  getUndistributedHouseholdReport(): Promise<UndistributedHouseholdReportItem[]>;
  searchDistributionMember(query: string): Promise<DistributionSearchResult | null>;
  getDistributionDetail(params: {
    memberId: number;
    familyUniqueCode: number;
  }): Promise<DistributionDetailData | null>;
  saveDistributionEvent(payload: LocalDistributionEventInput): Promise<{ id: number }>;
  saveClientDistribution(payload: ClientDistributionInput): Promise<{ id: number }>;
  saveClientDistributionHistory(payload: ClientDistributionHistoryInput): Promise<{ id: number }>;
  getClientDistributionHistory(
    query: ClientDistributionHistoryQuery
  ): Promise<ClientDistributionHistoryResult>;
  getDistributionQueue(): Promise<DistributionQueueItem[]>;
  getFamilyDistributionHistory(familyUniqueCode: number): Promise<FamilyDistributionHistoryItem[]>;
  deleteDistributionQueueItems(ids: number[]): Promise<{ deleted: number }>;
  getPendingDistributionCount(): Promise<number>;
  getOperationsAggregates(query: OperationsDashboardQuery): Promise<{
    totalDistributions: number;
    cycleProgress: Array<{
      cycleCode: number;
      cycleName: string;
      totalHouseholds: number;
      distributedCount: number;
    }>;
    overviewBars: Array<{
      alias: string;
      distributedCount: number;
    }>;
    clientCycleCounts: Array<{
      alias: string;
      cycleCode: number;
      distributedCount: number;
    }>;
    distributions: {
      items: Array<{
        id: number;
        subOperator: string;
        familyUniqueCode: number;
        documentNumber: string | null;
        date: string;
        cycleCode: number;
        cycleName: string;
        status: string;
        createdAt: string;
      }>;
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }>;
  clearDistributionQueue(): Promise<{ deleted: number }>;
  hasEligibleData(): Promise<boolean>;
  getOverviewSummary(): Promise<EligibleOverviewSummary>;
  clearEligibleData(): Promise<void>;
}

interface DistributionMemberRow {
  id: number;
  role: string | null;
  documentNumber: string | null;
  familyUniqueCode: number;
  firstName: string | null;
  lastName: string | null;
}

interface DistributionActiveCycleRow {
  cycleCode: number;
  cycleName: string;
  assistanceType: string;
  quantity: string;
  startDate: string;
  endDate: string;
  isDistributed: number;
}

interface DistributionCycleCommodityRow {
  cycleCode: number;
  commodityId: number;
  uniqueId: string;
  enName: string;
  arName: string;
  description: string | null;
  kcal: number | null;
  unit: string | null;
  quantity: number | null;
  weight: number | null;
}

interface DistributionHouseholdMemberRow {
  memberId: number;
  firstName: string | null;
  lastName: string | null;
  fatherName: string | null;
  documentNumber: string | null;
  dateOfBirth: string | null;
  role: string | null;
}

interface DistributionHouseholdInfoRow {
  familyUniqueCode: number;
  booklet: string | null;
  phone: string | null;
  createdDate: string | null;
  bpwCount: number | null;
  children623: number;
  updatedAt: string | null;
}

interface DistributionPrincipleRow {
  firstName: string | null;
  lastName: string | null;
}

interface UndistributedHouseholdReportRow {
  householdId: number;
  principalPhoneNo: string | null;
  hhSubdistrict: string | null;
  cycleCode: string | null;
  cpEnName: string | null;
  fdpEnName: string | null;
}

interface DistributionReportDbRow {
  sourceType: 'synced' | 'local';
  transactionId: number | null;
  localDistributionId: number | null;
  familyUniqueCode: number;
  memberId: number | null;
  hhid: string | null;
  hhMembers: number | null;
  hhRegistrationDate: string | null;
  ageGroup: string | null;
  timestamp: string | null;
  hhSubdistrict: string | null;
  cycleCode: number;
  cycleName: string | null;
  foodBasket: string | null;
  quantity: string | null;
  collectedByFirstName: string | null;
  collectedByLastName: string | null;
  collectedByFatherName: string | null;
  collectedByNationalId: string | null;
  operator: string | null;
  remarks: string | null;
  sourcefile: string | null;
  dateOfBirth: string | null;
}

export function isPrincipleRole(role: string | null): boolean {
  const normalized = (role ?? '').trim().toLowerCase();
  return normalized === 'principle' || normalized === 'principal';
}

function isDuplicateDistributionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalized = error.message.toLowerCase();
  return normalized.includes('duplicate distribution');
}

export function pickPreferredDistributionMember(
  rows: DistributionMemberRow[]
): DistributionMemberRow | null {
  if (rows.length === 0) {
    return null;
  }

  return rows.find((row) => isPrincipleRole(row.role)) ?? rows[0];
}

function pickPrincipleDistributionMember(rows: DistributionMemberRow[]): DistributionMemberRow | null {
  if (rows.length === 0) {
    return null;
  }

  return rows.find((row) => isPrincipleRole(row.role)) ?? rows[0];
}

function toSafeInteger(value: unknown): number | null {
  const parsed = asNullableNumericLike(value);
  if (parsed === null || !Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
}

function asRealNumber(value: unknown): number | null {
  const parsed = asNullableNumericLike(value);
  return parsed === null ? null : parsed;
}

function normalizeQuantity(value: unknown): number {
  const parsed = asNullableNumericLike(value);
  if (parsed === null || !Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.round(parsed));
}

function buildDistributionAppSignature(input: {
  familyUniqueCode: number;
  memberId: number;
  cycleCode: number;
  mainOperator: number;
  mainOperatorFDP: string;
  subOperator: string | null;
  quantity: number;
  notes: string | null;
  distributionTimeIso: string;
}): string {
  const source = JSON.stringify({
    familyUniqueCode: input.familyUniqueCode,
    memberID: input.memberId,
    distributionTime: input.distributionTimeIso,
    cycleCode: input.cycleCode,
    mainOperator: input.mainOperator,
    subOperator: input.subOperator ?? '',
    quantity: input.quantity,
    note: input.notes ?? '',
    mainOperatorFDP: input.mainOperatorFDP
  });

  return createHash('sha256').update(source).digest('hex');
}

function normalizeFamilyUniqueCode(family: EligibleFamilyApiModel): number | null {
  return toSafeInteger(family.FamilyUniqueCode);
}

function normalizeCommodityId(commodity: EligibleFoodCommodityApiModel): number | null {
  return toSafeInteger(commodity.id);
}

function getDistributionHistoryCycleCode(entry: Record<string, unknown>): number | null {
  return toSafeInteger(entry.cycleCode);
}

function getDistributionHistoryId(entry: Record<string, unknown>): number | null {
  return toSafeInteger(entry.id);
}

function getDistributionHistoryFamilyUniqueCode(
  entry: Record<string, unknown>,
  fallbackFamilyUniqueCode: number
): number | null {
  return toSafeInteger(entry.hhid) ?? fallbackFamilyUniqueCode;
}

function getDistributionHistoryCollectedByDocument(entry: Record<string, unknown>): string | null {
  return asNullableText(entry.collectedByNationalId);
}

function getDistributionHistoryOperator(entry: Record<string, unknown>): string | null {
  return asNullableText(entry.operator);
}

function getDistributionHistorySourcefile(entry: Record<string, unknown>): string | null {
  return asNullableText(entry.sourcefile);
}

function findHistoryCollectorMember(
  family: EligibleFamilyApiModel,
  historyEntry: Record<string, unknown>
): EligibleMemberApiModel | null {
  const collectedByDocument = getDistributionHistoryCollectedByDocument(historyEntry);
  if (!collectedByDocument?.trim()) {
    return null;
  }
  return (
    (family.members ?? []).find(
      (member) => asText(member.documentNumber).trim().toLowerCase() === collectedByDocument.trim().toLowerCase()
    ) ?? null
  );
}

export function createEligibleDataService(db: Database): EligibleDataService {
  async function getServerOperatorContext(): Promise<{ mainOperator: number; mainOperatorFDP: string }> {
    const row = await db.get<{ userId: number | null; fdp: string | null }>(
      `
      SELECT
        user_id as userId,
        fdp as fdp
      FROM "user"
      WHERE id = 1
      LIMIT 1
      `
    );

    const mainOperator = asNullableNumber(row?.userId);
    const mainOperatorFDP = asText(row?.fdp).trim();

    if (mainOperator === null) {
      throw new Error('Missing server main operator. Login on server before accepting client distributions.');
    }

    if (!mainOperatorFDP) {
      throw new Error('Missing server FDP. Login on server before accepting client distributions.');
    }

    return {
      mainOperator,
      mainOperatorFDP
    };
  }

  async function getUserProfileContext(): Promise<{
    corporatePartner: string;
    fieldOffice: string;
    fdp: string;
  }> {
    const row = await db.get<{
      corporatePartner: string | null;
      fieldOffice: string | null;
      fdp: string | null;
    }>(
      `
      SELECT
        corporate_partner as corporatePartner,
        field_office as fieldOffice,
        fdp as fdp
      FROM "user"
      WHERE id = 1
      LIMIT 1
      `
    );

    return {
      corporatePartner: asText(row?.corporatePartner).trim(),
      fieldOffice: asText(row?.fieldOffice).trim(),
      fdp: asText(row?.fdp).trim()
    };
  }

  async function clearEligibleData(): Promise<void> {
    await db.exec('BEGIN TRANSACTION');
    try {
      await db.run('DELETE FROM cycle_food_commodities');
      await db.run('DELETE FROM cycle_food_baskets');
      await db.run('DELETE FROM synced_distribution_history');
      await db.run('DELETE FROM distribution_list');
      await db.run('DELETE FROM members');
      await db.run('DELETE FROM families');
      await db.run('DELETE FROM cycles');
      await db.run('DELETE FROM eligible_meta');
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  }

  async function saveEligibleMembers(
    payload: EligibleMembersApiResponse
  ): Promise<EligibleOverviewSummary> {
    await db.exec('BEGIN TRANSACTION');
    try {
      await db.run('DELETE FROM cycle_food_commodities');
      await db.run('DELETE FROM cycle_food_baskets');
      await db.run('DELETE FROM synced_distribution_history');
      await db.run('DELETE FROM distribution_list');
      await db.run('DELETE FROM members');
      await db.run('DELETE FROM families');
      await db.run('DELETE FROM cycles');
      await db.run('DELETE FROM eligible_meta');

      let skippedCycles = 0;
      let skippedCycleFoodCommodities = 0;
      let skippedFamilies = 0;
      let skippedFamilyCycles = 0;
      let skippedMembers = 0;
      const validCycleCodes = new Set<number>();

      for (const cycle of payload.cycles ?? []) {
        const cycleCode = toSafeInteger(cycle.cycleCode);
        if (cycleCode === null) {
          skippedCycles += 1;
          continue;
        }
        validCycleCodes.add(cycleCode);

        await db.run(
          `
          INSERT INTO cycles (
            cycle_code, cycle_id, cycle_name, assistance_package_name, start_date, end_date,
            cycle_note, cooperating_partner, field_distribution_point, household_count
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(cycle_code) DO UPDATE SET
            cycle_id = excluded.cycle_id,
            cycle_name = excluded.cycle_name,
            assistance_package_name = excluded.assistance_package_name,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            cycle_note = excluded.cycle_note,
            cooperating_partner = excluded.cooperating_partner,
            field_distribution_point = excluded.field_distribution_point,
            household_count = excluded.household_count,
            updated_at = CURRENT_TIMESTAMP
          `,
          cycleCode,
          asText(cycle.cycleId),
          getEligibleCycleDisplayName(cycle),
          asText(cycle.assistancePackageName),
          asText(cycle.startDate),
          asText(cycle.endDate),
          asNullableText(cycle.cycleNote),
          asNullableText(cycle.cooperatingPartner),
          asNullableText(cycle.fieldDistributionPoint),
          asNumber(cycle.household_count)
        );

        for (const commodity of getEligibleCycleFoodCommodities(cycle)) {
          const commodityId = normalizeCommodityId(commodity);
          if (commodityId === null) {
            skippedCycleFoodCommodities += 1;
            continue;
          }

          await db.run(
            `
            INSERT INTO cycle_food_commodities (
              cycle_code,
              commodity_id,
              unique_id,
              en_name,
              ar_name,
              description,
              kcal,
              unit,
              quantity,
              weight
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cycle_code, commodity_id) DO UPDATE SET
              unique_id = excluded.unique_id,
              en_name = excluded.en_name,
              ar_name = excluded.ar_name,
              description = excluded.description,
              kcal = excluded.kcal,
              unit = excluded.unit,
              quantity = excluded.quantity,
              weight = excluded.weight,
              updated_at = CURRENT_TIMESTAMP
            `,
            cycleCode,
            commodityId,
            asText(commodity.unique_id),
            asText(commodity.en_name),
            asText(commodity.ar_name),
            asNullableText(commodity.description),
            asRealNumber(commodity.kcal),
            asNullableText(commodity.unit),
            asRealNumber(commodity.quantity),
            asRealNumber(commodity.weight)
          );
        }

        for (const foodBasket of getEligibleCycleFoodBaskets(cycle)) {
          const basketId = toSafeInteger(foodBasket.id);
          if (basketId === null) {
            skippedCycleFoodCommodities += 1;
            continue;
          }

          await db.run(
            `
            INSERT INTO cycle_food_baskets (
              cycle_code,
              basket_id,
              unique_id,
              code,
              en_name,
              ar_name,
              description
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cycle_code, basket_id) DO UPDATE SET
              unique_id = excluded.unique_id,
              code = excluded.code,
              en_name = excluded.en_name,
              ar_name = excluded.ar_name,
              description = excluded.description,
              updated_at = CURRENT_TIMESTAMP
            `,
            cycleCode,
            basketId,
            asText(foodBasket.unique_id),
            asText(foodBasket.code),
            asText(foodBasket.en_name),
            asText(foodBasket.ar_name),
            asNullableText(foodBasket.description)
          );
        }
      }

      for (const family of payload.families ?? []) {
        const familyUniqueCode = normalizeFamilyUniqueCode(family);
        if (familyUniqueCode === null) {
          skippedFamilies += 1;
          continue;
        }

        await db.run(
          `
          INSERT INTO families (
            family_unique_code,
            address,
            status,
            eligible,
            principle_family_booklet,
            principle_mobile,
            created_date,
            bpw_count,
            fdp_id,
            fdp_name,
            children_6_23_months
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(family_unique_code) DO UPDATE SET
            address = excluded.address,
            status = excluded.status,
            eligible = excluded.eligible,
            principle_family_booklet = excluded.principle_family_booklet,
            principle_mobile = excluded.principle_mobile,
            created_date = excluded.created_date,
            bpw_count = excluded.bpw_count,
            fdp_id = excluded.fdp_id,
            fdp_name = excluded.fdp_name,
            children_6_23_months = excluded.children_6_23_months,
            updated_at = CURRENT_TIMESTAMP
          `,
          familyUniqueCode,
          asNullableText(family.address),
          asText(family.status),
          family.eligible ? 1 : 0,
          getEligibleFamilyBooklet(family),
          getEligibleFamilyPhone(family),
          getEligibleFamilyCreatedDate(family),
          getEligibleFamilyBpwCount(family),
          asText(family.fdp_id),
          asText(family.fdp_name),
          asNumber(family.Number_of_Children_between_6_and_23_Months)
        );

        for (const familyCycle of family.cycles ?? []) {
          const cycleCode = toSafeInteger(familyCycle.code);
          if (cycleCode === null || !validCycleCodes.has(cycleCode)) {
            skippedFamilyCycles += 1;
            continue;
          }

          await db.run(
            `
            INSERT INTO distribution_list (
              family_unique_code,
              cycle_code,
              quantity
            )
            VALUES (?, ?, ?)
            ON CONFLICT(family_unique_code, cycle_code) DO UPDATE SET
              quantity = excluded.quantity,
              updated_at = CURRENT_TIMESTAMP
            `,
            familyUniqueCode,
            cycleCode,
            asText(familyCycle.quantity, '1')
          );
        }

        for (const historyEntry of family.distributionHistory ?? []) {
          const cycleCode = getDistributionHistoryCycleCode(historyEntry);
          const historyFamilyUniqueCode = getDistributionHistoryFamilyUniqueCode(
            historyEntry,
            familyUniqueCode
          );
          if (cycleCode === null || historyFamilyUniqueCode === null) {
            continue;
          }

          if (!validCycleCodes.has(cycleCode)) {
            // Preserve history entries for cycles no longer active in payload.
            await db.run(
              `
              INSERT INTO cycles (
                cycle_code, cycle_id, cycle_name, assistance_package_name, start_date, end_date,
                cycle_note, cooperating_partner, field_distribution_point, household_count
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(cycle_code) DO NOTHING
              `,
              cycleCode,
              `history_${cycleCode}`,
              `Cycle ${cycleCode}`,
              '',
              asText(historyEntry.timestamp, '1970-01-01T00:00:00Z'),
              asText(historyEntry.timestamp, '1970-01-01T00:00:00Z'),
              null,
              null,
              null,
              0
            );
            validCycleCodes.add(cycleCode);
          }

          await db.run(
            `
            INSERT INTO synced_distribution_history (
              family_unique_code,
              cycle_code,
              distribution_id,
              distribution_time,
              app_signature,
              collected_by_document,
              collected_by_first_name,
              collected_by_last_name,
              collected_by_father_name,
              operator,
              notes,
              sourcefile
          )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(family_unique_code, cycle_code) DO UPDATE SET
              distribution_id = excluded.distribution_id,
              distribution_time = excluded.distribution_time,
              app_signature = excluded.app_signature,
              collected_by_document = excluded.collected_by_document,
              collected_by_first_name = excluded.collected_by_first_name,
              collected_by_last_name = excluded.collected_by_last_name,
              collected_by_father_name = excluded.collected_by_father_name,
              operator = excluded.operator,
              notes = excluded.notes,
              sourcefile = excluded.sourcefile,
              updated_at = CURRENT_TIMESTAMP
            `,
            historyFamilyUniqueCode,
            cycleCode,
            getDistributionHistoryId(historyEntry),
            asNullableText(historyEntry.timestamp),
            asNullableText(historyEntry.signature),
            getDistributionHistoryCollectedByDocument(historyEntry),
            asNullableText(findHistoryCollectorMember(family, historyEntry)?.firstName),
            asNullableText(findHistoryCollectorMember(family, historyEntry)?.lastName),
            asNullableText(findHistoryCollectorMember(family, historyEntry)?.fatherName),
            getDistributionHistoryOperator(historyEntry),
            asNullableText(historyEntry.notes),
            getDistributionHistorySourcefile(historyEntry)
          );
        }

        for (const member of family.members ?? []) {
          const memberId = toSafeInteger(member.id);
          if (memberId === null) {
            skippedMembers += 1;
            continue;
          }

          await db.run(
            `
            INSERT INTO members (
              member_id,
              family_unique_code,
              role,
              first_name,
              last_name,
              father_name,
              mother_name,
              mother_last_name,
              city_of_birth,
              date_of_birth,
              document_number,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(member_id) DO UPDATE SET
              family_unique_code = excluded.family_unique_code,
              role = excluded.role,
              first_name = excluded.first_name,
              last_name = excluded.last_name,
              father_name = excluded.father_name,
              mother_name = excluded.mother_name,
              mother_last_name = excluded.mother_last_name,
              city_of_birth = excluded.city_of_birth,
              date_of_birth = excluded.date_of_birth,
              document_number = excluded.document_number,
              status = excluded.status,
              updated_at = CURRENT_TIMESTAMP
            `,
            memberId,
            familyUniqueCode,
            asNullableText(member.role),
            asNullableText(member.firstName),
            asNullableText(member.lastName),
            asNullableText(member.fatherName),
            asNullableText(member.motherName),
            asNullableText(member.motherLastName),
            asNullableText(member.cityOfBirth),
            asNullableText(member.dateOfBirth),
            asNullableText(member.documentNumber),
            asText(member.status)
          );
        }
      }

      const membersTotalRow = await db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM members'
      );
      const membersCount = asNumber(membersTotalRow?.count);

      await db.run(
        `
        INSERT INTO eligible_meta (
          id, fdp_code, fdp_name, total_households, total_cycles, total_members
        )
        VALUES (1, ?, ?, ?, ?, ?)
        `,
        payload.fdp_code,
        payload.fdp_name,
        payload.total_households,
        payload.total_cycles,
        membersCount
      );

      await db.exec('COMMIT');
      if (
        skippedCycles > 0 ||
        skippedCycleFoodCommodities > 0 ||
        skippedFamilies > 0 ||
        skippedFamilyCycles > 0 ||
        skippedMembers > 0
      ) {
        console.warn(
          `[eligibleData] Skipped invalid records during sync: cycles=${skippedCycles}, commodities=${skippedCycleFoodCommodities}, families=${skippedFamilies}, familyCycles=${skippedFamilyCycles}, members=${skippedMembers}`
        );
      }
      return buildOverviewSummaryFromPayload(payload, membersCount);
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  }

  async function hasEligibleData(): Promise<boolean> {
    const row = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM cycles');
    return asNumber(row?.count) > 0;
  }

  async function searchDistributionMember(query: string): Promise<DistributionSearchResult | null> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return null;
    }

    const isNumericFamilyCode = /^\d+$/.test(normalizedQuery);

    if (isNumericFamilyCode) {
      const familyUniqueCode = Number(normalizedQuery);
      if (Number.isSafeInteger(familyUniqueCode)) {
        const familyRows = await db.all<DistributionMemberRow[]>(
          `
          SELECT
            m.member_id as id,
            m.role as role,
            m.document_number as documentNumber,
            m.family_unique_code as familyUniqueCode,
            m.first_name as firstName,
            m.last_name as lastName
          FROM members m
          WHERE m.family_unique_code = ?
          ORDER BY m.member_id ASC
          `,
          familyUniqueCode
        );

        const preferredFamilyMember = pickPreferredDistributionMember(familyRows ?? []);
        const principleFamilyMember = pickPrincipleDistributionMember(familyRows ?? []);
        const familyRow = await db.get<{ fdpName: string; familyBooklet: string | null }>(
          `
          SELECT
            fdp_name as fdpName,
            principle_family_booklet as familyBooklet
          FROM families
          WHERE family_unique_code = ?
          LIMIT 1
          `,
          familyUniqueCode
        );
        if (preferredFamilyMember) {
          return {
            match: 'familyUniqueCode',
            member: {
              id: preferredFamilyMember.id,
              fullName: toDisplayName(
                preferredFamilyMember.firstName,
                preferredFamilyMember.lastName
              ),
              principleFullName: toDisplayName(
                principleFamilyMember?.firstName ?? preferredFamilyMember.firstName,
                principleFamilyMember?.lastName ?? preferredFamilyMember.lastName
              ),
              fdpName: asText(familyRow?.fdpName, 'N/A'),
              familyBooklet: asNullableText(familyRow?.familyBooklet),
              role: preferredFamilyMember.role,
              documentNumber: preferredFamilyMember.documentNumber,
              familyUniqueCode: preferredFamilyMember.familyUniqueCode
            }
          };
        }
      }
    }

    const familyByBooklet = await db.get<{
      familyUniqueCode: number;
      fdpName: string;
      familyBooklet: string | null;
    }>(
      `
      SELECT
        family_unique_code as familyUniqueCode,
        fdp_name as fdpName,
        principle_family_booklet as familyBooklet
      FROM families
      WHERE LOWER(TRIM(COALESCE(principle_family_booklet, ''))) = LOWER(TRIM(?))
      LIMIT 1
      `,
      normalizedQuery
    );

    if (familyByBooklet) {
      const familyRows = await db.all<DistributionMemberRow[]>(
        `
        SELECT
          m.member_id as id,
          m.role as role,
          m.document_number as documentNumber,
          m.family_unique_code as familyUniqueCode,
          m.first_name as firstName,
          m.last_name as lastName
        FROM members m
        WHERE m.family_unique_code = ?
        ORDER BY m.member_id ASC
        `,
        familyByBooklet.familyUniqueCode
      );
      const preferredFamilyMember = pickPreferredDistributionMember(familyRows ?? []);
      const principleFamilyMember = pickPrincipleDistributionMember(familyRows ?? []);

      if (preferredFamilyMember) {
        return {
          match: 'familyBooklet',
          member: {
            id: preferredFamilyMember.id,
            fullName: toDisplayName(
              preferredFamilyMember.firstName,
              preferredFamilyMember.lastName
            ),
            principleFullName: toDisplayName(
              principleFamilyMember?.firstName ?? preferredFamilyMember.firstName,
              principleFamilyMember?.lastName ?? preferredFamilyMember.lastName
            ),
            fdpName: asText(familyByBooklet.fdpName, 'N/A'),
            familyBooklet: asNullableText(familyByBooklet.familyBooklet),
            role: preferredFamilyMember.role,
            documentNumber: preferredFamilyMember.documentNumber,
            familyUniqueCode: preferredFamilyMember.familyUniqueCode
          }
        };
      }
    }

    const memberByDocument = await db.get<DistributionMemberRow>(
      `
      SELECT
        m.member_id as id,
        m.role as role,
        m.document_number as documentNumber,
        m.family_unique_code as familyUniqueCode,
        m.first_name as firstName,
        m.last_name as lastName
      FROM members m
      WHERE LOWER(TRIM(m.document_number)) = LOWER(TRIM(?))
      ORDER BY m.member_id ASC
      LIMIT 1
      `,
      normalizedQuery
    );

    if (!memberByDocument) {
      return null;
    }

    const familyRows = await db.all<DistributionMemberRow[]>(
      `
      SELECT
        m.member_id as id,
        m.role as role,
        m.document_number as documentNumber,
        m.family_unique_code as familyUniqueCode,
        m.first_name as firstName,
        m.last_name as lastName
      FROM members m
      WHERE m.family_unique_code = ?
      ORDER BY m.member_id ASC
      `,
      memberByDocument.familyUniqueCode
    );
    const principleFamilyMember = pickPrincipleDistributionMember(familyRows ?? []);
    const familyRow = await db.get<{ fdpName: string; familyBooklet: string | null }>(
      `
      SELECT
        fdp_name as fdpName,
        principle_family_booklet as familyBooklet
      FROM families
      WHERE family_unique_code = ?
      LIMIT 1
      `,
      memberByDocument.familyUniqueCode
    );

    return {
      match: 'documentNumber',
      member: {
        id: memberByDocument.id,
        fullName: toDisplayName(memberByDocument.firstName, memberByDocument.lastName),
        principleFullName: toDisplayName(
          principleFamilyMember?.firstName ?? memberByDocument.firstName,
          principleFamilyMember?.lastName ?? memberByDocument.lastName
        ),
        fdpName: asText(familyRow?.fdpName, 'N/A'),
        familyBooklet: asNullableText(familyRow?.familyBooklet),
        role: memberByDocument.role,
        documentNumber: memberByDocument.documentNumber,
        familyUniqueCode: memberByDocument.familyUniqueCode
      }
    };
  }

  async function getDistributionDetail(params: {
    memberId: number;
    familyUniqueCode: number;
  }): Promise<DistributionDetailData | null> {
    if (!params.memberId || !params.familyUniqueCode) {
      return null;
    }

    const householdRow = await db.get<DistributionHouseholdInfoRow>(
      `
      SELECT
        family_unique_code as familyUniqueCode,
        principle_family_booklet as booklet,
        principle_mobile as phone,
        created_date as createdDate,
        bpw_count as bpwCount,
        children_6_23_months as children623,
        updated_at as updatedAt
      FROM families
      WHERE family_unique_code = ?
      LIMIT 1
      `,
      params.familyUniqueCode
    );

    if (!householdRow) {
      return null;
    }

    const principleRow = await db.get<DistributionPrincipleRow>(
      `
      SELECT
        first_name as firstName,
        last_name as lastName
      FROM members
      WHERE family_unique_code = ?
        AND (LOWER(TRIM(role)) = 'principle' OR LOWER(TRIM(role)) = 'principal')
      ORDER BY member_id ASC
      LIMIT 1
      `,
      householdRow.familyUniqueCode
    );

    const fallbackMember = await db.get<DistributionHouseholdMemberRow>(
      `
      SELECT
        member_id as memberId,
        first_name as firstName,
        last_name as lastName,
        father_name as fatherName,
        document_number as documentNumber,
        date_of_birth as dateOfBirth,
        role as role
      FROM members
      WHERE family_unique_code = ?
      ORDER BY member_id ASC
      LIMIT 1
      `,
      householdRow.familyUniqueCode
    );

    const activeCycleRows = await db.all<DistributionActiveCycleRow[]>(
      `
      SELECT
        c.cycle_code as cycleCode,
        c.cycle_name as cycleName,
        c.assistance_package_name as assistanceType,
        dl.quantity as quantity,
        c.start_date as startDate,
        c.end_date as endDate,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM distribution_queue dq
            WHERE dq.family_unique_code = dl.family_unique_code
              AND dq.cycle_code = dl.cycle_code
          ) OR EXISTS (
            SELECT 1
            FROM client_distribution_history cdh
            WHERE cdh.family_unique_code = dl.family_unique_code
              AND cdh.cycle_code = dl.cycle_code
          ) OR EXISTS (
            SELECT 1
            FROM synced_distribution_history sdh
            WHERE sdh.family_unique_code = dl.family_unique_code
              AND sdh.cycle_code = dl.cycle_code
          ) THEN 1
          ELSE 0
        END as isDistributed
      FROM distribution_list dl
      INNER JOIN cycles c ON c.cycle_code = dl.cycle_code
      WHERE dl.family_unique_code = ?
      ORDER BY c.cycle_code DESC
      `,
      householdRow.familyUniqueCode
    );

    const memberRows = await db.all<DistributionHouseholdMemberRow[]>(
      `
      SELECT
        m.member_id as memberId,
        m.first_name as firstName,
        m.last_name as lastName,
        m.father_name as fatherName,
        m.document_number as documentNumber,
        m.date_of_birth as dateOfBirth,
        m.role as role
      FROM members m
      WHERE m.family_unique_code = ?
      ORDER BY m.member_id ASC
      `,
      householdRow.familyUniqueCode
    );

    const commodityRows = await db.all<DistributionCycleCommodityRow[]>(
      `
      SELECT
        cfc.cycle_code as cycleCode,
        cfc.commodity_id as commodityId,
        cfc.unique_id as uniqueId,
        cfc.en_name as enName,
        cfc.ar_name as arName,
        cfc.description as description,
        cfc.kcal as kcal,
        cfc.unit as unit,
        cfc.quantity as quantity,
        cfc.weight as weight
      FROM cycle_food_commodities cfc
      INNER JOIN distribution_list dl ON dl.cycle_code = cfc.cycle_code
      WHERE dl.family_unique_code = ?
      ORDER BY cfc.cycle_code DESC, cfc.commodity_id ASC
      `,
      householdRow.familyUniqueCode
    );

    const commodityByCycleCode = new Map<number, EligibleFoodCommodityApiModel[]>();
    for (const row of commodityRows) {
      const entry = commodityByCycleCode.get(row.cycleCode) ?? [];
      entry.push({
        id: row.commodityId,
        unique_id: row.uniqueId,
        en_name: row.enName,
        ar_name: row.arName,
        description: row.description,
        kcal: row.kcal,
        unit: row.unit,
        quantity: row.quantity,
        weight: row.weight
      });
      commodityByCycleCode.set(row.cycleCode, entry);
    }

    const household: DistributionHouseholdInfo = {
      familyUniqueCode: householdRow.familyUniqueCode,
      idmId: String(householdRow.familyUniqueCode),
      booklet: asText(householdRow.booklet).trim() || 'N/A',
      principle: toDisplayName(
        principleRow?.firstName ?? fallbackMember?.firstName ?? null,
        principleRow?.lastName ?? fallbackMember?.lastName ?? null
      ),
      phone: asText(householdRow.phone).trim() || 'N/A',
      registrationDate: formatDate(householdRow.createdDate, 'N/A'),
      pbwgs: String(asNumber(householdRow.bpwCount, 0)),
      children623: asNumber(householdRow.children623)
    };

    const activeCycles: DistributionActiveCycle[] = activeCycleRows.map((row) => ({
      cycleCode: row.cycleCode,
      cycleName: row.cycleName,
      assistanceType: row.assistanceType,
      quantity: row.quantity,
      startDate: formatDate(row.startDate, '01-Jan-2026'),
      endDate: formatDate(row.endDate, '31-Jan-2026'),
      isDistributed: asNumber(row.isDistributed) > 0,
      foodCommodities: commodityByCycleCode.get(row.cycleCode) ?? []
    }));

    const members: DistributionHouseholdMember[] = memberRows.map((row) => ({
      memberId: row.memberId,
      fullName: toDisplayName(row.firstName, row.lastName),
      firstName: row.firstName,
      lastName: row.lastName,
      fatherName: row.fatherName,
      documentNumber: row.documentNumber,
      age: computeAge(row.dateOfBirth),
      role: row.role
    }));

    return {
      household,
      activeCycles,
      members,
      selectedMemberId: params.memberId
    };
  }

  async function saveDistributionEvent(
    payload: LocalDistributionEventInput
  ): Promise<{ id: number }> {
    if (!Number.isFinite(payload.familyUniqueCode)) {
      throw new Error('Invalid familyUniqueCode for distribution event.');
    }
    if (!Number.isFinite(payload.memberId)) {
      throw new Error('Invalid memberId for distribution event.');
    }
    if (!Number.isFinite(payload.cycleCode)) {
      throw new Error('Invalid cycleCode for distribution event.');
    }
    if (!Number.isFinite(payload.mainOperator)) {
      throw new Error('Invalid mainOperator for distribution event.');
    }
    if (!payload.mainOperatorFDP?.trim()) {
      throw new Error('Missing mainOperatorFDP for distribution event.');
    }
    if (!Number.isFinite(payload.quantity) || payload.quantity < 1) {
      throw new Error('Invalid quantity for distribution event.');
    }

    const deviceMacAddress = payload.deviceMacAddress.trim();

    const duplicateRow = await db.get<{ count: number }>(
      `
      SELECT COUNT(*) as count
      FROM distribution_queue
      WHERE family_unique_code = ?
        AND cycle_code = ?
      `,
      payload.familyUniqueCode,
      payload.cycleCode
    );

    if (asNumber(duplicateRow?.count) > 0) {
      throw new Error(
        'Duplicate distribution blocked: this family has already received distribution for the selected cycle.'
      );
    }

    const normalizedQuantity = normalizeQuantity(payload.quantity);
    const distributionTimeIso = new Date().toISOString();
    const appSignature = buildDistributionAppSignature({
      familyUniqueCode: payload.familyUniqueCode,
      memberId: payload.memberId,
      cycleCode: payload.cycleCode,
      mainOperator: payload.mainOperator,
      mainOperatorFDP: payload.mainOperatorFDP,
      subOperator: payload.subOperator,
      quantity: normalizedQuantity,
      notes: payload.notes,
      distributionTimeIso
    });

    let result: { lastID?: number } = {};
    try {
      result = await db.run(
        `
        INSERT INTO distribution_queue (
          family_unique_code,
          member_id,
          cycle_code,
          main_operator,
          main_operator_fdp,
          sub_operator,
          quantity,
          app_signature,
          notes,
          device_mac_address,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_local')
        `,
        payload.familyUniqueCode,
        payload.memberId,
        payload.cycleCode,
        payload.mainOperator,
        payload.mainOperatorFDP,
        payload.subOperator,
        normalizedQuantity,
        appSignature,
        payload.notes,
        deviceMacAddress
      );
    } catch (error) {
      if (isDuplicateDistributionError(error)) {
        throw error;
      }

      if (error instanceof Error && error.message.toLowerCase().includes('unique')) {
        throw new Error(
          'Duplicate distribution blocked: this family has already received distribution for the selected cycle.'
        );
      }

      throw error;
    }

    return {
      id: asNumber(result.lastID)
    };
  }

  async function getOverviewSummary(): Promise<EligibleOverviewSummary> {
    const meta = await db.get<{
      fdpCode: string | null;
      fdpName: string | null;
      totalHouseholds: number;
      totalCycles: number;
      totalMembers: number;
      updatedAt: string | null;
    }>(
      `
      SELECT
        fdp_code as fdpCode,
        fdp_name as fdpName,
        total_households as totalHouseholds,
        total_cycles as totalCycles,
        total_members as totalMembers,
        updated_at as updatedAt
      FROM eligible_meta
      WHERE id = 1
      `
    );

    const pendingRow = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM distribution_queue WHERE status = 'pending_local'"
    );
    const pendingDistributionCount = asNumber(pendingRow?.count);

    const cycles = await db.all<EligibleCycleSummary[]>(
      `
      SELECT
        c.cycle_code as cycleCode,
        c.cycle_name as cycleName,
        c.assistance_package_name as assistancePackageName,
        c.start_date as startDate,
        c.end_date as endDate,
        c.household_count as householdCount
      FROM cycles c
      WHERE EXISTS (
        SELECT 1
        FROM distribution_list dl
        WHERE dl.cycle_code = c.cycle_code
      )
      ORDER BY c.cycle_code DESC
      LIMIT 2
      `
    );

    const hasData = (await hasEligibleData()) && Boolean(meta);
    return {
      hasData,
      fdpCode: meta?.fdpCode ?? null,
      fdpName: meta?.fdpName ?? null,
      totalCycles: asNumber(meta?.totalCycles),
      totalHouseholds: asNumber(meta?.totalHouseholds),
      totalMembers: asNumber(meta?.totalMembers),
      pendingDistributionCount,
      lastSynchronizedAt: meta?.updatedAt ?? null,
      cycles: (cycles ?? []) as unknown as EligibleCycleSummary[]
    };
  }

  async function getDistributionReport(): Promise<DistributionReportItem[]> {
    const profile = await getUserProfileContext();

    const syncedRows = await db.all<DistributionReportDbRow[]>(
      `
      SELECT
        'synced' as sourceType,
        COALESCE(sdh.distribution_id, sdh.rowid) as transactionId,
        NULL as localDistributionId,
        sdh.family_unique_code as familyUniqueCode,
        m.member_id as memberId,
        CAST(sdh.family_unique_code AS TEXT) as hhid,
        (SELECT COUNT(*) FROM members m2 WHERE m2.family_unique_code = sdh.family_unique_code) as hhMembers,
        f.created_date as hhRegistrationDate,
        m.date_of_birth as dateOfBirth,
        COALESCE(sdh.distribution_time, sdh.updated_at) as timestamp,
        f.address as hhSubdistrict,
        sdh.cycle_code as cycleCode,
        c.cycle_name as cycleName,
        COALESCE(
          (
            SELECT GROUP_CONCAT(en_name, ', ')
            FROM (
              SELECT fb.en_name
              FROM cycle_food_baskets fb
              WHERE fb.cycle_code = sdh.cycle_code
              ORDER BY fb.basket_id ASC
            )
          ),
          ''
        ) as foodBasket,
        COALESCE(dl.quantity, '1') as quantity,
        COALESCE(sdh.collected_by_first_name, m.first_name) as collectedByFirstName,
        COALESCE(sdh.collected_by_last_name, m.last_name) as collectedByLastName,
        COALESCE(sdh.collected_by_father_name, m.father_name) as collectedByFatherName,
        COALESCE(sdh.collected_by_document, m.document_number) as collectedByNationalId,
        COALESCE(sdh.operator, '') as operator,
        COALESCE(sdh.notes, '') as remarks,
        COALESCE(sdh.sourcefile, '') as sourcefile
      FROM synced_distribution_history sdh
      LEFT JOIN families f ON f.family_unique_code = sdh.family_unique_code
      LEFT JOIN cycles c ON c.cycle_code = sdh.cycle_code
      LEFT JOIN distribution_list dl
        ON dl.family_unique_code = sdh.family_unique_code
       AND dl.cycle_code = sdh.cycle_code
      LEFT JOIN members m
        ON m.family_unique_code = sdh.family_unique_code
       AND LOWER(TRIM(m.document_number)) = LOWER(TRIM(COALESCE(sdh.collected_by_document, '')))
      ORDER BY sdh.family_unique_code ASC, sdh.cycle_code ASC, COALESCE(sdh.distribution_time, sdh.updated_at) ASC
      `
    );

    const localRows = await db.all<DistributionReportDbRow[]>(
      `
      SELECT
        'local' as sourceType,
        NULL as transactionId,
        dq.id as localDistributionId,
        dq.family_unique_code as familyUniqueCode,
        dq.member_id as memberId,
        CAST(dq.family_unique_code AS TEXT) as hhid,
        (SELECT COUNT(*) FROM members m2 WHERE m2.family_unique_code = dq.family_unique_code) as hhMembers,
        f.created_date as hhRegistrationDate,
        m.date_of_birth as dateOfBirth,
        dq.created_at as timestamp,
        f.address as hhSubdistrict,
        dq.cycle_code as cycleCode,
        c.cycle_name as cycleName,
        COALESCE(
          (
            SELECT GROUP_CONCAT(en_name, ', ')
            FROM (
              SELECT fb.en_name
              FROM cycle_food_baskets fb
              WHERE fb.cycle_code = dq.cycle_code
              ORDER BY fb.basket_id ASC
            )
          ),
          ''
        ) as foodBasket,
        COALESCE(dl.quantity, CAST(dq.quantity AS TEXT), '1') as quantity,
        m.first_name as collectedByFirstName,
        m.last_name as collectedByLastName,
        m.father_name as collectedByFatherName,
        m.document_number as collectedByNationalId,
        COALESCE(NULLIF(TRIM(dq.sub_operator), ''), '') as operator,
        COALESCE(dq.notes, '') as remarks,
        '' as sourcefile
      FROM distribution_queue dq
      LEFT JOIN families f ON f.family_unique_code = dq.family_unique_code
      LEFT JOIN cycles c ON c.cycle_code = dq.cycle_code
      LEFT JOIN distribution_list dl
        ON dl.family_unique_code = dq.family_unique_code
       AND dl.cycle_code = dq.cycle_code
      LEFT JOIN members m ON m.member_id = dq.member_id
      ORDER BY dq.created_at ASC, dq.id ASC
      `
    );

    const rows = [...syncedRows, ...localRows];
    return rows
      .map((row) => {
      const transactionId =
        row.sourceType === 'synced'
          ? row.transactionId === null
            ? ''
            : String(row.transactionId)
          : buildReceiptId({
              fdpCode: profile.fdp,
              householdId: row.familyUniqueCode,
              sequence: row.localDistributionId
            });

      const hhRegistrationDate = asText(row.hhRegistrationDate).trim();
      const collectedByName = formatFullName(row.collectedByFirstName, row.collectedByLastName);
      const collectedByNationalId = asText(row.collectedByNationalId).trim();

      return {
        transactionId,
        hhid: row.hhid ?? String(row.familyUniqueCode),
        hhMembers: asNumber(row.hhMembers),
        hhRegistrationDate: hhRegistrationDate ? formatDate(hhRegistrationDate, hhRegistrationDate) : '',
        ageGroup: getAgeGroupLabel(row.dateOfBirth),
        timestamp: asText(row.timestamp).trim(),
        hhSubdistrict: asText(row.hhSubdistrict).trim(),
        cycleCode: String(asNumber(row.cycleCode)),
        cycleName: asText(row.cycleName).trim(),
        foodBasket: asText(row.foodBasket).trim(),
        quantity: asText(row.quantity).trim() || '1',
        partnerEnName: profile.corporatePartner,
        fdpEnName: profile.fieldOffice,
        fdpCode: profile.fdp,
        collectedByName,
        collectedByNationalId,
        operator: asText(row.operator).trim(),
        remarks: asText(row.remarks).trim(),
        sourcefile: asText(row.sourcefile).trim()
      };
      })
      .sort((left, right) => {
        const hhidComparison = left.hhid.localeCompare(right.hhid, 'en', { numeric: true });
        if (hhidComparison !== 0) {
          return hhidComparison;
        }

        const timestampComparison = left.timestamp.localeCompare(right.timestamp);
        if (timestampComparison !== 0) {
          return timestampComparison;
        }

        return left.cycleCode.localeCompare(right.cycleCode, 'en', { numeric: true });
      });
  }

  async function getUndistributedHouseholdReport(): Promise<UndistributedHouseholdReportItem[]> {
    const rows = await db.all<UndistributedHouseholdReportRow[]>(
      `
      WITH family_cycles AS (
        SELECT
          family_unique_code as familyUniqueCode,
          GROUP_CONCAT(cycle_code, ', ') as cycleCode
        FROM (
          SELECT DISTINCT
            family_unique_code,
            cycle_code
          FROM distribution_list
          ORDER BY family_unique_code ASC, cycle_code ASC
        )
        GROUP BY family_unique_code
      ),
      profile AS (
        SELECT
          corporate_partner as cpEnName,
          field_office as fdpEnName
        FROM "user"
        ORDER BY user_id DESC
        LIMIT 1
      )
      SELECT
        f.family_unique_code as householdId,
        f.principle_mobile as principalPhoneNo,
        f.address as hhSubdistrict,
        fc.cycleCode as cycleCode,
        COALESCE(profile.cpEnName, '') as cpEnName,
        COALESCE(profile.fdpEnName, '') as fdpEnName
      FROM families f
      LEFT JOIN family_cycles fc ON fc.familyUniqueCode = f.family_unique_code
      LEFT JOIN profile ON 1 = 1
      WHERE NOT EXISTS (
        SELECT 1
        FROM synced_distribution_history sdh
        WHERE sdh.family_unique_code = f.family_unique_code
      )
      AND NOT EXISTS (
        SELECT 1
        FROM distribution_queue dq
        WHERE dq.family_unique_code = f.family_unique_code
      )
      AND NOT EXISTS (
        SELECT 1
        FROM client_distribution_history cdh
        WHERE cdh.family_unique_code = f.family_unique_code
      )
      ORDER BY f.family_unique_code ASC
      `
    );

    return (rows ?? []).map((row) => ({
      householdId: String(asNumber(row.householdId)),
      principalPhoneNo: asText(row.principalPhoneNo).trim(),
      hhSubdistrict: asText(row.hhSubdistrict).trim(),
      cycleCode: asText(row.cycleCode).trim(),
      cpEnName: asText(row.cpEnName).trim(),
      fdpEnName: asText(row.fdpEnName).trim()
    }));
  }

  async function getDistributionQueue(): Promise<DistributionQueueItem[]> {
    const rows = await db.all<
      Array<{
        id: number;
        familyUniqueCode: number;
        memberId: number;
        cycleCode: number;
        mainOperator: number;
        mainOperatorFDP: string;
        subOperator: string | null;
        quantity: number;
        appSignature: string;
        notes: string | null;
        deviceMacAddress: string;
        status: string;
        createdAt: string;
      }>
    >(
      `
      SELECT
        id as id,
        family_unique_code as familyUniqueCode,
        member_id as memberId,
        cycle_code as cycleCode,
        main_operator as mainOperator,
        main_operator_fdp as mainOperatorFDP,
        sub_operator as subOperator,
        quantity as quantity,
        app_signature as appSignature,
        notes as notes,
        device_mac_address as deviceMacAddress,
        status as status,
        created_at as createdAt
      FROM distribution_queue
      ORDER BY created_at ASC, id ASC
      `
    );

    return (rows ?? []) as DistributionQueueItem[];
  }

  async function getFamilyDistributionHistory(
    familyUniqueCode: number
  ): Promise<FamilyDistributionHistoryItem[]> {
    if (!Number.isFinite(familyUniqueCode)) {
      return [];
    }

    const rows = await db.all<
      Array<{
        id: number;
        familyUniqueCode: number;
        memberId: number;
        collectedByDocument: string | null;
        collectedByFirstName: string | null;
        collectedByLastName: string | null;
        collectedByFatherName: string | null;
        cycleCode: number;
        cycleName: string | null;
        quantity: number;
        subOperator: string | null;
        status: string;
        appSignature: string;
        notes: string | null;
        createdAt: string;
      }>
    >(
      `
      SELECT
        history.id as id,
        history.familyUniqueCode as familyUniqueCode,
        history.memberId as memberId,
        history.collectedByDocument as collectedByDocument,
        history.collectedByFirstName as collectedByFirstName,
        history.collectedByLastName as collectedByLastName,
        history.collectedByFatherName as collectedByFatherName,
        history.cycleCode as cycleCode,
        history.cycleName as cycleName,
        history.quantity as quantity,
        history.subOperator as subOperator,
        history.status as status,
        history.appSignature as appSignature,
        history.notes as notes,
        history.createdAt as createdAt
      FROM (
        SELECT
          dq.id as id,
          dq.family_unique_code as familyUniqueCode,
          dq.member_id as memberId,
          m.document_number as collectedByDocument,
          m.first_name as collectedByFirstName,
          m.last_name as collectedByLastName,
          m.father_name as collectedByFatherName,
          dq.cycle_code as cycleCode,
          c.cycle_name as cycleName,
          dq.quantity as quantity,
          dq.sub_operator as subOperator,
          dq.status as status,
          dq.app_signature as appSignature,
          dq.notes as notes,
          dq.created_at as createdAt
        FROM distribution_queue dq
        LEFT JOIN cycles c ON c.cycle_code = dq.cycle_code
        LEFT JOIN members m ON m.member_id = dq.member_id
        WHERE dq.family_unique_code = ?

        UNION ALL

        SELECT
          COALESCE(sdh.distribution_id, sdh.rowid) as id,
          sdh.family_unique_code as familyUniqueCode,
          COALESCE(m.member_id, 0) as memberId,
          sdh.collected_by_document as collectedByDocument,
          COALESCE(m.first_name, sdh.collected_by_first_name) as collectedByFirstName,
          COALESCE(m.last_name, sdh.collected_by_last_name) as collectedByLastName,
          COALESCE(m.father_name, sdh.collected_by_father_name) as collectedByFatherName,
          sdh.cycle_code as cycleCode,
          c.cycle_name as cycleName,
          1 as quantity,
          NULL as subOperator,
          'synced_remote' as status,
          sdh.app_signature as appSignature,
          sdh.notes as notes,
          COALESCE(sdh.distribution_time, sdh.updated_at) as createdAt
        FROM synced_distribution_history sdh
        LEFT JOIN cycles c ON c.cycle_code = sdh.cycle_code
        LEFT JOIN members m
          ON m.family_unique_code = sdh.family_unique_code
         AND LOWER(TRIM(m.document_number)) = LOWER(TRIM(sdh.collected_by_document))
        WHERE sdh.family_unique_code = ?
      ) history
      ORDER BY history.createdAt DESC, history.id DESC
      `,
      familyUniqueCode,
      familyUniqueCode
    );

    return (rows ?? []).map((row) => ({
      id: asNumber(row.id),
      familyUniqueCode: asNumber(row.familyUniqueCode),
      memberId: asNumber(row.memberId),
      collectedByDocument: asNullableText(row.collectedByDocument),
      collectedByFirstName: asNullableText(row.collectedByFirstName),
      collectedByLastName: asNullableText(row.collectedByLastName),
      collectedByFatherName: asNullableText(row.collectedByFatherName),
      cycleCode: asNumber(row.cycleCode),
      cycleName: asText(row.cycleName, `Cycle ${row.cycleCode}`),
      quantity: normalizeQuantity(row.quantity),
      subOperator: asNullableText(row.subOperator),
      status: asText(row.status),
      appSignature: asText(row.appSignature),
      notes: asNullableText(row.notes),
      createdAt: asText(row.createdAt)
    }));
  }

  async function deleteDistributionQueueItems(ids: number[]): Promise<{ deleted: number }> {
    const normalizedIds = ids.filter((value) => Number.isInteger(value) && value > 0);
    if (normalizedIds.length === 0) {
      return { deleted: 0 };
    }

    const placeholders = normalizedIds.map(() => '?').join(', ');
    const result = await db.run(
      `DELETE FROM distribution_queue WHERE id IN (${placeholders})`,
      ...normalizedIds
    );
    return { deleted: asNumber(result.changes) };
  }

  async function getOperationsAggregates(
    query: OperationsDashboardQuery
  ): Promise<{
    totalDistributions: number;
    cycleProgress: Array<{
      cycleCode: number;
      cycleName: string;
      totalHouseholds: number;
      distributedCount: number;
    }>;
    overviewBars: Array<{
      alias: string;
      distributedCount: number;
    }>;
    clientCycleCounts: Array<{
      alias: string;
      cycleCode: number;
      distributedCount: number;
    }>;
    distributions: {
      items: Array<{
        id: number;
        subOperator: string;
        familyUniqueCode: number;
        documentNumber: string | null;
        date: string;
        cycleCode: number;
        cycleName: string;
        status: string;
        createdAt: string;
      }>;
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }> {
    const pagination = normalizeClientHistoryPagination(query.page, query.pageSize);
    const safePage = pagination.page;
    const safePageSize = pagination.pageSize;
    const search = query.search.trim().toLowerCase();
    const offset = pagination.offset;

    const searchPattern = `%${search}%`;
    const hasSearch = search.length > 0;

    const distributionFilterClause = hasSearch
      ? `WHERE (
          LOWER(COALESCE(NULLIF(TRIM(dq.sub_operator), ''), NULLIF(TRIM(u.email), ''), 'server')) LIKE ?
          OR CAST(dq.family_unique_code AS TEXT) LIKE ?
          OR LOWER(COALESCE(m.document_number, '')) LIKE ?
        )`
      : '';
    const tableFilterClause =
      hasSearch
        ? "WHERE (LOWER(COALESCE(NULLIF(TRIM(dq.sub_operator), ''), NULLIF(TRIM(u.email), ''), 'server')) LIKE ? OR CAST(dq.family_unique_code AS TEXT) LIKE ? OR LOWER(COALESCE(m.document_number, '')) LIKE ?)"
        : '';

    const params: unknown[] = [];
    if (hasSearch) {
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const totalRow = await db.get<{ count: number }>(
      `
      SELECT COUNT(*) as count
      FROM distribution_queue dq
      LEFT JOIN members m ON m.member_id = dq.member_id
      LEFT JOIN "user" u ON u.user_id = dq.main_operator
      ${distributionFilterClause}
      `,
      ...params
    );
    const totalDistributions = asNumber(totalRow?.count);

    const tableTotalRow = await db.get<{ count: number }>(
      `
      SELECT COUNT(*) as count
      FROM distribution_queue dq
      LEFT JOIN "user" u ON u.user_id = dq.main_operator
      LEFT JOIN members m ON m.member_id = dq.member_id
      ${tableFilterClause}
      `,
      ...params
    );
    const totalTableDistributions = asNumber(tableTotalRow?.count);

    const cycleRows = await db.all<
      Array<{
        cycleCode: number;
        cycleName: string;
        totalHouseholds: number;
      }>
    >(
      `
      SELECT
        c.cycle_code as cycleCode,
        c.cycle_name as cycleName,
        c.household_count as totalHouseholds
      FROM cycles c
      ORDER BY c.cycle_code DESC
      `
    );

    const cycleDistRows = await db.all<Array<{ cycleCode: number; distributedCount: number }>>(
      `
      SELECT
        dq.cycle_code as cycleCode,
        COUNT(*) as distributedCount
      FROM distribution_queue dq
      GROUP BY dq.cycle_code
      `
    );
    const distByCycle = new Map<number, number>();
    for (const row of cycleDistRows ?? []) {
      distByCycle.set(asNumber(row.cycleCode), asNumber(row.distributedCount));
    }

    const cycleProgress = (cycleRows ?? []).map((cycle) => ({
      cycleCode: asNumber(cycle.cycleCode),
      cycleName: asText(cycle.cycleName, `Cycle ${cycle.cycleCode}`),
      totalHouseholds: asNumber(cycle.totalHouseholds),
      distributedCount: asNumber(distByCycle.get(asNumber(cycle.cycleCode)))
    }));

    const overviewRows = await db.all<Array<{ alias: string; distributedCount: number }>>(
      `
      SELECT
        COALESCE(NULLIF(TRIM(dq.sub_operator), ''), NULLIF(TRIM(u.email), ''), 'SERVER') as alias,
        COUNT(*) as distributedCount
      FROM distribution_queue dq
      LEFT JOIN "user" u ON u.user_id = dq.main_operator
      GROUP BY alias
      ORDER BY distributedCount DESC, alias ASC
      `
    );
    const overviewBars = (overviewRows ?? []).map((row) => ({
      alias: asText(row.alias, 'Unknown'),
      distributedCount: asNumber(row.distributedCount)
    }));

    const clientCycleRows = await db.all<
      Array<{ alias: string; cycleCode: number; distributedCount: number }>
    >(
      `
      SELECT
        COALESCE(NULLIF(TRIM(dq.sub_operator), ''), NULLIF(TRIM(u.email), ''), 'SERVER') as alias,
        dq.cycle_code as cycleCode,
        COUNT(*) as distributedCount
      FROM distribution_queue dq
      LEFT JOIN "user" u ON u.user_id = dq.main_operator
      GROUP BY alias, dq.cycle_code
      ORDER BY alias ASC, dq.cycle_code DESC
      `
    );
    const clientCycleCounts = (clientCycleRows ?? []).map((row) => ({
      alias: asText(row.alias, 'Unknown'),
      cycleCode: asNumber(row.cycleCode),
      distributedCount: asNumber(row.distributedCount)
    }));

    const itemRows = await db.all<
      Array<{
        id: number;
        subOperator: string | null;
        operatorEmail: string | null;
        familyUniqueCode: number;
        documentNumber: string | null;
        cycleCode: number;
        cycleName: string | null;
        notes: string | null;
        status: string;
        createdAt: string;
      }>
    >(
      `
      SELECT
        dq.id as id,
        dq.sub_operator as subOperator,
        u.email as operatorEmail,
        dq.family_unique_code as familyUniqueCode,
        m.document_number as documentNumber,
        dq.cycle_code as cycleCode,
        c.cycle_name as cycleName,
        dq.notes as notes,
        dq.status as status,
        dq.created_at as createdAt
      FROM distribution_queue dq
      LEFT JOIN cycles c ON c.cycle_code = dq.cycle_code
      LEFT JOIN "user" u ON u.user_id = dq.main_operator
      LEFT JOIN members m ON m.member_id = dq.member_id
      ${tableFilterClause}
      ORDER BY dq.created_at DESC, dq.id DESC
      LIMIT ? OFFSET ?
      `,
      ...params,
      safePageSize,
      offset
    );

    const items = (itemRows ?? []).map((row) => {
      const created = new Date(asText(row.createdAt));
      const date = Number.isNaN(created.getTime())
        ? 'N/A'
        : created.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
      const time = Number.isNaN(created.getTime())
        ? 'N/A'
        : created.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });

      return {
        id: asNumber(row.id),
        subOperator:
          asText(row.subOperator).trim() || asText(row.operatorEmail).trim() || 'SERVER',
        familyUniqueCode: asNumber(row.familyUniqueCode),
        documentNumber: asNullableText(row.documentNumber),
        date: `${date} ${time}`,
        notes: asNullableText(row.notes),
        cycleCode: asNumber(row.cycleCode),
        cycleName: asText(row.cycleName, `Cycle ${row.cycleCode}`),
        status: asText(row.status, 'pending_local'),
        createdAt: asText(row.createdAt)
      };
    });

    return {
      totalDistributions,
      cycleProgress,
      overviewBars,
      clientCycleCounts,
      distributions: {
        items,
        total: totalTableDistributions,
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.max(1, Math.ceil(totalTableDistributions / safePageSize))
      }
    };
  }

  async function saveClientDistribution(
    payload: ClientDistributionInput
  ): Promise<{ id: number }> {
    const subOperator = payload.subOperator.trim();
    if (!subOperator || subOperator.length > 128) {
      throw new Error('Invalid subOperator. It must be between 1 and 128 characters.');
    }
    if (!Number.isFinite(payload.memberId)) {
      throw new Error('Invalid memberId for client distribution event.');
    }
    if (!Number.isFinite(payload.cycleCode)) {
      throw new Error('Invalid cycleCode for client distribution event.');
    }

    const deviceMacAddress = payload.deviceMacAddress.trim() || getDeviceMacAddress() || '';

    const familyRow = await db.get<{ familyUniqueCode: number }>(
      `
      SELECT
        m.family_unique_code as familyUniqueCode
      FROM members m
      WHERE m.member_id = ?
      LIMIT 1
      `,
      payload.memberId
    );

    const familyUniqueCode = asNullableNumber(familyRow?.familyUniqueCode);
    if (familyUniqueCode === null) {
      throw new Error('Member not found for the selected cycle.');
    }

    const duplicateRow = await db.get<{ count: number }>(
      `
      SELECT COUNT(*) as count
      FROM distribution_queue
      WHERE family_unique_code = ?
        AND cycle_code = ?
      `,
      familyUniqueCode,
      payload.cycleCode
    );

    if (asNumber(duplicateRow?.count) > 0) {
      throw new Error(
        'Duplicate distribution blocked: this family has already received distribution for the selected cycle.'
      );
    }

    const serverOperator = await getServerOperatorContext();
    const quantityRow = await db.get<{ quantity: string }>(
      `
      SELECT quantity
      FROM distribution_list
      WHERE family_unique_code = ?
        AND cycle_code = ?
      LIMIT 1
      `,
      familyUniqueCode,
      payload.cycleCode
    );
    const quantity = normalizeQuantity(quantityRow?.quantity);
    const distributionTimeIso = new Date().toISOString();
    const appSignature = buildDistributionAppSignature({
      familyUniqueCode,
      memberId: payload.memberId,
      cycleCode: payload.cycleCode,
      mainOperator: serverOperator.mainOperator,
      mainOperatorFDP: serverOperator.mainOperatorFDP,
      subOperator,
      quantity,
      notes: null,
      distributionTimeIso
    });

    const result = await db.run(
      `
      INSERT INTO distribution_queue (
        family_unique_code,
        member_id,
        cycle_code,
        main_operator,
        main_operator_fdp,
        sub_operator,
        quantity,
        app_signature,
        notes,
        device_mac_address,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_local')
      `,
      familyUniqueCode,
      payload.memberId,
      payload.cycleCode,
      serverOperator.mainOperator,
      serverOperator.mainOperatorFDP,
      subOperator,
      quantity,
      appSignature,
      null,
      deviceMacAddress
    );

    return {
      id: asNumber(result.lastID)
    };
  }

  async function saveClientDistributionHistory(
    payload: ClientDistributionHistoryInput
  ): Promise<{ id: number }> {
    const alias = payload.alias.trim();
    if (!alias || alias.length > 128) {
      throw new Error('Invalid alias for client distribution history.');
    }

    const host = payload.host.trim();
    if (!host) {
      throw new Error('Missing host for client distribution history.');
    }

    if (!Number.isFinite(payload.memberId) || !Number.isFinite(payload.familyUniqueCode)) {
      throw new Error('Invalid member or family identifier for client distribution history.');
    }
    if (!Number.isFinite(payload.cycleCode)) {
      throw new Error('Invalid cycle code for client distribution history.');
    }

    const cycleName = payload.cycleName.trim() || `Cycle ${payload.cycleCode}`;
    const collectedBy = payload.collectedBy.trim() || 'N/A';
    const collectedByDocument = payload.collectedByDocument?.trim() || null;
    const quantity = Number.isFinite(payload.quantity) && payload.quantity > 0
      ? Math.max(1, Math.round(payload.quantity))
      : 1;

    const result = await db.run(
      `
      INSERT INTO client_distribution_history (
        alias,
        host,
        member_id,
        family_unique_code,
        cycle_code,
        cycle_name,
        collected_by,
        collected_by_document,
        quantity,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      alias,
      host,
      payload.memberId,
      payload.familyUniqueCode,
      payload.cycleCode,
      cycleName,
      collectedBy,
      collectedByDocument,
      quantity,
      payload.notes?.trim() || null
    );

    return {
      id: asNumber(result.lastID)
    };
  }

  async function getClientDistributionHistory(
    query: ClientDistributionHistoryQuery
  ): Promise<ClientDistributionHistoryResult> {
    const alias = query.alias.trim();
    if (!alias) {
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1
      };
    }

    const pagination = normalizeClientHistoryPagination(query.page, query.pageSize);
    const safePage = pagination.page;
    const safePageSize = pagination.pageSize;
    const search = query.search.trim().toLowerCase();
    const offset = pagination.offset;
    const hasSearch = search.length > 0;
    const searchPattern = `%${search}%`;

    const totalRow = await db.get<{ count: number }>(
      `
      SELECT COUNT(*) as count
      FROM client_distribution_history
      WHERE alias = ?
      ${hasSearch ? 'AND (CAST(member_id AS TEXT) LIKE ? OR LOWER(cycle_name) LIKE ? OR LOWER(collected_by) LIKE ? OR LOWER(COALESCE(collected_by_document, \'\')) LIKE ?)' : ''}
      `,
      ...(hasSearch
        ? [alias, searchPattern, searchPattern, searchPattern, searchPattern]
        : [alias])
    );
    const total = asNumber(totalRow?.count);

    const rows = await db.all<
      Array<{
        id: number;
        alias: string;
        host: string;
        memberId: number;
        familyUniqueCode: number;
        cycleCode: number;
        cycleName: string;
        collectedBy: string;
        collectedByDocument: string | null;
        quantity: number;
        notes: string | null;
        createdAt: string;
      }>
    >(
      `
      SELECT
        id as id,
        alias as alias,
        host as host,
        member_id as memberId,
        family_unique_code as familyUniqueCode,
        cycle_code as cycleCode,
        cycle_name as cycleName,
        collected_by as collectedBy,
        collected_by_document as collectedByDocument,
        quantity as quantity,
        notes as notes,
        created_at as createdAt
      FROM client_distribution_history
      WHERE alias = ?
      ${hasSearch ? 'AND (CAST(member_id AS TEXT) LIKE ? OR LOWER(cycle_name) LIKE ? OR LOWER(collected_by) LIKE ? OR LOWER(COALESCE(collected_by_document, \'\')) LIKE ? OR LOWER(COALESCE(notes, \'\')) LIKE ?)' : ''}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
      `,
      ...(hasSearch
        ? [alias, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, safePageSize, offset]
        : [alias, safePageSize, offset])
    );

    const items: ClientDistributionHistoryItem[] = (rows ?? []).map((row) => ({
      id: asNumber(row.id),
      alias: asText(row.alias),
      host: asText(row.host),
      memberId: asNumber(row.memberId),
      familyUniqueCode: asNumber(row.familyUniqueCode),
      cycleCode: asNumber(row.cycleCode),
      cycleName: asText(row.cycleName),
      collectedBy: asText(row.collectedBy),
      collectedByDocument: asNullableText(row.collectedByDocument),
      quantity: normalizeQuantity(row.quantity),
      notes: asNullableText(row.notes),
      createdAt: asText(row.createdAt)
    }));

    return {
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.max(1, Math.ceil(total / safePageSize))
    };
  }

  async function clearDistributionQueue(): Promise<{ deleted: number }> {
    const countRow = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM distribution_queue');
    await db.run('DELETE FROM distribution_queue');
    return { deleted: asNumber(countRow?.count) };
  }

  async function getPendingDistributionCount(): Promise<number> {
    const row = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM distribution_queue WHERE status = 'pending_local'"
    );
    return asNumber(row?.count);
  }

  return {
    saveEligibleMembers,
    getDistributionReport,
    getUndistributedHouseholdReport,
    searchDistributionMember,
    getDistributionDetail,
    saveDistributionEvent,
    saveClientDistribution,
    saveClientDistributionHistory,
    getClientDistributionHistory,
    getDistributionQueue,
    getFamilyDistributionHistory,
    deleteDistributionQueueItems,
    getPendingDistributionCount,
    getOperationsAggregates,
    clearDistributionQueue,
    hasEligibleData,
    getOverviewSummary,
    clearEligibleData
  };
}
