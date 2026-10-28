-- Extra Guest / Receipt activation hardening.
--
-- This forward-only patch does not backfill or rewrite historical amounts.
-- It closes the PUBLIC EXECUTE gap left by the older Training wrappers and
-- refuses activation while legacy Booking/Payment signatures remain active.

BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.transactions') IS NULL
     OR to_regclass('public.finance_reservation_idempotency') IS NULL
     OR to_regclass('public.receipt_template_versions') IS NULL
     OR to_regclass('public.payment_receipts') IS NULL
     OR to_regclass('public.receipt_print_requests') IS NULL THEN
    RAISE EXCEPTION 'Extra Guest/Receipt hardening dependencies are incomplete';
  END IF;

  IF to_regprocedure('public.finance_is_booking_operator(uuid)') IS NULL
     OR to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid)') IS NULL
     OR to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)') IS NULL
     OR to_regprocedure('public.create_training_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid)') IS NULL
     OR to_regprocedure('public.create_training_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)') IS NULL
     OR to_regprocedure('public.record_transaction_payment(uuid,numeric,text,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Expected Booking/Finance RPC contract is incomplete';
  END IF;

  IF to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz)') IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy 10-parameter create_reservation remains active; reconcile it before activation';
  END IF;

  IF to_regprocedure('public.record_transaction_payment(uuid,numeric,text)') IS NOT NULL
     OR to_regprocedure('public.record_transaction_payment(uuid,numeric,text,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy payment RPC signature remains active; reconcile it before activation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.transactions
    WHERE price_snapshot IS NULL
  ) THEN
    RAISE EXCEPTION 'Historical transaction price_snapshot cannot be NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.transactions
    WHERE base_price_snapshot IS NOT NULL
      AND price_snapshot <> base_price_snapshot + extra_guest_charge
  ) THEN
    RAISE EXCEPTION 'Extra Guest snapshot does not reconcile with price_snapshot';
  END IF;
END
$preflight$;

-- Training API wrappers must never be callable through PUBLIC/anon.
REVOKE ALL ON FUNCTION public.get_finance_training_context() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_finance_training_assignment(uuid, uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_finance_training_assignment(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_training_reservation(text, uuid, uuid, text, text, text, numeric, text, text, timestamptz, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_training_reservation(text, uuid, uuid, text, text, text, numeric, text, text, timestamptz, uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_training_transaction_payment(uuid, numeric, text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_in_training_booking(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_out_training_transaction(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_training_finance_expense(uuid, uuid, numeric, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_training_finance_deposit(uuid, uuid, text, numeric, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_training_finance_session_summary(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_finance_training_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_finance_training_assignment(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_finance_training_assignment(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_training_reservation(text, uuid, uuid, text, text, text, numeric, text, text, timestamptz, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_training_reservation(text, uuid, uuid, text, text, text, numeric, text, text, timestamptz, uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_training_transaction_payment(uuid, numeric, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_training_booking(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_out_training_transaction(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_training_finance_expense(uuid, uuid, numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_training_finance_deposit(uuid, uuid, text, numeric, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_training_finance_session_summary(uuid) TO authenticated;

-- Receipt tables are API-readable but never directly mutable by application roles.
REVOKE INSERT, UPDATE, DELETE
ON public.receipt_template_versions, public.payment_receipts, public.receipt_print_requests
FROM PUBLIC, anon, authenticated;
GRANT SELECT
ON public.receipt_template_versions, public.payment_receipts, public.receipt_print_requests
TO authenticated;

DO $postcheck$
BEGIN
  IF has_function_privilege(
       'anon',
       'public.create_training_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid)'::regprocedure,
       'EXECUTE'
     )
     OR has_function_privilege(
       'anon',
       'public.create_training_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)'::regprocedure,
       'EXECUTE'
     )
     OR has_function_privilege(
       'anon',
       'public.record_training_transaction_payment(uuid,numeric,text,uuid,uuid)'::regprocedure,
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Training API still executable by anon/PUBLIC';
  END IF;

  IF NOT has_function_privilege(
       'authenticated',
       'public.create_training_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)'::regprocedure,
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Authenticated Extra Guest Training RPC grant missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('receipt_template_versions', 'payment_receipts', 'receipt_print_requests')
    GROUP BY c.oid
    HAVING bool_and(c.relrowsecurity)
  ) THEN
    RAISE EXCEPTION 'Receipt RLS is not enabled on every receipt table';
  END IF;
END
$postcheck$;

COMMIT;
