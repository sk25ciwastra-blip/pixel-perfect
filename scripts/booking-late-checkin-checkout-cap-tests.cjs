// Isolated PostgreSQL regression for Owner correction #46. Never connects to Cloud.
// Usage: node scripts/booking-late-checkin-checkout-cap-tests.cjs <local-pg-bin>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const postgres = require('postgres');
const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const pendingPath = 'supabase/pending/20261112_booking_late_checkin_checkout_cap.sql';
const old = read('supabase/pending/20261112_booking_checkin_actual_duration.sql');
const pending = read(pendingPath);
const durationBlock = /(?<=  IF is_duration_package THEN\n)[\s\S]*?(?=  ELSE\n    -- Pagi)/;
// All guards, fixed-mode code, updates, locks, grants and pre/post checks must match.
assert.equal(pending.slice(pending.indexOf('BEGIN;')).replace(durationBlock, '<duration>'),
  old.slice(old.indexOf('BEGIN;')).replace(durationBlock, '<duration>'));
assert.match(pending.match(durationBlock)[0], /SELECT LEAST\(t.ends_at, selected_transaction.scheduled_check_out\)/);
assert.match(pending.match(durationBlock)[0], /calculate_package_stay_times\(selected_transaction.package_id, server_now\)/);
console.log('PASS: only duration branch changed; all other function code and grants preserved');

const pgBin = process.argv[2];
if (!pgBin || !fs.existsSync(path.join(pgBin, 'initdb.exe'))) {
  console.error('NOT REACHED: supply an existing local PostgreSQL bin directory; no downloads are performed.');
  process.exit(1);
}
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'booking-checkout-cap-'));
const cluster = path.join(root, 'cluster');
const port = 55450;
const run = (exe, args) => execFileSync(path.join(pgBin, `${exe}.exe`), args, {
  windowsHide: true, stdio: 'ignore', timeout: 30000,
});
let started = false;
let sql;
const id = '00000000-0000-0000-0000-000000000001';
const otherId = '00000000-0000-0000-0000-000000000002';
const stamp = (value) => value.includes('2026-') ? value : `2026-11-12 ${value}:00+07`;

