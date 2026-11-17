# Baturaden 25 Homestay — Work checkpoint 17 November 2026 (WIB)

**Status: NO-GO OPERASIONAL SEMENTARA.** This is a review branch, not live activation.
Owner handoff was read in full. No merge, deploy, publish, Cloud mutation, migration,
DEMO reset, flag activation, reconnect, account change or Lovable AI credit use.

## Verified starting points

- GitHub main: `17161ef9aee2bcbf2ab702f3598a43d9b2efdcb1`.
- Lovable source: `3218bd2ebe8fd98a6a046c9fe105d21293de34ca`, unchanged;
  project reports `needs_attention / out_of_credits`.
- Gmail support thread `1a1e51e4fa45c6f2`: exactly the original request and Sam's
  reply from 16 November 23:24 WIB. No subsequent technical recovery confirmation.
  Backend reattach is only proposed; no reconnect was attempted.
- Existing monitor `Automation_ab4d645e4b388191a0a034553351ec93` is enabled;
  recorded last run completed. Latest result content is absent; no inference that
  technical recovery occurred. No duplicate monitor created.
- Cloud SELECT: Room 10 active, `cleaning`, last action `start_cleaning`, checklist
  count **0**. No attempt to complete the checklist or override READY.

## Rule / source / runtime matrix

| Final Owner rule | GitHub | Actual Lovable 3218bd2 | Runtime evidence / limit |
|---|---|---|---|
| Normal checklist → READY | Older navigation exists; this branch adds safe post-commit recovery | Five sections defined; navigation insertion packaged; original save does not handle failed refresh | Room 10 remains cleaning / 0 checklists; browser completion NOT REACHED |
| Checklist warning belongs to same HK job | This branch follows checklist → start_history → matching job_id/job_number + room/TRX | Original independently selects newest checklist per room and includes audit note | Cloud function stores checklist.housekeeping_history_id = start_history.id; finish history retains same job; no mutation test |
| Booking visible only on arrival date WIB | PR #80 local combined review passed | Still separate source; not integrated | Browser NOT REACHED |
| Strict >120 minutes, occupancy retained | PR #81 local combined review passed | Not integrated | Overtime trigger/table/index absent; no backend enforcement claim |
| Owner/Supervisor choose OPEN cash drawer, actual operator retained | PR #82 local combined review passed | Not integrated | Role/session browser and Cloud payment audit NOT REACHED |
| Fixed Pagi/Malam/Harian windows | Pending #56 remains separate | No silent SQL integration | Cloud check_in_booking still derives fixed-window end from calculate_package_stay_times(server_now); pending boundary review remains required |

## Implemented Housekeeping recovery

Actual GitHub source changes on this review branch:

1. Checklist submit uses an immediate in-flight guard. Successful RPC is remembered;
   retry after failed refresh only refreshes, never repeats the committed RPC.
2. PostgREST failures now reach this callback through opt-in
   `refresh({ throwOnError: true })` for rooms/history/checklists. Other callers keep
   the prior non-throwing refresh behavior. Processing state is reset in finally.
3. Answers are frozen during submit, after confirmed commit, and after an uncertain
   RPC outcome; retry preserves the checklist UUID and submitted answers. Both
   returned and thrown transport errors are handled. Closing/remounting is not a
   durable cross-browser idempotency mechanism and still needs real acceptance.
4. Room warnings require an exact relation to the displayed official finished job,
   via its start history row, same room, transaction, job ID and job number. Missing
   legacy identity, override READY, different cycle or ambiguous matches do not
   borrow a different checklist. Audit notes remain stored; only failed items feed
   the warning. This implements #78's cycle gap and #79's audit-note correction.
