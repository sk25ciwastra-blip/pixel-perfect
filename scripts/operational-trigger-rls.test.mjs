// Local native fixture: exact Cloud columns/defaults, trigger bodies and four-table RLS.
// External FKs/checks and API/JWT transport are not reconstructed.
import postgres from 'postgres';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {userInfo} from 'node:os';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');const catalog=JSON.parse(read('scripts/fixtures/operational-cloud-20261117/catalog.json'));
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;const q=s=>'"'+s.replaceAll('"','""')+'"';
const opts={host:'127.0.0.1',port:Number(process.env.B25_TEST_PORT),user:userInfo().username,max:1};assert.ok(process.env.B25_EXPECTED_DATA_DIRECTORY&&opts.port);
const admin=postgres({...opts,database:'postgres'});let db,a,b,observer;let count=0;const pass=s=>{count++;console.log('PASS',s)};
try{
 assert.equal((await admin.unsafe('SHOW data_directory'))[0].data_directory,process.env.B25_EXPECTED_DATA_DIRECTORY);await admin.unsafe('CREATE DATABASE b25_combined');const connect=()=>postgres({...opts,database:'b25_combined'});db=connect();a=connect();b=connect();observer=connect();
 await db.unsafe(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;CREATE SEQUENCE owner_transaction_number_seq;SET check_function_bodies=false;`);
 for(const type of [...new Set(catalog.enums.map(e=>e.typname))])await db.unsafe(`CREATE TYPE ${q(type)} AS ENUM (${catalog.enums.filter(e=>e.typname===type).map(e=>"'"+e.enumlabel+"'").join(',')})`);
 for(const table of [...new Set(catalog.columns.map(c=>c.table_name))]){const cols=catalog.columns.filter(c=>c.table_name===table);await db.unsafe(`CREATE TABLE ${q(table)} (${cols.map(c=>q(c.column_name)+' '+c.type+(c.default_expr?' DEFAULT '+c.default_expr:'')+(c.attnotnull?' NOT NULL':'')).join(',')})`);if(cols.some(c=>c.column_name==='id'))await db.unsafe(`ALTER TABLE ${q(table)} ADD PRIMARY KEY(id)`);}
 // No HK writes in this suite; minimal rows sufficient for exact SELECT policies.
 await db.unsafe('CREATE TABLE housekeeping_history(id uuid PRIMARY KEY);CREATE TABLE housekeeping_checklists(id uuid PRIMARY KEY)');
 await db.unsafe('SET check_function_bodies=off');
 for(const f of JSON.parse(readFileSync(new URL('./fixtures/operational-cloud-20261117/helpers.json',import.meta.url),'utf8')))await db.unsafe(f.definition);await db.unsafe(read('scripts/fixtures/hk-cloud-20261117/can_housekeeping.sql'));
 for(const f of catalog.triggers)await db.unsafe(f.function_definition);
 for(const t of catalog.triggers)await db.unsafe(t.definition);
 for(const t of ['rooms','transactions','housekeeping_history','housekeeping_checklists'])await db.unsafe(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
 for(const p of catalog.policies)await db.unsafe(`CREATE POLICY ${q(p.policyname)} ON ${q(p.tablename)} FOR ${p.cmd} TO authenticated${p.qual?' USING ('+p.qual+')':''}${p.with_check?' WITH CHECK ('+p.with_check+')':''}`);
 for(const g of catalog.grants)await db.unsafe(`GRANT ${g.privilege_type} ON ${q(g.table_name)} TO ${g.grantee}`);
 await db.unsafe('GRANT USAGE ON SCHEMA auth TO anon,authenticated');
 for(const [n,role,pos] of [[1,'owner',null],[2,'employee','housekeeping'],[3,'employee','receptionist'],[4,'employee','supervisor'],[5,'employee','investor']]){await db`INSERT INTO user_roles(user_id,role) VALUES (${id(n)},${role})`;if(pos)await db`INSERT INTO employees(user_id,name,employee_id,position) VALUES(${id(n)},'Synthetic fixture',${'FIX'+n},${pos})`;}
 const actor=async(sql,n)=>{await sql.unsafe('RESET ROLE;SET ROLE authenticated');await sql`SELECT set_config('test.actor',${id(n)},false)`};await actor(a,1);await actor(b,3);
 const room=async n=>db`INSERT INTO rooms(id,room_number,room_type_id,status) VALUES(${id(n)},${String(n)},${id(900)},'ready')`;
 const insert=async(sql,n,r,status='check_in')=>sql`INSERT INTO transactions(id,transaction_number,guest_id,room_id,status,price_snapshot,ends_at) VALUES(${id(n)},'caller spoof',${id(901)},${id(r)},${status},100000,now()+interval '1 hour') RETURNING transaction_number,created_by`;
 await room(100);await assert.rejects(insert(a,200,100),/permission denied|row-level security/);pass('Owner direct transaction INSERT denied by actual Cloud table privileges');
 await actor(b,2);assert.equal((await b`SELECT count(*)::int n FROM rooms`)[0].n,1);assert.equal((await b`UPDATE rooms SET room_number='bad' RETURNING id`).length,0);pass('HK reads operations but room writes are filtered by RLS');
 await actor(b,5);assert.equal((await b`SELECT count(*)::int n FROM rooms`)[0].n,1);assert.equal((await b`SELECT count(*)::int n FROM transactions`)[0].n,0);pass('Investor sees finance-visible rooms but not transaction operations');
 await b.unsafe('RESET ROLE;SET ROLE anon');assert.equal((await b`SELECT count(*)::int n FROM rooms`)[0].n,0);pass('anon SELECT gets no operational rows under actual policy');
 // TRUNCATE is not covered by RLS: reproduce within rollback, never touch Cloud.
 await b.unsafe('BEGIN;TRUNCATE rooms');assert.equal((await db`SELECT 1`).length,1);await b.unsafe('ROLLBACK');console.log('REPRODUCED Cloud grant defect: anon SQL role can TRUNCATE rooms despite RLS');
 await db.unsafe(read('supabase/pending/20261117093000_operational_truncate_acl.sql'));
 await assert.rejects(b.unsafe('TRUNCATE rooms'),/permission denied/);await actor(b,1);await assert.rejects(b.unsafe('TRUNCATE transactions'),/permission denied/);pass('pending ACL repair blocks anon and authenticated TRUNCATE');
 // Exact server-side trigger behavior on synthetic privileged transaction path.
 await db`SELECT set_config('test.actor',${id(1)},false)`;const trx=await insert(db,201,100);assert.match(trx[0].transaction_number,/^BTRDTRX-\d{6}$/);assert.equal(trx[0].created_by,id(1));await assert.rejects(db`UPDATE transactions SET transaction_number='spoof' WHERE id=${id(201)}`,/Identitas/);pass('identity insert generator and immutable identity coexist with audit/touch');
 await a`UPDATE rooms SET status='occupied' WHERE id=${id(100)}`;await assert.rejects(a`UPDATE rooms SET status='ready' WHERE id=${id(100)}`,/urutan/);assert.equal((await db`SELECT count(*)::int n FROM activity_logs WHERE entity_type='rooms'`)[0].n,2);pass('Owner RLS write obeys transition trigger and records audit');
 await db`INSERT INTO finance_settings(id,minimum_dp_mode,minimum_dp_value) VALUES(true,'PERCENTAGE',40)`;
 await room(101);await assert.rejects(insert(db,202,101,'booking'),/DP minimum/);assert.equal((await db`SELECT count(*)::int n FROM transactions WHERE id=${id(202)}`)[0].n,0);pass('deferred DP failure atomically removes transaction and audit insert');
 // Pending occupancy guard plus all eleven original Cloud triggers.
 await db.unsafe(read('supabase/pending/20261113150233_overtime_walkin_guard.sql'));
 await room(102);await room(103);await db`INSERT INTO finance_training_assignments(trainee_user_id,supervisor_user_id,starts_on,ends_on,created_by) VALUES(${id(3)},${id(4)},current_date,current_date+1,${id(1)})`;
 await db`SELECT set_config('test.actor',${id(3)},false)`;await assert.rejects(insert(db,203,102),/Training/);await db`SELECT set_config('test.actor',${id(1)},false)`;pass('actual Training guard rejects missing supervised session context alongside occupancy guard');
 // Privileged fixture callers stand in for server-side RPC writes; actual browser RPCs not claimed.
 await a.unsafe('RESET ROLE');await b.unsafe('RESET ROLE');await a.unsafe('BEGIN');await insert(a,204,102);const pid=(await b`SELECT pg_backend_pid() pid`)[0].pid;let done=false;const pending=insert(b,205,102).then(v=>({ok:true,v}),e=>({ok:false,e})).finally(()=>done=true);let blocked=false;const end=Date.now()+5000;while(!done&&Date.now()<end){if((await observer`SELECT wait_event_type FROM pg_stat_activity WHERE pid=${pid}`)[0]?.wait_event_type==='Lock'){blocked=true;break;}}assert.ok(blocked);await a.unsafe('COMMIT');const result=await pending;assert.equal(result.ok,false);assert.match(result.e.message,/hunian aktif|duplicate key/);assert.equal((await db`SELECT count(*)::int n FROM transactions WHERE room_id=${id(102)} AND status='check_in'`)[0].n,1);pass('combined 11-trigger stack and pending guard serialize competing occupancy with one winner');
 await assert.rejects(insert(db,206,102),/hunian aktif/);assert.equal((await db`SELECT count(*)::int n FROM activity_logs WHERE entity_id=${id(206)}`)[0].n,0);pass('rejected occupancy leaves no transaction audit residue');
 console.log(`${count} NEW combined cases PASS. Reduced schema, actual trigger/policy definitions, no Cloud writes.`);
}finally{for(const s of [a,b,observer,db])if(s)await s.end({timeout:2});await admin.end({timeout:2});}
