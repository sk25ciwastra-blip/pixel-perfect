// Baturaden 25 Homestay No.6: read-only verification of Setoran frontend guards.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const s = fs.readFileSync('src/routes/keuangan.tsx','utf8');
const section=s.slice(s.indexOf('  async function submitDeposit()'),s.indexOf('  async function refund()'));
assert.ok(section.includes("Number.isSafeInteger(amount) || amount <= 0"));
assert.ok(section.includes("depositMethod === 'Transfer'"));
assert.ok(section.includes("bank.active && bank.id === depositBankId"));
assert.ok(section.includes("!depositProof.trim()"));
assert.ok(section.includes("Metode Transfer memerlukan rekening Owner aktif"));
assert.ok(s.includes("Belum ada rekening Owner aktif. Setoran Transfer belum dapat diajukan"));
assert.ok(s.includes("disabled={busy || (depositMethod === 'Transfer' && !banks.rows.some((bank) => bank.active))}"));
assert.ok(section.includes("rpc(isTraining ? 'create_training_finance_deposit' : 'create_finance_deposit'"));
console.log('No6 Setoran Transfer guard: 8/8 PASS, no database or session mutation');
