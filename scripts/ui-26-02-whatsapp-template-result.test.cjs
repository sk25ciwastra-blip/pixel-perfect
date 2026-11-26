// UI-26-02 phase 5 — WhatsApp Template Owner result feedback contracts.
// Read-only source checks: no template versions, payments or Cloud data are changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/routes/pengaturan-template-whatsapp.tsx'), 'utf8');
const dialog = fs.readFileSync(path.join(root, 'src/components/action-result-dialog.tsx'), 'utf8');
const tests = [
  ['Uses one accessible shared success/error popup, no toast duplication',
    source.includes("ActionResultDialog, type ActionResultState") &&
    (source.match(/<ActionResultDialog /g) || []).length === 1 &&
    !source.includes("toast.") && dialog.includes('AlertDialogPrimitive.Cancel asChild')],
  ['Only Owner logged in and not training can use template settings',
    source.includes("siap && masuk && posisiKode === 'owner' && !training.is_training") &&
    source.includes("if (!owner || !backendReady || busy || unchanged || validation.length) return;")],
  ['Four approved UI categories retain their separate internal kinds',
    source.includes("key: 'PENAWARAN_RESERVASI', title: 'Konfirmasi Reservasi'") &&
    source.includes("key: 'PENGINGAT_BOOKING_30_MENIT', title: 'Pengingat Booking'") &&
    source.includes("key: 'PENGINGAT_WAKTU_HABIS', title: 'Pengingat Waktu Habis'") &&
    source.includes("key: 'PEMBERITAHUAN_OVERTIME', title: 'Pemberitahuan Overtime'")],
  ['Unpaid reservation remains distinct from paid booking and no TRX before payment',
    source.includes("belum ada TRX, kamar belum terkunci, dan belum menjadi Booking resmi") &&
    source.includes('OWNER_REVISED_UNPAID_RESERVATION_DRAFT')],
  ['Overtime still gated by real backend capability, no fallback save',
    source.includes("if (selectedKind === 'PEMBERITAHUAN_OVERTIME')") &&
    source.includes("'read_active_whatsapp_reminder_template'") &&
    source.includes("if (capabilityError)") &&
    source.includes("setBackendReady(false)") &&
    source.includes("MENUNGGU BACKEND")],
  ['No new backend methods; existing RPC split by reminder kind preserved',
    source.includes("'owner_save_whatsapp_reminder_template' : 'owner_save_whatsapp_template'") &&
    source.includes("{ _kind: savingKind, _body: body }")],
  ['Write and readback required before success feedback',
    source.indexOf("writeAcknowledged = true;") > source.indexOf("if (saveError) throw saveError;") &&
    source.indexOf("const refreshed = await reload(savingKind);") > source.indexOf("writeAcknowledged = true;") &&
    source.indexOf("kind: 'success'") > source.indexOf("if (refreshed) {")],
  ['Failed version reload never claims an active version is verified',
    source.includes("title: `Periksa status Template ${savingTitle}`") &&
    source.includes("daftar versi aktif belum berhasil diperiksa")],
  ['Uncertain write result does not claim definite failure or auto-retry',
    source.includes("Hasil penyimpanan belum dapat dipastikan.") &&
    source.includes("status backend, dan versi aktif sebelum mencoba kembali.")],
  ['Template validation and active version history preserved',
    source.includes("validateWhatsAppTemplate(kind, body)") &&
    source.includes("status === 'ACTIVE'") &&
    source.includes("WHATSAPP_TEMPLATE_FIELDS[kind]") &&
    source.includes("Riwayat Versi")],
  ['Manual delivery preserved without automatic WhatsApp or fees',
    source.includes("Pengiriman WhatsApp tetap dilakukan secara manual.") &&
    source.includes("Mengubah template tidak mengirim WhatsApp") &&
    source.includes("Tidak membuat charge otomatis.")],
  ['Save action and reload buttons remain disabled while busy',
    source.includes("disabled={!backendReady || busy || unchanged || validation.length > 0}") &&
    source.includes("disabled={busy || loading}") &&
    source.includes("aria-pressed={kind === item.key} disabled={busy}")],
];
for (const [label, ok] of tests) {
  assert.ok(ok, label);
  console.log('PASS', label);
}
console.log(tests.length + ' template dialog source contract checks PASS');
