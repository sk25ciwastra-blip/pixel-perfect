// Baturaden 25 Homestay: No6 Issue #114, focused offline Closing review.
// Uses synthetic values only; no Cloud connection, no production writes.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync('src/lib/finance-closing-count.ts', 'utf8');
const output = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
}}).outputText;
const mod = { exports: {} };
new Function('module','exports',output)(mod,mod.exports);
const review = mod.exports.reviewClosingCash;
const route = fs.readFileSync('src/routes/keuangan.tsx', 'utf8');
const sql = fs.readFileSync('supabase/migrations/20261123060000_finance_closing_counted_cash.sql', 'utf8');
let count=0;
function check(name, fn){fn();count++;console.log('PASS:',name);}
check('expected Rp97000, counted Rp97000 and matching allocation',()=>{
  assert.deepEqual(review(97000,'97000',97000,''),{ok:true,counted:97000,difference:0});
});
check('cash shortage Rp2000 requires reason and is not clamped',()=>{
  assert.equal(review(97000,'95000',95000,'').ok,false);
  assert.deepEqual(review(97000,'95000',95000,'Selisih fisik'),{ok:true,counted:95000,difference:-2000});
});
check('cash surplus Rp3000 requires reason',()=>{
  assert.deepEqual(review(97000,'100000',100000,'Lebih kas'),{ok:true,counted:100000,difference:3000});
});
check('count 0 with expected 0 passes',()=>{
  assert.deepEqual(review(0,'0',0,''),{ok:true,counted:0,difference:0});
});
check('negative expected -50000 stays negative; counted and allocations zero',()=>{
  assert.deepEqual(review(-50000,'0',0,'Saldo sesi minus'),{ok:true,counted:0,difference:50000});
  assert.equal(review(-50000,'100',100,'audit').ok,false);
});
check('reject missing or malformed counts, unsafe or negative amounts',()=>{
  for (const value of ['', '-1', '1.5', 'abc', 'NaN', 'Infinity', '9007199254740992']) {
    assert.equal(review(100,value,0,'audit').ok,false,value);
  }
  assert.equal(review(null,'100',100,'audit').ok,false);
});
check('allocation cannot exceed physical amount',()=>{
  assert.equal(review(97000,'95000',97000,'Selisih').ok,false);
});
check('UI passes count to server, does not finalize without confirmation',()=>{
  assert.ok(route.includes('reviewClosingCash(expectedCash, physicalCashCount, allocationCash, closingReason)'));
  assert.ok(route.includes('physical_cash_count: counted'));
  assert.ok(route.includes('window.confirm('));
  assert.ok(route.includes('setPhysicalCashCount(\'\')'));
});
check('SQL uses session lock and preserves FINAL guard/actual actor',()=>{
  assert.ok(sql.includes('FOR UPDATE'));
  assert.ok(sql.includes("selected_session.status <> 'OPEN'"));
  assert.ok(sql.includes('auth.uid()'));
  assert.ok(sql.includes("'closed_by', auth.uid()"));
});
check('SQL requires physical count and audits difference in snapshot',()=>{
  assert.ok(sql.includes("_allocation ? 'physical_cash_count'"));
  assert.ok(sql.includes('cash_difference := physical_cash_count - expected_cash'));
  assert.ok(sql.includes("'physical_cash_count', physical_cash_count"));
  assert.ok(sql.includes("'cash_difference', cash_difference"));
  assert.ok(sql.includes('physical_cash_count <> total_allocated'));
});
check('negative Closing keeps expected_cash and zero allocations',()=>{
  assert.ok(sql.includes("IF expected_cash < 0 THEN"));
  assert.ok(sql.includes('IF physical_cash_count <> 0 THEN'));
  assert.ok(sql.includes('IF total_allocated <> 0 THEN'));
  assert.ok(sql.includes("'expected_cash', expected_cash"));
  assert.ok(!sql.includes('GREATEST(expected_cash, 0)'));
});
console.log('B25 No6 Closing physical cash review:',count,'/',count,'PASS');
