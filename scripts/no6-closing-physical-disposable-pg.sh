#!/usr/bin/env bash
# Disposable PostgreSQL 17 regression for reviewed physical-cash Closing RPC.
# Runs only in GitHub Actions service DB; never connects to Lovable Cloud.
set -euo pipefail
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}" PGPASSWORD="${PGPASSWORD:-postgres}"
export PGDATABASE="${PGDATABASE:-postgres}"
psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
SELECT NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;
CREATE TABLE public.finance_cash_sessions (
 id uuid PRIMARY KEY, opened_by uuid NOT NULL, opening_cash numeric NOT NULL,
 status text NOT NULL, closed_at timestamptz, closed_by uuid,
 closing_reason text NOT NULL DEFAULT '', closing_snapshot jsonb
);
CREATE TABLE public.payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cash_session_id uuid,
 method text NOT NULL, amount numeric NOT NULL
);
CREATE TABLE public.finance_expenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid,
 method text NOT NULL, amount numeric NOT NULL
);
CREATE TABLE public.finance_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_session_id uuid,
 refund_method text NOT NULL, amount numeric NOT NULL
);
CREATE TABLE public.finance_session_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL,
 allocation_type text NOT NULL, method text NOT NULL, amount numeric NOT NULL,
 recipient_user_id uuid, created_by uuid NOT NULL
);
CREATE TABLE public.finance_drawer_handoffs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), allocation_id uuid NOT NULL,
 source_session_id uuid NOT NULL, recipient_user_id uuid NOT NULL,
 expected_amount numeric NOT NULL, created_by uuid NOT NULL
);
CREATE OR REPLACE FUNCTION public.finance_is_owner_or_supervisor(actor uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT actor = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'::uuid
$$;
SQL
# The fingerprint preflight is a Cloud drift gate, not applicable to this fresh
# disposable database. Extract the exact reviewed RPC body from the migration.
awk '/^CREATE TABLE IF NOT EXISTS public.finance_closing_count_audit/{start=1} /^COMMIT;$/{start=0} start {print}'  supabase/migrations/20261123060000_finance_closing_counted_cash.sql  | psql -v ON_ERROR_STOP=1

psql -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO public.finance_cash_sessions(id,opened_by,opening_cash,status) VALUES
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',0,'OPEN'),
('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',0,'OPEN'),
('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',0,'OPEN'),
('44444444-4444-4444-8444-444444444444','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0,'OPEN');

INSERT INTO public.payments(cash_session_id,method,amount)
VALUES ('11111111-1111-4111-8111-111111111111','Cash',98000),
       ('11111111-1111-4111-8111-111111111111','QRIS',338000);
INSERT INTO public.finance_expenses(session_id,method,amount) VALUES
('11111111-1111-4111-8111-111111111111','CASH',1000),
('22222222-2222-4222-8222-222222222222','CASH',50000);
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',false);

-- Missing count: fail closed, no session mutation
DO $t$
BEGIN
  BEGIN
    PERFORM public.close_finance_cash_session(
      '11111111-1111-4111-8111-111111111111',
      '{"dibawa":97000}'::jsonb, '');
    RAISE EXCEPTION 'expected rejection: missing physical count';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Hitung kas fisik wajib diisi%' THEN RAISE; END IF;
  END;
END $t$;
-- Allocation cannot claim cash that operator did not physically count
DO $t$
BEGIN
  BEGIN
    PERFORM public.close_finance_cash_session(
      '11111111-1111-4111-8111-111111111111',
      '{"physical_cash_count":95000,"dibawa":97000}'::jsonb, 'Selisih fisik');
    RAISE EXCEPTION 'expected rejection: allocation mismatch';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Alokasi kas tidak sama%' THEN RAISE; END IF;
  END;
END $t$;
-- Missing reason for nonzero variance: rejected
DO $t$
BEGIN
  BEGIN
    PERFORM public.close_finance_cash_session(
      '11111111-1111-4111-8111-111111111111',
      '{"physical_cash_count":95000,"dibawa":95000}'::jsonb, '');
    RAISE EXCEPTION 'expected rejection: variance reason';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Selisih uang fisik wajib%' THEN RAISE; END IF;
  END;
END $t$;

SELECT public.close_finance_cash_session(
 '11111111-1111-4111-8111-111111111111',
 '{"physical_cash_count":95000,"dibawa":95000}'::jsonb,'Selisih kas 2000');
DO $t$
DECLARE s public.finance_cash_sessions;
BEGIN
 SELECT * INTO s FROM public.finance_cash_sessions WHERE id='11111111-1111-4111-8111-111111111111';
 IF (SELECT count(*) FROM public.finance_closing_count_audit WHERE session_id=s.id
      AND actor_id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
      AND physical_cash_count=95000 AND cash_difference=-2000)<>1
 THEN RAISE EXCEPTION 'Missing append-only closing audit'; END IF;
 IF s.status<>'FINAL' OR (s.closing_snapshot->>'expected_cash')::numeric<>97000
 OR (s.closing_snapshot->>'physical_cash_count')::numeric<>95000
 OR (s.closing_snapshot->>'cash_difference')::numeric<>-2000
 OR (SELECT COALESCE(SUM(amount),0) FROM finance_session_allocations WHERE session_id=s.id)<>95000
 THEN RAISE EXCEPTION 'Wrong Closing snapshot for shortage'; END IF;
END $t$;

-- Audit must be immutable once written.
DO $t$
BEGIN
  BEGIN
    UPDATE public.finance_closing_count_audit SET reason='changed'
      WHERE session_id='11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'expected append-only audit rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%append-only%' THEN RAISE; END IF;
  END;
END $t$;
-- Replay on FINAL fails without new allocations
DO $t$
BEGIN
  BEGIN
    PERFORM public.close_finance_cash_session(
      '11111111-1111-4111-8111-111111111111',
      '{"physical_cash_count":95000,"dibawa":95000}'::jsonb,'Replay');
    RAISE EXCEPTION 'expected replay rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Sesi kas tidak aktif%' THEN RAISE; END IF;
  END;
END $t$;

SELECT public.close_finance_cash_session(
 '22222222-2222-4222-8222-222222222222',
 '{"physical_cash_count":0}'::jsonb,'Expected balance -50000');
DO $t$
DECLARE j jsonb;
BEGIN
 SELECT closing_snapshot INTO j FROM public.finance_cash_sessions WHERE id='22222222-2222-4222-8222-222222222222';
 IF (j->>'expected_cash')::numeric<>-50000 OR (j->>'physical_cash_count')::numeric<>0
 OR (j->>'cash_difference')::numeric<>50000
 OR EXISTS(SELECT 1 FROM finance_session_allocations WHERE session_id='22222222-2222-4222-8222-222222222222')
 THEN RAISE EXCEPTION 'Negative Closing was clamped or allocated'; END IF;
END $t$;

-- Anonymous actor rejected without writing status
SELECT set_config('request.jwt.claim.sub','',false);
DO $t$
BEGIN
  BEGIN
    PERFORM public.close_finance_cash_session(
      '33333333-3333-4333-8333-333333333333',
      '{"physical_cash_count":0}'::jsonb,'');
    RAISE EXCEPTION 'expected anonymous rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%identitas operator wajib%' THEN RAISE; END IF;
  END;
END $t$;
DO $t$
BEGIN
 IF (SELECT status FROM finance_cash_sessions WHERE id='33333333-3333-4333-8333-333333333333') <> 'OPEN'
 THEN RAISE EXCEPTION 'Anonymous request changed session'; END IF;
END $t$;

-- Owner assist requires reason when closing another operator's session
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',false);
DO $t$
BEGIN
  BEGIN
    PERFORM public.close_finance_cash_session(
      '44444444-4444-4444-8444-444444444444',
      '{"physical_cash_count":0}'::jsonb,'');
    RAISE EXCEPTION 'expected reason for assisted Closing';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Alasan closing khusus wajib%' THEN RAISE; END IF;
  END;
END $t$;
SELECT public.close_finance_cash_session(
 '44444444-4444-4444-8444-444444444444',
 '{"physical_cash_count":0}'::jsonb,'Owner assisted Closing');
DO $t$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM finance_cash_sessions
  WHERE id='44444444-4444-4444-8444-444444444444' AND status='FINAL'
  AND closed_by='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa')
 THEN RAISE EXCEPTION 'Assisted Closing failed'; END IF;
END $t$;
SELECT 'No6 disposable PG17 Closing contract PASS' AS result;
SQL
