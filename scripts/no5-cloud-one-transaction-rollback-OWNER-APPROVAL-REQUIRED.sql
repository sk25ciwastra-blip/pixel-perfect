-- Baturaden 25 Homestay: LIVE LOVABLE CLOUD owner opt-in test.
-- WARNING: DO NOT RUN UNTIL EXPLICIT PER-TEST OWNER APPROVAL.
-- Scope: one synthetic Room 99 and one DEMO transaction only in ONE database
-- transaction. After full positive cycle, ROLLBACK clears all row writes.
-- HOWEVER, PostgreSQL sequences are nontransactional: successful calls WILL
-- permanently consume one or more TRX / HK numbers, even after ROLLBACK.
-- The test may lock synthetic rows and touch an existing OPEN B25EMP-002 cash
-- session through payment triggers; no closing, refund or physical room used.
-- This script is for Lovable project 017f6e78-15f2-4d07-a38c-87cb185279bf only.
-- Never schedule automatically, never commit, never run on real reservations.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '45s';

DO $preflight$
DECLARE
  reception_id uuid;
  housekeeping_id uuid;
  session_id uuid;
  p_id uuid;
  typ_id uuid;
  sale_price numeric;
BEGIN
 IF current_user <> 'postgres' OR to_regrole('authenticated') IS NULL
  THEN RAISE EXCEPTION 'NO5 STOP: unexpected execution role'; END IF;
 IF EXISTS (SELECT 1 FROM public.rooms WHERE room_number='99')
   THEN RAISE EXCEPTION 'NO5 STOP: test room number already exists'; END IF;
 SELECT e.user_id INTO reception_id FROM public.employees e
 WHERE e.employee_id='B25EMP-002' AND e.active AND e.position='receptionist';
 IF reception_id IS NULL OR NOT public.can_frontdesk(reception_id)
 THEN RAISE EXCEPTION 'NO5 STOP: B25EMP-002 unavailable'; END IF;
 SELECT e.user_id INTO housekeeping_id FROM public.employees e
 WHERE e.active AND e.position='housekeeping' AND public.can_housekeeping(e.user_id)
 ORDER BY e.user_id LIMIT 1;
 IF housekeeping_id IS NULL THEN RAISE EXCEPTION 'NO5 STOP: no authorized Housekeeping'; END IF;
 SELECT s.id INTO session_id FROM public.finance_cash_sessions s
 WHERE s.opened_by=reception_id AND s.status='OPEN' ORDER BY s.opened_at DESC LIMIT 1;
 IF session_id IS NULL THEN RAISE EXCEPTION 'NO5 STOP: Receptionist OPEN cash session absent'; END IF;
 SELECT id INTO typ_id FROM public.room_types WHERE pricing_group='standard' ORDER BY id LIMIT 1;
 SELECT id INTO p_id FROM public.packages WHERE name='Paket 2 Jam' AND active LIMIT 1;
 IF typ_id IS NULL OR p_id IS NULL THEN RAISE EXCEPTION 'NO5 STOP: package/type unavailable'; END IF;
 SELECT CASE WHEN public.get_operational_day_mode(((now()-interval '3 minutes') AT TIME ZONE 'Asia/Jakarta')::date)='weekday'
  THEN weekday_price ELSE weekend_price END INTO sale_price
 FROM public.package_room_type_prices
 WHERE package_id=p_id AND pricing_group='standard';
 IF sale_price IS NULL OR sale_price<=0 THEN
   RAISE EXCEPTION 'NO5 STOP: official package price unavailable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.finance_settings
   WHERE minimum_dp_mode='PERCENTAGE' AND minimum_dp_value BETWEEN 1 AND 99)
 THEN RAISE EXCEPTION 'NO5 STOP: DP setting unsupported for this scenario'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)'::regprocedure)
  <>'14314995cf012335f18bd859da5b668b'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.record_transaction_payment(uuid,numeric,text,uuid,uuid)'::regprocedure)
  <>'e9e88c3e70c76450ecc89744adc78471'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.check_in_booking(uuid)'::regprocedure)
  <>'fb29b1e4d72c71f5895ef8a1a1767387'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.check_out_transaction(uuid)'::regprocedure)
  <>'2ab65aa2ebd66574f858dc3ff54e7c7f'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.advance_room_cleaning(uuid,text)'::regprocedure)
  <>'0eb3730060a3a005bfec097f42ae3810'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.complete_housekeeping_checklist(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text)'::regprocedure)
  <>'8c9dbcabf70646f89c047291cd81c0f2'
 THEN RAISE EXCEPTION 'NO5 STOP: production RPC function body drifted'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND (p.prosrc ILIKE '%net.http_%' OR p.prosrc ILIKE '%http_post%' OR p.prosrc ILIKE '%pg_notify(%'))
 THEN RAISE EXCEPTION 'NO5 STOP: external side effects require separate review'; END IF;
