import type { Database } from 'sqlite';
import type {
  ClientDistributionInput,
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
  getDistributionQueue(): Promise<DistributionQueueItem[]>;
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
      0,
      'LOCAL_SERVER',
      subOperator,
      'LAN_CLIENT',
      null
    );

    return {
      id: asNumber(result.lastID)
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
    getDistributionQueue,
    clearDistributionQueue,
    hasEligibleData,
    getOverviewSummary,
    clearEligibleData
  };
}
