const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// The application must carry the new RPC arguments before legacy EXECUTE is revoked.
const reservation = read('src/components/formulir-pemesanan.tsx');
const payment = read('src/routes/booking.tsx');

assert.match(reservation, /isTraining\s*\?\s*'create_training_reservation'\s*:\s*'create_reservation'/);
const reservationArgs = reservation.match(/const reservationArgs\s*=\s*\{([\s\S]*?)\n\s*\};/)?.[1];
assert.ok(reservationArgs, 'Reservation RPC argument object not found');
for (const argument of [
  '_mode', '_room_id', '_package_id', '_name', '_phone', '_address',
  '_amount', '_guest_count', '_method', '_day_mode',
  '_idempotency_key', '_session_id',
]) {
  assert.match(reservationArgs, new RegExp(`\\b${argument}\\s*:`), `${argument} missing`);
}
assert.match(reservationArgs, /_scheduled_check_in\s*:/);

assert.match(payment, /isTraining\s*\?\s*'record_training_transaction_payment'\s*:\s*'record_transaction_payment'/);
const paymentArgs = payment.match(/isTraining\s*\?\s*'record_training_transaction_payment'\s*:\s*'record_transaction_payment',\s*\{([\s\S]*?)\n\s*\},/)?.[1];
assert.ok(paymentArgs, 'Payment RPC argument object not found');
for (const argument of ['_transaction_id', '_amount', '_method', '_idempotency_key', '_session_id']) {
  assert.match(paymentArgs, new RegExp(`\\b${argument}\\s*:`), `${argument} missing`);
}

// These two paths are the application's direct callers of the transition RPCs.
// External clients cannot be proved absent by a repository-only test.
console.log('rpc-contract-source-tests: PASS (frontend reservation/payment contracts)');
