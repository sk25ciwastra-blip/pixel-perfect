-- Task 4: Official room type mapping
-- Baturaden 25 Homestay
--
-- Operational room mapping:
--   Standard   : 06, 07, 08, 09, 12
--   Superior A : 11
--   Superior B : 02, 03, 04
--   Deluxe     : 05, 10
--
-- Room 01 is intentionally NOT changed.

BEGIN;

-- Make sure the required room types exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.room_types
    WHERE name = 'Standard'
  ) THEN
    RAISE EXCEPTION 'Room type Standard tidak ditemukan';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.room_types
    WHERE name = 'Superior A'
  ) THEN
    RAISE EXCEPTION 'Room type Superior A tidak ditemukan';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.room_types
    WHERE name = 'Superior B'
  ) THEN
    RAISE EXCEPTION 'Room type Superior B tidak ditemukan';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.room_types
    WHERE name = 'Deluxe'
  ) THEN
    RAISE EXCEPTION 'Room type Deluxe tidak ditemukan';
  END IF;
END
$$;

-- Standard: 06, 07, 08, 09, 12
UPDATE public.rooms
SET room_type_id = (
  SELECT id
  FROM public.room_types
  WHERE name = 'Standard'
  LIMIT 1
)
WHERE room_number IN ('06', '07', '08', '09', '12');

-- Superior A: 11
UPDATE public.rooms
SET room_type_id = (
  SELECT id
  FROM public.room_types
  WHERE name = 'Superior A'
  LIMIT 1
)
WHERE room_number = '11';

-- Superior B: 02, 03, 04
UPDATE public.rooms
SET room_type_id = (
  SELECT id
  FROM public.room_types
  WHERE name = 'Superior B'
  LIMIT 1
)
WHERE room_number IN ('02', '03', '04');

-- Deluxe: 05, 10
UPDATE public.rooms
SET room_type_id = (
  SELECT id
  FROM public.room_types
  WHERE name = 'Deluxe'
  LIMIT 1
)
WHERE room_number IN ('05', '10');

COMMIT;