-- Assert exact security behavior of the migration in disposable PostgreSQL.
DO $audit$
BEGIN
 IF (SELECT count(*) FROM pg_policies
   WHERE schemaname='public' AND tablename='operational_calendar')<>1
 OR NOT EXISTS(SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='operational_calendar'
   AND policyname='Operational staff can read operational calendar'
   AND qual LIKE '%can_frontdesk%')
 THEN RAISE EXCEPTION 'Calendar retains wide-open RLS'; END IF;
 IF has_table_privilege('anon','public.operational_calendar','SELECT')
  OR has_function_privilege('anon','public.get_operational_day_mode(date)','EXECUTE')
 THEN RAISE EXCEPTION 'Anon can read calendar or day-mode RPC'; END IF;
 IF NOT has_table_privilege('authenticated','public.operational_calendar','SELECT')
 OR NOT has_function_privilege('authenticated','public.get_operational_day_mode(date)','EXECUTE')
 THEN RAISE EXCEPTION 'Operational users lost SELECT or RPC privileges'; END IF;
 IF (SELECT count(*) FROM public.operational_calendar)<>3
 OR (SELECT count(*) FROM (
      SELECT * FROM public.operational_calendar EXCEPT
      SELECT * FROM b25_maintenance_private.operational_calendar_backup_20261127
    ) different)<>0
 THEN RAISE EXCEPTION 'Original calendar data changed'; END IF;
END $audit$;

-- New signup: authenticated database role but no authorized employee identity.
BEGIN;
SELECT set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
SET LOCAL ROLE authenticated;
DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.operational_calendar)<>0
 THEN RAISE EXCEPTION 'Unapproved registered user can read calendar'; END IF;
END $verify$;
ROLLBACK;

-- Authenticated role, but no identity at all.
BEGIN;
SET LOCAL ROLE authenticated;
DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.operational_calendar)<>0
 THEN RAISE EXCEPTION 'Unidentified authenticated user can read calendar'; END IF;
END $verify$;
ROLLBACK;

-- Three authorized operational identities: Owner, Receptionist and Supervisor.
BEGIN;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
SET LOCAL ROLE authenticated;
DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.operational_calendar)<>3 THEN
  RAISE EXCEPTION 'Owner lost calendar rows';
 END IF;
 IF public.get_operational_day_mode('2026-12-25')<>'weekend'
 OR public.get_operational_day_mode('2026-12-24')<>'weekday'
 OR public.get_operational_day_mode('2026-12-28')<>'weekend'
 OR public.get_operational_day_mode('2026-11-27')<>'weekend'
 OR public.get_operational_day_mode('2026-11-30')<>'weekday' THEN
  RAISE EXCEPTION 'Owner pricing mode changed'; END IF;
END $verify$;
ROLLBACK;

BEGIN;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
SET LOCAL ROLE authenticated;
DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.operational_calendar)<>3
 OR public.get_operational_day_mode('2026-12-25')<>'weekend' THEN
  RAISE EXCEPTION 'Receptionist lost calendar visibility or holiday day mode';
 END IF;
END $verify$;
ROLLBACK;

BEGIN;
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
SET LOCAL ROLE authenticated;
DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.operational_calendar)<>3
 OR public.get_operational_day_mode('2026-12-24')<>'weekday' THEN
  RAISE EXCEPTION 'Supervisor lost calendar visibility or collective leave classification';
 END IF;
END $verify$;
ROLLBACK;

SELECT 'PASS security: new signup denied, staff preserved, pricing and data unchanged' AS result;
