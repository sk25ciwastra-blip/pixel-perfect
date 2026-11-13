import { createServerFn } from '@tanstack/react-start';
import { getRequest, setResponseHeader } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { boundedText, employeeUuid, strictObject, validateEmployeeEnrollment, validateOwnPasswordChange, validatePrivateIdentity } from './employee-enrollment';
function noStore(){setResponseHeader('Cache-Control','no-store');}
export const provisionSecureEmployee=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(validateEmployeeEnrollment).handler(async({data,context})=>{
    noStore();
    const services=await import('./employee-services.server');
    await services.requirePrivateEmployeeOwner(context.supabase);
    const core=await import('./employee-provisioning.server');const approval=await core.approvedEmployeeDelivery();
    if(!approval)throw new core.EnrollmentError('OWNER_DECISION_PENDING');
    const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
    return core.provisionEmployee(data,services.createProvisioningPorts(context.supabase,supabaseAdmin,context.userId,approval),approval);
  });
export const changeOwnPassword=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(validateOwnPasswordChange).handler(async({data,context})=>{
    noStore();const s=await import('./employee-services.server');
    const update=s.authenticatedOwnPasswordUpdater(process.env['SUPABASE_URL']??'',process.env['SUPABASE_PUBLISHABLE_KEY']??'',getRequest().headers.get('authorization')??'');
    return s.changeOwnEmployeePassword(context.supabase,context.userId,data,update);
  });
export const recoverSecureEmployee=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((input:unknown)=>{const r=strictObject(input,['requestId']);return {requestId:employeeUuid(r['requestId'])};})
  .handler(async({data,context})=>{
    noStore();const s=await import('./employee-services.server');await s.requirePrivateEmployeeOwner(context.supabase);
    const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
    return s.recoverEmployeeEnrollment(s.createProvisioningPorts(context.supabase,supabaseAdmin,context.userId),data.requestId);
  });
export const readPrivateEmployeeIdentity=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((input:unknown)=>{const r=strictObject(input,['employeeId']);return {employeeId:employeeUuid(r['employeeId'])};})
  .handler(async({data,context})=>{
    noStore();const s=await import('./employee-services.server');await s.requirePrivateEmployeeOwner(context.supabase);
    return await s.employeeRpc(context.supabase,'read_employee_identity',{_employee_id:data.employeeId}) as Record<string,string|null>;
  });
export const updatePrivateEmployeeIdentity=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((input:unknown)=>{const r=strictObject(input,['employeeId','identity']);return {employeeId:employeeUuid(r['employeeId']),identity:validatePrivateIdentity(r['identity'])};})
  .handler(async({data,context})=>{
    noStore();const s=await import('./employee-services.server');await s.requirePrivateEmployeeOwner(context.supabase);
    await s.employeeRpc(context.supabase,'update_employee_identity',{_employee_id:data.employeeId,_identity:data.identity});return {ok:true};
  });
export const uploadPrivateEmployeePortrait=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((input:unknown)=>{const r=strictObject(input,['employeeId','mime','base64']);return {employeeId:employeeUuid(r['employeeId']),mime:boundedText(r['mime'],1,40),base64:r['base64']};})
  .handler(async({data,context})=>{
    noStore();const s=await import('./employee-services.server');await s.requirePrivateEmployeeOwner(context.supabase);
    const {decodePortraitBase64}=await import('./employee-portrait.server');
    return s.uploadEmployeePortrait(context.supabase,data.employeeId,data.mime,decodePortraitBase64(data.base64));
  });
export const readPrivateEmployeePortrait=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((input:unknown)=>{const r=strictObject(input,['employeeId']);return {employeeId:employeeUuid(r['employeeId'])};})
  .handler(async({data,context})=>{
    noStore();const {signEmployeePortrait}=await import('./employee-services.server');return signEmployeePortrait(context.supabase,data.employeeId);
  });
