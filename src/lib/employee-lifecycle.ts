// Backend contracts only. No UI or private-identity fields in this lifecycle DTO.
export const EMPLOYEE_LIFECYCLE_EVENTS = [
  'SET_JOIN_DATE', 'ACTIVATE', 'SUSPEND', 'END_EMPLOYMENT', 'REACTIVATE',
] as const;
type LifecycleEvent = typeof EMPLOYEE_LIFECYCLE_EVENTS[number];
function object(value: unknown, allowed: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Permintaan tidak valid');
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !allowed.includes(key))) throw new Error('Field tidak diizinkan');
  return row;
}
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) throw new Error('ID tidak valid');
  return value;
}
function version(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Versi tidak valid');
  return value;
}
function date(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error('Tanggal tidak valid');
  return value;
}
export function validateEmployeeLifecycleChange(value: unknown) {
  const row = object(value, ['employeeId', 'event', 'reason', 'expectedVersion', 'effectiveOn', 'joinDate']);
  if (typeof row['event'] !== 'string' || !EMPLOYEE_LIFECYCLE_EVENTS.includes(row['event'] as LifecycleEvent)) throw new Error('Peristiwa tidak valid');
  const reason = typeof row['reason'] === 'string' ? row['reason'].trim() : '';
  if (reason.length < 5 || reason.length > 300 || /[\u0000-\u001f\u007f]/.test(reason)) throw new Error('Alasan audit tidak valid');
  const joinDate = date(row['joinDate']);
  if ((row['event'] === 'SET_JOIN_DATE') !== (joinDate !== null)) throw new Error('Tanggal bergabung hanya untuk SET_JOIN_DATE');
  return { employeeId: uuid(row['employeeId']), event: row['event'] as LifecycleEvent, reason,
    expectedVersion: version(row['expectedVersion']), effectiveOn: date(row['effectiveOn']), joinDate };
}
export function validateEmployeeTrainingPreparation(value: unknown) {
  const row = object(value, ['employeeId', 'supervisorUserId', 'startsOn', 'expectedVersion']);
  const startsOn = date(row['startsOn']);
  if (!startsOn) throw new Error('Tanggal Training wajib diisi');
  return { employeeId: uuid(row['employeeId']), supervisorUserId: uuid(row['supervisorUserId']),
    startsOn, expectedVersion: version(row['expectedVersion']) };
}
export function validateEmployeeLifecycleRead(value: unknown) {
  const row = object(value, ['employeeId', 'afterVersion']);
  return { employeeId: uuid(row['employeeId']), afterVersion: version(row['afterVersion'] ?? 0) };
}
