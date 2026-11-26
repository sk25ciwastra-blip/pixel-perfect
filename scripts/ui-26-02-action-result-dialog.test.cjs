// Baturaden 25 Homestay UI-26-02 — source-only contract for first integration.
// This does not call RPCs or make changes to Cloud or live bank accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dialog = fs.readFileSync(path.join(root, 'src/components/action-result-dialog.tsx'), 'utf8');
const bank = fs.readFileSync(path.join(root, 'src/routes/pengaturan-rekening-owner.tsx'), 'utf8');
const comparator = fs.readFileSync(path.join(root, 'src/lib/owner-bank-readback.ts'), 'utf8');
const checks = [
  ['Uses accessible Radix alert dialog title and description',
    dialog.includes('AlertDialogPrimitive.Root') &&
    dialog.includes('AlertDialogPrimitive.Title') &&
    dialog.includes('AlertDialogPrimitive.Description')],
  ['One dismiss control labeled Tutup, with no top corner X',
    dialog.includes('AlertDialogPrimitive.Cancel asChild') &&
    dialog.includes('Tutup') && !dialog.includes('DialogContent') && !dialog.includes('Close asChild')],
  ['Both success and error variants available', 
    dialog.includes("'success' | 'error'") && dialog.includes('CircleCheck') && dialog.includes('CircleX')],
  ['Dialog text is action-specific, not hardcoded as a single generic result',
    dialog.includes('result?.title') && dialog.includes('result?.description')],
  ['Bank actions remain Owner-only',
    bank.includes("posisiKode === 'owner' && !training.is_training") &&
    bank.includes('if (!owner || busy || banks.loading || !!banks.error) return;')],
  ['Bank mutations continue using existing named RPC',
    (bank.match(/rpc\('upsert_finance_bank_account'/g) || []).length === 2],
  ['Saving success waits for database write and successful refresh',
    (bank.match(/writeConfirmed = true;\s+await banks.refresh\(\{ throwOnError: true \}\);/g) || []).length === 2],
  ['Uncertain results do not claim success',
    bank.includes('Perubahan mungkin sudah tersimpan') &&
    bank.includes('Status rekening mungkin sudah berubah') &&
    bank.includes("title: writeConfirmed ? 'Periksa kembali")],
  ['One dialog instance and no duplicate success toast',
    (bank.match(/<ActionResultDialog /g) || []).length === 1 &&
    !bank.includes("toast.success") && !bank.includes("toast.error")],
  ['Bank save verifies UUID returned by RPC against new or edited values',
    bank.includes('data: writtenId') &&
    (bank.split('data: writtenId').length - 1) === 2 &&
    bank.includes("typeof writtenId === 'string' ? writtenId : ''") &&
    bank.includes('(!selected || id === selected.id) && await verifiedBankRow({') &&
    bank.includes('bank_name: name') && bank.includes('account_name: holder') &&
    bank.includes('account_number: number')],
  ['Bank activation requires same UUID and exact persisted status',
    bank.includes('writtenId === bank.id && await verifiedBankRow({') &&
    bank.includes('active: !bank.active') &&
    bank.includes('bank_name: bank.bank_name.trim()') &&
    bank.includes('account_number: bank.account_number.trim()')],
  ['Bank persistence check is independent read-only lookup by UUID',
    bank.includes("supabase.from('finance_bank_accounts')") &&
    bank.includes(".eq('id', expected.id).maybeSingle()") &&
    bank.includes('matchesOwnerBankReadback(expected, data)') &&
    comparator.includes('stored.id !== expected.id')],
  ['No success/reset before readback verification',
    (bank.split("if (!verified) throw new Error(").length - 1) === 2 &&
    bank.indexOf("if (!verified) throw new Error('Saved bank values not verified')") <
      bank.indexOf("title: editing ? 'Rekening berhasil diperbarui'") &&
    bank.indexOf("if (!verified) throw new Error('Saved bank status not verified')") <
      bank.indexOf("title: bank.active ? 'Rekening berhasil dinonaktifkan'")],
  ['Mismatch has uncertainty text rather than claiming success',
    bank.includes('nilai rekening belum cocok atau tidak dapat diverifikasi') &&
    bank.includes('status aktif belum cocok atau tidak dapat diverifikasi') &&
    !bank.includes('toast.success(')],
  ['No changes to checkout, booking, refunds, or confirmations',
    !bank.includes('checkOut(') && !bank.includes('refund(') && !bank.includes('checkIn(')],
];
for (const [label, pass] of checks) {
  assert.ok(pass, label);
  console.log('PASS', label);
}
console.log(checks.length + ' source-only action result guards PASS');
