-- DRAFT ONLY. Apply AFTER PR67 b4a486c and PR68 b9460e9, never in this task.
-- Owner decision Issue61/6862623040: B25EMP-001, global, minimum 3 digits, no year reset.
BEGIN;
DO $$ BEGIN
  IF current_user <> pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.employees'::regclass)) THEN
    RAISE EXCEPTION 'Migrasi memerlukan trusted owner employees';
  END IF;
  IF to_regprocedure('public.can_manage_employee_private_profile()') IS NULL
     OR to_regclass('public.employee_lifecycle') IS NULL THEN RAISE EXCEPTION 'Dependencies PR67/PR68 belum tersedia'; END IF;
END $$;
CREATE SEQUENCE public.employee_enrollment_number_seq;
REVOKE ALL ON SEQUENCE public.employee_enrollment_number_seq FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.format_new_employee_identifier(_number bigint) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN _number > 0 THEN
    'B25EMP-' || lpad(_number::text, greatest(3,length(_number::text)), '0')
  ELSE NULL END
$$;
REVOKE ALL ON FUNCTION public.format_new_employee_identifier(bigint) FROM PUBLIC,anon,authenticated;

ALTER TABLE public.employee_private_profiles
  ADD COLUMN birth_place text CHECK (length(btrim(birth_place)) BETWEEN 1 AND 100),
  ADD COLUMN birth_date date,
  ADD COLUMN gender text CHECK (length(btrim(gender)) BETWEEN 1 AND 40),
  ADD COLUMN address text CHECK (length(btrim(address)) BETWEEN 5 AND 500),
  ADD COLUMN email text CHECK (length(email) BETWEEN 3 AND 254);
-- Nullable for old profiles: no invented birth data/backfill or login blocking.
CREATE TABLE public.employee_enrollment_requests (
  request_id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES auth.users(id),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK (state IN ('RESERVED','AUTH_ATTACHED','COMPLETED','RECOVERY_REQUIRED','CANCELLED')),
  generated_identifier text NOT NULL UNIQUE,
  auth_user_id uuid, -- tombstone retained after compensated Auth deletion; deliberately no FK
  employee_id uuid REFERENCES public.employees(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  delivery_state text NOT NULL DEFAULT 'NOT_ATTEMPTED' CHECK (delivery_state IN ('NOT_ATTEMPTED','ATTEMPTED','SENT','UNKNOWN'))
);
ALTER TABLE public.employee_enrollment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_enrollment_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.employee_enrollment_requests TO authenticated;
CREATE POLICY enrollment_owner_read ON public.employee_enrollment_requests FOR SELECT TO authenticated
USING (actor_id=auth.uid() AND (SELECT public.can_manage_employee_private_profile()));

CREATE FUNCTION public.begin_employee_enrollment(_request_id uuid,_fingerprint text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.employee_enrollment_requests; code text; n integer:=0;
BEGIN
  IF public.can_manage_employee_private_profile() IS NOT TRUE THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF _request_id IS NULL OR _fingerprint IS NULL OR _fingerprint !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Permintaan tidak valid'; END IF;
  -- Same request serializes before any external Auth operation.
  PERFORM pg_advisory_xact_lock(hashtextextended(_request_id::text,0));
  SELECT * INTO r FROM public.employee_enrollment_requests WHERE request_id=_request_id FOR UPDATE;
  IF FOUND THEN
    IF r.actor_id<>auth.uid() OR r.fingerprint<>_fingerprint THEN RAISE EXCEPTION 'Idempotency mismatch'; END IF;
    RETURN to_jsonb(r)||jsonb_build_object('acquired',false);
  END IF;
  LOOP
    code:=public.format_new_employee_identifier(nextval('public.employee_enrollment_number_seq'));
    IF code IS NULL OR length(code) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Hasil generator ID tidak valid'; END IF;
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.employees WHERE employee_id=code);
    n:=n+1; IF n>10000 THEN RAISE EXCEPTION 'Konflik ID perlu review'; END IF;
  END LOOP;
  INSERT INTO public.employee_enrollment_requests(request_id,actor_id,fingerprint,state,generated_identifier)
  VALUES(_request_id,auth.uid(),_fingerprint,'RESERVED',code) RETURNING * INTO r;
  RETURN to_jsonb(r)||jsonb_build_object('acquired',true);
END $$;

CREATE FUNCTION public.attach_employee_enrollment_auth(_request_id uuid,_auth_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.employee_enrollment_requests;
BEGIN
  IF public.can_manage_employee_private_profile() IS NOT TRUE THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO r FROM public.employee_enrollment_requests WHERE request_id=_request_id AND actor_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR r.state<>'RESERVED' OR NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id=_auth_user_id AND u.created_at>=r.created_at
      AND u.raw_app_meta_data->'employee_enrollment'->>'request_id'=_request_id::text
      AND u.raw_app_meta_data->'employee_enrollment'->>'actor_id'=auth.uid()::text
      AND NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.user_id=u.id)
  ) THEN RAISE EXCEPTION 'Auth binding tidak valid'; END IF;
  UPDATE public.employee_enrollment_requests SET auth_user_id=_auth_user_id,state='AUTH_ATTACHED' WHERE request_id=_request_id;
