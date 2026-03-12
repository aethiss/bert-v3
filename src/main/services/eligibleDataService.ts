import type { Database } from 'sqlite';
import type {
  EligibleCycleSummary,
  EligibleMembersApiResponse,
  EligibleOverviewSummary
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

export function buildOverviewSummaryFromPayload(
  payload: EligibleMembersApiResponse,
  totalMembers: number
): EligibleOverviewSummary {
  const cycles: EligibleCycleSummary[] = payload.cycles
    .slice(0, 2)
    .map((cycle) => ({
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
    cycles
  };
}

export interface EligibleDataService {
  saveEligibleMembers(payload: EligibleMembersApiResponse): Promise<EligibleOverviewSummary>;
  hasEligibleData(): Promise<boolean>;
  getOverviewSummary(): Promise<EligibleOverviewSummary>;
  clearEligibleData(): Promise<void>;
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

  async function getOverviewSummary(): Promise<EligibleOverviewSummary> {
    const meta = await db.get<{
      fdpCode: string | null;
      fdpName: string | null;
      totalHouseholds: number;
      totalCycles: number;
      totalMembers: number;
    }>(
      `
      SELECT
        fdp_code as fdpCode,
        fdp_name as fdpName,
        total_households as totalHouseholds,
        total_cycles as totalCycles,
        total_members as totalMembers
      FROM eligible_meta
      WHERE id = 1
      `
    );

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
      cycles: (cycles ?? []) as unknown as EligibleCycleSummary[]
    };
  }

  return {
    saveEligibleMembers,
    hasEligibleData,
    getOverviewSummary,
    clearEligibleData
  };
}
