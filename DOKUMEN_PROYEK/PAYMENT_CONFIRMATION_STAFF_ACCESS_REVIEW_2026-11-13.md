# Payment Confirmation staff access — review only

Issue #45 Owner decision:
https://github.com/sk25ciwastra-blip/pixel-perfect/issues/45#issuecomment-6831460715

Base main: `c8297fbc6e7e49a75533d162f21f283ea1b8781a`.
This document supersedes the Owner-only PDF limitation in the Stage A handoff
**as a proposed implementation**, not as a statement of Cloud activation.

## Permission contract

- ALLOW authenticated Owner, active Supervisor and active Receptionist.
- DENY restricted Training even with valid assisted-session context; inactive
  employees, anon, other positions, absent user-role records and unavailable TRX.
- Training restriction is checked before the base role. PASSED/NONE may use the
  normal base role; ACTIVE, FAILED, REVOKED and unresolved/expired restriction deny.
- Server uses `auth.uid()`, `has_role`, `has_employee_position`,
  `finance_training_is_restricted`, then explicitly checks the selected transaction
  with the existing `transactions_read` / `transactions_supervisor_read` predicates.
  No implicit caller RLS assumption in SECURITY DEFINER; no creator/shift/session
  ownership restriction added. Review these predicates against live policies before
  future execution; if operational visibility changes, this contract must change too.
- These roles currently have broad operational transaction visibility. They may
  request the document projection for each permitted transaction; this is not an
  own-transactions ACL. No manual grant table and no refund table policy widening.

## Pending SQL (NOT APPLIED)

`supabase/pending/20261112175446_payment_confirmation_refunds.sql` was generated
using CLI migration-new, then placed in pending per AGENTS.md. It is outside the
automatic migration directory. No Cloud command or query was run for this work.

The one RPC `read_payment_confirmation_refunds(_transaction_id uuid)` returns
one scalar JSON envelope:

- `schema_version:1`, `actor_id`, `transaction_id`, `complete:true`;
- `refund_count`, `refunds` ordered by created_at/id with only
  id, transaction_id, amount, created_at, refund_method;
- `payment_count`, `payment_digest`, `ledger_revision` metadata.

No refund reasons, creators, funding sources, allocation details or commissions
are exposed. Complete empty arrays mean no refund; errors, missing RPC, malformed
or mismatched envelopes are never treated as zero. One JSON result avoids an API
row cap truncating refund rows. More than 10,000 payments/refunds or an envelope
over 8 MiB is rejected, not truncated.

Security: STABLE read-only function, SECURITY DEFINER required for complete refund
projection, empty search_path, qualified objects, no dynamic SQL; owner postgres
as for existing finance RPCs. Only authenticated receives EXECUTE; default grants
for PUBLIC/anon/service_role are revoked. There are no table grants, policy changes,
financial writes, print requests, service-key browser credentials or new data tables.
Owner must review this privileged ownership and object/helper permissions before use.

## Consistency boundaries

The RPC computes a revision over the selected transaction and full ordered payment
and projected refund sets in its statement snapshot. The loader calls it before
and after existing RLS reads, validates actor/TRX/count/completeness, and rejects a
changed revision or refund list. Direct paginated payments must match the RPC count
and SHA-256 digest. Digest input is ordered arrays of string ID, string TRX ID,
integer cents as text, UTC millisecond ISO timestamp, kind and method.

The MD5 revision is an equality/change token, not an authentication credential;
it is not accepted as authorization. Role and Training checks run on every call.
The client binds its document revision to actor ID too. The unchanged builder
performs monetary/snapshot/history validation and net-paid calculations.

After rendering the PDF, actions reload/recheck access and revision before local
Blob save. WhatsApp requires the same downloaded TRX, phone and ledger revision,
then freshly rechecks access before navigating the synchronously reserved neutral
tab. Changed/revoked state blocks output; attachment stays manual.

