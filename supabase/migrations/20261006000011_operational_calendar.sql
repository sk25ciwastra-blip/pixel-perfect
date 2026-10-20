-- Task 4: Operational calendar foundation
-- Baturaden 25 Homestay
--
-- Rules:
-- 1. Monday-Thursday = weekday
-- 2. Friday-Sunday = weekend
-- 3. Indonesian national holidays = weekend
-- 4. Owner override has the highest priority
-- 5. Pricing day mode is determined from the operational/check-in date

BEGIN;

CREATE TABLE IF NOT EXISTS public.operational_calendar (
  calendar_date date PRIMARY KEY,
  holiday_name text,
  is_national_holiday boolean NOT NULL DEFAULT false,
  owner_override text,
  override_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),

  CONSTRAINT operational_calendar_owner_override_check
    CHECK (
      owner_override IS NULL
      OR owner_override IN ('weekday', 'weekend')
    )
);

COMMENT ON TABLE public.operational_calendar IS
  'Operational pricing calendar for Baturaden 25 Homestay. Stores national holidays and optional Owner overrides.';

COMMENT ON COLUMN public.operational_calendar.owner_override IS
  'Owner decision for this date. When present, overrides normal weekday/weekend and national holiday rules.';

CREATE OR REPLACE FUNCTION public.get_operational_day_mode(
  _calendar_date date
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  calendar_row public.operational_calendar%ROWTYPE;
BEGIN
  SELECT *
  INTO calendar_row
  FROM public.operational_calendar
  WHERE calendar_date = _calendar_date;

  -- Owner override always wins.
  IF calendar_row.owner_override IS NOT NULL THEN
    RETURN calendar_row.owner_override;
  END IF;

  -- Indonesian national holidays are treated as weekend pricing.
  IF COALESCE(calendar_row.is_national_holiday, false) THEN
    RETURN 'weekend';
  END IF;

  -- ISO day of week:
  -- Monday = 1 ... Sunday = 7.
  IF EXTRACT(ISODOW FROM _calendar_date) BETWEEN 1 AND 4 THEN
    RETURN 'weekday';
  END IF;

  RETURN 'weekend';
END;
$$;

ALTER TABLE public.operational_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
  "Authenticated users can read operational calendar"
ON public.operational_calendar;

CREATE POLICY
  "Authenticated users can read operational calendar"
ON public.operational_calendar
FOR SELECT
TO authenticated
USING (true);

COMMIT;