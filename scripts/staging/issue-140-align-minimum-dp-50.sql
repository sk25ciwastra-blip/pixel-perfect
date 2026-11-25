-- STAGING ONLY / Baturaden-25-Staging (bgtztcfbkcrvcipxbfti).
-- Owner business rule: minimum DP 50%; preserve pricing rows and finance history.
-- Deliberately not a supabase/migrations or pending/ auto-deploy file.
-- Database target is selected and verified by the connector before applying.
DO $staging_dp$
DECLARE
  affected integer;
BEGIN
  IF to_regprocedure('public.get_booking_quote_minimum_dp()') IS NULL
     OR to_regclass('public.reservation_offers') IS NULL
  THEN
    RAISE EXCEPTION 'Offer/Quote staging prerequisites missing; DP adjustment withheld.';
  END IF;
  UPDATE public.finance_settings
     SET minimum_dp_value = 50
   WHERE id = true
     AND minimum_dp_mode = 'PERCENTAGE'
     AND minimum_dp_value = 40;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'Unexpected finance_settings baseline/rowcount (expected exactly one 40 percent row); DP unchanged.';
  END IF;
END
$staging_dp$;
