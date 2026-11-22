-- Baturaden 25 Homestay: emergency rollback for Issue #114.
-- REVIEWED FUNCTION ONLY. Requires coordinated rollback of frontend code,
-- explicit operator window and a fresh snapshot/check of new Closing activity.
-- DO NOT DROP finance_closing_count_audit or overwrite FINAL history.
-- Baseline fingerprint: 3371f1c4852304c0e507fea062f14faf
BEGIN;
CREATE OR REPLACE FUNCTION public.close_finance_cash_session(_session_id uuid, _allocation jsonb, _reason text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    RAISE EXCEPTION 'Akses ditolak: identitas operator wajib';
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

  -- Saldo kas negatif adalah defisit sesi (bukan uang tunai fisik).
  -- Simpan expected_cash negatif di closing_snapshot; jangan membuat
  -- alokasi negatif atau catatan talangan pribadi terpisah.
  -- Nilai alokasi fisik harus nol saat expected_cash <= 0.
  IF expected_cash < 0 THEN
    IF total_allocated <> 0 THEN
      RAISE EXCEPTION 'Saldo kas minus: alokasi CASH harus nol';
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
COMMIT;
