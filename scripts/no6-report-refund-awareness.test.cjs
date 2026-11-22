// Baturaden 25 Homestay — No.6 refund-aware report focused offline checks.
// No Cloud connection, actual employee or guest records, or credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const cache = new Map();
function loadSource(path) {
  if(cache.has(path)) return cache.get(path).exports;
  const text = fs.readFileSync(path, 'utf8');
  const js = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const item = { exports: {} }; cache.set(path,item);
  new Function('module','exports','require',js)(
    item,item.exports,(id)=>{
      if(id === './laporan-arus-kas') return loadSource('src/lib/laporan-arus-kas.ts');
      throw new Error('Unexpected import: '+id);
    }
  );
  return item.exports;
}
const helper = loadSource('src/lib/laporan-arus-kas.ts');
const exportCsv = loadSource('src/lib/laporan-export.ts');
const report = fs.readFileSync('src/routes/laporan.tsx', 'utf8');
let n=0;
const pass = (name,check)=> {check();n++;console.log('PASS: '+name);};
pass('Owner cashflow deducts refunds exactly once',()=>{
  assert.equal(helper.hitungArusKasBersih(200000,50000,30000),120000);
});
pass('A real negative net balance remains negative',()=>{
  assert.equal(helper.hitungArusKasBersih(0,50000,0),-50000);
});
pass('Refund zero preserves old gross-minus-expense figure',()=>{
  assert.equal(helper.hitungArusKasBersih(1356000,51000,0),1305000);
});
pass('Missing refund coverage cannot be mistaken for net cashflow',()=>{
  assert.equal(helper.hitungArusKasBersih(200000,50000,null),null);
  assert.equal(helper.labelHasilArusKas(false),'Selisih Data yang Terlihat (bukan Arus Kas Bersih)');
  assert.ok(helper.labelHasilArusKas(true).includes('setelah Refund'));
});
pass('Unexpected NaN input does not produce valid net',()=>{
  assert.equal(helper.hitungArusKasBersih(10,NaN,1),null);
});
const base={awal:'2026-11-23',akhir:'2026-11-23',penerimaan:200000,
 pengeluaran:50000,jumlahTransaksi:1,jumlahArsipDemo:0,
 rekap:[{tgl:'2026-11-23',transaksi:1,masuk:200000,keluar:50000,refund:30000}],
 metode:{Cash:120000,QRIS:80000}};
pass('Owner CSV explicitly reports gross, refund and true net',()=>{
 const csv=exportCsv.buatCsvLaporan({...base,refund:30000});
 assert.ok(csv.includes('"Total Refund","30000"'));
 assert.ok(csv.includes('"Arus Kas Bersih (setelah Refund)","120000"'));
 assert.ok(csv.includes('"2026-11-23","1","200000","50000","30000","120000"'));
 assert.ok(!csv.includes('Synthetic Guest Name'));
});
pass('Staff CSV must not call partial cashflow net',()=>{
 const csv=exportCsv.buatCsvLaporan({...base,refund:undefined});
 assert.ok(csv.includes('"Total Refund","Tidak tersedia untuk peran ini"'));
 assert.ok(csv.includes('"Selisih Data yang Terlihat (bukan Arus Kas Bersih)","150000"'));
 assert.ok(csv.includes('"2026-11-23","1","200000","50000","Tidak tersedia","150000"'));
 assert.ok(!csv.includes('"Arus Kas Bersih (setelah Refund)"'));
});
pass('Owner report fetches refund table only for Owner role',()=>{
 assert.ok(report.includes("const isOwner = peran === 'owner'"));
 assert.ok(report.includes("useTable('finance_refunds', isOwner)"));
 assert.ok(report.includes('isOwner ? refunds.rows.filter('));
});
pass('Report counts refund rows in their own WIB report date',()=>{
 assert.ok(report.includes('tanggalLaporan(r.created_at) === tgl'));
 assert.ok(report.includes('refundTotal = isOwner ? refundPeriode.reduce'));
});
pass('Report owner load/error includes refund ledger to avoid misleading zero',()=>{
 assert.ok(report.includes('(isOwner && refunds.loading)'));
 assert.ok(report.includes("isOwner ? refunds.error : ''"));
});
pass('Report uses one corrected net in UI and CSV',()=>{
 assert.ok(report.includes('hitungArusKasBersih(penerimaan, biaya, refundTotal)'));
 assert.ok(report.includes('...(isOwner ? { refund: refundTotal ?? 0 } : {})'));
 assert.ok(report.includes('{labelHasil}'));
});
pass('No effect on physical session Closing, refund posting or payment RPC',()=>{
 assert.ok(!report.includes('close_finance_cash_session'));
 assert.ok(!report.includes('create_finance_refund'));
 assert.ok(!report.includes('record_transaction_payment'));
});
console.log('B25 No6 REPORT REFUND-COVERAGE: '+n+'/'+n+' PASS');
