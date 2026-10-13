BEGIN;

CREATE TABLE IF NOT EXISTS public.housekeeping_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  housekeeping_history_id uuid NOT NULL
    REFERENCES public.housekeeping_history(id)
    ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id),
  transaction_id uuid REFERENCES public.transactions(id)
    ON DELETE SET NULL,
  towel_ok boolean NOT NULL,
  mineral_water_ok boolean NOT NULL,
  tissue_ok boolean NOT NULL,
  ashtray_ok boolean NOT NULL,
  tv_remote_ok boolean NOT NULL,
  fan_ok boolean NOT NULL,
  exhaust_fan_ok boolean NOT NULL,
  issue_note text NOT NULL DEFAULT '',
  towel_reason text NOT NULL DEFAULT '',
  mineral_water_reason text NOT NULL DEFAULT '',
  tissue_reason text NOT NULL DEFAULT '',
  ashtray_reason text NOT NULL DEFAULT '',
  tv_remote_reason text NOT NULL DEFAULT '',
  fan_reason text NOT NULL DEFAULT '',
  exhaust_fan_reason text NOT NULL DEFAULT '',
  result text NOT NULL CHECK (result IN ('passed', 'needs_action')),
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  performed_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.housekeeping_checklists
  ADD COLUMN IF NOT EXISTS towel_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mineral_water_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tissue_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ashtray_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tv_remote_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fan_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS exhaust_fan_reason text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS housekeeping_checklists_room_created_idx
  ON public.housekeeping_checklists (room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS housekeeping_checklists_history_created_idx
  ON public.housekeeping_checklists (housekeeping_history_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS housekeeping_checklists_history_unique
  ON public.housekeeping_checklists (housekeeping_history_id);

ALTER TABLE public.housekeeping_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS housekeeping_checklists_read
ON public.housekeeping_checklists;

CREATE POLICY housekeeping_checklists_read
ON public.housekeeping_checklists
FOR SELECT
TO authenticated
USING (
  public.can_housekeeping(auth.uid())
  OR public.has_employee_position(
    auth.uid(),
    array['inspector'::public.employee_position]
  )
);

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.housekeeping_checklists
FROM PUBLIC, anon, authenticated;

GRANT SELECT
ON TABLE public.housekeeping_checklists
TO authenticated;

CREATE TABLE IF NOT EXISTS public.housekeeping_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_type text NOT NULL CHECK (work_type IN ('linen', 'fan', 'toilet')),
  room_id uuid REFERENCES public.rooms(id),
  location_code text NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  operational_date date NOT NULL
    DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date),
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  performed_by_name text NOT NULL,
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  recorded_by_name text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT housekeeping_maintenance_toilet_location_check
    CHECK (
      work_type <> 'toilet'
      OR location_code IN (
        'Toilet Lantai 2 · Kiri',
        'Toilet Lantai 2 · Kanan',
        'Toilet Lantai 1 · Kiri',
        'Toilet Lantai 1 · Kanan',
        'Toilet Superior B · 02',
        'Toilet Superior B · 03',
        'Toilet Superior B · 04'
      )
    ),
  CONSTRAINT housekeeping_maintenance_room_requirement_check
    CHECK (
      (work_type IN ('linen', 'fan') AND room_id IS NOT NULL)
      OR (
        work_type = 'toilet'
        AND (
          (
            location_code IN (
              'Toilet Lantai 2 · Kiri',
              'Toilet Lantai 2 · Kanan',
              'Toilet Lantai 1 · Kiri',
              'Toilet Lantai 1 · Kanan'
            )
            AND room_id IS NULL
          )
          OR (
            location_code IN (
              'Toilet Superior B · 02',
              'Toilet Superior B · 03',
              'Toilet Superior B · 04'
            )
            AND room_id IS NOT NULL
          )
        )
      )
  )
);

ALTER TABLE public.housekeeping_maintenance
  DROP CONSTRAINT IF EXISTS housekeeping_maintenance_room_requirement_check;

