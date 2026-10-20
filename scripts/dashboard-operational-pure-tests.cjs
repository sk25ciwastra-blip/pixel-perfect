const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('src/routes/index.tsx', 'utf8');

assert.match(source, /<table className=/);
assert.match(source, /item\.status === "check_in"/);
assert.match(source, /item\.room\.status === "occupied"/);
assert.match(source, /<Eye className=/);
assert.match(source, /<MessageCircle className=/);
assert.match(source, /<LogOut className=/);
assert.match(source, /check_out_transaction/);
assert.match(source, /check_out_training_transaction/);
assert.match(source, /window\.confirm/);
assert.match(source, /openWhatsApp\(guest\.phone/);
assert.match(source, /disabled={!phoneValid}/);
assert.doesNotMatch(source, /<img[\s>]/i);
assert.doesNotMatch(source, /Booking Berikutnya/);

const rows = [
  { status: 'check_in', room: { active: true, status: 'occupied' }, endsAtMs: 20 },
  { status: 'booking', room: { active: true, status: 'occupied' }, endsAtMs: 1 },
  { status: 'check_in', room: { active: true, status: 'ready' }, endsAtMs: 2 },
  { status: 'check_in', room: { active: true, status: 'dirty' }, endsAtMs: 3 },
  { status: 'check_in', room: { active: true, status: 'occupied' }, endsAtMs: -1 },
];

const visible = rows
  .filter((row) => row.status === 'check_in')
  .filter((row) => row.room.active && row.room.status === 'occupied')
  .sort((a, b) => a.endsAtMs - b.endsAtMs);

assert.deepEqual(visible.map((row) => row.endsAtMs), [-1, 20]);
assert.match('WAKTU HABIS', /HABIS/);
assert.equal(/^62\d{8,13}$/.test('628123456789'), true);
assert.equal(/^62\d{8,13}$/.test('081234'), false);

console.log('dashboard-operational-pure-tests: PASS');
