# Gate Rilis Poin 4/7 — Template WhatsApp
**Tanggal checkpoint:** 25 November 2026 (WIB)
**PR:** #145 (DRAFT / HOLD) · **Issue:** #144
**Status keputusan:** **NO-GO untuk migrasi/publish**; akses dan preflight struktur LIVE sudah diperoleh (lihat addendum).

## Lingkungan yang benar-benar diperiksa
- Supabase connector hanya menampilkan **Baturaden-25-Staging** (`bgtztcfbkcrvcipxbfti`), PostgreSQL 17.11.
- **Pada checkpoint awal ini**, Supabase connector hanya memberi akses staging. Addendum di bawah mencatat temuan lanjutan saat LIVE ditemukan melalui Lovable.
- Semua pemeriksaan staging adalah `SELECT` metadata / `list_migrations` saja. Tidak ada DDL, DML, feature flag, deploy, publish, atau transaksi keuangan.

## Hasil preflight staging — 12 persyaratan
| Objek | Hasil |
|---|---|
| public.user_roles | 🟢 PRESENT |
| public.employees | 🟢 PRESENT |
| public.transactions | 🟢 PRESENT |
| public.app_role | 🟢 PRESENT |
| public.has_role(uuid, public.app_role) | 🟢 PRESENT |
| public.receipt_template_versions | 🔴 MISSING |
| public.finance_training_current_user_is_restricted() | 🔴 MISSING |
| public.read_payment_confirmation_refunds(uuid) | 🔴 MISSING |
| public.whatsapp_template_versions | 🔴 MISSING (expected until migration) |
| public.whatsapp_template_audit | 🔴 MISSING (expected until migration) |
| public.owner_save_whatsapp_template(text,text) | 🔴 MISSING (expected until migration) |
| public.read_active_whatsapp_template(text) | 🔴 MISSING (expected until migration) |

Migration history in staging covers an October 2026 baseline; this does **not** prove which migrations are installed on LIVE.

## Evidence on branch
- `supabase/pending/20261125_whatsapp_templates_owner_only.sql`: proposed new tables/RPC/permissions (not executed).
- `supabase/pending/20261125_whatsapp_templates_readonly_preflight.sql`: read-only metadata preflight.
- `scripts/whatsapp-template-postgres-fixture.sql`: isolated PostgreSQL authorization/versioning tests, including fail-closed missing Training guard.
- Latest focused CI to date: [run #45521288051](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/45521288051) PASS (previous branch checkpoint).

## Addendum verifikasi database Lovable LIVE — 25 November 2026

**Sumber verifikasi:** Lovable `Pixel Perfect Homestay Hub` (`project_id: 017f6e78-15f2-4d07-a38c-87cb185279bf`), akun Owner workspace. Proyek berstatus **published** dan databasenya **enabled, stack supabase**. Proyek ini berbeda dari koneksi Supabase staging `bgtztcfbkcrvcipxbfti`.

**Metode:** `get_project`, `get_database_status`, `query_database` dengan **SELECT metadata saja**. Tidak ada perubahan Cloud.

| Syarat objek LIVE | Hasil |
|---|---|
| `public.user_roles`, `public.employees`, `public.transactions` | 🟢 PRESENT |
| `public.app_role`, `public.has_role(uuid, app_role)` | 🟢 PRESENT |
| `public.receipt_template_versions` | 🟢 PRESENT |
| `public.finance_training_current_user_is_restricted()` | 🟢 PRESENT |
| `public.read_payment_confirmation_refunds(uuid)` | 🟢 PRESENT |
| `public.whatsapp_template_versions`, `public.whatsapp_template_audit` | 🔴 MISSING, new migration not applied |
| `public.owner_save_whatsapp_template(text,text)`, `public.read_active_whatsapp_template(text)` | 🔴 MISSING, new migration not applied |

**Metadata yang dikonfirmasi:** `employees.user_id` uuid, `position` enum `employee_position`, `active` boolean; `user_roles.user_id` uuid, `role` enum `app_role`; `transactions.id` uuid; `receipt_template_versions.header_config` jsonb. Enumerasi posisi mencakup receptionist, housekeeping, supervisor, inspector, investor.

**Fungsi LIVE:** `has_role` dan fungsi Training ada sebagai `SECURITY DEFINER`; `read_payment_confirmation_refunds(_transaction_id uuid)` juga ada; yang terakhir menyetel `search_path` kosong. Fungsi `finance_training_current_user_is_restricted()` mengembalikan `finance_training_is_restricted(auth.uid())`. Eksistensi fungsi **tidak sama dengan** bukti seluruh UAT role PASS.

**Perubahan keputusan:** penghalang *missing Training/refund dependencies* hanya berlaku di staging, **tidak berlaku di LIVE** yang diinspeksi. Preflight struktur LIVE **🟢 SELESAI**. Akan tetapi migrasi WhatsApp tetap **🔴 NO-GO** sampai backup/restore test, approval Owner, release review dan browser UAT disiapkan. Jangan mengasumsikan CIs atau audit metadata sudah menjadi bukti recoverability.

### Checklist sisa (LIVE)
1. 🟢 Identifikasi Lovable project LIVE dan keterkaitan backend—terverifikasi dengan koneksi Lovable.
2. 🟢 Cek 12 objek dan tipe dasar serta fungsi Training/refund—SELECT-only selesai.
3. 🔴 Pastikan backup terverifikasi dan pemulihan teruji; tidak tersedia bukti pada pemeriksaan ini.
4. 🔴 Audit mendalam implikasi migrasi, grants dan fungsi SECURITY DEFINER di target sebelum apply.
5. 🔴 Persetujuan Owner eksplisit untuk migrasi SQL perubahan, merge dan publikasi.
6. 🔴 UAT nyata Owner/Receptionist/Supervisor/Housekeeping/Training dan kasus refund/ledger, tanpa transaksi keuangan baru tanpa izin.

## Release gates (all required, sequential)
1. 🟢 Identify correct Lovable LIVE project and database (done via connector); 🔴 approved change window still pending.
2. 🟢 Execute **only read-only** structural preflight on LIVE (done); 🔴 independent final security review still pending.
3. 🔴 Confirm verified, recoverable backup, tested rollback strategy, and audit snapshot. Do not assume a `DROP TABLE` script is a safe rollback once Owner versions exist.
4. 🔴 Resolve missing dependencies in the actual target (if any) through their separately approved migrations; never weaken Training/finance guards to bypass missing functions.
5. 🔴 Review SQL role grants, SECURITY DEFINER, token allowlists, and schema parity independently.
6. 🔴 Explicit Owner approval is required **before** any Cloud DDL, merge, deploy, or publish. Apply only the approved migration to the approved target.
7. 🔴 UAT using actual Owner / Supervisor / Receptionist / Housekeeping / Training roles, including no automatic WhatsApp sending, PDF/ledger consistency, and copy-time invalidation. No new financial transaction unless separately authorized.
8. 🔴 Recheck GitHub CI and ensure PR is reviewed before merging. Announce separate LIVE release decision.

## Explicit NO-GO conditions
- Project identity unverified, missing owner/Training/refund guard, live source mismatch, no restore proof, or inconclusive role UAT.
- Failure of template audit/version tests, permission boundaries, stale-ledger copying checks or any regression in PDF/JPG/thermal 58 mm.
- Missing approval for production-altering operation.

**Owner rule:** 🟢 denotes completed, evidenced tasks; 🔴 denotes pending/blocked tasks. Do not call full Poin 4 complete until LIVE role/UAT and release gates pass.
