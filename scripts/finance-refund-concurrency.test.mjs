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


 const finance=JSON.parse(read('scripts/fixtures/finance-cloud-20261117/catalog.json'));
 for(const f of JSON.parse(read('scripts/fixtures/finance-cloud-20261117/numbers.json')))await db.unsafe(f.definition);
 for(const table of [...new Set(finance.columns.map(c=>c.table_name))]){
  if(catalog.columns.some(c=>c.table_name===table))continue;
  const cols=finance.columns.filter(c=>c.table_name===table);
  await db.unsafe(`CREATE TABLE ${q(table)} (${cols.map(c=>q(c.column_name)+' '+c.type+(c.default_expr?' DEFAULT '+c.default_expr:'')+(c.attnotnull?' NOT NULL':'')).join(',')})`);
  if(cols.some(c=>c.column_name==='id'))await db.unsafe(`ALTER TABLE ${q(table)} ADD PRIMARY KEY(id)`);
 }
 for(const f of finance.functions)await db.unsafe(f.definition);
 for(const t of finance.triggers){await db.unsafe(t.function_definition);await db.unsafe(t.definition);}
 for(const i of finance.indexes)if(i.indexname!=='payments_pkey')await db.unsafe(i.indexdef);
 const session=async n=>db`INSERT INTO finance_cash_sessions(id,opened_by,status,opening_cash) VALUES(${id(n)},${id(3)},'OPEN',0)`;
 await db.unsafe('REVOKE ALL ON FUNCTION close_finance_cash_session(uuid,jsonb,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION close_finance_cash_session(uuid,jsonb,text) TO authenticated');
 const setup=async(n,s)=>{await room(n);await db`SELECT set_config('test.actor',${id(1)},false)`;await insert(db,n+1000,n);await db`UPDATE transactions SET commission_mode_snapshot='OFF' WHERE id=${id(n+1000)}`;await session(s);};
 const pay=(sql,n,key,s)=>sql`SELECT record_transaction_payment(${id(n+1000)}::uuid,100000::numeric,'Cash'::text,${id(key)}::uuid,${id(s)}::uuid) id`;
 const close=(sql,s,amount)=>sql`SELECT close_finance_cash_session(${id(s)}::uuid,${sql.json({setor_cash:amount})}::jsonb,'Fixture Owner closing') result`;
 await a.unsafe('RESET ROLE');await b.unsafe('RESET ROLE');
 for(const sql of [a,b])await sql`SELECT set_config('test.actor',${id(1)},false)`;
 // Capture PID BEFORE starting an operation on the max:1 connection.
 const pidB=(await b`SELECT pg_backend_pid() pid`)[0].pid;
 const blocked=async()=>{const end=Date.now()+5000;while(Date.now()<end){if((await observer`SELECT wait_event_type FROM pg_stat_activity WHERE pid=${pidB}`)[0]?.wait_event_type==='Lock')return;}throw Error('No lock wait');};


 const refundCatalog=JSON.parse(read('scripts/fixtures/finance-cloud-20261117/refund.json'));
 for(const f of refundCatalog.functions)await db.unsafe(f.definition);
 for(const t of refundCatalog.triggers){await db.unsafe(t.function_definition);await db.unsafe(t.definition);}
 for(const i of refundCatalog.indexes)if(!i.indexname.endsWith('_pkey'))await db.unsafe(i.indexdef);
 const refund=(sql,n,key,amount=100000)=>sql`SELECT create_finance_refund(${id(key)}::uuid,${id(n+1000)}::uuid,${amount}::numeric,'CASH'::text,'OWNER_FUNDS'::text,NULL::uuid,'Synthetic refund'::text) id`;
 const ready=async(n,s)=>{await setup(n,s);await pay(db,n,n+5000,s);await close(db,s,100000);return (await db`SELECT closing_snapshot FROM finance_cash_sessions WHERE id=${id(s)}`)[0].closing_snapshot;};
 const unchanged=async(s,snapshot)=>assert.deepEqual((await db`SELECT closing_snapshot FROM finance_cash_sessions WHERE id=${id(s)}`)[0].closing_snapshot,snapshot);
 let snapshot=await ready(900,1900);await a.unsafe('BEGIN');await refund(a,900,6000);let pending=refund(b,900,6000).then(v=>({v}),e=>({e}));await blocked();await a.unsafe('COMMIT');let result=await pending;assert.match(result.e?.message??'',/melebihi/);await unchanged(1900,snapshot);console.log('REPRODUCED identical concurrent refund retry rejects after first commit; closing snapshot unchanged');
 const oldReplay=await refund(db,900,6000,1);assert.ok(oldReplay[0].id);console.log('REPRODUCED reused refund UUID silently accepts changed amount');
 await db.unsafe(read('supabase/pending/20261117104000_refund_retry_payload_guard.sql'));
 snapshot=await ready(901,1901);await a.unsafe('BEGIN');const first=await refund(a,901,6001);pending=refund(b,901,6001).then(v=>({v}),e=>({e}));await blocked();await a.unsafe('COMMIT');result=await pending;assert.ok(!result.e,result.e?.message);assert.equal(result.v[0].id,first[0].id);assert.equal((await db`SELECT count(*)::int n FROM finance_refunds WHERE transaction_id=${id(1901)}`)[0].n,1);await unchanged(1901,snapshot);pass('same UUID concurrent post-closing retry returns one refund and preserves closing snapshot');
 await assert.rejects(refund(db,901,6001,1),/payload berbeda/);await unchanged(1901,snapshot);pass('changed refund payload rejected without rewriting historical closing');
 snapshot=await ready(902,1902);await a.unsafe('BEGIN');await refund(a,902,6002,60000);pending=refund(b,902,6003,60000).then(v=>({v}),e=>({e}));await blocked();await a.unsafe('COMMIT');result=await pending;assert.match(result.e?.message??'',/melebihi/);assert.equal(Number((await db`SELECT sum(amount) total FROM finance_refunds WHERE transaction_id=${id(1902)}`)[0].total),60000);await unchanged(1902,snapshot);pass('different UUID concurrent refunds respect remaining paid balance and immutable FINAL snapshot');
 snapshot=await ready(903,1903);await db.unsafe(`CREATE FUNCTION fixture_refund_allocation_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'fixture allocation failure';END;$$;CREATE TRIGGER z_refund_fail BEFORE INSERT ON finance_refund_allocations FOR EACH ROW EXECUTE FUNCTION fixture_refund_allocation_fail()`);await assert.rejects(refund(db,903,6004),/allocation failure/);assert.equal((await db`SELECT count(*)::int n FROM finance_refunds WHERE idempotency_key=${id(6004)}`)[0].n,0);await unchanged(1903,snapshot);pass('allocation failure rolls back refund row and leaves historical snapshot intact');
 console.log(`${count} NEW refund concurrency/payload/rollback cases PASS; old refund suites not rerun.`);
}finally{for(const s of [a,b,observer,db])if(s)await s.end({timeout:2});await admin.end({timeout:2});}
