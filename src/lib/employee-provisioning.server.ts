import type { EmployeeEnrollment } from './employee-enrollment';
export class EnrollmentError extends Error { constructor(readonly code: string) { super(code); } }
export type EnrollmentState = {state:string;acquired?:boolean;auth_user_id:string|null;employee_id:string|null;generated_identifier:string;delivery_state:string};
export type ApprovedDelivery = {redirectTo:string;fingerprintKey:Uint8Array};
// No feature flag/config mutation. Both ID format and delivery still need Owner
// decisions + a reviewed implementation before this returns an approval.
export function approvedEmployeeDelivery(): ApprovedDelivery | null { return null; }
export interface ProvisioningPorts {
  owner():Promise<boolean>;
  begin(requestId:string,fingerprint:string):Promise<EnrollmentState>;
  createAuth(email:string,password:string,requestId:string):Promise<string>;
  attach(requestId:string,userId:string):Promise<void>;
  finalize(input:EmployeeEnrollment):Promise<string>;
  cancel(requestId:string,cleanupComplete:boolean):Promise<EnrollmentState>;
  deleteCreatedAuth(userId:string,requestId:string):Promise<void>;
  claimDelivery(requestId:string,outcome?:'SENT'|'UNKNOWN'):Promise<boolean>;
  sendSetup(email:string,redirectTo:string):Promise<void>;
}
export function createInitialEmployeeSecret() {
  const random=crypto.getRandomValues(new Uint8Array(32));
  return 'Aa1!'+Array.from(random,b=>b.toString(16).padStart(2,'0')).join('');
}
async function fingerprint(input:EmployeeEnrollment,key:Uint8Array) {
  if(key.length<32) throw new EnrollmentError('APPROVAL_INVALID');
  const k=await crypto.subtle.importKey('raw',new Uint8Array(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(JSON.stringify(input)))),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function provisionEmployee(input:EmployeeEnrollment,ports:ProvisioningPorts,approval:ApprovedDelivery|null) {
  if(!await ports.owner()) throw new EnrollmentError('ACCESS_DENIED');
  if(!approval) throw new EnrollmentError('OWNER_DECISION_PENDING');
  const redirect=new URL(approval.redirectTo);
  if(redirect.protocol!=='https:' || redirect.username || redirect.password || redirect.search || redirect.hash) throw new EnrollmentError('APPROVAL_INVALID');
  let request:EnrollmentState;
  try {request=await ports.begin(input.requestId,await fingerprint(input,approval.fingerprintKey));}
  catch {throw new EnrollmentError('REQUEST_REJECTED');}
  if(!request.acquired) {
    if(request.state==='COMPLETED') return {employeeId:request.employee_id,employeeCode:request.generated_identifier,delivery:request.delivery_state,replayed:true};
    throw new EnrollmentError(request.state==='RECOVERY_REQUIRED'?'RECOVERY_REQUIRED':request.state==='CANCELLED'?'REQUEST_CANCELLED':'REQUEST_IN_PROGRESS');
  }
  let userId:string|undefined; let employeeId:string;
  try {
    userId=await ports.createAuth(input.identity.email,createInitialEmployeeSecret(),input.requestId);
    await ports.attach(input.requestId,userId);
    employeeId=await ports.finalize(input);
  } catch {
    // Reconcile atomically against finalization before compensation. A network
    // timeout may mean COMMITTED, never blindly delete the new Auth account.
    try {
      const cancelled=await ports.cancel(input.requestId,false);
      if(cancelled.state==='COMPLETED') return {employeeId:cancelled.employee_id,employeeCode:cancelled.generated_identifier,delivery:cancelled.delivery_state,replayed:true};
      if(cancelled.state!=='RECOVERY_REQUIRED') throw new Error();
      if(userId) await ports.deleteCreatedAuth(userId,input.requestId);
      await ports.cancel(input.requestId,true);
    } catch { throw new EnrollmentError('RECOVERY_REQUIRED'); }
    throw new EnrollmentError('PROVISIONING_FAILED');
  }
  let delivery='UNKNOWN';
  try {
    if(await ports.claimDelivery(input.requestId)) {
      await ports.sendSetup(input.identity.email,approval.redirectTo);
      await ports.claimDelivery(input.requestId,'SENT'); delivery='SENT';
    }
  } catch {
    try {await ports.claimDelivery(input.requestId,'UNKNOWN');} catch { /* reconcile, never resend automatically */ }
  }
  // No password, identity data, access token or setup link is returned/logged.
  return {employeeId,employeeCode:request.generated_identifier,delivery,replayed:false};
}
