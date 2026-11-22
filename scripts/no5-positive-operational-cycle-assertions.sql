-- Baturaden 25 Homestay: No.5 disposable PG17 acceptance with exact
-- Cloud function bodies, but synthetic schema, test actors, and helpers.
-- NEVER run against Lovable Cloud. No guest/customer info here.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO public.employees (user_id,name,active,position) VALUES
 ('00000000-0000-4000-8000-000000000002','Fixture Receptionist',true,'receptionist'),
 ('00000000-0000-4000-8000-000000000003','Fixture Housekeeping',true,'housekeeping');

INSERT INTO public.rooms (id,room_number,active,status) VALUES
 ('10000000-0000-4000-8000-000000000005','05',true,'ready');
INSERT INTO public.packages (id,name,active,time_mode,duration_minutes) VALUES
 ('20000000-0000-4000-8000-000000000001','Paket 2 Jam',true,'duration',120);
INSERT INTO public.guests (id,full_name) VALUES
 ('30000000-0000-4000-8000-000000000001','Synthetic only — not a real guest');
INSERT INTO public.finance_cash_sessions (id,opened_by,opening_cash,status) VALUES
 ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',0,'OPEN');

-- Booking creation is a synthetic seed. The SQL under test starts with the
-- actual Cloud payment RPC below; create_reservation itself is not exercised.
INSERT INTO public.transactions (
 id,transaction_number,guest_id,room_id,package_id,status,created_by,
 price_snapshot,day_mode,scheduled_check_in,scheduled_check_out
) VALUES (
 '50000000-0000-4000-8000-000000000001',
 'B25-UAT-PG17-ONLY-001',
 '30000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000005',
 '20000000-0000-4000-8000-000000000001',
 'booking','00000000-0000-4000-8000-000000000002',
 200000,'weekend',now()-interval '10 minutes',now()+interval '110 minutes'
);
INSERT INTO public.payments (
 id,transaction_id,amount,method,kind,recorded_by,idempotency_key,cash_session_id
) VALUES (
 '60000000-0000-4000-8000-000000000001',
 '50000000-0000-4000-8000-000000000001',
 80000,'Cash','dp','00000000-0000-4000-8000-000000000002',
 '60000000-0000-4000-8000-000000000011',
 '40000000-0000-4000-8000-000000000001'
);
\echo 'B25 No5: booking seeded with 40 percent DP (not reservation RPC)'
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
SET ROLE authenticated;

