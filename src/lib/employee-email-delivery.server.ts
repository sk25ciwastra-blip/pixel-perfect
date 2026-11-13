import { isVerifiedEmployeeEmailApproval, type EmailDeliveryApproval } from './employee-email-approval.server';
export async function requestApprovedEmployeeSetupEmail(approval:EmailDeliveryApproval|undefined,redirectTo:string,send:()=>Promise<void>,timeoutMs=15000){
  if(!isVerifiedEmployeeEmailApproval(approval)||redirectTo!==approval.redirectTo)throw new Error('EMAIL_APPROVAL_REQUIRED');
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    await Promise.race([send(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error()),timeoutMs);})]);
  }catch{throw new Error('EMAIL_DELIVERY_UNKNOWN');}
  finally{if(timer)clearTimeout(timer);}
  // A timeout is NOT cancellation: provider may already have accepted delivery.
  // Never retry here, never generate another token automatically.
}
