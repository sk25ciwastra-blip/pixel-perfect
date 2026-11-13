import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { EnrollmentError, type ProvisioningPorts, type EnrollmentState } from './employee-provisioning.server';
import { verifyEmployeePortrait } from './employee-portrait.server';
import type { validateOwnPasswordChange } from './employee-enrollment';
type Caller=SupabaseClient<Database>;
function enrollmentState(value:unknown):EnrollmentState {
  const r=value as EnrollmentState|null;
  if(!r || !['RESERVED','AUTH_ATTACHED','COMPLETED','RECOVERY_REQUIRED','CANCELLED'].includes(r.state)
    || typeof r.generated_identifier!=='string' || !r.generated_identifier
    || !(r.auth_user_id===null||typeof r.auth_user_id==='string') || !(r.employee_id===null||typeof r.employee_id==='string')
    || !['NOT_ATTEMPTED','ATTEMPTED','SENT','UNKNOWN'].includes(r.delivery_state)) throw new EnrollmentError('REQUEST_REJECTED');
  return r;
}
export async function employeeRpc(caller:Caller,name:string,args:Record<string,unknown>={}) {
  try {
    const {data,error}=await caller.rpc(name as never,args as never);
    if(error) throw new Error();return data as unknown;
  } catch {throw new EnrollmentError('REQUEST_REJECTED');}
}
export async function requirePrivateEmployeeOwner(caller:Caller) {
  if(await employeeRpc(caller,'can_manage_employee_private_profile')!==true)throw new EnrollmentError('ACCESS_DENIED');
}
export function createProvisioningPorts(caller:Caller,admin:Caller,actorId:string):ProvisioningPorts {
  return {
    owner:async()=>await employeeRpc(caller,'can_manage_employee_private_profile')===true,
    begin:async(requestId,fingerprint)=>{
      const r=enrollmentState(await employeeRpc(caller,'begin_employee_enrollment',{_request_id:requestId,_fingerprint:fingerprint}));
      if(typeof r.acquired!=='boolean')throw new EnrollmentError('REQUEST_REJECTED');return r;
    },
    createAuth:async(email,password,requestId)=>{
      const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:false,
        app_metadata:{employee_enrollment:{request_id:requestId,actor_id:actorId}}});
      if(error||!data.user||data.user.app_metadata['employee_enrollment']?.request_id!==requestId
        ||data.user.app_metadata['employee_enrollment']?.actor_id!==actorId)throw new EnrollmentError('AUTH_CREATE_FAILED');return data.user.id;
    },
    attach:async(requestId,userId)=>{await employeeRpc(caller,'attach_employee_enrollment_auth',{_request_id:requestId,_auth_user_id:userId});},
    finalize:async(input)=>{
      const r=await employeeRpc(caller,'finalize_employee_enrollment',{_request_id:input.requestId,_name:input.name,_position:input.position,_join_date:input.joinDate,_identity:input.identity});
      if(typeof r!=='string'||!r)throw new EnrollmentError('REQUEST_REJECTED');return r;
    },
    cancel:async(requestId,done)=>enrollmentState(await employeeRpc(caller,'cancel_employee_enrollment',{_request_id:requestId,_cleanup_complete:done})),
    deleteCreatedAuth:async(userId,requestId)=>{
      const {data,error}=await admin.auth.admin.getUserById(userId);
      if(error?.status===404)return; // final DB cleanup check still proves absence
      const marker=data.user?.app_metadata['employee_enrollment'];
      if(error||marker?.request_id!==requestId||marker?.actor_id!==actorId)throw new EnrollmentError('RECOVERY_REQUIRED');
      const deleted=await admin.auth.admin.deleteUser(userId);if(deleted.error)throw new EnrollmentError('RECOVERY_REQUIRED');
    },
    claimDelivery:async(requestId,outcome)=>await employeeRpc(caller,'claim_employee_setup_delivery',{_request_id:requestId,_outcome:outcome??null})===true,
    sendSetup:async(email,redirectTo)=>{
      const {error}=await admin.auth.resetPasswordForEmail(email,{redirectTo});
      if(error)throw new EnrollmentError('DELIVERY_UNKNOWN');
    },
  };
}
export async function recoverEmployeeEnrollment(ports:ProvisioningPorts,requestId:string) {
  if(!await ports.owner())throw new EnrollmentError('ACCESS_DENIED');
  const r=await ports.cancel(requestId,false);
  if(r.state==='COMPLETED'||r.state==='CANCELLED')return {state:r.state};
  // Crash before Auth attachment needs explicit metadata inspection, not a scan
  // of or deletion by email. Never guess which existing account belongs here.
  if(r.state!=='RECOVERY_REQUIRED'||!r.auth_user_id)throw new EnrollmentError('RECOVERY_REVIEW_REQUIRED');
  await ports.deleteCreatedAuth(r.auth_user_id,requestId);
  const done=await ports.cancel(requestId,true);return {state:done.state};
}
type OwnPassword=ReturnType<typeof validateOwnPasswordChange>;
export function authenticatedOwnPasswordUpdater(url:string,key:string,authorization:string,transport:typeof fetch=fetch) {
  const base=new URL(url);
  if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||base.pathname!=='/'||!key||!authorization.startsWith('Bearer '))throw new EnrollmentError('PASSWORD_CHANGE_REJECTED');
  return async(input:OwnPassword)=>{
    // Uses the incoming, verified caller credential; no admin path, refresh
    // session, fabricated token or caller-specified account ID.
    const response=await transport(`${base.origin}/auth/v1/user`,{method:'PUT',cache:'no-store',headers:{Authorization:authorization,apikey:key,'Content-Type':'application/json'},body:JSON.stringify(input)});
    return {ok:response.ok};
  };
}
export async function changeOwnEmployeePassword(caller:Caller,actorId:string,input:OwnPassword,updateOwn:(input:OwnPassword)=>Promise<{ok:boolean}>) {
  const {data,error}=await caller.auth.getUser();
  if(error||data.user?.id!==actorId)throw new EnrollmentError('ACCESS_DENIED');
  try{const result=await updateOwn(input);if(!result.ok)throw new Error();}
  catch{throw new EnrollmentError('PASSWORD_CHANGE_REJECTED');}
  return {ok:true};
}
export async function uploadEmployeePortrait(caller:Caller,employeeId:string,mime:string,bytes:Uint8Array) {
  await requirePrivateEmployeeOwner(caller);
  await employeeRpc(caller,'read_employee_identity',{_employee_id:employeeId});
  const verified=verifyEmployeePortrait(bytes,mime);
  const objectPath=`${employeeId}/${crypto.randomUUID()}.${verified.extension}`;
  const storage=caller.storage.from('employee-portraits');
  const uploaded=await storage.upload(objectPath,verified.bytes,{contentType:verified.mime,upsert:false,cacheControl:'0'});
  if(uploaded.error)throw new EnrollmentError('PORTRAIT_UPLOAD_FAILED');
  try{await employeeRpc(caller,'set_employee_portrait',{_employee_id:employeeId,_path:objectPath});}
  catch{
    // DB restrictive DELETE policy prevents removing a referenced photo after an
    // ambiguous commit; no blind admin/service-role cleanup.
    await storage.remove([objectPath]);throw new EnrollmentError('PORTRAIT_BIND_RECONCILE');
  }
  return {ok:true};
}
export async function signEmployeePortrait(caller:Caller,employeeId:string) {
  await requirePrivateEmployeeOwner(caller);
  const profile=await employeeRpc(caller,'read_employee_identity',{_employee_id:employeeId}) as {portrait_path?:unknown};
  const p=profile.portrait_path;
  if(typeof p!=='string'||!p.startsWith(`${employeeId}/`)||!new RegExp(`^${employeeId}/[a-f0-9-]{36}\\.(jpg|png|webp)$`).test(p))throw new EnrollmentError('PORTRAIT_UNAVAILABLE');
  const {data,error}=await caller.storage.from('employee-portraits').createSignedUrl(p,60);
  if(error||!data?.signedUrl)throw new EnrollmentError('PORTRAIT_UNAVAILABLE');
  return {url:data.signedUrl,expiresIn:60};
}
