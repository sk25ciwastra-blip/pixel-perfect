-- REVIEW / READ-ONLY RECIPE ONLY. NOT EXECUTED AGAINST CLOUD IN THIS TASK.
-- Run only after the exact published backend is verified and Owner authorizes
-- metadata inspection. No business rows, tokens, config values or mutations.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SELECT current_database() AS database_name,
       current_setting('server_version_num') AS server_version_num;

SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,
       pg_get_userbyid(c.relowner) AS object_owner
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
ORDER BY c.relname;

SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS signature,
       p.proargnames AS parameter_names,p.prosecdef AS security_definer,
       pg_get_userbyid(p.proowner) AS object_owner,
       (SELECT array_agg(v) FROM unnest(p.proconfig) v WHERE v LIKE 'search_path=%') AS search_path_settings,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       md5(p.prosrc) AS body_digest
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
 'open_finance_cash_session','close_finance_cash_session','get_finance_session_summary',
 'finance_prepare_payment','finance_is_booking_operator','finance_training_is_restricted',
 'get_finance_training_context','create_reservation','create_training_reservation',
 'create_reservation_combined','create_training_reservation_combined',
 'check_in_booking','check_out_transaction','record_transaction_payment',
 'record_transaction_payment_combined','create_finance_refund','record_finance_expense',
 'advance_room_cleaning','complete_housekeeping_checklist',
 'issue_payment_receipt','request_receipt_print','record_receipt_print_result',
 'read_payment_confirmation_refunds','release_room_overtime_block')
ORDER BY p.proname,signature;

SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' AND tablename IN (
 'user_roles','employees','rooms','transactions','payments','finance_cash_sessions',
 'finance_refunds','finance_settings','finance_training_assignments',
 'housekeeping_checklists','housekeeping_history')
ORDER BY tablename,policyname;

SELECT table_name,column_name,data_type
FROM information_schema.columns WHERE table_schema='public'
 AND table_name IN ('transactions','finance_cash_sessions','finance_settings')
 AND column_name IN ('guest_count','extra_guest_count','extra_guest_unit_price','extra_guest_charge',
 'scheduled_check_in','scheduled_check_out','started_at','ends_at','status','closing_snapshot',
 'minimum_dp_mode','minimum_dp_value')
ORDER BY table_name,column_name;

SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS drizzle_ledger_present,
       to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS supabase_ledger_present;
ROLLBACK;
-- Body digests/signatures/grants are metadata, not proof of safe authorization.
-- Matching the actor/role guards requires separate code-definition comparison;
-- never fix a mismatch by blindly GRANTing or replaying the Finance DML seed.
