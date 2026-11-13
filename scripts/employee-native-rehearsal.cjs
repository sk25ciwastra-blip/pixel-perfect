// Gate 6A only: real PostgreSQL sessions, local synthetic identities, no provider.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {run}=require('./employee-native-runner.cjs');
const {id,snapshots,bootstrap}=require('./employee-native-fixture.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let phase='startup';
run(async lab=>{
 const proof={postgresVersion:lab.version,sourceOrder:snapshots.map(({pr,sha,digest})=>({pr,sha,sqlSha256:digest})),races:[],checks:[]};
 const primary=await lab.database(),observer=primary.sql;
 const q=(sql,args=[])=>observer.unsafe(sql,args);
 const one=async(sql,args=[])=> (await q(sql,args))[0].r;
 const connect=async(actor)=>{const sql=lab.open(primary.name);await sql.unsafe('SET statement_timeout=15000;SET lock_timeout=10000;SET ROLE authenticated');await sql.unsafe("SELECT set_config('test.actor',$1,false)",[id(actor)]);return sql;};
 const call=async(c,sql,args=[]) =>(await c.unsafe(sql,args))[0]?.r;
 const pid=async c=>call(c,'SELECT pg_backend_pid() r');
 const tracked=p=>p.then(value=>({ok:true,value}),error=>({ok:false,error})); // catch immediately, never dump error payload
 const success=async pending=>{const r=await pending;if(!r.ok)throw r.error;return r.value;};
 const denied=async(pending,pattern)=>{const r=await pending;assert.equal(r.ok,false);assert.match(r.error.message,pattern);};
 async function waitForBlock(label,waiter,holder){
  for(let i=0;i<100;i++){
   const row=(await q("SELECT pg_blocking_pids($1) blockers,wait_event_type,wait_event FROM pg_stat_activity WHERE pid=$1",[waiter]))[0];
   const chain=(await q(`WITH RECURSIVE chain(pid,depth,seen) AS (
    SELECT $1::int,0,ARRAY[$1::int] UNION ALL
    SELECT b,depth+1,seen||b FROM chain CROSS JOIN LATERAL unnest(pg_blocking_pids(chain.pid)) b WHERE depth<8 AND NOT b=ANY(seen)
   ) SELECT DISTINCT pid FROM chain WHERE depth>0`,[waiter])).map(r=>r.pid);
   if(chain.includes(holder)&&row.wait_event_type==='Lock'){
    proof.races.push({label,waiterPid:waiter,holderPid:holder,blockers:row.blockers,blockingChain:chain,waitType:row.wait_event_type,waitEvent:row.wait_event});
    fs.writeFileSync(path.join(lab.root,'overlap-progress.json'),JSON.stringify(proof.races,null,2));return;
   }
   await sleep(30);
  }
  throw Error('OVERLAP_NOT_PROVEN_'+label.toUpperCase().replaceAll('-','_'));
 }
 const begin=(c,n)=>call(c,'SELECT begin_employee_enrollment($1,$2) r',[id(n),'a'.repeat(64)]);
 const history=(c,employee)=>call(c,'SELECT read_employee_lifecycle($1) r',[employee]);
 const synthetic=n=>({nik:String(n).padStart(16,'0'),phone:'0'.repeat(9),emergencyName:'Synthetic',emergencyRelationship:'Synthetic',emergencyPhone:'0'.repeat(9),birthPlace:'Synthetic',birthDate:'2000-01-01',gender:'Synthetic',address:'Synthetic fixture only',email:`native-enrollment-${n}@example.invalid`});
 let today;
 async function attach(c,n,user){
  const identity=synthetic(n);
  await q('INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,$2,$3)',[id(user),identity.email,{employee_enrollment:{request_id:id(n),actor_id:id(1)}}]);
  await call(c,'SELECT attach_employee_enrollment_auth($1,$2) r',[id(n),id(user)]);return identity;
 }
 const finalize=(c,n,identity)=>call(c,"SELECT finalize_employee_enrollment($1,'Synthetic','receptionist',$2,$3) r",[id(n),today,identity]);
 async function change(c,employee,event,version){return call(c,'SELECT change_employee_lifecycle($1,$2,$3,$4) r',[employee,event,'Synthetic native race review',version]);}
 phase='bootstrap';await bootstrap(q);
 const legacy=await one("SELECT md5(jsonb_agg(to_jsonb(e) ORDER BY id)::text) r FROM employees e");
 const cashBefore=await one("SELECT md5(jsonb_agg(to_jsonb(s) ORDER BY id)::text) r FROM finance_cash_sessions s");
 const preDump=path.join(lab.root,'synthetic-before-cutover.dump');await lab.backup(primary.name,preDump);
 phase='wrong-ddl-owner';
 await q('SET ROLE authenticated');await assert.rejects(q(snapshots[1].sql),/trusted owner/);await q('ROLLBACK;RESET ROLE');
 assert.equal(await one("SELECT to_regclass('employee_lifecycle') IS NULL r"),true);
 phase='wrong-order';
 // No DDL from #69 may survive a missing dependency failure.
 await assert.rejects(q(snapshots[2].sql),/Dependencies PR67/);await q('ROLLBACK');
 assert.equal(await one("SELECT to_regclass('employee_enrollment_number_seq') IS NULL r"),true);
 phase='cutover-install';
 for(const [i,m] of snapshots.entries()){
  await q(m.sql);
  await q('INSERT INTO rehearsal.ledger VALUES($1,$2,$3,$4,current_user)',[i+1,m.pr,m.sha,m.digest]);
 }
 assert.equal(await one("SELECT md5(jsonb_agg(to_jsonb(e) ORDER BY id)::text) r FROM employees e"),legacy);
 today=await one("SELECT (now() AT TIME ZONE 'Asia/Jakarta')::date::text r");
 const a=await connect(1),b=await connect(1),other=await connect(7);
 const aPid=await pid(a),bPid=await pid(b),otherPid=await pid(other);assert.equal(new Set([aPid,bPid,otherPid]).size,3);
 phase='begin-race';
 await a.unsafe('BEGIN');const first=await begin(a,100);assert.equal(first.generated_identifier,'B25EMP-002');
 const duplicate=tracked(begin(b,100)),cross=tracked(begin(other,100));
 await waitForBlock('same-request-begin',bPid,aPid);await waitForBlock('cross-owner-begin',otherPid,aPid);
 await a.unsafe('COMMIT');assert.equal((await success(duplicate)).acquired,false);await denied(cross,/Idempotency mismatch/);
 assert.equal(await one('SELECT count(*)::int r FROM employee_enrollment_requests WHERE request_id=$1',[id(100)]),1);
 phase='independent-ids';
 await Promise.all([a.unsafe('BEGIN'),other.unsafe('BEGIN')]);
 const independent=await Promise.all([begin(a,101),begin(other,102)]);
 assert.equal(new Set(independent.map(r=>r.generated_identifier)).size,2);
 const overlapping=await q("SELECT pid,state FROM pg_stat_activity WHERE pid IN ($1,$2) AND state='idle in transaction'",[aPid,otherPid]);assert.equal(overlapping.length,2);
 proof.races.push({label:'independent-request-ids',backendPids:[aPid,otherPid],distinctOwners:true,simultaneouslyOpenTransactions:overlapping.length});
 await Promise.all([a.unsafe('COMMIT'),other.unsafe('COMMIT')]);
 phase='finalize-versus-recovery';
 const identity=await attach(a,100,30);
 await a.unsafe('BEGIN');const employee=await finalize(a,100,identity);
 const again=tracked(finalize(b,100,identity)),compensate=tracked(call(other,'SELECT cancel_employee_enrollment($1) r',[id(100)]));
 // Cross Owner may not even see request; it must not cancel committed Auth.
 await denied(compensate,/Permintaan tidak tersedia/);
 const recovery=tracked(call(other,'SELECT 1 r'));await success(recovery);
 const c=await connect(1),cPid=await pid(c);
 const cancellation=tracked(call(c,'SELECT cancel_employee_enrollment($1) r',[id(100)]));
 await waitForBlock('same-request-finalize',bPid,aPid);await waitForBlock('finalize-wins-cancel',cPid,aPid);
 await a.unsafe('COMMIT');assert.equal(await success(again),employee);assert.equal((await success(cancellation)).state,'COMPLETED');
 assert.equal(await one('SELECT count(*)::int r FROM employees WHERE user_id=$1',[id(30)]),1);
 assert.equal(await one('SELECT count(*)::int r FROM auth.users WHERE id=$1',[id(30)]),1);
 assert.equal((await history(a,employee)).lifecycle.employment_state,'REGISTERED');
 assert.equal(await one('SELECT active r FROM employees WHERE id=$1',[employee]),false);
 phase='cancel-wins';
 const cancelledIdentity=await attach(a,101,31);
 await a.unsafe('BEGIN');assert.equal((await call(a,'SELECT cancel_employee_enrollment($1) r',[id(101)])).state,'RECOVERY_REQUIRED');
 const lateFinalize=tracked(finalize(b,101,cancelledIdentity));await waitForBlock('cancel-wins-finalize',bPid,aPid);
 await a.unsafe('COMMIT');await denied(lateFinalize,/Permintaan tidak siap/);
 assert.equal(await one('SELECT count(*)::int r FROM employees WHERE user_id=$1',[id(31)]),0);
 // Tombstone preserves the identifier; no Auth deletion is performed here.
 assert.equal((await begin(a,101)).acquired,false);
 const next=await begin(a,103);assert.ok(!independent.map(r=>r.generated_identifier).includes(next.generated_identifier));
 phase='delivery-race';
 await a.unsafe('BEGIN');assert.equal(await call(a,'SELECT claim_employee_setup_delivery($1) r',[id(100)]),true);
 const secondClaim=tracked(call(b,'SELECT claim_employee_setup_delivery($1) r',[id(100)]));await waitForBlock('single-delivery-claim',bPid,aPid);
 await a.unsafe('COMMIT');assert.equal(await success(secondClaim),false);
 await call(a,"SELECT claim_employee_setup_delivery($1,'UNKNOWN') r",[id(100)]);
 assert.equal(await call(b,'SELECT claim_employee_setup_delivery($1) r',[id(100)]),false);
 assert.equal(await one("SELECT count(*)::int r FROM employee_email_audit WHERE event='DELIVERY_ATTEMPTED'"),1);
 phase='stale-lifecycle-race';
 const initial=(await history(a,employee)).current_version;
 await a.unsafe('BEGIN');await change(a,employee,'SUSPEND',initial);
 const stale=tracked(change(b,employee,'END_EMPLOYMENT',initial));await waitForBlock('stale-lifecycle-version',bPid,aPid);
 await a.unsafe('COMMIT');await denied(stale,/Versi lifecycle berubah/);
 assert.equal((await history(a,employee)).lifecycle.employment_state,'SUSPENDED');
 assert.equal(await one("SELECT count(*)::int r FROM employee_lifecycle_events WHERE employee_id=$1 AND event='SUSPEND'",[employee]),1);
 phase='emergency-suspension-existing-session';
 const trainee=await connect(4);await trainee.unsafe("SELECT set_config('app.finance_training_session_id',$1,false)",[id(10)]);
 assert.equal(await call(trainee,'SELECT can_frontdesk($1) r',[id(4)]),true);
 await a.unsafe('BEGIN');await change(a,id(2),'SUSPEND',0);
 // Under READ COMMITTED a statement before commit sees the old committed state.
 assert.equal(await call(trainee,'SELECT can_frontdesk($1) r',[id(4)]),true);
 await a.unsafe('COMMIT');
 assert.equal(await call(trainee,'SELECT can_frontdesk($1) r',[id(4)]),false);
 await assert.rejects(trainee.unsafe("UPDATE finance_cash_sessions SET status='CLOSED' WHERE id=$1",[id(10)]),/tidak boleh/);
 const suspended=await connect(2);await assert.rejects(suspended.unsafe("UPDATE finance_cash_sessions SET status='CLOSED' WHERE id=$1",[id(10)]),/tidak boleh/);
 assert.equal(await one("SELECT md5(jsonb_agg(to_jsonb(s) ORDER BY id)::text) r FROM finance_cash_sessions s"),cashBefore);
 proof.checks.push('existing caller sessions lose authorization after suspension commit; cash unchanged; no retroactive abort claim for already-running statements');
 phase='cutover-security';
 assert.equal(await one('SELECT count(*)=count(DISTINCT employee_id) r FROM employees'),true);
 assert.equal(await one('SELECT count(*)=count(DISTINCT generated_identifier) r FROM employee_enrollment_requests'),true);
 // Live native ACL/owner checks after the entire migration chain, not static grep.
 assert.equal(await one("SELECT bool_and(pg_get_userbyid(p.proowner)=current_user) r FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('begin_employee_enrollment','change_employee_lifecycle','confirm_my_employee_setup')"),true);
 for(const name of ['finance_training_is_restricted(uuid)','finance_training_context_valid(uuid)','validate_employee_identity(jsonb)','append_employee_lifecycle_event(uuid,text,text,date,jsonb,jsonb,timestamptz)']){
  assert.equal(await one('SELECT has_function_privilege($1,$2,$3) r',['authenticated','public.'+name,'EXECUTE']),false);
 }
 for(const name of ['begin_employee_enrollment(uuid,text)','read_employee_identity(uuid)','confirm_my_employee_setup()'])assert.equal(await one('SELECT has_function_privilege($1,$2,$3) r',['anon','public.'+name,'EXECUTE']),false);
 assert.equal(await one("SELECT public IS FALSE r FROM storage.buckets WHERE id='employee-portraits'"),true);
 assert.equal(await one("SELECT count(*)::int r FROM information_schema.columns WHERE table_schema='public' AND table_name='employee_private_profiles' AND column_name ~ '(ktp|password|token)'"),0);
 assert.equal((await call(a,'SELECT read_employee_identity($1) r',[employee])).nik,identity.nik);
 for(const n of [3,4]){const staff=await connect(n);assert.equal(await call(staff,'SELECT count(*)::int r FROM employee_private_profiles'),0);await assert.rejects(call(staff,'SELECT read_employee_identity($1) r',[employee]));}
 await assert.rejects(q("UPDATE employee_lifecycle_events SET reason='tampered'"),/append-only/);
 await assert.rejects(a.unsafe('UPDATE employees SET active=true WHERE id=$1',[employee]),/lifecycle/);
 await assert.rejects(a.unsafe("INSERT INTO employees(user_id,name,employee_id,position) VALUES($1,'Synthetic','MANUAL','receptionist')",[id(31)]),/secure provisioning/);
 // A mismatch must fail closed; complete new-contract registration cannot be
 // called production-ready while the old modal still targets retired create.
 const legacySource=fs.readFileSync('src/lib/employee.functions.ts','utf8'),form=fs.readFileSync('src/routes/karyawan.tsx','utf8');
 assert.match(legacySource,/Pendaftaran manual dinonaktifkan/);assert.match(form,/createEmployee/);assert.match(form,/employeeId,email,password/);
 for(const file of ['src/lib/employee-integration.ts','src/lib/employee-integration-client.ts','src/routes/karyawan.tsx','src/lib/employee.functions.ts']){
  assert.equal(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),cp.execFileSync('git',['show','849761cd47ac33e86cf839aa0cff8adb8ba86f0b:'+file],{encoding:'utf8'}).replaceAll('\r\n','\n'));
 }
 require('./employee-email-test-fixture.cjs'); // TypeScript loader only, never signs real approval.
 const {createEmployeeIntegration}=require('../src/lib/employee-integration.ts');
 let attempted=0;
 const controller=createEmployeeIntegration({approval:async()=>({state:'BLOCKED'}),enroll:async()=>{attempted++;}},()=>id(300));
 await assert.rejects(controller.submit({name:'Synthetic',position:'receptionist',joinDate:today,identity:synthetic(300)}),/OWNER_CONFIGURATION_REQUIRED/);assert.equal(attempted,0);controller.dispose();
 assert.equal((await require('../src/lib/employee-email-approval.server.ts').evaluateEmployeeEmailApproval({})).state,'OWNER_INPUT_REQUIRED');
 const own=createEmployeeIntegration({password:async input=>{assert.deepEqual(Object.keys(input),['password']);return {ok:true};}});
 await assert.rejects(own.ownPassword({password:'Synthetic-password-only-123!',userId:id(1)}));await own.ownPassword({password:'Synthetic-password-only-123!'});own.dispose();
 proof.checks.push('exact SQL dependency ledger/owner/ACL; legacy insert and direct active toggle denied; private bucket; email blocked; legacy modal remains NO-GO');
 phase='restore-rehearsal';
 // Canonical synthetic dataset + exact schema/ACL dump; restore is to a fresh DB.
 const digestSql=`SELECT md5(jsonb_build_object(
 'employees',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM employees t),
 'auth',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM auth.users t),
 'roles',(SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id) FROM user_roles t),
 'lifecycle',(SELECT jsonb_agg(to_jsonb(t) ORDER BY employee_id) FROM employee_lifecycle t),
 'events',(SELECT jsonb_agg(to_jsonb(t) ORDER BY employee_id,version) FROM employee_lifecycle_events t),
 'requests',(SELECT jsonb_agg(to_jsonb(t) ORDER BY request_id) FROM employee_enrollment_requests t),
 'emailAudit',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM employee_email_audit t),
 'profiles',(SELECT jsonb_agg(to_jsonb(t) ORDER BY employee_id) FROM employee_private_profiles t),
 'cash',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM finance_cash_sessions t),
 'ledger',(SELECT jsonb_agg(to_jsonb(t) ORDER BY ordinal) FROM rehearsal.ledger t),
 'sequence',(SELECT jsonb_build_array(last_value,is_called) FROM employee_enrollment_number_seq)
 )::text) r`;
 const before=await one(digestSql),dump=path.join(lab.root,'synthetic-cutover.dump');
 await lab.backup(primary.name,dump);
 const restored=await lab.database();await lab.restore(restored.name,dump);
 assert.equal((await restored.sql.unsafe(digestSql))[0].r,before);
 const sequence=await one('SELECT last_value::text r FROM employee_enrollment_number_seq');
 assert.equal((await restored.sql.unsafe('SELECT last_value::text r FROM employee_enrollment_number_seq'))[0].r,sequence);
 assert.equal((await restored.sql.unsafe("SELECT public IS FALSE r FROM storage.buckets WHERE id='employee-portraits'"))[0].r,true);
 assert.equal((await restored.sql.unsafe("SELECT has_function_privilege('anon','public.confirm_my_employee_setup()','EXECUTE') r"))[0].r,false);
 const baselineRestore=await lab.database();await lab.restore(baselineRestore.name,preDump);
 assert.equal((await baselineRestore.sql.unsafe("SELECT md5(jsonb_agg(to_jsonb(e) ORDER BY id)::text) r FROM employees e"))[0].r,legacy);
 assert.equal((await baselineRestore.sql.unsafe("SELECT to_regclass('employee_enrollment_requests') IS NULL r"))[0].r,true);
 assert.equal((await baselineRestore.sql.unsafe('SELECT count(*)::int r FROM rehearsal.ledger'))[0].r,0);
 proof.restore={postCutoverDataLedgerSequenceEqual:true,preCutoverLegacyEqual:true,preCutoverNewContractAbsent:true,privateBucketAndAnonDenyRetained:true};
 proof.checks.push('before-cutover dump restores legacy fixture and absence of new contract; wrong DDL owner rejected before schema mutation');
 proof.checks.push('native pg_dump/pg_restore to fresh DB: synthetic data/ledger/sequence digests equal; private bucket and callback ACL retained');
 proof.result='PASS';proof.gates={gate5:'PARTIAL',gate6A:'PASS_NATIVE_REHEARSAL_ONLY',gate6:'PARTIAL_PROVIDER_NOT_REACHED',gate7:'NOT_REACHED',completed:4,total:7,percent:57.1};
 fs.writeFileSync(path.join(lab.root,'evidence.json'),JSON.stringify(proof,null,2));
 console.log('PASS native PostgreSQL '+lab.version+': '+proof.races.length+' proven race/overlap scenarios; isolated dependency cutover and dump/restore');
 for(const r of proof.races)console.log('PASS overlap '+JSON.stringify(r));
 console.log('PASS cutover guard/ACL/ledger/private metadata/blocked email; native restore retains data and sequence');
 console.log('NOT REACHED real Auth/SMTP/Storage, browser/final modal, whole finance/receipt runtime; checkpoint remains 4/7 = 57.1%');
}).catch(e=>{console.error('FAIL native rehearsal phase='+phase+' code='+(e.code||e.name)+(e.tool?' tool='+e.tool:'')+' reason='+(/^[A-Z0-9_]+$/.test(e.message)?e.message:'DETAIL_REDACTED'));process.exitCode=1;});
