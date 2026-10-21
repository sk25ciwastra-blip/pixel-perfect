-- READ-ONLY PREFLIGHT FOR ISSUE #4
-- This file contains SELECT/metadata checks only.
-- It is NOT a migration and must not be used to infer permission to execute changes.
-- Run only after Owner confirms the target project/ref.

SELECT current_database() AS database_name,
       current_setting('server_version') AS server_version,
       current_setting('TimeZone') AS timezone;

-- Public tables and RLS state.
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- Finance table presence without selecting from absent tables.
SELECT table_name,
       table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'finance_%'
ORDER BY table_name;

-- Required core columns for preserving transactions, payments, prices and DP.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'transactions' AND column_name IN (
      'id', 'transaction_number', 'status', 'price_snapshot',
      'package_id', 'day_mode', 'scheduled_check_in',
      'scheduled_check_out', 'started_at', 'ends_at',
      'created_by', 'commission_mode_snapshot',
      'commission_rate_snapshot', 'commission_per_room_amount_snapshot',
      'commission_rounding_snapshot'
    ))
    OR (table_name = 'payments' AND column_name IN (
      'id', 'transaction_id', 'amount', 'method', 'kind',
      'recorded_by', 'cash_session_id', 'idempotency_key',
      'commission_amount'
    ))
    OR (table_name = 'packages' AND column_name IN (
      'id', 'name', 'price', 'weekday_price', 'weekend_price',
      'duration_minutes', 'active'
    ))
    OR (table_name = 'employees' AND column_name IN (
      'id', 'user_id', 'employee_id', 'position', 'active'
    ))
    OR (table_name = 'user_roles' AND column_name IN (
      'id', 'user_id', 'role'
    ))
  )
ORDER BY table_name, ordinal_position;

-- Existing migration ledgers; presence/count only.
SELECT to_regclass('drizzle.__drizzle_migrations') AS drizzle_migration_table,
       to_regclass('supabase_migrations.schema_migrations') AS supabase_migration_table;

-- Auth/operator mapping counts only; no email, token or UUID values are returned.
SELECT role::text AS role, count(*)::int AS count
FROM public.user_roles
GROUP BY role
ORDER BY role;

SELECT position::text AS position, active, count(*)::int AS count
FROM public.employees
GROUP BY position, active
ORDER BY position, active;

-- Transaction and payment preservation baseline.
SELECT status::text AS status,
       count(*)::int AS transaction_count,
       min(created_at) AS oldest_created_at,
       max(created_at) AS newest_created_at,
       min(price_snapshot) AS min_price_snapshot,
       max(price_snapshot) AS max_price_snapshot
FROM public.transactions
GROUP BY status
ORDER BY status;

SELECT count(*)::int AS payment_count,
       count(DISTINCT transaction_id)::int AS paid_transaction_count,
       coalesce(sum(amount), 0) AS payment_total,
       min(created_at) AS oldest_payment,
       max(created_at) AS newest_payment
FROM public.payments;

SELECT package_id,
       count(*)::int AS transaction_count,
       min(price_snapshot) AS min_price_snapshot,
       max(price_snapshot) AS max_price_snapshot
FROM public.transactions
WHERE package_id IS NOT NULL
GROUP BY package_id
ORDER BY package_id;

-- RLS policies for identity, operational and Finance surfaces.
SELECT schemaname, tablename, policyname, roles, cmd,
       coalesce(qual, '') AS using_expression,
       coalesce(with_check, '') AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    tablename IN (
      'user_roles', 'employees', 'transactions', 'payments',
      'rooms', 'packages'
    )
    OR tablename LIKE 'finance_%'
  )
ORDER BY tablename, policyname;

-- Table privileges. Empty result for direct finance writes is expected.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND (
    table_name IN ('user_roles', 'employees', 'transactions', 'payments')
    OR table_name LIKE 'finance_%'
  )
  AND grantee IN ('anon', 'authenticated', 'public')
ORDER BY table_name, grantee, privilege_type;

-- Function signatures and EXECUTE grants. No function is called.
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       p.prosecdef AS security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'has_role',
    'has_employee_position',
    'is_receptionist',
    'can_frontdesk',
    'can_housekeeping',
    'can_operate',
    'can_view_finance',
    'can_view_operations',
    'open_finance_cash_session',
    'close_finance_cash_session',
    'record_transaction_payment',
    'record_finance_expense',
    'create_finance_deposit',
    'decide_finance_deposit',
    'get_finance_session_summary',
    'confirm_finance_drawer_handover'
  )
ORDER BY p.proname, identity_arguments;

-- Exact function presence checks without invoking functions.
SELECT name,
       to_regprocedure(signature) AS resolved_procedure
FROM (
  VALUES
    ('open_finance_cash_session', 'public.open_finance_cash_session(numeric)'),
    ('close_finance_cash_session', 'public.close_finance_cash_session(uuid,jsonb,text)'),
    ('get_finance_session_summary', 'public.get_finance_session_summary(uuid)'),
    ('record_transaction_payment', 'public.record_transaction_payment(uuid,numeric,text,uuid,uuid)'),
    ('record_finance_expense', 'public.record_finance_expense(uuid,uuid,numeric,text,text,text)'),
    ('create_finance_deposit', 'public.create_finance_deposit(uuid,uuid,text,numeric,uuid,text)'),
    ('decide_finance_deposit', 'public.decide_finance_deposit(uuid,text,text)'),
    ('confirm_finance_drawer_handover', 'public.confirm_finance_drawer_handover(uuid,numeric,text)')
) AS expected(name, signature);

-- End of read-only preflight.
