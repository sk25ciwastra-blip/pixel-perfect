-- Task 4: Safe official package catalog validation
-- Baturaden 25 Homestay
--
-- Package rows and official prices are seeded separately.
-- The canonical timing function is preserved from migration 00007.
-- This migration only validates the official catalog and timing.

BEGIN;

-- Guard the complete official package catalog.
DO $$
BEGIN
  IF (
    SELECT COUNT(*)
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
    )
  ) <> 9 THEN
    RAISE EXCEPTION
      'Katalog paket resmi Baturaden 25 Homestay belum lengkap';
  END IF;
END;
$$;

-- Validate official timing without rewriting package rows.
DO $$
BEGIN
  IF EXISTS (
    WITH expected (
      name,
      duration_minutes,
      time_mode,
      slot_start_time,
      checkin_start_time,
      checkin_end_time,
      checkout_time
    ) AS (
      VALUES
        (
          'Paket 2 Jam',
          120,
          'duration_midnight_cap',
          NULL::time,
          TIME '06:00',
          TIME '23:30',
          NULL::time
        ),
        (
          'Paket 4 Jam',
          240,
          'duration_midnight_cap',
          NULL::time,
          TIME '06:00',
          TIME '22:30',
          NULL::time
        ),
        (
          'Paket 6 Jam',
          360,
          'duration_midnight_cap',
          NULL::time,
          TIME '04:30',
          TIME '19:30',
          NULL::time
        ),
        (
          'Paket 12 Jam',
          720,
          'duration',
          NULL::time,
          NULL::time,
          NULL::time,
          NULL::time
        ),
        (
          'Paket 24 Jam',
          1440,
          'duration',
          NULL::time,
          NULL::time,
          NULL::time,
          NULL::time
        ),
        (
          'Paket Pagi',
          450,
          'fixed_window',
          TIME '08:30',
          TIME '08:00',
          TIME '12:00',
          TIME '16:00'
        ),
        (
          'Paket Malam',
          600,
          'fixed_window',
          TIME '22:00',
          TIME '21:30',
          TIME '04:00',
          TIME '08:00'
        ),
        (
          'Paket Harian',
          1380,
          'fixed_window',
          TIME '13:00',
          TIME '12:00',
          TIME '04:00',
          TIME '12:00'
        ),
        (
          'Paket Mingguan',
          10080,
          'fixed_days_checkout',
          NULL::time,
          NULL::time,
          NULL::time,
          TIME '12:00'
        )
    )
    SELECT 1
    FROM public.packages p
    JOIN expected e
      ON e.name = p.name
    WHERE p.duration_minutes IS DISTINCT FROM e.duration_minutes
       OR p.time_mode IS DISTINCT FROM e.time_mode
       OR p.slot_start_time IS DISTINCT FROM e.slot_start_time
       OR p.checkin_start_time IS DISTINCT FROM e.checkin_start_time
       OR p.checkin_end_time IS DISTINCT FROM e.checkin_end_time
       OR p.checkout_time IS DISTINCT FROM e.checkout_time
  ) THEN
    RAISE EXCEPTION
      'Timing paket resmi tidak sesuai aturan Owner';
  END IF;
END;
$$;

COMMIT;
