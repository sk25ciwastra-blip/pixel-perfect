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
  ['Address display is centered with medium weight',
    src.includes('text-center font-medium"><span className="block truncate text-center" title={t.address') &&
    !src.includes('text-left"><span className="block truncate" title={t.address')],
  ['Header order is name address WhatsApp visits status actions',
    src.indexOf('>NAMA TAMU</Button>') < src.indexOf('>ALAMAT</th>') &&
    src.indexOf('>ALAMAT</th>') < src.indexOf('>WHATSAPP</th>') &&
    src.indexOf('>WHATSAPP</th>') < src.indexOf('>KUNJUNGAN<ArrowDownUp')],
  ['All table cells are centered vertically and horizontally in CSS',
    css.includes('.tabel-tamu-premium tbody tr td {\n  text-align: center;\n  vertical-align: middle;\n}')],
  ['Name remains the visual anchor at 15px semibold',
    css.includes('.tabel-tamu-premium tbody tr td:nth-child(2) {\n  font-size: 15px;\n  font-weight: 600;\n}')],
  ['Address becomes lighter at 14px medium',
    css.includes('.tabel-tamu-premium tbody tr td:nth-child(3) {\n  font-size: 14px;\n  font-weight: 500;\n}')],
  ['WhatsApp uses 14px medium and number of visits 15px semibold',
    css.includes('.tabel-tamu-premium tbody tr td:nth-child(4) {\n  font-size: 14px;\n  font-weight: 500;\n}') &&
    css.includes('.tabel-tamu-premium tbody tr td:nth-child(5) {\n  font-size: 15px;\n  font-weight: 600;\n}') &&
    src.includes('px-3 py-3 font-mono text-sm font-medium tabular-nums') &&
    src.includes('px-4 py-3 font-semibold tabular-nums')],
  ['Header typography is 13px semibold',
    css.includes('.tabel-tamu-premium thead tr th,\n.tabel-tamu-premium thead th button {\n  font-size: 13px !important;\n  font-weight: 600;\n}')],
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
