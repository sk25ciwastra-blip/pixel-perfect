import { type EmailDeliveryApproval, requireEmployeeCallbackOrigin } from './employee-email-approval.server';
import { employeeSetupToken } from './employee-email-callback';
export type SetupSession={access_token:string;refresh_token:string;expires_at:number;user:{id:string}};
export interface EmployeeSetupPorts {
 verify(tokenHash:string):Promise<{userId:string;session:SetupSession}>;
 currentUser():Promise<string>;
 context():Promise<{user_id:string;employee_code:string;employment_state:string;next_step:string}>;
 revoke():Promise<void>;
}
export async function exchangeEmployeeSetup(input:unknown,approval:EmailDeliveryApproval,origin:string,contentType:string,ports:EmployeeSetupPorts){
  requireEmployeeCallbackOrigin(approval,origin,contentType);
  const token=employeeSetupToken(input);
  let acquired=false;
  try{
    const {userId,session}=await ports.verify(token.tokenHash);acquired=true;
    if(!userId||userId!==session.user.id||!session.access_token||!session.refresh_token||!Number.isFinite(session.expires_at)||session.expires_at<=Date.now()/1000)throw new Error();
    if(await ports.currentUser()!==userId)throw new Error();
    const ctx=await ports.context();
    if(ctx.user_id!==userId||ctx.employment_state!=='REGISTERED'||ctx.next_step!=='SET_PASSWORD_ONLY')throw new Error();
    // Only this authenticated user's session, never admin/HMAC/SMTP keys or PII.
    // No returnTo/operational URL, no ACTIVATE or finance/session mutation.
    return {nextStep:'SET_PASSWORD_ONLY' as const,employeeCode:ctx.employee_code,
      session:{access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at}};
  }catch{
    if(acquired)try{await ports.revoke();}catch{/* best effort; never expose failed session */}
    throw new Error('SETUP_TOKEN_REJECTED');
  }
}
