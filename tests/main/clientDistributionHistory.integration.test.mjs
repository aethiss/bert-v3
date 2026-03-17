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
const { createEligibleDataService } = require('../../dist/main/services/eligibleDataService.js');

test('client distribution history is persisted and searchable by alias', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bert-client-history-'));
  const dbPath = path.join(tempDir, 'test.sqlite');

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    await runMigrations(db);
    const service = createEligibleDataService(db);

    await service.saveClientDistributionHistory({
      alias: 'Operator-1',
      host: '127.0.0.1:4860',
      memberId: 1001,
      familyUniqueCode: 2001,
      cycleCode: 3301,
      cycleName: 'Cycle A',
      collectedBy: 'Member A'
    });

    await service.saveClientDistributionHistory({
      alias: 'Operator-1',
      host: '127.0.0.1:4860',
      memberId: 1002,
      familyUniqueCode: 2002,
      cycleCode: 3302,
      cycleName: 'Cycle B',
      collectedBy: 'Member B'
    });

    await service.saveClientDistributionHistory({
      alias: 'Operator-2',
      host: '127.0.0.1:4860',
      memberId: 3001,
      familyUniqueCode: 4001,
      cycleCode: 3301,
      cycleName: 'Cycle A',
      collectedBy: 'Member C'
    });

    const result = await service.getClientDistributionHistory({
      alias: 'Operator-1',
      search: '',
      page: 1,
      pageSize: 10
    });

    assert.equal(result.total, 2);
    assert.equal(result.items.length, 2);
    assert.equal(result.items.every((item) => item.alias === 'Operator-1'), true);

    const searchResult = await service.getClientDistributionHistory({
      alias: 'Operator-1',
      search: '1002',
      page: 1,
      pageSize: 10
    });
    assert.equal(searchResult.total, 1);
    assert.equal(searchResult.items[0].memberId, 1002);
  } finally {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
