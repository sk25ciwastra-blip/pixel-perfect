-- Task 4: Room type pricing foundation
-- Baturaden 25 Homestay
--
-- Pricing groups:
--   Standard
--   Superior  -> shared by Superior A and Superior B
--   Deluxe
--
-- Legacy room types are preserved for historical safety.

BEGIN;

-- 1. Add an explicit pricing group to room types.
ALTER TABLE public.room_types
ADD COLUMN IF NOT EXISTS pricing_group text;

-- 2. Seed pricing groups for existing official room types.
UPDATE public.room_types
SET pricing_group = CASE
  WHEN name = 'Standard' THEN 'standard'
  WHEN name = 'Deluxe' THEN 'deluxe'
  WHEN name IN ('Superior A', 'Superior B') THEN 'superior'
  ELSE pricing_group
END
WHERE name IN (
  'Standard',
  'Deluxe',
  'Superior A',
  'Superior B'
);

-- 3. Create Superior A if it does not exist.
INSERT INTO public.room_types (
  name,
  description,
  active,
  pricing_group
)
SELECT
  'Superior A',
  'Superior A Baturaden 25 Homestay',
  true,
  'superior'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.room_types
  WHERE name = 'Superior A'
);

-- 4. Create Superior B if it does not exist.
INSERT INTO public.room_types (
  name,
  description,
  active,
  pricing_group
)
SELECT
  'Superior B',
  'Superior B Baturaden 25 Homestay',
  true,
  'superior'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.room_types
  WHERE name = 'Superior B'
);

-- 5. Ensure the official types have the correct pricing group.
UPDATE public.room_types
SET pricing_group = CASE
  WHEN name = 'Standard' THEN 'standard'
  WHEN name IN ('Superior A', 'Superior B') THEN 'superior'
  WHEN name = 'Deluxe' THEN 'deluxe'
  ELSE pricing_group
END
WHERE name IN (
  'Standard',
  'Superior A',
  'Superior B',
  'Deluxe'
);

-- 6. Guard official pricing-group values.
ALTER TABLE public.room_types
DROP CONSTRAINT IF EXISTS room_types_pricing_group_check;

ALTER TABLE public.room_types
ADD CONSTRAINT room_types_pricing_group_check
CHECK (
  pricing_group IS NULL
  OR pricing_group IN ('standard', 'superior', 'deluxe')
);

COMMIT;