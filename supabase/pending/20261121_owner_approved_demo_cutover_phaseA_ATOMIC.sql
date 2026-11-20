-- Baturaden 25 Homestay | OWNER-APPROVED LIVE DEMO CUTOVER: PHASE A
-- ONE atomic transaction. This is NOT an Auth user deletion.
-- Output postcheck follows COMMIT; preserves four nonstaff Auth accounts.
-- Only legacy demo employee profiles/rows/roles and 23 demo operational tables.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public.employees, public.employee_profiles, public.user_roles,
  public.rooms IN ACCESS EXCLUSIVE MODE;
LOCK TABLE auth.users IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.finance_cash_sessions,
  public.finance_charge_events,
  public.finance_deposits,
  public.finance_drawer_handoffs,
  public.finance_expenses,
  public.finance_payment_batch_idempotency,
  public.finance_refund_allocations,
  public.finance_refunds,
  public.finance_reservation_idempotency,
  public.finance_session_allocations,
  public.finance_training_audit,
  public.guest_notes,
  public.guests,
  public.housekeeping_checklists,
  public.housekeeping_history,
  public.housekeeping_jobs,
  public.housekeeping_maintenance,
  public.housekeeping_transaction_resolutions,
  public.payment_receipts,
  public.payments,
  public.receipt_print_requests,
  public.room_overtime_owner_releases,
  public.transactions IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE _b25_demo_employees ON COMMIT DROP AS
SELECT id,user_id,employee_id FROM public.employees
WHERE employee_id NOT LIKE 'B25EMP-%';

