-- Baturaden 25 Homestay — NO8 DEMO WIPE PRE-FLIGHT
-- SELECT ONLY. Safe to run against the verified Lovable database.
-- IMPORTANT: this is NOT the wipe; never run on Baturaden-25-Staging.
-- All rows were treated by Owner as DEMO operational data; master configuration
-- and mixed security/administrative audit require classification before deletion.
SELECT 'transactions' AS object, count(*) AS row_count FROM public.transactions
UNION ALL SELECT 'payments', count(*) FROM public.payments
UNION ALL SELECT 'finance_cash_sessions', count(*) FROM public.finance_cash_sessions
UNION ALL SELECT 'finance_expenses', count(*) FROM public.finance_expenses
UNION ALL SELECT 'finance_session_allocations', count(*) FROM public.finance_session_allocations
UNION ALL SELECT 'finance_reservation_idempotency', count(*) FROM public.finance_reservation_idempotency
UNION ALL SELECT 'finance_payment_batch_idempotency', count(*) FROM public.finance_payment_batch_idempotency
UNION ALL SELECT 'finance_charge_events', count(*) FROM public.finance_charge_events
UNION ALL SELECT 'finance_deposits', count(*) FROM public.finance_deposits
UNION ALL SELECT 'finance_refunds', count(*) FROM public.finance_refunds
UNION ALL SELECT 'finance_refund_allocations', count(*) FROM public.finance_refund_allocations
UNION ALL SELECT 'finance_drawer_handoffs', count(*) FROM public.finance_drawer_handoffs
UNION ALL SELECT 'finance_closing_count_audit', count(*) FROM public.finance_closing_count_audit
UNION ALL SELECT 'finance_training_assignments', count(*) FROM public.finance_training_assignments
UNION ALL SELECT 'finance_training_audit', count(*) FROM public.finance_training_audit
UNION ALL SELECT 'guests', count(*) FROM public.guests
UNION ALL SELECT 'guest_notes', count(*) FROM public.guest_notes
UNION ALL SELECT 'housekeeping_history', count(*) FROM public.housekeeping_history
UNION ALL SELECT 'housekeeping_jobs', count(*) FROM public.housekeeping_jobs
UNION ALL SELECT 'housekeeping_checklists', count(*) FROM public.housekeeping_checklists
UNION ALL SELECT 'housekeeping_maintenance', count(*) FROM public.housekeeping_maintenance
UNION ALL SELECT 'housekeeping_transaction_resolutions', count(*) FROM public.housekeeping_transaction_resolutions
UNION ALL SELECT 'payment_receipts', count(*) FROM public.payment_receipts
UNION ALL SELECT 'receipt_print_requests', count(*) FROM public.receipt_print_requests
UNION ALL SELECT 'room_overtime_owner_releases', count(*) FROM public.room_overtime_owner_releases
UNION ALL SELECT 'booking_owner_events', count(*) FROM public.booking_owner_events
UNION ALL SELECT 'activity_logs', count(*) FROM public.activity_logs
UNION ALL SELECT 'operational_calendar', count(*) FROM public.operational_calendar
UNION ALL SELECT 'operational_announcements', count(*) FROM public.operational_announcements
ORDER BY object;

-- Must match Owner-approved clean-slate scope; zeroing money alone is not sufficient.
SELECT status::text AS transaction_status, COUNT(*) AS row_count
FROM public.transactions GROUP BY status ORDER BY status;

SELECT status::text AS cash_status, COUNT(*) AS row_count
FROM public.finance_cash_sessions GROUP BY status ORDER BY status;

SELECT status::text AS room_status, COUNT(*) AS room_count
FROM public.rooms WHERE active = true GROUP BY status ORDER BY status;

SELECT action, entity_type, COUNT(*) AS row_count
FROM public.activity_logs GROUP BY action, entity_type ORDER BY row_count DESC, action;

-- Active triggers on critical financial tables: record before proposed cleanup.
SELECT t.tgrelid::regclass::text AS table_name, t.tgname,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
WHERE NOT t.tgisinternal AND t.tgenabled <> 'D'
  AND t.tgrelid IN (
    'public.finance_cash_sessions'::regclass,
    'public.payments'::regclass,
    'public.transactions'::regclass
  )
ORDER BY table_name, t.tgname;

-- Dependency chain; includes ON DELETE SET NULL on HK, which must not be allowed
-- to create silently orphaned audit history.
SELECT c.conrelid::regclass::text AS referencing_table,
       c.confrelid::regclass::text AS referenced_table,
       c.conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.contype = 'f'
  AND c.connamespace IN ('public'::regnamespace,'owner_delete_private'::regnamespace)
ORDER BY referencing_table, referenced_table;
