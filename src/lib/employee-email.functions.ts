import { createServerFn } from '@tanstack/react-start';
import { getRequest,setResponseHeader } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { employeeUuid,strictObject } from './employee-enrollment';
import { employeeSetupToken } from './employee-email-callback';
function noStore(){setResponseHeader('Cache-Control','no-store');setResponseHeader('Referrer-Policy','no-referrer');}
export const readEmployeeEmailApproval=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .handler(async({context})=>{
   noStore();const s=await import('./employee-services.server');await s.requirePrivateEmployeeOwner(context.supabase);
   const {loadEmployeeEmailApproval}=await import('./employee-email-approval.server');const r=await loadEmployeeEmailApproval();
   return {state:r.state,codes:r.state==='VERIFIED'?[]:r.codes}; // no sender/secret/evidence values
 });
export const readEmployeeEmailDelivery=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((input:unknown)=>{const r=strictObject(input,['requestId']);return {requestId:employeeUuid(r['requestId'])};})
 .handler(async({data,context})=>{
   noStore();const s=await import('./employee-services.server');await s.requirePrivateEmployeeOwner(context.supabase);
   const r=await s.employeeRpc(context.supabase,'read_employee_email_status',{_request_id:data.requestId}) as {request_id:string;state:string;delivery_state:string;events:{event:string;actor_id:string;recorded_at:string}[]};
   return {requestId:r.request_id,state:r.state,deliveryState:r.delivery_state,autoResend:false,
     events:r.events.map(e=>({event:e.event,actorId:e.actor_id,recordedAt:e.recorded_at}))};
 });
// Auth-only bootstrap, deliberately no operational/active-employee middleware.
// An unauthenticated caller must instead prove the one-time provider token.
export const exchangeEmployeeEmailSetup=createServerFn({method:'POST'}).inputValidator(employeeSetupToken)
 .handler(async({data})=>{
   noStore();const {loadEmployeeEmailApproval}=await import('./employee-email-approval.server');const r=await loadEmployeeEmailApproval();
   if(r.state!=='VERIFIED')throw new Error('EMAIL_SETUP_BLOCKED');
   const request=getRequest();
   const {requireEmployeeCallbackOrigin}=await import('./employee-email-approval.server');
   requireEmployeeCallbackOrigin(r.approval,request.headers.get('origin')??'',request.headers.get('content-type')??'');
   const {createEmployeeSetupPorts}=await import('./employee-email-provider.server');
   const {exchangeEmployeeSetup}=await import('./employee-email-callback.server');
   return exchangeEmployeeSetup(data,r.approval,request.headers.get('origin')??'',request.headers.get('content-type')??'',createEmployeeSetupPorts(r.approval));
 });
export const readEmployeeSetupPublicPolicy=createServerFn({method:'POST'}).handler(async()=>{
 noStore();const a=await import('./employee-email-approval.server');const r=await a.loadEmployeeEmailApproval();
 if(r.state!=='VERIFIED')return {state:'BLOCKED' as const};
 try{const request=getRequest();a.requireEmployeeCallbackOrigin(r.approval,request.headers.get('origin')??'',request.headers.get('content-type')??'');}
 catch{return {state:'BLOCKED' as const};}
 return {state:'VERIFIED' as const,callbackUrl:r.approval.redirectTo,authOrigin:r.approval.authOrigin}; // public URLs only, no evidence/key/sender
});
// Existing authenticated session resumes own setup after reload; no email/token
// reissue and no SMTP-approval dependency for changing one's own password.
export const resumeOwnEmployeeSetup=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 noStore();const {employeeRpc}=await import('./employee-services.server');
 const r=await employeeRpc(context.supabase,'confirm_my_employee_setup') as {user_id:string;employment_state:string;next_step:string};
 if(r.user_id!==context.userId||r.employment_state!=='REGISTERED'||r.next_step!=='SET_PASSWORD_ONLY')throw new Error('SETUP_SESSION_REJECTED');
 return {nextStep:'SET_PASSWORD_ONLY' as const};
});
