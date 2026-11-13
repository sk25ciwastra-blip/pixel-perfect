# Issue #61 — secure provisioning / credential / private identity DRAFT

Authority: https://github.com/sk25ciwastra-blip/pixel-perfect/issues/61#issuecomment-6860505160
Base main `17161ef9aee2bcbf2ab702f3598a43d9b2efdcb1`.
No existing PR changed. This is a new review candidate, NOT ready for activation.

## Dependencies / cutover order

| Stage | Exact reviewed dependency | Boundary |
|---|---|---|
| Private profile/storage | PR67 `b4a486c747202031e52a06a5cf9d67126fc83654`, SQL `20261113233800_private_employee_profiles.sql` | Owner wrapper, private bucket/RLS; unchanged here |
| Lifecycle | PR68 `b9460e98e56ea0a58da828f2208a468e8cdb09af`, SQL `20261113170814_employee_lifecycle_audit.sql` | REGISTERED/inactive, real Owner actor, join date, explicit Training graduation/activation; unchanged here |
| Provisioning | New `supabase/pending/20261113174830_secure_employee_provisioning.sql` | Apply only after both reviewed dependencies and coordinated endpoint/form cutover |
| ID policy | Owner final decision 6862623040 | B25EMP-001, global sequence, minimal 3 digits, never truncated at 999 |
| Delivery policy | Owner decision/verification still pending | Server delivery approval remains null; no provisioning activation |

Tests load those exact dependency SQL snapshots from Git, without merging/changing
their branches. `src/lib/employee-private-profile.ts` is reused byte-for-byte from
PR67 to avoid a second NIK/phone validator. Its existing PASS suite is not rerun.
Identical source introduces no validator drift when the dependency later merges.
Pending filenames are NOT an executable chronological ordering: use the dependency
order above, not filename sorting. Promotion into runnable migrations requires
an explicitly reviewed order/ledger plan; no pending file is auto-applied here.

Audit: main has only unique text employee_id, no existing employee generator.
TRX/HK/EXP sequences are separate and never touched. Existing create accepts manual
ID/password and admin inserts; old manage writes active and resets other accounts.
Those paths are incompatible with #68 and the final Owner credential decision.
No legacy account is reset, renumbered, backfilled, deleted or auto-graduated here.

**NO-GO cutover:** old create is retired (no side effects), old manage rejects
password resets/status toggles and retains only validated name/position editing
under the non-Training Owner wrapper. The old form still renders as before; its
registration/status/password controls cannot be released with this code unchanged.
Keep this PR DRAFT: prepare/wire the approved form, an Auth-only password setup
screen usable before operational activation, and lifecycle actions before ANY
merge/deploy/SQL execution. No UI/design changes were made in this task.

## Implemented contracts

- Server validates strict enrollment DTO; caller cannot supply employeeId,
  password, active, actor or role. Reuses exact 16-digit string NIK validator,
  preserving leading zeros; adds birth place/date, gender bounded text, full
  address/email. Public employees keeps its existing display name, position and
  ID; no NIK/contact/birth/photo/email columns are added to shared employees.
  There is no invented gender enum, minimum age or historic-data backfill. ID follows
  the explicit Owner decision recorded below.
- Database sequence + request lock + unique identifiers issue IDs automatically.
  Historical exact-code collisions are skipped, not renamed. IDs cannot be
  edited by application Owner/staff. Sequence gaps on rejected attempts are
  possible; values are never reused/reset. Official formatter is `B25EMP-` plus
  decimal integer padded to **at least** 3 digits: 001, 002, 010, 100, 999, 1000.
  Initial new number is 001 when free; actual existing collisions are skipped.
- Owner-scoped idempotency request stores only opaque IDs, a server-keyed HMAC
  fingerprint and state. No password/OTP/setup URL/NIK/email/contact is stored
  in its saga record. Dedicated HMAC key belongs on the server, never client input.
- `createUser` gets a 256-bit CSPRNG secret, email_confirm=false and trusted
  app_metadata binding request+original actor. Password is neither returned nor
  logged/stored in application data. User metadata is never an authorization proof.
  Auth create is distinct from application enrollment; no auto operational access.
- Caller-authenticated DB finalize atomically inserts employee role, generated
  employee ID, REGISTERED inactive lifecycle, Owner-entered join_date and private
  profile. It preserves auth.uid(); it is not an admin/service-role employee insert.
  Even application Owner direct INSERT is rejected; only the trusted table-owner
  finalizer plus the bound request can insert. A linked employee blocks automatic
  compensation deletion and instead requires reconciliation.
