# Baturaden 25 Homestay — employee acceptance and activation gate

> Latest Closing preflight: see CLOSING_SESSION_PREFLIGHT_2026-11-17.md. The source package now contains NINE files including Finance context alignment. Earlier eight-file references below describe the dd8dc97 checkpoint; use the current manifest and package once. New source repair is local/GitHub only, not active in Lovable. DEMO session still OPEN; no Closing authorized or executed.

17 November 2026 WIB. Latest verified live scenario: BTRDTRX-000028.
This checkpoint supersedes the earlier pre-submit-only status in this file.
Operational decision remains NO-GO; successful normal flow does not activate pending fixes.

## Source and authority

- Actual Lovable source: 3218bd2ebe8fd98a6a046c9fe105d21293de34ca, rechecked after the employee DEMO.
- PR #83 code baseline: 14be505e60bdb18bc7bf4c2ac13ce22f59017299; DRAFT, unmerged.
- GitHub main: 17161ef9aee2bcbf2ab702f3598a43d9b2efdcb1.
- Owner explicitly approved ONE employee DEMO: one new session if needed, opening Rp0, two guests, Rp70,000, DP Rp28,000 + settlement Rp42,000, same TRX, checkout and authorized Housekeeping through READY. No extra transaction, closing, refund, assistance transaction or race write is authorized.
- Owner saved Receptionist BTRDEMP-0001 through the application and subsequently created Housekeeping BTRDEMP-0002. The agent did not reset existing accounts/passwords. Both logins used the private authentication mechanism; no credentials/tokens/hashes are included here.

## Current acceptance matrix

| Flow | PASS LIVE LOVABLE | PASS LOKAL / GITHUB | SUDAH DIPERBAIKI TAPI BELUM AKTIF | BELUM DIUJI |
|---|---|---|---|---|
| Login and role routing | Receptionist BTRDEMP-0001 and HK BTRDEMP-0002 logged in with their own accounts. Receptionist /karyawan redirected to Dashboard. HK navigation limited to Dashboard/Kamar/Housekeeping. | Prior access evidence retained | Existing role/Training packages retain their own gates | Full privilege matrix, Supervisor assistance and Training signed-in acceptance |
| Cash session | Receptionist opened exactly one session with Rp0; date 17 Nov 2026; OPEN. UI shows Rp70,000 QRIS from two payment records | Prior cash-context tests retained, not rerun | Reactive assisted-session selector in PR83 | Closing, handover, assistance with a DIFFERENT operator |
| Booking | BTRDTRX-000028, Room12, Standard P2/Weekday, exactly 2 guests, Rp70,000; DP Rp28,000 saved | Previous unchanged tests retained | Preserve original Reservasi form | Retry/concurrent submission in actual Cloud |
| Settlement and Check-in | QRIS settlement Rp42,000 saved once; total exactly Rp70,000; Check-in kept same UUID/number | Previous native payment/occupancy tests retained | Pending RPC retry/closing-identity repair; source session package | Live concurrent retry and combined-payment races; no new writes authorized |
| Check-out | Same TRX check_out at 15:29:24 WIB, room DIRTY | Prior guard evidence retained | Overtime/fixed-window packages separately pending | Live overtime override not part of this DEMO |
| Housekeeping | HK BTRDEMP-0002 started CLEANING, job BTRDHK-000003, seven synthetic answers passed, room READY. One checklist and one finish | Existing HK source/native/browser evidence retained | Navigation/retry/job-warning patch in existing eight-file package | Integrated-source navigation acceptance and live race |
| Navigation to checklist | Direct /housekeeping?bagian=checklist works with HK account | Existing patch contains nav aria-label="Bagian Housekeeping" with links for each section | Main HK page has no Checklist tab; message tells employee to use that missing tab. Reproduced in this DEMO; DO NOT duplicate existing repair | Ordinary employee navigation after source integration |
| Receipt/closing/refund | No new acceptance claimed; prior Owner Room12 proof retained separately | Previous scoped evidence retained | Finance/receipt packages remain separately gated | Authenticated printing, closing and refund acceptance as required before GO |

PASS LIVE for the HK handler used a direct route workaround. It is not a PASS for the missing normal navigation.
Same-owner payment identity is verified; different-operator assisted-session acceptance is NOT implied.
Exactly two payments without duplication were observed; this is not a live concurrency guarantee.

## Exact preserved DEMO evidence

