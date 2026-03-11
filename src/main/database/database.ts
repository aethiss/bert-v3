import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { runMigrations } from './migrations';

export interface AppDatabase {
  connection: Database;
  close(): Promise<void>;
}

export async function initializeDatabase(userDataPath: string): Promise<AppDatabase> {
  const dbDirectory = path.join(userDataPath, 'db');
  const dbPath = path.join(dbDirectory, 'bert.sqlite');

  mkdirSync(dbDirectory, { recursive: true });

  const connection = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await connection.exec('PRAGMA journal_mode = WAL;');
  await runMigrations(connection);

  return {
    connection,
    close: () => connection.close()
  };
}
