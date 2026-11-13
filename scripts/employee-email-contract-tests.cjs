const assert=require('node:assert/strict');const fs=require('node:fs');
const fixture=require('./employee-email-test-fixture.cjs');
const core=require('../src/lib/employee-provisioning.server.ts');
const {requestApprovedEmployeeSetupEmail:send}=require('../src/lib/employee-email-delivery.server.ts');
const {exchangeEmployeeSetup:exchange}=require('../src/lib/employee-email-callback.server.ts');
const {captureEmployeeSetupFragment:capture}=require('../src/lib/employee-email-callback.ts');
const {startEmployeeEmailSetup:startBrowser,isAuthOnlyPasswordPage}=require('../src/lib/employee-email-setup-flow.ts');
(async()=>{
 assert.equal((await fixture.evaluateEmployeeEmailApproval({})).state,'OWNER_INPUT_REQUIRED');
 const {env,approval}=await fixture.signedFixture();assert.ok(approval);
 assert.equal(fixture.isVerifiedEmployeeEmailApproval({...approval}),false); // JSON cannot forge an approval
 assert.equal(isAuthOnlyPasswordPage('/reset-password'),true);for(const p of ['/','/booking','/auth','/reset-password/next'])assert.equal(isAuthOnlyPasswordPage(p),false);
 for(const changed of [
  {EMPLOYEE_SETUP_CALLBACK_URL:'http://app.example.invalid/auth/employee-setup'},
  {EMPLOYEE_SETUP_CALLBACK_URL:'https://evil.example.invalid/auth/employee-setup'},
  {EMPLOYEE_SETUP_CALLBACK_URL:'https://app.example.invalid/booking'},
  {EMPLOYEE_SETUP_CALLBACK_URL:'https://app.example.invalid/auth/../booking'},
  {EMPLOYEE_SETUP_CALLBACK_URL:'https://app.example.invalid/auth/employee-setup?next=https://evil.invalid'},
  {EMPLOYEE_SETUP_SITE_ORIGIN:'https://127.0.0.1',EMPLOYEE_SETUP_CALLBACK_URL:'https://127.0.0.1/reset-password'},
  {EMPLOYEE_SETUP_CALLBACK_URL:'https://app.example.invalid/auth/%2f%2fevil'},
  {EMPLOYEE_SETUP_CALLBACK_URL:'https://user:pass@app.example.invalid/auth/employee-setup'},
  {EMPLOYEE_SETUP_REDIRECT_ALLOWLIST:'["https://app.example.invalid/**"]'},
  {EMPLOYEE_SETUP_REDIRECT_ALLOWLIST:'["https://app.example.invalid/auth/other"]'},
  {EMPLOYEE_SETUP_SMTP_SECURITY:'NONE'},
  {EMPLOYEE_SETUP_SENDER_ADDRESS:'spoof@other.invalid'},
  {EMPLOYEE_SETUP_SENDER_ADDRESS:'setup@example.invalid\n'},
  {EMPLOYEE_SETUP_APPROVAL_HMAC_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')},
 ])assert.equal((await fixture.evaluateEmployeeEmailApproval({...env,...changed})).state,'BLOCKED');
 for(const proof of ['smtpTls','senderMailbox','providerAllowlist','fragmentTemplate','authOnlyCallback','unconfirmedRecovery','expirySingleUse'])assert.equal((await fixture.signedFixture({}, {[proof]:false})).approval===null,true);
 assert.equal((await fixture.signedFixture({}, {},{verifiedAt:new Date(Date.now()-3600000).toISOString(),validUntil:new Date(Date.now()-1000).toISOString()})).approval===null,true);
 assert.equal((await fixture.signedFixture({}, {},{ownerApprovalRef:'Issue61/6863917799'})).approval===null,true);
 const expired=JSON.parse(env.EMPLOYEE_SETUP_APPROVAL_RECORD);expired.validUntil=new Date(0).toISOString();
 assert.equal((await fixture.evaluateEmployeeEmailApproval({...env,EMPLOYEE_SETUP_APPROVAL_RECORD:JSON.stringify(expired)})).state,'BLOCKED');
 assert.equal((await core.approvedEmployeeDelivery())===null,true); // never print a returned secret object on failure
 console.log('PASS missing/invalid config BLOCKED; signed exact config, HTTPS/site/callback/allowlist, phishing/open redirect, mailbox/TLS/template/provider evidence gates');
 let count=0;await send(approval,approval.redirectTo,async()=>{count++;});
 await assert.rejects(send(approval,approval.redirectTo+'?next=evil',async()=>{count++;}),/EMAIL_APPROVAL_REQUIRED/);
 await assert.rejects(send(undefined,approval.redirectTo,async()=>{count++;}),/EMAIL_APPROVAL_REQUIRED/);
 await assert.rejects(send(approval,approval.redirectTo,async()=>{count++;return new Promise(()=>{});},2),/EMAIL_DELIVERY_UNKNOWN/);
 assert.equal(count,2); // no retry on timeout
 const ports={owner:async()=>true,begin:async()=>({state:'RESERVED',acquired:true,auth_user_id:null,employee_id:null,generated_identifier:'B25EMP-001',delivery_state:'NOT_ATTEMPTED'}),createAuth:async()=> 'fixture-user',attach:async()=>{},finalize:async()=> 'fixture-employee',cancel:async()=>{throw Error('Committed account must not be cancelled');},deleteCreatedAuth:async()=>{throw Error('Committed account must not be deleted');},claimDelivery:async(_,outcome)=>{if(!outcome){count++;return true;}assert.equal(outcome,'UNKNOWN');return true;},sendSetup:async()=>{throw Error('provider timeout');}};
 count=0;const input={requestId:'fixture-request',identity:{email:'synthetic@example.invalid'}};
 const outcome=await core.provisionEmployee(input,ports,approval);assert.equal(outcome.delivery,'UNKNOWN');assert.equal(count,1);
 ports.begin=async()=>({state:'COMPLETED',acquired:false,auth_user_id:'fixture-user',employee_id:'fixture-employee',generated_identifier:'B25EMP-001',delivery_state:'UNKNOWN'});
 await core.provisionEmployee(input,ports,approval);assert.equal(count,1);
 console.log('PASS delivery timeout/unknown no retry; committed account preserved and idempotent replay does not send');
 const token=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');let used=false,verifies=0,revoked=0;
 const callbackPorts={verify:async(value)=>{verifies++;if(value!==token||used)throw Error('expired/used token');used=true;return{userId:'fixture-user',session:{access_token:'fixture-opaque-access',refresh_token:'fixture-opaque-refresh',expires_at:Math.floor(Date.now()/1000)+300,user:{id:'fixture-user'}}};},currentUser:async()=> 'fixture-user',context:async()=>({user_id:'fixture-user',employee_code:'B25EMP-001',employment_state:'REGISTERED',next_step:'SET_PASSWORD_ONLY'}),revoke:async()=>{revoked++;}};
 await assert.rejects(exchange({tokenHash:token,type:'recovery'},approval,'https://evil.invalid','application/json',callbackPorts),/CALLBACK_REQUEST_REJECTED/);assert.equal(verifies,0);
 await assert.rejects(exchange({tokenHash:token,type:'recovery',next:'/booking'},approval,approval.siteOrigin,'application/json',callbackPorts),/CALLBACK_INPUT_INVALID/);
 let clean;const parsed=capture(`${approval.redirectTo}#token_hash=${token}&type=recovery`,approval.redirectTo,url=>{clean=url;});assert.equal(clean,approval.redirectTo);
 let attached=0,exchanged=0,existing=false;const order=[];
 const browser={clientAuthOrigin:approval.authOrigin,policy:async()=>{assert.equal(order[0],'stripped');return{state:'VERIFIED',callbackUrl:approval.redirectTo,authOrigin:approval.authOrigin};},hasSession:async()=>existing,exchange:async()=>{exchanged++;return{nextStep:'SET_PASSWORD_ONLY',session:{access_token:'fixture-user-access',refresh_token:'fixture-user-refresh',expires_at:Date.now()/1000+300}};},setSession:async()=>{attached++;}};
 const href=`${approval.redirectTo}#token_hash=${token}&type=recovery`;
 await startBrowser(href,()=>order.push('stripped'),browser);assert.equal(attached,1);assert.equal(exchanged,1);
 existing=true;await assert.rejects(startBrowser(href,()=>{},browser),/SIGN_OUT_BEFORE_SETUP/);assert.equal(exchanged,1);existing=false;
 await assert.rejects(startBrowser(href,()=>{}, {...browser,clientAuthOrigin:'https://different.example.invalid'}),/EMAIL_SETUP_BLOCKED/);assert.equal(exchanged,1);
 await assert.rejects(startBrowser(href,()=>{}, {...browser,policy:async()=>({state:'BLOCKED'}),hasSession:async()=>{throw Error('must not touch Auth before approval');}}),/EMAIL_SETUP_BLOCKED/);
 const result=await exchange(parsed,approval,approval.siteOrigin,'application/json',callbackPorts);assert.equal(result.nextStep,'SET_PASSWORD_ONLY');assert.ok(!('redirect' in result));assert.ok(!JSON.stringify(result).includes(token));
 await assert.rejects(exchange(parsed,approval,approval.siteOrigin,'application/json',callbackPorts),/SETUP_TOKEN_REJECTED/);
 used=false;callbackPorts.context=async()=>({user_id:'someone-else',employment_state:'REGISTERED',next_step:'SET_PASSWORD_ONLY'});
 await assert.rejects(exchange(parsed,approval,approval.siteOrigin,'application/json',callbackPorts),/SETUP_TOKEN_REJECTED/);assert.equal(revoked,1);
 used=false;callbackPorts.verify=async()=>({userId:'fixture-user',session:{access_token:'expired',refresh_token:'expired',expires_at:0,user:{id:'fixture-user'}}});
 await assert.rejects(exchange(parsed,approval,approval.siteOrigin,'application/json',callbackPorts),/SETUP_TOKEN_REJECTED/);
 for(const f of ['employee-email-approval.server.ts','employee-email-delivery.server.ts','employee-email-callback.server.ts','employee-email-provider.server.ts','employee-email.functions.ts'])assert.doesNotMatch(fs.readFileSync('src/lib/'+f,'utf8'),/console\.|generateLink\(|auth\.admin/);
 const page=fs.readFileSync('src/routes/reset-password.tsx','utf8');const mounted=page.slice(page.indexOf('useEffect(()=>'),page.indexOf('async function submit'));
 assert.doesNotMatch(mounted,/startEmployeeEmailSetup\(|exchangeEmployeeEmailSetup\(/); // scanners/GET do not consume OTP
 assert.match(page,/setupInFlight\.current/);assert.match(page,/resumeOwnEmployeeSetup/);
 console.log('PASS Auth-only callback contract: provider expiry/single-use fixtures, origin/type/target guards, fragment removal, own context, no operational redirect or activation');
 console.log('NOT REACHED actual Auth/SMTP token expiry/single-use/mailbox/callback/browser integration; synthetic transports only');
})().catch(e=>{console.error(`FAIL email contract ${e.name}`);process.exitCode=1;});
