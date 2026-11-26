// Baturaden 25 Homestay UI-26-02 phase 6: announcement result feedback.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const file = fs.readFileSync(path.join(root, 'src/components/papan-informasi.tsx'), 'utf8');
const dialog = fs.readFileSync(path.join(root, 'src/components/action-result-dialog.tsx'), 'utf8');

const checks = [
  ['Uses one official result dialog, no duplicate inline result message',
    file.includes('ActionResultDialog, type ActionResultState') &&
    (file.match(/<ActionResultDialog /g) || []).length === 1 &&
    !file.includes('setMessage(')],
  ['Owner-only edit/remove, existing operational read roles retained',
    file.includes("const owner = peran === 'owner';") &&
    file.includes("if (!owner || busy || !bolehDisimpan(body)) return;") &&
    file.includes("if (!owner || busy || !window.confirm('Hapus pengumuman ini?')) return;") &&
    file.includes("'receptionist', 'housekeeping', 'supervisor', 'inspector'")],
  ['Delete confirmation stays BEFORE mutation and separate from result popup',
    file.indexOf("window.confirm('Hapus pengumuman ini?')") <
    file.indexOf("supabase.from('operational_announcements').delete()") &&
    dialog.includes('AlertDialogPrimitive.Cancel asChild') &&
    dialog.includes('Tutup')],
  ['Create/edit/delete still use exact Supabase table with affected-row acknowledgement',
    file.includes("supabase.from('operational_announcements').update({ body: bersih }).eq('id', editingId).select('id').single()") &&
    file.includes("supabase.from('operational_announcements').insert({ body: bersih }).select('id').single()") &&
    file.includes("supabase.from('operational_announcements').delete().eq('id', row.id).select('id').single()") &&
    file.includes('if (result.error || !result.data?.id) throw')],
  ['Refresh returns verified rows or null when stale or failed',
    file.includes('if (requestId !== generation.current) return null;') &&
    file.includes('setRows(latest); setError(\'\');') &&
    file.includes('return latest;') &&
    file.includes('return null;')],
  ['Save success requires post-write readback of same id and body',
    file.includes("if (!latest?.some(item => item.id === result.data.id && item.body === bersih))") &&
    file.indexOf("title: editingId ? 'Pengumuman berhasil diperbarui'") >
      file.indexOf("if (!latest?.some(")],
  ['Delete success requires post-write readback where id is absent',
    file.includes('if (!latest || latest.some(item => item.id === row.id))') &&
    file.indexOf("title: 'Pengumuman berhasil dihapus'") >
      file.indexOf('if (!latest || latest.some(item => item.id === row.id))')],
  ['Uncertain outcomes never imply successful verified writes',
    file.includes('Penyimpanan diterima sistem, tetapi data terbaru belum berhasil diverifikasi') &&
    file.includes('Permintaan penghapusan diterima sistem, tetapi hasil terbaru belum dapat diverifikasi') &&
    file.includes('Hasil penyimpanan belum dapat dipastikan') &&
    file.includes('Hasil penghapusan belum dapat dipastikan')],
  ['Existing announcement text limits and rotation remain',
    file.includes('bolehDisimpan(body)') && file.includes('rapikanTeks(body)') &&
    file.includes('maxLength={MAKS_HURUF}') &&
    file.includes('indeksBerikut(index, rows.length, step)') &&
    file.includes('!bolehBerputar(rows.length, hovered || focused || manage)')],
  ['No new RPCs, SQL, or real data access in tests',
    !file.includes("rpc('") && !file.includes('toast.success(') &&
    !file.includes('toast.error(')],
];
for (const [label, pass] of checks) {
  assert.ok(pass, label);
  console.log('PASS', label);
}
console.log(checks.length + ' announcement result source guards PASS');
