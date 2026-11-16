type EditableProfile = { address: string; emergency_name: string; emergency_relation: string; emergency_phone: string };
export function employeeEditProfile(p: EditableProfile): EditableProfile {
  return { address: p.address, emergency_name: p.emergency_name, emergency_relation: p.emergency_relation, emergency_phone: p.emergency_phone };
}