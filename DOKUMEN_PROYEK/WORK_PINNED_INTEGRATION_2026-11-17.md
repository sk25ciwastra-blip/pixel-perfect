# Baturaden 25 Homestay — pinned-source integration checkpoint

17 November 2026, WIB. **NO-GO operational; review candidate only.**

## New progress

The actual Lovable functional source at `3218bd2ebe8fd98a6a046c9fe105d21293de34ca`
was exported read-only: 175 application/config text files, including complete
TS/TSX/CSS source, current package.json and tsconfig. It was overlaid in a disposable
local checkout, preserving existing binary assets from GitHub. Binary asset visual
parity was not independently verified; no environment file or credential was fetched.
Current Lovable dependencies were installed locally without committing a new lockfile.

One eight-file candidate combines:

- #83 Housekeeping commit-aware retry / strict refresh / exact job checklist link;
- #76 navigation, #79 audit-note indicator correction (do not double-apply);
- #80 arrival-date WIB Dashboard predicate;
- #81 >120 minutes action queue, guarded Detail/Check-out and occupied KPI;
- #82 explicit OPEN cash drawer selection and same-tab consumer refresh.

The current Kamar card markup, status popup and background are retained. Overtime
uses a conditional red ring and status text on that card, rather than importing the
older GitHub card. The newer Dashboard success popup and transaction typography
are preserved. Session context remains per-tab; cross-tab role/payment behavior is
not claimed. No SQL, price, finance, severity SOP, flag or authorization rule changed.

**Candidate:** `patches/operational-integration-lovable-3218bd2.patch`.
This supersedes the smaller Housekeeping-only package for a combined integration.
Choose one package; do not layer #76, #79 or the five-file package over it.
The main GitHub application source still contains the HK fix only; the combined
candidate is specifically an offline patch for the newer Lovable source, not a claim
that all four features are active after merging this PR.

## Evidence and limits

| Check | Result | Scope |
|---|---|---|
| Full TypeScript `tsc --noEmit` | PASS | Exported latest Lovable source + all candidate changes |
| Full `npm run build` | PASS | Same source/dependencies; existing binary assets reused |
| HK actual-handler / helper / refresh tests | 13 PASS | Against patched live-source candidate, local fakes |
| Booking + assisted-session focused tests | 13 PASS | Against candidate; source assertions / representative logic |
| Whole eight-file patch check/apply, TSX transpilation, combined invariants | PASS | Disposable copy of seven exact original fixtures + new helper |
| Native PostgreSQL 17.11 concurrency / constraint tests | 5 PASS | Actual pending overtime trigger/index; minimal fixture schema |
| Chromium checklist DOM acceptance | **4 PASS** | GitHub-hosted Ubuntu 24.04, Playwright 1.56.1; actual checklist component with fake data/RPC, no external browser requests |
| Authenticated normal HK acceptance | 1 live DEMO job PASS | Owner-authorized Room 10 normal submission; one checklist/finish, same job/TRX, READY. Candidate integration/multi-role acceptance remains NOT REACHED |

The same 13 HK cases were used to validate the packaged patch and candidate; they
are not additional distinct tests. The 26 focused candidate cases include structural
assertions, not a comprehensive browser/RLS test suite. The old Finance/Training/
payment/printing suites were not repeated.

### Patch application failure caught and corrected

The prior offline fixture had one extra trailing blank line introduced while copying
source. Its generated checklist hunk included EOF cleanup and failed against a fresh
actual export. Fixtures were corrected, both packages regenerated, and the full
candidate now checks/applies against the actual source. This was a real integration
failure, not a Cloud/runtime failure. Original fixture bytes are retained for review.

### Native concurrency details

The launcher creates a new local cluster on a dynamically allocated localhost port,
checks its exact data directory before any test write, and stops/removes it afterward.
No Cloud connection string, DEMO data, account or credential is used.

Actual pending `20261113150233_overtime_walkin_guard.sql` is executed unchanged in
that fixture. Two distinct native PostgreSQL backend PIDs are verified, with an
observed lock wait before committing the first arrival. Cases:

1. Direct arrival vs direct arrival: exactly one active stay.
2. Booking conversion vs Booking conversion: exactly one active stay.
3. Direct arrival vs Booking conversion: exactly one active stay.
4. Unique-index backstop still rejects duplicate occupancy when a fixture admin
   bypasses triggers.
5. An unrelated room remains usable while another room is locked.

This closes the native two-session concurrency evidence gap for the candidate
trigger/index only. Authorization helper stubs are deliberately non-permissive and
are not tested here; no claim of real Cloud role/RLS, payment RPC, Training wrapper,
Owner release or live schema compatibility PASS.

Reproduce with a local PostgreSQL 17 binary directory:

