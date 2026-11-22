-- Baturaden 25 Homestay — Nomor 4: backend synchronization/ACL review.
-- REVIEW ONLY: do not apply to Lovable Cloud before explicit Owner approval.
-- Scope: revoke unintended ANON EXECUTE on five SECURITY DEFINER Training
-- internal helpers. Do not edit function body, authenticated/service_role
-- privileges, Training assignments, Finance rows, customer data or RLS.
-- All five functions are used by SECURITY DEFINER postgres functions; no
-- RLS policy directly calls any of these helpers (verified in Cloud preflight).

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '20s';

DO $preflight$
DECLARE
  contract record;
  function_id oid;
BEGIN
  IF current_user <> 'postgres' OR to_regrole('anon') IS NULL
     OR to_regrole('authenticated') IS NULL OR to_regrole('service_role') IS NULL THEN
    RAISE EXCEPTION 'STOP B25 backend ACL: unexpected database role contract';
  END IF;

  FOR contract IN
    SELECT * FROM (VALUES
      ('public.finance_training_assignment_for(uuid)','40104554cbb07c88e6b98104e0dfd6e8'),
      ('public.finance_training_context_assignment(uuid,uuid)','5faa4ea003a9b4d86328cc018a61736a'),
      ('public.finance_training_context_matches_session(uuid,uuid)','19a63b511a9a6e7ab2c7ef12cf2542db'),
      ('public.finance_training_context_valid(uuid)','e26c657380a82573e251de79f7b2ea9e'),
      ('public.finance_training_session_is_valid(uuid,uuid)','2b00047c0f04ec36450bc76374832604')
    ) AS expected(signature, source_md5)
  LOOP
    function_id := to_regprocedure(contract.signature);
    IF function_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM pg_proc p
        WHERE p.oid=function_id AND p.prosecdef
          AND pg_get_userbyid(p.proowner)='postgres'
          AND md5(p.prosrc)=contract.source_md5
      )
      OR NOT has_function_privilege('anon',function_id,'EXECUTE')
      OR has_function_privilege('authenticated',function_id,'EXECUTE')
      OR EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE p.oid=function_id AND acl.grantee=0 AND acl.privilege_type='EXECUTE')
      OR NOT has_function_privilege('service_role',function_id,'EXECUTE')
    THEN
      RAISE EXCEPTION 'STOP B25 backend ACL: function drift or repeat installation: %', contract.signature;
    END IF;
  END LOOP;

  -- If an RLS policy has started directly calling these helpers in future,
  -- require a new review instead of blindly revoking roles.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND concat_ws(' ',qual,with_check) ~
      '(finance_training_assignment_for|finance_training_context_assignment|finance_training_context_matches_session|finance_training_context_valid|finance_training_session_is_valid)'
  ) THEN
    RAISE EXCEPTION 'STOP B25 backend ACL: RLS policy now directly depends on internal helper';
  END IF;
END;
$preflight$;

-- All caller function bodies are unchanged. postgres-owned SECURITY DEFINER
-- callers still execute the internal helpers with the postgres function owner.
REVOKE EXECUTE ON FUNCTION public.finance_training_assignment_for(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finance_training_context_assignment(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finance_training_context_matches_session(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finance_training_context_valid(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finance_training_session_is_valid(uuid,uuid) FROM anon;

DO $postcheck$
DECLARE contract record; function_id oid;
BEGIN
 FOR contract IN SELECT * FROM (VALUES
      ('public.finance_training_assignment_for(uuid)','40104554cbb07c88e6b98104e0dfd6e8'),
      ('public.finance_training_context_assignment(uuid,uuid)','5faa4ea003a9b4d86328cc018a61736a'),
      ('public.finance_training_context_matches_session(uuid,uuid)','19a63b511a9a6e7ab2c7ef12cf2542db'),
      ('public.finance_training_context_valid(uuid)','e26c657380a82573e251de79f7b2ea9e'),
      ('public.finance_training_session_is_valid(uuid,uuid)','2b00047c0f04ec36450bc76374832604')
 ) AS expected(signature, source_md5)
 LOOP
  function_id:=to_regprocedure(contract.signature);
  IF function_id IS NULL
     OR has_function_privilege('anon',function_id,'EXECUTE')
     OR has_function_privilege('authenticated',function_id,'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE p.oid=function_id AND acl.grantee=0 AND acl.privilege_type='EXECUTE')
     OR NOT has_function_privilege('service_role',function_id,'EXECUTE')
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=function_id)<>contract.source_md5
  THEN RAISE EXCEPTION 'STOP B25 backend ACL postcheck failed: %',contract.signature; END IF;
 END LOOP;
END;
$postcheck$;

COMMIT;
