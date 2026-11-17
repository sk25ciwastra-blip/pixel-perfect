"""Prepare review artifacts from metadata snapshots; no database/network operations."""
import json,re,hashlib
from pathlib import Path
root=Path(__file__).resolve().parent.parent
snapshot=json.loads((root/'scripts/fixtures/finance-cloud-20261117/release-snapshot.json').read_text())['rows']
out=root/'supabase/review/finance-20261117';out.mkdir(parents=True,exist_ok=True)
packages=[('payment-closing','20261117100000_payment_retry_closing_identity.sql',['record_transaction_payment','close_finance_cash_session']),('refund','20261117104000_refund_retry_payload_guard.sql',['create_finance_refund'])]
signatures={'record_transaction_payment':'public.record_transaction_payment(uuid,numeric,text,uuid,uuid)','close_finance_cash_session':'public.close_finance_cash_session(uuid,jsonb,text)','create_finance_refund':'public.create_finance_refund(uuid,uuid,numeric,text,text,uuid,text)'}
manifest={'status':'PREPARED_NOT_AUTHORIZED','packages':[],'recovery_restores_known_defects':True,'backup_restore_verified':False}
checks=[]
for label,filename,names in packages:
 path=root/'supabase/pending'/filename;sql=path.read_text();functions=[];restore=["-- REVIEW ONLY: restores known original defects. Separate Owner approval required.","BEGIN;","SET LOCAL lock_timeout='5s';","SET LOCAL statement_timeout='60s';","DO $approval$ BEGIN IF current_setting('b25.approved_recovery',true) IS DISTINCT FROM 'OWNER_APPROVED_RESTORE_ORIGINAL_FINANCE_RPCS' THEN RAISE EXCEPTION 'Explicit recovery approval token required'; END IF; END $approval$;"]
 for name in names:
  row=next(x for x in snapshot if x['proname']==name);original=row['definition'];sig=signatures[name]
  assert row['owner']=='postgres' and row['prosecdef'] and row['proconfig']==['search_path=public']
  candidate=re.search(r'CREATE OR REPLACE FUNCTION public\.'+name+r'\(.*?\$function\$;',sql,re.S).group(0)
  body=lambda s:s.split('AS $function$')[1].split('$function$')[0]
  md5=lambda s:hashlib.md5(body(s).encode()).hexdigest()
  assert md5(original)==row['body_md5'] and row['body_md5'] in sql
  desired=md5(candidate);functions.append({'signature':sig,'original_md5':row['body_md5'],'candidate_md5':desired,'owner':row['owner'],'acl':row['acl']})
  checks.append(f"SELECT '{label}' AS package,'{sig}' AS signature,md5(p.prosrc) AS actual_md5, md5(p.prosrc) IN ('{row['body_md5']}','{desired}') AS accepted_body,r.rolname='postgres' AND p.prosecdef AND p.proconfig=ARRAY['search_path=public']::text[] AND p.proacl::text='{row['acl']}' AS accepted_security FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid='{sig}'::regprocedure;")
  restore.append(f"DO $guard$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='{sig}'::regprocedure) NOT IN ('{row['body_md5']}','{desired}') THEN RAISE EXCEPTION 'Recovery source drift'; END IF; END $guard$;")
  restore.append(original.strip()+';')
  restore.append(f"DO $verify$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='{sig}'::regprocedure) IS DISTINCT FROM '{row['body_md5']}' THEN RAISE EXCEPTION 'Recovery postcheck failed'; END IF; END $verify$;")
 restore.append('COMMIT;');(out/(label+'-restore-review.sql')).write_text('\n'.join(restore)+'\n')
 manifest['packages'].append({'id':label,'path':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'functions':functions,'requires_other_package':False})
(out/'preflight-readonly.sql').write_text('-- SELECT-only; all rows and both accepted flags must be present/true. Not activation approval.\n'+'\n'.join(checks)+'\n')
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Prepared 2 independent packages, 3 RPC preflights, 2 guarded recovery scripts. No SQL executed.')
