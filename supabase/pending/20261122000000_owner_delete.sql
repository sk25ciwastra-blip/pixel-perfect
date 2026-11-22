BEGIN;

CREATE SCHEMA IF NOT EXISTS owner_delete_private;
REVOKE ALL ON SCHEMA owner_delete_private FROM PUBLIC, anon, authenticated;

ALTER TABLE public.employees ADD COLUMN deleted_at timestamptz;
REVOKE DELETE ON public.employees, public.transactions FROM PUBLIC, anon, authenticated;

CREATE TABLE owner_delete_private.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('archive_employee', 'delete_transaction')),
  target_id uuid NOT NULL,
  target_code text,
  actor_uid uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reason text NOT NULL CHECK (reason = 'demo_cleanup'),
  result text NOT NULL
);
ALTER TABLE owner_delete_private.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON owner_delete_private.events FROM PUBLIC, anon, authenticated, service_role;
CREATE UNIQUE INDEX owner_delete_success_target ON owner_delete_private.events (action, target_id)
  WHERE result = 'done';
CREATE UNIQUE INDEX owner_delete_transaction_number ON owner_delete_private.events (target_code)
  WHERE action = 'delete_transaction' AND result = 'done';

CREATE FUNCTION owner_delete_private.immutable_event()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Audit penghapusan hanya dapat ditambah.' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER owner_delete_immutable_event
  BEFORE UPDATE OR DELETE OR TRUNCATE ON owner_delete_private.events
  FOR EACH STATEMENT EXECUTE FUNCTION owner_delete_private.immutable_event();

CREATE FUNCTION owner_delete_private.protect_employee()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Arsip dan ID karyawan bersifat permanen.' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Karyawan sudah diarsipkan.' USING ERRCODE = '42501';
  END IF;
  IF NEW.deleted_at IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.active OR current_user <> (
    SELECT pg_get_userbyid(proowner) FROM pg_proc
    WHERE oid = 'public.owner_delete_demo(text,uuid,text,boolean)'::regprocedure
  )) THEN
    RAISE EXCEPTION 'Gunakan aksi Hapus khusus Owner.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER owner_delete_protect_employee
  BEFORE INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION owner_delete_private.protect_employee();

CREATE FUNCTION owner_delete_private.reserve_transaction_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM owner_delete_private.events e
    WHERE e.action = 'delete_transaction' AND e.result = 'done'
      AND (e.target_code = NEW.transaction_number OR e.target_id = NEW.id)
  ) THEN
    RAISE EXCEPTION 'Identitas transaksi sudah dipakai.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER owner_delete_reserve_transaction_identity
  AFTER INSERT OR UPDATE OF id, transaction_number ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION owner_delete_private.reserve_transaction_identity();

-- Match every inbound FK, including CASCADE and SET NULL, without changing its
-- policy. The locked parent row serializes FK validation with deletion.
CREATE FUNCTION owner_delete_private.transaction_has_reference(_id uuid, _code text)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  ref record;
  linked boolean;
BEGIN
  FOR ref IN
    SELECT n.nspname, c.relname,
      string_agg(format('r.%I = t.%I', child.attname, parent.attname), ' AND ') AS predicate
    FROM pg_constraint fk
    JOIN pg_class c ON c.oid = fk.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL unnest(fk.conkey, fk.confkey) AS keys(child_key, parent_key)
    JOIN pg_attribute child ON child.attrelid = fk.conrelid AND child.attnum = keys.child_key
    JOIN pg_attribute parent ON parent.attrelid = fk.confrelid AND parent.attnum = keys.parent_key
    WHERE fk.contype = 'f' AND fk.confrelid = 'public.transactions'::regclass
      AND fk.conparentid = 0
    GROUP BY fk.oid, n.nspname, c.relname
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I r JOIN public.transactions t ON %s WHERE t.id = $1)',
      ref.nspname, ref.relname, ref.predicate
    ) INTO linked USING _id;
    IF linked THEN RETURN true; END IF;
  END LOOP;
  -- These idempotency records also preserve a transaction number independently
  -- of the nullable foreign key.
  LOCK TABLE public.finance_payment_batch_idempotency, public.finance_reservation_idempotency IN SHARE MODE;
  IF EXISTS (SELECT 1 FROM public.finance_payment_batch_idempotency WHERE transaction_number = _code)
     OR EXISTS (SELECT 1 FROM public.finance_reservation_idempotency WHERE transaction_number = _code) THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- Financial actors in the existing schema are sometimes stored as UUIDs without
