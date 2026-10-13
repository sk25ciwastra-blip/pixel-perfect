-- Task 1.6 — Role & Permission Foundation
-- Adds employee positions and reusable capability helpers.
-- Existing accounts/data are preserved.


create or replace function public.has_employee_position(
  _user_id uuid,
  _positions public.employee_position[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(_user_id, 'employee'::public.app_role)
    and exists (
      select 1
      from public.employees
      where user_id = _user_id
        and active
        and position = any(_positions)
    );
$$;

create or replace function public.can_frontdesk(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(_user_id, 'owner'::public.app_role)
    or public.has_employee_position(
      _user_id,
      array['receptionist','supervisor']::public.employee_position[]
    );
$$;

create or replace function public.can_housekeeping(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(_user_id, 'owner'::public.app_role)
    or public.has_employee_position(
      _user_id,
      array['housekeeping','supervisor']::public.employee_position[]
    );
$$;

create or replace function public.can_view_operations(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(_user_id, 'owner'::public.app_role)
    or public.has_employee_position(
      _user_id,
      array[
        'receptionist',
        'housekeeping',
        'supervisor',
        'inspector'
      ]::public.employee_position[]
    );
$$;

create or replace function public.can_view_finance(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(_user_id, 'owner'::public.app_role)
    or public.has_employee_position(
      _user_id,
      array['supervisor','investor']::public.employee_position[]
    );
$$;

-- Keep the legacy helper safe.
-- Inspector and Investor are deliberately NOT operators.
create or replace function public.can_operate(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(_user_id, 'owner'::public.app_role)
    or public.has_employee_position(
      _user_id,
      array[
        'receptionist',
        'housekeeping',
        'supervisor'
      ]::public.employee_position[]
    );
$$;

-- Receptionist compatibility helper:
-- Supervisor is allowed wherever the current backend expects
-- receptionist/front-desk operational permission.
create or replace function public.is_receptionist(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_frontdesk(_user_id);
$$;

-- Employees may see their own employee record.
-- Owner keeps visibility of all employees.
drop policy if exists employee_owner_read on public.employees;
create policy employee_owner_read
on public.employees
for select
to authenticated
using (
  public.has_role(auth.uid(), 'owner'::public.app_role)
  or user_id = auth.uid()
);

-- Operational reference data.
drop policy if exists packages_read on public.packages;
create policy packages_read
on public.packages
for select
to authenticated
using (
  public.can_view_operations(auth.uid())
  or public.can_view_finance(auth.uid())
);

drop policy if exists room_types_read on public.room_types;
create policy room_types_read
on public.room_types
for select
to authenticated
using (
  public.can_view_operations(auth.uid())
  or public.can_view_finance(auth.uid())
);

drop policy if exists rooms_read on public.rooms;
create policy rooms_read
on public.rooms
for select
to authenticated
using (
  public.can_view_operations(auth.uid())
  or public.can_view_finance(auth.uid())
);

-- Guest PII:
-- Supervisor + Receptionist can operate guest/front-desk data.
-- Inspector may read it for operational inspection.
-- Investor is deliberately excluded.
drop policy if exists guests_read on public.guests;
create policy guests_read
on public.guests
for select
to authenticated
using (
  public.can_frontdesk(auth.uid())
  or public.has_employee_position(
    auth.uid(),
    array['inspector']::public.employee_position[]
  )
);

drop policy if exists guests_write on public.guests;
create policy guests_write
on public.guests
for all
to authenticated
using (public.can_frontdesk(auth.uid()))
with check (public.can_frontdesk(auth.uid()));

-- Raw transactions remain operational data.
-- Investor is deliberately excluded because transaction rows may
-- later expose guest-linked information. Investor finance access
-- will use a sanitized finance surface.
drop policy if exists transactions_read on public.transactions;
create policy transactions_read
on public.transactions
for select
to authenticated
using (
  public.can_frontdesk(auth.uid())
  or public.has_employee_position(
    auth.uid(),
    array['inspector']::public.employee_position[]
  )
);

drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert
on public.transactions
for insert
to authenticated
with check (
  public.can_frontdesk(auth.uid())
  and created_by = auth.uid()
);

-- Payments are readable by front desk and Inspector.
-- Investor does NOT receive raw payment rows here.
drop policy if exists payments_staff_read on public.payments;
create policy payments_staff_read
on public.payments
for select
to authenticated
using (
  public.can_frontdesk(auth.uid())
  or public.has_employee_position(
    auth.uid(),
    array['inspector']::public.employee_position[]
  )
);

-- Activity log remains Owner-only for now.
-- Broader audit-log visibility can be added deliberately later.

comment on function public.can_frontdesk(uuid)
is 'Owner, active Receptionist, or active Supervisor.';

comment on function public.can_housekeeping(uuid)
is 'Owner, active Housekeeping, or active Supervisor.';

comment on function public.can_view_operations(uuid)
is 'Owner or active operational employee including read-only Inspector.';

comment on function public.can_view_finance(uuid)
is 'Owner, active Supervisor, or active Investor. Investor finance must use sanitized surfaces.';
