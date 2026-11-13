// Only synthetic config + per-run random keys, no real secrets/mailbox/provider.
const fs=require('node:fs');const ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const approvalModule=require('../src/lib/employee-email-approval.server.ts');
const randomHex=()=>Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
async function signedFixture(overrides={},checkOverrides={},recordOverrides={}){
 const env={SUPABASE_URL:'https://auth.example.invalid',EMPLOYEE_SETUP_SENDER_ADDRESS:'setup@example.invalid',EMPLOYEE_SETUP_SMTP_HOST:'smtp.example.invalid',EMPLOYEE_SETUP_SMTP_PORT:'587',EMPLOYEE_SETUP_SMTP_SECURITY:'STARTTLS',EMPLOYEE_SETUP_CALLBACK_URL:'https://app.example.invalid/reset-password',EMPLOYEE_SETUP_SITE_ORIGIN:'https://app.example.invalid',EMPLOYEE_SETUP_REDIRECT_ALLOWLIST:JSON.stringify(['https://app.example.invalid/reset-password']),EMPLOYEE_SETUP_APPROVAL_HMAC_KEY:randomHex(),EMPLOYEE_PROVISIONING_HMAC_KEY:randomHex(),...overrides};
 const checks={smtpTls:true,senderMailbox:true,providerAllowlist:true,fragmentTemplate:true,authOnlyCallback:true,unconfirmedRecovery:true,expirySingleUse:true,...checkOverrides};
 const record={configDigest:await approvalModule.employeeEmailConfigDigest(env),ownerApprovalRef:'fixture-values-review-only',verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),checks,...recordOverrides};
 const k=await crypto.subtle.importKey('raw',Buffer.from(env.EMPLOYEE_SETUP_APPROVAL_HMAC_KEY,'hex'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Buffer.from(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(JSON.stringify(record)))).toString('hex');
 env.EMPLOYEE_SETUP_APPROVAL_RECORD=JSON.stringify({...record,signature});
 const r=await approvalModule.evaluateEmployeeEmailApproval(env);
 return {env,record,approval:r.state==='VERIFIED'?r.approval:null};
}
module.exports={...approvalModule,signedFixture};
