// UI-26-02 phase 2 — source contracts for Owner profile result dialog.
// This test is offline: no calls to LIVE RPC, accounts, bank, or transactions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src/routes/pengaturan-profil-homestay.tsx'), 'utf8',
);
const dialog = fs.readFileSync(
  path.join(__dirname, '..', 'src/components/action-result-dialog.tsx'), 'utf8',
);
const comparator = fs.readFileSync(
  path.join(__dirname, '..', 'src/lib/homestay-profile-readback.ts'), 'utf8',
);
const checks = [
  ['Uses reusable result dialog and one modal instance',
    source.includes('ActionResultDialog, type ActionResultState') &&
    (source.match(/<ActionResultDialog /g) || []).length === 1],
  ['Only Owner outside training can save',
    source.includes("siap && posisiKode === 'owner' && !training.is_training") &&
    source.includes('if (!owner || !profil || loading || saving) return;')],
  ['Retains original write and read RPCs, one write only',
    (source.split("rpc('b25_save_homestay_profile'").length - 1) === 1 &&
    (source.match(/rpc\('b25_read_homestay_profile'/g) || []).length === 2],
  ['Rejects invalid name, address, or contact before RPC',
    source.includes('cleanName.length < 3') &&
    source.includes('cleanAddress.length > 500') &&
    source.includes('!validContact(cleanPhone) || !validContact(cleanWhatsapp)') &&
    source.includes("title: 'Data profil perlu diperbaiki'")],
  ['No success dialog before acknowledged RPC and reread',
    source.indexOf('writeAcknowledged = true') > source.indexOf("if (result.error)") &&
    source.indexOf("const latest = await rpc('b25_read_homestay_profile');") > source.indexOf('writeAcknowledged = true') &&
    source.indexOf("title: 'Profil Homestay berhasil disimpan'") > source.indexOf('setProfil(row);')],
  ['Readback failure has honest uncertain-result message and stops',
    source.includes('if (latest.error || !row)') &&
    source.includes('Perubahan mungkin sudah tersimpan') &&
    source.includes("title: 'Periksa kembali perubahan profil'")],
  ['Failed save never displays raw RPC errors or double success toast',
    !source.includes('result.error.message') && !source.includes('toast.success') &&
    !source.includes('setNotice(') && !source.includes('{notice &&')],
  ['Preserves controlled fields and existing input limits',
    source.includes('value={name}') && source.includes('value={address}') &&
    source.includes('value={phone}') && source.includes('value={whatsapp}') &&
    source.includes('maxLength={100}') && source.includes('maxLength={500}') &&
    source.includes('maxLength={30}')],
  ['Readback verifies all four submitted fields before showing success',
    source.includes('const matchesRequest = matchesHomestayProfileReadback({') &&
    source.indexOf('if (!matchesRequest) {') <
      source.indexOf("title: 'Profil Homestay berhasil disimpan'") &&
    comparator.includes('stored.business_name === requested.business_name') &&
    comparator.includes('stored.address === requested.address') &&
    comparator.includes('stored.phone === requested.phone') &&
    comparator.includes('stored.whatsapp === requested.whatsapp')],
  ['Mismatch is not success and the form shows the latest stored profile',
    source.includes('if (!matchesRequest) {') &&
    source.includes('Formulir telah mengikuti data terakhir dari sistem.') &&
    source.indexOf('setName(row.business_name);', source.indexOf("const latest = await rpc('b25_read_homestay_profile');")) <
      source.indexOf('if (!matchesRequest) {')],
  ['No extra writes or sensitive data in the mismatch message',
    (source.match(/rpc\\('b25_save_homestay_profile'/g) || []).length === 1 &&
    !source.includes('console.log(cleanPhone)') &&
    !source.includes('console.log(cleanWhatsapp)')],
  ['Dialog is dismissible with a Tutup button, without a top X',
    dialog.includes('AlertDialogPrimitive.Cancel asChild') &&
    dialog.includes('Tutup') && !dialog.includes('DialogPrimitive.Close')],
];
for (const [label, pass] of checks) {
  assert.ok(pass, label);
  console.log('PASS', label);
}
console.log(checks.length + ' profile result dialog source contracts PASS');
