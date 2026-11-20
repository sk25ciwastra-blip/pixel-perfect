-- Baturaden 25 Homestay: official real-employee numbers (NOT DEMO reset).
-- REVIEW ONLY. DO NOT RUN ON LIVE without separate Owner Cloud SQL approval.
-- Requires no existing B25EMP- IDs; does not alter any historical employees.
BEGIN;

DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM public.employees WHERE employee_id LIKE 'B25EMP-%') THEN
    RAISE EXCEPTION 'STOP: B25EMP namespace already populated; reconcile sequence seed first';
  END IF;
  IF to_regclass('public.b25_employee_id_seq') IS NOT NULL
     OR to_regprocedure('public.allocate_b25_employee_id()') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: B25EMP allocator already installed; do not reinitialize';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    RAISE EXCEPTION 'STOP: missing Supabase service_role';
  END IF;
END
$preflight$;

CREATE SEQUENCE public.b25_employee_id_seq
  AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

REVOKE ALL ON SEQUENCE public.b25_employee_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SEQUENCE public.b25_employee_id_seq TO service_role;

CREATE FUNCTION public.allocate_b25_employee_id()
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $allocator$
  SELECT 'B25EMP-' ||
    lpad(nextval('public.b25_employee_id_seq'::regclass)::text, 3, '0');
$allocator$;

REVOKE ALL ON FUNCTION public.allocate_b25_employee_id()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_b25_employee_id()
  TO service_role;

DO $postcheck$
BEGIN
  IF NOT has_function_privilege('service_role', 'public.allocate_b25_employee_id()', 'EXECUTE')
     OR NOT has_sequence_privilege('service_role', 'public.b25_employee_id_seq', 'USAGE')
     OR has_function_privilege('anon', 'public.allocate_b25_employee_id()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.allocate_b25_employee_id()', 'EXECUTE')
     OR has_sequence_privilege('anon', 'public.b25_employee_id_seq', 'USAGE')
     OR has_sequence_privilege('authenticated', 'public.b25_employee_id_seq', 'USAGE') THEN
    RAISE EXCEPTION 'STOP: B25EMP allocator privilege postcheck failed';
  END IF;
END
$postcheck$;
COMMIT;
