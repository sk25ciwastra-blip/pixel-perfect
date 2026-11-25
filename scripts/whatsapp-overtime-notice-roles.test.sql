\set ON_ERROR_STOP on
-- Synthetic isolated database AFTER additive overtime migration.
-- No customer data, payments, or Cloud connection.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
SELECT set_config('request.jwt.claim.training','none',false);
SELECT public.owner_save_whatsapp_reminder_template(
  'PENGINGAT_WAKTU_HABIS','Pengingat [NAMA_TAMU]'
) AS baseline_reminder;
SELECT public.owner_save_whatsapp_reminder_template(
  'PEMBERITAHUAN_OVERTIME','Overtime [NAMA_TAMU] kamar [NOMOR_KAMAR]'
) AS owner_overtime;

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.whatsapp_template_versions
  WHERE kind='PEMBERITAHUAN_OVERTIME' AND status='ACTIVE';
  IF n<>1 THEN RAISE EXCEPTION 'FAIL: one overtime ACTIVE expected'; END IF;
  SELECT count(*) INTO n FROM public.whatsapp_template_audit
  WHERE kind='PEMBERITAHUAN_OVERTIME' AND action='CREATE';
  IF n<>1 THEN RAISE EXCEPTION 'FAIL: overtime audit missing'; END IF;
  SELECT count(*) INTO n FROM public.read_active_whatsapp_reminder_template('PEMBERITAHUAN_OVERTIME');
  IF n<>1 THEN RAISE EXCEPTION 'FAIL: Owner read ACTIVE overtime'; END IF;

  BEGIN
    PERFORM public.owner_save_whatsapp_reminder_template('PEMBERITAHUAN_OVERTIME','Invalid [CHARGE_OT]');
    RAISE EXCEPTION 'FAIL: unapproved overtime charge token accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'FAIL: unapproved overtime charge token accepted' THEN RAISE; END IF;
  END;
END $$;

-- Receptionist can READ ACTIVE but never WRITE, and cannot SELECT the version table.
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.read_active_whatsapp_reminder_template('PEMBERITAHUAN_OVERTIME');
  IF n<>1 THEN RAISE EXCEPTION 'FAIL: Receptionist cannot read Overtime ACTIVE'; END IF;

  SELECT count(*) INTO n FROM public.whatsapp_template_versions;
  IF n<>0 THEN RAISE EXCEPTION 'FAIL: Receptionist can directly read template table'; END IF;

  BEGIN
    PERFORM public.owner_save_whatsapp_reminder_template('PEMBERITAHUAN_OVERTIME','Try [NAMA_TAMU]');
    RAISE EXCEPTION 'FAIL: Receptionist wrote template';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- Training restricted must fail closed for Receptionist.
SELECT set_config('request.jwt.claim.training','restricted',false);
DO $$
BEGIN
  BEGIN
    PERFORM public.read_active_whatsapp_reminder_template('PEMBERITAHUAN_OVERTIME');
    RAISE EXCEPTION 'FAIL: Trainee read Overtime template';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- Housekeeping must fail closed.
UPDATE public.employees SET position='housekeeping'
WHERE user_id='10000000-0000-0000-0000-000000000002';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.training','none',false);
DO $$
BEGIN
  BEGIN
    PERFORM public.read_active_whatsapp_reminder_template('PEMBERITAHUAN_OVERTIME');
    RAISE EXCEPTION 'FAIL: Housekeeping read Overtime template';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- Anonymous role must not execute either template RPC.
SET ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.read_active_whatsapp_reminder_template('PEMBERITAHUAN_OVERTIME');
    RAISE EXCEPTION 'FAIL: Anonymous read Overtime';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.owner_save_whatsapp_reminder_template('PEMBERITAHUAN_OVERTIME','Try [NAMA_TAMU]');
    RAISE EXCEPTION 'FAIL: Anonymous wrote Overtime';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.whatsapp_template_versions
  WHERE kind='PENGINGAT_WAKTU_HABIS' AND status='ACTIVE';
  IF n<>1 THEN RAISE EXCEPTION 'FAIL: existing reminder lost during overtime migration'; END IF;
END $$;
