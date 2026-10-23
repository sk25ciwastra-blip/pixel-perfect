CREATE TABLE public.guest_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 guest_id uuid NOT NULL REFERENCES public.guests(id),
 body text NOT NULL,
 author_id uuid,
 author_role text,
 author_name text,
 created_at timestamptz,
 legacy boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.guest_notes TO authenticated;
GRANT ALL ON public.guest_notes TO service_role;
ALTER TABLE public.guest_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY guest_notes_read ON public.guest_notes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.guests g WHERE g.id = guest_notes.guest_id));
CREATE INDEX guest_notes_guest_order ON public.guest_notes(guest_id, created_at DESC, id);
INSERT INTO public.guest_notes (guest_id, body, legacy) SELECT id, notes, true FROM public.guests WHERE btrim(notes) <> '';
CREATE FUNCTION public.capture_guest_note() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid(); role_label text; actor_name text;
BEGIN
 IF btrim(NEW.notes) = '' THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' THEN
  IF NEW.notes IS NOT DISTINCT FROM OLD.notes THEN RETURN NEW; END IF;
 END IF;
 IF actor IS NOT NULL THEN
  IF public.has_role(actor, 'owner') THEN role_label := 'OWN'; actor_name := 'Pemilik';
  ELSE
   SELECT CASE e.position WHEN 'supervisor' THEN 'SPV' WHEN 'receptionist' THEN 'RCP' WHEN 'housekeeping' THEN 'HK' ELSE NULL END, e.name INTO role_label, actor_name FROM public.employees e WHERE e.user_id = actor AND e.active LIMIT 1;
  END IF;
 END IF;
 INSERT INTO public.guest_notes(guest_id, body, author_id, author_role, author_name, created_at, legacy)
 VALUES (NEW.id, NEW.notes, actor, role_label, actor_name, CASE WHEN actor IS NOT NULL THEN now() ELSE NULL END, actor IS NULL);
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_guest_note() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER capture_guest_note AFTER INSERT OR UPDATE OF notes ON public.guests FOR EACH ROW EXECUTE FUNCTION public.capture_guest_note();
COMMENT ON TABLE public.guest_notes IS 'Append-only guest note history; legacy author and time remain unknown. Writes are atomic with existing guest saves through capture_guest_note.';