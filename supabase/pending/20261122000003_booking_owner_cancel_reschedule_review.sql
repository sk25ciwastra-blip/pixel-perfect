-- Baturaden 25 Homestay — P0 Booking administrative Owner actions.
-- REVIEW CANDIDATE, NOT automatically deployed. Never touch old DEMO bookings.
-- Owner approval required before APPLY to Lovable Cloud.
--
-- AB-BOOK-006: paid Booking is NON-REFUNDABLE; admin cancellation is NOT refund.
-- AB-BOOK-007: ordinary schedule changes confirmed by original check-in minus 2h,
-- inclusive at exactly 2h. No schedule change may silently reprice the transaction.
-- This SQL creates two server-authorized RPCs and append-only operational evidence.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='35s';

DO $preflight$
BEGIN
 IF current_user <> 'postgres' THEN
   RAISE EXCEPTION 'STOP Booking P0: expected audited postgres role';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
   WHERE t.typname='transaction_status' AND e.enumlabel='cancelled'
 ) THEN RAISE EXCEPTION 'STOP Booking P0: cancelled status missing'; END IF;
 IF to_regprocedure('public.cancel_booking_owner(uuid,text,text,boolean)') IS NOT NULL
    OR to_regprocedure('public.reschedule_booking_owner(uuid,text,timestamp with time zone,text)') IS NOT NULL
    OR to_regclass('public.booking_owner_events') IS NOT NULL THEN
   RAISE EXCEPTION 'STOP Booking P0: partial install or existing Booking RPC; no replay';
 END IF;
 IF (SELECT md5(prosrc) FROM pg_proc
     WHERE oid='public.check_in_booking(uuid)'::regprocedure)
      IS DISTINCT FROM 'fb29b1e4d72c71f5895ef8a1a1767387'
    OR (SELECT md5(prosrc) FROM pg_proc
     WHERE oid='public.calculate_scheduled_booking_times(uuid,timestamp with time zone)'::regprocedure)
      IS DISTINCT FROM 'b089ff12792ef26856ebf4b3ddc9a481'
    OR (SELECT md5(prosrc) FROM pg_proc
     WHERE oid='public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamp with time zone,uuid,uuid,integer)'::regprocedure)
      IS DISTINCT FROM '14314995cf012335f18bd859da5b668b' THEN
    RAISE EXCEPTION 'STOP Booking P0: room/Booking RPC drift — review first';
 END IF;
 IF to_regprocedure('public.get_operational_day_mode(date)') IS NULL
    OR to_regprocedure('public.has_role(uuid,app_role)') IS NULL THEN
    RAISE EXCEPTION 'STOP Booking P0: role or day-mode helper not available';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class c
     WHERE c.oid='public.transactions'::regclass AND c.relrowsecurity)
    OR has_table_privilege('authenticated','public.transactions','UPDATE')
    OR has_table_privilege('anon','public.transactions','UPDATE') THEN
    RAISE EXCEPTION 'STOP Booking P0: transactions update ACL/RLS drift';
 END IF;
 IF EXISTS (
   SELECT 1 FROM (VALUES
      ('transactions','id'),('transactions','transaction_number'),
      ('transactions','status'),('transactions','room_id'),
      ('transactions','package_id'),('transactions','started_at'),
      ('transactions','checked_out_at'),
      ('transactions','scheduled_check_in'),('transactions','scheduled_check_out'),
      ('transactions','price_snapshot'),('transactions','day_mode'),
      ('rooms','active'),('rooms','id'),
      ('payments','transaction_id'),('payments','amount'),
      ('activity_logs','user_id'),('activity_logs','action'),
      ('activity_logs','entity_type'),('activity_logs','entity_id'),
      ('activity_logs','description')
    ) AS needed(tbl,col)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema='public' AND c.table_name=needed.tbl
       AND c.column_name=needed.col
   )
 ) THEN
    RAISE EXCEPTION 'STOP Booking P0: schema dependencies missing';
 END IF;
END;
$preflight$;

-- Separate evidence. No direct role grant, RLS on, and each cancellation has
-- at most one audit record. No payment, refund, commission or cash ledger changes.
CREATE TABLE public.booking_owner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  action text NOT NULL CHECK(action IN ('cancel','reschedule')),
  performed_by uuid NOT NULL,
  confirmed_number text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 500),
  prior_status public.transaction_status NOT NULL,
  before_check_in timestamptz,
  before_check_out timestamptz,
  after_check_in timestamptz,
  after_check_out timestamptz,
  original_price_snapshot numeric,
  received_amount_snapshot numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX booking_owner_one_cancellation
  ON public.booking_owner_events(transaction_id) WHERE action='cancel';
