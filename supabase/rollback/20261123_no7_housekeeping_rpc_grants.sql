-- Baturaden 25 Homestay — No7 targeted privilege rollback.
-- Read-only audit 23 Nov 2026: the two (uuid,text) SECURITY DEFINER
-- overloads carried explicit anon EXECUTE; PUBLIC was not granted EXECUTE.
-- Run only if a coordinated rollback is approved.
BEGIN;
DO $preflight$
BEGIN
  IF to_regprocedure('public.advance_room_cleaning(uuid,text)') IS NULL OR
     to_regprocedure('public.override_room_ready(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Housekeeping function signature drift: stop rollback';
  END IF;
END $preflight$;
GRANT EXECUTE ON FUNCTION public.advance_room_cleaning(uuid,text) TO anon;
GRANT EXECUTE ON FUNCTION public.override_room_ready(uuid,text) TO anon;
DO $postcheck$
BEGIN
  IF NOT has_function_privilege('anon','public.advance_room_cleaning(uuid,text)','EXECUTE') OR
     NOT has_function_privilege('anon','public.override_room_ready(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Housekeeping privilege rollback did not restore grants';
  END IF;
END $postcheck$;
COMMIT;
