INSERT INTO public.room_types (name, description)
VALUES
  ('Standar', 'Kamar standar'),
  ('Deluxe', 'Kamar deluxe'),
  ('Family', 'Kamar keluarga')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.packages (name, duration_minutes, price, description, active)
VALUES
  ('Paket 2 Jam', 120, 90000, 'Sewa 2 jam', true),
  ('Paket 4 Jam', 240, 150000, 'Sewa 4 jam', true),
  ('Paket 6 Jam', 360, 200000, 'Sewa 6 jam', true),
  ('Paket 12 Jam', 720, 300000, 'Sewa 12 jam', true),
  ('Paket 24 Jam', 1440, 450000, 'Sewa 24 jam', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.rooms (room_number, room_type_id, base_price, status, active, notes)
SELECT v.room_number, t.id, v.base_price, 'ready'::public.room_status, true, ''
FROM (
  VALUES
    ('101', 'Standar', 90000),
    ('102', 'Standar', 90000),
    ('103', 'Deluxe', 150000),
    ('104', 'Standar', 90000),
    ('201', 'Deluxe', 150000),
    ('202', 'Family', 450000),
    ('203', 'Family', 450000),
    ('204', 'Deluxe', 150000),
    ('205', 'Standar', 90000),
    ('206', 'Deluxe', 150000)
) AS v(room_number, type_name, base_price)
JOIN public.room_types AS t ON t.name = v.type_name
ON CONFLICT (room_number) DO NOTHING;
