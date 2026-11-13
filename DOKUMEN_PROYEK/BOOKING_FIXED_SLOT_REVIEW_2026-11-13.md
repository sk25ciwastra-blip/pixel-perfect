# Booking/Check-in fixed-slot review — 13 November 2026

Base: `daa093f18d53313e58ddd84431c4d5c86b4396f8`; Issue #45.
Read latest checkpoint, including backlog comment 6856445208: overtime and
Owner settings are separate work and are excluded here.

## Inventory (read-only, existing PASS suites not repeated)

- Owner rules: `02_ATURAN_BISNIS.md`. Pagi 08:30–16:00, Malam
  22:00–08:00 next day, Harian 13:00–12:00 next day. Existing permitted
  check-in windows remain 08:00–12:00, 21:30–04:00, 12:00–04:00 respectively.
- `formulir-pemesanan.tsx` sends planned times with explicit `+07:00`;
  `booking.tsx` uses the existing server check-in RPC, not a client checkout calculation.
- `20261003000002_package_time_engine.sql` calculates fixed endpoints using
  `Asia/Jakarta` and canonical `checkout_time`. Legacy `packages.end_time` in
  Drizzle is not the active contract. No column synchronization is needed.
- `20261006000007_scheduled_booking_foundation.sql` delegates scheduled times
  to the central engine. Direct check-in uses the same engine.
- Approved #47 source is preserved in
  `supabase/pending/20261112_booking_late_checkin_checkout_cap.sql`.
  Its duration checkout cap, auth/payment guards, locks, overlaps and Training
  wrapper are not rebuilt. Existing booking-time smoke and duration regression
  suites are inventoried, not rerun.

## One demonstrated gap and minimal correction

The existing RPC checks expiration but not whether the actual arrival belongs
to the booked fixed slot. A booking Malam for November 13 at 22:00 (ending
November 14 at 08:00 WIB) can check in November 13 at 02:00 and obtain an
incorrect November 13 08:00 endpoint. The isolated baseline runtime reproduces this.

The new pending SQL adds one guard for `fixed_window` only: the endpoint
calculated from actual arrival must equal `scheduled_check_out`. Wrong-slot
arrivals fail before room/transaction updates. Valid early arrival within the
existing permitted window and after-midnight arrival within the same slot stay
allowed. No blanket same-calendar-date restriction is introduced.

## Verification

- PASS: in-memory PostgreSQL (PGlite 0.3.14), baseline reproduction and 11 new
  cases covering Pagi/Malam/Harian, early permitted arrivals, wrong-slot denials,
  midnight, month/year rollover, explicit expected official endpoint, no row
  mutation on denial and no added payment. Dummy data only; no network DB.
- PASS: source equality check proves the function differs from #47 only by
  the fixed-window guard (file header excluded).
- PASS: focused TypeScript check for Booking, Check-in and reservation form,
  including generated route declarations; temporary config removed afterward.
- PASS: `bun run build`; existing Vite paths/deprecation/bundle warnings remain.
- PASS: diff scope/whitespace review. No frontend or financial logic changes.
- NOT REACHED: browser/manual integrated operational testing, real Cloud RPC
  behavior, role/RLS runtime and production data/configuration comparison.
  No historical PASS suite rerun or Cloud SQL execution.

Run the focused test with `node scripts/booking-fixed-slot-boundary-tests.cjs`.
It reuses the isolated temporary PGlite installation from earlier reviews.
On another machine, install `@electric-sql/pglite@0.3.14` outside the repository
and set `BTRD25_PGLITE_MODULE` to its module directory. No application dependency
or lockfile is changed. Auth helper is a fixture stub, not evidence of role/RLS PASS.

## Review and rollout boundary

`supabase/pending/20261113145045_booking_fixed_slot_boundary.sql` is a local
review artifact only. Owner execution approval and verification against the
then-current Cloud function are required separately; the function replacement
assumes the approved #47 baseline. This PR alone does not fix running Cloud.
Historical fixed-window bookings whose stored endpoint differs from current
configuration fail safely; no automatic historical repair is attempted.

No price, DP, refund, commission, Training policy, UI design, flag, Cloud/DEMO
data, or catalog changes. No merge, deployment, publication or Lovable usage.