5. `needs_action` severity / READY SOP remains unchanged (Issue #77).

`patches/housekeeping-operational-lovable-3218bd2.patch` consolidates these fixes
and #76's existing navigation insertion into **five minimal source files** for the
pinned Lovable source. It preserves the newer design and the extra live type export.
Do not also apply #76/#79 patches after this package. Do not replace live pages
with the older GitHub page. Fixtures contain source only, no business records.

## Validation completed

- `node --test scripts/housekeeping-operational-recovery.test.mjs`: **13 PASS**.
  Executes the actual TypeScript save handler / refresh callback through AST extraction
  and transpilation with local fakes, plus actual job-link helper. No network/DB.
- `python scripts/prepare-housekeeping-lovable-review.py` and
  `node scripts/verify-housekeeping-lovable-package.mjs`: **PASS**. Patch checks and
  applies in a disposable copy of pinned source, five-file TS/TSX transpilation and
  integrated callback/navigation assertions pass; same 13 behavioral cases pass
  against the patched source. These are the same cases, not 26 distinct tests.
- GitHub review tree `tsc --noEmit`: **PASS**. `npm run build`: **PASS**.
- Separate disposable combined review of PR #80 head `8abb19317c70a5a80e77c0e694e03ae2e780e5ff`,
  #81 head `ef4ece9a2cd35038953313a580bf17bf3996cbe0`, and #82 head
  `d6153336c5437cf89da4d7dd49d8ce8426d14ec8` on main: patches apply together,
  **22 tests PASS**, full TypeScript and build **PASS**. Both changes to index.tsx
  survive together. These tests include source assertions and representative
  predicates; they do not prove authenticated browser or backend behavior.
- No old Finance, payment, occupancy race, printing or Training PASS suite repeated.
- Dependencies installed locally using package.json ranges, without creating or
  changing a lockfile; this is not a Bun-lock reproduction. Build reports existing
  inputValidator deprecation / path-plugin warnings. No package upgrade committed.
- `git diff --check`: PASS.

**NOT REACHED:** full matching Lovable app typecheck/build, authenticated browser,
real checklist submission and retry, role/RLS, two tabs, print/receipt, runtime
financial acceptance, new database concurrency. No mock result is a Cloud PASS.

## Cloud pending preflight — SELECT only

New metadata/aggregate evidence:

| Check | Observed |
|---|---|
| Rooms with multiple active check_in transactions | 0 |
| public.room_overtime_owner_releases | ABSENT |
| room_single_active_checkin index | ABSENT |
| room_overtime_checkin_guard trigger | ABSENT |
| has_role(uuid, app_role) | Available |
| finance_training_is_restricted(uuid) | Available |
| finance_training_current_user_is_restricted() | Available |

The pending overtime package installs the unique active-stay backstop, release
record/RLS and Owner-only RPC, then the trigger in one transaction. It preserves
occupancy even after Owner release and excludes Booking from the overtime gate.
This inspection is not a migration PASS. Before requesting execution: recheck exact
index/object collisions, grants/role restrictions and current function dependencies;
verify an adequate backup/restore path; test the exact candidate against a disposable
matching schema, including two sessions and rollback. Do not replay historical SQL.

Rollback boundary: abort the transaction before COMMIT on preflight or validation
failure. After COMMIT, preserve release audit records; removal/disable of enforcement
or restore is a separate Owner-approved incident action, not an automatic DROP.
Fixed-window #56 needs separate exact-function review and acceptance; do not combine
its RPC replacement blindly with the independent overtime trigger installation.

## Integration and acceptance gates

1. Obtain safe original-repository reattach confirmation from Lovable Support.
   Then re-read both SHAs and compare direction of sync before any source transfer.
2. Recheck/apply the exact five-file package only to matching source; if SHA/context
   changes, regenerate and review. Integrate #80/#81/#82 function changes selectively
   while preserving current Lovable design. Full matching app typecheck/build first.
3. Ask Owner for one concrete, scoped Cloud test authorization only when the matching
   UI is ready: Room 10 normal checklist, same job/TRX, exactly one checklist and one
   finish history, resulting READY, and readback after refresh/retry. No override.
4. Complete pending backend candidate validation before a separate SQL approval;
   execute only the approved candidate and verify runtime. Then required end-to-end
   acceptance and final Owner GO decision.

Checkpoint preparation: **4/6 = 66.7%** (source verification, HK package/tests,
combined GitHub review, Cloud read-only preflight completed; live integration and
browser/Cloud acceptance outstanding). This is not total application completion.
Current blocker is safe source integration, not a request to merge old branches.
Support recovery has not arrived. No claim of continuous execution after this task
ends; the existing monitor remains separate.

## Delivery permission boundary

The local implementation commit is `8f23779d386619caca24fd428ec5216e99ab0c60`.
Push was rejected by automatic approval review: external repository mutation and
potential disclosure were judged to need explicit push authorization. No alternate
mutation path was attempted. A subsequent read-only `git ls-remote --heads origin
fix/hk-operational-consolidated-20261117` returned no branch. The branch is local;
no PR was created. Owner approval requested only to push this review branch and
open one DRAFT PR against main, without merging or activating anything in Lovable.
The proposed PR description is preserved in `WORK_HK_PR_REVIEW_2026-11-17.md`.
