-- PENDING ONLY: explicit Owner approval and Cloud schema review required.
-- No modification to existing employees rows or accounts. No KTP document uploads.
BEGIN;

-- Exposes only a current-caller boolean. Never broaden the sensitive helper ACL.
CREATE FUNCTION public.can_manage_employee_private_profile()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'owner') IS NOT TRUE THEN
    RETURN false;
  END IF;
  RETURN public.finance_training_is_restricted(auth.uid()) IS FALSE;
END;
$$;
REVOKE ALL ON FUNCTION public.can_manage_employee_private_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_employee_private_profile() TO authenticated;

-- An unexpected existing profile table is a review blocker, never silently reused.
CREATE TABLE public.employee_private_profiles (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  nik text NOT NULL UNIQUE CHECK (nik ~ '^[0-9]{16}$'),
  phone text NOT NULL CHECK (phone ~ '^([+])?[0-9]{9,15}$'),
  emergency_contact_name text NOT NULL CHECK (char_length(btrim(emergency_contact_name)) BETWEEN 2 AND 100),
  emergency_contact_relationship text NOT NULL CHECK (char_length(btrim(emergency_contact_relationship)) BETWEEN 2 AND 60),
  emergency_contact_phone text NOT NULL CHECK (emergency_contact_phone ~ '^([+])?[0-9]{9,15}$'),
  portrait_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES auth.users(id)
);
ALTER TABLE public.employee_private_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.employee_private_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.employee_private_profiles TO authenticated;

CREATE POLICY employee_private_profiles_owner_select ON public.employee_private_profiles
  FOR SELECT TO authenticated USING (
    (SELECT public.can_manage_employee_private_profile())
  );
CREATE POLICY employee_private_profiles_owner_insert ON public.employee_private_profiles
  FOR INSERT TO authenticated WITH CHECK (
    updated_by = auth.uid() AND (SELECT public.can_manage_employee_private_profile())
  );
CREATE POLICY employee_private_profiles_owner_update ON public.employee_private_profiles
  FOR UPDATE TO authenticated USING (
    (SELECT public.can_manage_employee_private_profile())
  ) WITH CHECK (
    updated_by = auth.uid() AND (SELECT public.can_manage_employee_private_profile())
  );

-- Private portrait bucket: no public URL, no document-ID bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-portraits', 'employee-portraits', false, 2097152,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Lock after INSERT/ON CONFLICT, so a concurrent bucket creator cannot evade
-- validation. Fail closed on collision, without changing existing configuration.
DO $bucket_check$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM storage.buckets WHERE id = 'employee-portraits' FOR UPDATE;
  IF NOT FOUND OR b.name IS DISTINCT FROM 'employee-portraits'
     OR b.public IS DISTINCT FROM false OR b.file_size_limit IS DISTINCT FROM 2097152
     OR b.allowed_mime_types IS NULL OR cardinality(b.allowed_mime_types) <> 3
     OR NOT (b.allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']::text[]
             AND b.allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp']::text[]) THEN
    RAISE EXCEPTION 'Bucket pas foto existing tidak sesuai spesifikasi privat; perlu review Owner';
  END IF;
END;
$bucket_check$;

-- The first stage intentionally grants portrait access only to Owner.
-- Employee self-view and signed URL delivery require an explicit follow-up policy review.
CREATE POLICY employee_portraits_owner_read ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND (SELECT public.can_manage_employee_private_profile())
  );
CREATE POLICY employee_portraits_owner_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'employee-portraits'
    AND (SELECT public.can_manage_employee_private_profile())
  );
CREATE POLICY employee_portraits_owner_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND (SELECT public.can_manage_employee_private_profile())
  ) WITH CHECK (
    bucket_id = 'employee-portraits'
    AND (SELECT public.can_manage_employee_private_profile())
  );

-- Restrictive guards prevent unrelated broad Storage policies from OR-ing open
-- this bucket. They grant no access to any other bucket or role by themselves.
CREATE POLICY employee_portraits_private_guard ON storage.objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id <> 'employee-portraits' OR (SELECT public.can_manage_employee_private_profile()))
  WITH CHECK (bucket_id <> 'employee-portraits' OR (SELECT public.can_manage_employee_private_profile()));
CREATE POLICY employee_portraits_anon_guard ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon
  USING (bucket_id <> 'employee-portraits') WITH CHECK (bucket_id <> 'employee-portraits');

COMMIT;
