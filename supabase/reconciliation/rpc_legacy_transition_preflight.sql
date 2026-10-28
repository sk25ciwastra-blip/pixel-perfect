-- SELECT ONLY: RPC legacy transition preflight.
-- This file never drops, replaces, revokes, grants, inserts, or updates.

SELECT
  current_database() AS database_name,
  current_user AS database_user,
  current_setting('server_version') AS server_version;

WITH expected(signature, contract) AS (
  VALUES
    ('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid)'::text, 'reservation_12'),
    ('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)'::text, 'reservation_13_extra_guest'),
    ('public.create_training_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid)'::text, 'training_reservation_12'),
    ('public.create_training_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)'::text, 'training_reservation_13_extra_guest'),
    ('public.record_transaction_payment(uuid,numeric,text,uuid,uuid)'::text, 'payment_5'),
    ('public.record_training_transaction_payment(uuid,numeric,text,uuid,uuid)'::text, 'training_payment_5')
)
SELECT
  contract,
  signature,
  to_regprocedure(signature) AS resolved_signature,
  CASE WHEN to_regprocedure(signature) IS NULL THEN 'MISSING' ELSE 'PRESENT' END AS status
FROM expected
ORDER BY contract;

WITH legacy(signature, contract) AS (
  VALUES
    ('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz)'::text, 'reservation_10_legacy'),
    ('public.record_transaction_payment(uuid,numeric,text)'::text, 'payment_3_legacy'),
    ('public.record_transaction_payment(uuid,numeric,text,uuid)'::text, 'payment_4_legacy')
)
SELECT
  contract,
  signature,
  to_regprocedure(signature) AS resolved_signature,
  CASE WHEN to_regprocedure(signature) IS NULL THEN 'ABSENT' ELSE 'STILL_ACTIVE' END AS status
FROM legacy
ORDER BY contract;

SELECT
  p.oid::regprocedure AS signature,
  p.proname,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config,
  p.proacl AS acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_reservation',
    'create_training_reservation',
    'record_transaction_payment',
    'record_training_transaction_payment'
  )
ORDER BY p.proname, p.oid;

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'transactions'
  AND column_name IN (
    'price_snapshot',
    'base_price_snapshot',
    'guest_count',
    'extra_guest_count',
    'extra_guest_unit_price',
    'extra_guest_charge'
  )
ORDER BY ordinal_position;

SELECT
  count(*) AS transaction_count,
  coalesce(sum(price_snapshot), 0) AS price_snapshot_total,
  count(*) FILTER (WHERE price_snapshot IS NULL) AS null_price_snapshot,
  count(*) FILTER (WHERE base_price_snapshot IS NULL) AS legacy_base_snapshot_null,
  count(*) FILTER (
    WHERE base_price_snapshot IS NOT NULL
      AND price_snapshot <> base_price_snapshot + extra_guest_charge
  ) AS extra_guest_snapshot_mismatch
FROM public.transactions;

SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'finance_cash_sessions',
    'finance_reservation_idempotency',
    'receipt_template_versions',
    'payment_receipts',
    'receipt_print_requests'
  )
ORDER BY c.relname;

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'finance_cash_sessions',
    'finance_reservation_idempotency',
    'receipt_template_versions',
    'payment_receipts',
    'receipt_print_requests'
  )
ORDER BY tablename, policyname;

SELECT
  routine_name,
  specific_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN (
    'create_reservation',
    'create_training_reservation',
    'record_transaction_payment',
    'record_training_transaction_payment'
  )
ORDER BY routine_name, specific_name, grantee;
