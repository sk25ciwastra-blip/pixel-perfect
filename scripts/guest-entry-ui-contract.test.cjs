// Source checks for the actual guest list and Add/Edit Guest screen.
// Complements the pure formatting tests. Never calls Supabase or touches data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'src/routes/tamu.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/components/tamu.css'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'src/lib/guest-entry-format.ts'), 'utf8');

const checks = [
  ['Address column follows guest name and precedes WhatsApp',
    page.indexOf('>NAMA TAMU</Button>') < page.indexOf('>ALAMAT</th>') &&
    page.indexOf('>ALAMAT</th>') < page.indexOf('>WHATSAPP</th>')],
  ['Exactly seven guest list column widths, fits 100 percent',
    page.includes('min-w-[1050px]') &&
    page.includes('w-[5%]') && page.includes('w-[19%]') &&
    page.includes('w-[22%]') && page.includes('w-[16%]') &&
    page.includes('w-[11%]') && page.includes('w-[13%]') &&
    page.includes('w-[14%]')],
  ['Address is read from actual guest row, with fallback and tooltip',
    page.includes("{t.address?.trim() || '—'}") &&
    page.includes("title={t.address || 'Alamat belum tercatat'}")],
  ['Visit-count emphasis moved to the fifth column',
    !css.includes('tbody tr td:nth-child(4)') &&
    css.includes('tbody tr td:nth-child(5)')],
  ['Guest name uppercases during typing and trims on blur',
    page.includes("onChange={e => setNama(e.target.value.toLocaleUpperCase('id-ID'))}") &&
    page.includes('onBlur={() => setNama(formatGuestName(nama))}')],
  ['Address is properly capitalized on blur and before write',
    page.includes('onBlur={() => setAlamat(formatGuestAddress(alamat))}') &&
    page.includes('const cleanAddress = formatGuestAddress(alamat)')],
  ['Phone paste and typing are normalized in the same change event',
    page.includes('onChange={e => setTelepon(formatGuestWhatsAppInput(e.target.value))}') &&
    page.includes('type="tel" inputMode="tel"') &&
    page.includes('onBlur={() => setTelepon(formatGuestWhatsAppInput(telepon))}')],
  ['Phone format is validated before write and stored exactly as normalized',
    page.includes('const cleanPhone = formatGuestWhatsAppInput(telepon)') &&
    page.includes('isValidGuestWhatsApp(cleanPhone)') &&
    page.includes('phone: cleanPhone')],
  ['Names and addresses stored formatted, not just displayed',
    page.includes('full_name: cleanName, address: cleanAddress') &&
    page.includes('const cleanName = formatGuestName(nama)')],
  ['Duplicate checking resolves +62 and 08 to the same number',
    page.includes('guestWhatsAppCanonical(t.phone) === guestWhatsAppCanonical(cleanPhone)')],
  ['Create/edit keep existing Supabase flow and note-only protection',
    page.includes("supabase.from('guests').update(catatanSaja ? { notes: catatan.trim() } : payload)") &&
    page.includes("supabase.from('guests').insert(payload)") &&
    page.includes('if (saving || readOnly) return')],
  ['No change to global WhatsApp normalization / delivery',
    !helper.includes("from '@/lib/whatsapp'") &&
    page.includes('openWhatsApp(t.phone)') &&
    page.includes('empatDigitWA(t.phone)')],
];
for (const [label, passed] of checks) {
  assert.ok(passed, label);
  console.log('PASS', label);
}
console.log(`PASS ${checks.length}/${checks.length} guest-entry UI contracts`);
