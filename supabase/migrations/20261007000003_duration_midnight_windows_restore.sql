-- Task 4: Restore original P2/P4/P6 check-in windows
-- Baturaden 25 Homestay
--
-- Original operational rules:
-- P2 = 120 minutes, check-in 06:00-23:30
-- P4 = 240 minutes, check-in 06:00-22:30
-- P6 = 360 minutes, check-in 04:30-19:30
--
-- All three retain duration_midnight_cap:
-- calculated checkout may not pass the next midnight.

UPDATE public.packages
SET
  duration_minutes = 120,
  time_mode = 'duration_midnight_cap',
  slot_start_time = NULL,
  checkin_start_time = TIME '06:00',
  checkin_end_time = TIME '23:30',
  checkout_time = NULL
WHERE name = 'Paket 2 Jam';

UPDATE public.packages
SET
  duration_minutes = 240,
  time_mode = 'duration_midnight_cap',
  slot_start_time = NULL,
  checkin_start_time = TIME '06:00',
  checkin_end_time = TIME '22:30',
  checkout_time = NULL
WHERE name = 'Paket 4 Jam';

UPDATE public.packages
SET
  duration_minutes = 360,
  time_mode = 'duration_midnight_cap',
  slot_start_time = NULL,
  checkin_start_time = TIME '04:30',
  checkin_end_time = TIME '19:30',
  checkout_time = NULL
WHERE name = 'Paket 6 Jam';