# Baturaden 25 Homestay — refund concurrency gate

17 November 2026 WIB. Pending repair only; operational NO-GO.

Prior combined-payment Finance coverage already includes ordinary OWNER_FUNDS
refund after FINAL and historical commission rules. Those passing scenarios were
not rerun. This extension exercises new concurrent/retry/failure interleavings.

Current Cloud create_finance_refund body MD5 695152a80fcd4e561759f34b27652c5a,
SECURITY DEFINER, EXECUTE postgres/authenticated/service_role, exported SELECT-only.
Exact RPC, refund source/Training trigger definitions and unique indexes retained
in scripts/fixtures/finance-cloud-20261117/refund.json. Uses the existing reduced
native Finance fixture: external FKs/checks and real JWT/API are excluded.

## Two defects reproduced on original Cloud body locally

1. Same UUID concurrent full refund: B sees no refund before transaction lock,
   waits for A, then falsely rejects because A already refunded the full balance.
2. Replaying a completed UUID with changed amount returns success silently, with
   no payload conflict check. No extra refund is created, but caller intent differs.

Pending 20261117104000_refund_retry_payload_guard.sql validates stored transaction,
amount/method/source/session/reason on replay and repeats the lookup after the
transaction lock. It preserves original signature, ACL and other business logic.
Source fingerprint preflight, atomic transaction, lock/statement timeouts and
postcheck included. No Cloud execution. It does not alter commission severity,
refund source rules, historical closing or finance policy.

## New 4/4 local cases PASS

- Same UUID concurrent post-closing refund returns original UUID, exactly one row,
  unchanged historical closing_snapshot.
- Changed amount with same UUID rejects; historical closing remains unchanged.
- Different UUID refunds racing for insufficient remaining paid balance: one wins,
  aggregate does not exceed paid amount; historical closing unchanged.
- Forced allocation insert failure rolls back refund row, leaves snapshot unchanged.

Two connections and an observed backend lock wait are asserted. Original defects
are reproduced before candidate installation in the same disposable local fixture.
No previous 4/5/6/11/15-case suite rerun. No Cloud data/write/SQL/flags, merge, deploy,
publish, Lovable AI or new repository/PR.

## Release limits

4/4 = 100% for this local extension. Integration preparation remains 6/7 = 85.7%,
not whole-app progress. No new Cloud operational PASS. Pending SQL still requires
current metadata/source preflight, backup/restore readiness and explicit Owner
approval. Original definition is preserved for review/recovery; no automatic rollback
that restores unsafe replay behavior is offered.

Next priority: consolidate pending Finance changes into the final review package,
then prepare full-schema constraints and authenticated RPC/session acceptance.
Read-only/local preparation can continue without Owner approval. Source integration,
Cloud execution and live transaction actions require their specific approvals.
