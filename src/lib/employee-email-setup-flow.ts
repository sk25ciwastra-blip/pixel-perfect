import { captureEmployeeSetupFragment } from './employee-email-callback';
export const EMPLOYEE_PASSWORD_SETUP_PATH='/reset-password';
export function isAuthOnlyPasswordPage(path:string){return path===EMPLOYEE_PASSWORD_SETUP_PATH;}
export type EmployeeSetupResult={nextStep:string;session:{access_token:string;refresh_token:string;expires_at:number}};
export interface EmployeeSetupBrowserPorts {
 policy():Promise<{state:string;callbackUrl?:string;authOrigin?:string}>;
 clientAuthOrigin:string;
 hasSession():Promise<boolean>;
 exchange(token:{tokenHash:string;type:'recovery'}):Promise<EmployeeSetupResult>;
 setSession(session:EmployeeSetupResult['session']):Promise<void>;
}
export async function startEmployeeEmailSetup(href:string,replace:(url:string)=>void,ports:EmployeeSetupBrowserPorts){
 // Call only on an explicit form submit, not GET/page mount or link prefetch.
 const u=new URL(href);
 // Remove credential material before this flow's async calls/storage. The
 // deployment must keep callback-page analytics disabled before hydration too.
 replace(u.origin+u.pathname);
 const policy=await ports.policy();
 if(policy.state!=='VERIFIED'||!policy.callbackUrl)throw new Error('EMAIL_SETUP_BLOCKED');
 const client=new URL(ports.clientAuthOrigin);
 if(!policy.authOrigin||client.origin!==policy.authOrigin||client.pathname!=='/'||client.search||client.hash||client.username||client.password)throw new Error('EMAIL_SETUP_BLOCKED');
 const token=captureEmployeeSetupFragment(href,policy.callbackUrl,()=>{});
 if(await ports.hasSession())throw new Error('SIGN_OUT_BEFORE_SETUP');
 const result=await ports.exchange(token);
 if(result.nextStep!=='SET_PASSWORD_ONLY')throw new Error('EMAIL_SETUP_BLOCKED');
 await ports.setSession(result.session);return result.session.access_token;
}
