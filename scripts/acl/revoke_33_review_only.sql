-- BATURADEN 25 HOMESTAY — SECURITY ACL, REVIEW-ONLY CANDIDATE
-- DRAFT. NOT EXECUTED. NOT OWNER AUTHORIZATION FOR DATABASE WRITE.
-- Target: Lovable LIVE database of project 017f6e78-15f2-4d07-a38c-87cb185279bf
-- Baseline sampled: 2026-11-20 around 22:03 WIB
-- Scope: revoke ONLY table TRUNCATE from anon and authenticated on exact 33 tables.
-- Does NOT change RLS, policies, data, functions, other privileges or default ACLs.
-- Before use: separate Owner approval, baseline refresh, reviewed recovery plan,
-- lock window, independent test of operational behavior and database identity.

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '45s';

DO $preflight$
DECLARE
  expected text[] := ARRAY[
    'activity_logs',
    'employee_profiles',
    'employees',
    'finance_bank_accounts',
    'finance_cash_sessions',
    'finance_charge_events',
    'finance_commission_configs',
    'finance_deposits',
    'finance_drawer_handoffs',
    'finance_expenses',
    'finance_payment_batch_idempotency',
    'finance_refund_allocations',
    'finance_refunds',
    'finance_reservation_idempotency',
    'finance_session_allocations',
    'finance_settings',
    'finance_training_assignments',
    'finance_training_audit',
    'guests',
    'housekeeping_jobs',
    'housekeeping_maintenance',
    'housekeeping_transaction_resolutions',
    'operational_announcements',
    'operational_calendar',
    'package_price_history',
    'package_room_type_prices',
    'packages',
    'payment_receipts',
    'payments',
    'receipt_print_requests',
    'receipt_template_versions',
    'room_types',
    'user_roles'
  ];
  live_tables text[];
  live_acl_hash text;
  live_default_acl_hash text;
BEGIN
  SELECT array_agg(c.relname::text ORDER BY c.relname),
         md5(string_agg(c.relname || '|' || coalesce(c.relacl::text, '') || '|' ||
           pg_get_userbyid(c.relowner) || '|' || c.relrowsecurity::text,
           E'\n' ORDER BY c.relname))
  INTO live_tables, live_acl_hash
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
    AND (has_table_privilege('anon', c.oid, 'TRUNCATE')
         OR has_table_privilege('authenticated', c.oid, 'TRUNCATE'));

  IF live_tables IS DISTINCT FROM expected OR
     live_acl_hash IS DISTINCT FROM 'b992406a39a1ca0142e56b017e45809b' THEN
    RAISE EXCEPTION 'STOP: public table TRUNCATE/ACL baseline drift';
  END IF;

  SELECT md5(string_agg(pg_get_userbyid(d.defaclrole) || '|' || d.defaclacl::text,
                        E'\n' ORDER BY pg_get_userbyid(d.defaclrole)))
  INTO live_default_acl_hash
  FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace
  WHERE n.nspname='public' AND d.defaclobjtype='r'
    AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin');

  IF live_default_acl_hash IS DISTINCT FROM 'bed16621c84278837e08965943391d9b' THEN
    RAISE EXCEPTION 'STOP: default ACL baseline changed';
  END IF;
END;
$preflight$;

REVOKE TRUNCATE ON TABLE
  public.activity_logs,
  public.employee_profiles,
  public.employees,
  public.finance_bank_accounts,
  public.finance_cash_sessions,
  public.finance_charge_events,
  public.finance_commission_configs,
  public.finance_deposits,
  public.finance_drawer_handoffs,
  public.finance_expenses,
  public.finance_payment_batch_idempotency,
  public.finance_refund_allocations,
  public.finance_refunds,
  public.finance_reservation_idempotency,
  public.finance_session_allocations,
  public.finance_settings,
  public.finance_training_assignments,
  public.finance_training_audit,
  public.guests,
  public.housekeeping_jobs,
  public.housekeeping_maintenance,
  public.housekeeping_transaction_resolutions,
  public.operational_announcements,
  public.operational_calendar,
  public.package_price_history,
  public.package_room_type_prices,
  public.packages,
  public.payment_receipts,
  public.payments,
  public.receipt_print_requests,
  public.receipt_template_versions,
  public.room_types,
  public.user_roles
FROM anon, authenticated RESTRICT;

DO $postcheck$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND (has_table_privilege('anon', c.oid, 'TRUNCATE')
           OR has_table_privilege('authenticated', c.oid, 'TRUNCATE'))
  ) THEN
    RAISE EXCEPTION 'STOP: TRUNCATE privilege remains, rollback whole transaction';
  END IF;
END;
$postcheck$;

-- Not addressed here: postgres/supabase_admin default ACLs, restore proof,
-- separate idempotency and other Cloud migration packages.
COMMIT;