DO $before_full_payment$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
   PERFORM public.check_in_booking('50000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='Sisa pembayaran harus dilunasi sebelum check-in'
     THEN blocked:=true;
   ELSE RAISE; END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'No5 FAIL: partially paid Booking checked in'; END IF;
END;
$before_full_payment$;

SELECT public.record_transaction_payment(
 '50000000-0000-4000-8000-000000000001',120000,'QRIS',
 '60000000-0000-4000-8000-000000000012',
 '40000000-0000-4000-8000-000000000001'
) AS payment_id \gset

SELECT public.record_transaction_payment(
 '50000000-0000-4000-8000-000000000001',120000,'QRIS',
 '60000000-0000-4000-8000-000000000012',
 '40000000-0000-4000-8000-000000000001'
) AS duplicate_payment_id \gset

SELECT public.check_in_booking(
 '50000000-0000-4000-8000-000000000001') AS checked_in;

RESET ROLE;
DO $after_checkin$
BEGIN
 IF (SELECT status::text FROM public.transactions WHERE id='50000000-0000-4000-8000-000000000001')<>'check_in'
  OR (SELECT status::text FROM public.rooms WHERE id='10000000-0000-4000-8000-000000000005')<>'occupied'
  OR (SELECT count(*) FROM public.payments WHERE transaction_id='50000000-0000-4000-8000-000000000001')<>2
  OR (SELECT sum(amount) FROM public.payments WHERE transaction_id='50000000-0000-4000-8000-000000000001')<>200000
  OR (SELECT count(DISTINCT cash_session_id) FROM public.payments WHERE transaction_id='50000000-0000-4000-8000-000000000001')<>1
  OR (SELECT ends_at<=scheduled_check_out FROM public.transactions WHERE id='50000000-0000-4000-8000-000000000001') IS NOT TRUE
  OR (SELECT started_at IS NOT NULL FROM public.transactions WHERE id='50000000-0000-4000-8000-000000000001') IS NOT TRUE
 THEN RAISE EXCEPTION 'No5 FAIL: payment/checkin/room/expiry invariant'; END IF;
END;
$after_checkin$;
\echo 'B25 No5: Booking DP, full QRIS payment, idempotency, one TRX, CHECKIN OCCUPIED PASS'

SET ROLE authenticated;
SELECT public.check_out_transaction(
 '50000000-0000-4000-8000-000000000001') AS checked_out;
RESET ROLE;

DO $after_checkout$
BEGIN
 IF (SELECT status::text FROM public.transactions WHERE id='50000000-0000-4000-8000-000000000001')<>'check_out'
  OR (SELECT status::text FROM public.rooms WHERE id='10000000-0000-4000-8000-000000000005')<>'dirty'
  OR (SELECT checked_out_at IS NOT NULL FROM public.transactions WHERE id='50000000-0000-4000-8000-000000000001') IS NOT TRUE
  OR (SELECT count(*) FROM public.activity_logs WHERE action='check_out' AND entity_id='50000000-0000-4000-8000-000000000001')<>1
 THEN RAISE EXCEPTION 'No5 FAIL: Checkout did not settle/mark DIRTY/audit'; END IF;
END;
$after_checkout$;

-- Receptionist cannot start HK even when room is DIRTY.
SET ROLE authenticated;
DO $receptionist_hk_guard$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM public.advance_room_cleaning('10000000-0000-4000-8000-000000000005','should be rejected');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Akses ditolak' THEN blocked:=true; ELSE RAISE; END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'No5 FAIL: Receptionist ran HK'; END IF;
END;
$receptionist_hk_guard$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
SET ROLE authenticated;
SELECT public.advance_room_cleaning(
 '10000000-0000-4000-8000-000000000005','Fixture after checkout') AS cleaning_started;

DO $checklist_reason_guard$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM public.complete_housekeeping_checklist(
   '10000000-0000-4000-8000-000000000005',
   '70000000-0000-4000-8000-000000000099',
   false,true,true,true,true,true,true,'{}');
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='Alasan Handuk wajib diisi' THEN blocked:=true; ELSE RAISE; END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'No5 FAIL: failed checklist item without reason accepted'; END IF;
END;
$checklist_reason_guard$;

SELECT public.complete_housekeeping_checklist(
 '10000000-0000-4000-8000-000000000005',
 '70000000-0000-4000-8000-000000000001',
 true,true,true,true,true,true,true,'{}') AS checklist_id \gset
SELECT public.complete_housekeeping_checklist(
 '10000000-0000-4000-8000-000000000005',
 '70000000-0000-4000-8000-000000000001',
 true,true,true,true,true,true,true,'{}') AS checklist_retry_id \gset
RESET ROLE;

DO $final_acceptance$
DECLARE v_session uuid:='40000000-0000-4000-8000-000000000001';
  v_tx uuid:='50000000-0000-4000-8000-000000000001';
  v_room uuid:='10000000-0000-4000-8000-000000000005';
BEGIN
 IF (SELECT status::text FROM public.transactions WHERE id=v_tx)<>'check_out'
  OR (SELECT status::text FROM public.rooms WHERE id=v_room)<>'ready'
  OR (SELECT sum(amount) FROM public.payments WHERE transaction_id=v_tx)<>200000
  OR (SELECT count(*) FROM public.payments WHERE transaction_id=v_tx)<>2
  OR (SELECT count(*) FROM public.payments WHERE transaction_id=v_tx AND cash_session_id=v_session)<>2
  OR (SELECT count(*) FROM public.housekeeping_jobs WHERE transaction_id=v_tx)<>1
  OR (SELECT count(*) FROM public.housekeeping_history WHERE transaction_id=v_tx AND action='start_cleaning')<>1
  OR (SELECT count(*) FROM public.housekeeping_history WHERE transaction_id=v_tx AND action='finish_cleaning')<>1
  OR (SELECT count(*) FROM public.housekeeping_checklists WHERE transaction_id=v_tx AND result='passed')<>1
  OR (SELECT count(*) FROM public.housekeeping_history h
       JOIN public.housekeeping_jobs j ON j.id=h.job_id AND j.transaction_id=h.transaction_id
       WHERE h.transaction_id=v_tx AND h.action='finish_cleaning')<>1
  OR (SELECT status FROM public.finance_cash_sessions WHERE id=v_session)<>'OPEN'
  OR (SELECT last_value FROM public.fixture_housekeeping_number_seq)<>1
  OR (SELECT count(*) FROM public.activity_logs WHERE action='check_out' AND entity_id=v_tx)<>1
 THEN RAISE EXCEPTION 'No5 FAIL: final TRX/HK/cash/settlement invariant'; END IF;
END;
$final_acceptance$;
ROLLBACK;
\echo 'B25 No5 disposable real Cloud RPCs: BOOKING DP > FULL PAYMENT > CHECKIN > CHECKOUT > DIRTY > CLEANING > CHECKLIST PASS > READY: PASS'
