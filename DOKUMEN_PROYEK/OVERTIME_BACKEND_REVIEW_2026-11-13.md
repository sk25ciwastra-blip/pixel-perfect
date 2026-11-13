# Overtime >120 minutes — isolated backend unit

Base main: `83058ae56e7fbdbdbf620938ce2a7b63d62f659d` (PR #56 merged).
Source of Owner decision: Issue #45, latest checkpoint
https://github.com/sk25ciwastra-blip/pixel-perfect/issues/45#issuecomment-6856724940
and the explicit overtime implementation instruction. Read alongside
`01_BUKU_INDUK.md` and `02_ATURAN_BISNIS.md`.

## Existing implementation inventory (read-only)

- Dashboard `index.tsx`: active stays remain in `kamarTerisi`/`statusKamarBaris`
  irrespective of >120 minutes. Existing `indikator.perluTindakan` is based on
  Housekeeping, a different condition; do not relabel it as transaction overtime.
- `kamar.tsx`: colors derive from room status. No transaction-overtime red yet.
- `create_reservation` in `20261015000002_finance_150_supervisor_alignment.sql`:
  auth, idempotency, payment and package validation, room lock/READY transition,
  scheduled conflicts, transaction insert. No >120 guard or Owner release.
- `20261104000000_atomic_combined_payments.sql`: combined reservation follows
  the same physical-room transition and transaction insert. Training wrappers
  delegate to normal/combined reservation. No replacement of these RPCs needed.
- Direct transaction writes remain subject to existing grants/RLS and Training
  trigger; RLS alone is not an overtime/occupancy guard. The new trigger adds a
  common write boundary without expanding any operational grants.
- Booking check-in uses existing ready/overlap guards. PR #56 added pending
  fixed-slot validation, not yet Cloud-applied. This PR is independent of that
  function replacement and must not be represented as activating #56.
- Existing dashboard, checkout-hardening, Training, fixed-slot and duration test
  suites remain intact and were not rerun. Existing checkout/finance/Housekeeping
  behavior and authorization are not rebuilt.

## Selected unit and contract

Backend overtime/occupancy guard plus audited Owner-only release, with a pure
presentation adapter. No Dashboard/Kamar redesign or new UI controls.

- Authoritative deadline: active `transactions.ends_at`; never scheduled checkout
  or client time. Overtime is strictly server time **greater than** deadline +120
  minutes. No rounding to whole minutes. Exactly 120 is not the overtime gate.
- Every new direct check-in entry (INSERT or reactivation/move other than a
  booking transition) checks outstanding active overtime on that room. Errors do
  not disclose another guest's data.
- Booking INSERT is unaffected. Existing schedule-conflict checks remain in the
  existing RPCs. This PR does not invent different booking availability rules.
- Booking -> check_in UPDATE skips the overtime gate. It still cannot introduce
  another active stay in the room. This is explicit occupancy protection, not a
  hidden new overtime rule for Booking check-in.
- No new stay while ANY former stay remains `check_in`, even when its nominal
  endpoint has passed, room status is incorrectly READY, or Owner released the
  overtime-specific block. Normal legitimate checkout/case resolution must happen
  first. This PR never changes status, deadline, payments or room readiness.
- Row lock on the room serializes normal arrivals. A partial unique index on
  `transactions(room_id) WHERE status='check_in'` is the final concurrency
  backstop. Historic duplicates abort installation; no repair/deletion occurs.
- Same-room updates of an existing active stay are unaffected, preserving
  settlement/extend/checkout workflow. Historical duplicate rows require Owner
  review before installation rather than being silently rewritten.

## Owner release and security

`release_room_overtime_block(transaction_id, reason)` accepts no actor, role,
timestamp or replacement status. It requires `auth.uid()`, the existing
`has_role(...,'owner')` helper and explicit non-restricted Training status.
Supervisor, Receptionist, other/inactive non-Owners, restricted Training (even
with an Owner role), and anonymous callers cannot release.

It locks the selected transaction then room (matching existing resolution RPC
order) and verifies the selected transaction is still active and
strictly overdue. The append-only application audit records transaction/room,
authoritative deadline, Owner ID, server time, fixed action and reason. Callers
must avoid guest PII in the reason. Duplicate release requests for the same
case return the original audit ID without replacing its identity/time/reason.
Changing transaction, room or deadline prevents reuse of an older release.

The release **only removes the overtime-specific gate** for that case. It is
not permission to admit a second guest, forge checkout, override settlement,
mark READY or rewrite history. Resolved/non-overdue/nonexistent cases are
rejected. Once normal checkout resolves occupancy, a new stay does not inherit
the old release. Overtime presentation remains based on the active deadline,
not on whether a release audit exists.

New SECURITY DEFINER functions use empty search_path, schema-qualified objects,
no dynamic SQL and explicit ACLs. The trigger function cannot be called by app
roles; the release is callable by authenticated only with internal Owner guard.
New audit table has RLS, Owner-only SELECT, no INSERT/UPDATE/DELETE grants to
application roles; writes occur solely through the authorized release RPC.
No existing RLS is broadened. Database administrators remain privileged.

## Presentation handoff (prepared, not wired)

`src/lib/room-overtime.ts` returns `needsAction`, `area: PERLU TINDAKAN`,
`cardIndicator: red`, `excludeFromRoomStatus`, and `deadlineKnown` from an
already authorized stay and caller's reactive clock. Invalid timestamps are
not proof of availability. This helper performs no RPC, reads or mutations.

Dashboard/Kamar do **not yet consume this adapter**. Moving rows, showing the
red card and an Owner release action are a later presentation integration;
preserve authorized detail/checkout actions in PERLU TINDAKAN. Do not simply
hide overdue rows and make case resolution inaccessible. Keep Housekeeping
needs_action separate and use complete RLS-scoped operational data; this
helper cannot establish completeness or grant access.

## Focused evidence

Run: `node scripts/room-overtime-tests.cjs`.
Uses isolated PGlite PostgreSQL 0.3.14 from the previous temporary fixture
installation. For another workstation, install the pinned version outside the
repo and set `BTRD25_PGLITE_MODULE` to its module directory. No dependency or
lockfile changes. All identifiers/data are isolated fixtures, not Cloud accounts,
JWTs, DEMO rows or production transactions. Deterministic clock injection is
limited to local copies of SQL; pending source uses the server clock.

PASS:
- >120 versus exactly 120 (including 1ms boundary), WIB year crossover, invalid
  timestamps and non-active statuses; red/area/exclusion adapter outputs.
- Walk-in rejection, unaffected Booking INSERT/other rooms; existing actual
  single-method reservation function aborts guest/payment/idempotency/room writes.
- Existing actual Booking check-in function rejects occupied room with occupancy
  error (not overtime), then succeeds after legitimate fixture checkout.
- Actual existing has_role/Training helper definitions plus local authenticated/
  anon roles exercise Owner release ALLOW/DENY, RLS audit visibility, no direct
  audit tampering, required reason, identity/time/action and idempotent retry.
- Stale release after deadline/room changes cannot bypass the gate. New stays
  do not inherit the release. Release never permits concurrent active occupancy.
- Historical duplicate preflight fails without editing rows; unique index rejects
  a duplicate even if a privileged fixture session disables the trigger; multirow
  arrival failure rolls back all its rows.
- Focused TypeScript check of the new helper, production `bun run build`, diff
  whitespace/scope review. Existing build deprecation/bundle warnings remain.

FAIL: none in final focused checks.

NOT REACHED:
- Cloud schema/definition preflight, SQL application, real logged-in role/RLS
  testing, native concurrent multi-session execution, combined/Training RPC E2E.
- Browser/manual integrated operational acceptance and Dashboard/Kamar wiring.
  Local non-Owner fixture actors test the new Owner-only authorization, not a
  comprehensive employee activation/Training-session or existing finance audit.
  Existing operational helper in Booking/reservation fixture is stubbed; no claim
  that existing operational role checks have been retested.

## SQL approval and next work

Only local pending file:
`supabase/pending/20261113150233_overtime_walkin_guard.sql`.
Before any separately approved execution, verify actual Cloud schema/helpers,
deployment function owner/ACLs (trusted migration role, normally postgres),
existing triggers, duplicate active rooms and index-build locking/maintenance
window. SQL creates an index, audit table/RLS, two functions and one trigger;
does not modify existing reservation/Booking RPC bodies. Execution remains an
Owner decision; this PR alone activates no Cloud behavior.

Subsequent independent functional tasks remain scheduled Booking visibility by
WIB arrival day, then Owner-only policy/settings audit. They are not included.
No Cloud SQL, DEMO/flags, finance rules, global design, Lovable, merge, deployment
or publication. No automatic checkout or transaction-history changes.
