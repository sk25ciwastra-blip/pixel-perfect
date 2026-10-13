-- Create only official Baturaden 25 Homestay packages.
-- Prices are supplied by the Owner; operational timing is system-controlled.

CREATE OR REPLACE FUNCTION public.create_official_package(
  _name text,
  _description text,
  _active boolean,
  _weekday_price numeric,
  _weekend_price numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_package_id uuid;
  official_duration integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  CASE _name
    WHEN 'Paket Pagi' THEN official_duration := 450;
    WHEN 'Paket Malam' THEN official_duration := 600;
    WHEN 'Paket Harian' THEN official_duration := 1380;
    WHEN 'Paket 2 Jam' THEN official_duration := 120;
    WHEN 'Paket 4 Jam' THEN official_duration := 240;
    WHEN 'Paket 6 Jam' THEN official_duration := 360;
    WHEN 'Paket 12 Jam' THEN official_duration := 720;
    WHEN 'Paket 24 Jam' THEN official_duration := 1440;
    WHEN 'Paket Mingguan' THEN official_duration := 10080;
    ELSE
      RAISE EXCEPTION 'Jenis paket tidak termasuk katalog resmi Baturaden 25 Homestay';
  END CASE;

  IF _weekday_price IS NULL
     OR _weekday_price < 0
     OR _weekend_price IS NULL
     OR _weekend_price < 0 THEN
    RAISE EXCEPTION 'Harga paket tidak valid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.packages
    WHERE name = _name
  ) THEN
    RAISE EXCEPTION 'Paket resmi ini sudah tersedia';
  END IF;

  INSERT INTO public.packages (
    name,
    duration_minutes,
    description,
    active,
    price,
    weekday_price,
    weekend_price
  )
  VALUES (
    _name,
    official_duration,
    COALESCE(_description, ''),
    _active,
    _weekday_price,
    _weekday_price,
    _weekend_price
  )
  RETURNING id INTO new_package_id;

  PERFORM public.apply_official_package_timing(
    new_package_id,
    _name
  );

  RETURN new_package_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_official_package(
  text, text, boolean, numeric, numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_official_package(
  text, text, boolean, numeric, numeric
) TO authenticated;
