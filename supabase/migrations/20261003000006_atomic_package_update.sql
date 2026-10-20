-- Atomic package update.
-- Metadata and Weekday/Weekend prices are changed in one database transaction.

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

  IF length(trim(COALESCE(_name, ''))) = 0
     OR _duration_minutes IS NULL
     OR _duration_minutes <= 0
     OR _weekday_price IS NULL
     OR _weekday_price < 0
     OR _weekend_price IS NULL
     OR _weekend_price < 0 THEN
    RAISE EXCEPTION 'Data paket tidak valid';
  END IF;

  SELECT *
  INTO current_package
  FROM public.packages
  WHERE id = _package_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paket tidak ditemukan';
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

  UPDATE public.packages
  SET
    name = trim(_name),
    duration_minutes = _duration_minutes,
    description = _description,
    active = _active,
    weekday_price = _weekday_price,
    weekend_price = _weekend_price,
    price = _weekday_price
  WHERE id = _package_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_package(
  uuid, text, integer, text, boolean, numeric, numeric, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_package(
  uuid, text, integer, text, boolean, numeric, numeric, text
) TO authenticated;
