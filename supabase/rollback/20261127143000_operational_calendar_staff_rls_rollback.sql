-- EMERGENCY ROLLBACK (not executed). Requires Owner's separate approval.
-- WARNING: This restores the original broad authenticated read rule and
-- re-opens the Lovable security finding. Only for controlled incident response.
-- Backup calendar rows and original grant/policy snapshots remain in:
-- b25_maintenance_private.operational_calendar_backup_20261127
-- b25_maintenance_private.operational_calendar_policy_backup_20261127
-- Never restore or delete live calendar data as part of an RLS rollback.
BEGIN;

DO $guard$
BEGIN
  IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='operational_calendar')<>1
     OR NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='operational_calendar'
         AND policyname='Operational staff can read operational calendar'
         AND cmd='SELECT' AND qual LIKE '%can_frontdesk%'
     )
  THEN RAISE EXCEPTION 'Current calendar security does not match expected new policy'; END IF;
END $guard$;

DROP POLICY "Operational staff can read operational calendar"
  ON public.operational_calendar;

CREATE POLICY "Authenticated users can read operational calendar"
  ON public.operational_calendar FOR SELECT TO authenticated USING (true);

-- These were the precise original privileges before security hardening.
GRANT SELECT ON TABLE public.operational_calendar TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_operational_day_mode(date)
  TO PUBLIC, anon, authenticated;

COMMIT;
-- Re-run security scanner and confirm the accepted incident exception
-- if an emergency rollback is ever explicitly authorized.
