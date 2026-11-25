\set ON_ERROR_STOP on
-- Isolated CI PostgreSQL fixture, NEVER Cloud. Supabase-like roles and auth.uid.
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
INSERT INTO auth.users (id) VALUES
 ('10000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
CREATE TYPE public.app_role AS ENUM ('owner', 'employee');
CREATE TABLE public.user_roles (user_id uuid NOT NULL REFERENCES auth.users(id), role public.app_role NOT NULL);
INSERT INTO public.user_roles VALUES
 ('10000000-0000-0000-0000-000000000001', 'owner'),
 ('10000000-0000-0000-0000-000000000002', 'employee');
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles
 WHERE user_id = _user_id AND role = _role) $$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO anon,authenticated;

\i supabase/pending/20261125_whatsapp_templates_owner_only.sql

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.owner_save_whatsapp_template('PENAWARAN_RESERVASI','Halo [NAMA_TAMU]');
    RAISE EXCEPTION 'FAIL: employee saved template';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public.owner_save_whatsapp_template('PENAWARAN_RESERVASI','Halo [NAMA_TAMU]') AS owner_created;
SELECT public.owner_save_whatsapp_template('PENAWARAN_RESERVASI','Selamat datang [NAMA_TAMU]') AS owner_revised;
DO $$
DECLARE
 n integer; a integer; r integer;
BEGIN
 SELECT count(*) INTO n FROM public.whatsapp_template_versions
  WHERE kind='PENAWARAN_RESERVASI';
 SELECT count(*) INTO a FROM public.whatsapp_template_versions
  WHERE kind='PENAWARAN_RESERVASI' AND status='ACTIVE';
 SELECT count(*) INTO r FROM public.whatsapp_template_audit
  WHERE kind='PENAWARAN_RESERVASI';
 IF n<>2 OR a<>1 OR r<>3 THEN RAISE EXCEPTION
 'FAIL: expected 2 versions, 1 active, 3 audit rows: %, %, %',n,a,r; END IF;
 BEGIN
  PERFORM public.owner_save_whatsapp_template('PENAWARAN_RESERVASI','Official [NOMOR_TRANSAKSI]');
  RAISE EXCEPTION 'FAIL: pre-booking TRX token accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM = 'FAIL: pre-booking TRX token accepted' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.owner_save_whatsapp_template('KONFIRMASI_BOOKING','Hello [NOT_ALLOWED]');
  RAISE EXCEPTION 'FAIL: unknown token accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM = 'FAIL: unknown token accepted' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.owner_save_whatsapp_template('KONFIRMASI_BOOKING','Hello [NAMA_TAMU');
  RAISE EXCEPTION 'FAIL: malformed token accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM = 'FAIL: malformed token accepted' THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO public.whatsapp_template_versions (kind,revision,body,created_by)
  VALUES ('KONFIRMASI_BOOKING', 1, 'Hello [NAMA_TAMU]', auth.uid());
  RAISE EXCEPTION 'FAIL: direct authenticated insert accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.whatsapp_template_versions;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: employee can view Owner versions'; END IF;
 SELECT count(*) INTO n FROM public.whatsapp_template_audit;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: employee can view audit'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
SET ROLE anon;
DO $$
BEGIN
 BEGIN
  PERFORM public.owner_save_whatsapp_template('PENAWARAN_RESERVASI','Halo [NAMA_TAMU]');
  RAISE EXCEPTION 'FAIL: anon executed Owner RPC';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'PASS: isolated postgres versioning + owner/employee/anon guards' AS result;
