-- Task 4: Scheduled booking foundation
-- Baturaden 25 Homestay
--
-- Adds the planned stay window to transactions.
--
-- scheduled_check_in  = check-in time agreed at booking
-- scheduled_check_out = checkout time calculated from the package
--
-- started_at = actual check-in time
-- ends_at    = effective checkout time after actual check-in
--
-- Historical transactions are intentionally left with NULL scheduled times.

BEGIN;


-- ============================================================
-- 1. Add scheduled stay columns
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS scheduled_check_in timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_check_out timestamptz;


-- ============================================================
-- 2. Scheduled stay must always be chronologically valid
-- ============================================================

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_scheduled_stay_valid;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_scheduled_stay_valid
  CHECK (
    scheduled_check_in IS NULL
    OR scheduled_check_out IS NULL
    OR scheduled_check_out > scheduled_check_in
  );


-- ============================================================
-- 3. Indexes for future room-slot availability checks
--
-- The next migration will use these columns for overlap checks,
-- rescheduling, and room reassignment.
-- ============================================================

CREATE INDEX IF NOT EXISTS transactions_room_scheduled_check_in_idx
  ON public.transactions (room_id, scheduled_check_in)
  WHERE scheduled_check_in IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_room_scheduled_window_idx
  ON public.transactions (
    room_id,
    scheduled_check_in,
    scheduled_check_out
  )
  WHERE scheduled_check_in IS NOT NULL
    AND scheduled_check_out IS NOT NULL;


-- ============================================================
-- 4. Helper: calculate a booking's planned stay
--
-- This deliberately does NOT modify calculate_package_stay_times().
-- We keep the currently working engine untouched until the new
-- booking flow has been introduced and tested.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_scheduled_booking_times(
  _package_id uuid,
  _scheduled_check_in timestamptz
)
RETURNS TABLE (
  scheduled_check_in timestamptz,
  scheduled_check_out timestamptz
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  calculated_started_at timestamptz;
  calculated_ends_at timestamptz;
BEGIN

  IF _scheduled_check_in IS NULL THEN
    RAISE EXCEPTION 'Tanggal dan jam check-in wajib dipilih';
  END IF;

  SELECT
    t.started_at,
    t.ends_at
  INTO
    calculated_started_at,
    calculated_ends_at
  FROM public.calculate_package_stay_times(
    _package_id,
    _scheduled_check_in
  ) t;

  IF calculated_started_at IS NULL
     OR calculated_ends_at IS NULL
     OR calculated_ends_at <= calculated_started_at THEN
    RAISE EXCEPTION 'Jadwal booking tidak valid';
  END IF;

  scheduled_check_in := calculated_started_at;
  scheduled_check_out := calculated_ends_at;

  RETURN NEXT;

END;
$$;


-- ============================================================
-- 5. Function permissions
-- ============================================================

REVOKE ALL ON FUNCTION public.calculate_scheduled_booking_times(
  uuid,
  timestamptz
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.calculate_scheduled_booking_times(
  uuid,
  timestamptz
) TO authenticated;


COMMIT;