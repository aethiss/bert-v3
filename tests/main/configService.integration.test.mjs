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

test('resetDatabaseForDevelopment clears installer mode lock and restores default language', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bert-config-reset-'));
  const dbPath = path.join(tempDir, 'test.sqlite');

  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  try {
    await runMigrations(db);
    const configService = createRuntimeConfigService(db);

    await configService.setApplicationMode('SERVER');
    await configService.setLanguage('ar');
    const beforeReset = await configService.getApplicationMode();
    const beforeResetLanguage = await configService.getLanguage();
    assert.equal(beforeReset, 'SERVER');
    assert.equal(beforeResetLanguage, 'ar');

    await configService.resetDatabaseForDevelopment();
    const afterReset = await configService.getApplicationMode();
    const afterResetLanguage = await configService.getLanguage();
    assert.equal(afterReset, null);
    assert.equal(afterResetLanguage, 'en');
  } finally {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
