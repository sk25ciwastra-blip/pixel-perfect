-- Task 1.5A-3: Reservation/check-in RPCs using weekday/weekend pricing
-- and the central package time engine.

DROP FUNCTION IF EXISTS public.create_reservation(
  text, uuid, uuid, text, text, text, numeric, text
);

CREATE OR REPLACE FUNCTION public.create_reservation(
  _mode text,
  _room_id uuid,
  _package_id uuid,
  _name text,
  _phone text,
  _address text,
  _amount numeric,
  _method text,
  _day_mode text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_price numeric(12,2);
  selected_guest uuid;
  selected_transaction uuid;
  number text;
  actual_started_at timestamptz;
  actual_ends_at timestamptz;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'owner')
    OR public.is_receptionist(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  IF _mode IS NULL OR _mode NOT IN ('booking', 'check_in') THEN
    RAISE EXCEPTION 'Jenis transaksi tidak valid';
  END IF;

  IF _method IS NULL OR _method NOT IN ('Cash', 'QRIS', 'Transfer') THEN
    RAISE EXCEPTION 'Metode pembayaran tidak valid';
  END IF;

  IF _day_mode IS NULL OR _day_mode NOT IN ('weekday', 'weekend') THEN
    RAISE EXCEPTION 'Pilihan Weekday/Weekend tidak valid';
  END IF;

  IF length(trim(coalesce(_name, ''))) NOT BETWEEN 1 AND 100
     OR coalesce(_phone, '') !~ '^[0-9+]{8,16}$'
     OR length(coalesce(_address, '')) > 500 THEN
    RAISE EXCEPTION 'Data tamu tidak valid';
  END IF;

  SELECT
    CASE
      WHEN _day_mode = 'weekday' THEN p.weekday_price
      WHEN _day_mode = 'weekend' THEN p.weekend_price
    END
  INTO selected_price
  FROM public.packages p
  WHERE p.id = _package_id
    AND p.active;

  IF NOT FOUND OR selected_price IS NULL THEN
    RAISE EXCEPTION 'Paket atau harga tidak tersedia';
  END IF;

  IF _amount IS NULL OR _amount < 0 OR _amount > selected_price THEN
    RAISE EXCEPTION 'Nominal pembayaran tidak valid';
  END IF;

  IF _mode = 'check_in' THEN
    SELECT t.started_at, t.ends_at
    INTO actual_started_at, actual_ends_at
    FROM public.calculate_package_stay_times(_package_id, now()) t;

    UPDATE public.rooms
    SET status = 'occupied'
    WHERE id = _room_id
      AND status = 'ready'
      AND active
      AND NOT EXISTS (
        SELECT 1
        FROM public.transactions
        WHERE room_id = _room_id
          AND status = 'booking'
      );

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Kamar tidak tersedia atau telah dipesan';
    END IF;
  ELSE
    PERFORM 1
    FROM public.rooms
    WHERE id = _room_id
      AND status = 'ready'
      AND active
    FOR UPDATE;

    IF NOT FOUND OR EXISTS (
      SELECT 1
      FROM public.transactions
      WHERE room_id = _room_id
        AND status = 'booking'
    ) THEN
      RAISE EXCEPTION 'Kamar tidak tersedia atau telah dipesan';
    END IF;
  END IF;

  SELECT id
  INTO selected_guest
  FROM public.guests
  WHERE phone = _phone;

  IF selected_guest IS NULL THEN
    IF length(trim(coalesce(_address, ''))) = 0 THEN
      RAISE EXCEPTION 'Alamat wajib diisi untuk tamu baru';
    END IF;

    INSERT INTO public.guests (
      full_name,
      address,
      phone
    )
    VALUES (
      trim(_name),
      trim(_address),
      _phone
    )
    RETURNING id INTO selected_guest;
  END IF;

  INSERT INTO public.transactions (
    guest_id,
    room_id,
    package_id,
    status,
    created_by,
    price_snapshot,
    day_mode,
    started_at,
    ends_at
  )
  VALUES (
    selected_guest,
    _room_id,
    _package_id,
    _mode::public.transaction_status,
    auth.uid(),
    selected_price,
    _day_mode,
    CASE WHEN _mode = 'check_in' THEN actual_started_at END,
    CASE WHEN _mode = 'check_in' THEN actual_ends_at END
  )
  RETURNING id, transaction_number
  INTO selected_transaction, number;

  IF _amount > 0 THEN
    INSERT INTO public.payments (
      transaction_id,
      amount,
      method,
      kind,
      recorded_by
    )
    VALUES (
      selected_transaction,
      _amount,
      _method,
      CASE WHEN _mode = 'booking' THEN 'dp' ELSE 'payment' END,
      auth.uid()
    );
  END IF;

  RETURN number;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reservation(
  text, uuid, uuid, text, text, text, numeric, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_reservation(
  text, uuid, uuid, text, text, text, numeric, text, text
) TO authenticated;


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

  IF selected_transaction.price_snapshot IS NULL THEN
    RAISE EXCEPTION 'Harga transaksi belum tersimpan';
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