END $$;

CREATE FUNCTION public.guard_generated_employee_identifier() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN RAISE EXCEPTION 'ID Karyawan read-only'; END IF;
  ELSIF current_user <> pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.employees'::regclass)) THEN
    RAISE EXCEPTION 'Registrasi hanya melalui secure provisioning';
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.employee_enrollment_requests r WHERE r.auth_user_id=NEW.user_id
      AND r.actor_id=auth.uid() AND r.state='AUTH_ATTACHED' AND r.generated_identifier=NEW.employee_id
  ) THEN RAISE EXCEPTION 'Registrasi hanya melalui secure provisioning';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_generated_employee_identifier BEFORE INSERT OR UPDATE OF employee_id ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.guard_generated_employee_identifier();

CREATE FUNCTION public.validate_employee_identity(_p jsonb) RETURNS void
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF jsonb_typeof(_p) IS DISTINCT FROM 'object' OR
    NOT (_p ?& ARRAY['nik','phone','emergencyName','emergencyRelationship','emergencyPhone','birthPlace','birthDate','gender','address','email'])
    OR EXISTS(SELECT 1 FROM jsonb_each(_p) x WHERE jsonb_typeof(x.value)<>'string')
    OR EXISTS(SELECT 1 FROM jsonb_each_text(_p) x WHERE x.value ~ '[[:cntrl:]]')
    OR (SELECT count(*) FROM jsonb_object_keys(_p))<>10
    OR _p->>'nik' !~ '^[0-9]{16}$' OR _p->>'phone' !~ '^[+]?[0-9]{9,15}$'
    OR _p->>'emergencyPhone' !~ '^[+]?[0-9]{9,15}$'
    OR length(btrim(_p->>'emergencyName')) NOT BETWEEN 2 AND 100
    OR length(btrim(_p->>'emergencyRelationship')) NOT BETWEEN 2 AND 60
    OR length(btrim(_p->>'birthPlace')) NOT BETWEEN 1 AND 100
    OR length(btrim(_p->>'gender')) NOT BETWEEN 1 AND 40
    OR length(btrim(_p->>'address')) NOT BETWEEN 5 AND 500
    OR length(_p->>'email')>254 OR _p->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    OR _p->>'birthDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    OR (_p->>'birthDate')::date> (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date
  THEN RAISE EXCEPTION 'Identitas privat tidak valid'; END IF;
END $$;

