import type { Database } from 'sqlite';

const BASE_MIGRATIONS: string[] = [
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

const ELIGIBLE_CACHE_SCHEMA: string[] = [
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
    assistance_package_name TEXT NOT NULL DEFAULT '',
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
    family_unique_code INTEGER PRIMARY KEY,
    address TEXT,
    status TEXT NOT NULL,
    eligible INTEGER NOT NULL DEFAULT 0,
    fdp_id TEXT NOT NULL,
    fdp_name TEXT NOT NULL,
    children_6_23_months INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS members (
    member_id INTEGER PRIMARY KEY,
    family_unique_code INTEGER NOT NULL,
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
    FOREIGN KEY(family_unique_code) REFERENCES families(family_unique_code) ON DELETE CASCADE
  );
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_members_family_unique_code
    ON members(family_unique_code);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_members_document_number
    ON members(document_number);
  `,
  `
  CREATE TABLE IF NOT EXISTS distribution_list (
    family_unique_code INTEGER NOT NULL,
    cycle_code INTEGER NOT NULL,
    quantity TEXT NOT NULL DEFAULT '1',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(family_unique_code, cycle_code),
    FOREIGN KEY(family_unique_code) REFERENCES families(family_unique_code) ON DELETE CASCADE,
    FOREIGN KEY(cycle_code) REFERENCES cycles(cycle_code) ON DELETE CASCADE
  );
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_distribution_list_cycle_code
    ON distribution_list(cycle_code);
  `,
  `
  CREATE TABLE IF NOT EXISTS cycle_food_commodities (
    cycle_code INTEGER NOT NULL,
    commodity_id INTEGER NOT NULL,
    unique_id TEXT NOT NULL,
    en_name TEXT NOT NULL DEFAULT '',
    ar_name TEXT NOT NULL DEFAULT '',
    description TEXT,
    kcal REAL,
    unit TEXT,
    quantity REAL,
    weight REAL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(cycle_code, commodity_id),
    FOREIGN KEY(cycle_code) REFERENCES cycles(cycle_code) ON DELETE CASCADE
  );
  `,
  `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_cycle_food_commodities_unique_id
    ON cycle_food_commodities(cycle_code, unique_id);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_cycle_food_commodities_cycle_code
    ON cycle_food_commodities(cycle_code);
  `
];

function normalizeSql(sql: string | null | undefined): string {
  return (sql ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

async function execStatements(db: Database, statements: string[]): Promise<void> {
  for (const statement of statements) {
    await db.exec(statement);
  }
}

async function ensureUserTableSchema(db: Database): Promise<void> {
  const userColumns = await db.all<Array<{ name: string }>>('PRAGMA table_info("user")');
  const hasUserId = userColumns.some((column) => column.name === 'user_id');
  if (!hasUserId) {
    await db.exec('ALTER TABLE "user" ADD COLUMN user_id INTEGER');
  }
}

async function shouldRebuildEligibleCacheSchema(db: Database): Promise<boolean> {
  const familiesRow = await db.get<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='families'"
  );
  const membersRow = await db.get<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='members'"
  );
  const distributionListRow = await db.get<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='distribution_list'"
  );
  const commoditiesRow = await db.get<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='cycle_food_commodities'"
  );

  const familiesSql = normalizeSql(familiesRow?.sql);
  const membersSql = normalizeSql(membersRow?.sql);
  const distributionListSql = normalizeSql(distributionListRow?.sql);
  const commoditiesSql = normalizeSql(commoditiesRow?.sql);

  if (!familiesSql || !membersSql || !distributionListSql || !commoditiesSql) {
    return true;
  }

  const hasV5FamiliesPk =
    familiesSql.includes('family_unique_code integer primary key') &&
    !familiesSql.includes('hh_id text not null');
  const hasV5MembersShape =
    membersSql.includes('member_id integer primary key') &&
    membersSql.includes('family_unique_code integer not null') &&
    !membersSql.includes('cycle_code integer not null');
  const hasDistributionListPk =
    distributionListSql.includes('primary key(family_unique_code, cycle_code)') ||
    distributionListSql.includes('primary key (family_unique_code, cycle_code)');
  const hasCommodityPk =
    commoditiesSql.includes('primary key(cycle_code, commodity_id)') ||
    commoditiesSql.includes('primary key (cycle_code, commodity_id)');

  return !(hasV5FamiliesPk && hasV5MembersShape && hasDistributionListPk && hasCommodityPk);
}

async function rebuildEligibleCacheSchema(db: Database): Promise<void> {
  await db.exec('PRAGMA foreign_keys = OFF');
  try {
    await db.exec('DROP TABLE IF EXISTS cycle_food_commodities');
    await db.exec('DROP TABLE IF EXISTS distribution_list');
    await db.exec('DROP TABLE IF EXISTS members');
    await db.exec('DROP TABLE IF EXISTS families');
    await db.exec('DROP TABLE IF EXISTS cycles');
    await db.exec('DROP TABLE IF EXISTS eligible_meta');
    await execStatements(db, ELIGIBLE_CACHE_SCHEMA);
  } finally {
    await db.exec('PRAGMA foreign_keys = ON');
  }
}

async function ensureEligibleCacheSchema(db: Database): Promise<void> {
  if (await shouldRebuildEligibleCacheSchema(db)) {
    await rebuildEligibleCacheSchema(db);
    return;
  }

  await execStatements(db, ELIGIBLE_CACHE_SCHEMA);
}

export async function runMigrations(db: Database): Promise<void> {
  await db.exec('BEGIN TRANSACTION');

  try {
    await execStatements(db, BASE_MIGRATIONS);
    await ensureUserTableSchema(db);
    await ensureEligibleCacheSchema(db);
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
