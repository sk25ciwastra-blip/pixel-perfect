import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { validateEmployeeLifecycleChange, validateEmployeeLifecycleRead, validateEmployeeTrainingPreparation } from './employee-lifecycle';

// Not wired to the old form. Database RPCs are pending until separately approved.
// Use the caller's authenticated client, never a service-role client or actor parameter.
// Keep lifecycle commands POST-only; no audit reason/identity in query strings.
export const changeEmployeeLifecycle = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth]).inputValidator(validateEmployeeLifecycleChange)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc('change_employee_lifecycle' as never, {
      _employee_id: data.employeeId, _event: data.event, _reason: data.reason,
      _expected_version: data.expectedVersion, _effective_on: data.effectiveOn, _join_date: data.joinDate,
    } as never);
    if (error || typeof result !== 'number' || !Number.isSafeInteger(result) || result < 1) throw new Error('Perubahan lifecycle tidak tersedia atau ditolak; muat ulang status.');
    return { version: result as number };
  });
export const prepareEmployeeTraining = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth]).inputValidator(validateEmployeeTrainingPreparation)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc('prepare_employee_training' as never, {
      _employee_id: data.employeeId, _supervisor_user_id: data.supervisorUserId,
      _starts_on: data.startsOn, _expected_version: data.expectedVersion,
    } as never);
    if (error || typeof result !== 'string' || !result) throw new Error('Persiapan Training tidak tersedia atau ditolak; muat ulang status.');
    return { assignmentId: result as string };
  });
export const readEmployeeLifecycle = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth]).inputValidator(validateEmployeeLifecycleRead)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc('read_employee_lifecycle' as never, {
      _employee_id: data.employeeId, _after_version: data.afterVersion,
    } as never);
    if (error || !result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Riwayat lifecycle tidak tersedia atau akses ditolak.');
    return result;
  });