(async () => {
  run('initdb', ['-D', cluster, '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '--no-locale']);
  run('pg_ctl', ['-D', cluster, '-l', path.join(root, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  started = true;
  sql = postgres({ host: '127.0.0.1', port, database: 'postgres', username: 'postgres', max: 1, onnotice: () => {} });
  // Minimal local fixtures. Auth/session helpers are stubs, not a full RLS or audit E2E.
  await sql.unsafe(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${id}'::uuid $$;
    CREATE FUNCTION public.finance_is_booking_operator(uuid) RETURNS boolean LANGUAGE sql AS
      $$ SELECT current_setting('test.allowed', true) = 'yes' $$;
    CREATE FUNCTION public.finance_training_session_is_valid(uuid, uuid) RETURNS boolean LANGUAGE sql AS
      $$ SELECT current_setting('test.training_valid', true) = 'yes' $$;
    CREATE TABLE rooms (id uuid PRIMARY KEY, active boolean, status text);
    CREATE TABLE packages (id uuid PRIMARY KEY, name text, active boolean, time_mode text,
      duration_minutes integer, checkin_start_time time, checkin_end_time time, checkout_time time);
    CREATE TABLE transactions (id uuid PRIMARY KEY, transaction_number text, guest_id uuid,
      room_id uuid, package_id uuid, status text, price_snapshot numeric, day_mode text,
      scheduled_check_in timestamptz, scheduled_check_out timestamptz, started_at timestamptz, ends_at timestamptz);
    CREATE TABLE payments (transaction_id uuid, amount numeric);
    -- Earlier migrations already provide this signature before the preflight.
    CREATE FUNCTION public.check_in_booking(uuid) RETURNS text LANGUAGE sql AS $$ SELECT ''::text $$;
  `);
  await sql.unsafe(read('supabase/migrations/20261003000002_package_time_engine.sql'));
  // Install previous definition for preflight, then apply pending SQL twice to prove idempotency.
  await sql.unsafe(old);
  await sql.unsafe(pending);
  await sql.unsafe(pending);
  console.log('PASS: pending SQL compiles and reapplies idempotently in fresh local PostgreSQL');
  // Deterministic test clock: replace ONLY the server_now initializer in the local copy.
  // Production pending SQL retains now(); no production clock or package rules are changed.
  assert.equal(pending.split('server_now timestamptz := now();').length, 2);
  await sql.unsafe(pending.replace('server_now timestamptz := now();',
    "server_now timestamptz := current_setting('test.server_now')::timestamptz;"));
  const trainingSource = read('supabase/migrations/20261018000000_finance_training_enforcement.sql');
  const wrapper = trainingSource.match(/CREATE OR REPLACE FUNCTION public\.check_in_training_booking\([\s\S]*?\$function\$;/)[0];
  await sql.unsafe(wrapper);

  async function seed({ actual = '07:13', mode = 'duration_midnight_cap', minutes = 120,
    scheduled = '06:58', scheduledEnd = '08:58', paid = 80000, ready = true } = {}) {
    await sql`TRUNCATE payments, transactions, rooms, packages`;
    await sql`SELECT set_config('test.allowed', 'yes', false), set_config('test.training_valid', 'yes', false),
      set_config('test.server_now', ${stamp(actual)}, false)`;
    await sql`INSERT INTO rooms VALUES (${id}, true, ${ready ? 'ready' : 'occupied'})`;
    await sql`INSERT INTO packages VALUES (${id}, 'Isolated package', true, ${mode}, ${minutes}, '06:00', '23:30', '16:00')`;
    await sql`INSERT INTO transactions VALUES (${id}, 'ISOLATED-TRX', ${id}, ${id}, ${id}, 'booking',
      80000, 'weekday', ${stamp(scheduled)}, ${stamp(scheduledEnd)}, NULL, NULL)`;
    await sql`INSERT INTO payments VALUES (${id}, ${paid})`;
  }
  async function checkEnd(options, expected, training = false) {
    await seed(options);
    const result = training
      ? await sql`SELECT check_in_training_booking(${id}, ${id}) AS number`
      : await sql`SELECT check_in_booking(${id}) AS number`;
    assert.equal(result[0].number, 'ISOLATED-TRX');
    const [row] = await sql`SELECT *, (SELECT status FROM rooms WHERE id = ${id}) AS room_status FROM transactions`;
    assert.equal(row.id, id);
    assert.equal(row.transaction_number, 'ISOLATED-TRX');
    assert.equal(row.started_at.toISOString(), new Date(stamp(options.actual)).toISOString());
    assert.equal(row.ends_at.toISOString(), new Date(expected).toISOString());
    assert.equal(row.scheduled_check_in.toISOString(), new Date(stamp(options.scheduled || '06:58')).toISOString());
    assert.equal(row.scheduled_check_out.toISOString(), new Date(stamp(options.scheduledEnd || '08:58')).toISOString());
    assert.equal(row.status, 'check_in');
    assert.equal(row.room_status, 'occupied');
    assert.ok(row.ends_at > row.started_at);
    // A shortened stay retains the full stored price and payment, never prorated.
    assert.equal(Number(row.price_snapshot), 80000);
    const [payment] = await sql`SELECT SUM(amount) AS total FROM payments WHERE transaction_id = ${id}`;
    assert.equal(Number(payment.total), 80000);
  }
  async function rejected(message, training = false) {
    await assert.rejects(training
      ? sql`SELECT check_in_training_booking(${id}, ${id})`
      : sql`SELECT check_in_booking(${id})`, (error) => error.message.includes(message));
    const [row] = await sql`SELECT status, started_at, ends_at FROM transactions WHERE id = ${id}`;
    assert.equal(row.status, 'booking');
    assert.equal(row.started_at, null);
    assert.equal(row.ends_at, null);
  }
  await checkEnd({ actual: '06:50' }, stamp('08:50'));
  await checkEnd({ actual: '06:58' }, stamp('08:58'));
  await checkEnd({ actual: '07:13' }, stamp('08:58'));
  // A schedule shorter than the normal package is still valid, including early arrival.
  await checkEnd({ actual: '07:13', scheduledEnd: '07:30' }, stamp('07:30'));
  await checkEnd({ actual: '06:50', scheduledEnd: '07:30' }, stamp('07:30'));
  for (const minutes of [120, 240, 360]) {
    await checkEnd({ actual: '23:00', minutes, scheduled: '22:00',
      scheduledEnd: '2026-11-13 01:00:00+07' }, '2026-11-13 00:00:00+07');
    await checkEnd({ actual: '23:00', minutes, scheduled: '22:00', scheduledEnd: '23:30' }, stamp('23:30'));
  }
  for (const minutes of [720, 1440]) {
    const scheduledEnd = minutes === 720 ? stamp('18:58') : '2026-11-13 06:58:00+07';
    await checkEnd({ actual: '06:50', mode: 'duration', minutes, scheduledEnd },
      minutes === 720 ? stamp('18:50') : '2026-11-13 06:50:00+07');
    await checkEnd({ actual: '07:13', mode: 'duration', minutes, scheduledEnd }, scheduledEnd);
  }
  await checkEnd({ actual: '07:05', mode: 'fixed_window' }, stamp('16:00'));
  await checkEnd({ actual: '07:05', mode: 'fixed_days_checkout', minutes: 1440 }, '2026-11-13 16:00:00+07');
  console.log('PASS: P2 early/on-time/late; shortened schedule without proration; P2/P4/P6 midnight vs schedule caps; P12/P24 early/late; fixed modes; same TRX/history');
  await checkEnd({ actual: '07:13' }, stamp('08:58'), true);
  await seed();
  await sql`SELECT set_config('test.training_valid', 'no', false)`;
  await rejected('Training wajib', true);
  console.log('PASS: unchanged training wrapper delegates capped checkout and retains session gate (stubbed helper)');
  for (const paid of [32000, 80001]) {
    await seed({ paid });
    await rejected(paid < 80000 ? 'Sisa pembayaran' : 'melebihi tagihan');
  }
  for (const status of ['booking', 'check_in']) {
    await seed();
    // 08:57 overlaps the capped end and must still reject.
    await sql`INSERT INTO transactions (id, room_id, status, scheduled_check_in, scheduled_check_out, started_at, ends_at)
      VALUES (${otherId}, ${id}, ${status}, ${stamp('08:57')}, ${stamp('10:00')}, ${stamp('08:57')}, ${stamp('10:00')})`;
    await rejected('Jadwal kamar bentrok');
    for (const nextStart of ['08:58', '09:00']) {
      await seed();
      // At/after 08:58 there is no overlap, even though full late duration would end 09:13.
      await sql`INSERT INTO transactions (id, room_id, status, scheduled_check_in, scheduled_check_out, started_at, ends_at)
        VALUES (${otherId}, ${id}, ${status}, ${stamp(nextStart)}, ${stamp('10:00')}, ${stamp(nextStart)}, ${stamp('10:00')})`;
      const [result] = await sql`SELECT check_in_booking(${id}) AS number`;
      assert.equal(result.number, 'ISOLATED-TRX');
      const [stay] = await sql`SELECT ends_at FROM transactions WHERE id = ${id}`;
      assert.equal(stay.ends_at.toISOString(), new Date(stamp('08:58')).toISOString());
    }
  }
  await seed({ ready: false }); await rejected('Kamar tidak tersedia');
  for (const actual of ['08:58', '09:00']) {
    await seed({ actual }); await rejected('Booking sudah kedaluwarsa');
  }
  await seed();
  await sql`SELECT set_config('test.allowed', 'no', false)`;
  await rejected('Akses ditolak');
  await seed({ actual: '05:59' }); await rejected('Check-in di luar jam');
  await seed();
  await sql`UPDATE transactions SET scheduled_check_out = scheduled_check_in`;
  await rejected('Jadwal check-in/check-out booking belum valid');
  await seed(); await sql`SELECT check_in_booking(${id})`;
  await assert.rejects(sql`SELECT check_in_booking(${id})`, /Transaksi tidak dapat di-check-in/);
  console.log('PASS: full payment, overpayment, booking/stay overlap, room-ready, expired boundary, auth gate, package window, invalid schedule, duplicate check-in');
  console.log('NOT REACHED: Cloud migration, browser E2E, full production auth/RLS/audit/session integration and concurrent-client locking.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (sql) await sql.end({ timeout: 5 });
  if (started) run('pg_ctl', ['-D', cluster, '-m', 'fast', '-w', 'stop']);
  console.log(`Local test artifacts: ${root}`);
});
