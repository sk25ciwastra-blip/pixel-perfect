# Housekeeping functional navigation: offline review package

## Authority and source boundary

Owner's current instruction authorizes one new DRAFT PR for functional navigation
only. Read PR #75, especially [the navigation finding](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/75#issuecomment-6914829160)
and [the corrected Lovable workspace handoff](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/75#issuecomment-6917234121).
Lovable project remains `017f6e78-15f2-4d07-a38c-87cb185279bf`, now in Kozan's
Lovable. GitHub Sync is disconnected per Owner. No automatic propagation assumed.

The requested `PANDUAN_MULAI_OBROLAN_BARU.md` could not be read: absent locally,
GitHub main contents API returned 404, and pinned Lovable file read returned 404.
Existing AGENTS.md, Buku Induk/Aturan Bisnis context and Housekeeping review, plus
the latest Owner instructions/checkpoints, were used instead. No replacement
guide or invented policy was created.

Tracked working tree was clean before work; existing ignored local artifacts were
preserved. New branch starts from fetched GitHub main
`17161ef9aee2bcbf2ab702f3598a43d9b2efdcb1`, separately from PR #75.

**Important:** GitHub main already renders the older four-section navigation.
The defect is in Lovable source `3218bd2ebe8fd98a6a046c9fe105d21293de34ca`, which
defines five sections but renders no navigation. GitHub commit API returns 422
for that SHA. Importing the whole newer page into old main would also import
unrelated layout and dependencies, violating scope. Therefore this PR carries an
eight-line source patch for the pinned Lovable file, not a replacement of the
GitHub application's page. **The fix is prepared, not integrated or activated.**

## Exact fix

`patches/housekeeping-navigation-lovable-3218bd2.patch` targets only
`src/routes/housekeeping.tsx`, immediately after the existing header:

- Render the existing `bagianHk` array as router Links, including Tugas Petugas.
- Use existing `hk-tabs` / `hk-tab` CSS and `aria-current="page"` for selection.
- Preserve the existing query validator, default occupied/dirty queue, cleaning
  queue on `?bagian=checklist`, and every role/action condition.
- Do not add a direct READY button or bypass the checklist. Telah Dibersihkan
  still only sets `checklistRoomId` for Owner/Supervisor/Housekeeping on cleaning
  rows; normal checklist completion remains responsible for READY on the server.

No RPC, SQL, calculation, role helper, checklist implementation, CSS, global
layout, flags, transaction or data is modified. The menu clipping suspicion is
not proven and is not patched speculatively.

## Isolated verification

Run only `bun test scripts/housekeeping-navigation-patch.test.tsx`.

**PASS:** 6 tests / 62 assertions. The test applies the actual unified patch with
`git apply --check` and `git apply` inside a fresh temporary synthetic tree, then
cleans up only the files it created. It checks:

1. Patched route TSX syntax/transpilation, not full application typechecking.
2. Removing just the navigation insertion restores the pinned source exactly
   after newline normalization. Existing CSS classes are present in a read-only
   excerpt of the pinned stylesheet; production CSS is untouched.
3. Actual navigation JSX renders all five real links, including Tugas Petugas,
   with exactly one selected section for each valid route.
4. Existing route validation accepts all sections and rejects invalid values.
5. Existing action expression allows Owner/Supervisor/Housekeeping and clicking
   opens the local checklist only (no server call).
6. Other positions and non-cleaning rows do not expose completion; an in-flight
   cleaning row keeps the existing disabled state.

Fixtures are source-only snapshots read through the Lovable connector at the
pinned commit, not live room/guest/employee data. No auth client is imported by
tests, no network or database is used, and no Cloud SQL was executed.

**FAIL:** none in final checks. An initial test detected Git's Windows newline
normalization; comparison now explicitly normalizes CRLF/LF, without changing
the patch or the application logic.

**NOT REACHED:** missing official guide; integration into the complete Lovable
source tree; full Lovable application typecheck/build; authenticated menu/browser
acceptance and checklist to READY. No claim that transpilation/SSR proves browser
visibility, server authorization, or successful room completion.

## Review / integration gate

After Owner restores Sync or supplies the complete matching source branch,
review and apply only the eight-line patch to that source (first
`git apply --check patches/housekeeping-navigation-lovable-3218bd2.patch`). Verify
the actual diff before applying; do not copy the whole page or apply blindly to
old main. Run the matching application's focused typecheck after integration.
This package does not reconnect Sync, apply the patch to Lovable, or authorize
merge/deploy/publish.

Walk-in, payment, Checkout and Start Housekeeping for room 10 remain PASS by
Owner's checkpoint; they were not repeated. Room 10 remains cleaning by that
checkpoint; no new Cloud read/write was needed. Runtime Checklist -> READY stays
NOT REACHED and temporary operations remain NO-GO until actual acceptance.

No Cloud SQL, DEMO changes, Owner override, feature flags, merge, deploy, publish
or Lovable AI/design work. PR #75 is unchanged.
