# No9 Work UAT — checkpoint Finance, 23 November 2026 WIB

Parent: [Issue #128](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/128).
Baseline main/Lovable source: `a03d7c41f5d94b96cb3de7b53846cae1f021f321`.
Target browser: `https://pixel-perfect-homestay-hub.lovable.app/`.
Published artifact checksum is not inferred from source metadata.

## Authorization and execution

Owner explicitly approved four UAT scenarios after reviewing their amounts/actions: deposit confirmation + positive FINAL Closing, one 1,000 refund, zero-opening Owner session + 10,000 expense + negative FINAL Closing, and one 70,000 Booking/28,000 DP administratively cancelled without refund. All are bookkeeping simulations, with UAT guest names/reasons; no real funds moved. No Cloud SQL writes, business tariff edits, account edits, merge or publish occurred.

The prior automatic approval rejection was respected: the original Closing confirmation was cancelled, then retried only after this new explicit Owner approval. Backend guards required source session FINAL before deposit acceptance and SETOR TRANSFER equal to the recorded Transfer amount; execution followed those rules without bypassing them.

## LIVE evidence

| Item | Result |
|---|---|
| Initial baseline | 0 transactions/payments/sessions; 11 active READY rooms |
| Receptionist B25EMP-002 | Login and Rp0 session successful; no credential copied |
| BTRDTRX-000032, Room09 | Booking70,000, DP QRIS28,000. DP27,000 rejected with zero transaction/payment writes. Cash20,000 + Transfer22,000 settlement; same TRX checked in and checked out. Two guests. |
| BTRDTRX-000033, Room10 | Walk-in Cash90,000, two guests, normal Checkout |
| BTRDEXP-000002 | Receptionist UAT expense10,000 |
| Positive Closing | Session `4fa318fa-81fc-4abb-b6c5-6643dd7aadf4` FINAL. Cash expected/physical100,000; SETOR CASH10,000, DIBAWA90,000, SETOR TRANSFER22,000, DI LACI0. Actual closed_by differs from opened_by, establishing Owner assistance. |
| Deposit | `f54b67a8-746d-4381-b3c3-3d82ce939b9d`,10,000 CASH, DITERIMA after source FINAL |
| Refund | `cebd23f9-fe99-4f9a-a786-0bb634c35ab9`,1,000 CASH, OWNER_FUNDS, no source session, original TRX000032. No second refund submitted. |
| Historic snapshot | Exact JSON comparison before/after refund unchanged; MD5 `66f2ccd215f7df1592fe023076cc427d` |
| Commissions |8%, FLOOR_RP1000: TRX0000325,000 + TRX0000337,000. Partial1,000 refund adjustment0 is consistent with rounded historical base. |
| BTRDEXP-000003 | Owner UAT expense10,000 |
| BTRDTRX-000034, Room06 | Future Booking24Nov09.00,70,000, DP QRIS28,000, two guests. Owner cancellation required reason, typed TRX and future acknowledgement. CANCELLED, DP retained, no refund; booking_owner_events action cancel exists. |
| Negative Closing | Owner session `6bd15445-6113-4239-adc0-2318788a2be6` FINAL. Cash expected-10,000, physical0, cash allocations0, Transfer0. QRIS28,000 recorded separately. No personal-advance feature used. |

## New LIVE failures and targeted patch

- [#129](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/129): pending-deposit review disappears when no OPEN session exists. The backend requires a FINAL source. Owner must not need an unrelated OPEN session to review it. Patch keeps the existing paper panel available to Owner independently, while only the submission form still requires an OPEN session. No new RPC/grants.
- [#130](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/130): successful Refund leaves the filled form armed without clear success feedback. Source also creates a new key every retry. Duplicate-refund risk is source-inferred; only one write was performed. Patch uses a synchronous in-flight lock, per-payload retry key, explicit confirmed receipt, clears successful inputs, and preserves confirmed success on refresh failure. A paginated, Owner-only RLS query exposes OWNER_FUNDS refund history without attributing it to session cash totals. Staff cannot see this history.

Validation: `node scripts/no9-finance-owner-review.test.cjs`, production build and TypeScript noEmit. Targeted tests render the actual route JSX and execute the actual refund handler, including pre-fix reproduction, no-OPEN Owner review, staff hiding, active-session submission, rapid-repeat/uncertain retry, backend failure, and post-write refresh failure. No old Finance SQL suite rerun. Generated route-tree output is not part of this patch.

**Patch is LOCAL/GITHUB only until explicitly merged, synchronized/published as appropriate, and failed LIVE cases retested. It does not close #129/#130 or make No9 PASS.** Safe activation: review this small source/test patch; separately authorize merge and publish; verify pending review without opening a new session and verify existing OWNER_FUNDS history. A further positive refund/deposit test requires a specific new UAT allowance; the single approved refund must not be repeated. Source rollback, if needed, is a normal revert of this patch; no deletion/restoration of UAT records.

## Current UAT inventory and next step

3 UAT transactions,5 payments,2 expenses,1 refund,1 accepted deposit,2 FINAL cash sessions,0 OPEN sessions. Room09 and10 remain DIRTY for the final Housekeeping role. No automatic cleanup: Owner decides UAT removal at closure of No9. Original employees B25EMP-001/B25EMP-002 and personal data preserved.

Conservative progress on the25 acceptance groups recorded in Issue128: **15 PASS (60%),2 FAIL,3 BLOCKED/conditional,5 HK not started**. Owner monetary operations passed as above, but deposit-review/Refund-feedback groups retain FAIL due to their UI defects. Receptionist Closing was finalized by assisting Owner, so no new claim that Receptionist personally finalized it. Overtime >120min not forced; extra guests/thermal remain unavailable. Earlier PASS evidence retained.

Next: Owner provisions one official Housekeeping account through the application, entering real required identity/contact data privately; then logs in as HK for DIRTY→CLEANING→checklist→READY, maintenance/history and access denials. Do not fabricate identity fields, create a demo employee, repeat No8, or run HK operations using Owner as proof of HK access. Keep role order Receptionist→Owner→HK.