```sh
python scripts/run-overtime-native-concurrency.py --pg-bin /absolute/path/to/pgsql/bin
node scripts/verify-operational-lovable-integration.mjs
```

The browser harness is prepared at `scripts/housekeeping-browser-local.test.mjs`.
It uses an actual checklist component with fake data/RPC and rejects non-localhost
requests. Its four DOM cases subsequently passed on a GitHub-hosted runner after specific
Owner approval; the original Work browser launch remains historically blocked.
Its fake callbacks must not be mistaken for Cloud transactions.

## Current release gate

Support thread still has only the original request and Sam's 16 November reply.
Lovable SHA remains 3218bd2 and reports out_of_credits. No reconnect or AI message
was sent. The existing response monitor was not duplicated.

**Do not merge GitHub and assume the latest Lovable app is updated.** First confirm
safe original-repository reattach, inspect both resulting SHAs and sync direction,
then apply/review the minimal combined patch to the matching source. If source
changes, recheck context and regenerate; never force application or overwrite pages.

The Owner-authorized Room 10 test has now completed on the existing live source:
seven answers passed, normal submit once, one checklist and one finish history,
same start history/job/TRX, room READY and operator Owner (UI + separate SELECT).
This did not use override READY or activate the candidate SQL/source. Do not rerun
this passing case merely to refresh the report. Full candidate integration and
multi-role acceptance remain separate. Pending SQL activation needs backup/rollback
readiness and specific Owner approval.

Checkpoint integration preparation: **6/7 = 85.7%** (source export, combined patch,
full typecheck, full build, native concurrency and isolated component-browser
acceptance complete; live integration outstanding). This is not total application
completion. Authenticated multi-role/Cloud end-to-end acceptance is still required
after integration before any operational GO.

No merge/deploy/publish, direct Cloud SQL write, DEMO reset, flags, reconnect or Lovable credit
use. The only authorized live write was the one normal Room 10 checklist submission. Owner's latest “ok lanjutkan” authorizes continued technical/review work; it is
not treated as approval for those release actions.

## Verified hosted-browser result — 17 November 2026, 07:46 WIB

Specific Owner approval was received for the four isolated browser cases and a
maximum 10-minute job. Run [43990081701](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/43990081701),
job [133728128319](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/43990081701/job/133728128319),
completed **success**. Logs show all four PASS lines and the final assertion:
4 real browser cases PASS; no external requests and no Cloud writes.

Tested PR source head: `d943c392661e5126603ff41c7eb7c6e1801a4cf8`; GitHub's
disposable test merge ref: `6f5fcec...`, not a merge into main. Node v22.23.4,
Playwright 1.56.1, Ubuntu 24.04. Tested component uses actual code, real Chromium DOM,
and deliberately fake data, primitive Button and RPC/callbacks. This is not the
full styled Housekeeping route, authenticated role/RLS or live Room 10 acceptance.

Cases: empty answers send no RPC; post-commit refresh failure retries refresh only;
returned RPC error freezes answers and retry keeps UUID; processing disables submit.

Initial run [43989884664](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/43989884664)
failed installing Chromium because ubuntu-latest was Ubuntu 26.04, unsupported by
the pinned Playwright. No browser case ran there. Pinning Ubuntu 24.04 resolved it;
application source was not changed. Existing action Node-20 deprecation warnings
were nonfatal and left outside this task's scope.

Automatic pull-request triggering was removed after success; workflow is manual-only
on this review branch, preventing ordinary PR updates from repeating these passing
cases. Both workflow/template use the supported image. No application changes were
needed for the browser result; no merge, deploy, publish, Cloud mutation or flags.

## Additional access and race verification — 17 November 2026 WIB

Six new native cases PASS in `scripts/housekeeping-native-access-races.test.mjs`.
Unlike the older fixture, this suite grants anon RPC EXECUTE matching the current
Cloud ACL; anon with null identity is denied by the actual function/helper code.
Other new cases: inactive HK employee, inactive room, unauthorized replay of a known
UUID, original transaction rollback while retry waits, and same UUID raced across
two different rooms. Only new cases ran; prior 15 were not repeated. Current Cloud
RPC fingerprint remains 2756ae72d61632458a5688b037526d75; pending SQL is not active.

This uses SQL roles with fixture identity settings, not actual JWT login or full
Cloud RLS/Training. All new cases passed without requiring another product-code fix.
Preparation remains 6/7 = 85.7%; new local access/race checks 6/6 = 100%, scoped only.
Next independent task: reconstruct matching Cloud room/transaction trigger and RLS
fixtures for combined local operational acceptance, using SELECT-only exports and
synthetic accounts. It can begin without Owner approval. Applying migrations,
live transaction tests or source integration remain separately gated.
