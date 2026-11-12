// Pure HTML/CSS checks only: no SDK, RPC, Cloud, print request or real printer.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/lib/receipt-print.ts', 'utf8');
const context = { exports: {}, require(name) {
  if (name === '../assets/receipt-thermal-logo-monochrome.png?inline') return {
    default: 'data:image/png;base64,' + fs.readFileSync('src/assets/receipt-thermal-logo-monochrome.png').toString('base64'),
  };
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
  assert.equal((html.match(/class="thermal-logo"/g) || []).length, 1);
  assert.match(html, /src="data:image\/png;base64,/);
  assert.match(html, /alt="Baturaden 25 Homestay — DAILY &amp; WEEKLY"/);
  assert.match(html, /width="1239" height="496" loading="eager" decoding="sync"/);
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
  assert.match(html, /<footer>.*<strong>Thank you for your visit<\/strong>/);
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
  assert.equal((html.match(/<img /g) || []).length, 1); // Only the trusted local logo.
  assert.doesNotMatch(html.replace(/<img class="thermal-logo"[^>]*>/g, ''), /<script|<img|<svg|<b>untrusted/);
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

test('thermal logo is bounded inside printable header without new page rules or external image requests', () => {
  let output = '';
  const popup = { closed: false, document: { write(html) { output += html; }, close() {} }, focus() {}, print() {} };
  openReceiptPrintPreview([fixture()], popup);
  assert.match(output, /\.thermal-logo\{display:block;width:40mm;max-width:100%;height:auto;max-height:21mm;object-fit:contain/);
  assert.match(output, /margin:0 auto 1mm;break-inside:avoid/);
  assert.match(output, /padding:3mm 2.5mm/); // 53mm inner width > 40mm logo.
  assert.ok(40 * 496 / 1239 < 21);
  assert.equal((output.match(/<img /g) || []).length, 1);
  assert.doesNotMatch(output, /<img[^>]+src="https?:/);
  assert.match(output, /\.receipt:last-child\{page-break-after:auto\}/);
  const bytes = fs.readFileSync('src/assets/receipt-thermal-logo-monochrome.png');
  assert.equal(bytes.readUInt32BE(16), 1239); assert.equal(bytes.readUInt32BE(20), 496);
  assert.equal(bytes[24], 1); assert.equal(bytes[25], 0); // True 1-bit grayscale PNG.
  // Runtime usage must stay confined to the thermal renderer.
  assert.doesNotMatch(fs.readFileSync('src/lib/payment-confirmation-pdf.ts', 'utf8'), /receipt-thermal-logo/);
});

for (const [variant, type, kind] of [['WALK-IN paid', 'WALK_IN', 'FINAL_PAYMENT'],
  ['BOOKING deposit', 'BOOKING', 'DEPOSIT'], ['BOOKING settlement', 'BOOKING', 'FINAL_PAYMENT']]) {
  test('thermal header/footer: ' + variant, () => {
    const data = fixture(type, kind);
    data.template_snapshot.header.whatsapp = '0811669505';
    data.receipt_snapshot.header = { address: 'Historical address', city: 'Historical city', whatsapp: '0811669505' };
    if (variant === 'BOOKING settlement') {
      data.receipt_snapshot.payment_history = [{ kind: 'dp', amount: 52000, created_at: 'dummy-prior-time' }];
      data.receipt_snapshot.current_payment.amount = 78000;
    }
    const before = JSON.stringify(data);
    let html = '';
    openReceiptPrintPreview([data], { closed: false,
      document: { write(value) { html += value; }, close() {} }, focus() {}, print() {} });
    assert.equal(JSON.stringify(data), before); // Contact override never rewrites historical snapshots.
    const header = html.match(/<header>(.*?)<\/header>/s)[1];
    assert.match(header, /<span class="thermal-contact">Jl\. Baturaden Raya No\. 25, Ciwastra<\/span><span>Kota Bandung<\/span><span>WhatsApp: 0811669805<\/span>/);
    assert.doesNotMatch(header, /0811669505|Historical address|Historical city/);
    assert.equal((header.match(/class="thermal-logo"/g) || []).length, 1);
    assert.match(header, /DAILY &amp; WEEKLY/);
    assert.match(html, /\.thermal-logo\{display:block;width:40mm;max-width:100%;height:auto;[^}]*margin:0 auto 1mm/);
    assert.match(html, /header \.thermal-contact,header \.thermal-contact~span\{font-size:10px;line-height:1\.25;color:#000;text-align:center\}/);
    const note = html.match(/<section class="payment-note">(.*?)<\/section>/s)[1];
    assert.equal((html.match(/>CATATAN</g) || []).length, 1);
    assert.equal(note, '<h2>CATATAN</h2><p>Pembayaran yang telah diterima <strong><em>tidak dapat dibatalkan maupun dikembalikan</em></strong> dengan alasan apa pun.</p>');
    assert.match(html, /footer \.payment-note h2\{[^}]*font-weight:700/);
    assert.match(html, /footer \.payment-note strong em\{font-weight:700;font-style:italic\}/);
    const totals = html.indexOf('<section class="totals">'), status = html.indexOf('<div class="payment-status">');
    const footer = html.indexOf('<footer>'), noteAt = html.indexOf('<section class="payment-note">');
    const thanks = html.indexOf('<strong>Thank you', noteAt), request = html.indexOf('Printed request #', thanks);
    assert.ok(totals < status && status < footer && footer < noteAt && noteAt < thanks && thanks < request);
    assert.match(html, /footer\{[^}]*border-top:1px dashed #000/);
    assert.ok(html.includes(kind === 'DEPOSIT' ? '<strong>NOT PAID IN FULL</strong>' : '<strong>PAID IN FULL</strong>'));
    if (variant === 'BOOKING settlement') assert.ok(html.indexOf('PAYMENT HISTORY') < html.indexOf('CURRENT PAYMENT'));
    assert.equal((html.match(/<article class="receipt">/g) || []).length, 1);
  });
}
