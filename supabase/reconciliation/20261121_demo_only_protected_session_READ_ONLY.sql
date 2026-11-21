-- Baturaden 25 Homestay | DEMO transaction reset preflight | READ-ONLY.
-- NEVER DELETE/TRUNCATE from this file. No Auth/Storage/password or prices modified.
-- Approved scope: 102 historical operational DEMO rows. Preserve all employees,
-- Auth users, staff photos, room configuration and the REAL receptionist session.
-- When any count changes, review afresh; do NOT force the counts to match.
WITH known_legacy_sessions(session_id) AS (
 VALUES
 ('29d2f77d-9014-4471-bd19-03afdda3270f'::uuid),
 ('947a7922-60db-4365-88e8-9fb963386eec'::uuid),
 ('714b1702-1a83-47f5-a9ed-60889b9ff617'::uuid),
 ('8b52c7ff-862f-4ea7-9223-68a6774e2d59'::uuid),
 ('e8dd94e9-f605-4c08-a84b-eae49865a1dd'::uuid)
), protected_real_session(session_id) AS (
 VALUES ('1aa5f75f-3438-4f00-8ede-b962c673b1a9'::uuid)
), row_counts(table_name,n) AS (
 SELECT 'finance_cash_sessions',count(*) FROM public.finance_cash_sessions UNION ALL
 SELECT 'finance_charge_events',count(*) FROM public.finance_charge_events UNION ALL
 SELECT 'finance_deposits',count(*) FROM public.finance_deposits UNION ALL
 SELECT 'finance_drawer_handoffs',count(*) FROM public.finance_drawer_handoffs UNION ALL
 SELECT 'finance_expenses',count(*) FROM public.finance_expenses UNION ALL
 SELECT 'finance_payment_batch_idempotency',count(*) FROM public.finance_payment_batch_idempotency UNION ALL
 SELECT 'finance_refund_allocations',count(*) FROM public.finance_refund_allocations UNION ALL
 SELECT 'finance_refunds',count(*) FROM public.finance_refunds UNION ALL
 SELECT 'finance_reservation_idempotency',count(*) FROM public.finance_reservation_idempotency UNION ALL
 SELECT 'finance_session_allocations',count(*) FROM public.finance_session_allocations UNION ALL
 SELECT 'finance_training_audit',count(*) FROM public.finance_training_audit UNION ALL
 SELECT 'guest_notes',count(*) FROM public.guest_notes UNION ALL
 SELECT 'guests',count(*) FROM public.guests UNION ALL
 SELECT 'housekeeping_checklists',count(*) FROM public.housekeeping_checklists UNION ALL
 SELECT 'housekeeping_history',count(*) FROM public.housekeeping_history UNION ALL
 SELECT 'housekeeping_jobs',count(*) FROM public.housekeeping_jobs UNION ALL
 SELECT 'housekeeping_maintenance',count(*) FROM public.housekeeping_maintenance UNION ALL
 SELECT 'housekeeping_transaction_resolutions',count(*) FROM public.housekeeping_transaction_resolutions UNION ALL
 SELECT 'payment_receipts',count(*) FROM public.payment_receipts UNION ALL
 SELECT 'payments',count(*) FROM public.payments UNION ALL
 SELECT 'receipt_print_requests',count(*) FROM public.receipt_print_requests UNION ALL
 SELECT 'room_overtime_owner_releases',count(*) FROM public.room_overtime_owner_releases UNION ALL
 SELECT 'transactions',count(*) FROM public.transactions
), inventory AS (
 SELECT
   (SELECT count(*)::int FROM public.finance_cash_sessions s JOIN known_legacy_sessions d ON d.session_id=s.id) AS known_legacy_sessions_present,
   (SELECT count(*)::int FROM public.finance_cash_sessions) AS all_cash_sessions,
   (SELECT count(*)::int FROM public.finance_cash_sessions s JOIN protected_real_session r ON r.session_id=s.id
       JOIN public.employees e ON e.user_id=s.opened_by
       WHERE e.employee_id='B25EMP-002' AND s.status='OPEN') AS real_receptionist_sessions_preserved,
   (SELECT count(*)::int FROM public.employees WHERE employee_id IN ('B25EMP-001','B25EMP-002')) AS real_staff,
   (SELECT count(*)::int FROM storage.objects o JOIN public.employee_profiles ep ON ep.photo_path=o.name
       JOIN public.employees e ON e.id=ep.employee_id
       WHERE o.bucket_id='employee-photos' AND e.employee_id IN ('B25EMP-001','B25EMP-002')) AS real_photos,
   (SELECT max(created_at) FROM public.employees WHERE employee_id IN ('B25EMP-001','B25EMP-002')) AS real_staff_created,
   (SELECT max(o.created_at) FROM storage.objects o JOIN public.employee_profiles ep ON ep.photo_path=o.name
       JOIN public.employees e ON e.id=ep.employee_id
       WHERE o.bucket_id='employee-photos' AND e.employee_id IN ('B25EMP-001','B25EMP-002')) AS last_real_photo_created,
   (SELECT max(created_at) FROM storage.objects WHERE bucket_id LIKE 'database_export_%' AND name LIKE '%.backup') AS latest_database_export,
   (SELECT count(*)::int FROM public.transactions WHERE created_at>=TIMESTAMPTZ '2026-11-21 00:00+07') AS transactions_since_start,
   (SELECT count(*)::int FROM public.payments WHERE created_at>=TIMESTAMPTZ '2026-11-21 00:00+07') AS payments_since_start,
   (SELECT count(*)::int FROM public.transactions) AS historical_transactions,
   (SELECT count(*)::int FROM public.payments) AS historical_payments,
   (SELECT sum(n)::int FROM row_counts) AS total_operational_rows
)
SELECT known_legacy_sessions_present,all_cash_sessions,real_receptionist_sessions_preserved,
       real_staff,real_photos,historical_transactions,historical_payments,
       total_operational_rows,(total_operational_rows-real_receptionist_sessions_preserved) AS candidate_historical_demo_rows,
       transactions_since_start,payments_since_start,
       latest_database_export,real_staff_created,last_real_photo_created,
       (latest_database_export>greatest(real_staff_created,last_real_photo_created)) AS fresh_database_export_present,
       CASE
         WHEN known_legacy_sessions_present<>5 OR all_cash_sessions<>6 OR real_receptionist_sessions_preserved<>1
           OR real_staff<>2 OR real_photos<>2 THEN 'STOP: protected inventory changed'
         WHEN historical_transactions<>17 OR historical_payments<>24 OR total_operational_rows<>103
           OR transactions_since_start<>0 OR payments_since_start<>0 THEN 'STOP: DEMO data inventory changed'
         WHEN NOT coalesce(latest_database_export>greatest(real_staff_created,last_real_photo_created),false)
           THEN 'BLOCKED: newer database export needed (also separately preserve photos)'
         ELSE 'READ-ONLY preflight counts match; backup restore and deletion procedure still require review'
       END AS gate_status
FROM inventory;
