CREATE TABLE public.employee_profiles (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  nik text NOT NULL DEFAULT '',
  birth_place text NOT NULL DEFAULT '',
  birth_date date,
  gender text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  emergency_name text NOT NULL DEFAULT '',
  emergency_relation text NOT NULL DEFAULT '',
  emergency_phone text NOT NULL DEFAULT '',
  photo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.employee_profiles TO authenticated;
GRANT ALL ON public.employee_profiles TO service_role;
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner kelola profil karyawan" ON public.employee_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));
CREATE TRIGGER employee_profiles_touch BEFORE UPDATE ON public.employee_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "Owner kelola foto karyawan" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id='employee-photos' AND public.has_role(auth.uid(),'owner'))
  WITH CHECK (bucket_id='employee-photos' AND public.has_role(auth.uid(),'owner'));