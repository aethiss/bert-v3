import type { Database } from 'sqlite';

const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS "user" (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    email TEXT NOT NULL,
    fdp TEXT,
    field_office TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS eligible_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    fdp_code TEXT,
    fdp_name TEXT,
    total_households INTEGER NOT NULL DEFAULT 0,
    total_cycles INTEGER NOT NULL DEFAULT 0,
    total_members INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS cycles (
    cycle_code INTEGER PRIMARY KEY,
    cycle_id TEXT NOT NULL,
    cycle_name TEXT NOT NULL,
    assistance_package_name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    cycle_note TEXT,
    cooperating_partner TEXT,
    field_distribution_point TEXT,
    household_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS families (
    hh_id TEXT NOT NULL,
    cycle_code INTEGER NOT NULL,
    assigned_status TEXT NOT NULL,
    household_size TEXT NOT NULL,
    quantity TEXT NOT NULL,
    assistance_package_name TEXT NOT NULL,
    cooperating_partner TEXT,
    fdp_id TEXT NOT NULL,
    fdp_name TEXT NOT NULL,
    children_6_23_months INTEGER NOT NULL DEFAULT 0,
    family_unique_code INTEGER NOT NULL,
    address TEXT,
    status TEXT NOT NULL,
    eligible INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(hh_id, cycle_code),
    FOREIGN KEY(cycle_code) REFERENCES cycles(cycle_code) ON DELETE CASCADE
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS members (
    member_id INTEGER NOT NULL,
    cycle_code INTEGER NOT NULL,
    family_hh_id TEXT NOT NULL,
    role TEXT,
    first_name TEXT,
    last_name TEXT,
    father_name TEXT,
    mother_name TEXT,
    mother_last_name TEXT,
    city_of_birth TEXT,
    date_of_birth TEXT,
    document_number TEXT,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(member_id, cycle_code),
    FOREIGN KEY(cycle_code) REFERENCES cycles(cycle_code) ON DELETE CASCADE,
    FOREIGN KEY(family_hh_id, cycle_code) REFERENCES families(hh_id, cycle_code) ON DELETE CASCADE
  );
  `
];

function normalizeSql(sql: string | null | undefined): string {
  return (sql ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

async function ensureEligibleTablesSchema(db: Database): Promise<void> {
  const familiesSchemaRow = await db.get<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='families'"
  );
  const membersSchemaRow = await db.get<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='members'"
  );

  const familiesSql = normalizeSql(familiesSchemaRow?.sql);
  const membersSql = normalizeSql(membersSchemaRow?.sql);

  const hasCompositeFamiliesPk =
    familiesSql.includes('primary key(hh_id, cycle_code)') ||
    familiesSql.includes('primary key (hh_id, cycle_code)');
  const hasCompositeMembersFamilyFk =
    membersSql.includes('foreign key(family_hh_id, cycle_code) references families(hh_id, cycle_code)') ||
    membersSql.includes('foreign key (family_hh_id, cycle_code) references families(hh_id, cycle_code)');

  if (hasCompositeFamiliesPk && hasCompositeMembersFamilyFk) {
    return;
  }

  await db.exec('PRAGMA foreign_keys = OFF');
  try {
    await db.exec('ALTER TABLE families RENAME TO families_legacy');
    await db.exec('ALTER TABLE members RENAME TO members_legacy');

    await db.exec(`
      CREATE TABLE families (
        hh_id TEXT NOT NULL,
        cycle_code INTEGER NOT NULL,
        assigned_status TEXT NOT NULL,
        household_size TEXT NOT NULL,
        quantity TEXT NOT NULL,
        assistance_package_name TEXT NOT NULL,
        cooperating_partner TEXT,
        fdp_id TEXT NOT NULL,
        fdp_name TEXT NOT NULL,
        children_6_23_months INTEGER NOT NULL DEFAULT 0,
        family_unique_code INTEGER NOT NULL,
        address TEXT,
        status TEXT NOT NULL,
        eligible INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(hh_id, cycle_code),
        FOREIGN KEY(cycle_code) REFERENCES cycles(cycle_code) ON DELETE CASCADE
      );
    `);

    await db.exec(`
      CREATE TABLE members (
        member_id INTEGER NOT NULL,
        cycle_code INTEGER NOT NULL,
        family_hh_id TEXT NOT NULL,
        role TEXT,
        first_name TEXT,
        last_name TEXT,
        father_name TEXT,
        mother_name TEXT,
        mother_last_name TEXT,
        city_of_birth TEXT,
        date_of_birth TEXT,
        document_number TEXT,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(member_id, cycle_code),
        FOREIGN KEY(cycle_code) REFERENCES cycles(cycle_code) ON DELETE CASCADE,
        FOREIGN KEY(family_hh_id, cycle_code) REFERENCES families(hh_id, cycle_code) ON DELETE CASCADE
      );
    `);

    await db.exec(`
      INSERT OR REPLACE INTO families (
        hh_id, cycle_code, assigned_status, household_size, quantity, assistance_package_name,
        cooperating_partner, fdp_id, fdp_name, children_6_23_months, family_unique_code,
        address, status, eligible, updated_at
      )
      SELECT
        hh_id, cycle_code, assigned_status, household_size, quantity, assistance_package_name,
        cooperating_partner, fdp_id, fdp_name, children_6_23_months, family_unique_code,
        address, status, eligible, updated_at
      FROM families_legacy;
    `);

    await db.exec(`
      INSERT OR REPLACE INTO members (
        member_id, cycle_code, family_hh_id, role, first_name, last_name,
        father_name, mother_name, mother_last_name, city_of_birth,
        date_of_birth, document_number, status, updated_at
      )
      SELECT
        member_id, cycle_code, family_hh_id, role, first_name, last_name,
        father_name, mother_name, mother_last_name, city_of_birth,
        date_of_birth, document_number, status, updated_at
      FROM members_legacy;
    `);

    await db.exec('DROP TABLE members_legacy');
    await db.exec('DROP TABLE families_legacy');
  } finally {
    await db.exec('PRAGMA foreign_keys = ON');
  }
}

export async function runMigrations(db: Database): Promise<void> {
  await db.exec('BEGIN TRANSACTION');

  try {
    for (const migration of MIGRATIONS) {
      await db.exec(migration);
    }
    await ensureEligibleTablesSchema(db);

    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
