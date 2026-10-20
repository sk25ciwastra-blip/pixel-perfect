-- Task 4: Require full payment before checking in a booking
-- Baturaden 25 Homestay

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
  actual_started_at timestamptz;
  actual_ends_at timestamptz;
  already_paid numeric(12,2);
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
    day_mode
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

  IF selected_transaction.day_mode IS NULL
     OR selected_transaction.day_mode NOT IN ('weekday', 'weekend') THEN
    RAISE EXCEPTION 'Weekday/Weekend transaksi belum ditentukan';
  END IF;

  IF selected_transaction.price_snapshot IS NULL
     OR selected_transaction.price_snapshot < 0 THEN
    RAISE EXCEPTION 'Harga transaksi belum tersimpan';
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