CREATE INDEX booking_owner_events_by_transaction
  ON public.booking_owner_events(transaction_id,created_at);

ALTER TABLE public.booking_owner_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_owner_events FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.cancel_booking_owner(
  _transaction_id uuid,
  _confirmation text,
  _reason text,
  _ack_future boolean DEFAULT false
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $cancel$
DECLARE
  actor uuid;
  original record;
  gross_paid numeric;
BEGIN
  actor := auth.uid();
  IF actor IS NULL
     OR NOT public.has_role(actor,'owner'::public.app_role)
     OR public.finance_training_is_restricted(actor) THEN
    RAISE EXCEPTION 'Hanya Owner aktif dapat membatalkan Booking';
  END IF;
  IF _transaction_id IS NULL THEN RAISE EXCEPTION 'Nomor Booking wajib dipilih'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib 10 sampai 500 karakter';
  END IF;

  SELECT id,transaction_number,status,room_id,started_at,checked_out_at,
         scheduled_check_in,scheduled_check_out,price_snapshot
    INTO original FROM public.transactions
    WHERE id=_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking tidak ditemukan'; END IF;
  IF _confirmation IS DISTINCT FROM original.transaction_number THEN
    RAISE EXCEPTION 'Konfirmasi nomor transaksi tidak sesuai';
  END IF;
  IF original.status='cancelled' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.booking_owner_events e
      WHERE e.transaction_id=original.id AND e.action='cancel'
    ) THEN RAISE EXCEPTION 'Pembatalan sebelumnya tidak memiliki audit yang dapat diverifikasi'; END IF;
    RETURN 'ALREADY_CANCELLED';
  END IF;
  IF original.status<>'booking' OR original.started_at IS NOT NULL
     OR original.checked_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'Hanya Booking yang belum Check-in dapat dibatalkan';
  END IF;
  IF original.scheduled_check_in>clock_timestamp()
     AND COALESCE(_ack_future,false)=false THEN
    RAISE EXCEPTION 'Booking masa depan membutuhkan persetujuan eksplisit Owner';
  END IF;

  SELECT COALESCE(SUM(amount),0) INTO gross_paid
  FROM public.payments WHERE transaction_id=original.id;

  UPDATE public.transactions
  SET status='cancelled'
  WHERE id=original.id AND status='booking';
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking berubah saat pembatalan'; END IF;

  INSERT INTO public.booking_owner_events (
    transaction_id,action,performed_by,confirmed_number,reason,prior_status,
    before_check_in,before_check_out,original_price_snapshot,received_amount_snapshot
  ) VALUES (
    original.id,'cancel',actor,original.transaction_number,btrim(_reason),original.status,
    original.scheduled_check_in,original.scheduled_check_out,original.price_snapshot,gross_paid
  );
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,description)
  VALUES (actor,'booking_cancelled','transaction',original.id,
     'Booking dibatalkan secara administratif; pembayaran tetap tercatat. Alasan: '||btrim(_reason));
  RETURN original.transaction_number;
END;
$cancel$;