- Failed create never deletes an existing account by email. Failed finalize first
  locks/fences its request against commit. COMMITTED is preserved. Only a verified
  recovery state and exact trusted Auth marker permit deletion of that newly
  created account. SQL refuses cleanup-complete while marked Auth users remain.
  If reconciliation fails, account is NOT blindly deleted. RECOVERY_REQUIRED
  stays blocked for review. Creator Owner can recover an attached request; a crash
  before attachment needs explicit metadata inspection, never a guessed email scan.
- Setup delivery occurs only after DB commit and a once-only delivery claim.
  Proposed safe alternative: Auth one-time password setup email over the approved
  verified SMTP/redirect channel. Initial random secret is discarded, not sent in
  plaintext. Ambiguous delivery is recorded UNKNOWN/ATTEMPTED and never resent
  automatically; a committed employee is not deleted for an SMTP failure.
  Cross-system Auth/DB/mail exactly-once atomicity is **not** claimed.
- Self-password API accepts only password/optional Auth nonce. Fresh Auth getUser
  must equal middleware caller; PUT goes only to `/auth/v1/user` using that same
  verified bearer and publishable key, never admin or an arbitrary target/role.
  Local SDK source was checked: header-only middleware has no local session, so
  calling SDK updateUser directly would fail. The scoped REST updater avoids
  fabricating a session/JWT or accepting refresh credentials. Provider's secure
  password-change/nonce settings remain authoritative and were not changed.
- Owner-only private read/update services; email must match the Auth account,
  not silently change login email. Post-only/no-store responses; static error codes,
  no data/credential logging, no identity in URLs/receipt/analytics. No ordinary
  menu is wired to private profile APIs. Updating Auth email requires a separate
  verified Auth flow; no unverified contact email is treated as login identity.
- Face-portrait-only upload has <=2MiB pre-decode/byte limit, allowed MIME and
  actual PNG/JPEG/WebP signature/container/structure checks, dimensions/pixel cap;
  PNG CRC/chunk checks and rejection of common EXIF/text/XMP/comment metadata.
  These are technical resource controls, not new business eligibility rules.
  Files use opaque employeeUUID/randomUUID paths and authenticated Owner Storage
  access, upsert=false. Private bucket config from #67 is unchanged.
- Scope-checked signed photo access uses fixed 60s TTL, no public URL. Only path is
  stored, never a signed URL. Upload bind failure attempts caller-scoped cleanup;
  restrictive DELETE prevents deleting a referenced photo after an ambiguous
  successful bind. Orphan cleanup does not gain service-role Storage bypass.
  Real Storage HTTP and signed capabilities are not proven by metadata fixtures.
- No photo-KTP field/bucket/flow/placeholder. Structural verification cannot prove
  that a photo depicts a face rather than a document, and is not a full pixel
  decoder or complete metadata sanitizer. Owner must upload a face portrait.

## Access matrix

| Caller | Enrollment/private read/update/photo/signed access | Lifecycle / own password |
|---|---|---|
| Legitimate non-restricted Owner | ALLOW authorization; enrollment still blocked on decisions | #68 rules retained; own password only |
| Supervisor | DENY private enrollment/data/photo | Existing Training preparation only, no graduation; own password only |
| Receptionist / other non-Owner | DENY | No status/policy change; own password only |
| Restricted Training (including Owner-role Training) | DENY, even if supervised context valid | No management; own password is not operational activation |
| Inactive / anonymous | DENY private management; anon has no RPC execute | No operational reactivation; self-password requires fresh valid Auth |

Training remains existing two WIB days under real assigned Owner/Supervisor cash
session. Expiry is EXPIRED_PENDING_OWNER, not PASSED; graduation and operational
activation remain explicit under #68. No cash session, owner, payment or receipt
is rewritten by new provisioning/identity functions. Suspension is not an Auth ban.

## Initial executed focused evidence (e0233bd; not rerun for ID-only revision)

PASS locally:

- `node scripts/secure-employee-service-tests.cjs`: Owner/default-approval gate,
  CSPRNG unpredictability shape, private input/injection checks, sanitized outputs,
  replay/in-progress, duplicate-email no-delete, failed DB compensation order,
  unreachable reconciliation no-delete, ambiguous COMMIT preservation, delivery
  unknown no account deletion/resend, attached recovery and wrong-marker denial.
- Same service tests: own-password target/role injection deny and caller-only PUT
  transport mock; PNG/JPEG/WebP structural bytes, MIME mismatch, oversize, truncated/
  corrupt/container fixtures; Owner-scoped upload and signed path/TTL; old admin
  password/active bypass absent. Mocks are NOT live Auth/mail/Storage proof.
