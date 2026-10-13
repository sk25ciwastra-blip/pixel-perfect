-- Task 4: Correct official P4 prices
-- Baturaden 25 Homestay
--
-- Corrects the P4 official price catalog for all pricing groups.

BEGIN;

UPDATE public.package_room_type_prices pr
SET
  weekday_price = CASE pr.pricing_group
    WHEN 'standard' THEN 90000
    WHEN 'superior' THEN 100000
    WHEN 'deluxe' THEN 110000
  END,
  weekend_price = CASE pr.pricing_group
    WHEN 'standard' THEN 100000
    WHEN 'superior' THEN 110000
    WHEN 'deluxe' THEN 120000
  END
FROM public.packages p
WHERE p.id = pr.package_id
  AND p.name = 'Paket 4 Jam'
  AND pr.pricing_group IN ('standard', 'superior', 'deluxe');

COMMIT;