CREATE FUNCTION public.finalize_employee_enrollment(_request_id uuid,_name text,_position public.employee_position,_join_date date,_identity jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.employee_enrollment_requests; e uuid; v bigint;
BEGIN
  IF public.can_manage_employee_private_profile() IS NOT TRUE THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO r FROM public.employee_enrollment_requests WHERE request_id=_request_id AND actor_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permintaan tidak tersedia'; END IF;
  IF r.state='COMPLETED' THEN RETURN r.employee_id; END IF;
  IF r.state<>'AUTH_ATTACHED' THEN RAISE EXCEPTION 'Permintaan tidak siap'; END IF;
  PERFORM public.validate_employee_identity(_identity);
  IF _name IS NULL OR length(btrim(_name)) NOT BETWEEN 1 AND 100 OR _join_date IS NULL
     OR _join_date>(clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date
     OR _position IS NULL OR _position::text NOT IN ('receptionist','supervisor','housekeeping','inspector','investor')
     OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=r.auth_user_id AND lower(email)=lower(_identity->>'email'))
  THEN RAISE EXCEPTION 'Data enrollment tidak valid'; END IF;
  INSERT INTO public.user_roles(user_id,role) VALUES(r.auth_user_id,'employee');
  INSERT INTO public.employees(user_id,name,employee_id,position,active)
  VALUES(r.auth_user_id,btrim(_name),r.generated_identifier,_position,false) RETURNING id INTO e;
  SELECT version INTO v FROM public.employee_lifecycle WHERE employee_id=e;
  PERFORM public.change_employee_lifecycle(e,'SET_JOIN_DATE','Tanggal bergabung saat secure enrollment',v,NULL,_join_date);
  INSERT INTO public.employee_private_profiles(employee_id,nik,phone,emergency_contact_name,emergency_contact_relationship,emergency_contact_phone,birth_place,birth_date,gender,address,email,updated_by)
  VALUES(e,_identity->>'nik',_identity->>'phone',_identity->>'emergencyName',_identity->>'emergencyRelationship',_identity->>'emergencyPhone',_identity->>'birthPlace',(_identity->>'birthDate')::date,_identity->>'gender',_identity->>'address',lower(_identity->>'email'),auth.uid());
  UPDATE public.employee_enrollment_requests SET state='COMPLETED',employee_id=e WHERE request_id=_request_id;
  RETURN e;
END $$;

-- Serializes compensation against finalization. NEVER delete an Auth user before
-- a verified RECOVERY_REQUIRED response; a completed enrollment is never cancelled.
CREATE FUNCTION public.cancel_employee_enrollment(_request_id uuid,_cleanup_complete boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.employee_enrollment_requests;
BEGIN
  IF public.can_manage_employee_private_profile() IS NOT TRUE THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO r FROM public.employee_enrollment_requests WHERE request_id=_request_id AND actor_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permintaan tidak tersedia'; END IF;
  IF r.state='CANCELLED' THEN RETURN to_jsonb(r); END IF;
  IF r.state<>'COMPLETED' THEN
    IF EXISTS(SELECT 1 FROM public.employees e WHERE e.user_id=r.auth_user_id) THEN
      RAISE EXCEPTION 'Akun terhubung memerlukan rekonsiliasi, bukan penghapusan otomatis';
    END IF;
    IF _cleanup_complete AND EXISTS(SELECT 1 FROM auth.users u
      WHERE u.id=r.auth_user_id OR (u.raw_app_meta_data->'employee_enrollment'->>'request_id'=_request_id::text
        AND u.raw_app_meta_data->'employee_enrollment'->>'actor_id'=auth.uid()::text)) THEN
      RAISE EXCEPTION 'Cleanup Auth belum terverifikasi';
    END IF;
    UPDATE public.employee_enrollment_requests SET state=CASE WHEN _cleanup_complete THEN 'CANCELLED' ELSE 'RECOVERY_REQUIRED' END
    WHERE request_id=_request_id RETURNING * INTO r;
  END IF;
  RETURN to_jsonb(r);
END $$;
CREATE FUNCTION public.claim_employee_setup_delivery(_request_id uuid,_outcome text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.employee_enrollment_requests;
BEGIN
  IF public.can_manage_employee_private_profile() IS NOT TRUE THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO r FROM public.employee_enrollment_requests WHERE request_id=_request_id AND actor_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR r.state<>'COMPLETED' THEN RAISE EXCEPTION 'Enrollment belum selesai'; END IF;
  IF _outcome IS NULL THEN
    IF r.delivery_state<>'NOT_ATTEMPTED' THEN RETURN false; END IF;
    UPDATE public.employee_enrollment_requests SET delivery_state='ATTEMPTED' WHERE request_id=_request_id; RETURN true;
  END IF;
  IF _outcome NOT IN ('SENT','UNKNOWN') OR r.delivery_state<>'ATTEMPTED' THEN RAISE EXCEPTION 'Status delivery tidak valid'; END IF;
  UPDATE public.employee_enrollment_requests SET delivery_state=_outcome WHERE request_id=_request_id; RETURN true;
END $$;

CREATE FUNCTION public.read_employee_identity(_employee_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF public.can_manage_employee_private_profile() IS NOT TRUE THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT to_jsonb(p)||jsonb_build_object('name',e.name) INTO result
  FROM public.employee_private_profiles p JOIN public.employees e ON e.id=p.employee_id WHERE p.employee_id=_employee_id;
  IF result IS NULL THEN RAISE EXCEPTION 'Profil tidak tersedia'; END IF; RETURN result;
END $$;
CREATE FUNCTION public.update_employee_identity(_employee_id uuid,_identity jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.can_manage_employee_private_profile() IS NOT TRUE THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  PERFORM public.validate_employee_identity(_identity);
  IF NOT EXISTS(SELECT 1 FROM public.employees e JOIN auth.users u ON u.id=e.user_id
    WHERE e.id=_employee_id AND lower(u.email)=lower(_identity->>'email')) THEN
    RAISE EXCEPTION 'Email harus mengikuti akun Auth';
  END IF;
  UPDATE public.employee_private_profiles SET nik=_identity->>'nik',phone=_identity->>'phone',
    emergency_contact_name=_identity->>'emergencyName',emergency_contact_relationship=_identity->>'emergencyRelationship',
    emergency_contact_phone=_identity->>'emergencyPhone',birth_place=_identity->>'birthPlace',birth_date=(_identity->>'birthDate')::date,
    gender=_identity->>'gender',address=_identity->>'address',email=lower(_identity->>'email'),updated_by=auth.uid(),updated_at=clock_timestamp()
  WHERE employee_id=_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil tidak tersedia'; END IF;
END $$;
CREATE FUNCTION public.set_employee_portrait(_employee_id uuid,_path text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.can_manage_employee_private_profile() IS NOT TRUE THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF _path IS NULL OR _path !~ ('^'||_employee_id::text||'/[a-f0-9-]{36}[.](jpg|png|webp)$')
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='employee-portraits' AND name=_path) THEN RAISE EXCEPTION 'Scope pas foto tidak valid'; END IF;
  UPDATE public.employee_private_profiles SET portrait_path=_path,updated_by=auth.uid(),updated_at=clock_timestamp() WHERE employee_id=_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil tidak tersedia'; END IF;
END $$;
CREATE POLICY employee_portraits_owner_cleanup ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='employee-portraits' AND (SELECT public.can_manage_employee_private_profile())
  AND NOT EXISTS(SELECT 1 FROM public.employee_private_profiles p WHERE p.portrait_path=storage.objects.name));
CREATE POLICY employee_portraits_referenced_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING(bucket_id<>'employee-portraits' OR NOT EXISTS(SELECT 1 FROM public.employee_private_profiles p WHERE p.portrait_path=storage.objects.name));

REVOKE ALL ON FUNCTION public.guard_generated_employee_identifier(),public.validate_employee_identity(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.begin_employee_enrollment(uuid,text),public.attach_employee_enrollment_auth(uuid,uuid),
 public.finalize_employee_enrollment(uuid,text,public.employee_position,date,jsonb),public.cancel_employee_enrollment(uuid,boolean),
 public.claim_employee_setup_delivery(uuid,text),public.read_employee_identity(uuid),public.update_employee_identity(uuid,jsonb),public.set_employee_portrait(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.begin_employee_enrollment(uuid,text),public.attach_employee_enrollment_auth(uuid,uuid),
 public.finalize_employee_enrollment(uuid,text,public.employee_position,date,jsonb),public.cancel_employee_enrollment(uuid,boolean),
 public.claim_employee_setup_delivery(uuid,text),public.read_employee_identity(uuid),public.update_employee_identity(uuid,jsonb),public.set_employee_portrait(uuid,text) TO authenticated;
COMMIT;
