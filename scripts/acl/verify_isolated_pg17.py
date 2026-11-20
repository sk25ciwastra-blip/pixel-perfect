#!/usr/bin/env python3
"""Baturaden 25 Homestay: ISOLATED PG17 ACL fixture test. No Cloud or live data."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
FIXTURE = ROOT / "isolated_live39_fixture.sql"
CANDIDATE = ROOT / "revoke_33_review_only.sql"
DB = "b25_acl_dummy"
OLD_TABLE_HASH = "b992406a39a1ca0142e56b017e45809b"
OLD_DEFAULT_HASH = "bed16621c84278837e08965943391d9b"
CANDIDATE_SHA256 = "a2dde2c93c6fcae9555f6aabd41fb27ddd8ec7acf73b20132239ff184798b0fd"
BRANCH = "validation/b25-acl-pg17-isolated-20261121"

EXPECTED_TARGETS = {
    "activity_logs", "employee_profiles", "employees", "finance_bank_accounts",
    "finance_cash_sessions", "finance_charge_events", "finance_commission_configs",
    "finance_deposits", "finance_drawer_handoffs", "finance_expenses",
    "finance_payment_batch_idempotency", "finance_refund_allocations",
    "finance_refunds", "finance_reservation_idempotency", "finance_session_allocations",
    "finance_settings", "finance_training_assignments", "finance_training_audit",
    "guests", "housekeeping_jobs", "housekeeping_maintenance",
    "housekeeping_transaction_resolutions", "operational_announcements",
    "operational_calendar", "package_price_history", "package_room_type_prices",
    "packages", "payment_receipts", "payments", "receipt_print_requests",
    "receipt_template_versions", "room_types", "user_roles",
}

def stop(message):
    raise RuntimeError("STOP: " + str(message))

def sql_file(path, *, expect_error=None):
    run = subprocess.run(
        ["psql", "-X", "-w", "-v", "ON_ERROR_STOP=1", "-f", str(path)],
        capture_output=True, text=True, env=os.environ.copy(), timeout=50,
    )
    out = (run.stdout or "") + (run.stderr or "")
    if expect_error:
        if run.returncode == 0 or expect_error not in out:
            stop("Expected SQL failure marker was absent; status=" + str(run.returncode) + " tail=" + out[-1000:])
    elif run.returncode != 0:
        stop("Unexpected SQL failure; status=" + str(run.returncode) + " tail=" + out[-1400:])
    return out

def query(sql):
    run = subprocess.run(
        ["psql", "-X", "-w", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-c", sql],
        capture_output=True, text=True, env=os.environ.copy(), timeout=30,
    )
    if run.returncode:
        stop("Read-only query failed: " + (run.stderr or run.stdout)[-1000:])
    return run.stdout.strip()

COUNTS_SQL = """SELECT count(*)::text || '|' ||
count(*) FILTER (WHERE has_table_privilege('anon',c.oid,'TRUNCATE') OR
 has_table_privilege('authenticated',c.oid,'TRUNCATE'))::text
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p');"""

TARGET_SQL = """WITH target AS (
 SELECT c.relname, c.relacl, c.relowner, c.relrowsecurity
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p')
 AND (has_table_privilege('anon',c.oid,'TRUNCATE') OR
      has_table_privilege('authenticated',c.oid,'TRUNCATE'))
)
SELECT count(*)::text || '|' || coalesce(md5(string_agg(
 relname||'|'||coalesce(relacl::text,'')||'|'||pg_get_userbyid(relowner)
 ||'|'||relrowsecurity::text, E'\\n' ORDER BY relname)),'<none>')
FROM target;"""

DEFAULT_SQL = """SELECT md5(string_agg(pg_get_userbyid(d.defaclrole)||'|'||d.defaclacl::text,
 E'\\n' ORDER BY pg_get_userbyid(d.defaclrole)))
FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace
WHERE n.nspname='public' AND d.defaclobjtype='r'
AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin');"""

MATRIX_SQL = """WITH maker AS (
 SELECT pg_get_userbyid(d.defaclrole) AS maker, d.defaclacl
 FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace
 WHERE n.nspname='public' AND d.defaclobjtype='r'
 AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin')
), grants AS (
 SELECT m.maker, a.privilege_type, r.rolname AS recipient
 FROM maker m CROSS JOIN LATERAL aclexplode(m.defaclacl) a
 JOIN pg_roles r ON r.oid=a.grantee
 WHERE r.rolname IN ('anon','authenticated')
)
SELECT (SELECT count(*) FROM maker)::text||'|'||
       (SELECT count(*) FROM grants WHERE privilege_type='TRUNCATE')::text||'|'||
       (SELECT count(*) FROM grants)::text;"""

