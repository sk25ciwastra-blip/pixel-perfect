# Baturaden 25 Homestay — No8: Reset Total Data DEMO (BUKAN ARSIP)

**23 November 2026 WIB — PROPOSAL PRE-FLIGHT, NO CLOUD DELETE YET.** Owner has explicitly chosen complete deletion of all operational DEMO data before No9. Previous archive-based solution is rejected; never reactivate archive as cleanup solution.

## 1. Scope and correct environment
- **Target:** Lovable project `017f6e78-15f2-4d07-a38c-87cb185279bf` PostgreSQL used by Baturaden 25 Homestay. Do not run against connected Supabase project **Baturaden-25-Staging** `bgtztcfbkcrvcipxbfti`: it is a different database. Currently available direct Supabase connector lists only Staging; Lovable query_database is available for read-only inspections.
- **Keep** authenticated Owner and actual staff accounts, password hashes, user_roles, employee_profiles, real room catalog/room types, package tariffs and snapshots defining defaults, Finance settings and commission policies, app permissions/RLS/functions, receipt templates, operational menu configuration. Reset room *status* only through a specifically audited maintenance operation, preserving 11 actual room identities. Room 01 legacy/demo needs separate verification before deleting a master room row.
- **Delete** DEMO-created transactions, payments, guest/guest notes, payment receipts/print requests, housekeeping history/jobs/checklists, Finance cash sessions and operational expenses/allocations, idempotency snapshots, overtime releases and operational audit **only after each row's DEMO ownership and retention classification**. Never scrub activity/audit concerning real employee accounts or security incidents indiscriminately.

## 2. Concrete inventory (Lovable Cloud, SELECT-only)
| Group | Rows |
|---|---:|
| Transactions | 17 (8 check_out, 6 booking, 3 check_in) |
| Payments | 24 (Rp1.356.000, DEMO) |
| Finance Cash Sessions | 6 (3 OPEN, 3 FINAL) |
| Finance expenses | 2 |
| Finance session allocations | 1 |
| Finance reservation idempotency | 8 |
| Guests / guest notes | 19 / 4 |
| Housekeeping history / checklists / jobs | 12 / 6 / 5 |
| Payment receipts / receipt print requests | 1 / 2 |
| Activity logs | 288, **mixed transactional and master/employee security audit** |

Other operational-calendar 51 rows, operational-announcements 5 rows and employee records include mixed source/test vs master policy; classify before wipe. Full SQL baseline, FK and trigger inspection: `scripts/no8-demo-full-wipe-preflight.sql` is exclusively SELECT statements and can be rerun safely.

## 3. Confirmed blockers to a naïve DELETE
1. `finance_final_session_guard()` intentionally raises `Closing final tidak dapat diubah atau dihapus` on every FINAL session DELETE or UPDATE.
2. `guard_payment_transaction_state()` rejects DELETE of payments whose transaction is check_out or cancelled. FK `payments_transaction_id_fkey` also blocks deleting transactions with attached payments.
3. `finance_closing_count_audit` has RESTRICT references to finance_cash_sessions; other finance allocations, payment receipts, Housekeeping and idempotency records also reference transactions or sessions.
4. HK has ON DELETE SET NULL for transaction references: a wrong deletion order could make records appear to lose their transaction linkage instead of truly cleaning the intended DEMO dataset.
5. `activity_logs` includes 67 room edits, 43 employee edits, 33 package edits, 25 transaction edits, 21 guest creations, 17 transaction creations, plus operational audit. **Do not delete 288 wholesale** without scoping real/DEMO and legal record retention.
6. The old database backup verification and integrity evidence did not prove a successful full restore to this current Lovable database; backup/restore and exact target identity must be re-verified now.

## 4. Required execution protocol (after prerequisites)
**A. Backup & restore gate:** obtain a current consistent backup of the **actual Lovable DB** including schema, Auth user mappings, sequences, protected metadata and relevant storage; verify checksum and perform a restore to an isolated clone. A backup file alone is not restore proof. Record actual tested restore point, timestamp and target ref; do not copy secrets or personal data into GitHub.

**B. Maintenance gate:** freeze operational writes (no login actions/Booking/Check-in/finance submissions during reset), record baseline counts, balances, FK and active rooms. Verify every row in cleanup set is DEMO and classify mandatory historical finance/audit retention before irreversible deletion. Owner-approved all DEMO does not authorize deleting real money records or regulated retention obligations.

**C. Controlled reset design:** use a narrowly scoped, privileged, reviewed maintenance script in a one-shot transaction on **the restored clone first**. Explicit dependency order for `receipt_print_requests` → `payment_receipts` and Finance payment/commission/refund/charge/idempotency children → payments → transactions; Housekeeping checklist/history/jobs and related links; Finance session allocations/expenses/handoffs → cash sessions; demo guest notes → guests. Handle FINAL/session and payment-closed guards **only within audited maintenance scope** and restore original guards immediately. Never globally disable all triggers, change RLS broadly, or use CASCADE/TRUNCATE against master tables.

**D. Reset room state and numbering:** after clearing DEMO occupancy, set verified actual operational rooms to READY via controlled maintenance, not fictional checkouts or HK. Preserve type, pricing, identity, and other master fields. Determine if global transaction sequence should be restarted only after full reference and idempotency audit; preserve monotonic employee IDs; do not silently reuse receipt numbers.

**E. Validation:** transactions=0, payments=0, demo guests/guest_notes=0, cash sessions=0 if all six confirmed DEMO, DEMO HK records=0, DEMO print requests=0, no DEMO IDs referenced elsewhere; active operational rooms all READY (unless genuine physical dirty/maintenance condition), guest-facing revenue/transactions dashboards show 0; no real staff account deleted; types/packages/prices/settings/roles/receipt templates unchanged. Confirm all FK, triggers, RLS and security invariants intact. Roll back on **any** mismatch.

**F. Execute Lovable only after clone PASS:** compare current counts to preflight baseline and stop on drift. Apply exactly vetted script once using credentialed administrative channel specific to the Lovable DB. Never run Staging SQL against Lovable by assumption. Re-run the same read-only counts after commit. Document what was removed and any backup retention without claiming backup or third-party copies vanished.

## 5. What NOT to do
- No archiving in place of deletion; no reschedule, cancel, Checkout, refund or Closing faked merely to clear data.
- No No9 Work multi-account feature UAT during No8. No9 runs later exactly **Receptionist → Owner → Housekeeping**.
- No unreviewed `TRUNCATE ... CASCADE`, no mass data erase while sessions remain writable, no disabling `finance_final_session_guard` in production without reviewed one-shot maintenance and verified restore, no deletion of Auth real users.

## 6. Status
Owner-approved goal: total deletion of DEMO operational data. **This document is NOT an executable deletion script or evidence that deletion happened.** Preflight SQL and dependency graph complete; actual Lovable backup + restored clone not verified, so **CLOUD WIPE = BLOCKED** pending those prerequisites. No8 is still incomplete. Do not report No8 GO or start No9.
