-- Task 4: Operational calendar event types
-- Baturaden 25 Homestay
--
-- Business rules:
-- 1. National holiday automatically uses weekend pricing.
-- 2. Collective leave is informational only and does NOT change pricing.
-- 3. Owner override has the highest priority.
-- 4. Without national holiday or Owner override:
--    Monday-Thursday = weekday
--    Friday-Sunday = weekend.

BEGIN;

ALTER TABLE public.operational_calendar
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_reference text;

ALTER TABLE public.operational_calendar
  DROP CONSTRAINT IF EXISTS operational_calendar_event_type_check;

ALTER TABLE public.operational_calendar
  ADD CONSTRAINT operational_calendar_event_type_check
  CHECK (
    event_type IS NULL
    OR event_type IN ('national_holiday', 'collective_leave')
  );

-- Preserve compatibility with the national-holiday flag created in 00011.
UPDATE public.operational_calendar
SET event_type = 'national_holiday'
WHERE is_national_holiday = true
  AND event_type IS NULL;

COMMENT ON COLUMN public.operational_calendar.event_type IS
  'national_holiday affects pricing automatically; collective_leave is informational only.';

COMMENT ON COLUMN public.operational_calendar.source_name IS
  'Human-readable source of the calendar event, for example an official government SKB.';

COMMENT ON COLUMN public.operational_calendar.source_reference IS
  'Reference identifying the official source used for this calendar event.';

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

  -- Highest priority: Owner decision.
  IF calendar_row.owner_override IS NOT NULL THEN
    RETURN calendar_row.owner_override;
  END IF;

  -- National holidays automatically use weekend pricing.
  -- Keep the old boolean compatible with migration 00011.
  IF calendar_row.event_type = 'national_holiday'
     OR COALESCE(calendar_row.is_national_holiday, false) THEN
    RETURN 'weekend';
  END IF;

  -- collective_leave intentionally has no automatic pricing effect.
  -- It falls through to the normal day-of-week rule.

  -- Monday (1) through Thursday (4) = weekday.
  IF EXTRACT(ISODOW FROM _calendar_date) BETWEEN 1 AND 4 THEN
    RETURN 'weekday';
  END IF;

  -- Friday (5) through Sunday (7) = weekend.
  RETURN 'weekend';
END;
$$;

COMMIT;