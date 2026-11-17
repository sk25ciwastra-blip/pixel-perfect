# Baturaden 25 Homestay — payment and closing race verification

17 November 2026 WIB. Existing PR #83; no Cloud writes or old passing suite reruns.

## New executable evidence

SELECT-only exports capture 28 Finance/helper RPC definitions, 164 Finance/payment
column definitions, seven payment/session/allocation/handoff triggers, four payment
indexes and expense/refund numbering functions. The fixture extends the prior
room/transaction trigger/RLS setup with actual Finance definitions, synthetic rows,
new native PostgreSQL cluster and two connections with observed lock waits.
External FK/check constraints, complete Finance RLS, signed JWTs, HTTP wrappers and
all charge/refund/commission branches are not reconstructed or claimed PASS.

Two defects reproduced on current Cloud function bodies locally:

1. Full settlement with the same payment UUID concurrently: caller B waits on the
   transaction lock, then sees no remaining balance and falsely rejects the successful
   retry. The existing UUID check occurs before the lock. No duplicate payment was
   observed; this is an erroneous retry response after a successful payment.
2. `close_finance_cash_session` evaluates comparisons with null auth.uid using SQL
   three-valued logic and permits closing without an identified actor. Reproduced
   with actual authenticated SQL role and RPC EXECUTE permission, not anon. Cloud
   ACL excludes anon/PUBLIC; no claim of an unauthenticated browser exploit.

Pending `20261117100000_payment_retry_closing_identity.sql` adds only a second
payment UUID/payload check after the transaction lock and an explicit non-null
operator check before closing. Signature, SECURITY DEFINER and CREATE OR REPLACE
preserve deployed ACL; fingerprint pre/postchecks reject unexpected body drift.
No closing-minus, commission, source-session policy or accounting rule changes.

Four new native cases PASS:
- Closing wins the session lock: waiting payment rejects FINAL without inserting.
- Payment wins the session lock: waiting closing includes its committed cash once.
- Fixed full-payment concurrent retry returns original UUID, exactly one payment.
- Fixed closing rejects authenticated SQL caller with null identity, session OPEN.

The baseline two defects are intentionally reproduced before local candidate use.
A fixture error initially encoded the closing allocation as a JSON string rather
than object; fixed using postgres.js sql.json. Temporary diagnostic replacement
was removed; successful run uses exact exported Cloud function definitions.

Run only the new suite:

```sh
python scripts/run-overtime-native-concurrency.py --pg-bin /absolute/pg/bin \
  --test-script scripts/finance-payment-closing-races.test.mjs
```

Current Cloud body MD5: payment five-arg e39b532635f0aa14a30992c6a87b3de9;
closing 2e6b21c915118dbf490796b0ecd86868. These remain current/unpatched in Cloud.

## Integration gate

The package manifest includes this separately gated pending SQL. It is not part
of the eight-file frontend patch. Before proposing activation, recheck source/ACL
fingerprints, backup/restore readiness and dependencies. Save original definitions;
recovery would restore those definitions in a separate approved transaction, keeping
existing data and ACL. Do not apply either function independently without review
of its specific test and affected caller paths. No migration/deploy is authorized.

Preparation checkpoint remains 6/7 = 85.7%; new Finance suite 4/4 = 100% scoped.
Operational NO-GO. Full-schema/Cloud acceptance, signed-session role matrix, backup/
restore readiness, source integration and receipt/closing operational acceptance
remain NOT REACHED. Native SQL fixture success does not close these gates.

Next independent technical priority: cover payment-batch versus single-payment
concurrency, fingerprint conflict rollback and post-closing refund immutability using
actual remaining dependencies. Review existing Finance PASS records before selecting
new cases. Can proceed locally/SELECT-only without Owner approval; activation cannot.
