-- Baturaden 25 Homestay — Finance 150 Staging preflight
-- READ-ONLY CATALOG QUERY ONLY.
-- This file is a metadata preflight package, not a migration.
-- It intentionally does not read business rows, guests, payments, or transactions.
-- It returns one result set with columns: category, details.

WITH relation_targets(object_name) AS (
  VALUES
    ('public.operational_calendar'::text),
    ('public.finance_settings'::text),
    ('public.finance_commission_configs'::text),
    ('public.finance_bank_accounts'::text),
    ('public.finance_cash_sessions'::text),
    ('public.finance_session_allocations'::text),
    ('public.finance_drawer_handoffs'::text),
    ('public.finance_expenses'::text),
    ('public.finance_deposits'::text),
    ('public.finance_charge_events'::text),
    ('public.finance_refunds'::text),
    ('public.finance_refund_allocations'::text),
    ('public.finance_reservation_idempotency'::text),
    ('public.cash_sessions'::text),
    ('public.cash_session_entries'::text),
    ('supabase_migrations.schema_migrations'::text)
),
finance_columns(table_name, column_name) AS (
  VALUES
    ('payments', 'cash_session_id'),
    ('payments', 'idempotency_key'),
    ('payments', 'charge_event_id'),
    ('payments', 'commission_mode'),
    ('payments', 'commission_rate'),
    ('payments', 'commission_per_room_amount'),
    ('payments', 'commission_rounding'),
    ('payments', 'commission_recipient'),
    ('payments', 'commission_amount'),
    ('transactions', 'commission_mode_snapshot'),
    ('transactions', 'commission_rate_snapshot'),
    ('transactions', 'commission_per_room_amount_snapshot'),
    ('transactions', 'commission_rounding_snapshot'),
    ('transactions', 'minimum_dp_mode_snapshot'),
    ('transactions', 'minimum_dp_value_snapshot'),
    ('transactions', 'minimum_dp_amount_snapshot')
),
function_targets(routine_name) AS (
  VALUES
    ('create_reservation'::text),
    ('record_transaction_payment'::text),
    ('check_in_booking'::text),
    ('get_operational_day_mode'::text),
    ('open_finance_cash_session'::text),
    ('close_finance_cash_session'::text),
    ('confirm_finance_drawer_handover'::text),
    ('get_finance_session_summary'::text),
    ('record_finance_expense'::text),
    ('create_finance_deposit'::text),
    ('decide_finance_deposit'::text),
    ('create_finance_refund'::text),
    ('set_finance_settings'::text),
    ('set_finance_commission_config'::text),
    ('upsert_finance_bank_account'::text),
    ('finance_is_owner_or_supervisor'::text),
    ('finance_is_booking_operator'::text),
    ('finance_prepare_payment'::text),
    ('finance_booking_payment_guard'::text),
    ('finance_final_session_guard'::text),
    ('finance_snapshot_booking_dp'::text),
    ('finance_refund_source_session_guard'::text)
),
table_targets(table_name) AS (
  VALUES
    ('payments'::text),
    ('transactions'::text),
    ('package_room_type_prices'::text),
    ('operational_calendar'::text),
    ('finance_settings'::text),
    ('finance_commission_configs'::text),
    ('finance_bank_accounts'::text),
    ('finance_cash_sessions'::text),
    ('finance_session_allocations'::text),
    ('finance_drawer_handoffs'::text),
    ('finance_expenses'::text),
    ('finance_deposits'::text),
    ('finance_charge_events'::text),
    ('finance_refunds'::text),
    ('finance_refund_allocations'::text),
    ('finance_reservation_idempotency'::text)
)
SELECT category, details
FROM (
  SELECT
    'relation_flags'::text AS category,
    jsonb_build_object(
      'schema_name', n.nspname,
      'relation_name', c.relname,
      'relkind', c.relkind,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity
    ) AS details
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'supabase_migrations')
    AND (
      n.nspname = 'supabase_migrations'
      OR format('%I.%I', n.nspname, c.relname) IN (
        SELECT object_name FROM relation_targets
      )
    )

  UNION ALL

  SELECT
    'column_presence'::text AS category,
    jsonb_build_object(
      'table_name', fc.table_name,
      'column_name', fc.column_name,
      'exists', c.column_name IS NOT NULL,
      'data_type', c.data_type,
      'udt_name', c.udt_name,
      'nullable', c.is_nullable,
      'default', c.column_default
    ) AS details
  FROM finance_columns fc
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = fc.table_name
   AND c.column_name = fc.column_name

  UNION ALL

  SELECT
    'function_metadata'::text AS category,
    jsonb_build_object(
      'identity_signature', p.oid::regprocedure::text,
      'routine_name', p.proname,
      'identity_arguments', pg_get_function_identity_arguments(p.oid),
      'result_type', pg_get_function_result(p.oid),
      'security_definer', p.prosecdef,
      'owner_name', pg_get_userbyid(p.proowner),
      'search_path_config', to_jsonb(p.proconfig),
      'function_definition', pg_get_functiondef(p.oid)
    ) AS details
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (SELECT routine_name FROM function_targets)

  UNION ALL

  SELECT
    'function_presence'::text AS category,
    jsonb_build_object(
      'routine_name', ft.routine_name,
      'overload_count', count(p.oid),
      'signatures', coalesce(
        jsonb_agg(p.oid::regprocedure::text) FILTER (WHERE p.oid IS NOT NULL),
        '[]'::jsonb
      )
    ) AS details
  FROM function_targets ft
  LEFT JOIN (
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  ) p ON p.proname = ft.routine_name
  GROUP BY ft.routine_name

  UNION ALL

  SELECT
    'trigger_metadata'::text AS category,
    jsonb_build_object(
      'schema_name', n.nspname,
      'table_name', c.relname,
      'trigger_name', t.tgname,
      'enabled', t.tgenabled,
      'trigger_definition', pg_get_triggerdef(t.oid)
    ) AS details
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
    AND (
      c.relname IN (SELECT table_name FROM table_targets)
      OR t.tgname ILIKE '%finance%'
    )

  UNION ALL

  SELECT
    'policy_metadata'::text AS category,
    jsonb_build_object(
      'schema_name', pol.schemaname,
      'table_name', pol.tablename,
      'policy_name', pol.policyname,
      'permissive', pol.permissive,
      'roles', pol.roles,
      'command', pol.cmd,
      'using_expression', pol.qual,
      'check_expression', pol.with_check
    ) AS details
  FROM pg_policies pol
  WHERE pol.schemaname = 'public'
    AND pol.tablename IN (SELECT table_name FROM table_targets)

  UNION ALL

  SELECT
    'table_grant'::text AS category,
    jsonb_build_object(
      'table_schema', tp.table_schema,
      'table_name', tp.table_name,
      'grantor', tp.grantor,
      'grantee', tp.grantee,
      'privilege_type', tp.privilege_type,
      'is_grantable', tp.is_grantable
    ) AS details
  FROM information_schema.table_privileges tp
  WHERE tp.table_schema = 'public'
    AND tp.table_name IN (SELECT table_name FROM table_targets)

  UNION ALL

  SELECT
    'routine_grant'::text AS category,
    jsonb_build_object(
      'routine_schema', rp.routine_schema,
      'routine_name', rp.routine_name,
      'specific_name', rp.specific_name,
      'grantor', rp.grantor,
      'grantee', rp.grantee,
      'privilege_type', rp.privilege_type,
      'is_grantable', rp.is_grantable
    ) AS details
  FROM information_schema.routine_privileges rp
  WHERE rp.routine_schema = 'public'
    AND rp.routine_name IN (SELECT routine_name FROM function_targets)

  UNION ALL

  SELECT
    'enum'::text AS category,
    jsonb_build_object(
      'enum_schema', n.nspname,
      'enum_name', t.typname,
      'sort_order', e.enumsortorder,
      'label', e.enumlabel
    ) AS details
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typname IN (
      'app_role', 'employee_position', 'room_status', 'transaction_status'
    )

  UNION ALL

  SELECT
    'object_presence'::text AS category,
    jsonb_build_object(
      'object_name', rt.object_name,
      'exists', to_regclass(rt.object_name) IS NOT NULL
    ) AS details
  FROM relation_targets rt

  UNION ALL

  SELECT
    'migration_history'::text AS category,
    jsonb_build_object(
      'relation_name', 'supabase_migrations.schema_migrations',
      'exists', to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
      'rows_read', false,
      'note', 'Only relation existence is inspected; migration rows are not read.'
    ) AS details
) AS metadata
ORDER BY category, details::text;
