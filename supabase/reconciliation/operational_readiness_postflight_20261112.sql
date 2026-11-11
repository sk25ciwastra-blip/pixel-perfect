-- SELECT-only. PREPARED, NOT EXECUTED. Run only after preflight confirms exact
-- target, columns, tables, signatures, ACL and RLS. NO migration is requested by
-- this frontend-only package. No guest names, phone numbers or credentials.
-- Run under the same authorized role for comparable pre/post aggregate counts.
SELECT current_database(), current_user, now() AS inspected_at;

SELECT count(*) AS transactions,
 count(*) FILTER (WHERE guest_count < 1 OR extra_guest_count <> greatest(guest_count - 2, 0)) AS invalid_guest_counts,
 count(*) FILTER (WHERE extra_guest_charge <> extra_guest_count * extra_guest_unit_price) AS invalid_extra_amounts,
 count(*) FILTER (WHERE base_price_snapshot IS NOT NULL
   AND price_snapshot <> base_price_snapshot + extra_guest_charge) AS unreconciled_snapshots,
 count(*) FILTER (WHERE base_price_snapshot IS NULL) AS legacy_or_unsplit_snapshots
FROM public.transactions;

SELECT count(*) AS receipts,
 count(*) FILTER (WHERE receipt_snapshot IS NULL OR template_snapshot IS NULL) AS incomplete_snapshots,
 count(*) FILTER (WHERE snapshot_hash IS NULL) AS missing_snapshot_hash
FROM public.payment_receipts;

SELECT status, count(*) AS requests,
 count(*) FILTER (WHERE physical_confirmed_at IS NOT NULL) AS physically_confirmed
FROM public.receipt_print_requests GROUP BY status ORDER BY status;

SELECT count(*) AS duplicate_payment_receipt_groups FROM
 (SELECT payment_id FROM public.payment_receipts GROUP BY payment_id HAVING count(*) > 1) duplicates;
SELECT count(*) AS duplicate_copy_number_groups FROM
 (SELECT receipt_id, print_no FROM public.receipt_print_requests
  GROUP BY receipt_id, print_no HAVING count(*) > 1) duplicates;

WITH expected(template_kind) AS (VALUES ('BOOKING'), ('WALK_IN'))
SELECT e.template_kind, count(v.id) AS active_templates,
 bool_and(v.paper_width_mm = 58 AND v.language = 'en') AS format_58mm_english
FROM expected e LEFT JOIN public.receipt_template_versions v
 ON v.template_kind=e.template_kind AND v.status='ACTIVE'
GROUP BY e.template_kind ORDER BY e.template_kind;

SELECT name, to_regprocedure(name) IS NOT NULL AS exists,
 CASE WHEN to_regprocedure(name) IS NOT NULL THEN
   has_function_privilege('anon', to_regprocedure(name), 'EXECUTE') END AS anon_execute,
 CASE WHEN to_regprocedure(name) IS NOT NULL THEN
   has_function_privilege('authenticated', to_regprocedure(name), 'EXECUTE') END AS authenticated_execute
FROM (VALUES ('public.issue_payment_receipt(uuid)'),
 ('public.request_receipt_print(uuid,uuid)'),
 ('public.record_receipt_print_result(uuid,text,text,text,boolean)')) expected(name);

SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c WHERE c.relnamespace=to_regnamespace('public') AND c.relname IN
 ('receipt_template_versions','payment_receipts','receipt_print_requests',
  'finance_payment_batch_idempotency','finance_training_assignments','finance_training_audit')
ORDER BY c.relname;
