BEGIN;
-- Archive is phase two. Keep within the SAME outer database transaction as
-- owner_delete installation during Cloud rollout to guarantee all-or-none.
DO $archive_preflight$
BEGIN
 IF current_user <> 'postgres'
  OR to_regnamespace('owner_delete_private') IS NULL
  OR to_regclass('owner_delete_private.events') IS NULL
  OR to_regprocedure('public.owner_delete_demo(text,uuid,text,boolean)') IS NULL
  OR to_regprocedure('public.owner_archive_demo(uuid,text)') IS NOT NULL
  OR to_regclass('owner_delete_private.demo_transaction_approvals') IS NOT NULL
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='transactions' AND column_name IN('demo_archived_at','demo_archived_by'))
 THEN
   RAISE EXCEPTION 'STOP DEMO archive preflight: first phase missing or partial installation';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
     AND table_name='employees' AND column_name='deleted_at')
   OR NOT EXISTS(SELECT 1 FROM pg_constraint
     WHERE conrelid='owner_delete_private.events'::regclass
       AND conname='events_action_check') THEN
   RAISE EXCEPTION 'STOP DEMO archive preflight: prerequisites drifted';
 END IF;
END;
$archive_preflight$;

ALTER TABLE public.transactions ADD COLUMN demo_archived_at timestamptz,
  ADD COLUMN demo_archived_by uuid,
  ADD CONSTRAINT demo_archive_metadata_pair CHECK ((demo_archived_at IS NULL) = (demo_archived_by IS NULL));
CREATE INDEX transactions_visible_created_idx ON public.transactions (created_at DESC, id DESC)
  WHERE demo_archived_at IS NULL;

-- Empty on install. Record individually reviewed UUID/number pairs, using a
-- non-sensitive approval/ticket reference and the actual database session user.
CREATE TABLE owner_delete_private.demo_transaction_approvals (
  transaction_id uuid PRIMARY KEY,
  transaction_number text NOT NULL,
  approval_ref text NOT NULL CHECK (length(btrim(approval_ref)) BETWEEN 1 AND 160),
  approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_by name NOT NULL DEFAULT session_user
);
ALTER TABLE owner_delete_private.demo_transaction_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON owner_delete_private.demo_transaction_approvals FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER demo_approval_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON owner_delete_private.demo_transaction_approvals
  FOR EACH STATEMENT EXECUTE FUNCTION owner_delete_private.immutable_event();

CREATE FUNCTION owner_delete_private.approve_demo_transaction(_id uuid, _number text, _approval_ref text)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.transactions
    WHERE id = _id AND transaction_number COLLATE "C" = _number COLLATE "C" FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nomor transaksi tidak cocok dengan UUID.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO owner_delete_private.demo_transaction_approvals (transaction_id, transaction_number, approval_ref)
  VALUES (_id, _number, _approval_ref);
END;
$$;
REVOKE ALL ON FUNCTION owner_delete_private.approve_demo_transaction(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE owner_delete_private.events DROP CONSTRAINT events_action_check,
  ADD CONSTRAINT events_action_check CHECK (action IN ('archive_employee', 'delete_transaction', 'archive_transaction'));

CREATE FUNCTION owner_delete_private.protect_archive_metadata()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.demo_archived_at IS NOT NULL OR NEW.demo_archived_by IS NOT NULL THEN
      RAISE EXCEPTION 'Gunakan aksi Arsip DEMO.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.demo_archived_at IS NOT NULL AND NEW.status IN ('booking', 'check_in') THEN
    RAISE EXCEPTION 'Transaksi arsip tidak dapat diaktifkan kembali.' USING ERRCODE = '42501';
  END IF;
  IF (NEW.demo_archived_at, NEW.demo_archived_by) IS DISTINCT FROM (OLD.demo_archived_at, OLD.demo_archived_by) THEN
    IF OLD.demo_archived_at IS NOT NULL OR current_user <> (
      SELECT pg_get_userbyid(proowner) FROM pg_proc
      WHERE oid = 'public.owner_archive_demo(uuid,text)'::regprocedure
    ) THEN
      RAISE EXCEPTION 'Gunakan aksi Arsip DEMO.' USING ERRCODE = '42501';
    END IF;
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;
-- Runs after the generic touch trigger so the archival update preserves the
-- financial/document snapshot version and changes only the two archive fields.
CREATE TRIGGER zz_protect_demo_archive BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION owner_delete_private.protect_archive_metadata();
REVOKE ALL ON FUNCTION owner_delete_private.protect_archive_metadata() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.owner_archive_demo(_id uuid, _confirmation text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET lock_timeout = '2s' AS $$
DECLARE
  actor uuid := auth.uid();
  trx public.transactions%ROWTYPE;
  outcome text;
BEGIN
  IF actor IS NULL OR NOT public.has_role(actor, 'owner')
     OR coalesce((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'Akses Owner diperlukan.' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM auth.sessions WHERE id = (auth.jwt()->>'session_id')::uuid AND user_id = actor
    AND (not_after IS NULL OR not_after > now()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesi Owner tidak aktif.' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM auth.users WHERE id = actor AND (banned_until IS NULL OR banned_until <= now()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesi Owner tidak aktif.' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.user_roles WHERE user_id = actor AND role = 'owner' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Akses Owner diperlukan.' USING ERRCODE = '42501'; END IF;
  IF _id IS NULL OR length(coalesce(_confirmation, '')) > 128 THEN
    RAISE EXCEPTION 'Target tidak valid.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO trx FROM public.transactions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN outcome := 'missing';
  ELSIF trx.transaction_number COLLATE "C" IS DISTINCT FROM _confirmation COLLATE "C" THEN outcome := 'confirmation';
  ELSIF trx.status NOT IN ('check_out', 'cancelled') THEN outcome := 'active_transaction';
  ELSIF NOT EXISTS (SELECT 1 FROM owner_delete_private.demo_transaction_approvals
    WHERE transaction_id = trx.id AND transaction_number = trx.transaction_number) THEN outcome := 'demo_unclassified';
  ELSIF trx.demo_archived_at IS NOT NULL THEN RETURN 'done';
  ELSIF NOT EXISTS (SELECT 1 FROM public.payments WHERE transaction_id = trx.id FOR SHARE) THEN outcome := 'unpaid_transaction';
  ELSE
    UPDATE public.transactions SET demo_archived_at = clock_timestamp(), demo_archived_by = actor WHERE id = trx.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Arsip transaksi gagal.'; END IF;
    outcome := 'done';
  END IF;
  INSERT INTO owner_delete_private.events (action, target_id, target_code, actor_uid, reason, result)
  VALUES ('archive_transaction', _id, trx.transaction_number, actor, 'demo_cleanup', outcome);
  RETURN outcome;
END;
$$;
REVOKE ALL ON FUNCTION public.owner_archive_demo(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_archive_demo(uuid, text) TO authenticated;

COMMIT;