-- a foreign key. Include those references as well as cash and Training records.
CREATE FUNCTION owner_delete_private.employee_has_financial_history(_user uuid, _employee uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  ref record;
  linked boolean;
BEGIN
  FOR ref IN
    SELECT c.relname, string_agg(
      format('%I = %s', a.attname, CASE WHEN a.attname = 'employee_id' THEN '$2' ELSE '$1' END),
      ' OR ' ORDER BY a.attnum
    ) AS predicate
    FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
      AND (starts_with(c.relname, 'finance_') OR c.relname IN (
        'transactions', 'payments', 'payment_receipts', 'receipt_print_requests'
      ))
      AND a.attnum > 0 AND NOT a.attisdropped AND a.atttypid = 'uuid'::regtype
      AND (right(a.attname, 3) = '_by' OR right(a.attname, 8) = '_user_id'
           OR a.attname IN ('user_id', 'employee_id', 'operator_id', 'commission_recipient', 'actor_uid'))
    GROUP BY c.relname ORDER BY c.relname
  LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE MODE', ref.relname);
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE %s)', ref.relname, ref.predicate)
      INTO linked USING _user, _employee;
    IF linked THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END;
$$;

-- Existing cash/Training RPCs may check active staff before reaching their
-- INSERT. Recheck at the write boundary after any concurrent archive commits.
CREATE FUNCTION owner_delete_private.guard_archived_employee_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_users uuid[];
BEGIN
  IF TG_TABLE_NAME = 'finance_cash_sessions' THEN
    target_users := ARRAY[NEW.opened_by];
  ELSE
    target_users := ARRAY[NEW.trainee_user_id, NEW.supervisor_user_id];
  END IF;
  IF EXISTS (SELECT 1 FROM public.employees WHERE user_id = ANY(target_users) AND deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Karyawan sudah diarsipkan.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER owner_delete_guard_cash
  BEFORE INSERT OR UPDATE OF opened_by ON public.finance_cash_sessions
  FOR EACH ROW EXECUTE FUNCTION owner_delete_private.guard_archived_employee_assignment();
CREATE TRIGGER owner_delete_guard_training
  BEFORE INSERT OR UPDATE OF trainee_user_id, supervisor_user_id ON public.finance_training_assignments
  FOR EACH ROW EXECUTE FUNCTION owner_delete_private.guard_archived_employee_assignment();

CREATE FUNCTION public.owner_delete_demo(_kind text, _id uuid, _confirmation text, _demo_confirmed boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET lock_timeout = '2s' AS $$
DECLARE
  actor uuid := auth.uid();
  action_name text;
  target_code text;
  outcome text;
  employee public.employees%ROWTYPE;
  trx public.transactions%ROWTYPE;
BEGIN
  IF actor IS NULL OR NOT public.has_role(actor, 'owner')
     OR coalesce((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'Akses Owner diperlukan.' USING ERRCODE = '42501';
  END IF;
  -- Scope authorization to a currently valid provider session as well as the
  -- database role. Lock the actor role until the mutation commits.
  PERFORM 1 FROM auth.sessions s
    WHERE s.id = (auth.jwt()->>'session_id')::uuid AND s.user_id = actor
      AND (s.not_after IS NULL OR s.not_after > now()) FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesi Owner tidak aktif.' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM auth.users u
    WHERE u.id = actor AND (u.banned_until IS NULL OR u.banned_until <= now()) FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesi Owner tidak aktif.' USING ERRCODE = '42501';
  END IF;
  IF _kind = 'employee' THEN
    -- Serialize role changes, including assignment to a roleless target.
    LOCK TABLE public.user_roles IN SHARE ROW EXCLUSIVE MODE;
  END IF;
  PERFORM 1 FROM public.user_roles WHERE user_id = actor AND role = 'owner' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Akses Owner diperlukan.' USING ERRCODE = '42501';
  END IF;

  action_name := CASE _kind WHEN 'employee' THEN 'archive_employee' WHEN 'transaction' THEN 'delete_transaction' END;
  IF action_name IS NULL OR _id IS NULL OR length(coalesce(_confirmation, '')) > 128 THEN
    RAISE EXCEPTION 'Target tidak valid.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(action_name || ':' || _id::text, 0));
  SELECT e.target_code INTO target_code FROM owner_delete_private.events e
  WHERE e.action = action_name AND e.target_id = _id AND e.result = 'done';
  IF NOT FOUND THEN
    IF _kind = 'employee' THEN
      SELECT * INTO employee FROM public.employees WHERE id = _id FOR UPDATE;
      target_code := employee.employee_id;
    ELSE
      LOCK TABLE public.transactions IN ROW EXCLUSIVE MODE;
      SELECT * INTO trx FROM public.transactions WHERE id = _id FOR UPDATE;
      target_code := trx.transaction_number;
    END IF;
  END IF;

  IF target_code IS NULL THEN outcome := 'missing';
  ELSIF _confirmation IS DISTINCT FROM target_code THEN outcome := 'confirmation';
  ELSIF _demo_confirmed IS DISTINCT FROM true THEN outcome := 'demo_required';
  ELSIF EXISTS (SELECT 1 FROM owner_delete_private.events e
    WHERE e.action = action_name AND e.target_id = _id AND e.result = 'done') THEN
    RETURN 'done';
  ELSIF _kind = 'employee' THEN
    LOCK TABLE public.finance_cash_sessions, public.finance_training_assignments IN SHARE MODE;
    IF employee.user_id = actor OR public.has_role(employee.user_id, 'owner') THEN outcome := 'protected_employee';
    ELSIF EXISTS (SELECT 1 FROM public.finance_cash_sessions WHERE opened_by = employee.user_id AND status = 'OPEN') THEN outcome := 'open_cash';
    ELSIF EXISTS (SELECT 1 FROM public.finance_training_assignments WHERE status = 'ACTIVE'
      AND employee.user_id IN (trainee_user_id, supervisor_user_id)) THEN outcome := 'active_training';
    ELSIF owner_delete_private.employee_has_financial_history(employee.user_id, employee.id) THEN outcome := 'employee_history';
    ELSE
      UPDATE auth.users SET banned_until = '2999-01-01T00:00:00Z'::timestamptz WHERE id = employee.user_id;
      DELETE FROM auth.sessions WHERE user_id = employee.user_id;
      UPDATE auth.refresh_tokens SET revoked = true WHERE user_id = employee.user_id::text AND revoked IS DISTINCT FROM true;
      UPDATE public.employees SET active = false, deleted_at = clock_timestamp() WHERE id = _id;
      DELETE FROM public.user_roles WHERE user_id = employee.user_id AND role = 'employee';
      outcome := 'done';
    END IF;
  ELSIF trx.status IS NULL OR trx.status NOT IN ('check_out', 'cancelled') THEN outcome := 'active_transaction';
  ELSIF EXISTS (SELECT 1 FROM public.payments WHERE transaction_id = _id) THEN outcome := 'paid_transaction';
  ELSIF owner_delete_private.transaction_has_reference(_id, target_code) THEN outcome := 'transaction_reference';
  ELSE
    BEGIN
      DELETE FROM public.transactions WHERE id = _id;
      outcome := CASE WHEN FOUND THEN 'done' ELSE 'transaction_reference' END;
    EXCEPTION WHEN foreign_key_violation THEN
      outcome := 'transaction_reference';
    END;
  END IF;

  INSERT INTO owner_delete_private.events (action, target_id, target_code, actor_uid, reason, result)
  VALUES (action_name, _id, target_code, actor, 'demo_cleanup', outcome);
  RETURN outcome;
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA owner_delete_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.owner_delete_demo(text, uuid, text, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_delete_demo(text, uuid, text, boolean) TO authenticated;

COMMIT;
