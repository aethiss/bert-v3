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
    user_id INTEGER,
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
  `,
  `
  CREATE TABLE IF NOT EXISTS distribution_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_unique_code INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    cycle_code INTEGER NOT NULL,
    main_operator INTEGER NOT NULL,
    main_operator_fdp TEXT NOT NULL,
    sub_operator TEXT,
    app_signature TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending_local',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_distribution_queue_status_created
    ON distribution_queue(status, created_at);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_distribution_queue_sub_operator
    ON distribution_queue(sub_operator);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_distribution_queue_member_id
    ON distribution_queue(member_id);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_distribution_queue_cycle_code
    ON distribution_queue(cycle_code);
  `,
  `
  CREATE TABLE IF NOT EXISTS client_distribution_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alias TEXT NOT NULL,
    host TEXT NOT NULL,
    member_id INTEGER NOT NULL,
    family_unique_code INTEGER NOT NULL,
    cycle_code INTEGER NOT NULL,
    cycle_name TEXT NOT NULL,
    collected_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_client_distribution_history_alias_created
    ON client_distribution_history(alias, created_at);
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
  const isV5FamiliesSchema =
    familiesSql.includes('primary key(family_unique_code)') ||
    familiesSql.includes('primary key (family_unique_code)');

  if (hasCompositeFamiliesPk && hasCompositeMembersFamilyFk) {
    return;
  }

  await db.exec('PRAGMA foreign_keys = OFF');
  try {
    if (isV5FamiliesSchema) {
      console.info(
        '[migrations] Detected v5 eligible schema on legacy branch; rebuilding eligible cache tables.'
      );
    } else {
      console.info('[migrations] Detected incompatible eligible schema; rebuilding eligible cache tables.');
    }

    // Eligible data is a sync cache, so on mismatch we rebuild instead of attempting
    // column-level copy between incompatible shapes.
    await db.exec('DROP TABLE IF EXISTS members');
    await db.exec('DROP TABLE IF EXISTS families');
    await db.exec('DELETE FROM eligible_meta');

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
  } finally {
    await db.exec('PRAGMA foreign_keys = ON');
  }
}

async function ensureUserTableSchema(db: Database): Promise<void> {
  const userColumns = await db.all<Array<{ name: string }>>('PRAGMA table_info("user")');
  const hasUserId = userColumns.some((column) => column.name === 'user_id');
  if (!hasUserId) {
    await db.exec('ALTER TABLE "user" ADD COLUMN user_id INTEGER');
  }
}

export async function runMigrations(db: Database): Promise<void> {
  await db.exec('BEGIN TRANSACTION');

  try {
    for (const migration of MIGRATIONS) {
      await db.exec(migration);
    }
    await ensureUserTableSchema(db);
    await ensureEligibleTablesSchema(db);

    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
