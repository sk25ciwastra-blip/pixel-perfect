# P0 Walk-in: required RPC argument name (16 November 2026)

Authority: [Issue #2, Owner handoff 6913111383](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/2#issuecomment-6913111383).

## Baseline and source mapping

- Clean tracked working tree before work. New branch `fix/walkin-rpc-contract-20261116`
  starts from fetched GitHub `main` `17161ef9aee2bcbf2ab702f3598a43d9b2efdcb1`.
- The Lovable audit commit `d7e74184c56ee9c6a4ad2c3c958ba87a3fbd71b8` is
  reported by Owner, but GitHub's commit API returns 422 (commit not found in this
  repository). This patch cannot establish parity with that unpublished source.
- `src/components/formulir-pemesanan.tsx`, `save`: Booking builds the selected
  date/time with explicit `+07:00`; Walk-in deliberately has no scheduled date.
  Previously the conditional spread omitted `_scheduled_check_in` for Walk-in.
- `src/lib/data-live.ts`, `rpc`: forwards argument names unchanged to Supabase;
  its permissive compatibility typing does not enforce generated RPC contracts.
- `src/integrations/supabase/types.ts`, `create_reservation`: three overloads all
  declare `_scheduled_check_in` as required. This matches the required-name
  metadata reported by Owner (not a new Cloud query by Codex).
- `supabase/migrations/20261015000002_finance_150_supervisor_alignment.sql`,
  `create_reservation`: rejects a null schedule only for Booking; Walk-in calls
  `calculate_package_stay_times(_package_id, now())`, with WIB operational date.
  Local historical SQL declares defaults; Cloud metadata does not. Sending null
  explicitly is compatible with both contracts without fabricating client time.
- `supabase/migrations/20261018000000_finance_training_enforcement.sql` forwards
  the schedule through the Training wrapper after its session guard.
- `supabase/migrations/20261104000000_atomic_combined_payments.sql` accepts the
  same nullable schedule and uses server time for Walk-in. Both frontend payloads
  now include the key, including their Training dispatch routes.
- `src/routes/booking.tsx` continues calling `check_in_booking` (or its existing
  Training wrapper) with the selected transaction ID. No reservation is recreated.

## Scope and verification

Production diff: two conditional spreads replaced with explicit nullable arguments,
plus one explanatory comment. No SQL, generated types, RPC wrapper, financial
calculation, authorization, occupancy guard, UI layout, feature gate, or data change.
No cache reload, new overload, migration or database permission is required by this
source fix.

`bun test scripts/walkin-rpc-contract.test.ts`: **PASS**, 8 tests / 52 assertions.
Tests extract and execute the actual submit handler with isolated closure fakes:

- Exact single-payment wire keys with extra-guest gate off/on, explicit null,
  session and request key retained; extra-guest fixture includes Rp50,000.
- Booking at 00:05 WIB retains its exact selected timestamp and UTC equivalent;
  a missing Booking schedule dispatches nothing.
- Normal/Training and single/combined routing retain the nullable schedule and
  existing session/component idempotency keys.
- Server error remains visible; failed retries keep payload/key and do not report
  success or refresh. Successful response refreshes once and rotates the key.
- Missing cash session or unresolved assisted-session context dispatches nothing.
- Installed Supabase SDK sends the JSON body through an injected local fetch:
  legacy omission fails a model of Owner's required-name contract; explicit null
  succeeds. This is **not** a live PostgREST or PostgreSQL test.

`bun x tsc --noEmit`: **PASS**. `git diff --check`: **PASS**.
Unrelated previously PASS suites (#73/#74, Finance, closing, Housekeeping,
concurrency, receipts) were not run. No native database smoke was necessary for
this argument-only fix. No new database-function or role/RLS execution claim.

## GO / NO-GO and next acceptance

| Gate | Status | Decision |
| --- | --- | --- |
| Required-name mismatch in GitHub source | PASS | GO for DRAFT review only |
| Owner browser / actual Cloud schema-cache dispatch and guards | NOT REACHED | Walk-in operational NO-GO pending authorized runtime acceptance |
| Whole application temporary operations | NOT REACHED | Overall NO-GO remains |

P0 remaining: reconcile the reviewed source with the published application's
source and, after separate Owner authorization for runtime writes, verify one
Walk-in through the real application against the actual deployed function. Check
session, server time/WIB boundaries, one transaction/payment, and normal rejection
handling. Isolated tests cannot establish this acceptance or authorize publication.

No merge, deploy, publish, Cloud SQL, DEMO mutation, flag change or Lovable use.