- `node scripts/secure-employee-sql-tests.cjs`: full exact #67 + #68 + new pending
  SQL applied to isolated PostgreSQL/PGlite 0.3.14. At that initial SHA, undecided
  formatter blocked; the then TEST-ONLY formatter proved uniqueness/historical collision,
  read-only ID, idempotency and Auth binding (old account cannot be hijacked).
  Atomically creates private profile + inactive lifecycle/join_date; duplicate
  NIK rolls back employee/role/history. Cancel fences finalize and requires actual
  Auth absence; completed account preserved. Owner ALLOW; Supervisor/Receptionist/
  Training/Owner-role Training/inactive/anon DENY; scoped portrait/cleanup and
  referenced photo deletion protection. Existing cash session rows unchanged.
- Focused tsc `-p scripts/tsconfig.secure-employees.json`, production build,
  workflow YAML and diff review. Existing build deprecation/bundle warnings remain.
  Server secret/admin markers absent from generated public client assets.

FAIL: none in final affected checks. No unrelated historical PASS suite rerun.

NOT REACHED:

- Native concurrent PostgreSQL connections/ID races (psql/initdb/pg_ctl unavailable
  on PATH); sequence/unique/advisory locks and sequential replay tests are not a
  native multi-session concurrency result.
- Live GoTrue duplicate-email behavior, unconfirmed account recovery/setup email,
  verified SMTP delivery, first-login callback/PKCE/nonce/password update E2E,
  actual Storage HTTP/signed URL expiry, pixel decoding/face recognition, browser.
- Cloud schema/helper/ACL verification or execution, actual form cutover, existing
  financial transaction E2E. No real accounts, tokens, transactions, photos or email
  were created/sent. Tests use synthetic memory-only data and fake transports.

## Owner decisions / one next action

Official ID policy is FINAL under [Owner decision 6862623040](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/61#issuecomment-6862623040):
`B25EMP-001`, global across year/position/status/unit, minimum 3 digits, no 999 cap,
initial 001 if free, unique/permanent/read-only. No re-confirmation needed.

Still pending: approve the proposed CSPRNG + Auth one-time setup email mechanism, verified
   sender/SMTP, destination verification and exact allowed HTTPS callback.

Delivery gate remains closed in source; formatter is no longer NULL for positive IDs.
A later approved implementation
must load a dedicated server HMAC secret and bind the approved delivery channel;
no feature flag is enabled/modified here. Real unconfirmed-Auth onboarding behavior
and Auth-only setup UI must be verified before release. Existing #68 pending
decisions (backdating/rehire/Auth ban) remain unchanged, not re-asked or overridden.

**Next action:** Owner reviews the remaining delivery mechanism and coordinated
cutover; keep all PRs DRAFT/NO-GO until the form/setup flow, native concurrency
and isolated real-provider integration are verified under separate authorization.
SQL files are review artifacts only, not permission to run Cloud migrations.

Reference API contracts checked against installed SDK and official documentation:
https://supabase.com/docs/reference/javascript/auth-admin-createuser
https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
https://supabase.com/docs/reference/javascript/auth-updateuser

No merge, deploy, publish, SQL Cloud, DEMO, feature flags, finance rules, global
design, account resets or Lovable. Codex implemented all code in this candidate.

## ID revision checkpoint — decision 6862623040

`node scripts/secure-employee-id-tests.cjs` PASS, isolated PostgreSQL/PGlite 0.3.14:
official formatter 1/2/10/100/999/1000/10000; first 001; historic 002 collision
skipped; replay/mismatch does not issue a new ID; cancelled/removed reservation
does not rewind the cursor; different-year ledger entries do not reset the global
sequence (generator definition has no date/year reset). Local forward-only cursor
advance checks 999 -> 1000 -> 1001. Owner cannot call sequence/formatter directly,
type manual employeeId in enrollment, or edit existing employee IDs. Real lifecycle
calls ACTIVATE/SUSPEND/REACTIVATE/ENDED and a position change keep the same ID and
employee record. Historic employees/cash rows remain unchanged. Delivery approval
is still null; no email/SMTP approval is inferred from the ID decision.

No generation of new account on reactivation. Sequence/request reservations prevent
reuse of newly issued IDs even after cancellation/deactivation; application roles
cannot reset the sequence. **Historical limitation:** deleted codes that predate
this generator and have no surviving employee row or archive cannot be discovered
or reconstructed. No claim of recovering those lost numbers; review any available
archive before eventual activation. Never reset sequence or purge issuance records.

Only ID tests are rerun for this revision. CI scopes formatter/comment-only changes
to the new ID regression, skipping unrelated service, profile/RLS, tsc and build
PASS suites. Full integration test expectations are updated to the real formatter
for future affected runs, with no test-only formatter replacement remaining there.
NOT REACHED: native concurrent PostgreSQL sessions, live Cloud/browser. No psql/
initdb/pg_ctl available on PATH in the prior environment. Sequential fixtures and
locks/unique constraints are not a concurrent runtime proof. SQL remains pending;
PR67/PR68 unchanged; no merge/deploy/Cloud SQL/DEMO/flags/Lovable.
