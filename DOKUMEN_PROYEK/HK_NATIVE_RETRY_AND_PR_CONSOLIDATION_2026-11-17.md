# Baturaden 25 Homestay — native Housekeeping repair and consolidation

17 November 2026 (WIB). **New executable repair; Cloud remains unchanged.**

## Concrete defect reproduced

The current Cloud `complete_housekeeping_checklist` body (MD5
`2756ae72d61632458a5688b037526d75`) checks for an existing UUID before locking the
room. With two native sessions using the same UUID, both can initially see no
checklist. Session A completes and commits; B waits for the room lock, sees READY,
and raises `Kamar tidak sedang dibersihkan` instead of replaying the successful UUID.
The new harness reproduces this on the exact read-only snapshot before installing
the candidate locally. This is a native local reproduction of actual Cloud code,
not an executed Cloud transaction.

## Minimal pending fix

`supabase/pending/20261117081000_housekeeping_retry_after_room_lock.sql` rechecks
the same UUID after acquiring the room lock and before rejecting the now-READY
room. A different room still rejects that UUID. No caller-supplied operator, READY
override, new table, index, policy, grants, account, flag or severity rule is added.
`CREATE OR REPLACE` preserves the existing owner/ACL and function signature.

The package has a source-fingerprint preflight, existing SECURITY DEFINER/search_path
checks, 5-second lock timeout, 60-second statement timeout, atomic transaction and
candidate-fingerprint postcheck. It accepts the original/current candidate hash only;
source drift aborts rather than overwriting another change. Candidate body MD5:
`8c9dbcabf70646f89c047291cd81c0f2`.

## New evidence — 15/15 focused native cases PASS

Run only this new suite:

```sh
python scripts/run-overtime-native-concurrency.py \
  --pg-bin /absolute/path/to/postgresql-17/bin \
  --test-script scripts/housekeeping-native-readiness.test.mjs
```

The existing isolated launcher now accepts a choice of the old overtime test or the
new HK test; this run chose HK only. Prior passing overtime/browser/Finance suites
were not rerun. PostgreSQL 17.11 used two distinct backend PIDs and an observed room
lock wait. A new local cluster, random localhost port and exact data-directory check
prevent a remote target; the launcher stops and removes the fixture afterward.

1. Existing RPC execute ACL survives replacement.
2. Same UUID race returns the same UUID to both callers, exactly one checklist and
   one finish history, room READY.
3. Correct start-history/job/TRX and original operator retained.
4. Different UUID race cannot duplicate completion.
5. REPEATABLE READ produces safe serialization failure; fresh-transaction retry
   returns the existing UUID.
6. Post-commit replay appends no history and does not rewrite the operator.
7. A UUID already used for another room cannot change that room.
8. Actual Cloud role-helper definitions allow fixture Owner/HK/Supervisor and reject
   receptionist/null identity; this is not signed-session or full Cloud RLS acceptance.
9. NULL answer / missing X reason abort before writes.
10. `needs_action → ready` behavior remains unchanged, per #77's policy boundary.
11. Missing start history cannot complete READY.
12. A forced finish-history failure rolls back the checklist and room update atomically.
13. A later real room cycle uses its new job/start history/TRX.
14. Candidate reapplication preserves ACL/data.
15. Unexpected function-body drift aborts without replacing it.

Fixtures retain the actual Cloud RPC, can_housekeeping, has_role,
has_employee_position and room-transition trigger definitions. The checklist table
is taken from the existing migration. Native fixture uses matching unique checklist
UUID/history indexes and relevant FK/job relations, confirmed SELECT-only on Cloud.
Fixture auth.uid reads a local setting, not a real JWT. Full audit, Training and all
Cloud RLS/policies/triggers are not reconstructed; no such runtime PASS is claimed.

## PR #75–#83 consolidation — no new PR

| Item | Disposition for implementation |
|---|---|
| #75 Walk-in schedule argument | Current pinned Lovable already contains explicit nullable argument; do not apply/merge a duplicate repair blindly. Prior contract PASS preserved. |
| #76 HK navigation | Included in #83's combined eight-file live-source patch. Do not also apply #76 patch. |
| #77 | Issue, not PR: business severity question preserved. This SQL does not change its rule. |
| #78 | Issue, not PR: warning derived only from actual failed items and correct job; handled by #83's candidate. |
| #79 indicator patch | Superseded for integration by #83's exact-job/failed-item implementation. Do not double-apply. |
| #80 Booking arrival date | Included selectively in #83's live-source package; original PR retained for review/history. |
| #81 overtime UI | Included selectively, preserving actual live card design; does not activate backend overtime guard. |
| #82 assisted session | Included selectively; browser multi-role/multi-tab and payment/audit acceptance still separate. |
| #83 | Single review/integration entry point: eight-file source package plus this separately gated SQL repair and native evidence. Nothing activated by merge alone. |

No PR closed, merged or recreated. Drafts remain review records; this mapping avoids
blind merging or double application. An audit is not a declaration of operational GO.

## Remaining approval gates

This specific HK SQL has **NOT** run on Cloud. Before asking for execution: retain
an adequate backup/restore path, recheck source fingerprint/owner/ACL and target,
review coordination with other pending changes, then obtain specific Owner approval.
Before COMMIT, any failure rolls back the function replacement automatically.
After COMMIT, a separately approved reversal can restore the exact original RPC
snapshot via CREATE OR REPLACE, preserving data/ACL; do not delete completed records.

Sync recovery remains with Support. Independent native work proceeded without waiting
for it. Live integration, real Room 10 checklist acceptance, role/RLS/Training/finance
end-to-end and final Owner GO remain outstanding. No Cloud writes, merge, deploy,
publish, Lovable credits, reset or feature flag change occurred.

New-suite progress: **15/15 = 100% local**, not app completion. The earlier frontend
integration-preparation checkpoint remains 6/7 = 85.7%; this new pending backend
repair adds a separate approval/runtime gate and is not counted as active readiness.
