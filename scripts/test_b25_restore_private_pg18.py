"""Offline metadata-only tests. NEVER use a real customer backup or Cloud."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

SCRIPT = Path(__file__).with_name("b25_restore_private_windows_pg18.py")
spec = importlib.util.spec_from_file_location("b25_restore_private_windows_pg18", SCRIPT)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


class PrivateRestoreGuardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.manifest = self.root / "manifest.json"
        self.names = ["reservation_offers", "whatsapp_template_versions"]
        self.counts = {key: 1 for key in tool.CATALOG_SQL}
        self.counts["public_tables"] = 2
        self.manifest.write_text(json.dumps({
            "public_tables": self.names,
            "counts": self.counts,
            "captured_date_wib": "2026-11-26",
        }), encoding="utf-8")

    def test_real_live_metadata_manifest_tracks_51_tables_and_six_new_names(self):
        path = SCRIPT.parent.parent / "DOKUMEN_PROYEK" / "B25_LIVE_CATALOG_SNAPSHOT_20261126.json"
        manifest = tool.read_manifest(path)
        self.assertEqual(len(manifest["names"]), 51)
        self.assertEqual(manifest["counts"]["public_tables"], 51)
        self.assertEqual(manifest["counts"]["public_rls_tables"], 51)
        self.assertTrue({
            "b25_homestay_profile", "b25_homestay_profile_audit",
            "reservation_offers", "reservation_offer_events",
            "whatsapp_template_versions", "whatsapp_template_audit",
        }.issubset(set(manifest["names"])))

    def test_manifest_rejects_wrong_table_count(self):
        manifest = tool.read_manifest(self.manifest)
        self.assertEqual(manifest["names"], self.names)
        self.assertEqual(manifest["counts"]["public_tables"], 2)
        data = json.loads(self.manifest.read_text())
        data["counts"]["public_tables"] = 1
        self.manifest.write_text(json.dumps(data))
        with self.assertRaisesRegex(tool.RestoreGateError, "INCONSISTENT"):
            tool.read_manifest(self.manifest)

    def test_manifest_rejects_duplicates_and_nonidentifiers(self):
        for bad in (["reservation_offers", "reservation_offers"], ["../../secrets"]):
            obj = json.loads(self.manifest.read_text())
            obj["public_tables"] = bad
            self.manifest.write_text(json.dumps(obj))
            with self.assertRaises(tool.RestoreGateError):
                tool.read_manifest(self.manifest)

    def test_toc_parser_includes_public_tables_only(self):
        toc = """
        ; TOC for synthetic PostgreSQL custom archive
        20; 1259 44 TABLE public reservation_offers postgres
        21; 1259 45 TABLE public whatsapp_template_versions postgres
        22; 0 45 TABLE DATA public whatsapp_template_versions postgres
        23; 1259 46 TABLE auth users postgres
        """
        self.assertEqual(tool.toc_table_names(toc), self.names)

    def test_toc_public_schema_detection_controls_safe_cleanup(self):
        # Some Lovable dumps omit the public SCHEMA TOC entry. An empty local
        # PG18 instance already provides public; deleting it causes failures.
        no_schema = "20; 1259 44 TABLE public reservation_offers postgres\n"
        with_schema = (
            "18; 2615 2200 SCHEMA - public pg_database_owner\n"
            "20; 1259 44 TABLE public reservation_offers postgres\n"
        )
        self.assertFalse(tool.toc_declares_public_schema(no_schema))
        self.assertTrue(tool.toc_declares_public_schema(with_schema))
        self.assertFalse(tool.toc_declares_public_schema(
            "18; 2615 2200 SCHEMA - auth postgres\n"
        ))

    def test_failure_classification_contains_no_raw_sql_or_private_data(self):
        cases = [
            ("pg_restore: error: could not execute query: ERROR: schema "
             "\\"public\\" does not exist", "MISSING_PUBLIC_SCHEMA"),
            ("pg_restore: error: could not execute query: ERROR: schema "
             "\\"auth\\" does not exist", "MISSING_SUPABASE_AUTH_DEPENDENCY"),
            ("pg_restore: error: could not execute query: ERROR: schema "
             "\\"storage\\" does not exist", "MISSING_SUPABASE_STORAGE_DEPENDENCY"),
            ("pg_restore: error: could not execute query: ERROR: role "
             "\\"service_role\\" does not exist", "MISSING_DATABASE_ROLE"),
            ("pg_restore: error: could not execute query: ERROR: extension "
             "\\"vector\\" is not available", "MISSING_POSTGRES_EXTENSION"),
            ("pg_restore: error: could not execute query: ERROR: function "
             "auth.uid() does not exist", "MISSING_SUPABASE_AUTH_DEPENDENCY"),
            ("pg_restore: error: could not execute query: ERROR: duplicate key value "
             "violates unique constraint", "DATA_CONSTRAINT_FAILURE"),
            ("pg_restore: error: could not execute query: ERROR: mysterious "
             "exception involving private@example.invalid",
             "UNCLASSIFIED_POSTGRES_RESTORE_ERROR"),
        ]
        log = self.root / "raw-secret-never-upload.txt"
        for raw, expected in cases:
            log.write_text(raw + "\nCommand was: INSERT INTO private_table VALUES ('SECRET');")
            code = tool.classify_private_restore_error(log)
            self.assertEqual(code, expected)
            self.assertNotIn("SECRET", code)
            self.assertNotIn("private@example.invalid", code)
        log.unlink()
        self.assertEqual(tool.classify_private_restore_error(log), "ERROR_LOG_UNAVAILABLE")

    def test_valid_private_archive_and_sha(self):
        zippath = self.root / "test.backup.zip"
        with zipfile.ZipFile(zippath, "w") as z:
            z.writestr("test.backup", b"PGDMP" + b"synthetic not a real dump")
        digest = hashlib.sha256(zippath.read_bytes()).hexdigest()
        target = self.root / "tmp"
        target.mkdir()
        inner, info = tool.unpack_private_zip(zippath, target, digest)
        self.assertTrue(inner.is_file())
        self.assertEqual(info["zip_identity"], "INDEPENDENT_HASH_MATCH")
        self.assertEqual(info["zip_integrity"], "PASS")
        with self.assertRaisesRegex(tool.RestoreGateError, "SHA256_MISMATCH"):
            tool.unpack_private_zip(zippath, target, "0" * 64)

    def test_rejects_unsafe_nested_zip_entry(self):
        zippath = self.root / "nested.zip"
        with zipfile.ZipFile(zippath, "w") as z:
            z.writestr("../../payload.backup", b"PGDMP" + b"fake")
        with self.assertRaisesRegex(tool.RestoreGateError, "INVALID_BACKUP_ZIP_ENTRY"):
            tool.unpack_private_zip(zippath, self.root, None)

    def test_rejects_zip_multiple_files(self):
        zippath = self.root / "multiple.zip"
        with zipfile.ZipFile(zippath, "w") as z:
            z.writestr("one.backup", b"PGDMPfake")
            z.writestr("two.backup", b"PGDMPfake")
        with self.assertRaisesRegex(tool.RestoreGateError, "EXPECTED_ONE_ROOT"):
            tool.unpack_private_zip(zippath, self.root, None)

    def test_rejects_non_pg_dump_payload(self):
        zippath = self.root / "bad.zip"
        with zipfile.ZipFile(zippath, "w") as z:
            z.writestr("export.backup", b"WRONGfake")
        with self.assertRaisesRegex(tool.RestoreGateError, "NOT_A_POSTGRES"):
            tool.unpack_private_zip(zippath, self.root, None)

    def test_sanitizes_remote_database_environment(self):
        import os
        prior = {name: os.environ.get(name) for name in ["PGHOST", "PGPORT", "PGPASSWORD", "DATABASE_URL"]}
        try:
            os.environ.update({"PGHOST": "remote.invalid", "PGPORT": "5432",
                               "PGPASSWORD": "secret", "DATABASE_URL": "postgres://remote.invalid"})
            env = tool.clean_pg_env()
            for name in prior:
                self.assertNotIn(name, env)
        finally:
            for name, value in prior.items():
                if value is None:
                    os.environ.pop(name, None)
                else:
                    os.environ[name] = value


if __name__ == "__main__":
    unittest.main()
