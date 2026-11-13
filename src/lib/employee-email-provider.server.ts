import { createClient } from '@supabase/supabase-js';
import { isVerifiedEmployeeEmailApproval, type EmailDeliveryApproval } from './employee-email-approval.server';
import type { EmployeeSetupPorts } from './employee-email-callback.server';
export function createEmployeeSetupPorts(approval:EmailDeliveryApproval):EmployeeSetupPorts {
  const key=process.env['SUPABASE_PUBLISHABLE_KEY'];
  if(!isVerifiedEmployeeEmailApproval(approval)||!key||key.startsWith('sb_secret_'))throw new Error('EMAIL_SETUP_BLOCKED');
  // Per-request public Auth client, never the admin singleton or browser storage.
  const caller=createClient(approval.authOrigin,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>{
    const headers=new Headers(input instanceof Request?input.headers:undefined);
    new Headers(init?.headers).forEach((v,k)=>headers.set(k,v));
    if(key.startsWith('sb_publishable_')&&headers.get('Authorization')===`Bearer ${key}`)headers.delete('Authorization');
    headers.set('apikey',key);return fetch(input,{...init,headers,cache:'no-store'});
  }}});
  return {
    verify:async(tokenHash)=>{
      const {data,error}=await caller.auth.verifyOtp({token_hash:tokenHash,type:'recovery'});
      if(error||!data.user||!data.session)throw new Error('SETUP_TOKEN_REJECTED');
      return {userId:data.user.id,session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token,expires_at:data.session.expires_at??0,user:{id:data.user.id}}};
    },
    currentUser:async()=>{const {data,error}=await caller.auth.getUser();if(error||!data.user)throw new Error();return data.user.id;},
    context:async()=>{const {data,error}=await caller.rpc('confirm_my_employee_setup');if(error||!data)throw new Error();return data;},
    revoke:async()=>{await caller.auth.signOut({scope:'local'});},
  };
}
