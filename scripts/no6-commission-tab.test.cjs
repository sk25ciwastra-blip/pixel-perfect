// Baturaden 25 Homestay — No6 dedicated Komisi source contract.
// Offline only; no Cloud ledger mutation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const s = fs.readFileSync('src/routes/keuangan.tsx','utf8');
let n = 0;
function pass(name, run){run();n++;console.log('PASS:',name);}
pass('Komisi has a dedicated navigation target',()=>{
  assert.ok(s.includes("['Komisi', Percent, 'komisi']"));
  assert.ok(s.includes('id="keuangan-komisi"'));
});
pass('Komisi panel includes selected session payment breakdown',()=>{
  assert.ok(s.includes('Rincian Komisi Sesi Kas'));
  assert.ok(s.includes('sessionPayments.map(payment =>'));
  assert.ok(s.includes('payment.commission_amount'));
  assert.ok(s.includes('nomorTrx(payment.transaction_id)'));
});
pass('backend commission summary used for refund correction',()=>{
  assert.ok(s.includes("summary['commission']"));
  assert.ok(s.includes('termasuk koreksi refund'));
  assert.ok(s.includes('Komisi Awal'));
});
pass('Ringkasan Hari Ini remains separate from Komisi',()=>{
  assert.ok(s.includes("selectedSession && tab === 'Sesi Kas'"));
  assert.ok(!s.includes("tab === 'Komisi' || tab === 'Sesi Kas'"));
});
pass('commission panel is read-only',()=>{
  const start=s.indexOf('<section id="keuangan-komisi"');
  const end=s.indexOf('<div className="kf-grille">',start);
  const view=s.slice(start,end);
  assert.ok(view.length>500);
  assert.ok(!view.includes('await rpc('));
  assert.ok(!view.includes('onClick='));
});
console.log('B25 Komisi UAT source guard',n+'/'+n,'PASS');
