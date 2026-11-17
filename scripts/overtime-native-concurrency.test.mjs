// Disposable local PostgreSQL only. Tests actual pending trigger + unique index,
// not production RPC authorization/finance or Cloud behavior.
import postgres from 'postgres';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {userInfo} from 'node:os';
const options={host:'127.0.0.1',port:Number(process.env.B25_TEST_PORT),user:userInfo().username,max:1};
const admin=postgres({...options,database:'postgres'});
assert.ok(process.env.B25_EXPECTED_DATA_DIRECTORY && Number.isInteger(options.port), 'Run only through disposable-cluster launcher');
const name='b25_guard_native_20261117';
let db,a,b,observe;
try {
 const directory=await admin.unsafe('SHOW data_directory');
 assert.equal(directory[0].data_directory,process.env.B25_EXPECTED_DATA_DIRECTORY,'Refuse a different local cluster before any write');
 await admin.unsafe(`CREATE DATABASE ${name}`);
 const connect=()=>postgres({...options,database:name});
 db=connect();a=connect();b=connect();observe=connect();
 await db.unsafe(`CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;
 CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
 CREATE FUNCTION public.finance_training_current_user_is_restricted() RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
 CREATE FUNCTION public.finance_training_is_restricted(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
 CREATE TABLE rooms(id uuid PRIMARY KEY);
 CREATE TABLE transactions(id uuid PRIMARY KEY,room_id uuid REFERENCES rooms(id),status text,ends_at timestamptz);`);
 await db.unsafe(readFileSync(new URL('../supabase/pending/20261113150233_overtime_walkin_guard.sql',import.meta.url),'utf8'));
 const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
 await db.unsafe(`INSERT INTO rooms VALUES ('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}')`);
 const [pa]=await a`SELECT pg_backend_pid() AS pid`;
 const [pb]=await b`SELECT pg_backend_pid() AS pid`;
 async function race(label,first,second,room){
  await a.unsafe('BEGIN');await a.unsafe(first);
  let settled=false;
  const pending=b.unsafe(second).then(v=>({ok:true,value:v}),e=>({ok:false,error:e.message})).finally(()=>settled=true);
  let blocked=false;
  const deadline=Date.now()+5000;
  while(Date.now()<deadline&&!settled){
   const rows=await observe`SELECT wait_event_type FROM pg_stat_activity WHERE pid=${pb.pid}`;
   if(rows[0]?.wait_event_type==='Lock'){blocked=true;break;}
  }
  assert.ok(blocked,label+' must block on the first native session');
  await a.unsafe('COMMIT');const result=await pending;
  assert.equal(result.ok,false,label+' second arrival must fail');
  assert.match(result.error,/hunian aktif|duplicate key/);
  const rows=await db`SELECT count(*)::int AS n FROM transactions WHERE room_id=${room} AND status='check_in'`;
  assert.equal(rows[0].n,1);console.log('PASS',label,'(two backend PIDs',pa.pid,pb.pid,')');
 }
 await race('direct arrival vs direct arrival',`INSERT INTO transactions VALUES ('${id(10)}','${id(1)}','check_in',now()+interval '1 hour')`,`INSERT INTO transactions VALUES ('${id(11)}','${id(1)}','check_in',now()+interval '1 hour')`,id(1));
 await db.unsafe(`INSERT INTO transactions VALUES ('${id(20)}','${id(2)}','booking',NULL),('${id(21)}','${id(2)}','booking',NULL)`);
 await race('booking conversion vs booking conversion',`UPDATE transactions SET status='check_in' WHERE id='${id(20)}'`,`UPDATE transactions SET status='check_in' WHERE id='${id(21)}'`,id(2));
 await db.unsafe(`INSERT INTO transactions VALUES ('${id(30)}','${id(3)}','booking',NULL)`);
 await race('direct arrival vs booking conversion',`INSERT INTO transactions VALUES ('${id(31)}','${id(3)}','check_in',now()+interval '1 hour')`,`UPDATE transactions SET status='check_in' WHERE id='${id(30)}'`,id(3));
 // The unique index must remain a backstop when an administrator bypasses triggers.
 await db.unsafe('BEGIN; SET LOCAL session_replication_role=replica;');
 await assert.rejects(db.unsafe(`INSERT INTO transactions VALUES ('${id(40)}','${id(1)}','check_in',now())`),/duplicate key/);
 await db.unsafe('ROLLBACK');console.log('PASS unique index backstop with triggers bypassed');
 // Transactions to a separate room must not wait for an unrelated room lock.
 await a.unsafe(`BEGIN; SELECT 1 FROM rooms WHERE id='${id(1)}' FOR UPDATE`);
 await b.unsafe(`SET statement_timeout='2s'; INSERT INTO transactions VALUES ('${id(41)}','${id(4)}','check_in',now()+interval '1 hour')`);
 await a.unsafe('ROLLBACK');console.log('PASS unrelated room remains usable');
 console.log('5 native concurrency/constraint cases PASS. No Cloud connection.');
}finally{
 for(const sql of [a,b,observe,db])if(sql)await sql.end({timeout:2});
 await admin.end({timeout:2});
}
