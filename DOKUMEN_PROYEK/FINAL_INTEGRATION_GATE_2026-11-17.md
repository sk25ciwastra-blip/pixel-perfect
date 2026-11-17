# Baturaden 25 Homestay — controlled integration package

17 November 2026 WIB. Review preparation only; operational NO-GO.

## New combined evidence

`operational-trigger-rls.test.mjs` reconstructs actual Cloud columns/defaults/enums,
11 room/transaction triggers, Training helper definitions, four-table RLS expressions
and table ACLs exported SELECT-only. External FKs/checks, full HK schema and JWT/API
transport are excluded. Synthetic data only, new disposable PostgreSQL cluster.

11 new cases PASS: Owner direct transaction INSERT denied; HK room writes filtered;
Investor finance/operations visibility; anonymous read filtering; TRUNCATE ACL repair;
identity numbering/immutability; Owner room transitions/audit; deferred DP rollback;
Training context guard; competing occupancy with all triggers; no audit residue from
rejected occupancy. Race uses two connections and observes the losing lock wait.
This expands prior minimal-fixture occupancy evidence; no six-case suite repeated.
An initial audit expectation omitted the room INSERT event; corrected to count both
INSERT and UPDATE, then the new suite passed. No application trigger fix needed.

Cloud aggregate inspection found zero rooms with multiple active check_in records.
This is current data inspection, not proof of concurrency safety in Cloud.

Three further Training-context cases PASS: valid supervisor OPEN session records
trainee operator and responsible supervisor separately; closed session and different
Owner OPEN session are rejected. These are SQL fixture contexts, not signed logins.

## Concrete pending ACL repair

Actual Cloud ACL grants TRUNCATE to anon/authenticated on rooms, transactions and
both HK tables. PostgreSQL TRUNCATE bypasses RLS. Reproduced only on local rooms,
inside a rolled-back transaction. Pending `20261117093000_operational_truncate_acl.sql`
revokes those grants; local anon/authenticated attempts are then denied. No Cloud
execution and no claim that REST/browser currently exposes arbitrary TRUNCATE.
Existing foreign-key dependencies are not reconstructed in the local reproduction;
they may require a wider TRUNCATE statement, but do not make RLS protect TRUNCATE.

## Source recovery and integration sequence

1. Support confirms original repository association. Read both actual heads; do not
   connect a new repository or overwrite a newer Lovable design with GitHub pages.
2. Export/checkout the actual recovered source in a separate clean review branch.
   Run `python scripts/preflight-operational-source.py --source-root /path/to/source`.
   It compares all eight paths to pinned original bytes, checks package hashes and
   clean checkout. Any drift stops integration and requires selective rebase/review.
3. After explicit Owner integration authorization, apply only
   `patches/operational-integration-lovable-3218bd2.patch` once. Do not also apply
   #76/#79 or the smaller five-file HK patch. Do not blindly merge #80/#81/#82.
4. Review the eight-file diff, preserve original layout/assets, then focused typecheck,
   build and tests affected by the actual integrated source. Previously passing
   unchanged suites are not rerun just for reporting.
5. Database packages remain separate approvals: fixed-window boundary, overtime
   guard, HK UUID retry and TRUNCATE ACL. Capture current definitions/ACL/indexes,
   check drift, active occupancy duplicates and backup/restore readiness first.
   Each package requires its own preflight and postcheck; source acceptance grants
   no SQL permission. No automatic execution order or all-in-one migration offered.
6. Perform approved authenticated role/session and end-to-end acceptance against the
   integrated source. Preserve the prior one-room live HK PASS; test it again only
   if the integrated change requires that regression.
7. Owner decides GO, publication and DEMO handling separately.

## Recovery preparation

Keep recovered source SHA and review diff before integrating. A source failure is
handled with a normal revert on the review branch, preserving published history.
Do not reset/force-push synced history. For SQL, save exact original function/ACL
metadata before any approved execution. HK original function snapshot is retained;
ACL restoration would re-grant the captured privileges and therefore needs explicit
approval. Do not drop an occupancy backstop or restore unsafe ACL as an automatic
rollback. Data restore capability is NOT REACHED; no backup is claimed.

## Checkpoint and next independent work

Integration preparation stays 6/7 = 85.7%; combined local suite 11/11 = 100% scoped.
Full schema constraints, authenticated multi-role browser/Training sessions, actual
Cloud financial RPC/closing/receipt and source integration remain NOT REACHED.
Next: extend fixture coverage to genuine supervised Training context and payment/
closing RPCs with exact dependencies, synthetic rows and focused cases only. Local
work and read-only exports need no new Owner approval. Cloud/source activation does.

Source preflight verified on a clean synthetic checkout of pinned original files
(PASS) and on the already-modified candidate (STOP as intended). This does not
activate or apply the patch.
