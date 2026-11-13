import { boundedText, employeeUuid, strictObject } from './employee-enrollment';
export function validateEmployeeTrainingResolution(input:unknown){
  const r=strictObject(input,['assignmentId','status','reason']);
  if(!['PASSED','FAILED','REVOKED'].includes(r['status'] as string))throw new Error('INPUT_INVALID');
  return {assignmentId:employeeUuid(r['assignmentId']),status:r['status'] as 'PASSED'|'FAILED'|'REVOKED',reason:boundedText(r['reason'],5,300)};
}
