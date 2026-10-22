-- P0: authoritative Booking check-in time enforcement.
--
-- Duration packages may check in early.  Early check-in consumes the
-- official duration from the server time; on-time and late check-in keep the
-- scheduled checkout.  Fixed-window/fixed-day packages retain the canonical
-- package time engine rules.

BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.check_in_booking(uuid)') IS NULL
     OR to_regprocedure('public.calculate_package_stay_times(uuid,timestamptz)') IS NULL
     OR to_regclass('public.transactions') IS NULL
     OR to_regclass('public.rooms') IS NULL
     OR to_regclass('public.packages') IS NULL
     OR to_regclass('public.payments') IS NULL THEN
    RAISE EXCEPTION 'Booking time enforcement dependencies are incomplete';
  END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.check_in_booking(_transaction_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_transaction record;
  selected_package record;
  actual_started_at timestamptz;
  actual_ends_at timestamptz;
  already_paid numeric(12,2);
  server_now timestamptz := now();
  is_duration_package boolean;
BEGIN
  IF NOT public.finance_is_booking_operator(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT
    t.id,
    t.transaction_number,
    t.guest_id,
    t.room_id,
    t.package_id,
    t.status,
    t.price_snapshot,
    t.day_mode,
    t.scheduled_check_in,
    t.scheduled_check_out
  INTO selected_transaction
  FROM public.transactions t
  WHERE t.id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  IF selected_transaction.status <> 'booking' THEN
    RAISE EXCEPTION 'Transaksi tidak dapat di-check-in';
  END IF;
  IF selected_transaction.guest_id IS NULL
     OR selected_transaction.room_id IS NULL
     OR selected_transaction.package_id IS NULL THEN
    RAISE EXCEPTION 'Data transaksi tidak lengkap';
  END IF;
  IF selected_transaction.scheduled_check_in IS NULL
     OR selected_transaction.scheduled_check_out IS NULL
     OR selected_transaction.scheduled_check_out <= selected_transaction.scheduled_check_in THEN
    RAISE EXCEPTION 'Jadwal check-in/check-out booking belum valid';
  END IF;
  IF selected_transaction.day_mode IS NULL
     OR selected_transaction.day_mode NOT IN ('weekday', 'weekend') THEN
    RAISE EXCEPTION 'Weekday/Weekend transaksi belum ditentukan';
  END IF;
  IF selected_transaction.price_snapshot IS NULL
     OR selected_transaction.price_snapshot < 0 THEN
    RAISE EXCEPTION 'Harga transaksi belum tersimpan';
  END IF;

  SELECT p.id, p.name, p.time_mode, p.duration_minutes
  INTO selected_package
  FROM public.packages p
  WHERE p.id = selected_transaction.package_id
    AND p.active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paket tidak tersedia'; END IF;

  -- The boundary is strict: at scheduled checkout, the booking is expired.
  IF server_now >= selected_transaction.scheduled_check_out THEN
    RAISE EXCEPTION 'Booking sudah kedaluwarsa pada batas checkout';
  END IF;

  is_duration_package := selected_package.time_mode IN ('duration', 'duration_midnight_cap');
  actual_started_at := server_now;

  IF is_duration_package THEN
    IF server_now < selected_transaction.scheduled_check_in THEN
      -- The canonical engine still enforces the official package window and
      -- midnight cap for P2/P4/P6. Only the start timestamp is server_now.
      SELECT t.ends_at
      INTO actual_ends_at
      FROM public.calculate_package_stay_times(selected_transaction.package_id, server_now) t;
    ELSE
      actual_ends_at := selected_transaction.scheduled_check_out;
    END IF;
  ELSE
    -- Pagi, Malam, Harian, and Mingguan keep their approved package rules.
    SELECT t.ends_at
    INTO actual_ends_at
    FROM public.calculate_package_stay_times(selected_transaction.package_id, server_now) t;
  END IF;

  IF actual_ends_at IS NULL OR actual_ends_at <= actual_started_at THEN
    RAISE EXCEPTION 'Waktu checkout hasil check-in tidak valid';
  END IF;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO already_paid
  FROM public.payments p
  WHERE p.transaction_id = selected_transaction.id;
  IF already_paid < selected_transaction.price_snapshot THEN
    RAISE EXCEPTION 'Sisa pembayaran harus dilunasi sebelum check-in';
  END IF;
  IF already_paid > selected_transaction.price_snapshot THEN
    RAISE EXCEPTION 'Total pembayaran melebihi tagihan transaksi';
  END IF;

  -- Lock the physical room before checking intervals. This serializes two
  -- operators attempting to check in the same room.
  PERFORM 1
  FROM public.rooms r
  WHERE r.id = selected_transaction.room_id
    AND r.active
    AND r.status = 'ready'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak tersedia'; END IF;

  -- A current stay or a following booking may not overlap the actual stay
  -- that this check-in would create.
  IF EXISTS (
    SELECT 1
    FROM public.transactions tr
    WHERE tr.room_id = selected_transaction.room_id
      AND tr.id <> selected_transaction.id
      AND (
        (tr.status = 'booking'
          AND tr.scheduled_check_in IS NOT NULL
          AND tr.scheduled_check_out IS NOT NULL
          AND tr.scheduled_check_in < actual_ends_at
          AND tr.scheduled_check_out > actual_started_at)
        OR
        (tr.status = 'check_in'
          AND tr.started_at IS NOT NULL
          AND tr.ends_at IS NOT NULL
          AND tr.started_at < actual_ends_at
          AND tr.ends_at > actual_started_at)
      )
  ) THEN
    RAISE EXCEPTION 'Jadwal kamar bentrok dengan transaksi lain';
  END IF;

  UPDATE public.rooms
  SET status = 'occupied'
  WHERE id = selected_transaction.room_id
    AND status = 'ready'
    AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak tersedia'; END IF;

  UPDATE public.transactions
  SET status = 'check_in',
      started_at = actual_started_at,
      ends_at = actual_ends_at
  WHERE id = selected_transaction.id
    AND status = 'booking';
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking sudah diproses oleh operator lain'; END IF;

  RETURN selected_transaction.transaction_number;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_in_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid) TO authenticated;

DO $postcheck$
BEGIN
  IF to_regprocedure('public.check_in_booking(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Booking time enforcement function was not installed';
  END IF;
END
$postcheck$;

COMMIT;
