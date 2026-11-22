import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const hapusDataDemo = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    kind: z.enum(['employee', 'transaction']),
    id: z.string().uuid(),
    confirmation: z.string().min(1).max(128),
    demoConfirmed: z.literal(true),
  }).strict())
  .handler(async ({ data, context }) => {
    const { data: owner, error: roleError } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'owner',
    });
    if (roleError || !owner) return 'denied';
    const { data: result, error } = await context.supabase.rpc('owner_delete_demo', {
      _kind: data.kind,
      _id: data.id,
      _confirmation: data.confirmation,
      _demo_confirmed: data.demoConfirmed,
    });
    if (error?.code === '42501') return 'denied';
    if (error?.code === 'PGRST202') return 'unavailable';
    if (error?.code === '55P03' || error?.code === '40P01' || error?.code === '40001') return 'busy';
    return error ? 'failed' : result;
  });
