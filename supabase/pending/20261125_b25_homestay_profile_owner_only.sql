-- Baturaden 25 Homestay — Poin 6/7: Owner-only homestay profile
-- PENDING REVIEW ONLY. DO NOT APPLY TO LIVE/STAGING WITHOUT OWNER APPROVAL.
-- New isolated configuration objects; no changes to finance, booking, or rooms.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $$
BEGIN
 IF to_regclass('public.b25_homestay_profile') IS NOT NULL
    OR to_regclass('public.b25_homestay_profile_audit') IS NOT NULL
    OR to_regprocedure('public.b25_save_homestay_profile(text,text,text,text)') IS NOT NULL
    OR to_regprocedure('public.b25_read_homestay_profile()') IS NOT NULL THEN
   RAISE EXCEPTION 'STOP: Poin6 profile already partially present; review schema first';
 END IF;
 IF to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL
    OR to_regprocedure('public.finance_training_is_restricted(uuid)') IS NULL
    OR to_regprocedure('auth.uid()') IS NULL THEN
   RAISE EXCEPTION 'STOP: owner or Training authorization dependency unavailable';
 END IF;
END $$;

CREATE TABLE public.b25_homestay_profile(
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  business_name text NOT NULL CHECK (char_length(btrim(business_name)) BETWEEN 3 AND 100),
  address text NOT NULL DEFAULT '' CHECK (char_length(address) <= 500),
  phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 30),
  whatsapp text NOT NULL DEFAULT '' CHECK (char_length(whatsapp) <= 30),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE TABLE public.b25_homestay_profile_audit(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  old_value jsonb NOT NULL,
  new_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.b25_homestay_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b25_homestay_profile_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.b25_homestay_profile, public.b25_homestay_profile_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.b25_homestay_profile_audit_id_seq FROM PUBLIC, anon, authenticated;

INSERT INTO public.b25_homestay_profile(id,business_name,address,phone,whatsapp)
VALUES(true,'Baturaden 25 Homestay','','','');

CREATE FUNCTION public.b25_read_homestay_profile()
RETURNS TABLE(business_name text,address text,phone text,whatsapp text,updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'Login diperlukan untuk membaca profil';
 END IF;
 RETURN QUERY SELECT p.business_name,p.address,p.phone,p.whatsapp,p.updated_at
 FROM public.b25_homestay_profile p WHERE p.id=true;
END;
$fn$;

CREATE FUNCTION public.b25_save_homestay_profile(
 _business_name text,_address text,_phone text,_whatsapp text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 actor uuid := auth.uid();
 old_record public.b25_homestay_profile%ROWTYPE;
 next_value jsonb;
 old_value jsonb;
 clean_name text := btrim(coalesce(_business_name,''));
 clean_address text := btrim(coalesce(_address,''));
 clean_phone text := btrim(coalesce(_phone,''));
 clean_whatsapp text := btrim(coalesce(_whatsapp,''));
BEGIN
 IF actor IS NULL OR NOT public.has_role(actor,'owner'::public.app_role)
    OR public.finance_training_is_restricted(actor) THEN
   RAISE EXCEPTION 'Hanya Owner aktif dapat menyimpan Profil Homestay';
 END IF;
 IF char_length(clean_name) NOT BETWEEN 3 AND 100
    OR char_length(clean_address)>500
    OR char_length(clean_phone)>30
    OR char_length(clean_whatsapp)>30
    OR (clean_phone<>'' AND clean_phone !~ '^[+]?[0-9 ()-]{6,30}$')
    OR (clean_whatsapp<>'' AND clean_whatsapp !~ '^[+]?[0-9 ()-]{6,30}$') THEN
   RAISE EXCEPTION 'Isi Profil Homestay tidak valid';
 END IF;
 SELECT * INTO old_record FROM public.b25_homestay_profile WHERE id=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Data profil belum terinisialisasi'; END IF;
 IF (old_record.business_name,old_record.address,old_record.phone,old_record.whatsapp)
    IS NOT DISTINCT FROM (clean_name,clean_address,clean_phone,clean_whatsapp) THEN
   RETURN;
 END IF;
 old_value:=jsonb_build_object(
   'business_name',old_record.business_name,'address',old_record.address,
   'phone',old_record.phone,'whatsapp',old_record.whatsapp);
 next_value:=jsonb_build_object(
   'business_name',clean_name,'address',clean_address,'phone',clean_phone,'whatsapp',clean_whatsapp);
 UPDATE public.b25_homestay_profile SET business_name=clean_name,
   address=clean_address,phone=clean_phone,whatsapp=clean_whatsapp,
   updated_by=actor,updated_at=clock_timestamp() WHERE id=true;
 INSERT INTO public.b25_homestay_profile_audit(actor_id,old_value,new_value)
 VALUES(actor,old_value,next_value);
END;
$fn$;

REVOKE ALL ON FUNCTION public.b25_read_homestay_profile() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.b25_save_homestay_profile(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.b25_read_homestay_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.b25_save_homestay_profile(text,text,text,text) TO authenticated;

COMMIT;
-- POSTCHECK (on isolated review DB): read RPC succeeds with valid logged-in context;
-- writes Owner-only, non-Owner/anon/Training denied, no-op has no audit, update append-only audit.
-- ROLLBACK PLAN (separately authorized):
-- DROP FUNCTION public.b25_save_homestay_profile(text,text,text,text);
-- DROP FUNCTION public.b25_read_homestay_profile();
-- DROP TABLE public.b25_homestay_profile_audit;
-- DROP TABLE public.b25_homestay_profile;
