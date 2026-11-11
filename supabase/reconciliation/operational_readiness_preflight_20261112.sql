-- SELECT-only. PREPARED, NOT EXECUTED against Cloud.
-- Operator must first select Pixel Perfect Homestay Hub in the PERSONAL Lovable
-- workspace (project 017f6e78-15f2-4d07-a38c-87cb185279bf). Database name alone
-- cannot prove Lovable project identity. Do not substitute the old Staging.
SELECT current_database() AS database_name, current_user AS database_role,
       version() AS postgres_version, now() AS inspected_at;

WITH expected(name) AS (VALUES
 ('transactions'), ('payments'), ('user_roles'), ('employees'),
 ('finance_settings'), ('finance_cash_sessions'), ('finance_payment_batch_idempotency'),
 ('finance_training_assignments'), ('finance_training_audit'),
 ('receipt_template_versions'), ('payment_receipts'), ('receipt_print_requests'),
 ('housekeeping_jobs'), ('housekeeping_history'), ('housekeeping_checklists'))
SELECT e.name, c.oid IS NOT NULL AS exists, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       CASE WHEN c.oid IS NOT NULL AND to_regrole('anon') IS NOT NULL
         THEN has_table_privilege('anon', c.oid, 'SELECT') END AS anon_select,
       CASE WHEN c.oid IS NOT NULL AND to_regrole('authenticated') IS NOT NULL
         THEN has_table_privilege('authenticated', c.oid, 'SELECT') END AS authenticated_select,
       CASE WHEN c.oid IS NOT NULL AND to_regrole('authenticated') IS NOT NULL
         THEN has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE') END AS authenticated_any_write
FROM expected e LEFT JOIN pg_class c ON c.oid = to_regclass('public.' || e.name)
ORDER BY e.name;

WITH expected(name) AS (VALUES
 ('create_reservation_combined'), ('create_training_reservation_combined'),
 ('record_transaction_payment_combined'), ('record_training_transaction_payment_combined'),
 ('create_reservation'), ('create_training_reservation'), ('check_in_booking'),
 ('check_out_transaction'), ('advance_room_cleaning'), ('complete_housekeeping_checklist'),
 ('finance_training_session_is_valid'), ('issue_payment_receipt'),
 ('request_receipt_print'), ('record_receipt_print_result'))
SELECT e.name, p.oid IS NOT NULL AS exists,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_get_function_arguments(p.oid) AS arguments_with_defaults,
       p.proargnames AS argument_names, pg_get_function_result(p.oid) AS returns,
       p.prosecdef AS security_definer, p.proconfig AS function_settings,
       pg_get_userbyid(p.proowner) AS owner,
       CASE WHEN p.oid IS NOT NULL AND to_regrole('anon') IS NOT NULL
         THEN has_function_privilege('anon', p.oid, 'EXECUTE') END AS anon_execute,
       CASE WHEN p.oid IS NOT NULL AND to_regrole('authenticated') IS NOT NULL
         THEN has_function_privilege('authenticated', p.oid, 'EXECUTE') END AS authenticated_execute,
       md5(pg_get_functiondef(p.oid)) AS definition_md5
FROM expected e LEFT JOIN pg_proc p
 ON p.proname = e.name AND p.pronamespace = to_regnamespace('public')
ORDER BY e.name, identity_arguments;

WITH expected(column_name) AS (VALUES ('guest_count'), ('extra_guest_count'),
 ('extra_guest_unit_price'), ('extra_guest_charge'), ('base_price_snapshot'),
 ('price_snapshot'), ('minimum_dp_amount_snapshot'))
SELECT e.column_name, c.data_type, c.is_nullable, c.column_default
FROM expected e LEFT JOIN information_schema.columns c
 ON c.table_schema = 'public' AND c.table_name = 'transactions'
 AND c.column_name = e.column_name ORDER BY e.column_name;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename IN
 ('transactions','payments','receipt_template_versions','payment_receipts','receipt_print_requests',
  'finance_payment_batch_idempotency','finance_training_assignments','finance_training_audit')
ORDER BY tablename, policyname;

SELECT c.relname AS table_name, t.tgname, pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
WHERE NOT t.tgisinternal AND c.relnamespace=to_regnamespace('public')
 AND c.relname IN ('transactions','payments','payment_receipts','receipt_print_requests')
ORDER BY c.relname,t.tgname;

SELECT extname, extversion FROM pg_extension ORDER BY extname;
SELECT n.nspname AS migration_history_schema, c.relname AS migration_history_relation
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE (n.nspname='supabase_migrations' AND c.relname='schema_migrations')
   OR (n.nspname='drizzle' AND c.relname='__drizzle_migrations');
