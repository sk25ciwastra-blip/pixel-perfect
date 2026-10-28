-- RPC legacy transition.
--
-- Apply only after the SELECT-only caller preflight has been reviewed by the
-- Owner. This preserves function definitions and data; it only removes
-- application-role EXECUTE from legacy signatures.

BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid)') IS NULL
     OR to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)') IS NULL
     OR to_regprocedure('public.create_training_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid)') IS NULL
     OR to_regprocedure('public.create_training_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)') IS NULL
     OR to_regprocedure('public.record_transaction_payment(uuid,numeric,text,uuid,uuid)') IS NULL
     OR to_regprocedure('public.record_training_transaction_payment(uuid,numeric,text,uuid,uuid)') IS NULL
     OR to_regprocedure('public.get_finance_training_context()') IS NULL
     OR to_regprocedure('public.check_in_training_booking(uuid,uuid)') IS NULL
     OR to_regprocedure('public.check_out_training_transaction(uuid,uuid)') IS NULL
     OR to_regprocedure('public.get_training_finance_session_summary(uuid)') IS NULL THEN
    RAISE EXCEPTION 'New Booking/Payment/Training contract is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.transactions
    WHERE price_snapshot IS NULL
  ) THEN
    RAISE EXCEPTION 'Historical price_snapshot cannot be NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.transactions
    WHERE base_price_snapshot IS NOT NULL
      AND price_snapshot <> base_price_snapshot + extra_guest_charge
  ) THEN
    RAISE EXCEPTION 'Historical Extra Guest snapshot mismatch';
  END IF;
END
$preflight$;

-- Function definitions remain for rollback. Only application roles lose
-- execute access; postgres ownership is untouched.
DO $revoke_legacy$
DECLARE
  signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz)',
    'public.record_transaction_payment(uuid,numeric,text)',
    'public.record_transaction_payment(uuid,numeric,text,uuid)'
  ] LOOP
    IF to_regprocedure(signature) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
        signature
      );
    END IF;
  END LOOP;
END
$revoke_legacy$;

DO $postcheck$
BEGIN
  IF has_function_privilege(
       'authenticated',
       'public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz)'::regprocedure,
       'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated',
       'public.record_transaction_payment(uuid,numeric,text)'::regprocedure,
       'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated',
       'public.record_transaction_payment(uuid,numeric,text,uuid)'::regprocedure,
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Legacy RPC EXECUTE remains granted to authenticated';
  END IF;

  IF NOT has_function_privilege(
       'authenticated',
       'public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)'::regprocedure,
       'EXECUTE'
     )
     OR NOT has_function_privilege(
       'authenticated',
       'public.record_transaction_payment(uuid,numeric,text,uuid,uuid)'::regprocedure,
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'New RPC EXECUTE grant is missing';
  END IF;
END
$postcheck$;

COMMIT;
