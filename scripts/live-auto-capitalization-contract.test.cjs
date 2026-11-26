// Guard capitalization across all operational pages without changing
// identifiers, search behavior, WhatsApp numbers or existing data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const appRoot = fs.readFileSync(path.join(root, 'src/routes/__root.tsx'), 'utf8');
const guest = fs.readFileSync(path.join(root, 'src/routes/tamu.tsx'), 'utf8');
const logic = fs.readFileSync(path.join(root, 'src/lib/live-auto-capitalization.ts'), 'utf8');

const checks = [
  ['Global listener installed once in the TanStack app root',
    appRoot.includes('useEffect(() => installLiveAutoCapitalization(document), [])') &&
    appRoot.includes('import { installLiveAutoCapitalization }')],
  ['Native capture runs before React controlled input handlers and cleans up',
    logic.includes("doc.addEventListener('input', applyLiveAutoCapitalize, true)") &&
    logic.includes("doc.removeEventListener('input', applyLiveAutoCapitalize, true)") &&
    logic.includes("Object.getOwnPropertyDescriptor(prototype, 'value')?.set")],
  ['Cursor and composition respected',
    logic.includes('event.isComposing') &&
    logic.includes('field.setSelectionRange(') &&
    logic.includes('capitalizeLiveText(before.slice(0, start), mode).length')],
  ['Structured fields and case-sensitive tokens excluded',
    logic.includes("field.type !== 'text'") &&
    logic.includes('technicalFieldHints.test(hint)') &&
    logic.includes("override === 'off'") &&
    logic.includes("['numeric', 'decimal', 'tel', 'email', 'url', 'search', 'none']")],
  ['Address uses live word capitalizing and preserves whitespace',
    logic.includes("if (mode === 'words')") &&
    !logic.includes("value.trim()") &&
    guest.includes("onChange={e => setAlamat(capitalizeLiveText(e.target.value, 'words'))}") &&
    guest.includes('onBlur={() => setAlamat(formatGuestAddress(alamat))}')],
  ['Guest name and WhatsApp remain under their approved own formatters',
    guest.includes("setNama(e.target.value.toLocaleUpperCase('id-ID'))") &&
    guest.includes('formatGuestWhatsAppInput(e.target.value)')],
  ['Unchanged data and backend: no database write in automatic formatter',
    !logic.includes("supabase") &&
    !logic.includes("fetch(") &&
    !logic.includes("localStorage") &&
    !logic.includes("dispatchEvent(")],
];
for (const [label, ok] of checks) {
  assert.ok(ok, label);
  console.log('PASS', label);
}
console.log(`PASS ${checks.length}/${checks.length} capitalization source contracts`);
