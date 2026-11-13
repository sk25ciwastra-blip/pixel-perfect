-- PENDING ONLY: explicit Owner approval and Cloud schema review required.
-- No modification to existing employees rows or accounts. No KTP document uploads.
BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_private_profiles (
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
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_insert ON public.employee_private_profiles
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IS NOT NULL AND updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_update ON public.employee_private_profiles
  FOR UPDATE TO authenticated USING (
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

-- Private portrait bucket: no public URL, no document-ID bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-portraits', 'employee-portraits', false, 2097152,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- The first stage intentionally grants portrait access only to Owner.
-- Employee self-view and signed URL delivery require an explicit follow-up policy review.
CREATE POLICY employee_portraits_owner_read ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

COMMIT;
),
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
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_insert ON public.employee_private_profiles
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IS NOT NULL AND updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_update ON public.employee_private_profiles
  FOR UPDATE TO authenticated USING (
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

-- Private portrait bucket: no public URL, no document-ID bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-portraits', 'employee-portraits', false, 2097152,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- The first stage intentionally grants portrait access only to Owner.
-- Employee self-view and signed URL delivery require an explicit follow-up policy review.
CREATE POLICY employee_portraits_owner_read ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

COMMIT;
),
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
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_insert ON public.employee_private_profiles
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IS NOT NULL AND updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_update ON public.employee_private_profiles
  FOR UPDATE TO authenticated USING (
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

-- Private portrait bucket: no public URL, no document-ID bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-portraits', 'employee-portraits', false, 2097152,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- The first stage intentionally grants portrait access only to Owner.
-- Employee self-view and signed URL delivery require an explicit follow-up policy review.
CREATE POLICY employee_portraits_owner_read ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

COMMIT;
),
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
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_insert ON public.employee_private_profiles
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IS NOT NULL AND updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_update ON public.employee_private_profiles
  FOR UPDATE TO authenticated USING (
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

-- Private portrait bucket: no public URL, no document-ID bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-portraits', 'employee-portraits', false, 2097152,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- The first stage intentionally grants portrait access only to Owner.
-- Employee self-view and signed URL delivery require an explicit follow-up policy review.
CREATE POLICY employee_portraits_owner_read ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

COMMIT;
),
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
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_insert ON public.employee_private_profiles
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IS NOT NULL AND updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_update ON public.employee_private_profiles
  FOR UPDATE TO authenticated USING (
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

-- Private portrait bucket: no public URL, no document-ID bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-portraits', 'employee-portraits', false, 2097152,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- The first stage intentionally grants portrait access only to Owner.
-- Employee self-view and signed URL delivery require an explicit follow-up policy review.
CREATE POLICY employee_portraits_owner_read ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

COMMIT;
),
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
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_insert ON public.employee_private_profiles
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IS NOT NULL AND updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_update ON public.employee_private_profiles
  FOR UPDATE TO authenticated USING (
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

-- Private portrait bucket: no public URL, no document-ID bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-portraits', 'employee-portraits', false, 2097152,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- The first stage intentionally grants portrait access only to Owner.
-- Employee self-view and signed URL delivery require an explicit follow-up policy review.
CREATE POLICY employee_portraits_owner_read ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

COMMIT;
),
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
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_insert ON public.employee_private_profiles
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IS NOT NULL AND updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_update ON public.employee_private_profiles
  FOR UPDATE TO authenticated USING (
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

-- Private portrait bucket: no public URL, no document-ID bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-portraits', 'employee-portraits', false, 2097152,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- The first stage intentionally grants portrait access only to Owner.
-- Employee self-view and signed URL delivery require an explicit follow-up policy review.
CREATE POLICY employee_portraits_owner_read ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

COMMIT;
),
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
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_insert ON public.employee_private_profiles
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IS NOT NULL AND updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_private_profiles_owner_update ON public.employee_private_profiles
  FOR UPDATE TO authenticated USING (
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    updated_by = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

-- Private portrait bucket: no public URL, no document-ID bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-portraits', 'employee-portraits', false, 2097152,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- The first stage intentionally grants portrait access only to Owner.
-- Employee self-view and signed URL delivery require an explicit follow-up policy review.
CREATE POLICY employee_portraits_owner_read ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );
CREATE POLICY employee_portraits_owner_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  ) WITH CHECK (
    bucket_id = 'employee-portraits'
    AND public.has_role(auth.uid(), 'owner')
    AND public.finance_training_is_restricted(auth.uid()) IS FALSE
  );

COMMIT;
