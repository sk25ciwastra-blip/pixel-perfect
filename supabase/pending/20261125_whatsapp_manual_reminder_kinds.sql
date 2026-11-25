-- Baturaden 25 Homestay Poin 4: additive manual WhatsApp reminder kinds
-- PENDING REVIEW. Does NOT change any overtime billing rule.
-- Existing Penawaran/Booking/legacy Payment rows and RPCs remain unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $check$
DECLARE existing_def text;
BEGIN
 IF to_regclass('public.whatsapp_template_versions') IS NULL
    OR to_regclass('public.whatsapp_template_audit') IS NULL
    OR to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL
    OR to_regprocedure('public.finance_training_current_user_is_restricted()') IS NULL
 THEN RAISE EXCEPTION 'STOP: WhatsApp v1 or auth dependencies missing'; END IF;
 SELECT pg_get_constraintdef(c.oid) INTO existing_def
 FROM pg_constraint c WHERE c.conrelid='public.whatsapp_template_versions'::regclass
 AND c.conname='whatsapp_template_versions_kind_check';
 IF existing_def IS NULL OR existing_def NOT LIKE '%PENAWARAN_RESERVASI%'
    OR existing_def NOT LIKE '%KONFIRMASI_BOOKING%'
    OR existing_def NOT LIKE '%KONFIRMASI_PEMBAYARAN%'
 THEN RAISE EXCEPTION 'STOP: unrecognized existing template kind constraint'; END IF;
 IF to_regprocedure('public.owner_save_whatsapp_reminder_template(text,text)') IS NOT NULL
    OR to_regprocedure('public.read_active_whatsapp_reminder_template(text)') IS NOT NULL
 THEN RAISE EXCEPTION 'STOP: reminder RPC already present; review independently'; END IF;
END $check$;

ALTER TABLE public.whatsapp_template_versions
 DROP CONSTRAINT whatsapp_template_versions_kind_check;
ALTER TABLE public.whatsapp_template_versions
 ADD CONSTRAINT whatsapp_template_versions_kind_check CHECK (kind IN (
 'PENAWARAN_RESERVASI','KONFIRMASI_BOOKING','KONFIRMASI_PEMBAYARAN',
 'PENGINGAT_BOOKING_30_MENIT','PENGINGAT_WAKTU_HABIS'
 ));

-- Separate narrowly-scoped procedures preserve previously verified RPC contracts.
CREATE FUNCTION public.owner_save_whatsapp_reminder_template(_kind text,_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $save$
DECLARE
  actor uuid := auth.uid();
  allowed text[];
  token text;
  remaining text;
  next_revision integer;
  previous_id uuid;
  new_id uuid;
BEGIN
  IF actor IS NULL OR NOT public.has_role(actor,'owner'::public.app_role) THEN
    RAISE EXCEPTION 'Hanya Owner boleh menyimpan pengingat WhatsApp' USING ERRCODE='42501';
  END IF;
  IF _kind NOT IN ('PENGINGAT_BOOKING_30_MENIT','PENGINGAT_WAKTU_HABIS') OR _kind IS NULL THEN
    RAISE EXCEPTION 'Jenis pengingat tidak diizinkan';
  END IF;
  IF _body IS NULL OR length(btrim(_body))=0 OR length(_body)>4000 OR
    replace(_body,chr(10),'') ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Teks pengingat tidak valid';
  END IF;
  allowed := CASE _kind
    WHEN 'PENGINGAT_BOOKING_30_MENIT' THEN ARRAY[
      'NAMA_TAMU','NOMOR_TRANSAKSI','TIPE_KAMAR','NOMOR_KAMAR','CHECKIN_WIB']
    ELSE ARRAY['NAMA_TAMU','NOMOR_TRANSAKSI','NOMOR_KAMAR','BATAS_CHECKOUT_WIB']
  END;
  remaining := regexp_replace(_body,'\\[[A-Z][A-Z0-9_]*\\]','','g');
  IF remaining ~ '[\\[\\]]' OR NOT (_body ~ '\\[[A-Z][A-Z0-9_]*\\]') THEN
    RAISE EXCEPTION 'Variabel pengingat tidak valid';
  END IF;
  FOR token IN SELECT hit[1] FROM regexp_matches(_body,'\\[([A-Z][A-Z0-9_]*)\\]','g') AS hits(hit) LOOP
    IF NOT (token=ANY(allowed)) THEN RAISE EXCEPTION 'Variabel tidak diizinkan'; END IF;
  END LOOP;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp_template:'||_kind,0));
  SELECT coalesce(max(revision),0)+1 INTO next_revision
    FROM public.whatsapp_template_versions WHERE kind=_kind;
  SELECT id INTO previous_id FROM public.whatsapp_template_versions
    WHERE kind=_kind AND status='ACTIVE' FOR UPDATE;
  IF previous_id IS NOT NULL THEN
    UPDATE public.whatsapp_template_versions SET status='SUPERSEDED' WHERE id=previous_id;
    INSERT INTO public.whatsapp_template_audit(version_id,kind,action,actor_id)
    VALUES(previous_id,_kind,'SUPERSEDE',actor);
  END IF;
  INSERT INTO public.whatsapp_template_versions(kind,revision,body,status,created_by)
  VALUES(_kind,next_revision,_body,'ACTIVE',actor) RETURNING id INTO new_id;
  INSERT INTO public.whatsapp_template_audit(version_id,kind,action,actor_id)
  VALUES(new_id,_kind,'CREATE',actor);
  RETURN new_id;
END;
$save$;

CREATE FUNCTION public.read_active_whatsapp_reminder_template(_kind text)
RETURNS TABLE(kind text,revision integer,body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $read$
DECLARE
  actor uuid:=auth.uid();
  active_staff boolean;
  restricted boolean:=true;
BEGIN
  IF actor IS NULL OR _kind IS NULL
    OR _kind NOT IN ('PENGINGAT_BOOKING_30_MENIT','PENGINGAT_WAKTU_HABIS') THEN
    RAISE EXCEPTION 'Akses pengingat ditolak' USING ERRCODE='42501';
  END IF;
  IF NOT public.has_role(actor,'owner'::public.app_role) THEN
    SELECT EXISTS(
      SELECT 1 FROM public.user_roles roles
      JOIN public.employees emp ON emp.user_id=roles.user_id
      WHERE roles.user_id=actor AND roles.role='employee'::public.app_role
        AND emp.active=true AND emp.position::text='receptionist'
    ) INTO active_staff;
    IF NOT active_staff THEN RAISE EXCEPTION 'Akses pengingat ditolak' USING ERRCODE='42501'; END IF;
    IF pg_catalog.to_regprocedure('public.finance_training_current_user_is_restricted()') IS NULL THEN
      RAISE EXCEPTION 'Pengaman Training belum tersedia' USING ERRCODE='42501';
    END IF;
    EXECUTE 'SELECT public.finance_training_current_user_is_restricted()' INTO restricted;
    IF restricted IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'Pengingat dibatasi selama Training' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN QUERY SELECT t.kind,t.revision,t.body FROM public.whatsapp_template_versions t
    WHERE t.kind=_kind AND t.status='ACTIVE' ORDER BY t.revision DESC LIMIT 1;
END;
$read$;

REVOKE ALL ON FUNCTION public.owner_save_whatsapp_reminder_template(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.read_active_whatsapp_reminder_template(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.owner_save_whatsapp_reminder_template(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.read_active_whatsapp_reminder_template(text) TO authenticated;
COMMIT;
-- No seed, no timer job, no outbound WA, no change to finance/overtime/RPC v1.
