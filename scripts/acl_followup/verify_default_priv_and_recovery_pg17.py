#!/usr/bin/env python3
"""B25: isolated PostgreSQL 17 default-privileges + ACL recovery demonstration.

Safe boundary: GitHub-hosted disposable database ONLY. Not a Supabase restore.
No user data, credentials, Cloud URLs, or write operations outside local dummy.
"""
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
FIXTURE = ROOT.parent / "acl" / "isolated_live39_fixture.sql"
CANDIDATE = ROOT.parent / "acl" / "revoke_33_review_only.sql"
DB = "b25_acl_dummy"
BRANCH = "validation/b25-acl-pg17-isolated-20261121"
CANDIDATE_SHA256 = "a2dde2c93c6fcae9555f6aabd41fb27ddd8ec7acf73b20132239ff184798b0fd"
LIVE_DEFAULT_HASH = "bed16621c84278837e08965943391d9b"
LIVE_TABLE_HASH = "b992406a39a1ca0142e56b017e45809b"
TARGETS = (
 "activity_logs","employee_profiles","employees","finance_bank_accounts",
 "finance_cash_sessions","finance_charge_events","finance_commission_configs",
 "finance_deposits","finance_drawer_handoffs","finance_expenses",
 "finance_payment_batch_idempotency","finance_refund_allocations","finance_refunds",
 "finance_reservation_idempotency","finance_session_allocations","finance_settings",
 "finance_training_assignments","finance_training_audit","guests","housekeeping_jobs",
 "housekeeping_maintenance","housekeeping_transaction_resolutions","operational_announcements",
 "operational_calendar","package_price_history","package_room_type_prices","packages",
 "payment_receipts","payments","receipt_print_requests","receipt_template_versions",
 "room_types","user_roles",
)
TARGET_COUNT = len(TARGETS)
SIX = ("finance_expense_options","guest_notes","housekeeping_checklists",
       "housekeeping_history","rooms","transactions")

def require(test, reason):
    if not test:
        raise RuntimeError("STOP: " + reason)

def psql(text, *, file=False):
    cmd = ["psql","-X","-w","-v","ON_ERROR_STOP=1"]
    cmd += ["-f",str(text)] if file else ["-A","-t","-c",str(text)]
    r = subprocess.run(cmd,text=True,capture_output=True,env=os.environ.copy(),timeout=60)
    require(r.returncode==0, "SQL failed: " + (r.stderr or r.stdout)[-1400:])
    return r.stdout.strip()

def scalar(sql):
    return psql(sql).splitlines()[-1].strip()

def count_acl():
    return scalar("""SELECT count(*)::text || '|' ||
count(*) FILTER (WHERE has_table_privilege('anon',c.oid,'TRUNCATE')
OR has_table_privilege('authenticated',c.oid,'TRUNCATE'))::text
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p');""")

def normalized_table_acl():
    # Normalize aclitems; raw relacl array order can differ after a GRANT
    # while effective privileges are identical.
    return scalar("""SELECT md5(string_agg(
 c.relname || '|' || coalesce(grantee.rolname,'PUBLIC') || '|' ||
 grantor.rolname || '|' || a.privilege_type || '|' || a.is_grantable::text,
 E'\\n' ORDER BY c.relname,grantee.rolname NULLS FIRST,grantor.rolname,
 a.privilege_type,a.is_grantable::text))
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN LATERAL aclexplode(c.relacl) a
 LEFT JOIN pg_roles grantee ON grantee.oid=a.grantee
 JOIN pg_roles grantor ON grantor.oid=a.grantor
 WHERE n.nspname='public' AND c.relkind IN ('r','p');""")

def default_acl():
    return scalar("""SELECT md5(string_agg(pg_get_userbyid(d.defaclrole)||'|'||
d.defaclacl::text, E'\\n' ORDER BY pg_get_userbyid(d.defaclrole)))
FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace
WHERE n.nspname='public' AND d.defaclobjtype='r'
AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin');""")

def six_acl():
    names = "','".join(SIX)
    return scalar("""SELECT md5(string_agg(c.relname||'|'||coalesce(c.relacl::text,''),
E'\\n' ORDER BY c.relname))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('""" + names + """');""")

def target_names():
    return scalar("""SELECT coalesce(string_agg(c.relname, ',' ORDER BY c.relname),'')
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p')
AND (has_table_privilege('anon',c.oid,'TRUNCATE')
OR has_table_privilege('authenticated',c.oid,'TRUNCATE'));""")

