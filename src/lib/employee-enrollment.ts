import { validateEmployeePrivateProfile } from './employee-private-profile';
export const EMPLOYEE_POSITIONS = ['receptionist','supervisor','housekeeping','inspector','investor'] as const;
export function strictObject(input: unknown, keys: readonly string[]) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INPUT_INVALID');
  const row=input as Record<string,unknown>;
  if (Object.keys(row).some(k=>!keys.includes(k))) throw new Error('INPUT_INVALID');
  return row;
}
export function boundedText(value: unknown, min: number, max: number) {
  if (typeof value!=='string' || value.trim().length<min || value.trim().length>max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('INPUT_INVALID');
  return value.trim();
}
export function employeeUuid(value: unknown) {
  const s=boundedText(value,36,36);
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s)) throw new Error('INPUT_INVALID');
  return s.toLowerCase();
}
function date(value: unknown) {
  const s=boundedText(value,10,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(`${s}T00:00:00Z`)) || new Date(`${s}T00:00:00Z`).toISOString().slice(0,10)!==s || s.startsWith('0000')) throw new Error('INPUT_INVALID');
  return s;
}
export function validatePrivateIdentity(input: unknown) {
  const p=strictObject(input,['nik','phone','emergencyName','emergencyRelationship','emergencyPhone','birthPlace','birthDate','gender','address','email']);
  const nik=boundedText(p['nik'],16,16);
  if (nik!==p['nik']) throw new Error('INPUT_INVALID');
  const base=validateEmployeePrivateProfile({nik,phone:boundedText(p['phone'],9,16),emergencyName:boundedText(p['emergencyName'],2,100),emergencyRelationship:boundedText(p['emergencyRelationship'],2,60),emergencyPhone:boundedText(p['emergencyPhone'],9,16)});
  const email=boundedText(p['email'],3,254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INPUT_INVALID');
  return {...base,birthPlace:boundedText(p['birthPlace'],1,100),birthDate:date(p['birthDate']),gender:boundedText(p['gender'],1,40),address:boundedText(p['address'],5,500),email};
}
export function validateEmployeeEnrollment(input: unknown) {
  const p=strictObject(input,['requestId','name','position','joinDate','identity']);
  if (!EMPLOYEE_POSITIONS.includes(p['position'] as typeof EMPLOYEE_POSITIONS[number])) throw new Error('INPUT_INVALID');
  return {requestId:employeeUuid(p['requestId']),name:boundedText(p['name'],1,100),position:p['position'] as typeof EMPLOYEE_POSITIONS[number],joinDate:date(p['joinDate']),identity:validatePrivateIdentity(p['identity'])};
}
export type EmployeeEnrollment = ReturnType<typeof validateEmployeeEnrollment>;
export function validateOwnPasswordChange(input: unknown) {
  const p=strictObject(input,['password','nonce']);
  // Do not trim passwords or accept role/email/target-user fields.
  if (typeof p['password']!=='string' || p['password'].length<12 || p['password'].length>128 || /[\u0000-\u001f\u007f]/.test(p['password'])) throw new Error('INPUT_INVALID');
  return {password:p['password'],...(p['nonce']===undefined?{}:{nonce:boundedText(p['nonce'],1,200)})};
}
