const assert = require('node:assert/strict');
const fs = require('node:fs');

const migration = fs.readFileSync(
  'supabase/migrations/20261019000001_harden_checkout_payment_settlement.sql',
  'utf8',
);
const checkout = fs.readFileSync(
  'supabase/migrations/20261005000012_checkout_foundation.sql',
  'utf8',
);
const dashboard = fs.readFileSync('src/routes/index.tsx', 'utf8');

assert.match(migration, /FOR UPDATE/);
assert.match(migration, /SUM\(p\.amount\)/);
assert.match(migration, /SUM\(c\.amount\)/);
assert.match(migration, /SUM\(r\.amount\)/);
assert.match(migration, /net_paid < settlement_due/);
assert.match(migration, /net_paid > settlement_due/);
assert.match(migration, /payments_transaction_state_guard_trigger/);
assert.match(migration, /charge_events_transaction_state_guard_trigger/);
assert.match(migration, /refunds_transaction_state_guard_trigger/);
assert.match(migration, /target_status IN \('check_out', 'cancelled'\)/);
assert.match(migration, /NEW\.transaction_id IS DISTINCT FROM OLD\.transaction_id/);
assert.match(migration, /Settlement tidak dapat dipindahkan ke transaksi lain/);
assert.match(migration, /occupied/);
assert.match(migration, /status = 'dirty'/);
assert.match(migration, /auth\.uid\(\),[\s\S]*'check_out'/);
assert.match(migration, /Hanya transaksi CHECK-IN yang dapat di-check-out/);
assert.match(checkout, /check_out_transaction/);
assert.match(dashboard, /check_out_transaction/);
assert.match(dashboard, /check_out_training_transaction/);

function settlement(price, charges, payments, refunds = []) {
  const due = price + charges.reduce((sum, amount) => sum + amount, 0);
  const net = payments.reduce((sum, amount) => sum + amount, 0) - refunds.reduce((sum, amount) => sum + amount, 0);
  if (net < due) return 'underpaid';
  if (net > due) return 'overpaid';
  return 'settled';
}

assert.equal(settlement(1000, [], []), 'underpaid');
assert.equal(settlement(1000, [], [400]), 'underpaid');
assert.equal(settlement(1000, [], [400, 600]), 'settled');
assert.equal(settlement(1000, [], [1001]), 'overpaid');
assert.equal(settlement(1000, [250], [1250]), 'settled');
assert.equal(settlement(1000, [], [1000], [200]), 'underpaid');

console.log('checkout-hardening-pure-tests: PASS');
