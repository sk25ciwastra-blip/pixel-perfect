# PR #67 — SQL/RLS repair checkpoint

Reviews read: PR #67 review 5895367160 and PR #68 review 5895367807.
Work continues only `feat/private-employee-profile-foundation-20261113` from
`0a884ed10cd9c18cd4a75b72c2abe5b834966fe0`. PR #68 is unchanged.

## Changes

- Existing pending SQL consolidated to one BEGIN/COMMIT and one copy of each DDL.
- Current-caller boolean wrapper `can_manage_employee_private_profile()` uses
  SECURITY DEFINER, empty search_path, no identity/role parameter. Owner membership
  and explicit non-restricted Training status are required. Only authenticated
  gets wrapper EXECUTE; PUBLIC/anon are revoked. The sensitive existing Training
  helper receives **no additional grant**. Runtime tests compare its ACL unchanged
  and prove direct invocation still denied, including by authenticated Owner.
- Profile read/insert/update and portrait policies use the wrapper. updated_by
  must remain the actual authenticated actor. No DELETE profile grant added.
- Bucket remains private, 2MiB limit, JPEG/PNG/WebP only. Existing matching bucket
  is accepted (MIME ordering irrelevant); public, unbounded/different-size,
  different-MIME or misnamed bucket aborts the entire transaction without silently
  changing configuration. Row lock after INSERT/ON CONFLICT closes the validation
  window for a concurrent creator. Native concurrent execution is not claimed.
- Restrictive Storage policies stop unrelated permissive policies from opening
  this bucket to staff/anon; they grant no access to other buckets. Unexpected
  existing profile table fails rather than silently reusing an unknown schema.
- CI now runs complete SQL tests on the PR head. The unchanged validator,
  typecheck and build checks are skipped for a SQL-only latest revision; they
  remain available automatically when their source/dependency inputs change.
  PR-only trigger avoids duplicate push/PR executions.

No private fields moved into shared employees, no employee/account mutation, no
KTP-photo field/bucket/flow/placeholder. Only existing face-portrait foundation.

## Executed evidence

`node scripts/employee-private-profile-sql-tests.cjs` — PASS, isolated PostgreSQL
PGlite 0.3.14. Executes **the full exact pending file**, never only its prefix.
No application dependency/lockfile installation; reuses external temporary fixture
or `BTRD25_PGLITE_MODULE`. Fixtures are synthetic in memory; identity values never
printed. Storage tables model metadata RLS, not the actual Storage HTTP service.

| Caller | Profile read | Profile insert/update | Portrait metadata read/insert/update |
|---|---|---|---|
| Non-restricted Owner | ALLOW | ALLOW; spoofed updated_by DENY | ALLOW |
| Supervisor | DENY | DENY | DENY |
| Receptionist | DENY | DENY | DENY |
| Training | DENY | DENY | DENY |
| Owner-role restricted Training | DENY | DENY | DENY |
| Other non-Owner | DENY | DENY | DENY |
| Anonymous / absent identity | DENY | DENY | DENY |

RLS SELECT/UPDATE/DELETE denial may be zero visible/affected rows, not an exception.
INSERT/ACL denial is verified by SQLSTATE 42501. Portrait staff/anon DELETE is
also denied even with a pre-existing permissive ALL Storage policy in the fixture.

PASS: full installation with new and matching existing private bucket; Owner
read/insert/update and actor binding; full deny matrix; wrapper ACL/definer and
sensitive helper ACL preservation; restrictive-policy protection; legacy employee
rows unchanged; six incompatible bucket collision cases with full rollback;
unknown existing profile-table collision rollback; face-only photo schema/configuration;
workflow YAML parsed using existing js-yaml; staged diff scope/whitespace checks.

FAIL: none in final affected checks. Original 42601/42501 defects were reproduced
in prior #68 audit and corrected here; no claim that the old SHA became valid.

NOT REACHED: Cloud SQL/schema/ACL, real Storage HTTP upload/download/signed URL,
server image-byte/face-content verification, native multi-session concurrency,
browser/manual acceptance and credential/private-profile service endpoints. The
bucket configuration and metadata upload authorization PASS are not image-byte or
end-to-end Storage proof. Previously PASS pure validation/typecheck/build were not
rerun locally because TypeScript/application sources are unchanged.

This remains a one-time pending migration, not an idempotent schema reconciler.
Before any separately approved SQL execution, verify function ownership/privileges,
existing policies, bucket identity/configuration/data and migration order on the
target. Old signed links or privileged administrative changes are not revoked by
this file. No Cloud application, deployment or operational readiness claim.

PR #67 stays DRAFT; PR #68's lifecycle/provisioning cutover gate is unchanged.
No merge, deploy, publish, Cloud SQL, DEMO, flags, account reset, finance changes,
Lovable or unrelated PASS suite reruns.
