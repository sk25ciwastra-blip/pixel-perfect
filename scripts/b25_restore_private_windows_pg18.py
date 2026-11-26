#!/usr/bin/env python3
"""Baturaden 25 Homestay: private Windows-only PostgreSQL 18 restore rehearsal.

This tool NEVER connects to a Cloud database. All SQL targets a brand-new
ephemeral PostgreSQL instance listening ONLY on 127.0.0.1 with random SCRAM
credentials. It never uploads any backup, data, or restore logs to GitHub.

INSPECT: verifies a ZIP, PGDMP magic, PG18 TOC, and LIVE table-name manifest.
RESTORE: additionally restores into a disposable localhost database and
compares public metadata. Uses --no-owner --no-acl: Auth login, Storage files
and exact role/ACL recovery remain UNPROVEN even after a successful run.

This tool does not export a backup. The Owner must obtain a NEW private export
that includes the latest LIVE schema; a 25 Nov export is known to be incomplete.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import zipfile

BINARIES = ("pg_restore.exe", "initdb.exe", "pg_ctl.exe", "createdb.exe", "psql.exe")
MAX_BACKUP_BYTES = 512 * 1024 * 1024
TABLE_RE = re.compile(r"^\s*\d+;\s+\d+\s+\d+\s+TABLE\s+public\s+([a-zA-Z_][a-zA-Z0-9_]*)\s", re.M)
NAME_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
# A custom dump may NOT contain CREATE SCHEMA public. In that case,
# preserve the default public schema of the brand-new local database.
PUBLIC_SCHEMA_TOC_RE = re.compile(
    r"^\s*\d+;\s+\d+\s+\d+\s+SCHEMA\s+-\s+public(?:\s|$)", re.M
)

CATALOG_SQL = {
    "public_tables": "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')",
    "public_functions": "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'",
    "public_rls_tables": "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity",
    "public_policies": "SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'",
    "public_indexes": "SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'",
    "public_triggers": "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal",
    "public_fks": "SELECT count(*) FROM pg_constraint c WHERE c.connamespace='public'::regnamespace AND c.contype='f'",
}
TABLE_NAMES_SQL = """SELECT coalesce(json_agg(t.relname ORDER BY t.relname), '[]'::json)::text
FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace
WHERE n.nspname='public' AND t.relkind IN ('r','p')"""


class RestoreGateError(Exception):
    def __init__(self, code: str, diagnostic_category: str | None = None):
        super().__init__(code)
        self.diagnostic_category = diagnostic_category


def classify_private_restore_error(log: Path) -> str:
    """Classify pg_restore errors without ever exposing SQL, row values or PII.

    Raw stderr exists ONLY in the runner's automatically deleted temp folder.
    Diagnostic categories are constant strings safe to share with the Owner.
    """
    try:
        tail = log.read_bytes()[-256 * 1024:].decode("utf-8", "replace")
    except OSError:
        return "ERROR_LOG_UNAVAILABLE"
    errors = [
        line.casefold() for line in tail.splitlines()
        if re.search(r"(?i)(?:pg_restore:\s*error:|\berror:|\bfatal:)", line)
        and "aborting because of errors" not in line.casefold()
    ]
    if not errors:
        return "NO_POSTGRES_ERROR_LINE_FOUND"
    combined = "\n".join(errors)
    if 'schema "public" does not exist' in combined:
        return "MISSING_PUBLIC_SCHEMA"
    if 'schema "auth" does not exist' in combined or "function auth." in combined:
        return "MISSING_SUPABASE_AUTH_DEPENDENCY"
    if 'schema "storage" does not exist' in combined or "function storage." in combined:
        return "MISSING_SUPABASE_STORAGE_DEPENDENCY"
    if 'schema "extensions" does not exist' in combined:
        return "MISSING_SUPABASE_EXTENSIONS_SCHEMA"
    if 'role "' in combined and 'does not exist' in combined:
        return "MISSING_DATABASE_ROLE"
    if 'extension "' in combined and ('not available' in combined or 'does not exist' in combined):
        return "MISSING_POSTGRES_EXTENSION"
    if "permission denied" in combined or "must be owner of" in combined:
        return "PERMISSIONS_OR_ROLE_RESTRICTION"
    if "could not open extension control file" in combined:
        return "MISSING_POSTGRES_EXTENSION"
    if "function " in combined and "does not exist" in combined:
        return "MISSING_EXTERNAL_FUNCTION"
    if "relation " in combined and "does not exist" in combined:
        return "MISSING_EXTERNAL_RELATION"
    if "schema " in combined and "does not exist" in combined:
        return "MISSING_OTHER_SCHEMA"
    if "violates foreign key constraint" in combined or "duplicate key value" in combined:
        return "DATA_CONSTRAINT_FAILURE"
    if "invalid input syntax" in combined or "extra data after last expected column" in combined:
        return "DATA_FORMAT_FAILURE"
    if "syntax error" in combined:
        return "SQL_SYNTAX_INCOMPATIBILITY"
    if "already exists" in combined:
        return "OBJECT_ALREADY_EXISTS"
    return "UNCLASSIFIED_POSTGRES_RESTORE_ERROR"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        while chunk := file.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def read_manifest(path: Path) -> dict:
    obj = json.loads(path.read_text(encoding="utf-8"))
    names = obj.get("public_tables")
    counts = obj.get("counts")
    if not isinstance(names, list) or not names or not all(
        isinstance(n, str) and NAME_RE.fullmatch(n) for n in names
    ) or names != sorted(set(names)):
        raise RestoreGateError("INVALID_LIVE_TABLE_MANIFEST")
    if not isinstance(counts, dict) or set(counts) != set(CATALOG_SQL):
        raise RestoreGateError("INVALID_LIVE_CATALOG_MANIFEST")
    if any(type(counts[k]) is not int or counts[k] < 0 for k in CATALOG_SQL):
        raise RestoreGateError("INVALID_LIVE_CATALOG_COUNTS")
    if counts["public_tables"] != len(names):
        raise RestoreGateError("INCONSISTENT_LIVE_MANIFEST")
    return {"names": names, "counts": counts, "captured_date_wib": obj.get("captured_date_wib", "unknown")}


def unpack_private_zip(path: Path, dest: Path, expected_zip_sha: str | None) -> tuple[Path, dict]:
    if not path.is_file() or path.suffix.lower() != ".zip":
        raise RestoreGateError("PRIVATE_BACKUP_ZIP_NOT_FOUND")
    if path.stat().st_size > MAX_BACKUP_BYTES:
        raise RestoreGateError("PRIVATE_ZIP_TOO_LARGE")
    zip_sha = sha256_file(path)
    if expected_zip_sha and not hmac.compare_digest(zip_sha.lower(), expected_zip_sha.lower()):
        raise RestoreGateError("PRIVATE_ZIP_SHA256_MISMATCH")
    with zipfile.ZipFile(path) as z:
        entries = z.infolist()
        if len(entries) != 1:
            raise RestoreGateError("EXPECTED_ONE_ROOT_LEVEL_BACKUP")
        entry = entries[0]
        if (entry.is_dir() or "/" in entry.filename or "\\" in entry.filename
            or not entry.filename.endswith(".backup")
            or entry.file_size < 5 or entry.file_size > MAX_BACKUP_BYTES):
            raise RestoreGateError("INVALID_BACKUP_ZIP_ENTRY")
        if z.testzip() is not None:
            raise RestoreGateError("BACKUP_ZIP_CRC_FAILED")
        restored_archive = dest / "private-export.backup"
        with z.open(entry) as source, restored_archive.open("wb") as target:
            shutil.copyfileobj(source, target)
    with restored_archive.open("rb") as file:
        if file.read(5) != b"PGDMP":
            raise RestoreGateError("NOT_A_POSTGRES_CUSTOM_DUMP")
    return restored_archive, {
        "zip_sha256": zip_sha,
        "archive_sha256": sha256_file(restored_archive),
        "archive_bytes": restored_archive.stat().st_size,
        "zip_integrity": "PASS",
        "zip_identity": "INDEPENDENT_HASH_MATCH" if expected_zip_sha else "COMPUTED_ONLY",
    }


def find_pg18_bin(path: str | None) -> dict[str, str]:
    candidates = [Path(path).expanduser().resolve()] if path else []
    if path:
        candidates += [candidates[0] / "bin", candidates[0] / "pgsql" / "bin"]
    else:
        exe = shutil.which("pg_restore.exe")
        if exe:
            candidates.append(Path(exe).parent)
    for folder in candidates:
        if all((folder / name).is_file() for name in BINARIES):
            return {name: str(folder / name) for name in BINARIES}
    raise RestoreGateError("POSTGRESQL_18_BINARIES_NOT_FOUND")


def clean_pg_env() -> dict[str, str]:
    env = os.environ.copy()
    for key in list(env):
        if key.upper().startswith("PG") or key.upper() in ("DATABASE_URL", "SUPABASE_DB_URL"):
            env.pop(key, None)
    return env


def run_tool(command: list[str], env: dict[str, str], timeout: int, log: Path | None = None) -> int:
    with (log.open("ab") if log else open(os.devnull, "wb")) as out:
        return subprocess.run(command, env=env, stdin=subprocess.DEVNULL,
                              stdout=out, stderr=subprocess.STDOUT, timeout=timeout, check=False).returncode


def tool_output(command: list[str], env: dict[str, str], timeout: int = 30) -> str:
    process = subprocess.run(command, env=env, stdin=subprocess.DEVNULL,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             timeout=timeout, check=True)
    return process.stdout.decode("utf-8", "replace").strip()


def verify_toolchain(bins: dict[str, str], env: dict[str, str]) -> None:
    for name in BINARIES:
        version = tool_output([bins[name], "--version"], env)
        if not re.search(r"\b18\.\d+\b", version):
            raise RestoreGateError("REQUIRES_POSTGRESQL_18_TOOLCHAIN")


def toc_table_names(toc: str) -> list[str]:
    return sorted(set(TABLE_RE.findall(toc)))


def toc_declares_public_schema(toc: str) -> bool:
    return bool(PUBLIC_SCHEMA_TOC_RE.search(toc))


def inspect_toc(bins: dict[str, str], env: dict[str, str], archive: Path,
                expected_names: list[str], tmp: Path) -> dict:
    out = tmp / "private-toc.txt"
    with out.open("wb") as file:
        r = subprocess.run([bins["pg_restore.exe"], "--list", str(archive)],
                           env=env, stdin=subprocess.DEVNULL,
                           stdout=file, stderr=subprocess.DEVNULL, timeout=90, check=False)
    if r.returncode:
        raise RestoreGateError("PG_RESTORE_TOC_FAILED")
    toc = out.read_text(encoding="utf-8", errors="replace")
    names = toc_table_names(toc)
    if names != expected_names:
        raise RestoreGateError("BACKUP_TABLE_SET_DIFFERS_FROM_CURRENT_LIVE")
    return {
        "toc_public_tables": len(names),
        "toc_public_tables_match_manifest": True,
        "toc_declares_public_schema": toc_declares_public_schema(toc),
        "toc_entries": sum(bool(l.strip()) and not l.lstrip().startswith(";") for l in toc.splitlines()),
    }


def random_local_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def restore_to_new_local_cluster(
    bins: dict[str, str], env: dict[str, str], archive: Path, tmp: Path, manifest: dict,
    toc_has_public_schema: bool,
) -> dict:
    password = secrets.token_urlsafe(32)
    pwfile = tmp / "pw.txt"
    pwfile.write_text(password + "\n", encoding="utf-8")
    datadir = tmp / "new-local-cluster"
    logfile = tmp / "private-pg-log.txt"
    runtime_log = tmp / "private-restore-log.txt"
    user = "b25_private_restore"
    started = False
    try:
        init = [bins["initdb.exe"], "-D", str(datadir), "-U", user,
                "--auth-host=scram-sha-256", "--auth-local=scram-sha-256",
                "--pwfile", str(pwfile), "--encoding=UTF8",
                "--no-locale", "--no-instructions"]
        if run_tool(init, env, 120, logfile) != 0:
            raise RestoreGateError("LOCAL_INITDB_FAILED")
    finally:
        pwfile.unlink(missing_ok=True)

    port = random_local_port()
    with (datadir / "postgresql.conf").open("a", encoding="utf-8") as f:
        f.write("\nlisten_addresses = '127.0.0.1'\n")
        f.write(f"port = {port}\nssl = off\n")
    (datadir / "pg_hba.conf").write_text(
        "host all all 127.0.0.1/32 scram-sha-256\n"
        "host all all 0.0.0.0/0 reject\n"
        "host all all ::/0 reject\n", encoding="utf-8",
    )
    local_env = dict(env, PGPASSWORD=password, PGCONNECT_TIMEOUT="5")
    conn = ["-h", "127.0.0.1", "-p", str(port), "-U", user]
    stopped = False
    try:
        if run_tool([bins["pg_ctl.exe"], "-D", str(datadir), "-l", str(logfile),
                     "-w", "start"], local_env, 90, runtime_log) != 0:
            raise RestoreGateError("LOCAL_POSTGRES_START_FAILED")
        started = True
        if run_tool([bins["createdb.exe"], *conn, "b25_temporary_restore_only"],
                    local_env, 50, runtime_log) != 0:
            raise RestoreGateError("LOCAL_CREATE_DB_FAILED")
        # A fresh PG18 database normally has an empty public schema. Drop it
        # ONLY if the dump explicitly contains CREATE SCHEMA public; otherwise
        # dropping it would cause the restore's first CREATE TABLE to fail.
        # All commands are confined to this brand-new 127.0.0.1-only cluster.
        if toc_has_public_schema:
            command = [bins["psql.exe"], *conn, "-d", "b25_temporary_restore_only",
                       "-X", "-v", "ON_ERROR_STOP=1", "-c", "DROP SCHEMA public CASCADE"]
            if run_tool(command, local_env, 45, runtime_log) != 0:
                raise RestoreGateError("LOCAL_EMPTY_PUBLIC_SCHEMA_CLEANUP_FAILED")
        restoring = [bins["pg_restore.exe"], *conn, "--dbname=b25_temporary_restore_only",
                     "--no-owner", "--no-acl", "--single-transaction",
                     "--exit-on-error", str(archive)]
        if run_tool(restoring, local_env, 600, runtime_log) != 0:
            raise RestoreGateError(
                "LOCAL_RESTORE_FAILED_DEPENDENCIES_OR_COMPATIBILITY",
                diagnostic_category=classify_private_restore_error(runtime_log),
            )

        def sql_value(sql: str) -> str:
            return tool_output([bins["psql.exe"], *conn, "-d", "b25_temporary_restore_only",
                                "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
                               local_env, timeout=50)

        names = json.loads(sql_value(TABLE_NAMES_SQL))
        if names != manifest["names"]:
            raise RestoreGateError("RESTORED_TABLE_SET_DIFFERS_FROM_LIVE")
        observed = {key: int(sql_value(query)) for key, query in CATALOG_SQL.items()}
        if observed != manifest["counts"]:
            raise RestoreGateError("RESTORED_CATALOG_COUNTS_DIFFER_FROM_LIVE")
        return {
            "public_table_name_parity": "PASS",
            "catalog_counts": observed,
            "catalog_counts_match_live_snapshot": True,
            "restore_probe": "LOCAL_SCHEMA_AND_DATA_RESTORE_PASS_OWNER_ACL_STRIPPED",
            "full_cloud_recovery_proven": False,
        }
    finally:
        # Also attempt stop if startup returned nonzero but left a local server.
        stop = [bins["pg_ctl.exe"], "-D", str(datadir), "-m", "immediate", "-w", "stop"]
        rc = run_tool(stop, local_env, 50, runtime_log)
        stopped = rc == 0
        if started and not stopped:
            raise RestoreGateError("LOCAL_CLUSTER_STOP_NOT_CONFIRMED")
        if not started and not stopped:
            # The service may not have started. A stop error is expected here.
            pass


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--backup", required=True, type=Path, help="PRIVATE latest Lovable .backup.zip file")
    ap.add_argument("--manifest", required=True, type=Path, help="LIVE public metadata JSON snapshot")
    ap.add_argument("--postgres-bin", help="TRUSTED local PostgreSQL 18 bin directory")
    ap.add_argument("--expected-zip-sha256", help="independently verified ZIP SHA256 (REQUIRED for restore)")
    ap.add_argument("--mode", choices=("inspect", "restore"), default="inspect")
    ap.add_argument("--ack-isolated-restore", action="store_true",
                    help="required for restore; only NEW local 127.0.0.1 cluster")
    ap.add_argument("--report", type=Path, help="safe metadata report (defaults beside private ZIP)")
    a = ap.parse_args()
    report_path = a.report or a.backup.parent / "B25_Private_Restore_Result.json"
    if report_path.resolve() in {a.backup.resolve(), a.manifest.resolve()}:
        ap.error("Report cannot overwrite the private backup or catalog manifest.")
    report: dict = {
        "project": "Baturaden 25 Homestay",
        "mode": a.mode,
        "started_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "cloud_mutations": False,
        "staging_mutations": False,
        "endpoint": "127.0.0.1_NEW_LOCAL_CLUSTER_ONLY",
        "owner_acl_restored": False,
        "auth_login_and_storage_files_verified": False,
        "status": "STARTED",
    }
    try:
        if os.name != "nt":
            raise RestoreGateError("WINDOWS_ONLY")
        manifest = read_manifest(a.manifest)
        report["expected_public_tables"] = len(manifest["names"])
        report["manifest_captured_date_wib"] = manifest["captured_date_wib"]
        if a.mode == "restore" and (not a.ack_isolated_restore
                                    or not a.expected_zip_sha256
                                    or not re.fullmatch(r"[a-fA-F0-9]{64}", a.expected_zip_sha256)):
            raise RestoreGateError("RESTORE_NEEDS_LOCAL_ACK_AND_INDEPENDENT_ZIP_SHA256")
        with tempfile.TemporaryDirectory(prefix="b25_private_pg18_") as td:
            tmp = Path(td)
            archive, inspected = unpack_private_zip(a.backup, tmp, a.expected_zip_sha256)
            report.update(inspected)
            bins = find_pg18_bin(a.postgres_bin)
            env = clean_pg_env()
            verify_toolchain(bins, env)
            report["postgres_toolchain"] = "18.x"
            report.update(inspect_toc(bins, env, archive, manifest["names"], tmp))
            if a.mode == "restore":
                report.update(restore_to_new_local_cluster(
                    bins, env, archive, tmp, manifest,
                    toc_has_public_schema=bool(report["toc_declares_public_schema"]),
                ))
                report["status"] = "LOCAL_RESTORE_PASS_LIMITED_NOT_CLOUD_RECOVERY"
            else:
                report["status"] = "INSPECT_PASS_TOC_AND_TABLE_NAMES_ONLY"
    except (RestoreGateError, OSError, ValueError, json.JSONDecodeError, zipfile.BadZipFile, subprocess.SubprocessError) as err:
        report["status"] = "BLOCKED_OR_FAILED"
        report["reason_code"] = str(err) if isinstance(err, RestoreGateError) else type(err).__name__
        if isinstance(err, RestoreGateError) and err.diagnostic_category:
            report["diagnostic_category"] = err.diagnostic_category
    finally:
        report["finished_utc"] = dt.datetime.now(dt.timezone.utc).isoformat()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"STATUS: {report['status']}")
        print("Report saved privately alongside the ZIP unless --report was provided.")
    return 0 if report["status"].startswith(("INSPECT_PASS", "LOCAL_RESTORE_PASS")) else 3


if __name__ == "__main__":
    sys.exit(main())
