# Baturaden 25 Homestay — Closing and assisted-session preflight

17 November 2026 WIB. Baseline PR83 dd8dc97664479f8c705be878ed32d75b1a2c9288.
SELECT/source inspection only in Cloud. No Closing, payment, refund, new DEMO,
migration, account change, merge, deploy, publish or Connect performed.

## Six preflight checks completed (6/6 inspection, NOT six live functional PASS)

1. Pinned active Lovable code still 3218bd2ebe8fd98a6a046c9fe105d21293de34ca.
   Inspected current src/routes/keuangan.tsx and src/lib/sesi-kas.ts.
2. Inspected exact Cloud Closing/summary/payment trigger/session-open definitions,
   ACLs, session/Training/final guards and payment/session RLS.
3. Existing DEMO session inspected; still OPEN, unchanged by this task.
4. Compared negative Closing behavior to official Owner decision: permitted deficit,
   physical CASH allocations zero, preserve negative expected_cash, no personal
   advance/talangan transaction or separate debt feature.
5. Compared operator/session-owner handling and already pending repairs; found an
   uncovered Finance-page context overwrite and prepared a narrowly scoped repair.
6. Prepared minimal write acceptance and read-only assistance scenario below.

## Exact existing DEMO baseline

Session 947a7922-60db-4365-88e8-9fb963386eec:
opened_by abb11176-8f20-45f8-8514-5869ff00a9e7 / BTRDEMP-0001,
operational_date 2026-11-17, OPEN, opening_cash 0.
Two payments of 28000 and 42000 (QRIS), total 70000, both BTRDTRX-000028.
Cash 0, Transfer 0, expenses 0, source refunds 0, allocations 0, drawer handoffs 0.
closed_at, closed_by and closing_snapshot are NULL.
Thus current expected_cash = 0 + 0 - 0 - 0 = 0.
No negative balance exists in this DEMO; do not fabricate one using an unapproved expense/refund.

Prior BTRDTRX-000028 Receptionist/HK READY and BTRDTRX-000027 Owner proof are
preserved, not repeated. Prior local concurrency/minus/refund PASS are retained,
not rerun, and are not called live acceptance.

## Closing contract actually deployed

- UI Proses Closing expands local form; Finalkan Closing calls
  close_finance_cash_session(_session_id,_allocation,_reason).
- UI blocks finalization if authoritative expected balance is unavailable.
- Server locks session row FOR UPDATE; requires OPEN.
- Own session permitted; Owner/Supervisor may close another session with nonempty reason.
- Server cash-only expected balance = opening + Cash payments - CASH expenses - CASH refunds.
  QRIS is not cash; Transfer has separate exact setor_transfer allocation.
- Negative expected_cash is allowed only with zero total physical cash allocation.
  Nonnegative expected_cash must equal setor_cash + di_laci + dibawa.
  No personal advance row is created by this function.
- DI_LACI >0 requires recipient; creates allocation and drawer handoff.
  Zero allocations in the minimal scenario create neither.
- Finalization sets FINAL/closed_at/closed_by/reason/closing_snapshot.
  finance_final_session_guard prevents subsequent UPDATE/DELETE of FINAL rows.
  Training session guard forbids trainees from opening/changing/closing sessions.
- Current closing_snapshot contains cash/transfer balances and closer identity;
  it does NOT embed QRIS/payment total. Verify Rp70000 QRIS from retained payment
  rows and session summary, not a nonexistent snapshot.qris field.
- Closing ACL: authenticated and service_role EXECUTE, SECURITY DEFINER,
  search_path=public; no anon/PUBLIC EXECUTE in inspected proacl.
- Existing null-actor guard defect is STILL present. Cloud body MD5:
  2e6b21c915118dbf490796b0ecd86868.
  PR83 pending 20261117100000_payment_retry_closing_identity.sql already adds
  explicit auth.uid() IS NULL rejection; patched MD5
  e994975f0e77a0c692ba3d89e5772538. Do not duplicate or apply SQL here.
  Previous local reproduction concerned authenticated SQL role with NULL identity;
  it is not proof of anonymous browser exploit.

## Owner/Supervisor assistance

Payments.recorded_by is authenticated operator; cash_session_id links the receiving
drawer; finance_cash_sessions.opened_by is session owner.
finance_prepare_payment locks OPEN session and validates authority for assistance.
The UI's displayed operator and revenue session must not be confused.
Closing separately uses closed_by for actual closer and preserves opened_by.

Existing package already fixed same-tab context notification, explicit helper
selection priority and no silent fallback in useSesiKasKonteks/MenuProfil.
However, Finance page kept its own selection logic:
activeSession ?? selectedSessionId ?? first OPEN, and an effect wrote that choice
back into the shared context. With Owner's own OPEN session and an explicitly chosen
Receptionist session, entering Finance overwrote the chosen drawer with Owner's.
The page also hid its local selector when the operator owned a session.

This is a SOURCE/PACKAGE defect reproduced locally, not a newly executed live
wrong-session Closing. No such harmful action was attempted.

