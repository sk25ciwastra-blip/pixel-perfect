#!/usr/bin/env bash
# Two real PostgreSQL connections for each Booking race. Disposable only.
set -euo pipefail
db=b25_booking_races
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail() {
 echo "B25_BOOKING_RACE_FAIL: $*" >&2
 for f in "$tmp"/*.log; do if [[ -f "$f" ]]; then tail -n 30 "$f" >&2; fi; done
 exit 1
}
probe() {
 docker exec "$db" psql -X -At -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$1" | tr -d '[:space:]'
}
await_state() {
 local app="$1" stage="$2" n
 for i in {1..100}; do
   if [[ "$stage" == hold ]]; then
     n="$(probe "SELECT count(*) FROM pg_stat_activity WHERE application_name='$app' AND state='active' AND query LIKE '%pg_sleep%';")"
   else
     n="$(probe "SELECT count(*) FROM pg_stat_activity WHERE application_name='$app' AND wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid))>0;")"
   fi
   if [[ "$n" == 1 ]]; then return; fi
   sleep .05
 done
 fail "$app: no proven $stage transaction lock"
}
run_race() {
 local id="$1" holder waiter
 timeout 25s docker exec -i "$db" psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 < "$tmp/$id-holder.sql" > "$tmp/$id-holder.log" 2>&1 &
 holder=$!
 await_state "b25_book_1_hold" hold
 timeout 25s docker exec -i "$db" psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 < "$tmp/$id-waiter.sql" > "$tmp/$id-waiter.log" 2>&1 &
 waiter=$!
 await_state "b25_book_1_wait" wait
 echo "B25_BOOKING_RACE_$id: pg_blocking_pids confirms actual wait"
 wait "$holder" || fail "$id holder error"
 wait "$waiter" || fail "$id waiter error"
 grep -Fq "HOLDER_OK_$id" "$tmp/$id-holder.log" || fail "$id holder marker"
 grep -Fq "WAITER_OK_$id" "$tmp/$id-waiter.log" || fail "$id waiter marker"
 echo "B25_BOOKING_RACE_$id: PASS"
}

cat > "$tmp/cancel-holder.sql" <<'SQL'
SET application_name='b25_book_cancel_hold';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
BEGIN;
SELECT public.cancel_booking_owner('20000000-0000-4000-8000-000000000002',
 'FIXBOOK-2','Synthetic Owner concurrent cancellation reason',true);
SELECT pg_sleep(4);
COMMIT;
\echo HOLDER_OK_cancel
SQL
cat > "$tmp/cancel-waiter.sql" <<'SQL'
SET application_name='b25_book_cancel_wait';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
DO $test$
BEGIN
 IF public.cancel_booking_owner('20000000-0000-4000-8000-000000000002',
  'FIXBOOK-2','Synthetic Owner concurrent cancellation reason',true)<>'ALREADY_CANCELLED'
 THEN RAISE EXCEPTION 'Concurrent retry created second cancellation'; END IF;
END;
$test$;
\echo WAITER_OK_cancel
SQL

cat > "$tmp/checkin-holder.sql" <<'SQL'
SET application_name='b25_book_checkin_hold';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
BEGIN;
SELECT public.check_in_booking('20000000-0000-4000-8000-000000000003');
SELECT pg_sleep(4);
COMMIT;
\echo HOLDER_OK_checkin
SQL
cat > "$tmp/checkin-waiter.sql" <<'SQL'
SET application_name='b25_book_checkin_wait';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
DO $test$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
   PERFORM public.cancel_booking_owner(
    '20000000-0000-4000-8000-000000000003',
    'FIXBOOK-3','Synthetic cancellation after check-in race',true);
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='Hanya Booking yang belum Check-in dapat dibatalkan'
   THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Check-in/cancel race not blocked'; END IF;
END;
$test$;
\echo WAITER_OK_checkin
SQL

run_race cancel
run_race checkin

docker exec -i "$db" psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $verify$
BEGIN
 IF (SELECT status::text FROM public.transactions WHERE transaction_number='FIXBOOK-2')<>'cancelled'
 OR (SELECT status::text FROM public.transactions WHERE transaction_number='FIXBOOK-3')<>'check_in' THEN
   RAISE EXCEPTION 'Final race statuses wrong';
 END IF;
 IF (SELECT COUNT(*) FROM public.booking_owner_events
   WHERE transaction_id='20000000-0000-4000-8000-000000000002' AND action='cancel')<>1
 OR (SELECT COUNT(*) FROM public.activity_logs
   WHERE entity_id='20000000-0000-4000-8000-000000000002' AND action='booking_cancelled')<>1
 OR EXISTS(SELECT 1 FROM public.booking_owner_events
   WHERE transaction_id='20000000-0000-4000-8000-000000000003') THEN
   RAISE EXCEPTION 'Final race audits wrong';
 END IF;
 IF (SELECT COUNT(*) FROM public.payments)<>4
 OR (SELECT SUM(amount) FROM public.payments)<>190000 THEN
   RAISE EXCEPTION 'Race changed immutable payment ledger';
 END IF;
END;
$verify$;
\echo 'B25 BOOKING TWO-SESSION RACES: 2/2 PASS'
SQL
