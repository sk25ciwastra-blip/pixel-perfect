-- Baturaden 25 Homestay — restrict operational pricing calendar visibility.
-- Approved by Owner 2026-11-27 after Lovable security warning.
-- Cloud prerequisite: protected snapshot in b25_maintenance_private, verified.
-- IMPORTANT: No calendar rows, rates, business-day algorithm or Owner overrides change.
BEGIN;

DO $guard$
DECLARE
  policy_count integer;
  unsafe_policy_count integer;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.operational_calendar'::regclass) THEN
    RAISE EXCEPTION 'operational_calendar RLS is not enabled; stop for manual review';
  END IF;

  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname='public' AND tablename='operational_calendar';

  SELECT count(*) INTO unsafe_policy_count
  FROM pg_policies
  WHERE schemaname='public' AND tablename='operational_calendar'
    AND policyname='Authenticated users can read operational calendar'
    AND cmd='SELECT' AND qual='true' AND roles=ARRAY['authenticated']::name[];

  IF policy_count <> 1 OR unsafe_policy_count <> 1 THEN
    RAISE EXCEPTION 'Unexpected calendar RLS policies; stop to avoid modifying later rules';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='can_frontdesk'
      AND pg_get_function_identity_arguments(p.oid)='_user_id uuid'
  ) THEN RAISE EXCEPTION 'Expected can_frontdesk authorization function missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='get_operational_day_mode'
      AND pg_get_function_identity_arguments(p.oid)='_calendar_date date'
      AND NOT p.prosecdef
  ) THEN RAISE EXCEPTION 'Unexpected calendar pricing RPC; stop for manual review'; END IF;

  IF to_regclass('b25_maintenance_private.operational_calendar_backup_20261127') IS NULL
     OR to_regclass('b25_maintenance_private.operational_calendar_policy_backup_20261127') IS NULL
  THEN RAISE EXCEPTION 'Restricted pre-migration backup not available'; END IF;

  IF (SELECT count(*) FROM public.operational_calendar)
    <> (SELECT count(*) FROM b25_maintenance_private.operational_calendar_backup_20261127)
  THEN RAISE EXCEPTION 'Calendar changed since backup; re-check before migration'; END IF;
END;
$guard$;

DROP POLICY "Authenticated users can read operational calendar"
  ON public.operational_calendar;

CREATE POLICY "Operational staff can read operational calendar"
  ON public.operational_calendar
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND public.can_frontdesk((SELECT auth.uid()))
  );

-- Direct read is now available only to authenticated operational users who
-- pass the RLS predicate. An arbitrary newly registered account sees 0 rows.
REVOKE SELECT ON TABLE public.operational_calendar FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.operational_calendar TO authenticated;

-- Booking calls this invoker RPC. Keep its logic unchanged; only authenticated
-- callers may invoke it. Their row visibility is enforced by the new RLS rule.
REVOKE EXECUTE ON FUNCTION public.get_operational_day_mode(date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operational_day_mode(date)
  TO authenticated;

COMMIT;
