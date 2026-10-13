-- Task 1.5A-2: Central package time engine.
-- Uses Asia/Jakarta explicitly for Baturaden25 operational time.

CREATE OR REPLACE FUNCTION public.calculate_package_stay_times(
  _package_id uuid,
  _started_at timestamptz DEFAULT now()
)
RETURNS TABLE (
  started_at timestamptz,
  ends_at timestamptz
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  pkg record;
  local_started timestamp;
  local_date date;
  local_time time;
  local_end timestamp;
  next_midnight timestamp;
  allowed boolean := false;
BEGIN
  SELECT
    p.duration_minutes,
    p.time_mode,
    p.checkin_start_time,
    p.checkin_end_time,
    p.checkout_time
  INTO pkg
  FROM public.packages p
  WHERE p.id = _package_id
    AND p.active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paket tidak tersedia';
  END IF;

  IF pkg.time_mode IS NULL THEN
    RAISE EXCEPTION 'Aturan waktu paket belum dikonfigurasi';
  END IF;

  local_started := _started_at AT TIME ZONE 'Asia/Jakarta';
  local_date := local_started::date;
  local_time := local_started::time;

  IF pkg.time_mode = 'duration' THEN
    IF pkg.duration_minutes IS NULL OR pkg.duration_minutes <= 0 THEN
      RAISE EXCEPTION 'Durasi paket tidak valid';
    END IF;

    local_end := local_started + (pkg.duration_minutes * interval '1 minute');

  ELSIF pkg.time_mode = 'duration_midnight_cap' THEN
    IF pkg.duration_minutes IS NULL OR pkg.duration_minutes <= 0 THEN
      RAISE EXCEPTION 'Durasi paket tidak valid';
    END IF;

    IF pkg.checkin_start_time IS NULL OR pkg.checkin_end_time IS NULL THEN
      RAISE EXCEPTION 'Jam check-in paket belum dikonfigurasi';
    END IF;

    allowed :=
      local_time >= pkg.checkin_start_time
      AND local_time <= pkg.checkin_end_time;

    IF NOT allowed THEN
      RAISE EXCEPTION 'Check-in di luar jam yang diizinkan untuk paket ini';
    END IF;

    local_end := local_started + (pkg.duration_minutes * interval '1 minute');

    next_midnight := local_date + interval '1 day';

    IF local_end > next_midnight THEN
      local_end := next_midnight;
    END IF;

  ELSIF pkg.time_mode = 'fixed_window' THEN
    IF pkg.checkin_start_time IS NULL
       OR pkg.checkin_end_time IS NULL
       OR pkg.checkout_time IS NULL THEN
      RAISE EXCEPTION 'Jam paket fixed window belum dikonfigurasi';
    END IF;

    IF pkg.checkin_start_time <= pkg.checkin_end_time THEN
      allowed :=
        local_time >= pkg.checkin_start_time
        AND local_time <= pkg.checkin_end_time;

      IF NOT allowed THEN
        RAISE EXCEPTION 'Check-in di luar jam yang diizinkan untuk paket ini';
      END IF;

      local_end := local_date + pkg.checkout_time;

      IF local_end <= local_started THEN
        local_end := local_end + interval '1 day';
      END IF;

    ELSE
      allowed :=
        local_time >= pkg.checkin_start_time
        OR local_time <= pkg.checkin_end_time;

      IF NOT allowed THEN
        RAISE EXCEPTION 'Check-in di luar jam yang diizinkan untuk paket ini';
      END IF;

      IF local_time >= pkg.checkin_start_time THEN
        local_end := (local_date + 1) + pkg.checkout_time;
      ELSE
        local_end := local_date + pkg.checkout_time;
      END IF;
    END IF;

  ELSIF pkg.time_mode = 'fixed_days_checkout' THEN
    IF pkg.duration_minutes IS NULL
       OR pkg.duration_minutes <= 0
       OR pkg.duration_minutes % 1440 <> 0 THEN
      RAISE EXCEPTION 'Durasi paket harian tidak valid';
    END IF;

    IF pkg.checkout_time IS NULL THEN
      RAISE EXCEPTION 'Jam checkout paket belum dikonfigurasi';
    END IF;

    local_end :=
      (local_date + (pkg.duration_minutes / 1440)::integer)
      + pkg.checkout_time;

  ELSE
    RAISE EXCEPTION 'Mode waktu paket tidak dikenal';
  END IF;

  IF local_end <= local_started THEN
    RAISE EXCEPTION 'Waktu checkout harus setelah waktu check-in';
  END IF;

  started_at := _started_at;
  ends_at := local_end AT TIME ZONE 'Asia/Jakarta';

  RETURN NEXT;
END;
$$;
