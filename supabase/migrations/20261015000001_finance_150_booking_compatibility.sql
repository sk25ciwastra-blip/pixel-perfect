-- Finance 150 local follow-up only.
-- This migration is intentionally separate from the Booking baseline and
-- must not be executed in Cloud/Staging without Owner approval.

BEGIN;

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

-- Seed the Owner-approved default only when the singleton has never been changed.
UPDATE public.finance_settings
SET minimum_dp_mode = 'PERCENTAGE',
    minimum_dp_value = 40,
    updated_at = now()
WHERE id = true
  AND updated_by IS NULL
  AND minimum_dp_mode = 'AMOUNT'
  AND minimum_dp_value = 0;

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

DROP FUNCTION IF EXISTS public.record_transaction_payment(uuid, numeric, text, uuid);
CREATE OR REPLACE FUNCTION public.record_transaction_payment(
  _transaction_id uuid,
  _amount numeric,
  _method text,
  _idempotency_key uuid DEFAULT NULL,
  _session_id uuid DEFAULT NULL
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
DROP FUNCTION IF EXISTS public.create_reservation(text, uuid, uuid, text, text, text, numeric, text, text, timestamptz);
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
  _scheduled_check_in timestamptz DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL,
  _session_id uuid DEFAULT NULL
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

COMMIT;
