import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { validateEmployeeTrainingResolution } from './employee-training-resolution';
// Graduation and operational activation are deliberately separate commands.
// Caller-scoped existing RPC; no new grant, admin client or actor argument.
export const resolveEmployeeTraining=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator(validateEmployeeTrainingResolution).handler(async({data,context})=>{
  setResponseHeader('Cache-Control','no-store');
  const s=await import('./employee-services.server');await s.requirePrivateEmployeeOwner(context.supabase);
  await s.employeeRpc(context.supabase,'resolve_finance_training_assignment',{_assignment_id:data.assignmentId,_status:data.status,_resolution_note:data.reason});
  return {ok:true};
 });
