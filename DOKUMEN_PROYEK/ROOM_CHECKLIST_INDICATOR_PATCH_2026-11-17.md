# ROOM ❌ checklist indicator — Lovable source-only patch

**Date:** 17 November 2026 WIB  
**Project:** Baturaden 25 Homestay  
**Lovable project:** `017f6e78-15f2-4d07-a38c-87cb185279bf` (Kozan)  
**Pinned source commit:** `3218bd2ebe8fd98a6a046c9fe105d21293de34ca`  
**Issue:** #78  
**Separate change:** PR #76 Housekeeping navigation  
**Status:** REVIEW PACKAGE ONLY — NOT INTEGRATED, NOT DEPLOYED

## Why this patch exists
The pinned Lovable `src/routes/kamar.tsx` renders the red ❌ indicator when `formatIssueDetails(checklist)` yields one or more elements. The function currently includes the full `checklist.issue_note.trim()` even if all seven checks were positive; the live `complete_housekeeping_checklist` RPC stores positive `CENTANG` lines in that audit note. Consequently a completed all-pass checklist can be reported as a visual room problem.

The authorized Owner rule AB-UI-ROOM-003 specifies ❌ for actual shortages/damage from official Housekeeping data only. No change to the room READY behavior is authorized by this package.

## Exact change
`patches/room-checklist-issue-indicator-lovable-3218bd2.patch` removes the **single line** appending `checklist.issue_note.trim()` to a UI-only list of failing item reasons. All seven explicit `!checklist.<item>_ok` guards remain unchanged, as do reason fallbacks, audit note storage, Housekeeping history and details, CSS, roles, RPC and database.

### Integration safeguards
- Only apply to the **same Lovable commit or a proven matching route**; GitHub main and Lovable are known to have diverged. Never replace the newer page with GitHub's older source.
- Current GitHub Git Sync is disconnected; merging this review package into main **does not patch Lovable**.
- Review exact file diff, then run matching-app targeted typecheck/build and authenticated UI tests. Verify a passed checklist displays **no ❌**, one failed item displays **only that item**, multiple failed items show only failures, and no checklist generates no fabricated problem.
- Independently examine cycle parity: current room view picks the latest ready HK history by room and the latest checklist by room, without joining on matching job IDs. Do not accidentally combine a prior failed cycle with a newer passed HK record. **This cross-cycle concern is not fixed in this one-line patch.**
- Do not alter `needs_action → ready` semantics without a separate Owner-approved policy (Issue #77).
- Do not use override READY, direct SQL writes, Cloud migrations, Lovable AI credits, merge, deploy, publish or feature-flag changes.

## Validation boundary
The actual pinned source was inspected read-only and the target deletion occurs exactly once; a standalone review patch has been prepared. **No full app typecheck, local runner, browser acceptance, runtime Housekeeping checklist, or code deployment was executed**. Keep this PR DRAFT until those gates pass.

Room 10 remains cleaning under the latest confirmed runtime checkpoint. Previously passed transaction/checkout tests should not be repeated.
