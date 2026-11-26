-- Synthetic-only PostgreSQL fixture for the pending guest history migration.
-- Executed in an ephemeral Postgres Docker container, NOT Cloud.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TYPE public.app_role AS ENUM ('owner','employee');
CREATE TYPE public.employee_position AS ENUM ('receptionist','supervisor','housekeeping');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.has_role(u uuid,r public.app_role) RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT u='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid AND r='owner'::public.app_role $$;
CREATE FUNCTION public.can_frontdesk(u uuid) RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT u='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid $$;
CREATE TABLE public.employees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  position public.employee_position NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  address text NOT NULL,
  phone text NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.guest_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guests(id),
  body text NOT NULL,
  author_id uuid,
  author_role text,
  author_name text,
  created_at timestamptz,
  legacy boolean NOT NULL DEFAULT false
);
