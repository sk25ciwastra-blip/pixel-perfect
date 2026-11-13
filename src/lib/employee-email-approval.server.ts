// Server-only approval evidence. No setter, SMTP credentials, defaults or feature flags.
import { EMPLOYEE_PASSWORD_SETUP_PATH } from './employee-email-setup-flow';
export type EmailDeliveryApproval={redirectTo:string;siteOrigin:string;authOrigin:string;fingerprintKey:Uint8Array;configDigest:string;validUntil:number};
type Env=Record<string,string|undefined>;
export type EmailApprovalResult={state:'OWNER_INPUT_REQUIRED'|'BLOCKED';codes:string[]}|{state:'VERIFIED';approval:EmailDeliveryApproval};
const verified=new WeakSet<object>();
const checks=['smtpTls','senderMailbox','providerAllowlist','fragmentTemplate','authOnlyCallback','unconfirmedRecovery','expirySingleUse'] as const;
const fields={sender:'EMPLOYEE_SETUP_SENDER_ADDRESS',smtpHost:'EMPLOYEE_SETUP_SMTP_HOST',smtpPort:'EMPLOYEE_SETUP_SMTP_PORT',smtpSecurity:'EMPLOYEE_SETUP_SMTP_SECURITY',callback:'EMPLOYEE_SETUP_CALLBACK_URL',siteOrigin:'EMPLOYEE_SETUP_SITE_ORIGIN',authOrigin:'SUPABASE_URL',allowlist:'EMPLOYEE_SETUP_REDIRECT_ALLOWLIST',evidence:'EMPLOYEE_SETUP_APPROVAL_RECORD',approvalKey:'EMPLOYEE_SETUP_APPROVAL_HMAC_KEY',fingerprintKey:'EMPLOYEE_PROVISIONING_HMAC_KEY'} as const;
const fail=()=>{throw new Error('CONFIG_INVALID');};
function origin(raw:string){const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||!u.hostname.includes('.')||/^[0-9.]+$/.test(u.hostname)||/\.(local|localhost|internal)$/.test(u.hostname)||!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?\/?$/.test(raw))fail();return u.origin;}
function callback(raw:string){const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.href!==raw||!/^\/[a-zA-Z0-9/_-]+$/.test(u.pathname)||u.pathname.includes('//')||raw.includes('*'))fail();return u;}
const operational=['/','/auth','/dashboard','/booking','/check-in','/transaksi','/kamar','/keuangan','/pengaturan','/karyawan','/housekeeping','/tamu'];
function configuration(env:Env){
  const sender=env[fields.sender]!;if(/[\s\u0000-\u001f\u007f]/.test(sender)||!/^[a-zA-Z0-9.!#$&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(sender)||sender.length>254)fail();
  const smtpHost=env[fields.smtpHost]!;if(/[\s\u0000-\u001f\u007f]/.test(smtpHost)||!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(smtpHost)||smtpHost.includes('..'))fail();
  const port=env[fields.smtpPort]!;const smtpPort=Number(port);if(!/^[0-9]{1,5}$/.test(port)||!Number.isInteger(smtpPort)||smtpPort<1||smtpPort>65535)fail();
  const smtpSecurity=env[fields.smtpSecurity]!;if(!['TLS','STARTTLS'].includes(smtpSecurity))fail();
  const siteOrigin=origin(env[fields.siteOrigin]!),authOrigin=origin(env[fields.authOrigin]!);
  const u=callback(env[fields.callback]!);
  if(u.pathname!==EMPLOYEE_PASSWORD_SETUP_PATH)fail(); // existing route, no invented domain/default URL
  if(u.origin!==siteOrigin||operational.some(p=>u.pathname===p||(p!=='/'&&p!=='/auth'&&u.pathname.startsWith(p+'/'))))fail();
  const a:unknown=JSON.parse(env[fields.allowlist]!);if(!Array.isArray(a)||!a.length||a.length>32||a.some(s=>typeof s!=='string'))fail();
  const allowlist=(a as string[]).map(s=>callback(s).href).sort();
  if(new Set(allowlist).size!==allowlist.length||!allowlist.includes(u.href))fail();
  return {channel:'EMAIL',sender,smtpHost,smtpPort,smtpSecurity,callback:u.href,siteOrigin,authOrigin,allowlist};
}
function secret(raw:string){if(raw.length!==64||!/^[a-f0-9]{64}$/i.test(raw))fail();return Uint8Array.from(raw.match(/../g)!,s=>parseInt(s,16));}
async function macKey(raw:Uint8Array){return crypto.subtle.importKey('raw',new Uint8Array(raw),{name:'HMAC',hash:'SHA-256'},false,['verify']);}
export async function employeeEmailConfigDigest(env:Env){const c=configuration(env);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(c)))),v=>v.toString(16).padStart(2,'0')).join('');}
export async function evaluateEmployeeEmailApproval(env:Env,now=Date.now()):Promise<EmailApprovalResult>{
  const missing=Object.entries(fields).filter(([,name])=>!env[name]?.trim()).map(([name])=>name);
  if(missing.length)return {state:'OWNER_INPUT_REQUIRED',codes:missing};
  try{
    const config=configuration(env),digest=await employeeEmailConfigDigest(env);
    const e=JSON.parse(env[fields.evidence]!) as Record<string,unknown>;
    if(!e||typeof e!=='object'||Object.keys(e).sort().join(',')!==['configDigest','ownerApprovalRef','verifiedAt','validUntil','checks','signature'].sort().join(','))fail();
    if(e['configDigest']!==digest||typeof e['ownerApprovalRef']!=='string'||e['ownerApprovalRef'].length<5||e['ownerApprovalRef'].length>200||e['ownerApprovalRef'].includes('6863917799'))fail();
    const verifiedAt=Date.parse(String(e['verifiedAt'])),validUntil=Date.parse(String(e['validUntil']));
    if(!Number.isFinite(verifiedAt)||!Number.isFinite(validUntil)||verifiedAt>now||validUntil<=now||validUntil<=verifiedAt)fail();
    const proof=e['checks'] as Record<string,unknown>;
    if(!proof||Object.keys(proof).sort().join(',')!==[...checks].sort().join(',')||checks.some(k=>proof[k]!==true))fail();
    const message=JSON.stringify({configDigest:e['configDigest'],ownerApprovalRef:e['ownerApprovalRef'],verifiedAt:e['verifiedAt'],validUntil:e['validUntil'],checks:Object.fromEntries(checks.map(k=>[k,true]))});
    const signature=secret(String(e['signature']));
    if(!await crypto.subtle.verify('HMAC',await macKey(secret(env[fields.approvalKey]!)),signature,new TextEncoder().encode(message)))fail();
    const approval=Object.freeze({redirectTo:config.callback,siteOrigin:config.siteOrigin,authOrigin:config.authOrigin,fingerprintKey:secret(env[fields.fingerprintKey]!),configDigest:digest,validUntil});
    verified.add(approval);return {state:'VERIFIED',approval};
  }catch{return {state:'BLOCKED',codes:['CONFIG_OR_EVIDENCE_INVALID']};}
}
export function isVerifiedEmployeeEmailApproval(value:unknown):value is EmailDeliveryApproval{return !!value&&typeof value==='object'&&verified.has(value)&&Number.isFinite((value as EmailDeliveryApproval).validUntil)&&(value as EmailDeliveryApproval).validUntil>Date.now();}
export async function loadEmployeeEmailApproval(){return evaluateEmployeeEmailApproval(process.env);}
export function requireEmployeeCallbackOrigin(approval:EmailDeliveryApproval,requestOrigin:string,contentType:string){
  if(!isVerifiedEmployeeEmailApproval(approval)||requestOrigin!==approval.siteOrigin||contentType.split(';')[0]?.trim().toLowerCase()!=='application/json')throw new Error('CALLBACK_REQUEST_REJECTED');
}
