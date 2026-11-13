// No Cloud connection, accounts, JWTs or production records: in-memory PostgreSQL only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.BTRD25_PGLITE_MODULE || path.join(require('node:os').tmpdir(), 'BTRD25-pdf-db-test/node_modules/@electric-sql/pglite'));
const read = p => fs.readFileSync(p, 'utf8');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const ts = require('typescript');
const compiled = ts.transpileModule(read('src/lib/room-overtime.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const helper = { exports: {} };
new Function('exports', compiled)(helper.exports);
const indicator = helper.exports.roomOvertimeIndicator;
const now = '2026-11-13T17:00:00+07:00';
const end = '2026-11-13T15:00:00+07:00';
for (const [delta, expected] of [[-1,false],[0,false],[1,true]]) {
  const result = indicator({status:'check_in', ends_at:end}, Date.parse(now)+delta);
  assert.equal(result.needsAction,expected);
  assert.equal(result.excludeFromRoomStatus,expected);
  assert.equal(result.cardIndicator,expected?'red':null);
  assert.equal(result.area,expected?'PERLU TINDAKAN':null);
}
assert.equal(indicator({status:'booking',ends_at:end},Date.parse(now)+1).needsAction,false);
assert.equal(indicator({status:'check_out',ends_at:end},Date.parse(now)+1).needsAction,false);
for (const invalid of [null,'invalid']) {
  assert.equal(indicator({status:'check_in',ends_at:invalid},Date.parse(now)).deadlineKnown,false);
}
assert.equal(indicator({status:'check_in',ends_at:end},NaN).needsAction,false);
assert.equal(indicator({status:'check_in',ends_at:'2026-12-31T23:00:00+07:00'}, Date.parse('2027-01-01T01:00:00.001+07:00')).needsAction,true);
console.log('PASS strict threshold, WIB year rollover, inactive/invalid presentation data');

(async () => {
  const db = new PGlite();
  const migration = read('supabase/pending/20261113150233_overtime_walkin_guard.sql');
  assert.match(migration,/SET search_path = ''/);
  assert.doesNotMatch(migration,/UPDATE public\.(rooms|transactions)|DELETE FROM|CREATE OR REPLACE FUNCTION public\.(create_reservation|check_in_booking)/i);
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TYPE public.app_role AS ENUM ('owner','staff');
      CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
      CREATE TABLE public.finance_training_assignments(trainee_user_id uuid,status text,starts_on date,created_at timestamptz DEFAULT now());
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
      CREATE TABLE public.rooms(id uuid PRIMARY KEY, active boolean DEFAULT true, status text DEFAULT 'ready');
      CREATE TABLE public.packages(id uuid PRIMARY KEY,name text,active boolean,time_mode text,duration_minutes int,checkin_start_time time,checkin_end_time time,checkout_time time);
      CREATE TABLE public.transactions(id uuid PRIMARY KEY,transaction_number text,guest_id uuid,room_id uuid REFERENCES rooms(id),package_id uuid,status text,price_snapshot numeric,day_mode text,scheduled_check_in timestamptz,scheduled_check_out timestamptz,started_at timestamptz,ends_at timestamptz);
      CREATE TABLE public.payments(transaction_id uuid,amount numeric);
      CREATE FUNCTION public.finance_is_booking_operator(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
      CREATE FUNCTION public.check_in_booking(uuid) RETURNS text LANGUAGE sql AS $$SELECT 'stub'::text$$;
      GRANT USAGE ON SCHEMA auth TO authenticated,anon;
      GRANT SELECT,INSERT,UPDATE ON public.transactions TO authenticated;
      GRANT SELECT,UPDATE ON public.rooms TO authenticated;`);
    const roleSql = read('drizzle/migrations/0000_operational_foundation.sql');
    await db.exec(roleSql.match(/CREATE FUNCTION public\.has_role\([\s\S]*?\$\$;/)[0]);
    const trainingSql = read('supabase/migrations/20261018000000_finance_training_enforcement.sql');
    for (const name of ['finance_training_is_restricted','finance_training_current_user_is_restricted']) {
      const start = trainingSql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
      const stop = trainingSql.indexOf('$function$;', start) + '$function$;'.length;
      await db.exec(trainingSql.slice(start,stop));
    }
    await db.exec(read('supabase/migrations/20261003000002_package_time_engine.sql'));
    await db.exec(read('supabase/pending/20261113145045_booking_fixed_slot_boundary.sql').replace('server_now timestamptz := now();', "server_now timestamptz := current_setting('test.clock')::timestamptz;"));
    // Historical duplicates abort installation without repairing production history.
    await db.exec(`INSERT INTO rooms(id) VALUES ('${id(98)}');
      INSERT INTO transactions(id,room_id,status) VALUES ('${id(98)}','${id(98)}','check_in'),('${id(99)}','${id(98)}','check_in');`);
    await assert.rejects(db.exec(migration), /Hunian aktif ganda/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM transactions')).rows[0].n,2);
    await db.exec('DELETE FROM transactions; DELETE FROM rooms;'); // discard isolated fixtures only
    // Inject deterministic time ONLY into the local copy, not the pending SQL.
    await db.exec(migration.replaceAll('clock_timestamp()', "current_setting('test.clock')::timestamptz"));
    await db.query("SELECT set_config('test.clock',$1,false)",[now]);
    const actor = async n => db.query("SELECT set_config('test.actor',$1,false)",[n ? id(n) : '']);
    await db.exec(`INSERT INTO user_roles VALUES ('${id(1)}','owner'),('${id(5)}','owner');
      INSERT INTO finance_training_assignments(trainee_user_id,status,starts_on) VALUES ('${id(5)}','ACTIVE','2026-11-01');
      INSERT INTO rooms(id) VALUES ('${id(10)}'),('${id(11)}');
      INSERT INTO packages VALUES ('${id(12)}','Malam',true,'fixed_window',600,'21:30','04:00','08:00');`);
    const insert = (n, status='check_in', room=10, deadline=end) => db.query(
      'INSERT INTO transactions(id,room_id,status,ends_at) VALUES ($1,$2,$3,$4)', [id(n),id(room),status,deadline]);
    await actor(2); // fixture receptionist; no claim of complete production staff RLS coverage
    await insert(20);
    await assert.rejects(insert(21), /hunian aktif/); // exactly 120, not overtime gate
    await db.query("SELECT set_config('test.clock',$1,false)",['2026-11-13T17:00:00.001+07:00']);
    await assert.rejects(insert(21), /Walk-in diblokir/);
    await insert(21,'booking'); // overtime trigger adds no new restriction to Booking
    await insert(22,'check_in',11); // another room unaffected
    console.log('PASS 120 boundary; >120 Walk-in denied; Booking/other room unaffected');

    // Exercise the existing single-method reservation RPC, not a copied mock RPC.
    await db.exec(`CREATE TABLE finance_reservation_idempotency(idempotency_key uuid PRIMARY KEY,request_fingerprint text,created_by uuid,transaction_id uuid,transaction_number text);
      CREATE TABLE room_types(id uuid PRIMARY KEY,pricing_group text);
      CREATE TABLE package_room_type_prices(package_id uuid,pricing_group text,weekday_price numeric,weekend_price numeric);
      CREATE TABLE guests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),full_name text,address text,phone text);
      CREATE TYPE public.transaction_status AS ENUM ('booking','check_in','check_out','cancelled');
      CREATE FUNCTION public.get_operational_day_mode(date) RETURNS text LANGUAGE sql AS $$SELECT 'weekday'::text$$;
      ALTER TABLE rooms ADD COLUMN room_type_id uuid;
      ALTER TABLE transactions ADD COLUMN created_by uuid;
      ALTER TABLE payments ADD COLUMN method text, ADD COLUMN kind text, ADD COLUMN recorded_by uuid, ADD COLUMN idempotency_key uuid, ADD COLUMN cash_session_id uuid;
      INSERT INTO room_types VALUES ('${id(40)}','fixture');
      UPDATE rooms SET room_type_id='${id(40)}';
      INSERT INTO package_room_type_prices VALUES ('${id(12)}','fixture',100,100);`);
    const reservationSql = read('supabase/migrations/20261015000002_finance_150_supervisor_alignment.sql');
    const start = reservationSql.indexOf('CREATE OR REPLACE FUNCTION public.create_reservation(');
    const stop = reservationSql.indexOf('$function$;',start) + '$function$;'.length;
    await db.exec(reservationSql.slice(start,stop).replaceAll('now()', "current_setting('test.clock')::timestamptz"));
    await db.query("SELECT set_config('test.clock',$1,false)",['2026-11-13T22:00:00+07:00']);
    await assert.rejects(db.query(`SELECT public.create_reservation('check_in',$1,$2,'Fixture','00000000','Fixture',100,'Cash','weekday',NULL,$3,NULL)`,[id(10),id(12),id(41)]),/Walk-in diblokir/);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM guests')).rows[0].n,0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM finance_reservation_idempotency')).rows[0].n,0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM payments')).rows[0].n,0);
    assert.equal((await db.query('SELECT status FROM rooms WHERE id=$1',[id(10)])).rows[0].status,'ready');
    await db.query("SELECT set_config('test.clock',$1,false)",['2026-11-13T17:00:00.001+07:00']);
    console.log('PASS existing Walk-in RPC blocked atomically; guest/payment/idempotency/room writes rolled back');

    await db.exec('SET ROLE authenticated');
    // Local identifiers describe test positions; only Owner's actual role row authorizes release.
    for (const [n,label] of [[2,'Receptionist'],[3,'Supervisor'],[4,'other/inactive'],[5,'Owner with restricted Training']]) {
      await actor(n);
      await assert.rejects(db.query('SELECT public.release_room_overtime_block($1,$2)',[id(20),'Fixture resolution reviewed']), /Akses ditolak/);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM room_overtime_owner_releases')).rows[0].n,0);
      console.log(`PASS ${label}: release DENY and audit RLS hides rows`);
    }
    await actor(null);
    await assert.rejects(db.query('SELECT public.release_room_overtime_block($1,$2)',[id(20),'Fixture resolution reviewed']),/Akses ditolak/);
    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(db.query('SELECT public.release_room_overtime_block($1,$2)',[id(20),'Fixture resolution reviewed']),/permission denied/);
    await db.exec('RESET ROLE; SET ROLE authenticated');
    await actor(1);
    await db.query("SELECT set_config('test.clock',$1,false)",[now]);
    await assert.rejects(db.query('SELECT public.release_room_overtime_block($1,$2)',[id(20),'Fixture resolution reviewed']), /Kasus overtime/);
    await db.query("SELECT set_config('test.clock',$1,false)",['2026-11-13T17:00:00.001+07:00']);
    await assert.rejects(db.query('SELECT public.release_room_overtime_block($1,$2)',[id(20),'']),/Alasan audit/);
    await assert.rejects(db.query('SELECT public.release_room_overtime_block($1,$2)',[id(999),'Fixture resolution reviewed']),/Kasus overtime/);
    const release = async () => (await db.query('SELECT public.release_room_overtime_block($1,$2) AS id',[id(20),'Fixture resolution reviewed'])).rows[0].id;
    const auditId = await release();
    assert.equal(await release(),auditId);
    const audit = (await db.query('SELECT * FROM room_overtime_owner_releases')).rows[0];
    assert.equal(audit.actor_id,id(1)); assert.equal(audit.action,'RELEASE_OVERTIME_WALKIN_BLOCK');
    assert.equal(new Date(audit.released_at).toISOString(),'2026-11-13T10:00:00.001Z');
    assert.equal(new Date(audit.checkout_deadline).toISOString(),new Date(end).toISOString());
    assert.equal(audit.reason,'Fixture resolution reviewed');
    await assert.rejects(db.query('UPDATE room_overtime_owner_releases SET reason = $1',['tampered']),/permission denied/);
    await assert.rejects(db.query('DELETE FROM room_overtime_owner_releases'),/permission denied/);
    await assert.rejects(db.query('INSERT INTO room_overtime_owner_releases SELECT * FROM room_overtime_owner_releases'),/permission denied/);
    await assert.rejects(insert(23),/hunian aktif/); // release changes gate, never grants double occupancy
    await actor(2);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM room_overtime_owner_releases')).rows[0].n,0);
    await assert.rejects(db.query('SELECT public.release_room_overtime_block($1,$2)',[id(20),'Fixture resolution reviewed']), /Akses ditolak/);
    await actor(1);
    console.log('PASS Owner-only idempotent release, identity/time/action audit, direct tampering DENY, occupancy preserved');
    await db.exec('RESET ROLE');
    await db.query('UPDATE transactions SET ends_at = $1 WHERE id = $2',['2026-11-13T14:59:00+07:00',id(20)]);
    await assert.rejects(insert(23),/Walk-in diblokir/); // release not reusable after deadline changes
    await db.exec(`UPDATE transactions SET status='cancelled' WHERE id='${id(22)}';
      UPDATE transactions SET room_id='${id(11)}' WHERE id='${id(20)}';`);
    await assert.rejects(insert(23,'check_in',11),/Walk-in diblokir/); // not reusable in a different room
    await db.exec(`UPDATE transactions SET room_id='${id(10)}' WHERE id='${id(20)}';`);
    await db.query(`UPDATE transactions SET transaction_number='DUMMY', guest_id=$1,package_id=$2,
      price_snapshot=100,day_mode='weekday',scheduled_check_in='2026-11-13T22:00:00+07:00',scheduled_check_out='2026-11-14T08:00:00+07:00' WHERE id=$3`,[id(99),id(12),id(21)]);
    await db.query('INSERT INTO payments VALUES ($1,100)',[id(21)]);
    await db.query("SELECT set_config('test.clock',$1,false)",['2026-11-13T22:00:00+07:00']);
    await assert.rejects(db.query('SELECT public.check_in_booking($1)',[id(21)]),/hunian aktif/);
    assert.equal((await db.query('SELECT status FROM rooms WHERE id=$1',[id(10)])).rows[0].status,'ready');
    // Legitimate checkout is a fixture operation, not performed by the new functions.
    await db.query("UPDATE transactions SET status='check_out' WHERE id=$1",[id(20)]);
    await db.query('SELECT public.check_in_booking($1)',[id(21)]);
    assert.equal((await db.query('SELECT status FROM transactions WHERE id=$1',[id(21)])).rows[0].status,'check_in');
    await assert.rejects(insert(24),/hunian aktif/); // a new stay never inherits old release
    await assert.rejects(db.query('SELECT public.release_room_overtime_block($1,$2)',[id(21),'Fixture resolution reviewed']),/Kasus overtime/);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM room_overtime_owner_releases')).rows[0].n,1);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM payments')).rows[0].n,1);
    // Constraint remains effective even if a privileged maintenance session disables triggers.
    await db.exec('ALTER TABLE transactions DISABLE TRIGGER room_overtime_checkin_guard');
    await assert.rejects(insert(25),/room_single_active_checkin/);
    await db.exec('ALTER TABLE transactions ENABLE TRIGGER room_overtime_checkin_guard');
    await assert.rejects(db.exec(`INSERT INTO transactions(id,room_id,status) VALUES ('${id(30)}','${id(11)}','check_in'),('${id(31)}','${id(11)}','check_in')`), /hunian aktif/);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM transactions WHERE id IN ($1,$2)',[id(30),id(31)])).rows[0].n,0);
    console.log('PASS historical duplicate installation DENY; unique index backstop and multi-row rollback');
    console.log('PASS stale release not reusable; real Booking RPC uses occupancy guard, not overtime gate; resolution preserves audit/payments');
  } finally { await db.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
