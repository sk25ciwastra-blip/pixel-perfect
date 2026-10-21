-- Baturaden 25 Homestay — Finance post-install privilege hardening
-- REVIEW ONLY. Execute on Lovable only after explicit Owner approval for THIS script.
-- The six functions below were observed with effective anon EXECUTE after Finance install.
-- No DDL outside function privileges; no data writes; no deployment.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE ALL ON FUNCTION public.finance_booking_payment_guard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_commission_at(timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_final_session_guard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_prepare_payment() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_refund_source_session_guard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_snapshot_booking_dp() FROM PUBLIC, anon;

-- Preserve legitimate app and internal-function execution.
GRANT EXECUTE ON FUNCTION public.finance_booking_payment_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_commission_at(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_final_session_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_prepare_payment() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_refund_source_session_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_snapshot_booking_dp() TO authenticated;

DO $assert$
DECLARE
  v_proc oid;
BEGIN
  FOR v_proc IN
    SELECT oid FROM pg_proc WHERE oid IN (
      'public.finance_booking_payment_guard()'::regprocedure,
      'public.finance_commission_at(timestamptz)'::regprocedure,
      'public.finance_final_session_guard()'::regprocedure,
      'public.finance_prepare_payment()'::regprocedure,
      'public.finance_refund_source_session_guard()'::regprocedure,
      'public.finance_snapshot_booking_dp()'::regprocedure
    )
  LOOP
    IF has_function_privilege('anon',v_proc,'EXECUTE')
      OR has_function_privilege('PUBLIC',v_proc,'EXECUTE')
      OR NOT has_function_privilege('authenticated',v_proc,'EXECUTE') THEN
      RAISE EXCEPTION 'Finance helper function privilege hardening failed: %',v_proc::regprocedure;
    END IF;
  END LOOP;
END
$assert$;
COMMIT;
