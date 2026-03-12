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

test('eligibleDataService persists and returns overview summary', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bert-eligible-'));
  const dbPath = path.join(tempDir, 'test.sqlite');

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    await runMigrations(db);
    const service = createEligibleDataService(db);

    const payload = {
      fdp_code: 'FDP-77',
      fdp_name: 'Aleppo',
      total_households: 2,
      total_cycles: 1,
      cycles: [
        {
          cycleId: 'cycle-1',
          cycleCode: 9001,
          startDate: '2026-04-01',
          endDate: '2026-04-30',
          cooperatingPartner: 'CP',
          fieldDistributionPoint: 'FDP-A',
          assistancePackageName: 'SFA',
          cycleName: 'SFA - Apr',
          cycleNote: null,
          household_count: 2,
          households: [
            {
              hhId: 'HH-1',
              cycleCode: 9001,
              assignedStatus: 'assigned',
              householdSize: '4',
              quantity: '2',
              assistancePackageName: 'SFA',
              cooperatingPartner: 'CP',
              fdp_id: 'fdp-id',
              fdp_name: 'FDP-A',
              Number_of_Children_between_6_and_23_Months: 1,
              FamilyUniqueCode: 123,
              address: 'Damascus',
              status: 'ACTIVE',
              eligible: true,
              members: [
                {
                  id: 1,
                  family: 123,
                  role: 'head',
                  firstName: 'A',
                  lastName: 'B',
                  fatherName: null,
                  motherName: null,
                  motherLastName: null,
                  cityOfBirth: null,
                  dateOfBirth: null,
                  documentNumber: null,
                  cycleCode: null,
                  status: 'eligible'
                }
              ]
            }
          ]
        }
      ]
    };

    await service.saveEligibleMembers(payload);

    const hasData = await service.hasEligibleData();
    assert.equal(hasData, true);

    const summary = await service.getOverviewSummary();
    assert.equal(summary.hasData, true);
    assert.equal(summary.fdpCode, 'FDP-77');
    assert.equal(summary.totalCycles, 1);
    assert.equal(summary.totalHouseholds, 2);
    assert.equal(summary.totalMembers, 1);
    assert.equal(summary.cycles.length, 1);
    assert.equal(summary.cycles[0].cycleCode, 9001);
  } finally {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
