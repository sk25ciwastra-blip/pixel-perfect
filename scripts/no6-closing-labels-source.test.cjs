// Baturaden 25 Homestay — source-level closing presentation guard, no Cloud writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const finance = fs.readFileSync('src/routes/keuangan.tsx', 'utf8');
const chart = fs.readFileSync('src/components/keuangan-arus.tsx', 'utf8');
const cases = [
  ['gross cash no longer called physical counted cash', () => {
    assert.ok(finance.includes('Penerimaan Cash (Tercatat)'));
    assert.ok(!finance.includes('Total Cash (Fisik)'));
  }],
  ['expected cash remains separate from gross cash', () => {
    assert.ok(finance.includes('Saldo Cash yang diharapkan:'));
    assert.ok(finance.includes('rupiah(expectedCash)'));
    assert.ok(finance.includes('const totalCash = Number(summary[\'cash\'] ?? 0)'));
  }],
  ['closing RPC and negative cash protection preserved', () => {
    assert.ok(finance.includes("rpc('close_finance_cash_session'"));
    assert.ok(finance.includes('cashDeficit ? 0 : angka(setorCash)'));
    assert.ok(finance.includes('cashDeficit ? 0 : angka(diLaci)'));
    assert.ok(finance.includes('cashDeficit ? 0 : angka(dibawa)'));
    assert.ok(finance.includes('readOnly'));
  }],
  ['actor fallback distinguishes absent audit id from unresolved employee', () => {
    assert.ok(finance.includes("'Petugas tidak tercatat (historis)'"));
    assert.ok(finance.includes("'Profil petugas tidak tersedia'"));
    assert.ok(finance.includes('payment.recorded_by'));
  }],
  ['chart does not claim business net while excluding refunds', () => {
    assert.ok(chart.includes('Selisih Sesi (Belum Refund)'));
    assert.ok(!chart.includes('name="Arus Kas Bersih"'));
    assert.ok(!chart.includes('>Arus Kas Bersih</li>'));
  }],
];
for (const [name, run] of cases) { run(); console.log('PASS:', name); }
console.log(`No6 Closing UI source guard: ${cases.length}/${cases.length} PASS`);
