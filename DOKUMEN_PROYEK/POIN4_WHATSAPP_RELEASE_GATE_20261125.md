# Gate Rilis Poin 4/7 — Template WhatsApp
**Tanggal checkpoint:** 25 November 2026 (WIB)
**PR:** #145 (DRAFT / HOLD) · **Issue:** #144
**Status keputusan:** **NO-GO** untuk aktivasi Cloud saat ini.

## Lingkungan yang benar-benar diperiksa
- Supabase connector hanya menampilkan **Baturaden-25-Staging** (`bgtztcfbkcrvcipxbfti`), PostgreSQL 17.11.
- **Tidak ada akses Cloud LIVE melalui connector saat checkpoint ini.** Staging bukan bukti kesesuaian skema LIVE.
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

## Release gates (all required, sequential)
1. 🔴 Identify and authenticate **correct LIVE project** and its approved change window. Do not reuse staging ref or guess a production ref.
2. 🔴 Execute **only read-only** preflight on LIVE, compare object signatures, dependencies and existing owner/Training/finance authorization routines with approved baseline.
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
