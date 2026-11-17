-- PENDING explicit Owner approval; fixture-tested only. Never auto-apply.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $pre$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.create_finance_refund(uuid,uuid,numeric,text,text,uuid,text)'::regprocedure) NOT IN ('695152a80fcd4e561759f34b27652c5a','80bcdeabfc038907ee6dcea4d9d0e714') THEN RAISE EXCEPTION 'Refund RPC drift'; END IF; END $pre$;
CREATE OR REPLACE FUNCTION public.create_finance_refund(_idempotency_key uuid, _transaction_id uuid, _amount numeric, _refund_method text, _source_type text, _source_session_id uuid, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  refund_id uuid;
  existing_refund record;
  paid_total numeric;
  refunded_total numeric;
  remaining numeric;
  payment_row record;
  allocation numeric;
  original_commission numeric;
  adjusted_commission numeric;
  total_adjustment numeric := 0;
  transaction_total numeric;
  transaction_row public.transactions;
  source_available numeric;
  commission_mode_value text;
  commission_rate_value numeric := 0;
  commission_before numeric := 0;
  commission_after numeric := 0;
  first_allocation boolean := true;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN RAISE EXCEPTION 'Hanya Owner yang dapat melakukan refund'; END IF;
  SELECT * INTO existing_refund FROM public.finance_refunds WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF existing_refund.transaction_id IS DISTINCT FROM _transaction_id
       OR existing_refund.amount IS DISTINCT FROM _amount
       OR existing_refund.refund_method IS DISTINCT FROM _refund_method
       OR existing_refund.source_type IS DISTINCT FROM _source_type
       OR existing_refund.source_session_id IS DISTINCT FROM _source_session_id
       OR existing_refund.reason IS DISTINCT FROM trim(_reason) THEN
      RAISE EXCEPTION 'Idempotency refund payload berbeda';
    END IF;
    RETURN existing_refund.id;
  END IF;
  IF _amount <= 0 OR _refund_method NOT IN ('CASH', 'QRIS', 'Transfer') OR _source_type NOT IN ('SHIFT_CASH', 'DRAWER', 'OWNER_FUNDS') OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'Data refund tidak valid'; END IF;
  IF _source_type = 'OWNER_FUNDS' AND _source_session_id IS NOT NULL THEN
    RAISE EXCEPTION 'Dana Owner tidak boleh membawa source_session_id';
  END IF;
  IF _source_type IN ('SHIFT_CASH', 'DRAWER') AND _source_session_id IS NULL THEN
    RAISE EXCEPTION 'Sumber kas refund wajib memilih sesi';
  END IF;
  IF _source_session_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.finance_cash_sessions s
       WHERE s.id = _source_session_id
         AND s.status IN ('OPEN', 'FINAL')
     ) THEN
    RAISE EXCEPTION 'Sesi sumber refund tidak valid';
  END IF;
  IF _source_type = 'DRAWER'
     AND NOT EXISTS (
       SELECT 1
       FROM public.finance_drawer_handoffs h
       WHERE h.source_session_id = _source_session_id
         AND h.status = 'SELESAI'
     ) THEN
    RAISE EXCEPTION 'Sumber laci belum memiliki serah terima yang selesai';
  END IF;

  SELECT *
  INTO transaction_row
  FROM public.transactions t
  WHERE t.id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi refund tidak ditemukan';
  END IF;

  SELECT * INTO existing_refund FROM public.finance_refunds WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF existing_refund.transaction_id IS DISTINCT FROM _transaction_id
       OR existing_refund.amount IS DISTINCT FROM _amount
       OR existing_refund.refund_method IS DISTINCT FROM _refund_method
       OR existing_refund.source_type IS DISTINCT FROM _source_type
       OR existing_refund.source_session_id IS DISTINCT FROM _source_session_id
       OR existing_refund.reason IS DISTINCT FROM trim(_reason) THEN
      RAISE EXCEPTION 'Idempotency refund payload berbeda';
    END IF;
    RETURN existing_refund.id;
  END IF;

  transaction_total := transaction_row.price_snapshot;

  IF _source_session_id IS NOT NULL THEN
    PERFORM 1
    FROM public.finance_cash_sessions s
    WHERE s.id = _source_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sesi sumber refund tidak ditemukan';
    END IF;
  END IF;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO paid_total
  FROM public.payments p
  WHERE p.transaction_id = _transaction_id;

  IF _source_type = 'SHIFT_CASH' THEN
    SELECT s.opening_cash
      + COALESCE((SELECT SUM(p.amount) FROM public.payments p WHERE p.cash_session_id = s.id AND p.method = 'Cash'), 0)
      - COALESCE((SELECT SUM(e.amount) FROM public.finance_expenses e WHERE e.session_id = s.id AND e.method = 'CASH'), 0)
      - COALESCE((SELECT SUM(r.amount) FROM public.finance_refunds r WHERE r.source_session_id = s.id AND r.refund_method = 'CASH'), 0)
    INTO source_available
    FROM public.finance_cash_sessions s
    WHERE s.id = _source_session_id;

    IF _amount > COALESCE(source_available, 0) THEN
      RAISE EXCEPTION 'Saldo kas sumber tidak mencukupi untuk refund';
    END IF;
  ELSIF _source_type = 'DRAWER' THEN
    SELECT COALESCE(SUM(h.actual_amount), 0)
      - COALESCE((SELECT SUM(r.amount) FROM public.finance_refunds r WHERE r.source_session_id = _source_session_id AND r.refund_method = 'CASH'), 0)
    INTO source_available
    FROM public.finance_drawer_handoffs h
    WHERE h.source_session_id = _source_session_id
      AND h.status = 'SELESAI';

    IF _amount > COALESCE(source_available, 0) THEN
      RAISE EXCEPTION 'Saldo laci sumber tidak mencukupi untuk refund';
    END IF;
  END IF;

  SELECT COALESCE(SUM(r.amount), 0) INTO refunded_total FROM public.finance_refunds r WHERE r.transaction_id = _transaction_id;
  IF _amount > paid_total - refunded_total THEN RAISE EXCEPTION 'Nominal refund melebihi penerimaan yang sah'; END IF;

  commission_mode_value := COALESCE(transaction_row.commission_mode_snapshot, 'OFF');
  commission_rate_value := COALESCE(transaction_row.commission_rate_snapshot, 0);

  IF transaction_row.commission_mode_snapshot IS NULL THEN
    SELECT COALESCE(p.commission_mode, 'OFF'), COALESCE(p.commission_rate, 0)
    INTO commission_mode_value, commission_rate_value
    FROM public.payments p
    WHERE p.transaction_id = _transaction_id
    ORDER BY p.created_at, p.id
    LIMIT 1;
  END IF;

  IF commission_mode_value = 'PERCENTAGE' THEN
    commission_before := floor(((paid_total - refunded_total) * commission_rate_value / 100) / 1000) * 1000;
    commission_after := floor(((paid_total - refunded_total - _amount) * commission_rate_value / 100) / 1000) * 1000;
    total_adjustment := commission_after - commission_before;
  ELSIF commission_mode_value = 'PER_ROOM'
    AND _amount + refunded_total >= paid_total THEN
    SELECT COALESCE(SUM(p.commission_amount), 0)
    INTO commission_before
    FROM public.payments p
    WHERE p.transaction_id = _transaction_id;
    commission_after := 0;
    total_adjustment := commission_after - commission_before;
  END IF;

  INSERT INTO public.finance_refunds (idempotency_key, transaction_id, amount, refund_method, source_type, source_session_id, reason, original_payment_total, created_by)
  VALUES (_idempotency_key, _transaction_id, _amount, _refund_method, _source_type, _source_session_id, trim(_reason), paid_total, auth.uid())
  RETURNING id INTO refund_id;

  UPDATE public.finance_refunds
  SET commission_adjustment = total_adjustment
  WHERE id = refund_id;

  remaining := _amount;
  FOR payment_row IN
    SELECT p.*,
      COALESCE((SELECT SUM(a.refunded_amount) FROM public.finance_refund_allocations a WHERE a.payment_id = p.id), 0) AS already_refunded
    FROM public.payments p
    WHERE p.transaction_id = _transaction_id
    ORDER BY p.created_at, p.id
  LOOP
    EXIT WHEN remaining <= 0;
    allocation := LEAST(remaining, payment_row.amount - payment_row.already_refunded);
    CONTINUE WHEN allocation <= 0;

    IF first_allocation THEN
      original_commission := commission_before;
      adjusted_commission := commission_after;
      first_allocation := false;
    ELSE
      original_commission := 0;
      adjusted_commission := 0;
    END IF;

    INSERT INTO public.finance_refund_allocations (refund_id, payment_id, refunded_amount, original_commission, adjusted_commission, commission_delta)
    VALUES (refund_id, payment_row.id, allocation, original_commission, adjusted_commission, adjusted_commission - original_commission);
    remaining := remaining - allocation;
  END LOOP;
  IF remaining > 0 THEN RAISE EXCEPTION 'Alokasi refund tidak lengkap'; END IF;
  RETURN refund_id;
END;
$function$;
DO $post$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.create_finance_refund(uuid,uuid,numeric,text,text,uuid,text)'::regprocedure) IS DISTINCT FROM '80bcdeabfc038907ee6dcea4d9d0e714' THEN RAISE EXCEPTION 'Refund RPC postcheck failed'; END IF; END $post$;
COMMIT;
