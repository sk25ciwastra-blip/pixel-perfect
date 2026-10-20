-- Task 4: Secure reservation pricing by room pricing group
-- Baturaden 25 Homestay
--
-- The browser no longer determines the transaction total.
-- Official price is resolved by:
-- room -> room type -> pricing group -> package -> day mode
--
-- _amount remains the amount actually paid (DP/payment).
-- transactions.price_snapshot stores the official resolved total.

BEGIN;

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
  selected_pricing_group text;
  selected_guest uuid;
  selected_transaction uuid;
  number text;
  actual_started_at timestamptz;
  actual_ends_at timestamptz;
BEGIN

  -- ==========================================================
  -- 1. Access control
  -- ==========================================================

  IF NOT (
    public.has_role(auth.uid(), 'owner')
    OR public.is_receptionist(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;


  -- ==========================================================
  -- 2. Basic validation
  -- ==========================================================

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


  -- ==========================================================
  -- 3. Resolve official price from the room type
  --
  -- room
  --   -> room_types.pricing_group
  --   -> package_room_type_prices
  --   -> weekday/weekend official price
  -- ==========================================================

  SELECT
    rt.pricing_group,
    CASE
      WHEN _day_mode = 'weekday' THEN pr.weekday_price
      WHEN _day_mode = 'weekend' THEN pr.weekend_price
    END
  INTO
    selected_pricing_group,
    selected_price
  FROM public.rooms r
  JOIN public.room_types rt
    ON rt.id = r.room_type_id
  JOIN public.packages p
    ON p.id = _package_id
   AND p.active
  JOIN public.package_room_type_prices pr
    ON pr.package_id = p.id
   AND pr.pricing_group = rt.pricing_group
  WHERE r.id = _room_id;

  IF NOT FOUND
     OR selected_pricing_group IS NULL
     OR selected_price IS NULL THEN
    RAISE EXCEPTION
      'Harga resmi untuk kombinasi kamar dan paket tidak tersedia';
  END IF;


  -- ==========================================================
  -- 4. Validate actual payment amount
  --
  -- _amount is NOT the transaction price.
  -- It is only the amount paid now.
  -- ==========================================================

  IF _amount IS NULL
     OR _amount < 0
     OR _amount > selected_price THEN
    RAISE EXCEPTION 'Nominal pembayaran tidak valid';
  END IF;


  -- ==========================================================
  -- 5. Room availability and stay timing
  -- ==========================================================

  IF _mode = 'check_in' THEN

    SELECT
      t.started_at,
      t.ends_at
    INTO
      actual_started_at,
      actual_ends_at
    FROM public.calculate_package_stay_times(
      _package_id,
      now()
    ) t;

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


  -- ==========================================================
  -- 6. Find or create guest
  -- ==========================================================

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
    RETURNING id
    INTO selected_guest;

  END IF;


  -- ==========================================================
  -- 7. Create transaction
  --
  -- price_snapshot is always the official database price.
  -- ==========================================================

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
    CASE
      WHEN _mode = 'check_in' THEN actual_started_at
    END,
    CASE
      WHEN _mode = 'check_in' THEN actual_ends_at
    END
  )
  RETURNING
    id,
    transaction_number
  INTO
    selected_transaction,
    number;


  -- ==========================================================
  -- 8. Record initial payment
  --
  -- Booking  -> DP
  -- Check-in -> Payment
  -- ==========================================================

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
      CASE
        WHEN _mode = 'booking' THEN 'dp'
        ELSE 'payment'
      END,
      auth.uid()
    );

  END IF;


  RETURN number;

END;
$$;


-- ============================================================
-- 9. RPC permissions
-- ============================================================

REVOKE ALL ON FUNCTION public.create_reservation(
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  numeric,
  text,
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_reservation(
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  numeric,
  text,
  text
) TO authenticated;


COMMIT;