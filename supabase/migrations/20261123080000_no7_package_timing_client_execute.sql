-- Baturaden 25 Homestay — No7 P0 package timing privilege hardening.
-- SELECT-only Cloud audit found explicit anon EXECUTE on the SECURITY DEFINER
-- helper apply_official_package_timing(uuid,text). Its body updates packages
-- without checking actor identity. Preserve postgres/service_role internal calls.
-- Do not run in Cloud until authorized and disposable PG regression PASS.
BEGIN;
DO $preflight$
BEGIN
  IF to_regprocedure('public.apply_official_package_timing(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'P0 package timing helper signature drift: stop';
  END IF;
  IF NOT has_function_privilege('anon',
        'public.apply_official_package_timing(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'P0 package timing grant baseline changed: re-review';
  END IF;
  IF has_function_privilege('authenticated',
        'public.apply_official_package_timing(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected authenticated package timing grant: re-review';
  END IF;
  IF NOT has_function_privilege('service_role',
        'public.apply_official_package_timing(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Internal package timing service grant missing: stop';
  END IF;
END $preflight$;
REVOKE EXECUTE ON FUNCTION public.apply_official_package_timing(uuid,text) FROM anon, PUBLIC;
DO $postcheck$
BEGIN
  IF has_function_privilege('anon',
        'public.apply_official_package_timing(uuid,text)','EXECUTE') OR
     has_function_privilege('authenticated',
        'public.apply_official_package_timing(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Package timing helper still exposed to client roles';
  END IF;
  IF NOT has_function_privilege('service_role',
        'public.apply_official_package_timing(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Internal package timing grant lost';
  END IF;
END $postcheck$;
COMMIT;
