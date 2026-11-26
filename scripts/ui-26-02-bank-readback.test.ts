// UI-26-02 tahap 11 — synthetic Owner bank readback comparisons.
// No login, Supabase SDK, bank mutations, or real account details.
import assert from 'node:assert/strict';
import { matchesOwnerBankReadback, type OwnerBankReadback } from '../src/lib/owner-bank-readback';

const requested: OwnerBankReadback = {
  id: '00000000-0000-4000-8000-000000000111',
  bank_name: 'Bank Demo',
  account_name: 'Pemilik Demo',
  account_number: '1234567890',
  logo_key: '',
  active: true,
};
let passed = 0;
function check(name: string, actual: Partial<OwnerBankReadback> | null | undefined, expected: boolean) {
  assert.equal(matchesOwnerBankReadback(requested, actual), expected, name);
  console.log('PASS', name);
  passed++;
}
check('all persisted values match expected UUID', { ...requested }, true);
check('different UUID cannot match even with all other fields equal', { ...requested, id: '00000000-0000-4000-8000-000000000222' }, false);
check('bank name mismatch', { ...requested, bank_name: 'Bank Lain' }, false);
check('account holder mismatch', { ...requested, account_name: 'Pemilik Lain' }, false);
check('account number mismatch', { ...requested, account_number: '0000000000' }, false);
check('logo key mismatch', { ...requested, logo_key: 'different' }, false);
check('activation state mismatch', { ...requested, active: false }, false);
check('missing readback row', null, false);
check('undefined readback row', undefined, false);
check('missing ID in readback row', { ...requested, id: undefined }, false);
check('missing active status', { ...requested, active: undefined }, false);
check('missing expected UUID', { ...requested, id: '' }, false);

// Both activation directions are verified, not just a truthy active flag.
const expectedInactive: OwnerBankReadback = { ...requested, active: false };
assert.equal(matchesOwnerBankReadback(expectedInactive, { ...expectedInactive }), true);
passed++; console.log('PASS expected inactive matches actual inactive');
assert.equal(matchesOwnerBankReadback(expectedInactive, { ...requested, active: true }), false);
passed++; console.log('PASS inactive request rejects still-active row');

console.log(`PASS ${passed}/${passed} Owner bank persisted-value scenarios (synthetic only)`);
