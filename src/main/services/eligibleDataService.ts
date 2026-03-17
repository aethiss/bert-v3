import type { Database } from 'sqlite';
import type {
  ClientDistributionInput,
  ClientDistributionHistoryInput,
  ClientDistributionHistoryItem,
  ClientDistributionHistoryQuery,
  ClientDistributionHistoryResult,
  DistributionQueueItem,
  DistributionActiveCycle,
  DistributionDetailData,
  DistributionHouseholdInfo,
  DistributionHouseholdMember,
  DistributionSearchMember,
  DistributionSearchResult,
  EligibleCycleSummary,
  EligibleMembersApiResponse,
  EligibleOverviewSummary,
  LocalDistributionEventInput
} from '../../shared/types/eligible';
import type { OperationsDashboardQuery } from '../../shared/types/operations';

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
    cycleName: cycle.cycleName,
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
  searchDistributionMember(query: string): Promise<DistributionSearchResult | null>;
  getDistributionDetail(params: {
    memberId: number;
    cycleCode: number;
    familyHhId: string;
  }): Promise<DistributionDetailData | null>;
  saveDistributionEvent(payload: LocalDistributionEventInput): Promise<{ id: number }>;
  saveClientDistribution(payload: ClientDistributionInput): Promise<{ id: number }>;
  saveClientDistributionHistory(payload: ClientDistributionHistoryInput): Promise<{ id: number }>;
  getClientDistributionHistory(
    query: ClientDistributionHistoryQuery
  ): Promise<ClientDistributionHistoryResult>;
  getDistributionQueue(): Promise<DistributionQueueItem[]>;
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
        memberId: number;
        date: string;
        time: string;
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

interface DistributionMemberRow extends DistributionSearchMember {
  cycleCode: number;
  familyHhId: string;
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
}

interface DistributionHouseholdMemberRow {
  memberId: number;
  cycleCode: number;
  firstName: string | null;
  lastName: string | null;
  documentNumber: string | null;
  dateOfBirth: string | null;
  role: string | null;
}

interface DistributionHouseholdInfoRow {
  familyUniqueCode: number;
  familyHhId: string;
  cycleCode: number;
  quantity: string;
  children623: number;
  updatedAt: string | null;
}

interface DistributionPrincipleRow {
  firstName: string | null;
  lastName: string | null;
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