END;
$preflight$;

-- All state stays session-local and inside this one transaction.
SELECT set_config('app.b25_no5_receptionist',
 (SELECT user_id::text FROM public.employees WHERE employee_id='B25EMP-002' AND active),true);
SELECT set_config('app.b25_no5_housekeeper',
 (SELECT user_id::text FROM public.employees WHERE active AND position='housekeeping' AND public.can_housekeeping(user_id) ORDER BY user_id LIMIT 1),true);
SELECT set_config('app.b25_no5_session',
 (SELECT s.id::text FROM public.finance_cash_sessions s WHERE s.opened_by=current_setting('app.b25_no5_receptionist')::uuid AND s.status='OPEN' ORDER BY s.opened_at DESC LIMIT 1),true);
SELECT set_config('app.b25_no5_room',gen_random_uuid()::text,true);
SELECT set_config('app.b25_no5_room_type',(SELECT id::text FROM public.room_types WHERE pricing_group='standard' ORDER BY id LIMIT 1),true);
SELECT set_config('app.b25_no5_package',(SELECT id::text FROM public.packages WHERE name='Paket 2 Jam' AND active LIMIT 1),true);
SELECT set_config('app.b25_no5_price',(SELECT (CASE WHEN public.get_operational_day_mode(((now()-interval '3 minutes') AT TIME ZONE 'Asia/Jakarta')::date)='weekday' THEN pr.weekday_price ELSE pr.weekend_price END)::text FROM public.package_room_type_prices pr WHERE pr.package_id=current_setting('app.b25_no5_package')::uuid AND pr.pricing_group='standard'),true);
SELECT set_config('app.b25_no5_day',public.get_operational_day_mode(((now()-interval '3 minutes') AT TIME ZONE 'Asia/Jakarta')::date),true);
SELECT set_config('app.b25_no5_dp',(SELECT CEIL(current_setting('app.b25_no5_price')::numeric*minimum_dp_value/100)::text FROM public.finance_settings ORDER BY updated_at DESC LIMIT 1),true);
SELECT set_config('app.b25_no5_key_booking',gen_random_uuid()::text,true);
SELECT set_config('app.b25_no5_key_payment',gen_random_uuid()::text,true);
SELECT set_config('app.b25_no5_key_checklist',gen_random_uuid()::text,true);

-- New, never-committed synthetic Room 99. No existing physical room is touched.
INSERT INTO public.rooms(id,room_number,room_type_id,base_price,status,notes,active)
VALUES(current_setting('app.b25_no5_room')::uuid,'99',
current_setting('app.b25_no5_room_type')::uuid,
current_setting('app.b25_no5_price')::numeric,'ready','NO5 UAT — ROLLBACK ONLY',true);

SELECT set_config('request.jwt.claim.sub',current_setting('app.b25_no5_receptionist'),true);
SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('app.b25_no5_receptionist'),
  'role','authenticated','is_anonymous',false)::text,true);
SET LOCAL ROLE authenticated;
SELECT set_config('app.b25_no5_number',
 public.create_reservation('booking',current_setting('app.b25_no5_room')::uuid,
 current_setting('app.b25_no5_package')::uuid,
 'B25 NO5 ROLLBACK ONLY','0800000000000099','SYNTHETIC—ROLLBACK',
 current_setting('app.b25_no5_dp')::numeric,'Cash',
 current_setting('app.b25_no5_day'),now()-interval '3 minutes',
 current_setting('app.b25_no5_key_booking')::uuid,
 current_setting('app.b25_no5_session')::uuid,2),true);
RESET ROLE;

SELECT set_config('app.b25_no5_trx',
 (SELECT id::text FROM public.transactions WHERE transaction_number=current_setting('app.b25_no5_number')),true);
