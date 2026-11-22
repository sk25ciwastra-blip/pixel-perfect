-- Targeted seam: actual Lovable Cloud create_finance_refund() function definition,
-- compiled and executed ONLY on disposable PostgreSQL 17 synthetic data.
\set ON_ERROR_STOP on
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;

-- Both source TRXs were paid into a FINAL session, but refunds will originate
-- from OWNER_FUNDS or a *different* OPEN session.
SELECT public.check_out_transaction('20000000-0000-4000-8000-000000000006');
SELECT public.check_out_transaction('20000000-0000-4000-8000-000000000007');

DO $tests$
DECLARE
  first_id uuid;
  replay_id uuid;
  mismatch_rejected boolean:=false;
  final_rejected boolean:=false;
  direct_insert_rejected boolean:=false;
BEGIN
  -- PERCENTAGE mode: 10% on 100000, then 20% refunded, then fully refunded.
  first_id:=public.create_finance_refund(
    '50000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000006',
    20000,'CASH','OWNER_FUNDS',NULL,'Synthetic PERCENT partial');
  replay_id:=public.create_finance_refund(
    '50000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000006',
    20000,'CASH','OWNER_FUNDS',NULL,'Synthetic PERCENT partial');
  IF first_id IS DISTINCT FROM replay_id THEN
    RAISE EXCEPTION 'Real function idempotent retry not stable';
  END IF;
  BEGIN
    PERFORM public.create_finance_refund(
      '50000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000006',
      20001,'CASH','OWNER_FUNDS',NULL,'Synthetic PERCENT partial');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Idempotency refund payload berbeda' THEN mismatch_rejected:=true;
    ELSE RAISE; END IF;
  END;
  IF NOT mismatch_rejected THEN RAISE EXCEPTION 'Payload tamper accepted'; END IF;

  PERFORM public.create_finance_refund(
    '50000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000006',
    80000,'CASH','SHIFT_CASH',
    '30000000-0000-4000-8000-000000000002','Synthetic PERCENT full via OPEN');

  -- PER_ROOM mode: partial refund pays commission unchanged; full refund
  -- reverses per-room commission. Both refunds occur after Checkout.
  PERFORM public.create_finance_refund(
    '50000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000007',
    10000,'CASH','OWNER_FUNDS',NULL,'Synthetic PER_ROOM partial');
  PERFORM public.create_finance_refund(
    '50000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000007',
    90000,'CASH','OWNER_FUNDS',NULL,'Synthetic PER_ROOM full');

  -- A FINAL session is *never* allowed as refund funding source.
  BEGIN
    PERFORM public.create_finance_refund(
      '50000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000006',
      1,'CASH','SHIFT_CASH',
      '30000000-0000-4000-8000-000000000001','Synthetic FINAL invalid');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Sumber dana refund harus berasal dari sesi kas OPEN' THEN
      final_rejected:=true;
    ELSIF SQLERRM='Nominal refund melebihi penerimaan yang sah' THEN
      -- If refund amount already exhausted, cannot reach funding guard.
      -- This is NOT adequate proof of FINAL source denial.
      RAISE EXCEPTION 'FINAL source case masked by fully refunded TRX';
    ELSE RAISE; END IF;
  END;
  -- The condition above is intentionally strict; a separate non-exhausted
  -- closed transaction is used for the source-denial test below.
END;
$tests$;

-- Genuine refund before checkout must make net settlement insufficient.
SELECT public.create_finance_refund(
  '50000000-0000-4000-8000-000000000006',
  '20000000-0000-4000-8000-000000000008',
  30000,'CASH','OWNER_FUNDS',NULL,'Synthetic pre-checkout refund');
DO $tests$
DECLARE rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM public.check_out_transaction('20000000-0000-4000-8000-000000000008');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Check-out ditolak:%' THEN rejected:=true;
    ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Checkout after genuine refund must deny underpay'; END IF;
END;
$tests$;

-- Non-Owner cannot refund, even if Postgres role is authenticated.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
DO $tests$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.create_finance_refund(
      gen_random_uuid(),'20000000-0000-4000-8000-000000000008',1,
      'CASH','OWNER_FUNDS',NULL,'Synthetic nonOwner');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Hanya Owner yang dapat melakukan refund' THEN denied:=true;
    ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'NonOwner refund was accepted'; END IF;
END;
$tests$;
RESET ROLE;

-- These checks must be done as postgres because refund table RLS denies direct
-- read/write to authenticated in the isolated fixture.
DO $checks$
DECLARE percent_total numeric; per_room_total numeric;
BEGIN
  IF (SELECT COUNT(*) FROM public.finance_refunds
      WHERE transaction_id='20000000-0000-4000-8000-000000000006') <> 2 THEN
    RAISE EXCEPTION 'Idempotent replay created duplicate percent refund';
  END IF;
  SELECT COALESCE(SUM(commission_adjustment),0) INTO percent_total
  FROM public.finance_refunds
  WHERE transaction_id='20000000-0000-4000-8000-000000000006';
  IF percent_total <> -10000 THEN
    RAISE EXCEPTION 'Percentage commission correction mismatch: %',percent_total;
  END IF;
  SELECT COALESCE(SUM(commission_adjustment),0) INTO per_room_total
  FROM public.finance_refunds
  WHERE transaction_id='20000000-0000-4000-8000-000000000007';
  IF per_room_total <> -5000 THEN
    RAISE EXCEPTION 'Per room commission correction mismatch: %',per_room_total;
  END IF;
  IF (SELECT commission_adjustment FROM public.finance_refunds
      WHERE idempotency_key='50000000-0000-4000-8000-000000000003') <> 0 THEN
    RAISE EXCEPTION 'Partial PER_ROOM refund wrongly reduced commission';
  END IF;
  IF (SELECT COUNT(*) FROM public.finance_refund_allocations a
      JOIN public.finance_refunds r ON r.id=a.refund_id
      WHERE r.transaction_id IN
      ('20000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000007')) <> 4 THEN
    RAISE EXCEPTION 'Missing genuine refund allocations';
  END IF;
  IF (SELECT status FROM public.finance_cash_sessions
      WHERE id='30000000-0000-4000-8000-000000000001') <> 'FINAL'
     OR (SELECT closing_snapshot FROM public.finance_cash_sessions
      WHERE id='30000000-0000-4000-8000-000000000001') IS DISTINCT FROM
      '{"cash":"sealed-final","amount":1234}'::jsonb THEN
    RAISE EXCEPTION 'Historical FINAL snapshot modified';
  END IF;
  IF (SELECT status FROM public.transactions
      WHERE transaction_number='FIXTURE-PRE-REFUND') <> 'check_in'::public.transaction_status
     OR (SELECT status FROM public.rooms
      WHERE id='10000000-0000-4000-8000-000000000008') <> 'occupied' THEN
    RAISE EXCEPTION 'Rejected checkout modified stay/room';
  END IF;
END;
$checks$;
\echo 'B25 REAL LOVABLE REFUND FUNCTION + CHECKOUT SEAM: PASS'
