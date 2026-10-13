-- Task 4: Interval booking availability
-- Baturaden 25 Homestay
--
-- A room may have multiple future bookings as long as their
-- scheduled time intervals do not overlap.
--
-- Overlap rule:
-- existing_start < new_end
-- AND
-- existing_end > new_start
--
-- Adjacent bookings are allowed:
-- 10:00-12:00 followed by 12:00-14:00 is NOT an overlap.

BEGIN;


-- ============================================================
-- 1. Replace create_reservation with interval availability
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_reservation(
  _mode text,
  _room_id uuid,
  _package_id uuid,
  _name text,
  _phone text,
  _address text,
  _amount numeric,
  _method text,
  _day_mode text,
  _scheduled_check_in timestamptz DEFAULT NULL
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

  planned_check_in timestamptz;
  planned_check_out timestamptz;
BEGIN

  -- ==========================================================
  -- 2. Access control
  -- ==========================================================

  IF NOT (
    public.has_role(auth.uid(), 'owner')
    OR public.is_receptionist(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;


  -- ==========================================================
  -- 3. Basic validation
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

  IF _mode = 'booking' AND _scheduled_check_in IS NULL THEN
    RAISE EXCEPTION 'Tanggal dan jam check-in wajib dipilih untuk booking';
  END IF;


  -- ==========================================================
  -- 4. Resolve official price
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
  -- 5. Payment validation
  -- ==========================================================

  IF _amount IS NULL
     OR _amount < 0
     OR _amount > selected_price THEN
    RAISE EXCEPTION 'Nominal pembayaran tidak valid';
  END IF;

  IF _mode = 'check_in' AND _amount <> selected_price THEN
    RAISE EXCEPTION 'Check-in langsung harus dibayar lunas';
  END IF;


  -- ==========================================================
  -- 6. Calculate planned or actual stay
  -- ==========================================================

  IF _mode = 'booking' THEN

    SELECT
      t.scheduled_check_in,
      t.scheduled_check_out
    INTO
      planned_check_in,
      planned_check_out
    FROM public.calculate_scheduled_booking_times(
      _package_id,
      _scheduled_check_in
    ) t;

    IF planned_check_in IS NULL
       OR planned_check_out IS NULL
       OR planned_check_out <= planned_check_in THEN
      RAISE EXCEPTION 'Jadwal booking tidak valid';
    END IF;

  ELSE

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

  END IF;


  -- ==========================================================
  -- 7. Lock and validate room
  -- ==========================================================

  PERFORM 1
  FROM public.rooms
  WHERE id = _room_id
    AND active
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kamar tidak aktif atau tidak tersedia';
  END IF;


  -- ==========================================================
  -- 8. Availability
  -- ==========================================================

  IF _mode = 'booking' THEN

    -- Future booking only requires a valid operational room.
    -- Current physical occupancy does not block a future slot.
    --
    -- Reject only another scheduled booking whose interval
    -- overlaps the requested interval.

    IF EXISTS (
      SELECT 1
      FROM public.transactions tr
      WHERE tr.room_id = _room_id
        AND tr.status = 'booking'
        AND tr.scheduled_check_in IS NOT NULL
        AND tr.scheduled_check_out IS NOT NULL
        AND tr.scheduled_check_in < planned_check_out
        AND tr.scheduled_check_out > planned_check_in
    ) THEN
      RAISE EXCEPTION 'Jadwal kamar bentrok dengan booking lain';
    END IF;

  ELSE

    -- Direct check-in concerns physical occupancy NOW.
    -- A room must actually be ready before it can be occupied.
    --
    -- Future non-overlapping bookings no longer lock the room
    -- for the entire day.

    UPDATE public.rooms
    SET status = 'occupied'
    WHERE id = _room_id
      AND status = 'ready'
      AND active;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Kamar tidak tersedia untuk check-in';
    END IF;

    -- Direct check-in must also not consume time already reserved
    -- by a scheduled booking.

    IF EXISTS (
      SELECT 1
      FROM public.transactions tr
      WHERE tr.room_id = _room_id
        AND tr.status = 'booking'
        AND tr.scheduled_check_in IS NOT NULL
        AND tr.scheduled_check_out IS NOT NULL
        AND tr.scheduled_check_in < actual_ends_at
        AND tr.scheduled_check_out > actual_started_at
    ) THEN
      RAISE EXCEPTION
        'Waktu check-in bentrok dengan booking terjadwal';
    END IF;

  END IF;


  -- ==========================================================
  -- 9. Find or create guest
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
  -- 10. Create transaction
  -- ==========================================================

  INSERT INTO public.transactions (
    guest_id,
    room_id,
    package_id,
    status,
    created_by,
    price_snapshot,
    day_mode,
    scheduled_check_in,
    scheduled_check_out,
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
      WHEN _mode = 'booking' THEN planned_check_in
    END,

    CASE
      WHEN _mode = 'booking' THEN planned_check_out
    END,

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
  -- 11. Record initial payment
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
-- 12. RPC permissions
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
  text,
  timestamptz
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
  text,
  timestamptz
) TO authenticated;


COMMIT;