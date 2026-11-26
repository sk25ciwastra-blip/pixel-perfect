-- Baturaden 25 Homestay — Guest profile change history + categorized notes
-- Gate: reviewed migration; DO NOT apply to Lovable LIVE without Owner's
-- explicit SQL Cloud authorization and schema/restore rehearsal.
-- New audit applies to future profile updates; no backfilling guessed values.
-- Preserve audit integrity: removing a guest with history is RESTRICTED.
BEGIN;

CREATE SCHEMA IF NOT EXISTS b25_guest_internal;
REVOKE ALL ON SCHEMA b25_guest_internal FROM PUBLIC, anon, authenticated;

-- Email shown in Detail Tamu becomes a real optional profile field.
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS email text;

CREATE TABLE IF NOT EXISTS public.guest_profile_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE RESTRICT,
  field_name text NOT NULL CHECK (field_name IN ('full_name','address','phone','email')),
  old_value text,
  new_value text,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  changed_by uuid,
  actor_role text,
  actor_name text,
  CONSTRAINT guest_profile_history_real_change CHECK (old_value IS DISTINCT FROM new_value)
);
CREATE INDEX IF NOT EXISTS guest_profile_history_guest_time
  ON public.guest_profile_history (guest_id, changed_at DESC, id DESC);

ALTER TABLE public.guest_profile_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_profile_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.guest_profile_history TO authenticated;

DROP POLICY IF EXISTS guest_profile_history_read ON public.guest_profile_history;
CREATE POLICY guest_profile_history_read ON public.guest_profile_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.guests g WHERE g.id = guest_profile_history.guest_id));

-- Trigger-only writer. The audit table cannot be edited directly by browser users.
CREATE OR REPLACE FUNCTION b25_guest_internal.capture_profile_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $b25$
DECLARE
  actor uuid := auth.uid();
  actor_role_label text;
  actor_display text;
BEGIN
  IF actor IS NULL THEN
    actor_role_label := 'system';
    actor_display := 'Sistem / Administrasi';
  ELSIF public.has_role(actor, 'owner'::public.app_role) THEN
    actor_role_label := 'owner';
    actor_display := 'Pemilik';
  ELSE
    SELECT e.position::text, e.name INTO actor_role_label, actor_display
    FROM public.employees e WHERE e.user_id = actor AND e.active
    ORDER BY e.created_at DESC LIMIT 1;
    actor_role_label := COALESCE(actor_role_label, 'employee');
    actor_display := COALESCE(actor_display, 'Karyawan');
  END IF;

  IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
    INSERT INTO public.guest_profile_history
      (guest_id,field_name,old_value,new_value,changed_by,actor_role,actor_name)
    VALUES (NEW.id,'full_name',OLD.full_name,NEW.full_name,actor,actor_role_label,actor_display);
  END IF;
  IF OLD.address IS DISTINCT FROM NEW.address THEN
    INSERT INTO public.guest_profile_history
      (guest_id,field_name,old_value,new_value,changed_by,actor_role,actor_name)
    VALUES (NEW.id,'address',OLD.address,NEW.address,actor,actor_role_label,actor_display);
  END IF;
  IF OLD.phone IS DISTINCT FROM NEW.phone THEN
    INSERT INTO public.guest_profile_history
      (guest_id,field_name,old_value,new_value,changed_by,actor_role,actor_name)
    VALUES (NEW.id,'phone',OLD.phone,NEW.phone,actor,actor_role_label,actor_display);
  END IF;
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    INSERT INTO public.guest_profile_history
      (guest_id,field_name,old_value,new_value,changed_by,actor_role,actor_name)
    VALUES (NEW.id,'email',OLD.email,NEW.email,actor,actor_role_label,actor_display);
  END IF;
  RETURN NEW;
END;
$b25$;
REVOKE ALL ON FUNCTION b25_guest_internal.capture_profile_history() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS b25_guest_profile_history_on_update ON public.guests;
CREATE TRIGGER b25_guest_profile_history_on_update
  AFTER UPDATE OF full_name, address, phone, email ON public.guests
  FOR EACH ROW EXECUTE FUNCTION b25_guest_internal.capture_profile_history();

-- Existing notes are "umum" unless explicitly categorized after migration.
ALTER TABLE public.guest_notes
  ADD COLUMN IF NOT EXISTS note_type text NOT NULL DEFAULT 'umum';
DO $b25$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.guest_notes'::regclass
      AND conname='guest_notes_type_allowed'
  ) THEN
    ALTER TABLE public.guest_notes
      ADD CONSTRAINT guest_notes_type_allowed
      CHECK (note_type IN ('umum','preferensi','perhatian','lainnya'));
  END IF;
END;
$b25$;

-- A typed append-only note is inserted by an authorized frontdesk actor.
-- Original guests.notes/capture_guest_note legacy trigger remains unchanged.
CREATE OR REPLACE FUNCTION public.b25_add_guest_categorized_note(
  p_guest_id uuid, p_body text, p_note_type text DEFAULT 'umum'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $b25$
DECLARE
  actor uuid := auth.uid();
  label_role text;
  label_name text;
  note_id uuid;
  clean_body text := btrim(COALESCE(p_body,''));
BEGIN
  IF actor IS NULL OR NOT public.can_frontdesk(actor) THEN
    RAISE EXCEPTION 'Not authorized to write guest notes' USING ERRCODE='42501';
  END IF;
  IF char_length(clean_body) < 1 OR char_length(clean_body) > 500 THEN
    RAISE EXCEPTION 'Guest note must contain 1–500 characters';
  END IF;
  IF p_note_type IS NULL OR p_note_type NOT IN ('umum','preferensi','perhatian','lainnya') THEN
    RAISE EXCEPTION 'Invalid guest note category';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.guests WHERE id=p_guest_id) THEN
    RAISE EXCEPTION 'Guest not found' USING ERRCODE='22023';
  END IF;
  IF public.has_role(actor,'owner'::public.app_role) THEN
    label_role:='owner'; label_name:='Pemilik';
  ELSE
    SELECT e.position::text,e.name INTO label_role,label_name
    FROM public.employees e WHERE e.user_id=actor AND e.active
    ORDER BY e.created_at DESC LIMIT 1;
    label_role:=COALESCE(label_role,'employee');
    label_name:=COALESCE(label_name,'Karyawan');
  END IF;
  INSERT INTO public.guest_notes
    (guest_id,body,author_id,author_role,author_name,created_at,legacy,note_type)
  VALUES (p_guest_id,clean_body,actor,label_role,label_name,clock_timestamp(),false,p_note_type)
  RETURNING id INTO note_id;
  RETURN note_id;
END;
$b25$;
REVOKE ALL ON FUNCTION public.b25_add_guest_categorized_note(uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.b25_add_guest_categorized_note(uuid,text,text) TO authenticated;

COMMENT ON TABLE public.guest_profile_history IS
  'Append-only future profile updates, by field; RLS read follows guests permissions.';
COMMENT ON COLUMN public.guest_notes.note_type IS
  'Category of note. Existing/legacy notes default to umum.';

COMMIT;
