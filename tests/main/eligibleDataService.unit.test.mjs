import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildOverviewSummaryFromPayload,
  pickPreferredDistributionMember
} = require('../../dist/main/services/eligibleDataService.js');

test('buildOverviewSummaryFromPayload maps top-level totals and first two cycles', () => {
  const payload = {
    fdp_code: 'FDP-01',
    fdp_name: 'Damascus',
    total_households: 12,
    total_cycles: 3,
    cycles: [
      {
        cycleId: 'c-1',
        cycleCode: 101,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        cooperatingPartner: null,
        fieldDistributionPoint: null,
        assistancePackageName: 'SFA',
        cycleName: 'SFA - Jan',
        cycleNote: null,
        household_count: 10,
        households: []
      },
      {
        cycleId: 'c-2',
        cycleCode: 102,
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        cooperatingPartner: null,
        fieldDistributionPoint: null,
        assistancePackageName: 'BSFP',
        cycleName: 'BSFP - Feb',
        cycleNote: null,
        household_count: 8,
        households: []
      },
      {
        cycleId: 'c-3',
        cycleCode: 103,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        cooperatingPartner: null,
        fieldDistributionPoint: null,
        assistancePackageName: 'NFI',
        cycleName: 'NFI - Mar',
        cycleNote: null,
        household_count: 5,
        households: []
      }
    ]
  };

  const summary = buildOverviewSummaryFromPayload(payload, 42);

  assert.equal(summary.hasData, true);
  assert.equal(summary.fdpCode, 'FDP-01');
  assert.equal(summary.fdpName, 'Damascus');
  assert.equal(summary.totalHouseholds, 12);
  assert.equal(summary.totalCycles, 3);
  assert.equal(summary.totalMembers, 42);
  assert.equal(summary.cycles.length, 2);
  assert.equal(summary.cycles[0].cycleCode, 101);
  assert.equal(summary.cycles[1].cycleCode, 102);
});

test('pickPreferredDistributionMember selects Principle role and falls back to first', () => {
  const withPrinciple = [
    { id: 11, role: 'Member', documentNumber: 'A', familyUniqueCode: 1, cycleCode: 10 },
    { id: 12, role: 'Principle', documentNumber: 'B', familyUniqueCode: 1, cycleCode: 10 }
  ];

  const preferred = pickPreferredDistributionMember(withPrinciple);
  assert.equal(preferred.id, 12);

  const withoutPrinciple = [
    { id: 21, role: 'Caregiver', documentNumber: 'X', familyUniqueCode: 2, cycleCode: 10 },
    { id: 22, role: 'Member', documentNumber: 'Y', familyUniqueCode: 2, cycleCode: 10 }
  ];

  const fallback = pickPreferredDistributionMember(withoutPrinciple);
  assert.equal(fallback.id, 21);
});
