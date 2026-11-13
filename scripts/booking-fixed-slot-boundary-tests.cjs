// Isolated PostgreSQL runtime: dummy rows only, no network/database credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Reuse the isolated pinned fixture dependency; never install into the application.
const { PGlite } = require(process.env.BTRD25_PGLITE_MODULE || path.join(require('node:os').tmpdir(), 'BTRD25-pdf-db-test/node_modules/@electric-sql/pglite'));
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const baseline = read('supabase/pending/20261112_booking_late_checkin_checkout_cap.sql');
const candidate = read('supabase/pending/20261113145045_booking_fixed_slot_boundary.sql');
const added = /\n\n    -- Fixed-window arrivals must belong to the booked WIB slot\.\n    IF selected_package.time_mode = 'fixed_window'\n       AND actual_ends_at IS DISTINCT FROM selected_transaction.scheduled_check_out THEN\n      RAISE EXCEPTION 'Check-in harus berada pada slot waktu booking yang sama';\n    END IF;/;
// All existing function logic, including duration/payment/overlap/auth guards, stays identical.
assert.equal(candidate.replace(added, '').slice(candidate.indexOf('BEGIN;')), baseline.slice(baseline.indexOf('BEGIN;')));
const fixtureClock = sql => sql.replace('server_now timestamptz := now();', "server_now timestamptz := current_setting('test.server_now')::timestamptz;");
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${id(9)}'::uuid$$;
      CREATE FUNCTION public.finance_is_booking_operator(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
      CREATE TABLE rooms(id uuid PRIMARY KEY, active boolean, status text);
      CREATE TABLE packages(id uuid PRIMARY KEY,name text,active boolean,time_mode text,duration_minutes int,checkin_start_time time,checkin_end_time time,checkout_time time);
      CREATE TABLE transactions(id uuid PRIMARY KEY,transaction_number text,guest_id uuid,room_id uuid,package_id uuid,status text,price_snapshot numeric,day_mode text,scheduled_check_in timestamptz,scheduled_check_out timestamptz,started_at timestamptz,ends_at timestamptz);
      CREATE TABLE payments(transaction_id uuid,amount numeric);
      CREATE FUNCTION public.check_in_booking(uuid) RETURNS text LANGUAGE sql AS $$SELECT 'stub'::text$$;`);
    await db.exec(read('supabase/migrations/20261003000002_package_time_engine.sql'));
    await db.exec(fixtureClock(baseline));
    const seed = async (pkg, scheduled, actual) => {
      await db.exec('TRUNCATE payments, transactions, rooms, packages;');
      await db.query('INSERT INTO packages VALUES ($1,$2,true,\'fixed_window\',450,$3,$4,$5)', [id(1), pkg[0], ...pkg.slice(1)]);
      await db.query('INSERT INTO rooms VALUES ($1,true,\'ready\')', [id(2)]);
      await db.query(`INSERT INTO transactions SELECT $1,'DUMMY', $2,$3,$4,'booking',100,'weekday',$5::timestamptz,t.ends_at,NULL,NULL FROM public.calculate_package_stay_times($4,$5::timestamptz) t`, [id(3),id(9),id(2),id(1),scheduled]);
      await db.query('INSERT INTO payments VALUES ($1,100)', [id(3)]);
      await db.query("SELECT set_config('test.server_now',$1,false)", [actual]);
    };
    const pagi = ['Pagi','08:00','12:00','16:00'];
    const malam = ['Malam','21:30','04:00','08:00'];
    const harian = ['Harian','12:00','04:00','12:00'];
    await seed(malam,'2026-11-13T22:00:00+07:00','2026-11-13T02:00:00+07:00');
    await db.query('SELECT public.check_in_booking($1)',[id(3)]);
    assert.equal((await db.query('SELECT ends_at <> scheduled_check_out AS wrong FROM transactions')).rows[0].wrong,true);
    console.log('PASS baseline reproduces earlier-slot checkout mismatch');
    await db.exec(fixtureClock(candidate));
    const cases = [
      [pagi,'2026-11-13T08:30:00+07:00','2026-11-13T08:00:00+07:00',true],
      [pagi,'2026-11-14T08:30:00+07:00','2026-11-13T09:00:00+07:00',false],
      [malam,'2026-11-13T22:00:00+07:00','2026-11-13T21:30:00+07:00',true],
      [malam,'2026-11-13T22:00:00+07:00','2026-11-14T00:00:00+07:00',true],
      [malam,'2026-11-13T22:00:00+07:00','2026-11-14T04:00:00+07:00',true],
      [malam,'2026-11-13T22:00:00+07:00','2026-11-13T02:00:00+07:00',false],
      [harian,'2026-11-13T13:00:00+07:00','2026-11-13T12:00:00+07:00',true],
      [harian,'2026-11-13T13:00:00+07:00','2026-11-14T02:00:00+07:00',true],
      [harian,'2026-11-13T13:00:00+07:00','2026-11-13T02:00:00+07:00',false],
      [malam,'2026-12-31T22:00:00+07:00','2027-01-01T00:00:00+07:00',true],
      [harian,'2026-11-30T13:00:00+07:00','2026-12-01T00:00:00+07:00',true],
    ];
    for (const [pkg,scheduled,actual,allowed] of cases) {
      await seed(pkg,scheduled,actual);
      const endDay = new Date(`${scheduled.slice(0,10)}T00:00:00Z`);
      if (pkg !== pagi) endDay.setUTCDate(endDay.getUTCDate() + 1);
      const expectedEnd = new Date(`${endDay.toISOString().slice(0,10)}T${pkg[3]}:00+07:00`).toISOString();
      assert.equal(new Date((await db.query('SELECT scheduled_check_out FROM transactions')).rows[0].scheduled_check_out).toISOString(), expectedEnd);
      const snapshot = async () => JSON.stringify((await db.query('SELECT * FROM transactions')).rows);
      const before = await snapshot();
      if (allowed) {
        await db.query('SELECT public.check_in_booking($1)',[id(3)]);
        const row = (await db.query('SELECT *, ends_at = scheduled_check_out AS same_slot FROM transactions')).rows[0];
        assert.equal(row.same_slot,true); assert.equal(row.status,'check_in');
        assert.equal(row.price_snapshot,'100');
      } else {
        await assert.rejects(db.query('SELECT public.check_in_booking($1)',[id(3)]), /slot waktu booking yang sama/);
        assert.equal(await snapshot(), before);
        assert.equal((await db.query('SELECT status FROM rooms')).rows[0].status,'ready');
      }
      assert.equal((await db.query('SELECT count(*)::int AS n FROM payments')).rows[0].n,1);
      console.log(`PASS ${pkg[0]} ${actual} ${allowed ? 'same slot' : 'wrong slot denied without mutation'}`);
    }
    console.log('PASS only fixed-window guard differs from approved baseline; 11 regression cases');
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
