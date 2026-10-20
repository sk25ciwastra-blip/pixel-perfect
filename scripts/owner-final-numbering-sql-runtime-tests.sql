\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END;
$$;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TYPE public.app_role AS ENUM ('owner', 'employee');
CREATE TYPE public.employee_position AS ENUM ('receptionist', 'housekeeping', 'supervisor', 'inspector', 'investor');
CREATE TYPE public.room_status AS ENUM ('ready', 'occupied', 'dirty', 'cleaning');
CREATE TYPE public.transaction_status AS ENUM ('booking', 'check_in', 'check_out', 'cancelled');
CREATE TABLE public.rooms (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.can_housekeeping(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.has_employee_position(uuid, public.employee_position[]) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transaction_number_format CHECK (transaction_number ~ '^BTRD25-[0-9]{6}$')
);
CREATE UNIQUE INDEX transactions_transaction_number_unique ON public.transactions(transaction_number);

CREATE SEQUENCE public.transaction_number_seq START 1;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE OR REPLACE FUNCTION public.enforce_transaction_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
    NEW.transaction_number := 'BTRD25-' || lpad(nextval('public.transaction_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER transaction_identity_insert
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_transaction_identity();

INSERT INTO public.transactions (transaction_number) VALUES ('BTRD25-000431');

CREATE TABLE public.housekeeping_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text NOT NULL,
  room_id uuid NOT NULL REFERENCES public.rooms(id),
  transaction_id uuid REFERENCES public.transactions(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT housekeeping_jobs_job_number_check CHECK (job_number ~ '^BTRD25-HK-[0-9]{6}-[0-9]{2}$')
);
INSERT INTO auth.users (id) VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO public.rooms (id) VALUES ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.housekeeping_jobs (job_number, room_id, created_by, created_by_name)
VALUES ('BTRD25-HK-000007-26', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Fixture');

CREATE TABLE public.housekeeping_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id),
  transaction_id uuid REFERENCES public.transactions(id),
  job_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.finance_expenses DEFAULT VALUES;

\ir ../supabase/migrations/20261019000000_owner_final_numbering.sql

GRANT INSERT ON public.transactions TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

SET ROLE authenticated;
SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
INSERT INTO public.transactions DEFAULT VALUES;
RESET request.jwt.claim.sub;
RESET ROLE;
SELECT transaction_number AS identity_transaction_number, created_by AS identity_created_by
FROM public.transactions
WHERE created_by = '11111111-1111-4111-8111-111111111111'
ORDER BY created_at DESC, id DESC
LIMIT 1 \gset

DO $$
DECLARE
  identity_transaction_number text;
  identity_created_by uuid;
BEGIN
  SELECT t.transaction_number, t.created_by
  INTO identity_transaction_number, identity_created_by
  FROM public.transactions t
  WHERE t.created_by = '11111111-1111-4111-8111-111111111111'
  ORDER BY t.created_at DESC, t.id DESC
  LIMIT 1;

  IF identity_transaction_number !~ '^BTRDTRX-[0-9]{6,}$'
     OR identity_created_by <> '11111111-1111-4111-8111-111111111111' THEN
    RAISE EXCEPTION 'FAIL legacy identity trigger was not hardened';
  END IF;
  RAISE NOTICE 'PASS staging-like-identity-trigger';
END;
$$;

DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.next_transaction_number();
    RAISE EXCEPTION 'FAIL authenticated can call transaction generator directly';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS authenticated-direct-generator-denied';
  END;
END;
$$;

DO $$
DECLARE
  transaction_one text;
  transaction_two text;
  housekeeping_one text;
  expense_one text;
  expanded text;
BEGIN
  IF public.next_transaction_number() <> 'BTRDTRX-000433' THEN
    RAISE EXCEPTION 'FAIL transaction safe start';
  END IF;
  transaction_one := public.next_transaction_number();
  transaction_two := public.next_transaction_number();
  IF transaction_one <> 'BTRDTRX-000434' OR transaction_two <> 'BTRDTRX-000435' THEN
    RAISE EXCEPTION 'FAIL transaction sequence';
  END IF;

  housekeeping_one := public.next_housekeeping_number();
  IF housekeeping_one <> 'BTRDHK-000008' THEN
    RAISE EXCEPTION 'FAIL housekeeping safe start';
  END IF;
  INSERT INTO public.housekeeping_jobs (room_id, created_by, created_by_name)
  VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Fixture')
  RETURNING job_number INTO housekeeping_one;
  IF housekeeping_one <> 'BTRDHK-000009' THEN
    RAISE EXCEPTION 'FAIL housekeeping default generator';
  END IF;

  INSERT INTO public.finance_expenses DEFAULT VALUES RETURNING expense_number INTO expense_one;
  IF expense_one <> 'BTRDEXP-000001' THEN
    RAISE EXCEPTION 'FAIL expense generator';
  END IF;

  PERFORM setval('public.owner_transaction_number_seq', 999999, true);
  expanded := public.next_transaction_number();
  RAISE NOTICE 'expanded number=%', expanded;
  IF expanded <> 'BTRDTRX-1000000' THEN
    RAISE EXCEPTION 'FAIL seven digit expansion: %', expanded;
  END IF;

  IF (SELECT transaction_number FROM public.transactions WHERE transaction_number = 'BTRD25-000431') <> 'BTRD25-000431' THEN
    RAISE EXCEPTION 'FAIL legacy transaction preservation';
  END IF;
  IF (SELECT job_number FROM public.housekeeping_jobs WHERE job_number = 'BTRD25-HK-000007-26') <> 'BTRD25-HK-000007-26' THEN
    RAISE EXCEPTION 'FAIL legacy housekeeping preservation';
  END IF;

  RAISE NOTICE 'owner-final-numbering-sql-runtime-tests: PASS';
END;
$$;
