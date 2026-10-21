-- FINANCE MINIMAL EXECUTABLE PATCH — ISSUE #4
-- REVIEW-ONLY: DO NOT EXECUTE WITHOUT EXPLICIT OWNER APPROVAL.
-- PostgreSQL-only / Lovable Cloud SQL Editor compatible.
-- Replace the placeholder in SET LOCAL below with the exact Owner UUID
-- before execution. The zero UUID intentionally fails the preflight.
-- The placeholder is not an Owner identity and must not be left unchanged.
--
-- Generated from reviewed main migrations:
--   20261015000000, 20261015000001, 20261015000002, 20261015000003
-- Compatibility decisions:
--   * negative expected_cash is recorded in closing snapshot with zero physical CASH allocation;
--   * transfer settlement remains mandatory; next-session carry stays nonnegative;
--   * legacy create_reservation signature remains available;
--   * Finance-compatible create_reservation signature is added;
--   * legacy record_transaction_payment signature remains available;
--   * Supervisor uses SECURITY DEFINER RPCs;
--   * no direct Supervisor transaction INSERT policy is created;
--   * Owner-approved minimum DP of 40% applies to new bookings only;
--   * exactly one 8% commission seed is created for future events;
--   * existing transactions/payments/prices/P4 remain unchanged.
--
-- This patch is one transaction with fail-fast assertions and postchecks.
-- Rollback/restore: abort on failure; after commit, restore verified DB/Auth
-- backup or use an approved forward-fix. Do not run blind down SQL.

BEGIN;
SET LOCAL app.owner_user_id = '00000000-0000-0000-0000-000000000000';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

DO $preflight$
DECLARE
  v_count integer;
  v_owner uuid;
BEGIN
  BEGIN
    v_owner := NULLIF(current_setting('app.owner_user_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'app.owner_user_id must be a valid UUID';
  END;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Set app.owner_user_id to the exact Owner auth.users UUID before execution';
  END IF;

  IF (
    SELECT count(*)
    FROM public.user_roles
    WHERE user_id = v_owner
      AND role = 'owner'::public.app_role
  ) <> 1 THEN
    RAISE EXCEPTION 'app.owner_user_id must resolve to exactly one existing Owner role';
  END IF;

  IF to_regclass('public.finance_cash_sessions') IS NOT NULL
     OR to_regclass('public.finance_settings') IS NOT NULL THEN
    RAISE EXCEPTION 'Finance objects already exist; use reconciliation, not this first-install patch';
  END IF;

  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Expected Lovable Drizzle migration ledger is missing';
  END IF;

  IF (SELECT max(id) FROM drizzle.__drizzle_migrations) <> 6 THEN
    RAISE EXCEPTION 'Unexpected Drizzle migration ledger; expected latest id 6';
  END IF;

  SELECT count(*) INTO v_count FROM public.transactions;
  IF v_count <> 9 THEN
    RAISE EXCEPTION 'Transaction preservation precondition failed: expected 9, got %', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.payments;
  IF v_count <> 11 THEN
    RAISE EXCEPTION 'Payment preservation precondition failed: expected 11, got %', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.employees;
  IF v_count <> 7 THEN
    RAISE EXCEPTION 'Employee preservation precondition failed: expected 7, got %', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.user_roles;
  IF v_count <> 9 THEN
    RAISE EXCEPTION 'Role preservation precondition failed: expected 9, got %', v_count;
  END IF;

  IF to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'Legacy create_reservation signature is missing';
  END IF;

  IF to_regprocedure('public.check_in_booking(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Legacy check_in_booking signature is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'packages'
      AND column_name IN ('price', 'weekday_price', 'weekend_price')
    GROUP BY table_name
    HAVING count(*) = 3
  ) THEN
    RAISE EXCEPTION 'Required package price columns are missing';
  END IF;
END
$preflight$;

CREATE TEMP TABLE _finance_patch_transactions ON COMMIT DROP AS
SELECT id, transaction_number, status, price_snapshot, package_id,
       day_mode, scheduled_check_in, scheduled_check_out,
       started_at, ends_at, created_by
FROM public.transactions;

CREATE TEMP TABLE _finance_patch_payments ON COMMIT DROP AS
SELECT id, transaction_id, amount, method, kind, created_at, recorded_by
FROM public.payments;

CREATE TEMP TABLE _finance_patch_packages ON COMMIT DROP AS
SELECT id, name, price, weekday_price, weekend_price,
       duration_minutes, active
FROM public.packages;

-- Finance V1.0: append-only financial events, cash sessions, commission snapshots,
-- deposits, refunds, and idempotent payment/charge entry points.

CREATE TABLE IF NOT EXISTS public.finance_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  minimum_dp_mode text NOT NULL DEFAULT 'AMOUNT'
    CHECK (minimum_dp_mode IN ('AMOUNT', 'PERCENTAGE')),
  minimum_dp_value numeric(12,2) NOT NULL DEFAULT 0
    CHECK (minimum_dp_value >= 0),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.finance_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.finance_commission_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('PERCENTAGE', 'PER_ROOM', 'OFF')),
  rate numeric(8,4) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  per_room_amount numeric(12,2) NOT NULL DEFAULT 0
    CHECK (per_room_amount >= 0),
  rounding_rule text NOT NULL DEFAULT 'FLOOR_RP1000'
    CHECK (rounding_rule = 'FLOOR_RP1000'),
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_commission_configs_effective_idx
  ON public.finance_commission_configs (effective_from DESC);
-- Original arbitrary commission seed removed; one deterministic seed is added below.
CREATE TABLE IF NOT EXISTS public.finance_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  logo_key text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_name, account_number)
);

CREATE TABLE IF NOT EXISTS public.finance_cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by uuid NOT NULL REFERENCES auth.users(id),
  operational_date date NOT NULL
    DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date),
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_cash numeric(12,2) NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
  opening_source_session_id uuid REFERENCES public.finance_cash_sessions(id),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FINAL')),
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id),
  closing_reason text NOT NULL DEFAULT '',
  closing_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_cash_sessions_one_open_actor
  ON public.finance_cash_sessions (opened_by)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS finance_cash_sessions_operational_date_idx
  ON public.finance_cash_sessions (operational_date DESC, opened_at DESC);

