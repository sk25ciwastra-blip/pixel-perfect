import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settings = readFileSync('src/routes/pengaturan.tsx', 'utf8');
const page = readFileSync('src/routes/pengaturan-metode-pembayaran.tsx', 'utf8');
const finance = readFileSync('src/routes/pengaturan-keuangan.tsx', 'utf8');

test('Owner methods settings route is real, not dead card', () => {
  assert.match(settings, /label: "Metode Pembayaran"[^\n]*ke: "\/pengaturan-metode-pembayaran"/);
  assert.match(settings, /peran === "owner" \? kelompok/);
  assert.match(page, /if \(!owner\) return/);
  assert.match(page, /useTable\('finance_bank_accounts', owner\)/);
  assert.match(page, /to="\/pengaturan-keuangan"/);
  assert.match(finance, /upsert_finance_bank_account/);
});
test('payment overview does not claim to modify acceptance or combined flags', () => {
  assert.match(page, /featureFlags\.combinedPayment/);
  assert.match(page, /Cash/);
  assert.match(page, /QRIS/);
  assert.match(page, /Transfer/);
  assert.doesNotMatch(page, /supabase\.from\(/);
  assert.doesNotMatch(page, /\.update\(|\.insert\(|\.delete\(/);
  assert.doesNotMatch(page, /set_feature_flag|set_payment_method_active|toggle_payment_method/i);
});