- Receptionist employee: BTRDEMP-0001, user abb11176-8f20-45f8-8514-5869ff00a9e7.
- Cash session: 947a7922-60db-4365-88e8-9fb963386eec; opened_by equals Receptionist user; opening_cash=0; remains OPEN. No closing executed.
- Transaction: bbe16673-ac9d-4672-a758-6098dcd08134, BTRDTRX-000028.
- Room: ad20aec8-6160-4fa1-a02c-59cb26638cda (12).
- Synthetic guest label: DEMO RCP WORK 20261117; guest_transactions=1.
- DP payment: cf6306cb-4de3-4f93-b09d-00998c27ba03, QRIS 28000.
- Settlement: 3e7f62c5-7460-4ee2-9d0a-2981816ae081, QRIS 42000.
- Both payments recorded_by equals Receptionist user; both cash_session_id equals the above session. Transaction created_by is the same user.
- Actual Check-in 15:28:37 WIB; P2 ends 17:28:37 WIB; actual Check-out 15:29:24 WIB. Scheduled arrival 15:35 WIB; early arrival did not create another transaction.
- HK employee BTRDEMP-0002, position housekeeping, active=true, employee role=true; user 2ba28c8c-d4ec-46c9-ae3e-fc1a9f4dd408; displayed name Dedi Mulyadi.
- HK job 7cc97180-2157-492a-bf57-1617c608a4a0, BTRDHK-000003, belongs to the exact Room12/TRX above.
- Start history 41cf6954-8add-46ca-a7be-40fb28b95e09: dirty -> cleaning.
- Checklist cacb7913-809c-48af-a5ba-18cdc8ac02bb: result=passed, all seven booleans=true, housekeeping_history_id equals start history.
- Finish c5a9c676-e864-47fb-aeb4-53b8d244d1ec: cleaning -> ready.
- Start, checklist, finish and job all identify the HK user; start/finish identify the same job.
- Final SELECT: transaction check_out, room ready, one guest transaction, two payment records, one job, one checklist, one start and one finish. UI history also shows Dedi Mulyadi / Room12 / Selesai.
- Payments are DEMO entries through the application; no real transfer, WhatsApp message, print job, refund or deletion executed.
- Prior Owner BTRDTRX-000027 was not rerun or modified.

Read-only reproduction query (counts exclude historical other room cycles):

```sql
SELECT t.transaction_number, t.status, r.status AS room_status,
       (SELECT count(*) FROM public.payments p WHERE p.transaction_id=t.id) AS payments,
       (SELECT sum(p.amount) FROM public.payments p WHERE p.transaction_id=t.id) AS paid,
       (SELECT count(*) FROM public.housekeeping_jobs j WHERE j.transaction_id=t.id) AS jobs,
       (SELECT count(*) FROM public.housekeeping_checklists c WHERE c.transaction_id=t.id AND c.result::text='passed') AS passed_checklists,
       (SELECT count(*) FROM public.housekeeping_history h WHERE h.transaction_id=t.id AND h.action::text='finish_cleaning') AS finishes
FROM public.transactions t JOIN public.rooms r ON r.id=t.room_id
WHERE t.id='bbe16673-ac9d-4672-a758-6098dcd08134';
```

## Highest-priority remaining operational blocker

Restore normal HK checklist navigation by integrating the ALREADY PREPARED source patch.
Do not make another PR or copy old GitHub pages over Lovable design.

Latest Support thread inspected 17 Nov: Ava 11:57 WIB suggested Connect with a warning about new GitHub commits; later Sam 12:07 WIB explicitly said hold off on Connect project and await backend re-attachment by a teammate. Owner supplied project URL at 12:10 WIB and requested safe sync direction/history preservation. No later technical confirmation was present in the inspected thread/search.
These replies are not an integration authorization or evidence that Sync has recovered. No email was sent in this task.

## Reviewable application and recovery plan

1. Wait for technical Support confirmation identifying ORIGINAL repository ID 1391084125 and exact first-sync direction, preserving both divergent sources and all PR branches. Do not click Connect/Disconnect.
2. Read both actual heads, export the recovered Lovable source to a clean separate review checkout, preserve its exact SHA and original assets. Owner source-integration permission is required before changes.
3. Run existing scripts/preflight-operational-source.py against that clean checkout. Any drift from the eight pinned paths stops application for selective rebase/review.
4. Apply patches/operational-integration-lovable-3218bd2.patch ONCE after approval. It already includes HK navigation, retry recovery, job/checklist relation, WIB arrival/queue and reactive assisted-session selection. Do not also apply the five-file patch or overlapping #76/#79/#80/#81/#82 changes.
5. Review diff and original layout, typecheck/build, then only affected checks. For this missing-nav fix, first verify HK can reach Checklist through UI without new operational writes. A complete new DEMO is not automatically authorized by this document.
6. Source failure: normal revert of only the approved integration commit on review branch; preserve history and original source snapshot. Do not reset/force-push. Revert does not undo DEMO data; no data deletion/reset.
7. SQL remains separate: Finance manifest/recovery under supabase/review/finance-20261117 plus HK/overtime/ACL/fixed-window packages. Exact Cloud drift/dependency checks, backup/restore readiness, explicit per-package authorization and postchecks are required. No source approval authorizes SQL, flags, deployment or publication.
8. GO requires closure of active navigation and required backend gates, scoped role/session acceptance still missing, and Owner review. Do not turn this one successful normal DEMO into a blanket GO.

## Owner decisions and preserved scope

Reservasi intentionally locks Jumlah Tamu to 2. Keep it locked.
Earlier supplemental guest-count patch was withdrawn before publication.
Finance preflight/recovery and prior native suites remain their original local scope; no old PASS suites rerun.
No new code bug fix or new PR was needed in this task; navigation repair already exists.

Integration preparation stays 6/7 = 85.7%; this is NOT whole-application completion.
This authorized employee scenario has 8/9 acceptance groups PASS LIVE (login, own session, Booking, DP, settlement, same-TRX Check-in, Check-out/DIRTY, HK handler/READY); normal checklist navigation FAIL LIVE = ninth group. This scope excludes closing/refund/assistance/concurrency and cannot establish overall readiness.
Next technical action: review/apply existing HK navigation package after Support's safe re-attachment procedure and explicit Owner integration approval. Independently retain exact evidence and prepare only missing approval packets; no extra transactions.
