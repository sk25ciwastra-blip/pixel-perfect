-- Baturaden 25 Homestay — Finance 150 legacy compatibility preflight
-- SELECT ONLY. Aggregate counts only; no individual business rows are returned.
-- This package must be run separately from the Finance 150 reconciliation package.

WITH existing_tables(table_name) AS (
  VALUES
    ('user_roles'::text),
    ('employees'::text),
    ('room_types'::text),
    ('rooms'::text),
    ('packages'::text),
    ('package_price_history'::text),
    ('guests'::text),
    ('transactions'::text),
    ('activity_logs'::text),
    ('payments'::text),
    ('package_room_type_prices'::text)
)
SELECT category, details
FROM (
  SELECT
    'database_identity'::text AS category,
    jsonb_build_object(
      'database_name', current_database(),
      'current_user', current_user,
      'session_user', session_user,
      'server_version', current_setting('server_version'),
      'server_address', inet_server_addr()::text,
      'backup_pitr_status', 'not_queryable_from_public_catalog'
    ) AS details

  UNION ALL

  SELECT
    'rls_flags'::text AS category,
    jsonb_build_object(
      'schema_name', n.nspname,
      'table_name', c.relname,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity
    ) AS details
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (SELECT table_name FROM existing_tables)

  UNION ALL

  SELECT
    'legacy_transactions_quality'::text AS category,
    jsonb_build_object(
      'transactions_total', count(*),
      'price_snapshot_null', count(*) FILTER (WHERE price_snapshot IS NULL),
      'transaction_number_null', count(*) FILTER (WHERE transaction_number IS NULL),
      'transaction_number_legacy_format', count(*) FILTER (
        WHERE transaction_number !~ '^BTRD25-[0-9]{6}$'
      ),
      'booking_without_scheduled_window', count(*) FILTER (
        WHERE status = 'booking'
          AND (scheduled_check_in IS NULL OR scheduled_check_out IS NULL)
      ),
      'scheduled_window_invalid', count(*) FILTER (
        WHERE scheduled_check_in IS NOT NULL
          AND scheduled_check_out IS NOT NULL
          AND scheduled_check_out <= scheduled_check_in
      ),
      'day_mode_null', count(*) FILTER (WHERE day_mode IS NULL),
      'package_id_null', count(*) FILTER (WHERE package_id IS NULL),
      'checked_out_at_present', count(*) FILTER (WHERE checked_out_at IS NOT NULL)
    ) AS details
  FROM public.transactions

  UNION ALL

  SELECT
    'legacy_payments_quality'::text AS category,
    jsonb_build_object(
      'payments_total', count(*),
      'amount_nonpositive', count(*) FILTER (WHERE amount <= 0),
      'transaction_id_null', count(*) FILTER (WHERE transaction_id IS NULL),
      'recorded_by_null', count(*) FILTER (WHERE recorded_by IS NULL),
      'dp_payments', count(*) FILTER (WHERE kind = 'dp'),
      'full_payments', count(*) FILTER (WHERE kind = 'payment'),
      'cash_payments', count(*) FILTER (WHERE method = 'Cash'),
      'qris_payments', count(*) FILTER (WHERE method = 'QRIS'),
      'transfer_payments', count(*) FILTER (WHERE method = 'Transfer')
    ) AS details
  FROM public.payments

  UNION ALL

  SELECT
    'legacy_payment_coverage'::text AS category,
    jsonb_build_object(
      'transactions_without_payment', count(*) FILTER (WHERE coalesce(paid.payment_count, 0) = 0),
      'booking_transactions_without_payment', count(*) FILTER (
        WHERE t.status = 'booking' AND coalesce(paid.payment_count, 0) = 0
      ),
      'transactions_with_payment_over_total', count(*) FILTER (
        WHERE t.price_snapshot IS NOT NULL
          AND coalesce(paid.payment_total, 0) > t.price_snapshot
      ),
      'transactions_with_payment', count(*) FILTER (WHERE coalesce(paid.payment_count, 0) > 0)
    ) AS details
  FROM public.transactions t
  LEFT JOIN (
    SELECT
      transaction_id,
      count(*) AS payment_count,
      coalesce(sum(amount), 0) AS payment_total
    FROM public.payments
    GROUP BY transaction_id
  ) paid ON paid.transaction_id = t.id

  UNION ALL

  SELECT
    'execution_prerequisites'::text AS category,
    jsonb_build_object(
      'legacy_backfill_decision_required', true,
      'backup_pitr_confirmation_required', true,
      'legacy_rows_are_not_assumed_empty', true,
      'individual_rows_returned', false,
      'note', 'Counts only; no backfill recommendation is inferred from this query alone.'
    ) AS details
) AS metadata
ORDER BY category, details::text;