CREATE TABLE IF NOT EXISTS public.finance_session_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.finance_cash_sessions(id),
  allocation_type text NOT NULL CHECK (allocation_type IN ('SETOR', 'DI_LACI', 'DIBAWA')),
  method text NOT NULL CHECK (method IN ('CASH', 'TRANSFER')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  recipient_user_id uuid REFERENCES auth.users(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_allocation_drawer_recipient_check
    CHECK (allocation_type <> 'DI_LACI' OR recipient_user_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.finance_drawer_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL UNIQUE REFERENCES public.finance_session_allocations(id),
  source_session_id uuid NOT NULL REFERENCES public.finance_cash_sessions(id),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id),
  expected_amount numeric(12,2) NOT NULL CHECK (expected_amount > 0),
  actual_amount numeric(12,2),
  difference numeric(12,2),
  status text NOT NULL DEFAULT 'MENUNGGU_HITUNG'
    CHECK (status IN ('MENUNGGU_HITUNG', 'SELESAI')),
  reason text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  confirmed_by uuid REFERENCES auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_session_allocations_session_idx
  ON public.finance_session_allocations (session_id, allocation_type);

CREATE TABLE IF NOT EXISTS public.finance_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key uuid NOT NULL UNIQUE,
  session_id uuid NOT NULL REFERENCES public.finance_cash_sessions(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('CASH', 'QRIS', 'Transfer')),
  category text NOT NULL,
  note text NOT NULL DEFAULT '',
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key uuid NOT NULL UNIQUE,
  session_id uuid NOT NULL REFERENCES public.finance_cash_sessions(id),
  method text NOT NULL CHECK (method IN ('CASH', 'Transfer')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  bank_account_id uuid REFERENCES public.finance_bank_accounts(id),
  proof_ref text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'MENUNGGU_KONFIRMASI_OWNER'
    CHECK (status IN ('MENUNGGU_KONFIRMASI_OWNER', 'DITERIMA', 'DITOLAK', 'BELUM_DITERIMA')),
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  confirmed_by uuid REFERENCES auth.users(id),
  confirmed_at timestamptz,
  decision_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_deposits_status_idx
  ON public.finance_deposits (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.finance_charge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key uuid NOT NULL UNIQUE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  kind text NOT NULL CHECK (kind IN ('extend', 'overtime')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  processed_by uuid NOT NULL REFERENCES auth.users(id),
  commission_mode text NOT NULL CHECK (commission_mode IN ('PERCENTAGE', 'PER_ROOM', 'OFF')),
  commission_rate numeric(8,4) NOT NULL DEFAULT 0,
  commission_per_room_amount numeric(12,2) NOT NULL DEFAULT 0,
  commission_rounding text NOT NULL DEFAULT 'FLOOR_RP1000',
  commission_recipient uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key uuid NOT NULL UNIQUE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  refund_method text NOT NULL CHECK (refund_method IN ('CASH', 'QRIS', 'Transfer')),
  source_type text NOT NULL CHECK (source_type IN ('SHIFT_CASH', 'DRAWER', 'OWNER_FUNDS')),
  source_session_id uuid REFERENCES public.finance_cash_sessions(id),
  reason text NOT NULL,
  original_payment_total numeric(12,2) NOT NULL,
  commission_adjustment numeric(12,2) NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_refund_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES public.finance_refunds(id),
  payment_id uuid NOT NULL REFERENCES public.payments(id),
  refunded_amount numeric(12,2) NOT NULL CHECK (refunded_amount > 0),
  original_commission numeric(12,2) NOT NULL DEFAULT 0,
  adjusted_commission numeric(12,2) NOT NULL DEFAULT 0,
  commission_delta numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (refund_id, payment_id)
);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS cash_session_id uuid,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS charge_event_id uuid,
  ADD COLUMN IF NOT EXISTS commission_mode text,
  ADD COLUMN IF NOT EXISTS commission_rate numeric(8,4),
  ADD COLUMN IF NOT EXISTS commission_per_room_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS commission_rounding text,
  ADD COLUMN IF NOT EXISTS commission_recipient uuid,
  ADD COLUMN IF NOT EXISTS commission_amount numeric(12,2);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS commission_mode_snapshot text,
  ADD COLUMN IF NOT EXISTS commission_rate_snapshot numeric(8,4),
  ADD COLUMN IF NOT EXISTS commission_per_room_amount_snapshot numeric(12,2),
  ADD COLUMN IF NOT EXISTS commission_rounding_snapshot text;

CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_unique
  ON public.payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

DO $finance_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_cash_session_id_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_cash_session_id_fkey
      FOREIGN KEY (cash_session_id)
      REFERENCES public.finance_cash_sessions(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_charge_event_id_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_charge_event_id_fkey
      FOREIGN KEY (charge_event_id)
      REFERENCES public.finance_charge_events(id);
  END IF;
END;
$finance_fk$;

CREATE OR REPLACE FUNCTION public.finance_is_owner_or_supervisor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'owner')
    OR public.has_employee_position(
      _user_id,
      ARRAY['supervisor'::public.employee_position]
    );
$$;

CREATE OR REPLACE FUNCTION public.finance_commission_at(_at timestamptz)
RETURNS TABLE (
  mode text,
  rate numeric,
  per_room_amount numeric,
  rounding_rule text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.mode, c.rate, c.per_room_amount, c.rounding_rule
  FROM public.finance_commission_configs c
  WHERE c.effective_from <= _at
  ORDER BY c.effective_from DESC, c.created_at DESC
  LIMIT 1;
$$;

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
     OR selected_session.opened_by <> NEW.recorded_by THEN
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

CREATE OR REPLACE FUNCTION public.finance_booking_payment_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  total_paid numeric;
  minimum_value numeric;
  settings_row public.finance_settings;
BEGIN
  IF NEW.status <> 'booking' THEN
    RETURN NEW;
  END IF;

  IF NEW.price_snapshot IS NULL OR NEW.price_snapshot <= 0 THEN
    RAISE EXCEPTION 'Booking wajib memiliki tagihan valid';
  END IF;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO total_paid
  FROM public.payments p
  WHERE p.transaction_id = NEW.id;

  SELECT * INTO settings_row
  FROM public.finance_settings
  WHERE id = true;

  minimum_value := CASE settings_row.minimum_dp_mode
    WHEN 'PERCENTAGE' THEN NEW.price_snapshot * settings_row.minimum_dp_value / 100
    ELSE settings_row.minimum_dp_value
  END;

  IF total_paid <= 0 OR total_paid < minimum_value THEN
    RAISE EXCEPTION 'Booking wajib memiliki DP sesuai minimum Owner';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finance_final_session_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF OLD.status = 'FINAL' THEN
    RAISE EXCEPTION 'Closing final tidak dapat diubah atau dihapus';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS finance_prepare_payment_trigger ON public.payments;
CREATE TRIGGER finance_prepare_payment_trigger
BEFORE INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.finance_prepare_payment();

DROP TRIGGER IF EXISTS finance_booking_payment_guard_trigger ON public.transactions;
CREATE CONSTRAINT TRIGGER finance_booking_payment_guard_trigger
AFTER INSERT OR UPDATE OF status, price_snapshot ON public.transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.finance_booking_payment_guard();

DROP TRIGGER IF EXISTS finance_final_session_guard_trigger ON public.finance_cash_sessions;
CREATE TRIGGER finance_final_session_guard_trigger
BEFORE UPDATE OR DELETE ON public.finance_cash_sessions
FOR EACH ROW
EXECUTE FUNCTION public.finance_final_session_guard();

CREATE OR REPLACE FUNCTION public.open_finance_cash_session(_opening_cash numeric DEFAULT 0)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  previous_session public.finance_cash_sessions;
  carried_amount numeric := 0;
  new_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'owner') OR public.is_receptionist(auth.uid())) THEN
    RAISE EXCEPTION 'Hanya Owner atau Receptionist yang dapat membuka sesi kas';
  END IF;

  IF _opening_cash < 0 THEN
    RAISE EXCEPTION 'Saldo awal tidak valid';
  END IF;

  SELECT * INTO previous_session
  FROM public.finance_cash_sessions s
  WHERE s.opened_by = auth.uid()
    AND s.status = 'FINAL'
  ORDER BY s.closed_at DESC NULLS LAST
  LIMIT 1;

  IF previous_session.id IS NOT NULL THEN
    SELECT COALESCE(SUM(a.amount), 0)
    INTO carried_amount
    FROM public.finance_session_allocations a
    WHERE a.session_id = previous_session.id
      AND a.allocation_type = 'DIBAWA';
  END IF;

  INSERT INTO public.finance_cash_sessions (
    opened_by,
    opening_cash,
    opening_source_session_id
  )
  VALUES (
    auth.uid(),
    CASE WHEN previous_session.id IS NOT NULL THEN carried_amount ELSE _opening_cash END,
    CASE WHEN previous_session.id IS NOT NULL THEN previous_session.id ELSE NULL END
  )
  RETURNING id INTO new_id;

  RETURN new_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Masih ada sesi kas aktif untuk pengguna ini';
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_transaction_payment(
  _transaction_id uuid,
  _amount numeric,
  _method text,
  _idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_transaction record;
  already_paid numeric;
  remaining_amount numeric;
  existing_payment uuid;
  new_payment_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'owner') OR public.is_receptionist(auth.uid())) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT id INTO existing_payment
  FROM public.payments
  WHERE idempotency_key = _idempotency_key;

  IF existing_payment IS NOT NULL THEN
    RETURN existing_payment;
  END IF;

  IF _idempotency_key IS NULL OR _amount IS NULL OR _amount <= 0
     OR _method NOT IN ('Cash', 'QRIS', 'Transfer') THEN
    RAISE EXCEPTION 'Data pembayaran tidak valid';
  END IF;

  SELECT * INTO selected_transaction
  FROM public.transactions
  WHERE id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND OR selected_transaction.status = 'cancelled' THEN
    RAISE EXCEPTION 'Transaksi tidak dapat menerima pembayaran';
  END IF;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO already_paid
  FROM public.payments p
  WHERE p.transaction_id = _transaction_id;

  remaining_amount := selected_transaction.price_snapshot - already_paid;

  IF remaining_amount <= 0 OR _amount > remaining_amount THEN
    RAISE EXCEPTION 'Nominal pembayaran melebihi sisa tagihan';
  END IF;

  INSERT INTO public.payments (
    transaction_id,
    amount,
    method,
    kind,
    recorded_by,
    idempotency_key
  )
  VALUES (
    _transaction_id,
    _amount,
    _method,
    'payment',
    auth.uid(),
    _idempotency_key
  )
  ON CONFLICT (idempotency_key)
  WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO new_payment_id;

  IF new_payment_id IS NULL THEN
    SELECT id INTO new_payment_id
    FROM public.payments
    WHERE idempotency_key = _idempotency_key;
  END IF;

  RETURN new_payment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_finance_cash_session(
  _session_id uuid,
  _allocation jsonb,
  _reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_session public.finance_cash_sessions;
  cash_received numeric;
  transfer_received numeric;
  cash_expenses numeric;
  cash_refunds numeric;
  expected_cash numeric;
  setor_cash numeric := COALESCE((_allocation->>'setor_cash')::numeric, 0);
  setor_transfer numeric := COALESCE((_allocation->>'setor_transfer')::numeric, 0);
  di_laci numeric := COALESCE((_allocation->>'di_laci')::numeric, 0);
  dibawa numeric := COALESCE((_allocation->>'dibawa')::numeric, 0);
  di_laci_allocation_id uuid;
  total_allocated numeric;
  snapshot jsonb;
BEGIN
  SELECT * INTO selected_session
  FROM public.finance_cash_sessions s
  WHERE s.id = _session_id
  FOR UPDATE;

  IF NOT FOUND OR selected_session.status <> 'OPEN' THEN
    RAISE EXCEPTION 'Sesi kas tidak aktif';
  END IF;

  IF selected_session.opened_by <> auth.uid()
     AND NOT public.finance_is_owner_or_supervisor(auth.uid()) THEN
    RAISE EXCEPTION 'Tidak berwenang menutup sesi kas ini';
  END IF;

  IF selected_session.opened_by <> auth.uid()
     AND length(trim(coalesce(_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Alasan closing khusus wajib diisi';
  END IF;

  IF setor_cash < 0 OR setor_transfer < 0 OR di_laci < 0 OR dibawa < 0 THEN
    RAISE EXCEPTION 'Nominal alokasi closing tidak boleh negatif';
  END IF;

  SELECT COALESCE(SUM(p.amount), 0) INTO cash_received
  FROM public.payments p
  WHERE p.cash_session_id = _session_id AND p.method = 'Cash';

  SELECT COALESCE(SUM(p.amount), 0) INTO transfer_received
  FROM public.payments p
  WHERE p.cash_session_id = _session_id AND p.method = 'Transfer';

  SELECT COALESCE(SUM(e.amount), 0) INTO cash_expenses
  FROM public.finance_expenses e
  WHERE e.session_id = _session_id AND e.method = 'CASH';

  SELECT COALESCE(SUM(r.amount), 0) INTO cash_refunds
  FROM public.finance_refunds r
  WHERE r.source_session_id = _session_id AND r.refund_method = 'CASH';

  expected_cash := selected_session.opening_cash + cash_received
    - cash_expenses - cash_refunds;
  total_allocated := setor_cash + di_laci + dibawa;

  -- Saldo kas negatif adalah defisit sesi (bukan uang tunai fisik).
  -- Simpan expected_cash negatif di closing_snapshot; jangan membuat
  -- alokasi negatif atau catatan talangan pribadi terpisah.
  -- Nilai alokasi fisik harus nol saat expected_cash <= 0.
  IF expected_cash < 0 THEN
    IF total_allocated <> 0 THEN
      RAISE EXCEPTION 'Saldo kas minus: alokasi CASH harus nol';
    END IF;
  ELSIF expected_cash <> total_allocated THEN
    RAISE EXCEPTION 'Alokasi kas tidak sama dengan saldo fisik yang diharapkan';
  END IF;

  IF setor_transfer <> transfer_received THEN
    RAISE EXCEPTION 'Alokasi SETOR transfer harus sama dengan penerimaan transfer sesi';
  END IF;

  IF di_laci > 0 AND NULLIF(_allocation->>'recipient_user_id', '') IS NULL THEN
    RAISE EXCEPTION 'Penerima DI LACI wajib dicatat';
  END IF;

  IF setor_cash > 0 THEN
    INSERT INTO public.finance_session_allocations
      (session_id, allocation_type, method, amount, created_by)
    VALUES (_session_id, 'SETOR', 'CASH', setor_cash, auth.uid());
  END IF;

  IF setor_transfer > 0 THEN
    INSERT INTO public.finance_session_allocations
      (session_id, allocation_type, method, amount, created_by)
    VALUES (_session_id, 'SETOR', 'TRANSFER', setor_transfer, auth.uid());
  END IF;

  IF di_laci > 0 THEN
    INSERT INTO public.finance_session_allocations
      (session_id, allocation_type, method, amount, recipient_user_id, created_by)
    VALUES (_session_id, 'DI_LACI', 'CASH', di_laci,
      NULLIF(_allocation->>'recipient_user_id', '')::uuid, auth.uid())
    RETURNING id INTO di_laci_allocation_id;

    INSERT INTO public.finance_drawer_handoffs
      (allocation_id, source_session_id, recipient_user_id, expected_amount, created_by)
    VALUES (
      di_laci_allocation_id,
      _session_id,
      NULLIF(_allocation->>'recipient_user_id', '')::uuid,
      di_laci,
      auth.uid()
    );
  END IF;

  IF dibawa > 0 THEN
    INSERT INTO public.finance_session_allocations
      (session_id, allocation_type, method, amount, recipient_user_id, created_by)
    VALUES (_session_id, 'DIBAWA', 'CASH', dibawa, selected_session.opened_by, auth.uid());
  END IF;

  snapshot := jsonb_build_object(
    'opening_cash', selected_session.opening_cash,
    'cash_received', cash_received,
    'transfer_received', transfer_received,
    'cash_expenses', cash_expenses,
    'cash_refunds', cash_refunds,
    'expected_cash', expected_cash,
    'setor_cash', setor_cash,
    'setor_transfer', setor_transfer,
    'di_laci', di_laci,
    'dibawa', dibawa,
    'closed_by', auth.uid(),
    'closed_at', now()
  );

  UPDATE public.finance_cash_sessions
  SET status = 'FINAL',
      closed_at = now(),
      closed_by = auth.uid(),
      closing_reason = trim(coalesce(_reason, '')),
      closing_snapshot = snapshot
  WHERE id = _session_id;

  RETURN snapshot;
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_finance_drawer_handover(
  _handoff_id uuid,
  _actual_amount numeric,
  _reason text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE handoff public.finance_drawer_handoffs;
BEGIN
  SELECT * INTO handoff FROM public.finance_drawer_handoffs WHERE id = _handoff_id FOR UPDATE;
  IF NOT FOUND OR handoff.status <> 'MENUNGGU_HITUNG' THEN RAISE EXCEPTION 'Serah terima tidak aktif'; END IF;
  IF auth.uid() <> handoff.recipient_user_id AND NOT public.finance_is_owner_or_supervisor(auth.uid()) THEN RAISE EXCEPTION 'Penerima atau pengawas yang berwenang wajib mengonfirmasi'; END IF;
  IF _actual_amount < 0 THEN RAISE EXCEPTION 'Nominal aktual tidak valid'; END IF;
  UPDATE public.finance_drawer_handoffs
  SET actual_amount = _actual_amount,
      difference = _actual_amount - expected_amount,
      status = 'SELESAI',
      reason = trim(coalesce(_reason, '')),
      confirmed_by = auth.uid(),
      confirmed_at = now()
  WHERE id = _handoff_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_finance_expense(
  _idempotency_key uuid,
  _session_id uuid,
  _amount numeric,
  _method text,
  _category text,
  _note text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  existing_id uuid;
  session_status text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'owner') OR public.is_receptionist(auth.uid())) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT id INTO existing_id FROM public.finance_expenses
  WHERE idempotency_key = _idempotency_key;
  IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;

  SELECT status INTO session_status FROM public.finance_cash_sessions
  WHERE id = _session_id AND opened_by = auth.uid();
  IF session_status <> 'OPEN' THEN RAISE EXCEPTION 'Sesi kas tidak aktif'; END IF;

  INSERT INTO public.finance_expenses
    (idempotency_key, session_id, amount, method, category, note, recorded_by)
  VALUES (_idempotency_key, _session_id, _amount, _method, trim(_category), trim(coalesce(_note, '')), auth.uid())
  RETURNING id INTO existing_id;
  RETURN existing_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_finance_deposit(
  _idempotency_key uuid,
  _session_id uuid,
  _method text,
  _amount numeric,
  _bank_account_id uuid DEFAULT NULL,
  _proof_ref text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE existing_id uuid; session_status text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'owner') OR public.is_receptionist(auth.uid())) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT id INTO existing_id FROM public.finance_deposits WHERE idempotency_key = _idempotency_key;
  IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;
  SELECT status INTO session_status FROM public.finance_cash_sessions WHERE id = _session_id AND opened_by = auth.uid();
  IF session_status NOT IN ('OPEN', 'FINAL') THEN RAISE EXCEPTION 'Sesi kas tidak ditemukan'; END IF;
  IF _method = 'Transfer' AND _bank_account_id IS NULL THEN RAISE EXCEPTION 'Rekening Owner wajib dipilih'; END IF;
  IF _method = 'Transfer' AND length(trim(coalesce(_proof_ref, ''))) = 0 THEN RAISE EXCEPTION 'Bukti transfer wajib dicatat'; END IF;
  INSERT INTO public.finance_deposits
    (idempotency_key, session_id, method, amount, bank_account_id, proof_ref, submitted_by)
  VALUES (_idempotency_key, _session_id, _method, _amount, _bank_account_id, trim(coalesce(_proof_ref, '')), auth.uid())
  RETURNING id INTO existing_id;
  RETURN existing_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decide_finance_deposit(
  _deposit_id uuid,
  _status text,
  _reason text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_status text;
  deposit_row public.finance_deposits;
  session_row public.finance_cash_sessions;
  allocated_amount numeric;
  accepted_amount numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN RAISE EXCEPTION 'Hanya Owner yang dapat mengonfirmasi setoran'; END IF;
  IF _status NOT IN ('DITERIMA', 'DITOLAK', 'BELUM_DITERIMA') THEN RAISE EXCEPTION 'Status setoran tidak valid'; END IF;
  SELECT * INTO deposit_row FROM public.finance_deposits WHERE id = _deposit_id FOR UPDATE;
  current_status := deposit_row.status;
  IF current_status IS NULL OR current_status <> 'MENUNGGU_KONFIRMASI_OWNER' THEN RAISE EXCEPTION 'Setoran sudah diputuskan'; END IF;

  -- Lock order is always deposit first, then its session. All concurrent
  -- deposit decisions for one session therefore serialize consistently.
  SELECT *
  INTO session_row
  FROM public.finance_cash_sessions s
  WHERE s.id = deposit_row.session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesi setoran tidak ditemukan';
  END IF;

  IF _status = 'DITERIMA' THEN
    IF session_row.status <> 'FINAL' THEN
      RAISE EXCEPTION 'Setoran hanya dapat diterima setelah sesi kas FINAL';
    END IF;

    SELECT COALESCE(SUM(a.amount), 0)
    INTO allocated_amount
    FROM public.finance_session_allocations a
    WHERE a.session_id = deposit_row.session_id
      AND a.allocation_type = 'SETOR'
      AND a.method = deposit_row.method;

    SELECT COALESCE(SUM(d.amount), 0)
    INTO accepted_amount
    FROM public.finance_deposits d
    WHERE d.session_id = deposit_row.session_id
      AND d.method = deposit_row.method
      AND d.status = 'DITERIMA'
      AND d.id <> deposit_row.id;

    IF allocated_amount <= 0
       OR accepted_amount + deposit_row.amount > allocated_amount THEN
      RAISE EXCEPTION 'Nominal setoran tidak sesuai alokasi SETOR pada closing';
    END IF;
  END IF;

  UPDATE public.finance_deposits SET status = _status, confirmed_by = auth.uid(), confirmed_at = now(), decision_reason = trim(coalesce(_reason, '')) WHERE id = _deposit_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_finance_settings(
  _minimum_dp_mode text,
  _minimum_dp_value numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN RAISE EXCEPTION 'Hanya Owner yang dapat mengubah minimum DP'; END IF;
  IF _minimum_dp_mode NOT IN ('AMOUNT', 'PERCENTAGE') OR _minimum_dp_value < 0 THEN RAISE EXCEPTION 'Konfigurasi minimum DP tidak valid'; END IF;
  UPDATE public.finance_settings SET minimum_dp_mode = _minimum_dp_mode, minimum_dp_value = _minimum_dp_value, updated_by = auth.uid(), updated_at = now() WHERE id = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_finance_commission_config(
  _mode text,
  _rate numeric,
  _per_room_amount numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN RAISE EXCEPTION 'Hanya Owner yang dapat mengubah komisi'; END IF;
  IF _mode NOT IN ('PERCENTAGE', 'PER_ROOM', 'OFF') OR _rate < 0 OR _per_room_amount < 0 THEN RAISE EXCEPTION 'Konfigurasi komisi tidak valid'; END IF;
  IF _mode = 'PERCENTAGE' AND _rate > 100 THEN RAISE EXCEPTION 'Persentase komisi tidak valid'; END IF;
  INSERT INTO public.finance_commission_configs (mode, rate, per_room_amount, created_by) VALUES (_mode, _rate, _per_room_amount, auth.uid()) RETURNING id INTO new_id;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_finance_bank_account(
  _id uuid,
  _bank_name text,
  _account_name text,
  _account_number text,
  _logo_key text,
  _active boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE account_id uuid := COALESCE(_id, gen_random_uuid());
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN RAISE EXCEPTION 'Hanya Owner yang dapat mengelola rekening'; END IF;
  INSERT INTO public.finance_bank_accounts (id, bank_name, account_name, account_number, logo_key, active, created_by)
  VALUES (account_id, trim(_bank_name), trim(_account_name), trim(_account_number), trim(coalesce(_logo_key, '')), _active, auth.uid())
  ON CONFLICT (id) DO UPDATE SET bank_name = excluded.bank_name, account_name = excluded.account_name, account_number = excluded.account_number, logo_key = excluded.logo_key, active = excluded.active;
  RETURN account_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_finance_refund(
  _idempotency_key uuid,
  _transaction_id uuid,
  _amount numeric,
  _refund_method text,
  _source_type text,
  _source_session_id uuid,
  _reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  refund_id uuid;
  paid_total numeric;
  refunded_total numeric;
  remaining numeric;
  payment_row record;
  allocation numeric;
  original_commission numeric;
  adjusted_commission numeric;
  total_adjustment numeric := 0;
  transaction_total numeric;
  transaction_row public.transactions;
  source_available numeric;
  commission_mode_value text;
  commission_rate_value numeric := 0;
  commission_before numeric := 0;
  commission_after numeric := 0;
  first_allocation boolean := true;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN RAISE EXCEPTION 'Hanya Owner yang dapat melakukan refund'; END IF;
  SELECT id INTO refund_id FROM public.finance_refunds WHERE idempotency_key = _idempotency_key;
  IF refund_id IS NOT NULL THEN RETURN refund_id; END IF;
  IF _amount <= 0 OR _refund_method NOT IN ('CASH', 'QRIS', 'Transfer') OR _source_type NOT IN ('SHIFT_CASH', 'DRAWER', 'OWNER_FUNDS') OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'Data refund tidak valid'; END IF;
  IF _source_type = 'OWNER_FUNDS' AND _source_session_id IS NOT NULL THEN
    RAISE EXCEPTION 'Dana Owner tidak boleh membawa source_session_id';
  END IF;
  IF _source_type IN ('SHIFT_CASH', 'DRAWER') AND _source_session_id IS NULL THEN
    RAISE EXCEPTION 'Sumber kas refund wajib memilih sesi';
  END IF;
  IF _source_session_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.finance_cash_sessions s
       WHERE s.id = _source_session_id
         AND s.status IN ('OPEN', 'FINAL')
     ) THEN
    RAISE EXCEPTION 'Sesi sumber refund tidak valid';
  END IF;
  IF _source_type = 'DRAWER'
     AND NOT EXISTS (
       SELECT 1
       FROM public.finance_drawer_handoffs h
       WHERE h.source_session_id = _source_session_id
         AND h.status = 'SELESAI'
     ) THEN
    RAISE EXCEPTION 'Sumber laci belum memiliki serah terima yang selesai';
  END IF;

  SELECT *
  INTO transaction_row
  FROM public.transactions t
  WHERE t.id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi refund tidak ditemukan';
  END IF;

  transaction_total := transaction_row.price_snapshot;

  IF _source_session_id IS NOT NULL THEN
    PERFORM 1
    FROM public.finance_cash_sessions s
    WHERE s.id = _source_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sesi sumber refund tidak ditemukan';
    END IF;
  END IF;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO paid_total
  FROM public.payments p
  WHERE p.transaction_id = _transaction_id;

  IF _source_type = 'SHIFT_CASH' THEN
    SELECT s.opening_cash
      + COALESCE((SELECT SUM(p.amount) FROM public.payments p WHERE p.cash_session_id = s.id AND p.method = 'Cash'), 0)
      - COALESCE((SELECT SUM(e.amount) FROM public.finance_expenses e WHERE e.session_id = s.id AND e.method = 'CASH'), 0)
      - COALESCE((SELECT SUM(r.amount) FROM public.finance_refunds r WHERE r.source_session_id = s.id AND r.refund_method = 'CASH'), 0)
    INTO source_available
    FROM public.finance_cash_sessions s
    WHERE s.id = _source_session_id;

    IF _amount > COALESCE(source_available, 0) THEN
      RAISE EXCEPTION 'Saldo kas sumber tidak mencukupi untuk refund';
    END IF;
  ELSIF _source_type = 'DRAWER' THEN
    SELECT COALESCE(SUM(h.actual_amount), 0)
      - COALESCE((SELECT SUM(r.amount) FROM public.finance_refunds r WHERE r.source_session_id = _source_session_id AND r.refund_method = 'CASH'), 0)
    INTO source_available
    FROM public.finance_drawer_handoffs h
    WHERE h.source_session_id = _source_session_id
      AND h.status = 'SELESAI';

    IF _amount > COALESCE(source_available, 0) THEN
      RAISE EXCEPTION 'Saldo laci sumber tidak mencukupi untuk refund';
    END IF;
  END IF;

  SELECT COALESCE(SUM(r.amount), 0) INTO refunded_total FROM public.finance_refunds r WHERE r.transaction_id = _transaction_id;
  IF _amount > paid_total - refunded_total THEN RAISE EXCEPTION 'Nominal refund melebihi penerimaan yang sah'; END IF;

  commission_mode_value := COALESCE(transaction_row.commission_mode_snapshot, 'OFF');
  commission_rate_value := COALESCE(transaction_row.commission_rate_snapshot, 0);

  IF transaction_row.commission_mode_snapshot IS NULL THEN
    SELECT COALESCE(p.commission_mode, 'OFF'), COALESCE(p.commission_rate, 0)
    INTO commission_mode_value, commission_rate_value
    FROM public.payments p
    WHERE p.transaction_id = _transaction_id
    ORDER BY p.created_at, p.id
    LIMIT 1;
  END IF;

  IF commission_mode_value = 'PERCENTAGE' THEN
    commission_before := floor(((paid_total - refunded_total) * commission_rate_value / 100) / 1000) * 1000;
    commission_after := floor(((paid_total - refunded_total - _amount) * commission_rate_value / 100) / 1000) * 1000;
    total_adjustment := commission_after - commission_before;
  ELSIF commission_mode_value = 'PER_ROOM'
    AND _amount + refunded_total >= paid_total THEN
    SELECT COALESCE(SUM(p.commission_amount), 0)
    INTO commission_before
    FROM public.payments p
    WHERE p.transaction_id = _transaction_id;
    commission_after := 0;
    total_adjustment := commission_after - commission_before;
  END IF;

  INSERT INTO public.finance_refunds (idempotency_key, transaction_id, amount, refund_method, source_type, source_session_id, reason, original_payment_total, created_by)
  VALUES (_idempotency_key, _transaction_id, _amount, _refund_method, _source_type, _source_session_id, trim(_reason), paid_total, auth.uid())
  RETURNING id INTO refund_id;

  UPDATE public.finance_refunds
  SET commission_adjustment = total_adjustment
  WHERE id = refund_id;

  remaining := _amount;
  FOR payment_row IN
    SELECT p.*,
      COALESCE((SELECT SUM(a.refunded_amount) FROM public.finance_refund_allocations a WHERE a.payment_id = p.id), 0) AS already_refunded
    FROM public.payments p
    WHERE p.transaction_id = _transaction_id
    ORDER BY p.created_at, p.id
  LOOP
    EXIT WHEN remaining <= 0;
    allocation := LEAST(remaining, payment_row.amount - payment_row.already_refunded);
    CONTINUE WHEN allocation <= 0;

    IF first_allocation THEN
      original_commission := commission_before;
      adjusted_commission := commission_after;
      first_allocation := false;
    ELSE
      original_commission := 0;
      adjusted_commission := 0;
    END IF;

    INSERT INTO public.finance_refund_allocations (refund_id, payment_id, refunded_amount, original_commission, adjusted_commission, commission_delta)
    VALUES (refund_id, payment_row.id, allocation, original_commission, adjusted_commission, adjusted_commission - original_commission);
    remaining := remaining - allocation;
  END LOOP;
  IF remaining > 0 THEN RAISE EXCEPTION 'Alokasi refund tidak lengkap'; END IF;
  RETURN refund_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_finance_session_summary(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE s public.finance_cash_sessions; result jsonb;
BEGIN
  SELECT * INTO s FROM public.finance_cash_sessions WHERE id = _session_id;
  IF NOT FOUND OR (s.opened_by <> auth.uid() AND NOT public.finance_is_owner_or_supervisor(auth.uid()) AND NOT public.has_role(auth.uid(), 'owner')) THEN RAISE EXCEPTION 'Akses sesi ditolak'; END IF;
  SELECT jsonb_build_object(
    'opening_cash', s.opening_cash,
    -- Cash-only ledger balance, can be negative. QRIS/Transfer not mixed in.
    'expected_cash', s.opening_cash
      + COALESCE((SELECT SUM(amount) FROM public.payments WHERE cash_session_id = _session_id AND method = 'Cash'), 0)
      - COALESCE((SELECT SUM(amount) FROM public.finance_expenses WHERE session_id = _session_id AND method = 'CASH'), 0)
      - COALESCE((SELECT SUM(amount) FROM public.finance_refunds WHERE source_session_id = _session_id AND refund_method = 'CASH'), 0),
    'payments_total', COALESCE((SELECT SUM(amount) FROM public.payments WHERE cash_session_id = _session_id), 0),
    'cash', COALESCE((SELECT SUM(amount) FROM public.payments WHERE cash_session_id = _session_id AND method = 'Cash'), 0),
    'qris', COALESCE((SELECT SUM(amount) FROM public.payments WHERE cash_session_id = _session_id AND method = 'QRIS'), 0),
    'transfer', COALESCE((SELECT SUM(amount) FROM public.payments WHERE cash_session_id = _session_id AND method = 'Transfer'), 0),
    'commission',
      COALESCE((SELECT SUM(commission_amount) FROM public.payments WHERE cash_session_id = _session_id), 0)
      + COALESCE((SELECT SUM(commission_adjustment) FROM public.finance_refunds WHERE source_session_id = _session_id), 0),
    'expenses', COALESCE((SELECT SUM(amount) FROM public.finance_expenses WHERE session_id = _session_id), 0),
    'refunds', COALESCE((SELECT SUM(amount) FROM public.finance_refunds WHERE source_session_id = _session_id), 0),
    'status', s.status,
    'snapshot', s.closing_snapshot
  ) INTO result;
  RETURN result;
END;
$function$;

-- RLS: direct writes stay closed; all mutations go through SECURITY DEFINER RPCs.
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_commission_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_session_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_charge_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_refund_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_drawer_handoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_settings_read ON public.finance_settings;
CREATE POLICY finance_settings_read ON public.finance_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
DROP POLICY IF EXISTS finance_commission_configs_read ON public.finance_commission_configs;
CREATE POLICY finance_commission_configs_read ON public.finance_commission_configs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
DROP POLICY IF EXISTS finance_bank_accounts_read ON public.finance_bank_accounts;
CREATE POLICY finance_bank_accounts_read ON public.finance_bank_accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner') OR public.is_receptionist(auth.uid()));
DROP POLICY IF EXISTS finance_sessions_read ON public.finance_cash_sessions;
CREATE POLICY finance_sessions_read ON public.finance_cash_sessions FOR SELECT TO authenticated USING (opened_by = auth.uid() OR public.finance_is_owner_or_supervisor(auth.uid()));
DROP POLICY IF EXISTS finance_allocations_read ON public.finance_session_allocations;
CREATE POLICY finance_allocations_read ON public.finance_session_allocations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.finance_cash_sessions s WHERE s.id = session_id AND (s.opened_by = auth.uid() OR public.finance_is_owner_or_supervisor(auth.uid()))));
DROP POLICY IF EXISTS finance_expenses_read ON public.finance_expenses;
CREATE POLICY finance_expenses_read ON public.finance_expenses FOR SELECT TO authenticated USING (recorded_by = auth.uid() OR public.finance_is_owner_or_supervisor(auth.uid()));
DROP POLICY IF EXISTS finance_deposits_read ON public.finance_deposits;
CREATE POLICY finance_deposits_read ON public.finance_deposits FOR SELECT TO authenticated USING (submitted_by = auth.uid() OR public.finance_is_owner_or_supervisor(auth.uid()));
DROP POLICY IF EXISTS finance_charges_read ON public.finance_charge_events;
CREATE POLICY finance_charges_read ON public.finance_charge_events FOR SELECT TO authenticated USING (processed_by = auth.uid() OR public.finance_is_owner_or_supervisor(auth.uid()));
DROP POLICY IF EXISTS finance_refunds_read ON public.finance_refunds;
CREATE POLICY finance_refunds_read ON public.finance_refunds FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner') OR created_by = auth.uid());
DROP POLICY IF EXISTS finance_refund_allocations_read ON public.finance_refund_allocations;
CREATE POLICY finance_refund_allocations_read ON public.finance_refund_allocations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.finance_refunds r WHERE r.id = refund_id AND (public.has_role(auth.uid(), 'owner') OR r.created_by = auth.uid())));
DROP POLICY IF EXISTS finance_drawer_handoffs_read ON public.finance_drawer_handoffs;
CREATE POLICY finance_drawer_handoffs_read ON public.finance_drawer_handoffs FOR SELECT TO authenticated USING (recipient_user_id = auth.uid() OR public.finance_is_owner_or_supervisor(auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON TABLE public.finance_settings, public.finance_commission_configs, public.finance_bank_accounts, public.finance_cash_sessions, public.finance_session_allocations, public.finance_drawer_handoffs, public.finance_expenses, public.finance_deposits, public.finance_charge_events, public.finance_refunds, public.finance_refund_allocations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.finance_settings, public.finance_commission_configs, public.finance_bank_accounts, public.finance_cash_sessions, public.finance_session_allocations, public.finance_drawer_handoffs, public.finance_expenses, public.finance_deposits, public.finance_charge_events, public.finance_refunds, public.finance_refund_allocations TO authenticated;

REVOKE ALL ON FUNCTION public.record_transaction_payment(uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_transaction_payment(uuid, numeric, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_transaction_payment(uuid, numeric, text, uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.open_finance_cash_session(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_finance_cash_session(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_finance_expense(uuid, uuid, numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_finance_deposit(uuid, uuid, text, numeric, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_finance_deposit(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_finance_settings(text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_finance_commission_config(text, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_finance_bank_account(uuid, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_finance_refund(uuid, uuid, numeric, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_session_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_finance_drawer_handover(uuid, numeric, text) TO authenticated;

REVOKE ALL ON FUNCTION public.finance_is_owner_or_supervisor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_commission_at(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_prepare_payment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_booking_payment_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_final_session_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_is_owner_or_supervisor(uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.finance_is_owner_or_supervisor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_commission_at(timestamptz) TO postgres;
GRANT EXECUTE ON FUNCTION public.finance_prepare_payment() TO postgres;
GRANT EXECUTE ON FUNCTION public.finance_booking_payment_guard() TO postgres;
GRANT EXECUTE ON FUNCTION public.finance_final_session_guard() TO postgres;

-- Finance 150 local follow-up only.
-- This migration is intentionally separate from the Booking baseline and
-- must not be executed in Cloud/Staging without Owner approval.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS minimum_dp_mode_snapshot text,
  ADD COLUMN IF NOT EXISTS minimum_dp_value_snapshot numeric(8,4),
  ADD COLUMN IF NOT EXISTS minimum_dp_amount_snapshot numeric(12,2);

CREATE TABLE IF NOT EXISTS public.finance_reservation_idempotency (
  idempotency_key uuid PRIMARY KEY,
  request_fingerprint text NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id),
  transaction_number text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_reservation_idempotency_transaction_idx
  ON public.finance_reservation_idempotency (transaction_id);

-- DP default update intentionally removed; Owner approval is required.
CREATE OR REPLACE FUNCTION public.finance_snapshot_booking_dp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  setting_row public.finance_settings;
  raw_minimum numeric;
BEGIN
  IF NEW.status <> 'booking' OR NEW.minimum_dp_mode_snapshot IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO setting_row
  FROM public.finance_settings
  WHERE id = true;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.minimum_dp_mode_snapshot := setting_row.minimum_dp_mode;
  NEW.minimum_dp_value_snapshot := setting_row.minimum_dp_value;

  raw_minimum := CASE setting_row.minimum_dp_mode
    WHEN 'PERCENTAGE' THEN COALESCE(NEW.price_snapshot, 0) * setting_row.minimum_dp_value / 100
    ELSE setting_row.minimum_dp_value
  END;

  -- Payment storage is numeric(12,2); the Owner rule requires a whole-rupiah
  -- ceiling, so no rounding to thousands is performed.
  NEW.minimum_dp_amount_snapshot := CEIL(raw_minimum);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS finance_snapshot_booking_dp_trigger ON public.transactions;
CREATE TRIGGER finance_snapshot_booking_dp_trigger
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.finance_snapshot_booking_dp();

CREATE OR REPLACE FUNCTION public.finance_booking_payment_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  total_paid numeric;
BEGIN
  IF NEW.status <> 'booking' THEN
    RETURN NEW;
  END IF;

  IF NEW.price_snapshot IS NULL OR NEW.price_snapshot <= 0 THEN
    RAISE EXCEPTION 'Booking wajib memiliki tagihan valid';
  END IF;

  -- Legacy bookings created before the snapshot column existed are not
  -- retroactively reinterpreted by a later Owner setting change.
  IF NEW.minimum_dp_amount_snapshot IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO total_paid
  FROM public.payments p
  WHERE p.transaction_id = NEW.id;

  IF total_paid < NEW.minimum_dp_amount_snapshot THEN
    RAISE EXCEPTION 'Booking wajib memiliki DP minimum sesuai snapshot transaksi';
  END IF;

  IF total_paid > NEW.price_snapshot THEN
    RAISE EXCEPTION 'Total pembayaran melebihi tagihan transaksi';
  END IF;

  RETURN NEW;
END;
$function$;

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

  IF NOT FOUND OR selected_session.status <> 'OPEN' THEN
    RAISE EXCEPTION 'Sesi kas aktif penerima pembayaran tidak ditemukan';
  END IF;

  IF selected_session.opened_by <> NEW.recorded_by
     AND NOT public.finance_is_owner_or_supervisor(NEW.recorded_by) THEN
    RAISE EXCEPTION 'Operator tidak berwenang membantu sesi kas ini';
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

CREATE OR REPLACE FUNCTION public.record_transaction_payment(
  _transaction_id uuid,
  _amount numeric,
  _method text,
  _idempotency_key uuid,
  _session_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_transaction record;
  existing_payment record;
  already_paid numeric;
  remaining_amount numeric;
  new_payment_id uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'owner')
    OR public.is_receptionist(auth.uid())
    OR public.has_employee_position(auth.uid(), ARRAY['supervisor'::public.employee_position])
  ) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  IF _idempotency_key IS NULL
     OR _amount IS NULL
     OR _amount <= 0
     OR _method NOT IN ('Cash', 'QRIS', 'Transfer') THEN
    RAISE EXCEPTION 'Data pembayaran tidak valid';
  END IF;

  SELECT p.id, p.transaction_id, p.amount, p.method
  INTO existing_payment
  FROM public.payments p
  WHERE p.idempotency_key = _idempotency_key;

  IF existing_payment.id IS NOT NULL THEN
    IF existing_payment.transaction_id <> _transaction_id
       OR existing_payment.amount <> _amount
       OR existing_payment.method <> _method THEN
      RAISE EXCEPTION 'Idempotency key sudah digunakan dengan payload berbeda';
    END IF;
    RETURN existing_payment.id;
  END IF;

  SELECT * INTO selected_transaction
  FROM public.transactions
  WHERE id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND OR selected_transaction.status = 'cancelled' THEN
    RAISE EXCEPTION 'Transaksi tidak dapat menerima pembayaran';
  END IF;

  already_paid := COALESCE((SELECT SUM(p.amount) FROM public.payments p WHERE p.transaction_id = _transaction_id), 0);
  remaining_amount := selected_transaction.price_snapshot - already_paid;

  IF remaining_amount <= 0 OR _amount > remaining_amount THEN
    RAISE EXCEPTION 'Nominal pembayaran melebihi sisa tagihan';
  END IF;

  INSERT INTO public.payments (
    transaction_id,
    amount,
    method,
    kind,
    recorded_by,
    idempotency_key,
    cash_session_id
  )
  VALUES (
    _transaction_id,
    _amount,
    _method,
    'payment',
    auth.uid(),
    _idempotency_key,
    _session_id
  )
  ON CONFLICT (idempotency_key)
  WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO new_payment_id;

  IF new_payment_id IS NULL THEN
    SELECT p.id, p.transaction_id, p.amount, p.method
    INTO existing_payment
    FROM public.payments p
    WHERE p.idempotency_key = _idempotency_key;
    IF existing_payment.transaction_id <> _transaction_id
       OR existing_payment.amount <> _amount
       OR existing_payment.method <> _method THEN
      RAISE EXCEPTION 'Idempotency key sudah digunakan dengan payload berbeda';
    END IF;
    RETURN existing_payment.id;
  END IF;

  RETURN new_payment_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.record_finance_expense(uuid, uuid, numeric, text, text, text);
CREATE OR REPLACE FUNCTION public.record_finance_expense(
  _idempotency_key uuid,
  _session_id uuid,
  _amount numeric,
  _method text,
  _category text,
  _note text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  existing_id uuid;
  session_status text;
  session_owner uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'owner')
    OR public.is_receptionist(auth.uid())
    OR public.has_employee_position(auth.uid(), ARRAY['supervisor'::public.employee_position])
  ) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  IF _method IS DISTINCT FROM 'CASH' THEN
    RAISE EXCEPTION 'Kas Keluar hanya menerima pembayaran tunai (CASH)';
  END IF;
  IF _idempotency_key IS NULL OR _session_id IS NULL
     OR _amount IS NULL OR _amount <= 0
     OR length(trim(coalesce(_category, ''))) = 0 THEN
    RAISE EXCEPTION 'Data Kas Keluar tidak valid';
  END IF;

  SELECT id INTO existing_id FROM public.finance_expenses WHERE idempotency_key = _idempotency_key;
  IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;

  SELECT status, opened_by INTO session_status, session_owner
  FROM public.finance_cash_sessions WHERE id = _session_id;
  IF session_status <> 'OPEN' THEN RAISE EXCEPTION 'Sesi kas tidak aktif'; END IF;
  IF session_owner <> auth.uid() AND NOT public.finance_is_owner_or_supervisor(auth.uid()) THEN
    RAISE EXCEPTION 'Operator tidak berwenang membantu sesi kas ini';
  END IF;

  INSERT INTO public.finance_expenses
    (idempotency_key, session_id, amount, method, category, note, recorded_by)
  VALUES (_idempotency_key, _session_id, _amount, _method, trim(_category), trim(coalesce(_note, '')), auth.uid())
  RETURNING id INTO existing_id;
  RETURN existing_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.create_finance_deposit(uuid, uuid, text, numeric, uuid, text);
CREATE OR REPLACE FUNCTION public.create_finance_deposit(
  _idempotency_key uuid,
  _session_id uuid,
  _method text,
  _amount numeric,
  _bank_account_id uuid DEFAULT NULL,
  _proof_ref text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  existing_id uuid;
  session_status text;
  session_owner uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'owner')
    OR public.is_receptionist(auth.uid())
    OR public.has_employee_position(auth.uid(), ARRAY['supervisor'::public.employee_position])
  ) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT id INTO existing_id FROM public.finance_deposits WHERE idempotency_key = _idempotency_key;
  IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;

  SELECT status, opened_by INTO session_status, session_owner
  FROM public.finance_cash_sessions WHERE id = _session_id;
  IF session_status <> 'OPEN' THEN RAISE EXCEPTION 'Setoran hanya dapat dibuat pada sesi kas OPEN'; END IF;
  IF session_owner <> auth.uid() AND NOT public.finance_is_owner_or_supervisor(auth.uid()) THEN
    RAISE EXCEPTION 'Operator tidak berwenang membantu sesi kas ini';
  END IF;
  IF _method = 'Transfer' AND _bank_account_id IS NULL THEN RAISE EXCEPTION 'Rekening Owner wajib dipilih'; END IF;
  IF _method = 'Transfer' AND length(trim(coalesce(_proof_ref, ''))) = 0 THEN RAISE EXCEPTION 'Bukti transfer wajib dicatat'; END IF;

  INSERT INTO public.finance_deposits
    (idempotency_key, session_id, method, amount, bank_account_id, proof_ref, submitted_by)
  VALUES (_idempotency_key, _session_id, _method, _amount, _bank_account_id, trim(coalesce(_proof_ref, '')), auth.uid())
  RETURNING id INTO existing_id;
  RETURN existing_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_finance_session_summary(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE s public.finance_cash_sessions; result jsonb;
BEGIN
  SELECT * INTO s FROM public.finance_cash_sessions WHERE id = _session_id;
  IF NOT FOUND OR (s.opened_by <> auth.uid() AND NOT public.finance_is_owner_or_supervisor(auth.uid()) AND NOT public.has_role(auth.uid(), 'owner')) THEN RAISE EXCEPTION 'Akses sesi ditolak'; END IF;
  SELECT jsonb_build_object(
    'opening_cash', s.opening_cash,
    -- Cash-only ledger balance, can be negative. QRIS/Transfer not mixed in.
    'expected_cash', s.opening_cash
      + COALESCE((SELECT SUM(amount) FROM public.payments WHERE cash_session_id = _session_id AND method = 'Cash'), 0)
      - COALESCE((SELECT SUM(amount) FROM public.finance_expenses WHERE session_id = _session_id AND method = 'CASH'), 0)
      - COALESCE((SELECT SUM(amount) FROM public.finance_refunds WHERE source_session_id = _session_id AND refund_method = 'CASH'), 0),
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

-- Keep the old Booking function untouched in its original migration, but
-- replace its local callable contract with the idempotent/session-aware form.
CREATE OR REPLACE FUNCTION public.create_reservation(
  _mode text,
  _room_id uuid,
  _package_id uuid,
  _name text,
  _phone text,
  _address text,
  _amount numeric,
  _method text,
  _day_mode text,
  _scheduled_check_in timestamptz,
  _idempotency_key uuid,
  _session_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_price numeric(12,2);
  selected_pricing_group text;
  selected_guest uuid;
  selected_transaction uuid;
  number text;
  actual_started_at timestamptz;
  actual_ends_at timestamptz;
  planned_check_in timestamptz;
  planned_check_out timestamptz;
  authoritative_day_mode text;
  operational_date date;
  request_fingerprint text;
  existing_idempotency public.finance_reservation_idempotency;
BEGIN
  IF _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Idempotency key booking wajib diisi';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'owner') OR public.is_receptionist(auth.uid())) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  request_fingerprint := md5(jsonb_build_object(
    'mode', _mode, 'room_id', _room_id, 'package_id', _package_id,
    'name', trim(_name), 'phone', _phone, 'address', trim(_address),
    'amount', _amount, 'method', _method, 'day_mode', _day_mode,
    'scheduled_check_in', _scheduled_check_in, 'session_id', _session_id
  )::text);

  INSERT INTO public.finance_reservation_idempotency
    (idempotency_key, request_fingerprint, created_by)
  VALUES (_idempotency_key, request_fingerprint, auth.uid())
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT * INTO existing_idempotency
  FROM public.finance_reservation_idempotency
  WHERE idempotency_key = _idempotency_key
  FOR UPDATE;

  IF existing_idempotency.request_fingerprint <> request_fingerprint THEN
    RAISE EXCEPTION 'Idempotency key booking sudah digunakan dengan payload berbeda';
  END IF;

  IF existing_idempotency.transaction_id IS NOT NULL THEN
    RETURN existing_idempotency.transaction_number;
  END IF;

  IF _mode IS NULL OR _mode NOT IN ('booking', 'check_in') THEN RAISE EXCEPTION 'Jenis transaksi tidak valid'; END IF;
  IF _method IS NULL OR _method NOT IN ('Cash', 'QRIS', 'Transfer') THEN RAISE EXCEPTION 'Metode pembayaran tidak valid'; END IF;
  IF length(trim(coalesce(_name, ''))) NOT BETWEEN 1 AND 100 OR coalesce(_phone, '') !~ '^[0-9+]{8,16}$' OR length(coalesce(_address, '')) > 500 THEN RAISE EXCEPTION 'Data tamu tidak valid'; END IF;
  IF _mode = 'booking' AND _scheduled_check_in IS NULL THEN RAISE EXCEPTION 'Tanggal dan jam check-in wajib dipilih untuk booking'; END IF;

  IF _mode = 'booking' THEN
    SELECT t.scheduled_check_in, t.scheduled_check_out
    INTO planned_check_in, planned_check_out
    FROM public.calculate_scheduled_booking_times(_package_id, _scheduled_check_in) t;
    IF planned_check_in IS NULL OR planned_check_out IS NULL OR planned_check_out <= planned_check_in THEN
      RAISE EXCEPTION 'Jadwal booking tidak valid';
    END IF;
    operational_date := (planned_check_in AT TIME ZONE 'Asia/Jakarta')::date;
  ELSE
    SELECT t.started_at, t.ends_at
    INTO actual_started_at, actual_ends_at
    FROM public.calculate_package_stay_times(_package_id, now()) t;
    IF actual_started_at IS NULL OR actual_ends_at IS NULL OR actual_ends_at <= actual_started_at THEN
      RAISE EXCEPTION 'Waktu check-in tidak valid';
    END IF;
    operational_date := (actual_started_at AT TIME ZONE 'Asia/Jakarta')::date;
  END IF;

  authoritative_day_mode := public.get_operational_day_mode(operational_date);
  IF authoritative_day_mode IS NULL OR authoritative_day_mode NOT IN ('weekday', 'weekend') THEN
    RAISE EXCEPTION 'Jenis hari operasional tidak valid';
  END IF;

  SELECT rt.pricing_group,
         CASE WHEN authoritative_day_mode = 'weekday' THEN pr.weekday_price ELSE pr.weekend_price END
  INTO selected_pricing_group, selected_price
  FROM public.rooms r
  JOIN public.room_types rt ON rt.id = r.room_type_id
  JOIN public.packages p ON p.id = _package_id AND p.active
  JOIN public.package_room_type_prices pr ON pr.package_id = p.id AND pr.pricing_group = rt.pricing_group
  WHERE r.id = _room_id;

  IF NOT FOUND OR selected_pricing_group IS NULL OR selected_price IS NULL THEN
    RAISE EXCEPTION 'Harga resmi untuk kombinasi kamar dan paket tidak tersedia';
  END IF;

  IF _amount IS NULL OR _amount < 0 OR _amount > selected_price THEN
    RAISE EXCEPTION 'Nominal pembayaran tidak valid';
  END IF;
  IF _mode = 'check_in' AND _amount <> selected_price THEN
    RAISE EXCEPTION 'Check-in langsung harus dibayar lunas';
  END IF;

  PERFORM 1 FROM public.rooms WHERE id = _room_id AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak aktif atau tidak tersedia'; END IF;

  IF _mode = 'booking' THEN
    IF EXISTS (
      SELECT 1 FROM public.transactions tr
      WHERE tr.room_id = _room_id AND tr.status = 'booking'
        AND tr.scheduled_check_in IS NOT NULL AND tr.scheduled_check_out IS NOT NULL
        AND tr.scheduled_check_in < planned_check_out
        AND tr.scheduled_check_out > planned_check_in
    ) THEN RAISE EXCEPTION 'Jadwal kamar bentrok dengan booking lain'; END IF;
  ELSE
    UPDATE public.rooms SET status = 'occupied'
    WHERE id = _room_id AND status = 'ready' AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak tersedia untuk check-in'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.transactions tr
      WHERE tr.room_id = _room_id AND tr.status = 'booking'
        AND tr.scheduled_check_in IS NOT NULL AND tr.scheduled_check_out IS NOT NULL
        AND tr.scheduled_check_in < actual_ends_at
        AND tr.scheduled_check_out > actual_started_at
    ) THEN RAISE EXCEPTION 'Waktu check-in bentrok dengan booking terjadwal'; END IF;
  END IF;

  SELECT id INTO selected_guest FROM public.guests WHERE phone = _phone;
  IF selected_guest IS NULL THEN
    IF length(trim(coalesce(_address, ''))) = 0 THEN RAISE EXCEPTION 'Alamat wajib diisi untuk tamu baru'; END IF;
    INSERT INTO public.guests (full_name, address, phone)
    VALUES (trim(_name), trim(_address), _phone)
    RETURNING id INTO selected_guest;
  END IF;

  INSERT INTO public.transactions (
    guest_id, room_id, package_id, status, created_by, price_snapshot,
    day_mode, scheduled_check_in, scheduled_check_out, started_at, ends_at
  ) VALUES (
    selected_guest, _room_id, _package_id, _mode::public.transaction_status,
    auth.uid(), selected_price, authoritative_day_mode,
    CASE WHEN _mode = 'booking' THEN planned_check_in END,
    CASE WHEN _mode = 'booking' THEN planned_check_out END,
    CASE WHEN _mode = 'check_in' THEN actual_started_at END,
    CASE WHEN _mode = 'check_in' THEN actual_ends_at END
  ) RETURNING id, transaction_number INTO selected_transaction, number;

  IF _amount > 0 THEN
    INSERT INTO public.payments (
      transaction_id, amount, method, kind, recorded_by,
      idempotency_key, cash_session_id
    ) VALUES (
      selected_transaction, _amount, _method,
      CASE WHEN _mode = 'booking' THEN 'dp' ELSE 'payment' END,
      auth.uid(), _idempotency_key, _session_id
    );
  END IF;

  UPDATE public.finance_reservation_idempotency
  SET transaction_id = selected_transaction,
      transaction_number = number
  WHERE idempotency_key = _idempotency_key;

  RETURN number;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_transaction_payment(uuid, numeric, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_transaction_payment(uuid, numeric, text, uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.create_reservation(text, uuid, uuid, text, text, text, numeric, text, text, timestamptz, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reservation(text, uuid, uuid, text, text, text, numeric, text, text, timestamptz, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_snapshot_booking_dp() TO postgres;
GRANT EXECUTE ON FUNCTION public.finance_booking_payment_guard() TO postgres;

ALTER TABLE public.finance_reservation_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.finance_reservation_idempotency FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.finance_reservation_idempotency TO authenticated;
DROP POLICY IF EXISTS finance_reservation_idempotency_read ON public.finance_reservation_idempotency;
CREATE POLICY finance_reservation_idempotency_read
ON public.finance_reservation_idempotency
FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.finance_is_owner_or_supervisor(auth.uid()));

-- Refunds may reference payments from a FINAL session, but a cash source
-- session used to fund the refund must remain OPEN. OWNER_FUNDS has no source
-- session and therefore does not mutate the original closing.
CREATE OR REPLACE FUNCTION public.finance_refund_source_session_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  source_status text;
BEGIN
  IF NEW.source_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status INTO source_status
  FROM public.finance_cash_sessions
  WHERE id = NEW.source_session_id;

  IF source_status IS DISTINCT FROM 'OPEN' THEN
    RAISE EXCEPTION 'Sumber dana refund harus berasal dari sesi kas OPEN';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS finance_refund_source_session_guard_trigger ON public.finance_refunds;
CREATE TRIGGER finance_refund_source_session_guard_trigger
BEFORE INSERT ON public.finance_refunds
FOR EACH ROW
EXECUTE FUNCTION public.finance_refund_source_session_guard();

-- Finance 150: align the approved Supervisor operating role.
-- This migration extends only the approved operational paths and SELECT RLS.
CREATE OR REPLACE FUNCTION public.finance_is_booking_operator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.has_role(_user_id, 'owner')
    OR public.is_receptionist(_user_id)
    OR public.has_employee_position(
      _user_id,
      ARRAY['supervisor'::public.employee_position]
    );
$function$;

REVOKE ALL ON FUNCTION public.finance_is_booking_operator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_is_booking_operator(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.open_finance_cash_session(_opening_cash numeric DEFAULT 0)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  previous_session public.finance_cash_sessions;
  carried_amount numeric := 0;
  new_id uuid;
BEGIN
  IF NOT public.finance_is_booking_operator(auth.uid()) THEN
    RAISE EXCEPTION 'Hanya Owner, Receptionist, atau Supervisor yang dapat membuka sesi kas';
  END IF;

  IF _opening_cash < 0 THEN
    RAISE EXCEPTION 'Saldo awal tidak valid';
  END IF;

  SELECT * INTO previous_session
  FROM public.finance_cash_sessions s
  WHERE s.opened_by = auth.uid()
    AND s.status = 'FINAL'
  ORDER BY s.closed_at DESC NULLS LAST
  LIMIT 1;

  IF previous_session.id IS NOT NULL THEN
    SELECT COALESCE(SUM(a.amount), 0)
    INTO carried_amount
    FROM public.finance_session_allocations a
    WHERE a.session_id = previous_session.id
      AND a.allocation_type = 'DIBAWA';
  END IF;

  INSERT INTO public.finance_cash_sessions (
    opened_by,
    opening_cash,
    opening_source_session_id
  )
  VALUES (
    auth.uid(),
    CASE WHEN previous_session.id IS NOT NULL THEN carried_amount ELSE _opening_cash END,
    CASE WHEN previous_session.id IS NOT NULL THEN previous_session.id ELSE NULL END
  )
  RETURNING id INTO new_id;

  RETURN new_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Masih ada sesi kas aktif untuk pengguna ini';
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_in_booking(_transaction_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_transaction record;
  selected_package record;
  actual_started_at timestamptz;
  actual_ends_at timestamptz;
  already_paid numeric(12,2);
  jakarta_now timestamp;
  scheduled_local timestamp;
BEGIN
  IF NOT public.finance_is_booking_operator(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT
    id,
    transaction_number,
    guest_id,
    room_id,
    package_id,
    status,
    price_snapshot,
    day_mode,
    scheduled_check_in
  INTO selected_transaction
  FROM public.transactions
  WHERE id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  IF selected_transaction.status <> 'booking' THEN RAISE EXCEPTION 'Transaksi tidak dapat di-check-in'; END IF;
  IF selected_transaction.guest_id IS NULL OR selected_transaction.room_id IS NULL OR selected_transaction.package_id IS NULL THEN
    RAISE EXCEPTION 'Data transaksi tidak lengkap';
  END IF;
  IF selected_transaction.scheduled_check_in IS NULL THEN RAISE EXCEPTION 'Jadwal check-in booking belum ditentukan'; END IF;
  IF selected_transaction.day_mode IS NULL OR selected_transaction.day_mode NOT IN ('weekday', 'weekend') THEN
    RAISE EXCEPTION 'Weekday/Weekend transaksi belum ditentukan';
  END IF;
  IF selected_transaction.price_snapshot IS NULL OR selected_transaction.price_snapshot < 0 THEN
    RAISE EXCEPTION 'Harga transaksi belum tersimpan';
  END IF;

  SELECT p.id, p.name, p.time_mode
  INTO selected_package
  FROM public.packages p
  WHERE p.id = selected_transaction.package_id
    AND p.active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paket tidak tersedia'; END IF;

  jakarta_now := now() AT TIME ZONE 'Asia/Jakarta';
  scheduled_local := selected_transaction.scheduled_check_in AT TIME ZONE 'Asia/Jakarta';
  IF jakarta_now::date < scheduled_local::date THEN
    RAISE EXCEPTION 'Belum waktunya check-in. Jadwal booking belum tiba';
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO already_paid
  FROM public.payments
  WHERE transaction_id = selected_transaction.id;
  IF already_paid < selected_transaction.price_snapshot THEN RAISE EXCEPTION 'Sisa pembayaran harus dilunasi sebelum check-in'; END IF;
  IF already_paid > selected_transaction.price_snapshot THEN RAISE EXCEPTION 'Total pembayaran melebihi tagihan transaksi'; END IF;

  SELECT t.started_at, t.ends_at
  INTO actual_started_at, actual_ends_at
  FROM public.calculate_package_stay_times(selected_transaction.package_id, now()) t;

  UPDATE public.rooms
  SET status = 'occupied'
  WHERE id = selected_transaction.room_id
    AND status = 'ready'
    AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak tersedia'; END IF;

  UPDATE public.transactions
  SET status = 'check_in', started_at = actual_started_at, ends_at = actual_ends_at
  WHERE id = selected_transaction.id;

  RETURN selected_transaction.transaction_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_reservation(
  _mode text,
  _room_id uuid,
  _package_id uuid,
  _name text,
  _phone text,
  _address text,
  _amount numeric,
  _method text,
  _day_mode text,
  _scheduled_check_in timestamptz,
  _idempotency_key uuid,
  _session_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_price numeric(12,2);
  selected_pricing_group text;
  selected_guest uuid;
  selected_transaction uuid;
  number text;
  actual_started_at timestamptz;
  actual_ends_at timestamptz;
  planned_check_in timestamptz;
  planned_check_out timestamptz;
  authoritative_day_mode text;
  operational_date date;
  request_fingerprint text;
  existing_idempotency public.finance_reservation_idempotency;
BEGIN
  IF _idempotency_key IS NULL THEN RAISE EXCEPTION 'Idempotency key booking wajib diisi'; END IF;
  IF NOT public.finance_is_booking_operator(auth.uid()) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;

  request_fingerprint := md5(jsonb_build_object(
    'mode', _mode, 'room_id', _room_id, 'package_id', _package_id,
    'name', trim(_name), 'phone', _phone, 'address', trim(_address),
    'amount', _amount, 'method', _method, 'day_mode', _day_mode,
    'scheduled_check_in', _scheduled_check_in, 'session_id', _session_id
  )::text);

  INSERT INTO public.finance_reservation_idempotency
    (idempotency_key, request_fingerprint, created_by)
  VALUES (_idempotency_key, request_fingerprint, auth.uid())
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT * INTO existing_idempotency
  FROM public.finance_reservation_idempotency
  WHERE idempotency_key = _idempotency_key
  FOR UPDATE;

  IF existing_idempotency.request_fingerprint <> request_fingerprint THEN
    RAISE EXCEPTION 'Idempotency key booking sudah digunakan dengan payload berbeda';
  END IF;
  IF existing_idempotency.transaction_id IS NOT NULL THEN RETURN existing_idempotency.transaction_number; END IF;

  IF _mode IS NULL OR _mode NOT IN ('booking', 'check_in') THEN RAISE EXCEPTION 'Jenis transaksi tidak valid'; END IF;
  IF _method IS NULL OR _method NOT IN ('Cash', 'QRIS', 'Transfer') THEN RAISE EXCEPTION 'Metode pembayaran tidak valid'; END IF;
  IF length(trim(coalesce(_name, ''))) NOT BETWEEN 1 AND 100 OR coalesce(_phone, '') !~ '^[0-9+]{8,16}$' OR length(coalesce(_address, '')) > 500 THEN
    RAISE EXCEPTION 'Data tamu tidak valid';
  END IF;
  IF _mode = 'booking' AND _scheduled_check_in IS NULL THEN RAISE EXCEPTION 'Tanggal dan jam check-in wajib dipilih untuk booking'; END IF;

  IF _mode = 'booking' THEN
    SELECT t.scheduled_check_in, t.scheduled_check_out
    INTO planned_check_in, planned_check_out
    FROM public.calculate_scheduled_booking_times(_package_id, _scheduled_check_in) t;
    IF planned_check_in IS NULL OR planned_check_out IS NULL OR planned_check_out <= planned_check_in THEN RAISE EXCEPTION 'Jadwal booking tidak valid'; END IF;
    operational_date := (planned_check_in AT TIME ZONE 'Asia/Jakarta')::date;
  ELSE
    SELECT t.started_at, t.ends_at
    INTO actual_started_at, actual_ends_at
    FROM public.calculate_package_stay_times(_package_id, now()) t;
    IF actual_started_at IS NULL OR actual_ends_at IS NULL OR actual_ends_at <= actual_started_at THEN RAISE EXCEPTION 'Waktu check-in tidak valid'; END IF;
    operational_date := (actual_started_at AT TIME ZONE 'Asia/Jakarta')::date;
  END IF;

  authoritative_day_mode := public.get_operational_day_mode(operational_date);
  IF authoritative_day_mode IS NULL OR authoritative_day_mode NOT IN ('weekday', 'weekend') THEN RAISE EXCEPTION 'Jenis hari operasional tidak valid'; END IF;

  SELECT rt.pricing_group,
         CASE WHEN authoritative_day_mode = 'weekday' THEN pr.weekday_price ELSE pr.weekend_price END
  INTO selected_pricing_group, selected_price
  FROM public.rooms r
  JOIN public.room_types rt ON rt.id = r.room_type_id
  JOIN public.packages p ON p.id = _package_id AND p.active
  JOIN public.package_room_type_prices pr ON pr.package_id = p.id AND pr.pricing_group = rt.pricing_group
  WHERE r.id = _room_id;
  IF NOT FOUND OR selected_pricing_group IS NULL OR selected_price IS NULL THEN RAISE EXCEPTION 'Harga resmi untuk kombinasi kamar dan paket tidak tersedia'; END IF;
  IF _amount IS NULL OR _amount < 0 OR _amount > selected_price THEN RAISE EXCEPTION 'Nominal pembayaran tidak valid'; END IF;
  IF _mode = 'check_in' AND _amount <> selected_price THEN RAISE EXCEPTION 'Check-in langsung harus dibayar lunas'; END IF;

  PERFORM 1 FROM public.rooms WHERE id = _room_id AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak aktif atau tidak tersedia'; END IF;
  IF _mode = 'booking' THEN
    IF EXISTS (
      SELECT 1 FROM public.transactions tr
      WHERE tr.room_id = _room_id AND tr.status = 'booking'
        AND tr.scheduled_check_in IS NOT NULL AND tr.scheduled_check_out IS NOT NULL
        AND tr.scheduled_check_in < planned_check_out AND tr.scheduled_check_out > planned_check_in
    ) THEN RAISE EXCEPTION 'Jadwal kamar bentrok dengan booking lain'; END IF;
  ELSE
    UPDATE public.rooms SET status = 'occupied' WHERE id = _room_id AND status = 'ready' AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak tersedia untuk check-in'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.transactions tr
      WHERE tr.room_id = _room_id AND tr.status = 'booking'
        AND tr.scheduled_check_in IS NOT NULL AND tr.scheduled_check_out IS NOT NULL
        AND tr.scheduled_check_in < actual_ends_at AND tr.scheduled_check_out > actual_started_at
    ) THEN RAISE EXCEPTION 'Waktu check-in bentrok dengan booking terjadwal'; END IF;
  END IF;

  SELECT id INTO selected_guest FROM public.guests WHERE phone = _phone;
  IF selected_guest IS NULL THEN
    IF length(trim(coalesce(_address, ''))) = 0 THEN RAISE EXCEPTION 'Alamat wajib diisi untuk tamu baru'; END IF;
    INSERT INTO public.guests (full_name, address, phone)
    VALUES (trim(_name), trim(_address), _phone)
    RETURNING id INTO selected_guest;
  END IF;

  INSERT INTO public.transactions (
    guest_id, room_id, package_id, status, created_by, price_snapshot,
    day_mode, scheduled_check_in, scheduled_check_out, started_at, ends_at
  ) VALUES (
    selected_guest, _room_id, _package_id, _mode::public.transaction_status,
    auth.uid(), selected_price, authoritative_day_mode,
    CASE WHEN _mode = 'booking' THEN planned_check_in END,
    CASE WHEN _mode = 'booking' THEN planned_check_out END,
    CASE WHEN _mode = 'check_in' THEN actual_started_at END,
    CASE WHEN _mode = 'check_in' THEN actual_ends_at END
  ) RETURNING id, transaction_number INTO selected_transaction, number;

  IF _amount > 0 THEN
    INSERT INTO public.payments (
      transaction_id, amount, method, kind, recorded_by, idempotency_key, cash_session_id
    ) VALUES (
      selected_transaction, _amount, _method,
      CASE WHEN _mode = 'booking' THEN 'dp' ELSE 'payment' END,
      auth.uid(), _idempotency_key, _session_id
    );
  END IF;

  UPDATE public.finance_reservation_idempotency
  SET transaction_id = selected_transaction, transaction_number = number
  WHERE idempotency_key = _idempotency_key;
  RETURN number;
END;
$function$;

-- Operational read access for the approved Supervisor role.
DROP POLICY IF EXISTS guests_supervisor_read ON public.guests;
CREATE POLICY guests_supervisor_read ON public.guests
FOR SELECT TO authenticated
USING (public.has_employee_position(auth.uid(), ARRAY['supervisor'::public.employee_position]));

DROP POLICY IF EXISTS transactions_supervisor_read ON public.transactions;
CREATE POLICY transactions_supervisor_read ON public.transactions
FOR SELECT TO authenticated
USING (public.has_employee_position(auth.uid(), ARRAY['supervisor'::public.employee_position]));

DROP POLICY IF EXISTS payments_supervisor_read ON public.payments;
CREATE POLICY payments_supervisor_read ON public.payments
FOR SELECT TO authenticated
USING (public.has_employee_position(auth.uid(), ARRAY['supervisor'::public.employee_position]));

DROP POLICY IF EXISTS employees_supervisor_read ON public.employees;
CREATE POLICY employees_supervisor_read ON public.employees
FOR SELECT TO authenticated
USING (public.has_employee_position(auth.uid(), ARRAY['supervisor'::public.employee_position]));

DROP POLICY IF EXISTS finance_bank_accounts_supervisor_read ON public.finance_bank_accounts;
CREATE POLICY finance_bank_accounts_supervisor_read ON public.finance_bank_accounts
FOR SELECT TO authenticated
USING (public.has_employee_position(auth.uid(), ARRAY['supervisor'::public.employee_position]));


GRANT EXECUTE ON FUNCTION public.create_reservation(text, uuid, uuid, text, text, text, numeric, text, text, timestamptz, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_finance_cash_session(numeric) TO authenticated;

-- Booking reference-data privilege correction.
-- RLS remains authoritative; authenticated users receive read-only access only.
GRANT SELECT ON TABLE public.package_room_type_prices TO authenticated;
GRANT SELECT ON TABLE public.operational_calendar TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_operational_day_mode(date) TO authenticated;

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.package_room_type_prices, public.operational_calendar
FROM PUBLIC, anon, authenticated;



-- Exactly one deterministic 8% seed for future Finance events.
-- The Owner identity comes only from app.owner_user_id, validated above.
INSERT INTO public.finance_commission_configs (
  mode, rate, per_room_amount, rounding_rule, effective_from, created_by
)
SELECT 'PERCENTAGE', 8, 0, 'FLOOR_RP1000', now(),
       NULLIF(current_setting('app.owner_user_id', true), '')::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.finance_commission_configs
);

-- Owner decision 21 Oct 2026: new bookings require a minimum DP of 40%.
-- Applies prospectively via booking DP snapshot/guard; prior bookings untouched.
UPDATE public.finance_settings
SET minimum_dp_mode = 'PERCENTAGE',
    minimum_dp_value = 40,
    updated_by = NULLIF(current_setting('app.owner_user_id', true), '')::uuid,
    updated_at = now()
WHERE id = true
  AND minimum_dp_mode = 'AMOUNT'
  AND minimum_dp_value = 0;

DO $owner_dp_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.finance_settings
    WHERE id = true
      AND minimum_dp_mode = 'PERCENTAGE'
      AND minimum_dp_value = 40
  ) THEN
    RAISE EXCEPTION 'Owner-approved Booking minimum DP 40 percent was not set';
  END IF;
END
$owner_dp_check$;

-- Preserve the original three-argument payment RPC for existing app callers.
CREATE OR REPLACE FUNCTION public.record_transaction_payment(
  _transaction_id uuid,
  _amount numeric,
  _method text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN public.record_transaction_payment(
    _transaction_id, _amount, _method, gen_random_uuid(), NULL::uuid
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_transaction_payment(
  _transaction_id uuid,
  _amount numeric,
  _method text,
  _idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN public.record_transaction_payment(
    _transaction_id, _amount, _method, _idempotency_key, NULL::uuid
  );
END;
$function$;

-- PostgreSQL cannot remove defaults with CREATE OR REPLACE. Drop the legacy
-- signature explicitly before recreating it as an unambiguous wrapper.
DROP FUNCTION IF EXISTS public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz);
-- SECURITY DEFINER RPCs must never inherit PUBLIC/anon EXECUTE.
REVOKE ALL ON FUNCTION public.record_transaction_payment(uuid,numeric,text,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_transaction_payment(uuid,numeric,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_transaction_payment(uuid,numeric,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.check_in_booking(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_is_owner_or_supervisor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_finance_cash_session(numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_finance_cash_session(uuid,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_finance_expense(uuid,uuid,numeric,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_finance_deposit(uuid,uuid,text,numeric,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_finance_deposit(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_finance_settings(text,numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_finance_commission_config(text,numeric,numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_finance_bank_account(uuid,text,text,text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_finance_refund(uuid,uuid,numeric,text,text,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_finance_session_summary(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_finance_drawer_handover(uuid,numeric,text) FROM PUBLIC, anon;
CREATE OR REPLACE FUNCTION public.create_reservation(
  _mode text,
  _room_id uuid,
  _package_id uuid,
  _name text,
  _phone text,
  _address text,
  _amount numeric,
  _method text,
  _day_mode text,
  _scheduled_check_in timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  active_session uuid;
BEGIN
  SELECT id INTO active_session
  FROM public.finance_cash_sessions
  WHERE opened_by = auth.uid()
    AND status = 'OPEN'
  ORDER BY opened_at DESC
  LIMIT 1;

  RETURN public.create_reservation(
    _mode, _room_id, _package_id, _name, _phone, _address, _amount,
    _method, _day_mode, _scheduled_check_in, gen_random_uuid(), active_session
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_transaction_payment(uuid,numeric,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_transaction_payment(uuid,numeric,text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.record_transaction_payment(uuid,numeric,text,uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_transaction_payment(uuid,numeric,text,uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz)
  TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_employee_position(uuid, public.employee_position[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_receptionist(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_frontdesk(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_housekeeping(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_operate(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_finance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_operations(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_employee_position(uuid, public.employee_position[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_receptionist(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_frontdesk(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_housekeeping(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_operate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_finance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_operations(uuid) TO authenticated;

-- Final privilege boundary: apply after every CREATE/GRANT in this patch.
REVOKE ALL ON FUNCTION public.finance_is_booking_operator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_is_booking_operator(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finance_is_owner_or_supervisor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_is_owner_or_supervisor(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.record_transaction_payment(uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_transaction_payment(uuid,numeric,text) TO authenticated;
REVOKE ALL ON FUNCTION public.record_transaction_payment(uuid,numeric,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_transaction_payment(uuid,numeric,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.record_transaction_payment(uuid,numeric,text,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_transaction_payment(uuid,numeric,text,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.check_in_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.open_finance_cash_session(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_finance_cash_session(numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.close_finance_cash_session(uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_finance_cash_session(uuid,jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION public.record_finance_expense(uuid,uuid,numeric,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_finance_expense(uuid,uuid,numeric,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_finance_deposit(uuid,uuid,text,numeric,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_finance_deposit(uuid,uuid,text,numeric,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.decide_finance_deposit(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_finance_deposit(uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.set_finance_settings(text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_finance_settings(text,numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.set_finance_commission_config(text,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_finance_commission_config(text,numeric,numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.upsert_finance_bank_account(uuid,text,text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_finance_bank_account(uuid,text,text,text,text,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.create_finance_refund(uuid,uuid,numeric,text,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_finance_refund(uuid,uuid,numeric,text,text,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_finance_session_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_session_summary(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.confirm_finance_drawer_handover(uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_finance_drawer_handover(uuid,numeric,text) TO authenticated;
DO $postcheck$
BEGIN
  IF (SELECT count(*) FROM public.transactions) <> 9
     OR (SELECT count(*) FROM public.payments) <> 11
     OR (SELECT count(*) FROM public.employees) <> 7
     OR (SELECT count(*) FROM public.user_roles) <> 9 THEN
    RAISE EXCEPTION 'Core row-count preservation postcheck failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.transactions t
    FULL OUTER JOIN _finance_patch_transactions s ON s.id = t.id
    WHERE t.id IS NULL OR s.id IS NULL
       OR t.transaction_number IS DISTINCT FROM s.transaction_number
       OR t.status IS DISTINCT FROM s.status
       OR t.price_snapshot IS DISTINCT FROM s.price_snapshot
       OR t.package_id IS DISTINCT FROM s.package_id
       OR t.day_mode IS DISTINCT FROM s.day_mode
       OR t.scheduled_check_in IS DISTINCT FROM s.scheduled_check_in
       OR t.scheduled_check_out IS DISTINCT FROM s.scheduled_check_out
       OR t.started_at IS DISTINCT FROM s.started_at
       OR t.ends_at IS DISTINCT FROM s.ends_at
       OR t.created_by IS DISTINCT FROM s.created_by
  ) THEN
    RAISE EXCEPTION 'Transaction preservation postcheck failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payments p
    FULL OUTER JOIN _finance_patch_payments s ON s.id = p.id
    WHERE p.id IS NULL OR s.id IS NULL
       OR p.transaction_id IS DISTINCT FROM s.transaction_id
       OR p.amount IS DISTINCT FROM s.amount
       OR p.method IS DISTINCT FROM s.method
       OR p.kind IS DISTINCT FROM s.kind
       OR p.created_at IS DISTINCT FROM s.created_at
       OR p.recorded_by IS DISTINCT FROM s.recorded_by
  ) THEN
    RAISE EXCEPTION 'Payment preservation postcheck failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.packages p
    FULL OUTER JOIN _finance_patch_packages s ON s.id = p.id
    WHERE p.id IS NULL OR s.id IS NULL
       OR p.name IS DISTINCT FROM s.name
       OR p.price IS DISTINCT FROM s.price
       OR p.weekday_price IS DISTINCT FROM s.weekday_price
       OR p.weekend_price IS DISTINCT FROM s.weekend_price
       OR p.duration_minutes IS DISTINCT FROM s.duration_minutes
       OR p.active IS DISTINCT FROM s.active
  ) THEN
    RAISE EXCEPTION 'Package/P4 preservation postcheck failed';
  END IF;


  IF to_regprocedure('public.record_transaction_payment(uuid,numeric,text)') IS NULL
     OR to_regprocedure('public.record_transaction_payment(uuid,numeric,text,uuid)') IS NULL
     OR to_regprocedure('public.record_transaction_payment(uuid,numeric,text,uuid,uuid)') IS NULL
     OR to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz)') IS NULL
     OR to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Legacy/new payment or reservation signature is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid IN (
      to_regprocedure('public.record_transaction_payment(uuid,numeric,text)'),
      to_regprocedure('public.record_transaction_payment(uuid,numeric,text,uuid)'),
      to_regprocedure('public.record_transaction_payment(uuid,numeric,text,uuid,uuid)'),
      to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz)'),
      to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid)')
    )
    AND pronargdefaults <> 0
  ) THEN
    RAISE EXCEPTION 'Legacy/new compatibility functions must not use default arguments';
  END IF;

  IF to_regprocedure('public.finance_is_booking_operator(uuid)') IS NULL
     OR to_regprocedure('public.open_finance_cash_session(numeric)') IS NULL
     OR to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid)') IS NULL
     OR to_regprocedure('public.check_in_booking(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Finance compatibility function postcheck failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.finance_settings
    WHERE id = true
      AND minimum_dp_mode = 'PERCENTAGE'
      AND minimum_dp_value = 40
  ) THEN
    RAISE EXCEPTION 'Owner-approved minimum DP 40 percent postcheck failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.finance_commission_configs
    WHERE mode = 'PERCENTAGE'
      AND rate = 8
  ) THEN
    RAISE EXCEPTION 'Owner commission 8 percent postcheck failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transactions'
      AND cmd = 'INSERT'
      AND (
        coalesce(with_check, '') ILIKE '%supervisor%'
        OR coalesce(with_check, '') ILIKE '%has_employee_position%'
      )
  ) THEN
    RAISE EXCEPTION 'Supervisor direct transaction INSERT policy detected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'public.finance_is_booking_operator(uuid)'::regprocedure,
      'public.record_transaction_payment(uuid,numeric,text)'::regprocedure,
      'public.record_transaction_payment(uuid,numeric,text,uuid)'::regprocedure,
      'public.record_transaction_payment(uuid,numeric,text,uuid,uuid)'::regprocedure,
      'public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz)'::regprocedure,
      'public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid)'::regprocedure,
      'public.check_in_booking(uuid)'::regprocedure,
      'public.open_finance_cash_session(numeric)'::regprocedure,
      'public.close_finance_cash_session(uuid,jsonb,text)'::regprocedure,
      'public.record_finance_expense(uuid,uuid,numeric,text,text,text)'::regprocedure,
      'public.create_finance_deposit(uuid,uuid,text,numeric,uuid,text)'::regprocedure,
      'public.decide_finance_deposit(uuid,text,text)'::regprocedure,
      'public.set_finance_settings(text,numeric)'::regprocedure,
      'public.set_finance_commission_config(text,numeric,numeric)'::regprocedure,
      'public.upsert_finance_bank_account(uuid,text,text,text,text,boolean)'::regprocedure,
      'public.create_finance_refund(uuid,uuid,numeric,text,text,uuid,text)'::regprocedure,
      'public.get_finance_session_summary(uuid)'::regprocedure,
      'public.confirm_finance_drawer_handover(uuid,numeric,text)'::regprocedure
    ]::regprocedure[]) AS fn(proc)
    WHERE has_function_privilege('anon', fn.proc, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'Anonymous Finance RPC EXECUTE remains granted';
  END IF;
  IF has_function_privilege(
       'anon',
       'public.finance_is_booking_operator(uuid)'::regprocedure,
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Anonymous Finance helper EXECUTE remains granted';
  END IF;
END
$postcheck$;

COMMIT;

-- Restore checklist after an approved run:
-- 1. Record commit timestamp and migration ledger hash.
-- 2. Confirm DB/Auth backup identifier and restore capability.
-- 3. Confirm 9 transactions, 11 payments, 7 employees, 9 roles.
-- 4. Confirm no price/P4 snapshot changed.
-- 5. Confirm Owner/Supervisor authenticated access before any isolated smoke test.
-- 6. If any postcheck fails, abort transaction; after commit, restore verified
--    DB/Auth backup or use an approved forward-fix. Never use blind down SQL.

