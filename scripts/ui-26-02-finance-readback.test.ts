// UI-26-02 phase 9: compare stored values with Owner's requested configuration.
// No Supabase, auth, SQL, finance mutations, or real data.
import assert from 'node:assert/strict';
import {
  matchesPersistedFinanceSettings,
  type RequestedFinanceSettings,
  type StoredFinanceSettings,
  type StoredCommissionConfig,
} from '../src/lib/finance-settings-readback';

const expected: RequestedFinanceSettings = {
  minimumDpMode: 'PERCENTAGE',
  minimumDpValue: 50,
  commissionMode: 'PERCENTAGE',
  commissionRate: 8,
  perRoomAmount: 10000,
};
const storedDP: StoredFinanceSettings = {
  minimum_dp_mode: 'PERCENTAGE',
  minimum_dp_value: 50,
};
const storedCommission: StoredCommissionConfig = {
  mode: 'PERCENTAGE',
  rate: 8,
  per_room_amount: 0,
};
let passed = 0;
function test(name: string, value: boolean, expectedResult: boolean) {
  assert.equal(value, expectedResult, name);
  passed++;
  console.log('PASS', name);
}

test('matching percent DP and rate, irrelevant room amount ignored',
  matchesPersistedFinanceSettings(expected, storedDP, storedCommission), true);
test('DB DP value unchanged despite acknowledged write => mismatch',
  matchesPersistedFinanceSettings(expected, { ...storedDP, minimum_dp_value: 40 }, storedCommission), false);
test('DB DP mode wrong => mismatch',
  matchesPersistedFinanceSettings(expected, { ...storedDP, minimum_dp_mode: 'AMOUNT' }, storedCommission), false);
test('DB commission percentage wrong => mismatch',
  matchesPersistedFinanceSettings(expected, storedDP, { ...storedCommission, rate: 5 }), false);
test('DB commission mode wrong => mismatch',
  matchesPersistedFinanceSettings(expected, storedDP, { ...storedCommission, mode: 'PER_ROOM' }), false);
test('missing DP row cannot establish persistency',
  matchesPersistedFinanceSettings(expected, null, storedCommission), false);
test('missing commission row cannot establish persistency',
  matchesPersistedFinanceSettings(expected, storedDP, null), false);
test('OFF requires mode matching, unused old rates ignored',
  matchesPersistedFinanceSettings({ ...expected, commissionMode: 'OFF' }, storedDP, { mode: 'OFF', rate: 80, per_room_amount: 90000 }), true);
test('PER_ROOM checks amount, ignores unused rate',
  matchesPersistedFinanceSettings({ ...expected, commissionMode: 'PER_ROOM', perRoomAmount: 10000 },
    storedDP, { mode: 'PER_ROOM', rate: 900, per_room_amount: 10000 }), true);
test('PER_ROOM different nominal must not show success',
  matchesPersistedFinanceSettings({ ...expected, commissionMode: 'PER_ROOM', perRoomAmount: 10000 },
    storedDP, { mode: 'PER_ROOM', rate: 8, per_room_amount: 9000 }), false);
test('unknown commission mode cannot be claimed persisted',
  matchesPersistedFinanceSettings({ ...expected, commissionMode: 'CUSTOM' },
    storedDP, { mode: 'CUSTOM', rate: 8, per_room_amount: 0 }), false);
test('non-finite readback must not match',
  matchesPersistedFinanceSettings(expected, { ...storedDP, minimum_dp_value: Number.NaN }, storedCommission), false);

console.log(`PASS ${passed}/${passed} finance persisted-value comparison scenarios (synthetic only)`);