CREATE FUNCTION public.reschedule_booking_owner(
  _transaction_id uuid,
  _confirmation text,
  _new_scheduled_check_in timestamptz,
  _reason text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $reschedule$
DECLARE
 actor uuid;
 original record;
 room_active boolean;
 proposed_check_in timestamptz;
 proposed_check_out timestamptz;
 proposed_day_mode text;
 gross_paid numeric;
BEGIN
 actor:=auth.uid();
 IF actor IS NULL OR NOT public.has_role(actor,'owner'::public.app_role)
   OR public.finance_training_is_restricted(actor) THEN
   RAISE EXCEPTION 'Hanya Owner aktif dapat mengubah jadwal Booking';
 END IF;
 IF _reason IS NULL OR length(btrim(_reason)) NOT BETWEEN 10 AND 500 THEN
   RAISE EXCEPTION 'Alasan perubahan jadwal wajib 10 sampai 500 karakter';
 END IF;
 IF _new_scheduled_check_in IS NULL THEN
   RAISE EXCEPTION 'Jadwal baru wajib diisi';
 END IF;

 SELECT id,transaction_number,status,room_id,package_id,started_at,checked_out_at,
        scheduled_check_in,scheduled_check_out,price_snapshot,day_mode
 INTO original FROM public.transactions WHERE id=_transaction_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking tidak ditemukan'; END IF;
 IF _confirmation IS DISTINCT FROM original.transaction_number THEN
   RAISE EXCEPTION 'Konfirmasi nomor transaksi tidak sesuai';
 END IF;
 IF original.status<>'booking' OR original.started_at IS NOT NULL
    OR original.checked_out_at IS NOT NULL THEN
   RAISE EXCEPTION 'Hanya Booking aktif yang belum Check-in boleh diubah';
 END IF;
 IF original.scheduled_check_in IS NULL OR original.scheduled_check_out IS NULL THEN
   RAISE EXCEPTION 'Booking tidak memiliki jadwal resmi; perlu penanganan terpisah';
 END IF;

 -- Compare against ORIGINAL scheduled time; exactly 2h before is allowed.
 IF clock_timestamp()>original.scheduled_check_in - interval '2 hours' THEN
   RAISE EXCEPTION 'Perubahan jadwal wajib paling lambat 2 jam sebelum Check-in';
 END IF;
 IF _new_scheduled_check_in<clock_timestamp()+interval '2 hours' THEN
   RAISE EXCEPTION 'Jadwal baru harus sekurangnya 2 jam dari sekarang';
 END IF;

 SELECT calculated.scheduled_check_in,calculated.scheduled_check_out
 INTO proposed_check_in,proposed_check_out
 FROM public.calculate_scheduled_booking_times(original.package_id,_new_scheduled_check_in) AS calculated;
 IF proposed_check_in IS NULL OR proposed_check_out IS NULL
    OR proposed_check_out<=proposed_check_in THEN
   RAISE EXCEPTION 'Jadwal baru tidak valid untuk paket kamar';
 END IF;
 IF proposed_check_in=original.scheduled_check_in
    AND proposed_check_out=original.scheduled_check_out THEN
   RETURN 'NO_CHANGE';
 END IF;

 proposed_day_mode := public.get_operational_day_mode(
   (proposed_check_in AT TIME ZONE 'Asia/Jakarta')::date);
 -- Prevent implicit weekday/weekend reprice or silently changing DP.
 IF original.day_mode IS NULL
    OR proposed_day_mode IS DISTINCT FROM original.day_mode THEN
   RAISE EXCEPTION 'Perubahan kategori Weekday/Weekend mengubah harga: perlu proses Owner terpisah';
 END IF;

 SELECT r.active INTO room_active FROM public.rooms r
 WHERE r.id=original.room_id FOR UPDATE;
 IF room_active IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Kamar tidak aktif atau tidak tersedia';
 END IF;

 -- Serialize with reservation creation and forbid any Booking overlap.
 IF EXISTS (
   SELECT 1 FROM public.transactions other
   WHERE other.id<>original.id AND other.room_id=original.room_id
   AND (
     (other.status='booking' AND
       (other.scheduled_check_in IS NULL OR other.scheduled_check_out IS NULL
        OR (other.scheduled_check_in<proposed_check_out
         AND other.scheduled_check_out>proposed_check_in)))
     OR
     (other.status='check_in' AND
       (COALESCE(other.started_at,other.scheduled_check_in) IS NULL
        OR COALESCE(other.ends_at,other.scheduled_check_out) IS NULL
        OR (COALESCE(other.started_at,other.scheduled_check_in)<proposed_check_out
         AND COALESCE(other.ends_at,other.scheduled_check_out)>proposed_check_in)))
   )
 ) THEN
   RAISE EXCEPTION 'Jadwal kamar bentrok dengan Booking atau hunian aktif';
 END IF;

 SELECT COALESCE(SUM(p.amount),0) INTO gross_paid
 FROM public.payments p WHERE p.transaction_id=original.id;
 UPDATE public.transactions
 SET scheduled_check_in=proposed_check_in,scheduled_check_out=proposed_check_out
 WHERE id=original.id AND status='booking';
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking berubah saat proses perubahan jadwal'; END IF;

 INSERT INTO public.booking_owner_events(
   transaction_id,action,performed_by,confirmed_number,reason,prior_status,
   before_check_in,before_check_out,after_check_in,after_check_out,
   original_price_snapshot,received_amount_snapshot
 ) VALUES (
   original.id,'reschedule',actor,original.transaction_number,btrim(_reason),original.status,
   original.scheduled_check_in,original.scheduled_check_out,
   proposed_check_in,proposed_check_out,original.price_snapshot,gross_paid
 );
 INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,description)
 VALUES (actor,'booking_rescheduled','transaction',original.id,
   'Jadwal Booking diubah oleh Owner. Alasan: '||btrim(_reason));
 RETURN original.transaction_number;
END;
$reschedule$;

REVOKE ALL ON FUNCTION public.cancel_booking_owner(uuid,text,text,boolean)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reschedule_booking_owner(uuid,text,timestamptz,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_owner(uuid,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_booking_owner(uuid,text,timestamptz,text) TO authenticated;

COMMENT ON TABLE public.booking_owner_events IS
 'Baturaden 25 Homestay immutable Owner Booking cancellation/reschedule audit; private to Owner-authorized RPC.';
COMMIT;
