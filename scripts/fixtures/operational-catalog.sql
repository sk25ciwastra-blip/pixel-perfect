-- Synthetic disposable catalog prerequisite only; never Cloud seed.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

INSERT INTO auth.users (id)
VALUES ('11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('11111111-1111-4111-8111-111111111111', 'owner')
ON CONFLICT (user_id) DO UPDATE SET role = 'owner';

INSERT INTO public.room_types (name, description, active, pricing_group)
VALUES
  ('Standard', 'Standard Baturaden 25 Homestay', true, 'standard'),
  ('Deluxe', 'Deluxe Baturaden 25 Homestay', true, 'deluxe')
ON CONFLICT (name) DO UPDATE
SET pricing_group = EXCLUDED.pricing_group;

WITH desired(room_number, room_type_name) AS (
  VALUES
    ('02', 'Superior B'),
    ('03', 'Superior B'),
    ('04', 'Superior B'),
    ('05', 'Deluxe'),
    ('06', 'Standard'),
    ('07', 'Standard'),
    ('08', 'Standard'),
    ('09', 'Standard'),
    ('10', 'Deluxe'),
    ('11', 'Superior A'),
    ('12', 'Standard')
)
INSERT INTO public.rooms (room_number, room_type_id, base_price, status, notes, active)
SELECT d.room_number, rt.id, 0, 'ready', '', true
FROM desired d
JOIN public.room_types rt ON rt.name = d.room_type_name
ON CONFLICT (room_number) DO UPDATE
SET room_type_id = EXCLUDED.room_type_id;

INSERT INTO public.packages (
  name, duration_minutes, price, active, description,
  weekday_price, weekend_price, time_mode,
  slot_start_time, checkin_start_time, checkin_end_time, checkout_time
)
VALUES
  ('Paket 2 Jam', 120, 70000, true, 'Paket 2 Jam Baturaden 25 Homestay', 70000, 80000, 'duration_midnight_cap', NULL, '06:00', '23:30', NULL),
  ('Paket 4 Jam', 240, 80000, true, 'Paket 4 Jam Baturaden 25 Homestay', 80000, 90000, 'duration_midnight_cap', NULL, '06:00', '22:30', NULL),
  ('Paket 6 Jam', 360, 110000, true, 'Paket 6 Jam Baturaden 25 Homestay', 110000, 120000, 'duration_midnight_cap', NULL, '04:30', '19:30', NULL),
  ('Paket 12 Jam', 720, 150000, true, 'Paket 12 Jam Baturaden 25 Homestay', 150000, 170000, 'duration', NULL, NULL, NULL, NULL),
  ('Paket 24 Jam', 1440, 200000, true, 'Paket 24 Jam Baturaden 25 Homestay', 200000, 220000, 'duration', NULL, NULL, NULL, NULL),
  ('Paket Pagi', 450, 115000, true, 'Paket Pagi Baturaden 25 Homestay', 115000, 135000, 'fixed_window', '08:30', '08:00', '12:00', '16:00'),
  ('Paket Malam', 600, 125000, true, 'Paket Malam Baturaden 25 Homestay', 125000, 145000, 'fixed_window', '22:00', '21:30', '04:00', '08:00'),
  ('Paket Harian', 1380, 170000, true, 'Paket Harian Baturaden 25 Homestay', 170000, 190000, 'fixed_window', '13:00', '12:00', '04:00', '12:00'),
  ('Paket Mingguan', 10080, 800000, true, 'Paket Mingguan Baturaden 25 Homestay', 800000, 800000, 'fixed_days_checkout', NULL, NULL, NULL, '12:00')
ON CONFLICT (name) DO UPDATE SET
  duration_minutes = EXCLUDED.duration_minutes,
  price = EXCLUDED.price,
  active = EXCLUDED.active,
  weekday_price = EXCLUDED.weekday_price,
  weekend_price = EXCLUDED.weekend_price,
  time_mode = EXCLUDED.time_mode,
  slot_start_time = EXCLUDED.slot_start_time,
  checkin_start_time = EXCLUDED.checkin_start_time,
  checkin_end_time = EXCLUDED.checkin_end_time,
  checkout_time = EXCLUDED.checkout_time;
