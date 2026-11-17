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

 const manifest=JSON.parse(read('supabase/review/finance-20261117/manifest.json'));
 const signatures=manifest.packages.flatMap(p=>p.functions.map(f=>f.signature));
 const metadata=async()=>db`SELECT p.oid::regprocedure::text signature,p.proacl::text acl,p.prosecdef,p.proconfig,md5(p.prosrc) body FROM pg_proc p WHERE p.oid=ANY(${signatures}::regprocedure[]) ORDER BY p.oid::regprocedure::text`;
 const original=await metadata();
 for(const pack of manifest.packages)await db.unsafe(read(pack.path));
 const candidate=await metadata();assert.equal(candidate.length,3);for(let i=0;i<3;i++){assert.equal(candidate[i].acl,original[i].acl);assert.equal(candidate[i].prosecdef,original[i].prosecdef);assert.deepEqual(candidate[i].proconfig,original[i].proconfig);assert.notEqual(candidate[i].body,original[i].body);}pass('two independent pending packages coexist and preserve all three RPC ACL/security attributes');
 await assert.rejects(db.unsafe(read('supabase/review/finance-20261117/payment-closing-restore-review.sql')),/approval token/);await db.unsafe('ROLLBACK');assert.deepEqual(await metadata(),candidate);pass('recovery script refuses ordinary execution without changing candidate');
 await db`SELECT set_config('b25.approved_recovery','OWNER_APPROVED_RESTORE_ORIGINAL_FINANCE_RPCS',false)`;
 for(const name of ['payment-closing','refund'])await db.unsafe(read('supabase/review/finance-20261117/'+name+'-restore-review.sql'));
 assert.deepEqual(await metadata(),original);pass('explicit local recovery rehearsal restores exact original bodies and retains ACL/security');
 for(const pack of manifest.packages)await db.unsafe(read(pack.path));
 const f=refundCatalog.functions[0].definition.replace('  refund_id uuid;','  -- synthetic drift\n  refund_id uuid;');await db.unsafe(f);
 const before=await metadata();await assert.rejects(db.unsafe(read('supabase/review/finance-20261117/refund-restore-review.sql')),/Recovery source drift/);await db.unsafe('ROLLBACK');assert.deepEqual(await metadata(),before);pass('recovery rejects unexpected source drift atomically');
 console.log(`${count} NEW package/recovery checks PASS, no payment or refund scenario rerun, local metadata only.`);
}finally{for(const s of [a,b,observer,db])if(s)await s.end({timeout:2});await admin.end({timeout:2});}