DO $booking_checks$
BEGIN
 IF current_setting('app.b25_no5_trx',true) IS NULL
 OR (SELECT count(*) FROM public.payments WHERE transaction_id=current_setting('app.b25_no5_trx')::uuid)<>1
 OR (SELECT coalesce(sum(amount),0) FROM public.payments WHERE transaction_id=current_setting('app.b25_no5_trx')::uuid)<>current_setting('app.b25_no5_dp')::numeric
 OR (SELECT status::text FROM public.transactions WHERE id=current_setting('app.b25_no5_trx')::uuid)<>'booking'
 THEN RAISE EXCEPTION 'NO5 FAIL: Booking/DP state'; END IF;
END;
$booking_checks$;

SET LOCAL ROLE authenticated;
SELECT public.record_transaction_payment(
 current_setting('app.b25_no5_trx')::uuid,
 current_setting('app.b25_no5_price')::numeric-current_setting('app.b25_no5_dp')::numeric,
 'QRIS',current_setting('app.b25_no5_key_payment')::uuid,current_setting('app.b25_no5_session')::uuid);
SELECT public.check_in_booking(current_setting('app.b25_no5_trx')::uuid);
SELECT public.check_out_transaction(current_setting('app.b25_no5_trx')::uuid);
RESET ROLE;

DO $receptionist_checks$
BEGIN
 IF (SELECT count(*) FROM public.payments WHERE transaction_id=current_setting('app.b25_no5_trx')::uuid)<>2
 OR (SELECT coalesce(sum(amount),0) FROM public.payments WHERE transaction_id=current_setting('app.b25_no5_trx')::uuid)<>current_setting('app.b25_no5_price')::numeric
 OR (SELECT count(*) FROM public.payments WHERE transaction_id=current_setting('app.b25_no5_trx')::uuid AND cash_session_id=current_setting('app.b25_no5_session')::uuid)<>2
 OR (SELECT status::text FROM public.transactions WHERE id=current_setting('app.b25_no5_trx')::uuid)<>'check_out'
 OR (SELECT status::text FROM public.rooms WHERE id=current_setting('app.b25_no5_room')::uuid)<>'dirty'
 THEN RAISE EXCEPTION 'NO5 FAIL: payment/Checkout/DIRTY invariant'; END IF;
END;
$receptionist_checks$;

SELECT set_config('request.jwt.claim.sub',current_setting('app.b25_no5_housekeeper'),true);
SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('app.b25_no5_housekeeper'),
  'role','authenticated','is_anonymous',false)::text,true);
SET LOCAL ROLE authenticated;
SELECT public.advance_room_cleaning(current_setting('app.b25_no5_room')::uuid,'NO5 UAT ROLLBACK ONLY');
SELECT public.complete_housekeeping_checklist(
 current_setting('app.b25_no5_room')::uuid,
 current_setting('app.b25_no5_key_checklist')::uuid,
 true,true,true,true,true,true,true,'{}');
RESET ROLE;

DO $finished$
BEGIN
 IF (SELECT status::text FROM public.rooms WHERE id=current_setting('app.b25_no5_room')::uuid)<>'ready'
 OR (SELECT count(*) FROM public.housekeeping_jobs WHERE transaction_id=current_setting('app.b25_no5_trx')::uuid)<>1
 OR (SELECT count(*) FROM public.housekeeping_history WHERE transaction_id=current_setting('app.b25_no5_trx')::uuid AND action='start_cleaning')<>1
 OR (SELECT count(*) FROM public.housekeeping_history WHERE transaction_id=current_setting('app.b25_no5_trx')::uuid AND action='finish_cleaning')<>1
 OR (SELECT count(*) FROM public.housekeeping_checklists WHERE transaction_id=current_setting('app.b25_no5_trx')::uuid AND result='passed')<>1
 OR (SELECT status FROM public.finance_cash_sessions WHERE id=current_setting('app.b25_no5_session')::uuid)<>'OPEN'
 THEN RAISE EXCEPTION 'NO5 FAIL: final same-TRX Housekeeping/READY/session invariants'; END IF;
END;
$finished$;

-- Entire test should disappear from all rows when transaction rolls back.
-- Number generators are NOT rolled back, intentionally and with Owner approval.
ROLLBACK;
SELECT 'NO5 CLOUD POSITIVE RPC UAT PASSED; ROW WRITES ROLLED BACK; TRX/HK SEQUENCE VALUES MAY HAVE ADVANCED' AS result;
