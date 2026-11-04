BEGIN;

-- Training is an orthogonal, server-enforced access assignment.
-- It never changes the employee's base position automatically.
CREATE TABLE IF NOT EXISTS public.finance_training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_user_id uuid NOT NULL REFERENCES auth.users(id),
  supervisor_user_id uuid NOT NULL REFERENCES auth.users(id),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PASSED', 'FAILED', 'REVOKED')),
  label text NOT NULL DEFAULT 'Training'
    CHECK (label = 'Training'),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  resolution_note text NOT NULL DEFAULT '',
  CONSTRAINT finance_training_two_calendar_days
    CHECK (ends_on = starts_on + 1),
  CONSTRAINT finance_training_distinct_users
    CHECK (trainee_user_id <> supervisor_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_training_one_active_assignment
  ON public.finance_training_assignments (trainee_user_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS finance_training_supervisor_idx
  ON public.finance_training_assignments (supervisor_user_id, starts_on DESC);

CREATE TABLE IF NOT EXISTS public.finance_training_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.finance_training_assignments(id),
  label text NOT NULL DEFAULT 'Training' CHECK (label = 'Training'),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  transaction_id uuid REFERENCES public.transactions(id),
  payment_id uuid REFERENCES public.payments(id),
  session_id uuid NOT NULL REFERENCES public.finance_cash_sessions(id),
  operator_id uuid NOT NULL REFERENCES auth.users(id),
  supervisor_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS finance_training_audit_assignment_idx
  ON public.finance_training_audit (assignment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS finance_training_audit_operator_idx
  ON public.finance_training_audit (operator_id, created_at DESC);

ALTER TABLE public.finance_training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_training_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_training_assignments_read
ON public.finance_training_assignments;

CREATE POLICY finance_training_assignments_read
ON public.finance_training_assignments
FOR SELECT TO authenticated
USING (
  trainee_user_id = auth.uid()
  OR supervisor_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'owner')
);

DROP POLICY IF EXISTS finance_training_audit_read
ON public.finance_training_audit;

CREATE POLICY finance_training_audit_read
ON public.finance_training_audit
FOR SELECT TO authenticated
USING (
  operator_id = auth.uid()
  OR supervisor_id = auth.uid()
  OR public.has_role(auth.uid(), 'owner')
);

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.finance_training_assignments, public.finance_training_audit
FROM PUBLIC, anon, authenticated;

GRANT SELECT
ON TABLE public.finance_training_assignments, public.finance_training_audit
TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_training_assignment_for(
  _user_id uuid
)
RETURNS TABLE (
  id uuid,
  trainee_user_id uuid,
  supervisor_user_id uuid,
  starts_on date,
  ends_on date,
  status text,
  label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT a.id, a.trainee_user_id, a.supervisor_user_id,
         a.starts_on, a.ends_on, a.status, a.label
  FROM public.finance_training_assignments a
  WHERE a.trainee_user_id = _user_id
  ORDER BY a.starts_on DESC, a.created_at DESC
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.finance_training_is_restricted(
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(
    (
      SELECT a.status <> 'PASSED'
      FROM public.finance_training_assignments a
      WHERE a.trainee_user_id = _user_id
      ORDER BY a.starts_on DESC, a.created_at DESC
      LIMIT 1
    ),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.finance_training_session_is_valid(
  _user_id uuid,
  _session_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.finance_training_assignments a
    JOIN public.finance_cash_sessions s
      ON s.id = _session_id
     AND s.opened_by = a.supervisor_user_id
     AND s.status = 'OPEN'
    WHERE a.trainee_user_id = _user_id
      AND a.status = 'ACTIVE'
      AND ((now() AT TIME ZONE 'Asia/Jakarta')::date BETWEEN a.starts_on AND a.ends_on)
      AND (
        public.has_role(a.supervisor_user_id, 'owner')
        OR public.has_employee_position(
          a.supervisor_user_id,
          ARRAY['supervisor'::public.employee_position]
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.finance_training_context_assignment(
  _user_id uuid,
  _session_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT a.id
  FROM public.finance_training_assignments a
  WHERE a.trainee_user_id = _user_id
    AND a.status = 'ACTIVE'
    AND public.finance_training_session_is_valid(_user_id, _session_id)
  ORDER BY a.starts_on DESC, a.created_at DESC
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.finance_training_context_valid(
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.finance_training_context_assignment(
    _user_id,
    NULLIF(current_setting('app.finance_training_session_id', true), '')::uuid
  ) IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.finance_training_current_user_is_restricted()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.finance_training_is_restricted(auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.finance_training_current_user_can_read_session(
  _session_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.finance_training_session_is_valid(auth.uid(), _session_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_finance_training_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  assignment record;
  operational_date date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  current_session uuid;
  current_status text;
BEGIN
  SELECT *
  INTO assignment
  FROM public.finance_training_assignment_for(auth.uid());

  IF assignment.id IS NULL THEN
    RETURN jsonb_build_object('status', 'NONE', 'is_training', false);
  END IF;

  current_status := CASE
    WHEN assignment.status <> 'ACTIVE' THEN assignment.status
    WHEN operational_date < assignment.starts_on THEN 'PENDING'
    WHEN operational_date > assignment.ends_on THEN 'EXPIRED_PENDING_OWNER'
    ELSE 'ACTIVE'
  END;

  SELECT s.id
  INTO current_session
  FROM public.finance_cash_sessions s
  WHERE s.opened_by = assignment.supervisor_user_id
    AND s.status = 'OPEN'
    AND public.finance_training_session_is_valid(auth.uid(), s.id)
  ORDER BY s.opened_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'status', current_status,
    'is_training', assignment.status <> 'PASSED',
    'can_transact', current_status = 'ACTIVE' AND current_session IS NOT NULL,
    'assignment_id', assignment.id,
    'trainee_user_id', assignment.trainee_user_id,
    'supervisor_user_id', assignment.supervisor_user_id,
    'starts_on', assignment.starts_on,
    'ends_on', assignment.ends_on,
    'label', assignment.label,
    'session_id', current_session
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_finance_training_assignment(
  _trainee_user_id uuid,
  _supervisor_user_id uuid,
  _starts_on date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner')
     AND NOT public.has_employee_position(
       auth.uid(), ARRAY['supervisor'::public.employee_position]
     ) THEN
    RAISE EXCEPTION 'Hanya Owner atau Supervisor yang dapat menyiapkan Training';
  END IF;

  IF _trainee_user_id = _supervisor_user_id THEN
    RAISE EXCEPTION 'Peserta dan penanggung jawab harus berbeda';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.user_id = _trainee_user_id AND e.active
  ) THEN
    RAISE EXCEPTION 'Peserta Training harus memiliki karyawan aktif';
  END IF;

  IF NOT (
    public.has_role(_supervisor_user_id, 'owner')
    OR public.has_employee_position(
      _supervisor_user_id, ARRAY['supervisor'::public.employee_position]
    )
  ) THEN
    RAISE EXCEPTION 'Penanggung jawab harus Owner atau Supervisor';
  END IF;

  IF NOT public.has_role(auth.uid(), 'owner')
     AND _supervisor_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Supervisor hanya dapat menjadi penanggung jawab dirinya sendiri';
  END IF;

  INSERT INTO public.finance_training_assignments (
    trainee_user_id, supervisor_user_id, starts_on, ends_on, created_by
  )
  VALUES (
    _trainee_user_id, _supervisor_user_id, _starts_on, _starts_on + 1, auth.uid()
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_finance_training_assignment(
  _assignment_id uuid,
  _status text,
  _resolution_note text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Hanya Owner yang dapat mengaktifkan atau menyelesaikan Training';
  END IF;

  IF _status NOT IN ('PASSED', 'FAILED', 'REVOKED') THEN
    RAISE EXCEPTION 'Status penyelesaian Training tidak valid';
  END IF;

  UPDATE public.finance_training_assignments
  SET status = _status,
      resolved_by = auth.uid(),
      resolved_at = now(),
      resolution_note = trim(coalesce(_resolution_note, ''))
  WHERE id = _assignment_id
    AND status = 'ACTIVE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment Training tidak aktif atau tidak ditemukan';
  END IF;
END;
$function$;

-- Existing role helpers remain compatible for normal users, but a Training
-- assignment is held until Owner resolves it explicitly.
CREATE OR REPLACE FUNCTION public.can_frontdesk(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.finance_training_context_valid(_user_id)
    OR (
      NOT public.finance_training_is_restricted(_user_id)
      AND (
        public.has_role(_user_id, 'owner')
        OR public.has_employee_position(
          _user_id,
          ARRAY['receptionist'::public.employee_position, 'supervisor'::public.employee_position]
        )
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_receptionist(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.finance_training_context_valid(_user_id)
    OR (
      NOT public.finance_training_is_restricted(_user_id)
      AND public.has_role(_user_id, 'employee')
      AND EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.user_id = _user_id AND e.active AND e.position = 'receptionist'
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.finance_is_owner_or_supervisor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.finance_training_context_valid(_user_id)
    OR (
      NOT public.finance_training_is_restricted(_user_id)
      AND (
        public.has_role(_user_id, 'owner')
        OR public.has_employee_position(
          _user_id, ARRAY['supervisor'::public.employee_position]
        )
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.finance_is_booking_operator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.finance_training_context_valid(_user_id)
    OR (
      NOT public.finance_training_is_restricted(_user_id)
      AND (
        public.has_role(_user_id, 'owner')
        OR public.is_receptionist(_user_id)
        OR public.has_employee_position(
          _user_id, ARRAY['supervisor'::public.employee_position]
        )
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.finance_training_session_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF public.finance_training_is_restricted(auth.uid()) THEN
    RAISE EXCEPTION 'Peserta Training tidak boleh membuka, mengubah, atau menutup sesi kas';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS finance_training_session_guard_trigger
ON public.finance_cash_sessions;

CREATE TRIGGER finance_training_session_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_cash_sessions
FOR EACH ROW
EXECUTE FUNCTION public.finance_training_session_guard();

CREATE OR REPLACE FUNCTION public.finance_training_context_matches_session(
  _user_id uuid,
  _session_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT _session_id IS NOT NULL
    AND NULLIF(current_setting('app.finance_training_session_id', true), '')::uuid = _session_id
    AND public.finance_training_context_assignment(_user_id, _session_id) IS NOT NULL;
$function$;

-- Finance 150's payment trigger normally requires the session owner to equal
-- recorded_by. Training is the explicitly approved dual-identity exception:
-- only a validated assigned session may differ from the authenticated operator.
CREATE OR REPLACE FUNCTION public.finance_prepare_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_session public.finance_cash_sessions;
  selected_transaction public.transactions;
  selected_charge public.finance_charge_events;
  config record;
  payment_count integer;
  paid_before numeric;
  commission_before numeric;
  target_commission numeric;
BEGIN
  IF NEW.idempotency_key IS NULL THEN
    NEW.idempotency_key := gen_random_uuid();
  END IF;

  SELECT * INTO selected_transaction
  FROM public.transactions t
  WHERE t.id = NEW.transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi pembayaran tidak ditemukan';
  END IF;

  IF NEW.cash_session_id IS NULL THEN
    SELECT * INTO selected_session
    FROM public.finance_cash_sessions s
    WHERE s.opened_by = NEW.recorded_by
      AND s.status = 'OPEN'
    ORDER BY s.opened_at DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT * INTO selected_session
    FROM public.finance_cash_sessions s
    WHERE s.id = NEW.cash_session_id
    FOR UPDATE;
  END IF;

  IF NOT FOUND OR selected_session.status <> 'OPEN'
     OR (
       selected_session.opened_by <> NEW.recorded_by
       AND NOT public.finance_training_context_matches_session(
         auth.uid(), selected_session.id
       )
     ) THEN
    RAISE EXCEPTION 'Sesi kas aktif penerima pembayaran tidak ditemukan';
  END IF;

  NEW.cash_session_id := selected_session.id;

  IF NEW.charge_event_id IS NOT NULL THEN
    SELECT * INTO selected_charge
    FROM public.finance_charge_events c
    WHERE c.id = NEW.charge_event_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Peristiwa Extend/Overtime tidak ditemukan';
    END IF;
    NEW.commission_mode := selected_charge.commission_mode;
    NEW.commission_rate := selected_charge.commission_rate;
    NEW.commission_per_room_amount := selected_charge.commission_per_room_amount;
    NEW.commission_rounding := selected_charge.commission_rounding;
    NEW.commission_recipient := CASE
      WHEN selected_charge.commission_mode = 'PERCENTAGE' THEN NEW.recorded_by
      WHEN selected_charge.commission_mode = 'PER_ROOM' THEN selected_charge.commission_recipient
      ELSE NULL
    END;
  ELSE
    IF selected_transaction.commission_mode_snapshot IS NULL THEN
      SELECT * INTO config
      FROM public.finance_commission_at(selected_transaction.created_at);
      IF config.mode IS NULL THEN
        config.mode := 'OFF';
        config.rate := 0;
        config.per_room_amount := 0;
        config.rounding_rule := 'FLOOR_RP1000';
      END IF;
      UPDATE public.transactions
      SET commission_mode_snapshot = config.mode,
          commission_rate_snapshot = config.rate,
          commission_per_room_amount_snapshot = config.per_room_amount,
          commission_rounding_snapshot = config.rounding_rule
      WHERE id = selected_transaction.id;
      selected_transaction.commission_mode_snapshot := config.mode;
      selected_transaction.commission_rate_snapshot := config.rate;
      selected_transaction.commission_per_room_amount_snapshot := config.per_room_amount;
      selected_transaction.commission_rounding_snapshot := config.rounding_rule;
    END IF;

    NEW.commission_mode := COALESCE(selected_transaction.commission_mode_snapshot, 'OFF');
    NEW.commission_rate := COALESCE(selected_transaction.commission_rate_snapshot, 0);
    NEW.commission_per_room_amount := COALESCE(selected_transaction.commission_per_room_amount_snapshot, 0);
    NEW.commission_rounding := COALESCE(selected_transaction.commission_rounding_snapshot, 'FLOOR_RP1000');
    NEW.commission_recipient := CASE
      WHEN NEW.commission_mode = 'PERCENTAGE' THEN NEW.recorded_by
      WHEN NEW.commission_mode = 'PER_ROOM'
        AND NOT EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.transaction_id = NEW.transaction_id
        )
        THEN selected_transaction.created_by
      ELSE NULL
    END;
  END IF;

  SELECT COUNT(*)::integer INTO payment_count
  FROM public.payments p
  WHERE p.transaction_id = NEW.transaction_id;

  SELECT COALESCE(SUM(p.amount), 0), COALESCE(SUM(p.commission_amount), 0)
  INTO paid_before, commission_before
  FROM public.payments p
  WHERE p.transaction_id = NEW.transaction_id;

  target_commission := floor(((paid_before + NEW.amount) * COALESCE(NEW.commission_rate, 0) / 100) / 1000) * 1000;
  NEW.commission_amount := CASE
    WHEN NEW.commission_mode = 'PERCENTAGE' THEN
      GREATEST(target_commission - commission_before, 0)
    WHEN NEW.commission_mode = 'PER_ROOM'
      AND NEW.commission_recipient IS NOT NULL
      AND (payment_count = 0 OR NEW.charge_event_id IS NOT NULL)
      THEN NEW.commission_per_room_amount
    ELSE 0
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finance_training_transaction_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF public.finance_training_is_restricted(auth.uid())
     AND NOT public.finance_training_context_valid(auth.uid()) THEN
    RAISE EXCEPTION 'Peserta Training wajib memakai wrapper transaksi dengan sesi kas penanggung jawab';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS finance_training_transactions_guard_trigger
ON public.transactions;
CREATE TRIGGER finance_training_transactions_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.finance_training_transaction_guard();

CREATE OR REPLACE FUNCTION public.finance_training_session_row_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  payload jsonb;
  row_session_id uuid;
BEGIN
  IF public.finance_training_is_restricted(auth.uid()) THEN
    payload := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
    row_session_id := COALESCE(
      NULLIF(payload->>'cash_session_id', '')::uuid,
      NULLIF(payload->>'session_id', '')::uuid
    );
    IF NOT public.finance_training_context_matches_session(auth.uid(), row_session_id) THEN
      RAISE EXCEPTION 'Peserta Training wajib memakai sesi kas penanggung jawab yang valid';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS finance_training_payments_guard_trigger
ON public.payments;
CREATE TRIGGER finance_training_payments_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.finance_training_session_row_guard();

DROP TRIGGER IF EXISTS finance_training_expenses_guard_trigger
ON public.finance_expenses;
CREATE TRIGGER finance_training_expenses_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_expenses
FOR EACH ROW
EXECUTE FUNCTION public.finance_training_session_row_guard();

DROP TRIGGER IF EXISTS finance_training_deposits_guard_trigger
ON public.finance_deposits;
CREATE TRIGGER finance_training_deposits_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_deposits
FOR EACH ROW
EXECUTE FUNCTION public.finance_training_session_row_guard();

CREATE OR REPLACE FUNCTION public.finance_training_forbidden_finance_mutation_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF public.finance_training_is_restricted(auth.uid()) THEN
    RAISE EXCEPTION 'Peserta Training tidak dapat mengubah objek Finance ini';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS finance_training_settings_guard_trigger ON public.finance_settings;
CREATE TRIGGER finance_training_settings_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_settings
FOR EACH ROW EXECUTE FUNCTION public.finance_training_forbidden_finance_mutation_guard();

DROP TRIGGER IF EXISTS finance_training_commission_configs_guard_trigger ON public.finance_commission_configs;
CREATE TRIGGER finance_training_commission_configs_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_commission_configs
FOR EACH ROW EXECUTE FUNCTION public.finance_training_forbidden_finance_mutation_guard();

DROP TRIGGER IF EXISTS finance_training_bank_accounts_guard_trigger ON public.finance_bank_accounts;
CREATE TRIGGER finance_training_bank_accounts_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.finance_training_forbidden_finance_mutation_guard();

DROP TRIGGER IF EXISTS finance_training_allocations_guard_trigger ON public.finance_session_allocations;
CREATE TRIGGER finance_training_allocations_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_session_allocations
FOR EACH ROW EXECUTE FUNCTION public.finance_training_forbidden_finance_mutation_guard();

DROP TRIGGER IF EXISTS finance_training_handoffs_guard_trigger ON public.finance_drawer_handoffs;
CREATE TRIGGER finance_training_handoffs_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_drawer_handoffs
FOR EACH ROW EXECUTE FUNCTION public.finance_training_forbidden_finance_mutation_guard();

DROP TRIGGER IF EXISTS finance_training_charge_events_guard_trigger ON public.finance_charge_events;
CREATE TRIGGER finance_training_charge_events_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_charge_events
FOR EACH ROW EXECUTE FUNCTION public.finance_training_forbidden_finance_mutation_guard();

DROP TRIGGER IF EXISTS finance_training_refunds_guard_trigger ON public.finance_refunds;
CREATE TRIGGER finance_training_refunds_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_refunds
FOR EACH ROW EXECUTE FUNCTION public.finance_training_forbidden_finance_mutation_guard();

DROP TRIGGER IF EXISTS finance_training_refund_allocations_guard_trigger ON public.finance_refund_allocations;
CREATE TRIGGER finance_training_refund_allocations_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_refund_allocations
FOR EACH ROW EXECUTE FUNCTION public.finance_training_forbidden_finance_mutation_guard();

CREATE OR REPLACE FUNCTION public.finance_training_audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  assignment_id_value uuid;
  session_id_value uuid;
  payload jsonb := to_jsonb(NEW);
  transaction_id_value uuid;
  payment_id_value uuid;
  supervisor_id_value uuid;
BEGIN
  IF NOT public.finance_training_context_valid(auth.uid()) THEN
    RETURN NEW;
  END IF;

  session_id_value := COALESCE(
    NULLIF(payload->>'cash_session_id', '')::uuid,
    NULLIF(payload->>'session_id', '')::uuid,
    NULLIF(current_setting('app.finance_training_session_id', true), '')::uuid
  );

  assignment_id_value := public.finance_training_context_assignment(
    auth.uid(), session_id_value
  );

  SELECT s.opened_by
  INTO supervisor_id_value
  FROM public.finance_cash_sessions s
  WHERE s.id = session_id_value
    AND s.status = 'OPEN'
    AND public.finance_training_context_matches_session(auth.uid(), s.id);

  IF assignment_id_value IS NULL OR supervisor_id_value IS NULL THEN
    RAISE EXCEPTION 'Konteks audit Training tidak lengkap';
  END IF;

  transaction_id_value := CASE
    WHEN TG_TABLE_NAME = 'transactions' THEN (payload->>'id')::uuid
    ELSE NULLIF(payload->>'transaction_id', '')::uuid
  END;
  payment_id_value := CASE
    WHEN TG_TABLE_NAME = 'payments' THEN (payload->>'id')::uuid
    ELSE NULL
  END;

  INSERT INTO public.finance_training_audit (
    assignment_id, action, entity_type, entity_id,
    transaction_id, payment_id, session_id,
    operator_id, supervisor_id, details
  )
  VALUES (
    assignment_id_value, TG_OP, TG_TABLE_NAME, (payload->>'id')::uuid,
    transaction_id_value, payment_id_value, session_id_value,
    auth.uid(), supervisor_id_value,
    jsonb_build_object('label', 'Training', 'table', TG_TABLE_NAME)
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS finance_training_transactions_audit_trigger
ON public.transactions;
CREATE TRIGGER finance_training_transactions_audit_trigger
AFTER INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.finance_training_audit_row();

DROP TRIGGER IF EXISTS finance_training_payments_audit_trigger
ON public.payments;
CREATE TRIGGER finance_training_payments_audit_trigger
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.finance_training_audit_row();

DROP TRIGGER IF EXISTS finance_training_expenses_audit_trigger
ON public.finance_expenses;
CREATE TRIGGER finance_training_expenses_audit_trigger
AFTER INSERT ON public.finance_expenses
FOR EACH ROW EXECUTE FUNCTION public.finance_training_audit_row();

DROP TRIGGER IF EXISTS finance_training_deposits_audit_trigger
ON public.finance_deposits;
CREATE TRIGGER finance_training_deposits_audit_trigger
AFTER INSERT ON public.finance_deposits
FOR EACH ROW EXECUTE FUNCTION public.finance_training_audit_row();

CREATE OR REPLACE FUNCTION public.create_training_reservation(
  _mode text, _room_id uuid, _package_id uuid, _name text, _phone text,
  _address text, _amount numeric, _method text, _day_mode text,
  _scheduled_check_in timestamptz DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL, _session_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE result_number text;
BEGIN
  IF NOT public.finance_training_session_is_valid(auth.uid(), _session_id) THEN
    RAISE EXCEPTION 'Training wajib memakai sesi kas aktif penanggung jawab';
  END IF;

  PERFORM set_config('app.finance_training_session_id', _session_id::text, true);

  SELECT public.create_reservation(
    _mode, _room_id, _package_id, _name, _phone, _address, _amount,
    _method, _day_mode, _scheduled_check_in, _idempotency_key, _session_id
  ) INTO result_number;
  RETURN result_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_training_transaction_payment(
  _transaction_id uuid, _amount numeric, _method text,
  _idempotency_key uuid, _session_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE result_id uuid;
BEGIN
  IF NOT public.finance_training_session_is_valid(auth.uid(), _session_id) THEN
    RAISE EXCEPTION 'Training wajib memakai sesi kas aktif penanggung jawab';
  END IF;

  PERFORM set_config('app.finance_training_session_id', _session_id::text, true);

  SELECT public.record_transaction_payment(
    _transaction_id, _amount, _method, _idempotency_key, _session_id
  ) INTO result_id;
  RETURN result_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_in_training_booking(
  _transaction_id uuid, _session_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE result_number text;
BEGIN
  IF NOT public.finance_training_session_is_valid(auth.uid(), _session_id) THEN
    RAISE EXCEPTION 'Training wajib memakai sesi kas aktif penanggung jawab';
  END IF;
  PERFORM set_config('app.finance_training_session_id', _session_id::text, true);
  SELECT public.check_in_booking(_transaction_id) INTO result_number;
  RETURN result_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_out_training_transaction(
  _transaction_id uuid,
  _session_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result_number text;
BEGIN
  IF NOT public.finance_training_session_is_valid(auth.uid(), _session_id) THEN
    RAISE EXCEPTION 'Training wajib memakai sesi kas aktif penanggung jawab';
  END IF;

  PERFORM set_config('app.finance_training_session_id', _session_id::text, true);
  SELECT public.check_out_transaction(_transaction_id) INTO result_number;
  RETURN result_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_training_finance_expense(
  _idempotency_key uuid, _session_id uuid, _amount numeric,
  _method text, _category text, _note text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE result_id uuid;
BEGIN
  IF NOT public.finance_training_session_is_valid(auth.uid(), _session_id) THEN
    RAISE EXCEPTION 'Training wajib memakai sesi kas aktif penanggung jawab';
  END IF;
  PERFORM set_config('app.finance_training_session_id', _session_id::text, true);
  SELECT public.record_finance_expense(
    _idempotency_key, _session_id, _amount, _method, _category, _note
  ) INTO result_id;
  RETURN result_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_training_finance_deposit(
  _idempotency_key uuid, _session_id uuid, _method text, _amount numeric,
  _bank_account_id uuid DEFAULT NULL, _proof_ref text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE result_id uuid;
BEGIN
  IF NOT public.finance_training_session_is_valid(auth.uid(), _session_id) THEN
    RAISE EXCEPTION 'Training wajib memakai sesi kas aktif penanggung jawab';
  END IF;
  PERFORM set_config('app.finance_training_session_id', _session_id::text, true);
  SELECT public.create_finance_deposit(
    _idempotency_key, _session_id, _method, _amount, _bank_account_id, _proof_ref
  ) INTO result_id;
  RETURN result_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_training_finance_session_summary(
  _session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT public.finance_training_session_is_valid(auth.uid(), _session_id) THEN
    RAISE EXCEPTION 'Training tidak memiliki akses ke sesi tersebut';
  END IF;
  PERFORM set_config('app.finance_training_session_id', _session_id::text, true);
  SELECT public.get_finance_session_summary(_session_id) INTO result;
  RETURN result;
END;
$function$;

-- Keep the existing Finance 150 summary contract, but deny a restricted
-- trainee's legacy direct call unless it carries the validated assigned
-- session context.
CREATE OR REPLACE FUNCTION public.get_finance_session_summary(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  s public.finance_cash_sessions;
  result jsonb;
BEGIN
  IF public.finance_training_is_restricted(auth.uid())
     AND NOT public.finance_training_context_matches_session(auth.uid(), _session_id) THEN
    RAISE EXCEPTION 'Peserta Training hanya dapat melihat sesi kas penanggung jawab';
  END IF;

  SELECT * INTO s
  FROM public.finance_cash_sessions
  WHERE id = _session_id;

  IF NOT FOUND
     OR (
       s.opened_by <> auth.uid()
       AND NOT public.finance_is_owner_or_supervisor(auth.uid())
       AND NOT public.has_role(auth.uid(), 'owner')
     ) THEN
    RAISE EXCEPTION 'Akses sesi ditolak';
  END IF;

  SELECT jsonb_build_object(
    'opening_cash', s.opening_cash,
    'payments_total', COALESCE((SELECT SUM(amount) FROM public.payments WHERE cash_session_id = _session_id), 0),
    'cash', COALESCE((SELECT SUM(amount) FROM public.payments WHERE cash_session_id = _session_id AND method = 'Cash'), 0),
    'qris', COALESCE((SELECT SUM(amount) FROM public.payments WHERE cash_session_id = _session_id AND method = 'QRIS'), 0),
    'transfer', COALESCE((SELECT SUM(amount) FROM public.payments WHERE cash_session_id = _session_id AND method = 'Transfer'), 0),
    'commission',
      COALESCE((SELECT SUM(commission_amount) FROM public.payments WHERE cash_session_id = _session_id), 0)
      + COALESCE((SELECT SUM(a.commission_delta)
                  FROM public.finance_refund_allocations a
                  JOIN public.payments p ON p.id = a.payment_id
                  WHERE p.cash_session_id = _session_id), 0),
    'expenses', COALESCE((SELECT SUM(amount) FROM public.finance_expenses WHERE session_id = _session_id), 0),
    'refunds', COALESCE((SELECT SUM(amount) FROM public.finance_refunds WHERE source_session_id = _session_id), 0),
    'status', s.status,
    'snapshot', s.closing_snapshot
  ) INTO result;
  RETURN result;
END;
$function$;

DROP POLICY IF EXISTS finance_training_session_read
ON public.finance_cash_sessions;
CREATE POLICY finance_training_session_read
ON public.finance_cash_sessions
FOR SELECT TO authenticated
USING (public.finance_training_current_user_can_read_session(id));

DROP POLICY IF EXISTS finance_sessions_read
ON public.finance_cash_sessions;
CREATE POLICY finance_sessions_read
ON public.finance_cash_sessions
FOR SELECT TO authenticated
USING (
  (
    opened_by = auth.uid()
    AND NOT public.finance_training_current_user_is_restricted()
  )
  OR public.finance_is_owner_or_supervisor(auth.uid())
  OR public.finance_training_current_user_can_read_session(id)
);

REVOKE ALL ON FUNCTION public.finance_training_assignment_for(uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.finance_training_is_restricted(uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.finance_training_session_is_valid(uuid, uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.finance_training_context_valid(uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.finance_training_context_assignment(uuid, uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.finance_training_context_matches_session(uuid, uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.finance_training_transaction_guard() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.finance_training_session_guard() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.finance_training_session_row_guard() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.finance_training_forbidden_finance_mutation_guard() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.finance_training_audit_row() FROM PUBLIC, authenticated;

REVOKE ALL ON FUNCTION public.finance_training_current_user_is_restricted() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_training_current_user_can_read_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_training_current_user_is_restricted() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_training_current_user_can_read_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_training_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_finance_training_assignment(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_finance_training_assignment(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_training_reservation(text, uuid, uuid, text, text, text, numeric, text, text, timestamptz, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_training_transaction_payment(uuid, numeric, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_training_booking(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_out_training_transaction(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_training_finance_expense(uuid, uuid, numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_training_finance_deposit(uuid, uuid, text, numeric, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_training_finance_session_summary(uuid) TO authenticated;

-- Internal predicates are callable only through the SECURITY DEFINER API above.
REVOKE ALL ON FUNCTION public.finance_training_assignment_for(uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.finance_training_is_restricted(uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.finance_training_session_is_valid(uuid, uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.finance_training_context_valid(uuid) FROM PUBLIC, authenticated;

COMMIT;
