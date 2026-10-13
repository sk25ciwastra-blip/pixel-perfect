-- Task 4: Official package pricing by room pricing group
-- Baturaden 25 Homestay
--
-- 9 official packages x 3 pricing groups = 27 price rows.
--
-- Pricing groups:
--   standard
--   superior  -> shared by Superior A and Superior B
--   deluxe
--
-- Existing packages.weekday_price / weekend_price are preserved
-- temporarily for backward compatibility.

BEGIN;

-- ============================================================
-- 1. Official room-type package price catalog
-- ============================================================

CREATE TABLE IF NOT EXISTS public.package_room_type_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  package_id uuid NOT NULL
    REFERENCES public.packages(id)
    ON DELETE RESTRICT,

  pricing_group text NOT NULL,

  weekday_price numeric NOT NULL,
  weekend_price numeric NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT package_room_type_prices_pricing_group_check
    CHECK (
      pricing_group IN (
        'standard',
        'superior',
        'deluxe'
      )
    ),

  CONSTRAINT package_room_type_prices_weekday_price_check
    CHECK (weekday_price >= 0),

  CONSTRAINT package_room_type_prices_weekend_price_check
    CHECK (weekend_price >= 0),

  CONSTRAINT package_room_type_prices_package_group_key
    UNIQUE (package_id, pricing_group)
);


-- ============================================================
-- 2. Row Level Security
-- ============================================================

ALTER TABLE public.package_room_type_prices
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS package_room_type_prices_read
ON public.package_room_type_prices;

CREATE POLICY package_room_type_prices_read
ON public.package_room_type_prices
FOR SELECT
TO authenticated
USING (
  public.can_view_operations(auth.uid())
);


-- ============================================================
-- 3. Seed the official 27 prices
--
-- Values:
-- package name | pricing group | weekday | weekend
-- ============================================================

INSERT INTO public.package_room_type_prices (
  package_id,
  pricing_group,
  weekday_price,
  weekend_price
)
SELECT
  p.id,
  price_catalog.pricing_group,
  price_catalog.weekday_price,
  price_catalog.weekend_price
FROM public.packages p
JOIN (
  VALUES

    -- P2 / Paket 2 Jam
    ('Paket 2 Jam', 'standard',  70000::numeric,  80000::numeric),
    ('Paket 2 Jam', 'superior',  80000::numeric,  90000::numeric),
    ('Paket 2 Jam', 'deluxe',    90000::numeric, 100000::numeric),

    -- P4 / Paket 4 Jam
    ('Paket 4 Jam', 'standard',  80000::numeric,  90000::numeric),
    ('Paket 4 Jam', 'superior',  90000::numeric, 100000::numeric),
    ('Paket 4 Jam', 'deluxe',   100000::numeric, 110000::numeric),

    -- P6 / Paket 6 Jam
    ('Paket 6 Jam', 'standard', 110000::numeric, 120000::numeric),
    ('Paket 6 Jam', 'superior', 120000::numeric, 130000::numeric),
    ('Paket 6 Jam', 'deluxe',   130000::numeric, 140000::numeric),

    -- P12 / Paket 12 Jam
    ('Paket 12 Jam', 'standard', 150000::numeric, 170000::numeric),
    ('Paket 12 Jam', 'superior', 160000::numeric, 180000::numeric),
    ('Paket 12 Jam', 'deluxe',   170000::numeric, 190000::numeric),

    -- P24 / Paket 24 Jam
    ('Paket 24 Jam', 'standard', 200000::numeric, 220000::numeric),
    ('Paket 24 Jam', 'superior', 210000::numeric, 230000::numeric),
    ('Paket 24 Jam', 'deluxe',   220000::numeric, 240000::numeric),

    -- PP / Paket Pagi
    ('Paket Pagi', 'standard', 115000::numeric, 135000::numeric),
    ('Paket Pagi', 'superior', 125000::numeric, 145000::numeric),
    ('Paket Pagi', 'deluxe',   135000::numeric, 155000::numeric),

    -- PM / Paket Malam
    ('Paket Malam', 'standard', 125000::numeric, 145000::numeric),
    ('Paket Malam', 'superior', 135000::numeric, 155000::numeric),
    ('Paket Malam', 'deluxe',   145000::numeric, 165000::numeric),

    -- PH / Paket Harian
    ('Paket Harian', 'standard', 170000::numeric, 190000::numeric),
    ('Paket Harian', 'superior', 180000::numeric, 200000::numeric),
    ('Paket Harian', 'deluxe',   190000::numeric, 210000::numeric),

    -- PW / Paket Mingguan
    ('Paket Mingguan', 'standard', 800000::numeric,  800000::numeric),
    ('Paket Mingguan', 'superior', 1000000::numeric, 1000000::numeric),
    ('Paket Mingguan', 'deluxe',   1200000::numeric, 1200000::numeric)

) AS price_catalog(
  package_name,
  pricing_group,
  weekday_price,
  weekend_price
)
  ON p.name = price_catalog.package_name

ON CONFLICT (package_id, pricing_group)
DO UPDATE SET
  weekday_price = EXCLUDED.weekday_price,
  weekend_price = EXCLUDED.weekend_price,
  updated_at = now();


-- ============================================================
-- 4. Safety guards
-- ============================================================

DO $$
DECLARE
  official_package_count integer;
  official_price_count integer;
BEGIN

  SELECT COUNT(*)
  INTO official_package_count
  FROM public.packages
  WHERE name IN (
    'Paket 2 Jam',
    'Paket 4 Jam',
    'Paket 6 Jam',
    'Paket 12 Jam',
    'Paket 24 Jam',
    'Paket Pagi',
    'Paket Malam',
    'Paket Harian',
    'Paket Mingguan'
  );

  IF official_package_count <> 9 THEN
    RAISE EXCEPTION
      'Master 9 paket resmi Baturaden 25 Homestay belum lengkap';
  END IF;


  SELECT COUNT(*)
  INTO official_price_count
  FROM public.package_room_type_prices pr
  JOIN public.packages p
    ON p.id = pr.package_id
  WHERE p.name IN (
    'Paket 2 Jam',
    'Paket 4 Jam',
    'Paket 6 Jam',
    'Paket 12 Jam',
    'Paket 24 Jam',
    'Paket Pagi',
    'Paket Malam',
    'Paket Harian',
    'Paket Mingguan'
  )
  AND pr.pricing_group IN (
    'standard',
    'superior',
    'deluxe'
  );

  IF official_price_count <> 27 THEN
    RAISE EXCEPTION
      'Katalog harga resmi harus memiliki tepat 27 kombinasi';
  END IF;

END;
$$;

COMMIT;