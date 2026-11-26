// UI-26-02 phase 3 — source-only contract for Manajemen Kamar feedback.
// No database access, no room mutation, and no operational test transactions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/routes/pengaturan-manajemen-kamar.tsx'), 'utf8');
const dialog = fs.readFileSync(path.join(root, 'src/components/action-result-dialog.tsx'), 'utf8');
const checks = [
  ['Reuses ActionResultDialog exactly once',
    source.includes('ActionResultDialog, type ActionResultState') &&
    (source.match(/<ActionResultDialog /g) || []).length === 1],
  ['Only Owner outside training has access',
    source.includes("siap && posisiKode === 'owner' && !training.is_training") &&
    source.includes('if (!owner) return <Kerangka')],
  ['Existing room edit contract preserves room type',
    source.includes("dialog.room ?") &&
    source.includes("update({ room_number: n, lantai: floor })") &&
    source.includes("insert({ room_number: n, room_type_id: tipeId, lantai: floor })")],
  ['Duplicate room and floor validation remain',
    source.includes("room.room_number.trim().toLowerCase() === n.toLowerCase()") &&
    source.includes("!Number.isInteger(floor) || floor < 1")],
  ['Disabled room guard still checks occupied and Booking',
    source.includes("room.status === 'occupied'") &&
    source.includes("trx.status === 'check_in' || trx.status === 'booking'") &&
    source.includes("room.active && digunakan(room)")],
  ['Transaction load/read failure blocks deactivation',
    source.includes("room.active && (transactions.loading || transactions.error)") &&
    source.includes("reportError('Penonaktifan kamar ditahan'")],
  ['Existing Supabase writes remain two specific paths and one activation',
    source.includes("supabase.from('rooms').update({ room_number: n, lantai: floor }).eq('id', dialog.room.id)") &&
    source.includes("supabase.from('rooms').insert({ room_number: n, room_type_id: tipeId, lantai: floor })") &&
    source.includes("supabase.from('rooms').update({ active: !room.active }).eq('id', room.id)")],
  ['Success reported only after write acknowledgement and refresh',
    (source.match(/writeAcknowledged = true;\s+await rooms.refresh\(\{ throwOnError: true \}\);/g) || []).length === 2],
  ['Uncertain result not incorrectly reported as definite failure',
    source.includes('Perubahan mungkin sudah disimpan') &&
    source.includes('Status kamar mungkin sudah berubah') &&
    source.includes('Periksa kembali sebelum mengulangi')],
  ['Action-specific titles for add/edit/activate/deactivate and block',
    source.includes("title: editing ? 'Kamar berhasil diperbarui' : 'Kamar berhasil ditambahkan'") &&
    source.includes("title: room.active ? 'Kamar berhasil dinonaktifkan' : 'Kamar berhasil diaktifkan'") &&
    source.includes("reportError('Kamar masih digunakan'")],
  ['No duplicate toast or raw backend error shown in popup',
    !source.includes("toast.") && !source.includes('failure.message') && !source.includes('writeError.message')],
  ['Existing editor dialog and Cancel remain',
    source.includes('role="dialog" aria-modal="true"') &&
    source.includes("onClick={() => setDialog(null)}>Batal") &&
    dialog.includes('AlertDialogPrimitive.Cancel asChild') &&
    dialog.includes('Tutup')],
];
for (const [label, ok] of checks) {
  assert.ok(ok, label);
  console.log('PASS', label);
}
console.log(checks.length + ' room management popup source contracts PASS');
