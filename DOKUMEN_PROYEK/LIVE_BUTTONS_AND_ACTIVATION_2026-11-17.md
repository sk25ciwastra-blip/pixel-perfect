# Baturaden 25 Homestay — employee-facing flow audit

17 November 2026 WIB. Current Lovable source remains 3218bd2ebe8fd98a6a046c9fe105d21293de34ca.
Read current source files directly through Lovable connector. Preview session is Owner;
no employee/Training login result is implied. No live data changed during this audit.

| Flow | PASS LIVE LOVABLE | PASS LOKAL / GITHUB | SUDAH DIPERBAIKI TAPI BELUM AKTIF | BELUM DIUJI |
|---|---|---|---|---|
| Booking | Dashboard Reservasi and Booking Reservasi Baru open form; 2 guests deliberately locked by Owner | No new form fix retained | Original form preserved | Save Booking/DP and employee role |
| Check-in Langsung | Dashboard CHECK-IN opens form; room-type options load | Existing contract evidence retained | Existing PR83 session integration package pending | Actual new check-in through this source, employee role |
| Payment / Booking Check-in | Booking Check-in opens payment panel with balance and session message | Prior native payment/batch/closing PASS retained, not rerun | Pending payment retry and session-context patches | Bayar / finish Check-in submission; no new payment authorized |
| Check-out | Actual confirmation dialog opens and was dismissed | Prior guard evidence retained | Overtime queue still pending PR83 | Confirmed checkout/dirty transition in this audit |
| Housekeeping | Earlier approved Room10 normal checklist -> READY, 1 checklist/finish retained; not repeated | Prior HK source/native/browser PASS retained | Navigation/retry/job-warning patch pending | Employee login and integrated source acceptance |
| Sesi Kas | Keuangan loads OPEN session; Sesi Kas tab responds | Prior assisted-context evidence retained | Reactive session selector from PR83 not active | Open/assist/change/close session submission |

## Owner correction: Booking guest count intentionally locked

Owner explicitly confirmed during this audit that Reservasi intentionally locks
Jumlah Tamu to 2. Treat this as the latest business decision. The previously prepared
supplemental patch was withdrawn before GitHub publication; no app or Cloud change.
Do not reopen the input or classify the lock as a bug. Walk-in extra-guest controls
remain as originally implemented. Earlier general extra-guest notes do not override
this explicit Booking decision. The temporary candidate typecheck is not credited
as a retained fix or live progress.

## One source integration sequence, separate database approvals

1. Confirm original GitHub Sync recovery with Support, inspect both heads, preserve
   actual Lovable design. Export a clean current source checkout.
2. Run scripts/preflight-operational-source.py against that checkout. Manifest
   covers the existing eight original paths plus artifact hashes. Drift stops
   application. Never point this at the already-modified review tree for acceptance.
3. After Owner integration authorization, apply the existing eight-file
   operational-integration-lovable-3218bd2.patch ONCE, retain the original Reservasi form and its two-guest lock.
   Do not also apply old five-file HK patch or duplicate PR76/79/80/81/82 patches.
4. Inspect eight-file diff; typecheck/build and only regressions affected by actual
   integrated code. Verify employee-facing forms, error messages and preserved design.
5. Pending SQL packages are separate: finance manifest/recovery under
   supabase/review/finance-20261117, plus HK/overtime/ACL/fixed-window gates.
   Nothing in source approval authorizes migrations, flags or transaction writes.
6. Prepare a specific minimal DEMO end-to-end scenario for Owner approval, then
   verify saved record IDs, totals/session/operator, room transitions and retries.

## Finance preparation preserved, not the active priority

Three SELECT-only preflight checks against current Cloud returned accepted_body=true
and accepted_security=true. Read-only dependency inventory includes 24 helpers,
16 triggers and 8 indexes. Two Finance packages do not require one another.
Four NEW local package/recovery checks PASS: combined replacement preserves three
RPC ACL/security attributes; ordinary recovery execution refused; explicitly opted-in
fixture recovery restores exact original bodies; source drift refuses overwrite.
These are function-definition recovery tests, NOT a Cloud data backup/restore drill.
Original recovery reinstates known defects and therefore needs separate approval.
No previous Finance functional suite was rerun.

## Remaining work and priority

Actual browser saves/payments/checkout and employee role matrix remain BELUM DIUJI.
Sync/source activation blocked; database changes separately gated by Owner and backup
readiness. Preparation remains 6/7 = 85.7%, operational NO-GO. This does not measure
whole-app completion. Continue safe live pre-submit checks and fix concrete source
bugs in this single PR. Do not claim a button fixed live from local tests alone.
