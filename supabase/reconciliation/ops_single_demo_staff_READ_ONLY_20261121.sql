-- Baturaden 25 Homestay | read-only single DEMO staff acceptance monitor
-- Marker intentionally unique to the one Owner-approved staff test on 21 Nov 2026.
-- No login impersonation, writes, or financial mutation. Run after staff reports test steps.
WITH demo AS (
  SELECT t.*, g.full_name AS test_marker, r.room_number, r.status::text AS room_status, p.name AS package_name
  FROM public.transactions t
  JOIN public.guests g ON g.id=t.guest_id
  JOIN public.rooms r ON r.id=t.room_id
  JOIN public.packages p ON p.id=t.package_id
  WHERE g.full_name = 'B25 UJI OPS 21NOV26 A'
),
payments AS (
 SELECT p.transaction_id,
 count(*)::int AS payment_records,
 coalesce(sum(p.amount),0) AS total_paid,
 count(*) FILTER(WHERE p.cash_session_id IS NULL)::int AS no_cash_session,
 count(DISTINCT p.cash_session_id)::int AS distinct_payment_sessions,
 count(*) FILTER(WHERE p.recorded_by IS NULL)::int AS payment_missing_operator,
 string_agg(p.method || ':' || p.amount::text, ', ' ORDER BY p.created_at) AS payment_details
 FROM public.payments p
 WHERE p.transaction_id IN (SELECT id FROM demo)
 GROUP BY p.transaction_id
),
housekeeping AS (
 SELECT h.transaction_id,count(*)::int AS events,
 count(*) FILTER(WHERE h.action='start_cleaning')::int AS cleaning_start_events
 FROM public.housekeeping_history h
 WHERE h.transaction_id IN (SELECT id FROM demo)
 GROUP BY h.transaction_id
),
checklists AS (
 SELECT h.transaction_id,count(*)::int AS checklist_records
 FROM public.housekeeping_checklists h
 WHERE h.transaction_id IN (SELECT id FROM demo)
 GROUP BY h.transaction_id
),
receipts AS (
 SELECT pr.transaction_id,
 count(DISTINCT pr.id)::int AS payment_receipts,
 count(q.id)::int AS print_requests,
 string_agg(q.print_no::text || ':' || coalesce(q.copy_label,'FIRST'), ', ' ORDER BY q.print_no) AS receipt_copy_sequence
 FROM public.payment_receipts pr
 LEFT JOIN public.receipt_print_requests q ON q.receipt_id=pr.id
 WHERE pr.transaction_id IN (SELECT id FROM demo)
 GROUP BY pr.transaction_id
)
SELECT
 d.transaction_number,d.status::text AS trx_status,
 d.room_number,d.room_status,d.package_name,d.day_mode,
 d.price_snapshot,d.minimum_dp_amount_snapshot,
 d.guest_count,
 to_char(d.scheduled_check_in AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD HH24:MI') AS scheduled_in_wib,
 to_char(d.scheduled_check_out AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD HH24:MI') AS scheduled_out_wib,
 to_char(d.started_at AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD HH24:MI') AS actual_in_wib,
 to_char(d.checked_out_at AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD HH24:MI') AS actual_out_wib,
 coalesce(pay.payment_records,0) AS payment_records,
 coalesce(pay.total_paid,0) AS total_paid,
 coalesce(pay.no_cash_session,0) AS no_cash_session,
 coalesce(pay.distinct_payment_sessions,0) AS distinct_payment_sessions,
 coalesce(pay.payment_missing_operator,0) AS payments_without_operator,
 pay.payment_details,
 coalesce(h.events,0) AS hk_events,
 coalesce(h.cleaning_start_events,0) AS hk_cleaning_start,
 coalesce(c.checklist_records,0) AS hk_checklists,
 coalesce(rec.payment_receipts,0) AS receipt_snapshots,
 coalesce(rec.print_requests,0) AS print_requests,
 rec.receipt_copy_sequence,
 (SELECT count(*)::int FROM public.transactions x WHERE x.room_id=d.room_id AND x.status='check_in') AS active_checkins_in_room
FROM demo d
LEFT JOIN payments pay ON pay.transaction_id=d.id
LEFT JOIN housekeeping h ON h.transaction_id=d.id
LEFT JOIN checklists c ON c.transaction_id=d.id
LEFT JOIN receipts rec ON rec.transaction_id=d.id
ORDER BY d.created_at;
