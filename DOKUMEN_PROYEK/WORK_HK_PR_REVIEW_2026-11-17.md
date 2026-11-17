# Proposed DRAFT PR

Title: fix: recover Housekeeping refresh safely and bind warnings to the correct job

Base: main
Head: fix/hk-operational-consolidated-20261117

After a checklist RPC commits, a failed table refresh previously left staff able to
submit again. The submit handler now remembers the successful commit and retries
only refresh, handles returned/thrown errors, freezes submitted answers when the
outcome is uncertain, and blocks concurrent clicks. Opt-in strict table refresh
surfaces PostgREST failures to this callback without changing background callers.

Room warnings now link the displayed completed HK job to its exact start history
and checklist, validating room, transaction, job ID and job number. Different cycles,
legacy missing identity, overrides and ambiguous matches do not inherit warnings.
Full audit notes are retained; warning text comes only from failed checklist items.
No change to Issue #77's needs_action/READY severity policy.

Includes a single five-file minimal offline patch for actual Lovable SHA 3218bd2,
including the existing #76 navigation insertion and superseding #79's indicator-only
patch for integration. GitHub main is older and divergent: do not copy whole pages
into Lovable, or apply #76/#79 in addition to the consolidated patch.

Validation: 13 actual-handler/helper/refresh tests PASS; patch check/apply plus five-file
TSX transpilation and patched-source behavioral tests PASS; GitHub review branch full
TypeScript and build PASS. A separate combined review of #80/#81/#82 passed 22 focused
tests, TypeScript and build. Those PRs are not included/merged by this PR.

Cloud SELECT only: Room 10 remains cleaning / 0 checklists; overtime objects absent;
0 rooms with duplicate active check-ins. No authenticated browser or mutation PASS.
Full matching Lovable build/role/RLS/retry/concurrency acceptance NOT REACHED.

NO-GO operational. No merge/deploy/publish, Cloud SQL/data, flags, reconnect or Lovable
AI credit use. Existing Support recovery is still pending. See the checkpoint file
for source SHAs, exact evidence limits, integration gates and pending SQL review.
