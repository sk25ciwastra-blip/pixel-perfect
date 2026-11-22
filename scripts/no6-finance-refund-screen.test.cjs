// Baturaden 25 Homestay No.6 — non-destructive Finance UI eligibility tests.
// Server has separate, more restrictive authorization; these checks ensure the
// Owner form does not offer known-forbidden Booking and FINAL source options.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const tsText = fs.readFileSync('src/lib/finance-refund-eligibility.ts', 'utf8');
const js = ts.transpileModule(tsText, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { canRefundTransactionStatus, canSourceRefundFromSession } = mod.exports;
const code = fs.readFileSync('src/routes/keuangan.tsx', 'utf8');

let passed = 0;
function test(title, action) { action(); passed++; console.log('PASS: ' + title); }

test('Booking payment never selectable for Owner Refund', () => {
  assert.equal(canRefundTransactionStatus('booking'), false);
});
test('Administratively cancelled Booking never selectable', () => {
  assert.equal(canRefundTransactionStatus('cancelled'), false);
});
test('Eligible Check-in transaction remains selectable', () => {
  assert.equal(canRefundTransactionStatus('check_in'), true);
});
test('Owner refund after Checkout remains available', () => {
  assert.equal(canRefundTransactionStatus('check_out'), true);
});
test('Unknown status fails closed, preventing accidental refund', () => {
  for (const x of ['', 'CHECK_OUT', 'FINAL', 'active', null, undefined]) assert.equal(canRefundTransactionStatus(x), false);
});
test('Only OPEN source sessions appear for SHIFT_CASH/DRAWER', () => {
  assert.equal(canSourceRefundFromSession('OPEN'), true);
  for (const x of ['FINAL', 'CLOSED', 'open', '', null, undefined]) assert.equal(canSourceRefundFromSession(x), false);
});
test('Owner refund dropdown uses status guards for both options', () => {
  assert.ok(code.includes('transactions.rows.filter((transaction) => canRefundTransactionStatus(transaction.status))'));
  assert.ok(code.includes('sessions.rows.filter((session) => canSourceRefundFromSession(session.status))'));
  assert.ok(code.includes('Pilih Transaksi Check-in / Selesai'));
});
test('Client rejects stale status and stale FINAL selection before RPC', () => {
  assert.ok(code.includes('!canRefundTransactionStatus(target.status)'));
  assert.ok(code.includes('!sessions.rows.some((session) => session.id === refundSourceSessionId &&'));
  assert.ok(code.includes('canSourceRefundFromSession(session.status)'));
});
test('Backend contract preserved: Owner RPC and source type unchanged', () => {
  assert.ok(code.includes("rpc('create_finance_refund'"));
  assert.ok(code.includes("_source_type: refundSourceType"));
  assert.ok(code.includes("_source_session_id: refundSourceType === 'OWNER_FUNDS' ? null : refundSourceSessionId || null"));
  assert.ok(code.includes('setMessage('));
});
test('Booking non-refundable and FINAL unsupported messages are specific', () => {
  assert.ok(code.includes('Pembayaran Booking tidak dapat direfund'));
  assert.ok(code.includes('Sesi FINAL tidak boleh dipilih'));
  assert.ok(!code.includes('Contoh: Pembatalan oleh tamu'));
});
console.log('B25 NO6 REFUND SCREEN ELIGIBILITY: ' + passed + '/' + passed + ' PASS');
