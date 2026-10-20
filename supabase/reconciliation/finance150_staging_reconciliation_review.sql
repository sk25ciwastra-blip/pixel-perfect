-- Baturaden 25 Homestay — Finance 150 Staging reconciliation review package
-- REVIEW ONLY. Do not execute directly.
-- This file describes the forward-only package for the existing 11-table Staging schema.
-- Historical migrations are not replayed and existing migration files are not edited.
-- Execution remains BLOCKED until the read-only preflight, backup/PITR, and legacy-data
-- compatibility decisions are reviewed by Owner.

-- ============================================================
-- PHASE 0 — PRECONDITIONS / ABORT CONDITIONS
-- ============================================================
-- Required before materializing an executable migration:
--   1. Target identity matches Baturaden-25-Staging.
--   2. Approved provider backup/PITR evidence exists and rollback owner is named.
--   3. Existing 11-table relation flags, RLS, grants, triggers, and function identity
--      are captured by finance150_staging_preflight.sql.
--   4. Current signatures are confirmed exactly:
--        create_reservation(text, uuid, uuid, text, text, text, numeric, text, text, timestamptz)
--        record_transaction_payment(uuid, numeric, text)
--        check_in_booking(uuid)
--   5. No unexpected overload or existing Finance object conflicts with the package.
--   6. Legacy aggregate compatibility results are reviewed without exposing rows.
--   7. Application cutover window is coordinated so callers do not use 10/3 contracts
--      while the 12/5 contracts are being installed.
--
-- If any precondition fails, abort before any write operation.

-- Read-only execution guard template. It raises instead of changing the database.
-- Keep this guard at the beginning of any later materialized write package.
DO $preflight$
DECLARE
  required_table text;
  finance_relation_count integer;
