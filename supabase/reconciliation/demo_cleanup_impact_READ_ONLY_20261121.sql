-- Baturaden 25 Homestay: read-only DEMO cleanup impact check
-- CHECKPOINT 2026-11-21. NON-DESTRUCTIVE. Not an authorization to delete.
-- Counts, FK closure and trigger scan only; no mutation or credentials.
WITH
target_tables(table_name) AS (
    VALUES ('finance_cash_sessions'),
    ('finance_charge_events'),
    ('finance_deposits'),
    ('finance_drawer_handoffs'),
    ('finance_expenses'),
    ('finance_payment_batch_idempotency'),
    ('finance_refund_allocations'),
    ('finance_refunds'),
    ('finance_reservation_idempotency'),
    ('finance_session_allocations'),
    ('finance_training_audit'),
    ('guest_notes'),
    ('guests'),
    ('housekeeping_checklists'),
    ('housekeeping_history'),
    ('housekeeping_jobs'),
    ('housekeeping_maintenance'),
    ('housekeeping_transaction_resolutions'),
    ('payment_receipts'),
    ('payments'),
    ('receipt_print_requests'),
    ('room_overtime_owner_releases'),
    ('transactions')
),
target_counts AS (
  SELECT 'finance_cash_sessions'::text AS table_name, count(*)::bigint AS row_count FROM public.finance_cash_sessions
  UNION ALL
  SELECT 'finance_charge_events'::text AS table_name, count(*)::bigint AS row_count FROM public.finance_charge_events
  UNION ALL
  SELECT 'finance_deposits'::text AS table_name, count(*)::bigint AS row_count FROM public.finance_deposits
  UNION ALL
  SELECT 'finance_drawer_handoffs'::text AS table_name, count(*)::bigint AS row_count FROM public.finance_drawer_handoffs
  UNION ALL
  SELECT 'finance_expenses'::text AS table_name, count(*)::bigint AS row_count FROM public.finance_expenses
  UNION ALL
  SELECT 'finance_payment_batch_idempotency'::text AS table_name, count(*)::bigint AS row_count FROM public.finance_payment_batch_idempotency
  UNION ALL
  SELECT 'finance_refund_allocations'::text AS table_name, count(*)::bigint AS row_count FROM public.finance_refund_allocations
  UNION ALL
  SELECT 'finance_refunds'::text AS table_name, count(*)::bigint AS row_count FROM public.finance_refunds
  UNION ALL
  SELECT 'finance_reservation_idempotency'::text AS table_name, count(*)::bigint AS row_count FROM public.finance_reservation_idempotency
  UNION ALL
  SELECT 'finance_session_allocations'::text AS table_name, count(*)::bigint AS row_count FROM public.finance_session_allocations
  UNION ALL
  SELECT 'finance_training_audit'::text AS table_name, count(*)::bigint AS row_count FROM public.finance_training_audit
  UNION ALL
  SELECT 'guest_notes'::text AS table_name, count(*)::bigint AS row_count FROM public.guest_notes
  UNION ALL
  SELECT 'guests'::text AS table_name, count(*)::bigint AS row_count FROM public.guests
  UNION ALL
  SELECT 'housekeeping_checklists'::text AS table_name, count(*)::bigint AS row_count FROM public.housekeeping_checklists
  UNION ALL
  SELECT 'housekeeping_history'::text AS table_name, count(*)::bigint AS row_count FROM public.housekeeping_history
  UNION ALL
  SELECT 'housekeeping_jobs'::text AS table_name, count(*)::bigint AS row_count FROM public.housekeeping_jobs
  UNION ALL
  SELECT 'housekeeping_maintenance'::text AS table_name, count(*)::bigint AS row_count FROM public.housekeeping_maintenance
  UNION ALL
  SELECT 'housekeeping_transaction_resolutions'::text AS table_name, count(*)::bigint AS row_count FROM public.housekeeping_transaction_resolutions
  UNION ALL
  SELECT 'payment_receipts'::text AS table_name, count(*)::bigint AS row_count FROM public.payment_receipts
  UNION ALL
  SELECT 'payments'::text AS table_name, count(*)::bigint AS row_count FROM public.payments
  UNION ALL
  SELECT 'receipt_print_requests'::text AS table_name, count(*)::bigint AS row_count FROM public.receipt_print_requests
  UNION ALL
  SELECT 'room_overtime_owner_releases'::text AS table_name, count(*)::bigint AS row_count FROM public.room_overtime_owner_releases
  UNION ALL
  SELECT 'transactions'::text AS table_name, count(*)::bigint AS row_count FROM public.transactions
),
all_public_tables AS (
 SELECT c.oid,c.relname,c.relrowsecurity
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p')
),
fk_external AS (
 SELECT co.oid
 FROM pg_constraint co
 JOIN pg_class parent ON parent.oid=co.confrelid
 JOIN pg_namespace pn ON pn.oid=parent.relnamespace
 JOIN pg_class child ON child.oid=co.conrelid
 JOIN pg_namespace cn ON cn.oid=child.relnamespace
 WHERE co.contype='f' AND pn.nspname='public'
 AND parent.relname IN (SELECT table_name FROM target_tables)
 AND NOT (cn.nspname='public' AND child.relname IN (SELECT table_name FROM target_tables))
),
truncate_triggers AS (
 SELECT t.oid
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN (SELECT table_name FROM target_tables)
 AND NOT t.tgisinternal AND (t.tgtype::int & 32)<>0
)
SELECT
 current_database() AS database_name,
 current_setting('server_version_num') AS server_version_num,
 (SELECT count(*)::int FROM all_public_tables) AS public_tables,
 (SELECT count(*)::int FROM target_tables) AS planned_demo_tables,
 (SELECT count(*)::int FROM target_counts) AS counted_demo_tables,
 (SELECT coalesce(sum(row_count),0)::int FROM target_counts) AS planned_demo_rows,
 (SELECT jsonb_object_agg(table_name,row_count ORDER BY table_name) FROM target_counts) AS demo_row_counts,
 (SELECT count(*)::int FROM fk_external) AS incoming_fk_from_preserved_tables,
 (SELECT count(*)::int FROM truncate_triggers) AS user_defined_on_truncate_triggers,
 (SELECT count(*)::int FROM all_public_tables
  WHERE has_table_privilege('anon',oid,'TRUNCATE')
     OR has_table_privilege('authenticated',oid,'TRUNCATE')) AS exposed_table_truncate,
 (SELECT count(*)::int FROM public.finance_cash_sessions WHERE status='FINAL') AS immutable_final_sessions,
 (SELECT count(*)::int FROM public.finance_cash_sessions WHERE status='OPEN') AS open_cash_sessions,
 (SELECT count(*)::int FROM public.rooms WHERE status='occupied') AS rooms_occupied,
 (SELECT count(*)::int FROM public.rooms WHERE status='dirty') AS rooms_dirty,
 (SELECT count(*)::int FROM public.activity_logs WHERE user_id IS NULL) AS historical_null_actor_logs,
 auth.uid() IS NULL AS no_authenticated_actor_in_sql_console,
 (SELECT count(*)::int FROM public.transactions WHERE created_at>timestamptz '2026-11-20 00:00:00+07') AS new_transactions_since_nov20,
 (SELECT count(*)::int FROM public.payments WHERE created_at>timestamptz '2026-11-20 00:00:00+07') AS new_payments_since_nov20;
