-- SOURCE-ONLY RECONCILIATION CANDIDATE. PENDING REVIEW; NOT A CLOUD RUNBOOK.
-- Owner Issue2/6869144520: Cloud already implements the two rules and columns.
-- Reuse PR36 3a8dd60e8337a9fb2f222fbdd81e6fba36e26245 payment function + four column definitions/constraints.
-- New code is only negative-cash allocation and an explicit NULL actor denial.
-- Stop on ANY non-main/partially applied state; never overwrite corrected Cloud.
BEGIN;
DO $source_only_preflight$
BEGIN
 IF current_user<>pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.payments'::regclass))
 OR current_user<>pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.finance_cash_sessions'::regclass)) THEN
  RAISE EXCEPTION 'Trusted SQL object owner required';
 END IF;
 IF (SELECT md5(replace(prosrc,chr(13),'')) FROM pg_proc WHERE oid='public.finance_prepare_payment()'::regprocedure) IS DISTINCT FROM '418ce75230c91df0c8510334f888caff'
 OR (SELECT md5(replace(prosrc,chr(13),'')) FROM pg_proc WHERE oid='public.close_finance_cash_session(uuid,jsonb,text)'::regprocedure) IS DISTINCT FROM 'b5c3f521b18e2b8a178b3f0d7d21b445'
 OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions'
  AND column_name IN ('guest_count','extra_guest_count','extra_guest_unit_price','extra_guest_charge')) THEN
  RAISE EXCEPTION 'Not the locked main replay state; already corrected/partial/Cloud state requires review, DO NOT APPLY';
 END IF;