TARGET_NAMES_SQL = """SELECT string_agg(c.relname::text, ',' ORDER BY c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p')
AND (has_table_privilege('anon',c.oid,'TRUNCATE')
 OR has_table_privilege('authenticated',c.oid,'TRUNCATE'));"""

ALL_ACL_SQL = """SELECT md5(string_agg(c.relname||'|'||coalesce(c.relacl::text,'')||'|'||
pg_get_userbyid(c.relowner)||'|'||c.relrowsecurity::text,
E'\\n' ORDER BY c.relname))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p');"""

NON_TRUNCATE_SQL = """SELECT coalesce(md5(string_agg(
c.relname||'|'||r.rolname||'|'||z.privilege_type,
E'\\n' ORDER BY c.relname,r.rolname,z.privilege_type)),'<none>')
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN LATERAL aclexplode(c.relacl) z
JOIN pg_roles r ON r.oid=z.grantee
WHERE n.nspname='public' AND c.relkind IN ('r','p')
 AND r.rolname IN ('anon','authenticated') AND z.privilege_type <> 'TRUNCATE';"""

OTHER_TARGETS_SQL = """SELECT md5(string_agg(c.relname||'|'||coalesce(c.relacl::text,''),
E'\\n' ORDER BY c.relname))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p')
 AND NOT (has_table_privilege('anon',c.oid,'TRUNCATE')
 OR has_table_privilege('authenticated',c.oid,'TRUNCATE'));"""

# Expected from same fixture before and after; after commit all tables lack TRUNCATE,
# so use the actual six known unaffected tables for the comparison.
UNTOUCHED_SQL = """SELECT md5(string_agg(c.relname||'|'||coalesce(c.relacl::text,''),
E'\\n' ORDER BY c.relname))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
('finance_expense_options','guest_notes','housekeeping_checklists',
'housekeeping_history','rooms','transactions');"""

def snapshot():
    return {
        "counts": query(COUNTS_SQL),
        "all_acl": query(ALL_ACL_SQL),
        "target": query(TARGET_SQL),
        "default": query(DEFAULT_SQL),
        "non_truncate": query(NON_TRUNCATE_SQL),
        "untouched_six": query(UNTOUCHED_SQL),
    }

