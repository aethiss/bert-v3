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
  `
];

export async function runMigrations(db: Database): Promise<void> {
  await db.exec('BEGIN TRANSACTION');

  try {
    for (const migration of MIGRATIONS) {
      await db.exec(migration);
    }

    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