## New narrowly scoped candidate repair

- Finance reads the SAME useSesiKasKonteks as payment forms and profile selector.
- Removes independent own-first/first-OPEN selection and context-writing effect.
- Existing Finance selector uses central authorized selection, including when helper
  owns an OPEN session. A closed explicit selection remains unavailable.
- Summary is bound to session UUID; a mismatched old summary cannot enable Closing.
  On session change, clear prior allocation/reason values and cancel old effect response.
- Keep actual Lovable Finance layout, styles, figures and negative-cash rules.
- Equivalent logical change prepared in GitHub Finance source without replacing its layout.
- Existing integration patch expanded from EIGHT to NINE files, adding current
  src/routes/keuangan.tsx. Same package filename, refreshed source/artifact manifest,
  fixture, generator and verifier path list. Old eight-file prose is historical.
  Do not apply old package and new package cumulatively.

Five NEW focused source regressions PASS, running only
node scripts/finance-session-preflight.test.cjs:
1. actual Finance preamble preserves explicit helper session despite own OPEN session;
   original baseline demonstrated own-session overwrite;
2. closed explicit context produces no selected drawer;
3. foreign-session summary cannot enable Closing;
4. actual close handler sends no RPC when expected balance unavailable;
5. actual handler submits selected session UUID and zero allocation when ready.
The source test applies the Finance hunk from the actual package to the pinned
Lovable fixture. Hook context/RPC/auth are mocked; not authenticated E2E.
Full candidate tsc --noEmit PASS with current Lovable package context.
GitHub counterpart TSX syntax PASS.
Nine pinned source hashes + complete nine-file patch check/application PASS.
No old passing test suite rerun. Candidate is NOT active Lovable code.

## Minimal next execution — one Receptionist Closing, new Owner permission needed

Technical priority: prove normal employee Closing independently of GitHub Sync.

Scope:
- Login privately as BTRDEMP-0001, not Owner/HK.
- Recheck exact session UUID above, owner, OPEN, cash=0, QRIS=70000, Transfer=0,
  exactly two payments, no new expenses/refunds/allocations.
- Abort on any drift; do not adjust data to make the test pass.
- Expand Proses Closing, review selected session/owner and summary.
- Set setor_cash=0, setor_transfer=0, di_laci=0, dibawa=0, no recipient.
- Reason: DEMO WORK — closing penerimaan QRIS BTRDTRX-000028.
- Click Finalkan Closing ONCE only after separate Owner approval.
- No new session, Booking, payment, expense, refund, deposit, handoff or money transfer.

Expected Cloud changes:
only this existing session becomes FINAL, closed_by equals Receptionist user,
closed_at set, reason saved, snapshot expected_cash=0 and cash allocations=0.
No new allocation/handoff expected. Record exact result and UUID; retain evidence.

Read-only postcheck:
status FINAL; opened_by unchanged; closed_by/closing_snapshot.closed_by correct;
snapshot cash_received/transfer_received/cash_expenses/cash_refunds/expected_cash all0;
same two payment IDs, QRIS total70000; no new transaction/allocations/handoffs.
UI refresh must not offer a second finalization of that same session.
A newly offered Buka Sesi is not clicked.

Recovery:
Closing is intentionally FINAL, protected against reopening/editing. There is no
approved rollback that reopens it. On error/timeout first inspect read-only; do not
retry blindly or reset status. If FINAL succeeded, retain it. A future cash session
would require a separate explicit authorization; it is not part of this test.

## Minimal assistance acceptance — no new payment

After safe source integration (separate approval and Support gate):
- Private Owner/Supervisor login, own OPEN session still present where applicable.
- Explicitly select another authorized OPEN session using Bantu Sesi Aktif.
- Open Finance and a payment form WITHOUT submitting either action.
- Verify both use selected drawer; returning to Finance must not revert to own drawer.
- No Cloud row needs to change for this read-only UI acceptance.
- If the Receptionist DEMO has already been finalized, do NOT reopen it. Use a
  separately approved existing OPEN session for inspection, or defer this check.
- This proves context/navigation only, NOT recorded_by != opened_by on a new payment.

To prove an assisted financial write with two different identities, new explicit
permission and a genuine unpaid synthetic balance or separately specified authorized
assisted Closing are required. BTRDTRX-000028 is fully paid; do NOT add a payment,
extend its price, refund it, or make a new transaction to manufacture a balance.

## Activation and GO

Pending navigation/source package and SQL identity guard remain distinct gates.
Support must confirm safe original-repository re-attachment and sync direction.
Source integration, SQL execution, merge, deploy, publish and Connect are not authorized.
Rollback for source is ordinary revert of the approved integration commit, no force/reset.
SQL recovery restores captured definitions and may reinstate known defects; requires
specific review, backup/restore readiness and approval.

Preflight inspection 6/6 = 100% within THIS scope.
Integration preparation remains 6/7 = 85.7%; new Finance file extends package scope,
does not improve live readiness by itself. Overall operational NO-GO.
Next permission request is only the one existing-session Receptionist Closing above.
