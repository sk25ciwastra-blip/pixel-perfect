-- Disposable PostgreSQL 17 only. Fail on first deviation.
\set ON_ERROR_STOP on
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;

DO $verify$
DECLARE
 denied boolean;
 result text;
 old_total numeric;
BEGIN
 -- Owner cancellation needs exact number confirmation and reason.
 denied:=false;
 BEGIN
   PERFORM public.cancel_booking_owner(
    '20000000-0000-4000-8000-000000000001','WRONG','Synthetic cancellation because guest did not arrive',false);
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='Konfirmasi nomor transaksi tidak sesuai' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Wrong transaction number permitted'; END IF;

 denied:=false;
 BEGIN
   PERFORM public.cancel_booking_owner(
    '20000000-0000-4000-8000-000000000001','FIXBOOK-1','short',false);
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE 'Alasan pembatalan wajib%' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Short cancellation reason permitted'; END IF;

 denied:=false;
 BEGIN
   PERFORM public.cancel_booking_owner(
    '20000000-0000-4000-8000-000000000002','FIXBOOK-2','Synthetic future booking cancellation without acknowledgement',false);
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='Booking masa depan membutuhkan persetujuan eksplisit Owner' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Unacknowledged future booking cancelled'; END IF;

 old_total:=(SELECT COALESCE(SUM(amount),0) FROM public.payments);
 result:=public.cancel_booking_owner(
   '20000000-0000-4000-8000-000000000001','FIXBOOK-1',
   'Synthetic no-show administrative closure',false);
 IF result<>'FIXBOOK-1' THEN RAISE EXCEPTION 'Cancellation result invalid'; END IF;
 IF public.cancel_booking_owner(
   '20000000-0000-4000-8000-000000000001','FIXBOOK-1',
   'Synthetic no-show administrative closure',false)<>'ALREADY_CANCELLED' THEN
   RAISE EXCEPTION 'Idempotent cancelled retry failed';
 END IF;
 IF (SELECT COALESCE(SUM(amount),0) FROM public.payments)<>old_total THEN
   RAISE EXCEPTION 'Cancellation mutated payment ledger';
 END IF;

 result:=public.cancel_booking_owner(
   '20000000-0000-4000-8000-000000000002','FIXBOOK-2',
   'Synthetic explicit future Booking cancellation',true);
 IF result<>'FIXBOOK-2' THEN RAISE EXCEPTION 'Future acknowledged Owner cancellation failed'; END IF;

 -- Check-in transactions must never be cancelled as Booking.
 denied:=false;
 BEGIN
   PERFORM public.cancel_booking_owner(
    '20000000-0000-4000-8000-000000000005','FIXBOOK-5','Synthetic invalid cancellation after check-in',true);
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='Hanya Booking yang belum Check-in dapat dibatalkan' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'CHECK-IN cancellation permitted'; END IF;

 -- Reschedule same package and same weekday category; refuse collision.
 denied:=false;
 BEGIN
  PERFORM public.reschedule_booking_owner(
    '20000000-0000-4000-8000-000000000003','WRONG',
    now()+interval '19 days','Synthetic invalid number confirmation');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Konfirmasi nomor transaksi tidak sesuai' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Reschedule accepted wrong number'; END IF;

 denied:=false;
 BEGIN
  PERFORM public.reschedule_booking_owner(
    '20000000-0000-4000-8000-000000000006','FIXBOOK-6',
    now()+interval '8 days','Synthetic missed deadline change');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'Perubahan jadwal wajib paling lambat 2 jam%' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Reschedule after two-hour deadline permitted'; END IF;

 denied:=false;
 BEGIN
  PERFORM public.reschedule_booking_owner(
    '20000000-0000-4000-8000-000000000003','FIXBOOK-3',
    (SELECT scheduled_check_in+interval '7 days' FROM public.transactions WHERE transaction_number='FIXBOOK-3'),
    'Synthetic overlap with other scheduled booking');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Jadwal kamar bentrok dengan Booking atau hunian aktif' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Overlapping Booking reschedule permitted'; END IF;

 -- New time +14 days preserves category and avoids all scheduled overlaps.
 result:=public.reschedule_booking_owner(
    '20000000-0000-4000-8000-000000000003','FIXBOOK-3',
    (SELECT scheduled_check_in+interval '14 days' FROM public.transactions WHERE transaction_number='FIXBOOK-3'),
    'Synthetic valid reschedule to matching weekday group');
 IF result<>'FIXBOOK-3' THEN RAISE EXCEPTION 'Owner valid reschedule failed'; END IF;

 IF public.reschedule_booking_owner(
    '20000000-0000-4000-8000-000000000003','FIXBOOK-3',
    (SELECT scheduled_check_in FROM public.transactions WHERE transaction_number='FIXBOOK-3'),
    'Synthetic repeated exact same schedule')<>'NO_CHANGE' THEN
    RAISE EXCEPTION 'Exact-schedule retry must not create duplicate event';
 END IF;
 -- Day category change is blocked because price/DP would need reprice policy.
 denied:=false;
 BEGIN
  PERFORM public.reschedule_booking_owner(
    '20000000-0000-4000-8000-000000000003','FIXBOOK-3',
    (SELECT scheduled_check_in+interval '1 day' FROM public.transactions WHERE transaction_number='FIXBOOK-3'),
    'Synthetic cross-category price mutation prohibited');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'Perubahan kategori Weekday/Weekend%' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Reschedule silently changed Weekday/Weekend'; END IF;
