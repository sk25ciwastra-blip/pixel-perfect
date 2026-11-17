// Exact read-only Cloud RPC/helper snapshots, disposable native PostgreSQL fixture.
// No Cloud URL, real account, guest, JWT or DEMO data. Not full Cloud/RLS acceptance.
import postgres from 'postgres';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {userInfo} from 'node:os';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fixture=p=>read('scripts/fixtures/hk-cloud-20261117/'+p+'.sql');
const candidate=read('supabase/pending/20261117081000_housekeeping_retry_after_room_lock.sql');
const baseline=fixture('complete_housekeeping_checklist');
const body=source=>source.split('AS $function$')[1].split('$function$')[0];
assert.equal(createHash('md5').update(body(baseline)).digest('hex'),'2756ae72d61632458a5688b037526d75');
const options={host:'127.0.0.1',port:Number(process.env.B25_TEST_PORT),user:userInfo().username,max:1};
assert.ok(process.env.B25_EXPECTED_DATA_DIRECTORY&&Number.isInteger(options.port),'Use isolated cluster launcher only');
const admin=postgres({...options,database:'postgres'});let db,a,b,observer;let count=0;
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const actor=(sql,n)=>sql`SELECT set_config('test.actor',${n?id(n):''},false)`;
const save=(sql,room,key,flags=[true,true,true,true,true,true,true],note='{}')=>sql`SELECT public.complete_housekeeping_checklist(${id(room)}::uuid,${id(key)}::uuid,${flags[0]}::boolean,${flags[1]}::boolean,${flags[2]}::boolean,${flags[3]}::boolean,${flags[4]}::boolean,${flags[5]}::boolean,${flags[6]}::boolean,${note}::text) AS id`;
const pass=label=>{count++;console.log('PASS',label);};
try{
 assert.equal((await admin.unsafe('SHOW data_directory'))[0].data_directory,process.env.B25_EXPECTED_DATA_DIRECTORY,'Refuse another database before writes');
 await admin.unsafe('CREATE DATABASE b25_hk_native');const connect=()=>postgres({...options,database:'b25_hk_native'});
 db=connect();a=connect();b=connect();observer=connect();
 await db.unsafe(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;
 CREATE TYPE app_role AS ENUM ('owner','employee');
 CREATE TYPE employee_position AS ENUM ('housekeeping','supervisor','receptionist');
 CREATE TYPE room_status AS ENUM ('ready','occupied','dirty','cleaning');
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
 CREATE TABLE user_roles(user_id uuid REFERENCES auth.users(id),role app_role);
 CREATE TABLE employees(user_id uuid REFERENCES auth.users(id),name text,active boolean,position employee_position);
 CREATE TABLE rooms(id uuid PRIMARY KEY,active boolean NOT NULL DEFAULT true,status room_status NOT NULL);
 CREATE TABLE transactions(id uuid PRIMARY KEY);
 CREATE TABLE housekeeping_jobs(id uuid PRIMARY KEY,job_number text,UNIQUE(id,job_number));
 CREATE TABLE housekeeping_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),room_id uuid NOT NULL REFERENCES rooms(id),transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,job_id uuid,job_number text,action text NOT NULL CHECK(action IN ('start_cleaning','finish_cleaning','override_ready')),from_status room_status,to_status room_status,note text NOT NULL DEFAULT '',performed_by uuid NOT NULL REFERENCES auth.users(id),performed_by_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),FOREIGN KEY(job_id,job_number) REFERENCES housekeeping_jobs(id,job_number) ON DELETE SET NULL,CHECK((job_id IS NULL AND job_number IS NULL) OR (job_id IS NOT NULL AND job_number IS NOT NULL)));`);
 // Use the repository's real checklist table and unique-history index definitions.
 const table=read('supabase/migrations/20261013000000_housekeeping_checklists_maintenance.sql');
 await db.unsafe(table.slice(table.indexOf('CREATE TABLE IF NOT EXISTS'),table.indexOf('ALTER TABLE public.housekeeping_checklists')));
 await db.unsafe('CREATE UNIQUE INDEX housekeeping_checklists_history_unique ON housekeeping_checklists(housekeeping_history_id)');
 for(const name of ['has_role','has_employee_position','can_housekeeping','validate_room_transition'])await db.unsafe(fixture(name));
 await db.unsafe('CREATE TRIGGER room_transition BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION validate_room_transition()');
 await db.unsafe(baseline);
 await db.unsafe(`REVOKE ALL ON FUNCTION public.complete_housekeeping_checklist(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.complete_housekeeping_checklist(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text) TO authenticated;GRANT USAGE ON SCHEMA auth TO authenticated,anon;`);
 for(let i=1;i<=4;i++)await db`INSERT INTO auth.users VALUES (${id(i)})`;
 await db.unsafe(`INSERT INTO user_roles VALUES ('${id(1)}','owner'),('${id(2)}','employee'),('${id(3)}','employee'),('${id(4)}','employee');INSERT INTO employees VALUES ('${id(2)}','Fixture HK',true,'housekeeping'),('${id(3)}','Fixture Supervisor',true,'supervisor'),('${id(4)}','Fixture Reception',true,'receptionist')`);
 for(const sql of [a,b])await sql.unsafe('SET ROLE authenticated');await actor(a,1);await actor(b,2);
 const pidA=(await a`SELECT pg_backend_pid() AS pid`)[0].pid,pidB=(await b`SELECT pg_backend_pid() AS pid`)[0].pid;assert.notEqual(pidA,pidB);
 async function seed(room,job=room){
  await db`INSERT INTO rooms VALUES (${id(room)},true,'cleaning') ON CONFLICT(id) DO UPDATE SET status='cleaning'`;
  await db`INSERT INTO transactions VALUES (${id(job+10000)}) ON CONFLICT DO NOTHING`;
  const number='BTRDHK-'+String(job).padStart(6,'0');
  await db`INSERT INTO housekeeping_jobs VALUES (${id(job+20000)},${number}) ON CONFLICT DO NOTHING`;
  await db`INSERT INTO housekeeping_history(id,room_id,transaction_id,job_id,job_number,action,from_status,to_status,performed_by,performed_by_name) VALUES (${id(job+30000)},${id(room)},${id(job+10000)},${id(job+20000)},${number},'start_cleaning','dirty','cleaning',${id(2)},'Fixture HK')`;
 }
 const state=async room=>(await db`SELECT r.status,(SELECT count(*)::int FROM housekeeping_checklists WHERE room_id=r.id) AS checklists,(SELECT count(*)::int FROM housekeeping_history WHERE room_id=r.id AND action='finish_cleaning') AS finishes FROM rooms r WHERE r.id=${id(room)}`)[0];
 async function race(room,keyA,keyB,expectReplay,repeatable=false){
  await a.unsafe('BEGIN');const first=await save(a,room,keyA);
  if(repeatable)await b.unsafe('BEGIN ISOLATION LEVEL REPEATABLE READ');
  let done=false;const pending=save(b,room,keyB).then(value=>({ok:true,value}),error=>({ok:false,error})).finally(()=>done=true);
  let blocked=false;const deadline=Date.now()+5000;
  while(!done&&Date.now()<deadline){const rows=await observer`SELECT wait_event_type FROM pg_stat_activity WHERE pid=${pidB}`;if(rows[0]?.wait_event_type==='Lock'){blocked=true;break;}}
  assert.ok(blocked,'Native second session must wait on room lock');await a.unsafe('COMMIT');const result=await pending;
  if(expectReplay){assert.equal(result.ok,true,result.error?.message);assert.equal(result.value[0].id,first[0].id);}else assert.equal(result.ok,false);
  if(repeatable){assert.equal(result.error.code,'40001');await b.unsafe('ROLLBACK');assert.equal((await save(b,room,keyB))[0].id,first[0].id);}
  assert.deepEqual(await state(room),{status:'ready',checklists:1,finishes:1});return result;
 }
 await seed(100);const original=await race(100,1000,1000,false);assert.match(original.error.message,/tidak sedang dibersihkan/);console.log('REPRODUCED baseline defect: same-key concurrent retry falsely rejected after original commit');
 const aclBefore=(await db`SELECT proacl::text AS acl FROM pg_proc WHERE oid='public.complete_housekeeping_checklist(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text)'::regprocedure`)[0].acl;
 await db.unsafe(candidate);
 const aclAfter=(await db`SELECT proacl::text AS acl FROM pg_proc WHERE oid='public.complete_housekeeping_checklist(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text)'::regprocedure`)[0].acl;assert.equal(aclAfter,aclBefore);pass('candidate preserves existing function ACL');
 await seed(101);await race(101,1001,1001,true);pass('same-key native race returns one UUID, one checklist and one finish');
 const row=(await db`SELECT c.housekeeping_history_id,c.transaction_id,c.performed_by,h.job_id FROM housekeeping_checklists c JOIN housekeeping_history h ON h.id=c.housekeeping_history_id WHERE c.id=${id(1001)}`)[0];assert.equal(row.housekeeping_history_id,id(30101));assert.equal(row.transaction_id,id(10101));assert.equal(row.job_id,id(20101));assert.equal(row.performed_by,id(1));pass('job, transaction, start history and original operator remain authoritative');
 await seed(102);const other=await race(102,1002,1003,false);assert.match(other.error.message,/tidak sedang dibersihkan/);pass('different-key same-cycle race does not duplicate completion');
 await seed(103);await race(103,1004,1004,false,true);pass('higher isolation serializes safely; retry after rollback returns existing UUID');
 assert.equal((await save(b,101,1001))[0].id,id(1001));assert.deepEqual(await state(101),{status:'ready',checklists:1,finishes:1});pass('post-commit replay does not append history or change recorded operator');
 await seed(104);await assert.rejects(save(b,104,1001),/kamar lain/);assert.deepEqual(await state(104),{status:'cleaning',checklists:0,finishes:0});pass('existing UUID for another room is rejected without room mutation');
 for(const [who,expected] of [[1,true],[2,true],[3,true],[4,false],[null,false]]){
  const room=110+(who??5);await seed(room);await actor(b,who);
  if(expected){await save(b,room,1100+room);assert.equal((await state(room)).status,'ready');}
  else{await assert.rejects(save(b,room,1100+room),/Akses ditolak/);assert.equal((await state(room)).status,'cleaning');}
 }
 await actor(b,2);pass('actual Cloud role helpers allow Owner/HK/Supervisor and deny receptionist/anonymous identity');
 await seed(120);await assert.rejects(save(b,120,1200,[null,true,true,true,true,true,true]),/wajib dijawab/);await assert.rejects(save(b,120,1200,[false,true,true,true,true,true,true]),/Handuk wajib/);assert.deepEqual(await state(120),{status:'cleaning',checklists:0,finishes:0});pass('invalid answers and missing failed-item reason roll back all writes');
 await save(b,120,1200,[false,true,true,true,true,true,true],'{"towel":"Fixture stock note"}');assert.equal((await db`SELECT result FROM housekeeping_checklists WHERE id=${id(1200)}`)[0].result,'needs_action');assert.equal((await state(120)).status,'ready');pass('needs_action severity / READY business policy is preserved');
 await seed(121);await db`DELETE FROM housekeeping_history WHERE room_id=${id(121)}`;await assert.rejects(save(b,121,1201),/mulai pembersihan/);assert.deepEqual(await state(121),{status:'cleaning',checklists:0,finishes:0});pass('missing start history cannot complete READY');
 await seed(122);await db.unsafe(`CREATE FUNCTION fixture_fail_finish() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='finish_cleaning' AND NEW.room_id='${id(122)}'::uuid THEN RAISE EXCEPTION 'fixture finish failure';END IF;RETURN NEW;END;$$;CREATE TRIGGER fixture_fail_finish BEFORE INSERT ON housekeeping_history FOR EACH ROW EXECUTE FUNCTION fixture_fail_finish()`);await assert.rejects(save(b,122,1202),/fixture finish failure/);assert.deepEqual(await state(122),{status:'cleaning',checklists:0,finishes:0});pass('finish-history failure atomically rolls back checklist and READY update');
 await db.unsafe('DROP TRIGGER fixture_fail_finish ON housekeeping_history');await seed(123);await save(b,123,1203);await db.unsafe(`UPDATE rooms SET status='occupied' WHERE id='${id(123)}';UPDATE rooms SET status='dirty' WHERE id='${id(123)}'`);await seed(123,124);await save(b,123,1204);const cycle=(await db`SELECT housekeeping_history_id,transaction_id FROM housekeeping_checklists WHERE id=${id(1204)}`)[0];assert.equal(cycle.housekeeping_history_id,id(30124));assert.equal(cycle.transaction_id,id(10124));assert.equal((await state(123)).finishes,2);pass('next real room cycle links its new job and transaction');
 await db.unsafe(candidate);pass('pending package can be reapplied without ACL or data changes');
 const drift=baseline.replace('  RETURN checklist_id;','  -- fixture drift\n  RETURN checklist_id;');await db.unsafe(drift);await assert.rejects(db.unsafe(candidate),/HK function drift/);await db.unsafe('ROLLBACK');assert.equal((await db`SELECT prosrc FROM pg_proc WHERE oid='public.complete_housekeeping_checklist(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text)'::regprocedure`)[0].prosrc,body(drift));pass('fingerprint preflight rejects unexpected source without overwriting it');
 console.log(`${count} focused native cases PASS; original defect reproduced; backend PIDs ${pidA}/${pidB}. No Cloud writes.`);
}finally{for(const sql of [a,b,observer,db])if(sql)await sql.end({timeout:2});await admin.end({timeout:2});}