This is **not an atomic financial export** across client reads or until browser
save. A later concurrent commit, or a change reverted between checks, remains
possible. Guest/config changes are not all covered by the financial revision.
No saved/downloaded file can be revoked retroactively. Fully atomic immutable
exports would require a separately approved snapshot/export design.

## Frontend and rollout

Owner-only guard is replaced by the authorized refund RPC for all eligible roles.
The shared hook exposes a UI capability derived from readiness, active login,
position and Training state; server remains authoritative even if UI context is
stale. Booking and Detail already share this hook/component; their layouts and
routes were not edited. No PDF/thermal renderer or financial builder was changed.

Cloud still lacks this proposed RPC unless Owner separately approves execution.
Do not deploy the frontend ahead of the SQL: unavailable RPC causes fail-closed
PDF errors for Owner as well as staff. No fallback to partial direct refund reads.
After future approval, review live helpers/policies/privileges, approve the pending
SQL, apply through the agreed migration process, refresh schema cache as needed,
then verify authenticated Cloud integration before separately approving deployment.
No activation/deployment is authorized by this PR.

## Focused validation

- PASS `node --test scripts/payment-confirmation-refunds-sql.test.cjs`: one local
  PostgreSQL/PGlite test with real SET ROLE and RLS. Checks eligible roles,
  inactive/other roles/anon/unknown actor/unavailable TRX deny, restricted Training
  deny even with modeled valid context, FAILED/REVOKED deny and PASSED allow,
  unchanged refund policy and direct table isolation, other creators included,
  transaction isolation, empty complete result, deterministic order, 207 refunds,
  payment digest parity/change detection, hardened metadata and execution grants.
  Uses existing repository helper definitions where applicable. Auth JWT extraction
  and the valid assisted-context helper are modeled fixtures, not live Supabase auth.
- Local DB dependency: `@electric-sql/pglite@0.3.14` installed in
  `%TEMP%/BTRD25-pdf-db-test` with no project package/lockfile modification.
  Reproduce install with `npm install --prefix <TEMP>/BTRD25-pdf-db-test
  --no-package-lock --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.3.14`.
  SQL executes only in the fresh in-memory instance; test accepts no DB URL.
- PASS `bun test scripts/payment-confirmation.test.ts -t
  "RLS-scoped|staff PDF access|refund completeness|success/close"`: 4 affected tests,
  328 assertions. Tests SDK read-only HTTP transport, role gates, 205 refunds,
  net-paid partial state, malformed/incomplete/cross-TRX/actor/version payloads,
  missing RPC, changed access/ledger, omitted/tampered payments and shared UI wiring.
  POST is allowed only for this read RPC; table reads are GET, no mutation endpoints.
- PASS `bun test scripts/payment-confirmation-whatsapp.test.ts -t
  "requires successful|reserves synchronously|blocked popup|denied access|clear/logout|manually closed|ledger|WhatsApp rejects"`:
  8 affected action tests, 40 assertions; a failed post-render recheck prevents save,
  stale ledger prevents WhatsApp, and original safe tab reservation/cancel behavior
  remains. The browser adapter test not affected by this change was filtered out.
- PASS `bun test scripts/payment-confirmation-ui-access.test.tsx`: shared component
  SSR, one test/33 assertions for allowed/denied roles, Training, inactive login,
  download-first disabled WA and honest denial notice. No SDK or network involved.
- PASS `node node_modules/typescript/bin/tsc --noEmit -p scripts/tsconfig.payment-confirmation.json`;
  focused config now includes the affected shared component.
- PASS final diff scope/check. No previous PDF/layout/thermal/full-build suite rerun.

NOT REACHED: live Cloud function/policy parity, production JWT/session integration,
browser E2E role switching and actual download/WhatsApp attachment/delivery.
Local role/RLS PASS does not claim hosted integration PASS. No Cloud/DEMO/flags,
Lovable, merge, deploy or publish. SQL execution still needs explicit Owner approval.
