// Baturaden 25 Homestay — No7 role-route regression, offline source contracts.
// Browser role UAT and RLS integration are separate gates.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const root = fs.readFileSync('src/routes/__root.tsx','utf8');
const staff = fs.readFileSync('src/routes/karyawan.tsx','utf8');
const peran = fs.readFileSync('src/lib/peran.tsx','utf8');
const session = fs.readFileSync('src/lib/sesi-kas.ts','utf8');
const finance = fs.readFileSync('src/routes/keuangan.tsx','utf8');
const hk = fs.readFileSync('src/routes/housekeeping.tsx','utf8');
let passes = 0;
const check = (name, fn) => { fn(); passes++; console.log('PASS:',name); };
const roleSection = root.slice(root.indexOf('function bolehAksesHalaman('),root.indexOf('const aksesDitolak ='));
check('Owner controls Tim & Akses page, not regular role allowlists',()=>{
  assert.ok(roleSection.includes("if (peran === 'owner') return true"));
  assert.ok(!roleSection.includes("'/karyawan'"));
  assert.ok(staff.includes("createFileRoute('/karyawan')"));
});
check('private settings allowed for staff, business settings not broadly allowed',()=>{
  assert.ok(roleSection.includes("pathname === '/pengaturan-keamanan'"));
  assert.ok(!roleSection.includes("'/pengaturan-keuangan'"));
});
check('Receptionist route allowlist excludes housekeeping and employee admin',()=>{
  const part=roleSection.slice(roleSection.indexOf("case 'receptionist':"),roleSection.indexOf("case 'housekeeping':"));
  for (const path of ["/booking","/check-in","/transaksi","/keuangan"]) assert.ok(part.includes("'"+path+"'"));
  for (const path of ["/housekeeping","/karyawan","/pengaturan-keuangan"]) assert.ok(!part.includes("'"+path+"'"));
});
check('Housekeeping route allowlist excludes finance and booking',()=>{
  const part=roleSection.slice(roleSection.indexOf("case 'housekeeping':"),roleSection.indexOf("case 'inspector':"));
  assert.ok(part.includes("'/housekeeping'"));
  assert.ok(!part.includes("'/keuangan'"));
  assert.ok(!part.includes("'/booking'"));
});
check('unauthorized route hides contents and redirects',()=>{
  assert.ok(root.includes('aksesDitolak'));
  assert.ok(root.includes("navigate({ to: '/', replace: true })"));
  assert.ok(root.includes('return null;'));
});
check('employee identity lifecycle and auth changes refresh role state',()=>{
  assert.ok(peran.includes("supabase.auth.onAuthStateChange"));
  assert.ok(peran.includes("!!employee?.active"));
});
check('assisted session only OPEN, Owner or Supervisor',()=>{
  assert.ok(session.includes("session.status === 'OPEN'"));
  assert.ok(session.includes("posisiKode === 'owner' || posisiKode === 'supervisor'"));
  assert.ok(session.includes('if (sessionId && !openSessions.some'));
});
check('Training does not own or open a cash session',()=>{
  assert.ok(session.includes("training.is_training"));
  assert.ok(session.includes("canOpenSession: !training.is_training"));
  assert.ok(finance.includes("isTraining ? selectedSession : ownSession"));
});
check('housekeeping override Owner or Supervisor',()=>{
  assert.ok(hk.includes("const canOverride = posisiKode === 'owner' || posisiKode === 'supervisor'"));
});
console.log('B25 No7 role-route source contracts:',passes+'/'+passes,'PASS');