def run():
    for k,v in {"GITHUB_ACTIONS":"true","GITHUB_REF_NAME":BRANCH,
                "B25_DUMMY_ONLY":"true","PGHOST":"127.0.0.1",
                "PGPORT":"55439","PGUSER":"postgres","PGDATABASE":DB}.items():
        require(os.environ.get(k)==v, "isolation environment guard mismatch: "+k)
    dbident = scalar("""SELECT current_database()||'|'||
 host(inet_server_addr())||'|'||inet_server_port()||'|'||
 current_setting('server_version_num')||'|'||current_user""").split("|")
    require(len(dbident)==5 and dbident[0]==DB and dbident[2]=="5432" and
        dbident[3].startswith("17") and dbident[4]=="postgres" and
        ipaddress.ip_address(dbident[1]).is_private,
        "not the disposable PG17 Docker database: "+str(dbident))
    require(scalar("""SELECT count(*) FROM pg_class c JOIN pg_namespace n
        ON n.oid=c.relnamespace WHERE n.nspname='public'
        AND c.relkind IN ('r','p')""")=="0", "database not empty")
    require(scalar("""SELECT count(*) FROM pg_roles WHERE rolname IN
        ('anon','authenticated','service_role','sandbox_exec','supabase_admin')""")=="0",
        "dummy roles not pristine")
    require(len(TARGETS)==33 and len(set(TARGETS))==33,"wrong target list")
    print("PASS: fresh PostgreSQL 17 dummy identity, no Cloud connection",flush=True)

    require(hashlib.sha256(CANDIDATE.read_bytes()).hexdigest()==CANDIDATE_SHA256,
            "reviewed candidate file integrity mismatch")
    reviewed=CANDIDATE.read_text(encoding="utf-8")
    require(reviewed.count(LIVE_DEFAULT_HASH)==1 and reviewed.count(LIVE_TABLE_HASH)==1
            and reviewed.count("COMMIT;")==1,
            "reviewed candidate guards changed")
    psql(FIXTURE,file=True)
    require(count_acl()=="39|33", "fixture lacks 39/33 tables")
    require(set(target_names().split(","))==set(TARGETS),
            "target names drift")
    original_acl=normalized_table_acl()
    original_default=default_acl()
    original_six=six_acl()
    require(original_default != "" and original_acl != "", "empty baseline fingerprint")
    print("PASS: isolated 39-table baseline and 33 historic targets",flush=True)

    # The production default ACL fingerprint is intentionally NOT replaced in
    # the reviewed candidate. Only a temporary copy may use dummy's fingerprint.
    local_sql = reviewed.replace(LIVE_DEFAULT_HASH,original_default)
    require(local_sql.replace(original_default,LIVE_DEFAULT_HASH,1)==reviewed,
            "dummy-only guard substitution is not reversible")

    # Grant CREATE only within disposable database so our mock Supabase-owned
    # role can actually create a table. Never change role grants in Cloud.
    psql("GRANT CREATE ON SCHEMA public TO supabase_admin;")

    # Demonstrate both configured owner default privileges yield unsafe
    # TRUNCATE on a fresh table *before* a targeted REVOKE. Roll back the table.
    for creator in ("postgres","supabase_admin"):
        tbl="b25_unsafe_"+creator
        set_role = "SET LOCAL ROLE supabase_admin;" if creator=="supabase_admin" else ""
        tx = f"""BEGIN;
{set_role}
CREATE TABLE public.{tbl}(id integer);
DO $check$ BEGIN
  IF NOT (has_table_privilege('anon','public.{tbl}','TRUNCATE') AND
          has_table_privilege('authenticated','public.{tbl}','TRUNCATE')) THEN
    RAISE EXCEPTION 'Expected unsafe inherited default GRANT not present';
  END IF;
END $check$;
ROLLBACK;"""
        psql(tx)
        require(scalar("SELECT to_regclass('public."+tbl+"') IS NULL")=="t",
                "unsafe example table persisted after rollback")
    print("PASS: both default-privilege creators give TRUNCATE to new tables; unsafe examples rolled back",flush=True)

    # Reproduce migration-local mitigation. CREATE + REVOKE in ONE transaction,
    # so a future exposed table is not committed with TRUNCATE permission.
    for creator in ("postgres","supabase_admin"):
        tbl="b25_safe_"+creator
        set_role = "SET LOCAL ROLE supabase_admin;" if creator=="supabase_admin" else ""
        psql(f"""BEGIN;
{set_role}
CREATE TABLE public.{tbl}(id integer);
REVOKE TRUNCATE ON TABLE public.{tbl} FROM anon, authenticated;
DO $check$ BEGIN
  IF has_table_privilege('anon','public.{tbl}','TRUNCATE') OR
     has_table_privilege('authenticated','public.{tbl}','TRUNCATE') THEN
    RAISE EXCEPTION 'Unsafe privilege still present after REVOKE';
  END IF;
  IF NOT has_table_privilege('anon','public.{tbl}','SELECT') OR
     NOT has_table_privilege('authenticated','public.{tbl}','SELECT') THEN
    RAISE EXCEPTION 'Unexpected change to non-TRUNCATE SELECT rights';
  END IF;
END $check$;
COMMIT;""")
        require(scalar("SELECT to_regclass('public."+tbl+"') IS NOT NULL")=="t",
                "safe table not committed")
        require(scalar(f"""SELECT NOT has_table_privilege('anon','public.{tbl}','TRUNCATE')
  AND NOT has_table_privilege('authenticated','public.{tbl}','TRUNCATE')""")=="t",
                "unsafe committed new table")
    require(default_acl()==original_default, "new-table mitigation accidentally changed default grants")
    psql("DROP TABLE public.b25_safe_postgres,public.b25_safe_supabase_admin;")
    require(count_acl()=="39|33" and normalized_table_acl()==original_acl,
            "new-table test altered existing table ACLs")
    print("PASS: one-transaction CREATE + REVOKE gives safe committed tables for both creators",flush=True)

    # Separate from earlier tests of failures BEFORE COMMIT: demonstrate
    # post-COMMIT ACL restoration on dummy, NOT a production rollback policy.
    with tempfile.TemporaryDirectory(prefix="b25_acl_recovery_") as path:
        temp=Path(path)/"locally-adapted-dummy-only.sql"
        temp.write_text(local_sql,encoding="utf-8")
        psql(temp,file=True)
    require(count_acl()=="39|0","cannot start recovery from fully revoked dummy")
    require(normalized_table_acl()!=original_acl,"committed REVOKE unexpectedly left ACL unchanged")
    require(six_acl()==original_six and default_acl()==original_default,
            "unexpected changes after REVOKE")

    # All original direct TRUNCATE grants are from postgres and not GRANTABLE.
    # This is a simulation of targeted metadata recovery, not a recommendation
    # to restore unsafe privileges on LIVE without a separate Owner decision.
    target_sql=",\n".join("public."+t for t in TARGETS)
    psql("BEGIN;\nGRANT TRUNCATE ON TABLE "+target_sql+
         " TO anon, authenticated;\nCOMMIT;")
    require(count_acl()=="39|33","post-commit ACL restoration counts differ")
    require(normalized_table_acl()==original_acl,
            "post-commit ACL recovery semantic normalized fingerprint differs")
    require(six_acl()==original_six, "six non-target tables changed during recovery")
    require(default_acl()==original_default, "default ACL changed during recovery")
    print("PASS: post-COMMIT recovery rehearsal restored normalized privileges for all 39 dummy tables",flush=True)

    result={
        "result":"PASS_FOCUSED_DEFAULT_PRIV_AND_ACL_RECOVERY",
        "postgres_major":17,"dummy_database":DB,"historical_tables":39,
        "target_tables":33,"creators_tested":["postgres","supabase_admin"],
        "unsafe_future_table_default_grants":"CONFIRMED_FOR_BOTH_CREATORS",
        "migration_local_create_revoke_atomic":"PASS_FOR_BOTH_CREATORS",
        "old_defaults_unmodified":"PASS",
        "post_commit_acl_metadata_restoration":"PASS_IN_DUMMY_ONLY",
        "non_target_six_restored":"PASS",
        "candidate_sha256":CANDIDATE_SHA256,
        "historical_live_default_acl_hash":LIVE_DEFAULT_HASH,
        "dummy_default_acl_hash":original_default,
        "live_or_staging_modified":False,
        "full_supabase_restore":"NOT_TESTED",
        "auth_storage":"NOT_TESTED",
        "application_behavior":"NOT_TESTED",
        "cloud_activation":"NO_GO",
        "timestamp_utc":datetime.now(timezone.utc).isoformat()
    }
    print("B25_FOCUSED_EVIDENCE "+json.dumps(result,sort_keys=True),flush=True)
    print("RESULT: PASS FOCUSED DEFAULT ACL AND RECOVERY (ISOLATED ONLY) — CLOUD NO-GO",flush=True)

if __name__=="__main__":
    try: run()
    except Exception as e:
        print("RESULT: BLOCKED/FAIL — "+str(e),file=sys.stderr,flush=True)
        sys.exit(1)