BEGIN
  IF current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'Wrong database target: expected postgres';
  END IF;

  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'Unexpected PostgreSQL major version';
  END IF;

  FOREACH required_table IN ARRAY ARRAY[
    'user_roles', 'employees', 'room_types', 'rooms', 'packages',
    'package_price_history', 'guests', 'transactions', 'activity_logs',
    'payments', 'package_room_type_prices'
  ] LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'Required existing table is missing: public.%', required_table;
    END IF;
  END LOOP;

  SELECT count(*)
  INTO finance_relation_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'operational_calendar',
      'finance_settings', 'finance_commission_configs', 'finance_bank_accounts',
      'finance_cash_sessions', 'finance_session_allocations',
      'finance_drawer_handoffs', 'finance_expenses', 'finance_deposits',
      'finance_charge_events', 'finance_refunds',
      'finance_refund_allocations', 'finance_reservation_idempotency'
    );

  IF finance_relation_count <> 0 THEN
    RAISE EXCEPTION 'Partial Finance/calendar state exists; stop for exact diff';
  END IF;

  IF to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'Expected existing 10-argument create_reservation is missing';
  END IF;

  IF to_regprocedure('public.record_transaction_payment(uuid,numeric,text)') IS NULL THEN
    RAISE EXCEPTION 'Expected existing 3-argument payment RPC is missing';
  END IF;

  IF to_regprocedure('public.check_in_booking(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Expected existing check_in_booking(uuid) is missing';
  END IF;

  IF (SELECT count(*) FROM public.transactions) <> 0
     OR (SELECT count(*) FROM public.payments) <> 0 THEN
    RAISE EXCEPTION 'Snapshot drift detected: transactions/payments are no longer empty';
  END IF;
END
$preflight$;

-- ============================================================
-- PHASE 1 — SCHEMA PREPARATION, FORWARD-ONLY
-- ============================================================
-- Materialize only after Phase 0 passes.
--
-- 1A. Operational calendar prerequisite
--     Source references to review:
--       supabase/migrations/20261006000011_operational_calendar.sql
--       supabase/migrations/20261006000012_calendar_event_types.sql
--       supabase/migrations/20261006000013_seed_official_calendar.sql
--       supabase/migrations/20261006000014_authoritative_day_mode.sql
--     Preserve existing tables. Create only missing calendar relation/columns,
--     constraints, read policy, and get_operational_day_mode(date), with guards.
--     Do not replay unrelated migration files.
--
-- 1B. Finance Foundation
--     Source for exact reviewed definitions:
--       supabase/migrations/20261015000000_finance_foundation.sql
--     Create only missing Finance relations:
--       finance_settings
--       finance_commission_configs
--       finance_bank_accounts
--       finance_cash_sessions
--       finance_session_allocations
--       finance_drawer_handoffs
--       finance_expenses
--       finance_deposits
--       finance_charge_events
--       finance_refunds
--       finance_refund_allocations
--     Add only missing Finance columns/FKs/indexes on payments/transactions.
--     Install Finance triggers and RLS only after exact relation/column checks.
--     Do not backfill legacy payment/session ownership implicitly.
--
-- 1C. Finance 150 Booking Compatibility
--     Source for exact reviewed definitions:
--       supabase/migrations/20261015000001_finance_150_booking_compatibility.sql
--     Create finance_reservation_idempotency and minimum-DP snapshot columns.
--     Install DP snapshot/payment guards and refund-source guard.
--     Cut over record_transaction_payment to the five-argument contract.
--     Cut over create_reservation to the twelve-argument contract.
--     Drop only the exact old signatures inside the approved cutover transaction;
--     do not leave ambiguous overloads.
--
-- 1D. Supervisor Alignment
--     Source for exact reviewed definitions:
--       supabase/migrations/20261015000002_finance_150_supervisor_alignment.sql
--     Replace the approved open-session/check-in/reservation definitions and add
--     Supervisor read-only policies. Keep direct Finance writes behind SECURITY DEFINER
--     RPCs. Verify can_frontdesk/can_view_finance semantics before policy replacement.
--
-- 1E. Reference privileges
--     Source for exact reviewed definitions:
--       supabase/migrations/20261015000003_booking_reference_read_privileges.sql
--     Apply only after calendar/pricing relations exist and exact table grants are known.

-- ============================================================
-- PHASE 2 — LEGACY DATA COMPATIBILITY / BACKFILL DECISION
-- ============================================================
-- No automatic backfill is approved by this file.
--
-- Existing payments:
--   - cash_session_id, idempotency_key, commission fields are absent today.
--   - Existing rows must remain historically valid.
--   - A policy is required for historical payments that predate cash sessions.
--
-- Existing transactions:
--   - commission snapshots and minimum-DP snapshots are absent today.
--   - Existing booking rows must not be reinterpreted by later Finance settings.
--   - Any backfill requires aggregate compatibility results and Owner approval.
--
-- Safe default for review: preserve legacy NULL snapshots and apply Finance triggers
-- only to new/updated Finance-managed rows according to the reviewed function bodies.
-- This default is a decision placeholder, not an execution instruction.

-- ============================================================
-- PHASE 3 — ATOMIC RPC CUTOVER
-- ============================================================
-- Required sequence inside one reviewed transaction/cutover window:
--   1. Reconfirm exact old signatures and dependent callers.
--   2. Install/verify prerequisite calendar and Finance relations.
--   3. Replace payment contract 3 args -> 4 args -> 5 args as defined by the
--      reviewed Finance 150 chain; no obsolete callable overload remains.
--   4. Replace reservation contract 10 args -> 12 args; no obsolete callable
--      overload remains unless an explicitly approved compatibility wrapper exists.
--   5. Replace check_in_booking(uuid) with Supervisor-aligned definition.
--   6. Verify SECURITY DEFINER, owner, search_path, EXECUTE grants, and PostgREST
--      identity resolution before releasing application traffic.
--
-- If application callers cannot be cut over atomically, stop and design an approved
-- compatibility wrapper with a distinct name. Do not leave ambiguous same-name overloads.

-- ============================================================
-- PHASE 4 — RLS, GRANTS, AND POST-CUTOVER VERIFICATION
-- ============================================================
-- Verify, without business-row export:
--   - RLS enabled/forced on every Finance relation.
--   - Authenticated SELECT surface for permitted Finance/reference tables.
--   - No direct INSERT/UPDATE/DELETE on Finance tables for anon/authenticated.
--   - EXECUTE only on approved SECURITY DEFINER RPCs.
--   - Supervisor reads are SELECT-only and do not grant direct Finance mutation.
--   - Legacy 10/3 RPC signatures are absent after approved cutover.
--   - New 12/5 signatures resolve uniquely.

-- ============================================================
-- PHASE 5 — NON-BUSINESS SMOKE TESTS
-- ============================================================
-- After successful verification and separate Owner approval:
--   1. Authenticate non-production Owner/Receptionist/Supervisor identities.
--   2. Open one Finance cash session.
--   3. Create one dummy booking with idempotency key.
--   4. Retry identical key and confirm no duplicate.
--   5. Record one dummy payment and verify session ownership/operator separation.
--   6. Check in the same dummy booking through approved RPC.
--   7. Verify Finance summary and RLS read surface.
--   8. Roll back/clean only according to the approved Staging data policy.
--
-- No step in this review file has been executed.
