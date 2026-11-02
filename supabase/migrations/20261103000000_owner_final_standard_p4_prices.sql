-- Baturaden 25 Homestay — Owner final Standard P4 prices (3 Nov 2026).
-- Forward-only, non-historical catalog correction. DO NOT apply automatically.
-- Existing transaction price snapshots are intentionally untouched.
BEGIN;
DO $preflight$
DECLARE
  current_weekday numeric;
  current_weekend numeric;
  match_count integer;
BEGIN
  SELECT COUNT(*), MIN(pr.weekday_price), MIN(pr.weekend_price)
    INTO match_count, current_weekday, current_weekend
  FROM public.package_room_type_prices pr
  JOIN public.packages p ON p.id = pr.package_id
  WHERE p.name = 'Paket 4 Jam'
    AND pr.pricing_group = 'standard';
  IF match_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one Standard P4 catalog entry, got %', match_count;
  END IF;
  IF NOT (
    (current_weekday = 80000 AND current_weekend = 90000)
    OR (current_weekday = 90000 AND current_weekend = 100000)
  ) THEN
    RAISE EXCEPTION 'Unexpected Standard P4 catalog prices: weekday %, weekend %', current_weekday, current_weekend;
  END IF;
END
$preflight$;
UPDATE public.package_room_type_prices pr
SET weekday_price = 90000,
    weekend_price = 100000
FROM public.packages p
WHERE pr.package_id = p.id
  AND p.name = 'Paket 4 Jam'
  AND pr.pricing_group = 'standard'
  AND (pr.weekday_price, pr.weekend_price) IS DISTINCT FROM (90000::numeric, 100000::numeric);
DO $postcheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.package_room_type_prices pr
    JOIN public.packages p ON p.id = pr.package_id
    WHERE p.name = 'Paket 4 Jam'
      AND pr.pricing_group = 'standard'
      AND pr.weekday_price = 90000
      AND pr.weekend_price = 100000
  ) THEN
    RAISE EXCEPTION 'Standard P4 catalog correction did not persist';
  END IF;
END
$postcheck$;
COMMIT;
