#!/usr/bin/env bash
set -euo pipefail
# CI ONLY: synthetic fixture, never a real Baturaden 25 backup or user data.
# Requires docker service postgres:17 on localhost:5432.
export PGPASSWORD=postgres
PGURI='postgresql://postgres@localhost:5432/postgres'
RESTORE_URI='postgresql://postgres@localhost:5432/b25_whatsapp_restore_test'
readonly tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Existing fixture already executes the pending migration using synthetic auth users.
psql "$PGURI" -v ON_ERROR_STOP=1 -f scripts/whatsapp-template-postgres-fixture.sql \
  >"$tmp/fixture.log"
echo "PASS synthetic migration and access fixture"

# Docker service container postgres:17 supplies matching pg_dump/pg_restore 17,
# without installing a PostgreSQL server or exposing any real Cloud data.
container=$(docker ps --filter 'ancestor=postgres:17' --format '{{.ID}}' | head -n1)
if [[ -z "$container" ]]; then
  echo "FAIL: isolated postgres:17 service container missing" >&2; exit 1
fi
docker exec "$container" pg_dump -U postgres -d postgres -Fc \
  -n public -n auth -f /tmp/b25_synthetic_whatsapp.backup
docker exec "$container" createdb -U postgres b25_whatsapp_restore_test
# A new PostgreSQL DB already has an empty public schema; the dump owns its
# public schema definition. Remove it ONLY from the named synthetic test DB.
psql "$RESTORE_URI" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE'
docker exec "$container" pg_restore -U postgres -d b25_whatsapp_restore_test \
  --exit-on-error --no-owner --no-acl /tmp/b25_synthetic_whatsapp.backup
docker exec "$container" rm -f /tmp/b25_synthetic_whatsapp.backup

# Privileges deliberately excluded by --no-acl, so compare structural only;
# this does NOT establish full Supabase Auth/Storage/ACL recoverability.
psql "$RESTORE_URI" -v ON_ERROR_STOP=1 -At -c \
  "SELECT CASE WHEN
      (SELECT count(*) FROM public.whatsapp_template_versions) = 2
      AND (SELECT count(*) FROM public.whatsapp_template_audit) = 3
      AND (SELECT count(*) FROM public.whatsapp_template_versions WHERE status='ACTIVE') = 1
      AND to_regprocedure('public.owner_save_whatsapp_template(text,text)') IS NOT NULL
      AND to_regprocedure('public.read_active_whatsapp_template(text)') IS NOT NULL
      AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.whatsapp_template_versions'::regclass)
      THEN 'PASS synthetic isolated restore of version/audit/functions/RLS'
      ELSE 'FAIL synthetic restore mismatch' END" \
  | tee "$tmp/check.txt"
grep -q '^PASS synthetic isolated restore' "$tmp/check.txt"


# Two independent simulated Owner sessions race to save one kind.
# The advisory transaction lock must create sequential revision numbers
# without losing audit history or producing two ACTIVE versions.
for n in 3 4; do
  (
    psql "$RESTORE_URI" -X -v ON_ERROR_STOP=1 -c \
      "SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
       SELECT public.owner_save_whatsapp_template('PENAWARAN_RESERVASI', 'Simulasi revisi ${n}: [NAMA_TAMU]');" \
      >"$tmp/owner_${n}.log"
  ) &
done
wait
psql "$RESTORE_URI" -v ON_ERROR_STOP=1 -At -c \
  "SELECT CASE WHEN
    (SELECT count(*) FROM public.whatsapp_template_versions WHERE kind='PENAWARAN_RESERVASI')=4
    AND (SELECT count(*) FROM public.whatsapp_template_versions WHERE kind='PENAWARAN_RESERVASI' AND status='ACTIVE')=1
    AND (SELECT max(revision) FROM public.whatsapp_template_versions WHERE kind='PENAWARAN_RESERVASI')=4
    AND (SELECT count(*) FROM public.whatsapp_template_audit WHERE kind='PENAWARAN_RESERVASI')=7
    THEN 'PASS simultaneous Owner edits serialized with complete audit'
    ELSE 'FAIL concurrent Owner edit state' END" | tee "$tmp/concurrent.txt"
grep -q '^PASS simultaneous Owner edits' "$tmp/concurrent.txt"
