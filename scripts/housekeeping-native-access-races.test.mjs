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

 // Match current Cloud EXECUTE ACL: anon may call; identity guard must reject.
 await db.unsafe('GRANT EXECUTE ON FUNCTION public.complete_housekeeping_checklist(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text) TO anon');
 await db.unsafe(candidate);
 await seed(201);await b.unsafe('RESET ROLE; SET ROLE anon');await actor(b,null);
 await assert.rejects(save(b,201,2201),/Akses ditolak/);assert.deepEqual(await state(201),{status:'cleaning',checklists:0,finishes:0});pass('actual anon SQL role with Cloud EXECUTE permission rejects null identity without writes');
 await b.unsafe('RESET ROLE; SET ROLE authenticated');await actor(b,2);
 await db`UPDATE employees SET active=false WHERE user_id=${id(2)}`;
 await assert.rejects(save(b,201,2201),/Akses ditolak/);assert.equal((await state(201)).checklists,0);pass('inactive Housekeeping employee rejected before completion');
 await db`UPDATE employees SET active=true WHERE user_id=${id(2)}`;
 await seed(202);await a.unsafe('BEGIN');await save(a,202,2202);
 let pending=save(b,202,2202).then(value=>({value}),error=>({error}));
 let locked=false;const deadline=Date.now()+5000;
 while(Date.now()<deadline){if((await observer`SELECT wait_event_type FROM pg_stat_activity WHERE pid=${pidB}`)[0]?.wait_event_type==='Lock'){locked=true;break;}}
 assert.ok(locked);await a.unsafe('ROLLBACK');const retry=await pending;assert.equal(retry.error,undefined);assert.equal(retry.value[0].id,id(2202));assert.deepEqual(await state(202),{status:'ready',checklists:1,finishes:1});
 assert.equal((await db`SELECT performed_by FROM housekeeping_checklists WHERE id=${id(2202)}`)[0].performed_by,id(2));pass('waiting retry completes once under its own operator after original transaction rolls back');
 await seed(203);await seed(204);await a.unsafe('BEGIN');await save(a,203,2203);
 pending=save(b,204,2203).then(value=>({value}),error=>({error}));locked=false;const deadline2=Date.now()+5000;
 while(Date.now()<deadline2){if((await observer`SELECT wait_event_type FROM pg_stat_activity WHERE pid=${pidB}`)[0]?.wait_event_type==='Lock'){locked=true;break;}}
 assert.ok(locked);await a.unsafe('COMMIT');const cross=await pending;assert.ok(cross.error);assert.deepEqual(await state(203),{status:'ready',checklists:1,finishes:1});assert.deepEqual(await state(204),{status:'cleaning',checklists:0,finishes:0});pass('concurrent shared UUID across different rooms cannot make second room READY or append history');
 await actor(b,4);await assert.rejects(save(b,203,2203),/Akses ditolak/);assert.deepEqual(await state(203),{status:'ready',checklists:1,finishes:1});pass('unauthorized operator cannot replay a known completed UUID');
 await actor(b,2);await seed(205);await db`UPDATE rooms SET active=false WHERE id=${id(205)}`;
 await assert.rejects(save(b,205,2205));assert.deepEqual(await state(205),{status:'cleaning',checklists:0,finishes:0});pass('inactive room cannot complete checklist');
 console.log(`${count} NEW extension cases PASS; old 15-case suite not rerun. Local fixture only.`);
}finally{for(const sql of [a,b,observer,db])if(sql)await sql.end({timeout:2});await admin.end({timeout:2});}
