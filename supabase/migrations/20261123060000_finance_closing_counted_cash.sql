-- Baturaden 25 Homestay No6 / Issue #114: reviewed Cloud baseline 2026-11-23.
-- Deployment must be coordinated with the new UI. Do not execute on
-- production until isolated PG tests, permissions and rollback are reviewed.
-- No data backfills; historical FINAL closing_snapshot unchanged.
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
  physical_cash_count numeric;
  cash_difference numeric;
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

  -- A Closing must contain a real operator-entered physical count, not a
  -- number inferred from allocations or the expected session balance.
  IF _allocation IS NULL OR jsonb_typeof(_allocation) <> 'object'
     OR NOT (_allocation ? 'physical_cash_count')
     OR jsonb_typeof(_allocation->'physical_cash_count') <> 'number' THEN
    RAISE EXCEPTION 'Hitung kas fisik wajib diisi sebelum Closing';
  END IF;
  physical_cash_count := (_allocation->>'physical_cash_count')::numeric;
  IF physical_cash_count < 0 OR physical_cash_count <> trunc(physical_cash_count) THEN
    RAISE EXCEPTION 'Hitung kas fisik wajib nominal rupiah bulat dan tidak negatif';
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
  cash_difference := physical_cash_count - expected_cash;
  IF cash_difference <> 0 AND length(trim(coalesce(_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Selisih uang fisik wajib disertai alasan Closing';
  END IF;

  -- Saldo kas negatif adalah defisit sesi (bukan uang tunai fisik).
  -- Simpan expected_cash negatif di closing_snapshot; jangan membuat
  -- alokasi negatif atau catatan talangan pribadi terpisah.
  -- Nilai alokasi fisik harus nol saat expected_cash <= 0.
  IF expected_cash < 0 THEN
    -- Deficit is retained in the expected_cash snapshot, never clamped.
    -- With a deficit, existing policy allocates zero physical cash.
    IF physical_cash_count <> 0 THEN
      RAISE EXCEPTION 'Saldo kas minus: hitung fisik harus nol sebelum Closing';
    END IF;
    IF total_allocated <> 0 THEN
      RAISE EXCEPTION 'Saldo kas minus: alokasi CASH harus nol';
    END IF;
  ELSIF physical_cash_count <> total_allocated THEN
    RAISE EXCEPTION 'Alokasi kas tidak sama dengan hasil hitung uang fisik';
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
    'physical_cash_count', physical_cash_count,
    'cash_difference', cash_difference,
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
$function$

COMMIT;
