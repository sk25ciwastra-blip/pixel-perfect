-- Configure timing rules for the existing duration-based packages.
-- This migration does NOT create packages.
-- Package names are matched only to configure packages that already exist.

UPDATE public.packages
SET
  time_mode = 'duration_midnight_cap',
  checkin_start_time = TIME '06:00',
  checkin_end_time = TIME '23:30',
  checkout_time = NULL
WHERE name = 'Paket 2 Jam';

UPDATE public.packages
SET
  time_mode = 'duration_midnight_cap',
  checkin_start_time = TIME '06:00',
  checkin_end_time = TIME '22:30',
  checkout_time = NULL
WHERE name = 'Paket 4 Jam';

UPDATE public.packages
SET
  time_mode = 'duration_midnight_cap',
  checkin_start_time = TIME '04:30',
  checkin_end_time = TIME '19:30',
  checkout_time = NULL
WHERE name = 'Paket 6 Jam';

UPDATE public.packages
SET
  time_mode = 'duration',
  checkin_start_time = NULL,
  checkin_end_time = NULL,
  checkout_time = NULL
WHERE name = 'Paket 12 Jam';

UPDATE public.packages
SET
  time_mode = 'duration',
  checkin_start_time = NULL,
  checkin_end_time = NULL,
  checkout_time = NULL
WHERE name = 'Paket 24 Jam';

-- Weekly package: check-in 24 hours, checkout at 12:00 after 7 days.
-- Does nothing when Paket Mingguan does not exist yet.
UPDATE public.packages
SET
  duration_minutes = 10080,
  time_mode = 'fixed_days_checkout',
  checkin_start_time = NULL,
  checkin_end_time = NULL,
  checkout_time = TIME '12:00'
WHERE name = 'Paket Mingguan';