  async function clearEligibleData(): Promise<void> {
    await db.exec('BEGIN TRANSACTION');
    try {
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
      await db.run('DELETE FROM members');
      await db.run('DELETE FROM families');
      await db.run('DELETE FROM cycles');
      await db.run('DELETE FROM eligible_meta');

      let skippedCycles = 0;
      let skippedFamilies = 0;
      let skippedMembers = 0;

      for (const cycle of payload.cycles ?? []) {
        const cycleCode = asNullableNumber(cycle.cycleCode);
        if (cycleCode === null) {
          skippedCycles += 1;
          continue;
        }

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
          asText(cycle.cycleName),
          asText(cycle.assistancePackageName),
          asText(cycle.startDate),
          asText(cycle.endDate),
          asNullableText(cycle.cycleNote),
          asNullableText(cycle.cooperatingPartner),
          asNullableText(cycle.fieldDistributionPoint),
          asNumber(cycle.household_count)
        );

        for (const household of cycle.households ?? []) {
          const householdCycleCode = asNullableNumber(household.cycleCode) ?? cycleCode;
          const householdId = asText(household.hhId);
          if (householdCycleCode === null || householdId.length === 0) {
            skippedFamilies += 1;
            continue;
          }

          await db.run(
            `
            INSERT INTO families (
              hh_id, cycle_code, assigned_status, household_size, quantity, assistance_package_name,
              cooperating_partner, fdp_id, fdp_name, children_6_23_months, family_unique_code,
              address, status, eligible
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(hh_id, cycle_code) DO UPDATE SET
              cycle_code = excluded.cycle_code,
              assigned_status = excluded.assigned_status,
              household_size = excluded.household_size,
              quantity = excluded.quantity,
              assistance_package_name = excluded.assistance_package_name,
              cooperating_partner = excluded.cooperating_partner,
              fdp_id = excluded.fdp_id,
              fdp_name = excluded.fdp_name,
              children_6_23_months = excluded.children_6_23_months,
              family_unique_code = excluded.family_unique_code,
              address = excluded.address,
              status = excluded.status,
              eligible = excluded.eligible,
              updated_at = CURRENT_TIMESTAMP
            `,
            householdId,
            householdCycleCode,
            asText(household.assignedStatus),
            asText(household.householdSize),
            asText(household.quantity),
            asText(household.assistancePackageName),
            asNullableText(household.cooperatingPartner),
            asText(household.fdp_id),
            asText(household.fdp_name),
            asNumber(household.Number_of_Children_between_6_and_23_Months),
            asNumber(household.FamilyUniqueCode),
            asNullableText(household.address),
            asText(household.status),
            household.eligible ? 1 : 0
          );

          for (const member of household.members ?? []) {
            const memberId = asNullableNumber(member.id);
            const memberCycleCode =
              asNullableNumber(member.cycleCode) ?? householdCycleCode ?? cycleCode;
            if (memberId === null || memberCycleCode === null) {
              skippedMembers += 1;
              continue;
            }

            await db.run(
              `
              INSERT INTO members (
                member_id, cycle_code, family_hh_id, role, first_name, last_name,
                father_name, mother_name, mother_last_name, city_of_birth,
                date_of_birth, document_number, status
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(member_id, cycle_code) DO UPDATE SET
                family_hh_id = excluded.family_hh_id,
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
              memberCycleCode,
              householdId,
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
      if (skippedCycles > 0 || skippedFamilies > 0 || skippedMembers > 0) {
        console.warn(
          `[eligibleData] Skipped invalid records during sync: cycles=${skippedCycles}, families=${skippedFamilies}, members=${skippedMembers}`
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
            f.family_unique_code as familyUniqueCode,
            m.cycle_code as cycleCode,
            m.family_hh_id as familyHhId,
            m.first_name as firstName,
            m.last_name as lastName
          FROM members m
          INNER JOIN families f
            ON f.hh_id = m.family_hh_id
            AND f.cycle_code = m.cycle_code
          WHERE f.family_unique_code = ?
            AND m.cycle_code = (
              SELECT MAX(m2.cycle_code)
              FROM members m2
              INNER JOIN families f2
                ON f2.hh_id = m2.family_hh_id
                AND f2.cycle_code = m2.cycle_code
              WHERE f2.family_unique_code = ?
            )
          ORDER BY m.member_id ASC
          `,
          familyUniqueCode,
          familyUniqueCode
        );

        const preferredFamilyMember = pickPreferredDistributionMember(familyRows ?? []);
        if (preferredFamilyMember) {
          return {
            match: 'familyUniqueCode',
            member: {
              id: preferredFamilyMember.id,
              cycleCode: preferredFamilyMember.cycleCode,
              familyHhId: preferredFamilyMember.familyHhId,
              fullName: toDisplayName(
                preferredFamilyMember.firstName,
                preferredFamilyMember.lastName
              ),
              role: preferredFamilyMember.role,
              documentNumber: preferredFamilyMember.documentNumber,
              familyUniqueCode: preferredFamilyMember.familyUniqueCode
            }
          };
        }
      }
    }

    const memberByDocument = await db.get<DistributionMemberRow>(
      `
      SELECT
        m.member_id as id,
        m.role as role,
        m.document_number as documentNumber,
        f.family_unique_code as familyUniqueCode,
        m.cycle_code as cycleCode,
        m.family_hh_id as familyHhId,
        m.first_name as firstName,
        m.last_name as lastName
      FROM members m
      INNER JOIN families f
        ON f.hh_id = m.family_hh_id
        AND f.cycle_code = m.cycle_code
      WHERE LOWER(TRIM(m.document_number)) = LOWER(TRIM(?))
      ORDER BY m.cycle_code DESC, m.member_id ASC
      LIMIT 1
      `,
      normalizedQuery
    );

    if (!memberByDocument) {
      return null;
    }

    return {
      match: 'documentNumber',
      member: {
        id: memberByDocument.id,
        cycleCode: memberByDocument.cycleCode,
        familyHhId: memberByDocument.familyHhId,
        fullName: toDisplayName(memberByDocument.firstName, memberByDocument.lastName),
        role: memberByDocument.role,
        documentNumber: memberByDocument.documentNumber,
        familyUniqueCode: memberByDocument.familyUniqueCode
      }
    };
  }

  async function getDistributionDetail(params: {
    memberId: number;
    cycleCode: number;
    familyHhId: string;
  }): Promise<DistributionDetailData | null> {
    if (!params.memberId || !params.cycleCode || !params.familyHhId) {
      return null;
    }

    const householdRow = await db.get<DistributionHouseholdInfoRow>(
      `
      SELECT
        family_unique_code as familyUniqueCode,
        hh_id as familyHhId,
        cycle_code as cycleCode,
        quantity as quantity,
        children_6_23_months as children623,
        updated_at as updatedAt
      FROM families
      WHERE hh_id = ? AND cycle_code = ?
      LIMIT 1
      `,
      params.familyHhId,
      params.cycleCode
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
      WHERE family_hh_id = ?
        AND cycle_code = ?
        AND (LOWER(TRIM(role)) = 'principle' OR LOWER(TRIM(role)) = 'principal')
      ORDER BY member_id ASC
      LIMIT 1
      `,
      householdRow.familyHhId,
      householdRow.cycleCode
    );

    const fallbackMember = await db.get<DistributionHouseholdMemberRow>(
      `
      SELECT
        member_id as memberId,
        cycle_code as cycleCode,
        first_name as firstName,
        last_name as lastName,
        document_number as documentNumber,
        date_of_birth as dateOfBirth,
        role as role
      FROM members
      WHERE family_hh_id = ?
        AND cycle_code = ?
      ORDER BY member_id ASC
      LIMIT 1
      `,
      householdRow.familyHhId,
      householdRow.cycleCode
    );

    const activeCycleRows = await db.all<DistributionActiveCycleRow[]>(
      `
      SELECT
        c.cycle_code as cycleCode,
        c.cycle_name as cycleName,
        c.assistance_package_name as assistanceType,
        f.quantity as quantity,
        c.start_date as startDate,
        c.end_date as endDate
      FROM families f
      INNER JOIN cycles c ON c.cycle_code = f.cycle_code
      WHERE f.family_unique_code = ?
      ORDER BY c.cycle_code DESC
      `,
      householdRow.familyUniqueCode
    );

    const memberRows = await db.all<DistributionHouseholdMemberRow[]>(
      `
      SELECT
        m.member_id as memberId,
        m.cycle_code as cycleCode,
        m.first_name as firstName,
        m.last_name as lastName,
        m.document_number as documentNumber,
        m.date_of_birth as dateOfBirth,
        m.role as role
      FROM members m
      INNER JOIN families f ON f.hh_id = m.family_hh_id AND f.cycle_code = m.cycle_code
      WHERE f.family_unique_code = ?
      ORDER BY m.cycle_code DESC, m.member_id ASC
      `,
      householdRow.familyUniqueCode
    );

    const household: DistributionHouseholdInfo = {
      familyUniqueCode: householdRow.familyUniqueCode,
      familyHhId: householdRow.familyHhId,
      cycleCode: householdRow.cycleCode,
      idmId: String(params.memberId),
      booklet: String(householdRow.familyUniqueCode),
      principle: toDisplayName(
        principleRow?.firstName ?? fallbackMember?.firstName ?? null,
        principleRow?.lastName ?? fallbackMember?.lastName ?? null
      ),
      phone: 'N/A',
      registrationDate: formatDate(householdRow.updatedAt, '26-Jan-2025'),
      pbwgs: householdRow.quantity || '1',
      children623: asNumber(householdRow.children623),
    };

    const activeCycles: DistributionActiveCycle[] = activeCycleRows.map((row) => ({
      cycleCode: row.cycleCode,
      cycleName: row.cycleName,
      assistanceType: row.assistanceType,
      quantity: row.quantity,
      startDate: formatDate(row.startDate, '01-Jan-2026'),
      endDate: formatDate(row.endDate, '31-Jan-2026')
    }));

    const members: DistributionHouseholdMember[] = memberRows.map((row) => ({
      memberId: row.memberId,
      cycleCode: row.cycleCode,
      fullName: toDisplayName(row.firstName, row.lastName),
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
          app_signature,
          notes,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_local')
        `,
        payload.familyUniqueCode,
        payload.memberId,
        payload.cycleCode,
        payload.mainOperator,
        payload.mainOperatorFDP,
        payload.subOperator,
        payload.appSignature,
        payload.notes
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
        cycle_code as cycleCode,
        cycle_name as cycleName,
        assistance_package_name as assistancePackageName,
        start_date as startDate,
        end_date as endDate,
        household_count as householdCount
      FROM cycles
      ORDER BY cycle_code DESC
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
        appSignature: string;
        notes: string | null;
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
        app_signature as appSignature,
        notes as notes,
        status as status,
        created_at as createdAt
      FROM distribution_queue
      ORDER BY created_at ASC, id ASC
      `
    );

    return (rows ?? []) as DistributionQueueItem[];
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
        memberId: number;
        date: string;
        time: string;
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

    const clientOnlyClause = `TRIM(COALESCE(dq.sub_operator, '')) <> ''`;
    const filterClause =
      hasSearch
        ? `WHERE ${clientOnlyClause} AND (LOWER(COALESCE(dq.sub_operator, '')) LIKE ? OR CAST(dq.member_id AS TEXT) LIKE ?)`
        : `WHERE ${clientOnlyClause}`;

    const params: unknown[] = [];
    if (hasSearch) {
      params.push(searchPattern, searchPattern);
    }

    const totalRow = await db.get<{ count: number }>(
      `
      SELECT COUNT(*) as count
      FROM distribution_queue dq
      ${filterClause}
      `,
      ...params
    );
    const totalDistributions = asNumber(totalRow?.count);

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
      WHERE TRIM(COALESCE(dq.sub_operator, '')) <> ''
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
        COALESCE(NULLIF(TRIM(dq.sub_operator), ''), 'Unknown') as alias,
        COUNT(*) as distributedCount
      FROM distribution_queue dq
      WHERE TRIM(COALESCE(dq.sub_operator, '')) <> ''
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
        COALESCE(NULLIF(TRIM(dq.sub_operator), ''), 'Unknown') as alias,
        dq.cycle_code as cycleCode,
        COUNT(*) as distributedCount
      FROM distribution_queue dq
      WHERE TRIM(COALESCE(dq.sub_operator, '')) <> ''
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
        memberId: number;
        cycleCode: number;
        cycleName: string | null;
        status: string;
        createdAt: string;
      }>
    >(
      `
      SELECT
        dq.id as id,
        dq.sub_operator as subOperator,
        dq.member_id as memberId,
        dq.cycle_code as cycleCode,
        c.cycle_name as cycleName,
        dq.status as status,
        dq.created_at as createdAt
      FROM distribution_queue dq
      LEFT JOIN cycles c ON c.cycle_code = dq.cycle_code
      ${filterClause}
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
        subOperator: asText(row.subOperator, 'Unknown'),
        memberId: asNumber(row.memberId),
        date,
        time,
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
        total: totalDistributions,
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.max(1, Math.ceil(totalDistributions / safePageSize))
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

    const familyRow = await db.get<{ familyUniqueCode: number }>(
      `
      SELECT
        f.family_unique_code as familyUniqueCode
      FROM members m
      INNER JOIN families f
        ON f.hh_id = m.family_hh_id
        AND f.cycle_code = m.cycle_code
      WHERE m.member_id = ?
        AND m.cycle_code = ?
      LIMIT 1
      `,
      payload.memberId,
      payload.cycleCode
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

    const result = await db.run(
      `
      INSERT INTO distribution_queue (
        family_unique_code,
        member_id,
        cycle_code,
        main_operator,
        main_operator_fdp,
        sub_operator,
        app_signature,
        notes,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_local')
      `,
      familyUniqueCode,
      payload.memberId,
      payload.cycleCode,
      serverOperator.mainOperator,
      serverOperator.mainOperatorFDP,
      subOperator,
      'LAN_CLIENT',
      null
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

    const result = await db.run(
      `
      INSERT INTO client_distribution_history (
        alias,
        host,
        member_id,
        family_unique_code,
        cycle_code,
        cycle_name,
        collected_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      alias,
      host,
      payload.memberId,
      payload.familyUniqueCode,
      payload.cycleCode,
      cycleName,
      collectedBy
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
      ${hasSearch ? 'AND (CAST(member_id AS TEXT) LIKE ? OR LOWER(cycle_name) LIKE ? OR LOWER(collected_by) LIKE ?)' : ''}
      `,
      ...(hasSearch ? [alias, searchPattern, searchPattern, searchPattern] : [alias])
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
        created_at as createdAt
      FROM client_distribution_history
      WHERE alias = ?
      ${hasSearch ? 'AND (CAST(member_id AS TEXT) LIKE ? OR LOWER(cycle_name) LIKE ? OR LOWER(collected_by) LIKE ?)' : ''}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
      `,
      ...(hasSearch
        ? [alias, searchPattern, searchPattern, searchPattern, safePageSize, offset]
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

  return {
    saveEligibleMembers,
    searchDistributionMember,
    getDistributionDetail,
    saveDistributionEvent,
    saveClientDistribution,
    saveClientDistributionHistory,
    getClientDistributionHistory,
    getDistributionQueue,
    getOperationsAggregates,
    clearDistributionQueue,
    hasEligibleData,
    getOverviewSummary,
    clearEligibleData
  };
}
