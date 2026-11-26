// UI-26-02 phase 4: conservative Owner finance-settings result-dialog contract.
// Offline source checks only: never connect to Cloud, mutate rates, or create payments.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/routes/pengaturan-keuangan.tsx'), 'utf8');
const dialog = fs.readFileSync(path.join(__dirname, '..', 'src/components/action-result-dialog.tsx'), 'utf8');

const checks = [
  ['Shared dialog is rendered once and closed through Tutup',
    source.includes('ActionResultDialog, type ActionResultState') &&
    (source.match(/<ActionResultDialog /g) || []).length === 1 &&
    dialog.includes('AlertDialogPrimitive.Cancel asChild') && dialog.includes('Tutup')],
  ['Existing Owner guard and disabled controls retained',
    source.includes("posisiKode === 'owner' && !training.is_training") &&
    source.includes('if (!isOwner || busy) return;') &&
    source.includes('disabled={busy || financeSettings.loading || commissionConfigs.loading')],
  ['Exactly the original two finance RPCs, DP then commission',
    (source.match(/rpc\('set_finance_settings'/g) || []).length === 1 &&
    (source.match(/rpc\('set_finance_commission_config'/g) || []).length === 1 &&
    source.indexOf("rpc('set_finance_settings'") < source.indexOf("rpc('set_finance_commission_config'")],
  ['Failed first RPC stops before starting second; partial flag set only on second failure',
    source.includes('if (first.error) return { error: first.error };') &&
    source.includes('return { error: second.error, partial: Boolean(second.error) };')],
  ['Partial success is never presented as complete success',
    source.includes('if (result.partial) {') &&
    source.includes("title: 'Konfigurasi tersimpan sebagian'") &&
    source.includes('Minimum DP berhasil disimpan, tetapi komisi belum berhasil diperbarui.')],
  ['Both data sources are re-read with error propagation on partial and success',
    (source.match(/financeSettings.refresh\(\{ throwOnError: true \}\)/g) || []).length === 2 &&
    (source.match(/commissionConfigs.refresh\(\{ throwOnError: true \}\)/g) || []).length === 2 &&
    (source.match(/Promise.allSettled\(/g) || []).length === 2],
  ['Readback uncertainty is not labeled success',
    source.includes("title: 'Periksa kembali konfigurasi'") &&
    source.includes('Kedua penyimpanan diterima sistem, tetapi hasil terbaru belum dapat dibaca sepenuhnya.')],
  ['Only full acknowledgement plus re-read yields success',
    source.indexOf("title: successLabel") > source.indexOf('if (reread.some(item => item.status === \'rejected\'))') &&
    source.includes("kind: 'success'")],
  ['Known validation errors remain before both RPCs',
    source.includes("minimumDpMode === 'PERCENTAGE' && dp > 100") &&
    source.includes("commissionMode === 'PERCENTAGE' && (!Number.isFinite(rate) || rate < 0 || rate > 100)") &&
    source.includes("commissionMode === 'PER_ROOM' && (!Number.isFinite(roomAmount) || roomAmount < 0)") &&
    source.includes('validationError:')],
  ['No duplicate toast or leaked database error details',
    !source.includes('toast.') && !source.includes('setMessage(') &&
    !source.includes('result.error.message') && !source.includes('failure.message')],
  ['Existing commission modes and two source tables unchanged',
    source.includes("useTable('finance_commission_configs', isOwner)") &&
    source.includes("useTable('finance_settings', isOwner)") &&
    source.includes('<option value="OFF">Komisi OFF</option>') &&
    source.includes('<option value="PERCENTAGE">Persentase</option>') &&
    source.includes('<option value="PER_ROOM">Per kamar</option>')],
  ['Uncertain errors advise verifying both settings before retry',
    source.includes('Sebagian perubahan mungkin sudah tersimpan.') &&
    source.includes('Periksa Minimum DP dan komisi sebelum mencoba kembali.')],
];
for (const [name, ok] of checks) {
  assert.ok(ok, name);
  console.log('PASS', name);
}
console.log(checks.length + ' Owner finance popup contract checks PASS');
