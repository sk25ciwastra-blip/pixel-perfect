// UI-26-02 stage 8: source guards for the existing Owner finance RPC sequence
// and its pure feedback resolver. Offline — no Cloud calls, values or money touched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/routes/pengaturan-keuangan.tsx'), 'utf8');
const outcome = fs.readFileSync(path.join(root, 'src/lib/finance-settings-outcome.ts'), 'utf8');
const readback = fs.readFileSync(path.join(root, 'src/lib/finance-settings-readback.ts'), 'utf8');
const dialog = fs.readFileSync(path.join(root, 'src/components/action-result-dialog.tsx'), 'utf8');

const checks = [
  ['One reusable dialog with Tutup, no second success notice',
    source.includes('ActionResultDialog, type ActionResultState') &&
    (source.match(/<ActionResultDialog /g) || []).length === 1 &&
    dialog.includes('AlertDialogPrimitive.Cancel asChild') &&
    dialog.includes('Tutup') && !source.includes('toast.')],
  ['Owner-only outside training, controls remain blocked on busy/error',
    source.includes("posisiKode === 'owner' && !training.is_training") &&
    source.includes('if (!isOwner || busy) return;') &&
    source.includes('disabled={busy || financeSettings.loading || commissionConfigs.loading || !!financeSettings.error || !!commissionConfigs.error}')],
  ['Existing distinct finance RPCs, in same DP then commission order',
    (source.match(/rpc\('set_finance_settings'/g) || []).length === 1 &&
    (source.match(/rpc\('set_finance_commission_config'/g) || []).length === 1 &&
    source.indexOf("rpc('set_finance_settings'") < source.indexOf("rpc('set_finance_commission_config'")],
  ['First RPC error prevents call to second; partial flag only on second error',
    source.includes('if (first.error) return { error: first.error };') &&
    source.includes('return { error: second.error, partial: Boolean(second.error) };')],
  ['The page calls the actual testable outcome handler exactly once',
    source.includes('resolveFinanceSettingsOutcome({') &&
    (source.match(/resolveFinanceSettingsOutcome\(\{/g) || []).length === 1 &&
    source.includes('setActionResult(result)')],
  ['Both genuine refresh callbacks use error-propagation flags',
    source.includes('refreshFinance: () => financeSettings.refresh({ throwOnError: true })') &&
    source.includes('refreshCommission: () => commissionConfigs.refresh({ throwOnError: true })') &&
    outcome.includes('Promise.allSettled([')],
  ['Partial success never reported as complete, even with successful reread',
    outcome.includes('if (result.partial) {') &&
    outcome.includes("title: 'Konfigurasi tersimpan sebagian'") &&
    outcome.includes('Minimum DP berhasil disimpan, tetapi komisi belum berhasil diperbarui.')],
  ['Readback failures never become success',
    outcome.includes("title: 'Periksa kembali konfigurasi'") &&
    outcome.includes('if (!refreshed) {') &&
    outcome.includes('return results.every(result => result.status === \'fulfilled\')')],
  ['Success only after write action resolves and both refresh functions succeed',
    outcome.indexOf('const result = await options.action()') <
      outcome.indexOf('const refreshed = await rereadFinanceSettings(options)') &&
    outcome.indexOf("kind: 'success'") >
      outcome.indexOf('if (!refreshed) {')],
  ['Original numeric validation and limits unchanged before RPC',
    source.includes("minimumDpMode === 'PERCENTAGE' && dp > 100") &&
    source.includes("commissionMode === 'PERCENTAGE' && (!Number.isFinite(rate) || rate < 0 || rate > 100)") &&
    source.includes("commissionMode === 'PER_ROOM' && (!Number.isFinite(roomAmount) || roomAmount < 0)") &&
    source.includes('validationError:')],
  ['Commission modes and tables unchanged',
    source.includes("useTable('finance_commission_configs', isOwner)") &&
    source.includes("useTable('finance_settings', isOwner)") &&
    source.includes('<option value="OFF">Komisi OFF</option>') &&
    source.includes('<option value="PERCENTAGE">Persentase</option>') &&
    source.includes('<option value="PER_ROOM">Per kamar</option>')],
  ['No raw backend messages in popup; no automatic retry',
    !outcome.includes('result.error.message') &&
    !outcome.includes('failure.message') &&
    !outcome.includes('while (') &&
    outcome.includes('Periksa Minimum DP dan komisi sebelum mencoba kembali.')],
  ['Owner values are independently checked after refresh before success',
    source.includes('verifyPersisted: async () => {') &&
    source.includes("supabase.from('finance_settings')") &&
    source.includes("supabase.from('finance_commission_configs')") &&
    source.includes('matchesPersistedFinanceSettings(') &&
    outcome.includes('const persistedMatches = await options.verifyPersisted();') &&
    outcome.indexOf("const persistedMatches = await options.verifyPersisted()") <
      outcome.indexOf("kind: 'success'")],
  ['Mismatch and missing rows do not claim success',
    outcome.includes("if (!persistedMatches) {") &&
    outcome.includes('belum cocok dengan nilai yang disimpan') &&
    readback.includes('if (!storedFinance || !storedCommission) return false;')],
  ['All three commission modes compare only their active fields',
    readback.includes("case 'OFF':") &&
    readback.includes("case 'PERCENTAGE':") &&
    readback.includes("case 'PER_ROOM':") &&
    readback.includes('sameNumber(requested.commissionRate, storedCommission.rate)') &&
    readback.includes('sameNumber(requested.perRoomAmount, storedCommission.per_room_amount)')],
  ['Readback is read-only and the two write RPCs retain their original sequence',
    !readback.includes('supabase') &&
    (source.match(/rpc\('set_finance_settings'/g) || []).length === 1 &&
    (source.match(/rpc\('set_finance_commission_config'/g) || []).length === 1],
];
for (const [name, ok] of checks) {
  assert.ok(ok, name);
  console.log('PASS', name);
}
console.log(checks.length + ' Owner finance outcome source guards PASS');
