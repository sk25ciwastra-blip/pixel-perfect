-- Only disposable PostgreSQL 17; minimal anonymous Training helper ACL fixture.
-- Deliberately contains no guests, employees, auth.users, payment or real data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE FUNCTION public.finance_training_assignment_for(_user_id uuid)
RETURNS TABLE(id uuid, trainee_user_id uuid, supervisor_user_id uuid,
              starts_on date, ends_on date, status text, label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public'
AS $func$ SELECT NULL::uuid,NULL::uuid,NULL::uuid,NULL::date,NULL::date,
                  NULL::text,NULL::text WHERE FALSE $func$;

CREATE FUNCTION public.finance_training_context_assignment(_user_id uuid,_session_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public'
AS $func$ SELECT NULL::uuid $func$;

CREATE FUNCTION public.finance_training_context_matches_session(_user_id uuid,_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public'
AS $func$ SELECT FALSE $func$;

CREATE FUNCTION public.finance_training_context_valid(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public'
AS $func$ SELECT public.finance_training_context_assignment(_user_id,NULL::uuid) IS NOT NULL $func$;

CREATE FUNCTION public.finance_training_session_is_valid(_user_id uuid,_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public'
AS $func$ SELECT FALSE $func$;

CREATE FUNCTION public.get_finance_training_context()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public'
AS $func$ SELECT jsonb_build_object('training',public.finance_training_context_valid(NULL::uuid)) $func$;

-- Mirror live preflight: 5 helpers are owned by postgres, SECURITY DEFINER,
-- and only anon/service_role are granted EXECUTE. PUBLIC/authenticated have
-- no grant. This is deliberate for reproducing the problematic ACL, NOT a
-- recommendation for Lovable permissions.
REVOKE EXECUTE ON FUNCTION public.finance_training_assignment_for(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finance_training_context_assignment(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finance_training_context_matches_session(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finance_training_context_valid(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finance_training_session_is_valid(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_training_assignment_for(uuid) TO anon,service_role;
GRANT EXECUTE ON FUNCTION public.finance_training_context_assignment(uuid,uuid) TO anon,service_role;
GRANT EXECUTE ON FUNCTION public.finance_training_context_matches_session(uuid,uuid) TO anon,service_role;
GRANT EXECUTE ON FUNCTION public.finance_training_context_valid(uuid) TO anon,service_role;
GRANT EXECUTE ON FUNCTION public.finance_training_session_is_valid(uuid,uuid) TO anon,service_role;

REVOKE EXECUTE ON FUNCTION public.get_finance_training_context() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_finance_training_context() TO authenticated,service_role;
