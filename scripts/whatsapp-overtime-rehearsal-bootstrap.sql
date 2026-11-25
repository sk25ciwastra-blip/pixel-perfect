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
CREATE TYPE public.employee_position AS ENUM ('receptionist','housekeeping','supervisor','inspector','investor');
CREATE TABLE public.employees (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  position public.employee_position NOT NULL,
  active boolean NOT NULL DEFAULT true
);
INSERT INTO public.employees(user_id,position,active) VALUES
 ('10000000-0000-0000-0000-000000000002','receptionist',true);
CREATE FUNCTION public.finance_training_current_user_is_restricted()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $func$ SELECT current_setting('request.jwt.claim.training', true) = 'restricted' $func$;
GRANT EXECUTE ON FUNCTION public.finance_training_current_user_is_restricted()
 TO authenticated;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles
 WHERE user_id = _user_id AND role = _role) $$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO anon,authenticated;

\i supabase/pending/20261125_whatsapp_templates_owner_only.sql
\i supabase/pending/20261125_whatsapp_manual_reminder_kinds.sql
-- Synthetic pre-overtime baseline only, no real accounts or transactions.
