-- Guard the official Baturaden 25 Homestay package catalog.
-- Official package names and operational timing rules are system-controlled.
-- Owner may manage prices, description, and active status.
-- This migration does not create missing packages and does not invent prices.

CREATE OR REPLACE FUNCTION public.apply_official_package_timing(
  _package_id uuid,
  _package_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE _package_name
    WHEN 'Paket Pagi' THEN
      UPDATE public.packages
      SET
        duration_minutes = 450,
        time_mode = 'fixed_window',
        slot_start_time = TIME '08:30',
        checkin_start_time = TIME '08:00',
        checkin_end_time = TIME '12:00',
        checkout_time = TIME '16:00'
      WHERE id = _package_id;

    WHEN 'Paket Malam' THEN
      UPDATE public.packages
      SET
        duration_minutes = 600,
        time_mode = 'fixed_window',
        slot_start_time = TIME '22:00',
        checkin_start_time = TIME '21:30',
        checkin_end_time = TIME '04:00',
        checkout_time = TIME '08:00'
      WHERE id = _package_id;

    WHEN 'Paket Harian' THEN
      UPDATE public.packages
      SET
        duration_minutes = 1380,
        time_mode = 'fixed_window',
        slot_start_time = TIME '13:00',
        checkin_start_time = TIME '12:00',
        checkin_end_time = TIME '04:00',
        checkout_time = TIME '12:00'
      WHERE id = _package_id;

    WHEN 'Paket 2 Jam' THEN
      UPDATE public.packages
      SET
        duration_minutes = 120,
        time_mode = 'duration_midnight_cap',
        slot_start_time = NULL,
        checkin_start_time = TIME '06:00',
        checkin_end_time = TIME '23:30',
        checkout_time = NULL
      WHERE id = _package_id;

    WHEN 'Paket 4 Jam' THEN
      UPDATE public.packages
      SET
        duration_minutes = 240,
        time_mode = 'duration_midnight_cap',
        slot_start_time = NULL,
        checkin_start_time = TIME '06:00',
        checkin_end_time = TIME '22:30',
        checkout_time = NULL
      WHERE id = _package_id;

    WHEN 'Paket 6 Jam' THEN
      UPDATE public.packages
      SET
        duration_minutes = 360,
        time_mode = 'duration_midnight_cap',
        slot_start_time = NULL,
        checkin_start_time = TIME '04:30',
        checkin_end_time = TIME '19:30',
        checkout_time = NULL
      WHERE id = _package_id;

    WHEN 'Paket 12 Jam' THEN
      UPDATE public.packages
      SET
        duration_minutes = 720,
        time_mode = 'duration',
        slot_start_time = NULL,
        checkin_start_time = NULL,
        checkin_end_time = NULL,
        checkout_time = NULL
      WHERE id = _package_id;

    WHEN 'Paket 24 Jam' THEN
      UPDATE public.packages
      SET
        duration_minutes = 1440,
        time_mode = 'duration',
        slot_start_time = NULL,
        checkin_start_time = NULL,
        checkin_end_time = NULL,
        checkout_time = NULL
      WHERE id = _package_id;

    WHEN 'Paket Mingguan' THEN
      UPDATE public.packages
      SET
        duration_minutes = 10080,
        time_mode = 'fixed_days_checkout',
        slot_start_time = NULL,
        checkin_start_time = NULL,
        checkin_end_time = NULL,
        checkout_time = TIME '12:00'
      WHERE id = _package_id;

    ELSE
      RAISE EXCEPTION 'Jenis paket tidak termasuk katalog resmi Baturaden 25 Homestay';
  END CASE;
END;
$$;


CREATE OR REPLACE FUNCTION public.update_package(
  _package_id uuid,
  _name text,
  _duration_minutes integer,
  _description text,
  _active boolean,
  _weekday_price numeric,
  _weekend_price numeric,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_package record;
  price_changed boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT *
  INTO current_package
  FROM public.packages
  WHERE id = _package_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paket tidak ditemukan';
  END IF;

  IF current_package.name NOT IN (
    'Paket Pagi',
    'Paket Malam',
    'Paket Harian',
    'Paket 2 Jam',
    'Paket 4 Jam',
    'Paket 6 Jam',
    'Paket 12 Jam',
    'Paket 24 Jam',
    'Paket Mingguan'
  ) THEN
    RAISE EXCEPTION 'Paket tidak termasuk katalog resmi Baturaden 25 Homestay';
  END IF;

  -- Official package identity cannot be renamed through this RPC.
  IF trim(COALESCE(_name, '')) <> current_package.name THEN
    RAISE EXCEPTION 'Nama paket resmi tidak dapat diubah';
  END IF;

  IF _weekday_price IS NULL
     OR _weekday_price < 0
     OR _weekend_price IS NULL
     OR _weekend_price < 0 THEN
    RAISE EXCEPTION 'Harga paket tidak valid';
  END IF;

  price_changed :=
    current_package.weekday_price IS DISTINCT FROM _weekday_price
    OR current_package.weekend_price IS DISTINCT FROM _weekend_price;

  IF price_changed AND length(trim(COALESCE(_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Alasan perubahan harga wajib diisi';
  END IF;

  IF price_changed THEN
    PERFORM set_config('app.price_reason', trim(_reason), true);
  END IF;

  -- Ignore client-provided duration. Duration and timing are controlled
  -- by the official package rule below.
  UPDATE public.packages
  SET
    description = COALESCE(_description, ''),
    active = _active,
    weekday_price = _weekday_price,
    weekend_price = _weekend_price,
    price = _weekday_price
  WHERE id = _package_id;

  PERFORM public.apply_official_package_timing(
    _package_id,
    current_package.name
  );
END;
$$;


REVOKE ALL ON FUNCTION public.apply_official_package_timing(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_official_package_timing(uuid, text) FROM authenticated;

REVOKE ALL ON FUNCTION public.update_package(
  uuid, text, integer, text, boolean, numeric, numeric, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_package(
  uuid, text, integer, text, boolean, numeric, numeric, text
) TO authenticated;


-- Normalize timing only for official packages that already exist.
-- Missing official packages are intentionally NOT created here because
-- their real Weekday/Weekend prices have not been supplied yet.

DO $$
DECLARE
  pkg record;
BEGIN
  FOR pkg IN
    SELECT id, name
    FROM public.packages
    WHERE name IN (
      'Paket Pagi',
      'Paket Malam',
      'Paket Harian',
      'Paket 2 Jam',
      'Paket 4 Jam',
      'Paket 6 Jam',
      'Paket 12 Jam',
      'Paket 24 Jam',
      'Paket Mingguan'
    )
  LOOP
    PERFORM public.apply_official_package_timing(pkg.id, pkg.name);
  END LOOP;
END;
$$;
