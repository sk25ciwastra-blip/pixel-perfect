REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.guest_notes FROM authenticated;
REVOKE ALL ON public.guest_notes FROM anon;
GRANT SELECT ON public.guest_notes TO authenticated;
GRANT ALL ON public.guest_notes TO service_role;