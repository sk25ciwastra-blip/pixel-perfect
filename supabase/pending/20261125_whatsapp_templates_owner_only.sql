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
    AND replace(body, chr(10), '') !~ '[[:cntrl:]]'
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
  _token text;
  _allowed text[];
  _remaining text;
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
    OR replace(_body, chr(10), '') ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Isi template tidak valid';
  END IF;
  -- Whitelist enforced on the server; client validation alone is insufficient.
  _allowed := CASE _kind
    WHEN 'PENAWARAN_RESERVASI' THEN ARRAY[
      'NAMA_TAMU','TIPE_KAMAR','NOMOR_KAMAR','PAKET','CHECKIN_WIB',
      'CHECKOUT_WIB','JUMLAH_TAMU','HARGA_KAMAR','BIAYA_TAMBAHAN',
      'TOTAL_TAGIHAN','DP_MINIMUM','DP_PERSEN']
    WHEN 'KONFIRMASI_BOOKING' THEN ARRAY[
      'NAMA_TAMU','NOMOR_TRANSAKSI','TIPE_KAMAR','NOMOR_KAMAR',
      'PAKET','CHECKIN_WIB','CHECKOUT_WIB','JUMLAH_TAMU',
      'TOTAL_TAGIHAN','DP_DITERIMA','SISA_TAGIHAN','STATUS_PEMBAYARAN']
    ELSE ARRAY[
      'NAMA_TAMU','NOMOR_TRANSAKSI','TOTAL_TAGIHAN',
      'TOTAL_DIBAYAR_BERSIH','SISA_TAGIHAN','STATUS_PEMBAYARAN']
  END;
  _remaining := regexp_replace(_body, '\[[A-Z][A-Z0-9_]*\]', '', 'g');
  IF _remaining ~ '[\[\]]' THEN
    RAISE EXCEPTION 'Format variabel tidak valid';
  END IF;
  IF NOT (_body ~ '\[[A-Z][A-Z0-9_]*\]') THEN
    RAISE EXCEPTION 'Minimal satu variabel resmi diperlukan';
  END IF;
  FOR _token IN
    SELECT m[1] FROM regexp_matches(_body, '\[([A-Z][A-Z0-9_]*)\]', 'g') AS m
  LOOP
    IF NOT (_token = ANY(_allowed)) THEN
      RAISE EXCEPTION 'Variabel tidak diizinkan untuk jenis template';
    END IF;
  END LOOP;
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
-- 1. Review against LIVE schema and independently test server-side token whitelist.
-- 2. Test anon/employee/HK/Training denial and Owner concurrent revisions.
-- 3. Implement authenticated controlled read for staff only after review.
-- 4. No table delete, no data seeding, and no automatic message sending.
