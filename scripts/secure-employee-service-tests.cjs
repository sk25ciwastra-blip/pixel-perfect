const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const contracts=require('../src/lib/employee-enrollment.ts');
const core=require('../src/lib/employee-provisioning.server.ts');
const media=require('../src/lib/employee-portrait.server.ts');
const service=require('../src/lib/employee-services.server.ts');
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const request=()=>contracts.validateEmployeeEnrollment({requestId:id(20),name:'Fixture',position:'receptionist',joinDate:'2026-11-14',identity:{nik:'0'.repeat(16),phone:'0'.repeat(9),emergencyName:'Fixture',emergencyRelationship:'Fixture',emergencyPhone:'0'.repeat(9),birthPlace:'Fixture',birthDate:'2000-01-01',gender:'Fixture',address:'Fixture address',email:'fixture@example.invalid'}});
const approval={redirectTo:'https://example.invalid/account/setup',fingerprintKey:crypto.getRandomValues(new Uint8Array(32))};
function ports(overrides={}){
 const calls=[];const state={state:'RESERVED',acquired:true,auth_user_id:null,employee_id:null,generated_identifier:'TEST-ONLY',delivery_state:'NOT_ATTEMPTED'};
 const p={owner:async()=>true,begin:async(_,fingerprint)=>{assert.match(fingerprint,/^[a-f0-9]{64}$/);return {...state};},createAuth:async(_,secret)=>{assert.ok(secret.length>=64);calls.push('create');return id(30);},attach:async()=>calls.push('attach'),finalize:async()=>{state.state='COMPLETED';state.employee_id=id(31);calls.push('finalize');return id(31);},cancel:async(_,done)=>{calls.push(done?'cancel-done':'cancel-fence');if(state.state!=='COMPLETED')state.state=done?'CANCELLED':'RECOVERY_REQUIRED';return {...state};},deleteCreatedAuth:async()=>calls.push('delete'),claimDelivery:async(_,outcome)=>{calls.push(outcome||'claim');return true;},sendSetup:async()=>calls.push('setup'),...overrides};
 return {p,calls,state};
}
function png(){
 const chunks=[];const chunk=(type,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);let crc=0xffffffff;for(const v of b.subarray(4,8+data.length)){crc^=v;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}b.writeUInt32BE((crc^0xffffffff)>>>0,8+data.length);chunks.push(b);};
 const h=Buffer.alloc(13);h.writeUInt32BE(1);h.writeUInt32BE(1,4);h[8]=8;h[9]=6;chunk('IHDR',h);chunk('IDAT',require('node:zlib').deflateSync(Buffer.from([0,0,0,0,255])));chunk('IEND',Buffer.alloc(0));
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),...chunks]);
}
(async()=>{
 const input=request();assert.equal(input.identity.nik,'0'.repeat(16));
 for(const extra of [{employeeId:'manual'},{password:'manual'},{actorId:id(1)},{role:'owner'},{active:true}])assert.throws(()=>contracts.validateEmployeeEnrollment({...input,...extra}));
 assert.throws(()=>contracts.validatePrivateIdentity({...input.identity,birthDate:'2026-02-30'}));
 const a=core.createInitialEmployeeSecret(),b=core.createInitialEmployeeSecret();assert.notEqual(a,b);assert.ok(a.length>=64);
 assert.equal(core.approvedEmployeeDelivery(),null);
 for(const role of ['Supervisor','Receptionist','Training','anon']){const {p,calls}=ports({owner:async()=>false});await assert.rejects(core.provisionEmployee(input,p,approval),/ACCESS_DENIED/);assert.deepEqual(calls,[]);}
 {const {p,calls}=ports();await assert.rejects(core.provisionEmployee(input,p,null),/OWNER_DECISION_PENDING/);assert.deepEqual(calls,[]);}
 {const {p,calls}=ports();const result=await core.provisionEmployee(input,p,approval);assert.deepEqual(calls,['create','attach','finalize','claim','setup','SENT']);assert.equal(result.delivery,'SENT');assert.equal(JSON.stringify(result).includes(input.identity.email),false);assert.equal(JSON.stringify(result).includes(input.identity.nik),false);}
 {const {p,calls}=ports({createAuth:async()=>{throw Error('duplicate email');}});await assert.rejects(core.provisionEmployee(input,p,approval),/PROVISIONING_FAILED/);assert.equal(calls.includes('delete'),false);}
 {const {p,calls}=ports({finalize:async()=>{throw Error('sensitive provider detail');}});await assert.rejects(core.provisionEmployee(input,p,approval),/^Error: PROVISIONING_FAILED$/);assert.deepEqual(calls,['create','attach','cancel-fence','delete','cancel-done']);}
 {const {p,calls}=ports({finalize:async()=>{throw Error();},cancel:async()=>{throw Error();}});await assert.rejects(core.provisionEmployee(input,p,approval),/RECOVERY_REQUIRED/);assert.equal(calls.includes('delete'),false);}
 {const {p,calls,state}=ports();p.finalize=async()=>{state.state='COMPLETED';state.employee_id=id(31);throw Error('commit response lost');};const r=await core.provisionEmployee(input,p,approval);assert.equal(r.replayed,true);assert.equal(calls.includes('delete'),false);}
 {const {p,calls}=ports({sendSetup:async()=>{throw Error('SMTP result unknown');}});const r=await core.provisionEmployee(input,p,approval);assert.equal(r.delivery,'UNKNOWN');assert.equal(calls.includes('delete'),false);assert.equal(calls.filter(x=>x==='claim').length,1);}
 {const {p,calls,state}=ports();state.acquired=false;state.state='COMPLETED';state.employee_id=id(31);const r=await core.provisionEmployee(input,p,approval);assert.equal(r.replayed,true);assert.deepEqual(calls,[]);}
 {const {p,calls,state}=ports();state.acquired=false;await assert.rejects(core.provisionEmployee(input,p,approval),/REQUEST_IN_PROGRESS/);assert.deepEqual(calls,[]);}
 {const {p,calls,state}=ports();state.state='AUTH_ATTACHED';state.auth_user_id=id(30);const r=await service.recoverEmployeeEnrollment(p,input.requestId);assert.equal(r.state,'CANCELLED');assert.deepEqual(calls,['cancel-fence','delete','cancel-done']);}
 {const {p,calls}=ports();await assert.rejects(service.recoverEmployeeEnrollment(p,input.requestId),/RECOVERY_REVIEW_REQUIRED/);assert.equal(calls.includes('delete'),false);}
 let deleted=0;
 const authAdmin={auth:{admin:{getUserById:async()=>({data:{user:{app_metadata:{employee_enrollment:{request_id:id(99),actor_id:id(1)}}}},error:null}),deleteUser:async()=>{deleted++;return {error:null};}}}};
 const bindings=service.createProvisioningPorts({},authAdmin,id(1));await assert.rejects(bindings.deleteCreatedAuth(id(30),input.requestId),/RECOVERY_REQUIRED/);assert.equal(deleted,0);
 console.log('PASS Owner-only gate, CSPRNG, pending decisions, sanitized result/errors, idempotency, duplicate-email safety, compensation fencing, ambiguous commit and delivery recovery');
 // No committed sample passwords: generated only in isolated test memory.
 const own=contracts.validateOwnPasswordChange({password:core.createInitialEmployeeSecret()});
 for(const abuse of [{userId:id(2)},{role:'owner'},{email:'fixture@example.invalid'},{active:true}])assert.throws(()=>contracts.validateOwnPasswordChange({...own,...abuse}));
 let changed=0;const ownClient={auth:{getUser:async()=>({data:{user:{id:id(1)}},error:null})}};
 const update=service.authenticatedOwnPasswordUpdater('https://example.invalid','fixture-publishable','Bearer fixture-opaque',async(url,init)=>{
   assert.equal(url,'https://example.invalid/auth/v1/user');assert.equal(init.method,'PUT');assert.equal(init.cache,'no-store');assert.equal(init.headers.Authorization,'Bearer fixture-opaque');assert.deepEqual(Object.keys(JSON.parse(init.body)),['password']);changed++;return new Response('{}',{status:200});
 });
 await service.changeOwnEmployeePassword(ownClient,id(1),own,update);await assert.rejects(service.changeOwnEmployeePassword(ownClient,id(2),own,update),/ACCESS_DENIED/);assert.equal(changed,1);
 const bytes=png();assert.equal(media.verifyEmployeePortrait(bytes,'image/png').mime,'image/png');
 assert.throws(()=>media.verifyEmployeePortrait(bytes,'image/jpeg'));
 assert.throws(()=>media.verifyEmployeePortrait(new Uint8Array(2097153),'image/png'));
 assert.throws(()=>media.verifyEmployeePortrait(bytes.subarray(0,40),'image/png'));
 const corrupt=Buffer.from(bytes);corrupt[corrupt.length-1]^=1;assert.throws(()=>media.verifyEmployeePortrait(corrupt,'image/png'));
 assert.throws(()=>media.decodePortraitBase64('data:image/png;base64,invalid'));assert.deepEqual(media.decodePortraitBase64(bytes.toString('base64')),new Uint8Array(bytes));
 // Minimal structural JPEG/WebP fixtures, not a pixel decoding/face recognition claim.
 const jpeg=Buffer.from([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,0,255,217]);
 assert.equal(media.verifyEmployeePortrait(jpeg,'image/jpeg').mime,'image/jpeg');
 const webp=Buffer.alloc(26);webp.write('RIFF');webp.writeUInt32LE(18,4);webp.write('WEBPVP8L',8);webp.writeUInt32LE(5,16);webp[20]=0x2f;
 assert.equal(media.verifyEmployeePortrait(webp,'image/webp').mime,'image/webp');webp.writeUInt32LE(999,4);assert.throws(()=>media.verifyEmployeePortrait(webp,'image/webp'));
 let signed=0,uploaded=0;let badScope=false;
 const scoped={rpc:async name=>({error:null,data:name==='can_manage_employee_private_profile'?true:{portrait_path:`${badScope?id(2):id(1)}/${id(90)}.png`}}),storage:{from:name=>{assert.equal(name,'employee-portraits');return {createSignedUrl:async(p,ttl)=>{assert.ok(p.startsWith(id(1)));assert.equal(ttl,60);signed++;return {data:{signedUrl:'https://example.invalid/private-capability'},error:null};},upload:async(p,b,options)=>{assert.ok(p.startsWith(id(1)));assert.equal(options.upsert,false);assert.equal(options.contentType,'image/png');uploaded++;return {error:null};},remove:async()=>({error:null})};}}};
 await service.signEmployeePortrait(scoped,id(1));badScope=true;await assert.rejects(service.signEmployeePortrait(scoped,id(1)),/PORTRAIT_UNAVAILABLE/);assert.equal(signed,1);
 await service.uploadEmployeePortrait(scoped,id(1),'image/png',bytes);assert.equal(uploaded,1);
 await assert.rejects(service.uploadEmployeePortrait({...scoped,rpc:async()=>({data:false,error:null})},id(1),'image/png',bytes),/ACCESS_DENIED/);assert.equal(uploaded,1);
 const endpoints=fs.readFileSync('src/lib/employee-secure.functions.ts','utf8');assert.equal((endpoints.match(/middleware\(\[requireSupabaseAuth\]\)/g)||[]).length,7);assert.doesNotMatch(endpoints,/console\.|method:'GET'/);
 const legacy=fs.readFileSync('src/lib/employee.functions.ts','utf8');assert.doesNotMatch(legacy,/supabaseAdmin|updateUserById|auth\.admin/);assert.match(legacy,/data.active!==employee.active/);
 console.log('PASS own-password only, role/target injection deny, photo bytes/MIME/size/CRC/container checks, Owner-scoped upload/signed TTL, no legacy admin password/active bypass');
 console.log('NOT REACHED live Auth setup email/HTTP Storage; structural image checks are not pixel decoding or face recognition');
})().catch(e=>{console.error(`FAIL service tests: ${e.code||e.name} ${e.message}`);process.exitCode=1;});
