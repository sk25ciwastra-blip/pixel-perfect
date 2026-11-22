-- Baturaden 25 Homestay — No7 Housekeeping EXECUTE least privilege.
-- REVIEW ONLY: do not apply to Lovable Cloud before Owner authorizes SQL rollout.
-- These two overloaded SECURITY DEFINER RPCs perform privileged state changes.
-- Actual authorization checks inside the functions remain untouched.
BEGIN;
DO $preflight$
BEGIN
  IF to_regprocedure('public.advance_room_cleaning(uuid,text)') IS NULL
    OR to_regprocedure('public.override_room_ready(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Housekeeping RPC signature drift: stop migration';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.advance_room_cleaning(uuid,text)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.override_room_ready(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Housekeeping authenticated EXECUTE grant drift: stop migration';
  END IF;
END $preflight$;

-- Effective anon privilege can be inherited from PUBLIC, so revoke both.
REVOKE EXECUTE ON FUNCTION public.advance_room_cleaning(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.override_room_ready(uuid,text) FROM PUBLIC, anon;

DO $postcheck$
BEGIN
  IF has_function_privilege('anon', 'public.advance_room_cleaning(uuid,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.override_room_ready(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous Housekeeping RPC still executable: rollback';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.advance_room_cleaning(uuid,text)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.override_room_ready(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated Housekeeping RPC lost privilege: rollback';
  END IF;
END $postcheck$;
COMMIT;