ALTER TABLE public.housekeeping_maintenance
  ADD CONSTRAINT housekeeping_maintenance_room_requirement_check
  CHECK (
    (work_type IN ('linen', 'fan') AND room_id IS NOT NULL)
    OR (
      work_type = 'toilet'
      AND (
        (
          location_code IN (
            'Toilet Lantai 2 · Kiri',
            'Toilet Lantai 2 · Kanan',
            'Toilet Lantai 1 · Kiri',
            'Toilet Lantai 1 · Kanan'
          )
          AND room_id IS NULL
        )
        OR (
          location_code IN (
            'Toilet Superior B · 02',
            'Toilet Superior B · 03',
            'Toilet Superior B · 04'
          )
          AND room_id IS NOT NULL
        )
      )
    )
  );

CREATE INDEX IF NOT EXISTS housekeeping_maintenance_location_date_idx
  ON public.housekeeping_maintenance (
    work_type,
    location_code,
    operational_date DESC
  );

CREATE INDEX IF NOT EXISTS housekeeping_maintenance_room_date_idx
  ON public.housekeeping_maintenance (room_id, operational_date DESC);

DROP INDEX IF EXISTS public.housekeeping_maintenance_toilet_daily_unique;

CREATE OR REPLACE FUNCTION public.validate_housekeeping_maintenance_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  expected_room_number text;
  actual_room_number text;
  actual_room_status public.room_status;
BEGIN
  IF NEW.work_type <> 'toilet' THEN
    RETURN NEW;
  END IF;

  IF NEW.location_code IN (
    'Toilet Lantai 2 · Kiri',
    'Toilet Lantai 2 · Kanan',
    'Toilet Lantai 1 · Kiri',
    'Toilet Lantai 1 · Kanan'
  ) THEN
    IF NEW.room_id IS NOT NULL THEN
      RAISE EXCEPTION 'Toilet bersama tidak boleh memiliki room_id';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.location_code IN (
    'Toilet Superior B · 02',
    'Toilet Superior B · 03',
    'Toilet Superior B · 04'
  ) THEN
    expected_room_number := replace(NEW.location_code, 'Toilet Superior B · ', '');

    IF NEW.room_id IS NULL THEN
      RAISE EXCEPTION
        'Toilet Superior B wajib terhubung dengan kamar %',
        expected_room_number;
    END IF;

    SELECT r.room_number, r.status
    INTO actual_room_number, actual_room_status
    FROM public.rooms r
    WHERE r.id = NEW.room_id
      AND r.active
    FOR UPDATE;

    IF NOT FOUND OR actual_room_number <> expected_room_number THEN
      RAISE EXCEPTION
        'room_id tidak cocok dengan lokasi Toilet Superior B %',
        expected_room_number;
    END IF;

    IF actual_room_status = 'occupied' THEN
      RAISE EXCEPTION 'MENUNGGU AKSES: kamar sedang terisi';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Lokasi toilet tidak valid';
END;
$function$;

DO $maintenance_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.housekeeping_maintenance'::regclass
      AND tgname = 'housekeeping_maintenance_location_guard'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER housekeeping_maintenance_location_guard
    BEFORE INSERT OR UPDATE OF work_type, room_id, location_code
    ON public.housekeeping_maintenance
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_housekeeping_maintenance_location();
  END IF;
END;
$maintenance_trigger$;

ALTER TABLE public.housekeeping_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS housekeeping_maintenance_read
ON public.housekeeping_maintenance;

CREATE POLICY housekeeping_maintenance_read
ON public.housekeeping_maintenance
FOR SELECT
TO authenticated
USING (public.can_view_operations(auth.uid()));

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.housekeeping_maintenance
FROM PUBLIC, anon, authenticated;

