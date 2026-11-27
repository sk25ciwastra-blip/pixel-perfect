// Source-level authorization contract; no SQL writes, guests or browser login.
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const guest = readFileSync('src/routes/tamu.tsx','utf8');
const transaction = readFileSync('src/components/detail-transaksi.tsx','utf8');
const root = readFileSync('src/routes/__root.tsx','utf8');
const nav = readFileSync('src/components/kerangka.tsx','utf8');
const access = readFileSync('src/lib/guest-detail-access.ts','utf8');

const checks = [
  ['Guest role is explicit, not default write except inspector',
    guest.includes('guestDetailPermissions(posisiKode, masuk)') &&
    guest.includes('const readOnly = !access.canWrite') &&
    !guest.includes("const readOnly = posisiKode === 'inspector'")],
  ['Guest edit function and save both deny unauthorized callers',
    guest.includes('function edit(t?: Guest, hanyaCatatan = false) {\n    if (!access.canWrite) return;') &&
    guest.includes('if (saving || !access.canWrite) return;')],
  ['Guest action buttons remain hidden for read-only roles',
    guest.includes('aksi={!readOnly && <Button') &&
    guest.includes('{!readOnly && <Button size="icon"') &&
    guest.includes('{!readOnly && <>')],
  ['Inspector nested transactions explicitly request read-only mode',
    guest.includes('mode={access.transactionMode}') &&
    guest.includes('access.canView && <DetailTransaksi')],
  ['Nested transaction enforces inspector read-only even for default mode',
    transaction.includes("mode?: 'full' | 'housekeeping' | 'read-only'") &&
    transaction.includes("const viewOnly = mode === 'read-only' || posisiKode === 'inspector'")],
  ['Contact action blocked for inspector in transaction detail',
    transaction.includes('const bolehHubungi = !viewOnly && bolehHubungiTamu(posisiKode, guest?.phone)') &&
    transaction.includes('disabled={!bolehHubungi}')],
  ['PDF and print controls not rendered in read-only transaction detail',
    transaction.includes('{!viewOnly && <>') &&
    transaction.includes('<AksiPdfStruk') &&
    transaction.includes('<ReceiptTransactionButton') &&
    transaction.includes('<ReceiptPrinterTestButton')],
  ['Delete/archive controls not rendered in read-only transaction detail',
    transaction.includes('!viewOnly && onDeleted && !transaction.demo_archived_at && <TombolHapusDemo kind="transaction"') &&
    transaction.includes('!viewOnly && onDeleted && !transaction.demo_archived_at && <TombolHapusDemo kind="archive"')],
  ['Housekeeping and Investor cannot navigate to Guest list',
    root.includes("case 'housekeeping':") && root.includes("case 'investor':") &&
    nav.includes('case "housekeeping":') && nav.includes('case "investor":') &&
    !access.includes("position === 'housekeeping' || position === 'investor'")],
  ['Existing guest RLS is still the final authority, never a client side privilege token',
    !guest.includes("supabase.auth.admin") && !access.includes('supabase.') &&
    !access.includes('sessionStorage') && !access.includes('localStorage')],
];
for(const [label,ok] of checks){assert.ok(ok,label);console.log('PASS',label);}
console.log(`PASS ${checks.length}/${checks.length} Guest Detail role UX contracts`);
