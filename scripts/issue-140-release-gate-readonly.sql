-- Baturaden 25 Homestay / Issue #140
-- READ-ONLY release-gate preflight. No DDL/DML, no guest identity/phone rows.
-- Run against a clearly identified target, NEVER assume staging equals Lovable LIVE.
WITH requirements(label, signature, kind, required) AS (
  VALUES
    ('booking_writer_12','public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid)','function',false),
    ('booking_writer_13','public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)','function',false),
    ('quote_role_guard','booking_quote_private.require_operator()','function',true),
    ('quote_minimum_dp','public.get_booking_quote_minimum_dp()','function',true),
    ('quote_schedule','public.check_booking_quote_schedule(uuid,uuid,timestamptz)','function',true),
    ('training_guard','public.finance_training_is_restricted(uuid)','function',true),
    ('booking_operator','public.finance_is_booking_operator(uuid)','function',true),
    ('day_mode','public.get_operational_day_mode(date)','function',true),
    ('offer_table','public.reservation_offers','relation',false),
    ('payments_table','public.payments','relation',true),
    ('guests_table','public.guests','relation',true)
), resolved AS (
  SELECT label, required,
    CASE WHEN kind = 'function' THEN to_regprocedure(signature) IS NOT NULL
         ELSE to_regclass(signature) IS NOT NULL END AS present
  FROM requirements
), backend AS (
  SELECT
    count(*) FILTER (WHERE proname = 'create_reservation') > 0 AS booking_writer_any,
    bool_or(prosecdef) FILTER (WHERE proname = 'create_reservation') AS booking_security_definer
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'create_reservation'
), payment_trigger AS (
  SELECT count(*) FILTER (WHERE tgname='finance_prepare_payment_trigger') > 0 AS prepare_guard,
         count(*) FILTER (WHERE tgname='payments_transaction_state_guard_trigger') > 0 AS state_guard
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='payments' AND NOT t.tgisinternal
), summary AS (
  SELECT
    (SELECT coalesce(jsonb_object_agg(label,present ORDER BY label),'{}'::jsonb) FROM resolved) AS prerequisites,
    (SELECT coalesce(bool_and(present),false) FROM resolved WHERE required) AS required_present,
    (SELECT booking_writer_any FROM backend) AS booking_writer_available,
    (SELECT booking_security_definer FROM backend) AS booking_is_security_definer,
    (SELECT prepare_guard FROM payment_trigger) AS payment_prepare_trigger,
    (SELECT state_guard FROM payment_trigger) AS payment_state_trigger
)
SELECT jsonb_build_object(
  'target_database', current_database(),
  'postgres_major', current_setting('server_version_num')::integer / 10000,
  'prerequisites', prerequisites,
  'release_gate', CASE
     WHEN NOT required_present THEN 'HOLD_MISSING_DEPENDENCY'
     WHEN NOT booking_writer_available OR booking_is_security_definer IS DISTINCT FROM true
       THEN 'HOLD_BOOKING_ABI'
     WHEN NOT payment_prepare_trigger OR NOT payment_state_trigger
       THEN 'HOLD_FINANCE_GUARD'
     ELSE 'CATALOG_CHECKS_ONLY_FURTHER_REHEARSAL_REQUIRED'
  END,
  'next_step', 'Compare definitions/ACL and test on approved isolated clone; never apply pending SQL based on this report alone'
) AS preflight
FROM summary;
