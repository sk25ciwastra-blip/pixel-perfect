const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// This is a source-order guard only. It never connects to a database or runs SQL.
const migrationDir = path.resolve(__dirname, '..', 'supabase', 'migrations');
const migration = name => path.join(migrationDir, name + '.sql');

const phases = [
  {
    name: 'Training',
    files: ['20261018000000_finance_training_enforcement'],
  },
  {
    name: 'Extra Guest and Receipt foundation',
    files: ['20261022000000_extra_guest_receipt_foundation'],
  },
  {
    name: 'Receipt 58mm',
    files: ['20261022000001_receipt_thermal_58mm'],
  },
  {
    name: 'Booking time enforcement',
    files: ['20261022000002_booking_time_dashboard_enforcement'],
  },
  {
    name: 'Hardening',
    files: ['20261022000003_extra_guest_receipt_hardening'],
  },
];

const deferredLegacy = '20261022000004_revoke_legacy_rpc_execute';
const excludedP4 = '20261006000010_correct_p4_prices';

function checkOrder(groups) {
  const files = groups.flatMap(group => group.files);
  assert.equal(new Set(files).size, files.length, 'Duplicate migration in phase list');
  assert.ok(!files.includes(deferredLegacy), 'Legacy revoke must remain outside additive phases');
  assert.ok(!files.includes(excludedP4), 'Conflicting P4 price migration remains blocked');
  for (const file of files) {
    assert.match(file, /^\d{14}_[a-z0-9_]+$/, `Invalid migration name: ${file}`);
    assert.ok(fs.existsSync(migration(file)), `Missing migration: ${file}`);
  }
  assert.ok(fs.existsSync(migration(deferredLegacy)), 'Missing deferred legacy revoke migration');
  const versions = files.map(file => file.slice(0, 14));
  assert.deepEqual(versions, [...versions].sort(), 'Additive migration versions out of order');
  return files;
}

const files = checkOrder(phases);
assert.equal(files.length, 5);
console.log('cloud-activation-order-guard: PASS (5 additive migrations in order)');
console.log('DEFERRED:', deferredLegacy, '(requires external caller clearance)');
console.log('BLOCKED:', excludedP4, '(conflicts with Owner pricing)');
console.log('NO-GO: independent restore proof, target preflight, prerequisites and Owner approval remain required.');

module.exports = { checkOrder, phases };
