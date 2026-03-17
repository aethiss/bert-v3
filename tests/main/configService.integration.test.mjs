import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { runMigrations } = require('../../dist/main/database/migrations.js');
const { createRuntimeConfigService } = require('../../dist/main/services/configService.js');

test('resetDatabaseForDevelopment clears installer mode lock', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bert-config-reset-'));
  const dbPath = path.join(tempDir, 'test.sqlite');

  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  try {
    await runMigrations(db);
    const configService = createRuntimeConfigService(db);

    await configService.setApplicationMode('SERVER');
    const beforeReset = await configService.getApplicationMode();
    assert.equal(beforeReset, 'SERVER');

    await configService.resetDatabaseForDevelopment();
    const afterReset = await configService.getApplicationMode();
    assert.equal(afterReset, null);
  } finally {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