DO $pre$
DECLARE n integer; n_auth integer;
BEGIN
 SELECT count(*) INTO n FROM _b25_demo_employees;
 IF n<>11 THEN RAISE EXCEPTION 'STOP: expected 11 legacy DEMO staff, got %',n; END IF;
 IF EXISTS(SELECT 1 FROM _b25_demo_employees WHERE user_id IS NULL)
    OR EXISTS(SELECT 1 FROM _b25_demo_employees GROUP BY user_id HAVING count(*)>1)
 THEN RAISE EXCEPTION 'STOP: missing or duplicated staff Auth linkage'; END IF;
 SELECT count(*) INTO n_auth FROM auth.users u JOIN _b25_demo_employees d ON d.user_id=u.id;
 IF n_auth<>11 OR (SELECT count(*) FROM auth.users)<>15
 THEN RAISE EXCEPTION 'STOP: unexpected Auth inventory'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles r JOIN _b25_demo_employees d ON d.user_id=r.user_id WHERE r.role::text='owner')
 THEN RAISE EXCEPTION 'STOP: Owner role detected in target'; END IF;
 IF (SELECT count(*) FROM public.user_roles r JOIN _b25_demo_employees d ON d.user_id=r.user_id)<>11
 THEN RAISE EXCEPTION 'STOP: employee roles changed'; END IF;
 IF (SELECT count(*) FROM public.employees WHERE employee_id LIKE 'B25EMP-%')<>0
 THEN RAISE EXCEPTION 'STOP: real employee registered; do not reset'; END IF;
 IF (SELECT count(*) FROM storage.objects s JOIN _b25_demo_employees d
     ON (s.owner=d.user_id OR s.owner_id=d.user_id::text))<>0
 THEN RAISE EXCEPTION 'STOP: staff owns Storage objects'; END IF;
 IF (SELECT count(*) FROM storage.buckets s JOIN _b25_demo_employees d
     ON (s.owner=d.user_id OR s.owner_id=d.user_id::text))<>0
 THEN RAISE EXCEPTION 'STOP: staff owns Storage buckets'; END IF;
 IF (SELECT sum(n) FROM (
  SELECT count(*)::int AS n FROM public.finance_cash_sessions
  UNION ALL
  SELECT count(*)::int AS n FROM public.finance_charge_events
  UNION ALL
  SELECT count(*)::int AS n FROM public.finance_deposits
  UNION ALL
  SELECT count(*)::int AS n FROM public.finance_drawer_handoffs
  UNION ALL
  SELECT count(*)::int AS n FROM public.finance_expenses
  UNION ALL
  SELECT count(*)::int AS n FROM public.finance_payment_batch_idempotency
  UNION ALL
  SELECT count(*)::int AS n FROM public.finance_refund_allocations
  UNION ALL
  SELECT count(*)::int AS n FROM public.finance_refunds
  UNION ALL
  SELECT count(*)::int AS n FROM public.finance_reservation_idempotency
  UNION ALL
  SELECT count(*)::int AS n FROM public.finance_session_allocations
  UNION ALL
  SELECT count(*)::int AS n FROM public.finance_training_audit
  UNION ALL
  SELECT count(*)::int AS n FROM public.guest_notes
  UNION ALL
  SELECT count(*)::int AS n FROM public.guests
  UNION ALL
  SELECT count(*)::int AS n FROM public.housekeeping_checklists
  UNION ALL
  SELECT count(*)::int AS n FROM public.housekeeping_history
  UNION ALL
  SELECT count(*)::int AS n FROM public.housekeeping_jobs
  UNION ALL
  SELECT count(*)::int AS n FROM public.housekeeping_maintenance
  UNION ALL
  SELECT count(*)::int AS n FROM public.housekeeping_transaction_resolutions
  UNION ALL
  SELECT count(*)::int AS n FROM public.payment_receipts
  UNION ALL
  SELECT count(*)::int AS n FROM public.payments
  UNION ALL
  SELECT count(*)::int AS n FROM public.receipt_print_requests
  UNION ALL
  SELECT count(*)::int AS n FROM public.room_overtime_owner_releases
  UNION ALL
  SELECT count(*)::int AS n FROM public.transactions
 ) checked_demo_counts)<>102
 THEN RAISE EXCEPTION 'STOP: expected precisely 102 DEMO operational rows'; END IF;
 IF (SELECT count(*) FROM public.transactions)<>17
  OR (SELECT count(*) FROM public.payments)<>24
  OR (SELECT count(*) FROM public.finance_cash_sessions)<>5
  OR (SELECT count(*) FROM public.finance_cash_sessions WHERE status='OPEN')<>2
  OR (SELECT count(*) FROM public.finance_cash_sessions WHERE status='FINAL')<>3
  OR (SELECT count(*) FROM public.rooms)<>12
  OR (SELECT count(*) FROM public.rooms WHERE status='occupied')<>4
  OR (SELECT count(*) FROM public.rooms WHERE status='dirty')<>1
 THEN RAISE EXCEPTION 'STOP: DEMO operational counts changed'; END IF;
 IF (SELECT count(*) FROM public.transactions WHERE created_at>timestamptz '2026-11-20 00:00:00+07')<>0
  OR (SELECT count(*) FROM public.payments WHERE created_at>timestamptz '2026-11-20 00:00:00+07')<>0
 THEN RAISE EXCEPTION 'STOP: new transactions may be real'; END IF;
 IF (SELECT count(*) FROM public.packages)<>9
  OR (SELECT count(*) FROM public.room_types)<>5
  OR (SELECT count(*) FROM public.finance_settings)<>1
  OR (SELECT count(*) FROM public.finance_commission_configs)<>1
  OR (SELECT count(*) FROM public.receipt_template_versions)<>2
 THEN RAISE EXCEPTION 'STOP: preserved configuration changed'; END IF;
 IF to_regclass('public.b25_employee_id_seq') IS NULL
  OR to_regprocedure('public.allocate_b25_employee_id()') IS NULL
 THEN RAISE EXCEPTION 'STOP: approved employee allocator missing'; END IF;
END
$pre$;

