-- Task 4: Duration package booking schedule guard fix
-- Baturaden 25 Homestay
--
-- P2/P4/P6 menggunakan duration_midnight_cap.
-- P12/P24 menggunakan duration.
-- Keduanya adalah keluarga paket berbasis durasi dan booking
-- tidak boleh check-in sebelum scheduled_check_in.

CREATE OR REPLACE FUNCTION public.check_in_booking(
  _transaction_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_transaction record;
  selected_package record;
  actual_started_at timestamptz;
  actual_ends_at timestamptz;
  already_paid numeric(12,2);
  jakarta_now timestamp;
  scheduled_local timestamp;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'owner')
    OR public.is_receptionist(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT
    id,
    transaction_number,
    guest_id,
    room_id,
    package_id,
    status,
    price_snapshot,
    day_mode,
    scheduled_check_in
  INTO selected_transaction
  FROM public.transactions
  WHERE id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan';
  END IF;

  IF selected_transaction.status <> 'booking' THEN
    RAISE EXCEPTION 'Transaksi tidak dapat di-check-in';
  END IF;

  IF selected_transaction.guest_id IS NULL
     OR selected_transaction.room_id IS NULL
     OR selected_transaction.package_id IS NULL THEN
    RAISE EXCEPTION 'Data transaksi tidak lengkap';
  END IF;

  IF selected_transaction.scheduled_check_in IS NULL THEN
    RAISE EXCEPTION 'Jadwal check-in booking belum ditentukan';
  END IF;

  IF selected_transaction.day_mode IS NULL
     OR selected_transaction.day_mode NOT IN ('weekday', 'weekend') THEN
    RAISE EXCEPTION 'Weekday/Weekend transaksi belum ditentukan';
  END IF;

  IF selected_transaction.price_snapshot IS NULL
     OR selected_transaction.price_snapshot < 0 THEN
    RAISE EXCEPTION 'Harga transaksi belum tersimpan';
  END IF;

  SELECT
    p.id,
    p.name,
    p.time_mode
  INTO selected_package
  FROM public.packages p
  WHERE p.id = selected_transaction.package_id
    AND p.active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paket tidak tersedia';
  END IF;

  jakarta_now := now() AT TIME ZONE 'Asia/Jakarta';
  scheduled_local :=
    selected_transaction.scheduled_check_in AT TIME ZONE 'Asia/Jakarta';

  -- Semua booking tidak boleh check-in pada tanggal
  -- yang lebih awal daripada tanggal reservasinya.
  IF jakarta_now::date < scheduled_local::date THEN
    RAISE EXCEPTION
      'Belum waktunya check-in. Jadwal booking belum tiba';
  END IF;

  -- Semua paket berbasis durasi mengikuti scheduled_check_in.
  -- P2/P4/P6 = duration_midnight_cap
  -- P12/P24  = duration
  IF selected_package.time_mode IN (
       'duration',
       'duration_midnight_cap'
     )
     AND jakarta_now < scheduled_local THEN
    RAISE EXCEPTION
      'Belum waktunya check-in. Check-in tersedia mulai % WIB',
      to_char(scheduled_local, 'DD-MM-YYYY HH24:MI');
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO already_paid
  FROM public.payments
  WHERE transaction_id = selected_transaction.id;

  IF already_paid < selected_transaction.price_snapshot THEN
    RAISE EXCEPTION
      'Sisa pembayaran harus dilunasi sebelum check-in';
  END IF;

  IF already_paid > selected_transaction.price_snapshot THEN
    RAISE EXCEPTION
      'Total pembayaran melebihi tagihan transaksi';
  END IF;

  SELECT t.started_at, t.ends_at
  INTO actual_started_at, actual_ends_at
  FROM public.calculate_package_stay_times(
    selected_transaction.package_id,
    now()
  ) t;

  UPDATE public.rooms
  SET status = 'occupied'
  WHERE id = selected_transaction.room_id
    AND status = 'ready'
    AND active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kamar tidak tersedia';
  END IF;

  UPDATE public.transactions
  SET
    status = 'check_in',
    started_at = actual_started_at,
    ends_at = actual_ends_at
  WHERE id = selected_transaction.id;

  RETURN selected_transaction.transaction_number;
END;
$$;

REVOKE ALL ON FUNCTION public.check_in_booking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid) TO authenticated;