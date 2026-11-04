\set ON_ERROR_STOP on
\echo 'COMBINED PAYMENT FINANCE RUNTIME TESTS — LOCAL ISOLATED PostgreSQL ONLY'

BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SET LOCAL request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

CREATE TEMP TABLE finance_test_results (
  id bigserial PRIMARY KEY,
  test_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('PASS', 'FAIL')),
  detail text NOT NULL
);

CREATE OR REPLACE FUNCTION pg_temp.record_finance_result(
  _test_name text,
  _status text,
  _detail text
)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO finance_test_results(test_name, status, detail)
  VALUES (_test_name, _status, _detail);
$$;

\echo 'TEST 1 — PERCENTAGE historical snapshot, combined rows, partial refund'
DO $$
DECLARE
  owner_id constant uuid := '11111111-1111-4111-8111-111111111111';
  session_id uuid;
  room_id uuid;
  package_id uuid;
  tx_id uuid;
  v_refund_id uuid;
  result jsonb;
  total numeric;
  first_amount numeric;
  second_amount numeric;
  expected_commission numeric;
  expected_after numeric;
  payment_count integer;
  payment_total numeric;
  commission_total numeric;
  refund_adjustment numeric;
  net_commission numeric;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
    SELECT id INTO session_id
    FROM public.finance_cash_sessions
    WHERE opened_by = owner_id AND status = 'OPEN'
    ORDER BY opened_at DESC
    LIMIT 1;
    IF session_id IS NULL THEN
      SELECT public.open_finance_cash_session(1) INTO session_id;
    END IF;

    PERFORM public.set_finance_commission_config('PERCENTAGE', 8, 0);
    SELECT r.id, p.id,
           CASE public.get_operational_day_mode((now() AT TIME ZONE 'Asia/Jakarta')::date)
             WHEN 'weekday' THEN pr.weekday_price ELSE pr.weekend_price END
    INTO room_id, package_id, total
    FROM public.rooms r
    JOIN public.room_types rt ON rt.id = r.room_type_id
    JOIN public.packages p ON p.name = 'Paket 24 Jam' AND p.active
    JOIN public.package_room_type_prices pr ON pr.package_id = p.id AND pr.pricing_group = rt.pricing_group
    WHERE r.room_number = '06' AND r.active;
    IF room_id IS NULL OR package_id IS NULL OR total IS NULL THEN
      RAISE EXCEPTION 'fixture room/package/price not found';
    END IF;
    first_amount := floor(total / 2);
    second_amount := total - first_amount;

    result := public.create_reservation_combined(
      'check_in', room_id, package_id, 'Finance Percentage Partial', '081111111101',
      'Alamat Finance Test',
      jsonb_build_array(
        jsonb_build_object('method', 'QRIS', 'amount', first_amount, 'idempotency_key', '10111111-1111-4111-8111-111111111111'::uuid),
        jsonb_build_object('method', 'Cash', 'amount', second_amount, 'idempotency_key', '10111111-1111-4111-8111-111111111112'::uuid)
      ),
      'weekday', NULL,
      '20111111-1111-4111-8111-111111111111'::uuid,
      'percentage-partial-v1', session_id, 2
    );
    tx_id := (result->>'transaction_id')::uuid;

    SELECT count(*), coalesce(sum(amount), 0), coalesce(sum(commission_amount), 0)
    INTO payment_count, payment_total, commission_total
    FROM public.payments WHERE transaction_id = tx_id;
    expected_commission := floor((total * 8 / 100) / 1000) * 1000;
    IF payment_count <> 2 OR payment_total <> total OR commission_total <> expected_commission THEN
      RAISE EXCEPTION 'combined percentage payment mismatch: count %, total %, commission %, expected %', payment_count, payment_total, commission_total, expected_commission;
    END IF;

    -- Change the current config after transaction creation; refund must use the transaction snapshot (8%).
    PERFORM public.set_finance_commission_config('PERCENTAGE', 20, 0);
    SELECT public.create_finance_refund(
      '10222222-2222-4222-8222-222222222222'::uuid, tx_id, 20000, 'CASH', 'OWNER_FUNDS', NULL,
      'Combined percentage partial refund'
    ) INTO v_refund_id;
    SELECT commission_adjustment INTO refund_adjustment
    FROM public.finance_refunds WHERE id = v_refund_id;
    expected_after := floor(((total - 20000) * 8 / 100) / 1000) * 1000;
    IF refund_adjustment <> expected_after - expected_commission THEN
      RAISE EXCEPTION 'percentage partial adjustment %, expected %', refund_adjustment, expected_after - expected_commission;
    END IF;
    SELECT coalesce((SELECT sum(p.commission_amount) FROM public.payments p WHERE p.transaction_id = tx_id), 0)
      + coalesce((SELECT sum(r.commission_adjustment) FROM public.finance_refunds r WHERE r.transaction_id = tx_id), 0)
    INTO net_commission;
    IF net_commission <> expected_after THEN
      RAISE EXCEPTION 'percentage net commission %, expected %', net_commission, expected_after;
    END IF;
    IF (SELECT count(*) FROM public.finance_refund_allocations a WHERE a.refund_id = v_refund_id) = 0
       OR (SELECT coalesce(sum(a.refunded_amount), 0) FROM public.finance_refund_allocations a WHERE a.refund_id = v_refund_id) <> 20000 THEN
      RAISE EXCEPTION 'partial refund allocation is not exact';
    END IF;

    PERFORM pg_temp.record_finance_result(
      'percentage historical + combined rows + partial refund', 'PASS',
      format('paid=%s; commission=%s; refund=20000; adjustment=%s; net_commission=%s', total, expected_commission, refund_adjustment, net_commission)
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record_finance_result('percentage historical + combined rows + partial refund', 'FAIL', SQLERRM);
  END;
END;
$$;

\echo 'TEST 2 — PERCENTAGE full refund reaches zero commission'
DO $$
DECLARE
  owner_id constant uuid := '11111111-1111-4111-8111-111111111111';
  session_id uuid;
  room_id uuid;
  package_id uuid;
  tx_id uuid;
  refund_id uuid;
  result jsonb;
  total numeric;
  first_amount numeric;
  second_amount numeric;
  initial_commission numeric;
  refund_adjustment numeric;
  net_commission numeric;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
    SELECT id INTO session_id FROM public.finance_cash_sessions WHERE opened_by = owner_id AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;
    IF session_id IS NULL THEN SELECT public.open_finance_cash_session(1) INTO session_id; END IF;
    PERFORM public.set_finance_commission_config('PERCENTAGE', 8, 0);
    SELECT r.id, p.id,
           CASE public.get_operational_day_mode((now() AT TIME ZONE 'Asia/Jakarta')::date)
             WHEN 'weekday' THEN pr.weekday_price ELSE pr.weekend_price END
    INTO room_id, package_id, total
    FROM public.rooms r
    JOIN public.room_types rt ON rt.id = r.room_type_id
    JOIN public.packages p ON p.name = 'Paket 24 Jam' AND p.active
    JOIN public.package_room_type_prices pr ON pr.package_id = p.id AND pr.pricing_group = rt.pricing_group
    WHERE r.room_number = '07' AND r.active;
    first_amount := floor(total / 2);
    second_amount := total - first_amount;
    result := public.create_reservation_combined(
      'check_in', room_id, package_id, 'Finance Percentage Full', '081111111102', 'Alamat Finance Test',
      jsonb_build_array(
        jsonb_build_object('method', 'QRIS', 'amount', first_amount, 'idempotency_key', '10333333-3333-4333-8333-333333333331'::uuid),
        jsonb_build_object('method', 'Cash', 'amount', second_amount, 'idempotency_key', '10333333-3333-4333-8333-333333333332'::uuid)
      ), 'weekday', NULL, '20333333-3333-4333-8333-333333333333'::uuid, 'percentage-full-v1', session_id, 2
    );
    tx_id := (result->>'transaction_id')::uuid;
    SELECT coalesce(sum(commission_amount), 0) INTO initial_commission FROM public.payments WHERE transaction_id = tx_id;
    SELECT public.create_finance_refund(
      '10444444-4444-4444-8444-444444444444'::uuid, tx_id, total, 'CASH', 'OWNER_FUNDS', NULL,
      'Combined percentage full refund'
    ) INTO refund_id;
    SELECT commission_adjustment INTO refund_adjustment FROM public.finance_refunds WHERE id = refund_id;
    SELECT coalesce((SELECT sum(p.commission_amount) FROM public.payments p WHERE p.transaction_id = tx_id), 0)
      + coalesce((SELECT sum(r.commission_adjustment) FROM public.finance_refunds r WHERE r.transaction_id = tx_id), 0)
    INTO net_commission;
    IF refund_adjustment <> -initial_commission OR net_commission <> 0
       OR (SELECT coalesce(sum(amount), 0) FROM public.finance_refunds WHERE transaction_id = tx_id) <> total THEN
      RAISE EXCEPTION 'percentage full refund mismatch: initial %, adjustment %, net %, total %', initial_commission, refund_adjustment, net_commission, total;
    END IF;
    PERFORM pg_temp.record_finance_result(
      'percentage full refund zeroes commission', 'PASS',
      format('paid=%s; initial_commission=%s; refund=%s; adjustment=%s; net_commission=0', total, initial_commission, total, refund_adjustment)
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record_finance_result('percentage full refund zeroes commission', 'FAIL', SQLERRM);
  END;
END;
$$;

\echo 'TEST 3 — PER_ROOM once, partial refund keeps it, full refund zeroes it'
DO $$
DECLARE
  owner_id constant uuid := '11111111-1111-4111-8111-111111111111';
  session_id uuid;
  room_id uuid;
  package_id uuid;
  tx_partial uuid;
  tx_full uuid;
  config_id uuid;
  refund_id uuid;
  result jsonb;
  total numeric;
  first_amount numeric;
  second_amount numeric;
  commission_total numeric;
  commission_rows integer;
  adjustment numeric;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
    SELECT id INTO session_id FROM public.finance_cash_sessions WHERE opened_by = owner_id AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;
    IF session_id IS NULL THEN SELECT public.open_finance_cash_session(1) INTO session_id; END IF;
    SELECT public.set_finance_commission_config('PER_ROOM', 0, 15000) INTO config_id;
    -- All assertions run in one rollback-only transaction. Normalize effective_from
    -- so the newly created historical config is ordered after same-transaction rows,
    -- matching separate production requests.
    UPDATE public.finance_commission_configs
    SET effective_from = now() - interval '2 microseconds'
    WHERE id <> config_id AND effective_from >= now() - interval '1 second';
    UPDATE public.finance_commission_configs
    SET effective_from = now() - interval '1 microsecond'
    WHERE id = config_id;
    SELECT r.id, p.id,
           CASE public.get_operational_day_mode((now() AT TIME ZONE 'Asia/Jakarta')::date)
             WHEN 'weekday' THEN pr.weekday_price ELSE pr.weekend_price END
    INTO room_id, package_id, total
    FROM public.rooms r
    JOIN public.room_types rt ON rt.id = r.room_type_id
    JOIN public.packages p ON p.name = 'Paket 24 Jam' AND p.active
    JOIN public.package_room_type_prices pr ON pr.package_id = p.id AND pr.pricing_group = rt.pricing_group
    WHERE r.room_number = '08' AND r.active;
    first_amount := floor(total / 2);
    second_amount := total - first_amount;
    result := public.create_reservation_combined(
      'check_in', room_id, package_id, 'Finance Per Room Partial', '081111111103', 'Alamat Finance Test',
      jsonb_build_array(
        jsonb_build_object('method', 'QRIS', 'amount', first_amount, 'idempotency_key', '10555555-5555-4555-8555-555555555551'::uuid),
        jsonb_build_object('method', 'Cash', 'amount', second_amount, 'idempotency_key', '10555555-5555-4555-8555-555555555552'::uuid)
      ), 'weekday', NULL, '20555555-5555-4555-8555-555555555555'::uuid, 'per-room-partial-v1', session_id, 2
    );
    tx_partial := (result->>'transaction_id')::uuid;
    SELECT coalesce(sum(commission_amount), 0), count(*) FILTER (WHERE commission_amount > 0)
    INTO commission_total, commission_rows FROM public.payments WHERE transaction_id = tx_partial;
    IF commission_total <> 15000 OR commission_rows <> 1 THEN
      RAISE EXCEPTION 'per-room commission duplicated or missing: total %, positive rows %', commission_total, commission_rows;
    END IF;
    SELECT public.create_finance_refund(
      '10666666-6666-4666-8666-666666666666'::uuid, tx_partial, 20000, 'CASH', 'OWNER_FUNDS', NULL,
      'Combined per-room partial refund'
    ) INTO refund_id;
    SELECT commission_adjustment INTO adjustment FROM public.finance_refunds WHERE id = refund_id;
    IF adjustment <> 0 OR (SELECT coalesce(sum(commission_amount), 0) FROM public.payments WHERE transaction_id = tx_partial) <> 15000 THEN
      RAISE EXCEPTION 'per-room partial refund changed commission: adjustment %, commission %', adjustment,
        (SELECT coalesce(sum(commission_amount), 0) FROM public.payments WHERE transaction_id = tx_partial);
    END IF;

    SELECT r.id, p.id,
           CASE public.get_operational_day_mode((now() AT TIME ZONE 'Asia/Jakarta')::date)
             WHEN 'weekday' THEN pr.weekday_price ELSE pr.weekend_price END
    INTO room_id, package_id, total
    FROM public.rooms r
    JOIN public.room_types rt ON rt.id = r.room_type_id
    JOIN public.packages p ON p.name = 'Paket 24 Jam' AND p.active
    JOIN public.package_room_type_prices pr ON pr.package_id = p.id AND pr.pricing_group = rt.pricing_group
    WHERE r.room_number = '09' AND r.active;
    first_amount := floor(total / 2);
    second_amount := total - first_amount;
    result := public.create_reservation_combined(
      'check_in', room_id, package_id, 'Finance Per Room Full', '081111111104', 'Alamat Finance Test',
      jsonb_build_array(
        jsonb_build_object('method', 'QRIS', 'amount', first_amount, 'idempotency_key', '10777777-7777-4777-8777-777777777771'::uuid),
        jsonb_build_object('method', 'Cash', 'amount', second_amount, 'idempotency_key', '10777777-7777-4777-8777-777777777772'::uuid)
      ), 'weekday', NULL, '20777777-7777-4777-8777-777777777777'::uuid, 'per-room-full-v1', session_id, 2
    );
    tx_full := (result->>'transaction_id')::uuid;
    SELECT public.create_finance_refund(
      '10888888-8888-4888-8888-888888888888'::uuid, tx_full, total, 'CASH', 'OWNER_FUNDS', NULL,
      'Combined per-room full refund'
    ) INTO refund_id;
    SELECT commission_adjustment INTO adjustment FROM public.finance_refunds WHERE id = refund_id;
    IF adjustment <> -15000
       OR (SELECT coalesce(sum(commission_amount), 0) FROM public.payments WHERE transaction_id = tx_full)
          + (SELECT coalesce(sum(commission_adjustment), 0) FROM public.finance_refunds WHERE transaction_id = tx_full) <> 0 THEN
      RAISE EXCEPTION 'per-room full refund mismatch: adjustment %, net commission %', adjustment,
        (SELECT coalesce(sum(commission_amount), 0) FROM public.payments WHERE transaction_id = tx_full)
        + (SELECT coalesce(sum(commission_adjustment), 0) FROM public.finance_refunds WHERE transaction_id = tx_full);
    END IF;
    PERFORM pg_temp.record_finance_result(
      'per-room one-time commission + partial/full refunds', 'PASS',
      'two payment rows; initial=15000 once; partial adjustment=0; full adjustment=-15000; full net=0'
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record_finance_result('per-room one-time commission + partial/full refunds', 'FAIL', SQLERRM);
  END;
END;
$$;

\echo 'TEST 4 — Cash/QRIS reconciliation, dual identity, final-session refund, valid funds'
DO $$
DECLARE
  owner_id constant uuid := '11111111-1111-4111-8111-111111111111';
  receptionist_id constant uuid := '22222222-2222-4222-8222-222222222222';
  session_id uuid;
  room_id uuid;
  package_id uuid;
  tx_id uuid;
  refund_id uuid;
  result jsonb;
  summary jsonb;
  snapshot_before jsonb;
  snapshot_after jsonb;
  total numeric;
  cash_amount numeric;
  qris_amount numeric;
  owner_payment_count integer;
  rejected boolean := false;
BEGIN
  BEGIN
    -- The real session owner is Receptionist A; the real operator is Owner.
    PERFORM set_config('request.jwt.claim.sub', receptionist_id::text, true);
    SELECT id INTO session_id FROM public.finance_cash_sessions WHERE opened_by = receptionist_id AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;
    IF session_id IS NULL THEN
      SELECT public.open_finance_cash_session(12345) INTO session_id;
    END IF;
    PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
    SELECT r.id, p.id,
           CASE public.get_operational_day_mode((now() AT TIME ZONE 'Asia/Jakarta')::date)
             WHEN 'weekday' THEN pr.weekday_price ELSE pr.weekend_price END
    INTO room_id, package_id, total
    FROM public.rooms r
    JOIN public.room_types rt ON rt.id = r.room_type_id
    JOIN public.packages p ON p.name = 'Paket 24 Jam' AND p.active
    JOIN public.package_room_type_prices pr ON pr.package_id = p.id AND pr.pricing_group = rt.pricing_group
    WHERE r.room_number = '10' AND r.active;
    cash_amount := floor(total / 2);
    qris_amount := total - cash_amount;
    result := public.create_reservation_combined(
      'check_in', room_id, package_id, 'Finance Session Reconciliation', '081111111105', 'Alamat Finance Test',
      jsonb_build_array(
        jsonb_build_object('method', 'Cash', 'amount', cash_amount, 'idempotency_key', '10999999-9999-4999-8999-999999999991'::uuid),
        jsonb_build_object('method', 'QRIS', 'amount', qris_amount, 'idempotency_key', '10999999-9999-4999-8999-999999999992'::uuid)
      ), 'weekday', NULL, '20999999-9999-4999-8999-999999999999'::uuid, 'session-reconciliation-v1', session_id, 2
    );
    tx_id := (result->>'transaction_id')::uuid;
    SELECT count(*) INTO owner_payment_count FROM public.payments WHERE transaction_id = tx_id AND recorded_by = owner_id;
    IF owner_payment_count <> 2 OR (SELECT count(*) FROM public.payments WHERE transaction_id = tx_id AND cash_session_id = session_id) <> 2 THEN
      RAISE EXCEPTION 'dual identity payment/session linkage mismatch';
    END IF;
    IF (SELECT opened_by FROM public.finance_cash_sessions WHERE id = session_id) <> receptionist_id THEN
      RAISE EXCEPTION 'session owner was not preserved';
    END IF;

    summary := public.get_finance_session_summary(session_id);
    IF (summary->>'payments_total')::numeric <> total
       OR (summary->>'cash')::numeric <> cash_amount
       OR (summary->>'qris')::numeric <> qris_amount
       OR (summary->>'transfer')::numeric <> 0 THEN
      RAISE EXCEPTION 'method reconciliation mismatch: %', summary;
    END IF;

    PERFORM public.close_finance_cash_session(
      session_id,
      jsonb_build_object('setor_cash', 12345 + cash_amount, 'setor_transfer', 0, 'di_laci', 0, 'dibawa', 0),
      'Owner membantu closing sesi Receptionist'
    );
    SELECT closing_snapshot INTO snapshot_before FROM public.finance_cash_sessions WHERE id = session_id;
    IF (SELECT status FROM public.finance_cash_sessions WHERE id = session_id) <> 'FINAL'
       OR (snapshot_before->>'expected_cash')::numeric <> 12345 + cash_amount
       OR (snapshot_before->>'cash_received')::numeric <> cash_amount
       OR (snapshot_before->>'transfer_received')::numeric <> 0 THEN
      RAISE EXCEPTION 'closing snapshot mismatch: %', snapshot_before;
    END IF;

    -- A transaction whose payments belong to FINAL may be refunded from OWNER_FUNDS.
    SELECT public.create_finance_refund(
      '11000000-0000-4000-8000-000000000000'::uuid, tx_id, total, 'CASH', 'OWNER_FUNDS', NULL,
      'Final-session transaction owner-funds refund'
    ) INTO refund_id;
    SELECT closing_snapshot INTO snapshot_after FROM public.finance_cash_sessions WHERE id = session_id;
    IF snapshot_after <> snapshot_before
       OR (SELECT source_session_id FROM public.finance_refunds WHERE id = refund_id) IS NOT NULL THEN
      RAISE EXCEPTION 'final closing snapshot changed or refund used an invalid owner-funds source';
    END IF;

    -- Invalid source combinations must be rejected and must not create refunds.
    BEGIN
      PERFORM public.create_finance_refund(
        '11000000-0000-4000-8000-000000000001'::uuid, tx_id, 1, 'CASH', 'SHIFT_CASH', NULL,
        'Invalid missing source session'
      );
    EXCEPTION WHEN OTHERS THEN
      rejected := true;
    END;
    IF NOT rejected OR EXISTS (SELECT 1 FROM public.finance_refunds WHERE idempotency_key = '11000000-0000-4000-8000-000000000001'::uuid) THEN
      RAISE EXCEPTION 'invalid SHIFT_CASH source was accepted';
    END IF;

    PERFORM pg_temp.record_finance_result(
      'cash/qris split + dual identity + final snapshot + valid funds', 'PASS',
      format('session_owner=%s; operator=%s; cash=%s; qris=%s; closing_expected_cash=%s; owner_funds_refund=%s', receptionist_id, owner_id, cash_amount, qris_amount, 12345 + cash_amount, total)
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record_finance_result('cash/qris split + dual identity + final snapshot + valid funds', 'FAIL', SQLERRM);
  END;
END;
$$;

\echo 'TEST 5 — Cash balance cannot close below the calculated balance'
DO $$
DECLARE
  owner_id constant uuid := '11111111-1111-4111-8111-111111111111';
  session_id uuid;
  rejected boolean := false;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
    SELECT id INTO session_id FROM public.finance_cash_sessions WHERE opened_by = owner_id AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;
    IF session_id IS NULL THEN SELECT public.open_finance_cash_session(1) INTO session_id; END IF;
    BEGIN
      PERFORM public.close_finance_cash_session(
        session_id,
        jsonb_build_object('setor_cash', 0, 'setor_transfer', 0, 'di_laci', 0, 'dibawa', 0),
        'Expected shortage rejection'
      );
    EXCEPTION WHEN OTHERS THEN
      rejected := true;
    END;
    IF NOT rejected OR (SELECT status FROM public.finance_cash_sessions WHERE id = session_id) <> 'OPEN' THEN
      RAISE EXCEPTION 'under-allocated closing was accepted or session changed';
    END IF;
    PERFORM pg_temp.record_finance_result('cash balance rejects shortage allocation', 'PASS', 'under-allocation rejected; session remains OPEN');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record_finance_result('cash balance rejects shortage allocation', 'FAIL', SQLERRM);
  END;
END;
$$;

-- Close any remaining Owner session only after assertions, using its database-calculated balance.
DO $$
DECLARE
  owner_id constant uuid := '11111111-1111-4111-8111-111111111111';
  v_session_id uuid;
  opening_cash numeric;
  cash_received numeric;
  cash_expenses numeric;
  cash_refunds numeric;
  expected_cash numeric;
  transfer_received numeric;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  SELECT s.id, s.opening_cash INTO v_session_id, opening_cash
  FROM public.finance_cash_sessions s WHERE s.opened_by = owner_id AND s.status = 'OPEN' ORDER BY s.opened_at DESC LIMIT 1;
  IF v_session_id IS NOT NULL THEN
    SELECT coalesce(sum(p.amount), 0) INTO cash_received FROM public.payments p WHERE p.cash_session_id = v_session_id AND p.method = 'Cash';
    SELECT coalesce(sum(e.amount), 0) INTO cash_expenses FROM public.finance_expenses e WHERE e.session_id = v_session_id AND e.method = 'CASH';
    SELECT coalesce(sum(r.amount), 0) INTO cash_refunds FROM public.finance_refunds r WHERE r.source_session_id = v_session_id AND r.refund_method = 'CASH';
    SELECT coalesce(sum(p.amount), 0) INTO transfer_received FROM public.payments p WHERE p.cash_session_id = v_session_id AND p.method = 'Transfer';
    expected_cash := opening_cash + cash_received - cash_expenses - cash_refunds;
    PERFORM public.close_finance_cash_session(
      v_session_id,
      jsonb_build_object('setor_cash', expected_cash, 'setor_transfer', transfer_received, 'di_laci', 0, 'dibawa', 0),
      'Final local Finance test cleanup'
    );
  END IF;
END;
$$;

\echo 'RESULTS'
TABLE finance_test_results ORDER BY id;
DO $$
DECLARE
  failures integer;
BEGIN
  SELECT count(*) INTO failures FROM finance_test_results WHERE status = 'FAIL';
  IF failures > 0 THEN
    RAISE EXCEPTION 'Finance combined-payment runtime tests failed: % failure(s)', failures;
  END IF;
END;
$$;

ROLLBACK;
\echo 'FINANCE COMBINED PAYMENT RUNTIME TESTS PASS — transaction rolled back; local test data not committed'
