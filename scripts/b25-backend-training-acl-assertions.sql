-- Disposable PostgreSQL 17 ACL UAT only. On first failed invariant, stop.
\set ON_ERROR_STOP on

DO $privileges$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_proc p
 WHERE p.pronamespace='public'::regnamespace
  AND p.proname IN
 ('finance_training_assignment_for','finance_training_context_assignment',
  'finance_training_context_matches_session','finance_training_context_valid',
  'finance_training_session_is_valid')
  AND p.prosecdef
  AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
  AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
  AND NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE')
  AND has_function_privilege('service_role',p.oid,'EXECUTE');
 IF n<>5 THEN RAISE EXCEPTION 'Helper privileges not reduced exactly as approved: %',n;END IF;
 IF NOT has_function_privilege('authenticated','public.get_finance_training_context()','EXECUTE')
    OR has_function_privilege('anon','public.get_finance_training_context()','EXECUTE') THEN
   RAISE EXCEPTION 'Public-facing authenticated Training context grants drifted';
 END IF;
END;
$privileges$;

SET ROLE anon;
DO $anon_guard$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
   PERFORM public.finance_training_assignment_for('00000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous Training helper RPC remains directly accessible'; END IF;
END;
$anon_guard$;
RESET ROLE;

SET ROLE authenticated;
DO $wrapper$
DECLARE val jsonb;
BEGIN
 SELECT public.get_finance_training_context() INTO val;
 IF val IS DISTINCT FROM '{"training":false}'::jsonb THEN
  RAISE EXCEPTION 'Authenticated public Training RPC stopped working: %',val;
 END IF;
END;
$wrapper$;
RESET ROLE;

DO $final$
BEGIN
 IF (SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
     AND p.proname IN ('finance_training_assignment_for','finance_training_context_assignment',
     'finance_training_context_matches_session','finance_training_context_valid','finance_training_session_is_valid'))<>5
 THEN RAISE EXCEPTION 'Internal helper count changed'; END IF;
END;
$final$;
\echo 'B25 BACKEND TRAINING ANON ACL: 5/5 REVOKED; OWNER-DEF. AUTH WRAPPER PASS'
