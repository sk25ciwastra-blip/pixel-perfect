-- Baturaden 25 Homestay: Owner-only update of a package price for ONE room pricing group.
-- PENDING REVIEW: DO NOT execute automatically; NEVER updates transaction price_snapshot.
-- Existing package_room_type_prices row + activity_logs are reused. No extra table.
CREATE OR REPLACE FUNCTION public.update_package_room_type_price(
  _package_id uuid, _pricing_group text, _weekday_price numeric,
  _weekend_price numeric, _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  old_row public.package_room_type_prices%ROWTYPE;
  new_reason text := btrim(coalesce(_reason,''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'owner'::public.app_role) THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Owner dapat mengubah tarif kamar';
  END IF;
  IF _package_id IS NULL OR length(coalesce(_pricing_group,'')) = 0
     OR NOT EXISTS(SELECT 1 FROM public.packages WHERE id = _package_id)
     OR NOT EXISTS(SELECT 1 FROM public.room_types WHERE pricing_group = _pricing_group) THEN
    RAISE EXCEPTION 'Paket atau tipe kamar tidak valid';
  END IF;
  IF _weekday_price IS NULL OR _weekend_price IS NULL
     OR _weekday_price <= 0 OR _weekend_price <= 0
     OR _weekday_price <> trunc(_weekday_price) OR _weekend_price <> trunc(_weekend_price)
     OR _weekday_price > 100000000 OR _weekend_price > 100000000 THEN
    RAISE EXCEPTION 'Harga Weekday/Weekend harus rupiah bulat positif';
  END IF;
  IF length(new_reason) < 3 OR length(new_reason) > 500 THEN
    RAISE EXCEPTION 'Alasan perubahan wajib 3-500 karakter';
  END IF;
  SELECT * INTO old_row FROM public.package_room_type_prices
  WHERE package_id = _package_id AND pricing_group = _pricing_group
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Harga khusus tipe kamar belum terdaftar';
  END IF;
  IF old_row.weekday_price IS NOT DISTINCT FROM _weekday_price
     AND old_row.weekend_price IS NOT DISTINCT FROM _weekend_price THEN
    RETURN; -- no change -> no audit event
  END IF;
  UPDATE public.package_room_type_prices
  SET weekday_price = _weekday_price, weekend_price = _weekend_price, updated_at = now()
  WHERE id = old_row.id;
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,description)
  VALUES(auth.uid(),'price_change','package_room_type_prices',old_row.id,
    jsonb_build_object(
      'package_id',_package_id,'pricing_group',_pricing_group,
      'weekday_before',old_row.weekday_price,'weekday_after',_weekday_price,
      'weekend_before',old_row.weekend_price,'weekend_after',_weekend_price,
      'reason',new_reason
    )::text);
END;
$$;
REVOKE ALL ON FUNCTION public.update_package_room_type_price(uuid,text,numeric,numeric,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_package_room_type_price(uuid,text,numeric,numeric,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_package_room_type_price(uuid,text,numeric,numeric,text) TO authenticated;
-- Postcheck: authenticated access is still stopped by owner check and all writes audit in same transaction.
-- Rollback: DROP FUNCTION public.update_package_room_type_price(uuid,text,numeric,numeric,text);
