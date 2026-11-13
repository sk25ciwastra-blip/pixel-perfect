import { supabase } from '@/integrations/supabase/client';
import { createEmployeeIntegration } from './employee-integration';
import { provisionSecureEmployee,recoverSecureEmployee,changeOwnPassword,readPrivateEmployeeIdentity,updatePrivateEmployeeIdentity,readPrivateEmployeePortrait,uploadPrivateEmployeePortrait } from './employee-secure.functions';
import { readEmployeeEmailApproval } from './employee-email.functions';
import { changeEmployeeLifecycle,prepareEmployeeTraining,readEmployeeLifecycle } from './employee-lifecycle.functions';
import { resolveEmployeeTraining } from './employee-training-resolution.functions';

// Construct per mounted form, dispose on close. No singleton holding private data.
// Every call takes the latest caller session; no cached credential or admin client.
export function createEmployeeFormIntegration(){
  async function headers(){const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw new Error('AUTH_REQUIRED');return {Authorization:`Bearer ${data.session.access_token}`};}
  return createEmployeeIntegration({
    approval:async()=>readEmployeeEmailApproval({headers:await headers()}),
    enroll:async data=>provisionSecureEmployee({data,headers:await headers()}),
    recover:async requestId=>recoverSecureEmployee({data:{requestId},headers:await headers()}),
    lifecycle:async data=>readEmployeeLifecycle({data,headers:await headers()}),
    change:async data=>changeEmployeeLifecycle({data,headers:await headers()}),
    training:async data=>prepareEmployeeTraining({data,headers:await headers()}),
    password:async data=>changeOwnPassword({data,headers:await headers()}),
    resolveTraining:async data=>resolveEmployeeTraining({data,headers:await headers()}),
    identity:async employeeId=>readPrivateEmployeeIdentity({data:{employeeId},headers:await headers()}),
    updateIdentity:async(employeeId,identity)=>updatePrivateEmployeeIdentity({data:{employeeId,identity},headers:await headers()}),
    portrait:async employeeId=>readPrivateEmployeePortrait({data:{employeeId},headers:await headers()}),
    uploadPortrait:async(employeeId,mime,base64)=>uploadPrivateEmployeePortrait({data:{employeeId,mime,base64},headers:await headers()}),
  });
}