END;
$source_only_preflight$;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS guest_count integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS extra_guest_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_guest_unit_price numeric(12,2) NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS extra_guest_charge numeric(12,2) NOT NULL DEFAULT 0;
DO $transaction_extra_guest_constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.transactions'::regclass AND conname='transactions_guest_count_valid') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_guest_count_valid CHECK (guest_count >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.transactions'::regclass AND conname='transactions_extra_guest_count_valid') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_extra_guest_count_valid CHECK (extra_guest_count = GREATEST(guest_count - 2, 0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.transactions'::regclass AND conname='transactions_extra_guest_charge_valid') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_extra_guest_charge_valid CHECK (extra_guest_unit_price >= 0 AND extra_guest_charge = extra_guest_count * extra_guest_unit_price);
  END IF;
END
$transaction_extra_guest_constraints$;

CREATE OR REPLACE FUNCTION public.finance_prepare_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_session public.finance_cash_sessions;
  selected_transaction public.transactions;
  selected_charge public.finance_charge_events;
  config record;
  payment_count integer;
  paid_before numeric;
  commission_before numeric;
  target_commission numeric;
BEGIN
  IF NEW.idempotency_key IS NULL THEN
    NEW.idempotency_key := gen_random_uuid();
  END IF;

  SELECT * INTO selected_transaction
  FROM public.transactions t
  WHERE t.id = NEW.transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi pembayaran tidak ditemukan';
  END IF;

  IF NEW.cash_session_id IS NULL THEN
    SELECT * INTO selected_session
    FROM public.finance_cash_sessions s
    WHERE s.opened_by = NEW.recorded_by
      AND s.status = 'OPEN'
    ORDER BY s.opened_at DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT * INTO selected_session
    FROM public.finance_cash_sessions s
    WHERE s.id = NEW.cash_session_id
    FOR UPDATE;
  END IF;

  IF NOT FOUND OR selected_session.status <> 'OPEN' THEN
    RAISE EXCEPTION 'Sesi kas aktif penerima pembayaran tidak ditemukan';
  END IF;

  -- Preserve the approved Owner/Supervisor assisted-session path while
  -- allowing an assigned trainee only through a validated Training context.
  -- Restricted trainees must not inherit the Owner/Supervisor shortcut.
  IF selected_session.opened_by <> NEW.recorded_by
     AND NOT (
       NOT public.finance_training_is_restricted(NEW.recorded_by)
       AND public.finance_is_owner_or_supervisor(NEW.recorded_by)
     )
     AND NOT public.finance_training_context_matches_session(
       auth.uid(), selected_session.id
     ) THEN
    RAISE EXCEPTION 'Operator tidak berwenang membantu sesi kas ini';
  END IF;

  NEW.cash_session_id := selected_session.id;

  IF NEW.charge_event_id IS NOT NULL THEN
    SELECT * INTO selected_charge
    FROM public.finance_charge_events c
    WHERE c.id = NEW.charge_event_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Peristiwa Extend/Overtime tidak ditemukan';
    END IF;
    NEW.commission_mode := selected_charge.commission_mode;
    NEW.commission_rate := selected_charge.commission_rate;
    NEW.commission_per_room_amount := selected_charge.commission_per_room_amount;
    NEW.commission_rounding := selected_charge.commission_rounding;
    NEW.commission_recipient := CASE
      WHEN selected_charge.commission_mode = 'PERCENTAGE' THEN NEW.recorded_by
      WHEN selected_charge.commission_mode = 'PER_ROOM' THEN selected_charge.commission_recipient
      ELSE NULL
    END;
  ELSE
    IF selected_transaction.commission_mode_snapshot IS NULL THEN
      SELECT * INTO config
      FROM public.finance_commission_at(selected_transaction.created_at);
      IF config.mode IS NULL THEN
        config.mode := 'OFF';
        config.rate := 0;
        config.per_room_amount := 0;
        config.rounding_rule := 'FLOOR_RP1000';
      END IF;
      UPDATE public.transactions
      SET commission_mode_snapshot = config.mode,
          commission_rate_snapshot = config.rate,
          commission_per_room_amount_snapshot = config.per_room_amount,
          commission_rounding_snapshot = config.rounding_rule
      WHERE id = selected_transaction.id;
      selected_transaction.commission_mode_snapshot := config.mode;
      selected_transaction.commission_rate_snapshot := config.rate;
      selected_transaction.commission_per_room_amount_snapshot := config.per_room_amount;
      selected_transaction.commission_rounding_snapshot := config.rounding_rule;
    END IF;

    NEW.commission_mode := COALESCE(selected_transaction.commission_mode_snapshot, 'OFF');
    NEW.commission_rate := COALESCE(selected_transaction.commission_rate_snapshot, 0);
    NEW.commission_per_room_amount := COALESCE(selected_transaction.commission_per_room_amount_snapshot, 0);
    NEW.commission_rounding := COALESCE(selected_transaction.commission_rounding_snapshot, 'FLOOR_RP1000');
    NEW.commission_recipient := CASE
      WHEN NEW.commission_mode = 'PERCENTAGE' THEN NEW.recorded_by
      WHEN NEW.commission_mode = 'PER_ROOM'
        AND NOT EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.transaction_id = NEW.transaction_id
        )
        THEN selected_transaction.created_by
      ELSE NULL
    END;
  END IF;

  SELECT COUNT(*)::integer INTO payment_count
  FROM public.payments p
  WHERE p.transaction_id = NEW.transaction_id;

  SELECT COALESCE(SUM(p.amount), 0), COALESCE(SUM(p.commission_amount), 0)
  INTO paid_before, commission_before
  FROM public.payments p
  WHERE p.transaction_id = NEW.transaction_id;

  target_commission := floor(((paid_before + NEW.amount) * COALESCE(NEW.commission_rate, 0) / 100) / 1000) * 1000;
  NEW.commission_amount := CASE
    WHEN NEW.commission_mode = 'PERCENTAGE' THEN
      GREATEST(target_commission - commission_before, 0)
    WHEN NEW.commission_mode = 'PER_ROOM'
      AND NEW.commission_recipient IS NOT NULL
      AND (payment_count = 0 OR NEW.charge_event_id IS NOT NULL)
      THEN NEW.commission_per_room_amount
    ELSE 0
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_finance_cash_session(
  _session_id uuid,
  _allocation jsonb,
  _reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_session public.finance_cash_sessions;
  cash_received numeric;
  transfer_received numeric;
  cash_expenses numeric;
  cash_refunds numeric;
  expected_cash numeric;
  setor_cash numeric := COALESCE((_allocation->>'setor_cash')::numeric, 0);
  setor_transfer numeric := COALESCE((_allocation->>'setor_transfer')::numeric, 0);
  di_laci numeric := COALESCE((_allocation->>'di_laci')::numeric, 0);
  dibawa numeric := COALESCE((_allocation->>'dibawa')::numeric, 0);
  di_laci_allocation_id uuid;
  total_allocated numeric;
  snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO selected_session
  FROM public.finance_cash_sessions s
  WHERE s.id = _session_id
  FOR UPDATE;

  IF NOT FOUND OR selected_session.status <> 'OPEN' THEN
    RAISE EXCEPTION 'Sesi kas tidak aktif';
  END IF;

  IF selected_session.opened_by <> auth.uid()
     AND NOT public.finance_is_owner_or_supervisor(auth.uid()) THEN
    RAISE EXCEPTION 'Tidak berwenang menutup sesi kas ini';
  END IF;

  IF selected_session.opened_by <> auth.uid()
     AND length(trim(coalesce(_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Alasan closing khusus wajib diisi';
  END IF;

  IF setor_cash < 0 OR setor_transfer < 0 OR di_laci < 0 OR dibawa < 0 THEN
    RAISE EXCEPTION 'Nominal alokasi closing tidak boleh negatif';
  END IF;

  SELECT COALESCE(SUM(p.amount), 0) INTO cash_received
  FROM public.payments p
  WHERE p.cash_session_id = _session_id AND p.method = 'Cash';

  SELECT COALESCE(SUM(p.amount), 0) INTO transfer_received
  FROM public.payments p
  WHERE p.cash_session_id = _session_id AND p.method = 'Transfer';

  SELECT COALESCE(SUM(e.amount), 0) INTO cash_expenses
  FROM public.finance_expenses e
  WHERE e.session_id = _session_id AND e.method = 'CASH';

  SELECT COALESCE(SUM(r.amount), 0) INTO cash_refunds
  FROM public.finance_refunds r
  WHERE r.source_session_id = _session_id AND r.refund_method = 'CASH';

  expected_cash := selected_session.opening_cash + cash_received
    - cash_expenses - cash_refunds;
  total_allocated := setor_cash + di_laci + dibawa;

  IF expected_cash < 0 THEN
    IF total_allocated <> 0 THEN
      RAISE EXCEPTION 'Saldo kas minus wajib memakai alokasi kas fisik nol';
    END IF;
  ELSIF expected_cash <> total_allocated THEN
    RAISE EXCEPTION 'Alokasi kas tidak sama dengan saldo fisik yang diharapkan';
  END IF;

  IF setor_transfer <> transfer_received THEN
    RAISE EXCEPTION 'Alokasi SETOR transfer harus sama dengan penerimaan transfer sesi';
  END IF;

  IF di_laci > 0 AND NULLIF(_allocation->>'recipient_user_id', '') IS NULL THEN
    RAISE EXCEPTION 'Penerima DI LACI wajib dicatat';
  END IF;

  IF setor_cash > 0 THEN
    INSERT INTO public.finance_session_allocations
      (session_id, allocation_type, method, amount, created_by)
    VALUES (_session_id, 'SETOR', 'CASH', setor_cash, auth.uid());
  END IF;

  IF setor_transfer > 0 THEN
    INSERT INTO public.finance_session_allocations
      (session_id, allocation_type, method, amount, created_by)
    VALUES (_session_id, 'SETOR', 'TRANSFER', setor_transfer, auth.uid());
  END IF;

  IF di_laci > 0 THEN
    INSERT INTO public.finance_session_allocations
      (session_id, allocation_type, method, amount, recipient_user_id, created_by)
    VALUES (_session_id, 'DI_LACI', 'CASH', di_laci,
      NULLIF(_allocation->>'recipient_user_id', '')::uuid, auth.uid())
    RETURNING id INTO di_laci_allocation_id;

    INSERT INTO public.finance_drawer_handoffs
      (allocation_id, source_session_id, recipient_user_id, expected_amount, created_by)
    VALUES (
      di_laci_allocation_id,
      _session_id,
      NULLIF(_allocation->>'recipient_user_id', '')::uuid,
      di_laci,
      auth.uid()
    );
  END IF;

  IF dibawa > 0 THEN
    INSERT INTO public.finance_session_allocations
      (session_id, allocation_type, method, amount, recipient_user_id, created_by)
    VALUES (_session_id, 'DIBAWA', 'CASH', dibawa, selected_session.opened_by, auth.uid());
  END IF;

  snapshot := jsonb_build_object(
    'opening_cash', selected_session.opening_cash,
    'cash_received', cash_received,
    'transfer_received', transfer_received,
    'cash_expenses', cash_expenses,
    'cash_refunds', cash_refunds,
    'expected_cash', expected_cash,
    'setor_cash', setor_cash,
    'setor_transfer', setor_transfer,
    'di_laci', di_laci,
    'dibawa', dibawa,
    'closed_by', auth.uid(),
    'closed_at', now()
  );

  UPDATE public.finance_cash_sessions
  SET status = 'FINAL',
      closed_at = now(),
      closed_by = auth.uid(),
      closing_reason = trim(coalesce(_reason, '')),
      closing_snapshot = snapshot
  WHERE id = _session_id;

  RETURN snapshot;
END;
$function$;
-- Retain authenticated access, deny anonymous execution as in audited Cloud.
REVOKE ALL ON FUNCTION public.close_finance_cash_session(uuid,jsonb,text) FROM PUBLIC,anon;
-- No sensitive helper or table grant is broadened.
COMMIT;
