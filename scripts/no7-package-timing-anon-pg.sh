#!/usr/bin/env bash
set -euo pipefail
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}" PGPASSWORD="${PGPASSWORD:-postgres}"
export PGDATABASE="${PGDATABASE:-postgres}"
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $roles$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $roles$;
CREATE TABLE public.packages(id uuid PRIMARY KEY, time_mode text);
CREATE FUNCTION public.apply_official_package_timing(_package_id uuid,_package_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $f$
BEGIN
 UPDATE public.packages SET time_mode='fixed_window' WHERE id=_package_id;
END $f$;
REVOKE ALL ON FUNCTION public.apply_official_package_timing(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_official_package_timing(uuid,text) TO anon,service_role;
INSERT INTO public.packages VALUES('11111111-1111-4111-8111-111111111111',NULL);
SQL
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261123080000_no7_package_timing_client_execute.sql
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $verify$
BEGIN
 IF has_function_privilege('anon','public.apply_official_package_timing(uuid,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.apply_official_package_timing(uuid,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.apply_official_package_timing(uuid,text)','EXECUTE') THEN
   RAISE EXCEPTION 'Package timing privilege postcheck failed';
 END IF;
END $verify$;
BEGIN;
SET LOCAL ROLE anon;
DO $deny$
BEGIN
  BEGIN
    PERFORM public.apply_official_package_timing('11111111-1111-4111-8111-111111111111','Paket Pagi');
    RAISE EXCEPTION 'Anonymous function call unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $deny$;
RESET ROLE;
ROLLBACK;
-- Service role retains package-timing helper access.
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.apply_official_package_timing('11111111-1111-4111-8111-111111111111','Paket Pagi');
RESET ROLE;
ROLLBACK;
SELECT 'No7 package timing P0 privilege test PASS' AS result;
SQL