END;
$verify$;

-- A non-Owner authenticated actor must not cancel or change schedule.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
DO $verify$
DECLARE denied_cancel boolean:=false;denied_change boolean:=false;denied_direct boolean:=false;
BEGIN
 BEGIN
  PERFORM public.cancel_booking_owner(
   '20000000-0000-4000-8000-000000000003','FIXBOOK-3',
   'Synthetic non Owner cancellation should be denied',true);
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Hanya Owner aktif dapat membatalkan Booking' THEN denied_cancel:=true;ELSE RAISE;END IF;
 END;
 BEGIN
  PERFORM public.reschedule_booking_owner(
   '20000000-0000-4000-8000-000000000003','FIXBOOK-3',
    now()+interval '26 days','Synthetic non Owner reschedule should be denied');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Hanya Owner aktif dapat mengubah jadwal Booking' THEN denied_change:=true;ELSE RAISE;END IF;
 END;
 BEGIN
  INSERT INTO public.booking_owner_events(transaction_id,action,performed_by,confirmed_number,reason,prior_status,received_amount_snapshot)
  VALUES('20000000-0000-4000-8000-000000000003','cancel','00000000-0000-4000-8000-000000000002',
  'FIXBOOK-3','Synthetic illegal direct audit insert','booking',1);
 EXCEPTION WHEN insufficient_privilege THEN denied_direct:=true; END;
 IF NOT denied_cancel OR NOT denied_change OR NOT denied_direct THEN
   RAISE EXCEPTION 'Owner privilege guard failed: cancel % change % direct %',denied_cancel,denied_change,denied_direct;
 END IF;
END;
$verify$;
RESET ROLE;

DO $summary$
BEGIN
 IF (SELECT COUNT(*) FROM public.booking_owner_events WHERE action='cancel')<>2
    OR (SELECT COUNT(*) FROM public.booking_owner_events WHERE action='reschedule')<>1
    OR (SELECT COUNT(*) FROM public.activity_logs WHERE action='booking_cancelled')<>2
    OR (SELECT COUNT(*) FROM public.activity_logs WHERE action='booking_rescheduled')<>1 THEN
    RAISE EXCEPTION 'Action audit count mismatch / retry duplicated audit';
 END IF;
 IF (SELECT COUNT(*) FROM public.transactions WHERE status='cancelled')<>2
    OR (SELECT COUNT(*) FROM public.transactions WHERE status='check_in')<>1
    OR (SELECT COUNT(*) FROM public.transactions WHERE status='booking')<>3 THEN
    RAISE EXCEPTION 'Unexpected status changes';
 END IF;
 IF (SELECT COUNT(*) FROM public.payments)<>4
    OR (SELECT SUM(amount) FROM public.payments)<>190000 THEN
    RAISE EXCEPTION 'Payment history was mutated';
 END IF;
 IF EXISTS(SELECT 1 FROM public.booking_owner_events WHERE action='cancel'
   AND (before_check_in IS NULL OR received_amount_snapshot IS NULL
    OR original_price_snapshot<>100000)) THEN
    RAISE EXCEPTION 'Booking cancellation history snapshot invalid';
 END IF;
 IF (SELECT COUNT(*) FROM public.rooms WHERE active)=0 THEN
    RAISE EXCEPTION 'Unrelated rooms were modified';
 END IF;
 IF has_function_privilege('anon','public.cancel_booking_owner(uuid,text,text,boolean)','EXECUTE')
    OR has_function_privilege('anon','public.reschedule_booking_owner(uuid,text,timestamp with time zone,text)','EXECUTE')
    OR has_table_privilege('authenticated','public.booking_owner_events','INSERT')
    OR has_table_privilege('authenticated','public.booking_owner_events','UPDATE')
    OR has_table_privilege('authenticated','public.booking_owner_events','DELETE') THEN
    RAISE EXCEPTION 'RPC or event table direct grants too broad';
 END IF;
END;
$summary$;
\echo 'B25 BOOKING OWNER CANCEL + TWO-HOUR RESCHEDULE DISPOSABLE: PASS'
