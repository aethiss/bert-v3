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

function buildPayload({ fdpCode, fdpName, cycles, families }) {
  return {
    fdp_code: fdpCode,
    fdp_name: fdpName,
    total_households: families.length,
    total_cycles: cycles.length,
    cycles,
    families
  };
}

function createCycle({
  cycleCode,
  cycleId,
  cycleName,
  assistancePackageName = 'SFA',
  startDate = '2026-05-01',
  endDate = '2026-05-31',
  foodCommodities = []
}) {
  return {
    cycleId,
    cycleCode,
    startDate,
    endDate,
    cooperatingPartner: null,
    fieldDistributionPoint: null,
    assistancePackageName,
    cycleName,
    cycleNote: null,
    household_count: 0,
    foodCommodities
  };
}

function createFamily({
  familyUniqueCode,
  fdpId = 'fdp-id',
  fdpName = 'FDP',
  address = null,
  children = 0,
  cycles = [],
  members = []
}) {
  return {
    FamilyUniqueCode: familyUniqueCode,
    address,
    status: 'ACTIVE',
    eligible: true,
    fdp_id: fdpId,
    fdp_name: fdpName,
    Number_of_Children_between_6_and_23_Months: children,
    distributionHistory: [],
    cycles,
    members
  };
}

function createMember({
  id,
  family,
  role,
  firstName,
  lastName,
  documentNumber
}) {
  return {
    id,
    family,
    role,
    firstName,
    lastName,
    fatherName: null,
    motherName: null,
    motherLastName: null,
    cityOfBirth: null,
    dateOfBirth: null,
    documentNumber,
    status: 'eligible'
  };
}

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

    const payload = buildPayload({
      fdpCode: 'FDP-77',
      fdpName: 'Aleppo',
      cycles: [
        createCycle({
          cycleId: 'cycle-1',
          cycleCode: 9001,
          cycleName: 'SFA - Apr',
          foodCommodities: [
            {
              id: 1,
              unique_id: 'rice-1',
              en_name: 'Rice',
              ar_name: 'أرز',
              description: null,
              kcal: 12,
              unit: 'kg',
              quantity: 2,
              weight: 20
            }
          ]
        })
      ],
      families: [
        createFamily({
          familyUniqueCode: 123,
          fdpName: 'FDP-A',
          address: 'Damascus',
          children: 1,
          cycles: [{ code: 9001, quantity: '2' }],
          members: [
            createMember({
              id: 1,
              family: 123,
              role: 'head',
              firstName: 'A',
              lastName: 'B',
              documentNumber: null
            })
          ]
        }),
        createFamily({
          familyUniqueCode: 124,
          fdpName: 'FDP-A',
          cycles: [{ code: 9001, quantity: '1' }],
          members: []
        })
      ]
    });

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

    const payload = buildPayload({
      fdpCode: 'FDP-88',
      fdpName: 'Homs',
      cycles: [
        createCycle({
          cycleId: 'cycle-10',
          cycleCode: 1010,
          cycleName: 'SFA - May'
        })
      ],
      families: [
        createFamily({
          familyUniqueCode: 556677,
          fdpName: 'FDP-H',
          cycles: [{ code: 1010, quantity: '2' }],
          members: [
            createMember({
              id: 10,
              family: 556677,
              role: 'Member',
              firstName: 'A',
              lastName: 'B',
              documentNumber: 'DOC-10'
            }),
            createMember({
              id: 11,
              family: 556677,
              role: 'Principle',
              firstName: 'C',
              lastName: 'D',
              documentNumber: 'DOC-11'
            })
          ]
        })
      ]
    });

    await service.saveEligibleMembers(payload);

    const byFamily = await service.searchDistributionMember('556677');
    assert.equal(byFamily.match, 'familyUniqueCode');
    assert.equal(byFamily.member.id, 11);

    const byDocument = await service.searchDistributionMember('DOC-10');
    assert.equal(byDocument.match, 'documentNumber');
    assert.equal(byDocument.member.id, 10);

    const detail = await service.getDistributionDetail({
      memberId: byFamily.member.id,
      familyUniqueCode: byFamily.member.familyUniqueCode
    });
    assert.equal(detail.household.familyUniqueCode, 556677);
    assert.equal(Array.isArray(detail.activeCycles), true);
    assert.equal(detail.activeCycles.length, 1);
    assert.equal(detail.activeCycles[0].quantity, '2');

    const saveResult = await service.saveDistributionEvent({
      familyUniqueCode: 556677,
      memberId: byFamily.member.id,
      cycleCode: detail.activeCycles[0].cycleCode,
      mainOperator: 595,
      mainOperatorFDP: '2547002158',
      subOperator: null,
      appSignature: '1234567890',
      notes: 'Test note'
    });
    assert.equal(typeof saveResult.id, 'number');
    assert.equal(saveResult.id > 0, true);

    await assert.rejects(
      () =>
        service.saveDistributionEvent({
          familyUniqueCode: 556677,
          memberId: byDocument.member.id,
          cycleCode: detail.activeCycles[0].cycleCode,
          mainOperator: 595,
          mainOperatorFDP: '2547002158',
          subOperator: null,
          appSignature: '1234567890',
          notes: 'Duplicate attempt'
        }),
      /Duplicate distribution blocked/i
    );
  } finally {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('client distributions inherit server operator and operations aggregates exclude server rows', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bert-eligible-client-ops-'));
  const dbPath = path.join(tempDir, 'test.sqlite');

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    await runMigrations(db);
    const service = createEligibleDataService(db);

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

    await service.saveEligibleMembers(
      buildPayload({
        fdpCode: 'FDP-99',
        fdpName: 'Damascus',
        cycles: [
          createCycle({
            cycleId: 'cycle-20',
            cycleCode: 3301,
            cycleName: 'SFA - May'
          })
        ],
        families: [
          createFamily({
            familyUniqueCode: 700001,
            fdpName: 'FDP-H',
            cycles: [{ code: 3301, quantity: '1' }],
            members: [
              createMember({
                id: 101,
                family: 700001,
                role: 'Principle',
                firstName: 'A',
                lastName: 'One',
                documentNumber: 'DOC-101'
              })
            ]
          }),
          createFamily({
            familyUniqueCode: 700002,
            fdpName: 'FDP-H',
            cycles: [{ code: 3301, quantity: '1' }],
            members: [
              createMember({
                id: 102,
                family: 700002,
                role: 'Principle',
                firstName: 'B',
                lastName: 'Two',
                documentNumber: 'DOC-102'
              })
            ]
          })
        ]
      })
    );

    await service.saveDistributionEvent({
      familyUniqueCode: 700001,
      memberId: 101,
      cycleCode: 3301,
      mainOperator: 595,
      mainOperatorFDP: '2547002158',
      subOperator: null,
      appSignature: '1234567890',
      notes: null
    });

    await service.saveClientDistribution({
      subOperator: 'Ahmed',
      memberId: 102,
      cycleCode: 3301
    });

    const queue = await service.getDistributionQueue();
    assert.equal(queue.length, 2);
    assert.equal(queue[1].mainOperator, 595);
    assert.equal(queue[1].mainOperatorFDP, '2547002158');
    assert.equal(queue[1].subOperator, 'Ahmed');

    const operations = await service.getOperationsAggregates({
      search: '',
      page: 1,
      pageSize: 10
    });

    assert.equal(operations.totalDistributions, 1);
    assert.equal(operations.overviewBars.length, 1);
    assert.equal(operations.overviewBars[0].alias, 'Ahmed');
    assert.equal(operations.distributions.items.length, 1);
    assert.equal(operations.distributions.items[0].subOperator, 'Ahmed');
  } finally {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
