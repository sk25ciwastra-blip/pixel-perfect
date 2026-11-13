import { validateEmployeeEnrollment, validateOwnPasswordChange, validatePrivateIdentity, strictObject, employeeUuid } from './employee-enrollment';
import { validateEmployeeLifecycleChange, validateEmployeeLifecycleRead, validateEmployeeTrainingPreparation } from './employee-lifecycle';
import { validateEmployeeTrainingResolution } from './employee-training-resolution';

// Headless form contract: retain requestId on ambiguous failures, never persist
// identity/password in browser storage. Backend remains authoritative for roles.
export interface EmployeeIntegrationPorts {
  approval():Promise<{state:string}>;
  enroll(input:ReturnType<typeof validateEmployeeEnrollment>):Promise<unknown>;
  recover(requestId:string):Promise<unknown>;
  lifecycle(input:ReturnType<typeof validateEmployeeLifecycleRead>):Promise<unknown>;
  change(input:ReturnType<typeof validateEmployeeLifecycleChange>):Promise<unknown>;
  training(input:ReturnType<typeof validateEmployeeTrainingPreparation>):Promise<unknown>;
  password(input:ReturnType<typeof validateOwnPasswordChange>):Promise<unknown>;
  resolveTraining(input:ReturnType<typeof validateEmployeeTrainingResolution>):Promise<unknown>;
  identity(employeeId:string):Promise<unknown>;
  updateIdentity(employeeId:string,identity:ReturnType<typeof validatePrivateIdentity>):Promise<unknown>;
  portrait(employeeId:string):Promise<unknown>;
  uploadPortrait(employeeId:string,mime:string,base64:string):Promise<unknown>;
}
export function createEmployeeIntegration(ports:EmployeeIntegrationPorts,uuid:()=>string=()=>crypto.randomUUID()) {
  let requestId:string|null=null, submitted:string|null=null, busy=false;
  async function exclusive<T>(work:()=>Promise<T>) {
    if(busy)throw new Error('REQUEST_IN_PROGRESS');busy=true;
    try{return await work();}finally{busy=false;}
  }
  return {
    // A new draft is explicit; retry never silently allocates another employee.
    newDraft(){if(busy)throw new Error('REQUEST_IN_PROGRESS');requestId=employeeUuid(uuid());submitted=null;return requestId;},
    getRequestId(){return requestId;},
    submit(input:unknown){return exclusive(async()=>{
      const raw=strictObject(input,['name','position','joinDate','identity']);
      if(!requestId)requestId=employeeUuid(uuid());
      const value=validateEmployeeEnrollment({...raw,requestId});
      const serialized=JSON.stringify(value);
      if(submitted!==null&&submitted!==serialized)throw new Error('DRAFT_CHANGED_REVIEW_REQUIRED');
      if((await ports.approval()).state!=='VERIFIED')throw new Error('OWNER_CONFIGURATION_REQUIRED');
      submitted=serialized;return ports.enroll(value);
    });},
    recover(){return exclusive(async()=>{if(!requestId)throw new Error('NO_REQUEST');return ports.recover(requestId);});},
    // Cursor is explicit. Presentation must not mistake a first page for all history.
    read(input:unknown){return ports.lifecycle(validateEmployeeLifecycleRead(input));},
    change(input:unknown){return exclusive(()=>ports.change(validateEmployeeLifecycleChange(input)));},
    prepareTraining(input:unknown){return exclusive(()=>ports.training(validateEmployeeTrainingPreparation(input)));},
    resolveTraining(input:unknown){return exclusive(()=>ports.resolveTraining(validateEmployeeTrainingResolution(input)));},
    readIdentity(employeeId:unknown){return ports.identity(employeeUuid(employeeId));},
    updateIdentity(input:unknown){return exclusive(()=>{const r=strictObject(input,['employeeId','identity']);return ports.updateIdentity(employeeUuid(r['employeeId']),validatePrivateIdentity(r['identity']));});},
    readPortrait(employeeId:unknown){return ports.portrait(employeeUuid(employeeId));},
    uploadPortrait(input:unknown){return exclusive(()=>{const r=strictObject(input,['employeeId','mime','base64']);
      if(!['image/jpeg','image/png','image/webp'].includes(r['mime'] as string)||typeof r['base64']!=='string'||r['base64'].length>2800000)throw new Error('PORTRAIT_INVALID');
      return ports.uploadPortrait(employeeUuid(r['employeeId']),r['mime'] as string,r['base64']);
    });},
    ownPassword(input:unknown){return exclusive(()=>ports.password(validateOwnPasswordChange(input)));},
    dispose(){if(busy)throw new Error('REQUEST_IN_PROGRESS');requestId=null;submitted=null;},
  };
}
