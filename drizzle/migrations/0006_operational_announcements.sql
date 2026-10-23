CREATE TABLE public.operational_announcements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 body text NOT NULL,
 created_by uuid NOT NULL DEFAULT auth.uid(),
 updated_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT announcement_body_not_empty CHECK (length(btrim(body)) > 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_announcements TO authenticated;
GRANT ALL ON public.operational_announcements TO service_role;
ALTER TABLE public.operational_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY announcements_read ON public.operational_announcements FOR SELECT TO authenticated USING (public.can_view_operations(auth.uid()));
CREATE POLICY announcements_owner_insert ON public.operational_announcements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY announcements_owner_update ON public.operational_announcements FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY announcements_owner_delete ON public.operational_announcements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE INDEX operational_announcements_rotation ON public.operational_announcements (created_at, id);
CREATE FUNCTION public.guard_operational_announcement() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(), 'owner') THEN RAISE EXCEPTION 'Hanya Owner yang dapat mengelola pengumuman'; END IF;
 NEW.body := btrim(NEW.body);
 IF TG_OP = 'INSERT' THEN
  NEW.created_by := auth.uid(); NEW.created_at := now();
 ELSE
  NEW.id := OLD.id; NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
 END IF;
 NEW.updated_by := auth.uid(); NEW.updated_at := now();
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_operational_announcement BEFORE INSERT OR UPDATE ON public.operational_announcements FOR EACH ROW EXECUTE FUNCTION public.guard_operational_announcement();
CREATE FUNCTION public.audit_operational_announcement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.activity_logs(user_id, action, entity_type, entity_id, description)
 VALUES (auth.uid(), CASE TG_OP WHEN 'INSERT' THEN 'buat' WHEN 'UPDATE' THEN 'ubah' ELSE 'hapus' END,
 'operational_announcements', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
 CASE TG_OP WHEN 'INSERT' THEN 'Pengumuman dibuat' WHEN 'UPDATE' THEN 'Pengumuman diubah' ELSE 'Pengumuman dihapus' END);
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_operational_announcement() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_operational_announcement() FROM PUBLIC;
CREATE TRIGGER audit_operational_announcement AFTER INSERT OR UPDATE OR DELETE ON public.operational_announcements FOR EACH ROW EXECUTE FUNCTION public.audit_operational_announcement();
ALTER PUBLICATION supabase_realtime ADD TABLE public.operational_announcements;