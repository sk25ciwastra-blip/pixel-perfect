#!/usr/bin/env bash
# Real two-connection row-lock tests, disposable PostgreSQL 17 ONLY.
set -euo pipefail
db="$(printenv B25_PG_CONTAINER || printf b25_checkout_race_native)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail() {
  echo "B25_RACE_FAIL: $*" >&2
  for f in "$tmp"/*.log; do
    if [[ -f "$f" ]]; then echo "=== $f ===" >&2; tail -n 35 "$f" >&2; fi
  done
  exit 1
}
probe() {
  docker exec "$db" psql -X -At -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$1" | tr -d '[:space:]'
}
await_state() {
  local app="$1" kind="$2" n i
  for ((i=0;i<120;i++)); do
    if [[ "$kind" == hold ]]; then
      n="$(probe "SELECT count(*) FROM pg_stat_activity WHERE application_name='$app' AND state='active' AND query LIKE '%pg_sleep%';")"
    else
      n="$(probe "SELECT count(*) FROM pg_stat_activity WHERE application_name='$app' AND wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid))>0;")"
    fi
    [[ "$n" == 1 ]] && return 0
    sleep 0.05
  done
  fail "$app never reached expected $kind state"
}
race() {
  local n="$1" holder_pid waiter_pid
  timeout 30s docker exec -i "$db" psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 \
      < "$tmp/$n-holder.sql" > "$tmp/$n-holder.log" 2>&1 &
  holder_pid=$!
  await_state "b25_hold_$n" hold
  timeout 30s docker exec -i "$db" psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 \
      < "$tmp/$n-waiter.sql" > "$tmp/$n-waiter.log" 2>&1 &
  waiter_pid=$!
  await_state "b25_wait_$n" wait
  echo "B25_RACE_$n: pg_blocking_pids confirmed real wait"
  wait "$holder_pid" || fail "$n holder error"
  wait "$waiter_pid" || fail "$n waiter error"
  grep -Fq "B25_HOLDER_$n_OK" "$tmp/$n-holder.log" || fail "$n holder marker missing"
  grep -Fq "B25_WAITER_$n_OK" "$tmp/$n-waiter.log" || fail "$n waiter marker missing"
  echo "B25_RACE_$n: PASS"
}

# Checkout locks the TRX; a later payment insert must wait and be denied.
cat > "$tmp/09-holder.sql" <<'SQL'
SET application_name='b25_hold_09';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
BEGIN;
SELECT public.check_out_transaction('20000000-0000-4000-8000-000000000009');
SELECT pg_sleep(5);
COMMIT;
\echo B25_HOLDER_09_OK
SQL
cat > "$tmp/09-waiter.sql" <<'SQL'
SET application_name='b25_wait_09';
DO $verify$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    INSERT INTO public.payments(transaction_id,amount,method)
    VALUES('20000000-0000-4000-8000-000000000009',1,'Cash');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Pembayaran tidak dapat diubah setelah transaksi ditutup atau dibatalkan' THEN
      denied:=true;
    ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Payment after checkout was allowed'; END IF;
END;
$verify$;
\echo B25_WAITER_09_OK
SQL

# Owner refund obtains TRX lock first; Checkout waits, recomputes, denies.
cat > "$tmp/10-holder.sql" <<'SQL'
SET application_name='b25_hold_10';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
BEGIN;
SELECT public.create_finance_refund(
 '50000000-0000-4000-8000-000000000010',
 '20000000-0000-4000-8000-000000000010',
 15000,'CASH','OWNER_FUNDS',NULL,'Synthetic refund-before-checkout race');
SELECT pg_sleep(5);
COMMIT;
\echo B25_HOLDER_10_OK
SQL
cat > "$tmp/10-waiter.sql" <<'SQL'
SET application_name='b25_wait_10';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
DO $verify$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.check_out_transaction('20000000-0000-4000-8000-000000000010');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Check-out ditolak: sisa settlement masih 15000' THEN
      denied:=true;
    ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Underpaid checkout after refund was allowed'; END IF;
END;
$verify$;
\echo B25_WAITER_10_OK
SQL

# Payment holds TRX lock first; Checkout waits and then succeeds at exact total.
cat > "$tmp/11-holder.sql" <<'SQL'
SET application_name='b25_hold_11';
BEGIN;
INSERT INTO public.payments(transaction_id,amount,method)
VALUES('20000000-0000-4000-8000-000000000011',30000,'Cash');
SELECT pg_sleep(5);
COMMIT;
\echo B25_HOLDER_11_OK
SQL
cat > "$tmp/11-waiter.sql" <<'SQL'
SET application_name='b25_wait_11';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
SELECT public.check_out_transaction('20000000-0000-4000-8000-000000000011');
\echo B25_WAITER_11_OK
SQL

# Checkout obtains lock first; actual Owner refund waits then succeeds after close.
cat > "$tmp/12-holder.sql" <<'SQL'
SET application_name='b25_hold_12';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
BEGIN;
SELECT public.check_out_transaction('20000000-0000-4000-8000-000000000012');
SELECT pg_sleep(5);
COMMIT;
\echo B25_HOLDER_12_OK
SQL
cat > "$tmp/12-waiter.sql" <<'SQL'
SET application_name='b25_wait_12';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
SELECT public.create_finance_refund(
 '50000000-0000-4000-8000-000000000012',
 '20000000-0000-4000-8000-000000000012',
 5000,'CASH','OWNER_FUNDS',NULL,'Synthetic post-checkout refund race');
\echo B25_WAITER_12_OK
SQL

race 09
race 10
race 11
race 12

# Independent connection: inspect all committed rows, audit and FINAL snapshot.
docker exec -i "$db" psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $verify$
DECLARE n integer; wanted_status text; wanted_room text; paid numeric; refunded numeric;
BEGIN
  FOR n IN 9..12 LOOP
    wanted_status:=CASE WHEN n=10 THEN 'check_in' ELSE 'check_out' END;
    wanted_room:=CASE WHEN n=10 THEN 'occupied' ELSE 'dirty' END;
    IF NOT EXISTS (
      SELECT 1 FROM public.transactions t JOIN public.rooms r ON r.id=t.room_id
      WHERE t.transaction_number='FIXTURE-RACE-'||n
        AND t.status::text=wanted_status AND r.status=wanted_room
    ) THEN RAISE EXCEPTION 'Race % wrong TRX/room status',n; END IF;
  END LOOP;

  SELECT COALESCE(SUM(amount),0) INTO paid FROM public.payments
    WHERE transaction_id='20000000-0000-4000-8000-000000000009';
  IF paid<>100000 THEN RAISE EXCEPTION 'Race 09 illegally modified payments'; END IF;

  SELECT COALESCE(SUM(amount),0) INTO refunded FROM public.finance_refunds
    WHERE transaction_id='20000000-0000-4000-8000-000000000010';
  IF refunded<>15000 THEN RAISE EXCEPTION 'Race 10 refund missing'; END IF;

  SELECT COALESCE(SUM(amount),0) INTO paid FROM public.payments
    WHERE transaction_id='20000000-0000-4000-8000-000000000011';
  IF paid<>100000 THEN RAISE EXCEPTION 'Race 11 payment lost'; END IF;

  SELECT COALESCE(SUM(amount),0) INTO refunded FROM public.finance_refunds
    WHERE transaction_id='20000000-0000-4000-8000-000000000012';
  IF refunded<>5000 THEN RAISE EXCEPTION 'Race 12 refund missing'; END IF;

  IF (SELECT COUNT(*) FROM public.activity_logs WHERE action='check_out'
       AND entity_id IN (
         '20000000-0000-4000-8000-000000000009',
         '20000000-0000-4000-8000-000000000010',
         '20000000-0000-4000-8000-000000000011',
         '20000000-0000-4000-8000-000000000012'))<>3 THEN
    RAISE EXCEPTION 'Race checkout audit not exactly 3'; END IF;

  IF (SELECT status FROM public.finance_cash_sessions
      WHERE id='30000000-0000-4000-8000-000000000001') <> 'FINAL'
     OR (SELECT closing_snapshot FROM public.finance_cash_sessions
      WHERE id='30000000-0000-4000-8000-000000000001')
      IS DISTINCT FROM '{"cash":"sealed-final","amount":1234}'::jsonb THEN
    RAISE EXCEPTION 'FINAL session modified by race'; END IF;
END;
$verify$;
\echo 'B25 TWO-CONNECTION RACES: 4/4 PASS, FINAL IMMUTABLE'
SQL
