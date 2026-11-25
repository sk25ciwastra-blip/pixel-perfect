#!/usr/bin/env bash
set -euo pipefail
# Runs ONLY with an ephemeral PostgreSQL 17 CI service and synthetic users.
# No real Cloud credentials, payments, guest data, or database backups.
export PGPASSWORD=postgres
host=localhost
user=postgres
db1=b25_ot_with_history_ci
db2=b25_ot_empty_ci
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

run_file() {
  psql -X -h "$host" -U "$user" -d "$1" -v ON_ERROR_STOP=1 -f "$2" >"$tmp/$(basename "$2").$1.log"
}
create_db() {
  createdb -h "$host" -U "$user" "$1"
  run_file "$1" scripts/whatsapp-overtime-rehearsal-bootstrap.sql
}

# Positive migration & role authorization with NEW overtime history.
create_db "$db1"
run_file "$db1" supabase/pending/20261126_whatsapp_overtime_notice_kind.sql
run_file "$db1" scripts/whatsapp-overtime-notice-roles.test.sql
echo "PASS: synthetic additive migration; Owner/Receptionist/HK/Training/anon role tests"

# Rollback MUST REFUSE if the new kind has any rows/audit history. This is
# deliberate; never DELETE historic templates merely to make rollback pass.
if psql -X -h "$host" -U "$user" -d "$db1" -v ON_ERROR_STOP=1 \
  -f supabase/pending/20261126_whatsapp_overtime_notice_rollback.sql \
  >"$tmp/rollback-blocked.log" 2>&1; then
  echo 'FAIL: rollback unexpectedly accepted when overtime template history exists' >&2
  exit 1
fi
grep -q 'STOP: overtime history exists' "$tmp/rollback-blocked.log"
check=$(
  psql -X -h "$host" -U "$user" -d "$db1" -At -v ON_ERROR_STOP=1 -c \
  "SELECT CASE WHEN
     (SELECT count(*) FROM public.whatsapp_template_versions
       WHERE kind='PEMBERITAHUAN_OVERTIME' AND status='ACTIVE')=1
     AND (SELECT count(*) FROM public.whatsapp_template_audit
       WHERE kind='PEMBERITAHUAN_OVERTIME')=1
     AND pg_get_functiondef('public.read_active_whatsapp_reminder_template(text)'::regprocedure)
       LIKE '%PEMBERITAHUAN_OVERTIME%'
   THEN 'PASS' ELSE 'FAIL' END"
)
[[ "$check" == 'PASS' ]]
echo "PASS: rollback with ACTIVE/audit history refuses and preserves all data"

# Clean rollback scenario: an old active reminder exists, but no overtime
# versions have ever been saved. Reversal must preserve the old kind and audit.
create_db "$db2"
psql -X -h "$host" -U "$user" -d "$db2" -v ON_ERROR_STOP=1 \
  >"$tmp/seed-old-kind.log" <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
SELECT public.owner_save_whatsapp_reminder_template(
  'PENGINGAT_WAKTU_HABIS', 'Halo [NAMA_TAMU]'
);
RESET ROLE;
SQL
run_file "$db2" supabase/pending/20261126_whatsapp_overtime_notice_kind.sql
run_file "$db2" supabase/pending/20261126_whatsapp_overtime_notice_rollback.sql
restored=$(
  psql -X -h "$host" -U "$user" -d "$db2" -At -v ON_ERROR_STOP=1 -c \
  "SELECT CASE WHEN
      (SELECT count(*) FROM public.whatsapp_template_versions
       WHERE kind='PENGINGAT_WAKTU_HABIS' AND status='ACTIVE')=1
      AND (SELECT count(*) FROM public.whatsapp_template_audit
       WHERE kind='PENGINGAT_WAKTU_HABIS' AND action='CREATE')=1
      AND pg_get_constraintdef(oid) NOT LIKE '%PEMBERITAHUAN_OVERTIME%'
      AND pg_get_functiondef('public.owner_save_whatsapp_reminder_template(text,text)'::regprocedure)
          NOT LIKE '%PEMBERITAHUAN_OVERTIME%'
      AND pg_get_functiondef('public.read_active_whatsapp_reminder_template(text)'::regprocedure)
          NOT LIKE '%PEMBERITAHUAN_OVERTIME%'
    THEN 'PASS' ELSE 'FAIL' END
    FROM pg_constraint
    WHERE conrelid='public.whatsapp_template_versions'::regclass
       AND conname='whatsapp_template_versions_kind_check'"
)
[[ "$restored" == 'PASS' ]]
echo "PASS: empty-kind rollback restores old constraints/RPCs, keeps reminder ACTIVE/audit"

# We do not test real Supabase Cloud recovery. Only isolated migration scope
# was rehearsed; actual LIVE backup/restore and UAT remain release gates.
