-- REVIEW ONLY. Not applied. Kept outside automatic migrations until Owner approves execution.
BEGIN;

CREATE FUNCTION public.read_payment_confirmation_refunds(_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  transaction_data jsonb;
  payment_rows jsonb;
  payment_canonical text;
  refund_rows jsonb;
  payload jsonb;
BEGIN
  IF actor IS NULL OR _transaction_id IS NULL THEN
    RAISE EXCEPTION 'Payment Confirmation access denied' USING ERRCODE = '42501';
  END IF;
  -- Training is orthogonal to the base position: even a valid assisted context is DENY.
  IF public.finance_training_is_restricted(actor)
     OR NOT (public.has_role(actor, 'owner'::public.app_role)
       OR public.has_employee_position(actor, ARRAY['supervisor','receptionist']::public.employee_position[])) THEN
    RAISE EXCEPTION 'Payment Confirmation access denied' USING ERRCODE = '42501';
  END IF;

  -- Explicitly mirror existing transactions_read + transactions_supervisor_read.
  -- SECURITY DEFINER does NOT implicitly enforce caller RLS. No creator/shift restriction.
  SELECT pg_catalog.to_jsonb(t) INTO transaction_data
  FROM public.transactions t
  WHERE t.id = _transaction_id AND (
    public.has_role(actor, 'owner'::public.app_role)
    OR public.is_receptionist(actor)
    OR public.has_employee_position(actor, ARRAY['supervisor']::public.employee_position[])
  );
  IF transaction_data IS NULL THEN
    RAISE EXCEPTION 'Payment Confirmation access denied' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', p.id, 'transaction_id', p.transaction_id, 'amount', p.amount,
    'created_at', p.created_at, 'kind', p.kind, 'method', p.method)
    ORDER BY p.created_at, p.id), '[]'::jsonb),
    '[' || COALESCE(pg_catalog.string_agg(pg_catalog.array_to_json(ARRAY[
      p.id::text, p.transaction_id::text, ((p.amount * 100)::bigint)::text,
      pg_catalog.to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      p.kind::text, p.method::text])::text, ',' ORDER BY p.created_at, p.id), '') || ']'
  INTO payment_rows, payment_canonical FROM public.payments p WHERE p.transaction_id = _transaction_id;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', r.id, 'transaction_id', r.transaction_id, 'amount', r.amount,
    'created_at', r.created_at, 'refund_method', r.refund_method)
    ORDER BY r.created_at, r.id), '[]'::jsonb)
  INTO refund_rows FROM public.finance_refunds r WHERE r.transaction_id = _transaction_id;

  -- JSON envelope is one result: PostgREST row limits cannot silently page away refunds.
  -- Oversized results fail instead of returning an incomplete ledger.
  IF pg_catalog.jsonb_array_length(refund_rows) > 10000
     OR pg_catalog.jsonb_array_length(payment_rows) > 10000 THEN
    RAISE EXCEPTION 'Payment Confirmation ledger exceeds supported size' USING ERRCODE = '54000';
  END IF;
  payload := pg_catalog.jsonb_build_object(
    'schema_version', 1, 'transaction_id', _transaction_id, 'actor_id', actor,
    'complete', true, 'refund_count', pg_catalog.jsonb_array_length(refund_rows),
    'refunds', refund_rows,
    'payment_count', pg_catalog.jsonb_array_length(payment_rows),
    'payment_digest', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(payment_canonical, 'UTF8')), 'hex'),
    -- Equality token only, not an authorization credential or an atomic export promise.
    'ledger_revision', pg_catalog.md5(pg_catalog.jsonb_build_object(
      'transaction', transaction_data, 'payments', payment_rows, 'refunds', refund_rows)::text)
  );
  IF pg_catalog.octet_length(payload::text) > 8388608 THEN
    RAISE EXCEPTION 'Payment Confirmation ledger exceeds supported size' USING ERRCODE = '54000';
  END IF;
  RETURN payload;
END;
$function$;

-- Same trusted owner as existing finance RPCs; privileged reads are confined above.
-- No table privileges, RLS policies, writes or service-role client credentials added.
ALTER FUNCTION public.read_payment_confirmation_refunds(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.read_payment_confirmation_refunds(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_payment_confirmation_refunds(uuid) TO authenticated;
COMMENT ON FUNCTION public.read_payment_confirmation_refunds(uuid) IS
  'Read-only complete refund projection for one operationally authorized transaction; restricted Training denied.';

COMMIT;
