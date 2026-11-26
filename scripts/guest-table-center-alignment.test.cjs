// UI table alignment regression — no database calls or guest mutations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/routes/tamu.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/components/tamu.css'), 'utf8');
const guestTableStart = src.indexOf('<table className="w-full min-w-[1050px]');
const guestTable = guestTableStart === -1 ? '' : src.slice(guestTableStart, src.indexOf('</table>', guestTableStart) + '</table>'.length);

const checks = [
  ['Table continues to use seven columns and center alignment',
    src.includes('min-w-[1050px]') &&
    src.includes('table-fixed border-separate border-spacing-0 text-center') &&
    (guestTable.match(/<col className=/g) || []).length === 7],
  ['Name display is explicitly centered and bold',
    src.includes('text-center font-semibold"><span className="block truncate text-center" title={t.full_name}') &&
    !src.includes('text-left font-semibold"><span className="block truncate" title={t.full_name}')],
  ['Address display is explicitly centered and bold',
    src.includes('text-center font-semibold"><span className="block truncate text-center" title={t.address') &&
    !src.includes('text-left"><span className="block truncate" title={t.address')],
  ['Header order is name address WhatsApp visits status actions',
    src.indexOf('>NAMA TAMU</Button>') < src.indexOf('>ALAMAT</th>') &&
    src.indexOf('>ALAMAT</th>') < src.indexOf('>WHATSAPP</th>') &&
    src.indexOf('>WHATSAPP</th>') < src.indexOf('>KUNJUNGAN<ArrowDownUp')],
  ['All table cells are centered vertically and horizontally in CSS',
    css.includes('.tabel-tamu-premium tbody tr td {\n  text-align: center;\n  vertical-align: middle;\n}')],
  ['Name and address columns share font size and weight',
    css.includes('.tabel-tamu-premium tbody tr td:nth-child(2),\n.tabel-tamu-premium tbody tr td:nth-child(3) {\n  font-size: 15px;\n  font-weight: 700;\n  text-align: center;\n}')],
  ['Existing add/edit guest normalization remains unchanged',
    src.includes('formatGuestName(nama)') &&
    src.includes('formatGuestAddress(alamat)') &&
    src.includes('formatGuestWhatsAppInput(telepon)') &&
    src.includes("supabase.from('guests').insert(payload)")],
  ['No global text-transform that could alter address casing',
    !css.includes('text-transform: uppercase') &&
    src.includes("{t.address?.trim() || '—'}")],
];
for (const [name,pass] of checks) {
  assert.ok(pass,name);
  console.log('PASS',name);
}
console.log(`PASS ${checks.length}/${checks.length} guest table alignment source guards`);
