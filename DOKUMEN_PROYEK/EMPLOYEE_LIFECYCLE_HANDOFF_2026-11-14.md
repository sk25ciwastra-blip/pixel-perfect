# Issue #61 — lifecycle + audit DRAFT checkpoint

Authority: [Owner handoff 6859535048](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/61#issuecomment-6859535048),
including decisions 6859465088 and 6857290091. Base main
`17161ef9aee2bcbf2ab702f3598a43d9b2efdcb1`. No existing draft #63–#67 modified.
Scope split follows handoff item 6: this PR implements lifecycle/audit; credential
generation, delivery, private identity/media endpoints follow in a separate PR.
Issue #61 is not complete and must not be closed by this checkpoint.

## Audit inventory, no unrelated PASS suites rerun

- `employees`: unique `user_id`, unique text `employee_id`, position, `active`,
  `created_at`; no join date or repeated status history. `user_roles` is separate.
  Existing employees are not cloned, reset, renumbered or mass-backfilled.
- `employee.functions.ts`: Owner-only creation still accepts manual employeeId/
  password, creates Auth user via admin client and compensates on insert failure.
  Management directly writes active and can reset another account's password.
  Those legacy endpoints/forms are not rewritten in this lifecycle PR. Their
  replacement/self-password contract belongs to credential follow-up, not PASS here.
- No employee ID generator/sequence was found in main migrations: employee ID
  has only a uniqueness constraint. TRX/HK numberators are unrelated and untouched.
- Existing Training: assignment with two calendar days, immutable-by-client
  assignment writes through RPC; Owner/Supervisor assign, Owner resolves
  PASSED/FAILED/REVOKED. Expiry yields EXPIRED_PENDING_OWNER, never automatic PASS.
- `peran.tsx` reads employees.active before Training context and route access.
  Login via Supabase Auth is separate from this operational compatibility flag.
- Training session validation did not recheck trainee active. Session close can
  authorize a session owner even without a fresh frontdesk-role check. Therefore
  disabling only UI/employee flags is insufficient; existing mutation guards must
  also see the revoked entitlement. Cash-session owner/operators must not change.
- Existing employee RLS allows Owner creation/update; employee read scopes exist.
  Existing Training/RPC permissions and finance rules are reused, not reimplemented.
- PR #67 is draft at `0a884ed10cd9c18cd4a75b72c2abe5b834966fe0` with separate
  validator/storage foundation. Its previously PASS pure validation/typecheck/build
  suites were not rerun. New SQL audit findings are below.

## New SQL, pending only

`supabase/pending/20261113170814_employee_lifecycle_audit.sql` depends on existing
role foundation and `20261018000000_finance_training_enforcement.sql`. It does
NOT depend on #67 or any other draft. It creates:

- `employee_lifecycle`: employee ID, employment state, Owner-entered join_date,
  monotonic version. No NIK, phone, birth data, photo, password or additional role.
- `employee_lifecycle_events`: event, employee/version, server recorded_at,
  effective_on/effective_at, original auth.uid actor, reason, previous/new snapshots.
  Repeated cycles append rows; unique employee/version, immutable UPDATE/DELETE
  trigger, no client write grants. FK history is not cascaded away on deletion.
- Owner-only read RLS and authenticated RPCs with internal server role checks;
  empty search_path, schema-qualified relations, no dynamic SQL. Internal event
  writer and trigger functions have no application EXECUTE privilege.
- Future employee INSERT initializes REGISTERED and inactive operational flag,
  with real authenticated Owner audit. Install itself never updates existing rows.
  Service-role-only inserts without original Owner context fail safely.
- Existing status/identity browser writes cannot silently bypass audit. New
  lifecycle functions run as trusted employees table owner; preflight requires
  migration/function owner to match it. Direct SQL management is not an app grant.

Two existing internal authorization helpers are replaced (body/ACL preflight
against actual Cloud required before any execution):

1. `finance_training_is_restricted`: compatibility restriction bridge also
   denies REGISTERED/SUSPENDED/ENDED and inactive non-Owner staff, even following
   an earlier Training PASS. This is an **entitlement check, not a Training state
   rewrite**. It lets existing cash-session/payment mutation guards deny suspended
   users, without changing cash/financial rules or closing/reassigning sessions.
   Existing guard error wording may mention Training for a denied inactive user.
2. `finance_training_session_is_valid`: also requires trainee.active; existing
   supervisor-position helper already verifies supervisor.active. Revocation is
   checked on each context use, including with a still-valid login token/session.

No Auth password, ban, session, payment, receipt, responsible cash owner or base
position/role is mutated. Old active accounts retain permissions on install;
old inactive accounts cannot use the cash guard fallback to resume operations.
Historical ownership-based read policies are not broadened or comprehensively
revoked here; full historical-data read cutoff is not claimed.

## Three independent dimensions and transition contract

| Dimension | Source/behavior |
|---|---|
| Account/login | Supabase Auth; reader reports current provider banned_now (null if unknown). No login ban or session deletion in this PR. |
| Training | Existing assignments/RPC approval, with runtime date projection. Two elapsed days never mean PASSED. |
| Employment | REGISTERED, ACTIVE, SUSPENDED, ENDED; LEGACY explicitly means no reviewed historic state. |

Technical employment labels are proposed mappings for Owner review, not new
business approval roles. employees.active remains a compatibility entitlement,
not a single combined source for all three dimensions.

REGISTERED has no ordinary operational permission. Preparation under existing
Owner/Supervisor authority atomically enables the compatibility flag, creates an
existing Training assignment and appends preparation/assignment/window-end audit.
This enables the established login/context flow for a legitimate trainee; actual
transactions still require the valid supervised cash context. A scheduled-end
event is explicitly a schedule, not a claim that attendance occurred or passed.
After two days the projection is EXPIRED_PENDING_OWNER. Existing Owner resolution
can record PASSED; REGISTERED still needs explicit ACTIVATE with join_date, an
employee role and latest PASSED assignment. No role or position is changed.

SUSPEND/END_EMPLOYMENT immediately set operational active false and deny existing
cash-context mutation. Owner can still resolve a suspended trainee's assignment
without activating them. REACTIVATE from SUSPENDED requires the same explicit
role/join-date/PASSED checks, and each repeated cycle appends audit. No automatic
checkout, session closing, history deletion or assignment substitution.

Employee row lock + expected version serialize management; stale requests fail,
not duplicate transitions. Lifecycle/history read is Owner-only, deterministic
version ordering, bounded pages of 100 with cursor/current_version/has_more.
Snapshots keep legacy dates unknown, not inferred from created_at. First explicit
management action or Training event can record LEGACY baseline without fabricated
past events. Existing inactive legacy staff cannot be enabled by Training prepare.

## Access matrix

| Caller | Lifecycle/history and state changes | Training prepare / resolution |
|---|---|---|
| Legitimate non-restricted Owner | ALLOW, target/transition/version validated | Existing assign + resolve authority |
| Active non-restricted Supervisor | DENY history/general status management | Existing assign authority; no graduation/activation |
| Receptionist, Housekeeping, Inspector, Investor | DENY | DENY management |
| Inactive staff / restricted Training, even Owner-role Training | DENY | DENY management |
| Anonymous / authenticated with no permitted role | DENY before reading target | DENY |
| App direct table mutation | No lifecycle/event writes; direct active toggle denied | Existing assignment ACL unchanged |

Own password changes and credential delivery are not included or enabled.

## Focused checks actually executed

PASS:

- `node scripts/employee-lifecycle-runtime-tests.cjs`: isolated PGlite PostgreSQL
  0.3.14. Existing role/Training function definitions loaded from main, new SQL
  applied only to in-memory fixtures. Registration -> supervised Training ->
  day 1/day 2/WIB expiry -> waiting -> explicit approval and activation; suspension,
  permanent end, repeated reactivation, audit actor/effective vs recorded date,
  stale version denial, pending decision denials, role matrix/new RLS/immutability.
- Existing valid trainee context works; inactive trainee and suspended supervisor
  immediately lose context access. Existing cash mutation trigger denies suspended
  staff following a previous PASS. OPEN session owner/status stay unchanged.
- Old rows remain byte-equivalent on install, with no inferred join dates.
- `node scripts/employee-lifecycle-contract-tests.cjs`: request/date/version
  validation, unknown actor/role/password fields rejected, authenticated POST RPC
  boundaries without service-role bypass, query-string data or logging.
- Focused tsc for two new modules, `bun run build`, diff whitespace/scope review.
  Temporary tsconfig/route-generator artifacts removed; existing build warnings
  are unrelated. No UI/global stylesheet changes.

FAIL (unmodified dependency #67, NEW audit, not a rerun of old PASS suites):

- `node scripts/audit-private-profile-pending.cjs` intentionally exits 1.
  Exact #67 SQL contains **8 COMMIT statements**, repeated trailing DDL fragments;
  full original fails PostgreSQL parse/install **SQLSTATE 42601**.
- Its first intended transaction inspected separately is NOT a repaired artifact:
  authenticated Owner SELECT fails **42501**, because policy directly calls
  finance_training_is_restricted whose existing EXECUTE ACL excludes authenticated.
  No broad GRANT should be used as an unreviewed workaround. #67 untouched.

NOT REACHED / not claimed:

- Native multi-session concurrency. Row locks, unique version constraint and
  stale-version tests exist; sequential PGlite is not concurrent-session proof.
- Cloud SQL, actual Cloud definitions/ACLs, logged-in browser/Auth provider E2E,
  old UI cutover, real cash close/calculation integration or global historical RLS.
- Credential numberator concurrency, generated-password secure delivery/self-change,
  private-profile CRUD, server byte verification, signed image access and real
  Storage service tests: reserved for credential/identity follow-up, not implemented.

Fixtures use arbitrary local UUIDs/labels, no real identities/accounts/JWTs.
The dependency audit generates only synthetic zero strings in memory; no identity
values are emitted. Existing external temporary PGlite installation is reused,
or set BTRD25_PGLITE_MODULE to a pinned 0.3.14 module outside the repo. No lockfile
or dependency installation into this application.

## Outstanding Owner decisions and activation gate

- Effective status changes outside today's WIB date are rejected until scheduling/
  backdating semantics are approved. Historical join_date can be recorded with
  reason and distinct recorded_at; future join_date remains pending.
- Rehire/reactivation after ENDED needs Owner's final policy; not silently allowed.
- Legacy unknown join date/Training history remains unknown. Review/backfill must
  use evidence and explicit Owner actions; no mass requirement blocks old accounts.
- Auth login disable/revoke policy is distinct from operational suspension. This
  PR revokes operational mutation, not Auth tokens themselves or all historical reads.
- Safe one-time credential-delivery channel and retention/self-profile rights must
  be settled in the credential/private-identity phase. No initial credential is
  generated or delivered by this PR, and no credential channel is activated.

**Do not apply this SQL alone now.** Before separate Owner SQL approval, review
Cloud helper definitions/owners/ACLs, existing employee insert/management cutover
and the secure provisioning replacement. The old admin-only insertion lacks
the original Owner auth context and will be rejected after installation; old
unaudited active toggles will also be rejected. Draft endpoint contracts are not
wired to the old form. Coordinate activation/cutover rather than breaking an
existing production provisioning flow. No #67 dependency or shared migration drift.

**One next step:** credential/private-identity follow-up PR: repair and runtime-test
the #67 SQL defects with explicit dependency coordination, then add secure server
numberator/credential and portrait services; keep delivery disabled until safe.
NIK remains text 16 digits including leading zeros, face portrait only; no KTP
photo field, bucket, flow or placeholder is created here or authorized for later.

No merge, deploy, publish, Cloud SQL, DEMO, flags, finance-rule changes, account
reset, design changes or Lovable. All application/database work remains DRAFT.
