-- Task 4: Duration package early check-in correction
-- Baturaden 25 Homestay
--
-- P2/P4/P6/P12/P24 adalah paket berbasis durasi.
-- Booking paket durasi boleh check-in lebih awal pada tanggal reservasi
-- yang sama selama kamar tersedia.
-- Waktu checkout aktual dihitung dari waktu check-in aktual
-- oleh calculate_package_stay_times().
--
-- Booking tetap tidak boleh check-in pada tanggal sebelum
-- tanggal reservasinya.

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

  -- Booking tidak boleh digunakan pada tanggal sebelum
  -- tanggal reservasinya.
  IF jakarta_now::date < scheduled_local::date THEN
    RAISE EXCEPTION
      'Belum waktunya check-in. Jadwal booking belum tiba';
  END IF;

  -- Paket berbasis durasi (P2/P4/P6/P12/P24) sengaja TIDAK
  -- dibatasi oleh jam scheduled_check_in pada tanggal reservasi.
  -- Jika kamar masih ready, check-in lebih awal diperbolehkan.
  -- started_at dan ends_at dihitung dari waktu check-in aktual.

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