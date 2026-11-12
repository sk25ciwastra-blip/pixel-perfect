// Pure HTML/CSS checks only: no SDK, RPC, Cloud, print request or real printer.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/lib/receipt-print.ts', 'utf8');
const context = { exports: {}, require(name) {
  if (name === '@/lib/data-live') return { rpc() { throw Error('Unexpected RPC'); } };
  if (name === '@/lib/feature-flags') return { featureFlags: { receipt58mm: false } };
  if (name === '@/integrations/supabase/client') return { supabase: { from() { throw Error('Unexpected Cloud read'); } } };
  throw Error(`Unexpected import ${name}`);
} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText, context);
const { receiptHtml, openReceiptPrintPreview } = context.exports;
const format = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
function fixture(type = 'WALK_IN', kind = 'FINAL_PAYMENT') {
  const deposit = kind === 'DEPOSIT';
  return { print_request_id: 'isolated-request', print_no: 1, copy_label: '', status: 'READY',
    template_snapshot: { language: 'en', paper_width_mm: 58,
      blocks: ['header', 'transaction_details', 'description', 'payment_history', 'current_payment', 'totals', 'footer'].map(key => ({ key })),
      header: { title: 'Fixture Homestay', address: 'Fixture address', city: 'Fixture city', whatsapp: 'Fixture contact' },
      footer: { thank_you: type === 'BOOKING' ? 'Thank you for booking' : 'Thank you for your visit' } },
    receipt_snapshot: { transaction_type: type, registration_number: 'FIXTURE-REG', payment_reference: 'fixture-payment-id',
      served_by: { name: 'Fixture operator' }, room: { number: '03', type: 'Fixture room' }, package: 'Paket 2 Jam',
      scheduled_check_in: '2026-11-12T10:00:00+07:00', scheduled_check_out: '2026-11-12T12:00:00+07:00',
      actual_check_in: '2026-11-12T10:03:00+07:00', actual_check_out: '2026-11-12T12:03:00+07:00',
      total_bill: 130000, extra_guest_charge: 50000, extra_guest_count: 1,
      total_paid: deposit ? 52000 : 130000, outstanding_balance: deposit ? 78000 : 0,
      payment_status: deposit ? 'BALANCE DUE' : 'PAID IN FULL',
      current_payment: { kind, amount: deposit ? 52000 : 130000, method: 'QRIS', created_at: 'fixture-current-time' }, payment_history: [] } };
}
function columns(html) {
  assert.match(html, /<table class="description">/);
  assert.match(html, /<th scope="col">DESCRIPTION<\/th><th scope="col">PACKAGE<\/th><th scope="col">AMOUNT<\/th>/);
  assert.match(html, /<td>Room 03<small>Fixture room<\/small><\/td><td>Paket 2 Jam<\/td>/);
  assert.ok(html.includes(`<td class="amount">${format(80000)}</td>`));
  assert.ok(html.includes(`<td class="amount">${format(50000)}</td>`));
  assert.match(html, /Receipt Reference/); assert.match(html, /fixture-payment-id/);
  assert.match(html, /FIXTURE-REG/); assert.match(html, /Fixture operator/);
  assert.equal((html.match(/<article class="receipt">/g) || []).length, 1);
}
test('A WALK-IN full payment: actual times, three columns, Grand Total, strong paid status and footer', () => {
  const data = fixture(), html = receiptHtml(data); columns(html);
  assert.match(html, /Actual Check-in/); assert.match(html, /Estimated Check-out/);
  assert.ok(html.includes(data.receipt_snapshot.actual_check_in));
  assert.doesNotMatch(html, /Scheduled Check-in|PAYMENT HISTORY/);
  assert.match(html, /Grand Total/); assert.match(html, /<div class="payment-status"><strong>PAID IN FULL<\/strong>/);
  assert.match(html, /<footer><strong>Thank you for your visit<\/strong>/);
  assert.match(html, /Payment Method/); assert.match(html, /QRIS/);
});
test('B BOOKING deposit: schedule, charge/deposit/balance, unpaid emphasis and original status', () => {
  const data = fixture('BOOKING', 'DEPOSIT'), html = receiptHtml(data); columns(html);
  assert.match(html, /Scheduled Check-in/); assert.match(html, /Scheduled Check-out/);
  assert.ok(html.includes(data.receipt_snapshot.scheduled_check_out));
  assert.doesNotMatch(html, /Actual Check-in|PAYMENT HISTORY|Grand Total/);
  assert.match(html, /Total Charge/); assert.match(html, /Deposit Paid/); assert.match(html, /Outstanding Balance/);
  assert.ok(html.includes(format(52000))); assert.ok(html.includes(format(78000)));
  assert.match(html, /<strong>NOT PAID IN FULL<\/strong><small>Payment Status: BALANCE DUE/);
  assert.match(html, /Thank you for booking/);
});
test('C BOOKING settlement: prior history separated from current payment, snapshot totals unchanged', () => {
  const data = fixture('BOOKING');
  data.receipt_snapshot.current_payment.amount = 78000;
  data.receipt_snapshot.payment_history = [{ kind: 'dp', amount: 52000, method: 'Cash', created_at: 'fixture-prior-time' }];
  const original = JSON.stringify(data), html = receiptHtml(data); columns(html);
  const history = html.indexOf('<h2>PAYMENT HISTORY</h2>'), current = html.indexOf('<h2>CURRENT PAYMENT</h2>');
  assert.ok(history >= 0 && current > history);
  assert.ok(html.slice(history, current).includes(format(52000)));
  assert.ok(!html.slice(history, current).includes(format(78000)));
  assert.ok(html.slice(current).includes(format(78000)));
  assert.match(html, /Final Payment/); assert.match(html, /Total Paid/);
  assert.match(html, /<strong>PAID IN FULL<\/strong>/);
  assert.equal(JSON.stringify(data), original);
});
test('escape untrusted fields, retain copy numbering, avoid fabricated logo or unknown paid status', () => {
  const data = fixture('BOOKING'); data.print_no = 3; data.copy_label = '<img src=x onerror=alert(1)>';
  data.template_snapshot.header.title = '<script>alert("x")</script>';
  data.receipt_snapshot.room.type = '<svg onload=alert(1)>';
  data.receipt_snapshot.package = '"<&\'';
  data.receipt_snapshot.current_payment.method = '<img src=x>';
  data.receipt_snapshot.payment_status = '<unknown>';
  data.template_snapshot.footer.thank_you = '<b>untrusted</b>';
  const html = receiptHtml(data);
  assert.doesNotMatch(html, /<script|<img|<svg|<b>untrusted/);
  assert.match(html, /&lt;script&gt;/); assert.match(html, /&quot;&lt;&amp;&#39;/);
  assert.match(html, /SALINAN 2\/COPY 2/); assert.match(html, /Printed request #3/);
  assert.match(html, /<strong>&lt;unknown&gt;<\/strong>/);
  assert.doesNotMatch(html, /<strong>PAID IN FULL<\/strong>/);
  data.print_no = 1; assert.doesNotMatch(receiptHtml(data), /class="copy"/);
});
test('preview CSS preserves 58mm, fixed table alignment, dashed separators, emphasized status and per-payment articles', () => {
  let output = '', prints = 0;
  const popup = { closed: false, document: { write(html) { output += html; }, close() {} }, focus() {}, print() { prints++; } };
  openReceiptPrintPreview([fixture(), fixture('BOOKING', 'DEPOSIT'), fixture('BOOKING')], popup);
  assert.match(output, /@page\{size:58mm auto;margin:0\}/);
  assert.match(output, /width:58mm;max-width:58mm/); assert.match(output, /table-layout:fixed/);
  assert.match(output, /border-bottom:1px dashed #000/); assert.match(output, /\.payment-status strong\{[^}]*font-size:14px/);
  assert.match(output, /page-break-after:always/); assert.match(output, /\.receipt:last-child\{page-break-after:auto\}/);
  assert.equal((output.match(/<article class="receipt">/g) || []).length, 3); assert.equal(prints, 1);
});
test('existing template validation and optional history block remain intact', () => {
  const data = fixture(); data.template_snapshot.language = 'id';
  assert.throws(() => receiptHtml(data), /English and 58 mm/);
  data.template_snapshot.language = 'en'; data.template_snapshot.paper_width_mm = 80;
  assert.throws(() => receiptHtml(data), /English and 58 mm/);
  data.template_snapshot.paper_width_mm = 58;
  data.template_snapshot.blocks = data.template_snapshot.blocks.filter(block => block.key !== 'payment_history');
  assert.doesNotThrow(() => receiptHtml(data));
  data.template_snapshot.blocks.pop(); assert.throws(() => receiptHtml(data), /incomplete or invalid/);
});
