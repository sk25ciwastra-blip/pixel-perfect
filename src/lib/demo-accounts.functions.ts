import { createServerFn } from '@tanstack/react-start';

export const DEMO_ACCOUNTS = {
  password: 'Btrd25-Demo!2026',
  users: [
    { email: 'owner@btrd25.com', role: 'owner' as const },
    {
      email: 'receptionist@btrd25.com',
      role: 'employee' as const,
      name: 'Rina Lestari',
      employeeId: 'KR-DEMO-01',
      position: 'receptionist' as const,
      active: true,
    },
    {
      email: 'housekeeping@btrd25.com',
      role: 'employee' as const,
      name: 'Joko Susilo',
      employeeId: 'KR-DEMO-02',
      position: 'housekeeping' as const,
      active: true,
    },
    {
      email: 'inactive@btrd25.com',
      role: 'employee' as const,
      name: 'Nia Ramadhani',
      employeeId: 'KR-DEMO-03',
      position: 'receptionist' as const,
      active: false,
    },
  ],
};

export const seedDemoAccounts = createServerFn({ method: 'POST' }).handler(async () => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: listed } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const known = listed?.users ?? [];
  const emails: string[] = [];

  for (const account of DEMO_ACCOUNTS.users) {
    const existing = known.find((user) => user.email?.toLowerCase() === account.email.toLowerCase());
    let userId = existing?.id;
    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: DEMO_ACCOUNTS.password,
        email_confirm: true,
      });
      if (!created.user) throw new Error(error?.message ?? `Gagal membuat ${account.email}`);
      userId = created.user.id;
    }

    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: userId, role: account.role }, { onConflict: 'user_id' });
    if (roleError) throw new Error(roleError.message);

    if (account.role === 'employee') {
      const { error: employeeError } = await supabaseAdmin.from('employees').upsert(
        {
          user_id: userId,
          name: account.name,
          employee_id: account.employeeId,
          position: account.position,
          active: account.active,
        },
        { onConflict: 'user_id' },
      );
      if (employeeError) throw new Error(employeeError.message);
    }
    emails.push(account.email);
  }

  return { ok: true as const, emails };
});
