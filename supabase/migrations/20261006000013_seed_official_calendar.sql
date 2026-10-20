-- Task 4: Seed official Indonesian calendar 2026-2027
-- Baturaden 25 Homestay
--
-- Sources:
-- 2026: SKB Menteri Agama No. 1497 Tahun 2025,
--       Menteri Ketenagakerjaan No. 2 Tahun 2025,
--       Menteri PANRB No. 5 Tahun 2025.
--
-- 2027: SKB Menteri Agama No. 1205 Tahun 2026,
--       Menteri Ketenagakerjaan No. 3 Tahun 2026,
--       Menteri PANRB No. 2 Tahun 2026.
--
-- IMPORTANT:
-- national_holiday  -> automatically affects operational day mode.
-- collective_leave  -> informational only.
-- Existing Owner override is intentionally NOT overwritten.

BEGIN;

INSERT INTO public.operational_calendar (
  calendar_date,
  holiday_name,
  is_national_holiday,
  event_type,
  source_name,
  source_reference
)
VALUES

-- =========================================================
-- 2026 - NATIONAL HOLIDAYS
-- =========================================================

('2026-01-01', 'Tahun Baru 2026 Masehi',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-01-16', 'Isra Mikraj Nabi Muhammad S.A.W.',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-02-17', 'Tahun Baru Imlek 2577 Kongzili',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-03-19', 'Hari Suci Nyepi (Tahun Baru Saka 1948)',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-03-21', 'Idul Fitri 1447 Hijriah',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-03-22', 'Idul Fitri 1447 Hijriah',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-04-03', 'Wafat Yesus Kristus',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-04-05', 'Kebangkitan Yesus Kristus (Paskah)',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-05-01', 'Hari Buruh Internasional',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-05-14', 'Kenaikan Yesus Kristus',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-05-27', 'Idul Adha 1447 Hijriah',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-05-31', 'Hari Raya Waisak 2570 BE',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-06-01', 'Hari Lahir Pancasila',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-06-16', '1 Muharam Tahun Baru Islam 1448 Hijriah',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-08-17', 'Proklamasi Kemerdekaan',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-08-25', 'Maulid Nabi Muhammad S.A.W.',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-12-25', 'Kelahiran Yesus Kristus',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

-- =========================================================
-- 2026 - COLLECTIVE LEAVE
-- Does NOT automatically change pricing.
-- =========================================================

('2026-02-16', 'Cuti Bersama Tahun Baru Imlek 2577 Kongzili',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-03-18', 'Cuti Bersama Hari Suci Nyepi (Tahun Baru Saka 1948)',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-03-20', 'Cuti Bersama Idul Fitri 1447 Hijriah',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-03-23', 'Cuti Bersama Idul Fitri 1447 Hijriah',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-03-24', 'Cuti Bersama Idul Fitri 1447 Hijriah',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-05-15', 'Cuti Bersama Kenaikan Yesus Kristus',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-05-28', 'Cuti Bersama Idul Adha 1447 Hijriah',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

('2026-12-24', 'Cuti Bersama Kelahiran Yesus Kristus',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1497/2025, 2/2025, 5/2025'),

-- =========================================================
-- 2027 - NATIONAL HOLIDAYS
-- =========================================================

('2027-01-01', 'Tahun Baru 2027 Masehi',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-01-05', 'Isra Mikraj Nabi Muhammad S.A.W.',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-02-06', 'Tahun Baru Imlek 2578 Kongzili',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-03-08', 'Hari Suci Nyepi (Tahun Baru Saka 1949)',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-03-10', 'Idul Fitri 1448 Hijriah',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-03-11', 'Idul Fitri 1448 Hijriah',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-03-26', 'Wafat Yesus Kristus',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-03-28', 'Kebangkitan Yesus Kristus (Paskah)',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-05-01', 'Hari Buruh Internasional',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-05-06', 'Kenaikan Yesus Kristus',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-05-17', 'Idul Adha 1448 Hijriah',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-05-20', 'Hari Raya Waisak 2571 BE',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-06-01', 'Hari Lahir Pancasila',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-06-06', '1 Muharam Tahun Baru Islam 1449 Hijriah',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-08-15', 'Maulid Nabi Muhammad S.A.W.',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-08-17', 'Proklamasi Kemerdekaan',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-12-25', 'Kelahiran Yesus Kristus',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-12-26', 'Isra Mikraj Nabi Muhammad S.A.W.',
 true, 'national_holiday',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

-- =========================================================
-- 2027 - COLLECTIVE LEAVE
-- Does NOT automatically change pricing.
-- =========================================================

('2027-02-05', 'Cuti Bersama Tahun Baru Imlek 2578 Kongzili',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-03-09', 'Cuti Bersama Idul Fitri 1448 Hijriah',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-03-12', 'Cuti Bersama Idul Fitri 1448 Hijriah',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-03-15', 'Cuti Bersama Idul Fitri 1448 Hijriah',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-03-25', 'Cuti Bersama Wafat Yesus Kristus',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-05-18', 'Cuti Bersama Idul Adha 1448 Hijriah',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-05-19', 'Cuti Bersama Hari Raya Waisak 2571 BE',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026'),

('2027-12-24', 'Cuti Bersama Kelahiran Yesus Kristus',
 false, 'collective_leave',
 'SKB 3 Menteri',
 'SKB 1205/2026, 3/2026, 2/2026')

ON CONFLICT (calendar_date)
DO UPDATE SET
  holiday_name = EXCLUDED.holiday_name,
  is_national_holiday = EXCLUDED.is_national_holiday,
  event_type = EXCLUDED.event_type,
  source_name = EXCLUDED.source_name,
  source_reference = EXCLUDED.source_reference,
  updated_at = now();

COMMIT;