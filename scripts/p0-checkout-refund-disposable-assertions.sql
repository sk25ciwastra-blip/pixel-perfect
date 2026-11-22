-- Disposable-only Checkout/refund seam checks. No Cloud credentials/data.
\set ON_ERROR_STOP on

-- Run the real candidate's compiled Checkout RPC as an authenticated Owner.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
SELECT public.check_out_transaction('20000000-0000-4000-8000-000000000001');

-- Four invalid checkouts: underpaid, overpaid, unpaid charge, precheckout refund.
DO $test$
DECLARE
  tx_ids uuid[] := ARRAY[
    '20000000-0000-4000-8000-000000000002'::uuid,
    '20000000-0000-4000-8000-000000000003'::uuid,
    '20000000-0000-4000-8000-000000000004'::uuid,
    '20000000-0000-4000-8000-000000000005'::uuid
  ];
  i integer; rejected boolean;
BEGIN
  FOR i IN 1..4 LOOP
    rejected:=false;
    BEGIN
      PERFORM public.check_out_transaction(tx_ids[i]);
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'Check-out ditolak:%' THEN
        rejected:=true;
      ELSE
        RAISE;
      END IF;
    END;
    IF NOT rejected THEN
      RAISE EXCEPTION 'Checkout invalid case % was not rejected',i;
    END IF;
  END LOOP;
END;
$test$;

-- Owner refund after checkout must remain possible and must invoke INSERT+UPDATE.
SELECT public.create_finance_refund(
  gen_random_uuid(),'20000000-0000-4000-8000-000000000001',5,
  'CASH','OWNER_FUNDS',NULL,'Fixture post-checkout refund');

-- An authorized OPEN cash session is also eligible.
SELECT public.create_finance_refund(
  gen_random_uuid(),'20000000-0000-4000-8000-000000000001',5,
  'CASH','SHIFT_CASH','30000000-0000-4000-8000-000000000002',
  'Fixture post-checkout OPEN session');

-- A FINAL cash session must never become the refund source.
DO $test$
DECLARE rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM public.create_finance_refund(
      gen_random_uuid(),'20000000-0000-4000-8000-000000000001',5,
      'CASH','SHIFT_CASH','30000000-0000-4000-8000-000000000001',
      'Fixture FINAL invalid source');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Sumber dana refund harus dari sesi OPEN' THEN
      rejected:=true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'FINAL source refund was not rejected'; END IF;
END;
$test$;

-- Direct refund insert must be denied even for authenticated actor.
DO $test$
DECLARE rejected boolean:=false;
BEGIN
  BEGIN
    INSERT INTO public.finance_refunds(transaction_id,amount,source_type)
    VALUES('20000000-0000-4000-8000-000000000001',1,'OWNER_FUNDS');
  EXCEPTION WHEN insufficient_privilege THEN
    rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Direct refund insert was not denied'; END IF;
END;
$test$;

-- Non-Owner cannot use the Owner refund RPC or the checkout RPC.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
DO $test$
DECLARE checkout_denied boolean:=false; refund_denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.check_out_transaction('20000000-0000-4000-8000-000000000002');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Akses ditolak' THEN checkout_denied:=true; ELSE RAISE; END IF;
  END;
  BEGIN
    PERFORM public.create_finance_refund(
      gen_random_uuid(),'20000000-0000-4000-8000-000000000001',1,
      'CASH','OWNER_FUNDS',NULL,'Fixture non-owner denied');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Hanya Owner yang dapat melakukan refund' THEN
      refund_denied:=true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT checkout_denied OR NOT refund_denied THEN
    RAISE EXCEPTION 'Actor authorization failure: checkout=% refund=%',
      checkout_denied,refund_denied;
  END IF;
END;
$test$;

RESET ROLE;

-- The guard triggers must prohibit even privileged direct post-checkout writes.
DO $test$
DECLARE payment_denied boolean:=false; charge_denied boolean:=false;
BEGIN
  BEGIN
    INSERT INTO public.payments(transaction_id,amount)
    VALUES('20000000-0000-4000-8000-000000000001',1);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Pembayaran tidak dapat diubah setelah transaksi ditutup atau dibatalkan' THEN
      payment_denied:=true;
    ELSE
      RAISE;
    END IF;
  END;
  BEGIN
    INSERT INTO public.finance_charge_events(transaction_id,amount)
    VALUES('20000000-0000-4000-8000-000000000001',1);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Charge tidak dapat diubah setelah transaksi ditutup atau dibatalkan' THEN
      charge_denied:=true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT payment_denied OR NOT charge_denied THEN
    RAISE EXCEPTION 'Closed mutation guard failed: payment=% charge=%',
      payment_denied,charge_denied;
  END IF;
END;
$test$;

DO $test$
BEGIN
  IF (SELECT status FROM public.transactions
      WHERE transaction_number='FIXTURE-1') IS DISTINCT FROM 'check_out'::public.transaction_status
     OR (SELECT status FROM public.rooms
         WHERE id='10000000-0000-4000-8000-000000000001') <> 'dirty' THEN
    RAISE EXCEPTION 'Successful checkout did not mark check_out/dirty';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.transactions t
    JOIN public.rooms r ON r.id=t.room_id
    WHERE t.transaction_number IN ('FIXTURE-2','FIXTURE-3','FIXTURE-4','FIXTURE-5')
      AND (t.status <> 'check_in'::public.transaction_status OR r.status <> 'occupied')
  ) THEN
    RAISE EXCEPTION 'Rejected Checkout mutated room or transaction';
  END IF;
  IF (SELECT COUNT(*) FROM public.activity_logs WHERE action='check_out') <> 1 THEN
    RAISE EXCEPTION 'Checkout audit count mismatch';
  END IF;
  IF (SELECT COUNT(*) FROM public.finance_refunds
      WHERE transaction_id='20000000-0000-4000-8000-000000000001') <> 2 THEN
    RAISE EXCEPTION 'Post-checkout refund did not preserve both authorized cases';
  END IF;
  IF (SELECT COALESCE(SUM(commission_adjustment),0) FROM public.finance_refunds
      WHERE transaction_id='20000000-0000-4000-8000-000000000001') <> -2 THEN
    RAISE EXCEPTION 'Post-checkout refund UPDATE path failed';
  END IF;
  IF (SELECT status FROM public.finance_cash_sessions
      WHERE id='30000000-0000-4000-8000-000000000001') <> 'FINAL' THEN
    RAISE EXCEPTION 'FINAL source session was modified';
  END IF;
  IF has_function_privilege('anon','public.check_out_transaction(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_payment_transaction_state()','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_charge_transaction_state_review()','EXECUTE') THEN
    RAISE EXCEPTION 'RPC helper grant is too broad';
  END IF;
END;
$test$;
\echo 'B25 DISPOSABLE POSTGRES 17 CHECKOUT/REFUND SEAM: PASS'
