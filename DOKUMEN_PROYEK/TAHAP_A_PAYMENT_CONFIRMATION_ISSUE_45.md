# Payment Confirmation — Tahap A, Issue #45

Branch: `feat/payment-confirmation-pdf-20261112`. Logic only; no new page markup,
buttons or dialog. No database, DEMO, environment or feature-flag changes.

## Contract for Tahap B Lovable

`usePaymentConfirmation()` in `src/lib/use-payment-confirmation.ts` provides:

- `state`: `closed | loading | ready | error`, successful check-in identity,
  refreshed same-TRX timestamps and read error. `finishCheckIn()` captures this
  only after a successful existing RPC. Capture does not retry or issue Check-in.
  A refresh failure retains the successful identity: offer read retry, never
  Check-in retry. `captureCheckInSuccess(identity)` can retry that read only.
- `download(transactionId)`: fresh authenticated, RLS-scoped reads, then actual
  PDF bytes and a local Blob download. Promise rejection is an operator-visible
  error; do not show a completed-download state on rejection. Browser file saving
  cannot be confirmed. No receipt/payment/print-request RPC or Cloud upload.
- `openWhatsApp(transactionId)`: requires preceding successful download for the
  same transaction, revalidates access/phone, then opens the existing WhatsApp
  chat helper with no message containing financial/guest data. PDF attachment is
  **manual**. Never label this automatically attached, sent or delivered.
- `thermalAvailable` and `print(transactionNumber)`: reuse the three existing
  receipt gates and original 58 mm engine (one payment per receipt, batch print,
  existing request keys and copy numbering). When false, present an honest
  unavailable status; do not bypass or activate gates. Print failures may be
  retried with the same keys using the existing engine.
- `clear()`: close/dismiss/Selesai; invalidates pending document requests and
  removes in-memory download eligibility. No operational write. Auth changes and
  unmount invalidate pending work too.

For Detail Transaksi, reuse the same headless hook with the selected transaction
ID; add visual actions only in Tahap B. Existing detail/thermal buttons are not
changed here. No new PDF control is currently rendered.

Data calculation is isolated in `payment-confirmation.ts`. Rendering and download
are isolated in `payment-confirmation-pdf.ts`, dynamically imported only on the
download action. Tahap B can adjust layout without changing totals or reads.
The landscape base renderer is functional scaffolding, not a claim of approved
visual fidelity. Owner's referenced image was not attached to this Codex session;
Lovable should use that reference for the final design.

## Data and permissions

- Browser client only; `auth.getUser()`, stored `user_roles` and active employee
  position determine availability; RLS remains authoritative. No privileged key.
- Transaction/guest/room/package reads are scoped by IDs. Payments and refunds
  use 100-row pages ordered by `created_at`, then `id`. Read failures and missing
  required data block the document; an empty successful payment history is UNPAID.
- **Current PDF limitation: Owner only.** Existing `finance_refunds_read` permits
  Owner or refund `created_by=self`. Receptionist/supervisor cannot prove their
  refund list is complete, so the loader explicitly rejects document issuance
  rather than claiming PAID from a partially visible ledger. They may retain the
  successful Check-in state and existing guarded thermal flow. Supporting a
  complete staff PDF needs a separately approved backend read contract; no DB/RLS
  patch is included or executed here.
- Gross payment minus `finance_refunds.amount` is net paid; commission adjustments
  are internal and are not guest bill reductions. Unknown payment/adjustment kinds,
  duplicate/mismatched rows, invalid money or inconsistent snapshots block output.
  The stored total bill is never prorated. Extra Guest uses stored snapshots.
- A transaction version/auth recheck rejects changed records or users during
  loading. Reads are a client snapshot, not a new atomic server financial export.
- Business identity/contact come from ACTIVE English 58 mm BOOKING/WALK_IN
  `receipt_template_versions.header_config`, including rows with NULL
  `published_at`. All matching rows are read in ID order with pagination and
  must agree on the identity/contact fields used by the PDF; empty names or
  conflicting headers block output. Missing required identity fails
  clearly, unavailable optional contact fields are omitted. No contact invented.
  Logo is bundled `/assets/Logo_Resmi_BTRD25_Transparan.png`, fetched same-origin.
- Dates use WIB. Actual checkout is exclusively `checked_out_at`. Checkout
  deadline is separate; duration Booking presentation uses the stricter of stored
  `ends_at` and `scheduled_check_out`, including the historical late-check-in case
  from Issue #46. Fixed package deadlines are not recapped. No record is corrected
  by PDF generation; any historical DEMO fix still requires separate permission.

## PDF dependency and limitations

Added exact `pdf-lib@1.17.1` and `bun.lock` resolutions; no other direct dependency
changed. MIT, browser-capable, no native process or remote PDF service. Installed
minified UMD distribution measured 525,099 bytes / 206,639 bytes gzip; this is a
library-distribution measurement, not a production bundle measurement. No full
build rerun. Dynamic import keeps PDF code off the initial synchronous action path.

Real downloadable PDF, landscape A4, embedded official logo, word/character
wrapping and pagination for all history rows and long fields. Standard Helvetica
supports WinAnsi; unsupported characters produce an explicit error instead of
replacing/truncating names. Unicode-wide support would require a licensed bundled
font and fontkit; it is not silently claimed here. No room photos or external asset
URLs. No PDF upload, public link, file-attachment automation or print-dialog PDF.

## Validation

- PASS: new isolated `bun test scripts/payment-confirmation.test.ts`, 9 cases,
  299 assertions after fixing the test transport's stale-version fixture.
- PASS: focused `node node_modules/typescript/bin/tsc --noEmit -p
  scripts/tsconfig.payment-confirmation.json` after correcting nullable generic
  inference and including installed Node types for transitive client imports.
- PDF parser tests cover one-page output, multipage 205-row history, every method
  label retained, very long fields, official logo image resource and explicit
  unsupported-font errors. Tests use fixtures/isolated transport, never Cloud.
- Financial and action tests cover DP+settlement snapshot, PAID/partial/unpaid,
  no payments, Extra Guest, refund, actual/scheduled/checked-out times, checkout
  cap, denied/incomplete data, scoped pagination, stale auth/version rejection,
  local Blob download, no mutation requests, same-TRX success/error state,
  duplicate download suppression, cancel, manual WA ordering and thermal OFF.
- No previously passing Booking/payment/check-in SQL suites, full typecheck or
  production build rerun. No SQL/migration, flag activation, DEMO changes, merge,
  deploy or publish.
- NOT REACHED: Cloud/browser E2E, final reference-design approval, successful
  receptionist/supervisor PDF (refund permission constraint), physical thermal
  print, real WhatsApp attachment/delivery, full Unicode font rendering.

Existing local `src/routeTree.gen.ts` change is excluded from the PR.
