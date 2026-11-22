#!/usr/bin/env bash
set -euo pipefail
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}" PGPASSWORD="${PGPASSWORD:-postgres}"
export PGDATABASE="${PGDATABASE:-postgres}"

# Disposable PG only. Synthetic functions represent signatures and grants.
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $roles$;
CREATE OR REPLACE FUNCTION public.advance_room_cleaning(uuid,text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $func$
BEGIN NULL; END $func$;
CREATE OR REPLACE FUNCTION public.override_room_ready(uuid,text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $func$
BEGIN NULL; END $func$;
GRANT EXECUTE ON FUNCTION public.advance_room_cleaning(uuid,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.override_room_ready(uuid,text) TO PUBLIC;
DO $guard$
BEGIN
  IF NOT has_function_privilege('anon','public.advance_room_cleaning(uuid,text)','EXECUTE')
     OR NOT has_function_privilege('anon','public.override_room_ready(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Fixture missing effective anon grants';
  END IF;
END $guard$;
SQL
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261123073000_no7_housekeeping_anon_rpc_execute.sql
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $assert$
BEGIN
  IF has_function_privilege('anon','public.advance_room_cleaning(uuid,text)','EXECUTE')
     OR has_function_privilege('anon','public.override_room_ready(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'anon privilege remains after migration';
  END IF;
  IF NOT has_function_privilege('authenticated','public.advance_room_cleaning(uuid,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.override_room_ready(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost execute';
  END IF;
END $assert$;
SELECT 'No7 Housekeeping anon grants disposable PG PASS' AS result;
SQL
