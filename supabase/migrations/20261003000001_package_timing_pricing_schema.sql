-- Task 1.5A-1: package timing rules and weekday/weekend pricing schema.
-- Schema only. RPC timing enforcement will be implemented separately.

ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS weekday_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS weekend_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS time_mode text,
  ADD COLUMN IF NOT EXISTS slot_start_time time,
  ADD COLUMN IF NOT EXISTS checkin_start_time time,
  ADD COLUMN IF NOT EXISTS checkin_end_time time,
  ADD COLUMN IF NOT EXISTS checkout_time time;

-- Preserve compatibility with existing package prices.
UPDATE public.packages
SET
  weekday_price = COALESCE(weekday_price, price),
  weekend_price = COALESCE(weekend_price, price);

ALTER TABLE public.packages
  ALTER COLUMN weekday_price SET NOT NULL,
  ALTER COLUMN weekend_price SET NOT NULL;

ALTER TABLE public.packages
  DROP CONSTRAINT IF EXISTS packages_weekday_price_nonnegative,
  ADD CONSTRAINT packages_weekday_price_nonnegative
    CHECK (weekday_price >= 0),
  DROP CONSTRAINT IF EXISTS packages_weekend_price_nonnegative,
  ADD CONSTRAINT packages_weekend_price_nonnegative
    CHECK (weekend_price >= 0),
  DROP CONSTRAINT IF EXISTS packages_time_mode_valid,
  ADD CONSTRAINT packages_time_mode_valid
    CHECK (
      time_mode IS NULL
      OR time_mode IN ('duration', 'fixed_window', 'duration_midnight_cap', 'fixed_days_checkout')
    );

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS day_mode text;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_day_mode_valid,
  ADD CONSTRAINT transactions_day_mode_valid
    CHECK (
      day_mode IS NULL
      OR day_mode IN ('weekday', 'weekend')
  );
