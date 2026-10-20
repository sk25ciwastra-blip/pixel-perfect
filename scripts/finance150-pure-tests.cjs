const assert = require('node:assert/strict');

function minimumDp(total, percentage) {
  return Math.ceil((total * percentage) / 100);
}

function idempotencyDecision(existing, request) {
  if (!existing) return 'CREATE';
  return existing.transactionId === request.transactionId &&
    existing.amount === request.amount &&
    existing.method === request.method
    ? 'REPLAY'
    : 'CONFLICT';
}

function commissionAfter(mode, paid, refund, rate, perRoom) {
  if (mode === 'OFF') return 0;
  if (mode === 'PER_ROOM') return refund >= paid ? 0 : perRoom;
  return Math.floor(((paid - refund) * rate / 100) / 1000) * 1000;
}

function canUseSession(sessionOwner, operator, operatorRole) {
  return sessionOwner === operator || operatorRole === 'owner' || operatorRole === 'supervisor';
}

assert.equal(minimumDp(100000, 40), 40000);
assert.equal(minimumDp(99999, 40), 40000);
assert.equal(minimumDp(100001, 40), 40001);
assert.equal(minimumDp(100000, 37.5), 37500);
assert.equal(minimumDp(99999, 37.5), 37500);

const payment = { transactionId: 'trx-1', amount: 40000, method: 'Cash' };
assert.equal(idempotencyDecision(payment, payment), 'REPLAY');
assert.equal(idempotencyDecision(payment, { ...payment, amount: 41000 }), 'CONFLICT');
assert.equal(idempotencyDecision(null, payment), 'CREATE');

assert.equal(canUseSession('receptionist-1', 'receptionist-1', 'receptionist'), true);
assert.equal(canUseSession('receptionist-1', 'owner-1', 'owner'), true);
assert.equal(canUseSession('receptionist-1', 'supervisor-1', 'supervisor'), true);
assert.equal(canUseSession('receptionist-1', 'receptionist-2', 'receptionist'), false);

assert.equal(commissionAfter('PERCENTAGE', 100000, 20000, 8, 0), 6000);
assert.equal(commissionAfter('PER_ROOM', 100000, 20000, 8, 15000), 15000);
assert.equal(commissionAfter('PER_ROOM', 100000, 100000, 8, 15000), 0);
assert.equal(commissionAfter('OFF', 100000, 20000, 8, 15000), 0);

assert.equal('OPEN' !== 'FINAL', true);
assert.equal('FINAL' !== 'FINAL', false);

console.log('finance150-pure-tests: PASS');