-- DEMO cutover exception: FINAL sessions are DEMO, explicitly cleared
-- as an initialization, not as historical operational refunds/edits.
-- Without CASCADE and without resetting any numbering sequences.
TRUNCATE TABLE
  public.finance_cash_sessions,
  public.finance_charge_events,
  public.finance_deposits,
  public.finance_drawer_handoffs,
  public.finance_expenses,
  public.finance_payment_batch_idempotency,
  public.finance_refund_allocations,
  public.finance_refunds,
  public.finance_reservation_idempotency,
  public.finance_session_allocations,
  public.finance_training_audit,
  public.guest_notes,
  public.guests,
  public.housekeeping_checklists,
  public.housekeeping_history,
  public.housekeeping_jobs,
  public.housekeeping_maintenance,
  public.housekeeping_transaction_resolutions,
  public.payment_receipts,
  public.payments,
  public.receipt_print_requests,
  public.room_overtime_owner_releases,
  public.transactions
  CONTINUE IDENTITY RESTRICT;

-- Do not mark unverified rooms READY: occupied DEMO becomes DIRTY
-- and an actual Supervisor/Housekeeping user must perform physical check.
UPDATE public.rooms
SET status='dirty'
WHERE status='occupied';

-- Revoke legacy employee access immediately. Auth user deletion is phase B
-- via official Auth Admin API, not this SQL command.
DELETE FROM public.user_roles r
USING _b25_demo_employees d
WHERE r.user_id=d.user_id;
DELETE FROM public.employee_profiles p
USING _b25_demo_employees d
WHERE p.employee_id=d.id;
DELETE FROM public.employees e
USING _b25_demo_employees d
WHERE e.id=d.id;

DO $post$
BEGIN
 IF EXISTS(SELECT 1 FROM public.employees)
  OR EXISTS(SELECT 1 FROM public.user_roles r JOIN _b25_demo_employees d ON d.user_id=r.user_id)
  OR EXISTS(SELECT 1 FROM public.employee_profiles p JOIN _b25_demo_employees d ON d.id=p.employee_id)
  OR (SELECT count(*) FROM public.transactions)<>0
  OR (SELECT count(*) FROM public.payments)<>0
  OR (SELECT count(*) FROM public.finance_cash_sessions)<>0
  OR (SELECT count(*) FROM public.guests)<>0
  OR (SELECT count(*) FROM public.housekeeping_jobs)<>0
  OR (SELECT count(*) FROM public.housekeeping_history)<>0
  OR (SELECT count(*) FROM public.receipt_print_requests)<>0
 THEN RAISE EXCEPTION 'STOP: DEMO cutover postcheck failed; rollback'; END IF;
 IF (SELECT count(*) FROM auth.users)<>15
  OR (SELECT count(*) FROM auth.users u JOIN _b25_demo_employees d ON d.user_id=u.id)<>11
  OR (SELECT count(*) FROM auth.users u WHERE u.id NOT IN
      (SELECT user_id FROM _b25_demo_employees))<>4
 THEN RAISE EXCEPTION 'STOP: Auth inventory changed; rollback'; END IF;
 IF (SELECT count(*) FROM public.rooms)<>12
  OR (SELECT count(*) FROM public.rooms WHERE status='occupied')<>0
  OR (SELECT count(*) FROM public.rooms WHERE status='dirty')<>5
  OR (SELECT count(*) FROM public.rooms WHERE status='ready')<>7
  OR (SELECT count(*) FROM public.packages)<>9
  OR (SELECT count(*) FROM public.room_types)<>5
  OR (SELECT count(*) FROM public.finance_settings)<>1
  OR (SELECT count(*) FROM public.finance_commission_configs)<>1
  OR (SELECT count(*) FROM public.receipt_template_versions)<>2
 THEN RAISE EXCEPTION 'STOP: preserved room/config changed; rollback'; END IF;
END
$post$;
COMMIT;

SELECT 'PHASE_A_SUCCESS_AUTH_ADMIN_PENDING' AS result,
 (SELECT count(*)::int FROM public.employees) AS remaining_employees,
 (SELECT count(*)::int FROM public.transactions) AS remaining_demo_trx,
 (SELECT count(*)::int FROM public.payments) AS remaining_demo_payments,
 (SELECT count(*)::int FROM public.finance_cash_sessions) AS remaining_demo_cash,
 (SELECT count(*)::int FROM auth.users) AS auth_accounts_including_11_pending_delete,
 (SELECT count(*)::int FROM public.rooms WHERE status='dirty') AS rooms_awaiting_physical_cleaning;
