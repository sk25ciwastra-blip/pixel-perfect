-- PENDING OWNER APPROVAL ONLY. No Cloud execution authorized.
-- Snapshot: complete_housekeeping_checklist Cloud body 2756ae72d61632458a5688b037526d75.
-- Fixes same-key concurrent retry only; READY severity/SOP is unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $preflight$
DECLARE target oid := to_regprocedure('public.complete_housekeeping_checklist(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text)');
BEGIN
  IF target IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE oid=target AND prosecdef
      AND proconfig @> ARRAY['search_path=public']
      AND md5(prosrc) IN ('2756ae72d61632458a5688b037526d75','8c9dbcabf70646f89c047291cd81c0f2')
  ) THEN RAISE EXCEPTION 'HK function drift: stop and review before applying'; END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.complete_housekeeping_checklist(_room_id uuid, _checklist_id uuid, _towel_ok boolean, _mineral_water_ok boolean, _tissue_ok boolean, _ashtray_ok boolean, _tv_remote_ok boolean, _fan_ok boolean, _exhaust_fan_ok boolean, _issue_note text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_status public.room_status;
  start_history record;
  existing_checklist record;
  employee_name text;
  result_name text;
  checklist_id uuid;
  job_code text;
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kamar tidak sedang dibersihkan';
  END IF;

  -- Another request may have committed this exact key while we waited for
  -- the room lock. Recheck before rejecting the now-READY room.
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

  IF current_status <> 'cleaning' THEN
    RAISE EXCEPTION 'Kamar tidak sedang dibersihkan';
  END IF;

  SELECT h.id, h.job_id, h.transaction_id, h.job_number
  INTO start_history
  FROM public.housekeeping_history h
  WHERE h.room_id = _room_id
    AND h.action = 'start_cleaning'
  ORDER BY h.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Riwayat mulai pembersihan tidak ditemukan';
  END IF;

  job_code := start_history.job_number;

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
    job_id,
    job_number,
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
    start_history.job_id,
    job_code,
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

DO $postcheck$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.complete_housekeeping_checklist(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text)'::regprocedure) IS DISTINCT FROM '8c9dbcabf70646f89c047291cd81c0f2' THEN
    RAISE EXCEPTION 'HK function verification failed';
  END IF;
END;
$postcheck$;
COMMIT;
