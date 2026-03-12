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

test('eligibleDataService searches member offline by family unique code and document number', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bert-eligible-search-'));
  const dbPath = path.join(tempDir, 'test.sqlite');

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    await runMigrations(db);
    const service = createEligibleDataService(db);

    const payload = {
      fdp_code: 'FDP-88',
      fdp_name: 'Homs',
      total_households: 1,
      total_cycles: 1,
      cycles: [
        {
          cycleId: 'cycle-10',
          cycleCode: 1010,
          startDate: '2026-05-01',
          endDate: '2026-05-31',
          cooperatingPartner: null,
          fieldDistributionPoint: null,
          assistancePackageName: 'SFA',
          cycleName: 'SFA - May',
          cycleNote: null,
          household_count: 1,
          households: [
            {
              hhId: 'HH-10',
              cycleCode: 1010,
              assignedStatus: 'assigned',
              householdSize: '3',
              quantity: '2',
              assistancePackageName: 'SFA',
              cooperatingPartner: null,
              fdp_id: 'fdp-id',
              fdp_name: 'FDP-H',
              Number_of_Children_between_6_and_23_Months: 0,
              FamilyUniqueCode: 556677,
              address: null,
              status: 'ACTIVE',
              eligible: true,
              members: [
                {
                  id: 10,
                  family: 556677,
                  role: 'Member',
                  firstName: 'A',
                  lastName: 'B',
                  fatherName: null,
                  motherName: null,
                  motherLastName: null,
                  cityOfBirth: null,
                  dateOfBirth: null,
                  documentNumber: 'DOC-10',
                  cycleCode: 1010,
                  status: 'eligible'
                },
                {
                  id: 11,
                  family: 556677,
                  role: 'Principle',
                  firstName: 'C',
                  lastName: 'D',
                  fatherName: null,
                  motherName: null,
                  motherLastName: null,
                  cityOfBirth: null,
                  dateOfBirth: null,
                  documentNumber: 'DOC-11',
                  cycleCode: 1010,
                  status: 'eligible'
                }
              ]
            }
          ]
        }
      ]
    };

    await service.saveEligibleMembers(payload);

    const byFamily = await service.searchDistributionMember('556677');
    assert.equal(byFamily.match, 'familyUniqueCode');
    assert.equal(byFamily.member.id, 11);

    const byDocument = await service.searchDistributionMember('DOC-10');
    assert.equal(byDocument.match, 'documentNumber');
    assert.equal(byDocument.member.id, 10);
  } finally {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
