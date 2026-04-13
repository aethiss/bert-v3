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
const { createLocalApiServer } = require('../../dist/main/server/localApiServer.js');

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  return { status: response.status, data };
}

test('local api server serves client distribution flow endpoints', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bert-local-api-'));
  const dbPath = path.join(tempDir, 'test.sqlite');

  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  try {
    await runMigrations(db);
    const eligibleDataService = createEligibleDataService(db);
    await db.run(
      `
      INSERT INTO "user" (id, user_id, email, fdp, field_office)
      VALUES (1, ?, ?, ?, ?)
      `,
      595,
      'operator@example.org',
      '2547002158',
      'Damascus SO'
    );

    await eligibleDataService.saveEligibleMembers({
      fdp_code: 'FDP',
      fdp_name: 'Damascus',
      total_households: 1,
      total_cycles: 1,
      cycles: [
        {
          cycleId: 'cycle-1',
          cycleCode: 3301,
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          cooperatingPartner: null,
          fieldDistributionPoint: null,
          assistancePackageName: 'SFA',
          cycleName: 'SFA-Jan',
          cycleNote: null,
          household_count: 1,
          foodCommodities: []
        }
      ],
      families: [
        {
          FamilyUniqueCode: 2000000617,
          address: null,
          status: 'ACTIVE',
          eligible: true,
          fdp_id: 'fdp-id',
          fdp_name: 'Damascus',
          Number_of_Children_between_6_and_23_Months: 0,
          distributionHistory: [],
          cycles: [{ code: 3301, quantity: '1' }],
          members: [
            {
              id: 119293,
              family: 2000000617,
              role: 'Principle',
              firstName: 'John',
              lastName: 'Doe',
              fatherName: null,
              motherName: null,
              motherLastName: null,
              cityOfBirth: null,
              dateOfBirth: null,
              documentNumber: '65379946927',
              status: 'eligible'
            }
          ]
        }
      ]
    });

    const localApiServer = createLocalApiServer({ eligibleDataService });
    const status = await localApiServer.start({
      interfaceName: 'lo0',
      bindIp: '127.0.0.1',
      port: 4877,
      oneTimePassword: 'test'
    });

    assert.equal(status.running, true);

    const baseUrl = 'http://127.0.0.1:4877';
    const login = await jsonRequest(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alias: 'Operator1', oneTimePassword: 'test' })
    });
    assert.equal(login.status, 200);
    assert.equal(typeof login.data.accessToken, 'string');

    const authHeader = { authorization: `Bearer ${login.data.accessToken}` };

    const search = await jsonRequest(`${baseUrl}/search?id=2000000617`, {
      method: 'GET',
      headers: authHeader
    });
    assert.equal(search.status, 200);
    assert.equal(search.data.result.member.id, 119293);

    const detail = await jsonRequest(
      `${baseUrl}/distribution/detail?memberId=119293&familyUniqueCode=2000000617`,
      {
        method: 'GET',
        headers: authHeader
      }
    );
    assert.equal(detail.status, 200);
    assert.equal(detail.data.result.household.familyUniqueCode, 2000000617);

    const distribution = await jsonRequest(`${baseUrl}/distribution`, {
      method: 'POST',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ subOperator: 'Operator1', memberId: 119293, cycleCode: 3301 })
    });
    assert.equal(distribution.status, 201);

    await localApiServer.stop();
  } finally {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
