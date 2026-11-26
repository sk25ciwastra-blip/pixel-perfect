// UI-26-02 stage 8: real execution of finance feedback logic with fake RPC/refresh callbacks.
// bun scripts/ui-26-02-finance-outcome-runtime.test.ts
// No login, Supabase SDK, Cloud access, payouts, bookings or financial mutations.
import assert from 'node:assert/strict';
import { resolveFinanceSettingsOutcome, type FinanceSaveActionResult } from '../src/lib/finance-settings-outcome';

let pass = 0;
async function scenario(
  name: string,
  result: FinanceSaveActionResult | Error,
  readStatus: 'ok' | 'finance-fail' | 'commission-fail' = 'ok',
  verification: 'match' | 'mismatch' | 'error' = 'match',
) {
  const calls: string[] = [];
  const outcome = await resolveFinanceSettingsOutcome({
    action: async () => {
      calls.push('write-action');
      if (result instanceof Error) throw result;
      return result;
    },
    refreshFinance: async () => {
      calls.push('read-finance');
      if (readStatus === 'finance-fail') throw new Error('synthetic read failure, finance');
      return [{ minimum_dp_value: 50 }];
    },
    refreshCommission: async () => {
      calls.push('read-commission');
      if (readStatus === 'commission-fail') throw new Error('synthetic read failure, commission');
      return [{ rate: 8 }];
    },
    verifyPersisted: async () => {
      calls.push('verify-values');
      if (verification === 'error') throw new Error('synthetic readback unavailable');
      return verification === 'match';
    },
    successLabel: 'Minimum DP dan komisi berhasil disimpan',
  });
  console.log('TEST', name, outcome.title);
  pass++;
  return { outcome, calls };
}

const success = await scenario('both writes confirmed, both rereads succeed', { error: null });
assert.deepEqual(success.calls, ['write-action', 'read-finance', 'read-commission', 'verify-values']);
assert.equal(success.outcome.kind, 'success');
assert.equal(success.outcome.title, 'Minimum DP dan komisi berhasil disimpan');

const invalid = await scenario('invalid DP rejected before write', {
  error: { message: 'Nilai DP tidak valid.' },
  validationError: 'Nilai DP tidak valid.',
});
assert.deepEqual(invalid.calls, ['write-action']);
assert.equal(invalid.outcome.kind, 'error');
assert.equal(invalid.outcome.title, 'Nilai pengaturan belum valid');
assert.match(invalid.outcome.description, /Nilai DP tidak valid/);

const firstFailure = await scenario('DP RPC fails, no successful save claimed', {
  error: { message: 'synthetic backend error' },
  partial: false,
});
assert.deepEqual(firstFailure.calls, ['write-action']);
assert.equal(firstFailure.outcome.kind, 'error');
assert.equal(firstFailure.outcome.title, 'Konfigurasi belum dapat disimpan');
assert.doesNotMatch(firstFailure.outcome.description, /synthetic backend error/);

const partial = await scenario('DP accepted, commission rejected', {
  error: { message: 'synthetic failed commission RPC' },
  partial: true,
});
assert.deepEqual(partial.calls, ['write-action', 'read-finance', 'read-commission']);
assert.equal(partial.outcome.kind, 'error');
assert.equal(partial.outcome.title, 'Konfigurasi tersimpan sebagian');
assert.match(partial.outcome.description, /Minimum DP berhasil disimpan, tetapi komisi belum/);

const partialReadFailure = await scenario('commission rejected and finance refresh fails', {
  error: { message: 'synthetic failed commission RPC' },
  partial: true,
}, 'finance-fail');
assert.deepEqual(partialReadFailure.calls, ['write-action', 'read-finance', 'read-commission']);
assert.equal(partialReadFailure.outcome.kind, 'error');
assert.equal(partialReadFailure.outcome.title, 'Konfigurasi tersimpan sebagian');
assert.match(partialReadFailure.outcome.description, /belum dapat diperiksa/);

const successButReadFailure = await scenario('both writes accepted but commission read fails', {
  error: null,
}, 'commission-fail');
assert.deepEqual(successButReadFailure.calls, ['write-action', 'read-finance', 'read-commission']);
assert.equal(successButReadFailure.outcome.kind, 'error');
assert.equal(successButReadFailure.outcome.title, 'Periksa kembali konfigurasi');

const mismatch = await scenario('fresh read succeeds but saved values do not match', { error: null }, 'ok', 'mismatch');
assert.deepEqual(mismatch.calls, ['write-action', 'read-finance', 'read-commission', 'verify-values']);
assert.equal(mismatch.outcome.kind, 'error');
assert.equal(mismatch.outcome.title, 'Periksa kembali konfigurasi');
assert.match(mismatch.outcome.description, /belum cocok/);

const unavailable = await scenario('independent verification read fails', { error: null }, 'ok', 'error');
assert.deepEqual(unavailable.calls, ['write-action', 'read-finance', 'read-commission', 'verify-values']);
assert.equal(unavailable.outcome.kind, 'error');
assert.equal(unavailable.outcome.title, 'Hasil penyimpanan belum dapat dipastikan');

const writeUncertain = await scenario('RPC unexpectedly throws without confirmation', new Error('network failure'));
assert.deepEqual(writeUncertain.calls, ['write-action']);
assert.equal(writeUncertain.outcome.kind, 'error');
assert.equal(writeUncertain.outcome.title, 'Hasil penyimpanan belum dapat dipastikan');

// Deliberately fake two RPCs in action to ensure that none of these outcomes
// introduces automatic retries. The exact production RPC order is also guarded
// by the accompanying source-contract test.
const calls: string[] = [];
const noRetry = await resolveFinanceSettingsOutcome({
  action: async () => {
    calls.push('dp');
    calls.push('commission');
    return { error: { message: 'commission failure' }, partial: true };
  },
  refreshFinance: async () => { calls.push('refresh-dp'); },
  refreshCommission: async () => { calls.push('refresh-commission'); },
  verifyPersisted: async () => { calls.push('unexpected-verify'); return true; },
  successLabel: 'Tidak boleh tampil',
});
assert.deepEqual(calls, ['dp', 'commission', 'refresh-dp', 'refresh-commission']);
assert.equal(noRetry.title, 'Konfigurasi tersimpan sebagian');
pass++;

console.log(`PASS ${pass}/${pass} finance result runtime scenarios (all synthetic, no Cloud)`);
