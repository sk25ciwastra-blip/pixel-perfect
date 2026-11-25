-- PENDING ONLY — Issue #144 / Poin 4 of 7 (25 November 2026)
-- Do NOT execute on Cloud without Owner approval and schema preflight.
-- Owner-only draft storage. No employee grants until Training/role review.
-- Requires existing public.user_roles(user_id, role) and public.app_role('owner').
BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN (
    'PENAWARAN_RESERVASI','KONFIRMASI_BOOKING','KONFIRMASI_PEMBAYARAN'
  )),
  revision integer NOT NULL CHECK (revision > 0),
  body text NOT NULL CHECK (
    char_length(body) BETWEEN 1 AND 4000
    AND body !~ '[[:cntrl:]]'
  ),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUPERSEDED')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind,revision)
);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_templates_one_active_per_kind
  ON public.whatsapp_template_versions(kind) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS public.whatsapp_template_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version_id uuid NOT NULL REFERENCES public.whatsapp_template_versions(id),
  kind text NOT NULL,
  action text NOT NULL CHECK (action IN ('CREATE','SUPERSEDE')),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_template_audit ENABLE ROW LEVEL SECURITY;

-- Owner-only reads. All writes go through audited, versioned RPC.
DROP POLICY IF EXISTS whatsapp_template_owner_read ON public.whatsapp_template_versions;
CREATE POLICY whatsapp_template_owner_read ON public.whatsapp_template_versions
 FOR SELECT TO authenticated USING (
  auth.uid() IS NOT NULL
  AND public.has_role(auth.uid(), 'owner'::public.app_role)
);
DROP POLICY IF EXISTS whatsapp_template_audit_owner_read ON public.whatsapp_template_audit;
CREATE POLICY whatsapp_template_audit_owner_read ON public.whatsapp_template_audit
 FOR SELECT TO authenticated USING (
  auth.uid() IS NOT NULL
  AND public.has_role(auth.uid(), 'owner'::public.app_role)
);

REVOKE ALL ON public.whatsapp_template_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.whatsapp_template_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.whatsapp_template_versions TO authenticated;
GRANT SELECT ON public.whatsapp_template_audit TO authenticated;

-- Lock all direct table writes, including for authenticated role.
-- Security definer is narrowly scoped: validates Owner against DB roles,
-- restricts kind/body, controls revision and appends the audit in same TX.
CREATE OR REPLACE FUNCTION public.owner_save_whatsapp_template(
  _kind text, _body text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _actor uuid := auth.uid();
  _next integer;
  _new_id uuid;
  _prev uuid;
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'owner'::public.app_role) THEN
    RAISE EXCEPTION 'Hanya Owner dapat mengubah template WhatsApp' USING ERRCODE = '42501';
  END IF;
  IF _kind IS NULL OR _kind NOT IN (
    'PENAWARAN_RESERVASI','KONFIRMASI_BOOKING','KONFIRMASI_PEMBAYARAN'
  ) THEN
    RAISE EXCEPTION 'Jenis template tidak dikenal';
  END IF;
  IF _body IS NULL OR length(btrim(_body)) = 0 OR length(_body) > 4000
    OR _body ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Isi template tidak valid';
  END IF;
  -- Do not allow raw malformed placeholders. Client enforces per-kind
  -- token whitelist; server also must verify that every bracket token is allowed.
  IF _body ~ '\\[[^]]*\\]' AND (
    _body ~ '\\[[^A-Z0-9_]' OR _body ~ '\\[[A-Z0-9_]*[^A-Z0-9_]\\]'
  ) THEN
    RAISE EXCEPTION 'Format variabel tidak valid';
  END IF;
  -- Serialize edits even for a kind with zero rows.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('whatsapp_template:' || _kind, 0)
  );
  SELECT coalesce(max(revision),0) + 1 INTO _next
    FROM public.whatsapp_template_versions WHERE kind = _kind;
  SELECT id INTO _prev FROM public.whatsapp_template_versions
    WHERE kind = _kind AND status = 'ACTIVE' FOR UPDATE;
  IF _prev IS NOT NULL THEN
    UPDATE public.whatsapp_template_versions SET status = 'SUPERSEDED'
      WHERE id = _prev;
    INSERT INTO public.whatsapp_template_audit(version_id,kind,action,actor_id)
      VALUES (_prev,_kind,'SUPERSEDE',_actor);
  END IF;
  INSERT INTO public.whatsapp_template_versions(kind,revision,body,status,created_by)
    VALUES (_kind,_next,_body,'ACTIVE',_actor) RETURNING id INTO _new_id;
  INSERT INTO public.whatsapp_template_audit(version_id,kind,action,actor_id)
    VALUES (_new_id,_kind,'CREATE',_actor);
  RETURN _new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.owner_save_whatsapp_template(text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_save_whatsapp_template(text,text) TO authenticated;
COMMIT;

-- Release gate:
-- 1. Review against LIVE schema; validate server-side full token whitelist
--    before activation (current draft validation alone is NOT sufficient).
-- 2. Test anon/employee/HK/Training denial and Owner concurrent revisions.
-- 3. Implement authenticated controlled read for staff only after review.
-- 4. No table delete, no data seeding, and no automatic message sending.
