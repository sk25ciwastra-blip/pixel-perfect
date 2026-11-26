-- ROLLBACK PLAN ONLY — DO NOT RUN AUTOMATICALLY.
-- Baturaden 25 Homestay: guarded reversal for 20261126190000_guest_profile_history_notes.sql.
-- Must be manually approved for execution. Never discard committed audit
-- events, guest email data or typed notes merely to revert a UI deployment.
BEGIN;
DO $guard$
BEGIN
  IF to_regclass('public.guest_profile_history') IS NULL THEN
    RAISE EXCEPTION 'Audit table missing: rollback requires manual inspection';
  END IF;
  IF EXISTS (SELECT 1 FROM public.guest_profile_history LIMIT 1) THEN
    RAISE EXCEPTION 'History exists: rollback stopped to preserve old/new audit records';
  END IF;
  IF EXISTS (SELECT 1 FROM public.guests WHERE email IS NOT NULL LIMIT 1) THEN
    RAISE EXCEPTION 'Guest email values exist: rollback stopped to preserve guest data';
  END IF;
  IF EXISTS (SELECT 1 FROM public.guest_notes WHERE note_type <> 'umum' LIMIT 1) THEN
    RAISE EXCEPTION 'Categorized notes exist: rollback stopped to preserve history';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger
             WHERE tgrelid = 'public.guests'::regclass
               AND tgname = 'b25_guest_profile_history_on_update'
               AND NOT tgisinternal) IS FALSE THEN
    RAISE EXCEPTION 'Audit trigger absent: rollback stopped';
  END IF;
END;
$guard$;
DROP TRIGGER b25_guest_profile_history_on_update ON public.guests;
DROP FUNCTION b25_guest_internal.capture_profile_history();
DROP FUNCTION public.b25_add_guest_categorized_note(uuid,text,text);
DROP TABLE public.guest_profile_history;
ALTER TABLE public.guest_notes DROP COLUMN note_type;
ALTER TABLE public.guests DROP COLUMN email;
DROP SCHEMA b25_guest_internal RESTRICT;
COMMIT;

-- Restricted backup snapshots in b25_maintenance_private are intentionally
-- NEVER deleted by this rollback. Retention/deletion needs separate approval.
