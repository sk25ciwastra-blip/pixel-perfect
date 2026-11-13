// New lifecycle security tests only. In-memory PostgreSQL, no tokens/real identities/network DB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PGlite } = require(process.env.BTRD25_PGLITE_MODULE || path.join(os.tmpdir(),'BTRD25-pdf-db-test/node_modules/@electric-sql/pglite'));
const read = p => fs.readFileSync(p,'utf8');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const clock = sql => sql.replaceAll('clock_timestamp()',"current_setting('test.now')::timestamptz").replaceAll('now()',"current_setting('test.now')::timestamptz");
function fn(sql,name) {
  const pattern = new RegExp(`create(?: or replace)? function public\\.${name}\\([\\s\\S]*?(\\$function\\$|\\$\\$);`,'i');
  const match = sql.match(pattern); assert.ok(match,`missing source function ${name}`); return match[0];
}
(async()=>{
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
      CREATE TYPE app_role AS ENUM ('owner','employee');
      CREATE TYPE employee_position AS ENUM ('receptionist','supervisor','housekeeping','inspector','investor');
      CREATE TABLE auth.users(id uuid PRIMARY KEY,banned_until timestamptz);
      CREATE TABLE user_roles(user_id uuid PRIMARY KEY,role app_role);
      CREATE TABLE employees(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid UNIQUE,name text,employee_id text UNIQUE,position employee_position,active boolean NOT NULL DEFAULT true,created_at timestamptz DEFAULT now());
      CREATE TABLE finance_cash_sessions(id uuid PRIMARY KEY,opened_by uuid,status text,opened_at timestamptz DEFAULT now());
      GRANT USAGE ON SCHEMA auth TO authenticated,anon;
      GRANT SELECT,INSERT,UPDATE ON employees TO authenticated;
      GRANT SELECT ON finance_cash_sessions TO authenticated;`);
    await db.exec(fn(read('drizzle/migrations/0000_operational_foundation.sql'),'has_role'));
    const roles = read('supabase/migrations/20261003000011_role_permission_foundation.sql');
    await db.exec(fn(roles,'has_employee_position'));
    await db.exec(fn(roles,'can_operate'));
    const training = read('supabase/migrations/20261018000000_finance_training_enforcement.sql');
    await db.exec(training.slice(training.indexOf('CREATE TABLE IF NOT EXISTS public.finance_training_assignments'),training.indexOf('CREATE TABLE IF NOT EXISTS public.finance_training_audit')));
    for(const name of ['finance_training_assignment_for','finance_training_is_restricted','finance_training_session_is_valid','finance_training_context_assignment','finance_training_context_valid','finance_training_current_user_is_restricted','get_finance_training_context','create_finance_training_assignment','resolve_finance_training_assignment','can_frontdesk','is_receptionist','finance_is_owner_or_supervisor','finance_is_booking_operator']) await db.exec(clock(fn(training,name)));
    await db.exec(`REVOKE ALL ON FUNCTION finance_training_is_restricted(uuid),finance_training_session_is_valid(uuid,uuid),finance_training_context_valid(uuid) FROM PUBLIC,authenticated;
      CREATE POLICY employees_owner_insert ON employees FOR INSERT TO authenticated WITH CHECK(has_role(auth.uid(),'owner'));
      CREATE POLICY employees_owner_update ON employees FOR UPDATE TO authenticated USING(has_role(auth.uid(),'owner')) WITH CHECK(has_role(auth.uid(),'owner'));
      CREATE POLICY employees_owner_read ON employees FOR SELECT TO authenticated USING(has_role(auth.uid(),'owner') OR user_id=auth.uid());
      ALTER TABLE employees ENABLE ROW LEVEL SECURITY;`);
    for(const n of [1,2,3,4,5,6,7,8,9,20,21,22]) {
      await db.query('INSERT INTO auth.users(id) VALUES($1)',[id(n)]);
      if(n!==9) await db.query('INSERT INTO user_roles VALUES($1,$2)',[id(n),n===1||n===5?'owner':'employee']);
    }
    for(const [n,pos,active] of [[2,'supervisor',true],[3,'receptionist',true],[4,'supervisor',false],[6,'housekeeping',true],[7,'inspector',true],[8,'investor',true]]) await db.query('INSERT INTO employees(id,user_id,name,employee_id,position,active) VALUES($1,$1,\'Fixture\',$2,$3,$4)',[id(n),`FIXTURE-${n}`,pos,active]);
    await db.query('INSERT INTO finance_cash_sessions VALUES($1,$2,\'OPEN\',now())',[id(10),id(1)]);
    await db.query('INSERT INTO finance_training_assignments(trainee_user_id,supervisor_user_id,starts_on,ends_on,created_by) VALUES($1,$2,\'2026-11-14\',\'2026-11-15\',$2)',[id(5),id(1)]);
    const legacyBefore = JSON.stringify((await db.query('SELECT * FROM employees ORDER BY id')).rows);
    const setNow = value => db.query("SELECT set_config('test.now',$1,false)",[value]);
    const actor = n => db.query("SELECT set_config('test.actor',$1,false)",[n?id(n):'']);
    await setNow('2026-11-14T08:00:00+07:00'); await actor(1);
    await db.exec(fn(training,'finance_training_session_guard'));
    await db.exec('CREATE TRIGGER finance_training_session_guard_trigger BEFORE INSERT OR UPDATE OR DELETE ON finance_cash_sessions FOR EACH ROW EXECUTE FUNCTION finance_training_session_guard()');
    await db.exec(clock(read('supabase/pending/20261113170814_employee_lifecycle_audit.sql')));
    assert.equal(JSON.stringify((await db.query('SELECT * FROM employees ORDER BY id')).rows),legacyBefore);
    assert.equal((await db.query('SELECT count(*)::int n FROM employee_lifecycle')).rows[0].n,0);
    assert.equal((await db.query('SELECT finance_is_booking_operator($1) ok',[id(3)])).rows[0].ok,true);
    console.log('PASS install preserves legacy accounts/permissions; no inferred dates/backfill');

    await db.exec('SET ROLE authenticated');
    await db.query('INSERT INTO employees(id,user_id,name,employee_id,position) VALUES($1,$1,\'Fixture\',\'FIXTURE-NEW\',\'receptionist\')',[id(20)]);
    const history = async(n=20,cursor=0)=>(await db.query('SELECT read_employee_lifecycle($1,$2) result',[id(n),cursor])).rows[0].result;
    const change = async(event,extra={},n=20)=> {
      const h=await history(n);
      return db.query('SELECT change_employee_lifecycle($1,$2,$3,$4,$5,$6) v',[id(n),event,'Fixture status review',extra.version??h.current_version,extra.effective??null,extra.join??null]);
    };
    let h=await history();
    assert.equal(h.lifecycle.employment_state,'REGISTERED'); assert.equal(h.account.operational_compat_active,false);
    assert.equal(h.training.display_status,'NONE'); assert.equal(h.account.banned_now,false);
    await assert.rejects(change('ACTIVATE'),/Aktivasi memerlukan/);
    await assert.rejects(change('SUSPEND',{effective:'2026-11-15'}),/menunggu keputusan/);
    await assert.rejects(change('SUSPEND',{effective:'2026-11-13'}),/menunggu keputusan/);
    await assert.rejects(db.query('UPDATE employees SET active=true WHERE id=$1',[id(20)]),/lifecycle teraudit/);
    await change('SET_JOIN_DATE',{join:'2026-11-13'});
    h=await history(); assert.equal(h.lifecycle.join_date,'2026-11-13');
    assert.equal(h.events.at(-1).effective_on,'2026-11-13');
    assert.equal(new Date(h.events.at(-1).recorded_at).toISOString(),'2026-11-14T01:00:00.000Z');
    await assert.rejects(change('SET_JOIN_DATE',{join:'2026-11-15'}),/Tanggal bergabung/);
    console.log('PASS new registration waits; audited join date preserves effective/recorded WIB dates; ambiguous dates DENY');

    // Supervisor assignment authority is reused, not graduation/activation authority.
    await actor(2);
    await assert.rejects(history(),/Akses ditolak/);
    const version=h.current_version;
    const assignment=(await db.query('SELECT prepare_employee_training($1,$2,$3,$4) id',[id(20),id(2),'2026-11-14',version])).rows[0].id;
    await assert.rejects(db.query('SELECT prepare_employee_training($1,$2,$3,$4)',[id(20),id(2),'2026-11-14',version]),/versi berubah/);
    await assert.rejects(db.query('SELECT change_employee_lifecycle($1,\'ACTIVATE\',\'Fixture review\',0)',[id(20)]),/Akses ditolak/);
    await assert.rejects(db.query('SELECT resolve_finance_training_assignment($1,\'PASSED\',\'Fixture review\')',[assignment]),/Hanya Owner/);
    // Actual supervised cash context, no new session or owner substitution.
    await db.exec('RESET ROLE');
    await db.query('INSERT INTO finance_cash_sessions VALUES($1,$2,\'OPEN\',now())',[id(11),id(2)]);
    await actor(20);
    await db.query("SELECT set_config('app.finance_training_session_id',$1,false)",[id(11)]);
    assert.equal((await db.query('SELECT finance_is_booking_operator($1) ok',[id(20)])).rows[0].ok,true);
    assert.equal((await db.query('SELECT get_finance_training_context() result')).rows[0].result.can_transact,true);
    await actor(1); await db.exec('SET ROLE authenticated');
    await assert.rejects(db.query('SELECT prepare_employee_training($1,$2,$3,0)',[id(4),id(1),'2026-11-14']),/Lifecycle tidak siap/);
    await change('SUSPEND');
    await db.exec('RESET ROLE'); await actor(20);
    assert.equal((await db.query('SELECT finance_is_booking_operator($1) ok',[id(20)])).rows[0].ok,false);
    assert.equal((await db.query('SELECT finance_training_session_is_valid($1,$2) ok',[id(20),id(11)])).rows[0].ok,false);
    await actor(1); await db.exec('SET ROLE authenticated');
    await assert.rejects(change('REACTIVATE'),/Aktivasi memerlukan/);
    // Owner can still resolve Training on a suspended employee, without unblocking operations.
    await db.query('SELECT resolve_finance_training_assignment($1,\'PASSED\',\'Fixture Owner review\')',[assignment]);
    await change('REACTIVATE');
    for(let i=0;i<2;i++){await change('SUSPEND');await change('REACTIVATE');}
    h=await history();
    assert.equal(h.events.filter(e=>e.event==='REACTIVATE').length,3);
    assert.equal(h.events.filter(e=>e.event==='SUSPEND').length,3);
    const staleVersion=h.current_version;
    await change('SUSPEND');
    await assert.rejects(change('REACTIVATE',{version:staleVersion}),/Versi lifecycle berubah/);
    await change('REACTIVATE');
    await change('END_EMPLOYMENT');
    await assert.rejects(change('REACTIVATE'),/Transisi lifecycle/);
    h=await history();assert.equal(h.lifecycle.employment_state,'ENDED');
    assert.equal(h.account.operational_compat_active,false);
    assert.equal(h.events.every(e=>e.actor_id===id(1)||e.actor_id===id(2)),true);
    assert.equal(h.events.every(e=>e.new_state.version===e.version),true);
    assert.equal((await db.query('SELECT status FROM finance_cash_sessions WHERE id=$1',[id(11)])).rows[0].status,'OPEN');
    console.log('PASS supervised Training, immediate revocation of existing context, explicit Owner reactivation, repeated immutable history, stale version DENY');

    // Separate new employee: day 1 -> day 2 -> expiry does not automatically PASS.
    await db.query('INSERT INTO employees(id,user_id,name,employee_id,position) VALUES($1,$1,\'Fixture\',\'FIXTURE-NEXT\',\'receptionist\')',[id(21)]);
    await change('SET_JOIN_DATE',{join:'2026-11-14'},21);
    const h21=await history(21);
    const a21=(await db.query('SELECT prepare_employee_training($1,$2,$3,$4) id',[id(21),id(1),'2026-11-14',h21.current_version])).rows[0].id;
    for(const [time,expected] of [['2026-11-14T23:59:00+07:00','ACTIVE'],['2026-11-15T00:00:00+07:00','ACTIVE'],['2026-11-16T00:00:00+07:00','EXPIRED_PENDING_OWNER']]){
      await setNow(time); assert.equal((await history(21)).training.display_status,expected);
    }
    await assert.rejects(change('ACTIVATE',{},21),/Aktivasi memerlukan/);
    await db.query('SELECT resolve_finance_training_assignment($1,\'PASSED\',\'Fixture Owner approval\')',[a21]);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT finance_is_booking_operator($1) ok',[id(21)])).rows[0].ok,false);
    await db.exec('SET ROLE authenticated'); await change('ACTIVATE',{},21);
    h=await history(21); assert.equal(h.lifecycle.employment_state,'ACTIVE');
    await db.exec('RESET ROLE'); await actor(21);
    await db.query('INSERT INTO finance_cash_sessions VALUES($1,$2,\'OPEN\',now())',[id(12),id(21)]);
    await actor(1); await db.exec('SET ROLE authenticated');
    await change('SUSPEND',{},21);
    await db.exec('RESET ROLE');await actor(21);
    await assert.rejects(db.query('UPDATE finance_cash_sessions SET status=\'CLOSED\' WHERE id=$1',[id(12)]),/tidak boleh/);
    assert.equal((await db.query('SELECT status FROM finance_cash_sessions WHERE id=$1',[id(12)])).rows[0].status,'OPEN');
    await actor(1);await db.exec('SET ROLE authenticated');
    await change('REACTIVATE',{},21);
    // Existing OPEN session loses validity if its non-Owner supervisor is suspended.
    await db.query('INSERT INTO employees(id,user_id,name,employee_id,position) VALUES($1,$1,\'Fixture\',\'FIXTURE-SUPERVISED\',\'receptionist\')',[id(22)]);
    const h22=await history(22);
    await db.query('SELECT prepare_employee_training($1,$2,$3,$4)',[id(22),id(2),'2026-11-16',h22.current_version]);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT finance_training_session_is_valid($1,$2) ok',[id(22),id(11)])).rows[0].ok,true);
    await db.exec('SET ROLE authenticated');await change('SUSPEND',{},2);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT finance_training_session_is_valid($1,$2) ok',[id(22),id(11)])).rows[0].ok,false);
    assert.equal((await db.query('SELECT opened_by FROM finance_cash_sessions WHERE id=$1',[id(11)])).rows[0].opened_by,id(2));
    await db.exec('SET ROLE authenticated');
    const page=await history(20,5); assert.equal(page.events.every(e=>e.version>5),true);
    for(const n of [2,3,4,5,6,7,8,9,20,22]){
      await actor(n);
      await assert.rejects(history(),/Akses ditolak/);
      await assert.rejects(db.query('SELECT change_employee_lifecycle($1,\'SUSPEND\',\'Fixture review\',0)',[id(21)]),/Akses ditolak/);
      assert.equal((await db.query('SELECT count(*)::int n FROM employee_lifecycle_events')).rows[0].n,0);
    }
    await actor(null); await assert.rejects(history(),/Akses ditolak/);
    await db.exec('RESET ROLE; SET ROLE anon'); await assert.rejects(history(),/permission denied/);
    await db.exec('RESET ROLE; SET ROLE authenticated'); await actor(1);
    for(const command of ['UPDATE employee_lifecycle_events SET reason=\'edited\'','DELETE FROM employee_lifecycle_events','INSERT INTO employee_lifecycle_events DEFAULT VALUES','UPDATE employee_lifecycle SET employment_state=\'ACTIVE\'']) await assert.rejects(db.exec(command),/permission denied/);
    await db.exec('RESET ROLE'); await assert.rejects(db.exec('UPDATE employee_lifecycle_events SET reason=\'edited\''),/append-only/);
    assert.equal((await db.query('SELECT count(*)::int n FROM finance_cash_sessions')).rows[0].n,3);
    console.log('PASS two calendar days -> waiting -> explicit graduation + activation; Owner-only history/changes, RLS, immutable audit, no session mutation');
  } finally { await db.close(); }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
