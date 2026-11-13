// New cutover seams only; fake Auth/mail transport, no remote calls or real tokens.
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const {signedFixture}=require('./employee-email-test-fixture.cjs');
const {fixture,id}=require('./secure-employee-fixture.cjs');
const {createEmployeeIntegration}=require('../src/lib/employee-integration.ts');
const core=require('../src/lib/employee-provisioning.server.ts');
const service=require('../src/lib/employee-services.server.ts');
const {exchangeEmployeeSetup}=require('../src/lib/employee-email-callback.server.ts');
const read=p=>fs.readFileSync(p,'utf8');
(async()=>{const {db,actor}=await fixture();try{
 // Exact, complete SQL dependency order #67 -> #68 (fixture) -> #69 -> #70.
 await db.exec(cp.execFileSync('git',['show','a8acfcf548bcba11111361f0b4e03ef82dd69c38:supabase/pending/20261113174830_secure_employee_provisioning.sql'],{encoding:'utf8'}));
 await db.exec(read('supabase/pending/20261113202919_employee_email_delivery_contract.sql'));
 const cash=JSON.stringify((await db.query('SELECT * FROM finance_cash_sessions')).rows);
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0].r;
 const approved=(await signedFixture()).approval;let verified=false,authCreates=0,deliveries=0,failResponse=false;
 const today=await one("SELECT (now() AT TIME ZONE 'Asia/Jakarta')::date::text r");
 const draft={name:'Synthetic',position:'receptionist',joinDate:today,identity:{nik:'0'.repeat(16),phone:'0'.repeat(9),emergencyName:'Synthetic',emergencyRelationship:'Synthetic',emergencyPhone:'0'.repeat(9),birthPlace:'Synthetic',birthDate:'2000-01-01',gender:'Synthetic',address:'Synthetic fixture',email:'integration@example.invalid'}};
 const privileged=async work=>{await db.exec('RESET ROLE');try{return await work();}finally{await db.exec('SET ROLE authenticated');}};
 const ports={owner:()=>one('SELECT can_manage_employee_private_profile() r'),begin:(req,fp)=>one('SELECT begin_employee_enrollment($1,$2) r',[req,fp]),
 createAuth:async(email,password,req)=>{authCreates++;assert.ok(password.length>=64);return privileged(async()=>{await db.query('INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,$2,$3)',[id(30),email,{employee_enrollment:{request_id:req,actor_id:id(1)}}]);return id(30);});},
 attach:(req,user)=>one('SELECT attach_employee_enrollment_auth($1,$2) r',[req,user]),
 finalize:input=>one('SELECT finalize_employee_enrollment($1,$2,$3,$4,$5) r',[input.requestId,input.name,input.position,input.joinDate,input.identity]),
 cancel:(req,done)=>one('SELECT cancel_employee_enrollment($1,$2) r',[req,done]),deleteCreatedAuth:async()=>{throw Error('UNEXPECTED_DELETE');},
 claimDelivery:(req,outcome)=>one('SELECT claim_employee_setup_delivery($1,$2) r',[req,outcome??null]),sendSetup:async()=>{deliveries++;}};
 const adapter=createEmployeeIntegration({approval:async()=>({state:verified?'VERIFIED':'BLOCKED'}),
 enroll:async input=>{const r=await core.provisionEmployee(input,ports,approved);if(failResponse){failResponse=false;throw Error('SYNTHETIC_RESPONSE_LOSS');}return r;},
 recover:req=>service.recoverEmployeeEnrollment(ports,req),
 lifecycle:input=>one('SELECT read_employee_lifecycle($1,$2) r',[input.employeeId,input.afterVersion]),
 change:input=>one('SELECT change_employee_lifecycle($1,$2,$3,$4,$5,$6) r',[input.employeeId,input.event,input.reason,input.expectedVersion,input.effectiveOn,input.joinDate]),
 training:input=>one('SELECT prepare_employee_training($1,$2,$3,$4) r',[input.employeeId,input.supervisorUserId,input.startsOn,input.expectedVersion]),
 password:input=>service.changeOwnEmployeePassword({auth:{getUser:async()=>({data:{user:{id:id(30)}}})}},id(30),input,async()=>({ok:true})),
 resolveTraining:async input=>{assert.equal(await ports.owner(),true);return one('SELECT resolve_finance_training_assignment($1,$2,$3) r',[input.assignmentId,input.status,input.reason]);},
 identity:employeeId=>one('SELECT read_employee_identity($1) r',[employeeId]),
 updateIdentity:(employeeId,identity)=>one('SELECT update_employee_identity($1,$2) r',[employeeId,identity]),
 portrait:async()=>{throw Error('NOT_REACHED_STORAGE');},uploadPortrait:async()=>{throw Error('NOT_REACHED_STORAGE');},
 },()=>id(40));
 await db.exec('SET ROLE authenticated');await actor(1);
 await assert.rejects(adapter.submit(draft),/OWNER_CONFIGURATION_REQUIRED/);assert.equal(authCreates,0);assert.equal(deliveries,0);
 for(const extra of [{employeeId:'manual'},{password:'manual'},{active:true},{actorId:id(1)},{ktp:'upload'}])await assert.rejects(adapter.submit({...draft,...extra}));
 verified=true;failResponse=true;await assert.rejects(adapter.submit(draft),/SYNTHETIC_RESPONSE_LOSS/);
 const receipt=await adapter.submit(draft);assert.equal(receipt.replayed,true);assert.match(receipt.employeeCode,/^B25EMP-\d{3,}$/);assert.equal(authCreates,1);assert.equal(deliveries,1);
 assert.equal(JSON.stringify(receipt).includes(draft.identity.nik),false);
 await assert.rejects(adapter.submit({...draft,name:'Changed'}),/DRAFT_CHANGED_REVIEW_REQUIRED/);
 assert.equal((await adapter.recover()).state,'COMPLETED');assert.equal(authCreates,1);
 const employee=receipt.employeeId;const history=()=>adapter.read({employeeId:employee});
 assert.equal((await adapter.readIdentity(employee)).nik,draft.identity.nik);
 await adapter.updateIdentity({employeeId:employee,identity:{...draft.identity,address:'Updated synthetic address'}});
 await assert.rejects(adapter.uploadPortrait({employeeId:employee,mime:'application/pdf',base64:'invalid'}),/PORTRAIT_INVALID/);
 await assert.rejects(adapter.updateIdentity({employeeId:employee,identity:{...draft.identity,ktpPhoto:'forbidden'}}));
 let h=await history();assert.equal(h.lifecycle.employment_state,'REGISTERED');assert.equal(h.lifecycle.join_date,today);assert.equal(h.account.operational_compat_active,false);
 const command=async event=>{const v=(await history()).current_version;return adapter.change({employeeId:employee,event,reason:'Synthetic Owner review',expectedVersion:v});};
 await assert.rejects(command('ACTIVATE'),/Aktivasi memerlukan/);
 await actor(30);let passwordUpdates=0;
 const ctx=await exchangeEmployeeSetup({tokenHash:'x'.repeat(64),type:'recovery'},approved,approved.siteOrigin,'application/json',{
 verify:async()=>({userId:id(30),session:{user:{id:id(30)},access_token:'synthetic-opaque-access',refresh_token:'synthetic-opaque-refresh',expires_at:Date.now()/1000+60}}),currentUser:async()=>id(30),context:()=>one('SELECT confirm_my_employee_setup() r'),revoke:async()=>{},});
 assert.equal(ctx.nextStep,'SET_PASSWORD_ONLY');
 await adapter.ownPassword({password:'Synthetic-only-password-123!'});
 assert.throws(()=>require('../src/lib/employee-enrollment.ts').validateOwnPasswordChange({password:'Synthetic-only-password-123!',userId:id(1)}));
 await service.changeOwnEmployeePassword({auth:{getUser:async()=>({data:{user:{id:id(30)}}})}},id(30),{password:'Synthetic-only-password-123!'},async()=>{passwordUpdates++;return {ok:true};});assert.equal(passwordUpdates,1);
 await assert.rejects(service.changeOwnEmployeePassword({auth:{getUser:async()=>({data:{user:null}})}},id(30),{password:'Synthetic-only-password-123!'},async()=>{passwordUpdates++;return {ok:true};}),/ACCESS_DENIED/);assert.equal(passwordUpdates,1);
 for(const n of [1,2,3,4,6]){let count=0;await service.changeOwnEmployeePassword({auth:{getUser:async()=>({data:{user:{id:id(n)}}})}},id(n),{password:'Synthetic-only-password-123!'},async()=>{count++;return {ok:true};});assert.equal(count,1);}
 for(const n of [2,3,4,5,6]){await actor(n);await assert.rejects(history(),/Akses ditolak/);await assert.rejects(adapter.readIdentity(employee));await assert.rejects(adapter.submit(draft),/ACCESS_DENIED/);}
 await actor(1);h=await history();await actor(2);
 const assignment=await adapter.prepareTraining({employeeId:employee,supervisorUserId:id(2),startsOn:today,expectedVersion:h.current_version});
 await assert.rejects(adapter.change({employeeId:employee,event:'ACTIVATE',reason:'Synthetic review',expectedVersion:h.current_version}),/Akses ditolak/);
 await actor(1);h=await history();assert.equal(h.training.assignment.id,assignment);
 // Installed exact SQL above; inject a clock ONLY into local function definitions
 // for cross-midnight integration scenarios. No project SQL is rewritten.
 await privileged(async()=>{
 const defs=(await db.query("SELECT pg_get_functiondef(p.oid) d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND (p.prosrc LIKE '%now()%' OR p.prosrc LIKE '%clock_timestamp()%')")).rows;
 for(const {d} of defs)await db.exec(d.replaceAll('clock_timestamp()',"current_setting('test.integration_now')::timestamptz").replaceAll('now()',"current_setting('test.integration_now')::timestamptz"));
 });
 const dayOffset=n=>new Date(Date.parse(today+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
 for(const [d,time,status] of [[today,'23:59:00','ACTIVE'],[dayOffset(1),'00:00:00','ACTIVE'],[dayOffset(2),'00:00:00','EXPIRED_PENDING_OWNER']]){
 await db.query("SELECT set_config('test.integration_now',$1,false)",[d+'T'+time+'+07:00']);assert.equal((await history()).training.display_status,status);
 await assert.rejects(command('ACTIVATE'),/Aktivasi memerlukan/);
 }
 await adapter.resolveTraining({assignmentId:assignment,status:'PASSED',reason:'Synthetic Owner decision'});
 h=await history();assert.equal(h.lifecycle.employment_state,'REGISTERED');assert.equal(h.account.operational_compat_active,false);
 await command('ACTIVATE');await command('SUSPEND');await command('REACTIVATE');h=await history();
 assert.equal(h.lifecycle.employment_state,'ACTIVE');assert.equal(h.events.filter(e=>e.event==='SUSPEND').length,1);assert.equal(h.events.filter(e=>e.event==='REACTIVATE').length,1);
 await privileged(async()=>{await assert.rejects(db.exec("UPDATE employee_lifecycle_events SET reason='edited'"),/append-only/);assert.equal(JSON.stringify((await db.query('SELECT * FROM finance_cash_sessions')).rows),cash);});
 await actor(null);await assert.rejects(history(),/Akses ditolak/);await db.exec('RESET ROLE;SET ROLE anon');await assert.rejects(history(),e=>e.code==='42501');
 adapter.dispose();assert.equal(adapter.getRequestId(),null);
 // Independent form instances, concurrent-submit latch and explicit teardown.
 let release,entered;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 const latch=createEmployeeIntegration({approval:async()=>{entered();await gate;return {state:'BLOCKED'};}},()=>id(60));
 const pending=latch.submit(draft);await started;
 await assert.rejects(latch.submit(draft),/REQUEST_IN_PROGRESS/);assert.throws(()=>latch.newDraft(),/REQUEST_IN_PROGRESS/);
 release();await assert.rejects(pending,/OWNER_CONFIGURATION_REQUIRED/);latch.dispose();
 // Binding/source seams, not a browser PASS claim.
 const client=read('src/lib/employee-integration-client.ts');for(const name of ['provisionSecureEmployee','recoverSecureEmployee','changeOwnPassword','changeEmployeeLifecycle','prepareEmployeeTraining','readEmployeeLifecycle'])assert.ok(client.includes(name));
 assert.ok(!/localStorage|sessionStorage|supabaseAdmin|console\./.test(client));
 assert.ok(read('src/routes/pengaturan.tsx').includes('mode:\'own\''));assert.ok(read('src/routes/reset-password.tsx').includes('controller.ownPassword({password})'));
 for(const file of ['src/routes/reset-password.tsx','src/routes/pengaturan.tsx']){
  const before=cp.execFileSync('git',['show','98e87d1e86803bb0d77c5aaf0a67ac846bb082ea:'+file],{encoding:'utf8'});
  assert.deepEqual([...read(file).matchAll(/className="([^"]*)"/g)].map(m=>m[1]),[...before.matchAll(/className="([^"]*)"/g)].map(m=>m[1]));
 }
 for(const p of ['src/lib/employee-lifecycle.ts','src/lib/employee-lifecycle.functions.ts'])assert.equal(read(p).replaceAll('\r\n','\n'),cp.execFileSync('git',['show','b9460e98e56ea0a58da828f2208a468e8cdb09af:'+p],{encoding:'utf8'}).replaceAll('\r\n','\n'));
 console.log('PASS integrated dependency SQL + new adapter: enrollment/config/privacy/idempotency/recovery, own Auth-only setup/password, Owner/staff/Training/anon matrix, WIB day1/day2/expiry + explicit Owner activation, immutable suspend/reactivate, no cash mutation');
 console.log('NOT REACHED browser form wiring, live Auth/SMTP/Storage, native concurrency; legacy employee modal remains cutover blocker');
}finally{await db.close();}})().catch(e=>{console.error('FAIL synthetic employee integration '+(e.code||e.name)+': '+e.message);process.exitCode=1;});