GRANT SELECT
ON TABLE public.housekeeping_maintenance
TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_room_cleaning(
  _room_id uuid,
  _note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_status public.room_status;
  employee_name text;
  related_transaction uuid;
BEGIN
  IF NOT public.can_housekeeping(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT status
  INTO current_status
  FROM public.rooms
  WHERE id = _room_id
    AND active
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kamar tidak ditemukan atau tidak aktif';
  END IF;

  IF current_status <> 'dirty' THEN
    IF current_status = 'cleaning' THEN
      RAISE EXCEPTION 'Checklist akhir wajib diselesaikan sebelum kamar SIAP';
    END IF;

    RAISE EXCEPTION 'Status kamar tidak dapat diubah';
  END IF;

  SELECT COALESCE(
    (
      SELECT e.name
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.active
      LIMIT 1
    ),
    CASE
      WHEN public.has_role(auth.uid(), 'owner') THEN 'Owner'
      ELSE 'Petugas Housekeeping'
    END
  )
  INTO employee_name;

  SELECT t.id
  INTO related_transaction
  FROM public.transactions t
  WHERE t.room_id = _room_id
    AND t.status = 'check_out'
  ORDER BY COALESCE(t.checked_out_at, t.updated_at, t.created_at) DESC
  LIMIT 1;

  UPDATE public.rooms
  SET status = 'cleaning'
  WHERE id = _room_id;

  INSERT INTO public.housekeeping_history (
    room_id,
    transaction_id,
    action,
    from_status,
    to_status,
    note,
    performed_by,
    performed_by_name
  )
  VALUES (
    _room_id,
    related_transaction,
    'start_cleaning',
    'dirty',
    'cleaning',
    trim(coalesce(_note, '')),
    auth.uid(),
    employee_name
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.advance_room_cleaning(
  _room_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.advance_room_cleaning(_room_id, '');
END;
$function$;

REVOKE ALL ON FUNCTION public.advance_room_cleaning(uuid, text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.advance_room_cleaning(uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.advance_room_cleaning(uuid, text)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.advance_room_cleaning(uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_housekeeping_checklist(
  _room_id uuid,
  _checklist_id uuid,
  _towel_ok boolean,
  _mineral_water_ok boolean,
  _tissue_ok boolean,
  _ashtray_ok boolean,
  _tv_remote_ok boolean,
  _fan_ok boolean,
  _exhaust_fan_ok boolean,
  _issue_note text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_status public.room_status;
  start_history record;
  existing_checklist record;
  employee_name text;
  result_name text;
  checklist_id uuid;
  item_payload jsonb;
  towel_reason_value text;
  mineral_water_reason_value text;
  tissue_reason_value text;
  ashtray_reason_value text;
  tv_remote_reason_value text;
  fan_reason_value text;
  exhaust_fan_reason_value text;
  history_note text;
BEGIN
  IF NOT public.can_housekeeping(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT id, room_id
  INTO existing_checklist
  FROM public.housekeeping_checklists
  WHERE id = _checklist_id;

  IF FOUND THEN
    IF existing_checklist.room_id <> _room_id THEN
      RAISE EXCEPTION 'Checklist idempotency key sudah digunakan untuk kamar lain';
    END IF;

    RETURN existing_checklist.id;
  END IF;

  BEGIN
    item_payload := CASE
      WHEN trim(coalesce(_issue_note, '')) = '' THEN '{}'::jsonb
      ELSE trim(_issue_note)::jsonb
    END;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Alasan checklist tidak valid';
  END;

  IF jsonb_typeof(item_payload) <> 'object' THEN
    RAISE EXCEPTION 'Alasan checklist harus berbentuk object';
  END IF;

  towel_reason_value := trim(coalesce(item_payload->>'towel', ''));
  mineral_water_reason_value := trim(coalesce(item_payload->>'mineral_water', ''));
  tissue_reason_value := trim(coalesce(item_payload->>'tissue', ''));
  ashtray_reason_value := trim(coalesce(item_payload->>'ashtray', ''));
  tv_remote_reason_value := trim(coalesce(item_payload->>'tv_remote', ''));
  fan_reason_value := trim(coalesce(item_payload->>'fan', ''));
  exhaust_fan_reason_value := trim(coalesce(item_payload->>'exhaust_fan', ''));

  IF _towel_ok IS NULL
     OR _mineral_water_ok IS NULL
     OR _tissue_ok IS NULL
     OR _ashtray_ok IS NULL
     OR _tv_remote_ok IS NULL
     OR _fan_ok IS NULL
     OR _exhaust_fan_ok IS NULL THEN
    RAISE EXCEPTION 'Semua item checklist wajib dijawab';
  END IF;

  IF NOT _towel_ok AND towel_reason_value = '' THEN
    RAISE EXCEPTION 'Alasan Handuk wajib diisi';
  END IF;

  IF NOT _mineral_water_ok AND mineral_water_reason_value = '' THEN
    RAISE EXCEPTION 'Alasan Air mineral wajib diisi';
  END IF;

  IF NOT _tissue_ok AND tissue_reason_value = '' THEN
    RAISE EXCEPTION 'Alasan Tisu wajib diisi';
  END IF;

  IF NOT _ashtray_ok AND ashtray_reason_value = '' THEN
    RAISE EXCEPTION 'Alasan Asbak wajib diisi';
  END IF;

  IF NOT _tv_remote_ok AND tv_remote_reason_value = '' THEN
    RAISE EXCEPTION 'Alasan TV + Remot wajib diisi';
  END IF;

  IF NOT _fan_ok AND fan_reason_value = '' THEN
    RAISE EXCEPTION 'Alasan Kipas Angin wajib diisi';
  END IF;

  IF NOT _exhaust_fan_ok AND exhaust_fan_reason_value = '' THEN
    RAISE EXCEPTION 'Alasan Exhaust Fan wajib diisi';
  END IF;

  SELECT status
  INTO current_status
  FROM public.rooms
  WHERE id = _room_id
    AND active
  FOR UPDATE;

  IF NOT FOUND OR current_status <> 'cleaning' THEN
    RAISE EXCEPTION 'Kamar tidak sedang dibersihkan';
  END IF;

  SELECT h.id, h.transaction_id
  INTO start_history
  FROM public.housekeeping_history h
  WHERE h.room_id = _room_id
    AND h.action = 'start_cleaning'
  ORDER BY h.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Riwayat mulai pembersihan tidak ditemukan';
  END IF;

  SELECT COALESCE(
    (
      SELECT e.name
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.active
      LIMIT 1
    ),
    CASE
      WHEN public.has_role(auth.uid(), 'owner') THEN 'Owner'
      ELSE 'Petugas Housekeeping'
    END
  )
  INTO employee_name;

  result_name := CASE
    WHEN _towel_ok
     AND _mineral_water_ok
     AND _tissue_ok
     AND _ashtray_ok
     AND _tv_remote_ok
     AND _fan_ok
     AND _exhaust_fan_ok
    THEN 'passed'
    ELSE 'needs_action'
  END;

  history_note := concat_ws(
    '; ',
    'Handuk: ' || CASE WHEN _towel_ok THEN 'CENTANG' ELSE 'X - ' || towel_reason_value END,
    'Air mineral: ' || CASE WHEN _mineral_water_ok THEN 'CENTANG' ELSE 'X - ' || mineral_water_reason_value END,
    'Tisu: ' || CASE WHEN _tissue_ok THEN 'CENTANG' ELSE 'X - ' || tissue_reason_value END,
    'Asbak: ' || CASE WHEN _ashtray_ok THEN 'CENTANG' ELSE 'X - ' || ashtray_reason_value END,
    'TV + Remot: ' || CASE WHEN _tv_remote_ok THEN 'CENTANG' ELSE 'X - ' || tv_remote_reason_value END,
    'Kipas Angin: ' || CASE WHEN _fan_ok THEN 'CENTANG' ELSE 'X - ' || fan_reason_value END,
    'Exhaust Fan: ' || CASE WHEN _exhaust_fan_ok THEN 'CENTANG' ELSE 'X - ' || exhaust_fan_reason_value END
  );

  history_note := COALESCE(
    NULLIF(history_note, ''),
    'Checklist akhir seluruh item sesuai'
  );

  INSERT INTO public.housekeeping_checklists (
    id,
    housekeeping_history_id,
    room_id,
    transaction_id,
    towel_ok,
    mineral_water_ok,
    tissue_ok,
    ashtray_ok,
    tv_remote_ok,
    fan_ok,
    exhaust_fan_ok,
    issue_note,
    towel_reason,
    mineral_water_reason,
    tissue_reason,
    ashtray_reason,
    tv_remote_reason,
    fan_reason,
    exhaust_fan_reason,
    result,
    performed_by,
    performed_by_name
  )
  VALUES (
    _checklist_id,
    start_history.id,
    _room_id,
    start_history.transaction_id,
    _towel_ok,
    _mineral_water_ok,
    _tissue_ok,
    _ashtray_ok,
    _tv_remote_ok,
    _fan_ok,
    _exhaust_fan_ok,
    history_note,
    towel_reason_value,
    mineral_water_reason_value,
    tissue_reason_value,
    ashtray_reason_value,
    tv_remote_reason_value,
    fan_reason_value,
    exhaust_fan_reason_value,
    result_name,
    auth.uid(),
    employee_name
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO checklist_id;

  IF checklist_id IS NULL THEN
    SELECT id
    INTO checklist_id
    FROM public.housekeeping_checklists
    WHERE housekeeping_history_id = start_history.id;

    IF checklist_id IS NULL THEN
      RAISE EXCEPTION 'Checklist gagal dicatat karena konflik id';
    END IF;

    RETURN checklist_id;
  END IF;

  UPDATE public.rooms
  SET status = 'ready'
  WHERE id = _room_id;

  INSERT INTO public.housekeeping_history (
    room_id,
    transaction_id,
    action,
    from_status,
    to_status,
    note,
    performed_by,
    performed_by_name
  )
  VALUES (
    _room_id,
    start_history.transaction_id,
    'finish_cleaning',
    'cleaning',
    'ready',
    history_note,
    auth.uid(),
    employee_name
  );

  RETURN checklist_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_housekeeping_checklist(
  uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.complete_housekeeping_checklist(
  uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_housekeeping_maintenance(
  _maintenance_id uuid,
  _work_type text,
  _room_id uuid,
  _location_code text,
  _performed_by uuid DEFAULT NULL,
  _note text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_performer uuid := COALESCE(_performed_by, auth.uid());
  performer_name text;
  recorder_name text;
  room_status_value public.room_status;
  operation_date date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  existing_id uuid;
  existing_work_type text;
  existing_room_id uuid;
  existing_location_code text;
  expected_room_number text;
  actual_room_number text;
  selected_room_id uuid := _room_id;
BEGIN
  IF NOT public.can_housekeeping(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT id, work_type, room_id, location_code
  INTO existing_id, existing_work_type, existing_room_id, existing_location_code
  FROM public.housekeeping_maintenance
  WHERE id = _maintenance_id;

  IF FOUND THEN
    IF existing_work_type IS DISTINCT FROM _work_type
       OR existing_location_code IS DISTINCT FROM _location_code
       OR (
         _work_type <> 'toilet'
         AND existing_room_id IS DISTINCT FROM _room_id
       ) THEN
      RAISE EXCEPTION 'Id pencatatan perawatan sudah digunakan untuk data lain';
    END IF;

    RETURN existing_id;
  END IF;

  IF _work_type NOT IN ('linen', 'fan', 'toilet') THEN
    RAISE EXCEPTION 'Jenis perawatan tidak valid';
  END IF;

  IF _work_type = 'toilet' THEN
    IF _location_code NOT IN (
      'Toilet Lantai 2 · Kiri',
      'Toilet Lantai 2 · Kanan',
      'Toilet Lantai 1 · Kiri',
      'Toilet Lantai 1 · Kanan',
      'Toilet Superior B · 02',
      'Toilet Superior B · 03',
      'Toilet Superior B · 04'
    ) THEN
      RAISE EXCEPTION 'Lokasi toilet tidak valid';
    END IF;

    IF _location_code IN (
      'Toilet Lantai 2 · Kiri',
      'Toilet Lantai 2 · Kanan',
      'Toilet Lantai 1 · Kiri',
      'Toilet Lantai 1 · Kanan'
    ) THEN
      IF _room_id IS NOT NULL THEN
        RAISE EXCEPTION 'Toilet bersama tidak boleh memiliki room_id';
      END IF;
    ELSE
      expected_room_number := replace(_location_code, 'Toilet Superior B · ', '');

      IF selected_room_id IS NULL THEN
        SELECT r.id
        INTO selected_room_id
        FROM public.rooms r
        WHERE r.room_number = expected_room_number
          AND r.active
        ORDER BY r.id
        LIMIT 1;
      END IF;

      SELECT r.room_number, r.status
      INTO actual_room_number, room_status_value
      FROM public.rooms r
      WHERE r.id = selected_room_id
        AND r.active
      FOR UPDATE;

      IF NOT FOUND OR actual_room_number <> expected_room_number THEN
        RAISE EXCEPTION
          'room_id tidak cocok dengan lokasi Toilet Superior B %',
          expected_room_number;
      END IF;

      IF room_status_value = 'occupied' THEN
        RAISE EXCEPTION 'MENUNGGU AKSES: kamar sedang terisi';
      END IF;
    END IF;
  ELSE
    IF _room_id IS NULL THEN
      RAISE EXCEPTION 'Kamar wajib dipilih untuk perawatan ini';
    END IF;

    SELECT status
    INTO room_status_value
    FROM public.rooms
    WHERE id = _room_id
      AND active
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Kamar tidak ditemukan atau tidak aktif';
    END IF;

    IF room_status_value = 'occupied' THEN
      RAISE EXCEPTION 'MENUNGGU AKSES: kamar sedang terisi';
    END IF;
  END IF;

  IF selected_performer <> auth.uid()
     AND NOT (
       public.has_role(auth.uid(), 'owner')
       OR public.has_employee_position(
         auth.uid(),
         array['supervisor'::public.employee_position]
       )
     ) THEN
    RAISE EXCEPTION 'Hanya Owner atau Supervisor yang dapat mencatat atas nama petugas lain';
  END IF;

  SELECT e.name
  INTO performer_name
  FROM public.employees e
  WHERE e.user_id = selected_performer
    AND e.active
    AND e.position = 'housekeeping';

  IF performer_name IS NULL THEN
    IF selected_performer = auth.uid()
       AND public.has_role(auth.uid(), 'owner') THEN
      performer_name := 'Owner';
    ELSE
      RAISE EXCEPTION 'Petugas housekeeping tidak ditemukan atau tidak aktif';
    END IF;
  END IF;

  SELECT COALESCE(
    (
      SELECT e.name
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.active
      LIMIT 1
    ),
    CASE
      WHEN public.has_role(auth.uid(), 'owner') THEN 'Owner'
      ELSE 'Operator'
    END
  )
  INTO recorder_name;

  INSERT INTO public.housekeeping_maintenance (
    id,
    work_type,
    room_id,
    location_code,
    performed_at,
    operational_date,
    performed_by,
    performed_by_name,
    recorded_by,
    recorded_by_name,
    note
  )
  VALUES (
    _maintenance_id,
    _work_type,
    selected_room_id,
    _location_code,
    now(),
    operation_date,
    selected_performer,
    performer_name,
    auth.uid(),
    recorder_name,
    trim(coalesce(_note, ''))
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO existing_id;

  IF existing_id IS NULL THEN
    SELECT id, work_type, room_id, location_code
    INTO existing_id, existing_work_type, existing_room_id, existing_location_code
    FROM public.housekeeping_maintenance
    WHERE id = _maintenance_id;
  END IF;

  IF existing_id IS NULL THEN
    RAISE EXCEPTION 'Pencatatan perawatan gagal atau sudah berubah';
  END IF;

  IF existing_work_type IS NOT NULL
     AND (
       existing_work_type IS DISTINCT FROM _work_type
       OR existing_room_id IS DISTINCT FROM selected_room_id
       OR existing_location_code IS DISTINCT FROM _location_code
     ) THEN
    RAISE EXCEPTION 'Id pencatatan perawatan sudah digunakan untuk data lain';
  END IF;

  RETURN existing_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_housekeeping_maintenance(
  uuid, text, uuid, text, uuid, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_housekeeping_maintenance(
  uuid, text, uuid, text, uuid, text
) TO authenticated;

COMMIT;
