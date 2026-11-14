// Locked provenance, no Cloud access. Reuse approved code rather than reimplement it.
const cp=require('node:child_process'),crypto=require('node:crypto');
const MAIN='17161ef9aee2bcbf2ab702f3598a43d9b2efdcb1',CANDIDATE='3a8dd60e8337a9fb2f222fbdd81e6fba36e26245';
const blob=(sha,path)=>cp.execFileSync('git',['show',sha+':'+path],{encoding:'utf8'}).replaceAll('\r\n','\n');
const fn=(sql,name)=>{const m=sql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$function\\$;`,'i'));if(!m)throw Error('FUNCTION_SOURCE_MISSING');return m[0];};
const body=sql=>sql.split('$function$')[1];
const md5=s=>crypto.createHash('md5').update(s).digest('hex');
const oldPayment=fn(blob(MAIN,'supabase/migrations/20261018000000_finance_training_enforcement.sql'),'finance_prepare_payment');
const payment=fn(blob(CANDIDATE,'supabase/migrations/20261018000000_finance_training_enforcement.sql'),'finance_prepare_payment');
const oldClosing=fn(blob(MAIN,'supabase/migrations/20261015000000_finance_foundation.sql'),'close_finance_cash_session');
const oldBranch="  IF expected_cash <> total_allocated THEN\n    RAISE EXCEPTION 'Alokasi kas tidak sama dengan saldo fisik yang diharapkan';\n  END IF;";
const newBranch="  IF expected_cash < 0 THEN\n    IF total_allocated <> 0 THEN\n      RAISE EXCEPTION 'Saldo kas minus wajib memakai alokasi kas fisik nol';\n    END IF;\n  ELSIF expected_cash <> total_allocated THEN\n    RAISE EXCEPTION 'Alokasi kas tidak sama dengan saldo fisik yang diharapkan';\n  END IF;";
if(!oldClosing.includes(oldBranch))throw Error('CLOSING_SOURCE_CHANGED');
const authGuard="  IF auth.uid() IS NULL THEN\n    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';\n  END IF;\n";
const closing=oldClosing.replace(oldBranch,newBranch).replace('BEGIN\n  SELECT * INTO selected_session','BEGIN\n'+authGuard+'  SELECT * INTO selected_session');
const foundation=blob(CANDIDATE,'supabase/migrations/20261022000000_extra_guest_receipt_foundation.sql');
const columns=foundation.match(/ALTER TABLE public\.transactions[\s\S]*?;/)[0].replace('  ADD COLUMN IF NOT EXISTS base_price_snapshot numeric(12,2),\n','');
const constraints=foundation.match(/DO \$transaction_extra_guest_constraints\$[\s\S]*?\$transaction_extra_guest_constraints\$;/)[0];
function build(){return `-- SOURCE-ONLY RECONCILIATION CANDIDATE. PENDING REVIEW; NOT A CLOUD RUNBOOK.
-- Owner Issue2/6869144520: Cloud already implements the two rules and columns.
-- Reuse PR36 ${CANDIDATE} payment function + four column definitions/constraints.
-- New code is only negative-cash allocation and an explicit NULL actor denial.
-- Stop on ANY non-main/partially applied state; never overwrite corrected Cloud.
BEGIN;
DO $source_only_preflight$
BEGIN
 IF current_user<>pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.payments'::regclass))
 OR current_user<>pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.finance_cash_sessions'::regclass)) THEN
  RAISE EXCEPTION 'Trusted SQL object owner required';
 END IF;
 IF (SELECT md5(replace(prosrc,chr(13),'')) FROM pg_proc WHERE oid='public.finance_prepare_payment()'::regprocedure) IS DISTINCT FROM '${md5(body(oldPayment))}'
 OR (SELECT md5(replace(prosrc,chr(13),'')) FROM pg_proc WHERE oid='public.close_finance_cash_session(uuid,jsonb,text)'::regprocedure) IS DISTINCT FROM '${md5(body(oldClosing))}'
 OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions'
  AND column_name IN ('guest_count','extra_guest_count','extra_guest_unit_price','extra_guest_charge')) THEN
  RAISE EXCEPTION 'Not the locked main replay state; already corrected/partial/Cloud state requires review, DO NOT APPLY';
 END IF;
END;
$source_only_preflight$;

${columns}
${constraints}

${payment}

${closing}
-- Retain authenticated access, deny anonymous execution as in audited Cloud.
REVOKE ALL ON FUNCTION public.close_finance_cash_session(uuid,jsonb,text) FROM PUBLIC,anon;
-- No sensitive helper or table grant is broadened.
COMMIT;
`;}
module.exports={MAIN,CANDIDATE,blob,fn,body,md5,oldPayment,payment,oldClosing,closing,oldBranch,newBranch,authGuard,columns,constraints,build};
