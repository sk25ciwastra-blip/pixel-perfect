CREATE OR REPLACE FUNCTION public.can_housekeeping(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.has_role(_user_id, 'owner'::public.app_role)
    or public.has_employee_position(
      _user_id,
      array['housekeeping','supervisor']::public.employee_position[]
    );
$function$
