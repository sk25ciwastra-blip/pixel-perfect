-- Dual Weekday/Weekend package price history.
-- Keep legacy packages.price synchronized with weekday_price for compatibility.

ALTER TABLE public.package_price_history
  ADD COLUMN IF NOT EXISTS price_type text;

UPDATE public.package_price_history
SET price_type = 'legacy'
WHERE price_type IS NULL;

ALTER TABLE public.package_price_history
  ALTER COLUMN price_type SET NOT NULL;

ALTER TABLE public.package_price_history
  DROP CONSTRAINT IF EXISTS package_price_history_price_type_check;

ALTER TABLE public.package_price_history
  ADD CONSTRAINT package_price_history_price_type_check
  CHECK (price_type IN ('legacy', 'weekday', 'weekend'));

CREATE OR REPLACE FUNCTION public.audit_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid;
  reason_text text;
BEGIN
  actor := auth.uid();
  reason_text := COALESCE(
    NULLIF(current_setting('app.price_reason', true), ''),
    'Perubahan harga'
  );

  IF TG_TABLE_NAME = 'packages' AND TG_OP = 'UPDATE' THEN
    IF OLD.weekday_price IS DISTINCT FROM NEW.weekday_price THEN
      INSERT INTO public.package_price_history(
        package_id,
        old_price,
        new_price,
        price_type,
        reason,
        changed_by
      )
      VALUES (
        NEW.id,
        OLD.weekday_price,
        NEW.weekday_price,
        'weekday',
        reason_text,
        actor
      );
    END IF;

    IF OLD.weekend_price IS DISTINCT FROM NEW.weekend_price THEN
      INSERT INTO public.package_price_history(
        package_id,
        old_price,
        new_price,
        price_type,
        reason,
        changed_by
      )
      VALUES (
        NEW.id,
        OLD.weekend_price,
        NEW.weekend_price,
        'weekend',
        reason_text,
        actor
      );
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs(
      user_id,
      action,
      entity_type,
      entity_id,
      description
    )
    VALUES (
      actor,
      'buat',
      TG_TABLE_NAME,
      NEW.id,
      'Data dibuat'
    );
  ELSE
    INSERT INTO public.activity_logs(
      user_id,
      action,
      entity_type,
      entity_id,
      description
    )
    VALUES (
      actor,
      'ubah',
      TG_TABLE_NAME,
      NEW.id,
      'Data diubah'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.change_package_price(uuid, numeric, text);

CREATE OR REPLACE FUNCTION public.change_package_prices(
  _package_id uuid,
  _weekday_price numeric,
  _weekend_price numeric,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  IF _weekday_price < 0
     OR _weekend_price < 0
     OR length(trim(COALESCE(_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Harga Weekday, Weekend, dan alasan wajib diisi';
  END IF;

  PERFORM set_config('app.price_reason', trim(_reason), true);

  UPDATE public.packages
  SET
    weekday_price = _weekday_price,
    weekend_price = _weekend_price,
    price = _weekday_price
  WHERE id = _package_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paket tidak ditemukan';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.change_package_prices(uuid, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_package_prices(uuid, numeric, numeric, text) TO authenticated;