def run():
    for name, expected in {
        "GITHUB_ACTIONS":"true", "GITHUB_REF_NAME":BRANCH,
        "PGHOST":"127.0.0.1", "PGPORT":"55439", "PGUSER":"postgres",
        "PGDATABASE":DB, "B25_DUMMY_ONLY":"true"
    }.items():
        if os.environ.get(name) != expected:
            stop(name + " environment did not match isolated CI allowlist")
    ident = query("""SELECT current_database()||'|'||host(inet_server_addr())||'|'||
  inet_server_port()||'|'||current_setting('server_version_num')||'|'||current_user""")
    parts = ident.split("|")
    if len(parts)!=5 or parts[0]!=DB or parts[1]!="127.0.0.1" or parts[2]!="55439" or not parts[3].startswith("17") or parts[4]!="postgres":
        stop("Database identity or PG17 major version failed: " + ident)
    print("PASS: isolated GitHub-hosted PostgreSQL 17 service at 127.0.0.1:55439 / dummy database",flush=True)

    if query("""SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                 WHERE n.nspname='public' AND c.relkind IN ('r','p')""")!="0":
        stop("Dummy service is not pristine")
    if query("""SELECT count(*) FROM pg_roles WHERE rolname IN
      ('anon','authenticated','service_role','sandbox_exec','supabase_admin')""")!="0":
        stop("Dummy fixture roles already exist")

    bytes_candidate=CANDIDATE.read_bytes()
    sha=hashlib.sha256(bytes_candidate).hexdigest()
    if sha!=CANDIDATE_SHA256:
        stop("Reviewed candidate sha256 mismatch: "+sha)
    original=bytes_candidate.decode("utf-8")
    if original.count("COMMIT;")!=1 or original.count(OLD_DEFAULT_HASH)!=1 or original.count(OLD_TABLE_HASH)!=1:
        stop("Reviewed candidate SQL unexpectedly changed")
    sql_file(FIXTURE)
    before=snapshot()
    names=set((query(TARGET_NAMES_SQL) or "").split(","))
    if before["counts"]!="39|33" or before["target"]!="33|"+OLD_TABLE_HASH or names!=EXPECTED_TARGETS:
        stop("Historical 33-table LIVE ACL fingerprint, names or counts did not match dummy fixture: "+str(before))
    if query(MATRIX_SQL)!="2|4|32" or not before["default"]:
        stop("Dummy default ACL grants mismatch; no fingerprint adaptation permitted")
    print("PASS: 39 dummy tables; 33 targeted table ACLs match historical LIVE fingerprint",flush=True)

    dummy_default=before["default"]
    # The Supabase default-ACL fingerprint differs from plain Postgres fixture:
    # ONLY replace the single guard literal in ephemeral SQL used on this dummy.
    local_only=original.replace(OLD_DEFAULT_HASH,dummy_default)
    if local_only==original and dummy_default!=OLD_DEFAULT_HASH:
        stop("Cannot adapt dummy-only default ACL guard")
    if local_only.replace(dummy_default,OLD_DEFAULT_HASH,1)!=original:
        stop("Guard adaptation changed more than one literal")
    with tempfile.TemporaryDirectory(prefix="b25-acl-ci-dummy-") as d:
        file=Path(d)/"candidate-dummy-only.sql"
        file.write_text(local_only,encoding="utf-8")

        # Fail-closed negative guard: a deliberately invalid table fingerprint.
        bad=local_only.replace(OLD_TABLE_HASH,"0"*32)
        if bad==local_only: stop("No hash to mutate for negative test")
        file.write_text(bad,encoding="utf-8")
        sql_file(file,expect_error="STOP: public table TRUNCATE/ACL baseline drift")
        if snapshot()!=before: stop("Baseline guard negative test mutated dummy")
        print("PASS: bad fingerprint fails BEFORE REVOKE; dummy ACL unchanged",flush=True)

        # Deliberate post-REVOKE / pre-COMMIT failure verifies transactional rollback.
        marker = """DO $b25_forced$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p')
     AND (has_table_privilege('anon',c.oid,'TRUNCATE')
       OR has_table_privilege('authenticated',c.oid,'TRUNCATE'))) THEN
   RAISE EXCEPTION 'B25_TEST_REVOKES_NOT_PERFORMED';
 END IF;
 RAISE EXCEPTION 'B25_FORCED_PRECOMMIT_ABORT';
END;
$b25_forced$;
COMMIT;"""
        forced=local_only.replace("COMMIT;",marker)
        file.write_text(forced,encoding="utf-8")
        sql_file(file,expect_error="B25_FORCED_PRECOMMIT_ABORT")
        if snapshot()!=before: stop("Forced pre-COMMIT rollback did not restore all ACL snapshots")
        print("PASS: forced failure AFTER REVOKE rolled back; all ACL/default hashes unchanged",flush=True)

        # Commit the review candidate (ONLY a local adapted copy; never original Cloud SQL).
        file.write_text(local_only,encoding="utf-8")
        sql_file(file)
        after=snapshot()
        if after["counts"]!="39|0":
            stop("Postcheck: anon/authenticated still have TRUNCATE on dummy tables: "+after["counts"])
        if after["default"]!=before["default"] or after["non_truncate"]!=before["non_truncate"] or after["untouched_six"]!=before["untouched_six"]:
            stop("Postcheck: other rights, 6 untouched tables, or default ACL changed")
        print("PASS: committed 33 dummy-only REVOKEs; 0/39 retain API TRUNCATE, other rights unchanged",flush=True)

    outcome={
        "result":"PASS_ISOLATED_ACL_ONLY", "postgres_major":17, "db":DB,
        "tables":39, "targets":33, "historical_live_target_md5":OLD_TABLE_HASH,
        "dummy_default_acl_md5":dummy_default,
        "default_acl_guard_adapted_in_ephemeral_dummy_only_sql":dummy_default!=OLD_DEFAULT_HASH,
        "review_candidate_sha256":sha,
        "negative_drift_test":"PASS", "rollback_after_revoke":"PASS",
        "committed_dummy_revoke":"PASS", "non_truncate_acl_unchanged":"PASS",
        "non_target_six_unchanged":"PASS", "default_acl_unchanged":"PASS",
        "full_restore":"NOT_TESTED", "auth_storage":"NOT_TESTED",
        "cloud":"NO_GO",
        "at_utc":datetime.now(timezone.utc).isoformat(),
    }
    print("B25_EVIDENCE_JSON "+json.dumps(outcome,sort_keys=True),flush=True)
    print("RESULT: PASS ISOLATED ACL ONLY; CLOUD REMAINS NO-GO",flush=True)

if __name__=="__main__":
    try: run()
    except Exception as exc:
        print("RESULT: BLOCKED/FAIL — "+str(exc),file=sys.stderr,flush=True)
        sys.exit(1)
