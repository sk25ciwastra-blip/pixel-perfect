// ID-only regression: complete pending SQL, isolated PostgreSQL, no external services.
const assert=require('node:assert/strict');const fs=require('node:fs');const {fixture,id}=require('./secure-employee-fixture.cjs');
const sql=fs.readFileSync('supabase/pending/20261113174830_secure_employee_provisioning.sql','utf8');
(async()=>{const {db}=await fixture();try{
 // Isolated historic fixture, prepared BEFORE installing the read-only generator.
 await db.query("UPDATE employees SET employee_id='B25EMP-002' WHERE id=$1",[id(2)]);
 const legacy=JSON.stringify((await db.query('SELECT * FROM employees ORDER BY id')).rows);
 const cash=JSON.stringify((await db.query('SELECT * FROM finance_cash_sessions')).rows);
 await db.exec(sql);
 for(const n of [1,2,10,100,999,1000,10000]){
  const actual=(await db.query('SELECT format_new_employee_identifier($1) code',[n])).rows[0].code;
  assert.equal(actual,`B25EMP-${String(n).padStart(3,'0')}`);
 }
 assert.equal((await db.query('SELECT format_new_employee_identifier(0) code')).rows[0].code,null);
 assert.equal(JSON.stringify((await db.query('SELECT * FROM employees ORDER BY id')).rows),legacy);
 await db.exec('SET ROLE authenticated');
 const reserve=async n=>(await db.query('SELECT begin_employee_enrollment($1,$2) r',[id(n),'a'.repeat(64)])).rows[0].r;
 const first=await reserve(100);assert.equal(first.generated_identifier,'B25EMP-001');
 assert.equal(first.acquired,true);
 const replay=await reserve(100);assert.equal(replay.generated_identifier,first.generated_identifier);assert.equal(replay.acquired,false);
 await assert.rejects(db.query('SELECT begin_employee_enrollment($1,$2)',[id(100),'b'.repeat(64)]),/Idempotency mismatch/);
 assert.equal((await reserve(101)).generated_identifier,'B25EMP-003'); // historic 002 skipped
 await db.query('SELECT cancel_employee_enrollment($1,false)',[id(101)]);
 await db.query('SELECT cancel_employee_enrollment($1,true)',[id(101)]);
 assert.equal((await reserve(102)).generated_identifier,'B25EMP-004'); // cancelled 003 not reused
 await assert.rejects(db.query("SELECT nextval('public.employee_enrollment_number_seq')"),e=>e.code==='42501');
 await assert.rejects(db.query('SELECT format_new_employee_identifier(1)'),e=>e.code==='42501');
 await db.exec('RESET ROLE');
 // Fixture archive removal/year changes cannot rewind the sequence. No test clock
 // rewrite or generator replacement: real generator is independent of dates.
 await db.query('DELETE FROM employee_enrollment_requests WHERE request_id=$1',[id(101)]);
 await db.query("UPDATE employee_enrollment_requests SET created_at='2025-12-31T23:59:59+07:00' WHERE request_id=$1",[id(102)]);
 await db.exec('SET ROLE authenticated');assert.equal((await reserve(103)).generated_identifier,'B25EMP-005');
 await db.exec('RESET ROLE');
 await db.query("UPDATE employee_enrollment_requests SET created_at='2027-01-01T00:00:00+07:00' WHERE request_id=$1",[id(103)]);
 await db.exec('SET ROLE authenticated');assert.equal((await reserve(104)).generated_identifier,'B25EMP-006');
 await db.exec('RESET ROLE');
 const definition=(await db.query("SELECT pg_get_functiondef('public.begin_employee_enrollment(uuid,text)'::regprocedure) def")).rows[0].def;
 assert.doesNotMatch(definition,/extract\s*\(|date_part|current_date|setval/i);
 await db.query('INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,$2,$3)',[id(50),'fixture@example.invalid',{employee_enrollment:{request_id:id(100),actor_id:id(1)}}]);
 await db.exec('SET ROLE authenticated');await db.query('SELECT attach_employee_enrollment_auth($1,$2)',[id(100),id(50)]);
 const today=(await db.query("SELECT (now() AT TIME ZONE 'Asia/Jakarta')::date::text d")).rows[0].d;
 const identity={nik:'0'.repeat(16),phone:'0'.repeat(9),emergencyName:'Fixture',emergencyRelationship:'Fixture',emergencyPhone:'0'.repeat(9),birthPlace:'Fixture',birthDate:'2000-01-01',gender:'Fixture',address:'Fixture address',email:'fixture@example.invalid'};
 const employee=(await db.query("SELECT finalize_employee_enrollment($1,'Fixture','receptionist',$2,$3) e",[id(100),today,identity])).rows[0].e;
 const code=async()=>(await db.query('SELECT employee_id FROM employees WHERE id=$1',[employee])).rows[0].employee_id;
 await db.query("UPDATE employees SET position='supervisor' WHERE id=$1",[employee]);assert.equal(await code(),'B25EMP-001');
 const life=async()=>(await db.query('SELECT read_employee_lifecycle($1) r',[employee])).rows[0].r;
 const assignment=(await db.query('SELECT prepare_employee_training($1,$2,$3,$4) a',[employee,id(1),today,(await life()).current_version])).rows[0].a;
 await db.query("SELECT resolve_finance_training_assignment($1,'PASSED','Fixture approval')",[assignment]);
 for(const event of ['ACTIVATE','SUSPEND','REACTIVATE','SUSPEND','REACTIVATE','END_EMPLOYMENT']){
  await db.query("SELECT change_employee_lifecycle($1,$2,'Fixture ID permanence',$3)",[employee,event,(await life()).current_version]);
  assert.equal(await code(),'B25EMP-001');
 }
 await assert.rejects(db.query("UPDATE employees SET employee_id='B25EMP-777' WHERE id=$1",[employee]),/read-only/);
 await assert.rejects(db.query("UPDATE employees SET employee_id='B25EMP-777' WHERE id=$1",[id(2)]),/read-only/);
 await db.exec('RESET ROLE');
 // Forward-only fixture cursor simulates a mature global sequence, never a reset.
 await db.query("SELECT setval('public.employee_enrollment_number_seq',998,true)");
 await db.exec('SET ROLE authenticated');assert.equal((await reserve(105)).generated_identifier,'B25EMP-999');
 assert.equal((await reserve(106)).generated_identifier,'B25EMP-1000');
 await db.exec('RESET ROLE');assert.equal((await reserve(107)).generated_identifier,'B25EMP-1001');
 assert.equal(JSON.stringify((await db.query('SELECT * FROM employees WHERE id<>$1 ORDER BY id',[employee])).rows),legacy);
 assert.equal(JSON.stringify((await db.query('SELECT * FROM finance_cash_sessions')).rows),cash);
 const service=fs.readFileSync('src/lib/employee-provisioning.server.ts','utf8');
 assert.match(service,/approvedEmployeeDelivery\(\)[^{]*\{ return null; \}/);
 const contract=fs.readFileSync('src/lib/employee-enrollment.ts','utf8');
 assert.match(contract,/strictObject\(input,\['requestId','name','position','joinDate','identity'\]\)/);
 console.log('PASS official B25EMP 1/2/10/100/999/1000/10000; initial 001, historic collision, replay/mismatch, cancellation/archive non-reuse, date-independent global increment, readonly/permanent across position/lifecycle, unchanged legacy/cash, delivery still blocked');
 console.log('NOT REACHED native multi-session concurrency; no claim of recovering unarchived IDs deleted before generator existed');
}finally{await db.close();}
 const second=await fixture();try{
  await second.db.query("UPDATE employees SET employee_id='B25EMP-001' WHERE id=$1",[id(2)]);
  await second.db.exec(sql);await second.db.exec('SET ROLE authenticated');
  const r=(await second.db.query('SELECT begin_employee_enrollment($1,$2) r',[id(200),'a'.repeat(64)])).rows[0].r;
  assert.equal(r.generated_identifier,'B25EMP-002');
  assert.equal((await second.db.query('SELECT employee_id FROM employees WHERE id=$1',[id(2)])).rows[0].employee_id,'B25EMP-001');
  console.log('PASS initial 001 already in use: skip to 002 without renumbering historical employee');
 }finally{await second.db.close();}
})().catch(e=>{console.error(`FAIL employee ID: ${e.code||e.name} ${e.message}`);process.exitCode=1;});
