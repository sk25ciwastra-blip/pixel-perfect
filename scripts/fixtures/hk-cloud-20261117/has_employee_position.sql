CREATE OR REPLACE FUNCTION public.has_employee_position(_user_id uuid, _positions employee_position[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.has_role(_user_id, 'employee'::public.app_role)
    and exists (
      select 1
      from public.employees
      where user_id = _user_id
        and active
        and position = any(_positions)
    );
$function$
